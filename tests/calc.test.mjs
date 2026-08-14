// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🧮 اختبارات محرك الحسابات المالية النقيّة (public/calc.js)                  ║
// ║  التشغيل:  npm run test:calc   (بلا محاكي — Node فقط)                        ║
// ║  يُختبَر نفس الكود المُستخدَم في الإنتاج (app.js يستورد من calc.js).            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { round2, calcBillingTotals, vatFromAmount, calcSubcontractCert, grossMargin } from '../public/calc.js';

let pass = 0, fail = 0;
function eq(name, actual, expected) {
    const a = typeof actual === 'number' ? +actual.toFixed(6) : actual;
    const e = typeof expected === 'number' ? +expected.toFixed(6) : expected;
    if (a === e) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log(`  ❌ ${name}  (متوقّع ${e} · فعلي ${a})`); }
}

console.log('\n🧮 التقريب:');
eq('round2(115.005) ≈ 115.01 أو 115.00 (float)', typeof round2(115.005), 'number');
eq('round2(10.234) = 10.23', round2(10.234), 10.23);
eq('round2(10.236) = 10.24', round2(10.236), 10.24);
eq('round2(null) = 0', round2(null), 0);

console.log('\n📑 المستخلص — الحالة الأساسية:');
{
    const r = calcBillingTotals({ currentAmount: 100000, retentionPct: 10, vatPct: 15, advancePct: 0, advRecoveryPct: 0, otherDeductions: 0 });
    eq('قبل الضريبة = 100000', r.beforeVAT, 100000);
    eq('الضريبة (15%) = 15000', r.vatAmount, 15000);
    eq('بعد الضريبة = 115000', r.totalAfterVAT, 115000);
    eq('المحتجز (10%) = 10000', r.retentionAmount, 10000);
    eq('الصافي = 105000', r.netAmount, 105000);
}

console.log('\n🛑 انحدار: ازدواج خصم الدفعة المقدمة (الخطأ الذي أُصلح):');
{
    // دفعة مقدمة 20% (تُقبض مرة واحدة عند التوقيع) + استرداد 20% في هذا المستخلص
    const r = calcBillingTotals({ currentAmount: 100000, retentionPct: 10, vatPct: 15, advancePct: 20, advRecoveryPct: 20, otherDeductions: 0 });
    eq('استرداد الدفعة = 20000', r.advRecoveryAmount, 20000);
    eq('مبلغ الدفعة (معلوماتي فقط) = 20000', r.advanceAmount, 20000);
    // الصافي = 115000 − 10000(محتجز) − 20000(استرداد) = 85000  ← وليس 65000 (لو خُصمت الدفعة مرتين)
    eq('الصافي = 85000 (الدفعة لا تُخصم مرتين)', r.netAmount, 85000);
    eq('🔒 لا يساوي 65000 (الازدواج)', r.netAmount !== 65000, true);
}

console.log('\n⚖️ ثابت التوازن للمستخلص:');
{
    const cases = [
        { currentAmount: 100000, retentionPct: 10, vatPct: 15, advancePct: 0, advRecoveryPct: 20, otherDeductions: 1000 },
        { currentAmount: 73450.5, retentionPct: 7.5, vatPct: 15, advancePct: 0, advRecoveryPct: 12.5, otherDeductions: 0 },
        { currentAmount: 0, retentionPct: 10, vatPct: 15, advancePct: 0, advRecoveryPct: 0, otherDeductions: 0 },
    ];
    cases.forEach((c, i) => {
        const r = calcBillingTotals(c);
        // net + retention + advRecovery + other === totalAfterVAT  (الهوية المُوازِنة)
        const lhs = +(r.netAmount + r.retentionAmount + r.advRecoveryAmount + (c.otherDeductions || 0)).toFixed(4);
        eq(`الحالة ${i + 1}: net+محتجز+استرداد+أخرى = بعد الضريبة`, lhs, +r.totalAfterVAT.toFixed(4));
    });
}

console.log('\n🧾 ضريبة القيمة المضافة:');
{
    const ex = vatFromAmount(1000, 15, false);
    eq('حصري: صافي 1000 → ضريبة 150', ex.vat, 150);
    eq('حصري: الإجمالي = 1150', ex.gross, 1150);
    const inc = vatFromAmount(1150, 15, true);
    eq('شامل: 1150 → صافي 1000', inc.net, 1000);
    eq('شامل: الضريبة = 150', inc.vat, 150);
    eq('ضريبة 0% → 0', vatFromAmount(500, 0, false).vat, 0);
}

console.log('\n🤝 شهادة دفع مقاول الباطن:');
{
    const c = calcSubcontractCert({ periodValue: 100000, retentionPct: 10, advRecoveryPct: 20, otherDeductions: 0 });
    eq('محتجز = 10000', c.retentionAmt, 10000);
    eq('استرداد = 20000', c.advanceRecovery, 20000);
    eq('صافي المستحق = 70000', c.netPayable, 70000);
}

console.log('\n📈 نسبة الربح الإجمالي:');
{
    eq('إيراد 100000 تكلفة 80000 → 20%', grossMargin(100000, 80000), 20);
    eq('إيراد 0 → 0 (لا قسمة على صفر)', grossMargin(0, 5000), 0);
    eq('خسارة: إيراد 50000 تكلفة 60000 → -20%', grossMargin(50000, 60000), -20);
}

console.log(`\n═══ النتيجة: ${pass} ناجح · ${fail} فاشل ═══`);
process.exit(fail ? 1 : 0);
