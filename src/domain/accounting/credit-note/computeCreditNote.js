// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حساب مبالغ الإشعار الدائن — نقيّة                                  [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  واجهة مستقلّة فوق النواة المشتركة `computeNoteAmounts`. النواة مشتركة لأن        ║
// ║  `cnCompute` و`dnCompute` **ثبت** تطابقهما رياضياً بالمقارنة التشغيلية — لا       ║
// ║  بالافتراض. الواجهتان منفصلتان كي يبقى كل مسار قابلاً للتباعد لاحقاً بلا كسر.     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { computeNoteAmounts } from '../notes/computeNoteAmounts.js';

/**
 * @param {{invoice:object, returnQuantities?:Array<number>}} p الفاتورة المصدر (مبيعات)
 * @returns {{subTotal,discount,netBeforeTax,vatTotal,grandTotal,lines}}
 */
export function computeCreditNote({ invoice, returnQuantities }) {
    return computeNoteAmounts({ invoice, returnQuantities });
}
