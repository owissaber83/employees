// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  بناء قيد فاتورة مشتريات — نقيّة، منقولة من createJournalForPInv       [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لمنطق البناء في accounting.js:18673 (createJournalForPInv) —      ║
// ║  **باستثناء** الكتابة الفعلية (push/update) وتوليد رقم القيد وحل رموز الحسابات   ║
// ║  (`vendPayableAccount`/`getExpenseAccountForType`)، وهي مسؤولية طبقة الخدمة.     ║
// ║                                                                              ║
// ║  ⚠️ **مُثبتة بالمقارنة الفعلية** مع الدالة الحقيقية على بيانات Phase 4/5 —       ║
// ║  انظر tests/characterization/buildPurchaseInvoiceJournal.test.mjs. هذا هو       ║
// ║  «LEGACY BEHAVIOR TEST» المطلوب في §11 قبل استخدام أي منطق جديد.                ║
// ║                                                                              ║
// ║  🔴 حدّ موثَّق: legacy تدعم fallback إلى `getExpenseAccountForType` حين لا يوجد   ║
// ║  `debitAccountCode` على الفاتورة. **لم يُنقَل هنا** — هذه الدالة تتطلّب           ║
// ║  `debitAccountCode` صراحةً وترفض غيابه (ValidationError). راجع docs/services/    ║
// ║  posting.md «حدود معروفة».                                                    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2 } from '../../../../public/calc.js';
import { ValidationError, MissingAccountError } from '../../../services/accounting/errors/ValidationError.js';

/**
 * @param {object} p
 * @param {string} p.invoiceKey
 * @param {object} p.invoice          {number,date,vendorId,vendorRef,netBeforeTax,vatTotal,grandTotal,currency,exchangeRate,costCenter,projectId,debitAccountCode}
 * @param {object|null} p.vendor      {nameAr,...} أو null
 * @param {object|null} p.expenseAccount   حساب مُحلَّل مسبقاً {code,nameAr} — من debitAccountCode
 * @param {object|null} p.vendorAccount    حساب الموردين المُحلَّل {code,nameAr}
 * @param {object|null} p.vatInputAccount  حساب ضريبة المدخلات المُحلَّل {code,nameAr}، أو null إن غير موجود
 * @param {string} p.journalNumber    رقم القيد (مُولَّد ذرّياً من طبقة الخدمة)
 * @param {string} p.baseCurrencyCode العملة الدفترية (مثال 'SAR')
 * @param {string} p.now              ISO timestamp
 * @param {string} p.userId
 * @returns {{journal:object, warnings:string[]}}
 * @throws {ValidationError|MissingAccountError}
 */
export function buildPurchaseInvoiceJournal({
    invoiceKey, invoice, vendor, expenseAccount, vendorAccount, vatInputAccount,
    journalNumber, baseCurrencyCode, now, userId
}) {
    if (!invoice) throw new ValidationError('الفاتورة مطلوبة');
    if (!invoice.debitAccountCode) {
        // 🔴 حدّ موثَّق أعلاه — لا fallback إلى getExpenseAccountForType في هذا الإصدار
        throw new ValidationError('debitAccountCode مطلوب على الفاتورة — fallback نوع المصروف غير مدعوم بعد',
            { invoiceKey, expenseType: invoice.expenseType });
    }
    if (!expenseAccount) {
        throw new MissingAccountError(`الحساب ${invoice.debitAccountCode} غير موجود في شجرة الحسابات`,
            { accountCode: invoice.debitAccountCode });
    }
    if (!vendorAccount) {
        throw new MissingAccountError('حساب الموردين غير موجود في شجرة الحسابات', { invoiceKey });
    }

    const warnings = [];
    const baseCode = baseCurrencyCode || 'SAR';
    const curCode = invoice.currency || baseCode;
    const fx = (curCode !== baseCode) ? (parseFloat(invoice.exchangeRate) || 1) : 1;
    const cvt = v => round2((Number(v) || 0) * fx);
    const grandBase = cvt(invoice.grandTotal);
    const curNote = fx !== 1 ? ` [${invoice.grandTotal} ${curCode} × ${fx}]` : '';

    const lines = [];
    lines.push({
        accountCode: expenseAccount.code,
        accountName: expenseAccount.nameAr,
        description: `فاتورة ${invoice.number} (مورد: ${invoice.vendorRef}) - ${(vendor && vendor.nameAr) || ''}${curNote}`,
        costCenter: invoice.costCenter || invoice.projectId || '',
        debit: cvt(invoice.netBeforeTax),
        credit: 0
    });

    if ((Number(invoice.vatTotal) || 0) > 0 && vatInputAccount) {
        lines.push({
            accountCode: vatInputAccount.code,
            accountName: vatInputAccount.nameAr,
            description: `VAT مدخل - فاتورة ${invoice.number}`,
            costCenter: invoice.costCenter || invoice.projectId || '',
            debit: cvt(invoice.vatTotal),
            credit: 0
        });
    } else if ((Number(invoice.vatTotal) || 0) > 0) {
        // مطابقة حرفية للسلوك القديم: الضريبة تُطوى في سطر المصروف + تحذير بدل toast
        lines[0].debit = round2(lines[0].debit + cvt(invoice.vatTotal));
        warnings.push('حساب 1180 (VAT مدخل) غير موجود — أُضيفت الضريبة للمصروفات');
    }

    const totDebit = lines.reduce((s, l) => s + l.debit, 0);
    const roundDiff = round2(grandBase - totDebit);
    if (Math.abs(roundDiff) >= 0.01) lines[0].debit = round2(lines[0].debit + roundDiff);

    lines.push({
        accountCode: vendorAccount.code,
        accountName: vendorAccount.nameAr,
        description: `استحقاق فاتورة ${invoice.number}`,
        costCenter: invoice.costCenter || invoice.projectId || '',
        debit: 0,
        credit: grandBase
    });

    const journal = {
        number: journalNumber,
        date: invoice.date,
        reference: 'فاتورة مشتريات ' + invoice.number + ' / مورد: ' + invoice.vendorRef,
        description: `إثبات فاتورة مشتريات ${invoice.number} - ${(vendor && vendor.nameAr) || ''}`,
        lines,
        totalDebit: grandBase,
        totalCredit: grandBase,
        currency: curCode,
        exchangeRate: fx,
        foreignTotal: invoice.grandTotal,
        status: 'posted',
        sourceType: 'purchase_invoice',
        sourceKey: invoiceKey,
        createdAt: now,
        createdBy: userId,
        postedAt: now,
        postedBy: userId
    };

    return { journal, warnings };
}
