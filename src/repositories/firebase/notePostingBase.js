// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  محرّك ترحيل إشعارات الإرجاع على Firebase RTDB — مشترك              [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الإشعاران الدائن والمدين يشتركان في **الآلية** (مطالبة · حجز · سعة · كتابة      ║
// ║  ذرّية · تعويض) ويختلفان في **الإعدادات** (المجموعات · الحقول · الاتجاه). لذلك   ║
// ║  محرّك واحد + إعدادات، لا نسختان تتباعدان (§6: لا تكرار للبنية التحتية).         ║
// ║  ⚠️ الاشتراك في الآلية **لا يفترض تماثل السلوك المحاسبي** — البناء يأتي من        ║
// ║  دوال نقيّة مستقلّة لكل مسار، وكلٌّ مُختبَر ومُقارَن بالقديم على حدة.               ║
// ║                                                                              ║
// ║  لا مسار جديد ولا حقل جديد خارج ما وافق عليه المالك:                           ║
// ║    ledger/{creditNotes|debitNotes}/{k}            ← موجودة                     ║
// ║    ledger/{salesInvoices|purchaseInvoices}/{k}    ← موجودة                     ║
// ║    ledger/journalEntries/{k} · ledger/inventoryMovements/{k}  ← موجودة         ║
// ║    ledger/counters/jrn/… · ledger/counters/invmov/…           ← موجودة         ║
// ║    ledger/counters/{cn|dn}/{year}   ← **قرار المالك رقم 2، داخل counters القائمة** ║
// ║  **لا تعديل على database.rules.json.**                                        ║
// ║                                                                              ║
// ║  ═══ الترتيب ═══                                                              ║
// ║  1. مطالبة الإشعار (معاملة، غائب→draft)   ← تُحرَّر عند أي فشل لاحق              ║
// ║  2. حجز رقم الإشعار · رقم القيد · أرقام الحركات (معاملات مستقلّة)               ║
// ║  3. بناء المستند (نقيّ)                                                        ║
// ║  4. معاملة على الفاتورة المصدر: فحص السعة + تحديث ذرّي  ← تُعوَّض عند أي فشل لاحق ║
// ║  5. بناء القيد والحركات (نقيّ)                                                 ║
// ║  6. كتابة ذرّية واحدة: المستند + القيد + كل الحركات                             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { RepositoryError, REPO_ERRORS, translateRtdbError } from '../contracts/errors.js';
import { AtomicityError } from '../../services/accounting/errors/AtomicityError.js';
import { DuplicatePostingError } from '../../services/accounting/errors/DuplicatePostingError.js';
import { AllocationConflictError } from '../../services/accounting/errors/AllocationConflictError.js';
import { ValidationError } from '../../services/accounting/errors/ValidationError.js';
import { computeNoteCapacity } from '../../domain/accounting/notes/computeNoteCapacity.js';
import {
    reserveJournalNumber, reserveInventoryMovementNumber,
    reserveNoteNumber, claimNoteCreation, releaseNoteClaim, pollForPostedLink
} from './postingHelpers.js';

const JOURNALS_PATH = 'ledger/journalEntries';
const MOVEMENTS_PATH = 'ledger/inventoryMovements';

/** يُعيد بناء كائن الفاتورة بعد استرجاع حقول بعينها إلى قيمها السابقة (غياب = حذف). */
function restoreFields(current, fields, prior) {
    const out = { ...current };
    for (const f of fields) {
        if (prior[f] === undefined) delete out[f];
        else out[f] = prior[f];
    }
    return out;
}

export class NotePostingEngine {
    /**
     * @param {object} port منفذ RTDB من createRtdbPort
     * @param {object} cfg  {noteCollection, invoiceCollection, counterKind, movementType, fields}
     */
    constructor(port, cfg) {
        if (!port) throw new RepositoryError(REPO_ERRORS.UNAVAILABLE, 'منفذ RTDB مطلوب');
        this._p = port;
        this._c = cfg;
    }

    _ref(path) { return this._p.ref(this._p.db, path); }

