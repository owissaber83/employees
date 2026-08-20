// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حلّ حسابات تكلفة المشروع الشهرية (PMC) — نقيّة                     [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  منقولة حرفياً من `PMC_CATEGORIES` (accounting.js:7576) و`getPMCCategoryInfo`   ║
// ║  (:7591). لا `window` — الأنواع المخصّصة تُمرَّر كوسيط.                          ║
// ║                                                                              ║
// ║  🔴 **ثغرة مرصودة في القديم (BUG-015):** `getPMCCategoryInfo` تُرجع للأنواع      ║
// ║  المخصّصة (`custom_*`) وللنوع غير المعروف كائناً بـ`{ar, color, bg}` فقط —       ║
// ║  **بلا `defaultDebitAccountCode`/`defaultCreditAccountCode`**. النتيجة أن        ║
// ║  `createJournalForPMC` تجد `undefined` فترفض وتعيد `null`، والمستدعي            ║
// ║  (`savePMC`) يتخطّى الربط بصمت ⇒ **تكلفة مُسجَّلة بلا قيد محاسبي**.               ║
// ║  السلوك محفوظ هنا حرفياً؛ الخدمة الجديدة ترفض صراحةً بدل التخطّي الصامت.         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/** منقولة حرفياً — 12 نوعاً قياسياً بخريطة حساباتها. */
export const PMC_CATEGORIES = Object.freeze({
    materials: { ar: '🏗️ المواد', defaultDebitAccountCode: '5110', defaultCreditAccountCode: '2110' },
    labor: { ar: '👷 العمالة والأجور', defaultDebitAccountCode: '5210', defaultCreditAccountCode: '2130' },
    equipment: { ar: '🚜 المعدات والآليات', defaultDebitAccountCode: '5130', defaultCreditAccountCode: '2110' },
    subcontractors: { ar: '🤝 مقاولين من الباطن', defaultDebitAccountCode: '5140', defaultCreditAccountCode: '2110' },
    transport: { ar: '🚚 النقل والشحن', defaultDebitAccountCode: '5220', defaultCreditAccountCode: '2110' },
    utilities: { ar: '⚡ الكهرباء والمياه', defaultDebitAccountCode: '5330', defaultCreditAccountCode: '2110' },
    rent: { ar: '🏢 إيجارات', defaultDebitAccountCode: '5320', defaultCreditAccountCode: '2110' },
    leasehold: { ar: '🏗️ تحسينات مستأجرة', defaultDebitAccountCode: '1240', defaultCreditAccountCode: '2110' },
    permits: { ar: '📋 رسوم وتراخيص', defaultDebitAccountCode: '5390', defaultCreditAccountCode: '2110' },
    depreciation: { ar: '📉 إهلاك', defaultDebitAccountCode: '5370', defaultCreditAccountCode: '1290' },
    indirect: { ar: '📊 تكاليف غير مباشرة', defaultDebitAccountCode: '5390', defaultCreditAccountCode: '2110' },
    other: { ar: '📦 أخرى', defaultDebitAccountCode: '5390', defaultCreditAccountCode: '2110' }
});

/**
 * منقولة حرفياً من `getPMCCategoryInfo` — بحقن `customCategories` بدل `window`.
 * ⚠️ تُعيد كائناً **بلا رموز حسابات** للأنواع المخصّصة وغير المعروفة (BUG-015).
 * @param {string} cat
 * @param {object} [customCategories] مقابل `window.pmcCustomCategories`
 */
export function getPMCCategoryInfo(cat, customCategories = {}) {
    if (PMC_CATEGORIES[cat]) return PMC_CATEGORIES[cat];
    const rawKey = cat && cat.replace(/^custom_/, '');
    if (rawKey && customCategories[rawKey]) {
        const c = customCategories[rawKey];
        return { ar: (c.icon || '📌') + ' ' + c.name };
    }
    return { ar: cat || '—' };
}

/** هل يحمل النوع خريطة حسابات صالحة أصلاً؟ (يكشف ثغرة BUG-015 صراحةً) */
export function pmcCategoryHasAccounts(cat, customCategories = {}) {
    const info = getPMCCategoryInfo(cat, customCategories);
    return Boolean(info.defaultDebitAccountCode && info.defaultCreditAccountCode);
}
