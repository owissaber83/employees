// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حساب العملاء المستحَق لعميل بعينه — نقيّة، منقولة من القديم           [Phase 7] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ⚠️ مطابقة حرفية لـ`custReceivableAccount`/`arApMode` في accounting.js         ║
// ║  (13176، 13172) — مرآة `resolveVendorPayableAccount.js` (Phase 6)، بقصد لا     ║
// ║  إهمالاً: `custReceivableAccount`/`vendPayableAccount` دالتان منفصلتان فعلياً   ║
// ║  في القديم (لا واحدة مشتركة) — مطابقة كل منهما 1:1 بملف مستقلّ أوضح للتتبّع من   ║
// ║  تجريد مشترك مبكر. **مُثبتة بالمقارنة الفعلية**، لا مُعاد كتابتها من الفهم.       ║
// ║  انظر: tests/characterization/resolveCustomerReceivableAccount.test.mjs        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { arApModeFrom } from './resolveVendorPayableAccount.js'; // نفس arApMode() — مصدر واحد لا نسخة موازية

/**
 * رمز حساب العملاء المستحَق لعميل. مطابقة حرفية لـ`custReceivableAccount(customerId)`:
 * وضع «مجموعات» + للعميل `groupAccount` صالح موجود فعلاً في الشجرة ⇒ يُستخدم؛
 * وإلا الحساب الموحّد الثابت `'1130'`.
 * @param {{customerId, customers, chartOfAccounts, cfg}} p
 * @returns {string}
 */
export function resolveCustomerReceivableAccountCode({ customerId, customers, chartOfAccounts, cfg }) {
    if (arApModeFrom(cfg) === 'groups') {
        const c = (customers || {})[customerId];
        if (c && c.groupAccount &&
            Object.values(chartOfAccounts || {}).some(a => a.code === c.groupAccount)) {
            return c.groupAccount;
        }
    }
    return '1130';
}
