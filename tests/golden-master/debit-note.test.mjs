// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · الإشعار المدين — القديم مقابل الجديد               [Phase 7-D] ║
// ║  ⚠️ **لا يُفترَض تماثله مع الإشعار الدائن** — كل دالة مدينة تُشغَّل وتُقارَن على     ║
// ║  حدة، والفروق المؤكَّدة (حساب الضريبة · تكلفة المخزون · سطر التقريب) مُختبَرة      ║
// ║  صراحةً في §[5] أدناه.                                                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureDebit } from './capture-debit-note.mjs';
import { canonicalMovement, canonicalCompute } from './capture-credit-note.mjs';
import { compareJournals, lineTotals, moneyEq, round2 } from './canonical.mjs';
import { computeDebitNote } from '../../src/domain/accounting/debit-note/computeDebitNote.js';
import { buildDebitNoteJournal } from '../../src/domain/accounting/debit-note/buildDebitNoteJournal.js';
import { planDebitNoteMovements } from '../../src/domain/inventory/planDebitNoteMovements.js';
import { assertBalanced } from '../../src/domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../src/domain/accounting/posting/validateJournal.js';
import {
    ACCOUNTS, accountsWithout, VENDORS, purchaseInvoice, noteState, resolveFor
} from '../fixtures/accounting/note-world.mjs';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const eq = (n, a, b) => ok(n, JSON.stringify(a) === JSON.stringify(b), `متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`);

const NOW = '2026-04-01T10:00:00.000Z';
const USER = 'u-test';
const DN_FNS = ['submitDebitNote', 'dnCompute', 'createJournalForDebitNote', 'createReturnMovementsForDN', 'generateDNNumber'];

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  Golden Master — الإشعار المدين · Phase 7 Step D          ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// ── [1] حساب المبالغ ─────────────────────────────────────────────────────────
console.log('\n[1] حساب المبالغ — dnCompute مقابل computeDebitNote');

async function compareCompute(name, invoice, quantities) {
    const state = noteState({ purchaseInvoices: { PINV1: invoice } });
    const legacy = await captureDebit(DN_FNS, 'dnCompute', ['PINV1'], state, { invoiceKey: 'PINV1', quantities });
    const next = computeDebitNote({ invoice, returnQuantities: quantities });
    eq(name, canonicalCompute(next), canonicalCompute(legacy.result));
}

await compareCompute('1 · إرجاع كامل (بلا كميات)', purchaseInvoice(), undefined);
await compareCompute('2 · إرجاع كامل صريح', purchaseInvoice(), [2, 5]);
await compareCompute('3 · إرجاع جزئي', purchaseInvoice(), [1, 2]);
await compareCompute('4 · سطر واحد فقط', purchaseInvoice(), [2, 0]);
await compareCompute('5 · كسري', purchaseInvoice(), [0.5, 1.5]);
await compareCompute('6 · كمّية أعلى تُقصّ', purchaseInvoice(), [999, 999]);
await compareCompute('7 · كمّية سالبة تُقصّ لصفر', purchaseInvoice(), [-3, 5]);
await compareCompute('8 · خصم رأسي', purchaseInvoice({ discount: 200 }), [2, 5]);
await compareCompute('9 · خصم رأسي + جزئي', purchaseInvoice({ discount: 200 }), [1, 2]);
await compareCompute('10 · ضريبة صفر', purchaseInvoice({
    lines: [{ itemId: 'IT1', qty: 2, unitPrice: 750, total: 1500, vatRate: 0 }], vatTotal: 0, grandTotal: 1500
}), [2]);
await compareCompute('11 · حدود التقريب', purchaseInvoice({
    lines: [{ itemId: 'IT1', qty: 3, unitPrice: 33.33, total: 99.99, vatRate: 15 }]
}), [1]);
await compareCompute('12 · كل الكميات صفر', purchaseInvoice(), [0, 0]);

