// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  بناء قيد الإشعار الدائن — نقيّة، منقولة من createJournalForCreditNote [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لمنطق البناء في accounting.js:16125 — **باستثناء** الكتابة        ║
// ║  (`push`/`update`)، وتوليد رقم القيد، وحلّ رموز الحسابات (مسؤولية طبقة الخدمة).  ║
// ║                                                                              ║
// ║  عكس فاتورة المبيعات:                                                         ║
// ║      مدين  الإيرادات (netBeforeTax)  ← + فرق التقريب                          ║
// ║      مدين  ضريبة المخرجات 2140 (vatTotal)                                      ║
// ║      دائن  العملاء (grandTotal)                                                ║
// ║                                                                              ║
// ║  🔎 تفاصيل تكسر التطابق لو أُهملت:                                             ║
// ║   • `fx` هنا شرطه `cn.currency && cn.currency !== base` — عملة فارغة ⇒ fx = 1.  ║
// ║     (يختلف عن فاتورة المبيعات التي تُسند `invoice.currency ‖ base` أولاً.)       ║
// ║   • تسوية التقريب على `lines[0]` (الإيراد) ومن مجموع **المدين**.                ║
// ║   • **لا فرز للسطور** — الترتيب صحيح بحكم البناء لا بحكم `sort`.                ║
// ║   • `currency` يُكتب خاماً كما ورد على المستند (قد يكون `undefined`).            ║
// ║                                                                              ║
// ║  🔴 غياب 2140 ⇒ القديم يضمّ الضريبة إلى سطر الإيراد **بلا أي تنبيه**. منقول      ║
// ║  هنا مع تحذير صريح مُعاد للمستدعي. المسار غير قابل للوصول عبر الخدمة (ترفض        ║
// ║  قبله)، لكنه يبقى منقولاً كي يظلّ التطابق قابلاً للإثبات على مستوى الدومين.       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2 } from '../../../../public/calc.js';
import { ValidationError, MissingAccountError } from '../../../services/accounting/errors/ValidationError.js';

/**
 * @param {object} p
 * @param {string} p.noteKey
 * @param {object} p.note        مستند الإشعار {number,date,invoiceNumber,customerId,netBeforeTax,vatTotal,grandTotal,currency,exchangeRate,projectId}
 * @param {object|null} p.customer
 * @param {object|null} p.receivableAccount
 * @param {object|null} p.revenueAccount
 * @param {object|null} p.vatAccount   حساب 2140 أو null
 * @param {string} p.journalNumber
 * @param {string} p.baseCurrencyCode
 * @param {string} p.now
 * @param {string} p.userId
 * @returns {{journal:object, warnings:string[]}}
 */
export function buildCreditNoteJournal({
    noteKey, note, customer, receivableAccount, revenueAccount, vatAccount,
    journalNumber, baseCurrencyCode, now, userId
}) {
    if (!note) throw new ValidationError('مستند الإشعار الدائن مطلوب');
    // مقابل حارس القديم `if (!receivableAcc || !revAcc) { toast(...); return; }` —
    // القديم يعود بصمت والمستدعي لا يفحص (BUG-010). هنا خطأ مُصنَّف يصعد للمستدعي.
    if (!receivableAccount) {
        throw new MissingAccountError('حساب العملاء غير موجود في شجرة الحسابات', { noteKey });
    }
    if (!revenueAccount) {
        throw new MissingAccountError('حساب الإيرادات غير موجود في شجرة الحسابات', { noteKey });
    }

    const warnings = [];
    const base = baseCurrencyCode || 'SAR';
    const fx = (note.currency && note.currency !== base) ? (parseFloat(note.exchangeRate) || 1) : 1;
    const cvt = v => round2((Number(v) || 0) * fx);
    const grandBase = cvt(note.grandTotal);

    const lines = [];
    // [0] مدين: الإيرادات — موضعه الرقمي مُعتمَد عليه في تسوية التقريب أدناه
    lines.push({
        accountCode: revenueAccount.code,
        accountName: revenueAccount.nameAr,
        description: `مرتجع/إشعار دائن ${note.number} — فاتورة ${note.invoiceNumber}`,
        costCenter: note.projectId || '',
        debit: cvt(note.netBeforeTax),
        credit: 0
    });

    const vatTotal = Number(note.vatTotal) || 0;
    if (vatTotal > 0 && vatAccount) {
        lines.push({
            accountCode: vatAccount.code,
            accountName: vatAccount.nameAr,
            description: `عكس ضريبة ${note.number}`,
            costCenter: note.projectId || '',
            debit: cvt(note.vatTotal),
            credit: 0
        });
    } else if (vatTotal > 0) {
        lines[0].debit = round2(lines[0].debit + cvt(note.vatTotal));
        warnings.push('حساب 2140 (ضريبة المخرجات) غير موجود — ضُمّت الضريبة إلى الإيرادات (لا يُعكَس التزام الضريبة)');
    }

    // دائن: العملاء
    lines.push({
        accountCode: receivableAccount.code,
        accountName: receivableAccount.nameAr,
        description: `إشعار دائن ${note.number} - ${(customer && customer.nameAr) || ''}`,
        costCenter: note.projectId || '',
        debit: 0,
        credit: grandBase
    });

    // موازنة التقريب على سطر الإيراد — من مجموع المدين (مطابقة حرفية)
    const totDebit = lines.filter(l => l.debit).reduce((s, l) => s + l.debit, 0);
    const rd = round2(grandBase - totDebit);
    if (Math.abs(rd) >= 0.01) lines[0].debit = round2(lines[0].debit + rd);

    const journal = {
        number: journalNumber,
        date: note.date,
        reference: 'إشعار دائن ' + note.number,
        description: `عكس فاتورة ${note.invoiceNumber} بإشعار دائن ${note.number}`,
        lines,
        totalDebit: grandBase,
        totalCredit: grandBase,
        currency: note.currency,
        exchangeRate: fx,
        foreignTotal: note.grandTotal,
        status: 'posted',
        sourceType: 'credit_note',
        sourceKey: noteKey,
        createdAt: now,
        createdBy: userId,
        postedAt: now,
        postedBy: userId
    };

    return { journal, warnings };
}
