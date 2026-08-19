// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  الذرّية — ترحيل فاتورة المبيعات (قيد + ربط + كل حركات المخزون)     [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الادّعاء المُختبَر: نجاح ⇒ كل شيء مكتوب. فشل ⇒ **لا شيء** مكتوب — لا قيد يتيم،    ║
// ║  ولا فاتورة «مرحّلة» بلا قيد، ولا حركة مخزون شبح، ولا مجموعة حركات ناقصة.       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import {
    buildSalesEnv, makeCounters, tenantPath, countAt, salesInvoice,
    InMemorySalesInvoicePostingRepository, ACCOUNTS, CUSTOMERS, ITEMS, MOVEMENTS
} from './salesInvoiceTestKit.mjs';
import { createPostSalesInvoiceService } from '../../src/services/accounting/posting/postSalesInvoice.js';
import { InMemoryChartOfAccountsRepository } from '../../src/repositories/memory/InMemoryChartOfAccountsRepository.js';

const { ok, eq, summary } = makeCounters();
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  الذرّية — فاتورة المبيعات · Phase 7 Step C                ║');
console.log('╚══════════════════════════════════════════════════════════╝');

const MULTI = salesInvoice({
    lines: [
        { itemId: 'IT1', qty: 2, unitPrice: 4000, description: 'حديد' },
        { itemId: 'IT2', qty: 5, unitPrice: 30, description: 'أسمنت' },
        { itemId: 'SV1', qty: 1, unitPrice: 500, description: 'إشراف' }
    ]
});

// ── [1] الكتابة الواحدة ───────────────────────────────────────────────────────
console.log('\n[1] كتابة ذرّية واحدة تضمّ كل شيء');
{
    const env = buildSalesEnv({ invoice: MULTI });
    const calls = [];
    const realUpdate = env.port.update;
    env.port.update = async (r, v) => { calls.push({ path: r.path, keys: Object.keys(v) }); return realUpdate(r, v); };
    const r = await env.service({ invoiceKey: env.invoiceKey });

    const atomic = calls.filter(c => c.path === '/');
    eq('استدعاء update ذرّي واحد فقط على الجذر', atomic.length, 1);
    eq('يضمّ 5 مسارات: قيد + 4 حقول ربط… زائد الحركات', atomic[0].keys.length, 4 + 1 + 2);
    ok('يضمّ القيد', atomic[0].keys.some(k => k.startsWith('ledger/journalEntries/')));
    ok('يضمّ حركتي المخزون معاً (الخدمة مُتخطّاة)', atomic[0].keys.filter(k => k.startsWith('ledger/inventoryMovements/')).length === 2);
    ok('يضمّ ربط الفاتورة', atomic[0].keys.some(k => k.endsWith('/journalEntryKey')));
    eq('وحركتان فعلاً في المتجر', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 2);
    eq('وعدد الأرقام المحجوزة يطابق', r.movementNumbers.length, 2);
}

