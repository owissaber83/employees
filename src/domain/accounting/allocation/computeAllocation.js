// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حساب تخصيص سند على فاتورة — منطق نقيّ                                [Phase 7] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔴 **فرق مقصود عن `allocateToInvoices` (accounting.js:19731) — موثَّق صراحةً:**  ║
// ║  القديم `newPaid = currentPaid + amt` **بلا أي سقف** — يقبل تجاوز رصيد          ║
// ║  الفاتورة بلا قيد. هذه الدالة **ترفض** تجاوز الرصيد — بطلب صريح من تعليمات      ║
// ║  Phase 7 Step B («reject the conflicting operation rather than silently        ║
// ║  overwrite»)، لا كإصلاح صامت. مُثبَت الفرق نفسه في characterization قبل هذا     ║
// ║  الملف — راجع docs/services/allocation.md «فرق مقصود عن القديم».               ║
// ║                                                                              ║
// ║  هذه الدالة **لا تكتب شيئاً** — تحسب النتيجة المطلوبة من حالة مُعطاة. طبقة       ║
// ║  المستودع هي من تُنفِّذها داخل runTransaction لضمان أمان التزامن الفعلي.         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2 } from '../../../../public/calc.js';
import { ValidationError } from '../../../services/accounting/errors/ValidationError.js';
import { AllocationConflictError } from '../../../services/accounting/errors/AllocationConflictError.js';

export const ALLOCATION_TOLERANCE = 0.01; // نفس تسامح النظام القائم — لا تسامح جديد

/**
 * يحسب رصيد الفاتورة الجديد بعد تخصيص مبلغ عليها، ويرفض التجاوز.
 * **نقيّة تماماً** — `currentPaidAmount`/`grandTotal` تُقرَآن مسبقاً (داخل
 * runTransaction في المستودع)، لا هنا.
 *
 * @param {{invoiceKey:string, currentPaidAmount:number, grandTotal:number, allocatedAmount:number}} p
 * @returns {{nextPaidAmount:number, remainingBefore:number, remainingAfter:number}}
 * @throws {ValidationError} مبلغ غير صالح
 * @throws {AllocationConflictError} يتجاوز الرصيد المتبقّي
 */
export function computeInvoiceAllocation({ invoiceKey, currentPaidAmount, grandTotal, allocatedAmount }) {
    const amt = Number(allocatedAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
        throw new ValidationError(`مبلغ التخصيص على الفاتورة ${invoiceKey} غير صالح`, { invoiceKey, allocatedAmount });
    }
    const grand = round2(grandTotal);
    const current = round2(currentPaidAmount || 0);
    const remainingBefore = round2(grand - current);
    const next = round2(current + amt);

    // 🔴 الفحص المطلوب صراحةً في Phase 7 — القديم لا يفحصه إطلاقاً
    if (next > grand + ALLOCATION_TOLERANCE) {
        throw new AllocationConflictError(
            `التخصيص (${amt}) على الفاتورة ${invoiceKey} يتجاوز رصيدها المتبقّي (${remainingBefore})`,
            { invoiceKey, allocatedAmount: amt, currentPaidAmount: current, grandTotal: grand, remainingBefore }
        );
    }
    return { nextPaidAmount: next, remainingBefore, remainingAfter: round2(grand - next) };
}

/**
 * فحوص بنيوية على مجموعة تخصيصات كاملة **قبل** أي قراءة/كتابة فعلية —
 * نفس انضباط validateJournal في Phase 6: رفض مبكر لا كتابة جزئية.
 * @param {Record<string,number>} allocations  { invoiceKey: amount }
 * @throws {ValidationError}
 */
export function validateAllocationSet(allocations) {
    if (allocations == null) return; // بلا تخصيصات إطلاقاً — سند عام، سلوك مطابق للقديم (§return المبكر)
    if (typeof allocations !== 'object' || Array.isArray(allocations)) {
        throw new ValidationError('صيغة التخصيصات غير صالحة — يجب أن تكون كائناً {مفتاح الفاتورة: مبلغ}');
    }
    const keys = Object.keys(allocations);
    const seen = new Set();
    for (const k of keys) {
        if (!k) throw new ValidationError('مفتاح فاتورة فارغ في التخصيصات');
        if (seen.has(k)) throw new ValidationError(`الفاتورة ${k} مكرَّرة في نفس مجموعة التخصيصات`, { invoiceKey: k });
        seen.add(k);
        const amt = Number(allocations[k]);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new ValidationError(`مبلغ التخصيص على الفاتورة ${k} غير صالح`, { invoiceKey: k, amount: allocations[k] });
        }
    }
}
