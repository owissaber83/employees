// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حراسات القيد اليدوي — نقيّة، من saveJrnEntry                       [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الحراسات المالية في `saveJrnEntry` (accounting.js:6477) مستخلَصة كما هي —      ║
// ║  **بلا** حراسات الواجهة (الصلاحيات · قفل الفترة · التنبيهات الذكية · التسوية     ║
// ║  البنكية)، وهي تبقى مسؤولية المهايئ عند الوصل. موثَّق في                        ║
// ║  docs/services/manual-journal-posting.md §«ما لم يُنقَل».                       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { ValidationError, MissingAccountError } from '../../../services/accounting/errors/ValidationError.js';

/** عتبة التوازن المرصودة في القديم — نفس السياسة القائمة، لا سياسة جديدة. */
export const JRN_BALANCE_TOLERANCE = 0.01;

/** سطور المستخدم الصالحة — مطابقة لمُرشِّح accounting.js:6482. */
export function selectUserLines(lines) {
    return (lines || []).filter(l =>
        l && !l._taxAuto && l.accountCode &&
        ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0));
}

/** «سطران على الأقل بمبالغ» — حارس القديم حرفياً. */
export function assertMinimumLines(userLines) {
    if (!userLines || userLines.length < 2) {
        throw new ValidationError('يجب أن يكون هناك سطران على الأقل بمبالغ',
            { count: (userLines && userLines.length) || 0 });
    }
    return true;
}

/** «البيان العام مطلوب» — حارس القديم حرفياً. */
export function assertDescription(description) {
    if (!String(description || '').trim()) {
        throw new ValidationError('البيان العام مطلوب');
    }
    return true;
}

/**
 * توازن بعملة الإدخال — يُطبَّق في القديم **فقط عند الترحيل** (`status === 'posted'`).
 * المسوّدة غير المتوازنة مسموحة، وهذا سلوك محفوظ عمداً.
 */
export function assertBalancedForPosting(lines, status) {
    if (status !== 'posted') return true;
    const d = (lines || []).reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const c = (lines || []).reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    if (Math.abs(d - c) > JRN_BALANCE_TOLERANCE) {
        throw new ValidationError('لا يمكن ترحيل قيد غير متوازن', { totalDebit: d, totalCredit: c });
    }
    return true;
}

/**
 * كل حساب موجود وليس رئيسياً — حارس القديم حرفياً (accounting.js:6517).
 * @param {Array<object>} lines
 * @param {object|Array} chartOfAccounts
 */
export function assertAccountsUsable(lines, chartOfAccounts) {
    const list = Array.isArray(chartOfAccounts) ? chartOfAccounts : Object.values(chartOfAccounts || {});
    for (const line of lines || []) {
        const acc = list.find(a => a && a.code === line.accountCode);
        if (!acc) {
            throw new MissingAccountError(`الحساب ${line.accountCode} غير موجود`, { accountCode: line.accountCode });
        }
        if (acc.nature === 'header') {
            throw new ValidationError(`الحساب ${line.accountCode} رئيسي ولا يقبل قيوداً`, { accountCode: line.accountCode });
        }
    }
    return true;
}

/** سعر صرف صالح للعملة الأجنبية — حارس القديم حرفياً. */
export function assertExchangeRate(currency, baseCurrency, rate) {
    if (currency !== baseCurrency && !(rate > 0)) {
        throw new ValidationError(`أدخل سعر صرف صحيح للعملة ${currency}`, { currency, rate });
    }
    return true;
}
