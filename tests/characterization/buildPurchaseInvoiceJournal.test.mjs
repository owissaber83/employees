// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  LEGACY BEHAVIOR TEST — buildPurchaseInvoiceJournal مقابل createJournalForPInv  ║
// ║  التشغيل: npm run test:char:pinvjournal                              [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §11: «شغّل نفس البيانات عبر القديم، ثم عبر الجديد، قارن النتائج المعيارية».     ║
// ║  يُعيد استخدام captureLegacy/canonicalJournal/compareJournals من Phase 4 —      ║
// ║  حرفياً بلا نسخ منطق موازٍ.                                                    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureLegacy } from '../golden-master/capture.mjs';
import { canonicalJournal, compareJournals, round2 } from '../golden-master/canonical.mjs';
import * as F from '../fixtures/accounting/world.mjs';
import { buildPurchaseInvoiceJournal } from '../../src/domain/accounting/posting/buildPurchaseInvoiceJournal.js';

/** يحذف مفتاحاً فعلياً من نسخة شجرة الحسابات — لا يتركه `undefined` (يكسر .find في القديم والجديد معاً). */
function accountsWithout(...keys) {
    const c = { ...F.ACCOUNTS };
    keys.forEach(k => delete c[k]);
    return c;
}

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

/** يبني مدخلات الدالة النقيّة من نفس عالم Phase 4 — تماماً كما تحلّها createJournalForPInv داخلياً. */
function toDomainInputs(invoiceKey, invoice, world) {
    const accounts = Object.values(world.chartOfAccounts || {}).filter(Boolean);
    const expenseAccount = accounts.find(a => a.code === (invoice.debitAccountCode)) || null;
    // نفس منطق vendPayableAccount المُثبَت في resolveVendorPayableAccount.test.mjs — aggregate افتراضياً
    const vendorAccount = accounts.find(a => a.code === '2110') || null;
    const vatInputAccount = accounts.find(a => a.code === '1180') || null;
    return {
        invoiceKey, invoice,
        vendor: (world.vendors || {})[invoice.vendorId] || null,
        expenseAccount, vendorAccount, vatInputAccount,
        journalNumber: world.jrnNumber || 'JV-TEST-0001',
        baseCurrencyCode: (world.cfg && world.cfg.baseCurrencyCode) || 'SAR',
        now: '2026-01-01T00:00:00.000Z',
        userId: (world.curU && world.curU.uid) || 'system'
    };
}

async function compareOne(name, invoiceKey, invoice, world) {
    const legacy = await captureLegacy('createJournalForPInv', [invoiceKey, invoice], world);
    const legacyCanonical = canonicalJournal(legacy.journal, { keepVolatile: false });

    const domainInputs = toDomainInputs(invoiceKey, invoice, world);
    let domainResult = null, domainError = null;
    try { domainResult = buildPurchaseInvoiceJournal(domainInputs); } catch (e) { domainError = e; }

    if (!legacy.journal) {
        ok(`${name}: القديم لم يُنشئ قيداً`, true);
        ok(`${name}: والجديد يرمي خطأً متوقَّعاً بدل قيد`, !!domainError, domainError ? domainError.message : 'لم يرمِ شيئاً!');
        return;
    }
    ok(`${name}: القديم أنشأ قيداً`, !!legacy.journal);
    ok(`${name}: الجديد بلا خطأ`, !domainError, domainError && domainError.message);
    if (!domainResult) return;

    const domainCanonical = canonicalJournal(domainResult.journal, { keepVolatile: false });
    // نستبعد createdAt/postedAt (متقلّبة) بفرضها متطابقة يدوياً قبل المقارنة
    domainCanonical.createdAt = legacyCanonical.createdAt; domainCanonical.postedAt = legacyCanonical.postedAt;
    legacyCanonical.createdAt = undefined; domainCanonical.createdAt = undefined;
    legacyCanonical.postedAt = undefined; domainCanonical.postedAt = undefined;

    const cmp = compareJournals(legacyCanonical, domainCanonical);
    ok(`${name}: القيدان متطابقان معيارياً (lines + totals + كل الحقول)`, cmp.equal,
        cmp.equal ? '' : JSON.stringify(cmp.diffs, null, 2));
}

console.log('\n🧮 buildPurchaseInvoiceJournal مقابل createJournalForPInv — نفس بيانات Phase 4\n');

await compareOne('فاتورة قياسية (15% ضريبة)', 'PINV-K1', F.PURCHASE_INVOICE, F.world());

await compareOne('ضريبة 0% (صفرية) — سطران فقط', 'PINV-K2',
    { ...F.PURCHASE_INVOICE, netBeforeTax: 10000, vatTotal: 0, grandTotal: 10000 }, F.world());

await compareOne('عملة أجنبية USD × 3.75', 'PINV-K3',
    { ...F.PURCHASE_INVOICE, currency: 'USD', exchangeRate: 3.75, netBeforeTax: 1000, vatTotal: 150, grandTotal: 1150 },
    F.world());

await compareOne('حساب 1180 غير موجود — الضريبة تُطوى في المصروف', 'PINV-K4',
    F.PURCHASE_INVOICE, F.world({ chartOfAccounts: accountsWithout('a1180') }));

for (const amt of [0.01, 100, 333.33, 999999.99]) {
    await compareOne(`مبلغ حدّي ${amt}`, 'PINV-AMT',
        { ...F.PURCHASE_INVOICE, netBeforeTax: amt, vatTotal: round2(amt * 0.15), grandTotal: round2(amt * 1.15) },
        F.world());
}

await compareOne('حساب المصروف مفقود — كلاهما يرفض', 'PINV-K5',
    F.PURCHASE_INVOICE, F.world({ chartOfAccounts: accountsWithout('a5110') }));

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
