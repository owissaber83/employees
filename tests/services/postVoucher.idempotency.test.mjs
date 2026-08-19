// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEW SAFETY INVARIANT TEST — Idempotency ترحيل السند                  [Phase 7] ║
// ║  التشغيل: npm run test:svc:voucher:idempotency                                ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  نفس الطلب مرّتين تتابعياً · مفتاح حتمي · طلبان متزامنان (Promise.all) · خمسة     ║
// ║  طلبات متزامنة · إعادة محاولة بعد فشل — في كل الحالات: قيد واحد وتخصيص واحد.     ║
// ║                                                                              ║
// ║  🔴 القديم (postVoucher في accounting.js:20004) **لا** بوّابة idempotency خادمية  ║
// ║  فيه إطلاقاً — فحص العميل `data.status !== 'draft'` وحده (سباق حقيقي ممكن).      ║
// ║  هنا: runTransaction خادمي حقيقي يمنع الترحيل المزدوج فعلياً — فرق مقصود موثَّق.  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { makeCounters } from './testKit.mjs';
import { buildVoucherTestEnv } from './voucherTestKit.mjs';
import { rawPath } from './fakePostingRtdb.mjs';

const { eq, ok, summary } = makeCounters();

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [نفس الطلب مرّتين — تتابعياً] الثاني Idempotent لا مكرَّر');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv();
    const r1 = await service({ voucherKey, voucherType: 'receipt' });
    const r2 = await service({ voucherKey, voucherType: 'receipt' });

    ok('الطلب الأول ينشئ قيداً', r1.success && !r1.alreadyPosted);
    ok('✅ الثاني alreadyPosted=true — لا خطأ', r2.success && r2.alreadyPosted === true);
    eq('✅ ونفس journalId بالضبط', r2.journalId, r1.journalId);
    eq('✅✅ قيد واحد فقط في الدفتر', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
    eq('✅✅ وتخصيص واحد فقط طُبِّق على الفاتورة — لا مضاعفة (يمنع BUG مطابق لـBUG-007 لهذا المسار)',
        rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 6000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [نفس مفتاح idempotency] محسوب حتمياً من sourceType:sourceId:operation');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, voucherKey } = await buildVoucherTestEnv();
    const r1 = await service({ voucherKey, voucherType: 'receipt' });
    eq('المفتاح حتمي وقابل للتنبؤ', r1.idempotencyKey, `receipt:${voucherKey}:POST`);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [طلبان متزامنان حقيقيان] Promise.all على نفس السند — يحاكي نقرتين على زر الترحيل');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv();
    const [r1, r2] = await Promise.all([
        service({ voucherKey, voucherType: 'receipt' }),
        service({ voucherKey, voucherType: 'receipt' })
    ]);

    const results = [r1, r2];
    const successCount = results.filter(r => r.success && !r.alreadyPosted).length;
    const dupCount = results.filter(r => r.success && r.alreadyPosted).length;

    ok('✅✅ واحد فقط نجح كترحيل جديد', successCount === 1, JSON.stringify(results));
    ok('✅✅ والآخر عاد Idempotent (alreadyPosted)', dupCount === 1, JSON.stringify(results));
    eq('✅✅✅ قيد واحد فقط رغم التزامن الحقيقي', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
    eq('✅✅✅ وتخصيص واحد فقط طُبِّق على الفاتورة — لا مضاعفة رغم التزامن',
        rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 6000);

    const winner = results.find(r => !r.alreadyPosted);
    const loser = results.find(r => r.alreadyPosted);
    eq('والخاسر يحمل journalId الفائز نفسه', loser.journalId, winner.journalId);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [خمسة طلبات متزامنة] — لا تُنتج أكثر من قيد واحد ولا أكثر من تخصيص واحد مهما زاد العدد');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv();
    const results = await Promise.all(Array.from({ length: 5 }, () => service({ voucherKey, voucherType: 'receipt' })));
    const successCount = results.filter(r => !r.alreadyPosted).length;
    eq('واحد فقط نجح كجديد من أصل 5', successCount, 1);
    eq('قيد واحد فقط في الدفتر', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
    eq('وتخصيص واحد فقط على الفاتورة', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 6000);
    const uniqueJournalIds = new Set(results.map(r => r.journalId));
    eq('وكل الخمسة يحملون نفس journalId', uniqueJournalIds.size, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [إعادة محاولة بعد فشل ذرّي] — لا تُنتج قيدين ولا تخصيصين');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, port, store, voucherKey } = await buildVoucherTestEnv();
    const realUpdate = port.update;
    let failedOnce = false;
    port.update = async (r, values) => { if (!failedOnce) { failedOnce = true; throw new Error('boom'); } return realUpdate(r, values); };

    let err = null;
    try { await service({ voucherKey, voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('الأولى فشلت (AtomicityError)', err && err.name === 'AtomicityError');
    const r2 = await service({ voucherKey, voucherType: 'receipt' });
    ok('إعادة المحاولة تنجح كترحيل جديد (الحالة والتخصيص استُرجعا بعد الفشل)', r2.success && !r2.alreadyPosted);
    eq('وقيد واحد فقط بالنتيجة', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
    eq('وتخصيص واحد فقط بالنتيجة', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 6000);
}

console.log(summary() ? process.exit(1) : process.exit(0));
