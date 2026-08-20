// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خدمة التطبيق: إصدار وترحيل إشعار دائن (مرتجع مبيعات)              [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  UI/Legacy ──▶ [هذا الملف] ──▶ Domain ──▶ Repository (ذرّي + تعويضي) ──▶ RTDB    ║
// ║                                                                              ║
// ║  🔒 محايدة عن التخزين تماماً — لا Firebase، لا DOM، لا `window`، لا `document`،  ║
// ║  لا `toast`. `returnQuantities` تُمرَّر **صراحةً** بدل قراءتها من DOM (§5).       ║
// ║                                                                              ║
// ║  ═══ الفروق المقصودة عن القديم (كلها مُصنَّفة ومُختبَرة) ═══                     ║
// ║  C1 — **يرفض الترحيل عند غياب أي حساب مطلوب.** القديم يكتب المستند والمخزون     ║
// ║       ويُحدِّث `creditedAmount` ثم يعرض تنبيهاً عابراً بلا قيد (BUG-010).          ║
// ║  C2 — **ترقيم بمعاملة خادمية** (`counters/cn/{year}`) بدل `max(cache)+1` (BUG-011). ║
// ║  C3 — **تحديث الفاتورة المصدر داخل معاملة** ⇒ لا ضياع تحديث (BUG-012).          ║
// ║  C4 — **رفض التجاوز** بحساب المتبقّي من الحالة اللحظية للفاتورة (BUG-013).       ║
// ║  A  — ما عدا ذلك: القيد والمبالغ وحركات المخزون **مطابقة حرفياً** للقديم.        ║
// ║                                                                              ║
// ║  ⚠️ D3 (عكس الاحتجاز 1131 والدفعة المقدمة 2150) **غير محسوم ولم يُنفَّذ** —       ║
// ║  القديم لا يعكسهما، وهذه الخدمة لا تعكسهما. لا سياسة محاسبية مُخترَعة.           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { computeCreditNote } from '../../../domain/accounting/credit-note/computeCreditNote.js';
import { validateCreditNoteSource, validateReturnQuantities, validateNoteAmounts } from '../../../domain/accounting/credit-note/validateCreditNote.js';
import { buildCreditNoteJournal } from '../../../domain/accounting/credit-note/buildCreditNoteJournal.js';
import { creditNoteRevenueCandidates, creditNoteReceivableCode, OUTPUT_VAT_CODE } from '../../../domain/accounting/credit-note/resolveCreditNoteAccounts.js';
import { planCreditNoteMovements } from '../../../domain/inventory/planCreditNoteMovements.js';
import { assertBalanced } from '../../../domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../../domain/accounting/posting/validateJournal.js';
import { buildIdempotencyKey } from '../idempotency/idempotencyKey.js';
import { ValidationError, MissingAccountError } from '../errors/ValidationError.js';

const PLACEHOLDER = '__PENDING__';   // لا يُكتب أبداً — يُستبدَل قبل أي كتابة فعلية
const FALLBACK_RECEIVABLE = '1130';

/**
 * @param {object} deps
 * @param {import('../../../repositories/contracts/ChartOfAccountsRepository.js').ChartOfAccountsRepository} deps.chartOfAccountsRepo
 * @param {import('../../../repositories/contracts/CreditNotePostingRepository.js').CreditNotePostingRepository} deps.creditNotePostingRepo
 * @param {(key:string)=>Promise<object|null>} deps.getSalesInvoice
 * @param {(id:string)=>Promise<object|null>} [deps.getCustomer]
 * @param {()=>Promise<{items:object, movements:object, warehouses:object}>} [deps.getInventorySnapshot]
 * @param {object} [deps.cfg]  { baseCurrencyCode, arApMode }
 * @param {{uid:string}} [deps.currentUser]
 * @param {()=>string} [deps.now]
 */
