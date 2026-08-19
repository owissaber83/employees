// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عدّة اختبار مشتركة لملفات tests/services/*                          [Phase 6] ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export function makeCounters() {
    let pass = 0, fail = 0;
    const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
    const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
    const summary = () => { console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`); return fail; };
    return { eq, ok, summary, counts: () => ({ pass, fail }) };
}

export const STD_ACCOUNTS = {
    a5110: { code: '5110', nameAr: 'مشتريات' },
    a2110: { code: '2110', nameAr: 'الموردون' },
    a1180: { code: '1180', nameAr: 'ضريبة مدخلات' }
};

export const STD_VENDORS = { V1: { code: 'SUP-01', nameAr: 'مورد الحديد' } };

export function draftInvoice(overrides = {}) {
    return {
        number: 'PINV-2026-001', vendorId: 'V1', vendorRef: 'SUP-77', date: '2026-03-10',
        debitAccountCode: '5110', netBeforeTax: 10000, vatTotal: 1500, grandTotal: 11500,
        currency: 'SAR', exchangeRate: 1, status: 'draft',
        ...overrides
    };
}

/** يبني بيئة خدمة كاملة على المحاكي الواقعي — منفذ مستأجر واحد + مستودعان + الخدمة. */
export async function buildTestEnv({ tenantId = 'T1', invoiceKey = 'PINV-1', invoice = draftInvoice(), accounts = STD_ACCOUNTS, vendors = STD_VENDORS, shared } = {}) {
    const { createSharedStore, createTenantPort } = await import('./fakePostingRtdb.mjs');
    const { FirebaseJournalPostingRepository } = await import('../../src/repositories/firebase/FirebaseJournalPostingRepository.js');
    const { InMemoryChartOfAccountsRepository } = await import('../../src/repositories/memory/InMemoryChartOfAccountsRepository.js');
    const { createPostPurchaseInvoiceService } = await import('../../src/services/accounting/posting/postPurchaseInvoice.js');

    const store = shared || createSharedStore();
    const port = createTenantPort(store, tenantId);
    if (invoice) await port.update(port.ref(port.db, `ledger/purchaseInvoices/${invoiceKey}`), invoice);

    const coa = new InMemoryChartOfAccountsRepository(accounts);
    const postingRepo = new FirebaseJournalPostingRepository(port);
    const service = createPostPurchaseInvoiceService({
        chartOfAccountsRepo: coa,
        journalPostingRepo: postingRepo,
        getInvoice: async k => { const s = await port.get(port.ref(port.db, `ledger/purchaseInvoices/${k}`)); return s.exists() ? s.val() : null; },
        getVendor: async id => vendors[id] || null,
        cfg: { baseCurrencyCode: 'SAR', arApMode: 'aggregate' },
        currentUser: { uid: 'u1' }
    });

    return { store, port, coa, postingRepo, service, invoiceKey };
}
