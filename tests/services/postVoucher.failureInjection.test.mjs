// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEW SAFETY INVARIANT TEST — حقن الفشل الشامل لترحيل السند             [Phase 7] ║
// ║  التشغيل: npm run test:svc:voucher:failure                                    ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  السيناريوهات المُغطّاة في ملفات أخرى تُشار إليها بدل تكرارها:                    ║
// ║    فشل أثناء الالتزام الذرّي النهائي وتعويضه → postVoucher.atomicity.test.mjs   ║
// ║    التكرار والتزامن                          → postVoucher.idempotency.test.mjs║
// ║    تجاوز التخصيص + تعويض جزئي + سباق حقيقي    → postVoucher.allocation.test.mjs ║
// ║    عزل المستأجرين                            → postVoucher.multiTenant.test.mjs║
// ║    تكامل القيد (assertBalanced/validateJournal) → journalIntegrity.test.mjs (مشترك مع Phase 6) ║
// ║  هذا الملف يغطّي **الباقي**: سند غير موجود · فاتورة تخصيص غير موجودة · بنية       ║
// ║  تخصيصات غير صالحة · حساب مفقود · نوع سند غير معروف · فشل حجز رقم القيد.         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { makeCounters } from './testKit.mjs';
import { buildVoucherTestEnv, draftReceipt, draftInvoice } from './voucherTestKit.mjs';
import { rawPath } from './fakePostingRtdb.mjs';

const { eq, ok, summary } = makeCounters();

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💉 [سند مصدر مفقود] — لا سند بهذا المفتاح إطلاقاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service } = await buildVoucherTestEnv({ voucher: null });
    let err = null;
    try { await service({ voucherKey: 'GHOST-KEY', voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('يرمي ValidationError — لا استثناء غير مُصنَّف', err && err.name === 'ValidationError', err && err.message);
    eq('برسالة توضّح غياب السند', err.message, 'السند غير موجود');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💉 [M] فاتورة تخصيص غير موجودة — تُرفَض صراحةً (بخلاف القديم الذي كان يتجاوزها بصمت)');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv({
        voucher: draftReceipt({ amount: 1000, allocations: { GHOST: 1000 } }),
        invoices: {} // لا فاتورة GHOST إطلاقاً
    });
    let err = null;
    try { await service({ voucherKey, voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('🔴 يرمي ValidationError — القديم كان "يتجاوز بصمت" (console.warn فقط)، هنا رفض صريح', err && err.name === 'ValidationError', err && err.message);
    eq('السند بقي draft', rawPath(store, `tenants/T1/ledger/receipts/${voucherKey}`).status, 'draft');
    ok('ولا قيد يتيم', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💉 [بنية تخصيصات غير صالحة] مفتاح مكرَّر — يُكتشَف قبل أي معاملة على أي فاتورة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // كائن JS لا يستطيع فعلياً حمل مفتاح مكرَّر — نختبر بدلاً منه مبلغاً غير صالح (نفس فحص validateAllocationSet)
    const { service, store, voucherKey } = await buildVoucherTestEnv({
        voucher: draftReceipt({ amount: 1000, allocations: { INV1: -500 } }),
        invoices: { INV1: draftInvoice() }
    });
    let err = null;
    try { await service({ voucherKey, voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('يرمي ValidationError (مبلغ تخصيص غير صالح) قبل أي كتابة', err && err.name === 'ValidationError', err && err.message);
    eq('السند بقي draft', rawPath(store, `tenants/T1/ledger/receipts/${voucherKey}`).status, 'draft');
    eq('الفاتورة لم تُلمَس', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💉 [حساب طرف مفقود] عميل بلا حساب مذكور — يُرفض قبل حجز أي رقم');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, port, store, voucherKey } = await buildVoucherTestEnv({ accounts: { a1010: { code: '1010', nameAr: 'الصندوق' } } }); // 1130 مفقود
    let err = null;
    try { await service({ voucherKey, voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('يرمي MissingAccountError', err && err.name === 'MissingAccountError', err && err.message);
    const counterYear = new Date().getFullYear();
    const c = await port.get(port.ref(port.db, `ledger/counters/jrn/JV/${counterYear}`));
    ok('✅ عدّاد ترقيم القيود لم يتحرّك — لا رقم مُهدَر على فشل مؤكَّد سلفاً', !c.exists());
    eq('السند بقي draft', rawPath(store, `tenants/T1/ledger/receipts/${voucherKey}`).status, 'draft');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💉 [نوع سند غير معروف] — يُرفض بنيوياً قبل أي قراءة أو كتابة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service } = await buildVoucherTestEnv();
    let err = null;
    try { await service({ voucherKey: 'X', voucherType: 'transfer' }); } catch (e) { err = e; }
    ok('يرمي ValidationError', err && err.name === 'ValidationError', err && err.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n💉 [فشل حجز رقم القيد] بعد نجاح كل التخصيصات — يُعوَّض التخصيص أيضاً لا الحالة فقط');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, port, store, voucherKey } = await buildVoucherTestEnv();
    const realRunTransaction = port.runTransaction;
    let calls = 0;
    port.runTransaction = async (r, fn) => {
        calls++;
        // 1: مطالبة حالة السند (يجب أن تنجح) · 2: تخصيص INV1 (يجب أن تنجح) · 3: حجز رقم القيد — نُفشله
        if (calls === 3) throw new Error('counter reservation failed');
        return realRunTransaction(r, fn);
    };

    let err = null;
    try { await service({ voucherKey, voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('الخطأ يصعد للمستدعي (خطأ تخزين مترجَم)', !!err, err && err.message);
    eq('🔴✅ السند استُرجع إلى draft', rawPath(store, `tenants/T1/ledger/receipts/${voucherKey}`).status, 'draft');
    eq('🔴✅ والفاتورة عُوِّضت — عادت إلى 0 رغم نجاح تخصيصها قبل فشل حجز الرقم', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 0);
    ok('ولا قيد يتيم', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length === 0);
}

console.log(summary() ? process.exit(1) : process.exit(0));
