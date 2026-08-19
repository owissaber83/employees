// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · بناء القيود                                                  ║
// ║  التشغيل:  npm run test:gm                                                    ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 لا كتابة في أي قاعدة بيانات · بيانات مُصنَّعة فقط · لا تغيير سلوك.          ║
// ║  الشفرة القديمة **مصدر الحقيقة السلوكي** — لا مصدر الصحّة المحاسبية.           ║
// ║  ما يبدو خطأً يُسجَّل في ACCOUNTING_INTEGRITY_FIX_PLAN ولا يُصلَح هنا.           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { captureLegacy, countDbOps } from './capture.mjs';
import { canonicalJournal, lineTotals, moneyEq, round2, compareJournals, MONEY_TOLERANCE } from './canonical.mjs';
import * as F from '../fixtures/accounting/world.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAP = path.join(HERE, 'snapshots');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

let pass = 0, fail = 0;
const eq = (n, a, b) => {
    if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); }
    else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); }
};
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

/** لقطة: تُكتب أول مرة، ثم تُقارَن. اللقطة وحدها ليست الاختبار — التأكيدات تحتها. */
function snapshot(name, value) {
    const file = path.join(SNAP, name + '.json');
    const text = JSON.stringify(value, null, 2);
    if (!fs.existsSync(file) || UPDATE) {
        fs.writeFileSync(file, text + '\n');
        console.log(`  📸 لقطة ${UPDATE ? 'مُحدَّثة' : 'مُنشأة'}: ${name}`);
        return true;
    }
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved === text) { pass++; console.log(`  ✅ لقطة ثابتة: ${name}`); return true; }
    fail++;
    console.log(`  ❌ لقطة تغيّرت: ${name}\n       شغّل UPDATE_SNAPSHOTS=1 بعد التحقّق من أن التغيير مقصود`);
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧾 [1] فاتورة مشتريات — createJournalForPInv');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureLegacy('createJournalForPInv', ['PINV-K1', F.PURCHASE_INVOICE], F.world());
    eq('يُنفَّذ بلا خطأ', r.error, null);
    const c = canonicalJournal(r.journal);
    snapshot('journal-purchase-invoice', c);

    eq('ثلاثة سطور', c.lines.length, 3);
    ok('مدين حساب المصروف بالصافي قبل الضريبة', c.lines.some(l => l.accountCode === '5110' && moneyEq(l.debit, 10000)));
    ok('مدين ضريبة المدخلات', c.lines.some(l => l.accountCode === '1180' && moneyEq(l.debit, 1500)));
    ok('دائن الموردون بالإجمالي', c.lines.some(l => l.accountCode === '2110' && moneyEq(l.credit, 11500)));
    eq('مصدر القيد', c.sourceType, 'purchase_invoice');
    eq('حالته', c.status, 'posted');

    const t = lineTotals(r.journalLines);
    ok('مجموع المدين = مجموع الدائن', moneyEq(t.debit, t.credit), `${t.debit} ≠ ${t.credit}`);
    ok('والترويسة تطابق مجموع السطور', moneyEq(c.totalDebit, t.debit) && moneyEq(c.totalCredit, t.credit));

    const ops = countDbOps(r.captured);
    eq('عمليات الكتابة: قيد واحد + تحديث الفاتورة', ops.writes, 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧾 [2] فاتورة مبيعات — createJournalForSInv');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureLegacy('createJournalForSInv', ['SINV-K1', F.SALES_INVOICE], F.world());
    eq('يُنفَّذ بلا خطأ', r.error, null);
    const c = canonicalJournal(r.journal);
    snapshot('journal-sales-invoice', c);

    ok('مدين العملاء بالإجمالي', c.lines.some(l => l.accountCode === '1130' && moneyEq(l.debit, 23000)), JSON.stringify(c.lines));
    ok('دائن الإيراد 4100 بالصافي', c.lines.some(l => l.accountCode === '4100' && moneyEq(l.credit, 20000)));
    ok('دائن ضريبة المخرجات 2140', c.lines.some(l => l.accountCode === '2140' && moneyEq(l.credit, 3000)), JSON.stringify(c.lines));
    eq('مصدر القيد', c.sourceType, 'sales_invoice');

    const t = lineTotals(r.journalLines);
    ok('متوازن', moneyEq(t.debit, t.credit), `${t.debit} ≠ ${t.credit}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💸 [3] سند صرف وسند قبض — createJournalForVoucher');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const p = await captureLegacy('createJournalForVoucher', ['PV-K1', F.PAYMENT_VOUCHER], F.world());
    eq('سند الصرف بلا خطأ', p.error, null);
    const cp = canonicalJournal(p.journal);
    snapshot('journal-payment-voucher', cp);
    ok('مدين الموردون (تخفيض الالتزام)', cp.lines.some(l => l.accountCode === '2110' && moneyEq(l.debit, 11500)), JSON.stringify(cp.lines));
    ok('دائن النقد (خروج نقد)', cp.lines.some(l => moneyEq(l.credit, 11500)));
    ok('متوازن', moneyEq(lineTotals(p.journalLines).debit, lineTotals(p.journalLines).credit));

    const rc = await captureLegacy('createJournalForVoucher', ['RV-K1', F.RECEIPT_VOUCHER], F.world());
    eq('سند القبض بلا خطأ', rc.error, null);
    const cr = canonicalJournal(rc.journal);
    snapshot('journal-receipt-voucher', cr);
    ok('مدين النقد (دخول نقد)', cr.lines.some(l => moneyEq(l.debit, 23000)), JSON.stringify(cr.lines));
    ok('دائن العملاء (تخفيض الذمّة)', cr.lines.some(l => l.accountCode === '1130' && moneyEq(l.credit, 23000)));
    ok('متوازن', moneyEq(lineTotals(rc.journalLines).debit, lineTotals(rc.journalLines).credit));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [4] ثوابت محاسبية — مستقلة عن القديم');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // هذه ليست توصيفاً بل قواعد محاسبية يجب أن تصمد أياً كان التنفيذ
    const AMOUNTS = [0, 0.01, 0.1, 1, 100, 333.33, 999999.99];
    for (const amt of AMOUNTS) {
        const inv = { ...F.PURCHASE_INVOICE, netBeforeTax: amt, vatTotal: round2(amt * 0.15), grandTotal: round2(amt * 1.15) };
        const r = await captureLegacy('createJournalForPInv', ['K', inv], F.world());
        const t = lineTotals(r.journalLines);
        ok(`مبلغ ${amt}: المدين = الدائن`, moneyEq(t.debit, t.credit), `${t.debit} ≠ ${t.credit}`);
        ok(`مبلغ ${amt}: لا سطر بمدين ودائن معاً`,
            r.journalLines.every(l => !((Number(l.debit) || 0) > 0 && (Number(l.credit) || 0) > 0)));
        ok(`مبلغ ${amt}: لا مبالغ سالبة`,
            r.journalLines.every(l => (Number(l.debit) || 0) >= 0 && (Number(l.credit) || 0) >= 0));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [5] الترويسة مقابل السطور — كشف الثغرة لا إصلاحها');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // القاعدة في database.rules.json تقارن totalDebit بtotalCredit فقط.
    // هذا الاختبار يُثبت أن قيداً ترويسته متوازنة وسطوره ليست كذلك يجتاز الحراسة.
    const forged = {
        totalDebit: 1000, totalCredit: 1000,
        lines: [
            { accountCode: '5110', debit: 5000, credit: 0 },
            { accountCode: '2110', debit: 0, credit: 5000 }
        ]
    };
    const rulesGuard = e => e.totalDebit === e.totalCredit;      // ما تفحصه RTDB
    const linesGuard = e => {                                     // ما لا تستطيع فحصه
        const t = lineTotals(e.lines);
        return moneyEq(t.debit, e.totalDebit) && moneyEq(t.credit, e.totalCredit);
    };

    ok('🔴 حراسة القاعدة تقبل القيد المزوَّر', rulesGuard(forged) === true);
    ok('🔴 بينما مجموع السطور يخالف الترويسة (5000 مقابل 1000)', linesGuard(forged) === false);
    ok('   وهذا هو الفرق الذي لا تستطيع RTDB كشفه بنيوياً', true);
    console.log('       ⇒ مُسجَّل في ACCOUNTING_INTEGRITY_FIX_PLAN.md §1 و§2 — لا يُصلَح في Phase 4');

    // القيود التي يبنيها النظام فعلاً سليمة — الثغرة في الحراسة لا في البناء
    const real = await captureLegacy('createJournalForPInv', ['K', F.PURCHASE_INVOICE], F.world());
    ok('✅ القيود التي يبنيها النظام تجتاز الفحصين معاً',
        rulesGuard(real.journal) && linesGuard(real.journal));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧮 [6] الضريبة — 0% · 15% · معفاة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const cases = [
        ['15%', 10000, 1500, 11500, 3],
        ['0% (صفرية)', 10000, 0, 10000, 2],
        ['معفاة', 5000, 0, 5000, 2]
    ];
    for (const [label, net, vat, gross, expectedLines] of cases) {
        const inv = { ...F.PURCHASE_INVOICE, netBeforeTax: net, vatTotal: vat, grandTotal: gross };
        const r = await captureLegacy('createJournalForPInv', ['K', inv], F.world());
        const t = lineTotals(r.journalLines);
        eq(`${label}: عدد السطور`, r.journalLines.length, expectedLines);
        ok(`${label}: متوازن`, moneyEq(t.debit, t.credit));
        ok(`${label}: الدائن = الإجمالي`, moneyEq(t.credit, gross), `${t.credit} ≠ ${gross}`);
        if (vat === 0) ok(`${label}: لا سطر ضريبة`, !r.journalLines.some(l => l.accountCode === '1180'));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💱 [7] العملات — سلوك التحويل القائم');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const usd = { ...F.PURCHASE_INVOICE, currency: 'USD', exchangeRate: 3.75, netBeforeTax: 1000, vatTotal: 150, grandTotal: 1150 };
    const r = await captureLegacy('createJournalForPInv', ['K', usd], F.world());
    eq('بلا خطأ', r.error, null);
    const c = canonicalJournal(r.journal);
    snapshot('journal-purchase-invoice-usd', c);
    const t = lineTotals(r.journalLines);
    ok('القيد يُرحَّل بالعملة الدفترية (1150 × 3.75 = 4312.50)', moneyEq(t.credit, 4312.5), `الدائن=${t.credit}`);
    ok('ومتوازن بعد التحويل', moneyEq(t.debit, t.credit), `${t.debit} ≠ ${t.credit}`);
    eq('العملة الأصلية محفوظة', c.currency, 'USD');
    eq('وسعر الصرف محفوظ', c.exchangeRate, 3.75);
    ok('والمبلغ الأجنبي محفوظ', moneyEq(c.foreignTotal, 1150), String(c.foreignTotal));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧷 [8] حساب مفقود — سلوك الفشل القائم');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.world();
    delete w.chartOfAccounts.a5110;                       // حساب المصروف غير موجود
    const r = await captureLegacy('createJournalForPInv', ['K', F.PURCHASE_INVOICE], w);
    eq('لا يُنشأ قيد', r.journal, null);
    ok('ويُعرض تحذير للمستخدم', r.toasts.length > 0, JSON.stringify(r.toasts));
    ok('والرسالة تسمّي الحساب الناقص', /5110|2110/.test(r.toasts.map(t => t.message).join(' ')));
    console.log('       ⚠️ ملاحظة: postPInv يفحص عودة الدالة ويترك الفاتورة مسوّدة — مُوثَّق');
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
