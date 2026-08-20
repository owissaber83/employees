// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عوالم اختبار إشعارات الإرجاع — بيانات ثابتة                        [Phase 7-D] ║
// ║  🔒 مُصطنَعة بالكامل. لا نسخة من إنتاج، ولا قراءة من قاعدة حقيقية.               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export const ACCOUNTS = {
    k1130: { code: '1130', nameAr: 'العملاء (المدينون)' },
    k2140: { code: '2140', nameAr: 'ضريبة القيمة المضافة المستحقة (مخرجات)' },
    k4100: { code: '4100', nameAr: 'إيرادات عقود المقاولات (المستخلصات)' },
    k4110: { code: '4110', nameAr: 'إيرادات المبيعات' },
    k2110: { code: '2110', nameAr: 'الموردون (الدائنون)' },
    k1180: { code: '1180', nameAr: 'ضريبة القيمة المضافة (مدخلات)' },
    k5110: { code: '5110', nameAr: 'مشتريات مواد' },
    k5120: { code: '5120', nameAr: 'مشتريات خدمات' }
};

export function accountsWithout(...codes) {
    const out = {};
    for (const [k, a] of Object.entries(ACCOUNTS)) if (!codes.includes(a.code)) out[k] = a;
    return out;
}

export const CUSTOMERS = { C1: { nameAr: 'عميل المشروع الأول' } };
export const VENDORS = { V1: { nameAr: 'مورد الحديد' } };

export const ITEMS = {
    IT1: { nameAr: 'حديد تسليح', type: 'material', openingQty: 10, costPrice: 80 },
    IT2: { nameAr: 'أسمنت', type: 'material', openingQty: 0, costPrice: 25 },
    IT3: { nameAr: 'صنف بلا تكلفة', type: 'material', openingQty: 0, costPrice: 0 },
    SV1: { nameAr: 'خدمة إشراف', type: 'service' }
};

export const MOVEMENTS = {
    m1: { itemId: 'IT1', type: 'in', qty: 20, unitPrice: 90, date: '2026-01-05', createdAt: '2026-01-05T08:00:00.000Z' },
    m2: { itemId: 'IT2', type: 'in', qty: 100, unitPrice: 25, date: '2026-02-01', createdAt: '2026-02-01T08:00:00.000Z' }
};

/** فاتورة مبيعات مرحّلة: سطران، 2000 + 15% = 2300. */
export function salesInvoice(overrides = {}) {
    return {
        number: 'SINV-2026-001', date: '2026-03-01', customerId: 'C1', projectId: 'P1',
        status: 'posted', discount: 0,
        subTotal: 2000, netBeforeTax: 2000, vatTotal: 300, grandTotal: 2300,
        currency: 'SAR', exchangeRate: 1, salesAccountCode: '4100',
        lines: [
            { itemId: 'IT1', qty: 2, unitPrice: 750, total: 1500, vatRate: 15, description: 'حديد' },
            { itemId: 'IT2', qty: 5, unitPrice: 100, total: 500, vatRate: 15, description: 'أسمنت' }
        ],
        ...overrides
    };
}

/** فاتورة مشتريات مرحّلة: سطران، 2000 + 15% = 2300. */
export function purchaseInvoice(overrides = {}) {
    return {
        number: 'PINV-2026-001', date: '2026-03-01', vendorId: 'V1', vendorRef: 'SUP-77', projectId: 'P1',
        status: 'posted', discount: 0,
        subTotal: 2000, netBeforeTax: 2000, vatTotal: 300, grandTotal: 2300,
        currency: 'SAR', exchangeRate: 1, debitAccountCode: '5110', expenseType: 'materials',
        lines: [
            { itemId: 'IT1', qty: 2, unitPrice: 750, total: 1500, vatRate: 15, description: 'حديد' },
            { itemId: 'IT2', qty: 5, unitPrice: 100, total: 500, vatRate: 15, description: 'أسمنت' }
        ],
        ...overrides
    };
}

/** الحالة الكاملة لعالم المِشجب القديم. */
export function noteState(overrides = {}) {
    return {
        chartOfAccounts: ACCOUNTS, customers: CUSTOMERS, vendors: VENDORS,
        inventoryItems: ITEMS, inventoryMovements: MOVEMENTS, warehouses: {},
        cfg: { baseCurrencyCode: 'SAR' }, curU: { uid: 'u-test' }, jrnNumber: 'JV-TEST-0001',
        ...overrides
    };
}

/** يحلّ الحسابات كما يفعل القديم — بلا إنشاء. */
export function resolveFor(chart, codes) {
    const list = Object.values(chart);
    const by = c => list.find(a => a.code === c) || null;
    const out = {};
    for (const [k, c] of Object.entries(codes)) out[k] = by(c);
    return out;
}
