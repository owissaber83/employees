// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خدمة القيد اليدوي — Idempotency · ذرّية · عزل مستأجرين · حقن فشل  [Phase 7-E] ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildMJEnv, makeCounters, tenantPath, countAt, createSharedStore, COA, SIMPLE_LINES, HEADER } from './projectManualTestKit.mjs';

const { ok, eq, summary } = makeCounters();
const grab = async fn => { try { return { value: await fn(), err: null }; } catch (e) { return { value: null, err: e }; } };

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  خدمة القيد اليدوي · Phase 7 Step E                       ║');
console.log('╚══════════════════════════════════════════════════════════╝');

console.log('\n[1] التسجيل المفرد');
{
    const env = buildMJEnv();
    const journalKey = env.newJournalKey();
    const r = await env.service({ journalKey, lines: SIMPLE_LINES(), header: HEADER() });
    ok('تسجيل ناجح', r.success && !r.alreadyPosted);
    eq('قيد واحد', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    const j = tenantPath(env.store, 'T1', `ledger/journalEntries/${journalKey}`);
    eq('مكتوب على المفتاح المُعطى', j.number, r.journalNumber);
    eq('الحالة posted', j.status, 'posted');
    eq('period', j.period, '2026-05');
    eq('المجاميع', [j.totalDebit, j.totalCredit], [1000, 1000]);
    ok('رقم بصيغة الدفتر GEN⇒JV', /^JV-\d{4}-\d{5}$/.test(r.journalNumber), r.journalNumber);
    ok('مفتاح Idempotency حتمي', r.idempotencyKey === `manualJournal:${journalKey}:POSTED`, r.idempotencyKey);
}
{
    const env = buildMJEnv();
    const r = await env.service({ journalKey: env.newJournalKey(), lines: SIMPLE_LINES(), header: HEADER({ book: 'SAL' }) });
    ok('دفتر المبيعات ⇒ بادئة SV', /^SV-/.test(r.journalNumber), r.journalNumber);
}
{
    const env = buildMJEnv();
    const lines = [
        { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, taxable: true, vatRate: 15, description: 'شراء' },
        { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1150 }
    ];
    const r = await env.service({ journalKey: env.newJournalKey(), lines, header: HEADER() });
    const j = Object.values(tenantPath(env.store, 'T1', 'ledger/journalEntries'))[0];
    eq('سطر الضريبة التلقائي أُضيف', j.lines.length, 3);
    // ⚠️ سطر الضريبة يقع مباشرةً **بعد سطره المصدر** لا في نهاية القيد — سلوك
    //    القديم حرفياً، مُثبَت في tests/golden-master/manual-journal.test.mjs §[1].
    eq('وموضعه مباشرةً بعد سطره المصدر', j.lines.findIndex(l => l._taxAuto), 1);
    eq('وحسابه 1180 (مدخلات)', j.lines[1].accountCode, '1180');
    eq('ومبلغه 150', j.lines[1].debit, 150);
    eq('والقيد متوازن', [j.totalDebit, j.totalCredit], [1150, 1150]);
    ok('عدد السطور مُعاد من الخدمة', r.lineCount === 3);
}
{
    const env = buildMJEnv({ projects: { P1: {}, P2: {} } });
    const lines = [
        { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, analytic: [{ target: 'P1', pct: 60 }, { target: 'P2', pct: 40 }] },
        { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1000 }
    ];
    await env.service({ journalKey: env.newJournalKey(), lines, header: HEADER() });
    const j = Object.values(tenantPath(env.store, 'T1', 'ledger/journalEntries'))[0];
    eq('التوزيع التحليلي وُسِّع لسطرين', j.lines.filter(l => l._agid).length, 2);
    eq('600 / 400', [j.lines[0].debit, j.lines[1].debit], [600, 400]);
    eq('ومشروعاهما', [j.lines[0].projectId, j.lines[1].projectId], ['P1', 'P2']);
}

console.log('\n[2] التكرار والتزامن بنفس المفتاح');
{
    const env = buildMJEnv();
    const journalKey = env.newJournalKey();
    const r1 = await env.service({ journalKey, lines: SIMPLE_LINES(), header: HEADER() });
    const r2 = await env.service({ journalKey, lines: SIMPLE_LINES(), header: HEADER() });
    ok('الثاني idempotent', r2.success && r2.alreadyPosted === true);
    eq('ولا قيد ثانٍ', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    eq('ويعيد الرقم الأصلي', r2.journalNumber, r1.journalNumber);
}
for (const n of [2, 5, 10]) {
    const env = buildMJEnv();
    const journalKey = env.newJournalKey();
    const rs = await Promise.allSettled(Array.from({ length: n }, () => env.service({ journalKey, lines: SIMPLE_LINES(), header: HEADER() })));
    const fresh = rs.filter(r => r.status === 'fulfilled' && !r.value.alreadyPosted);
    eq(`${n} متزامناً ⇒ تسجيل أصلي واحد`, fresh.length, 1);
    eq(`${n} ⇒ قيد واحد`, countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
}
{
    const env = buildMJEnv();
    await env.service({ journalKey: env.newJournalKey(), lines: SIMPLE_LINES(), header: HEADER() });
    await env.service({ journalKey: env.newJournalKey(), lines: SIMPLE_LINES(), header: HEADER() });
    eq('مفاتيح مختلفة ⇒ قيدان مشروعان', countAt(env.store, 'T1', 'ledger/journalEntries'), 2);
}

console.log('\n[3] الذرّية');
{
    const env = buildMJEnv();
    const calls = [];
    const real = env.port.update;
    env.port.update = async (r, v) => { calls.push(r.path); return real(r, v); };
    await env.service({ journalKey: env.newJournalKey(), lines: SIMPLE_LINES(), header: HEADER() });
    eq('كتابة ذرّية واحدة على الجذر', calls.filter(p => p === '/').length, 1);
}
{
    const env = buildMJEnv();
    const real = env.port.update;
    let failed = false;
    env.port.update = async (r, v) => { if (!failed && r.path === '/') { failed = true; throw new Error('disk full'); } return real(r, v); };
    const key = env.newJournalKey();
    const { err } = await grab(() => env.service({ journalKey: key, lines: SIMPLE_LINES(), header: HEADER() }));
    ok('فشل ⇒ AtomicityError', err && err.name === 'AtomicityError');
    eq('لا قيد يتيم', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    const r2 = await env.service({ journalKey: key, lines: SIMPLE_LINES(), header: HEADER() });
    ok('وإعادة المحاولة بنفس المفتاح تنجح', r2.success && !r2.alreadyPosted);
    eq('بقيد واحد', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
}

console.log('\n[4] حقن الفشل');
{
    const env = buildMJEnv();
    const { err } = await grab(() => env.service({ lines: SIMPLE_LINES(), header: HEADER() }));
    ok('A · journalKey مفقود ⇒ ValidationError', err && err.name === 'ValidationError');
}
{
    const env = buildMJEnv();
    const { err } = await grab(() => env.service({ journalKey: env.newJournalKey(), lines: SIMPLE_LINES(), header: HEADER({ description: '' }) }));
    ok('B · بيان فارغ ⇒ رفض', err && err.name === 'ValidationError');
    eq('B · صفر كتابة', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
}
{
    const env = buildMJEnv();
    const { err } = await grab(() => env.service({ journalKey: env.newJournalKey(), lines: [SIMPLE_LINES()[0]], header: HEADER() }));
    ok('C · سطر واحد ⇒ رفض', err && err.name === 'ValidationError');
}
{
    const env = buildMJEnv();
    const lines = [{ accountCode: '5110', debit: 1000, credit: 0 }, { accountCode: '1110', debit: 0, credit: 900 }];
    const { err } = await grab(() => env.service({ journalKey: env.newJournalKey(), lines, header: HEADER(), status: 'posted' }));
    ok('D · ترحيل غير متوازن ⇒ رفض', err && err.name === 'ValidationError');
    eq('D · صفر كتابة', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    const env2 = buildMJEnv();
    const r = await env2.service({ journalKey: env2.newJournalKey(), lines, header: HEADER(), status: 'draft' });
    ok('D2 · لكن المسوّدة غير المتوازنة تُقبل (سلوك القديم محفوظ)', r.success && r.status === 'draft');
}
{
    const env = buildMJEnv();
    const lines = [{ accountCode: '9999', debit: 100, credit: 0 }, { accountCode: '1110', debit: 0, credit: 100 }];
    const { err } = await grab(() => env.service({ journalKey: env.newJournalKey(), lines, header: HEADER() }));
    ok('E · حساب غير موجود ⇒ MissingAccountError', err && err.name === 'MissingAccountError');
}
{
    const env = buildMJEnv();
    const lines = [{ accountCode: '5000', debit: 100, credit: 0 }, { accountCode: '1110', debit: 0, credit: 100 }];
    const { err } = await grab(() => env.service({ journalKey: env.newJournalKey(), lines, header: HEADER() }));
    ok('F · حساب رئيسي ⇒ رفض', err && err.name === 'ValidationError' && /رئيسي/.test(err.message));
}
{
    const env = buildMJEnv();
    const { err } = await grab(() => env.service({ journalKey: env.newJournalKey(), lines: SIMPLE_LINES(), header: HEADER(), currency: 'USD', exchangeRate: 0 }));
    ok('G · عملة أجنبية بلا سعر صرف ⇒ رفض', err && err.name === 'ValidationError');
}
{
    const env = buildMJEnv();
    const r = await env.service({ journalKey: env.newJournalKey(), lines: SIMPLE_LINES(), header: HEADER(), currency: 'USD', exchangeRate: 3.75 });
    const j = Object.values(tenantPath(env.store, 'T1', 'ledger/journalEntries'))[0];
    eq('G2 · التحويل للعملة الأساسية', [j.totalDebit, j.totalCredit], [3750, 3750]);
    ok('G2 · والمبالغ الأصلية محفوظة', j.lines[0].fcDebit === 1000);
    eq('G2 · وسعر الصرف مُسجَّل', j.exchangeRate, 3.75);
}
{
    const env = buildMJEnv();
    const { err } = await grab(() => env.service({ journalKey: env.newJournalKey(), lines: SIMPLE_LINES(), header: HEADER(), status: 'weird' }));
    ok('H · حالة غير معروفة ⇒ رفض', err && err.name === 'ValidationError');
}
{
    const env = buildMJEnv();
    const real = env.port.runTransaction;
    env.port.runTransaction = async (r, fn) => {
        if (String(r.path).includes('counters/jrn')) throw new Error('permission_denied');
        return real(r, fn);
    };
    const { err } = await grab(() => env.service({ journalKey: env.newJournalKey(), lines: SIMPLE_LINES(), header: HEADER() }));
    ok('I · فشل حجز الرقم ⇒ RepositoryError محايد', err && err.name === 'RepositoryError' && err.code === 'PERMISSION_DENIED', err && `${err.name}/${err.code}`);
    eq('I · صفر كتابة', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
}

console.log('\n[5] عزل المستأجرين');
{
    const shared = createSharedStore();
    const A = buildMJEnv({ shared, tenantId: 'TA' });
    const B = buildMJEnv({ shared, tenantId: 'TB' });
    const SAME = 'JRN-SAME-KEY';
    const [ra, rb] = await Promise.all([
        A.service({ journalKey: SAME, lines: SIMPLE_LINES(), header: HEADER({ description: 'قيد أ' }) }),
        B.service({ journalKey: SAME, lines: SIMPLE_LINES(), header: HEADER({ description: 'قيد ب' }) })
    ]);
    ok('كلاهما نجح بنفس المفتاح', ra.success && rb.success && !ra.alreadyPosted && !rb.alreadyPosted);
    eq('TA: قيد واحد', countAt(shared, 'TA', 'ledger/journalEntries'), 1);
    eq('TB: قيد واحد', countAt(shared, 'TB', 'ledger/journalEntries'), 1);
    const jA = tenantPath(shared, 'TA', `ledger/journalEntries/${SAME}`);
    const jB = tenantPath(shared, 'TB', `ledger/journalEntries/${SAME}`);
    eq('TA: بيانه', jA.description, 'قيد أ');
    eq('TB: بيانه', jB.description, 'قيد ب');
    ok('العدّاد لا يُتقاسَم', ra.journalNumber.endsWith('00001') && rb.journalNumber.endsWith('00001'));
    eq('جذر المتجر: tenants فقط', Object.keys(shared.root), ['tenants']);
}

process.exit(summary() ? 1 : 0);
