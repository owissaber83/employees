// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  النطاق · شجرة الحسابات · البنية الشجرية والتجميع                            ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  نقيّ. `buildHierarchy` منقولة حرفياً عن accounting.js:537 — يحرس تطابقها      ║
// ║  اختبار توصيفي يُشغّل النسخة القديمة نفسها ويقارن (tests/characterization).     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { isHeader } from './types.js';

/**
 * يبني شجرة من قائمة مسطّحة عبر حقل `parent` (الذي يحمل **رمز** الأب لا مفتاحه).
 *
 * سلوك موثّق من النسخة القديمة ويجب الحفاظ عليه:
 * - العنصر الذي `parent` فارغ **أو** يشير إلى رمز غير موجود ⇒ جذر (لا يُفقَد).
 * - الترتيب هو ترتيب المدخلات، بلا فرز.
 * - رمز مكرّر ⇒ الأخير يطغى في الخريطة (سلوك قائم، غير مثالي، محفوظ كما هو).
 *
 * @param {Array<{code:string,parent?:string}>} items
 * @returns {Array<object>} الجذور، ولكل عقدة `children`
 */
export function buildHierarchy(items) {
    const map = {};
    items.forEach(item => { map[item.code] = { ...item, children: [] }; });
    const roots = [];
    items.forEach(item => {
        if (item.parent && map[item.parent]) {
            map[item.parent].children.push(map[item.code]);
        } else {
            roots.push(map[item.code]);
        }
    });
    return roots;
}

/** أبناء رمز، مرتّبين بالرمز — منقول عن `childrenOf` في coaBalanceRows. */
export function childrenOf(accounts, code) {
    return accounts
        .filter(a => (a.parent || '') === code)
        .sort((x, y) => (x.code || '').localeCompare(y.code || ''));
}

/** الجذور: بلا أب، أو أبٌ غير موجود — منقول عن `roots` في coaBalanceRows. */
export function rootsOf(accounts) {
    const byCode = {};
    accounts.forEach(a => { byCode[a.code] = a; });
    return accounts
        .filter(a => !a.parent || !byCode[a.parent])
        .sort((x, y) => (x.code || '').localeCompare(y.code || ''));
}

const EMPTY = () => ({ opening: 0, debit: 0, credit: 0, closing: 0, count: 0 });

/**
 * مجاميع حساب: الورقة من أرصدتها، والتجميعي من مجموع أبنائه تنازلياً.
 * منقول عن `totalsFor` في accounting.js:1098.
 *
 * @param {Array} accounts كل الحسابات
 * @param {object} account الحساب المطلوب
 * @param {object} balances خريطة رمز ← {naturalOpening,periodDebit,periodCredit,naturalClosing,count}
 */
export function totalsFor(accounts, account, balances) {
    if (!isHeader(account)) {
        const b = balances && balances[account.code];
        if (b) {
            return {
                opening: b.naturalOpening, debit: b.periodDebit,
                credit: b.periodCredit, closing: b.naturalClosing, count: b.count
            };
        }
        const op = parseFloat(account.openingBalance) || 0;
        return { opening: op, debit: 0, credit: 0, closing: op, count: 0 };
    }
    const t = EMPTY();
    childrenOf(accounts, account.code).forEach(child => {
        const kt = totalsFor(accounts, child, balances);
        t.opening += kt.opening; t.debit += kt.debit;
        t.credit += kt.credit; t.closing += kt.closing; t.count += kt.count;
    });
    return t;
}

/** يسطّح الشجرة إلى صفوف بعمق — منقول عن `walk` في accounting.js:1113. */
export function flattenRows(accounts, balances) {
    const rows = [];
    const walk = (a, depth) => {
        rows.push({ a, depth, header: isHeader(a), t: totalsFor(accounts, a, balances) });
        if (isHeader(a)) childrenOf(accounts, a.code).forEach(k => walk(k, depth + 1));
    };
    rootsOf(accounts).forEach(r => walk(r, 0));
    return rows;
}
