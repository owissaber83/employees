// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  أخطاء طبقة خدمات المحاسبة                                          [Phase 6]  ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  محايدة عن التخزين وعن الواجهة — لا `toast`/`alert`/`innerHTML` هنا (§19).       ║
// ║  المهايئ (Legacy أو React لاحقاً) هو من يترجمها إلى رسالة للمستخدم.             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export const ACCOUNTING_ERROR_CODES = Object.freeze({
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    UNBALANCED_JOURNAL: 'UNBALANCED_JOURNAL',
    MISSING_ACCOUNT: 'MISSING_ACCOUNT',
    DUPLICATE_POSTING: 'DUPLICATE_POSTING',
    ATOMICITY_FAILURE: 'ATOMICITY_FAILURE',
    NOT_FOUND: 'NOT_FOUND',
    INVALID_STATE: 'INVALID_STATE'
});

/** الأساس المشترك لكل أخطاء خدمات المحاسبة. `details` كائن بيانات إضافي — لا نص جاهز للعرض. */
export class AccountingError extends Error {
    constructor(code, message, details) {
        super(message || code);
        this.name = 'AccountingError';
        this.code = code;
        this.details = details || {};
    }
}