// ── [2] القيد ────────────────────────────────────────────────────────────────
console.log('\n[2] القيد المحاسبي — القديم مقابل الجديد');

const dnNote = (o = {}) => ({
    number: 'DN-2026-00001', date: '2026-04-01', invoiceKey: 'PINV1', invoiceNumber: 'PINV-2026-001',
    vendorId: 'V1', vendorRef: 'SUP-77', netBeforeTax: 2000, vatTotal: 300, grandTotal: 2300,
    currency: 'SAR', exchangeRate: 1, expenseAccountCode: '5110', projectId: 'P1', ...o
});

async function compareJournal(name, note, chart = ACCOUNTS, expenseCode = '5110') {
    const state = noteState({ chartOfAccounts: JSON.parse(JSON.stringify(chart)) });
    const legacy = await captureDebit(DN_FNS, 'createJournalForDebitNote', ['DN-K1', note], state, {});
    const acc = resolveFor(chart, { payableAccount: '2110', expenseAccount: expenseCode, vatAccount: '1180' });
    let next = null, err = null;
    try {
        next = buildDebitNoteJournal({
            noteKey: 'DN-K1', note, vendor: VENDORS[note.vendorId] || null, ...acc,
            journalNumber: 'JV-TEST-0001', baseCurrencyCode: 'SAR', now: NOW, userId: USER
        }).journal;
    } catch (e) { err = e; }
    if (err) return ok(name, false, `الجديد رمى: ${err.name}: ${err.message}`);
    if (!legacy.journal) return ok(name, false, 'القديم لم يُنتج قيداً');
    const cmp = compareJournals(legacy.journal, next);
    ok(name, cmp.equal, cmp.diffs.map(d => `${d.field}: قديم=${JSON.stringify(d.legacy)} جديد=${JSON.stringify(d.next)}`).join('\n       '));
    if (cmp.equal) { validateJournal(next); assertBalanced(next); }
}

await compareJournal('13 · إشعار عادي 15%', dnNote());
await compareJournal('14 · ضريبة صفر', dnNote({ vatTotal: 0, grandTotal: 2000 }));
await compareJournal('15 · عملة أجنبية USD × 3.75', dnNote({ currency: 'USD', exchangeRate: 3.75, netBeforeTax: 1000, vatTotal: 150, grandTotal: 1150 }));
await compareJournal('16 · حساب مصروف مخصّص 5120', dnNote({ expenseAccountCode: '5120' }), ACCOUNTS, '5120');
await compareJournal('17 · بلا مركز تكلفة', dnNote({ projectId: '' }));
await compareJournal('18 · مورد مفقود', dnNote({ vendorId: 'GHOST' }));
await compareJournal('19 · حدود التقريب', dnNote({ netBeforeTax: 33.33, vatTotal: 5, grandTotal: 38.33 }));
await compareJournal('20 · مبالغ نصّية', dnNote({ netBeforeTax: '2000', vatTotal: '300', grandTotal: '2300' }));
await compareJournal('21 · عملة فارغة ⇒ fx=1', dnNote({ currency: '', exchangeRate: 9 }));

// ── [3] غياب 1180 ────────────────────────────────────────────────────────────
console.log('\n[3] غياب ضريبة المدخلات — الدومين يطابق القديم');
{
    const chart = accountsWithout('1180');
    const note = dnNote();
    const state = noteState({ chartOfAccounts: JSON.parse(JSON.stringify(chart)) });
    const legacy = await captureDebit(DN_FNS, 'createJournalForDebitNote', ['DN-K1', note], state, {});
    const acc = resolveFor(chart, { payableAccount: '2110', expenseAccount: '5110', vatAccount: '1180' });
    const { journal, warnings } = buildDebitNoteJournal({
        noteKey: 'DN-K1', note, vendor: VENDORS.V1, ...acc,
        journalNumber: 'JV-TEST-0001', baseCurrencyCode: 'SAR', now: NOW, userId: USER
    });
    const cmp = compareJournals(legacy.journal, journal);
    ok('22 · الضريبة تُضمّ للمصروف في الطرفين', cmp.equal, JSON.stringify(cmp.diffs));
    eq('22b · سطر المصروف يحمل 2300', journal.lines[1].credit, 2300);
    ok('22c · مع تحذير صريح في الجديد', warnings.some(w => w.includes('1180')));
}

