// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خدمة التطبيق: ترحيل سند قبض/صرف + تخصيصه على N فاتورة                [Phase 7] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  UI/Legacy ──▶ [هذا الملف] ──▶ Domain (بناء + تحقّق) ──▶ Repository (تعويضي) ──▶ RTDB ║
// ║                                                                              ║
// ║  🔒 محايدة عن التخزين تماماً — لا Firebase هنا، فقط عقود المستودعات (نفس نمط     ║
// ║  postPurchaseInvoice.js في Phase 6). لا DOM ولا `toast`/`window.*` — نتيجة أو    ║
// ║  خطأ مُصنَّف فقط؛ المهايئ يترجم لواجهة المستخدم.                                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildVoucherJournal } from '../../../domain/accounting/posting/buildVoucherJournal.js';
import { resolveCustomerReceivableAccountCode } from '../../../domain/accounting/posting/resolveCustomerReceivableAccount.js';
import { resolveVendorPayableAccountCode } from '../../../domain/accounting/posting/resolveVendorPayableAccount.js';
import { assertBalanced } from '../../../domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../../domain/accounting/posting/validateJournal.js';
import { validateAllocationSet } from '../../../domain/accounting/allocation/computeAllocation.js';
import { buildIdempotencyKey } from '../idempotency/idempotencyKey.js';
import { ValidationError, MissingAccountError } from '../errors/ValidationError.js';

const PLACEHOLDER_NUMBER = '__PENDING__'; // لا يُكتب أبداً — يُستبدَل قبل أي كتابة فعلية

/**
 * @param {object} deps
 * @param {import('../../../repositories/contracts/ChartOfAccountsRepository.js').ChartOfAccountsRepository} deps.chartOfAccountsRepo
 * @param {import('../../../repositories/contracts/VoucherPostingRepository.js').VoucherPostingRepository} deps.voucherPostingRepo
 * @param {(key:string, type:'receipt'|'payment')=>Promise<object|null>} deps.getVoucher  يعيد سجل السند بمفتاحه ونوعه
 * @param {(id:string)=>Promise<object|null>} [deps.getCustomer]  للسندات receipt
 * @param {(id:string)=>Promise<object|null>} [deps.getVendor]    للسندات payment
 * @param {object} deps.cfg      { baseCurrencyCode, arApMode } — نفس شكل `cfg` القديم
 * @param {{uid:string}} deps.currentUser
 * @param {()=>string} [deps.now]  للاختبار — افتراضياً `new Date().toISOString()`
 */
export function createPostVoucherService(deps) {
    const {
        chartOfAccountsRepo, voucherPostingRepo, getVoucher,
        getCustomer = async () => null, getVendor = async () => null,
        cfg = {}, currentUser, now = () => new Date().toISOString()
    } = deps;

    if (!chartOfAccountsRepo) throw new Error('chartOfAccountsRepo مطلوب');
    if (!voucherPostingRepo) throw new Error('voucherPostingRepo مطلوب');
    if (!getVoucher) throw new Error('getVoucher مطلوب');

    /**
     * @param {{voucherKey:string, voucherType:'receipt'|'payment'}} input
     * @returns {Promise<{success:true, journalId:string, journalNumber:string, sourceId:string, idempotencyKey:string, alreadyPosted:boolean, allocationResults?:Array}>}
     */
    return async function postVoucher({ voucherKey, voucherType }) {
        if (!voucherKey) throw new ValidationError('voucherKey مطلوب');
        if (voucherType !== 'receipt' && voucherType !== 'payment') {
            throw new ValidationError(`نوع سند غير معروف: ${voucherType}`, { voucherKey, voucherType });
        }

        const voucher = await getVoucher(voucherKey, voucherType);
        if (!voucher) throw new ValidationError('السند غير موجود', { voucherKey });

        const idempotencyKey = buildIdempotencyKey({ sourceType: voucherType, sourceId: voucherKey, operation: 'POST' });

        // ── حلّ الحسابات (طبقة الخدمة — لا الدومين، ولا المستودع) ──────────────────
        const party = voucher.partyId
            ? await (voucherType === 'receipt' ? getCustomer(voucher.partyId) : getVendor(voucher.partyId))
            : null;

        if (!voucher.cashAccountCode) {
            throw new ValidationError('cashAccountCode مطلوب على السند', { voucherKey });
        }
        const cashAccount = await chartOfAccountsRepo.getByCode(voucher.cashAccountCode);
        if (!cashAccount) {
            throw new MissingAccountError(`حساب الصندوق/البنك ${voucher.cashAccountCode} غير موجود في شجرة الحسابات`, { voucherKey, accountCode: voucher.cashAccountCode });
        }

        const allAccounts = await chartOfAccountsRepo.list();
        const chartOfAccounts = Object.fromEntries(allAccounts.map(a => [a.__key, a]));
        const partyAccountCode = voucherType === 'receipt'
            ? resolveCustomerReceivableAccountCode({ customerId: voucher.partyId, customers: party ? { [voucher.partyId]: party } : {}, chartOfAccounts, cfg })
            : resolveVendorPayableAccountCode({ vendorId: voucher.partyId, vendors: party ? { [voucher.partyId]: party } : {}, chartOfAccounts, cfg });
        const partyAccount = await chartOfAccountsRepo.getByCode(partyAccountCode);
        if (!partyAccount) {
            throw new MissingAccountError(
                voucherType === 'receipt' ? 'حساب العملاء غير موجود في شجرة الحسابات' : 'حساب الموردين غير موجود في شجرة الحسابات',
                { voucherKey });
        }

        const nowIso = now();
        const userId = (currentUser && currentUser.uid) || 'system';
        const buildInputs = {
            voucherKey, voucher: { ...voucher, type: voucherType }, party, cashAccount, partyAccount,
            baseCurrencyCode: cfg.baseCurrencyCode || 'SAR', now: nowIso, userId
        };

        // ── §11: تحقّق مسبق برقم مؤقّت — يكشف أي عطل بنيوي **قبل** حجز رقم قيد حقيقي
        // أو لمس أي فاتورة (نفس انضباط postPurchaseInvoice) ────────────────────────
        const preview = buildVoucherJournal({ ...buildInputs, journalNumber: PLACEHOLDER_NUMBER });
        validateJournal(preview.journal);
        assertBalanced(preview.journal);

        // ── فحص بنيوي مبكر على مجموعة التخصيصات — قبل أي معاملة على أي فاتورة ──────
        validateAllocationSet(voucher.allocations);

        const buildJournal = journalNumber => buildVoucherJournal({ ...buildInputs, journalNumber });

        try {
            const result = await voucherPostingRepo.postVoucherAtomic({
                voucherKey, voucherType, allocations: voucher.allocations, buildJournal, journalBookPrefix: 'JV'
            });
            return { success: true, ...result, sourceId: voucherKey, idempotencyKey };
        } catch (e) {
            if (e && e.name === 'DuplicatePostingError') {
                // Idempotent: لا نعتبرها فشلاً — نعيد النتيجة الأصلية (§8، نفس سلوك Phase 6)
                const original = (e.details && e.details.original) || {};
                return {
                    success: true, alreadyPosted: true,
                    journalId: original.journalId || null,
                    journalNumber: original.journalNumber || null,
                    sourceId: voucherKey, idempotencyKey
                };
            }
            throw e;
        }
    };
}
