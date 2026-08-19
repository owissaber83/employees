// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  LEGACY BEHAVIOR TEST — buildVoucherJournal مقابل createJournalForVoucher [Phase 7] ║
// ║  التشغيل: npm run test:char:voucherjournal                                    ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §Step2: يُشغّل نفس البيانات عبر القديم ثم الجديد، يقارن النتائج المعيارية —     ║
// ║  يُعيد استخدام captureLegacy/canonicalJournal/compareJournals من Phase 4 حرفياً. ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureLegacy } from '../golden-master/capture.mjs';
import { canonicalJournal, compareJournals, round2 } from '../golden-master/canonical.mjs';
import * as F from '../fixtures/accounting/world.mjs';
import { buildVoucherJournal } from '../../src/domain/accounting/posting/buildVoucherJournal.js';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

function accountsWithout(...keys) { const c = { ...F.ACCOUNTS }; keys.forEach(k => delete c[k]); return c; }

function toDomainInputs(voucherKey, voucher, world) {
    const accounts = Object.values(world.chartOfAccounts || {}).filter(Boolean);
    const cashAccount = accounts.find(a => a.code === voucher.cashAccountCode) || null;
    const partyAccount = accounts.find(a => a.code === (voucher.type === 'receipt' ? '1130' : '2110')) || null;
    const party = voucher.type === 'receipt' ? (world.customers || {})[voucher.partyId] : (world.vendors || {})[voucher.partyId];
    return {
        voucherKey, voucher, party: party || null, cashAccount, partyAccount,
        journalNumber: world.jrnNumber || 'JV-TEST-0001',
        baseCurrencyCode: (world.cfg && world.cfg.baseCurrencyCode) || 'SAR',
        now: '2026-01-01T00:00:00.000Z',
        userId: (world.curU && world.curU.uid) || 'system'
    };
}

async function compareOne(name, voucherKey, voucher, world) {
    const legacy = await captureLegacy('createJournalForVoucher', [voucherKey, voucher], world);
    const legacyCanonical = canonicalJournal(legacy.journal, { keepVolatile: false });

    const domainInputs = toDomainInputs(voucherKey, voucher, world);
    let domainResult = null, domainError = null;
    try { domainResult = buildVoucherJournal(domainInputs); } catch (e) { domainError = e; }

    if (!legacy.journal) {
        ok(`${name}: القديم لم يُنشئ قيداً`, true);
        ok(`${name}: والجديد يرمي خطأً متوقَّعاً بدل قيد`, !!domainError, domainError ? domainError.message : 'لم يرمِ شيئاً!');
        return;
    }
    ok(`${name}: القديم أنشأ قيداً`, !!legacy.journal);
    ok(`${name}: الجديد بلا خطأ`, !domainError, domainError && domainError.message);
    if (!domainResult) return;

    const domainCanonical = canonicalJournal(domainResult.journal, { keepVolatile: false });
    legacyCanonical.createdAt = undefined; domainCanonical.createdAt = undefined;
    legacyCanonical.postedAt = undefined; domainCanonical.postedAt = undefined;

    const cmp = compareJournals(legacyCanonical, domainCanonical);
    ok(`${name}: القيدان متطابقان معيارياً`, cmp.equal, cmp.equal ? '' : JSON.stringify(cmp.diffs, null, 2));
}

console.log('\n🧮 buildVoucherJournal مقابل createJournalForVoucher — نفس بيانات Phase 4\n');

await compareOne('سند قبض قياسي', 'RV-K1', F.RECEIPT_VOUCHER, F.world());
await compareOne('سند صرف قياسي', 'PV-K1', F.PAYMENT_VOUCHER, F.world());

await compareOne('سند قبض بعملة أجنبية USD × 3.75', 'RV-K2',
    { ...F.RECEIPT_VOUCHER, currency: 'USD', exchangeRate: 3.75, amount: 1000 }, F.world());

for (const amt of [0.01, 100, 333.33, 999999.99]) {
    await compareOne(`سند صرف بمبلغ حدّي ${amt}`, 'PV-AMT', { ...F.PAYMENT_VOUCHER, amount: amt }, F.world());
}

await compareOne('حساب الصندوق مفقود — كلاهما يرفض', 'RV-K3', F.RECEIPT_VOUCHER, F.world({ chartOfAccounts: accountsWithout('a1120') }));
await compareOne('حساب العملاء مفقود — كلاهما يرفض', 'RV-K4', F.RECEIPT_VOUCHER, F.world({ chartOfAccounts: accountsWithout('a1130') }));
await compareOne('حساب الموردين مفقود — كلاهما يرفض', 'PV-K5', F.PAYMENT_VOUCHER, F.world({ chartOfAccounts: accountsWithout('a2110') }));

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
