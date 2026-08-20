// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عقد مستودع القيد اليدوي                                            [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ⚠️ الفارق البنيوي عن كل المسارات السابقة: **لا مستند مصدر**. القيد نفسه هو      ║
// ║  المستند، فلا فاتورة ولا سند ولا إشعار يُطالَب به. لذلك المرساة هي مفتاح القيد    ║
// ║  الذي يولّده المستدعي محلّياً (`push(ref).key`) ويعيد استخدامه عند إعادة المحاولة. ║
// ║                                                                              ║
// ║  1) مطالبة على `journalEntries/{journalKey}/status` (غائب → `__claiming__`).    ║
// ║  2) كتابة ذرّية واحدة تكتب القيد كاملاً بحالته النهائية (`draft` أو `posted`).   ║
// ║  3) العدّاد خارج الذرّية.                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { RepositoryError, REPO_ERRORS } from './errors.js';

const notImplemented = name => {
    throw new RepositoryError(REPO_ERRORS.NOT_IMPLEMENTED, `${name} غير مُنفَّذة في هذا المستودع`);
};

export class ManualJournalPostingRepository {
    /**
     * @param {object} p
     * @param {string} p.journalKey مفتاح مُولَّد محلّياً — مرساة Idempotency
     * @param {(journalNumber:string)=>{journal:object}} p.buildJournal نقيّة
     * @param {string} [p.journalBookPrefix]
     * @returns {Promise<{journalId:string, journalNumber:string, alreadyPosted:boolean}>}
     */
    async postManualJournalAtomic(p) { return notImplemented('postManualJournalAtomic'); }
}
