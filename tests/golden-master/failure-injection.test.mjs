// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · حقن الفشل — الأثر على التقارير لا على عدّاد الكتابات  [Phase 5] ║
// ║  التشغيل:  npm run test:gm:failure                                            ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  Phase 4 [C] (posting-integrity.test.mjs) أثبتت أن فشل الكتابة الثانية يُنتج    ║
// ║  «قيداً يتيماً». هذا الملف يجيب السؤال التالي: **كيف يظهر هذا اليتيم في تقرير    ║
// ║  محاسبي فعلي، وهل يوجد أي فحص آلي قائم يكتشفه؟**                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureBalanceFn } from './capture-balances.mjs';
import * as F from '../fixtures/accounting/balances-world.mjs';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const note = m => console.log('       ' + m);

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🩹 [القيد اليتيم] كيف يظهر في ميزان المراجعة — ولماذا لا يُكتشَف');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // نحاكي بالضبط نتيجة Phase 4 [C]: قيد دُفع بنجاح، لكن تحديث الفاتورة (الكتابة الثانية) فشل.
    // النتيجة العملية: القيد موجود في journalEntries بلا أي فاتورة تشير إليه أو تُشار منه إليها،
    // والفاتورة نفسها **تبقى مسوّدة** (لم تُحدَّث حالتها) — لا وجود لها في purchaseInvoices بحالة posted.
    const orphan = F.movementEntry({
        number: 'JV-ORPHAN', sourceType: 'purchase_invoice', sourceKey: 'PINV-VANISHED',
        lines: [{ accountCode: '5110', debit: 4000, credit: 0 }, { accountCode: '2110', debit: 0, credit: 4000 }],
        totalDebit: 4000, totalCredit: 4000
    });
    const w = F.balancesWorld({
        journalEntries: { orphan },
        purchaseInvoices: {}   // لا وجود لـPINV-VANISHED هنا إطلاقاً — الكتابة الثانية فشلت قبل ربطها
    });

    const rTb = await captureBalanceFn('tbCalcBalances', [], w);
    const payables = rTb.result.displayBalances.find(b => b.account.code === '2110');
    ok('🔴 القيد اليتيم يدخل ميزان المراجعة بكامل قيمته (4000)', payables.credit === 4000);
    ok('🔴 والميزان يبقى متوازناً تماماً — لا إشارة حمراء واحدة', rTb.result.debitCreditBalance === true);

    // هل يوجد أي أثر نستطيع تتبّعه؟ نبحث في كل مصادر المستندات عن sourceKey القيد
    const anyMatchingInvoice = Object.values(w.purchaseInvoices).some(inv => inv.journalEntryKey === 'orphan');
    ok('🔴 ولا توجد أي فاتورة تُشير إلى هذا القيد — لا مسار عكسي للتتبّع', anyMatchingInvoice === false);
    note('⇒ التخفيف الوحيد القائم (Phase 4 §D): فشل *بناء* القيد يمنع الترحيل. هذا مختلف —');
    note('القيد **نجح** والفشل جاء في الخطوة التالية، وهي حالة لا يحرسها أي تخفيف حالي.');
    note('لا يوجد في accounting.js أي مهمة أو دالة "فحص اتّساق دوري" تقارن مجموع القيود بمصادرها.');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🩹 [مقارنة] نفس المبلغ عبر calcVendorBalance — لا يظهر إطلاقاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // القيد اليتيم بلا فاتورة posted مقابلة ⇒ calcVendorBalance (المبنية على الفواتير) لا ترى شيئاً
    const orphan = F.movementEntry({ sourceType: 'purchase_invoice', sourceKey: 'PINV-VANISHED',
        lines: [{ accountCode: '5110', debit: 4000, credit: 0 }, { accountCode: '2110', debit: 0, credit: 4000 }], totalDebit: 4000, totalCredit: 4000 });
    const w = F.balancesWorld({ journalEntries: { orphan }, purchaseInvoices: {}, vendors: { V1: { code: 'SUP-01', nameAr: 'مورد', openingBalance: 0 } } });
    const r = await captureBalanceFn('calcVendorBalance', ['V1'], w);
    eq('رصيد المورد = صفر — لا فاتورة posted تُبنى منها', r.result.balance, 0);
    note('🔴🔴 نفس نمط idempotency.test.mjs: ميزان المراجعة يحمل 4000 التزاماً لا مصدر ظاهر له،');
    note('بينما شاشة أرصدة الموردين "نظيفة" تماماً — لأن مصدر بياناتها مختلف جذرياً (الفاتورة لا القيد).');
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
console.log('⚠️  نجاح هذه المجموعة يعني «النظام يتصرّف كما وُصف» لا «النظام سليم».');
process.exit(fail ? 1 : 0);
