// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ ترحيل السند + التخصيص متعدّد الفواتير على Firebase RTDB         [Phase 7] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  لا مسار جديد ولا حقل جديد — كل المسارات منقولة حرفياً من accounting.js:        ║
// ║    ledger/receipts/{key} · ledger/payments/{key}   ← موجودة أصلاً               ║
// ║    ledger/salesInvoices/{key}/paidAmount · ledger/purchaseInvoices/{key}/paidAmount ← موجودة (accounting.js:19731) ║
// ║    ledger/journalEntries/{key} · ledger/counters/jrn/{prefix}/{year}  ← موجودة ║
// ║  **لا حقل جديد. لا مجموعة جديدة (لا postingLocks/). لا تعديل على               ║
// ║  database.rules.json.**                                                       ║
// ║                                                                              ║
// ║  ═══ الآلية (راجع VoucherPostingRepository.js للنموذج الكامل) ═══              ║
// ║  1. بوّابة Idempotency: runTransaction على status السند (draft→posted) —       ║
// ║     نفس آلية FirebaseJournalPostingRepository حرفياً (مشتركة عبر               ║
// ║     postingHelpers.js). لا commit ⇒ DuplicatePostingError.                     ║
// ║  2. لكل تخصيص: runTransaction على **عقدة الفاتورة كاملة** (لا paidAmount فقط — ║
// ║     الحساب يحتاج grandTotal أيضاً) عبر computeInvoiceAllocation (Domain نقيّة). ║
// ║     Firebase يعيد المحاولة خادمياً عند تعارض حقيقي؛ رمي AllocationConflictError ║
// ║     من داخل دالة التحديث يُجهض تلك المعاملة **فقط** بلا كتابة (موثَّق في SDK:    ║
// ║     استثناء دالة التحديث ⇒ transaction aborted, exception يصعد للمستدعي).       ║
// ║  3. أي فشل بعد نجاح تخصيصات سابقة (تعارض على فاتورة لاحقة، أو فشل الكتابة       ║
// ║     الذرّية النهائية) ⇒ **تعويض**: عكس كل تخصيص ناجح بمعاملة عكسية (نفس منطق     ║
// ║     unallocateFromInvoices: طرح المبلغ، حدّ أدنى صفر)، ثم استرجاع حالة السند.    ║
// ║  4. نجاح كل التخصيصات ⇒ حجز رقم القيد + بناء القيد + كتابة ذرّية واحدة           ║
// ║     (قيد + journalEntryKey/Number/postedAt/postedBy على السند).                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2 } from '../../../public/calc.js';
import { VoucherPostingRepository } from '../contracts/VoucherPostingRepository.js';
import { RepositoryError, REPO_ERRORS, translateRtdbError } from '../contracts/errors.js';
import { AtomicityError } from '../../services/accounting/errors/AtomicityError.js';
import { DuplicatePostingError } from '../../services/accounting/errors/DuplicatePostingError.js';
import { AllocationConflictError } from '../../services/accounting/errors/AllocationConflictError.js';
import { ValidationError } from '../../services/accounting/errors/ValidationError.js';
import { computeInvoiceAllocation, validateAllocationSet } from '../../domain/accounting/allocation/computeAllocation.js';
import { reserveJournalNumber, claimDraftToPosted, pollForPostedLink, safeRollbackStatus } from './postingHelpers.js';

const VOUCHER_PATHS = { receipt: 'ledger/receipts', payment: 'ledger/payments' };
const INVOICE_PATHS = { receipt: 'ledger/salesInvoices', payment: 'ledger/purchaseInvoices' };
const JOURNALS_PATH = 'ledger/journalEntries';

export class FirebaseVoucherPostingRepository extends VoucherPostingRepository {
    /** @param {object} port منفذ RTDB من createRtdbPort — نفس نمط Phase 3/6 */
    constructor(port) {
        super();
        if (!port) throw new RepositoryError(REPO_ERRORS.UNAVAILABLE, 'منفذ RTDB مطلوب');
        this._p = port;
    }

    _ref(path) { return this._p.ref(this._p.db, path); }

