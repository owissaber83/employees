// ══════════════════════════════════════════════════════════════════════════
// 🧮 محرك الحسابات المالية النقيّة — مصدر الحقيقة الوحيد للمعادلات
// ──────────────────────────────────────────────────────────────────────────
// دوال نقيّة (بلا DOM ولا Firebase) ليمكن اختبارها آلياً (tests/calc.test.mjs)
// ويستوردها app.js فيُختبَر نفس الكود المُستخدَم في الإنتاج — لا نسخة موازية.
// أي تغيير في معادلة مالية يجب أن يمرّ عبر هذه الوحدة واختباراتها.
// ══════════════════════════════════════════════════════════════════════════

/** تقريب لمنزلتين عشريتين (نمط النظام: Math.round(n*100)/100) */
export function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/**
 * حساب مبالغ المستخلص (Progress Billing / IPC).
 * ⚠️ [إصلاح ازدواج الخصم] لا يُخصم advanceAmount من صافي المستخلص:
 *   الدفعة المقدمة تُقبض مرة واحدة عند التوقيع (التزام/دفعة عميل مستقلة)،
 *   وتُسترَدّ تدريجياً عبر advRecovery المخصوم من كل مستخلص فقط.
 * @returns { beforeVAT, vatAmount, totalAfterVAT, retentionAmount, advanceAmount, advRecoveryAmount, netAmount }
 */
export function calcBillingTotals({ currentAmount, retentionPct, advancePct, advRecoveryPct, otherDeductions, vatPct }) {
    const subtotal = (currentAmount || 0);
    const advanceAmount = subtotal * ((advancePct || 0) / 100);
    const vatAmount = subtotal * ((vatPct || 0) / 100);
    const totalAfterVAT = subtotal + vatAmount;
    const retentionAmount = subtotal * ((retentionPct || 0) / 100);
    const advRecoveryAmount = subtotal * ((advRecoveryPct || 0) / 100);
    const netAmount = totalAfterVAT - retentionAmount - (otherDeductions || 0) - advRecoveryAmount;
    return { retentionAmount, advanceAmount, advRecoveryAmount, beforeVAT: subtotal, vatAmount, netAmount, totalAfterVAT };
}

/**
 * حساب ضريبة القيمة المضافة من مبلغ.
 * inclusive=true: المبلغ شامل الضريبة (نستخرج الصافي)؛ false: المبلغ صافٍ (نضيف الضريبة).
 * @returns { net, vat, gross }
 */
export function vatFromAmount(amount, ratePct, inclusive = false) {
    const amt = Number(amount) || 0, rate = Number(ratePct) || 0;
    let net, vat;
    if (inclusive) { net = round2(amt / (1 + rate / 100)); vat = round2(amt - net); }
    else { net = amt; vat = round2(amt * rate / 100); }
    return { net, vat, gross: round2(net + vat) };
}

/**
 * صافي شهادة دفع مقاول الباطن: قيمة الفترة − محتجز − استرداد الدفعة − أخرى.
 * @returns { retentionAmt, advanceRecovery, netPayable }
 */
export function calcSubcontractCert({ periodValue, retentionPct, advRecoveryPct, otherDeductions }) {
    const val = Number(periodValue) || 0;
    const retentionAmt = round2(val * ((retentionPct || 0) / 100));
    const advanceRecovery = round2(val * ((advRecoveryPct || 0) / 100));
    const netPayable = round2(val - retentionAmt - advanceRecovery - (Number(otherDeductions) || 0));
    return { retentionAmt, advanceRecovery, netPayable };
}

/** نسبة الربح الإجمالي (%) = (الإيراد − التكلفة) ÷ الإيراد × 100 */
export function grossMargin(revenue, cost) {
    const r = Number(revenue) || 0, c = Number(cost) || 0;
    if (r === 0) return 0;
    return round2(((r - c) / r) * 100);
}

// اجعل الدوال متاحة أيضاً للملفات الكلاسيكية (accounting.js …) عبر window
if (typeof window !== 'undefined') {
    window.GBRCalc = { round2, calcBillingTotals, vatFromAmount, calcSubcontractCert, grossMargin };
}
