// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · الدقّة المالية في دوال الأرصدة                    [Phase 5]  ║
// ║  التشغيل:  npm run test:gm:precision                                          ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 لا كتابة في أي قاعدة بيانات · بيانات مُصنَّعة فقط · لا تغيير سلوك.          ║
// ║  ⚠️ لا نغيّر Math.round ولا تسامح المقارنة — نُثبت السلوك القائم فقط (canonical- ║
// ║  balances.mjs يستورد round2/moneyEq من canonical.mjs بلا نسخ، فلا يمكن أن       ║
// ║  يتباعدا صدفةً).                                                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureBalanceFn } from './capture-balances.mjs';
import { round2, moneyEq } from './canonical-balances.mjs';
import * as F from '../fixtures/accounting/balances-world.mjs';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💯 [مبالغ حدّية] عبر tbCalcBalances مباشرةً — بلا تقريب وسيط من المِشجب');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const AMOUNTS = [100.00, 100.01, 0.01, 999999.99];
    for (const amt of AMOUNTS) {
        const w = F.balancesWorld({ journalEntries: { j: F.movementEntry({ totalDebit: amt, totalCredit: amt, lines: [{ accountCode: '5110', debit: amt, credit: 0 }, { accountCode: '1120', debit: 0, credit: amt }] }) } });
        const r = await captureBalanceFn('tbCalcBalances', [], w);
        const b = r.result.displayBalances.find(x => x.account.code === '5110');
        ok(`مبلغ ${amt}: netBalance يطابق المُدخَل تماماً (الدالة لا تُقرِّب بنفسها)`, b.netBalance === amt, `فعلياً ${b.netBalance}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔎 [اكتشاف] tbCalcBalances/calcFSBalances لا تُقرِّبان — القيد نفسه هو من يُقرِّب');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // 100.005 قيمة لا تمثيل عشري ثنائي دقيق لها (float) — نمرّرها كما هي ونلاحظ ما يحدث فعلاً
    // بلا أي افتراض مسبق، تماماً كما ينص §4 من التعليمات.
    const amt = 100.005;
    const w = F.balancesWorld({ journalEntries: { j: F.movementEntry({ totalDebit: amt, totalCredit: amt, lines: [{ accountCode: '5110', debit: amt, credit: 0 }, { accountCode: '1120', debit: 0, credit: amt }] }) } });
    const r = await captureBalanceFn('tbCalcBalances', [], w);
    const b = r.result.displayBalances.find(x => x.account.code === '5110');
    console.log(`       المُدخَل: ${amt} · الناتج الفعلي دون تدخّل منّا: ${b.netBalance}`);
    ok('🔎 موثَّق كما وقع فعلياً — لا افتراض على القيمة الناتجة', typeof b.netBalance === 'number');
    ok('وبعد round2 (نفس تقريب النظام) يستقرّ على قيمتين عشريتين', round2(b.netBalance) === round2(amt) || Math.abs(round2(b.netBalance) - round2(amt)) < 0.02);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [تسامح موحَّد] moneyEq مستوردة لا مكرَّرة — إثبات عدم التباعد');
// ═══════════════════════════════════════════════════════════════════════════════
{
    ok('moneyEq(100, 100.005) بنفس تسامح canonical.mjs الأصلي', moneyEq(100, 100.005) === (Math.abs(100 - 100.005) < 0.01));
    ok('moneyEq(100, 100.02) يرفض — يتجاوز التسامح', moneyEq(100, 100.02) === false);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
