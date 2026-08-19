// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عقد مستودع ترحيل فاتورة المبيعات (قيد + حركات مخزون)               [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الواجهة التي تعرفها خدمة التطبيق (postSalesInvoice). لا تذكر Firebase ولا RTDB. ║
// ║                                                                              ║
// ║  ═══ نموذج الاتساق — ما يُضمَن حرفياً وما لا يُضمَن ═══                          ║
// ║  1) **بوّابة Idempotency آمنة من التزامن**: runTransaction على حقل `status`      ║
// ║     الموجود (draft→posted). فائز واحد فقط. لا حقل ولا مجموعة جديدة.            ║
// ║  2) **كتابة ذرّية واحدة حقيقية** تضمّ: القيد + ربط الفاتورة + **كل** حركات        ║
// ║     المخزون معاً — `update` واحد متعدّد المسارات. كل شيء أو لا شيء.             ║
// ║     👈 هذا يُغلق بنيوياً «فاتورة مرحّلة بلا حركة مخزون» و«قيد يتيم» معاً.         ║
// ║  3) **العدّادات ليست جزءاً من الذرّية** — `counters/jrn` و`counters/invmov`      ║
// ║     معاملات مستقلّة سابقة للكتابة. فشل بعدها يحرق أرقاماً (فجوة ترقيم فقط، بلا   ║
// ║     أثر مالي). نفس سلوك القديم حرفياً — لا ادّعاء ذرّية لا تقع.                  ║
// ║  4) فشل الكتابة الذرّية ⇒ استرجاع `status` إلى `draft` (أفضل جهد) + AtomicityError. ║
// ║     لا تعويض على مجموعات أخرى **لأنه غير مطلوب**: لم تُكتب أي حركة أصلاً.         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { RepositoryError, REPO_ERRORS } from './errors.js';

const notImplemented = name => {
    throw new RepositoryError(REPO_ERRORS.NOT_IMPLEMENTED, `${name} غير مُنفَّذة في هذا المستودع`);
};

export class SalesInvoicePostingRepository {
    /**
     * @param {object} p
     * @param {string} p.invoiceKey
     * @param {(journalNumber:string)=>{journal:object}} p.buildJournal
     *        نقيّة — تُستدعى بعد نجاح حجز الحالة وحجز الرقم فقط.
     * @param {number} p.movementCount عدد حركات المخزون المطلوب حجز أرقام لها (قد يكون 0)
     * @param {(numbers:string[])=>Array<object>} p.buildMovements
     *        نقيّة — تتلقّى الأرقام المحجوزة بالترتيب وتعيد سجلات الحركات الجاهزة.
     * @param {string} [p.journalBookPrefix]
     * @returns {Promise<{journalId:string, journalNumber:string, alreadyPosted:boolean, movementIds:string[], movementNumbers:string[]}>}
     * @throws {import('../../services/accounting/errors/DuplicatePostingError.js').DuplicatePostingError}
     * @throws {import('../../services/accounting/errors/AtomicityError.js').AtomicityError}
     */
    async postSalesInvoiceAtomic(p) { return notImplemented('postSalesInvoiceAtomic'); }
}
