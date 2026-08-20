// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · الإشعار الدائن — القديم مقابل الجديد               [Phase 7-D] ║
// ║  كل حالة تُشغَّل مرّتين: بالدالة القديمة الحقيقية من public/accounting.js،         ║
// ║  وبوحدة الدومين الجديدة — ثم تُقارَن معياريّاً. 🔒 لا كتابة في أي قاعدة بيانات.    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureNotes, canonicalMovement, canonicalCompute } from './capture-credit-note.mjs';
import { compareJournals, lineTotals, moneyEq, round2 } from './canonical.mjs';
import { computeCreditNote } from '../../src/domain/accounting/credit-note/computeCreditNote.js';
import { buildCreditNoteJournal } from '../../src/domain/accounting/credit-note/buildCreditNoteJournal.js';
import { planCreditNoteMovements } from '../../src/domain/inventory/planCreditNoteMovements.js';
import { assertBalanced } from '../../src/domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../src/domain/accounting/posting/validateJournal.js';
import {
    ACCOUNTS, accountsWithout, CUSTOMERS, ITEMS, MOVEMENTS,
    salesInvoice, noteState, resolveFor
} from '../fixtures/accounting/note-world.mjs';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const eq = (n, a, b) => ok(n, JSON.stringify(a) === JSON.stringify(b), `متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`);

const NOW = '2026-04-01T10:00:00.000Z';
const USER = 'u-test';
const CN_FNS = ['submitCreditNote', 'cnCompute', 'createJournalForCreditNote', 'createReturnMovementsForCN', 'generateCNNumber'];

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  Golden Master — الإشعار الدائن · Phase 7 Step D          ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// ── [1] حساب المبالغ: cnCompute الحقيقية مقابل computeCreditNote النقيّة ────────
console.log('\n[1] حساب المبالغ — cnCompute مقابل computeCreditNote');

async function compareCompute(name, invoice, quantities) {
    const state = noteState({ salesInvoices: { INV1: invoice } });
    const legacy = await captureNotes(CN_FNS, 'cnCompute', ['INV1'], state,
        { prefix: 'cn', invoiceKey: 'INV1', quantities });
    const next = computeCreditNote({ invoice, returnQuantities: quantities });
    eq(name, canonicalCompute(next), canonicalCompute(legacy.result));
    return { legacy: legacy.result, next };
}

await compareCompute('1 · إرجاع كامل (بلا كميات مُمرَّرة)', salesInvoice(), undefined);
await compareCompute('2 · إرجاع كامل صريح', salesInvoice(), [2, 5]);
await compareCompute('3 · إرجاع جزئي (1 من 2 · 5 من 5)', salesInvoice(), [1, 5]);
await compareCompute('4 · إرجاع سطر واحد فقط', salesInvoice(), [2, 0]);
await compareCompute('5 · إرجاع كسري', salesInvoice(), [0.5, 2.5]);
await compareCompute('6 · كمّية أعلى من الأصلية — تُقصّ', salesInvoice(), [999, 999]);
await compareCompute('7 · كمّية سالبة — تُقصّ إلى صفر', salesInvoice(), [-5, 5]);
await compareCompute('8 · كل الكميات صفر', salesInvoice(), [0, 0]);
await compareCompute('9 · خصم رأسي على الفاتورة', salesInvoice({ discount: 200 }), [2, 5]);
await compareCompute('10 · خصم رأسي + إرجاع جزئي', salesInvoice({ discount: 200 }), [1, 2]);
await compareCompute('11 · ضريبة صفر', salesInvoice({
    lines: [{ itemId: 'IT1', qty: 2, unitPrice: 750, total: 1500, vatRate: 0, description: 'حديد' }],
    vatTotal: 0, grandTotal: 1500
}), [2]);
await compareCompute('12 · نسب ضريبة مختلطة', salesInvoice({
    lines: [
        { itemId: 'IT1', qty: 2, unitPrice: 750, total: 1500, vatRate: 15 },
        { itemId: 'IT2', qty: 5, unitPrice: 100, total: 500, vatRate: 0 }
    ]
}), [2, 5]);
await compareCompute('13 · حدود التقريب (كسور)', salesInvoice({
    lines: [{ itemId: 'IT1', qty: 3, unitPrice: 33.33, total: 99.99, vatRate: 15 }]
}), [1]);
await compareCompute('14 · سطر بكمّية أصلية صفر', salesInvoice({
    lines: [{ itemId: 'IT1', qty: 0, unitPrice: 750, total: 0, vatRate: 15 }]
}), undefined);
await compareCompute('15 · سطر خدمي + سطر مادي', salesInvoice({
    lines: [
        { itemId: 'SV1', qty: 1, unitPrice: 500, total: 500, vatRate: 15, description: 'إشراف' },
        { itemId: 'IT1', qty: 2, unitPrice: 750, total: 1500, vatRate: 15 }
    ]
}), [1, 2]);
await compareCompute('16 · كمّية سطر واحد غير مذكورة ⇒ الأصلية', salesInvoice(), [1]);

