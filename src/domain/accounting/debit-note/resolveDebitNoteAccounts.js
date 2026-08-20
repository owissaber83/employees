// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حلّ حسابات الإشعار المدين — نقيّة                                  [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لـaccounting.js:16265–16269:                                     ║
// ║      apAcc  = find(code === vendPayableAccount(vendorId))                      ║
// ║      vatAcc = find(code === '1180')            ← **مدخلات**، لا 2140            ║
// ║      expAcc = find(code === expenseAccountCode) ‖ find(code === '5110')        ║
// ║                                                                              ║
// ║  ⚠️ **ليس مرآةً للإشعار الدائن** — حسابٌ مختلف واتجاهٌ مختلف. أُثبت الفرق         ║
// ║  تشغيلياً في tests/golden-master/debit-note.test.mjs، لم يُفترَض.                ║
// ║                                                                              ║
// ║  `expenseAccountCode` يُشتقّ عند إنشاء المستند (accounting.js:16247):            ║
// ║      inv.debitAccountCode ‖ getExpenseAccountForType(inv.expenseType) ‖ '5110' ║
// ║  ولذلك يصل إلى هنا **محلولاً** على المستند — لا يُعاد اشتقاقه.                   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { resolveVendorPayableAccountCode } from '../posting/resolveVendorPayableAccount.js';

export const INPUT_VAT_CODE = '1180';
export const DEFAULT_EXPENSE_CODE = '5110';

/** ترتيب مرشّحي حساب المصروف — بنفس أولوية القديم، بلا تكرار. */
export function debitNoteExpenseCandidates({ note }) {
    const primary = (note && note.expenseAccountCode) || DEFAULT_EXPENSE_CODE;
    return primary === DEFAULT_EXPENSE_CODE ? [primary] : [primary, DEFAULT_EXPENSE_CODE];
}

/** رمز حساب الموردين — يعيد استخدام دالة Phase 6 النقيّة، لا نسخة موازية. */
export function debitNotePayableCode({ note, vendors, chartOfAccounts, cfg }) {
    return resolveVendorPayableAccountCode({
        vendorId: note && note.vendorId, vendors, chartOfAccounts, cfg
    });
}

/**
 * خريطة نوع المصروف — منقولة حرفياً من `getExpenseAccountForType` (accounting.js).
 * تُستخدم فقط عند بناء مستند الإشعار من فاتورة بلا `debitAccountCode`.
 */
export const EXPENSE_TYPE_MAP = Object.freeze({
    materials: '5110', services: '5120', equipment_rent: '5130', subcontractor: '5140',
    transport: '5220', utilities: '5330', rent: '5320', other: '5190'
});

export function expenseAccountForType(expenseType) {
    return EXPENSE_TYPE_MAP[expenseType] || '5190';
}
