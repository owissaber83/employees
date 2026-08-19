// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حقن الفشل — ترحيل فاتورة المبيعات (السيناريوهات A–M)              [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  لكل سيناريو نُثبت أربعة أمور صراحةً: نوع الخطأ · الحالة المتبقّية · صفر كتابة    ║
// ║  عالقة · قابلية إعادة المحاولة. **لا فشل صامت مقبول.**                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import {
    buildSalesEnv, makeCounters, tenantPath, countAt, salesInvoice,
    createSharedStore, ACCOUNTS
} from './salesInvoiceTestKit.mjs';

const { ok, eq, summary } = makeCounters();
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  حقن الفشل — فاتورة المبيعات · Phase 7 Step C             ║');
console.log('╚══════════════════════════════════════════════════════════╝');

const without = (...codes) => {
    const out = {};
    for (const [k, a] of Object.entries(ACCOUNTS)) if (!codes.includes(a.code)) out[k] = a;
    return out;
};
const grab = async fn => { try { return { value: await fn(), err: null }; } catch (e) { return { value: null, err: e }; } };
const clean = env => countAt(env.store, 'T1', 'ledger/journalEntries') === 0 && countAt(env.store, 'T1', 'ledger/inventoryMovements') === 0;

// ── A — فاتورة مفقودة ─────────────────────────────────────────────────────────
console.log('\n[A] فاتورة مفقودة');
{
    const env = buildSalesEnv({ invoice: null });
    const { err } = await grab(() => env.service({ invoiceKey: 'GHOST' }));
    ok('A · ValidationError صريح', err && err.name === 'ValidationError', err && err.name);
    ok('A · صفر كتابة', clean(env));
}
{
    const env = buildSalesEnv();
    const { err } = await grab(() => env.service({ invoiceKey: '' }));
    ok('A2 · مفتاح فارغ ⇒ ValidationError قبل أي قراءة', err && err.name === 'ValidationError');
}

// ── B — عميل مفقود (سلوك القديم محفوظ: يُرحَّل) ──────────────────────────────
console.log('\n[B] عميل مفقود — سلوك القديم محفوظ (صنف A)');
{
    const env = buildSalesEnv({ invoice: salesInvoice({ customerId: 'GHOST' }) });
    const { value, err } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok('B · يُرحَّل بنجاح كما القديم (لا يُرفَض)', !err && value.success, err && err.message);
    const j = Object.values(tenantPath(env.store, 'T1', 'ledger/journalEntries'))[0];
    ok('B2 · باسم عميل فارغ في الوصف', j.description.endsWith(' - '), j.description);
    eq('B3 · والقيد متوازن وكامل', j.totalDebit, 23000);
}
{
    const env = buildSalesEnv({ invoice: salesInvoice({ customerId: '' }) });
    const { value, err } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok('B4 · فاتورة بلا عميل إطلاقاً ⇒ حساب العملاء الموحّد 1130', !err && value.success);
}

