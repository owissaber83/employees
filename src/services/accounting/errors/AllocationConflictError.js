import { AccountingError, ACCOUNTING_ERROR_CODES } from './AccountingError.js';

/**
 * تخصيص سند (قبض/صرف) على فاتورة يتجاوز رصيدها المتبقّي — سواء بسبب طلب واحد
 * خاطئ أو سباق حقيقي بين طلبين متزامنين على نفس الفاتورة (Phase 7 §CONCURRENCY).
 *
 * ⚠️ **فرق مقصود عن القديم — موثَّق لا مخفيّ** (docs/services/allocation.md):
 * `allocateToInvoices` في accounting.js **لا تفحص التجاوز إطلاقاً** — تسمح
 * بتخصيص يتجاوز رصيد الفاتورة بلا أي حدّ. هذا الفحص طُلب صراحةً في تعليمات
 * Phase 7 Step B («If the combined allocation exceeds the invoice balance:
 * the system must reject the conflicting operation») كآلية أمان من التزامن،
 * لا كإصلاح صامت لسلوك محاسبي — الفرق مُثبَت ومُختبَر في characterization
 * قبل أي تنفيذ (§Golden Master من التعليمات: A/B/C/D — هذا خيار C موثَّق).
 */
export class AllocationConflictError extends AccountingError {
    constructor(message, details) {
        super(ACCOUNTING_ERROR_CODES.ALLOCATION_CONFLICT, message, details);
        this.name = 'AllocationConflictError';
    }
}