// ── [2] القيد: createJournalForCreditNote الحقيقية مقابل الدومين ───────────────
console.log('\n[2] القيد المحاسبي — القديم مقابل الجديد');

async function compareJournal(name, note, chart = ACCOUNTS, revenueCode = '4100') {
    const state = noteState({ chartOfAccounts: JSON.parse(JSON.stringify(chart)) });
    const legacy = await captureNotes(CN_FNS, 'createJournalForCreditNote', ['CN-K1', note], state, { prefix: 'cn' });
    const acc = resolveFor(chart, { receivableAccount: '1130', revenueAccount: revenueCode, vatAccount: '2140' });
    let next = null, err = null;
    try {
        next = buildCreditNoteJournal({
            noteKey: 'CN-K1', note, customer: CUSTOMERS[note.customerId] || null, ...acc,
            journalNumber: 'JV-TEST-0001', baseCurrencyCode: 'SAR', now: NOW, userId: USER
        }).journal;
    } catch (e) { err = e; }
    if (err) return ok(name, false, `الجديد رمى: ${err.name}: ${err.message}`);
    if (!legacy.journal) return ok(name, false, 'القديم لم يُنتج قيداً');
    const cmp = compareJournals(legacy.journal, next);
    ok(name, cmp.equal, cmp.diffs.map(d => `${d.field}: قديم=${JSON.stringify(d.legacy)} جديد=${JSON.stringify(d.next)}`).join('\n       '));
    if (cmp.equal) { validateJournal(next); assertBalanced(next); }
}

const baseNote = (o = {}) => ({
    number: 'CN-2026-00001', date: '2026-04-01', invoiceKey: 'INV1', invoiceNumber: 'SINV-2026-001',
    customerId: 'C1', netBeforeTax: 2000, vatTotal: 300, grandTotal: 2300,
    currency: 'SAR', exchangeRate: 1, salesAccountCode: '4100', projectId: 'P1', ...o
});

await compareJournal('17 · إشعار عادي 15%', baseNote());
await compareJournal('18 · ضريبة صفر', baseNote({ netBeforeTax: 2000, vatTotal: 0, grandTotal: 2000 }));
await compareJournal('19 · عملة أجنبية USD × 3.75', baseNote({ currency: 'USD', exchangeRate: 3.75, netBeforeTax: 1000, vatTotal: 150, grandTotal: 1150 }));
await compareJournal('20 · حساب إيرادات مخصّص 4110', baseNote({ salesAccountCode: '4110' }), ACCOUNTS, '4110');
await compareJournal('21 · بلا مركز تكلفة', baseNote({ projectId: '' }));
await compareJournal('22 · عميل مفقود', baseNote({ customerId: 'GHOST' }));
await compareJournal('23 · حدود التقريب', baseNote({ netBeforeTax: 33.33, vatTotal: 5, grandTotal: 38.33 }));
await compareJournal('24 · مبالغ نصّية', baseNote({ netBeforeTax: '2000', vatTotal: '300', grandTotal: '2300' }));
await compareJournal('25 · عملة فارغة ⇒ fx=1', baseNote({ currency: '', exchangeRate: 9 }));

