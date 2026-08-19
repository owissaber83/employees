// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  LEGACY BEHAVIOR TEST — resolveVendorPayableAccountCode مقابل vendPayableAccount ║
// ║  التشغيل: npm run test:char:vendaccount                              [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يُثبت أن src/domain/.../resolveVendorPayableAccount.js تُنتج **نفس** نتيجة      ║
// ║  الدالة الحقيقية في accounting.js، على كل الحالات — قبل استخدامها في أي خدمة.   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { loadLegacyFunction, extractFunction } from './legacy-loader.mjs';
import { resolveVendorPayableAccountCode } from '../../src/domain/accounting/posting/resolveVendorPayableAccount.js';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };

/** يُشغّل vendPayableAccount الحقيقية بحالة مُحقَنة — arApMode تُحمَّل معها لأنها تستدعيها. */
function legacyVendPayableAccount({ vendorId, vendors, chartOfAccounts, cfg }) {
    const arApModeBody = extractFunction('arApMode');
    const win = { vendors: vendors || {}, chartOfAccounts: chartOfAccounts || {}, gbrCfg: {} };
    const globals = { window: win, cfg: cfg || {} };
    const keys = Object.keys(globals);
    // vendPayableAccount تستدعي arApMode في نفس النطاق — نجمعهما كما فعل capture.mjs دائماً
    const body = extractFunction('vendPayableAccount');
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `${arApModeBody}\n${body}\nreturn vendPayableAccount;`)(...keys.map(k => globals[k]));
    return fn(vendorId);
}

const CASES = [
    { name: 'aggregate mode (افتراضي) — دائماً 2110', input: { vendorId: 'V1', vendors: { V1: { groupAccount: '2199' } }, chartOfAccounts: { a: { code: '2199' } }, cfg: { arApMode: 'aggregate' } } },
    { name: 'groups mode — مورد بلا groupAccount ⇒ 2110', input: { vendorId: 'V1', vendors: { V1: {} }, chartOfAccounts: {}, cfg: { arApMode: 'groups' } } },
    { name: 'groups mode — groupAccount محدَّد لكن غير موجود في الشجرة ⇒ 2110', input: { vendorId: 'V1', vendors: { V1: { groupAccount: '2199' } }, chartOfAccounts: {}, cfg: { arApMode: 'groups' } } },
    { name: 'groups mode — groupAccount محدَّد وموجود فعلاً ⇒ يُستخدم', input: { vendorId: 'V1', vendors: { V1: { groupAccount: '2199' } }, chartOfAccounts: { a: { code: '2199' } }, cfg: { arApMode: 'groups' } } },
    { name: 'مورد غير موجود إطلاقاً ⇒ 2110', input: { vendorId: 'GHOST', vendors: {}, chartOfAccounts: {}, cfg: { arApMode: 'groups' } } },
    { name: 'بلا cfg إطلاقاً (undefined) ⇒ aggregate ⇒ 2110', input: { vendorId: 'V1', vendors: { V1: { groupAccount: '2199' } }, chartOfAccounts: { a: { code: '2199' } }, cfg: undefined } }
];

console.log('\n🧮 resolveVendorPayableAccountCode مقابل vendPayableAccount الحقيقية\n');
for (const c of CASES) {
    const legacy = legacyVendPayableAccount(c.input);
    const domain = resolveVendorPayableAccountCode(c.input);
    eq(c.name, domain, legacy);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
