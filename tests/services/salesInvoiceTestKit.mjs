// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عدّة اختبار خدمة ترحيل فاتورة المبيعات                             [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  تبني البيئة على المحاكي الواقعي (fakePostingRtdb) الذي يحاكي `ref()` و        ║
// ║  `scopeUpdates()` من app.js حرفياً — فيثبت عزل المستأجرين والذرّية معاً.         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { createSharedStore, createTenantPort, rawPath } from './fakePostingRtdb.mjs';
import { FirebaseSalesInvoicePostingRepository } from '../../src/repositories/firebase/FirebaseSalesInvoicePostingRepository.js';
import { InMemorySalesInvoicePostingRepository } from '../../src/repositories/memory/InMemorySalesInvoicePostingRepository.js';
import { InMemoryChartOfAccountsRepository } from '../../src/repositories/memory/InMemoryChartOfAccountsRepository.js';
import { createPostSalesInvoiceService } from '../../src/services/accounting/posting/postSalesInvoice.js';
import { ACCOUNTS, CUSTOMERS, ITEMS, MOVEMENTS, salesInvoice } from '../fixtures/accounting/sales-invoice-world.mjs';

export { createSharedStore, createTenantPort, rawPath, salesInvoice, ACCOUNTS, CUSTOMERS, ITEMS, MOVEMENTS };
export { InMemorySalesInvoicePostingRepository };

export function makeCounters() {
    let pass = 0, fail = 0;
    const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
    const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
    const summary = () => { console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`); return fail; };
    return { eq, ok, summary, counts: () => ({ pass, fail }) };
}

/** بيئة كاملة على منفذ مستأجر واحد فوق متجر مشترك. */
export function buildSalesEnv({
    tenantId = 'T1', invoiceKey = 'SINV-1', invoice = salesInvoice(),
    accounts = ACCOUNTS, customers = CUSTOMERS,
    items = ITEMS, movements = MOVEMENTS, warehouses = {},
    shared, cfg = { baseCurrencyCode: 'SAR', arApMode: 'aggregate' }, currentUser = { uid: 'u1' }
} = {}) {
    const store = shared || createSharedStore();
    const port = createTenantPort(store, tenantId);
    if (invoice) port.update(port.ref(port.db, `ledger/salesInvoices/${invoiceKey}`), invoice);

    const coa = new InMemoryChartOfAccountsRepository(JSON.parse(JSON.stringify(accounts)));
    const postingRepo = new FirebaseSalesInvoicePostingRepository(port);
    const service = createPostSalesInvoiceService({
        chartOfAccountsRepo: coa,
        salesInvoicePostingRepo: postingRepo,
        getInvoice: async k => { const s = await port.get(port.ref(port.db, `ledger/salesInvoices/${k}`)); return s.exists() ? s.val() : null; },
        getCustomer: async id => customers[id] || null,
        getInventorySnapshot: async () => ({ items, movements, warehouses }),
        cfg, currentUser
    });

    return { store, port, coa, postingRepo, service, invoiceKey, tenantId };
}

/** قراءة مباشرة من مسار المستأجر — للتأكيدات فقط. */
export const tenantPath = (store, tenantId, path) => rawPath(store, `tenants/${tenantId}/${path}`);

/** عدّ الأبناء تحت مسار. */
export const countAt = (store, tenantId, path) => Object.keys(tenantPath(store, tenantId, path) || {}).length;