    async post({ noteKey, invoiceKey, noteAmount, buildNote, buildJournal, movementCount = 0, buildMovements, journalBookPrefix = 'JV' }) {
        const C = this._c, F = C.fields;
        if (!noteKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الإشعار مطلوب');
        if (!invoiceKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الفاتورة المصدر مطلوب');

        const notePath = `${C.noteCollection}/${noteKey}`;
        const invoicePath = `${C.invoiceCollection}/${invoiceKey}`;

        // ── 1. مطالبة Idempotency الخادمية ───────────────────────────────────────
        const claim = await claimNoteCreation(this._p, `${notePath}/status`);
        if (!claim || !claim.committed) {
            const existing = await pollForPostedLink(this._p, notePath);
            throw new DuplicatePostingError(
                existing && existing.journalEntryKey
                    ? 'الإشعار مُرحَّل بالفعل'
                    : 'الإشعار مُطالَب به بالفعل — ترحيل متزامن جارٍ أو محاولة سابقة لم تُحرَّر',
                {
                    noteKey,
                    original: existing && existing.journalEntryKey
                        ? { noteId: noteKey, noteNumber: existing.number || null, journalId: existing.journalEntryKey, journalNumber: existing.journalEntryNumber || null }
                        : null
                }
            );
        }

        let allocated = null;   // {prior} — لازم للتعويض
        try {
            // ── 2. حجز الأرقام (معاملات مستقلّة — خارج الذرّية، فجوات مقبولة) ──────
            const noteNumber = await reserveNoteNumber(this._p, C.counterKind);
            const journalNumber = await reserveJournalNumber(this._p, journalBookPrefix);
            const movementNumbers = [];
            for (let i = 0; i < movementCount; i++) {
                movementNumbers.push(await reserveInventoryMovementNumber(this._p, C.movementType));
            }

            // ── 3. بناء المستند (نقيّ) ────────────────────────────────────────────
            const note = buildNote(noteNumber);

            // ── 4. معاملة الفاتورة المصدر: فحص السعة + التحديث معاً ────────────────
            let capacity = null;
            const prior = {};
            let tx;
            try {
                tx = await this._p.runTransaction(this._ref(invoicePath), current => {
                    if (current == null) {
                        throw new ValidationError(`الفاتورة المصدر ${invoiceKey} غير موجودة`, { invoiceKey });
                    }
                    // القيم السابقة — تُلتقط داخل المعاملة كي يكون التعويض دقيقاً
                    prior[F.notedAmount] = current[F.notedAmount];
                    prior[F.fully] = current[F.fully];
                    prior[F.keys] = current[F.keys];
                    prior[F.number] = current[F.number];

                    capacity = computeNoteCapacity({
                        invoiceKey,
                        grandTotal: current.grandTotal,
                        currentNotedAmount: current[F.notedAmount],
                        noteAmount,
                        noteKey,
                        existingKeys: current[F.keys],
                        legacySingleKey: current[F.legacySingle]
                    });

                    return {
                        ...current,
                        [F.number]: noteNumber,
                        [F.keys]: capacity.nextKeys,
                        [F.notedAmount]: capacity.nextNotedAmount,
                        ...(capacity.fullyNoted ? { [F.fully]: true } : {})
                    };
                });
            } catch (e) {
                if (e instanceof ValidationError || e instanceof AllocationConflictError) throw e;
                throw translateRtdbError(e);
            }
            if (!tx || !tx.committed) {
                throw new AllocationConflictError(
                    `تعذّر تحديث الفاتورة المصدر ${invoiceKey} — تعارض تزامن`, { invoiceKey, noteKey });
            }
            allocated = { prior };

            // ── 5. بناء القيد والحركات (نقيّ — مُتحقَّق منه مسبقاً في الخدمة) ────────
            const { journal } = buildJournal(journalNumber, note);
            const movements = movementCount ? buildMovements(movementNumbers, note) : [];
            if (movements.length !== movementCount) {
                throw new RepositoryError(REPO_ERRORS.UNKNOWN,
                    `عدد الحركات المبنيّة (${movements.length}) لا يطابق العدد المحجوز (${movementCount})`);
            }

            const journalId = this._p.push(this._ref(JOURNALS_PATH)).key;
            const movementIds = movements.map(() => this._p.push(this._ref(MOVEMENTS_PATH)).key);

            // ── 6. الكتابة الذرّية الوحيدة ────────────────────────────────────────
            const updates = {
                // المستند كاملاً بحالة 'posted' — هذا هو انتقال draft → posted
                [notePath]: { ...note, status: 'posted', journalEntryKey: journalId, journalEntryNumber: journalNumber }
            };
            updates[`${JOURNALS_PATH}/${journalId}`] = journal;
            movements.forEach((m, i) => { updates[`${MOVEMENTS_PATH}/${movementIds[i]}`] = m; });

            try {
                await this._p.update(this._ref('/'), updates);
            } catch (e) {
                await this._compensateInvoice(invoicePath, noteKey, prior, F);
                await releaseNoteClaim(this._p, notePath);
                throw new AtomicityError(
                    'فشلت الكتابة الذرّية للإشعار — لا مستند ولا قيد ولا حركات (وتخصيص الفاتورة عُوِّض)',
                    { noteKey, invoiceKey, journalId, journalNumber, movementCount, cause: e && e.message });
            }

            return {
                noteId: noteKey, noteNumber, journalId, journalNumber,
                alreadyPosted: false, movementIds, movementNumbers,
                invoiceState: {
                    notedAmount: capacity.nextNotedAmount,
                    fullyNoted: capacity.fullyNoted,
                    remainingAfter: capacity.remainingAfter,
                    keys: capacity.nextKeys
                }
            };
        } catch (e) {
            if (e instanceof AtomicityError) throw e;
            if (allocated) await this._compensateInvoice(invoicePath, noteKey, allocated.prior, F);
            await releaseNoteClaim(this._p, notePath);
            throw e;
        }
    }

    /**
     * تعويض عكسي على الفاتورة المصدر — يسترجع الحقول الأربعة إلى قيمها السابقة
     * ويُزيل مفتاح الإشعار من المصفوفة. أفضل جهد: لا نرمي إن فشل التعويض نفسه؛
     * الخطأ الأصلي هو ما يُبلَّغ (نفس سياسة Phase 7-B).
     */
    async _compensateInvoice(invoicePath, noteKey, prior, F) {
        try {
            await this._p.runTransaction(this._ref(invoicePath), current => {
                if (current == null) return undefined;
                const restored = restoreFields(current, [F.notedAmount, F.fully, F.keys, F.number], prior);
                if (Array.isArray(restored[F.keys])) {
                    const filtered = restored[F.keys].filter(k => k !== noteKey);
                    if (filtered.length) restored[F.keys] = filtered; else delete restored[F.keys];
                }
                return restored;
            });
        } catch (e) { /* أفضل جهد فقط — موثَّق كحدّ معروف */ }
    }
}

/** إعدادات المسارين — الفارق كله هنا، لا في المحرّك. */
export const CREDIT_NOTE_CONFIG = Object.freeze({
    noteCollection: 'ledger/creditNotes',
    invoiceCollection: 'ledger/salesInvoices',
    counterKind: 'cn',
    movementType: 'in',
    fields: Object.freeze({
        notedAmount: 'creditedAmount', keys: 'creditNoteKeys',
        fully: 'fullyCredited', number: 'creditNoteNumber', legacySingle: 'creditNoteKey'
    })
});

export const DEBIT_NOTE_CONFIG = Object.freeze({
    noteCollection: 'ledger/debitNotes',
    invoiceCollection: 'ledger/purchaseInvoices',
    counterKind: 'dn',
    movementType: 'out',
    fields: Object.freeze({
        notedAmount: 'debitedAmount', keys: 'debitNoteKeys',
        fully: 'fullyDebited', number: 'debitNoteNumber', legacySingle: 'debitNoteKey'
    })
});
