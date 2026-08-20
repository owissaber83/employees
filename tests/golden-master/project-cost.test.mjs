// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · تكلفة المشروع الشهرية (PMC) — القديم مقابل الجديد  [Phase 7-E] ║
// ║  🔒 لا كتابة في أي قاعدة بيانات.                                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { capturePM } from './capture-project-manual.mjs';
import { compareJournals, lineTotals, moneyEq } from './canonical.mjs';
import { buildPMCJournal } from '../../src/domain/accounting/pmc/buildPMCJournal.js';
import { getPMCCategoryInfo, PMC_CATEGORIES, pmcCategoryHasAccounts } from '../../src/domain/accounting/pmc/resolvePMCAccounts.js';
import { assertBalanced } from '../../src/domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../src/domain/accounting/posting/validateJournal.js';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const eq = (n, a, b) => ok(n, JSON.stringify(a) === JSON.stringify(b), `متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`);

const NOW = '2026-05-01T10:00:00.000Z';
const COA = {
    a5110: { code: '5110', nameAr: 'مشتريات مواد' }, a2110: { code: '2110', nameAr: 'الموردون' },
    a5210: { code: '5210', nameAr: 'أجور' }, a2130: { code: '2130', nameAr: 'رواتب مستحقة' },
    a5370: { code: '5370', nameAr: 'مصروف إهلاك' }, a1290: { code: '1290', nameAr: 'مجمع الإهلاك' },
    a1240: { code: '1240', nameAr: 'تحسينات مستأجرة' }, a5390: { code: '5390', nameAr: 'أخرى' },
    a5130: { code: '5130', nameAr: 'معدات' }, a5140: { code: '5140', nameAr: 'مقاولون' },
    a5220: { code: '5220', nameAr: 'نقل' }, a5330: { code: '5330', nameAr: 'كهرباء' }, a5320: { code: '5320', nameAr: 'إيجار' }
};
const pmc = (o = {}) => ({
    key: 'PMC-K1', projectId: 'P1', category: 'materials', amount: 5000,
    month: '2026-05', date: '2026-05-15', description: 'توريد حديد',
    reference: 'REF-1', name: 'بند أ', createdBy: 'u-test', ...o
});
const resolve = (chart, code) => Object.values(chart).find(a => a.code === code) || null;

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  Golden Master — تكلفة المشروع (PMC) · Phase 7 Step E     ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// ── [0] BUG-004 — التعريفان المكرّران ───────────────────────────────────────
console.log('\n[0] BUG-004 — التعريف المكرَّر');
{
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../public/accounting.js', import.meta.url), 'utf8');
    const positions = [];
    for (let p = src.indexOf('async function createJournalForPMC('); p !== -1;
         p = src.indexOf('async function createJournalForPMC(', p + 1)) positions.push(p);
    eq('1 · لا يزال التعريف مكرَّراً في القديم (لم يُحذَف)', positions.length, 2);
    const extractAt = i => { let j = src.indexOf('{', i), d = 0, s = null, e = false;
        for (; j < src.length; j++) { const c = src[j];
            if (e) { e = false; continue; } if (c === '\\') { e = true; continue; }
            if (s) { if (c === s) s = null; continue; }
            if (c === '"' || c === "'" || c === '`') { s = c; continue; }
            if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
        return src.slice(i, j); };
    const a = extractAt(positions[0]), b = extractAt(positions[1]);
    ok('2 · والتعريفان متطابقان بايتاً ببايت ⇒ التكرار غير ضارّ سلوكياً', a === b, `${a.length} مقابل ${b.length}`);
    ok('3 · ⇒ extractFunction (تُرجع الأولى) آمنة للتوصيف', a === b);
}

// ── [1] القيد: القديم مقابل الجديد ──────────────────────────────────────────
console.log('\n[1] القيد المحاسبي — القديم مقابل الجديد');
async function compare(name, data, chart = COA) {
    const state = { chartOfAccounts: chart, jrnNumber: 'JV-TEST-0001' };
    const legacy = await capturePM(['createJournalForPMC', 'getPMCCategoryInfo'], 'createJournalForPMC', [data], state);
    const info = getPMCCategoryInfo(data.category);
    let next = null, err = null;
    try {
        next = buildPMCJournal({
            pmc: data, categoryInfo: info,
            debitAccount: resolve(chart, info.defaultDebitAccountCode),
            creditAccount: resolve(chart, info.defaultCreditAccountCode),
            journalNumber: 'JV-TEST-0001', now: NOW
        }).journal;
    } catch (e) { err = e; }
    if (err) return ok(name, false, `الجديد رمى: ${err.name}: ${err.message}`);
    if (!legacy.journal) return ok(name, false, 'القديم لم يُنتج قيداً');
    const cmp = compareJournals(legacy.journal, next);
    ok(name, cmp.equal, cmp.diffs.map(d => `${d.field}: قديم=${JSON.stringify(d.legacy)} جديد=${JSON.stringify(d.next)}`).join('\n       '));
    if (cmp.equal) { validateJournal(next); assertBalanced(next); }
    return { legacy: legacy.journal, next };
}

for (const cat of Object.keys(PMC_CATEGORIES)) {
    await compare(`4 · نوع «${cat}»`, pmc({ category: cat }));
}
await compare('5 · بلا مشروع', pmc({ projectId: '' }));
await compare('6 · بلا وصف ⇒ وصف مُشتقّ من النوع', pmc({ description: '' }));
await compare('7 · بلا مرجع ⇒ PMC-{month}', pmc({ reference: '' }));
await compare('8 · بلا تاريخ ⇒ month-01', pmc({ date: '' }));
await compare('9 · مبلغ كسري', pmc({ amount: 1234.567 }));
await compare('10 · مبلغ نصّي', pmc({ amount: '5000' }));
await compare('11 · بلا اسم بند', pmc({ name: undefined }));

// ── [2] السطران يحملان projectId وcostCenter معاً ───────────────────────────
console.log('\n[2] خصائص القيد المميّزة');
{
    const info = getPMCCategoryInfo('materials');
    const { journal } = buildPMCJournal({
        pmc: pmc(), categoryInfo: info,
        debitAccount: resolve(COA, '5110'), creditAccount: resolve(COA, '2110'),
        journalNumber: 'JV-1', now: NOW
    });
    ok('12 · كلا السطرين يحمل projectId **و**costCenter', journal.lines.every(l => l.projectId === 'P1' && l.costCenter === 'P1'));
    eq('13 · sourceType', journal.sourceType, 'project_monthly_cost');
    eq('14 · sourceKey = مفتاح التكلفة', journal.sourceKey, 'PMC-K1');
    eq('15 · المجاميع = المبلغ', [journal.totalDebit, journal.totalCredit], [5000, 5000]);
    const t = lineTotals(journal.lines);
    ok('16 · متوازن', moneyEq(t.debit, t.credit));
    eq('17 · postedBy = createdBy لا المستخدم الحالي', journal.postedBy, 'u-test');
}

// ── [3] BUG-015 — النوع المخصّص بلا حسابات ─────────────────────────────────
console.log('\n[3] BUG-015 — النوع المخصّص لا يحمل خريطة حسابات');
{
    const state = { chartOfAccounts: COA, pmcCustomCategories: { steel: { name: 'حديد خاص', icon: '🔩' } } };
    const data = pmc({ category: 'custom_steel' });
    const legacy = await capturePM(['createJournalForPMC', 'getPMCCategoryInfo'], 'createJournalForPMC', [data], state);
    eq('18 · القديم يعيد null', legacy.result, null);
    eq('19 · وصفر قيد', legacy.captured.journals.length, 0);
    ok('20 · بتنبيه تحذيري عابر فقط', legacy.toasts.some(t => t.type === 'wn'), JSON.stringify(legacy.toasts));
    ok('21 · لأن getPMCCategoryInfo لا تُرجع رموز حسابات للنوع المخصّص',
        !getPMCCategoryInfo('custom_steel', { steel: { name: 'حديد خاص' } }).defaultDebitAccountCode);
    ok('22 · والدالة النقيّة الجديدة تكشفها صراحةً', !pmcCategoryHasAccounts('custom_steel', { steel: { name: 'حديد' } }));
    ok('23 · بينما النوع القياسي يحملها', pmcCategoryHasAccounts('materials'));
}
{
    // نوع غير معروف إطلاقاً — نفس المصير
    const legacy = await capturePM(['createJournalForPMC', 'getPMCCategoryInfo'], 'createJournalForPMC', [pmc({ category: 'ghost' })], { chartOfAccounts: COA });
    eq('24 · نوع غير معروف ⇒ null بلا قيد', [legacy.result, legacy.captured.journals.length], [null, 0]);
}

// ── [4] حساب مفقود من الشجرة ────────────────────────────────────────────────
console.log('\n[4] حساب مفقود من شجرة الحسابات');
{
    const chart = { ...COA }; delete chart.a5110;
    const legacy = await capturePM(['createJournalForPMC', 'getPMCCategoryInfo'], 'createJournalForPMC', [pmc()], { chartOfAccounts: chart });
    eq('25 · القديم: null + صفر قيد', [legacy.result, legacy.captured.journals.length], [null, 0]);
    ok('26 · وتنبيه تحذيري لا خطأ', legacy.toasts.some(t => t.type === 'wn'));
    let threw = null;
    try {
        buildPMCJournal({ pmc: pmc(), categoryInfo: getPMCCategoryInfo('materials'), debitAccount: null, creditAccount: resolve(COA, '2110'), journalNumber: 'J', now: NOW });
    } catch (e) { threw = e; }
    ok('27 · الجديد يرمي MissingAccountError بدل العودة الصامتة', threw && threw.name === 'MissingAccountError');
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
