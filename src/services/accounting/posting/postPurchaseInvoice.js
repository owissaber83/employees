// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خدمة التطبيق: ترحيل فاتورة مشتريات                                   [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  UI/Legacy ──▶ [هذا الملف] ──▶ Domain (بناء + تحقّق) ──▶ Repository (ذرّي) ──▶ RTDB ║
// ║                                                                              ║
// ║  🔒 محايدة عن التخزين تماماً: لا `import` واحد من Firebase أو RTDB هنا — فقط     ║
// ║  عقد `ChartOfAccountsRepository`/`JournalPostingRepository` (§3، §21).          ║
// ║  🔒 لا DOM ولا React ولا `toast`/`alert`/`window.*` — نتيجة أو خطأ مُصنَّف فقط    ║
// ║  (§19). المهايئ (Legacy الحالي أو React لاحقاً) يترجم هذا لواجهة المستخدم.       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildPurchaseInvoiceJournal } from '../../../domain/accounting/posting/buildPurchaseInvoiceJournal.js';
import { resolveVendorPayableAccountCode } from '../../../domain/accounting/posting/resolveVendorPayableAccount.js';
import { assertBalanced } from '../../../domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../../domain/accounting/posting/validateJournal.js';
import { buildIdempotencyKey } from '../idempotency/idempotencyKey.js';
import { ValidationError, MissingAccountError } from '../errors/ValidationError.js';

const PLACEHOLDER_NUMBER = '__PENDING__'; // لا يُكتب أبداً — يُستبدَل قبل أي كتابة فعلية (انظر التعليق أدناه)

/**
 * @param {object} deps
 * @param {import('../../../repositories/contracts/ChartOfAccountsRepository.js').ChartOfAccountsRepository} deps.chartOfAccountsRepo
 * @param {import('../../../repositories/contracts/JournalPostingRepository.js').JournalPostingRepository} deps.journalPostingRepo
 * @param {(key:string)=>Promise<object|null>} deps.getInvoice   يعيد سجل فاتورة المشتريات بمفتاحه
 * @param {(key:string)=>Promise<object|null>} deps.getVendor    يعيد سجل المورد بمفتاحه
 * @param {object} deps.cfg      { baseCurrencyCode, arApMode } — نفس شكل `cfg` القديم
 * @param {{uid:string}} deps.currentUser
 * @param {()=>string} [deps.now]  للاختبار — افتراضياً `new Date().toISOString()`
 */
export function createPostPurchaseInvoiceService(deps) {
    const {
        chartOfAccountsRepo, journalPostingRepo, getInvoice, getVendor,
        cfg = {}, currentUser, now = () => new Date().toISOString()
    } = deps;

    if (!chartOfAccountsRepo) throw new Error('chartOfAccountsRepo مطلوب');
    if (!journalPostingRepo) throw new Error('journalPostingRepo مطلوب');
    if (!getInvoice) throw new Error('getInvoice مطلوب');

    /**
     * @param {{invoiceKey:string}} input
     * @returns {Promise<{success:true, journalId:string, journalNumber:string, sourceId:string, idempotencyKey:string, alreadyPosted:boolean}>}
     */
    return async function postPurchaseInvoice({ invoiceKey }) {
        if (!invoiceKey) throw new ValidationError('invoiceKey مطلوب');

        const invoice = await getInvoice(invoiceKey);
        if (!invoice) throw new ValidationError('الفاتورة غير موجودة', { invoiceKey });

        const idempotencyKey = buildIdempotencyKey({ sourceType: 'purchaseInvoice', sourceId: invoiceKey, operation: 'POST' });

        // ── حلّ الحسابات (طبقة الخدمة — لا الدومين، ولا المستودع) ──────────────────
        const vendor = invoice.vendorId ? await getVendor(invoice.vendorId) : null;
        if (!invoice.debitAccountCode) {
            throw new ValidationError('debitAccountCode مطلوب على الفاتورة — fallback نوع المصروف غير مدعوم بعد (حدّ موثَّق)', { invoiceKey });
        }
        const expenseAccount = await chartOfAccountsRepo.getByCode(invoice.debitAccountCode);
        if (!expenseAccount) {
            throw new MissingAccountError(`الحساب ${invoice.debitAccountCode} غير موجود في شجرة الحسابات`, { invoiceKey, accountCode: invoice.debitAccountCode });
        }
        const allAccounts = await chartOfAccountsRepo.list();
        const vendorAccountCode = resolveVendorPayableAccountCode({
            vendorId: invoice.vendorId,
            vendors: vendor ? { [invoice.vendorId]: vendor } : {},
            chartOfAccounts: Object.fromEntries(allAccounts.map(a => [a.__key, a])),
            cfg
        });
        const vendorAccount = await chartOfAccountsRepo.getByCode(vendorAccountCode);
        if (!vendorAccount) {
            throw new MissingAccountError(`حساب الموردين ${vendorAccountCode} غير موجود في شجرة الحسابات`, { invoiceKey });
        }
        const vatInputAccount = (await chartOfAccountsRepo.getByCode('1180')) || null;

        const nowIso = now();
        const userId = (currentUser && currentUser.uid) || 'system';
        const buildInputs = {
            invoiceKey, invoice, vendor, expenseAccount, vendorAccount, vatInputAccount,
            baseCurrencyCode: cfg.baseCurrencyCode || 'SAR', now: nowIso, userId
        };

        // ── §11: تحقّق مسبق برقم مؤقّت — يكشف أي عطل بنيوي **قبل** حجز رقم قيد حقيقي.
        // نفس انضباط createJournalForPInv الأصلية: التحقّق من الحسابات يسبق توليد الرقم
        // (accounting.js:18686 قبل :18738) — لا نُهدر رقماً على فشل مؤكَّد سلفاً. ──────
        const preview = buildPurchaseInvoiceJournal({ ...buildInputs, journalNumber: PLACEHOLDER_NUMBER });
        validateJournal(preview.journal);
        assertBalanced(preview.journal);

        // ── الاستدعاء الفعلي: المستودع يحجز الحالة ذرّياً، يحجز رقماً حقيقياً، ثم يستدعي
        // buildJournal هذه مرّة أخرى بالرقم الحقيقي (رخيصة ونقيّة — لن تفشل بعد التحقّق أعلاه) ──
        const buildJournal = journalNumber => buildPurchaseInvoiceJournal({ ...buildInputs, journalNumber });

        try {
            const result = await journalPostingRepo.postPurchaseInvoiceAtomic({ invoiceKey, buildJournal, journalBookPrefix: 'JV' });
            return { success: true, ...result, sourceId: invoiceKey, idempotencyKey };
        } catch (e) {
            if (e && e.name === 'DuplicatePostingError') {
                // Idempotent: لا نعتبرها فشلاً — نعيد النتيجة الأصلية كما طلب §8 صراحةً
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
