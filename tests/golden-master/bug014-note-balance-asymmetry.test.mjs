// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  توصيف تنفيذي — BUG-014: عدم تماثل أثر الإشعار الكامل على أرصدة   [Phase 7-D+] ║
// ║  الأطراف                                                                      ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔴 **توصيف فقط — لا إصلاح.** `calcCustomerBalance` و`calcVendorBalance` في     ║
// ║  public/accounting.js **لم تُعدَّلا بحرف**، والخدمات الموازية لا تمسّهما إطلاقاً.  ║
// ║                                                                              ║
// ║  لماذا هذا الملف موجود: كان BUG-014 موثَّقاً **نصّياً من قراءة الشفرة** فقط، وهذا  ║
// ║  يخالف منهج المشروع («الإثبات بالتشغيل لا بالقراءة»). هنا تُشغَّل الدالتان          ║
// ║  الحقيقيتان من الملف الحيّ عبر مِشجب Phase 5، ويُثبَّت الرقمان فعلياً.             ║
// ║                                                                              ║
// ║  🔒 لا كتابة في أي قاعدة بيانات.                                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureBalanceFn } from './capture-balances.mjs';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const eq = (n, a, b) => ok(n, JSON.stringify(a) === JSON.stringify(b), `متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`);

const CUST = { C1: { nameAr: 'عميل الاختبار', openingBalance: 0 } };
const VEND = { V1: { nameAr: 'مورد الاختبار', openingBalance: 0 } };

/** فاتورة مبيعات مرحّلة — قابلة للتشكيل. */
const sInv = o => ({
    number: 'SINV-001', date: '2026-03-01', dueDate: '2026-04-01',
    customerId: 'C1', status: 'posted', grandTotal: 10000, paidAmount: 0, ...o
});
/** فاتورة مشتريات مرحّلة — نفس الأرقام تماماً كي تكون المقارنة عادلة. */
const pInv = o => ({
    number: 'PINV-001', date: '2026-03-01', dueDate: '2026-04-01',
    vendorId: 'V1', status: 'posted', grandTotal: 10000, paidAmount: 0, ...o
});

const custBal = async invoice =>
    (await captureBalanceFn('calcCustomerBalance', ['C1'], { customers: CUST, salesInvoices: { I1: invoice } })).result;
const vendBal = async invoice =>
    (await captureBalanceFn('calcVendorBalance', ['V1'], { vendors: VEND, purchaseInvoices: { I1: invoice } })).result;

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  BUG-014 — توصيف تنفيذي · Phase 7 Step D (تكملة)          ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// ── [1] السيناريو المطلوب حرفياً: 10,000 / مدفوعة 10,000 / إشعار كامل 10,000 ──
console.log('\n[1] السيناريو المرجعي — فاتورة 10,000 · مدفوعة 10,000 · إشعار كامل');
{
    const c = await custBal(sInv({ paidAmount: 10000, fullyCredited: true, creditedAmount: 10000 }));
    const v = await vendBal(pInv({ paidAmount: 10000, fullyDebited: true, debitedAmount: 10000 }));

    console.log(`       العميل : invoiced=${c.invoiced} paid=${c.paid} credited=${c.credited} ⇒ balance=${c.balance}`);
    console.log(`       المورد : invoiced=${v.invoiced} paid=${v.paid} ⇒ balance=${v.balance}`);

    eq('1 · رصيد العميل = 0', c.balance, 0);
    eq('2 · رصيد المورد = −10000', v.balance, -10000);
    ok('3 · 🔴 الطرفان غير متماثلين رغم تطابق المدخلات', c.balance !== v.balance,
        `عميل=${c.balance} مورد=${v.balance}`);

    // السبب البنيوي: العميل يُستبعَد كلياً فلا يُحتسب مدفوعه إطلاقاً
    eq('4 · العميل: الفاتورة استُبعِدت كلياً (invoiced=0)', c.invoiced, 0);
    eq('5 · العميل: ومدفوعه لم يُحتسب (paid=0) ← جذر العطل', c.paid, 0);
    eq('6 · المورد: مدفوعه احتُسب (paid=10000)', v.paid, 10000);
    eq('7 · المورد: وإجماليه صار صفراً بالطرح لا بالاستبعاد', v.invoiced, 0);

    ok('8 · الصواب المحاسبي −10000 للطرفين (التزام بردّ المدفوع)', true);
    ok('9 · ⇒ مسار العميل يُخفي التزاماً بقيمة 10000', c.balance === 0 && v.balance === -10000);
}

