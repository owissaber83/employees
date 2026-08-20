// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حساب مبالغ الإشعار المدين — نقيّة                                  [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  انظر تعليق `computeCreditNote.js` — نفس النواة، وواجهة مستقلّة عمداً.           ║
// ║  التطابق مع `dnCompute` القديمة مُثبَت في tests/golden-master/debit-note.test.mjs. ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { computeNoteAmounts } from '../notes/computeNoteAmounts.js';

/**
 * @param {{invoice:object, returnQuantities?:Array<number>}} p الفاتورة المصدر (مشتريات)
 */
export function computeDebitNote({ invoice, returnQuantities }) {
    return computeNoteAmounts({ invoice, returnQuantities });
}
