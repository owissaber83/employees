// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  بناء قيد الإشعار المدين — نقيّة، منقولة من createJournalForDebitNote [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لمنطق البناء في accounting.js:16262.                             ║
// ║                                                                              ║
// ║  عكس فاتورة المشتريات:                                                        ║
// ║      مدين  الموردون (grandTotal)                                               ║
// ║      دائن  المصروف (netBeforeTax)  ← + فرق التقريب                            ║
// ║      دائن  ضريبة المدخلات 1180 (vatTotal)                                      ║
// ║                                                                              ║
// ║  ⚠️ **ليس مرآةً للإشعار الدائن** — أُثبت الفرق تشغيلياً لا افتراضاً:              ║
// ║   • حساب الضريبة `1180` (مدخلات) لا `2140`.                                    ║
// ║   • سطر الطرف **أولاً** (مدين)، بخلاف الدائن حيث يأتي أخيراً.                    ║
// ║   • تسوية التقريب على `lines[1]` (المصروف) ومن مجموع **الدائن**.                ║
// ║   • **لا فرز للسطور** — الترتيب صحيح بحكم البناء.                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2 } from '../../../../public/calc.js';
import { ValidationError, MissingAccountError } from '../../../services/accounting/errors/ValidationError.js';

/**
 * @param {object} p
 * @param {string} p.noteKey
 * @param {object} p.note      {number,date,invoiceNumber,vendorId,netBeforeTax,vatTotal,grandTotal,currency,exchangeRate,projectId}
 * @param {object|null} p.vendor
 * @param {object|null} p.payableAccount
 * @param {object|null} p.expenseAccount
 * @param {object|null} p.vatAccount  حساب 1180 أو null
 * @param {string} p.journalNumber
 * @param {string} p.baseCurrencyCode
 * @param {string} p.now
 * @param {string} p.userId
 * @returns {{journal:object, warnings:string[]}}
 */
export function buildDebitNoteJournal({
    noteKey, note, vendor, payableAccount, expenseAccount, vatAccount,
    journalNumber, baseCurrencyCode, now, userId
}) {
    if (!note) throw new ValidationError('مستند الإشعار المدين مطلوب');
    // مقابل حارس القديم `if (!apAcc || !expAcc) { toast(...); return; }` — BUG-010
    if (!payableAccount) {
        throw new MissingAccountError('حساب الموردين غير موجود في شجرة الحسابات', { noteKey });
    }
    if (!expenseAccount) {
        throw new MissingAccountError('حساب المصروف غير موجود في شجرة الحسابات', { noteKey });
    }

    const warnings = [];
    const base = baseCurrencyCode || 'SAR';
    const fx = (note.currency && note.currency !== base) ? (parseFloat(note.exchangeRate) || 1) : 1;
    const cvt = v => round2((Number(v) || 0) * fx);
    const grandBase = cvt(note.grandTotal);

    const lines = [];
    // [0] مدين: الموردون
    lines.push({
        accountCode: payableAccount.code,
        accountName: payableAccount.nameAr,
        description: `إشعار مدين ${note.number} - ${(vendor && vendor.nameAr) || ''}`,
        costCenter: note.projectId || '',
        debit: grandBase,
        credit: 0
    });
    // [1] دائن: المصروف — موضعه الرقمي مُعتمَد عليه في تسوية التقريب أدناه
    lines.push({
        accountCode: expenseAccount.code,
        accountName: expenseAccount.nameAr,
        description: `مرتجع/إشعار مدين ${note.number} — فاتورة ${note.invoiceNumber}`,
        costCenter: note.projectId || '',
        debit: 0,
        credit: cvt(note.netBeforeTax)
    });

    const vatTotal = Number(note.vatTotal) || 0;
    if (vatTotal > 0 && vatAccount) {
        lines.push({
            accountCode: vatAccount.code,
            accountName: vatAccount.nameAr,
            description: `عكس ضريبة مدخلات ${note.number}`,
            costCenter: note.projectId || '',
            debit: 0,
            credit: cvt(note.vatTotal)
        });
    } else if (vatTotal > 0) {
        lines[1].credit = round2(lines[1].credit + cvt(note.vatTotal));
        warnings.push('حساب 1180 (ضريبة المدخلات) غير موجود — ضُمّت الضريبة إلى المصروف (لا يُعكَس أصل الضريبة)');
    }

    // موازنة التقريب على سطر المصروف — من مجموع الدائن (مطابقة حرفية)
    const totCredit = lines.filter(l => l.credit).reduce((s, l) => s + l.credit, 0);
    const rd = round2(grandBase - totCredit);
    if (Math.abs(rd) >= 0.01) lines[1].credit = round2(lines[1].credit + rd);

    const journal = {
        number: journalNumber,
        date: note.date,
        reference: 'إشعار مدين ' + note.number,
        description: `عكس فاتورة مشتريات ${note.invoiceNumber} بإشعار مدين ${note.number}`,
        lines,
        totalDebit: grandBase,
        totalCredit: grandBase,
        currency: note.currency,
        exchangeRate: fx,
        foreignTotal: note.grandTotal,
        status: 'posted',
        sourceType: 'debit_note',
        sourceKey: noteKey,
        createdAt: now,
        createdBy: userId,
        postedAt: now,
        postedBy: userId
    };

    return { journal, warnings };
}
