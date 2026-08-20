// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تحويل سطور القيد إلى العملة الأساسية — نقيّة                       [Phase 7-E] ║
// ║  مطابقة حرفية لـ`jrnConvertLinesToBase` (accounting.js:5598).                  ║
// ║                                                                              ║
// ║  🔎 السلوك المرصود الذي يجب ألّا يُبسَّط:                                        ║
// ║   • المبالغ الأصلية تُحفظ في `fcDebit`/`fcCredit` قبل التحويل.                   ║
// ║   • فرق التقريب يُصحَّح **فقط** إن كان `> 0.001` و`≤ 1` — وإلا يُترك كما هو.      ║
// ║   • التصحيح يقع على **أكبر سطر** في الجانب المخالف (طرح من المدين الأكبر أو      ║
// ║     إضافة إلى الدائن الأكبر) — لا على أول سطر ولا موزَّعاً.                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/**
 * @param {Array<object>} lines
 * @param {number} rate
 * @returns {Array<object>}
 */
export function convertLinesToBase(lines, rate) {
    const out = (lines || []).map(l => {
        const fcD = parseFloat(l.debit) || 0, fcC = parseFloat(l.credit) || 0;
        return {
            ...l, fcDebit: fcD, fcCredit: fcC,
            debit: Math.round(fcD * rate * 100) / 100,
            credit: Math.round(fcC * rate * 100) / 100
        };
    });
    let sd = 0, sc = 0;
    out.forEach(l => { sd += l.debit; sc += l.credit; });
    const resid = Math.round((sd - sc) * 100) / 100;
    if (Math.abs(resid) > 0.001 && Math.abs(resid) <= 1) {
        if (resid > 0) {
            let idx = -1, mx = -1;
            out.forEach((l, i) => { if (l.debit > mx) { mx = l.debit; idx = i; } });
            if (idx >= 0) out[idx].debit = Math.round((out[idx].debit - resid) * 100) / 100;
        } else {
            let idx = -1, mx = -1;
            out.forEach((l, i) => { if (l.credit > mx) { mx = l.credit; idx = i; } });
            if (idx >= 0) out[idx].credit = Math.round((out[idx].credit + resid) * 100) / 100;
        }
    }
    return out;
}
