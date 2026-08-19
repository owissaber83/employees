// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ الترحيل الذرّي على Firebase RTDB                               [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الملف **الوحيد** الذي يعرف أن التخزين RTDB. لا مسار جديد ولا حقل جديد —        ║
// ║  كل المسارات والحقول منقولة حرفياً من accounting.js (§16 من التعليمات):         ║
// ║    ledger/journalEntries/{key}                  ← موجودة أصلاً                 ║
// ║    ledger/purchaseInvoices/{key}/status          ← موجود أصلاً — نُعيد استخدامه ║
// ║    ledger/purchaseInvoices/{key}/journalEntryKey ← موجود أصلاً (accounting.js:18760) ║
// ║    ledger/counters/jrn/{prefix}/{year}           ← موجود أصلاً (accounting.js:3370) ║
// ║  **لا حقل جديد. لا مجموعة جديدة. لا تعديل على database.rules.json.**            ║
// ║                                                                              ║
// ║  ═══ الآلية الذرّية (§6) ═══                                                   ║
// ║  1. بوّابة Idempotency: runTransaction يحاول قلب status من 'draft' إلى         ║
// ║     'posted'. متزامنة الأمان بحكم Firebase (خادمي، يُعيد المحاولة عند تعارض) —  ║
// ║     **ليست** "if(!exists) create()" منفصلتين (§8، الممنوع صراحةً).             ║
// ║  2. لا commit ⇒ الفاتورة مُرحَّلة بالفعل أو ليست مسوّدة ⇒ DuplicatePostingError   ║
// ║     تحمل نتيجة الترحيل الأصلية — لا كتابة إضافية إطلاقاً.                       ║
// ║  3. commit ⇒ حجز رقم القيد ذرّياً (نفس آلية generateJrnNumberAtomic تماماً).     ║
// ║  4. بناء القيد (buildJournal مُمرَّرة من الخدمة، **مُتحقَّق منها مسبقاً** بمعامل    ║
// ║     رقم مؤقّت — فلا تفشل هنا في المسار السعيد، ولا يُهدَر رقم القيد).            ║
// ║  5. كتابة ذرّية **واحدة** متعدّدة المسارات (update بمفاتيح مطلقة تبدأ بـ         ║
// ║     'ledger/' فتمرّ عبر scopeUpdates() الموجودة في app.js تلقائياً — لا نستدعيها ║
// ║     يدوياً هنا، window.update تفعل ذلك داخلياً (app.js:202)). النجاح أو الفشل   ║
// ║     الكامل فقط — لا تسلسل كتابات مستقلة (بالضبط ما مُنع صراحةً في §6).           ║
// ║  فشل الكتابة الذرّية ⇒ استرجاع status إلى 'draft' (محاولة أفضل جهد) ثم           ║
// ║  AtomicityError — لا حالة وسيطة تبقى في الفاتورة.                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { JournalPostingRepository } from '../contracts/JournalPostingRepository.js';
import { RepositoryError, REPO_ERRORS } from '../contracts/errors.js';
import { AtomicityError } from '../../services/accounting/errors/AtomicityError.js';
import { DuplicatePostingError } from '../../services/accounting/errors/DuplicatePostingError.js';
import { reserveJournalNumber, claimDraftToPosted, pollForPostedLink, safeRollbackStatus } from './postingHelpers.js'; // [Phase 7] مشتركة مع FirebaseVoucherPostingRepository

const INVOICES_PATH = 'ledger/purchaseInvoices';
const JOURNALS_PATH = 'ledger/journalEntries';

export class FirebaseJournalPostingRepository extends JournalPostingRepository {
    /** @param {object} port منفذ RTDB من createRtdbPort — نفس نمط Phase 3 */
    constructor(port) {
        super();
        if (!port) throw new RepositoryError(REPO_ERRORS.UNAVAILABLE, 'منفذ RTDB مطلوب');
        this._p = port;
    }

    _ref(path) { return this._p.ref(this._p.db, path); }