// ── [3] فرق مقصود: غياب 2140 ────────────────────────────────────────────────
console.log('\n[3] غياب حساب الضريبة — الدومين يطابق «آخر ملاذ» القديم');
{
    const chart = accountsWithout('2140');
    const note = baseNote();
    const state = noteState({ chartOfAccounts: JSON.parse(JSON.stringify(chart)) });
    const legacy = await captureNotes(CN_FNS, 'createJournalForCreditNote', ['CN-K1', note], state, { prefix: 'cn' });
    const acc = resolveFor(chart, { receivableAccount: '1130', revenueAccount: '4100', vatAccount: '2140' });
    const { journal, warnings } = buildCreditNoteJournal({
        noteKey: 'CN-K1', note, customer: CUSTOMERS.C1, ...acc,
        journalNumber: 'JV-TEST-0001', baseCurrencyCode: 'SAR', now: NOW, userId: USER
    });
    const cmp = compareJournals(legacy.journal, journal);
    ok('26 · الضريبة تُضمّ للإيراد في الطرفين', cmp.equal, JSON.stringify(cmp.diffs));
    eq('26b · سطر الإيراد يحمل 2300', journal.lines[0].debit, 2300);
    ok('26c · مع تحذير صريح في الجديد (القديم صامت تماماً)', warnings.some(w => w.includes('2140')));
    ok('26d · القديم لا يُصدر أي تنبيه لهذه الحالة', legacy.toasts.length === 0, JSON.stringify(legacy.toasts));
}

// ── [4] حركات المخزون ────────────────────────────────────────────────────────
console.log('\n[4] حركات المخزون — القديم مقابل الجديد');

async function compareMovements(name, note, stateOverrides = {}) {
    const state = noteState(stateOverrides);
    const legacy = await captureNotes(CN_FNS, 'createReturnMovementsForCN', ['CN-K1', note], state, { prefix: 'cn' });
    const plan = planCreditNoteMovements({
        noteKey: 'CN-K1', note,
        items: state.inventoryItems, movements: state.inventoryMovements, warehouses: state.warehouses,
        now: NOW, userId: USER
    });
    eq(name, plan.movements.map(canonicalMovement), legacy.movements.map(canonicalMovement));
}

const noteWithLines = lines => baseNote({ lines });
await compareMovements('27 · صنف مادي واحد', noteWithLines([{ itemId: 'IT1', qty: 2, unitPrice: 750, description: 'حديد' }]));
await compareMovements('28 · صنفان', noteWithLines([{ itemId: 'IT1', qty: 2, unitPrice: 750 }, { itemId: 'IT2', qty: 5, unitPrice: 100 }]));
await compareMovements('29 · صنف خدمي يُتخطّى', noteWithLines([{ itemId: 'SV1', qty: 1, unitPrice: 500 }, { itemId: 'IT1', qty: 1, unitPrice: 750 }]));
await compareMovements('30 · سطر بلا itemId يُتخطّى', noteWithLines([{ qty: 3, unitPrice: 100 }, { itemId: 'IT1', qty: 1, unitPrice: 750 }]));
await compareMovements('31 · صنف غير موجود يُتخطّى', noteWithLines([{ itemId: 'GHOST', qty: 2, unitPrice: 10 }]));
await compareMovements('32 · كمّية صفر تُنتج حركة بصفر', noteWithLines([{ itemId: 'IT1', qty: 0, unitPrice: 750 }]));
await compareMovements('33 · صنف بلا تكلفة ولا حركات ⇒ سعر السطر', noteWithLines([{ itemId: 'IT3', qty: 2, unitPrice: 77 }]));
await compareMovements('34 · بلا سطور', noteWithLines([]));
{
    const note = noteWithLines([{ itemId: 'IT1', qty: 2, unitPrice: 750 }]);
    const state = noteState();
    const legacy = await captureNotes(CN_FNS, 'createReturnMovementsForCN', ['CN-K1', note], state, { prefix: 'cn' });
    ok('35 · التكلفة = المتوسط المرجّح المتحرّك (86.667)', Math.abs(legacy.movements[0].unitPrice - 2600 / 30) < 1e-9, String(legacy.movements[0].unitPrice));
    ok('35b · القديم لا يكتب warehouseId', !('warehouseId' in legacy.movements[0]));
    ok('35c · ولا salePrice (بخلاف حركة البيع)', !('salePrice' in legacy.movements[0]));
}

