// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خدمة التطبيق: ترحيل فاتورة مبيعات (قيد + حركات مخزون)             [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  UI/Legacy ──▶ [هذا الملف] ──▶ Domain (بناء + تحقّق) ──▶ Repository (ذرّي) ──▶ RTDB ║
// ║                                                                              ║
// ║  🔒 محايدة عن التخزين تماماً — لا Firebase هنا، فقط عقود المستودعات (نفس نمط     ║
// ║  Phase 6/7-B). لا DOM ولا `toast`/`window.*` — نتيجة أو خطأ مُصنَّف فقط.          ║
// ║                                                                              ║
// ║  ═══ الفروق المقصودة عن القديم (كلها مُصنَّفة C ومُختبَرة) ═══                    ║
// ║  C1 — **لا إنشاء حسابات إطلاقاً.** القديم يستدعي `ensureStdAccount` حتى 6 مرّات   ║
// ║       أثناء الترحيل (BUG-006: غير idempotent تحت التزامن، والمخطط الحالي لا      ║
// ║       يدعم فرادة `code`). هنا: حلّ الموجود فقط، ورفض صريح بـMissingAccountError. ║
// ║  C2 — **الضريبة لا تُضمّ للإيراد أبداً.** القديم عند غياب 2140 يضمّ الضريبة إلى    ║
// ║       الإيراد (إيراد منتفخ + إقرار ضريبي خاطئ). هنا: رفض الترحيل.               ║
// ║  C3 — **الاحتجاز/الدفعة المقدمة لا يُسقَطان بصمت.** القديم يُصفّرهما عند غياب      ║
// ║       1131/2150 فتبقى المبالغ على ذمّة العميل خطأً. هنا: رفض الترحيل.            ║
// ║  ما عدا ذلك: القيد وحركات المخزون **مطابقان حرفياً** للقديم (Golden Master).      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildSalesInvoiceJournal, MATERIALITY } from '../../../domain/accounting/posting/buildSalesInvoiceJournal.js';
import { resolveCustomerReceivableAccountCode } from '../../../domain/accounting/posting/resolveCustomerReceivableAccount.js';
import { salesRevenueAccountCandidates } from '../../../domain/accounting/posting/resolveSalesRevenueAccount.js';
import { assertBalanced } from '../../../domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../../domain/accounting/posting/validateJournal.js';
import { planSalesInvoiceMovements, withMovementNumbers } from '../../../domain/inventory/planSalesInvoiceMovements.js';
import { buildIdempotencyKey } from '../idempotency/idempotencyKey.js';
import { ValidationError, MissingAccountError } from '../errors/ValidationError.js';

const PLACEHOLDER_NUMBER = '__PENDING__';  // لا يُكتب أبداً — يُستبدَل قبل أي كتابة فعلية
const FALLBACK_RECEIVABLE = '1130';
const OUTPUT_VAT_CODE = '2140';
const RETENTION_CODE = '1131';
const ADVANCE_CODE = '2150';

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {object} deps
 * @param {import('../../../repositories/contracts/ChartOfAccountsRepository.js').ChartOfAccountsRepository} deps.chartOfAccountsRepo
 * @param {import('../../../repositories/contracts/SalesInvoicePostingRepository.js').SalesInvoicePostingRepository} deps.salesInvoicePostingRepo
 * @param {(key:string)=>Promise<object|null>} deps.getInvoice
 * @param {(id:string)=>Promise<object|null>} [deps.getCustomer]
 * @param {()=>Promise<{items:object, movements:object, warehouses:object}>} [deps.getInventorySnapshot]
 * @param {object} [deps.cfg]  { baseCurrencyCode, arApMode }
 * @param {{uid:string}} [deps.currentUser]
 * @param {()=>string} [deps.now]
 */
