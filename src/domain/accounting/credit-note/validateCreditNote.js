// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تحقّق بنيوي من مدخلات الإشعار الدائن — نقيّة                        [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  فحوص بنيوية فقط. لا تُصلِح شيئاً، ولا تفترض قاعدة عمل غير مُثبتة من السلوك       ║
// ║  الحالي. الحارس المالي (السعة المتبقّية) في `computeNoteCapacity` لأنه يجب أن     ║
// ║  يقع **داخل** معاملة على الفاتورة، لا هنا.                                     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { validateNoteSourceInvoice, validateReturnQuantities, validateNoteAmounts } from '../notes/validateNote.js';

/** حارس الفاتورة المصدر — مطابق لحارسَي `openCreditNote` (accounting.js:16045–16046). */
export function validateCreditNoteSource(invoice, invoiceKey) {
    return validateNoteSourceInvoice(invoice, invoiceKey, {
        fullyFlag: 'fullyCredited',
        fullyMessage: 'صدر لهذه الفاتورة إشعار دائن كامل بالفعل'
    });
}

export { validateReturnQuantities, validateNoteAmounts };
