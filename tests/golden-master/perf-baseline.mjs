// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · خط أساس الأداء — لا اختبار نجاح/فشل، تقرير أرقام   [Phase 5]  ║
// ║  التشغيل:  npm run gm:perf                                                    ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 لا يمسّ أي إنتاج. بيانات مُصنَّعة بالكامل، مولَّدة برمجياً في الذاكرة.         ║
// ║  الهدف: رقم مرجعي يُقارَن به أي تحسين لاحق (§22) — لا تحسين الآن.               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureBalanceFn, buildBalancesWorld } from './capture-balances.mjs';

/** يبني N قيد متوازن على حسابين ثابتين — كافٍ لقياس تكلفة المرور لا واقعية التوزيع. */
function genJournalEntries(n) {
    const je = {};
    for (let i = 0; i < n; i++) {
        const amt = 10 + (i % 500);
        je['j' + i] = {
            number: 'JV-' + i, date: `2026-${String(1 + (i % 12)).padStart(2, '0')}-15`, status: 'posted',
            totalDebit: amt, totalCredit: amt,
            lines: [{ accountCode: '5110', debit: amt, credit: 0 }, { accountCode: '1120', debit: 0, credit: amt }]
        };
    }
    return je;
}

const ACCOUNTS = {
    a1120: { code: '1120', nameAr: 'البنك', type: 'asset', nature: 'debit', openingBalance: 100000 },
    a5110: { code: '5110', nameAr: 'مصروفات', type: 'expense', nature: 'debit' }
};

// ⚠️ [منهجية] `new Function(...)` تُحلَّل وتُترجَم في كل بناء عالم جديد — عند
// N صغيرة/متوسطة (≤10,000) هذه التكلفة تطغى على حلقة الدالة نفسها، فقياس
// "استدعاء واحد شامل البناء" يعكس تكلفة V8 لا خوارزمية النظام. الحلّ: نبني
// العالم **مرّة واحدة** لكل حجم، ثم نستدعي الدالة المُصرَّفة نفسها عدّة مرّات
// ونقيس متوسط زمن التنفيذ الصرف وحده — وهذا ما يعكس فعلياً تكلفة حلقة JS
// نفسها التي ستُشغَّل في متصفح المستخدم (حيث لا تكلفة تجميع أصلاً).
async function timeSteadyState(label, buildOnce, callFn, iterations = 20) {
    const { globals } = buildOnce();
    // إحماء واحدة (JIT) خارج القياس
    await callFn(globals);
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) await callFn(globals);
    const totalMs = performance.now() - t0;
    const perCall = totalMs / iterations;
    console.log(`  ${label.padEnd(34)} ${perCall.toFixed(3).padStart(10)} ms/استدعاء   (متوسط ${iterations} استدعاءً بعد إحماء)`);
    return { label, perCall };
}

console.log('\n⏱️  خط أساس الأداء — دوال الأرصدة على بيانات مُصنَّعة\n');
console.log('  القياس: زمن التنفيذ الصرف فقط (بعد إحماء JIT، بلا تكلفة تجميع new Function).\n');

const rows = [];
for (const n of [100, 1000, 10000]) {
    console.log(`  ── ${n.toLocaleString('en')} قيد ──`);
    const journalEntries = genJournalEntries(n);
    const state = { chartOfAccounts: ACCOUNTS, journalEntries, tbState: { fromDate: '', toDate: '', includeStatuses: ['posted'], showZero: false, groupBy: 'type', costCenter: '', projectId: '' } };

    rows.push(await timeSteadyState(`tbCalcBalances(${n})`,
        () => buildBalancesWorld(state), g => g.tbCalcBalances()));
    // ⚠️ calcFSBalances تُخزِّن نتيجتها مؤقّتاً بمفتاح مركَّب من المعاملات (`_fsBalancesCache`) —
    // استدعاؤها بنفس المعاملات مرّاراً على نفس globals يضرب الكاش من الاستدعاء الثاني، فيقيس
    // "تكلفة قراءة Map" لا "تكلفة الحساب". لقياس التكلفة الحقيقية غير المخزَّنة، نُغيّر toDate
    // في كل استدعاء (يوم مختلف ⇒ مفتاح كاش مختلف ⇒ إجبار إعادة الحساب دائماً).
    rows.push(await timeSteadyState(`calcFSBalances(${n}, غير مخزَّن)`,
        () => buildBalancesWorld(state),
        (() => { let d = 0; return g => g.calcFSBalances('', `2026-12-${String(1 + (d++ % 28)).padStart(2, '0')}`, ['posted']); })()));
    rows.push(await timeSteadyState(`coaAccountOps('5110', ${n})`,
        () => buildBalancesWorld(state), g => g.coaAccountOps('5110', '', '', false)));
    console.log('');
}

console.log('═'.repeat(66));
console.log('\n⚠️  أرقام مرجعية لا اختبار نجاح/فشل. لا تحسين في Phase 5 (§22).');
console.log('    كل الدوال متزامنة تماماً (لا قراءة شبكة) — نفس حلقات JS التي تُنفَّذ في متصفح المستخدم.');
