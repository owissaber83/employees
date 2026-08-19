// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEW SAFETY INVARIANT TEST — تكامل القيد (assertBalanced/validateJournal)  [Phase 6] ║
// ║  التشغيل: npm run test:svc:integrity                                          ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §13 «Integrity»: قيد متوازن · غير متوازن · ترويسة متوازنة وسطور غير متوازنة ·   ║
// ║  قيد صفري · حساب مفقود · مبلغ غير صالح · حدّ التسامح.                          ║
// ║                                                                              ║
// ║  🔴 يُغلق مباشرةً الثغرة المُثبَتة في Phase 4 journal.test.mjs §[5]: قيد ترويسته   ║
// ║  متوازنة (1000/1000) وسطوره ليست كذلك (5000/5000 بتوزيع مختلّ) كان يجتاز حراسة   ║
// ║  RTDB. assertBalanced ترفضه هنا صراحةً — هذا ما لا تستطيعه RTDB بنيوياً.         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { makeCounters } from './testKit.mjs';
import { assertBalanced, lineTotals, moneyEq } from '../../src/domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../src/domain/accounting/posting/validateJournal.js';

const { eq, ok, summary } = makeCounters();

function baseJournal(overrides = {}) {
    return {
        lines: [
            { accountCode: '5110', debit: 1000, credit: 0 },
            { accountCode: '2110', debit: 0, credit: 1000 }
        ],
        totalDebit: 1000, totalCredit: 1000,
        ...overrides
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [قيد متوازن] يمرّ من الفحصين بلا رمي');
// ═══════════════════════════════════════════════════════════════════════════════
{
    let err = null;
    try { validateJournal(baseJournal()); assertBalanced(baseJournal()); } catch (e) { err = e; }
    ok('لا يرمي', !err, err && err.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [قيد غير متوازن] Σ مدين ≠ Σ دائن — يُرفض');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const j = baseJournal({ lines: [{ accountCode: '5110', debit: 1000, credit: 0 }, { accountCode: '2110', debit: 0, credit: 900 }] });
    let err = null;
    try { assertBalanced(j); } catch (e) { err = e; }
    ok('يرمي UnbalancedJournalError', err && err.name === 'UnbalancedJournalError', err && err.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [الثغرة المُغلَقة] ترويسة متوازنة، سطور غير متوازنة — تُرفض هنا بخلاف RTDB');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // بالضبط قيد journal.test.mjs §[5] الذي أثبت Phase 4 أن RTDB تقبله
    const forged = {
        totalDebit: 1000, totalCredit: 1000,
        lines: [{ accountCode: '5110', debit: 5000, credit: 0 }, { accountCode: '2110', debit: 0, credit: 5000 }]
    };
    const rtdbGuard = e => e.totalDebit === e.totalCredit; // ما تفحصه RTDB وحدها
    ok('🔴 حراسة RTDB وحدها كانت ستقبله (كما أثبتت Phase 4)', rtdbGuard(forged) === true);
    let err = null;
    try { assertBalanced(forged); } catch (e) { err = e; }
    ok('✅✅ assertBalanced ترفضه صراحةً — الثغرة مُغلَقة على مستوى الخدمة', err && err.name === 'UnbalancedJournalError', err && err.message);
    eq('وتفاصيل الخطأ تكشف الفرق الحقيقي', err.details, { linesDebit: 5000, linesCredit: 5000, headerDebit: 1000, headerCredit: 1000 });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [قيد صفري بالكامل] — يُرفض بنيوياً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const j = baseJournal({ lines: [{ accountCode: '5110', debit: 0, credit: 0 }, { accountCode: '2110', debit: 0, credit: 0 }], totalDebit: 0, totalCredit: 0 });
    let err = null;
    try { validateJournal(j); } catch (e) { err = e; }
    ok('يرمي ValidationError على أول سطر صفري', err && err.name === 'ValidationError', err && err.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [حساب مفقود على سطر] — رمز حساب فارغ يُرفض');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const j = baseJournal({ lines: [{ accountCode: '', debit: 1000, credit: 0 }, { accountCode: '2110', debit: 0, credit: 1000 }] });
    let err = null;
    try { validateJournal(j); } catch (e) { err = e; }
    ok('يرمي ValidationError', err && err.name === 'ValidationError' && /رمز حساب/.test(err.message));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [مبلغ غير صالح] — نص أو NaN بدل رقم');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const j = baseJournal({ lines: [{ accountCode: '5110', debit: 'ألف', credit: 0 }, { accountCode: '2110', debit: 0, credit: 1000 }] });
    let err = null;
    try { validateJournal(j); } catch (e) { err = e; }
    ok('يرمي ValidationError', err && err.name === 'ValidationError', err && err.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [سطر بمدين ودائن معاً] — يُرفض');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const j = baseJournal({ lines: [{ accountCode: '5110', debit: 500, credit: 500 }, { accountCode: '2110', debit: 0, credit: 1000 }] });
    let err = null;
    try { validateJournal(j); } catch (e) { err = e; }
    ok('يرمي ValidationError', err && err.name === 'ValidationError', err && err.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [مبلغ سالب] — يُرفض');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const j = baseJournal({ lines: [{ accountCode: '5110', debit: -100, credit: 0 }, { accountCode: '2110', debit: 0, credit: 1000 }] });
    let err = null;
    try { validateJournal(j); } catch (e) { err = e; }
    ok('يرمي ValidationError', err && err.name === 'ValidationError', err && err.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [حدّ التسامح] — 0.005 يمرّ (< 0.01)، 0.02 يُرفض (≥ 0.01)');
// ═══════════════════════════════════════════════════════════════════════════════
{
    ok('moneyEq(1000, 1000.005) داخل التسامح', moneyEq(1000, 1000.005) === true);
    ok('moneyEq(1000, 1000.02) خارج التسامح', moneyEq(1000, 1000.02) === false);

    const withinTolerance = baseJournal({ totalDebit: 1000.005, totalCredit: 1000 });
    let err1 = null; try { assertBalanced(withinTolerance); } catch (e) { err1 = e; }
    ok('قيد بفرق 0.005 في الترويسة يمرّ (ضمن التسامح 0.01)', !err1, err1 && err1.message);

    const beyondTolerance = baseJournal({ totalDebit: 1000.02, totalCredit: 1000 });
    let err2 = null; try { assertBalanced(beyondTolerance); } catch (e) { err2 = e; }
    ok('وبفرق 0.02 يُرفض', err2 && err2.name === 'UnbalancedJournalError');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚖️ [قيد بلا سطور] — يُرفض');
// ═══════════════════════════════════════════════════════════════════════════════
{
    let err = null;
    try { validateJournal({ lines: [], totalDebit: 0, totalCredit: 0 }); } catch (e) { err = e; }
    ok('يرمي ValidationError', err && err.name === 'ValidationError', err && err.message);
}

console.log(summary() ? process.exit(1) : process.exit(0));
