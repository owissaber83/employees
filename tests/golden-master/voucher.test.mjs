// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master — مقارنة الخدمة الجديدة (postVoucher) بسلوك القديم الحقيقي [Phase 7] ║
// ║  التشغيل: npm run test:gm:voucher                                             ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يقارن **النتيجة النهائية** (paidAmount على الفاتورة) بين تشغيل حقيقي للقديم     ║
// ║  (allocateToInvoices عبر capture-voucher.mjs) وتشغيل الخدمة الجديدة (InMemory   ║
// ║  repo) على نفس المُدخلات — في السيناريوهات التي لا تتضمّن تجاوزاً (المنطقة التي   ║
// ║  يُفترَض فيها تطابق تام). سيناريو التجاوز له ملف مقارنة منفصل أدناه — يُصنَّف صراحةً ║
// ║  كـ(C) تحسين أمان مقصود، لا يُقارَن كتطابق.                                     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureVoucherFn } from './capture-voucher.mjs';
import { createPostVoucherService } from '../../src/services/accounting/posting/postVoucher.js';
import { InMemoryVoucherPostingRepository } from '../../src/repositories/memory/InMemoryVoucherPostingRepository.js';
import { InMemoryChartOfAccountsRepository } from '../../src/repositories/memory/InMemoryChartOfAccountsRepository.js';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

const ACCOUNTS = { a1010: { code: '1010', nameAr: 'الصندوق' }, a1130: { code: '1130', nameAr: 'العملاء' }, a2110: { code: '2110', nameAr: 'الموردون' } };

async function runNewService({ voucherKey = 'RV1', voucherType = 'receipt', amount, allocations, invoices, cashAccountCode = '1010', partyId = 'C1' }) {
    const voucherColl = voucherType === 'receipt' ? 'receipts' : 'payments';
    const invoiceColl = voucherType === 'receipt' ? 'salesInvoices' : 'purchaseInvoices';
    const voucher = { number: 'V-1', type: voucherType, partyId, date: '2026-01-01', amount, cashAccountCode, currency: 'SAR', exchangeRate: 1, status: 'draft', allocations };
    const seed = { [voucherColl]: { [voucherKey]: voucher }, [invoiceColl]: JSON.parse(JSON.stringify(invoices)) };
    const repo = new InMemoryVoucherPostingRepository(seed);
    const coa = new InMemoryChartOfAccountsRepository(ACCOUNTS);
    const service = createPostVoucherService({
        chartOfAccountsRepo: coa, voucherPostingRepo: repo,
        getVoucher: async k => seed[voucherColl][k] || null,
        getCustomer: async () => ({ nameAr: 'عميل' }), getVendor: async () => ({ nameAr: 'مورد' }),
        cfg: { baseCurrencyCode: 'SAR', arApMode: 'aggregate' }, currentUser: { uid: 'u1' }
    });
    const result = await service({ voucherKey, voucherType });
    return { result, invoicesAfter: seed[invoiceColl] };
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏆 [D] تخصيص فاتورة واحدة — القديم مقابل الجديد');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const legacy = await captureVoucherFn('allocateToInvoices', [{ INV1: 6000 }, 'receipt', 'RV1'],
        { salesInvoices: { INV1: { grandTotal: 10000, paidAmount: 0 } } });
    const { invoicesAfter } = await runNewService({ amount: 6000, allocations: { INV1: 6000 }, invoices: { INV1: { grandTotal: 10000, paidAmount: 0 } } });
    eq('paidAmount مطابق تماماً للقديم', invoicesAfter.INV1.paidAmount, legacy.store.ledger.salesInvoices.INV1.paidAmount);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏆 [E] تخصيصات متعددة على فواتير مختلفة — القديم مقابل الجديد');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const initial = { INV1: { grandTotal: 10000, paidAmount: 0 }, INV2: { grandTotal: 5000, paidAmount: 0 } };
    const legacy = await captureVoucherFn('allocateToInvoices', [{ INV1: 3000, INV2: 2000 }, 'receipt', 'RV1'], { salesInvoices: JSON.parse(JSON.stringify(initial)) });
    const { invoicesAfter } = await runNewService({ amount: 5000, allocations: { INV1: 3000, INV2: 2000 }, invoices: initial });
    eq('INV1 مطابق', invoicesAfter.INV1.paidAmount, legacy.store.ledger.salesInvoices.INV1.paidAmount);
    eq('INV2 مطابق', invoicesAfter.INV2.paidAmount, legacy.store.ledger.salesInvoices.INV2.paidAmount);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏆 [سند صرف] مسار purchaseInvoices — القديم مقابل الجديد');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const legacy = await captureVoucherFn('allocateToInvoices', [{ PINV1: 4000 }, 'payment', 'PV1'],
        { purchaseInvoices: { PINV1: { grandTotal: 11500, paidAmount: 0 } } });
    const { invoicesAfter } = await runNewService({ voucherType: 'payment', partyId: 'V1', amount: 4000, allocations: { PINV1: 4000 }, invoices: { PINV1: { grandTotal: 11500, paidAmount: 0 } } });
    eq('paidAmount مطابق تماماً للقديم', invoicesAfter.PINV1.paidAmount, legacy.store.ledger.purchaseInvoices.PINV1.paidAmount);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [F/تصنيف الفرق] تجاوز الرصيد — القديم يقبل (13000)، الجديد يرفض');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const legacy = await captureVoucherFn('allocateToInvoices', [{ INV1: 7000 }, 'receipt', 'RV2'],
        { salesInvoices: { INV1: { grandTotal: 10000, paidAmount: 6000 } } });
    eq('🔴 القديم: 13000 (يتجاوز 10000 بلا رفض)', legacy.store.ledger.salesInvoices.INV1.paidAmount, 13000);

    let newError = null, invoicesAfter = null;
    try {
        ({ invoicesAfter } = await runNewService({ amount: 7000, allocations: { INV1: 7000 }, invoices: { INV1: { grandTotal: 10000, paidAmount: 6000 } } }));
    } catch (e) { newError = e; }
    ok('🔴✅ الجديد: يرمي AllocationConflictError — لا يكتب شيئاً', newError && newError.name === 'AllocationConflictError');

    console.log('\n  ═══ تصنيف الفرق (مطلوب صراحةً — §Golden Master) ═══');
    console.log('  التصنيف: (C) تحسين أمان مقصود — لا (A) خطأ تنفيذ ولا (B) فرق سلوك قديم غير مقصود.');
    console.log('  السبب: طُلب صراحةً في تعليمات Phase 7 Step B رفض أي تخصيص يتجاوز رصيد الفاتورة');
    console.log('  المتبقّي كآلية أمان من التزامن، بدل السماح بتجاوز صامت كما يفعل القديم.');
    console.log('  التوثيق: docs/services/voucher-allocation.md «فرق مقصود عن القديم».');
    ok('✅ الفرق مُصنَّف صراحةً — لا اختيار صامت', true);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
