import { AccountingError, ACCOUNTING_ERROR_CODES } from './AccountingError.js';

/** بنية القيد غير صالحة — قبل حتى فحص التوازن (سطر مفقود، حساب غير مذكور، مبلغ غير رقمي...). */
export class ValidationError extends AccountingError {
    constructor(message, details) {
        super(ACCOUNTING_ERROR_CODES.VALIDATION_FAILED, message, details);
        this.name = 'ValidationError';
    }
}

/** القيد غير متوازن: Σ مدين ≠ Σ دائن ضمن التسامح المعتمد. */
export class UnbalancedJournalError extends AccountingError {
    constructor(message, details) {
        super(ACCOUNTING_ERROR_CODES.UNBALANCED_JOURNAL, message, details);
        this.name = 'UnbalancedJournalError';
    }
}

/** حساب مطلوب غير موجود في شجرة حسابات المستأجر — الترحيل يتوقّف، لا يُخترَع حساب. */
export class MissingAccountError extends AccountingError {
    constructor(message, details) {
        super(ACCOUNTING_ERROR_CODES.MISSING_ACCOUNT, message, details);
        this.name = 'MissingAccountError';
    }
}