    async postPurchaseInvoiceAtomic({ invoiceKey, buildJournal, journalBookPrefix = 'JV' }) {
        if (!invoiceKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الفاتورة مطلوب');

        // ── 1+2. بوّابة Idempotency الآمنة من التزامن — حقل status الموجود، لا حقل جديد ──
        const claim = await claimDraftToPosted(this._p, `${INVOICES_PATH}/${invoiceKey}/status`);

        if (!claim || !claim.committed) {
            // ⚠️ حدّ موثَّق (§8، §16 من docs/services/idempotency.md): «الخاسر» في سباق حقيقي
            // قد يقرأ الفاتورة **قبل** أن يُنهي «الفائز» كتابته الذرّية (الحالة تنقلب أولاً
            // بمعاملة منفصلة، وjournalEntryKey يُكتب لاحقاً ضمن التحديث الذرّي). محاولات
            // محدودة بتأخير قصير تُغلق هذه النافذة عملياً (الكتابة الذرّية تكتمل خلال
            // ميلي ثوانٍ عادةً) دون أن تدّعي حسماً مطلقاً — لا قفل خادمي حقيقي متاح على Spark.
            const existing = await pollForPostedLink(this._p, `${INVOICES_PATH}/${invoiceKey}`);
            throw new DuplicatePostingError(
                existing && existing.journalEntryKey ? 'الفاتورة مُرحَّلة بالفعل' : 'الفاتورة ليست مسوّدة — لا يمكن ترحيلها (أو الترحيل المتزامن لم يكتمل كتابته بعد)',
                { invoiceKey, original: existing && existing.journalEntryKey ? { journalId: existing.journalEntryKey, journalNumber: existing.journalEntryNumber || null } : null }
            );
        }

        try {
            // ── 3. حجز رقم القيد ذرّياً — نفس مسار وآلية generateJrnNumberAtomic تماماً ──
            const journalNumber = await reserveJournalNumber(this._p, journalBookPrefix);

            // ── 4. بناء القيد. مُتحقَّق منه مسبقاً من الخدمة (§11) — لا يُتوقَّع فشله هنا ──
            const { journal } = buildJournal(journalNumber);

            // ── مفتاح جديد بلا كتابة (push بلا بيانات يُولِّد مفتاحاً محلياً فقط) ──
            const journalId = this._p.push(this._ref(JOURNALS_PATH)).key;

            // ── 5. الكتابة الذرّية الوحيدة — كل شيء أو لا شيء ──
            const updates = {
                [`${JOURNALS_PATH}/${journalId}`]: journal,
                [`${INVOICES_PATH}/${invoiceKey}/journalEntryKey`]: journalId,
                [`${INVOICES_PATH}/${invoiceKey}/journalEntryNumber`]: journalNumber,
                [`${INVOICES_PATH}/${invoiceKey}/postedAt`]: journal.postedAt,
                [`${INVOICES_PATH}/${invoiceKey}/postedBy`]: journal.postedBy
                // status متروك كما قلبته المعاملة في الخطوة 1 — لا يُعاد كتابته هنا
                // عمداً: كتابته هنا ثانيةً يخفي أي تعارض لو غيّره طرف آخر بين الخطوتين.
            };
            try {
                await this._p.update(this._ref('/'), updates);
            } catch (e) {
                await safeRollbackStatus(this._p, `${INVOICES_PATH}/${invoiceKey}`);
                throw new AtomicityError('فشلت الكتابة الذرّية للترحيل — لا القيد كُتب ولا الفاتورة رُبطت',
                    { invoiceKey, journalId, journalNumber, cause: e && e.message });
            }

            return { journalId, journalNumber, alreadyPosted: false };
        } catch (e) {
            if (e instanceof AtomicityError) throw e;
            // أي عطل آخر بعد نجاح المعاملة (حجز الرقم فشل، أو buildJournal رمى رغم التحقّق
            // المسبق) ⇒ استرجاع الفاتورة إلى مسوّدة كي لا تبقى "مقفلة" على ترحيل لم يحدث.
            await safeRollbackStatus(this._p, `${INVOICES_PATH}/${invoiceKey}`);
            throw e;
        }
    }
}
