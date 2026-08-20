// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · القيد اليدوي — القديم مقابل الجديد                [Phase 7-E] ║
// ║  يقارن `jrnBuildFinalLines` و`jrnConvertLinesToBase` الحقيقيتين بالوحدات        ║
// ║  النقيّة المستخلَصة. 🔒 لا كتابة في أي قاعدة بيانات.                            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { capturePM, canonicalLines } from './capture-project-manual.mjs';
import { buildJournalLines } from '../../src/domain/accounting/manual-journal/buildJournalLines.js';
import { convertLinesToBase } from '../../src/domain/accounting/manual-journal/convertLinesToBase.js';
import { buildManualJournal, jrnBookByCode } from '../../src/domain/accounting/manual-journal/buildManualJournal.js';
import {
    selectUserLines, assertMinimumLines, assertBalancedForPosting, assertAccountsUsable
} from '../../src/domain/accounting/manual-journal/validateManualJournal.js';
import { assertBalanced } from '../../src/domain/accounting/posting/assertBalanced.js';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const eq = (n, a, b) => ok(n, JSON.stringify(a) === JSON.stringify(b), `متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`);

const COA = {
    a1: { code: '1110', nameAr: 'الصندوق' }, a2: { code: '5110', nameAr: 'مشتريات' },
    a3: { code: '2140', nameAr: 'ضريبة المخرجات' }, a4: { code: '1180', nameAr: 'ضريبة المدخلات' },
    a5: { code: '4100', nameAr: 'إيرادات' }, hdr: { code: '5000', nameAr: 'مصروفات', nature: 'header' }
};
const PROJECTS = { P1: { name: 'مشروع أ' }, P2: { name: 'مشروع ب' } };
const CENTERS = { CC1: { name: 'مركز 1' } };

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  Golden Master — القيد اليدوي · Phase 7 Step E            ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// ── [1] توسيع السطور: jrnBuildFinalLines مقابل buildJournalLines ────────────
console.log('\n[1] توسيع السطور — القديم مقابل الجديد');
async function compareBuild(name, userLines) {
    const state = { chartOfAccounts: COA, projects: PROJECTS, costCenters: CENTERS };
    const legacy = await capturePM('jrnBuildFinalLines', 'jrnBuildFinalLines', [userLines], state);
    if (legacy.error) return ok(name, false, `القديم رمى: ${legacy.error.message}`);
    let n = 0;
    const next = buildJournalLines({
        userLines, projects: PROJECTS, costCenters: CENTERS, chartOfAccounts: COA,
        newGroupId: () => `ag${++n}`
    });
    eq(name, canonicalLines(next), canonicalLines(legacy.result));
}

await compareBuild('1 · سطران بسيطان بلا ضريبة ولا توزيع', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, description: 'شراء' },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1000 }
]);
await compareBuild('2 · سطر خاضع للضريبة (مدين ⇒ مدخلات)', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, taxable: true, vatRate: 15, description: 'شراء' },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1150 }
]);
await compareBuild('3 · سطر دائن خاضع (⇒ مخرجات)', [
    { accountCode: '1110', accountName: 'الصندوق', debit: 1150, credit: 0 },
    { accountCode: '4100', accountName: 'إيرادات', debit: 0, credit: 1000, taxable: true, vatRate: 15 }
]);
await compareBuild('4 · توزيع تحليلي 50/50 على مشروعين', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, analytic: [{ target: 'P1', pct: 50 }, { target: 'P2', pct: 50 }] },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1000 }
]);
await compareBuild('5 · توزيع بكسور (33/33/34) — فرق التقريب لأكبر حصّة', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, analytic: [{ target: 'P1', pct: 33 }, { target: 'P2', pct: 33 }, { target: 'CC1', pct: 34 }] },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1000 }
]);
await compareBuild('6 · توزيع على مركز تكلفة لا مشروع', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 500, credit: 0, analytic: [{ target: 'CC1', pct: 100 }] },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 500 }
]);
await compareBuild('7 · توزيع + ضريبة معاً', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, taxable: true, vatRate: 15, analytic: [{ target: 'P1', pct: 60 }, { target: 'P2', pct: 40 }] },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1150 }
]);
await compareBuild('8 · نسب توزيع مجموعها < 100', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, analytic: [{ target: 'P1', pct: 30 }] },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1000 }
]);
await compareBuild('9 · توزيع بنسبة صفر يُتجاهَل', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, analytic: [{ target: 'P1', pct: 0 }, { target: 'P2', pct: 100 }] },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1000 }
]);
await compareBuild('10 · ضريبة بنسبة صفر ⇒ لا سطر ضريبة', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, taxable: true, vatRate: 0 },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1000 }
]);
await compareBuild('11 · هدف توزيع غير معروف (لا مشروع ولا مركز)', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, analytic: [{ target: 'GHOST', pct: 100 }] },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1000 }
]);
await compareBuild('12 · سطور متعدّدة خاضعة معاً', [
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, taxable: true, vatRate: 15 },
    { accountCode: '5110', accountName: 'مشتريات', debit: 500, credit: 0, taxable: true, vatRate: 5 },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1675 }
]);
await compareBuild('13 · قائمة فارغة', []);

