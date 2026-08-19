// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  LEGACY BEHAVIOR TEST — allocateToInvoices (السلوك القائم كما هو)     [Phase 7] ║
// ║  التشغيل: npm run test:char:allocation                                        ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يُشغّل الدالة الحقيقية من accounting.js عبر capture-voucher.mjs — لا يُعيد        ║
// ║  كتابة المنطق. **يُثبت خصوصاً غياب أي سقف للتجاوز** — هذا هو الأساس الذي يبني     ║
// ║  عليه computeInvoiceAllocation فرقاً موثَّقاً (docs/services/allocation.md).       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureVoucherFn } from '../golden-master/capture-voucher.mjs';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📎 [تخصيص واحد على فاتورة مبيعات] — سلوك عادي');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureVoucherFn('allocateToInvoices', [{ INV1: 6000 }, 'receipt', 'RV1'],
        { salesInvoices: { INV1: { grandTotal: 10000, paidAmount: 0 } } });
    eq('بلا خطأ', r.error, null);
    eq('paidAmount = 6000', r.store.ledger.salesInvoices.INV1.paidAmount, 6000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📎 [تخصيصات متعددة على فواتير مختلفة] — كل فاتورة مستقلة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureVoucherFn('allocateToInvoices', [{ INV1: 3000, INV2: 2000 }, 'receipt', 'RV1'],
        { salesInvoices: { INV1: { grandTotal: 10000, paidAmount: 0 }, INV2: { grandTotal: 5000, paidAmount: 0 } } });
    eq('INV1 = 3000', r.store.ledger.salesInvoices.INV1.paidAmount, 3000);
    eq('INV2 = 2000', r.store.ledger.salesInvoices.INV2.paidAmount, 2000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📎 [تخصيص على فاتورة مشتريات] — نفس المسار بمسار مختلف');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureVoucherFn('allocateToInvoices', [{ PINV1: 4000 }, 'payment', 'PV1'],
        { purchaseInvoices: { PINV1: { grandTotal: 11500, paidAmount: 0 } } });
    eq('paidAmount = 4000', r.store.ledger.purchaseInvoices.PINV1.paidAmount, 4000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [الاكتشاف الحرج] القديم لا يفحص التجاوز إطلاقاً — بلا خطأ، بلا تحذير');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // فاتورة رصيدها المتبقّي 4000 (10000 - 6000 مدفوع سلفاً) — نخصّص 7000 فوقها
    const r = await captureVoucherFn('allocateToInvoices', [{ INV1: 7000 }, 'receipt', 'RV2'],
        { salesInvoices: { INV1: { grandTotal: 10000, paidAmount: 6000 } } });
    eq('🔴 بلا خطأ إطلاقاً', r.error, null);
    eq('🔴 paidAmount = 13000 — يتجاوز الفاتورة (10000) بلا رفض', r.store.ledger.salesInvoices.INV1.paidAmount, 13000);
    eq('🔴 ولا حتى تحذير toast', r.captured.toasts, []);
    console.log('       ⇒ هذا الفرق مقصود ومُصلَح في الخدمة الجديدة (computeInvoiceAllocation)');
    console.log('       بطلب صريح من تعليمات Phase 7 Step B — موثَّق في docs/services/allocation.md');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📎 [فاتورة غير موجودة في التخصيصات] — تُتجاوَز بصمت، لا خطأ يوقف الباقي');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureVoucherFn('allocateToInvoices', [{ GHOST: 1000, INV1: 2000 }, 'receipt', 'RV1'],
        { salesInvoices: { INV1: { grandTotal: 10000, paidAmount: 0 } } });
    eq('بلا خطأ', r.error, null);
    eq('INV1 نُفِّذ رغم فشل GHOST', r.store.ledger.salesInvoices.INV1.paidAmount, 2000);
    ok('🔎 الفاتورة الوهمية GHOST لم تُنشأ في المتجر', !r.store.ledger.salesInvoices.GHOST);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📎 [مبلغ صفري أو سالب في التخصيصات] — يُتجاوَز');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureVoucherFn('allocateToInvoices', [{ INV1: 0, INV2: -500 }, 'receipt', 'RV1'],
        { salesInvoices: { INV1: { grandTotal: 10000, paidAmount: 0 }, INV2: { grandTotal: 5000, paidAmount: 0 } } });
    eq('INV1 يبقى صفراً (تخصيص صفري تُجوهر)', r.store.ledger.salesInvoices.INV1.paidAmount, 0);
    eq('INV2 يبقى صفراً (تخصيص سالب تُجوهر)', r.store.ledger.salesInvoices.INV2.paidAmount, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📎 [بلا تخصيصات إطلاقاً] — لا شيء يحدث');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureVoucherFn('allocateToInvoices', [null, 'receipt', 'RV1'], {});
    eq('بلا خطأ', r.error, null);
    eq('لا تحديثات', r.captured.updates, []);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
