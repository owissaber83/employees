// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · فاتورة المبيعات — القديم مقابل الجديد              [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  كل حالة تُشغَّل مرّتين: مرّة بالدالة القديمة الحقيقية من public/accounting.js،     ║
// ║  ومرّة بوحدة الدومين الجديدة — ثم يُقارَن الناتجان معياريّاً.                     ║
// ║  🔒 لا كتابة في أي قاعدة بيانات.                                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureSales, canonicalMovement } from './capture-sales-invoice.mjs';
import { compareJournals, canonicalJournal, lineTotals, moneyEq, round2 } from './canonical.mjs';
import { buildSalesInvoiceJournal } from '../../src/domain/accounting/posting/buildSalesInvoiceJournal.js';
import { planSalesInvoiceMovements } from '../../src/domain/inventory/planSalesInvoiceMovements.js';
import { assertBalanced } from '../../src/domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../src/domain/accounting/posting/validateJournal.js';
import {
    ACCOUNTS, accountsWithout, CUSTOMERS, ITEMS, MOVEMENTS,
    salesInvoice, salesState, resolveAccounts
} from '../fixtures/accounting/sales-invoice-world.mjs';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const eq = (n, a, b) => ok(n, JSON.stringify(a) === JSON.stringify(b), `متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`);

const NOW = '2026-03-12T10:00:00.000Z';
const USER = 'u-test';

/** يُشغّل القديم والجديد على نفس المدخلات ويقارن القيدين. */
async function compare(name, { invoice, chart = ACCOUNTS, customers = CUSTOMERS, receivableCode = '1130', revenueCode = '4100', cfg }) {
    const state = salesState({ chartOfAccounts: JSON.parse(JSON.stringify(chart)), customers, ...(cfg ? { cfg } : {}) });
    const legacy = await captureSales('createJournalForSInv', ['SINV-K1', invoice], state);

    const accounts = resolveAccounts(chart, { receivableCode, revenueCode });
    let next = null, err = null;
    try {
        next = buildSalesInvoiceJournal({
            invoiceKey: 'SINV-K1', invoice,
            customer: customers[invoice.customerId] || null,
            ...accounts,
            journalNumber: 'JV-TEST-0001',
            baseCurrencyCode: (cfg && cfg.baseCurrencyCode) || 'SAR',
            now: NOW, userId: USER
        }).journal;
    } catch (e) { err = e; }

    return { legacy: legacy.journal, next, err, legacyCapture: legacy };
}

