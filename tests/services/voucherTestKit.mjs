// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عدّة اختبار مشتركة لملفات tests/services/postVoucher.*                [Phase 7] ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export const STD_ACCOUNTS = {
    a1010: { code: '1010', nameAr: 'الصندوق' },
    a1130: { code: '1130', nameAr: 'العملاء' },
    a2110: { code: '2110', nameAr: 'الموردون' }
};

export const STD_CUSTOMERS = { C1: { nameAr: 'عميل تجريبي' } };
export const STD_VENDORS = { V1: { nameAr: 'مورد تجريبي' } };

export function draftReceipt(overrides = {}) {
    return {
        number: 'RV-2026-001', type: 'receipt', partyId: 'C1', date: '2026-03-10',
        amount: 6000, cashAccountCode: '1010', currency: 'SAR', exchangeRate: 1,
        status: 'draft', allocations: { INV1: 6000 },
        ...overrides
    };
}

export function draftPayment(overrides = {}) {
    return {
        number: 'PV-2026-001', type: 'payment', partyId: 'V1', date: '2026-03-10',
        amount: 4000, cashAccountCode: '1010', currency: 'SAR', exchangeRate: 1,
        status: 'draft', allocations: { PINV1: 4000 },
        ...overrides
    };
}

export function draftInvoice(overrides = {}) {
    return { grandTotal: 10000, paidAmount: 0, ...overrides };
}

/** يبني بيئة خدمة كاملة على المحاكي الواقعي — منفذ مستأجر واحد + مستودعان + الخدمة. */
export async function buildVoucherTestEnv({
    tenantId = 'T1', shared,
    voucherKey = 'RV1', voucherType = 'receipt', voucher = draftReceipt(),
    invoices = { INV1: draftInvoice() },
    accounts = STD_ACCOUNTS, customers = STD_CUSTOMERS, vendors = STD_VENDORS
} = {}) {
    const { createSharedStore, createTenantPort } = await import('./fakePostingRtdb.mjs');
    const { FirebaseVoucherPostingRepository } = await import('../../src/repositories/firebase/FirebaseVoucherPostingRepository.js');
    const { InMemoryChartOfAccountsRepository } = await import('../../src/repositories/memory/InMemoryChartOfAccountsRepository.js');
    const { createPostVoucherService } = await import('../../src/services/accounting/posting/postVoucher.js');

    const store = shared || createSharedStore();
    const port = createTenantPort(store, tenantId);

    const voucherColl = voucherType === 'receipt' ? 'receipts' : 'payments';
    if (voucher) await port.update(port.ref(port.db, `ledger/${voucherColl}/${voucherKey}`), voucher);

    const invoiceColl = voucherType === 'receipt' ? 'salesInvoices' : 'purchaseInvoices';
    for (const [k, v] of Object.entries(invoices || {})) {
        await port.update(port.ref(port.db, `ledger/${invoiceColl}/${k}`), v);
    }

    const coa = new InMemoryChartOfAccountsRepository(accounts);
    const postingRepo = new FirebaseVoucherPostingRepository(port);
    const service = createPostVoucherService({
        chartOfAccountsRepo: coa,
        voucherPostingRepo: postingRepo,
        getVoucher: async k => { const s = await port.get(port.ref(port.db, `ledger/${voucherColl}/${k}`)); return s.exists() ? s.val() : null; },
        getCustomer: async id => customers[id] || null,
        getVendor: async id => vendors[id] || null,
        cfg: { baseCurrencyCode: 'SAR', arApMode: 'aggregate' },
        currentUser: { uid: 'u1' }
    });

    return { store, port, coa, postingRepo, service, voucherKey, voucherType, voucherColl, invoiceColl };
}
