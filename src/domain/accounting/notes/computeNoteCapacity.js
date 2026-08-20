// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  سعة الإشعار المتبقّية على الفاتورة المصدر — نقيّة                   [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔴 **فرق مقصود عن القديم (مُصنَّف C — قرار المالك رقم 3، مُوافَق عليه صراحةً):**  ║
// ║  القديم لا يفحص السعة المتبقّية إطلاقاً. الإشعار الثاني يُحسب على سطور الفاتورة    ║
// ║  **الأصلية** لا المتبقّي، ثم يُقصّ الحقل إلى `grandTotal` بينما القيد يعكس المبلغ  ║
// ║  كاملاً ⇒ تجاوز في دفتر الأستاذ وذمّة سالبة (BUG-013، مُثبَت تشغيلياً).           ║
// ║  هذه الدالة **ترفض** التجاوز. لم يُعدَّل القديم بحرف.                            ║
// ║                                                                              ║
// ║  🔒 لا تكتب شيئاً — تحسب من حالة مُعطاة. المستودع يُنفِّذها **داخل**              ║
// ║  runTransaction على عقدة الفاتورة، وهو ما يجعل الفحص آمناً من التزامن فعلاً       ║
// ║  ويُغلق ضياع التحديث (BUG-012) في آنٍ واحد.                                    ║
// ║  نفس نمط `computeInvoiceAllocation` (Phase 7-B) — لا سياسة تسامح جديدة.        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2 } from '../../../../public/calc.js';
import { ValidationError } from '../../../services/accounting/errors/ValidationError.js';
import { AllocationConflictError } from '../../../services/accounting/errors/AllocationConflictError.js';

/** نفس تسامح النظام القائم (0.01) — لا تسامح جديد. */
export const NOTE_TOLERANCE = 0.01;

/**
 * يحسب حالة الفاتورة المصدر بعد إصدار إشعار عليها، ويرفض التجاوز.
 *
 * @param {object} p
 * @param {string} p.invoiceKey
 * @param {number} p.grandTotal          إجمالي الفاتورة المصدر
 * @param {number} p.currentNotedAmount  `creditedAmount` أو `debitedAmount` الحالي
 * @param {number} p.noteAmount          إجمالي الإشعار الجديد
 * @param {string} p.noteKey
 * @param {Array<string>|undefined} p.existingKeys  `creditNoteKeys`/`debitNoteKeys` الحالية
 * @param {string} p.legacySingleKey     الحقل المفرد القديم (`creditNoteKey`) — توافق رجعي
 * @returns {{nextNotedAmount:number, fullyNoted:boolean, remainingBefore:number, remainingAfter:number, nextKeys:string[]}}
 * @throws {ValidationError|AllocationConflictError}
 */
export function computeNoteCapacity({
    invoiceKey, grandTotal, currentNotedAmount, noteAmount, noteKey, existingKeys, legacySingleKey
}) {
    const amt = Number(noteAmount);
    if (!Number.isFinite(amt) || amt <= NOTE_TOLERANCE) {
        // مطابق لحارس القديم `c.grandTotal <= 0.01` — نفس العتبة، لكن كخطأ لا كعودة صامتة
        throw new ValidationError(`مبلغ الإشعار على الفاتورة ${invoiceKey} غير صالح — يجب أن يتجاوز ${NOTE_TOLERANCE}`,
            { invoiceKey, noteAmount });
    }
    const grand = round2(grandTotal);
    if (!Number.isFinite(grand) || grand <= 0) {
        throw new ValidationError(`إجمالي الفاتورة ${invoiceKey} غير صالح`, { invoiceKey, grandTotal });
    }

    const current = round2(currentNotedAmount || 0);
    const remainingBefore = round2(grand - current);
    const next = round2(current + amt);

    if (next > grand + NOTE_TOLERANCE) {
        throw new AllocationConflictError(
            `الإشعار (${amt}) على الفاتورة ${invoiceKey} يتجاوز المتبقّي القابل للإشعار (${remainingBefore})`,
            { invoiceKey, noteAmount: amt, currentNotedAmount: current, grandTotal: grand, remainingBefore }
        );
    }

    // مطابقة حرفية لعتبة «الإلغاء الكامل» في القديم: `>= grandTotal − 0.01`
    const fullyNoted = next >= grand - NOTE_TOLERANCE;

    // مطابقة حرفية لبناء المصفوفة في القديم (مع التوافق الرجعي للحقل المفرد)
    const base = Array.isArray(existingKeys) ? existingKeys.slice() : (legacySingleKey ? [legacySingleKey] : []);
    if (!base.includes(noteKey)) base.push(noteKey);

    // ⚠️ القديم **يقصّ** المبلغ إلى الإجمالي عند الإلغاء الكامل
    //    (`upd.creditedAmount = parseFloat(inv.grandTotal)`). محفوظ حرفياً (صنف A) —
    //    بعد رفض التجاوز لا يختلف القصّ عن الجمع إلا داخل التسامح، لكن نُبقيه مطابقاً.
    return {
        nextNotedAmount: fullyNoted ? grand : next,
        fullyNoted,
        remainingBefore,
        remainingAfter: round2(grand - next),
        nextKeys: base
    };
}
