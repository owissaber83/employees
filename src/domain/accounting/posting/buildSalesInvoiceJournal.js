// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  بناء قيد فاتورة مبيعات — نقيّة، منقولة من createJournalForSInv      [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لمنطق البناء في accounting.js:16511 (createJournalForSInv) —      ║
// ║  **باستثناء** الكتابة الفعلية (push/update)، وتوليد رقم القيد، وحلّ/إنشاء رموز   ║
// ║  الحسابات (`custReceivableAccount` · `ensureStdAccount`) — كلها مسؤولية طبقة     ║
// ║  الخدمة. الحسابات تصل هنا **محلولة** ككائنات، أو `null`.                        ║
// ║                                                                              ║
// ║  ⚠️ **مُثبتة بالمقارنة الفعلية** مع الدالة الحقيقية المُشغَّلة من الملف الحيّ —     ║
// ║  tests/characterization/buildSalesInvoiceJournal.test.mjs +                    ║
// ║  tests/golden-master/sales-invoice.test.mjs. لا منطق مُعاد كتابته من الفهم.      ║
// ║                                                                              ║
// ║  🔎 التفاصيل التي تكسر التطابق لو أُهملت (كلها مقصودة هنا):                     ║
// ║   • ذمّة العميل = الإجمالي − الاحتجاز **فقط** (لا يُطرح استرداد الدفعة المقدمة).  ║
// ║   • إجمالي القيد = الإجمالي + استرداد الدفعة (سطر مدين إضافي خارج الإجمالي).     ║
// ║   • تسوية التقريب تُضاف إلى `lines[1]` = سطر الإيراد، **قبل** الفرز لا بعده.      ║
// ║   • الفرز (كل المدين ثم كل الدائن) آخر خطوة، وبفرز مستقرّ.                       ║
// ║   • عتبة الاحتجاز/المقدّم `> 0.005` لا `> 0`.                                   ║
// ║                                                                              ║
// ║  🔴 فرق مُصنَّف B (تمثيل لا مال): القديم يمرّر النصوص عبر `esc()` (ترميز HTML)     ║
// ║  و`fmt()` (تنسيق محلّي) داخل الأوصاف — كلاهما من طبقة الواجهة. هنا تُكتب القيم   ║
// ║  الخام (نفس سابقة buildPurchaseInvoiceJournal في Phase 6). لا أثر مالي.         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2 } from '../../../../public/calc.js';
import { ValidationError, MissingAccountError } from '../../../services/accounting/errors/ValidationError.js';

/** العتبة الفعلية في القديم لتفعيل سطر الاحتجاز/الدفعة المقدمة. */
export const MATERIALITY = 0.005;

/**
 * @param {object} p
 * @param {string} p.invoiceKey
 * @param {object} p.invoice   {number,date,customerId,netBeforeTax,vatTotal,grandTotal,retentionAmount,advanceRecoveryAmount,currency,exchangeRate,projectId,salesAccountCode}
 * @param {object|null} p.customer
 * @param {object|null} p.receivableAccount  حساب العملاء المُحلَّل {code,nameAr}
 * @param {object|null} p.revenueAccount     حساب الإيرادات المُحلَّل
 * @param {object|null} p.vatPayableAccount  حساب ضريبة المخرجات (2140) أو null
 * @param {object|null} p.retentionAccount   حساب المحتجزات (1131) أو null
 * @param {object|null} p.advanceAccount     حساب الدفعات المقدمة (2150) أو null
 * @param {string} p.journalNumber
 * @param {string} p.baseCurrencyCode
 * @param {string} p.now  ISO
 * @param {string} p.userId
 * @returns {{journal:object, warnings:string[]}}
 * @throws {ValidationError|MissingAccountError}
 */
