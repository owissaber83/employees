// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خط أساس أداء ترحيل فاتورة المبيعات — تقرير أرقام لا اختبار        [Phase 7-C] ║
// ║  التشغيل: npm run svc:sales:perf                                              ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ⚠️ **هذه أرقام حساب نقيّ داخل الذاكرة — ليست زمن استجابة RTDB الحقيقي.**       ║
// ║  المحاكي لا يمرّ بشبكة ولا قرص ولا معاملة خادمية. القيمة الوحيدة لهذه الأرقام    ║
// ║  توصيف **شكل النمو** (Big-O) وكشف أي انحدار حسابي لاحق — لا التنبّؤ بالإنتاج.    ║
// ║  زمن الإنتاج الفعلي تحكمه: 1 معاملة حالة + 1 معاملة عدّاد قيد + N معاملة عدّاد   ║
// ║  حركة + 1 كتابة ذرّية = (3 + N) ذهاب/إياب شبكي — راجع §الأداء في                ║
// ║  docs/services/sales-invoice-posting.md.                                       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { createSharedStore, createTenantPort } from './fakePostingRtdb.mjs';
import { FirebaseSalesInvoicePostingRepository } from '../../src/repositories/firebase/FirebaseSalesInvoicePostingRepository.js';
import { InMemoryChartOfAccountsRepository } from '../../src/repositories/memory/InMemoryChartOfAccountsRepository.js';
import { createPostSalesInvoiceService } from '../../src/services/accounting/posting/postSalesInvoice.js';
import { buildSalesInvoiceJournal } from '../../src/domain/accounting/posting/buildSalesInvoiceJournal.js';
import { planSalesInvoiceMovements } from '../../src/domain/inventory/planSalesInvoiceMovements.js';
import { validateJournal } from '../../src/domain/accounting/posting/validateJournal.js';
import { assertBalanced } from '../../src/domain/accounting/posting/assertBalanced.js';
import { ACCOUNTS, CUSTOMERS, salesInvoice, resolveAccounts } from '../fixtures/accounting/sales-invoice-world.mjs';

const NOW = '2026-03-12T10:00:00.000Z';
const acc = resolveAccounts(ACCOUNTS);

const bench = (fn, iters) => {
    for (let i = 0; i < Math.min(iters, 2000); i++) fn();     // إحماء
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) fn();
    return (performance.now() - t0) / iters;
};

console.log('\n⏱️  خط أساس أداء ترحيل فاتورة المبيعات — Phase 7 Step C');
console.log('   (حساب نقيّ في الذاكرة — ليس زمن RTDB)\n');

// ── [أ] المكوّنات النقيّة ─────────────────────────────────────────────────────
console.log('  [أ] المكوّنات النقيّة (متوسط لكل استدعاء)');
console.log('  ' + '─'.repeat(58));

const inv = salesInvoice({ retentionAmount: 2300, advanceRecoveryAmount: 5000 });
const buildArgs = { invoiceKey: 'K', invoice: inv, customer: CUSTOMERS.C1, ...acc, journalNumber: 'JV-1', baseCurrencyCode: 'SAR', now: NOW, userId: 'u1' };
const jrn = buildSalesInvoiceJournal(buildArgs).journal;

