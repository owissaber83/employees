// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حلّ حسابات الإشعار الدائن — نقيّة                                  [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لـaccounting.js:16128–16132:                                     ║
// ║      receivableAcc = find(code === custReceivableAccount(customerId))          ║
// ║      vatAcc        = find(code === '2140')                                     ║
// ║      revAcc        = find(code === salesAccountCode) ‖ find(code === '4100')   ║
// ║                                                                              ║
// ║  ✅ **`ensureStdAccount` غير مستدعاة في مسار الإشعارات إطلاقاً** — تحقّقنا من     ║
// ║  ذلك بقراءة الشفرة الحيّة. لذلك «لا إنشاء حسابات» هنا **سلوك محفوظ (صنف A)**،   ║
// ║  لا تحسين أمان — بخلاف Step C حيث كان فرقاً مقصوداً (C1). BUG-006 لا يمسّ         ║
// ║  هذا المسار أصلاً.                                                            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { resolveCustomerReceivableAccountCode } from '../posting/resolveCustomerReceivableAccount.js';

export const OUTPUT_VAT_CODE = '2140';
export const DEFAULT_REVENUE_CODE = '4100';

/** ترتيب مرشّحي حساب الإيراد — بنفس أولوية القديم، بلا تكرار. */
export function creditNoteRevenueCandidates({ note }) {
    const primary = (note && note.salesAccountCode) || DEFAULT_REVENUE_CODE;
    return primary === DEFAULT_REVENUE_CODE ? [primary] : [primary, DEFAULT_REVENUE_CODE];
}

/** رمز حساب العملاء — يعيد استخدام دالة Phase 7-B النقيّة، لا نسخة موازية. */
export function creditNoteReceivableCode({ note, customers, chartOfAccounts, cfg }) {
    return resolveCustomerReceivableAccountCode({
        customerId: note && note.customerId, customers, chartOfAccounts, cfg
    });
}
