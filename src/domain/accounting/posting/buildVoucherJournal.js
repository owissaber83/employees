// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  بناء قيد سند قبض/صرف — نقيّة، منقولة من createJournalForVoucher      [Phase 7] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لمنطق البناء في accounting.js:19814 — **باستثناء** الكتابة        ║
// ║  الفعلية (push/update) وتوليد رقم القيد وحل رموز الحسابات (`custReceivableAccount`/ ║
// ║  `vendPayableAccount`)، وهي مسؤولية طبقة الخدمة (نفس تقسيم Phase 6).            ║
// ║                                                                              ║
// ║  ⚠️ **مُثبتة بالمقارنة الفعلية** مع الدالة الحقيقية —                          ║
// ║  انظر tests/characterization/buildVoucherJournal.test.mjs.                     ║
// ║                                                                              ║
// ║  لا `ensureStdAccount` في هذا المسار (مطابق لسلوك accounting.js — رفض صريح لا  ║
// ║  إنشاء تلقائي عند غياب حساب) — نفس خاصية فاتورة المشتريات في Phase 6.          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2 } from '../../../../public/calc.js';
import { ValidationError, MissingAccountError } from '../../../services/accounting/errors/ValidationError.js';

/**
 * @param {object} p
 * @param {string} p.voucherKey
 * @param {object} p.voucher        {number,type:'receipt'|'payment',partyId,date,amount,cashAccountCode,currency,exchangeRate,projectId,costCenter,description}
 * @param {object|null} p.party     العميل (receipt) أو المورد (payment) — {nameAr,...}
 * @param {object|null} p.cashAccount    حساب الصندوق/البنك المُحلَّل {code,nameAr}
 * @param {object|null} p.partyAccount   حساب العملاء (receipt) أو الموردين (payment) المُحلَّل {code,nameAr}
 * @param {string} p.journalNumber
 * @param {string} p.baseCurrencyCode
 * @param {string} p.now
 * @param {string} p.userId
 * @returns {{journal:object}}
 * @throws {ValidationError|MissingAccountError}
 */
export function buildVoucherJournal({
    voucherKey, voucher, party, cashAccount, partyAccount,
    journalNumber, baseCurrencyCode, now, userId
}) {
    if (!voucher) throw new ValidationError('السند مطلوب');
    if (voucher.type !== 'receipt' && voucher.type !== 'payment') {
        throw new ValidationError(`نوع سند غير معروف: ${voucher.type}`, { voucherKey, type: voucher.type });
    }
    if (!cashAccount) {
        throw new MissingAccountError(`حساب الصندوق/البنك ${voucher.cashAccountCode} غير موجود في شجرة الحسابات`,
            { voucherKey, accountCode: voucher.cashAccountCode });
    }
    if (!partyAccount) {
        throw new MissingAccountError(
            voucher.type === 'receipt' ? 'حساب العملاء غير موجود في شجرة الحسابات' : 'حساب الموردين غير موجود في شجرة الحسابات',
            { voucherKey });
    }

    const baseCode = baseCurrencyCode || 'SAR';
    const curCode = voucher.currency || baseCode;
    const fx = (curCode !== baseCode) ? (parseFloat(voucher.exchangeRate) || 1) : 1;
    const amtBase = round2((Number(voucher.amount) || 0) * fx);
    const curNote = fx !== 1 ? ` [${voucher.amount} ${curCode} × ${fx}]` : '';

    const lines = [];
    if (voucher.type === 'receipt') {
        lines.push({
            accountCode: cashAccount.code, accountName: cashAccount.nameAr,
            description: `قبض من ${(party && party.nameAr) || ''} - سند ${voucher.number}${curNote}`,
            costCenter: voucher.projectId || '', debit: amtBase, credit: 0
        });
        lines.push({
            accountCode: partyAccount.code, accountName: partyAccount.nameAr,
            description: `سداد فواتير ${(party && party.nameAr) || ''}`,
            costCenter: voucher.projectId || '', debit: 0, credit: amtBase
        });
    } else {
        lines.push({
            accountCode: partyAccount.code, accountName: partyAccount.nameAr,
            description: `صرف لـ ${(party && party.nameAr) || ''} - سند ${voucher.number}${curNote}`,
            costCenter: voucher.projectId || '', debit: amtBase, credit: 0
        });
        lines.push({
            accountCode: cashAccount.code, accountName: cashAccount.nameAr,
            description: `سداد فواتير ${(party && party.nameAr) || ''}`,
            costCenter: voucher.projectId || '', debit: 0, credit: amtBase
        });
    }

    const journal = {
        number: journalNumber,
        date: voucher.date,
        reference: voucher.number,
        description: `${voucher.type === 'receipt' ? 'سند قبض' : 'سند صرف'} ${voucher.number} - ${voucher.description || ''}`,
        lines,
        totalDebit: amtBase, totalCredit: amtBase,
        currency: curCode, exchangeRate: fx, foreignTotal: voucher.amount,
        status: 'posted',
        sourceType: voucher.type === 'receipt' ? 'receipt' : 'payment',
        sourceKey: voucherKey,
        createdAt: now, createdBy: userId, postedAt: now, postedBy: userId
    };

    return { journal };
}
