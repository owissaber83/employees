// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حساب الموردين المستحَق لمورد بعينه — نقيّة، منقولة من القديم          [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ⚠️ مطابقة حرفية لـ`vendPayableAccount`/`arApMode` في accounting.js (13172،     ║
// ║  13183) — **مُثبتة بالمقارنة الفعلية**، لا مُعاد كتابتها من الفهم. انظر:         ║
// ║  tests/characterization/resolveVendorPayableAccount.test.mjs                   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/** مطابقة حرفية لـ`arApMode()` — تقرأ `cfg.arApMode` بدل `window`/`cfg` الضمنيين. */
export function arApModeFrom(cfg) {
    return (cfg && cfg.arApMode) || 'aggregate';
}

/**
 * رمز حساب الموردين المستحَق لمورد. مطابقة حرفية لـ`vendPayableAccount(vendorId)`:
 * وضع «مجموعات» + المورد له `groupAccount` صالح موجود فعلاً في الشجرة ⇒ يُستخدم؛
 * وإلا الحساب الموحّد الثابت `'2110'`.
 * @param {{vendorId, vendors, chartOfAccounts, cfg}} p
 * @returns {string}
 */
export function resolveVendorPayableAccountCode({ vendorId, vendors, chartOfAccounts, cfg }) {
    if (arApModeFrom(cfg) === 'groups') {
        const v = (vendors || {})[vendorId];
        if (v && v.groupAccount &&
            Object.values(chartOfAccounts || {}).some(a => a.code === v.groupAccount)) {
            return v.groupAccount;
        }
    }
    return '2110';
}
