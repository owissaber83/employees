// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEW SAFETY INVARIANT TEST — ذرّية ترحيل السند                        [Phase 7] ║
// ║  التشغيل: npm run test:svc:voucher:atomicity                                  ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ترحيل ناجح · فشل قبل الالتزام (حساب مفقود) · فشل أثناء الكتابة الذرّية النهائية  ║
// ║  (بعد نجاح كل التخصيصات) · لا قيد يتيم · لا حالة جزئية على السند أو الفواتير.    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { makeCounters } from './testKit.mjs';
import { buildVoucherTestEnv, draftReceipt, draftInvoice, STD_ACCOUNTS } from './voucherTestKit.mjs';
import { rawPath } from './fakePostingRtdb.mjs';

const { eq, ok, summary } = makeCounters();

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚛️ [A] ترحيل ناجح — سند + فاتورة واحدة، كل شيء متّسق');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv();
    const r = await service({ voucherKey, voucherType: 'receipt' });
    ok('نجح', r.success && !r.alreadyPosted);
    const v = rawPath(store, `tenants/T1/ledger/receipts/${voucherKey}`);
    eq('السند posted', v.status, 'posted');
    eq('journalEntryKey مطابق للناتج', v.journalEntryKey, r.journalId);
    eq('الفاتورة استُلمت المبلغ الصحيح', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 6000);
    ok('والقيد موجود فعلياً', !!rawPath(store, `tenants/T1/ledger/journalEntries/${r.journalId}`));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚛️ [B] فشل قبل لمس أي فاتورة — حساب صندوق مفقود');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv({ accounts: { a1130: STD_ACCOUNTS.a1130 } }); // 1010 مفقود
    let err = null;
    try { await service({ voucherKey, voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('يرمي MissingAccountError', err && err.name === 'MissingAccountError', err && err.message);
    const v = rawPath(store, `tenants/T1/ledger/receipts/${voucherKey}`);
    eq('🔴→✅ السند يبقى draft — لم يُقفَل بلا سبب', v.status, 'draft');
    eq('والفاتورة لم تُلمَس إطلاقاً', rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 0);
    ok('ولا قيد يتيم', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚛️ [C] فشل أثناء الكتابة الذرّية النهائية — بعد نجاح كل التخصيصات');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, port, store, voucherKey } = await buildVoucherTestEnv();
    const realUpdate = port.update;
    let calls = 0;
    port.update = async (r, values) => {
        calls++;
        if (calls === 1) throw new Error('network lost during final atomic commit');
        return realUpdate(r, values);
    };

    let err = null;
    try { await service({ voucherKey, voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('يرمي AtomicityError', err && err.name === 'AtomicityError', err && err.message);

    const v = rawPath(store, `tenants/T1/ledger/receipts/${voucherKey}`);
    ok('🔴→✅ السند استُرجع إلى draft', v.status === 'draft', JSON.stringify(v));
    ok('ولا رابط جزئي (journalEntryKey) تسرّب', !v.journalEntryKey);
    eq('🔴→✅ والفاتورة عُوِّضت — عادت إلى 0 رغم أن تخصيصها نجح قبل فشل الالتزام النهائي',
        rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 0);
    ok('ولا قيد وُجد في الدفتر', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚛️ [D] بعد فشل الالتزام النهائي — إعادة المحاولة تنجح وتُنتج قيداً واحداً وتخصيصاً واحداً فقط');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, port, store, voucherKey } = await buildVoucherTestEnv();
    const realUpdate = port.update;
    let failedOnce = false;
    port.update = async (r, values) => {
        if (!failedOnce) { failedOnce = true; throw new Error('transient failure'); }
        return realUpdate(r, values);
    };

    let err = null;
    try { await service({ voucherKey, voucherType: 'receipt' }); } catch (e) { err = e; }
    ok('المحاولة الأولى تفشل كما هو متوقَّع', err && err.name === 'AtomicityError');

    const r2 = await service({ voucherKey, voucherType: 'receipt' });
    ok('إعادة المحاولة تنجح', r2.success && !r2.alreadyPosted);
    eq('وقيد واحد فقط في الدفتر', Object.keys(rawPath(store, 'tenants/T1/ledger/journalEntries') || {}).length, 1);
    eq('🔴→✅ وتخصيص واحد فقط طُبِّق على الفاتورة (لا مضاعفة من المحاولة الفاشلة)',
        rawPath(store, 'tenants/T1/ledger/salesInvoices/INV1').paidAmount, 6000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n⚛️ [E] سند بلا تخصيصات إطلاقاً — يُرحَّل بقيد فقط، بلا لمس أي فاتورة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { service, store, voucherKey } = await buildVoucherTestEnv({ voucher: draftReceipt({ allocations: null }), invoices: {} });
    const r = await service({ voucherKey, voucherType: 'receipt' });
    ok('نجح', r.success && !r.alreadyPosted);
    eq('بلا نتائج تخصيص', r.allocationResults, []);
    ok('قيد وُجد', !!rawPath(store, `tenants/T1/ledger/journalEntries/${r.journalId}`));
}

console.log(summary() ? process.exit(1) : process.exit(0));