// ── [2] تحويل العملة: jrnConvertLinesToBase ────────────────────────────────
console.log('\n[2] تحويل العملة — القديم مقابل الجديد');
async function compareConvert(name, lines, rate) {
    const legacy = await capturePM('jrnConvertLinesToBase', 'jrnConvertLinesToBase', [lines, rate], { chartOfAccounts: COA });
    const next = convertLinesToBase(lines, rate);
    eq(name, canonicalLines(next), canonicalLines(legacy.result));
}
await compareConvert('14 · سعر 3.75 متوازن', [
    { accountCode: '5110', debit: 100, credit: 0 }, { accountCode: '1110', debit: 0, credit: 100 }
], 3.75);
await compareConvert('15 · سعر كسري يُحدث فرق تقريب', [
    { accountCode: '5110', debit: 33.33, credit: 0 }, { accountCode: '5110', debit: 33.33, credit: 0 },
    { accountCode: '1110', debit: 0, credit: 66.66 }
], 3.7512);
await compareConvert('16 · فرق أكبر من 1 لا يُصحَّح', [
    { accountCode: '5110', debit: 1000, credit: 0 }, { accountCode: '1110', debit: 0, credit: 900 }
], 3.75);
await compareConvert('17 · سعر 1', [
    { accountCode: '5110', debit: 10.005, credit: 0 }, { accountCode: '1110', debit: 0, credit: 10.005 }
], 1);
await compareConvert('18 · جانب دائن أكبر (التصحيح على الدائن)', [
    { accountCode: '5110', debit: 66.67, credit: 0 },
    { accountCode: '1110', debit: 0, credit: 33.33 }, { accountCode: '1110', debit: 0, credit: 33.34 }
], 3.3333);

// ── [3] بناء سجل القيد + الحراسات ──────────────────────────────────────────
console.log('\n[3] بناء السجل والحراسات');
{
    const lines = [
        { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, description: 'شراء' },
        { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1000 }
    ];
    const { journal } = buildManualJournal({
        storeLines: lines, header: { date: '2026-05-15', reference: 'R1', description: 'قيد', notes: 'ملاحظة', book: 'GEN' },
        currency: 'SAR', exchangeRate: 1, baseCurrency: 'SAR', status: 'posted',
        journalNumber: 'JV-1', now: '2026-05-15T00:00:00.000Z', userId: 'u1'
    });
    eq('19 · period مشتقّ من التاريخ', journal.period, '2026-05');
    eq('20 · المجاميع محسوبة من السطور', [journal.totalDebit, journal.totalCredit], [1000, 1000]);
    ok('21 · لا fcDebit عند العملة الأساسية', !('fcDebit' in journal.lines[0]));
    assertBalanced(journal);
    ok('22 · يجتاز assertBalanced', true);
    eq('23 · journalBook', journal.journalBook, 'GEN');
}
{
    const { journal } = buildManualJournal({
        storeLines: [{ accountCode: '5110', debit: 375, credit: 0, fcDebit: 100, fcCredit: 0 },
                     { accountCode: '1110', debit: 0, credit: 375, fcDebit: 0, fcCredit: 100 }],
        header: { date: '2026-05-15', description: 'قيد' },
        currency: 'USD', exchangeRate: 3.75, baseCurrency: 'SAR', status: 'posted',
        journalNumber: 'JV-1', now: 'N', userId: 'u1'
    });
    ok('24 · fcDebit/fcCredit تُكتب عند العملة الأجنبية', journal.lines[0].fcDebit === 100 && journal.lines[1].fcCredit === 100);
}
{
    const lines = [{ accountCode: '5110', debit: 100, credit: 0 }, { _taxAuto: true, accountCode: '1180', debit: 15, credit: 0 }];
    eq('25 · selectUserLines تستبعد سطور الضريبة التلقائية', selectUserLines(lines).length, 1);
    let threw = null; try { assertMinimumLines(selectUserLines(lines)); } catch (e) { threw = e; }
    ok('26 · وسطر واحد يُرفض (يجب سطران)', threw && threw.name === 'ValidationError');
}
{
    let threw = null;
    try { assertBalancedForPosting([{ debit: 100, credit: 0 }, { debit: 0, credit: 90 }], 'posted'); } catch (e) { threw = e; }
    ok('27 · ترحيل قيد غير متوازن يُرفض', threw && threw.name === 'ValidationError');
    threw = null;
    try { assertBalancedForPosting([{ debit: 100, credit: 0 }, { debit: 0, credit: 90 }], 'draft'); } catch (e) { threw = e; }
    ok('28 · لكن المسوّدة غير المتوازنة مسموحة (سلوك القديم محفوظ)', threw === null);
}
{
    let threw = null;
    try { assertAccountsUsable([{ accountCode: '5000' }], COA); } catch (e) { threw = e; }
    ok('29 · الحساب الرئيسي يُرفض', threw && threw.name === 'ValidationError' && /رئيسي/.test(threw.message));
    threw = null;
    try { assertAccountsUsable([{ accountCode: '9999' }], COA); } catch (e) { threw = e; }
    ok('30 · الحساب غير الموجود يُرفض', threw && threw.name === 'MissingAccountError');
}
{
    eq('31 · دفتر غير معروف يرجع لـGEN/JV', jrnBookByCode('ZZZ').prefix, 'JV');
    eq('32 · دفتر المبيعات SV', jrnBookByCode('SAL').prefix, 'SV');
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
