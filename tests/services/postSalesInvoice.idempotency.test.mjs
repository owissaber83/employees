// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Idempotency وسلامة القيد تحت التزامن — ترحيل فاتورة المبيعات      [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الادّعاء المُختبَر: طلب ترحيل متكرّر أو متزامن لا يُنتج قيداً ثانياً ولا حركة       ║
// ║  مخزون ثانية ولا أثراً مالياً مضاعفاً (حماية BUG-007).                          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildSalesEnv, makeCounters, tenantPath, countAt, salesInvoice } from './salesInvoiceTestKit.mjs';

const { ok, eq, summary } = makeCounters();
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  Idempotency — فاتورة المبيعات · Phase 7 Step C           ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// ── [1] الترحيل المفرد ────────────────────────────────────────────────────────
console.log('\n[1] الترحيل المفرد — الأساس');
{
    const env = buildSalesEnv();
    const r = await env.service({ invoiceKey: env.invoiceKey });
    ok('ترحيل واحد ينجح', r.success && !r.alreadyPosted);
    eq('قيد واحد فقط', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    eq('حركة مخزون واحدة فقط', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 1);
    const inv = tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1');
    eq('حالة الفاتورة posted', inv.status, 'posted');
    ok('الفاتورة مربوطة بالقيد', inv.journalEntryKey === r.journalId && inv.journalEntryNumber === r.journalNumber);
    ok('مفتاح Idempotency حتمي', r.idempotencyKey === 'salesInvoice:SINV-1:POST');
}

// ── [2] الطلب المكرّر (تسلسلي) ────────────────────────────────────────────────
console.log('\n[2] الطلب المكرّر — تسلسلي');
{
    const env = buildSalesEnv();
    const r1 = await env.service({ invoiceKey: env.invoiceKey });
    const r2 = await env.service({ invoiceKey: env.invoiceKey });
    ok('الطلب الثاني ينجح idempotently لا يفشل', r2.success && r2.alreadyPosted === true);
    eq('لا قيد ثانٍ', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    eq('لا حركة مخزون ثانية', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 1);
    eq('ويعيد نفس القيد الأصلي', r2.journalId, r1.journalId);
    eq('ونفس رقم القيد', r2.journalNumber, r1.journalNumber);
}
{
    const env = buildSalesEnv();
    await env.service({ invoiceKey: env.invoiceKey });
    for (let i = 0; i < 5; i++) await env.service({ invoiceKey: env.invoiceKey });
    eq('6 طلبات تسلسلية ⇒ قيد واحد', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    eq('6 طلبات تسلسلية ⇒ حركة واحدة', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 1);
}

// ── [3] الطلبات المتزامنة الحقيقية (Promise.all) ──────────────────────────────
console.log('\n[3] التزامن الحقيقي — Promise.all');
for (const n of [2, 5, 10]) {
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [
        { itemId: 'IT1', qty: 2, unitPrice: 4000 }, { itemId: 'IT2', qty: 3, unitPrice: 30 }
    ] }) });
    const results = await Promise.allSettled(
        Array.from({ length: n }, () => env.service({ invoiceKey: env.invoiceKey }))
    );
    const fulfilled = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const fresh = fulfilled.filter(r => !r.alreadyPosted);
    eq(`${n} طلباً متزامناً ⇒ ترحيل أصلي واحد بالضبط`, fresh.length, 1);
    eq(`${n} طلباً متزامناً ⇒ قيد واحد بالضبط`, countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    eq(`${n} طلباً متزامناً ⇒ مجموعة حركات واحدة (2)`, countAt(env.store, 'T1', 'ledger/inventoryMovements'), 2);
    ok(`${n} طلباً متزامناً ⇒ لا استثناء غير مُصنَّف`, results.every(r => r.status === 'fulfilled'),
        results.filter(r => r.status === 'rejected').map(r => r.reason && r.reason.name).join(','));
}

