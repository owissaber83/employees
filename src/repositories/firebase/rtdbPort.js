// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  منفذ RTDB — حقن الاعتماديات                                                  ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ⚠️ لا يستورد Firebase ولا يبني اتصالاً. يتلقّى الدوال الجاهزة من التطبيق.      ║
// ║                                                                              ║
// ║  السبب حاسم: عزل المستأجرين في هذا النظام يتم داخل غلافَي `ref()` و           ║
// ║  `scopeUpdates()` في app.js. أي استيراد مباشر لـ Firebase هنا سيتجاوزهما      ║
// ║  ويكتب في النطاق العام بدل مسار المستأجر — أي كسر العزل بصمت.                 ║
// ║  لذلك نحقنهما كما هما ولا نعيد كتابتهما إطلاقاً.                               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { RepositoryError, REPO_ERRORS } from '../contracts/errors.js';

const REQUIRED = ['db', 'ref', 'get', 'push', 'update', 'remove', 'onValue', 'runTransaction'];

/**
 * يبني منفذاً موثّقاً من دوال Firebase المحقونة.
 * @param {object} fns يجب أن يحوي: db · ref · get · push · update · remove · onValue · runTransaction
 */
export function createRtdbPort(fns) {
    const missing = REQUIRED.filter(k => typeof fns?.[k] === 'undefined');
    if (missing.length) {
        throw new RepositoryError(REPO_ERRORS.UNAVAILABLE,
            `منفذ RTDB ناقص: ${missing.join(' · ')}`);
    }
    return Object.freeze({ ...fns });
}

/**
 * يبني المنفذ من المتغيّرات العامة التي يعرضها app.js.
 * تُستدعى من نقطة التركيب في التطبيق فقط — لا من النطاق ولا من المستودعات.
 */
export function portFromGlobals(g = (typeof window !== 'undefined' ? window : {})) {
    return createRtdbPort({
        db: g.db,
        ref: g.ref,                 // ← الغلاف الواعي بالمستأجر، لا _rawRef
        get: g.get,
        push: g.push,
        update: g.update,
        remove: g.remove,
        onValue: g.onValue,
        runTransaction: g.runTransaction
    });
}