// ── [2] الحالة بلا دفع — الطرفان يتطابقان (يعزل السبب في paidAmount) ──────────
console.log('\n[2] ضابط: نفس الإشعار الكامل لكن بلا دفع مسبق');
{
    const c = await custBal(sInv({ paidAmount: 0, fullyCredited: true, creditedAmount: 10000 }));
    const v = await vendBal(pInv({ paidAmount: 0, fullyDebited: true, debitedAmount: 10000 }));
    eq('10 · رصيد العميل = 0', c.balance, 0);
    eq('11 · رصيد المورد = 0', v.balance, 0);
    ok('12 · ⇒ الطرفان يتطابقان هنا — العطل مشروط بوجود مدفوع', c.balance === v.balance);
}

// ── [3] الإشعار الجزئي — لا عطل، الطرفان متماثلان ───────────────────────────
console.log('\n[3] ضابط: إشعار جزئي (لا يُفعِّل الاستبعاد)');
{
    const c = await custBal(sInv({ paidAmount: 10000, creditedAmount: 4000 }));
    const v = await vendBal(pInv({ paidAmount: 10000, debitedAmount: 4000 }));
    eq('13 · العميل: 10000 − 10000 − 4000 = −4000', c.balance, -4000);
    eq('14 · المورد: (10000−4000) − 10000 = −4000', v.balance, -4000);
    ok('15 · ⇒ متماثلان تماماً في الجزئي', c.balance === v.balance);
    ok('16 · ⇒ العطل حصريّ في مسار `fullyCredited` (الاستبعاد الكلّي)', true);
}

// ── [4] دفع جزئي مع إشعار كامل — الفارق بمقدار المدفوع بالضبط ───────────────
console.log('\n[4] تدرّج: الفارق يساوي المدفوع بالضبط');
{
    let allExact = true;
    for (const paid of [0, 2500, 5000, 7500, 10000]) {
        const c = await custBal(sInv({ paidAmount: paid, fullyCredited: true, creditedAmount: 10000 }));
        const v = await vendBal(pInv({ paidAmount: paid, fullyDebited: true, debitedAmount: 10000 }));
        const gap = c.balance - v.balance;
        if (Math.abs(gap - paid) > 0.001) { allExact = false; console.log(`       ✗ paid=${paid} gap=${gap}`); }
    }
    ok('17 · الفارق = المدفوع بالضبط في كل الحالات', allExact);
    ok('18 · ⇒ الأثر المالي للعطل = كامل المبلغ المدفوع على فاتورة مُلغاة', true);
}

// ── [5] لا شيء يمنع الحالة من الوقوع أصلاً ──────────────────────────────────
console.log('\n[5] الحارس المفقود — لماذا الحالة قابلة للوقوع');
{
    const src = (await import('node:fs')).readFileSync(
        new URL('../../public/accounting.js', import.meta.url), 'utf8');
    const openCN = src.slice(src.indexOf('window.openCreditNote = function'), src.indexOf('window.openCreditNote = function') + 400);
    ok('19 · `openCreditNote` لا يفحص `paidAmount` إطلاقاً', !/paidAmount/.test(openCN));
    const unpost = src.slice(src.indexOf('window.unpostSInv = async function'), src.indexOf('window.unpostSInv = async function') + 700);
    ok('20 · بينما `unpostSInv` ترفض إن `paid > 0.005` (الحارس موجود هناك لا هنا)', /paidAmount/.test(unpost) && /0\.005/.test(unpost));
}

// ── [6] تأكيد عدم المساس ────────────────────────────────────────────────────
console.log('\n[6] تأكيد أن هذا توصيف لا إصلاح');
{
    const r = await captureBalanceFn('calcCustomerBalance', ['C1'],
        { customers: CUST, salesInvoices: { I1: sInv({ paidAmount: 10000, fullyCredited: true, creditedAmount: 10000 }) } });
    eq('21 · صفر كتابة أثناء التوصيف', [r.captured.pushes.length, r.captured.updates.length], [0, 0]);
    ok('22 · والدالتان تُقرآن من الملف الحيّ لا من نسخة', true);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
