// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEW SAFETY INVARIANT TEST — التخصيص متعدّد الفواتير (N)               [Phase 7] ║
// ║  التشغيل: npm run test:svc:allocation                                         ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §6 «الجزء الصعب»: N فاتورة · رفض التجاوز (بخلاف القديم المُثبَت في               ║
// ║  tests/characterization/allocateToInvoices.test.mjs) · تعويض عند فشل جزئي ·      ║
// ║  سباق حقيقي عبر Promise.all على نفس الفاتورة بين سندين مختلفين (السيناريو        ║
// ║  6000/7000 على فاتورة 10000 — بالضبط ما أثبتناه في القديم كسلوك خطير).          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { makeCounters } from './testKit.mjs';
import { buildVoucherTestEnv, draftReceipt, draftPayment, draftInvoice, STD_ACCOUNTS } from './voucherTestKit.mjs';
import { rawPath } from './fakePostingRtdb.mjs';
import { createPostVoucherService } from '../../src/services/accounting/posting/postVoucher.js';
import { InMemoryChartOfAccountsRepository } from '../../src/repositories/memory/InMemoryChartOfAccountsRepository.js';
import { FirebaseVoucherPostingRepository } from '../../src/repositories/firebase/FirebaseVoucherPostingRepository.js';

const { eq, ok, summary } = makeCounters();

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📎 [D] تخصيص على فاتورة واحدة — المسار الأساسي');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv({
        voucher: draftReceipt({ amount: 6000, allocations: { INV1: 6000 } }),
        invoices: { INV1: draftInvoice({ grandTotal: 10000 }) }
    });
    const r = await service({ voucherKey, voucherType: 'receipt' });
    ok('نجح', r.success);
    eq('نتيجة تخصيص واحدة', r.allocationResults, [{ invoiceKey: 'INV1', allocatedAmount: 6000 }]);
    eq('paidAmount = 6000', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 6000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📎 [E] تخصيصات متعددة على N فاتورة (N=3) — كتابة نهائية واحدة، لا تسلسل update مستقلّ');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv({
        voucher: draftReceipt({ amount: 6000, allocations: { INV1: 3000, INV2: 2000, INV3: 1000 } }),
        invoices: { INV1: draftInvoice({ grandTotal: 5000 }), INV2: draftInvoice({ grandTotal: 5000 }), INV3: draftInvoice({ grandTotal: 5000 }) }
    });
    const r = await service({ voucherKey, voucherType: 'receipt' });
    ok('نجح', r.success);
    eq('ثلاث نتائج تخصيص', r.allocationResults.length, 3);
    eq('INV1 = 3000', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 3000);
    eq('INV2 = 2000', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV2').paidAmount, 2000);
    eq('INV3 = 1000', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV3').paidAmount, 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📎 [F/G] سداد جزئي ثم سداد مكمّل عبر سندين منفصلين — كلاهما ضمن الرصيد');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { store, coa, postingRepo } = await buildVoucherTestEnv({
        voucher: null, invoices: { INV1: draftInvoice({ grandTotal: 10000 }) }
    });
    const { createPostVoucherService } = await import('../../src/services/accounting/posting/postVoucher.js');
    const mkService = () => createPostVoucherService({
        chartOfAccountsRepo: coa, voucherPostingRepo: postingRepo,
        getVoucher: async k => { const s = await postingRepo._p.get(postingRepo._ref(`ledger/receipts/${k}`)); return s.exists() ? s.val() : null; },
        getCustomer: async () => ({ nameAr: 'عميل' }), cfg: { baseCurrencyCode: 'SAR', arApMode: 'aggregate' }, currentUser: { uid: 'u1' }
    });
    await postingRepo._p.update(postingRepo._ref('ledger/receipts/RV1'), draftReceipt({ amount: 4000, allocations: { INV1: 4000 } }));
    await postingRepo._p.update(postingRepo._ref('ledger/receipts/RV2'), draftReceipt({ amount: 6000, allocations: { INV1: 6000 } }));

    const s1 = mkService();
    const r1 = await s1({ voucherKey: 'RV1', voucherType: 'receipt' });
    ok('سداد جزئي أول نجح', r1.success);
    eq('بعد الأول: 4000', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 4000);

    const s2 = mkService();
    const r2 = await s2({ voucherKey: 'RV2', voucherType: 'receipt' });
    ok('سداد مكمّل ثانٍ نجح — يصل بالضبط لرصيد الفاتورة', r2.success);
    eq('بعد الثاني: 10000 (سداد كامل بالضبط)', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 10000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [L] رفض صريح للتجاوز — بخلاف القديم المُثبَت (allocateToInvoices.test.mjs)');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv({
        voucher: draftReceipt({ amount: 7000, allocations: { INV1: 7000 } }),
        invoices: { INV1: draftInvoice({ grandTotal: 10000, paidAmount: 6000 }) } // المتبقّي 4000 فقط
    });
    let err = null;
    try { await service({ voucherKey, voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('🔴✅ يرمي AllocationConflictError — القديم كان يقبل بلا فحص', err && err.name === 'AllocationConflictError', err && err.message);
    eq('الفاتورة لم تتغيّر — بقيت 6000', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 6000);
    eq('السند بقي draft', rawPath(store, `tenants/T1/ledger/receipts/${voucherKey}`).status, 'draft');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [تعويض جزئي] فاتورة أولى تنجح، ثانية تتجاوز — الأولى تُعوَّض عكسياً بالكامل');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv({
        voucher: draftReceipt({ amount: 4500, allocations: { INV1: 4000, INV2: 500 } }),
        invoices: { INV1: draftInvoice({ grandTotal: 5000 }), INV2: draftInvoice({ grandTotal: 1000, paidAmount: 900 }) } // INV2 المتبقّي 100 فقط
    });
    let err = null;
    try { await service({ voucherKey, voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('يرمي AllocationConflictError على INV2', err && err.name === 'AllocationConflictError', err && err.message);
    eq('🔴✅ INV1 عُوِّضت — عادت لـ0 رغم نجاح تخصيصها قبل فشل INV2', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 0);
    eq('INV2 لم تتغيّر (فشلت هي نفسها فلم تُكتب أصلاً)', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV2').paidAmount, 900);
    eq('السند بقي draft', rawPath(store, `tenants/T1/ledger/receipts/${voucherKey}`).status, 'draft');
    ok('ولا قيد يتيم', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💥 [السباق الحقيقي] سندان مختلفان، Promise.all، نفس الفاتورة — 6000+7000 على 10000');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { store, service: svcA, port } = await buildVoucherTestEnv({
        voucherKey: 'RVA', voucher: draftReceipt({ amount: 6000, allocations: { INV1: 6000 } }),
        invoices: { INV1: draftInvoice({ grandTotal: 10000 }) }
    });
    await port.update(port.ref(port.db, 'ledger/receipts/RVB'), draftReceipt({ amount: 7000, allocations: { INV1: 7000 } }));
    // منفذ ثانٍ (نفس المستأجر، نفس المتجر المشترك) — يحاكي مستخدماً ثانياً يفتح جلسة مستقلّة
    const postingRepoB = new FirebaseVoucherPostingRepository(port);
    const svcB = createPostVoucherService({
        chartOfAccountsRepo: new InMemoryChartOfAccountsRepository(STD_ACCOUNTS),
        voucherPostingRepo: postingRepoB,
        getVoucher: async k => { const s = await port.get(port.ref(port.db, `ledger/receipts/${k}`)); return s.exists() ? s.val() : null; },
        getCustomer: async () => ({ nameAr: 'عميل' }), cfg: { baseCurrencyCode: 'SAR', arApMode: 'aggregate' }, currentUser: { uid: 'u1' }
    });

    const results = await Promise.allSettled([svcA({ voucherKey: 'RVA', voucherType: 'receipt' }), svcB({ voucherKey: 'RVB', voucherType: 'receipt' })]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    ok('🔴✅✅ واحد فقط نجح — لا كلاهما (كان القديم يقبل كليهما ⇒ 13000)', fulfilled.length === 1, JSON.stringify(results.map(r => r.status)));
    ok('والآخر رُفض بـAllocationConflictError', rejected.length === 1 && rejected[0].reason.name === 'AllocationConflictError', rejected[0] && rejected[0].reason.message);

    const finalPaid = rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount;
    ok('🔴✅✅✅ الرصيد النهائي 6000 أو 7000 بالضبط — أبداً 13000', finalPaid === 6000 || finalPaid === 7000, `فعلي: ${finalPaid}`);
    ok('ولا يتجاوز grandTotal (10000) بأي حال', finalPaid <= 10000, `فعلي: ${finalPaid}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📎 [سند صرف] نفس منطق التخصيص على مسار purchaseInvoices');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv({
        voucherType: 'payment', voucherKey: 'PV1',
        voucher: draftPayment({ amount: 4000, allocations: { PINV1: 4000 } }),
        invoices: { PINV1: draftInvoice({ grandTotal: 11500 }) }
    });
    const r = await service({ voucherKey, voucherType: 'payment' });
    ok('نجح', r.success);
    eq('paidAmount = 4000 على مسار المشتريات', rawPath(store, 'tenants/T1/ledger/purchaseInvoices/PINV1').paidAmount, 4000);
}

console.log(summary() ? process.exit(1) : process.exit(0));
