// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عقد مستودع شجرة الحسابات                                                     ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الواجهة التي يعرفها النطاق وخدمات الأعمال. لا تذكر Firebase ولا RTDB ولا      ║
// ║  DataSnapshot — وهذا هو ما يجعل استبدال التخزين لاحقاً تغييراً في تنفيذٍ واحد    ║
// ║  لا في الواجهة كلّها.                                                          ║
// ║                                                                              ║
// ║  ⚠️ عقد المفاتيح: كل سجل يُعاد يحمل `__key` (مفتاح التخزين). هذا حقل           ║
// ║  **مشتقّ للقراءة فقط**، يُجرَّد قبل أي كتابة — فلا يدخل قاعدة البيانات ولا       ║
// ║  يغيّر المخطّط.                                                               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { RepositoryError, REPO_ERRORS } from './errors.js';

const notImplemented = name => {
    throw new RepositoryError(REPO_ERRORS.NOT_IMPLEMENTED, `${name} غير مُنفَّذة في هذا المستودع`);
};

export class ChartOfAccountsRepository {
    /** كل الحسابات كمصفوفة، لكل عنصر `__key`. @returns {Promise<Array>} */
    async list() { return notImplemented('list'); }

    /** حساب بمفتاحه، أو null. @returns {Promise<object|null>} */
    async getByKey(key) { return notImplemented('getByKey'); }

    /** حساب برمزه المحاسبي، أو null. @returns {Promise<object|null>} */
    async getByCode(code) { return notImplemented('getByCode'); }

    /**
     * ينشئ حساباً بحجز ذرّي لرمزه.
     * يرمي `CODE_TAKEN` إن كان الرمز محجوزاً — سلوك مطابق للقديم.
     * @returns {Promise<string>} مفتاح السجل الجديد
     */
    async create(account) { return notImplemented('create'); }

    /** يحدّث حقول حساب قائم. */
    async update(key, patch) { return notImplemented('update'); }

    /** يحذف حساباً. ⚠️ لا يحرّر حجز الرمز — سلوك قائم موثّق (BUG-002). */
    async remove(key) { return notImplemented('remove'); }

    /**
     * يشترك في التغييرات اللحظية.
     * @param {(accounts:Array)=>void} onChange
     * @returns {()=>void} دالة إلغاء الاشتراك
     */
    subscribe(onChange) { return notImplemented('subscribe'); }
}

/** الحقول المشتقّة التي لا تُكتب إلى التخزين أبداً. */
export const DERIVED_FIELDS = Object.freeze(['__key']);

/** يجرّد الحقول المشتقّة قبل الكتابة — يحمي المخطّط من التلوّث. */
export function stripDerived(record) {
    if (!record || typeof record !== 'object') return record;
    const out = {};
    Object.keys(record).forEach(k => { if (!DERIVED_FIELDS.includes(k)) out[k] = record[k]; });
    return out;
}
