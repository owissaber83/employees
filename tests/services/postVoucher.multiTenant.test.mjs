// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEW SAFETY INVARIANT TEST — عزل المستأجرين في ترحيل السند             [Phase 7] ║
// ║  التشغيل: npm run test:svc:voucher:tenant                                     ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  نفس مفاتيح السند/الفاتورة/التخصيص عبر مستأجرَين — صفر تسرّب. الإثبات تنفيذي على  ║
// ║  متجر RTDB مشترك حقيقي (نفس fakePostingRtdb.mjs من Phase 6).                    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { makeCounters } from './testKit.mjs';
import { buildVoucherTestEnv, draftReceipt, draftInvoice } from './voucherTestKit.mjs';
import { createSharedStore, createTenantPort, rawPath } from './fakePostingRtdb.mjs';

const { eq, ok, summary } = makeCounters();

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏢 [ترحيل مستقلّ] كل مستأجر يكتب سنده وتخصيصه تحت شجرته فقط');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const shared = createSharedStore();
    const A = await buildVoucherTestEnv({ tenantId: 'T1', shared, voucher: draftReceipt({ amount: 3000, allocations: { INV1: 3000 } }), invoices: { INV1: draftInvoice({ grandTotal: 5000 }) } });
    const B = await buildVoucherTestEnv({ tenantId: 'T2', shared, voucher: draftReceipt({ amount: 9000, allocations: { INV1: 9000 } }), invoices: { INV1: draftInvoice({ grandTotal: 20000 }) } });

    const ra = await A.service({ voucherKey: A.voucherKey, voucherType: 'receipt' });
    const rb = await B.service({ voucherKey: B.voucherKey, voucherType: 'receipt' });

    ok('ترحيل A نجح', ra.success);
    ok('ترحيل B نجح باستقلالية', rb.success);
    eq('فاتورة A بمبلغها الصحيح (3000) — نفس المفتاح INV1 لكن شجرة مختلفة', rawPath(shared, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 3000);
    eq('فاتورة B بمبلغها الصحيح (9000) — مستقلّة تماماً رغم نفس المفتاح', rawPath(shared, 'tenants/T2/ledger/salesInvoices/INV1').paidAmount, 9000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [محاولة وصول عابر للمستأجرين] نفس مفاتيح السند والفاتورة والتخصيص بالضبط');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const shared = createSharedStore();
    const A = await buildVoucherTestEnv({ tenantId: 'T1', shared, voucherKey: 'RV-SAME', voucher: draftReceipt({ amount: 100, allocations: { 'INV-SAME': 100 } }), invoices: { 'INV-SAME': draftInvoice({ grandTotal: 100 }) } });
    const B = await buildVoucherTestEnv({ tenantId: 'T2', shared, voucherKey: 'RV-SAME', voucher: draftReceipt({ amount: 200, allocations: { 'INV-SAME': 200 } }), invoices: { 'INV-SAME': draftInvoice({ grandTotal: 200 }) } });

    const ra = await A.service({ voucherKey: 'RV-SAME', voucherType: 'receipt' });
    ok('ترحيل A نجح', ra.success);

    const rb = await B.service({ voucherKey: 'RV-SAME', voucherType: 'receipt' });
    ok('🔴✅ ترحيل B لم يتأثّر بترحيل A إطلاقاً — نجح باستقلالية رغم نفس المفتاح', rb.success && !rb.alreadyPosted);

    eq('🔴✅ فاتورة B بمبلغها (200) لا فاتورة A', rawPath(shared, 'tenants/T2/ledger/salesInvoices/INV-SAME').paidAmount, 200);
    eq('وفاتورة A لم تتأثّر (100)', rawPath(shared, 'tenants/T1/ledger/salesInvoices/INV-SAME').paidAmount, 100);
    eq('شجرة T1: قيد واحد بالضبط', Object.keys(rawPath(shared, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
    eq('شجرة T2: قيد واحد بالضبط', Object.keys(rawPath(shared, 'tenants/T2/ledger/journalEntries') || {}).length, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [حماية المسار العام] — الكتابة النهائية والتخصيصات لا تكتب خارج tenants/{tid}/ledger');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const shared = createSharedStore();
    const A = await buildVoucherTestEnv({ tenantId: 'T1', shared });
    await A.service({ voucherKey: A.voucherKey, voucherType: 'receipt' });

    ok('لا كتابة على ledger/journalEntries بلا بادئة مستأجر', !rawPath(shared, 'ledger/journalEntries'));
    ok('ولا على ledger/receipts بلا بادئة', !rawPath(shared, 'ledger/receipts'));
    ok('ولا على ledger/salesInvoices بلا بادئة', !rawPath(shared, 'ledger/salesInvoices'));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏢 [سباق عبر مستأجرَين مختلفَين] — لا يتفاعل التزامن بين شجرتين منفصلتين إطلاقاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const shared = createSharedStore();
    const A = await buildVoucherTestEnv({ tenantId: 'T1', shared, voucherKey: 'RV-X', voucher: draftReceipt({ amount: 6000, allocations: { INVX: 6000 } }), invoices: { INVX: draftInvoice({ grandTotal: 10000 }) } });
    const B = await buildVoucherTestEnv({ tenantId: 'T2', shared, voucherKey: 'RV-X', voucher: draftReceipt({ amount: 7000, allocations: { INVX: 7000 } }), invoices: { INVX: draftInvoice({ grandTotal: 10000 }) } });

    const [ra, rb] = await Promise.all([A.service({ voucherKey: 'RV-X', voucherType: 'receipt' }), B.service({ voucherKey: 'RV-X', voucherType: 'receipt' })]);
    ok('🔴✅ كلاهما نجح — عزل تام، لا تعارض عبر المستأجرين رغم نفس المفتاح والتزامن الحقيقي', ra.success && rb.success);
    eq('T1: 6000', rawPath(shared, 'tenants/T1/ledger/salesInvoices/INVX').paidAmount, 6000);
    eq('T2: 7000', rawPath(shared, 'tenants/T2/ledger/salesInvoices/INVX').paidAmount, 7000);
}

console.log(summary() ? process.exit(1) : process.exit(0));
