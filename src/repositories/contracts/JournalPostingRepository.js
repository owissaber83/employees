// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عقد مستودع الترحيل الذرّي                                            [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الواجهة التي تعرفها خدمة التطبيق (postPurchaseInvoice). لا تذكر Firebase ولا   ║
// ║  RTDB — التنفيذ (Firebase أو لاحقاً PostgreSQL) هو من يعرف تفاصيل الذرّية        ║
// ║  والتزامن الفعلية لمحرّك التخزين.                                              ║
// ║                                                                              ║
// ║  ⚠️ العقد الأساسي: `postAtomic` تضمن إحدى نتيجتين فقط —                       ║
// ║     نجاح: كل الكتابات المطلوبة تمّت معاً                                       ║
// ║     فشل:  لا كتابة واحدة تمّت (لا حالة جزئية) — أو DuplicatePostingError إن     ║
// ║           كان المصدر مُرحَّلاً بالفعل (ليس فشلاً، بل نتيجة Idempotent)           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { RepositoryError, REPO_ERRORS } from './errors.js';

const notImplemented = name => {
    throw new RepositoryError(REPO_ERRORS.NOT_IMPLEMENTED, `${name} غير مُنفَّذة في هذا المستودع`);
};

export class JournalPostingRepository {
    /**
     * يرحّل فاتورة مشتريات ذرّياً: يحجز رقم القيد، يكتسب قفل الحالة (draft→posted)
     * بطريقة آمنة من التزامن، ثم يكتب القيد وربط الفاتورة في تحديث ذرّي واحد.
     *
     * @param {object} p
     * @param {string} p.invoiceKey
     * @param {(journalNumber:string)=>{journal:object}} p.buildJournal
     *        دالة نقيّة تبني القيد بعد معرفة رقمه — تُستدعى **بعد** نجاح حجز الرقم
     *        وحجز حالة الفاتورة، لا قبله (يضمن ألا يُهدَر رقم عند تكرار).
     * @returns {Promise<{journalId:string, journalNumber:string, alreadyPosted:boolean}>}
     * @throws {import('../../services/accounting/errors/DuplicatePostingError.js').DuplicatePostingError}
     * @throws {import('../../services/accounting/errors/AtomicityError.js').AtomicityError}
     */
    async postPurchaseInvoiceAtomic(p) { return notImplemented('postPurchaseInvoiceAtomic'); }
}
