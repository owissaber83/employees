// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  محرّك ترحيل الإشعارات في الذاكرة — لإثبات محايدة العقد عن التخزين  [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  نفس مبدأ Phase 6/7: إن مرّ هذا التنفيذ وتنفيذ Firebase على **نفس** حالات        ║
// ║  الاختبار، فالعقد محايد فعلاً. التسلسل بسلسلة Promise — يحاكي عزل معاملات        ║
// ║  RTDB الخادمية في عملية Node أحادية الخيط، ولا يدّعي بديلاً عنها.                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { RepositoryError, REPO_ERRORS } from '../contracts/errors.js';
import { AtomicityError } from '../../services/accounting/errors/AtomicityError.js';
import { DuplicatePostingError } from '../../services/accounting/errors/DuplicatePostingError.js';
import { ValidationError } from '../../services/accounting/errors/ValidationError.js';
import { computeNoteCapacity } from '../../domain/accounting/notes/computeNoteCapacity.js';

const INJECTED = 'حقن فشل مُتعمَّد — لاختبار الذرّية';

export class InMemoryNotePostingEngine {
    /**
     * @param {object} seed {notes, invoices, journals, movements, counters}
     * @param {object} cfg  {counterKind, movementPrefix, fields}
     */
    constructor(seed = {}, cfg) {
        this._store = {
            notes: seed.notes || {}, invoices: seed.invoices || {},
            journals: seed.journals || {}, movements: seed.movements || {},
            counters: seed.counters || {}
        };
        this._c = cfg;
        this._n = 0;
        this._chain = Promise.resolve();
        this.forceAtomicWriteFailure = false;
        this.forceNumberReservationFailure = false;
    }

    get store() { return this._store; }

    async post(p) {
        const run = async () => this._postOnce(p);
        const result = this._chain.then(run, run);
        this._chain = result.catch(() => {});
        return result;
    }

    async _postOnce({ noteKey, invoiceKey, noteAmount, buildNote, buildJournal, movementCount = 0, buildMovements, journalBookPrefix = 'JV' }) {
        const C = this._c, F = C.fields;
        if (!noteKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الإشعار مطلوب');

        // ── 1. مطالبة الإنشاء ────────────────────────────────────────────────────
        const existing = this._store.notes[noteKey];
        if (existing) {
            throw new DuplicatePostingError(
                existing.status === 'posted' ? 'الإشعار مُرحَّل بالفعل' : 'الإشعار مُطالَب به بالفعل',
                {
                    noteKey,
                    original: existing.journalEntryKey
                        ? { noteId: noteKey, noteNumber: existing.number || null, journalId: existing.journalEntryKey, journalNumber: existing.journalEntryNumber || null }
                        : null
                }
            );
        }
        this._store.notes[noteKey] = { status: 'draft' };

        const invoice = this._store.invoices[invoiceKey];
        let prior = null;
        try {
            if (this.forceNumberReservationFailure) throw new Error('حقن فشل حجز رقم — لاختبار الاسترجاع');

            const year = new Date().getFullYear();
            const bump = k => { this._store.counters[k] = (this._store.counters[k] || 0) + 1; return this._store.counters[k]; };
            const noteNumber = `${C.counterKind.toUpperCase()}-${year}-${String(bump(`${C.counterKind}/${year}`)).padStart(5, '0')}`;
            const journalNumber = `${journalBookPrefix}-${year}-${String(bump(`jrn/${journalBookPrefix}/${year}`)).padStart(5, '0')}`;
            const movementNumbers = [];
            for (let i = 0; i < movementCount; i++) {
                movementNumbers.push(`${C.movementPrefix}-${year}-${String(bump(`invmov/${C.movementPrefix}/${year}`)).padStart(5, '0')}`);
            }

            const note = buildNote(noteNumber);

            // ── 2. سعة الفاتورة المصدر ───────────────────────────────────────────
            if (invoice == null) throw new ValidationError(`الفاتورة المصدر ${invoiceKey} غير موجودة`, { invoiceKey });
            prior = {
                [F.notedAmount]: invoice[F.notedAmount], [F.fully]: invoice[F.fully],
                [F.keys]: invoice[F.keys], [F.number]: invoice[F.number]
            };
            const capacity = computeNoteCapacity({
                invoiceKey, grandTotal: invoice.grandTotal,
                currentNotedAmount: invoice[F.notedAmount], noteAmount, noteKey,
                existingKeys: invoice[F.keys], legacySingleKey: invoice[F.legacySingle]
            });
            invoice[F.number] = noteNumber;
            invoice[F.keys] = capacity.nextKeys;
            invoice[F.notedAmount] = capacity.nextNotedAmount;
            if (capacity.fullyNoted) invoice[F.fully] = true;

            // ── 3. بناء ثم كتابة ذرّية ───────────────────────────────────────────
            const { journal } = buildJournal(journalNumber, note);
            const movements = movementCount ? buildMovements(movementNumbers, note) : [];
            if (this.forceAtomicWriteFailure) throw new Error(INJECTED);

            const journalId = `jrn-${++this._n}`;
            const movementIds = movements.map((_, i) => `mov-${this._n}-${i + 1}`);
            this._store.journals[journalId] = journal;
            movements.forEach((m, i) => { this._store.movements[movementIds[i]] = m; });
            this._store.notes[noteKey] = { ...note, status: 'posted', journalEntryKey: journalId, journalEntryNumber: journalNumber };

            return {
                noteId: noteKey, noteNumber, journalId, journalNumber,
                alreadyPosted: false, movementIds, movementNumbers,
                invoiceState: {
                    notedAmount: capacity.nextNotedAmount, fullyNoted: capacity.fullyNoted,
                    remainingAfter: capacity.remainingAfter, keys: capacity.nextKeys
                }
            };
        } catch (e) {
            if (prior && invoice) {
                for (const f of [F.notedAmount, F.fully, F.keys, F.number]) {
                    if (prior[f] === undefined) delete invoice[f]; else invoice[f] = prior[f];
                }
                if (Array.isArray(invoice[F.keys])) {
                    const filtered = invoice[F.keys].filter(k => k !== noteKey);
                    if (filtered.length) invoice[F.keys] = filtered; else delete invoice[F.keys];
                }
            }
            delete this._store.notes[noteKey];
            if (e && e.message === INJECTED) {
                throw new AtomicityError('فشلت الكتابة الذرّية للإشعار (مُحاكاة) — لا مستند ولا قيد ولا حركات', { noteKey, cause: e.message });
            }
            throw e;
        }
    }
}

export const MEM_CREDIT_CONFIG = Object.freeze({
    counterKind: 'cn', movementPrefix: 'IN',
    fields: Object.freeze({ notedAmount: 'creditedAmount', keys: 'creditNoteKeys', fully: 'fullyCredited', number: 'creditNoteNumber', legacySingle: 'creditNoteKey' })
});
export const MEM_DEBIT_CONFIG = Object.freeze({
    counterKind: 'dn', movementPrefix: 'OUT',
    fields: Object.freeze({ notedAmount: 'debitedAmount', keys: 'debitNoteKeys', fully: 'fullyDebited', number: 'debitNoteNumber', legacySingle: 'debitNoteKey' })
});