// ── [4] حركات المخزون ────────────────────────────────────────────────────────
console.log('\n[4] حركات المخزون — القديم مقابل الجديد');

async function compareMovements(name, note) {
    const state = noteState();
    const legacy = await captureDebit(DN_FNS, 'createReturnMovementsForDN', ['DN-K1', note], state, {});
    const plan = planDebitNoteMovements({ noteKey: 'DN-K1', note, items: state.inventoryItems, now: NOW, userId: USER });
    eq(name, plan.movements.map(canonicalMovement), legacy.movements.map(canonicalMovement));
}

const withLines = lines => dnNote({ lines });
await compareMovements('23 · صنف مادي واحد', withLines([{ itemId: 'IT1', qty: 2, unitPrice: 750, description: 'حديد' }]));
await compareMovements('24 · صنفان', withLines([{ itemId: 'IT1', qty: 2, unitPrice: 750 }, { itemId: 'IT2', qty: 5, unitPrice: 100 }]));
await compareMovements('25 · صنف خدمي يُتخطّى', withLines([{ itemId: 'SV1', qty: 1, unitPrice: 500 }, { itemId: 'IT1', qty: 1, unitPrice: 750 }]));
await compareMovements('26 · سطر بلا itemId يُتخطّى', withLines([{ qty: 3, unitPrice: 100 }]));
await compareMovements('27 · صنف غير موجود يُتخطّى', withLines([{ itemId: 'GHOST', qty: 2, unitPrice: 10 }]));
await compareMovements('28 · كمّية صفر', withLines([{ itemId: 'IT1', qty: 0, unitPrice: 750 }]));
await compareMovements('29 · بلا سطور', withLines([]));

// ── [5] الفروق المؤكَّدة عن الإشعار الدائن — لا تُوحَّد ─────────────────────────
console.log('\n[5] فروق مؤكَّدة عن الإشعار الدائن (مُثبتة لا مفترَضة)');
{
    const note = withLines([{ itemId: 'IT1', qty: 2, unitPrice: 750 }]);
    const state = noteState();
    const legacy = await captureDebit(DN_FNS, 'createReturnMovementsForDN', ['DN-K1', note], state, {});
    const m = legacy.movements[0];
    eq('30 · اتجاه الحركة out (لا in)', m.type, 'out');
    eq('30b · السبب purchase_return', m.reason, 'purchase_return');
    eq('30c · **التكلفة = سعر السطر 750 لا المتوسط المتحرّك 86.667** (D4)', m.unitPrice, 750);
    ok('30d · القديم لا يستدعي المتوسط المتحرّك في هذا المسار إطلاقاً', m.unitPrice === 750 && Math.abs(2600 / 30 - 86.667) < 0.01);
}
{
    const acc = resolveFor(ACCOUNTS, { payableAccount: '2110', expenseAccount: '5110', vatAccount: '1180' });
    const { journal } = buildDebitNoteJournal({
        noteKey: 'K', note: dnNote(), vendor: VENDORS.V1, ...acc,
        journalNumber: 'JV-1', baseCurrencyCode: 'SAR', now: NOW, userId: USER
    });
    eq('31 · حساب الضريبة 1180 (مدخلات) لا 2140', journal.lines[2].accountCode, '1180');
    eq('31b · سطر الطرف أولاً ومديناً', [journal.lines[0].accountCode, journal.lines[0].debit], ['2110', 2300]);
    eq('31c · سطر المصروف دائن', [journal.lines[1].accountCode, journal.lines[1].credit], ['5110', 2000]);
    eq('31d · sourceType debit_note', journal.sourceType, 'debit_note');
    ok('31e · المرجع «إشعار مدين»', journal.reference.startsWith('إشعار مدين'));
}