// ── [2] فشل الكتابة الذرّية ⇒ لا شيء يبقى ────────────────────────────────────
console.log('\n[2] فشل الكتابة الذرّية — لا حالة جزئية');
{
    const env = buildSalesEnv({ invoice: MULTI });
    env.port.update = async r => { if (r.path === '/') throw new Error('network unavailable'); return undefined; };
    let err = null;
    try { await env.service({ invoiceKey: env.invoiceKey }); } catch (e) { err = e; }
    ok('يرمي AtomicityError مُصنَّفاً', err && err.name === 'AtomicityError', err && `${err.name}: ${err.message}`);
    eq('لا قيد يتيم', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    eq('لا حركة مخزون شبح', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 0);
}
{
    // نفس السيناريو لكن مع نجاح استرجاع الحالة — الفاتورة يجب أن تعود مسوّدة
    const env = buildSalesEnv({ invoice: MULTI });
    const realUpdate = env.port.update;
    env.port.update = async (r, v) => { if (r.path === '/') throw new Error('network unavailable'); return realUpdate(r, v); };
    try { await env.service({ invoiceKey: env.invoiceKey }); } catch (e) { /* متوقّع */ }
    eq('الفاتورة رجعت draft لا تبقى مقفلة على posted', tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1').status, 'draft');
    const inv = tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1');
    ok('ولا حقول ربط كُتبت', !inv.journalEntryKey && !inv.journalEntryNumber);
}

// ── [3] فشل حجز الرقم — قبل أي كتابة ─────────────────────────────────────────
console.log('\n[3] فشل حجز رقم القيد');
{
    const env = buildSalesEnv({ invoice: MULTI });
    env.port.runTransaction = (function (real) {
        return async (r, fn) => {
            if (String(r.path).includes('counters/jrn')) throw new Error('permission_denied');
            return real(r, fn);
        };
    })(env.port.runTransaction);
    let err = null;
    try { await env.service({ invoiceKey: env.invoiceKey }); } catch (e) { err = e; }
    ok('يرمي خطأ مستودع محايد لا خطأ Firebase خام', err && err.name === 'RepositoryError', err && err.name);
    eq('لا قيد', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    eq('لا حركات', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 0);
    eq('والحالة رجعت draft', tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1').status, 'draft');
}

// ── [4] فشل حجز رقم حركة مخزون — بعد رقم القيد ───────────────────────────────
console.log('\n[4] فشل حجز رقم حركة مخزون');
{
    const env = buildSalesEnv({ invoice: MULTI });
    env.port.runTransaction = (function (real) {
        return async (r, fn) => {
            if (String(r.path).includes('counters/invmov')) throw new Error('permission_denied');
            return real(r, fn);
        };
    })(env.port.runTransaction);
    let err = null;
    try { await env.service({ invoiceKey: env.invoiceKey }); } catch (e) { err = e; }
    ok('يفشل بلا كتابة', err !== null);
    eq('لا قيد كُتب رغم حجز رقمه', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    eq('لا حركة كُتبت', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 0);
    eq('والحالة رجعت draft', tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1').status, 'draft');
}

// ── [5] تعادل التنفيذين — نفس العقد على تخزين مختلف تماماً ────────────────────
console.log('\n[5] محايدة العقد — تنفيذ الذاكرة مقابل تنفيذ Firebase');
{
    const seed = { salesInvoices: { 'SINV-1': JSON.parse(JSON.stringify(MULTI)) }, journals: {}, movements: {}, counters: {} };
    const memRepo = new InMemorySalesInvoicePostingRepository(seed);
    const service = createPostSalesInvoiceService({
        chartOfAccountsRepo: new InMemoryChartOfAccountsRepository(JSON.parse(JSON.stringify(ACCOUNTS))),
        salesInvoicePostingRepo: memRepo,
        getInvoice: async k => seed.salesInvoices[k] || null,
        getCustomer: async id => CUSTOMERS[id] || null,
        getInventorySnapshot: async () => ({ items: ITEMS, movements: MOVEMENTS, warehouses: {} }),
        cfg: { baseCurrencyCode: 'SAR', arApMode: 'aggregate' }, currentUser: { uid: 'u1' }
    });

    const r1 = await service({ invoiceKey: 'SINV-1' });
    ok('تنفيذ الذاكرة: ترحيل ناجح', r1.success && !r1.alreadyPosted);
    eq('قيد واحد', Object.keys(seed.journals).length, 1);
    eq('حركتان', Object.keys(seed.movements).length, 2);

    const r2 = await service({ invoiceKey: 'SINV-1' });
    ok('تنفيذ الذاكرة: التكرار idempotent', r2.alreadyPosted === true);
    eq('ولا قيد ثانٍ', Object.keys(seed.journals).length, 1);
    eq('ولا حركات إضافية', Object.keys(seed.movements).length, 2);

    // مقارنة القيد الناتج من التنفيذين
    const envFb = buildSalesEnv({ invoice: MULTI });
    await envFb.service({ invoiceKey: envFb.invoiceKey });
    const jFb = Object.values(tenantPath(envFb.store, 'T1', 'ledger/journalEntries'))[0];
    const jMem = Object.values(seed.journals)[0];
    const strip = j => ({ lines: j.lines, totalDebit: j.totalDebit, totalCredit: j.totalCredit, sourceType: j.sourceType, sourceKey: j.sourceKey, status: j.status });
    eq('القيد متطابق بين التنفيذين', strip(jMem), strip(jFb));
}

// ── [6] فشل مُحقَن داخل تنفيذ الذاكرة ─────────────────────────────────────────
console.log('\n[6] حقن فشل داخل تنفيذ الذاكرة');
{
    const seed = { salesInvoices: { 'SINV-1': JSON.parse(JSON.stringify(MULTI)) }, journals: {}, movements: {}, counters: {} };
    const memRepo = new InMemorySalesInvoicePostingRepository(seed);
    memRepo.forceAtomicWriteFailure = true;
    const service = createPostSalesInvoiceService({
        chartOfAccountsRepo: new InMemoryChartOfAccountsRepository(JSON.parse(JSON.stringify(ACCOUNTS))),
        salesInvoicePostingRepo: memRepo,
        getInvoice: async k => seed.salesInvoices[k] || null,
        getCustomer: async id => CUSTOMERS[id] || null,
        getInventorySnapshot: async () => ({ items: ITEMS, movements: MOVEMENTS, warehouses: {} }),
        cfg: { baseCurrencyCode: 'SAR' }, currentUser: { uid: 'u1' }
    });
    let err = null;
    try { await service({ invoiceKey: 'SINV-1' }); } catch (e) { err = e; }
    ok('AtomicityError', err && err.name === 'AtomicityError');
    eq('لا قيد', Object.keys(seed.journals).length, 0);
    eq('لا حركات', Object.keys(seed.movements).length, 0);
    eq('والحالة رجعت draft', seed.salesInvoices['SINV-1'].status, 'draft');

    memRepo.forceAtomicWriteFailure = false;
    const r = await service({ invoiceKey: 'SINV-1' });
    ok('وإعادة المحاولة بعد رفع الحقن تنجح', r.success && !r.alreadyPosted);
    eq('بقيد واحد', Object.keys(seed.journals).length, 1);
    eq('وحركتين', Object.keys(seed.movements).length, 2);
}

process.exit(summary() ? 1 : 0);
