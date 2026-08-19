// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عقود المستودعات · الأخطاء                                                    ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  أخطاء **محايدة عن قاعدة البيانات**. لا يظهر فوق طبقة المستودع خطأ Firebase    ║
// ║  خام — وإلا تسرّبت تفاصيل التخزين إلى النطاق والواجهة، وصار استبدال القاعدة     ║
// ║  لاحقاً يستلزم تعديلهما.                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export const REPO_ERRORS = Object.freeze({
    NOT_FOUND: 'NOT_FOUND',
    CODE_TAKEN: 'CODE_TAKEN',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    UNAVAILABLE: 'UNAVAILABLE',
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
    UNKNOWN: 'UNKNOWN'
});

export class RepositoryError extends Error {
    constructor(code, message, cause) {
        super(message || code);
        this.name = 'RepositoryError';
        this.code = code;
        if (cause) this.cause = cause;
    }
}

/** يترجم خطأ Firebase إلى خطأ محايد. */
export function translateRtdbError(err) {
    const msg = String((err && err.message) || err || '');
    if (/permission[_ ]denied/i.test(msg)) {
        return new RepositoryError(REPO_ERRORS.PERMISSION_DENIED,
            'رُفض الوصول — تحقّق من صلاحيتك أو من قواعد الأمان', err);
    }
    if (/network|unavailable|offline|timeout/i.test(msg)) {
        return new RepositoryError(REPO_ERRORS.UNAVAILABLE,
            'تعذّر الوصول إلى قاعدة البيانات — تحقّق من الاتصال', err);
    }
    return new RepositoryError(REPO_ERRORS.UNKNOWN, msg || 'خطأ غير معروف', err);
}
