// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  اتساق حركة المخزون — ترحيل فاتورة المبيعات                        [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الادّعاء المُختبَر: المخزون ليس أثراً جانبياً بل جزء من المعاملة — يُكتب مع القيد   ║
// ║  أو لا يُكتب إطلاقاً، بلا ازدواج تحت التكرار أو التزامن.                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildSalesEnv, makeCounters, tenantPath, countAt, salesInvoice, ITEMS, MOVEMENTS } from './salesInvoiceTestKit.mjs';
import { calcItemBalance } from '../../src/domain/inventory/movingAverage.js';

const { ok, eq, summary } = makeCounters();
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  اتساق المخزون — فاتورة المبيعات · Phase 7 Step C         ║');
console.log('╚══════════════════════════════════════════════════════════╝');

const movsOf = env => Object.values(tenantPath(env.store, 'T1', 'ledger/inventoryMovements') || {});

console.log('\n[1] محتوى الحركة');
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [{ itemId: 'IT1', qty: 5, unitPrice: 4000, description: 'توريد حديد' }] }) });
    const r = await env.service({ invoiceKey: env.invoiceKey });
    const m = movsOf(env)[0];
    eq('نوع الحركة out', m.type, 'out');
    eq('السبب sale', m.reason, 'sale');
    eq('مصدرها الفاتورة', [m.sourceType, m.sourceKey], ['sales_invoice', 'SINV-1']);
    eq('تاريخها = تاريخ الفاتورة', m.date, '2026-03-12');
    eq('كمّيتها', m.qty, 5);
    // المتوسط المتحرّك: (10×80 + 20×90) / 30 = 86.666…
    ok('تكلفة الخروج = المتوسط المرجّح المتحرّك', Math.abs(m.unitPrice - 2600 / 30) < 1e-9, String(m.unitPrice));
    eq('سعر البيع محفوظ للمرجعية', m.salePrice, 4000);
    eq('مركز التكلفة/المشروع', m.projectId, 'P1');
    ok('رقمها محجوز بصيغة OUT', /^OUT-\d{4}-\d{5}$/.test(m.number), m.number);
    ok('بلا warehouseId — مطابقة للقديم', !('warehouseId' in m));
    eq('ومعرّفاتها مُعادة من الخدمة', r.movementIds.length, 1);
}

console.log('\n[2] قواعد التخطّي');
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [
        { itemId: 'IT1', qty: 1, unitPrice: 100 },
        { itemId: 'SV1', qty: 1, unitPrice: 500 },      // خدمة
        { itemId: 'GHOST', qty: 1, unitPrice: 10 },     // صنف غير موجود
        { qty: 1, unitPrice: 10 }                        // بلا itemId
    ] }) });
    await env.service({ invoiceKey: env.invoiceKey });
    eq('4 سطور ⇒ حركة واحدة فقط', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 1);
    eq('وهي للصنف المادي وحده', movsOf(env)[0].itemId, 'IT1');
}
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [{ itemId: 'SV1', qty: 1, unitPrice: 500 }] }) });
    const r = await env.service({ invoiceKey: env.invoiceKey });
    ok('فاتورة خدمات بحتة ⇒ ترحيل ناجح بلا حركات', r.success);
    eq('صفر حركات', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 0);
    eq('والقيد مكتوب كالمعتاد', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
}
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [] }) });
    const r = await env.service({ invoiceKey: env.invoiceKey });
    ok('فاتورة بلا سطور ⇒ ترحيل ناجح', r.success);
    eq('صفر حركات', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 0);
}

console.log('\n[3] نقص الرصيد — تحذير لا منع (سلوك القديم محفوظ)');
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [{ itemId: 'IT1', qty: 999, unitPrice: 4000 }] }) });
    const r = await env.service({ invoiceKey: env.invoiceKey });
    ok('يُرحَّل رغم النقص', r.success);
    ok('مع تحذير صريح مُعاد للمستدعي (لا toast مبتلَع)', r.warnings.some(w => w.includes('حديد')), JSON.stringify(r.warnings));
    eq('والحركة كُتبت', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 1);
}

