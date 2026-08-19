// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ في الذاكرة — لإثبات محايدة عقد VoucherPostingRepository عن التخزين [Phase 7] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  نفس مبدأ Phase 6: إن مرّ هذا التنفيذ وتنفيذ Firebase على **نفس** حالات          ║
// ║  الاختبار (tests/repositories/voucherPosting.contract.test.mjs)، فالعقد محايد   ║
// ║  فعلاً. التسلسل هنا عبر سلسلة Promise بسيطة — يحاكي عزل معاملات RTDB الخادمية    ║
// ║  في عملية Node أحادية الخيط، وليس بديلاً عن ضمان runTransaction الحقيقي.         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { VoucherPostingRepository } from '../contracts/VoucherPostingRepository.js';
import { RepositoryError, REPO_ERRORS } from '../contracts/errors.js';
import { AtomicityError } from '../../services/accounting/errors/AtomicityError.js';
import { DuplicatePostingError } from '../../services/accounting/errors/DuplicatePostingError.js';
import { AllocationConflictError } from '../../services/accounting/errors/AllocationConflictError.js';
import { ValidationError } from '../../services/accounting/errors/ValidationError.js';
import { computeInvoiceAllocation, validateAllocationSet } from '../../domain/accounting/allocation/computeAllocation.js';
import { round2 } from '../../../public/calc.js';

const VOUCHER_COLLECTIONS = { receipt: 'receipts', payment: 'payments' };
const INVOICE_COLLECTIONS = { receipt: 'salesInvoices', payment: 'purchaseInvoices' };

export class InMemoryVoucherPostingRepository extends VoucherPostingRepository {
    /** @param {{receipts:object, payments:object, salesInvoices:object, purchaseInvoices:object, journals:object, counters:object}} seed مراجع كائنات حيّة */
    constructor(seed = {}) {
        super();
        this._store = {
            receipts: seed.receipts || {}, payments: seed.payments || {},
            salesInvoices: seed.salesInvoices || {}, purchaseInvoices: seed.purchaseInvoices || {},
            journals: seed.journals || {}, counters: seed.counters || {}
        };
        this._n = 0;
        this._chain = Promise.resolve(); // يسلسل العمليات — يحاكي عزل معاملات RTDB الفعلي
        this.forceAtomicWriteFailure = false; // لاختبارات حقن الفشل فقط
        this.forceAllocationFailureOn = null;  // invoiceKey — يحاكي فشل معاملة فردية (تعارض غير مُكتشَف بالحساب نفسه)
    }

    async postVoucherAtomic(p) {
        const run = async () => this._postOnce(p);
        const result = this._chain.then(run, run);
        this._chain = result.catch(() => {});
        return result;
    }

    async _postOnce({ voucherKey, voucherType, allocations, buildJournal, journalBookPrefix = 'JV' }) {
        if (!voucherKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح السند مطلوب');
        const voucherColl = VOUCHER_COLLECTIONS[voucherType];
        const invoiceColl = INVOICE_COLLECTIONS[voucherType];
        if (!voucherColl || !invoiceColl) throw new ValidationError(`نوع سند غير معروف: ${voucherType}`, { voucherKey, voucherType });

        const voucher = this._store[voucherColl][voucherKey];
        if (!voucher || voucher.status !== 'draft') {
            throw new DuplicatePostingError(voucher ? 'السند مُرحَّل بالفعل' : 'السند غير موجود',
                { voucherKey, original: voucher ? { journalId: voucher.journalEntryKey || null, journalNumber: voucher.journalEntryNumber || null } : null });
        }
        voucher.status = 'posted'; // ← يقابل نجاح معاملة الحالة في Firebase

        try { validateAllocationSet(allocations); }
        catch (e) { voucher.status = 'draft'; throw e; }

        const entries = Object.entries(allocations || {});
        const succeeded = [];
        const invoices = this._store[invoiceColl];

        try {
            for (const [invoiceKey, amount] of entries) {
                if (this.forceAllocationFailureOn === invoiceKey) {
                    throw new AllocationConflictError(`حقن فشل مُتعمَّد على الفاتورة ${invoiceKey} — لاختبار التعويض`, { invoiceKey });
                }
                const inv = invoices[invoiceKey];
                if (!inv) throw new ValidationError(`الفاتورة ${invoiceKey} غير موجودة`, { invoiceKey });
                const { nextPaidAmount } = computeInvoiceAllocation({
                    invoiceKey, currentPaidAmount: inv.paidAmount, grandTotal: inv.grandTotal, allocatedAmount: amount
                });
                inv.paidAmount = nextPaidAmount; // ← يقابل نجاح معاملة الفاتورة الفردية
                succeeded.push({ invoiceKey, amount });
            }
        } catch (e) {
            this._compensate(invoices, succeeded);
            voucher.status = 'draft';
            throw e;
        }

        try {
            const year = new Date().getFullYear();
            const ck = `${journalBookPrefix}/${year}`;
            this._store.counters[ck] = (this._store.counters[ck] || 0) + 1;
            const journalNumber = `${journalBookPrefix}-${year}-${String(this._store.counters[ck]).padStart(5, '0')}`;

            const { journal } = buildJournal(journalNumber);

            if (this.forceAtomicWriteFailure) throw new Error('حقن فشل مُتعمَّد — لاختبار الذرّية');

            const journalId = `jrn-${++this._n}`;
            this._store.journals[journalId] = journal;
            voucher.journalEntryKey = journalId;
            voucher.journalEntryNumber = journalNumber;
            voucher.postedAt = journal.postedAt;
            voucher.postedBy = journal.postedBy;

            return { journalId, journalNumber, alreadyPosted: false, allocationResults: succeeded.map(s => ({ invoiceKey: s.invoiceKey, allocatedAmount: s.amount })) };
        } catch (e) {
            this._compensate(invoices, succeeded);
            voucher.status = 'draft';
            delete voucher.journalEntryKey; delete voucher.journalEntryNumber; delete voucher.postedAt; delete voucher.postedBy;
            if (e && e.message === 'حقن فشل مُتعمَّد — لاختبار الذرّية') {
                throw new AtomicityError('فشلت الكتابة الذرّية النهائية للترحيل (مُحاكاة)', { voucherKey, cause: e.message });
            }
            throw e;
        }
    }

    _compensate(invoices, succeeded) {
        for (const { invoiceKey, amount } of succeeded.slice().reverse()) {
            const inv = invoices[invoiceKey];
            if (!inv) continue;
            inv.paidAmount = round2(Math.max(0, (Number(inv.paidAmount) || 0) - amount));
        }
    }
}