// ── [4] حماية BUG-007 — الأثر المالي لا يتضاعف ───────────────────────────────
console.log('\n[4] حماية BUG-007 — الأثر المالي المفرد');
{
    const env = buildSalesEnv();
    await env.service({ invoiceKey: env.invoiceKey });
    await env.service({ invoiceKey: env.invoiceKey });
    const journals = Object.values(tenantPath(env.store, 'T1', 'ledger/journalEntries') || {});
    const totalDebit = journals.reduce((s, j) => s + (Number(j.totalDebit) || 0), 0);
    eq('مجموع مدين دفتر اليومية = 23000 لا 46000', totalDebit, 23000);

    const custLines = journals.flatMap(j => j.lines).filter(l => l.accountCode === '1130');
    eq('أثر ذمّة العميل مرّة واحدة', custLines.reduce((s, l) => s + l.debit, 0), 23000);

    const revLines = journals.flatMap(j => j.lines).filter(l => l.accountCode === '4100');
    eq('أثر الإيراد مرّة واحدة', revLines.reduce((s, l) => s + l.credit, 0), 20000);

    const vatLines = journals.flatMap(j => j.lines).filter(l => l.accountCode === '2140');
    eq('أثر الضريبة مرّة واحدة', vatLines.reduce((s, l) => s + l.credit, 0), 3000);

    const movs = Object.values(tenantPath(env.store, 'T1', 'ledger/inventoryMovements') || {});
    eq('أثر المخزون مرّة واحدة (الكمّية)', movs.reduce((s, m) => s + m.qty, 0), 5);
}

// ── [5] فاتورة ليست مسوّدة ────────────────────────────────────────────────────
console.log('\n[5] الحالات غير القابلة للترحيل');
{
    const env = buildSalesEnv({ invoice: salesInvoice({ status: 'posted', journalEntryKey: 'OLD-J', journalEntryNumber: 'JV-OLD' }) });
    const r = await env.service({ invoiceKey: env.invoiceKey });
    ok('فاتورة مُرحَّلة سلفاً ⇒ نتيجة idempotent بالقيد القديم', r.alreadyPosted && r.journalId === 'OLD-J');
    eq('ولا يُكتب قيد جديد', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    eq('ولا حركة مخزون', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 0);
}
{
    const env = buildSalesEnv({ invoice: salesInvoice({ status: 'cancelled' }) });
    const r = await env.service({ invoiceKey: env.invoiceKey });
    ok('فاتورة ملغاة ⇒ لا ترحيل ولا كتابة', r.alreadyPosted && r.journalId === null);
    eq('لا قيد', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
}

// ── [6] إعادة المحاولة بعد فشل ────────────────────────────────────────────────
console.log('\n[6] إعادة المحاولة بعد الفشل');
{
    const env = buildSalesEnv();
    // نُفشل الكتابة الذرّية مرّة واحدة ثم نُعيد المحاولة
    const realUpdate = env.port.update;
    let failed = false;
    env.port.update = async (r, v) => {
        if (!failed && r.path === '/') { failed = true; throw new Error('network unavailable'); }
        return realUpdate(r, v);
    };
    let firstErr = null;
    try { await env.service({ invoiceKey: env.invoiceKey }); } catch (e) { firstErr = e; }
    ok('المحاولة الأولى تفشل بـAtomicityError', firstErr && firstErr.name === 'AtomicityError', firstErr && firstErr.name);
    eq('ولا قيد بقي', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    eq('ولا حركة مخزون بقيت', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 0);
    eq('والفاتورة رجعت مسوّدة (قابلة لإعادة المحاولة)', tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1').status, 'draft');

    const r2 = await env.service({ invoiceKey: env.invoiceKey });
    ok('إعادة المحاولة تنجح', r2.success && !r2.alreadyPosted);
    eq('وقيد واحد فقط في النهاية', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    eq('وحركة واحدة فقط', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 1);
    ok('ورقم القيد الثاني ≠ الأول (الرقم الأول احترق — حدّ موثَّق)', r2.journalNumber.endsWith('00002'), r2.journalNumber);
}

process.exit(summary() ? 1 : 0);
