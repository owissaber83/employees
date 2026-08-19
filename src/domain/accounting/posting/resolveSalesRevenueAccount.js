// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حلّ حساب الإيرادات لفاتورة مبيعات — نقيّة                            [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة لسلسلة الرجوع الفعلية في accounting.js:16528–16530:                    ║
// ║      const salesAccCode = inv.salesAccountCode || '4100';                      ║
// ║      accounts.find(code === salesAccCode)                                      ║
// ║   || accounts.find(code === '4100')                                            ║
// ║   || ensureStdAccount(salesAccCode) || ensureStdAccount('4100')                ║
// ║                                                                              ║
// ║  🔴 **الإنشاء التلقائي (`ensureStdAccount`) غير منقول عمداً** — الخدمة الجديدة   ║
// ║  لا تُنشئ حسابات إطلاقاً (BUG-006: غير idempotent تحت التزامن، ولا يدعم المخطط   ║
// ║  الحالي فرادة `code`). هنا نُعيد **ترتيب المرشّحين** فقط، والخدمة ترفض بـ        ║
// ║  MissingAccountError إن لم يوجد أيٌّ منهم. فرق مُصنَّف C — راجع                  ║
// ║  docs/services/sales-invoice-posting.md §«الفروق المقصودة».                     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export const DEFAULT_SALES_REVENUE_CODE = '4100';

/**
 * ترتيب المرشّحين لحساب الإيرادات — بلا تكرار، بنفس أولوية القديم.
 * @param {{invoice:object}} p
 * @returns {string[]}
 */
export function salesRevenueAccountCandidates({ invoice }) {
    const primary = (invoice && invoice.salesAccountCode) || DEFAULT_SALES_REVENUE_CODE;
    return primary === DEFAULT_SALES_REVENUE_CODE ? [primary] : [primary, DEFAULT_SALES_REVENUE_CODE];
}

/**
 * يعيد كائن الحساب الأول الموجود فعلاً في الشجرة، أو null.
 * @param {{invoice:object, chartOfAccounts:object|Array}} p
 * @returns {object|null}
 */
export function resolveSalesRevenueAccount({ invoice, chartOfAccounts }) {
    const list = Array.isArray(chartOfAccounts) ? chartOfAccounts : Object.values(chartOfAccounts || {});
    for (const code of salesRevenueAccountCandidates({ invoice })) {
        const hit = list.find(a => a && a.code === code);
        if (hit) return hit;
    }
    return null;
}
