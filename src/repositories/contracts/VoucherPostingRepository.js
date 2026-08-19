// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عقد مستودع ترحيل السند وتخصيصه على N فاتورة                          [Phase 7] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الواجهة التي تعرفها خدمة التطبيق (postVoucher). لا تذكر Firebase ولا RTDB.     ║
// ║                                                                              ║
// ║  ⚠️ نموذج الاتساق **ليس** ذرّية N+1 مسار حقيقية — RTDB لا تدعمها بنيوياً على     ║
// ║  عقد multi-invoice متغيّر الطول (§6 من تعليمات Phase 7 Step B). العقد الفعلي:   ║
// ║                                                                              ║
// ║  1) **كل تخصيص فردي على فاتورة واحدة آمن من التزامن فعلياً** — عبر runTransaction ║
// ║     خادمي حقيقي (Firebase يعيد المحاولة عند تعارض)؛ يرفض التجاوز صراحةً.        ║
// ║  2) **الكتابة النهائية (قيد + ربط السند) ذرّية بالمعنى الحرفي** — update واحد    ║
// ║     متعدّد المسارات، كل شيء أو لا شيء.                                        ║
// ║  3) بين (1) و(2): إن فشل تخصيص لاحق بعد نجاح تخصيصات سابقة، أو فشلت الكتابة     ║
// ║     النهائية بعد نجاح كل التخصيصات — **تعويض صريح** (Saga): كل تخصيص ناجح       ║
// ║     يُعكَس بمعاملة عكسية، ثم تُسترجَع حالة السند. النتيجة النهائية متّسقة، لكن     ║
// ║     هناك نافذة زمنية قصيرة أثناء التنفيذ تكون فيها بعض الفواتير محدَّثة والبعض    ║
// ║     الآخر لا — موثَّقة صراحةً في docs/services/voucher-atomicity.md، لا مخفيّة.   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { RepositoryError, REPO_ERRORS } from './errors.js';

const notImplemented = name => {
    throw new RepositoryError(REPO_ERRORS.NOT_IMPLEMENTED, `${name} غير مُنفَّذة في هذا المستودع`);
};

export class VoucherPostingRepository {
    /**
     * يرحّل سند قبض/صرف: يكتسب قفل الحالة (draft→posted) ذرّياً، يخصّص المبلغ على
     * N فاتورة (كل واحدة آمنة من التزامن على حدة، ترفض التجاوز)، ثم يحجز رقم القيد
     * ويكتب القيد+ربط السند في تحديث ذرّي واحد.
     *
     * @param {object} p
     * @param {string} p.voucherKey
     * @param {'receipt'|'payment'} p.voucherType
     * @param {Record<string,number>|null|undefined} p.allocations  {مفتاح الفاتورة: مبلغ}
     * @param {(journalNumber:string)=>{journal:object}} p.buildJournal
     * @param {string} [p.journalBookPrefix]
     * @returns {Promise<{journalId:string, journalNumber:string, alreadyPosted:boolean, allocationResults:Array<{invoiceKey:string, allocatedAmount:number, nextPaidAmount:number, remainingAfter:number}>}>}
     * @throws {import('../../services/accounting/errors/DuplicatePostingError.js').DuplicatePostingError}
     * @throws {import('../../services/accounting/errors/AllocationConflictError.js').AllocationConflictError}
     * @throws {import('../../services/accounting/errors/AtomicityError.js').AtomicityError}
     */
    async postVoucherAtomic(p) { return notImplemented('postVoucherAtomic'); }
}
