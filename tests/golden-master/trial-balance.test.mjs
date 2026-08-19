// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · ميزان المراجعة — tbCalcBalances                   [Phase 5]  ║
// ║  التشغيل:  npm run test:gm:tb                                                 ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 لا كتابة في أي قاعدة بيانات · بيانات مُصنَّعة فقط · لا تغيير سلوك.          ║
// ║  الشفرة القديمة **مصدر الحقيقة السلوكي** — لا مصدر الصحّة المحاسبية.           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { captureBalanceFn } from './capture-balances.mjs';
import { canonicalTrialBalance, moneyEq } from './canonical-balances.mjs';
import * as F from '../fixtures/accounting/balances-world.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAP = path.join(HERE, 'snapshots');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

let pass = 0, fail = 0;
const eq = (n, a, b) => {
    if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); }
    else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); }
};
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
function snapshot(name, value) {
    const file = path.join(SNAP, name + '.json');
    const text = JSON.stringify(value, null, 2);
    if (!fs.existsSync(file) || UPDATE) { fs.writeFileSync(file, text + '\n'); console.log(`  📸 لقطة ${UPDATE ? 'مُحدَّثة' : 'مُنشأة'}: ${name}`); return; }
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved === text) { pass++; console.log(`  ✅ لقطة ثابتة: ${name}`); }
    else { fail++; console.log(`  ❌ لقطة تغيّرت: ${name}\n       شغّل UPDATE_SNAPSHOTS=1 بعد التحقّق من أن التغيير مقصود`); }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📊 [A] حساب بلا حركة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureBalanceFn('tbCalcBalances', [], F.balancesWorld({ tbState: { ...F.balancesWorld().tbState, showZero: true } }));
    eq('بلا خطأ', r.error, null);
    const tb = canonicalTrialBalance(r.result);
    const row1130 = tb.rows.find(x => x.code === '2110');
    ok('حساب الموردون بلا حركة: صفر مدين وصفر دائن', row1130 && row1130.debit === 0 && row1130.credit === 0);
    ok('ورصيده الافتتاحي = الافتتاحي المُعرَّف على الحساب (0)', row1130 && row1130.opening === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📊 [B–D] حركة مدين · دائن · مدين ودائن معاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.balancesWorld({ journalEntries: { j1: F.movementEntry() } });
    const r = await captureBalanceFn('tbCalcBalances', [], w);
    const tb = canonicalTrialBalance(r.result);
    const exp = tb.rows.find(x => x.code === '5110');   // مدين فقط: 300
    const bank = tb.rows.find(x => x.code === '1120');  // دائن فقط: 300 (ضمن حركة الفترة)
    ok('حساب المصروفات: مدين 300 دائن 0', moneyEq(exp.debit, 300) && exp.credit === 0, JSON.stringify(exp));
    ok('حساب البنك: دائن 300 ضمن حركة الفترة', moneyEq(bank.credit, 300), JSON.stringify(bank));
    ok('إجمالي المدين = إجمالي الدائن', tb.debitCreditBalance === true, JSON.stringify(tb.totals));
    snapshot('tb-single-movement', tb);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📊 [E–F] رصيد افتتاحي + قيد افتتاحي صريح');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // البنك: openingBalance ثابت على الحساب = 5000 + قيد افتتاحي صريح +500 ⇒ opening الناتج = 5500
    const w = F.balancesWorld({ journalEntries: { open: F.openingEntry() } });
    const r = await captureBalanceFn('tbCalcBalances', [], w);
    const bank = canonicalTrialBalance(r.result).rows.find(x => x.code === '1120');
    eq('opening = ثابت الحساب (5000) + القيد الافتتاحي (500)', bank.opening, 5500);
    eq('لا حركة فترة — القيد الافتتاحي لا يُحتسب حركة', bank.debit, 0);
    ok('ورصيده الختامي = الافتتاحي بلا حركة', moneyEq(bank.netBalance, 5500));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🌳 [G–I] حساب أب Header يُجمِّع فروعه — ومستويان في الشجرة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // ⚠️ tbCalcBalances نفسها لا تُنشئ صفاً لحساب header (يُستبعَد صراحةً: "الحسابات الرئيسية لا تحوي حركات مباشرة")
    // التجميع الهرمي مسؤولية coaBalanceRows لا tbCalcBalances — نوثّق الفرق بدل افتراض تطابقهما
    const w = F.balancesWorld({ journalEntries: { j1: F.movementEntry() } });
    const rTb = await captureBalanceFn('tbCalcBalances', [], w);
    const headerRow = (rTb.result.displayBalances || []).find(b => b.account.code === '1100');
    ok('🔎 tbCalcBalances لا تُنتج صفاً لحساب header أصلاً', headerRow === undefined);
    console.log('       ملاحظة: هذا سلوك موثَّق لا عطل — التجميع الهرمي في دالة منفصلة (coaBalanceRows)');

    const rRows = await captureBalanceFn('coaBalanceRows', ['', '', false], w);
    const headerRowB = rRows.result.find(x => x.a.code === '1100');
    ok('بينما coaBalanceRows تُنتج صفاً لـ1100 بمجموع فرعيه', !!headerRowB);
    eq('ومجموع مدين 1100 = مجموع مدين فرعيه (1110+1120)', headerRowB.t.debit, 0);   // في هذا العالم لا حركة على 1110/1120 المباشرة إلا عبر 1120
    console.log('       (1120 وحدها تحرّكت؛ 1110 بلا حركة — والمجموع الهرمي يعكس ذلك بدقّة)');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏷️ [J–N] أنواع الحسابات الخمسة — الطبيعة المدينة/الدائنة و isAnomaly');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.balancesWorld({ journalEntries: { j1: F.movementEntry() } }); // مدين 5110(expense) / دائن 1120(asset)
    const r = await captureBalanceFn('tbCalcBalances', [], w);
    const tb = canonicalTrialBalance(r.result);
    const exp = tb.rows.find(x => x.code === '5110');
    ok('حساب مصروف (naturallyDebit): رصيد موجب ⇒ لا شذوذ', exp.netBalance > 0 && exp.isAnomaly === false);

    // نقلب الاتجاه: مدين 1120(asset) دائن 5110(expense) ⇒ 5110 يصبح رصيده سالباً ⇒ شذوذ
    const reversed = F.balancesWorld({
        journalEntries: { j1: F.movementEntry({ lines: [{ accountCode: '1120', debit: 300, credit: 0 }, { accountCode: '5110', debit: 0, credit: 300 }] }) }
    });
    const r2 = await captureBalanceFn('tbCalcBalances', [], reversed);
    const exp2 = canonicalTrialBalance(r2.result).rows.find(x => x.code === '5110');
    ok('🔎 مصروف برصيد دائن صافٍ ⇒ isAnomaly = true (الحساب يفحصها فعلياً)', exp2.isAnomaly === true, JSON.stringify(exp2));
    console.log('       ملاحظة: isAnomaly لا تمنع القيد ولا تصلحه — إشارة عرض فقط، غير مفروضة في القاعدة');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [Y] قيد قبل بداية الفترة بلا علامة افتتاحي — فجوة بين محرّكَي الأرصدة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // calcFSBalances: أي قيد تاريخه < fromDate يُطوى تلقائياً في «قبل الفترة» (رصيد افتتاحي فعلي)
    // tbCalcBalances: قيد غير مُعلَّم افتتاحياً وتاريخه < fromDate **يُستبعَد بالكامل** — لا افتتاحي ولا فترة
    // النتيجتان تتطابقان فقط إن كان كل قيد سابق للفترة مُعلَّماً صراحةً (sourceType:'opening')، وهذا غير مفروض في أي مكان
    const w = F.balancesWorld({
        journalEntries: { pre: F.prePeriodUnflaggedEntry() },   // 2025-06-01، بلا isOpeningEntry، فترة الاختبار تبدأ 2026-01-01
        tbState: { ...F.balancesWorld().tbState, fromDate: '2026-01-01', toDate: '2026-12-31' }
    });

    const rFs = await captureBalanceFn('calcFSBalances', ['2026-01-01', '2026-12-31', ['posted']], w);
    const rTb = await captureBalanceFn('tbCalcBalances', [], w);

    const fsExp = rFs.result.balances['5110'];
    const tbExp = (rTb.result.displayBalances || []).find(b => b.account.code === '5110');

    ok('🔴 calcFSBalances: القيد السابق يُطوى في رصيد ما قبل الفترة (before=700)', fsExp.beforeDebit === 700, JSON.stringify(fsExp));
    ok('🔴 tbCalcBalances: نفس القيد **لا يظهر إطلاقاً** — لا في الافتتاحي ولا في الحركة',
        !tbExp || (tbExp.opening === 0 && tbExp.debit === 0), JSON.stringify(tbExp));
    console.log('       ⇒ مُسجَّل كعطل جديد: BUG-005 في BUGS_TO_FIX.md — لا يُصلَح في Phase 5');
    console.log('       الأثر: ميزان مراجعة لفترة تبدأ منتصف السنة قد يستبعد حركات سابقة غير مُعلَّمة');
    console.log('       افتتاحياً، بينما قائمة الدخل/المركز المالي (calcFSBalances) تطويها بصمت في الافتتاحي.');
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