export function createPostSalesInvoiceService(deps) {
    const {
        chartOfAccountsRepo, salesInvoicePostingRepo, getInvoice,
        getCustomer = async () => null,
        getInventorySnapshot = async () => ({ items: {}, movements: {}, warehouses: {} }),
        cfg = {}, currentUser, now = () => new Date().toISOString()
    } = deps;

    if (!chartOfAccountsRepo) throw new Error('chartOfAccountsRepo مطلوب');
    if (!salesInvoicePostingRepo) throw new Error('salesInvoicePostingRepo مطلوب');
    if (!getInvoice) throw new Error('getInvoice مطلوب');

    /**
     * @param {{invoiceKey:string}} input
     * @returns {Promise<{success:true, journalId:string, journalNumber:string, sourceId:string, idempotencyKey:string, alreadyPosted:boolean, movementIds?:string[], warnings?:string[]}>}
     */
    return async function postSalesInvoice({ invoiceKey }) {
        if (!invoiceKey) throw new ValidationError('invoiceKey مطلوب');

        const invoice = await getInvoice(invoiceKey);
        if (!invoice) throw new ValidationError('الفاتورة غير موجودة', { invoiceKey });

        const idempotencyKey = buildIdempotencyKey({ sourceType: 'salesInvoice', sourceId: invoiceKey, operation: 'POST' });

        // ── حلّ الحسابات — طبقة الخدمة وحدها. لا إنشاء (C1) ─────────────────────
        // ⚠️ العميل المفقود **ليس** خطأً: القديم يرحّل باسم فارغ (`customer?.nameAr || ''`).
        //    سلوك محفوظ حرفياً — صنف A. راجع docs/services/sales-invoice-posting.md.
        const customer = invoice.customerId ? await getCustomer(invoice.customerId) : null;

        const allAccounts = await chartOfAccountsRepo.list();
        const chartOfAccounts = Object.fromEntries(allAccounts.map(a => [a.__key, a]));

        const receivableCode = resolveCustomerReceivableAccountCode({
            customerId: invoice.customerId,
            customers: customer && invoice.customerId ? { [invoice.customerId]: customer } : {},
            chartOfAccounts, cfg
        });
        const receivableAccount =
            (await chartOfAccountsRepo.getByCode(receivableCode))
            || (await chartOfAccountsRepo.getByCode(FALLBACK_RECEIVABLE));
        if (!receivableAccount) {
            throw new MissingAccountError(`حساب العملاء (${receivableCode}) غير موجود في شجرة الحسابات — أضِفه ثم أعد الترحيل`,
                { invoiceKey, accountCode: receivableCode });
        }

        let revenueAccount = null;
        const revenueCandidates = salesRevenueAccountCandidates({ invoice });
        for (const code of revenueCandidates) {
            revenueAccount = await chartOfAccountsRepo.getByCode(code);
            if (revenueAccount) break;
        }
        if (!revenueAccount) {
            throw new MissingAccountError(`حساب الإيرادات (${revenueCandidates.join(' أو ')}) غير موجود في شجرة الحسابات — أضِفه ثم أعد الترحيل`,
                { invoiceKey, candidates: revenueCandidates });
        }

        // C2 — ضريبة المخرجات: مطلوبة فعلياً متى كانت الضريبة > 0. لا ضمّ للإيراد.
        const vatTotal = Number(invoice.vatTotal) || 0;
        const vatPayableAccount = await chartOfAccountsRepo.getByCode(OUTPUT_VAT_CODE);
        if (vatTotal > 0 && !vatPayableAccount) {
            throw new MissingAccountError(`حساب ${OUTPUT_VAT_CODE} (ضريبة المخرجات) غير موجود — لن تُضمّ الضريبة إلى الإيرادات؛ أنشئ الحساب ثم أعد الترحيل`,
                { invoiceKey, accountCode: OUTPUT_VAT_CODE });
        }

        // C3 — الاحتجاز والدفعة المقدمة: بنفس عتبة القديم وبعد تحويل العملة.
        const baseCode = cfg.baseCurrencyCode || 'SAR';
        const curCode = invoice.currency || baseCode;
        const fx = (curCode !== baseCode) ? (parseFloat(invoice.exchangeRate) || 1) : 1;
        const retBase = round2((Number(invoice.retentionAmount) || 0) * fx);
        const advBase = round2((Number(invoice.advanceRecoveryAmount) || 0) * fx);

        const retentionAccount = retBase > MATERIALITY ? await chartOfAccountsRepo.getByCode(RETENTION_CODE) : null;
        if (retBase > MATERIALITY && !retentionAccount) {
            throw new MissingAccountError(`حساب ${RETENTION_CODE} (محتجزات ضمان لدى العملاء) غير موجود — لن يُهمل الاحتجاز بصمت؛ أنشئ الحساب ثم أعد الترحيل`,
                { invoiceKey, accountCode: RETENTION_CODE, amount: retBase });
        }
        const advanceAccount = advBase > MATERIALITY ? await chartOfAccountsRepo.getByCode(ADVANCE_CODE) : null;
        if (advBase > MATERIALITY && !advanceAccount) {
            throw new MissingAccountError(`حساب ${ADVANCE_CODE} (دفعات مقدمة من العملاء) غير موجود — لن يُهمل استرداد المقدّم بصمت؛ أنشئ الحساب ثم أعد الترحيل`,
                { invoiceKey, accountCode: ADVANCE_CODE, amount: advBase });
        }

        const nowIso = now();
        const userId = (currentUser && currentUser.uid) || 'system';
        const buildInputs = {
            invoiceKey, invoice, customer,
            receivableAccount, revenueAccount, vatPayableAccount, retentionAccount, advanceAccount,
            baseCurrencyCode: baseCode, now: nowIso, userId
        };

        // ── تحقّق مسبق برقم مؤقّت — يكشف أي عطل بنيوي **قبل** حجز أي رقم أو لمس الحالة ──
        const preview = buildSalesInvoiceJournal({ ...buildInputs, journalNumber: PLACEHOLDER_NUMBER });
        validateJournal(preview.journal);
        assertBalanced(preview.journal);

        // ── تخطيط حركات المخزون (نقيّ) — على لقطة واحدة ثابتة، مثل القديم ─────────
        const snapshot = await getInventorySnapshot();
        const plan = planSalesInvoiceMovements({
            invoiceKey, invoice,
            items: (snapshot && snapshot.items) || {},
            movements: (snapshot && snapshot.movements) || {},
            warehouses: (snapshot && snapshot.warehouses) || {},
            now: nowIso, userId
        });

        const buildJournal = journalNumber => buildSalesInvoiceJournal({ ...buildInputs, journalNumber });
        const buildMovements = numbers => withMovementNumbers(plan.movements, numbers);

        try {
            const result = await salesInvoicePostingRepo.postSalesInvoiceAtomic({
                invoiceKey, buildJournal,
                movementCount: plan.movements.length, buildMovements,
                journalBookPrefix: 'JV'
            });
            return {
                success: true, ...result, sourceId: invoiceKey, idempotencyKey,
                warnings: [...preview.warnings, ...plan.warnings]
            };
        } catch (e) {
            if (e && e.name === 'DuplicatePostingError') {
                // Idempotent: ليست فشلاً — نعيد النتيجة الأصلية (نفس Phase 6/7-B)
                const original = (e.details && e.details.original) || {};
                return {
                    success: true, alreadyPosted: true,
                    journalId: original.journalId || null,
                    journalNumber: original.journalNumber || null,
                    sourceId: invoiceKey, idempotencyKey
                };
            }
            throw e;
        }
    };
}
