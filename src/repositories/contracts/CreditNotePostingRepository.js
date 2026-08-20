// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عقد مستودع ترحيل الإشعار الدائن                                    [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الواجهة التي تعرفها `postCreditNote`. لا تذكر Firebase ولا RTDB.               ║
// ║                                                                              ║
// ║  ═══ نموذج الاتساق — ما يُضمَن حرفياً وما لا يُضمَن ═══                          ║
// ║  1) **مطالبة Idempotency خادمية** على `creditNotes/{noteKey}/status` (غائب→draft). ║
// ║     فائز واحد فقط. لا حقل جديد ولا مجموعة جديدة.                              ║
// ║  2) **فحص السعة المتبقّية داخل معاملة على الفاتورة المصدر** — يرفض التجاوز        ║
// ║     ويمنع ضياع التحديث في آنٍ واحد (BUG-012 + BUG-013).                        ║
// ║  3) **كتابة ذرّية واحدة** تضمّ: مستند الإشعار + القيد + **كل** حركات المخزون.    ║
// ║  4) **العدّادات والفاتورة المصدر خارج تلك الذرّية** — معاملات مستقلّة سابقة.      ║
// ║     فشل بعدها ⇒ **تعويض صريح** (Saga): عكس تخصيص الفاتورة ثم تحرير المطالبة.    ║
// ║     التعويض **أفضل جهد** — لا يُدَّعى أكثر ممّا تقدّمه RTDB فعلاً.                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { RepositoryError, REPO_ERRORS } from './errors.js';

const notImplemented = name => {
    throw new RepositoryError(REPO_ERRORS.NOT_IMPLEMENTED, `${name} غير مُنفَّذة في هذا المستودع`);
};

export class CreditNotePostingRepository {
    /**
     * @param {object} p
     * @param {string} p.noteKey      مفتاح مُولَّد محلّياً (`push(ref).key`) — مرساة Idempotency
     * @param {string} p.invoiceKey   فاتورة المبيعات المصدر
     * @param {number} p.noteAmount   إجمالي الإشعار (لفحص السعة داخل المعاملة)
     * @param {(noteNumber:string)=>object} p.buildNote        نقيّة
     * @param {(journalNumber:string, note:object)=>{journal:object}} p.buildJournal  نقيّة
     * @param {number} p.movementCount
     * @param {(numbers:string[], note:object)=>Array<object>} p.buildMovements       نقيّة
     * @returns {Promise<{noteId, noteNumber, journalId, journalNumber, alreadyPosted, movementIds, movementNumbers, invoiceState}>}
     */
    async postCreditNoteAtomic(p) { return notImplemented('postCreditNoteAtomic'); }
}
