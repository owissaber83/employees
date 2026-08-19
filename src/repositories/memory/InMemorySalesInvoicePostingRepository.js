// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ في الذاكرة — لإثبات محايدة عقد ترحيل فاتورة المبيعات       [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  نفس مبدأ Phase 6/7-B: إن مرّ هذا التنفيذ وتنفيذ Firebase على **نفس** حالات      ║
// ║  الاختبار، فالعقد محايد فعلاً عن التخزين. التسلسل هنا بسلسلة Promise — يحاكي     ║
// ║  عزل معاملات RTDB الخادمية في عملية Node أحادية الخيط، ولا يدّعي بديلاً عنها.     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { SalesInvoicePostingRepository } from '../contracts/SalesInvoicePostingRepository.js';
import { RepositoryError, REPO_ERRORS } from '../contracts/errors.js';
import { AtomicityError } from '../../services/accounting/errors/AtomicityError.js';
import { DuplicatePostingError } from '../../services/accounting/errors/DuplicatePostingError.js';

const INJECTED = 'حقن فشل مُتعمَّد — لاختبار الذرّية';

export class InMemorySalesInvoicePostingRepository extends SalesInvoicePostingRepository {
    /** @param {{salesInvoices:object, journals:object, movements:object, counters:object}} seed مراجع كائنات حيّة */
    constructor(seed = {}) {
        super();
        this._store = {
            salesInvoices: seed.salesInvoices || {},
            journals: seed.journals || {},
            movements: seed.movements || {},
            counters: seed.counters || {}
        };
        this._n = 0;
        this._chain = Promise.resolve();
        this.forceAtomicWriteFailure = false;   // لاختبارات حقن الفشل فقط
        this.forceNumberReservationFailure = false;
    }

    get store() { return this._store; }

    async postSalesInvoiceAtomic(p) {
        const run = async () => this._postOnce(p);
        const result = this._chain.then(run, run);
        this._chain = result.catch(() => {});
        return result;
    }

    async _postOnce({ invoiceKey, buildJournal, movementCount = 0, buildMovements, journalBookPrefix = 'JV' }) {
        if (!invoiceKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الفاتورة مطلوب');

        const invoice = this._store.salesInvoices[invoiceKey];
        if (!invoice || invoice.status !== 'draft') {
            throw new DuplicatePostingError(invoice ? 'الفاتورة مُرحَّلة بالفعل' : 'الفاتورة غير موجودة', {
                invoiceKey,
                original: invoice && invoice.journalEntryKey
                    ? { journalId: invoice.journalEntryKey, journalNumber: invoice.journalEntryNumber || null }
                    : null
            });
        }
        invoice.status = 'posted'; // ← يقابل نجاح معاملة الحالة في Firebase

        try {
            if (this.forceNumberReservationFailure) throw new Error('حقن فشل حجز رقم — لاختبار الاسترجاع');

            const year = new Date().getFullYear();
            const jk = `jrn/${journalBookPrefix}/${year}`;
            this._store.counters[jk] = (this._store.counters[jk] || 0) + 1;
            const journalNumber = `${journalBookPrefix}-${year}-${String(this._store.counters[jk]).padStart(5, '0')}`;

            const movementNumbers = [];
            for (let i = 0; i < movementCount; i++) {
                const mk = `invmov/out/${year}`;
                this._store.counters[mk] = (this._store.counters[mk] || 0) + 1;
                movementNumbers.push(`OUT-${year}-${String(this._store.counters[mk]).padStart(5, '0')}`);
            }

            const { journal } = buildJournal(journalNumber);
            const movements = movementCount ? buildMovements(movementNumbers) : [];

            if (this.forceAtomicWriteFailure) throw new Error(INJECTED);

            // ── الكتابة «الذرّية»: تُطبَّق دفعةً واحدة بلا await بينها ─────────────
            const journalId = `jrn-${++this._n}`;
            const movementIds = movements.map((_, i) => `mov-${this._n}-${i + 1}`);
            this._store.journals[journalId] = journal;
            movements.forEach((m, i) => { this._store.movements[movementIds[i]] = m; });
            invoice.journalEntryKey = journalId;
            invoice.journalEntryNumber = journalNumber;
            invoice.postedAt = journal.postedAt;
            invoice.postedBy = journal.postedBy;

            return { journalId, journalNumber, alreadyPosted: false, movementIds, movementNumbers };
        } catch (e) {
            invoice.status = 'draft';
            delete invoice.journalEntryKey; delete invoice.journalEntryNumber;
            delete invoice.postedAt; delete invoice.postedBy;
            if (e && e.message === INJECTED) {
                throw new AtomicityError('فشلت الكتابة الذرّية للترحيل (مُحاكاة) — لا قيد ولا حركات', { invoiceKey, cause: e.message });
            }
            throw e;
        }
    }
}
