// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ في الذاكرة — للاختبار وإثبات محايدة العقد عن التخزين          [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  نفس مبدأ Phase 3: إن مرّ هذا التنفيذ ومرّ تنفيذ Firebase على **نفس** حالات      ║
// ║  الاختبار، فالعقد محايد فعلاً عن التخزين. الحماية من التزامن هنا عبر قفل         ║
// ║  Promise بسيط — كافٍ لإثبات المفهوم في Node أحادي الخيط، وليس بديلاً عن ضمان     ║
// ║  runTransaction الخادمي الحقيقي في Firebase (موثَّق في docs/services/idempotency.md). ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { JournalPostingRepository } from '../contracts/JournalPostingRepository.js';
import { RepositoryError, REPO_ERRORS } from '../contracts/errors.js';
import { AtomicityError } from '../../services/accounting/errors/AtomicityError.js';
import { DuplicatePostingError } from '../../services/accounting/errors/DuplicatePostingError.js';

export class InMemoryJournalPostingRepository extends JournalPostingRepository {
    /** @param {{invoices:object, journals:object, counters:object}} seed مراجع كائنات حيّة — تُعدَّل في مكانها */
    constructor(seed = {}) {
        super();
        this._invoices = seed.invoices || {};
        this._journals = seed.journals || {};
        this._counters = seed.counters || {};
        this._n = 0;
        this._chain = Promise.resolve(); // يسلسل العمليات — يحاكي عزل معاملات RTDB الفعلي
        this.forceAtomicWriteFailure = false; // لاختبارات حقن الفشل فقط
    }

    async postPurchaseInvoiceAtomic({ invoiceKey, buildJournal, journalBookPrefix = 'JV' }) {
        // نسلسل كل الطلبات عبر نفس السلسلة — يحاكي عدم وجود سباق حقيقي داخل عملية Node
        // واحدة، وهو بالضبط ما تضمنه runTransaction في Firebase عبر إعادة المحاولة الخادمية.
        const run = async () => this._postOnce({ invoiceKey, buildJournal, journalBookPrefix });
        const result = this._chain.then(run, run);
        this._chain = result.catch(() => {}); // لا نكسر التسلسل بخطأ طلب سابق
        return result;
    }

    async _postOnce({ invoiceKey, buildJournal, journalBookPrefix }) {
        if (!invoiceKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الفاتورة مطلوب');
        const inv = this._invoices[invoiceKey];
        if (!inv || inv.status !== 'draft') {
            throw new DuplicatePostingError(inv ? 'الفاتورة مُرحَّلة بالفعل' : 'الفاتورة غير موجودة',
                { invoiceKey, original: inv ? { journalId: inv.journalEntryKey || null, journalNumber: inv.journalEntryNumber || null } : null });
        }
        inv.status = 'posted'; // ← يقابل نجاح المعاملة الذرّية في Firebase

        try {
            const year = new Date().getFullYear();
            const ck = `${journalBookPrefix}/${year}`;
            this._counters[ck] = (this._counters[ck] || 0) + 1;
            const journalNumber = `${journalBookPrefix}-${year}-${String(this._counters[ck]).padStart(5, '0')}`;

            const { journal } = buildJournal(journalNumber);

            if (this.forceAtomicWriteFailure) throw new Error('حقن فشل مُتعمَّد — لاختبار الذرّية');

            const journalId = `jrn-${++this._n}`;
            this._journals[journalId] = journal;
            inv.journalEntryKey = journalId;
            inv.journalEntryNumber = journalNumber;
            inv.postedAt = journal.postedAt;
            inv.postedBy = journal.postedBy;

            return { journalId, journalNumber, alreadyPosted: false };
        } catch (e) {
            inv.status = 'draft'; // استرجاع — نفس سلوك FirebaseJournalPostingRepository
            if (e && e.message === 'حقن فشل مُتعمَّد — لاختبار الذرّية') {
                throw new AtomicityError('فشلت الكتابة الذرّية للترحيل (مُحاكاة)', { invoiceKey, cause: e.message });
            }
            throw e;
        }
    }
}