// ── C — حساب مفقود ────────────────────────────────────────────────────────────
console.log('\n[C] حساب مفقود — رفض صريح لا إنشاء (فرق C1/C2/C3)');
for (const [label, code, invoice] of [
    ['حساب العملاء 1130', '1130', salesInvoice()],
    ['حساب الإيرادات 4100', '4100', salesInvoice()],
    ['ضريبة المخرجات 2140', '2140', salesInvoice()],
    ['محتجزات 1131 مع احتجاز', '1131', salesInvoice({ retentionAmount: 2300 })],
    ['دفعات مقدمة 2150 مع مقدّم', '2150', salesInvoice({ advanceRecoveryAmount: 5000 })]
]) {
    const env = buildSalesEnv({ invoice, accounts: without(code) });
    const { err } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok(`C · ${label} ⇒ MissingAccountError`, err && err.name === 'MissingAccountError', err && `${err.name}: ${err.message}`);
    ok(`C · ${label} ⇒ صفر كتابة`, clean(env));
    eq(`C · ${label} ⇒ الفاتورة تبقى مسوّدة`, tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1').status, 'draft');
    eq(`C · ${label} ⇒ لا حساب أُنشئ تلقائياً`, (await env.coa.list()).length, Object.keys(without(code)).length);
}
{
    // الحساب المفقود لا يمسّ الفاتورة إن لم يكن مطلوباً فعلاً
    const env = buildSalesEnv({ invoice: salesInvoice({ vatTotal: 0, grandTotal: 20000 }), accounts: without('2140') });
    const { value, err } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok('C6 · غياب 2140 مع ضريبة صفر ⇒ يُرحَّل عادياً', !err && value.success, err && err.message);
}

// ── D — فاتورة مشوّهة ─────────────────────────────────────────────────────────
console.log('\n[D] فاتورة مشوّهة');
for (const [label, invoice] of [
    ['بلا مبالغ إطلاقاً', salesInvoice({ netBeforeTax: undefined, vatTotal: undefined, grandTotal: undefined })],
    ['إجمالي صفر', salesInvoice({ netBeforeTax: 0, vatTotal: 0, grandTotal: 0 })],
    ['مبالغ غير رقمية', salesInvoice({ netBeforeTax: 'كذا', vatTotal: 'كذا', grandTotal: 'كذا' })],
    ['إجمالي سالب', salesInvoice({ netBeforeTax: -100, vatTotal: 0, grandTotal: -100 })]
]) {
    const env = buildSalesEnv({ invoice });
    const { err } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok(`D · ${label} ⇒ رفض مُصنَّف`, err && (err.name === 'ValidationError' || err.name === 'UnbalancedJournalError'), err ? err.name : 'لم يُرفَض');
    ok(`D · ${label} ⇒ صفر كتابة`, clean(env));
    eq(`D · ${label} ⇒ الفاتورة تبقى مسوّدة`, tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1').status, 'draft');
}

// ── E — فشل حجز رقم القيد ─────────────────────────────────────────────────────
console.log('\n[E] فشل حجز رقم القيد');
{
    const env = buildSalesEnv();
    const real = env.port.runTransaction;
    env.port.runTransaction = async (r, fn) => {
        if (String(r.path).includes('counters/jrn')) throw new Error('network unavailable');
        return real(r, fn);
    };
    const { err } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok('E · RepositoryError محايد (UNAVAILABLE)', err && err.name === 'RepositoryError' && err.code === 'UNAVAILABLE', err && `${err.name}/${err.code}`);
    ok('E · صفر كتابة', clean(env));
    eq('E · والحالة استُرجعت', tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1').status, 'draft');
    env.port.runTransaction = real;
    const { value } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok('E · وإعادة المحاولة تنجح', value && value.success && !value.alreadyPosted);
}

// ── F — فشل مطالبة Idempotency ───────────────────────────────────────────────
console.log('\n[F] فشل مطالبة الحالة');
{
    const env = buildSalesEnv();
    env.port.runTransaction = async r => {
        if (String(r.path).endsWith('/status')) throw new Error('permission_denied');
        throw new Error('unexpected');
    };
    const { err } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok('F · PERMISSION_DENIED مترجَم لا خطأ Firebase خام', err && err.name === 'RepositoryError' && err.code === 'PERMISSION_DENIED', err && `${err.name}/${err.code}`);
    ok('F · صفر كتابة', clean(env));
}
{
    const env = buildSalesEnv();
    env.port.runTransaction = async () => ({ committed: false, snapshot: { val: () => 'posted' } });
    const { value } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok('F2 · عدم الالتزام ⇒ نتيجة idempotent لا استثناء', value && value.alreadyPosted === true);
    ok('F2 · صفر كتابة', clean(env));
}

// ── G/H/I/J — فشل الكتابة الذرّية (كلها نفس الكتابة الواحدة) ──────────────────
console.log('\n[G·H·I·J] فشل الكتابة الذرّية — القيد والحركات والربط معاً');
{
    const env = buildSalesEnv({ invoice: salesInvoice({ lines: [{ itemId: 'IT1', qty: 2, unitPrice: 100 }, { itemId: 'IT2', qty: 3, unitPrice: 30 }] }) });
    const real = env.port.update;
    env.port.update = async (r, v) => { if (r.path === '/') throw new Error('disk full'); return real(r, v); };
    const { err } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok('G·H·I·J · AtomicityError واحدة تغطّي الأربعة', err && err.name === 'AtomicityError');
    ok('H · لا قيد', countAt(env.store, 'T1', 'ledger/journalEntries') === 0);
    ok('G · لا حركة مخزون (ولا حتى واحدة من اثنتين)', countAt(env.store, 'T1', 'ledger/inventoryMovements') === 0);
    const inv = tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1');
    ok('I · لا حقول ربط', !inv.journalEntryKey && !inv.journalEntryNumber && !inv.postedAt);
    eq('J · والحالة draft', inv.status, 'draft');
    ok('J · تفاصيل الخطأ تحمل السبب الأصلي', err.details && err.details.cause === 'disk full');
}

// ── K — فشل التعويض نفسه (استرجاع الحالة) ────────────────────────────────────
console.log('\n[K] فشل التعويض — استرجاع الحالة يفشل هو الآخر');
{
    const env = buildSalesEnv();
    env.port.update = async () => { throw new Error('disk full'); };   // يفشل الذرّي **والاسترجاع**
    const { err } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok('K · الخطأ الأصلي (AtomicityError) هو ما يُبلَّغ لا خطأ التعويض', err && err.name === 'AtomicityError');
    ok('K · ولا كتابة مالية عالقة', clean(env));
    eq('K · لكن الحالة تبقى posted — حدّ موثَّق صراحةً', tenantPath(env.store, 'T1', 'ledger/salesInvoices/SINV-1').status, 'posted');
    // إعادة المحاولة بعد شفاء القاعدة: الفاتورة «مقفلة» ⇒ نتيجة idempotent بلا قيد
    const { value } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
    ok('K · إعادة المحاولة لا تُنتج قيداً مكرّراً (تُبلَّغ كمُرحَّلة)', value && value.alreadyPosted === true);
    ok('K · وتحتاج تدخّلاً يدوياً — لا إصلاح تلقائي مُدَّعى', countAt(env.store, 'T1', 'ledger/journalEntries') === 0);
}

// ── L — طلبان متزامنان ────────────────────────────────────────────────────────
console.log('\n[L] طلب مكرّر متزامن');
{
    const env = buildSalesEnv();
    const rs = await Promise.allSettled([env.service({ invoiceKey: env.invoiceKey }), env.service({ invoiceKey: env.invoiceKey })]);
    const fresh = rs.filter(r => r.status === 'fulfilled' && !r.value.alreadyPosted);
    eq('L · ترحيل أصلي واحد', fresh.length, 1);
    eq('L · قيد واحد', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    eq('L · حركة واحدة', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 1);
}

// ── M — طلب عابر للمستأجرين ──────────────────────────────────────────────────
console.log('\n[M] طلب عابر للمستأجرين');
{
    const shared = createSharedStore();
    const A = buildSalesEnv({ shared, tenantId: 'TA', invoiceKey: 'ONLY-IN-A' });
    const B = buildSalesEnv({ shared, tenantId: 'TB', invoiceKey: 'ONLY-IN-B' });

    const { err } = await grab(() => B.service({ invoiceKey: 'ONLY-IN-A' }));
    ok('M · مستأجر B لا يرى فاتورة A إطلاقاً ⇒ ValidationError «غير موجودة»', err && err.name === 'ValidationError', err && err.name);
    eq('M · ولا كتابة في نطاق A', countAt(shared, 'TA', 'ledger/journalEntries'), 0);
    eq('M · ولا في نطاق B', countAt(shared, 'TB', 'ledger/journalEntries'), 0);
    eq('M · وفاتورة A ما زالت مسوّدة سليمة', tenantPath(shared, 'TA', 'ledger/salesInvoices/ONLY-IN-A').status, 'draft');

    await A.service({ invoiceKey: 'ONLY-IN-A' });
    eq('M · وبعد ترحيل A شرعياً: قيد في A فقط', countAt(shared, 'TA', 'ledger/journalEntries'), 1);
    eq('M · وصفر في B', countAt(shared, 'TB', 'ledger/journalEntries'), 0);
}

process.exit(summary() ? 1 : 0);
