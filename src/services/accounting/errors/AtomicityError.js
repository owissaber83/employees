import { AccountingError, ACCOUNTING_ERROR_CODES } from './AccountingError.js';

/**
 * فشلت الكتابة الذرّية متعدّدة المسارات. لا كتابة جزئية — إمّا الكل أو لا شيء
 * (§6). `details.cause` يحمل الخطأ الأصلي من طبقة التخزين.
 */
export class AtomicityError extends AccountingError {
    constructor(message, details) {
        super(ACCOUNTING_ERROR_CODES.ATOMICITY_FAILURE, message, details);
        this.name = 'AtomicityError';
    }
}
