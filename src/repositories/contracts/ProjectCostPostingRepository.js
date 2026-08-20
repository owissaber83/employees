// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عقد مستودع ترحيل تكلفة المشروع الشهرية (PMC)                      [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ═══ نموذج الاتساق ═══                                                        ║
// ║  1) **مطالبة Idempotency** على حقل `journalEntryKey` **الموجود** على سجل        ║
// ║     التكلفة (غائب → مُطالَب). لا حقل جديد ولا مجموعة جديدة.                     ║
// ║  2) **كتابة ذرّية واحدة**: القيد + ربطه بسجل التكلفة معاً.                      ║
// ║  3) عدّاد رقم القيد خارج الذرّية — معاملة مستقلّة سابقة (فجوة مقبولة).           ║
// ║  4) فشل بعد المطالبة ⇒ تحرير المطالبة (أفضل جهد).                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { RepositoryError, REPO_ERRORS } from './errors.js';

const notImplemented = name => {
    throw new RepositoryError(REPO_ERRORS.NOT_IMPLEMENTED, `${name} غير مُنفَّذة في هذا المستودع`);
};

export class ProjectCostPostingRepository {
    /**
     * @param {object} p
     * @param {string} p.pmcKey مفتاح سجل التكلفة الموجود
     * @param {(journalNumber:string)=>{journal:object}} p.buildJournal نقيّة
     * @param {string} [p.journalBookPrefix]
     * @returns {Promise<{journalId:string, journalNumber:string, alreadyPosted:boolean}>}
     */
    async postProjectCostAtomic(p) { return notImplemented('postProjectCostAtomic'); }
}