    async postVoucherAtomic({ voucherKey, voucherType, allocations, buildJournal, journalBookPrefix = 'JV' }) {
        if (!voucherKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح السند مطلوب');
        const voucherPath = VOUCHER_PATHS[voucherType];
        const invoicePath = INVOICE_PATHS[voucherType];
        if (!voucherPath || !invoicePath) {
            throw new ValidationError(`نوع سند غير معروف: ${voucherType}`, { voucherKey, voucherType });
        }

        // ── 1. بوّابة Idempotency — نفس آلية Phase 6 حرفياً (مشتركة) ──────────────
        const claim = await claimDraftToPosted(this._p, `${voucherPath}/${voucherKey}/status`);
        if (!claim || !claim.committed) {
            const existing = await pollForPostedLink(this._p, `${voucherPath}/${voucherKey}`);
            throw new DuplicatePostingError(
                existing && existing.journalEntryKey ? 'السند مُرحَّل بالفعل' : 'السند ليس مسوّدة — لا يمكن ترحيله (أو الترحيل المتزامن لم يكتمل كتابته بعد)',
                { voucherKey, original: existing && existing.journalEntryKey ? { journalId: existing.journalEntryKey, journalNumber: existing.journalEntryNumber || null } : null }
            );
        }

        // ── فحص بنيوي مبكر على كامل مجموعة التخصيصات — قبل أي معاملة على فاتورة ──
        try { validateAllocationSet(allocations); }
        catch (e) { await safeRollbackStatus(this._p, `${voucherPath}/${voucherKey}`); throw e; }

        const entries = Object.entries(allocations || {});
        const succeeded = []; // {invoiceKey, amount} — بترتيب النجاح، للتعويض العكسي

        // ── 2. تخصيص كل فاتورة — آمن من التزامن فعلياً عبر runTransaction لكل فاتورة ──
        try {
            for (const [invoiceKey, amount] of entries) {
                let txResult;
                try {
                    txResult = await this._p.runTransaction(this._ref(`${invoicePath}/${invoiceKey}`), current => {
                        if (current == null) {
                            throw new ValidationError(`الفاتورة ${invoiceKey} غير موجودة`, { invoiceKey });
                        }
                        const { nextPaidAmount } = computeInvoiceAllocation({
                            invoiceKey, currentPaidAmount: current.paidAmount, grandTotal: current.grandTotal, allocatedAmount: amount
                        });
                        return { ...current, paidAmount: nextPaidAmount };
                    });
                } catch (e) {
                    if (e instanceof ValidationError || e instanceof AllocationConflictError) throw e;
                    throw translateRtdbError(e);
                }
                if (!txResult || !txResult.committed) {
                    throw new AllocationConflictError(`تعذّر تخصيص المبلغ (${amount}) على الفاتورة ${invoiceKey}`, { invoiceKey, amount });
                }
                succeeded.push({ invoiceKey, amount });
            }
        } catch (e) {
            await this._compensateAllocations(invoicePath, succeeded);
            await safeRollbackStatus(this._p, `${voucherPath}/${voucherKey}`);
            throw e;
        }

        // ── 3+4. حجز رقم القيد + بناء + كتابة ذرّية واحدة نهائية ─────────────────
        try {
            const journalNumber = await reserveJournalNumber(this._p, journalBookPrefix);
            const { journal } = buildJournal(journalNumber);
            const journalId = this._p.push(this._ref(JOURNALS_PATH)).key;

            const updates = {
                [`${JOURNALS_PATH}/${journalId}`]: journal,
                [`${voucherPath}/${voucherKey}/journalEntryKey`]: journalId,
                [`${voucherPath}/${voucherKey}/journalEntryNumber`]: journalNumber,
                [`${voucherPath}/${voucherKey}/postedAt`]: journal.postedAt,
                [`${voucherPath}/${voucherKey}/postedBy`]: journal.postedBy
                // status متروك كما قلبته المعاملة في الخطوة 1 — نفس انضباط Phase 6
            };
            try {
                await this._p.update(this._ref('/'), updates);
            } catch (e) {
                await this._compensateAllocations(invoicePath, succeeded);
                await safeRollbackStatus(this._p, `${voucherPath}/${voucherKey}`);
                throw new AtomicityError('فشلت الكتابة الذرّية النهائية للترحيل — لا القيد كُتب ولا السند رُبط (التخصيصات على الفواتير عُوِّضت)',
                    { voucherKey, journalId, journalNumber, cause: e && e.message });
            }

            return {
                journalId, journalNumber, alreadyPosted: false,
                allocationResults: succeeded.map(s => ({ invoiceKey: s.invoiceKey, allocatedAmount: s.amount }))
            };
        } catch (e) {
            if (e instanceof AtomicityError) throw e;
            await this._compensateAllocations(invoicePath, succeeded);
            await safeRollbackStatus(this._p, `${voucherPath}/${voucherKey}`);
            throw e;
        }
    }

    /**
     * تعويض عكسي — يعكس كل تخصيص ناجح بترتيب عكسي، بمعاملة آمنة من التزامن على كل
     * فاتورة (نفس منطق unallocateFromInvoices: طرح المبلغ، حدّ أدنى صفر). أفضل جهد —
     * لا نرمي إن فشل التعويض نفسه؛ الخطأ الأصلي هو ما يُبلَّغ (نفس سياسة safeRollbackStatus).
     */
    async _compensateAllocations(invoicePath, succeeded) {
        for (const { invoiceKey, amount } of succeeded.slice().reverse()) {
            try {
                await this._p.runTransaction(this._ref(`${invoicePath}/${invoiceKey}`), current => {
                    if (current == null) return undefined;
                    const reverted = round2(Math.max(0, (Number(current.paidAmount) || 0) - amount));
                    return { ...current, paidAmount: reverted };
                });
            } catch (e) { /* أفضل جهد فقط — موثَّق كحدّ معروف */ }
        }
    }
}
