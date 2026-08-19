// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEW SAFETY INVARIANT TEST — الذرّية                                  [Phase 6] ║
// ║  التشغيل: npm run test:svc:atomicity                                          ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §13 «Atomicity»: ترحيل ناجح · فشل قبل الالتزام · فشل أثناء الالتزام ·          ║
// ║  لا قيد يتيم · لا حالة جزئية للفاتورة.                                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { makeCounters, buildTestEnv, draftInvoice } from './testKit.mjs';
import { rawPath } from './fakePostingRtdb.mjs';

const { eq, ok, summary } = makeCounters();

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚛️ [A] ترحيل ناجح — كتابة واحدة، كل شيء متّسق');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, invoiceKey } = await buildTestEnv();
    const r = await service({ invoiceKey });
    ok('نجح', r.success && !r.alreadyPosted);
    const inv = rawPath(store, `tenants/T1/ledger/purchaseInvoices/${invoiceKey}`);
    eq('الفاتورة posted', inv.status, 'posted');
    eq('journalEntryKey مطابق للناتج', inv.journalEntryKey, r.journalId);
    ok('والقيد موجود فعلياً في الدفتر', !!rawPath(store, `tenants/T1/ledger/journalEntries/${r.journalId}`));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚛️ [B] فشل قبل الالتزام — حساب مفقود، لا كتابة إطلاقاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, invoiceKey } = await buildTestEnv({ accounts: { a2110: { code: '2110', nameAr: 'الموردون' } } }); // 5110 مفقود
    let err = null;
    try { await service({ invoiceKey }); } catch (e) { err = e; }
    ok('يرمي MissingAccountError', err && err.name === 'MissingAccountError', err && err.message);
    const inv = rawPath(store, `tenants/T1/ledger/purchaseInvoices/${invoiceKey}`);
    eq('🔴→✅ الفاتورة تبقى draft — لم تُقفَل بلا سبب', inv.status, 'draft');
    ok('ولا قيد يتيم أُنشئ', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚛️ [C] فشل أثناء الالتزام — الكتابة الذرّية نفسها تفشل');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, port, store, invoiceKey } = await buildTestEnv();
    // نحقن فشلاً في update() — يحاكي انقطاع الشبكة أثناء التحديث الذرّي متعدّد المسارات
    const realUpdate = port.update;
    let calls = 0;
    port.update = async (r, values) => {
        calls++;
        // أول استدعاء update بعد seed الفاتورة هو الكتابة الذرّية نفسها (تحديث الحالة عبر runTransaction لا update)
        if (calls === 1) throw new Error('network lost during atomic commit');
        return realUpdate(r, values);
    };

    let err = null;
    try { await service({ invoiceKey }); } catch (e) { err = e; }
    ok('يرمي AtomicityError', err && err.name === 'AtomicityError', err && err.message);

    const inv = rawPath(store, `tenants/T1/ledger/purchaseInvoices/${invoiceKey}`);
    ok('🔴→✅ الحالة استُرجعت إلى draft — لا قفل دائم على فاتورة فشل ترحيلها', inv.status === 'draft', JSON.stringify(inv));
    ok('ولا رابط جزئي (journalEntryKey) تسرّب إلى الفاتورة', !inv.journalEntryKey);
    ok('ولا قيد وُجد في الدفتر — الرقم المحجوز ضاع (مقبول، موثَّق) لكن لا قيد يتيم', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚛️ [D] بعد فشل الالتزام — إعادة المحاولة تنجح وتُنتج قيداً واحداً فقط');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, port, store, invoiceKey } = await buildTestEnv();
    const realUpdate = port.update;
    let failedOnce = false;
    port.update = async (r, values) => {
        if (!failedOnce) { failedOnce = true; throw new Error('transient failure'); }
        return realUpdate(r, values);
    };

    let err = null;
    try { await service({ invoiceKey }); } catch (e) { err = e; }
    ok('المحاولة الأولى تفشل كما هو متوقَّع', err && err.name === 'AtomicityError');

    const r2 = await service({ invoiceKey }); // إعادة محاولة حقيقية بعد الاسترجاع
    ok('إعادة المحاولة تنجح', r2.success && !r2.alreadyPosted);
    eq('وقيد واحد فقط في الدفتر', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
}

console.log(summary() ? process.exit(1) : process.exit(0));
