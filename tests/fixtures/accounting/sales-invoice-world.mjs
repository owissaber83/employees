// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عوالم اختبار فاتورة المبيعات — بيانات ثابتة قابلة لإعادة الإنتاج   [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 بيانات مُصطنَعة بالكامل. لا نسخة من إنتاج، ولا قراءة من قاعدة حقيقية.        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export const ACCOUNTS = {
    k1130: { code: '1130', nameAr: 'العملاء (المدينون)', type: 'asset', nature: 'detail' },
    k1131: { code: '1131', nameAr: 'محتجزات (ضمان) لدى العملاء', type: 'asset', nature: 'detail' },
    k2140: { code: '2140', nameAr: 'ضريبة القيمة المضافة المستحقة (مخرجات)', type: 'liability', nature: 'detail' },
    k2150: { code: '2150', nameAr: 'دفعات مقدمة من العملاء', type: 'liability', nature: 'detail' },
    k4100: { code: '4100', nameAr: 'إيرادات عقود المقاولات (المستخلصات)', type: 'revenue', nature: 'detail' },
    k4110: { code: '4110', nameAr: 'إيرادات المبيعات', type: 'revenue', nature: 'detail' },
    kG: { code: '1130-A', nameAr: 'مجموعة عملاء أ', type: 'asset', nature: 'detail' }
};

/** نسخة من الشجرة بعد حذف رموز بعينها — لاختبارات الحساب المفقود. */
export function accountsWithout(...codes) {
    const out = {};
    for (const [k, a] of Object.entries(ACCOUNTS)) if (!codes.includes(a.code)) out[k] = a;
    return out;
}

export const CUSTOMERS = {
    C1: { nameAr: 'عميل المشروع الأول' },
    CG: { nameAr: 'عميل بمجموعة', groupAccount: '1130-A' }
};

export const ITEMS = {
    IT1: { nameAr: 'حديد تسليح', type: 'material', openingQty: 10, costPrice: 80 },
    IT2: { nameAr: 'أسمنت', type: 'material', openingQty: 0, costPrice: 25 },
    IT3: { nameAr: 'صنف بلا حركات ولا رصيد', type: 'material', openingQty: 0, costPrice: 0 },
    SV1: { nameAr: 'خدمة إشراف', type: 'service' }
};

export const MOVEMENTS = {
    m1: { itemId: 'IT1', type: 'in', qty: 20, unitPrice: 90, date: '2026-01-05', createdAt: '2026-01-05T08:00:00.000Z' },
    m2: { itemId: 'IT2', type: 'in', qty: 100, unitPrice: 25, date: '2026-02-01', createdAt: '2026-02-01T08:00:00.000Z' }
};

/** فاتورة مسوّدة قياسية — 20000 + 15% = 23000. */
export function salesInvoice(overrides = {}) {
    return {
        number: 'SINV-2026-001', date: '2026-03-12', customerId: 'C1', projectId: 'P1',
        netBeforeTax: 20000, vatTotal: 3000, grandTotal: 23000,
        currency: 'SAR', exchangeRate: 1, status: 'draft',
        lines: [{ itemId: 'IT1', qty: 5, unitPrice: 4000, description: 'توريد حديد' }],
        ...overrides
    };
}

/** الحالة الكاملة لعالم المِشجب القديم. */
export function salesState(overrides = {}) {
    return {
        chartOfAccounts: ACCOUNTS,
        customers: CUSTOMERS,
        inventoryItems: ITEMS,
        inventoryMovements: MOVEMENTS,
        warehouses: {},
        cfg: { baseCurrencyCode: 'SAR' },
        curU: { uid: 'u-test' },
        jrnNumber: 'JV-TEST-0001',
        ...overrides
    };
}

/** يحلّ الحسابات كما يفعل القديم قبل البناء — بلا إنشاء (المقارنة تكون على نفس المدخلات). */
export function resolveAccounts(chart, { receivableCode = '1130', revenueCode = '4100' } = {}) {
    const list = Object.values(chart);
    const by = c => list.find(a => a.code === c) || null;
    return {
        receivableAccount: by(receivableCode),
        revenueAccount: by(revenueCode),
        vatPayableAccount: by('2140'),
        retentionAccount: by('1131'),
        advanceAccount: by('2150')
    };
}
