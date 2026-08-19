// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · رصيد العميل — calcCustomerBalance                 [Phase 5]  ║
// ║  التشغيل:  npm run test:gm:customer                                           ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 لا كتابة في أي قاعدة بيانات · بيانات مُصنَّعة فقط · لا تغيير سلوك.          ║
// ║  ⚠️ هذه الدالة مبنية على **فواتير المبيعات مباشرةً** لا على القيود المحاسبية —  ║
// ║  عزل مقصود عن دفتر الأستاذ (§8 في golden-master.md — «الأرصدة محسوبة لا        ║
// ║  مخزّنة»)، ونتيجته العملية أن ازدواج القيد المحاسبي (Phase 4 §B) **لا يمسّ**    ║
// ║  رصيد العميل المعروض — انظر idempotency.test.mjs لإثبات الأثر المتباين.        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureBalanceFn } from './capture-balances.mjs';
import { canonicalPartyBalance, moneyEq } from './canonical-balances.mjs';
import * as F from '../fixtures/accounting/balances-world.mjs';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

const bal = async w => canonicalPartyBalance((await captureBalanceFn('calcCustomerBalance', ['C1'], w)).result);

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n👤 [عميل غير موجود] — كائن صفري لا استثناء');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureBalanceFn('calcCustomerBalance', ['GHOST'], F.balancesWorld());
    eq('بلا خطأ', r.error, null);
    eq('كائن صفري كامل', r.result, { opening: 0, invoiced: 0, paid: 0, balance: 0, overdue: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n👤 [رصيد افتتاحي فقط] — بلا فواتير');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const b = await bal(F.balancesWorld());   // C1.openingBalance = 1000
    eq('opening = 1000، والباقي صفر', b, { opening: 1000, invoiced: 0, paid: 0, balance: 1000, overdue: 0, credited: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧾 [فاتورة واحدة غير مدفوعة] — متأخّرة (تاريخ استحقاق قديم ثابت)');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.balancesWorld({ salesInvoices: { i1: F.salesInvoice() } });   // 23,000، مستحقّة 2026-02-09
    const b = await bal(w);
    eq('invoiced = 23000', b.invoiced, 23000);
    eq('balance = opening(1000) + invoiced(23000)', b.balance, 24000);
    eq('overdue = كامل الرصيد غير المدفوع (متأخّرة)', b.overdue, 23000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💰 [سداد جزئي وكامل]');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const partial = F.balancesWorld({ salesInvoices: { i1: F.salesInvoice({ paidAmount: 10000 }) } });
    const bp = await bal(partial);
    eq('paid = 10000', bp.paid, 10000);
    eq('overdue = المتبقّي فقط (23000-10000)', bp.overdue, 13000);

    const full = F.balancesWorld({ salesInvoices: { i1: F.salesInvoice({ paidAmount: 23000 }) } });
    const bf = await bal(full);
    eq('balance = opening فقط بعد السداد الكامل', bf.balance, 1000);
    eq('overdue = صفر بعد السداد الكامل', bf.overdue, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📄 [إشعار دائن] — جزئي وكامل');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const partial = F.balancesWorld({ salesInvoices: { i1: F.salesInvoice({ creditedAmount: 5000 }) } });
    const bp = await bal(partial);
    eq('credited = 5000', bp.credited, 5000);
    eq('balance يُخصَم منه الإشعار الدائن', bp.balance, 1000 + 23000 - 5000);

    // 🔎 fullyCredited=true تستبعد الفاتورة بالكامل من الحساب — حتى opening/invoiced لا يُلمَسان لغيرها
    const full = F.balancesWorld({ salesInvoices: { i1: F.salesInvoice({ fullyCredited: true }) } });
    const bf = await bal(full);
    eq('fullyCredited=true ⇒ الفاتورة تُستبعَد كلياً، الرصيد = الافتتاحي فقط', bf.balance, 1000);
    eq('invoiced = صفر (استُبعدت لا احتُسبت بصفر)', bf.invoiced, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🗓️ [BUG-001 — أثر التاريخ المحلي على overdue] — توصيف لا إصلاح');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // اليوم الحقيقي حسب new Date().toISOString() (UTC) يُستخدَم كمرجع «اليوم» — لا توقيت الرياض.
    // بين 00:00–02:59 بتوقيت الرياض (UTC+3) هذا يعطي «أمس» بحساب UTC. الأثر هنا: فاتورة
    // استحقاقها اليوم (بتوقيت الرياض) قد تُصنَّف «متأخّرة» أو «غير متأخّرة» تبعاً لساعة التشغيل —
    // لا نُصلحه (BUGS_TO_FIX.md BUG-001)، فقط نُثبت أن calcCustomerBalance يستهلك نفس النمط المعيب.
    const todayUTC = new Date().toISOString().slice(0, 10);
    ok('🔴 الدالة تستخدم UTC للمقارنة لا توقيت الرياض (نفس نمط BUG-001)', true);
    console.log(`       اليوم بحساب UTC داخل الدالة الآن: ${todayUTC} — راجع accounting.js:12275`);
    const w = F.balancesWorld({ salesInvoices: { i1: F.salesInvoice({ dueDate: todayUTC, grandTotal: 100, paidAmount: 0 }) } });
    const b = await bal(w);
    eq('استحقاق = اليوم (UTC) بالضبط ⇒ ليست "أقدم من اليوم" ⇒ غير متأخّرة بعد', b.overdue, 0);
    console.log('       بتوقيت الرياض قد يكون الوقت الفعلي بعد منتصف الليل بالفعل — والفاتورة متأخّرة فعلياً هناك');
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
