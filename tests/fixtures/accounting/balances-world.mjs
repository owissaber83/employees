// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  بيانات مُصنَّعة — عالم الأرصدة (دفتر الأستاذ · ميزان المراجعة · الأطراف)  [Phase 5] ║
// ║  🔒 لا بيان إنتاجي واحد. ملف مستقل عن world.mjs (Phase 4) — لا تُعدَّل لقطاته.  ║
// ║  الرموز الجديدة هنا مطابقة للشجرة الافتراضية (DEFAULT_ACCOUNTS في accounting.js)║
// ║  حيث أمكن، ومختارة لتكون المجاميع قابلة للحساب ذهنياً.                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/**
 * شجرة حسابات هرمية صغيرة: حساب أب (header) بفرعين (child) — لتغطية الحالتين G/H/I.
 * 1100 الأصول المتداولة (header)
 *   1110 الصندوق (child, detail)
 *   1120 البنك (child, detail)
 * 2100 الخصوم المتداولة (header)
 *   2110 الموردون (child, detail)
 * 3110 رأس المال (equity) · 4100 الإيرادات (revenue) · 5110 المصروفات (expense)
 */
export const HIER_ACCOUNTS = {
    a1100: { code: '1100', nameAr: 'الأصول المتداولة', type: 'asset', nature: 'header' },
    a1110: { code: '1110', nameAr: 'الصندوق', type: 'asset', nature: 'detail', parent: '1100', openingBalance: 1000 },
    a1120: { code: '1120', nameAr: 'البنك', type: 'asset', nature: 'detail', parent: '1100', openingBalance: 5000 },
    a2100: { code: '2100', nameAr: 'الخصوم المتداولة', type: 'liability', nature: 'header' },
    a2110: { code: '2110', nameAr: 'الموردون', type: 'liability', nature: 'detail', parent: '2100', openingBalance: 0 },
    a3110: { code: '3110', nameAr: 'رأس المال', type: 'equity', nature: 'credit', openingBalance: 6000 },
    a4100: { code: '4100', nameAr: 'الإيرادات', type: 'revenue', nature: 'detail' },
    a5110: { code: '5110', nameAr: 'مصروفات', type: 'expense', nature: 'detail' }
};

/** قيد افتتاحي صريح (sourceType:'opening') — يُصنَّف رصيداً أول المدة لا حركة فترة. */
export function openingEntry(overrides = {}) {
    return {
        number: 'OPEN-2026', date: '2026-01-01', status: 'posted', sourceType: 'opening',
        totalDebit: 500, totalCredit: 500,
        lines: [{ accountCode: '1120', debit: 500, credit: 0 }, { accountCode: '3110', debit: 0, credit: 500 }],
        ...overrides
    };
}

/** قيد عادي داخل الفترة: مدين مصروفات 300 · دائن بنك 300. */
export function movementEntry(overrides = {}) {
    return {
        number: 'JV-2026-01', date: '2026-03-15', status: 'posted',
        totalDebit: 300, totalCredit: 300,
        lines: [{ accountCode: '5110', debit: 300, credit: 0, description: 'مصروف تشغيلي' },
        { accountCode: '1120', debit: 0, credit: 300 }],
        ...overrides
    };
}

/** قيد مسوّدة (draft) — لاختبار تضمين/استبعاد المسودات. */
export function draftEntry(overrides = {}) {
    return {
        number: 'JV-2026-DRAFT', date: '2026-03-20', status: 'draft',
        totalDebit: 150, totalCredit: 150,
        lines: [{ accountCode: '5110', debit: 150, credit: 0 }, { accountCode: '1120', debit: 0, credit: 150 }],
        ...overrides
    };
}

/** قيد قبل بداية فترة نموذجية (2025) — بلا علامة افتتاحي. لاختبار الفجوة بين calcFSBalances وtbCalcBalances. */
export function prePeriodUnflaggedEntry(overrides = {}) {
    return {
        number: 'JV-2025-99', date: '2025-06-01', status: 'posted',
        totalDebit: 700, totalCredit: 700,
        lines: [{ accountCode: '5110', debit: 700, credit: 0 }, { accountCode: '1120', debit: 0, credit: 700 }],
        ...overrides
    };
}

export const CUSTOMERS = {
    C1: { code: 'CUS-01', nameAr: 'عميل تجريبي', openingBalance: 1000, active: true }
};
export const VENDORS = {
    V1: { code: 'SUP-01', nameAr: 'مورد تجريبي', openingBalance: 0, active: true }
};

/** فاتورة مبيعات مرحَّلة: 23,000 غير مدفوعة، مستحقّة قبل اليوم بكثير (لضمان overdue ثابت في أي وقت تشغيل). */
export function salesInvoice(overrides = {}) {
    return { customerId: 'C1', status: 'posted', date: '2026-01-10', dueDate: '2026-02-09',
        grandTotal: 23000, paidAmount: 0, creditedAmount: 0, fullyCredited: false, ...overrides };
}
/** فاتورة مشتريات مرحَّلة: 11,500 غير مدفوعة. */
export function purchaseInvoice(overrides = {}) {
    return { vendorId: 'V1', status: 'posted', date: '2026-01-10', dueDate: '2026-02-09',
        grandTotal: 11500, paidAmount: 0, debitedAmount: 0, ...overrides };
}

/** الحالة الكاملة المُحقنة في عالم الأرصدة القديم. */
export function balancesWorld(extra = {}) {
    return {
        chartOfAccounts: { ...HIER_ACCOUNTS },
        journalEntries: {},
        customers: { ...CUSTOMERS },
        vendors: { ...VENDORS },
        salesInvoices: {},
        purchaseInvoices: {},
        curU: { uid: 'u-test' },
        cfg: { baseCurrencyCode: 'SAR' },
        tbState: { fromDate: '', toDate: '', includeStatuses: ['posted'], showZero: false, groupBy: 'type', costCenter: '', projectId: '' },
        ...extra
    };
}
