// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  فحوص بنيوية مشتركة لمستندات الإرجاع — نقيّة                        [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  تُقابل حارسَي `openCreditNote`/`openDebitNote` في القديم — لكن كأخطاء مُصنَّفة    ║
// ║  تصعد للمستدعي بدل `toast` + `return` صامتة. الحارسان أنفسهما محفوظان (صنف A):  ║
// ║      status === 'posted'   ·   !fullyCredited / !fullyDebited                  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { ValidationError } from '../../../services/accounting/errors/ValidationError.js';

/**
 * @param {object|null} invoice
 * @param {string} invoiceKey
 * @param {{fullyFlag:string, fullyMessage:string}} opts
 */
export function validateNoteSourceInvoice(invoice, invoiceKey, opts) {
    if (!invoice) throw new ValidationError('الفاتورة المصدر غير موجودة', { invoiceKey });
    if (invoice.status !== 'posted') {
        throw new ValidationError('الإشعار يُصدَر على الفواتير المرحّلة فقط', { invoiceKey, status: invoice.status });
    }
    if (invoice[opts.fullyFlag]) {
        throw new ValidationError(opts.fullyMessage, { invoiceKey });
    }
    if (!Array.isArray(invoice.lines) || invoice.lines.length === 0) {
        throw new ValidationError('الفاتورة المصدر بلا سطور — لا يمكن اشتقاق إشعار منها', { invoiceKey });
    }
    return true;
}

/**
 * كميات الإرجاع: مصفوفة أرقام غير سالبة، بطول لا يتجاوز سطور الفاتورة.
 * الغياب مسموح (⇒ إرجاع كامل) — مطابق لمسار `rq ? … : origQty` في القديم.
 */
export function validateReturnQuantities(returnQuantities, invoice) {
    if (returnQuantities == null) return true;
    if (!Array.isArray(returnQuantities)) {
        throw new ValidationError('كميات الإرجاع يجب أن تكون مصفوفة بترتيب سطور الفاتورة');
    }
    const lineCount = ((invoice && invoice.lines) || []).length;
    if (returnQuantities.length > lineCount) {
        throw new ValidationError(`عدد كميات الإرجاع (${returnQuantities.length}) يتجاوز عدد سطور الفاتورة (${lineCount})`);
    }
    returnQuantities.forEach((q, i) => {
        if (q === undefined || q === null) return;   // سطر غير مذكور ⇒ الكمّية الأصلية
        const n = Number(q);
        if (!Number.isFinite(n)) throw new ValidationError(`كمّية إرجاع غير رقمية في السطر ${i + 1}`, { index: i, value: q });
        if (n < 0) throw new ValidationError(`كمّية إرجاع سالبة في السطر ${i + 1}`, { index: i, value: q });
    });
    return true;
}

/** عتبة القديم حرفياً: `c.grandTotal <= 0.01` ⇒ رفض. */
export function validateNoteAmounts(amounts) {
    if (!amounts) throw new ValidationError('تعذّر حساب مبالغ الإشعار');
    const g = Number(amounts.grandTotal);
    if (!Number.isFinite(g) || g <= 0.01) {
        throw new ValidationError('حدّد كمية إرجاع موجبة — إجمالي الإشعار صفر أو أقل من عتبة التسامح',
            { grandTotal: amounts.grandTotal });
    }
    return true;
}