const items = { IT1: { nameAr: 'أ', type: 'material', openingQty: 1e6, costPrice: 10 } };
const movements = {};
for (let i = 0; i < 200; i++) movements[`m${i}`] = { itemId: 'IT1', type: 'in', qty: 10, unitPrice: 10 + i, date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` };

const rows = [
    ['بناء القيد (buildSalesInvoiceJournal)', bench(() => buildSalesInvoiceJournal(buildArgs), 20000)],
    ['التحقّق البنيوي (validateJournal)', bench(() => validateJournal(jrn), 50000)],
    ['فحص التوازن (assertBalanced)', bench(() => assertBalanced(jrn), 50000)],
    ['حلّ حساب العملاء (نقيّ)', bench(() => resolveAccounts(ACCOUNTS), 20000)],
    ['تخطيط حركة مخزون × 1 (200 حركة تاريخية)', bench(() => planSalesInvoiceMovements({ invoiceKey: 'K', invoice: salesInvoice({ lines: [{ itemId: 'IT1', qty: 1, unitPrice: 5 }] }), items, movements, warehouses: {}, now: NOW, userId: 'u1' }), 2000)]
];
rows.forEach(([n, ms]) => console.log(`  ${n.padEnd(46)} ${ms.toFixed(5)} ms`));

// ── [ب] نمو تخطيط المخزون مع عدد السطور ─────────────────────────────────────
console.log('\n  [ب] تخطيط المخزون — النمو مع عدد سطور الفاتورة');
console.log('  ' + '─'.repeat(58));
console.log('  سطور        ms/فاتورة       ms/سطر');
for (const n of [1, 5, 20, 100]) {
    const lines = Array.from({ length: n }, () => ({ itemId: 'IT1', qty: 1, unitPrice: 5 }));
    const i2 = salesInvoice({ lines });
    const ms = bench(() => planSalesInvoiceMovements({ invoiceKey: 'K', invoice: i2, items, movements, warehouses: {}, now: NOW, userId: 'u1' }), 300);
    console.log(`  ${String(n).padEnd(11)} ${ms.toFixed(4).padEnd(15)} ${(ms / n).toFixed(5)}`);
}
console.log('  ⚠️ خطّي في عدد السطور، وكل سطر يُعيد مسح كامل سجل الحركات (O(سطور × حركات))');
console.log('     — منقول حرفياً من القديم، لا يُحسَّن في مرحلة الاستخلاص.');

// ── [ج] الخدمة الكاملة على المحاكي ──────────────────────────────────────────
console.log('\n  [ج] الخدمة الكاملة (محاكي — لا شبكة)');
console.log('  ' + '─'.repeat(58));
console.log('  سطور        ms/ترحيل        كتابات ذرّية    معاملات عدّاد');
for (const n of [1, 5, 20]) {
    const shared = createSharedStore();
    const port = createTenantPort(shared, `T${n}`);
    let atomicWrites = 0, counterTx = 0;
    const realUpdate = port.update, realTx = port.runTransaction;
    port.update = async (r, v) => { if (r.path === '/') atomicWrites++; return realUpdate(r, v); };
    port.runTransaction = async (r, f) => { if (String(r.path).includes('counters')) counterTx++; return realTx(r, f); };

    const service = createPostSalesInvoiceService({
        chartOfAccountsRepo: new InMemoryChartOfAccountsRepository(JSON.parse(JSON.stringify(ACCOUNTS))),
        salesInvoicePostingRepo: new FirebaseSalesInvoicePostingRepository(port),
        getInvoice: async k => { const s = await port.get(port.ref(port.db, `ledger/salesInvoices/${k}`)); return s.exists() ? s.val() : null; },
        getCustomer: async id => CUSTOMERS[id] || null,
        getInventorySnapshot: async () => ({ items, movements, warehouses: {} }),
        cfg: { baseCurrencyCode: 'SAR' }, currentUser: { uid: 'u1' }
    });

    const lines = Array.from({ length: n }, () => ({ itemId: 'IT1', qty: 1, unitPrice: 5 }));
    const REPS = 30;
    for (let i = 0; i < REPS; i++) await port.update(port.ref(port.db, `ledger/salesInvoices/K${i}`), salesInvoice({ lines }));
    atomicWrites = 0; counterTx = 0;
    const t0 = performance.now();
    for (let i = 0; i < REPS; i++) await service({ invoiceKey: `K${i}` });
    const ms = (performance.now() - t0) / REPS;
    console.log(`  ${String(n).padEnd(11)} ${ms.toFixed(4).padEnd(15)} ${String(atomicWrites / REPS).padEnd(15)} ${counterTx / REPS}`);
}
console.log('\n  📌 كتابة ذرّية واحدة لكل ترحيل مهما بلغ عدد السطور — هذا هو الثابت المقصود.');
console.log('     معاملات العدّاد = 1 (قيد) + N (حركات) — الجزء غير الذرّي الموثَّق.');
console.log('     في الإنتاج: (3 + N) ذهاب/إياب شبكي؛ الحساب النقيّ أعلاه مهمَل أمامها.\n');