export function createPostCreditNoteService(deps) {
    const {
        chartOfAccountsRepo, creditNotePostingRepo, getSalesInvoice,
        getCustomer = async () => null,
        getInventorySnapshot = async () => ({ items: {}, movements: {}, warehouses: {} }),
        cfg = {}, currentUser, now = () => new Date().toISOString()
    } = deps;

    if (!chartOfAccountsRepo) throw new Error('chartOfAccountsRepo مطلوب');
    if (!creditNotePostingRepo) throw new Error('creditNotePostingRepo مطلوب');
    if (!getSalesInvoice) throw new Error('getSalesInvoice مطلوب');

    /**
     * @param {object} input
     * @param {string} input.noteKey    مفتاح مُولَّد محلّياً — **مرساة Idempotency**؛
     *                                  يجب إعادة استخدامه حرفياً عند إعادة المحاولة.
     * @param {string} input.invoiceKey فاتورة المبيعات المصدر
     * @param {Array<number>} [input.returnQuantities] كمّية الإرجاع لكل سطر (غياب ⇒ إرجاع كامل)
     * @param {string} [input.reason]
     */
    return async function postCreditNote({ noteKey, invoiceKey, returnQuantities, reason }) {
        if (!noteKey) throw new ValidationError('noteKey مطلوب — هو مرساة Idempotency ويجب أن يولّده المستدعي');
        if (!invoiceKey) throw new ValidationError('invoiceKey مطلوب');

        const invoice = await getSalesInvoice(invoiceKey);
        validateCreditNoteSource(invoice, invoiceKey);
        validateReturnQuantities(returnQuantities, invoice);

        const idempotencyKey = buildIdempotencyKey({ sourceType: 'creditNote', sourceId: noteKey, operation: 'POST' });

        // ── حساب المبالغ (نقيّ — بلا DOM) ────────────────────────────────────────
        const amounts = computeCreditNote({ invoice, returnQuantities });
        validateNoteAmounts(amounts);

        // ── حلّ الحسابات — بحث فقط، بلا إنشاء (سلوك القديم محفوظ) ────────────────
        const customer = invoice.customerId ? await getCustomer(invoice.customerId) : null;
        const allAccounts = await chartOfAccountsRepo.list();
        const chartOfAccounts = Object.fromEntries(allAccounts.map(a => [a.__key, a]));

        const receivableCode = creditNoteReceivableCode({
            note: { customerId: invoice.customerId },
            customers: customer && invoice.customerId ? { [invoice.customerId]: customer } : {},
            chartOfAccounts, cfg
        });
        const receivableAccount =
            (await chartOfAccountsRepo.getByCode(receivableCode))
            || (await chartOfAccountsRepo.getByCode(FALLBACK_RECEIVABLE));
        if (!receivableAccount) {
            throw new MissingAccountError(`حساب العملاء (${receivableCode}) غير موجود — لن يُصدَر إشعار بلا قيد`, { invoiceKey, accountCode: receivableCode });
        }

        const noteDraft = { salesAccountCode: invoice.salesAccountCode };
        let revenueAccount = null;
        const revCandidates = creditNoteRevenueCandidates({ note: noteDraft });
        for (const code of revCandidates) {
            revenueAccount = await chartOfAccountsRepo.getByCode(code);
            if (revenueAccount) break;
        }
        if (!revenueAccount) {
            throw new MissingAccountError(`حساب الإيرادات (${revCandidates.join(' أو ')}) غير موجود — لن يُصدَر إشعار بلا قيد`, { invoiceKey, candidates: revCandidates });
        }

        // C1 — الضريبة مطلوبة فعلياً متى كانت > 0؛ لا تُضمّ للإيراد بصمت
        const vatAccount = await chartOfAccountsRepo.getByCode(OUTPUT_VAT_CODE);
        if (amounts.vatTotal > 0 && !vatAccount) {
            throw new MissingAccountError(`حساب ${OUTPUT_VAT_CODE} (ضريبة المخرجات) غير موجود — لن تُضمّ الضريبة إلى الإيرادات`, { invoiceKey, accountCode: OUTPUT_VAT_CODE });
        }

        const nowIso = now();
        const today = nowIso.slice(0, 10);
        const userId = (currentUser && currentUser.uid) || 'system';

        // ── مستند الإشعار — نفس حقول القديم حرفياً (accounting.js:16110) ─────────
        const buildNote = noteNumber => ({
            number: noteNumber,
            date: today,
            invoiceKey,
            invoiceNumber: invoice.number,
            customerId: invoice.customerId,
            reason: (reason || '').trim() || 'مرتجع مبيعات',
            lines: amounts.lines,
            subTotal: amounts.subTotal,
            discount: amounts.discount,
            netBeforeTax: amounts.netBeforeTax,
            vatTotal: amounts.vatTotal,
            grandTotal: amounts.grandTotal,
            currency: invoice.currency || cfg.baseCurrencyCode || 'SAR',
            exchangeRate: invoice.exchangeRate || 1,
            salesAccountCode: invoice.salesAccountCode || '4100',
            projectId: invoice.projectId || '',
            status: 'posted',
            createdAt: nowIso,
            createdBy: userId
            // ⚠️ `partial` يُحسم داخل معاملة الفاتورة (السعة المتبقّية) لا هنا — يُضاف أدناه
        });

        const journalInputs = {
            noteKey, customer, receivableAccount, revenueAccount, vatAccount,
            baseCurrencyCode: cfg.baseCurrencyCode || 'SAR', now: nowIso, userId
        };

        // ── تحقّق مسبق برقم مؤقّت — قبل أي مطالبة أو حجز أو لمس للفاتورة ──────────
        const previewNote = buildNote(PLACEHOLDER);
        const preview = buildCreditNoteJournal({ ...journalInputs, note: previewNote, journalNumber: PLACEHOLDER });
        validateJournal(preview.journal);
        assertBalanced(preview.journal);

        // ── تخطيط حركات المخزون (نقيّ، على لقطة ثابتة كالقديم) ───────────────────
        const snapshot = await getInventorySnapshot();
        const plan = planCreditNoteMovements({
            noteKey, note: previewNote,
            items: (snapshot && snapshot.items) || {},
            movements: (snapshot && snapshot.movements) || {},
            warehouses: (snapshot && snapshot.warehouses) || {},
            now: nowIso, userId
        });

        try {
            const result = await creditNotePostingRepo.postCreditNoteAtomic({
                noteKey, invoiceKey, noteAmount: amounts.grandTotal,
                buildNote,
                buildJournal: (journalNumber, note) => buildCreditNoteJournal({ ...journalInputs, note, journalNumber }),
                movementCount: plan.movements.length,
                buildMovements: (numbers, note) =>
                    planCreditNoteMovements({
                        noteKey, note,
                        items: (snapshot && snapshot.items) || {},
                        movements: (snapshot && snapshot.movements) || {},
                        warehouses: (snapshot && snapshot.warehouses) || {},
                        now: nowIso, userId
                    }).movements.map((m, i) => ({ number: numbers[i], ...m })),
                journalBookPrefix: 'JV'
            });
            return {
                success: true, ...result, sourceId: invoiceKey, idempotencyKey,
                amounts, warnings: [...preview.warnings, ...plan.warnings]
            };
        } catch (e) {
            if (e && e.name === 'DuplicatePostingError') {
                const original = (e.details && e.details.original) || {};
                return {
                    success: true, alreadyPosted: true,
                    noteId: original.noteId || noteKey, noteNumber: original.noteNumber || null,
                    journalId: original.journalId || null, journalNumber: original.journalNumber || null,
                    sourceId: invoiceKey, idempotencyKey
                };
            }
            throw e;
        }
    };
}
