// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تحقّق بنيوي من مدخلات الإشعار المدين — نقيّة                        [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  انظر `validateCreditNote.js`. الحارسان مطابقان لـ`openDebitNote`               ║
// ║  (accounting.js:16183–16184) — نفس البنية، وحقل مختلف (`fullyDebited`).         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { validateNoteSourceInvoice, validateReturnQuantities, validateNoteAmounts } from '../notes/validateNote.js';

export function validateDebitNoteSource(invoice, invoiceKey) {
    return validateNoteSourceInvoice(invoice, invoiceKey, {
        fullyFlag: 'fullyDebited',
        fullyMessage: 'صدر لهذه الفاتورة إشعار مدين كامل بالفعل'
    });
}

export { validateReturnQuantities, validateNoteAmounts };
