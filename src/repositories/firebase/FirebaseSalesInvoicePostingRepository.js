// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ ترحيل فاتورة المبيعات على Firebase RTDB                     [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  لا مسار جديد ولا حقل جديد — كل المسارات منقولة حرفياً من accounting.js:        ║
// ║    ledger/salesInvoices/{key}/status·journalEntryKey·journalEntryNumber        ║
// ║        ·postedAt·postedBy                            ← موجودة (:16676, :16646) ║
// ║    ledger/journalEntries/{key}                       ← موجودة                 ║
// ║    ledger/inventoryMovements/{key}                   ← موجودة (:21699)        ║
// ║    ledger/counters/jrn/{prefix}/{year}               ← موجودة (:3370)          ║
// ║    ledger/counters/invmov/out/{year}                 ← موجودة (:20348)         ║
// ║  **لا حقل جديد · لا مجموعة جديدة (لا postingLocks/) · لا تعديل على القواعد.**   ║
// ║                                                                              ║
// ║  ═══ الفارق الجوهري عن القديم (فرق مُصنَّف C — موثَّق ومُختبَر) ═══                ║
// ║  القديم: 3 + 2×N كتابة مستقلّة (قيد ← ربط ← حالة ← N×[عدّاد + حركة])، وكل حركة   ║
// ║  داخل try/catch يبتلع الخطأ. 8 نقاط فشل تترك حالة جزئية على فاتورة بثلاثة أصناف.║
// ║  هنا: **كتابة ذرّية واحدة** تضمّ القيد + الربط + كل الحركات معاً. لا حركة ناقصة   ║
// ║  بصمت، ولا قيد يتيم، ولا فاتورة مرحّلة بلا مخزون.                               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { SalesInvoicePostingRepository } from '../contracts/SalesInvoicePostingRepository.js';
import { RepositoryError, REPO_ERRORS } from '../contracts/errors.js';
import { AtomicityError } from '../../services/accounting/errors/AtomicityError.js';
import { DuplicatePostingError } from '../../services/accounting/errors/DuplicatePostingError.js';
import {
    reserveJournalNumber, reserveInventoryMovementNumber,
    claimDraftToPosted, pollForPostedLink, safeRollbackStatus
} from './postingHelpers.js';

const INVOICES_PATH = 'ledger/salesInvoices';
const JOURNALS_PATH = 'ledger/journalEntries';
const MOVEMENTS_PATH = 'ledger/inventoryMovements';

export class FirebaseSalesInvoicePostingRepository extends SalesInvoicePostingRepository {
    /** @param {object} port منفذ RTDB من createRtdbPort */
    constructor(port) {
        super();
        if (!port) throw new RepositoryError(REPO_ERRORS.UNAVAILABLE, 'منفذ RTDB مطلوب');
        this._p = port;
    }

    _ref(path) { return this._p.ref(this._p.db, path); }

    async postSalesInvoiceAtomic({ invoiceKey, buildJournal, movementCount = 0, buildMovements, journalBookPrefix = 'JV' }) {
        if (!invoiceKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الفاتورة مطلوب');

        // ── 1. بوّابة Idempotency الآمنة من التزامن — حقل status الموجود ──────────
        const claim = await claimDraftToPosted(this._p, `${INVOICES_PATH}/${invoiceKey}/status`);
        if (!claim || !claim.committed) {
            // حدّ موثَّق: «الخاسر» قد يقرأ قبل أن يُنهي «الفائز» كتابته الذرّية — استطلاع
            // محدود يُغلق النافذة عملياً بلا ادّعاء حسم مطلق (نفس Phase 6/7-B).
            const existing = await pollForPostedLink(this._p, `${INVOICES_PATH}/${invoiceKey}`);
            throw new DuplicatePostingError(
                existing && existing.journalEntryKey ? 'الفاتورة مُرحَّلة بالفعل' : 'الفاتورة ليست مسوّدة — لا يمكن ترحيلها (أو الترحيل المتزامن لم يكتمل كتابته بعد)',
                { invoiceKey, original: existing && existing.journalEntryKey ? { journalId: existing.journalEntryKey, journalNumber: existing.journalEntryNumber || null } : null }
            );
        }

        try {
            // ── 2. حجز الأرقام (معاملات مستقلّة — ليست جزءاً من الذرّية، §3 من العقد) ──
            const journalNumber = await reserveJournalNumber(this._p, journalBookPrefix);
            const movementNumbers = [];
            for (let i = 0; i < movementCount; i++) {
                movementNumbers.push(await reserveInventoryMovementNumber(this._p, 'out'));
            }

            // ── 3. بناء نقيّ — مُتحقَّق منه مسبقاً في الخدمة، لا يُتوقَّع فشله هنا ──────
            const { journal } = buildJournal(journalNumber);
            const movements = movementCount ? buildMovements(movementNumbers) : [];
            if (movements.length !== movementCount) {
                throw new RepositoryError(REPO_ERRORS.UNKNOWN,
                    `عدد الحركات المبنيّة (${movements.length}) لا يطابق العدد المحجوز (${movementCount})`);
            }

            // ── مفاتيح محلّية بلا كتابة (push بلا بيانات) ─────────────────────────
            const journalId = this._p.push(this._ref(JOURNALS_PATH)).key;
            const movementIds = movements.map(() => this._p.push(this._ref(MOVEMENTS_PATH)).key);

            // ── 4. الكتابة الذرّية الوحيدة — القيد + الربط + كل الحركات معاً ─────────
            const updates = {
                [`${JOURNALS_PATH}/${journalId}`]: journal,
                [`${INVOICES_PATH}/${invoiceKey}/journalEntryKey`]: journalId,
                [`${INVOICES_PATH}/${invoiceKey}/journalEntryNumber`]: journalNumber,
                [`${INVOICES_PATH}/${invoiceKey}/postedAt`]: journal.postedAt,
                [`${INVOICES_PATH}/${invoiceKey}/postedBy`]: journal.postedBy
                // status متروك كما قلبته المعاملة في الخطوة 1 — نفس انضباط Phase 6/7-B
            };
            movements.forEach((m, i) => { updates[`${MOVEMENTS_PATH}/${movementIds[i]}`] = m; });

            try {
                await this._p.update(this._ref('/'), updates);
            } catch (e) {
                await safeRollbackStatus(this._p, `${INVOICES_PATH}/${invoiceKey}`);
                throw new AtomicityError('فشلت الكتابة الذرّية للترحيل — لا القيد كُتب ولا الحركات ولا رُبطت الفاتورة',
                    { invoiceKey, journalId, journalNumber, movementCount, cause: e && e.message });
            }

            return { journalId, journalNumber, alreadyPosted: false, movementIds, movementNumbers };
        } catch (e) {
            if (e instanceof AtomicityError) throw e;
            // أي عطل بعد نجاح المطالبة (حجز رقم فشل، بناء رمى) ⇒ استرجاع الحالة كي لا
            // تبقى الفاتورة «مقفلة» على ترحيل لم يقع. لا تعويض آخر مطلوب: لا كتابة تمّت.
            await safeRollbackStatus(this._p, `${INVOICES_PATH}/${invoiceKey}`);
            throw e;
        }
    }
}