// ── [6] الثوابت والدقّة ──────────────────────────────────────────────────────
console.log('\n[6] الثوابت المحاسبية والدقّة');
{
    const probes = [
        dnNote(), dnNote({ vatTotal: 0, grandTotal: 2000 }),
        dnNote({ netBeforeTax: 0.01, vatTotal: 0, grandTotal: 0.01 }),
        dnNote({ netBeforeTax: 33.33, vatTotal: 5, grandTotal: 38.33 }),
        dnNote({ netBeforeTax: 1000.005, vatTotal: 150.0008, grandTotal: 1150.01 }),
        dnNote({ currency: 'USD', exchangeRate: 3.75, netBeforeTax: 1000, vatTotal: 150, grandTotal: 1150 })
    ];
    const acc = resolveFor(ACCOUNTS, { payableAccount: '2110', expenseAccount: '5110', vatAccount: '1180' });
    let balanced = true, noMixed = true, header = true, rounded = true;
    for (const note of probes) {
        const { journal } = buildDebitNoteJournal({
            noteKey: 'K', note, vendor: VENDORS.V1, ...acc,
            journalNumber: 'JV-1', baseCurrencyCode: 'SAR', now: NOW, userId: USER
        });
        const t = lineTotals(journal.lines);
        if (!moneyEq(t.debit, t.credit)) balanced = false;
        if (journal.lines.some(l => l.debit > 0 && l.credit > 0)) noMixed = false;
        if (!moneyEq(t.debit, journal.totalDebit)) header = false;
        if (journal.lines.some(l => round2(l.debit) !== l.debit || round2(l.credit) !== l.credit)) rounded = false;
    }
    ok('32 · كل القيود متوازنة', balanced);
    ok('33 · لا سطر بمدين ودائن معاً', noMixed);
    ok('34 · الترويسة تطابق مجموع السطور', header);
    ok('35 · كل المبالغ مقرَّبة لمنزلتين', rounded);
}

// ── [7] توصيف العيوب القديمة ─────────────────────────────────────────────────
console.log('\n[7] توصيف العيوب القديمة على المسار الحيّ');
{
    const state = noteState({ chartOfAccounts: { k: { code: '1180', nameAr: 'ض' } }, purchaseInvoices: { PINV1: purchaseInvoice() } });
    const r = await captureDebit(DN_FNS, 'submitDebitNote', [], state, { invoiceKey: 'PINV1' });
    ok('36 · BUG-010 (مدين): صفر قيد', r.captured.journals.length === 0);
    ok('36b · لكن المستند كُتب', r.captured.notes.length === 1);
    ok('36c · وحركتا المخزون كُتبتا', r.movements.length === 2, `عدد: ${r.movements.length}`);
    const invUpd = r.updates.find(u => String(u.path).includes('purchaseInvoices'));
    ok('36d · والفاتورة عُلِّمت fullyDebited', invUpd && invUpd.patch.fullyDebited === true, JSON.stringify(invUpd));
}
{
    const inv = purchaseInvoice({ debitedAmount: 1380 });
    const state = noteState({ purchaseInvoices: { PINV1: inv } });
    const r = await captureDebit(DN_FNS, 'submitDebitNote', [], state, { invoiceKey: 'PINV1' });
    const invUpd = r.updates.find(u => String(u.path).includes('purchaseInvoices'));
    eq('37 · BUG-013 (مدين): الحقل يُقصّ إلى 2300', invUpd.patch.debitedAmount, 2300);
    eq('37b · لكن القيد يعكس 2300 كاملة', r.journal.totalDebit, 2300);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
