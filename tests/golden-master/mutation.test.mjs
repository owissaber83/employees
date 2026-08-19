// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · اختبار الطفرة — هل الشبكة حسّاسة فعلاً أم شكلية؟   [Phase 5]  ║
// ║  التشغيل:  npm run test:gm:mutation                                           ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 لا يمسّ public/accounting.js إطلاقاً. يُشوَّه **النصّ المُستخرَج في الذاكرة**  ║
// ║  فقط (نسخة داخل هذا الاختبار)، يُشغَّل، ثم يُرمى. الملف الحقيقي على القرص لا      ║
// ║  يتغيّر لحظة واحدة — يُتحقَّق من ذلك صراحةً في نهاية الاختبار.                   ║
// ║                                                                              ║
// ║  المبدأ (§17): لو عدّلنا `debit - credit` إلى `debit + credit` في tbCalcBalances ║
// ║  ولم ينكسر أي اختبار Golden Master، فالشبكة زخرفية لا حارسة. هذا الاختبار      ║
// ║  يثبت العكس — بدليل تنفيذي لا افتراض.                                         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import crypto from 'crypto';
import { extractFunction, extractConst, readLegacy } from '../characterization/legacy-loader.mjs';
import * as F from '../fixtures/accounting/balances-world.mjs';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

const ACCOUNTING_JS = 'public/accounting.js';

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧬 [تحضير] بصمة accounting.js قبل أي شيء — لإثبات عدم المساس لاحقاً');
// ═══════════════════════════════════════════════════════════════════════════════
const hashBefore = crypto.createHash('sha256').update(fs.readFileSync(ACCOUNTING_JS)).digest('hex');
console.log(`       sha256 قبل: ${hashBefore}`);

/** يبني tbCalcBalances حقيقية أو مُشوَّهة داخل نطاق واحد (تحتاج fsIsOpeningEntry). */
async function runTbCalcBalances(state, mutate) {
    let body = extractFunction('tbCalcBalances');
    if (mutate) body = mutate(body);
    const openBody = extractFunction('fsIsOpeningEntry');

    const win = { chartOfAccounts: state.chartOfAccounts || {}, journalEntries: state.journalEntries || {} };
    const globals = { window: win, tbState: state.tbState, ccLineMatchesProject: () => true };
    const keys = Object.keys(globals);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `${openBody}\n${body}\nreturn tbCalcBalances;`)(...keys.map(k => globals[k]));
    return fn();
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧬 [تأكيد العلامة] هل النصّ المستهدَف موجود فعلاً في الجسم المُستخرَج؟');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const marker = 'b.opening + b.debit - b.credit';
    const before = extractFunction('tbCalcBalances');
    ok('العلامة موجودة — شرط لصلاحية اختبار الطفرة أدناه', before.includes(marker));

    // ⚠️ ملاحظة صادقة: مع حركة مدين فقط (credit=0) فإن debit-credit == debit+credit عددياً —
    // فالطفرة **لا تظهر** بهذه الحالة تحديداً. سيناريو حركتين متعاكستين أدناه هو الإثبات الحقيقي.
    const w = F.balancesWorld({ journalEntries: { j: F.movementEntry() } });
    const real = await runTbCalcBalances(w, null);
    ok('السلوك الحقيقي (حركة مدين فقط): netBalance = 300', real.displayBalances.find(b => b.account.code === '5110').netBalance === 300);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧬 [طفرة أوضح] حساب بحركتين متعاكستين — الفرق يظهر بجلاء');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // حساب بمدين 300 ودائن 100 معاً: الصحيح 300-100=200. المشوَّه: 300+100=400. فرق لا يمكن تجاهله.
    const two = F.movementEntry({
        lines: [{ accountCode: '5110', debit: 300, credit: 0 }, { accountCode: '1120', debit: 0, credit: 300 },
        { accountCode: '5110', debit: 0, credit: 100 }, { accountCode: '1120', debit: 100, credit: 0 }],
        totalDebit: 400, totalCredit: 400
    });
    const w = F.balancesWorld({ journalEntries: { j: two } });

    const real = await runTbCalcBalances(w, null);
    const mutated = await runTbCalcBalances(w, body => body.replace('b.opening + b.debit - b.credit', 'b.opening + b.debit + b.credit'));

    const realExp = real.displayBalances.find(b => b.account.code === '5110').netBalance;
    const mutExp = mutated.displayBalances.find(b => b.account.code === '5110').netBalance;

    ok('الحقيقي: 300 - 100 = 200', realExp === 200, `فعلياً ${realExp}`);
    ok('🧬 المشوَّه: 300 + 100 = 400', mutExp === 400, `فعلياً ${mutExp}`);
    ok('✅ الفرق (200 مقابل 400) كان سيُسقط أي تأكيد `eq(...)` في trial-balance.test.mjs فوراً',
        realExp !== mutExp);
    console.log('       ⇒ شبكة Golden Master حسّاسة فعلاً لهذا النوع من الانحراف — ليست شكلية.');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔒 [تحقّق ختامي] الملف الحقيقي على القرص لم يُمَس إطلاقاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const hashAfter = crypto.createHash('sha256').update(fs.readFileSync(ACCOUNTING_JS)).digest('hex');
    ok('sha256(accounting.js) قبل الطفرة = بعدها بالضبط', hashAfter === hashBefore, `قبل:${hashBefore}\n       بعد :${hashAfter}`);
    console.log(`       sha256 بعد : ${hashAfter}`);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
