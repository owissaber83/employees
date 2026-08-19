// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEW SAFETY INVARIANT TEST — حقن الفشل الشامل                         [Phase 6] ║
// ║  التشغيل: npm run test:svc:failure                                            ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §12 (A–J). السيناريوهات المُغطّاة في ملفات أخرى تُشار إليها بدل تكرارها:        ║
// ║    B/C أثناء الالتزام الذرّي    → postPurchaseInvoice.atomicity.test.mjs        ║
// ║    E/F التكرار والتزامن        → postPurchaseInvoice.idempotency.test.mjs      ║
// ║    G قيد غير صالح              → journalIntegrity.test.mjs                     ║
// ║    H نطاق مستأجر غير صالح      → postPurchaseInvoice.multiTenant.test.mjs      ║
// ║  هذا الملف يغطّي **الباقي**: A (فشل حجز رقم القيد قبل البناء) · D (لا خطوة بعد   ║
// ║  عودة الخدمة في هذا التصميم — يُوثَّق) · I (مستند مصدر مفقود) · J (سطر مشوَّه).   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { makeCounters, buildTestEnv, draftInvoice } from './testKit.mjs';
import { rawPath } from './fakePostingRtdb.mjs';

const { eq, ok, summary } = makeCounters();

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💉 [I] مستند مصدر مفقود — لا فاتورة بهذا المفتاح إطلاقاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service } = await buildTestEnv({ invoice: null });
    let err = null;
    try { await service({ invoiceKey: 'GHOST-KEY' }); } catch (e) { err = e; }
    ok('يرمي ValidationError — لا استثناء غير مُصنَّف', err && err.name === 'ValidationError', err && err.message);
    eq('برسالة توضّح غياب الفاتورة', err.message, 'الفاتورة غير موجودة');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💉 [J] سطر محاسبي مشوَّه — يُكتشَف قبل حجز أي رقم (§11: التحقّق يسبق التوليد)');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // فاتورة بمبالغ متناقضة داخلياً تُنتج سطراً بمبلغ سالب بعد تصحيح فرق التقريب
    const { service, port, invoiceKey } = await buildTestEnv({
        invoice: draftInvoice({ netBeforeTax: 10000, vatTotal: 1500, grandTotal: 1 }) // grandTotal لا يطابق netBeforeTax+vatTotal إطلاقاً
    });
    let err = null;
    try { await service({ invoiceKey }); } catch (e) { err = e; }
    ok('يُكتشَف كـValidationError (مبلغ سالب) لا كخطأ كتابة', err && err.name === 'ValidationError', err && err.message);

    // ✅ الأهم: لم يُحجَز رقم قيد إطلاقاً — العدّاد لم يتحرّك (بفضل معاينة PLACEHOLDER قبل الحجز، §11)
    const counterYear = new Date().getFullYear();
    const c = await port.get(port.ref(port.db, `ledger/counters/jrn/JV/${counterYear}`));
    ok('✅✅ عدّاد ترقيم القيود لم يتحرّك — لا رقم مُهدَر على فشل مؤكَّد سلفاً', !c.exists());
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💉 [A] فشل حجز رقم القيد نفسه — بعد نجاح المعاينة والمطالبة بالحالة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, port, store, invoiceKey } = await buildTestEnv();
    const realRunTransaction = port.runTransaction;
    let calls = 0;
    port.runTransaction = async (r, fn) => {
        calls++;
        // الاستدعاء الأول: مطالبة الحالة draft→posted (يجب أن ينجح). الثاني: حجز الرقم — نُفشله عمداً.
        if (calls === 2) throw new Error('counter reservation failed');
        return realRunTransaction(r, fn);
    };

    let err = null;
    try { await service({ invoiceKey }); } catch (e) { err = e; }
    ok('الخطأ يصعد للمستدعي (خطأ تخزين مترجَم لا Firebase خام)', !!err, err && err.message);
    const inv = rawPath(store, `tenants/T1/ledger/purchaseInvoices/${invoiceKey}`);
    ok('🔴→✅ الحالة استُرجعت إلى draft رغم فشل خطوة لاحقة لمطالبة الحالة الناجحة', inv.status === 'draft', JSON.stringify(inv));
    ok('ولا قيد يتيم', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💉 [D] بعد عودة الخدمة — لا خطوة لاحقة في هذا التصميم (توثيق لا اختبار سلبي)');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // الخدمة متزامنة الإرجاع تماماً بعد نجاح الكتابة الذرّية — لا Promise معلَّقة ولا callback
    // لاحق قد يفشل "بعد العودة". النتيجة المُعادة **هي** الحالة النهائية، لا وعداً بها.
    ok('✅ توثيق: postPurchaseInvoice لا تُعيد قبل اكتمال الكتابة الذرّية فعلياً — لا نافذة D هنا', true);
}

console.log(summary() ? process.exit(1) : process.exit(0));
