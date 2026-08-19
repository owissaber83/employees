// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  اختبارات مستودع شجرة الحسابات                                                ║
// ║  التشغيل:  npm run test:repo                                                  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { runContractSuite } from './contract.suite.mjs';
import { createFakeRtdb } from './fakeRtdb.mjs';
import { FirebaseChartOfAccountsRepository, toRecords } from '../../src/repositories/firebase/FirebaseChartOfAccountsRepository.js';
import { InMemoryChartOfAccountsRepository } from '../../src/repositories/memory/InMemoryChartOfAccountsRepository.js';
import { createRtdbPort, portFromGlobals } from '../../src/repositories/firebase/rtdbPort.js';
import { stripDerived } from '../../src/repositories/contracts/ChartOfAccountsRepository.js';

let pass = 0, fail = 0;
const eq = (n, a, b) => {
    if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); }
    else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); }
};
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const t = { eq, ok };

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📇 [1] عقد المستودع — على تنفيذ Firebase');
// ═══════════════════════════════════════════════════════════════════════════════
await runContractSuite('Firebase', async () => {
    const { port } = createFakeRtdb();
    return new FirebaseChartOfAccountsRepository(port);
}, t);

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧠 [2] نفس العقد — على تنفيذ الذاكرة (برهان حياد التخزين)');
// ═══════════════════════════════════════════════════════════════════════════════
await runContractSuite('الذاكرة', async () => new InMemoryChartOfAccountsRepository(), t);

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏢 [3] عزل المستأجرين — الكتابة داخل مسار المستأجر لا النطاق العام');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { port, rawPath } = createFakeRtdb({ tenantId: 'ACME' });
    const repo = new FirebaseChartOfAccountsRepository(port);
    const key = await repo.create({ code: '1110', nameAr: 'الصندوق' });

    ok('السجل داخل tenants/ACME/ledger/chartOfAccounts',
        !!rawPath(`tenants/ACME/ledger/chartOfAccounts/${key}`));
    eq('ولا شيء في المسار العام ledger/chartOfAccounts', rawPath('ledger/chartOfAccounts'), undefined);
    ok('وحجز الرمز داخل مسار المستأجر أيضاً',
        !!rawPath('tenants/ACME/ledger/counters/coaCode/1110'));
    eq('ولا حجز في النطاق العام', rawPath('ledger/counters/coaCode'), undefined);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🗺️ [4] المسارات وأسماء الحقول — مطابقة للمخطّط القائم');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { port, rawPath } = createFakeRtdb({ tenantId: 'T' });
    const repo = new FirebaseChartOfAccountsRepository(port);
    const input = {
        code: '5110', type: 'expense', nameAr: 'مشتريات مواد', nameEn: 'Materials',
        parent: '5100', nature: 'debit', openingBalance: 0, fsRole: '', notes: '',
        active: true, createdAt: '2026-03-10T00:00:00.000Z', createdBy: 'u1'
    };
    const key = await repo.create(input);
    const stored = rawPath(`tenants/T/ledger/chartOfAccounts/${key}`);
    eq('كل الحقول تُخزَّن بأسمائها كما هي', Object.keys(stored).sort(), Object.keys(input).sort());
    eq('ولا حقل مشتقّ تسرّب إلى التخزين', Object.keys(stored).filter(k => k.startsWith('__')), []);
    eq('مسار الحجز مطابق لـaccounting.js:894', !!rawPath('tenants/T/ledger/counters/coaCode/5110'), true);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚡ [5] الذاكرة المحلية — يطابق ما تراه الواجهة القديمة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // القديم يقرأ window.chartOfAccounts الذي يملؤه onValue. المستودع يستخدمها
    // إن مُرِّرت، فيتجنّب قراءة زائدة ويعطي نفس ما تراه الشاشة بالضبط.
    const { port } = createFakeRtdb();
    const cache = { k1: { code: '1110', nameAr: 'الصندوق' }, k2: { code: '1120', nameAr: 'البنك' } };
    const repo = new FirebaseChartOfAccountsRepository(port, { cache: () => cache });
    const all = await repo.list();
    eq('list يقرأ من الذاكرة المحلية', all.length, 2);
    eq('ويضيف __key لكل سجل', all.map(a => a.__key).sort(), ['k1', 'k2']);
    eq('getByCode يعمل عليها', (await repo.getByCode('1120')).__key, 'k2');
    eq('getByKey يعمل عليها', (await repo.getByKey('k1')).nameAr, 'الصندوق');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔌 [6] المنفذ — يرفض التركيب الناقص بدل الفشل لاحقاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    let e = null;
    try { createRtdbPort({ db: {}, ref: () => {} }); } catch (x) { e = x; }
    ok('منفذ ناقص يُرفض عند البناء', !!e);
    ok('والرسالة تسمّي الدوال الناقصة', /get|push|update/.test(e.message), e.message);

    const { port } = createFakeRtdb();
    ok('منفذ كامل يُقبل', !!createRtdbPort(port));

    let e2 = null;
    try { new FirebaseChartOfAccountsRepository(null); } catch (x) { e2 = x; }
    ok('مستودع بلا منفذ يُرفض', !!e2);

    // portFromGlobals يستخدم window.ref لا window._rawRef — شرط عزل المستأجرين
    const g = { db: {}, ref: 'THE_WRAPPER', get: 1, push: 1, update: 1, remove: 1, onValue: 1, runTransaction: 1 };
    eq('portFromGlobals يأخذ غلاف ref الواعي بالمستأجر', portFromGlobals(g).ref, 'THE_WRAPPER');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧩 [7] أدوات مساعدة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    eq('toRecords من كائن RTDB مفتاحي', toRecords({ a: { code: '1' } }), [{ code: '1', __key: 'a' }]);
    eq('toRecords من null', toRecords(null), []);
    eq('stripDerived يجرّد __key فقط', stripDerived({ code: '1', __key: 'k', active: true }), { code: '1', active: true });
    eq('stripDerived لا يكسر القيم غير الكائنية', stripDerived(null), null);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
