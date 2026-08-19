// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  بيانات مُصنَّعة — عالم محاسبي صغير قابل للتدقيق يدوياً                          ║
// ║  🔒 لا بيان إنتاجي واحد. أرقام مختارة لتكون المجاميع قابلة للحساب ذهنياً.       ║
// ║  الرموز مطابقة للشجرة الافتراضية في accounting.js — لا مخترعة:                 ║
// ║    1130 العملاء · 1180 ضريبة مدخلات · 2110 الموردون · 2140 ضريبة مخرجات        ║
// ║    4100 الإيرادات · 5110 مشتريات مواد                                          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export const ACCOUNTS = {
    a1110: { code: '1110', nameAr: 'الصندوق', type: 'asset', nature: 'debit', openingBalance: 1000 },
    a1120: { code: '1120', nameAr: 'البنك', type: 'asset', nature: 'debit', openingBalance: 50000 },
    a1130: { code: '1130', nameAr: 'العملاء', type: 'asset', nature: 'debit', openingBalance: 0 },
    a1180: { code: '1180', nameAr: 'ضريبة القيمة المضافة المدفوعة (مدخلات)', type: 'asset', nature: 'detail' },
    a2110: { code: '2110', nameAr: 'الموردون', type: 'liability', nature: 'credit', openingBalance: 0 },
    a2140: { code: '2140', nameAr: 'ضريبة القيمة المضافة المستحقة (مخرجات)', type: 'liability', nature: 'detail' },
    a3110: { code: '3110', nameAr: 'رأس المال', type: 'equity', nature: 'credit', openingBalance: 51000 },
    a4100: { code: '4100', nameAr: 'الإيرادات', type: 'revenue', nature: 'detail' },
    a5110: { code: '5110', nameAr: 'مشتريات مواد', type: 'expense', nature: 'debit' },
    a5120: { code: '5120', nameAr: 'مشتريات خدمات', type: 'expense', nature: 'debit' }
};

export const VENDORS = {
    V1: { code: 'SUP-001', nameAr: 'مورد الحديد', nameEn: 'Steel Supplier', vatNumber: '311111111111113', groupAccount: '', active: true },
    V2: { code: 'SUP-002', nameAr: 'مورد الأسمنت', vatNumber: '322222222222223', active: true }
};

export const CUSTOMERS = {
    C1: { code: 'CUS-001', nameAr: 'عميل المشروع الأول', vatNumber: '333333333333333', active: true },
    C2: { code: 'CUS-002', nameAr: 'عميل المشروع الثاني', active: true }
};

export const PROJECTS = { P1: { name: 'مشروع الرياض' }, P2: { name: 'مشروع جدة' } };

/** فاتورة مشتريات: 10,000 + 15% = 11,500 */
export const PURCHASE_INVOICE = {
    number: 'PINV-2026-001', vendorId: 'V1', vendorRef: 'SUP-INV-77',
    date: '2026-03-10', dueDate: '2026-04-09',
    expenseType: 'materials', debitAccountCode: '5110',
    projectId: 'P1', costCenter: '',
    subTotal: 10000, discount: 0, netBeforeTax: 10000, vatTotal: 1500, grandTotal: 11500,
    currency: 'SAR', exchangeRate: 1, status: 'posted'
};

/** فاتورة مبيعات: 20,000 + 15% = 23,000 */
export const SALES_INVOICE = {
    number: 'SINV-2026-001', customerId: 'C1',
    date: '2026-03-12', dueDate: '2026-04-11',
    projectId: 'P1', costCenter: '',
    subTotal: 20000, discount: 0, netBeforeTax: 20000, vatTotal: 3000, grandTotal: 23000,
    retentionAmount: 0, advanceRecoveryAmount: 0,
    currency: 'SAR', exchangeRate: 1, status: 'posted'
};

/** سند صرف لمورد: 11,500 */
export const PAYMENT_VOUCHER = {
    number: 'PV-2026-001', type: 'payment', partyId: 'V1',
    date: '2026-03-20', amount: 11500, cashAccountCode: '1120',
    projectId: '', costCenter: '', currency: 'SAR', exchangeRate: 1, status: 'posted'
};

/** سند قبض من عميل: 23,000 */
export const RECEIPT_VOUCHER = {
    number: 'RV-2026-001', type: 'receipt', partyId: 'C1',
    date: '2026-03-25', amount: 23000, cashAccountCode: '1120',
    projectId: '', costCenter: '', currency: 'SAR', exchangeRate: 1, status: 'posted'
};

/** الحالة الكاملة التي تُحقن في العالم القديم. */
export function world(extra = {}) {
    return {
        chartOfAccounts: { ...ACCOUNTS },
        vendors: { ...VENDORS },
        customers: { ...CUSTOMERS },
        projects: { ...PROJECTS },
        curU: { uid: 'u-test' },
        cfg: { baseCurrencyCode: 'SAR' },
        jrnNumber: 'JV-TEST-0001',
        ...extra
    };
}