async function assertSame(name, opts) {
    const { legacy, next, err } = await compare(name, opts);
    if (err) return ok(name, false, `الجديد رمى: ${err.name}: ${err.message}`);
    if (!legacy) return ok(name, false, 'القديم لم يُنتج قيداً');
    const cmp = compareJournals(legacy, next);
    ok(name, cmp.equal, cmp.diffs.map(d => `${d.field}: قديم=${JSON.stringify(d.legacy)} جديد=${JSON.stringify(d.next)}`).join('\n       '));
    if (cmp.equal) { validateJournal(next); assertBalanced(next); }
    return { legacy, next };
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  Golden Master — فاتورة المبيعات · Phase 7 Step C         ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// ── [1] القيد: مصفوفة الحالات ─────────────────────────────────────────────────
console.log('\n[1] القيد المحاسبي — القديم مقابل الجديد');

await assertSame('1 · فاتورة خاضعة عادية (15%)', { invoice: salesInvoice() });
await assertSame('2 · ضريبة صفر', { invoice: salesInvoice({ netBeforeTax: 20000, vatTotal: 0, grandTotal: 20000 }) });
await assertSame('3 · حدّ الضريبة — كسور تُقرَّب', { invoice: salesInvoice({ netBeforeTax: 33.33, vatTotal: 5, grandTotal: 38.33 }) });
await assertSame('4 · عملة أجنبية USD × 3.75', { invoice: salesInvoice({ currency: 'USD', exchangeRate: 3.75, netBeforeTax: 1000, vatTotal: 150, grandTotal: 1150 }) });
await assertSame('5 · احتجاز ضمان 10%', { invoice: salesInvoice({ retentionAmount: 2300 }) });
await assertSame('6 · استرداد دفعة مقدمة', { invoice: salesInvoice({ advanceRecoveryAmount: 5000 }) });
await assertSame('7 · احتجاز + دفعة مقدمة معاً', { invoice: salesInvoice({ retentionAmount: 2300, advanceRecoveryAmount: 5000 }) });
await assertSame('8 · احتجاز تحت العتبة (0.004) — يُهمَل', { invoice: salesInvoice({ retentionAmount: 0.004 }) });
await assertSame('9 · حساب إيرادات مخصّص (4110)', { invoice: salesInvoice({ salesAccountCode: '4110' }), revenueCode: '4110' });
await assertSame('10 · عميل بمجموعة حسابات (arApMode=groups)', {
    invoice: salesInvoice({ customerId: 'CG' }), receivableCode: '1130-A',
    cfg: { baseCurrencyCode: 'SAR', arApMode: 'groups' }
});
await assertSame('11 · عميل مفقود — يُرحَّل باسم فارغ', { invoice: salesInvoice({ customerId: 'GHOST' }) });
await assertSame('12 · فرق تقريب يُسوَّى على سطر الإيراد', { invoice: salesInvoice({ netBeforeTax: 100.004, vatTotal: 15, grandTotal: 115.01 }) });
await assertSame('13 · بلا مركز تكلفة (لا مشروع)', { invoice: salesInvoice({ projectId: '' }) });
await assertSame('14 · مبالغ نصّية (مدخلات النموذج)', { invoice: salesInvoice({ netBeforeTax: '20000', vatTotal: '3000', grandTotal: '23000' }) });
await assertSame('15 · عملة أجنبية + احتجاز + مقدّم', {
    invoice: salesInvoice({ currency: 'USD', exchangeRate: 3.75, netBeforeTax: 1000, vatTotal: 150, grandTotal: 1150, retentionAmount: 115, advanceRecoveryAmount: 200 })
});

// ── [2] فروق مقصودة — القديم يُنشئ حساباً، الجديد يرفض ──────────────────────────
console.log('\n[2] الفروق المقصودة (C) — الحساب المفقود');

{
    const chart = accountsWithout('2140');
    const state = salesState({ chartOfAccounts: JSON.parse(JSON.stringify(chart)) });
    const legacy = await captureSales('createJournalForSInv', ['SINV-K1', salesInvoice()], state);
    ok('16 · القديم يُنشئ 2140 تلقائياً (ensureStdAccount)', legacy.captured.coaCreated.some(c => c.data.code === '2140'),
        `أُنشئ: ${JSON.stringify(legacy.captured.coaCreated.map(c => c.data.code))}`);
    ok('16b · وقيد القديم يحمل سطر 2140 رغم غيابه من الشجرة', (legacy.journal.lines || []).some(l => l.accountCode === '2140'));
}
{
    // الدومين الجديد على مسار «آخر ملاذ» (غير قابل للوصول عبر الخدمة — يُختبَر مباشرةً)
    const accounts = resolveAccounts(accountsWithout('2140'));
    const { journal, warnings } = buildSalesInvoiceJournal({
        invoiceKey: 'K', invoice: salesInvoice(), customer: CUSTOMERS.C1, ...accounts,
        journalNumber: 'JV-1', baseCurrencyCode: 'SAR', now: NOW, userId: USER
    });
    eq('17 · الدومين يطابق «آخر ملاذ» القديم: الضريبة تُضمّ للإيراد', journal.lines.find(l => l.accountCode === '4100').credit, 23000);
    ok('17b · مع تحذير صريح لا صامت', warnings.some(w => w.includes('2140')));
    assertBalanced(journal);
    ok('17c · ويبقى القيد متوازناً', true);
}
{
    const accounts = resolveAccounts(accountsWithout('1131'));
    const { journal, warnings } = buildSalesInvoiceJournal({
        invoiceKey: 'K', invoice: salesInvoice({ retentionAmount: 2300 }), customer: CUSTOMERS.C1, ...accounts,
        journalNumber: 'JV-1', baseCurrencyCode: 'SAR', now: NOW, userId: USER
    });
    ok('18 · غياب 1131: الدومين يُصفّر الاحتجاز كالقديم + تحذير', !journal.lines.some(l => l.accountCode === '1131') && warnings.some(w => w.includes('1131')));
    eq('18b · وذمّة العميل تعود للإجمالي الكامل', journal.lines.find(l => l.accountCode === '1130').debit, 23000);
}

// ── [3] حركات المخزون ─────────────────────────────────────────────────────────
console.log('\n[3] حركات المخزون — القديم مقابل الجديد');

async function compareMovements(name, invoice, stateOverrides = {}) {
    const state = salesState(stateOverrides);
    const legacy = await captureSales('createInventoryMovementsForSInv', ['SINV-K1', invoice], state);
    const plan = planSalesInvoiceMovements({
        invoiceKey: 'SINV-K1', invoice,
        items: state.inventoryItems, movements: state.inventoryMovements, warehouses: state.warehouses,
        now: NOW, userId: USER
    });
    const a = legacy.movements.map(canonicalMovement);
    const b = plan.movements.map(canonicalMovement);
    eq(name, b, a);
    return { legacy, plan };
}

await compareMovements('19 · صنف واحد مادي', salesInvoice());
await compareMovements('20 · أصناف متعدّدة + خدمة تُتخطّى', salesInvoice({
    lines: [
        { itemId: 'IT1', qty: 5, unitPrice: 4000, description: 'حديد' },
        { itemId: 'IT2', qty: 10, unitPrice: 30 },
        { itemId: 'SV1', qty: 1, unitPrice: 500, description: 'إشراف' }
    ]
}));
await compareMovements('21 · سطر بلا itemId يُتخطّى', salesInvoice({
    lines: [{ qty: 3, unitPrice: 100, description: 'بند حرّ' }, { itemId: 'IT1', qty: 1, unitPrice: 4000 }]
}));
await compareMovements('22 · صنف غير موجود يُتخطّى', salesInvoice({ lines: [{ itemId: 'GHOST', qty: 2, unitPrice: 10 }] }));
await compareMovements('23 · كمّية صفر — تُكتب حركة بصفر (سلوك محفوظ)', salesInvoice({ lines: [{ itemId: 'IT1', qty: 0, unitPrice: 4000 }] }));
await compareMovements('24 · رصيد غير كافٍ — تحذير فقط، الحركة تُكتب', salesInvoice({ lines: [{ itemId: 'IT1', qty: 999, unitPrice: 4000 }] }));
await compareMovements('25 · صنف بلا حركات ولا تكلفة — يرجع لسعر السطر', salesInvoice({ lines: [{ itemId: 'IT3', qty: 2, unitPrice: 77 }] }));
await compareMovements('26 · بلا سطور إطلاقاً', salesInvoice({ lines: [] }));

{
    const state = salesState();
    const inv = salesInvoice({ lines: [{ itemId: 'IT1', qty: 999, unitPrice: 4000 }] });
    const legacy = await captureSales('createInventoryMovementsForSInv', ['SINV-K1', inv], state);
    const plan = planSalesInvoiceMovements({ invoiceKey: 'SINV-K1', invoice: inv, items: ITEMS, movements: MOVEMENTS, warehouses: {}, now: NOW, userId: USER });
    ok('27 · تحذير النقص موجود في الطرفين', legacy.toasts.some(t => t.type === 'wn') && plan.warnings.length === 1);
    ok('27b · ولا يمنع الحركة في أيٍّ منهما', legacy.movements.length === 1 && plan.movements.length === 1);
}
{
    const state = salesState();
    const legacy = await captureSales('createInventoryMovementsForSInv', ['SINV-K1', salesInvoice()], state);
    ok('28 · القديم لا يكتب warehouseId إطلاقاً', !('warehouseId' in legacy.movements[0]));
}

// ── [4] الثوابت المحاسبية على كل قيد ناتج ─────────────────────────────────────
console.log('\n[4] الثوابت المحاسبية');
{
    const cases = [
        salesInvoice(), salesInvoice({ vatTotal: 0, grandTotal: 20000 }),
        salesInvoice({ retentionAmount: 2300 }), salesInvoice({ advanceRecoveryAmount: 5000 }),
        salesInvoice({ retentionAmount: 2300, advanceRecoveryAmount: 5000 }),
        salesInvoice({ currency: 'USD', exchangeRate: 3.75, netBeforeTax: 1000, vatTotal: 150, grandTotal: 1150 })
    ];
    let allBalanced = true, noMixed = true, headerMatches = true;
    for (const inv of cases) {
        const { journal } = buildSalesInvoiceJournal({
            invoiceKey: 'K', invoice: inv, customer: CUSTOMERS.C1, ...resolveAccounts(ACCOUNTS),
            journalNumber: 'JV-1', baseCurrencyCode: 'SAR', now: NOW, userId: USER
        });
        const t = lineTotals(journal.lines);
        if (!moneyEq(t.debit, t.credit)) allBalanced = false;
        if (journal.lines.some(l => l.debit > 0 && l.credit > 0)) noMixed = false;
        if (!moneyEq(t.debit, journal.totalDebit)) headerMatches = false;
    }
    ok('29 · كل القيود متوازنة (Σمدين = Σدائن)', allBalanced);
    ok('30 · لا سطر بمدين ودائن معاً', noMixed);
    ok('31 · الترويسة تطابق مجموع السطور', headerMatches);
}
{
    // ترتيب العرض: كل المدين ثم كل الدائن — ثابت محاسبي مرصود في القديم
    const { journal } = buildSalesInvoiceJournal({
        invoiceKey: 'K', invoice: salesInvoice({ retentionAmount: 2300, advanceRecoveryAmount: 5000 }),
        customer: CUSTOMERS.C1, ...resolveAccounts(ACCOUNTS), journalNumber: 'JV-1',
        baseCurrencyCode: 'SAR', now: NOW, userId: USER
    });
    const firstCredit = journal.lines.findIndex(l => l.credit > 0);
    const lastDebit = journal.lines.map(l => l.debit > 0).lastIndexOf(true);
    ok('32 · كل المدين قبل كل الدائن', lastDebit < firstCredit, JSON.stringify(journal.lines.map(l => `${l.accountCode}:${l.debit}/${l.credit}`)));
}
{
    // ⚠️ الثابت المالي الحاسم: استرداد الدفعة المقدمة **لا** يُنقص ذمّة العميل
    const { journal } = buildSalesInvoiceJournal({
        invoiceKey: 'K', invoice: salesInvoice({ advanceRecoveryAmount: 5000 }),
        customer: CUSTOMERS.C1, ...resolveAccounts(ACCOUNTS), journalNumber: 'JV-1',
        baseCurrencyCode: 'SAR', now: NOW, userId: USER
    });
    eq('33 · ذمّة العميل = الإجمالي كاملاً رغم المقدّم', journal.lines.find(l => l.accountCode === '1130').debit, 23000);
    eq('34 · إجمالي القيد = الإجمالي + المقدّم', journal.totalDebit, 28000);
}

// ── [5] الدقّة المالية ────────────────────────────────────────────────────────
console.log('\n[5] الدقّة المالية');
{
    const probes = [
        { net: 0.01, vat: 0, grand: 0.01 },
        { net: 0.1, vat: 0.015, grand: 0.12 },
        { net: 0.05, vat: 0.0075, grand: 0.06 },
        { net: 1000.005, vat: 150.0008, grand: 1150.01 },
        { net: 33.33, vat: 5, grand: 38.33 }
    ];
    let allOk = true;
    for (const p of probes) {
        const inv = salesInvoice({ netBeforeTax: p.net, vatTotal: p.vat, grandTotal: p.grand });
        const { journal } = buildSalesInvoiceJournal({
            invoiceKey: 'K', invoice: inv, customer: CUSTOMERS.C1, ...resolveAccounts(ACCOUNTS),
            journalNumber: 'JV-1', baseCurrencyCode: 'SAR', now: NOW, userId: USER
        });
        try { assertBalanced(journal); } catch (e) { allOk = false; console.log('       ✗', JSON.stringify(p), e.message); }
        if (journal.lines.some(l => round2(l.debit) !== l.debit || round2(l.credit) !== l.credit)) { allOk = false; console.log('       ✗ غير مقرَّب', JSON.stringify(p)); }
    }
    ok('35 · كل حدود التقريب متوازنة ومقرَّبة لمنزلتين', allOk);
}
{
    // مطابقة القديم على نفس حدود التقريب — لا نكتفي بالاتّساق الداخلي
    let same = true; const diffs = [];
    for (const p of [{ net: 0.01, vat: 0, grand: 0.01 }, { net: 33.33, vat: 5, grand: 38.33 }, { net: 1000.005, vat: 150.0008, grand: 1150.01 }]) {
        const inv = salesInvoice({ netBeforeTax: p.net, vatTotal: p.vat, grandTotal: p.grand });
        const r = await compare('precision', { invoice: inv });
        const cmp = compareJournals(r.legacy, r.next);
        if (!cmp.equal) { same = false; diffs.push(JSON.stringify({ p, d: cmp.diffs })); }
    }
    ok('36 · وتطابق القديم عند نفس الحدود', same, diffs.join('\n       '));
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
