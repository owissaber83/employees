// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  النطاق · شجرة الحسابات · الأنواع والطبائع                                   ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  نقيّ: بلا DOM · بلا window · بلا Firebase · بلا React.                        ║
// ║  مستخرَج حرفياً من public/accounting.js:259 (COA_TYPES) دون تغيير أي قيمة.     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/** المجموعات الرئيسية الخمس وبادئة رمز كل منها. */
export const ACCOUNT_TYPES = Object.freeze({
    asset: { ar: '🏦 الأصول', en: 'Assets', color: '#2d6a9f', bg: '#e8f4fd', codeStart: '1' },
    liability: { ar: '📤 الخصوم', en: 'Liabilities', color: '#c0392b', bg: '#fadbd8', codeStart: '2' },
    equity: { ar: '💎 حقوق الملكية', en: 'Equity', color: '#8e44ad', bg: '#f4ecf7', codeStart: '3' },
    revenue: { ar: '💰 الإيرادات', en: 'Revenue', color: '#27ae60', bg: '#e8f8f5', codeStart: '4' },
    expense: { ar: '💸 المصروفات', en: 'Expenses', color: '#e67e22', bg: '#fef5e7', codeStart: '5' }
});

export const ACCOUNT_TYPE_KEYS = Object.freeze(Object.keys(ACCOUNT_TYPES));

/**
 * طبيعة الحساب.
 * `header` ليست طبيعة محاسبية بل حساب تجميعي لا يقبل حركة، ومجاميعه من أبنائه.
 */
export const ACCOUNT_NATURES = Object.freeze(['debit', 'credit', 'header']);

export const isHeader = account => !!account && account.nature === 'header';
export const isPostable = account => !!account && account.nature !== 'header';

/** بادئة الرمز المتوقّعة لنوع — تُستخدم في تحذير لا في منع (انظر validation). */
export function expectedCodeStart(type) {
    const t = ACCOUNT_TYPES[type];
    return t ? t.codeStart : '';
}
