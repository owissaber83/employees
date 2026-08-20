// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خط أساس أداء خدمات الإشعارات — تقرير أرقام لا اختبار              [Phase 7-D] ║
// ║  التشغيل: npm run svc:notes:perf                                              ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ⚠️ **أرقام حساب نقيّ داخل الذاكرة — ليست زمن استجابة RTDB.** المحاكي لا يمرّ    ║
// ║  بشبكة ولا معاملة خادمية. القيمة الوحيدة: توصيف **شكل النمو** وكشف أي انحدار.   ║
// ║  زمن الإنتاج الفعلي تحكمه الذهابات/الإيابات: 1 مطالبة + 3 عدّادات (إشعار · قيد   ║
// ║  · N حركة) + 1 معاملة فاتورة + 1 كتابة ذرّية = **(4 + N)** رحلة شبكية.          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildNoteEnv } from './noteTestKit.mjs';
import { computeCreditNote } from '../../src/domain/accounting/credit-note/computeCreditNote.js';
import { computeDebitNote } from '../../src/domain/accounting/debit-note/computeDebitNote.js';
import { buildCreditNoteJournal } from '../../src/domain/accounting/credit-note/buildCreditNoteJournal.js';
import { buildDebitNoteJournal } from '../../src/domain/accounting/debit-note/buildDebitNoteJournal.js';
import { computeNoteCapacity } from '../../src/domain/accounting/notes/computeNoteCapacity.js';
import { planCreditNoteMovements } from '../../src/domain/inventory/planCreditNoteMovements.js';
import { planDebitNoteMovements } from '../../src/domain/inventory/planDebitNoteMovements.js';
import { validateJournal } from '../../src/domain/accounting/posting/validateJournal.js';
import { assertBalanced } from '../../src/domain/accounting/posting/assertBalanced.js';
import { ACCOUNTS, ITEMS, salesInvoice, purchaseInvoice, resolveFor } from '../fixtures/accounting/note-world.mjs';

const NOW = '2026-04-01T10:00:00.000Z';
const bench = (fn, iters) => {
    for (let i = 0; i < Math.min(iters, 2000); i++) fn();     // إحماء
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) fn();
    return (performance.now() - t0) / iters;
};
const lines = n => Array.from({ length: n }, (_, i) => ({ itemId: 'IT1', qty: 2, unitPrice: 100, total: 200, vatRate: 15, description: 'س' + i }));

console.log('\n⏱️  خط أساس أداء خدمات الإشعارات — Phase 7 Step D');
console.log('   (حساب نقيّ في الذاكرة — ليس زمن RTDB)\n');

console.log('  [أ] المكوّنات النقيّة (متوسط لكل استدعاء)');
console.log('  ' + '─'.repeat(60));
const sInv = salesInvoice(), pInv = purchaseInvoice();
const cnAcc = resolveFor(ACCOUNTS, { receivableAccount: '1130', revenueAccount: '4100', vatAccount: '2140' });
const dnAcc = resolveFor(ACCOUNTS, { payableAccount: '2110', expenseAccount: '5110', vatAccount: '1180' });
const cnNote = { number: 'CN-1', date: '2026-04-01', invoiceNumber: 'S1', customerId: 'C1', netBeforeTax: 2000, vatTotal: 300, grandTotal: 2300, currency: 'SAR', exchangeRate: 1, projectId: 'P1', lines: sInv.lines };
const dnNote = { number: 'DN-1', date: '2026-04-01', invoiceNumber: 'P1', vendorId: 'V1', netBeforeTax: 2000, vatTotal: 300, grandTotal: 2300, currency: 'SAR', exchangeRate: 1, projectId: 'P1', lines: pInv.lines };
const cnJ = buildCreditNoteJournal({ noteKey: 'K', note: cnNote, customer: null, ...cnAcc, journalNumber: 'J', baseCurrencyCode: 'SAR', now: NOW, userId: 'u' }).journal;

