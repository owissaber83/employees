// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEW SAFETY INVARIANT TEST — Idempotency                              [Phase 6] ║
// ║  التشغيل: npm run test:svc:idempotency                                        ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §13 «Idempotency»: نفس الطلب مرّتين · نفس مفتاح المصدر مرّتين · طلبان متزامنان   ║
// ║  مكرَّران · إعادة محاولة بعد فشل · إعادة محاولة بعد نجاح.                        ║
// ║                                                                              ║
// ║  🔴 يحلّ مباشرةً BUG-007 (idempotency.test.mjs في Phase 5): القيد المكرَّر كان     ║
// ║  يُضاعف ميزان المراجعة بصمت. هنا: طلبان متزامنان ⇒ **قيد واحد فقط** يُكتب.       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { makeCounters, buildTestEnv } from './testKit.mjs';
import { rawPath } from './fakePostingRtdb.mjs';

const { eq, ok, summary } = makeCounters();

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [نفس الطلب مرّتين — تتابعياً] الثاني Idempotent لا مكرَّر');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, invoiceKey } = await buildTestEnv();
    const r1 = await service({ invoiceKey });
    const r2 = await service({ invoiceKey });

    ok('الطلب الأول ينشئ قيداً', r1.success && !r1.alreadyPosted);
    ok('✅ الثاني alreadyPosted=true — لا خطأ', r2.success && r2.alreadyPosted === true);
    eq('✅ ونفس journalId بالضبط', r2.journalId, r1.journalId);
    eq('✅ ونفس journalNumber', r2.journalNumber, r1.journalNumber);
    eq('✅✅ قيد واحد فقط في الدفتر — لا مضاعفة (يُبطل BUG-007 لهذا المسار تحديداً)',
        Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [نفس مفتاح idempotency] محسوب حتمياً من sourceType:sourceId:operation');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, invoiceKey } = await buildTestEnv();
    const r1 = await service({ invoiceKey });
    eq('المفتاح حتمي وقابل للتنبؤ', r1.idempotencyKey, `purchaseInvoice:${invoiceKey}:POST`);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [طلبان متزامنان حقيقيان] Promise.all على نفس الفاتورة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, invoiceKey } = await buildTestEnv();
    // نفس نمط Phase 4/5 §[B]: نقرتان بفارق أجزاء من الثانية — هنا حرفياً بلا فارق زمني إطلاقاً
    const [r1, r2] = await Promise.all([service({ invoiceKey }), service({ invoiceKey })]);

    const results = [r1, r2];
    const successCount = results.filter(r => r.success && !r.alreadyPosted).length;
    const dupCount = results.filter(r => r.success && r.alreadyPosted).length;

    ok('✅✅ واحد فقط نجح كترحيل جديد', successCount === 1, JSON.stringify(results));
    ok('✅✅ والآخر عاد Idempotent (alreadyPosted)', dupCount === 1, JSON.stringify(results));
    eq('✅✅✅ قيد واحد فقط في الدفتر رغم التزامن الحقيقي — هذا هو جوهر §8',
        Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length, 1);

    const winner = results.find(r => !r.alreadyPosted);
    const loser = results.find(r => r.alreadyPosted);
    eq('والخاسر يحمل journalId الفائز نفسه', loser.journalId, winner.journalId);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [خمسة طلبات متزامنة] — لا تُنتج أكثر من قيد واحد مهما زاد العدد');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, invoiceKey } = await buildTestEnv();
    const results = await Promise.all(Array.from({ length: 5 }, () => service({ invoiceKey })));
    const successCount = results.filter(r => !r.alreadyPosted).length;
    eq('واحد فقط نجح كجديد من أصل 5', successCount, 1);
    eq('قيد واحد فقط في الدفتر', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
    const uniqueJournalIds = new Set(results.map(r => r.journalId));
    eq('وكل الخمسة يحملون نفس journalId', uniqueJournalIds.size, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [إعادة محاولة بعد فشل ذرّي] — لا تُنتج قيدين');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, port, store, invoiceKey } = await buildTestEnv();
    const realUpdate = port.update;
    let failedOnce = false;
    port.update = async (r, values) => { if (!failedOnce) { failedOnce = true; throw new Error('boom'); } return realUpdate(r, values); };

    let err = null;
    try { await service({ invoiceKey }); } catch (e) { err = e; }
    ok('الأولى فشلت (AtomicityError)', err && err.name === 'AtomicityError');
    const r2 = await service({ invoiceKey });
    ok('إعادة المحاولة تنجح كترحيل جديد (الحالة استُرجعت إلى draft بعد الفشل)', r2.success && !r2.alreadyPosted);
    eq('وقيد واحد فقط بالنتيجة', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
}

console.log(summary() ? process.exit(1) : process.exit(0));
