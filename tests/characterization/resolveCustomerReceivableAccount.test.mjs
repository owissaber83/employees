// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  LEGACY BEHAVIOR TEST — resolveCustomerReceivableAccountCode مقابل custReceivableAccount ║
// ║  التشغيل: npm run test:char:custaccount                              [Phase 7] ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { extractFunction } from './legacy-loader.mjs';
import { resolveCustomerReceivableAccountCode } from '../../src/domain/accounting/posting/resolveCustomerReceivableAccount.js';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };

function legacyCustReceivableAccount({ customerId, customers, chartOfAccounts, cfg }) {
    const arApModeBody = extractFunction('arApMode');
    const win = { customers: customers || {}, chartOfAccounts: chartOfAccounts || {}, gbrCfg: {} };
    const globals = { window: win, cfg: cfg || {} };
    const keys = Object.keys(globals);
    const body = extractFunction('custReceivableAccount');
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `${arApModeBody}\n${body}\nreturn custReceivableAccount;`)(...keys.map(k => globals[k]));
    return fn(customerId);
}

const CASES = [
    { name: 'aggregate mode (افتراضي) — دائماً 1130', input: { customerId: 'C1', customers: { C1: { groupAccount: '1199' } }, chartOfAccounts: { a: { code: '1199' } }, cfg: { arApMode: 'aggregate' } } },
    { name: 'groups mode — عميل بلا groupAccount ⇒ 1130', input: { customerId: 'C1', customers: { C1: {} }, chartOfAccounts: {}, cfg: { arApMode: 'groups' } } },
    { name: 'groups mode — groupAccount محدَّد لكن غير موجود ⇒ 1130', input: { customerId: 'C1', customers: { C1: { groupAccount: '1199' } }, chartOfAccounts: {}, cfg: { arApMode: 'groups' } } },
    { name: 'groups mode — groupAccount موجود فعلاً ⇒ يُستخدم', input: { customerId: 'C1', customers: { C1: { groupAccount: '1199' } }, chartOfAccounts: { a: { code: '1199' } }, cfg: { arApMode: 'groups' } } },
    { name: 'عميل غير موجود إطلاقاً ⇒ 1130', input: { customerId: 'GHOST', customers: {}, chartOfAccounts: {}, cfg: { arApMode: 'groups' } } },
    { name: 'بلا cfg إطلاقاً ⇒ aggregate ⇒ 1130', input: { customerId: 'C1', customers: { C1: { groupAccount: '1199' } }, chartOfAccounts: { a: { code: '1199' } }, cfg: undefined } }
];

console.log('\n🧮 resolveCustomerReceivableAccountCode مقابل custReceivableAccount الحقيقية\n');
for (const c of CASES) eq(c.name, resolveCustomerReceivableAccountCode(c.input), legacyCustReceivableAccount(c.input));

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