console.log('\n[4] لا ازدواج تحت التكرار والتزامن');
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [
        { itemId: 'IT1', qty: 2, unitPrice: 100 }, { itemId: 'IT2', qty: 4, unitPrice: 30 }
    ] }) });
    await env.service({ invoiceKey: env.invoiceKey });
    await env.service({ invoiceKey: env.invoiceKey });
    await env.service({ invoiceKey: env.invoiceKey });
    eq('3 طلبات ⇒ حركتان فقط', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 2);
    const total = movsOf(env).reduce((s, m) => s + m.qty, 0);
    eq('والكمّية الخارجة الإجمالية 6 لا 18', total, 6);
}
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [{ itemId: 'IT1', qty: 3, unitPrice: 100 }] }) });
    await Promise.allSettled(Array.from({ length: 8 }, () => env.service({ invoiceKey: env.invoiceKey })));
    eq('8 طلبات متزامنة ⇒ حركة واحدة', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 1);
    eq('وكمّية خارجة 3 لا 24', movsOf(env).reduce((s, m) => s + m.qty, 0), 3);
}

console.log('\n[5] أثر الرصيد الفعلي بعد الترحيل');
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [{ itemId: 'IT1', qty: 5, unitPrice: 4000 }] }) });
    const before = calcItemBalance({ itemKey: 'IT1', items: ITEMS, movements: MOVEMENTS, warehouses: {} }).balance;
    await env.service({ invoiceKey: env.invoiceKey });
    const after = calcItemBalance({
        itemKey: 'IT1', items: ITEMS,
        movements: { ...MOVEMENTS, ...tenantPath(env.store, 'T1', 'ledger/inventoryMovements') },
        warehouses: {}
    }).balance;
    eq('الرصيد قبل الترحيل', before, 30);
    eq('وبعده 25 (نقص مرّة واحدة)', after, 25);

    // ترحيل مكرّر لا يُنقص الرصيد ثانيةً
    await env.service({ invoiceKey: env.invoiceKey });
    const afterDup = calcItemBalance({
        itemKey: 'IT1', items: ITEMS,
        movements: { ...MOVEMENTS, ...tenantPath(env.store, 'T1', 'ledger/inventoryMovements') },
        warehouses: {}
    }).balance;
    eq('وبعد طلب مكرّر يبقى 25 لا 20', afterDup, 25);
}

console.log('\n[6] المخزون والقيد يقفان أو يسقطان معاً');
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [{ itemId: 'IT1', qty: 1, unitPrice: 100 }, { itemId: 'IT2', qty: 1, unitPrice: 30 }] }) });
    const real = env.port.update;
    env.port.update = async (r, v) => { if (r.path === '/') throw new Error('network unavailable'); return real(r, v); };
    try { await env.service({ invoiceKey: env.invoiceKey }); } catch (e) { /* متوقّع */ }
    eq('فشل ⇒ لا قيد', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    eq('فشل ⇒ لا حركة (ولا واحدة من اثنتين)', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 0);
    env.port.update = real;
    await env.service({ invoiceKey: env.invoiceKey });
    eq('نجاح ⇒ قيد', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    eq('نجاح ⇒ الحركتان معاً', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 2);
}

console.log('\n[7] المخزون لا يُنتج قيد تكلفة (سياسة قائمة — لا تُغيَّر)');
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [{ itemId: 'IT1', qty: 5, unitPrice: 4000 }] }) });
    await env.service({ invoiceKey: env.invoiceKey });
    const j = Object.values(tenantPath(env.store, 'T1', 'ledger/journalEntries'))[0];
    const codes = j.lines.map(l => l.accountCode).sort();
    eq('سطور القيد: العملاء + الإيراد + الضريبة فقط', codes, ['1130', '2140', '4100']);
    ok('لا سطر مخزون ولا تكلفة بضاعة مباعة — مطابقة للقديم', !j.lines.some(l => /^(114|5[12])/.test(l.accountCode)));
}

process.exit(summary() ? 1 : 0);
