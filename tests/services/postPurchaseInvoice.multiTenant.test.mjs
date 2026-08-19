// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEW SAFETY INVARIANT TEST — عزل المستأجرين                           [Phase 6] ║
// ║  التشغيل: npm run test:svc:tenant                                             ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §7 (مطلق) + §13 «Multi-tenancy»: ترحيل A · ترحيل B · محاولة وصول عابرة ·        ║
// ║  حماية المسار العام. الإثبات هنا **تنفيذي** على متجر RTDB مشترك حقيقي —         ║
// ║  fakePostingRtdb.mjs يطبّق نفس منطق ref()/scopeUpdates() من app.js حرفياً.       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { makeCounters, buildTestEnv, draftInvoice, STD_ACCOUNTS, STD_VENDORS } from './testKit.mjs';
import { createSharedStore, createTenantPort, rawPath } from './fakePostingRtdb.mjs';

const { eq, ok, summary } = makeCounters();

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏢 [ترحيل مستقلّ] كل مستأجر يكتب قيده تحت شجرته فقط');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const shared = createSharedStore();
    const A = await buildTestEnv({ tenantId: 'T1', shared, invoice: draftInvoice({ netBeforeTax: 10000, vatTotal: 1500, grandTotal: 11500 }) });
    const B = await buildTestEnv({ tenantId: 'T2', shared, invoice: draftInvoice({ netBeforeTax: 869.57, vatTotal: 130.43, grandTotal: 1000 }) });

    const ra = await A.service({ invoiceKey: A.invoiceKey });
    const rb = await B.service({ invoiceKey: B.invoiceKey });

    ok('ترحيل A نجح', ra.success && !ra.alreadyPosted);
    ok('ترحيل B نجح باستقلالية', rb.success && !rb.alreadyPosted);

    const jA = rawPath(shared, `tenants/T1/ledger/journalEntries/${ra.journalId}`);
    const jB = rawPath(shared, `tenants/T2/ledger/journalEntries/${rb.journalId}`);
    eq('قيد A بالمبلغ الصحيح (11500)', jA.totalDebit, 11500);
    eq('قيد B بالمبلغ الصحيح (1000) — مستقلّ تماماً', jB.totalDebit, 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [محاولة وصول عابر للمستأجرين] — لا تسرّب رغم مفاتيح متطابقة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const shared = createSharedStore();
    // نفس invoiceKey بالضبط في الشركتين — سيناريو واقعي (المفاتيح تُنشَأ بمعزل عن بعضها)
    const A = await buildTestEnv({ tenantId: 'T1', shared, invoiceKey: 'PINV-SAME', invoice: draftInvoice({ netBeforeTax: 100, vatTotal: 0, grandTotal: 100 }) });
    const B = await buildTestEnv({ tenantId: 'T2', shared, invoiceKey: 'PINV-SAME', invoice: draftInvoice({ netBeforeTax: 200, vatTotal: 0, grandTotal: 200 }) });

    const ra = await A.service({ invoiceKey: 'PINV-SAME' });
    ok('ترحيل A نجح', ra.success);

    // منفذ B يحاول ترحيل "نفس" المفتاح — يجب أن يقرأ فاتورته هو (200) لا فاتورة A (100)
    const rb = await B.service({ invoiceKey: 'PINV-SAME' });
    ok('🔴✅ ترحيل B لم يتأثّر بترحيل A إطلاقاً — نجح بشكل مستقلّ رغم نفس المفتاح', rb.success && !rb.alreadyPosted);

    const jB = rawPath(shared, `tenants/T2/ledger/journalEntries/${rb.journalId}`);
    eq('🔴✅ قيد B بمبلغ فاتورة B (200) لا فاتورة A', jB.totalDebit, 200);

    // والفحص الأهم: عدد القيود في كل شجرة = 1 بالضبط، لا صفر ولا اثنان
    eq('شجرة T1: قيد واحد بالضبط', Object.keys(rawPath(shared, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
    eq('شجرة T2: قيد واحد بالضبط', Object.keys(rawPath(shared, 'tenants/T2/ledger/journalEntries') || {}).length, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [حماية المسار العام] — التحديث الذرّي لا يكتب خارج tenants/{tid}/ledger');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const shared = createSharedStore();
    const A = await buildTestEnv({ tenantId: 'T1', shared });
    await A.service({ invoiceKey: A.invoiceKey });

    // المسار العام (بلا بادئة tenants/) يجب أن يبقى فارغاً تماماً بعد الترحيل
    ok('لا كتابة إطلاقاً على ledger/journalEntries بلا بادئة مستأجر (المسار العام)',
        !rawPath(shared, 'ledger/journalEntries'));
    ok('ولا على ledger/purchaseInvoices بلا بادئة',
        !rawPath(shared, 'ledger/purchaseInvoices'));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏢 [مستأجر بلا معرّف — tenantId=null] — يكتب في النطاق العام لا في tenants/*');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // يحاكي وضعاً نظرياً (لا ينبغي أن يحدث في التطبيق الحقيقي — buildRefs يُستدعى دائماً
    // بعد معرفة المستأجر) لكنه يوثّق دقّة محاكاة ref()/scopeUpdates() هنا بالضبط.
    const shared = createSharedStore();
    const port = createTenantPort(shared, null);
    await port.update(port.ref(port.db, 'ledger/purchaseInvoices/K1'), { status: 'draft', debitAccountCode: '5110', vendorId: 'V1', grandTotal: 100, netBeforeTax: 100, vatTotal: 0, number: 'P1', vendorRef: 'X', date: '2026-01-01', currency: 'SAR', exchangeRate: 1 });
    ok('بلا مستأجر: يُكتب مباشرةً تحت ledger/ بلا بادئة tenants/', !!rawPath(shared, 'ledger/purchaseInvoices/K1'));
    ok('ولا يظهر تحت أي tenants/*', !rawPath(shared, 'tenants'));
}

console.log(summary() ? process.exit(1) : process.exit(0));