[
    ['computeCreditNote (سطران)', () => computeCreditNote({ invoice: sInv, returnQuantities: [1, 2] }), 20000],
    ['computeDebitNote  (سطران)', () => computeDebitNote({ invoice: pInv, returnQuantities: [1, 2] }), 20000],
    ['buildCreditNoteJournal', () => buildCreditNoteJournal({ noteKey: 'K', note: cnNote, customer: null, ...cnAcc, journalNumber: 'J', baseCurrencyCode: 'SAR', now: NOW, userId: 'u' }), 20000],
    ['buildDebitNoteJournal', () => buildDebitNoteJournal({ noteKey: 'K', note: dnNote, vendor: null, ...dnAcc, journalNumber: 'J', baseCurrencyCode: 'SAR', now: NOW, userId: 'u' }), 20000],
    ['computeNoteCapacity', () => computeNoteCapacity({ invoiceKey: 'I', noteKey: 'N', grandTotal: 2300, currentNotedAmount: 0, noteAmount: 100 }), 50000],
    ['validateJournal', () => validateJournal(cnJ), 50000],
    ['assertBalanced', () => assertBalanced(cnJ), 50000],
    ['planCreditNoteMovements (متوسط متحرّك)', () => planCreditNoteMovements({ noteKey: 'K', note: cnNote, items: ITEMS, movements: {}, warehouses: {}, now: NOW, userId: 'u' }), 5000],
    ['planDebitNoteMovements (سعر السطر)', () => planDebitNoteMovements({ noteKey: 'K', note: dnNote, items: ITEMS, now: NOW, userId: 'u' }), 20000]
].forEach(([n, f, it]) => console.log(`  ${n.padEnd(42)} ${bench(f, it).toFixed(5)} ms`));

console.log('\n  [ب] النمو مع عدد السطور (حساب المبالغ + تخطيط المخزون)');
console.log('  ' + '─'.repeat(60));
console.log('  N سطر      compute (ms)    planCN (ms)     planDN (ms)');
for (const n of [1, 10, 100, 1000]) {
    const inv = salesInvoice({ lines: lines(n) });
    const note = { ...cnNote, lines: lines(n) };
    const c = bench(() => computeCreditNote({ invoice: inv }), n >= 1000 ? 30 : 300);
    const pc = bench(() => planCreditNoteMovements({ noteKey: 'K', note, items: ITEMS, movements: {}, warehouses: {}, now: NOW, userId: 'u' }), n >= 1000 ? 20 : 200);
    const pd = bench(() => planDebitNoteMovements({ noteKey: 'K', note, items: ITEMS, now: NOW, userId: 'u' }), n >= 1000 ? 30 : 300);
    console.log(`  ${String(n).padEnd(10)} ${c.toFixed(4).padEnd(15)} ${pc.toFixed(4).padEnd(15)} ${pd.toFixed(4)}`);
}
console.log('  ⚠️ planCN خطّي × سجل الحركات (متوسط متحرّك لكل سطر) — منقول حرفياً من القديم.');
console.log('     planDN خطّي فقط (لا تقييم) — الفرق البنيوي نفسه المُوثَّق في D4.');

console.log('\n  [ج] الخدمة الكاملة على المحاكي (لا شبكة)');
console.log('  ' + '─'.repeat(60));
console.log('  المسار       ms/إشعار      كتابات ذرّية   معاملات');
for (const kind of ['credit', 'debit']) {
    const REPS = 25;
    let atomic = 0, tx = 0;
    const t0 = performance.now();
    for (let i = 0; i < REPS; i++) {
        const env = buildNoteEnv(kind);
        const ru = env.port.update, rt = env.port.runTransaction;
        env.port.update = async (r, v) => { if (r.path === '/') atomic++; return ru(r, v); };
        env.port.runTransaction = async (r, f) => { tx++; return rt(r, f); };
        await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey });
    }
    const ms = (performance.now() - t0) / REPS;
    console.log(`  ${kind.padEnd(12)} ${ms.toFixed(4).padEnd(13)} ${(atomic / REPS).toFixed(0).padEnd(14)} ${(tx / REPS).toFixed(0)}`);
}
console.log('\n  📌 كتابة ذرّية واحدة لكل إشعار مهما بلغ عدد السطور — الثابت المقصود.');
console.log('     المعاملات = مطالبة + عدّاد إشعار + عدّاد قيد + N عدّاد حركة + فاتورة.');
console.log('     في الإنتاج: (4 + N) رحلة شبكية؛ الحساب النقيّ أعلاه مهمَل أمامها.\n');
