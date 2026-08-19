import { AccountingError, ACCOUNTING_ERROR_CODES } from './AccountingError.js';

/**
 * المصدر مُرحَّل بالفعل — ليس فشلاً، بل نتيجة الأصلية تُعاد كما هي (سلوك Idempotent).
 * `details.original` يحمل نتيجة الترحيل الأول: { journalId, journalNumber }.
 */
export class DuplicatePostingError extends AccountingError {
    constructor(message, details) {
        super(ACCOUNTING_ERROR_CODES.DUPLICATE_POSTING, message, details);
        this.name = 'DuplicatePostingError';
    }
}
