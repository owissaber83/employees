// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · رصيد المورد — calcVendorBalance                   [Phase 5]  ║
// ║  التشغيل:  npm run test:gm:supplier                                           ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 لا كتابة في أي قاعدة بيانات · بيانات مُصنَّعة فقط · لا تغيير سلوك.          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureBalanceFn } from './capture-balances.mjs';
import { canonicalPartyBalance } from './canonical-balances.mjs';
import * as F from '../fixtures/accounting/balances-world.mjs';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

const bal = async w => canonicalPartyBalance((await captureBalanceFn('calcVendorBalance', ['V1'], w)).result);

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏭 [مورد غير موجود] — كائن صفري لا استثناء');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureBalanceFn('calcVendorBalance', ['GHOST'], F.balancesWorld());
    eq('بلا خطأ', r.error, null);
    eq('كائن صفري كامل', r.result, { opening: 0, invoiced: 0, paid: 0, balance: 0, overdue: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏭 [فاتورة مشتريات واحدة غير مدفوعة] — متأخّرة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.balancesWorld({ purchaseInvoices: { p1: F.purchaseInvoice() } });   // 11,500
    const b = await bal(w);
    eq('invoiced = 11500', b.invoiced, 11500);
    eq('balance = opening(0) + invoiced(11500)', b.balance, 11500);
    eq('overdue = كامل الرصيد', b.overdue, 11500);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💸 [سداد جزئي وكامل]');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const partial = F.balancesWorld({ purchaseInvoices: { p1: F.purchaseInvoice({ paidAmount: 5000 }) } });
    const bp = await bal(partial);
    eq('overdue = المتبقّي (11500-5000)', bp.overdue, 6500);

    const full = F.balancesWorld({ purchaseInvoices: { p1: F.purchaseInvoice({ paidAmount: 11500 }) } });
    const bf = await bal(full);
    eq('balance = 0 بعد السداد الكامل', bf.balance, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📄 [إشعار مدين — debitedAmount]');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.balancesWorld({ purchaseInvoices: { p1: F.purchaseInvoice({ debitedAmount: 1500 }) } });
    const b = await bal(w);
    eq('invoiced يُخصَم منه الإشعار المدين (11500-1500)', b.invoiced, 10000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔎 [عدم تماثل موثَّق مع calcCustomerBalance] — لا استثناء fullyCredited');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // calcCustomerBalance تفحص inv.fullyCredited وتستبعد الفاتورة كلياً عند true.
    // calcVendorBalance لا تفحص أي حقل مماثل (لا fullyDebited ولا شبيهه) — الحقل هنا بلا أثر.
    const w = F.balancesWorld({ purchaseInvoices: { p1: F.purchaseInvoice({ fullyCredited: true }) } });
    const b = await bal(w);
    ok('🔎 fullyCredited على فاتورة المشتريات بلا أي أثر — الحقل غير مقروء هنا', b.invoiced === 11500, JSON.stringify(b));
    console.log('       ⇒ موثَّق في docs/accounting/supplier-balances.md — عدم تماثل تصميمي مع جانب العملاء، لا عطل مؤكَّد');
    console.log('       (السؤال: هل هناك مسار عملي لإشعار دائن كامل من مورد؟ خارج نطاق هذه المرحلة)');
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
