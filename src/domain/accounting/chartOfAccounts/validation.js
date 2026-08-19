// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  النطاق · شجرة الحسابات · قواعد التحقق                                       ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  نقيّ. القواعد مستخرَجة من saveCoaAccount (accounting.js:850) و               ║
// ║  deleteCoaAccount (accounting.js:913) — **بلا تغيير أي قاعدة**.               ║
// ║                                                                              ║
// ║  الفارق الوحيد عن القديم شكلي لا سلوكي: القديم يقرأ من DOM ويعرض toast،       ║
// ║  وهنا تُعاد النتيجة كبيانات ليقرّر المستدعي كيف يعرضها.                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { ACCOUNT_TYPES, expectedCodeStart } from './types.js';

export const ERRORS = Object.freeze({
    CODE_REQUIRED: 'CODE_REQUIRED',
    TYPE_REQUIRED: 'TYPE_REQUIRED',
    TYPE_UNKNOWN: 'TYPE_UNKNOWN',
    NAME_AR_REQUIRED: 'NAME_AR_REQUIRED',
    CODE_DUPLICATE: 'CODE_DUPLICATE'
});

export const WARNINGS = Object.freeze({
    CODE_PREFIX_MISMATCH: 'CODE_PREFIX_MISMATCH'
});

export const DELETE_BLOCKERS = Object.freeze({
    HAS_CHILDREN: 'HAS_CHILDREN',
    HAS_JOURNAL_ENTRIES: 'HAS_JOURNAL_ENTRIES'
});

const MSG = {
    CODE_REQUIRED: 'رمز الحساب مطلوب',
    TYPE_REQUIRED: 'اختر المجموعة الرئيسية',
    TYPE_UNKNOWN: 'المجموعة الرئيسية غير معروفة',
    NAME_AR_REQUIRED: 'اسم الحساب بالعربية مطلوب',
    CODE_DUPLICATE: 'رمز الحساب موجود مسبقاً',
    HAS_CHILDREN: 'لا يمكن حذف الحساب لوجود حسابات فرعية',
    HAS_JOURNAL_ENTRIES: 'لا يمكن حذف الحساب لوجود قيود مرتبطة به'
};
export const messageFor = code => MSG[code] || code;

/**
 * يتحقّق من حساب قبل الحفظ.
 *
 * ترتيب القواعد مطابق للقديم لأن القديم يتوقّف عند أول خطأ:
 *   1. الرمز مطلوب  2. النوع مطلوب  3. الاسم العربي مطلوب  4. الرمز غير مكرّر
 *   5. بادئة الرمز تطابق النوع ⇒ **تحذير لا خطأ** (القديم يسأل المستخدم ويسمح بالتجاوز)
 *
 * ⚠️ فحص التكرار هنا من القائمة المُمرَّرة فقط — تماماً كالقديم الذي يفحص الذاكرة
 * المحلية. الضمان الفعلي حجزٌ ذرّي على الخادم يتولّاه المستودع لا النطاق.
 *
 * @param {{code,type,nameAr}} account الحساب المُدخَل
 * @param {{existing?:Array, editingKey?:string}} ctx الحسابات القائمة ومفتاح المُعدَّل
 * @returns {{ok:boolean, errors:Array, warnings:Array}}
 */
export function validateAccount(account, ctx = {}) {
    const a = account || {};
    const errors = [];
    const warnings = [];
    const code = String(a.code || '').trim();
    const type = String(a.type || '').trim();
    const nameAr = String(a.nameAr || '').trim();

    if (!code) errors.push({ code: ERRORS.CODE_REQUIRED, field: 'code', message: MSG.CODE_REQUIRED });
    else if (!type) errors.push({ code: ERRORS.TYPE_REQUIRED, field: 'type', message: MSG.TYPE_REQUIRED });
    else if (!ACCOUNT_TYPES[type]) errors.push({ code: ERRORS.TYPE_UNKNOWN, field: 'type', message: MSG.TYPE_UNKNOWN });
    else if (!nameAr) errors.push({ code: ERRORS.NAME_AR_REQUIRED, field: 'nameAr', message: MSG.NAME_AR_REQUIRED });
    else {
        const existing = ctx.existing || [];
        const dup = existing.find(x => x && x.code === code && x.__key !== ctx.editingKey);
        if (dup) errors.push({ code: ERRORS.CODE_DUPLICATE, field: 'code', message: MSG.CODE_DUPLICATE });
        else {
            const start = expectedCodeStart(type);
            if (start && !code.startsWith(start)) {
                warnings.push({
                    code: WARNINGS.CODE_PREFIX_MISMATCH, field: 'code',
                    message: `الرمز «${code}» لا يبدأ بـ«${start}» المعتاد لـ${ACCOUNT_TYPES[type].ar}`,
                    requiresConfirmation: true
                });
            }
        }
    }
    return { ok: errors.length === 0, errors, warnings };
}

/**
 * هل يجوز حذف الحساب؟ — منقول عن deleteCoaAccount.
 * مانعان: وجود أبناء · وجود أي سطر قيد يشير إلى رمزه (بأي حالة، مسوّدة أو مُرحَّلة).
 *
 * @param {object} account
 * @param {{accounts?:Array, journalEntries?:Array}} ctx
 */
export function canDeleteAccount(account, ctx = {}) {
    const blockers = [];
    if (!account) return { ok: false, blockers };
    const accounts = ctx.accounts || [];
    const entries = ctx.journalEntries || [];

    if (accounts.some(a => a && a.parent === account.code)) {
        blockers.push({ code: DELETE_BLOCKERS.HAS_CHILDREN, message: MSG.HAS_CHILDREN });
    }
    if (entries.some(j => (j && j.lines ? j.lines : []).some(l => l && l.accountCode === account.code))) {
        blockers.push({ code: DELETE_BLOCKERS.HAS_JOURNAL_ENTRIES, message: MSG.HAS_JOURNAL_ENTRIES });
    }
    return { ok: blockers.length === 0, blockers };
}