// ── [5] الثوابت المحاسبية والدقّة ────────────────────────────────────────────
console.log('\n[5] الثوابت المحاسبية والدقّة');
{
    const probes = [
        baseNote(), baseNote({ vatTotal: 0, grandTotal: 2000 }),
        baseNote({ netBeforeTax: 0.01, vatTotal: 0, grandTotal: 0.01 }),
        baseNote({ netBeforeTax: 33.33, vatTotal: 5, grandTotal: 38.33 }),
        baseNote({ netBeforeTax: 1000.005, vatTotal: 150.0008, grandTotal: 1150.01 }),
        baseNote({ currency: 'USD', exchangeRate: 3.75, netBeforeTax: 1000, vatTotal: 150, grandTotal: 1150 })
    ];
    let balanced = true, noMixed = true, header = true, rounded = true;
    const acc = resolveFor(ACCOUNTS, { receivableAccount: '1130', revenueAccount: '4100', vatAccount: '2140' });
    for (const note of probes) {
        const { journal } = buildCreditNoteJournal({
            noteKey: 'K', note, customer: CUSTOMERS.C1, ...acc,
            journalNumber: 'JV-1', baseCurrencyCode: 'SAR', now: NOW, userId: USER
        });
        const t = lineTotals(journal.lines);
        if (!moneyEq(t.debit, t.credit)) balanced = false;
        if (journal.lines.some(l => l.debit > 0 && l.credit > 0)) noMixed = false;
        if (!moneyEq(t.debit, journal.totalDebit)) header = false;
        if (journal.lines.some(l => round2(l.debit) !== l.debit || round2(l.credit) !== l.credit)) rounded = false;
    }
    ok('36 · كل القيود متوازنة', balanced);
    ok('37 · لا سطر بمدين ودائن معاً', noMixed);
    ok('38 · الترويسة تطابق مجموع السطور', header);
    ok('39 · كل المبالغ مقرَّبة لمنزلتين', rounded);
}

// ── [6] توصيف العيوب القديمة (لا إصلاح — إثبات فقط) ──────────────────────────
console.log('\n[6] توصيف العيوب القديمة على المسار الحيّ');
{
    // BUG-010: حساب مفقود ⇒ لا قيد، لكن المستند والمخزون والفاتورة تُكتب
    const state = noteState({ chartOfAccounts: { k: { code: '2140', nameAr: 'ض' } }, salesInvoices: { INV1: salesInvoice() } });
    const r = await captureNotes(CN_FNS, 'submitCreditNote', [], state, { prefix: 'cn', invoiceKey: 'INV1' });
    ok('40 · BUG-010: صفر قيد', r.captured.journals.length === 0);
    ok('40b · لكن المستند كُتب', r.captured.notes.length === 1);
    ok('40c · وحركتا المخزون كُتبتا (سطرا الفاتورة)', r.movements.length === 2, `عدد الحركات: ${r.movements.length}`);
    const invUpd = r.updates.find(u => String(u.path).includes('salesInvoices'));
    ok('40d · والفاتورة عُلِّمت مُلغاة بالكامل', invUpd && invUpd.patch.fullyCredited === true, JSON.stringify(invUpd));
    ok('40e · والتنبيه من نوع تحذير عابر لا خطأ', r.toasts.some(t => t.type === 'wn'));
    ok('40f · ورسالة نجاح تُعرض للمستخدم رغم غياب القيد', r.toasts.some(t => t.type === 'ok' && t.message.includes('صدر الإشعار')));
}
{
    // BUG-013: إشعار ثانٍ يُحسب على الفاتورة الأصلية لا المتبقّي
    const inv = salesInvoice({ creditedAmount: 1380 });
    const state = noteState({ salesInvoices: { INV1: inv } });
    const r = await captureNotes(CN_FNS, 'submitCreditNote', [], state, { prefix: 'cn', invoiceKey: 'INV1' });
    const invUpd = r.updates.find(u => String(u.path).includes('salesInvoices'));
    eq('41 · BUG-013: الحقل يُقصّ إلى إجمالي الفاتورة', invUpd.patch.creditedAmount, 2300);
    eq('41b · لكن القيد يعكس المبلغ الكامل 2300', r.journal.totalDebit, 2300);
    ok('41c · ⇒ الأثر الدفتري الكلّي 1380+2300=3680 على فاتورة 2300 (تجاوز 1380)', true);
}
{
    // الترقيم: نداءان متتاليان قبل تحديث اللقطة
    const state = noteState({ creditNotes: { a: { number: 'CN-' + new Date().getFullYear() + '-00001' } } });
    const r = await captureNotes(CN_FNS, 'generateCNNumber', [], state, { prefix: 'cn' });
    const first = r.result;
    const r2 = await captureNotes(CN_FNS, 'generateCNNumber', [], state, { prefix: 'cn' });
    eq('42 · BUG-011: نداءان على نفس اللقطة ⇒ نفس الرقم', r2.result, first);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
