// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  بناء سجل القيد اليدوي — نقيّة، من saveJrnEntry                     [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لبناء كائن `data` في accounting.js:6540 — **باستثناء** قراءة      ║
// ║  الحقول من DOM (`$('mJrnDate').value` …) وحجز الرقم والكتابة.                   ║
// ║  كل قيمة تصل هنا **صراحةً كوسيط**. لا `window`، لا `document`.                  ║
// ║                                                                              ║
// ║  🔎 تفاصيل محفوظة حرفياً:                                                      ║
// ║   • `period` = أول 7 أحرف من التاريخ (`YYYY-MM`) — تعتمد عليه قواعد قفل الفترة.  ║
// ║   • الحقول الاختيارية تُكتب **فقط** إن وُجدت (`taxable` · `_taxAuto` · `_agid` ·  ║
// ║     `_agHead`/`_agShares` · `fcDebit`/`fcCredit`) — لا تُخترَع مفاتيح فارغة.      ║
// ║   • `fcDebit`/`fcCredit` تُكتب **فقط** عند اختلاف العملة عن الأساسية.            ║
// ║   • المجاميع تُحسب من السطور **بعد** التحويل للعملة الأساسية.                    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { ValidationError } from '../../../services/accounting/errors/ValidationError.js';

/**
 * @param {object} p
 * @param {Array<object>} p.storeLines سطور جاهزة بالعملة الأساسية
 * @param {object} p.header {date,reference,description,notes,book,autoReverseDate,attachments}
 * @param {string} p.currency · @param {number} p.exchangeRate · @param {string} p.baseCurrency
 * @param {string} p.status 'draft' | 'posted'
 * @param {string} p.journalNumber · @param {string} p.now · @param {string} p.userId
 * @returns {{journal:object}}
 */
export function buildManualJournal({
    storeLines, header = {}, currency, exchangeRate, baseCurrency,
    status, journalNumber, now, userId
}) {
    if (!Array.isArray(storeLines) || !storeLines.length) {
        throw new ValidationError('سطور القيد مطلوبة');
    }
    const isForeign = currency !== baseCurrency;

    const lines = storeLines.map(l => {
        const o = {
            accountCode: l.accountCode,
            accountName: l.accountName,
            description: l.description || '',
            date: l.date || '',
            costCenter: l.costCenter || '',
            projectId: l.projectId || '',
            supplierId: l.supplierId || '',
            matCategory: l.matCategory || '',
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0
        };
        if (l.taxable) { o.taxable = true; o.vatRate = parseFloat(l.vatRate) || 0; }
        if (l._taxAuto) o._taxAuto = true;
        if (l._agid) o._agid = l._agid;
        if (l._agHead) { o._agHead = true; o._agShares = l._agShares; }
        if (isForeign) { o.fcDebit = parseFloat(l.fcDebit) || 0; o.fcCredit = parseFloat(l.fcCredit) || 0; }
        return o;
    });

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    const date = header.date || '';

    const journal = {
        number: journalNumber,
        date,
        period: date.slice(0, 7),
        reference: String(header.reference || '').trim(),
        description: String(header.description || '').trim(),
        lines,
        currency, exchangeRate,
        journalBook: header.book || 'GEN',
        autoReverseDate: header.autoReverseDate || null,
        attachments: header.attachments || [],
        totalDebit, totalCredit,
        notes: String(header.notes || '').trim(),
        status,
        updatedAt: now,
        updatedBy: userId
    };

    return { journal };
}

/** دفاتر اليومية — منقولة حرفياً (accounting.js JRN_BOOKS). */
export const JRN_BOOKS = Object.freeze([
    { code: 'GEN', prefix: 'JV', name: 'عام' },
    { code: 'SAL', prefix: 'SV', name: 'مبيعات' },
    { code: 'PUR', prefix: 'PV', name: 'مشتريات' },
    { code: 'CASH', prefix: 'CV', name: 'نقدية' },
    { code: 'BANK', prefix: 'BV', name: 'بنك' },
    { code: 'ADJ', prefix: 'AV', name: 'تسوية' }
]);

/** منقولة حرفياً — أي رمز غير معروف يرجع لأول دفتر (GEN/JV). */
export function jrnBookByCode(code) {
    return JRN_BOOKS.find(b => b.code === code) || JRN_BOOKS[0];
}