export function buildSalesInvoiceJournal({
    invoiceKey, invoice, customer, receivableAccount, revenueAccount,
    vatPayableAccount, retentionAccount, advanceAccount,
    journalNumber, baseCurrencyCode, now, userId
}) {
    if (!invoice) throw new ValidationError('الفاتورة مطلوبة');
    // مقابل الحارس القديم (accounting.js:16536): `if (!receivableAcc || !revenueAcc) return;`
    // — القديم يعود بصمت مع toast؛ هنا خطأ مُصنَّف يصعد للمستدعي (لا ابتلاع صامت).
    if (!receivableAccount) {
        throw new MissingAccountError('حساب العملاء غير موجود في شجرة الحسابات', { invoiceKey });
    }
    if (!revenueAccount) {
        throw new MissingAccountError('حساب الإيرادات غير موجود في شجرة الحسابات', { invoiceKey });
    }

    const warnings = [];
    const baseCode = baseCurrencyCode || 'SAR';
    const curCode = invoice.currency || baseCode;
    const fx = (curCode !== baseCode) ? (parseFloat(invoice.exchangeRate) || 1) : 1;
    const cvt = v => round2((Number(v) || 0) * fx);
    const grandBase = cvt(invoice.grandTotal);
    const curNote = fx !== 1 ? ` [${invoice.grandTotal} ${curCode} × ${fx}]` : '';

    // 🏗️ ضمان الأعمال (احتجاز) واسترداد الدفعة المقدمة — نفس عتبة القديم
    let retBase = cvt(invoice.retentionAmount || 0);
    let advBase = cvt(invoice.advanceRecoveryAmount || 0);
    if (retBase > MATERIALITY && !retentionAccount) {
        warnings.push('حساب 1131 (محتجزات ضمان لدى العملاء) غير موجود — لم يُفصل الاحتجاز في القيد');
        retBase = 0;
    }
    if (advBase > MATERIALITY && !advanceAccount) {
        warnings.push('حساب 2150 (دفعات مقدمة من العملاء) غير موجود — لم يُسترد المقدّم في القيد');
        advBase = 0;
    }

    // ⚠️ صافي المستحق على العميل = الإجمالي − الاحتجاز **فقط**. استرداد الدفعة المقدمة
    // مطروح أصلاً من الوعاء الضريبي قبل احتساب الضريبة، فطرحه ثانيةً يُنقص الذمّة مرتين.
    const custDueBase = round2(grandBase - retBase);

    const lines = [];
    // [0] مدين: العملاء
    lines.push({
        accountCode: receivableAccount.code,
        accountName: receivableAccount.nameAr,
        description: `فاتورة ${invoice.number} - ${(customer && customer.nameAr) || ''}${curNote}`,
        costCenter: invoice.projectId || '',
        debit: custDueBase,
        credit: 0
    });
    // [1] دائن: الإيرادات — موضعه الرقمي مُعتمَد عليه في تسوية التقريب أدناه
    lines.push({
        accountCode: revenueAccount.code,
        accountName: revenueAccount.nameAr,
        description: `إيرادات فاتورة ${invoice.number}`,
        costCenter: invoice.projectId || '',
        debit: 0,
        credit: cvt(invoice.netBeforeTax)
    });

    const vatTotal = Number(invoice.vatTotal) || 0;
    if (vatTotal > 0 && vatPayableAccount) {
        lines.push({
            accountCode: vatPayableAccount.code,
            accountName: vatPayableAccount.nameAr,
            description: `ضريبة فاتورة ${invoice.number}`,
            costCenter: invoice.projectId || '',
            debit: 0,
            credit: cvt(invoice.vatTotal)
        });
    } else if (vatTotal > 0) {
        // مطابقة حرفية لآخر ملاذ في القديم: الضريبة تُضمّ للإيراد + تحذير صريح.
        // ⚠️ هذا المسار **غير قابل للوصول عبر الخدمة الجديدة** — postSalesInvoice ترفض
        // الترحيل قبل الوصول هنا (فرق C). يبقى منقولاً كي يظلّ التطابق مع القديم قابلاً
        // للإثبات على مستوى الدومين.
        lines[1].credit = round2(lines[1].credit + cvt(invoice.vatTotal));
        warnings.push('حساب 2140 (ضريبة المخرجات) غير موجود — ضُمّت الضريبة إلى الإيرادات (إيراد منتفخ وإقرار ضريبي خاطئ)');
    }

    // مدين: محتجزات ضمان لدى العملاء (1131)
    if (retBase > MATERIALITY && retentionAccount) {
        lines.push({
            accountCode: retentionAccount.code, accountName: retentionAccount.nameAr,
            description: `ضمان أعمال محتجز - فاتورة ${invoice.number}`,
            costCenter: invoice.projectId || '', debit: retBase, credit: 0
        });
    }
    // مدين: دفعات مقدمة من العملاء (2150)
    if (advBase > MATERIALITY && advanceAccount) {
        lines.push({
            accountCode: advanceAccount.code, accountName: advanceAccount.nameAr,
            description: `استرداد دفعة مقدمة - فاتورة ${invoice.number}`,
            costCenter: invoice.projectId || '', debit: advBase, credit: 0
        });
    }

    // ⚠️ مجموع القيد = الإجمالي + استرداد الدفعة المقدمة (سطر مدين إضافي خارج الإجمالي).
    const jrnTotal = round2(grandBase + advBase);
    const totCredit = lines.slice(1).reduce((s, l) => s + l.credit, 0);
    const roundDiff = round2(jrnTotal - totCredit);
    if (Math.abs(roundDiff) >= 0.01) lines[1].credit = round2(lines[1].credit + roundDiff);

    // 📑 كل المدين أولاً ثم كل الدائن — **بعد** تسوية التقريب (تعتمد على lines[1]).
    lines.sort((a, b) => ((+b.debit || 0) > 0 ? 1 : 0) - ((+a.debit || 0) > 0 ? 1 : 0));

    const journal = {
        number: journalNumber,
        date: invoice.date,
        reference: 'فاتورة ' + invoice.number,
        description: `إثبات فاتورة مبيعات ${invoice.number} - ${(customer && customer.nameAr) || ''}`,
        lines,
        totalDebit: jrnTotal,
        totalCredit: jrnTotal,
        currency: curCode,
        exchangeRate: fx,
        foreignTotal: invoice.grandTotal,
        status: 'posted',
        sourceType: 'sales_invoice',
        sourceKey: invoiceKey,
        createdAt: now,
        createdBy: userId,
        postedAt: now,
        postedBy: userId
    };

    return { journal, warnings };
}
