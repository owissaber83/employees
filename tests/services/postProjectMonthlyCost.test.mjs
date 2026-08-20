// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خدمة PMC — Idempotency · ذرّية · عزل مستأجرين · حقن فشل           [Phase 7-E] ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildPMCEnv, makeCounters, tenantPath, countAt, createSharedStore, COA, pmcRecord } from './projectManualTestKit.mjs';

const { ok, eq, summary } = makeCounters();
const grab = async fn => { try { return { value: await fn(), err: null }; } catch (e) { return { value: null, err: e }; } };
const without = code => { const o = {}; for (const [k, a] of Object.entries(COA)) if (a.code !== code) o[k] = a; return o; };

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  خدمة تكلفة المشروع (PMC) · Phase 7 Step E                ║');
console.log('╚══════════════════════════════════════════════════════════╝');

console.log('\n[1] الترحيل المفرد');
{
    const env = buildPMCEnv();
    const r = await env.service({ pmcKey: env.pmcKey });
    ok('ترحيل ناجح', r.success && !r.alreadyPosted);
    eq('قيد واحد', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    const rec = tenantPath(env.store, 'T1', 'ledger/projectMonthlyCosts/PMC-1');
    eq('التكلفة مربوطة بالقيد', rec.journalEntryKey, r.journalId);
    const j = Object.values(tenantPath(env.store, 'T1', 'ledger/journalEntries'))[0];
    eq('سطران', j.lines.length, 2);
    eq('مدين 5110 · دائن 2110', [j.lines[0].accountCode, j.lines[1].accountCode], ['5110', '2110']);
    eq('المجاميع', [j.totalDebit, j.totalCredit], [5000, 5000]);
    ok('مفتاح Idempotency حتمي', r.idempotencyKey === 'projectMonthlyCost:PMC-1:POST', r.idempotencyKey);
}

console.log('\n[2] التكرار والتزامن');
{
    const env = buildPMCEnv();
    const r1 = await env.service({ pmcKey: env.pmcKey });
    const r2 = await env.service({ pmcKey: env.pmcKey });
    ok('الطلب الثاني idempotent', r2.success && r2.alreadyPosted === true);
    eq('ولا قيد ثانٍ', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    eq('ويعيد القيد الأصلي', r2.journalId, r1.journalId);
}
for (const n of [2, 5, 10]) {
    const env = buildPMCEnv();
    const rs = await Promise.allSettled(Array.from({ length: n }, () => env.service({ pmcKey: env.pmcKey })));
    const fresh = rs.filter(r => r.status === 'fulfilled' && !r.value.alreadyPosted);
    eq(`${n} متزامناً ⇒ ترحيل أصلي واحد`, fresh.length, 1);
    eq(`${n} ⇒ قيد واحد`, countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    ok(`${n} ⇒ لا استثناء غير مُصنَّف`, rs.every(r => r.status === 'fulfilled'));
}

console.log('\n[3] الذرّية');
{
    const env = buildPMCEnv();
    const calls = [];
    const real = env.port.update;
    env.port.update = async (r, v) => { calls.push({ path: r.path, keys: Object.keys(v) }); return real(r, v); };
    await env.service({ pmcKey: env.pmcKey });
    const atomic = calls.filter(c => c.path === '/');
    eq('كتابة ذرّية واحدة', atomic.length, 1);
    eq('تضمّ القيد + الربط', atomic[0].keys.length, 2);
}
{
    const env = buildPMCEnv();
    const real = env.port.update;
    let failed = false;   // فشل لمرّة واحدة كي تُختبَر إعادة المحاولة فعلياً بعده
    env.port.update = async (r, v) => { if (!failed && r.path === '/') { failed = true; throw new Error('network unavailable'); } return real(r, v); };
    const { err } = await grab(() => env.service({ pmcKey: env.pmcKey }));
    ok('فشل الكتابة ⇒ AtomicityError', err && err.name === 'AtomicityError', err && err.name);
    eq('لا قيد يتيم', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    const rec = tenantPath(env.store, 'T1', 'ledger/projectMonthlyCosts/PMC-1');
    ok('والمطالبة حُرِّرت (لا ربط عالق)', !rec.journalEntryKey, JSON.stringify(rec.journalEntryKey));
    const r2 = await env.service({ pmcKey: env.pmcKey });
    ok('وإعادة المحاولة تنجح', r2.success && !r2.alreadyPosted);
}

console.log('\n[4] حقن الفشل');
{
    const env = buildPMCEnv({ record: null });
    const { err } = await grab(() => env.service({ pmcKey: 'GHOST' }));
    ok('A · تكلفة مفقودة ⇒ ValidationError', err && err.name === 'ValidationError');
    eq('A · صفر كتابة', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
}
{
    const env = buildPMCEnv();
    const { err } = await grab(() => env.service({}));
    ok('B · pmcKey مفقود ⇒ ValidationError', err && err.name === 'ValidationError');
}
for (const [label, amount] of [['صفر', 0], ['سالب', -100], ['غير رقمي', 'كذا'], ['غائب', undefined]]) {
    const env = buildPMCEnv({ record: pmcRecord({ amount }) });
    const { err } = await grab(() => env.service({ pmcKey: env.pmcKey }));
    ok(`C · مبلغ ${label} ⇒ رفض`, err && err.name === 'ValidationError', err && err.name);
    eq(`C · مبلغ ${label} ⇒ صفر كتابة`, countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
}
{
    const env = buildPMCEnv({ record: pmcRecord({ category: 'custom_steel' }), customCategories: { steel: { name: 'حديد' } } });
    const { err } = await grab(() => env.service({ pmcKey: env.pmcKey }));
    ok('D · BUG-015: نوع مخصّص ⇒ MissingAccountError (لا تكلفة بلا قيد)', err && err.name === 'MissingAccountError', err && `${err.name}: ${err.message}`);
    eq('D · صفر كتابة', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    const rec = tenantPath(env.store, 'T1', 'ledger/projectMonthlyCosts/PMC-1');
    ok('D · والتكلفة لم تُمَسّ', !rec.journalEntryKey);
}
for (const code of ['5110', '2110']) {
    const env = buildPMCEnv({ accounts: without(code) });
    const { err } = await grab(() => env.service({ pmcKey: env.pmcKey }));
    ok(`E · غياب ${code} ⇒ MissingAccountError`, err && err.name === 'MissingAccountError', err && err.name);
    eq(`E · غياب ${code} ⇒ صفر كتابة`, countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
}
{
    const env = buildPMCEnv();
    const real = env.port.runTransaction;
    env.port.runTransaction = async (r, fn) => {
        if (String(r.path).includes('counters/jrn')) throw new Error('network unavailable');
        return real(r, fn);
    };
    const { err } = await grab(() => env.service({ pmcKey: env.pmcKey }));
    ok('F · فشل حجز الرقم ⇒ RepositoryError محايد', err && err.name === 'RepositoryError' && err.code === 'UNAVAILABLE', err && `${err.name}/${err.code}`);
    eq('F · صفر كتابة', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
    const rec = tenantPath(env.store, 'T1', 'ledger/projectMonthlyCosts/PMC-1');
    ok('F · والمطالبة حُرِّرت', !rec.journalEntryKey);
}

console.log('\n[5] عزل المستأجرين');
{
    const shared = createSharedStore();
    const A = buildPMCEnv({ shared, tenantId: 'TA', pmcKey: 'SAME', record: pmcRecord({ amount: 5000, description: 'A' }) });
    const B = buildPMCEnv({ shared, tenantId: 'TB', pmcKey: 'SAME', record: pmcRecord({ amount: 7777, description: 'B' }) });
    const [ra, rb] = await Promise.all([A.service({ pmcKey: 'SAME' }), B.service({ pmcKey: 'SAME' })]);
    ok('كلاهما نجح', ra.success && rb.success && !ra.alreadyPosted && !rb.alreadyPosted);
    eq('TA: قيد واحد', countAt(shared, 'TA', 'ledger/journalEntries'), 1);
    eq('TB: قيد واحد', countAt(shared, 'TB', 'ledger/journalEntries'), 1);
    const jA = Object.values(tenantPath(shared, 'TA', 'ledger/journalEntries'))[0];
    const jB = Object.values(tenantPath(shared, 'TB', 'ledger/journalEntries'))[0];
    eq('TA: مبلغه', jA.totalDebit, 5000);
    eq('TB: مبلغه', jB.totalDebit, 7777);
    ok('لا تسرّب أوصاف', jA.description.includes('A') && jB.description.includes('B'));
    ok('العدّاد لا يُتقاسَم', ra.journalNumber.endsWith('00001') && rb.journalNumber.endsWith('00001'), `${ra.journalNumber}/${rb.journalNumber}`);
    eq('جذر المتجر: tenants فقط', Object.keys(shared.root), ['tenants']);
}

process.exit(summary() ? 1 : 0);
