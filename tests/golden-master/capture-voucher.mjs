// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · مِشجب السند والتخصيص                                 [Phase 7] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يُشغّل `createJournalForVoucher` و`allocateToInvoices` من accounting.js **كما   ║
// ║  هي** — بحقن حالة قابلة للقراءة (`get`) والكتابة (`update`)، على متجر ذاكرة      ║
// ║  بسيط لا Firebase فيه. الفارق عن capture.mjs (Phase 4): تلك تعترض الكتابة فقط    ║
// ║  ولا تدعم `get` حقيقياً (allocateToInvoices تقرأ القيمة الحالية صراحةً قبل        ║
// ║  التحديث — accounting.js:19739 — فمحاكاة قراءة حقيقية من نفس المتجر ضرورية).     ║
// ║                                                                              ║
// ║  🔒 لا كتابة في أي قاعدة بيانات حقيقية. متجر في الذاكرة فقط، يُرمى بعد كل اختبار. ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { extractFunction, extractConst } from '../characterization/legacy-loader.mjs';

const VOUCHER_FNS = ['createJournalForVoucher', 'allocateToInvoices', 'unallocateFromInvoices'];
const HELPERS = ['vendPayableAccount', 'custReceivableAccount', 'baseCurrencyCode', 'arApMode'];

const getPath = (store, path) => path.split('/').filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), store);
const setPath = (store, path, v) => {
    const parts = path.split('/').filter(Boolean);
    let cur = store;
    for (let i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] == null) cur[parts[i]] = {}; cur = cur[parts[i]]; }
    cur[parts[parts.length - 1]] = v;
};

/**
 * @param {object} state {chartOfAccounts, vendors, customers, salesInvoices, purchaseInvoices, curU, cfg}
 * @returns {{globals, captured, store}}
 */
export function buildVoucherWorld(state = {}) {
    const captured = { journals: [], updates: [], toasts: [] };
    const store = {
        ledger: {
            salesInvoices: { ...(state.salesInvoices || {}) },
            purchaseInvoices: { ...(state.purchaseInvoices || {}) }
        }
    };
    const win = {
        chartOfAccounts: state.chartOfAccounts || {},
        vendors: state.vendors || {},
        customers: state.customers || {}
    };
    const cfg = state.cfg || { baseCurrencyCode: 'SAR' };
    let jrnSeq = 0;

    const globals = {
        window: win, cfg, curU: state.curU || { uid: 'test-user' }, db: { __capture: true },
        ref: (_db, path) => ({ path }),
        get: async r => { const v = getPath(store, r.path); return { exists: () => v != null, val: () => v }; },
        push: async (r, data) => {
            const key = `jrn-${++jrnSeq}`;
            const entry = { __path: r && r.path, key, data };
            if (String(r && r.path).includes('journalEntries')) captured.journals.push(entry);
            return { key };
        },
        update: async (r, patch) => {
            captured.updates.push({ path: r && r.path, patch });
            // نطبّق التحديث فعلياً على المتجر — allocateToInvoices تعتمد على قراءة لاحقة صحيحة
            Object.keys(patch).forEach(k => setPath(store, `${r.path}/${k}`, patch[k]));
        },
        R: { jrn: { path: 'ledger/journalEntries' } },
        toast: (m, t) => captured.toasts.push({ message: String(m), type: t || '' }),
        esc: s => String(s == null ? '' : s),
        fmt: n => (Number(n) || 0).toFixed(2),
        generateJrnNumberAtomic: async () => state.jrnNumber || 'JV-TEST-0001'
    };

    try { globals.DEFAULT_ACCOUNTS = extractConst('DEFAULT_ACCOUNTS'); } catch (e) { globals.DEFAULT_ACCOUNTS = []; }

    const bodies = [], names = [];
    for (const name of [...HELPERS, ...VOUCHER_FNS]) {
        try { bodies.push(extractFunction(name)); names.push(name); }
        catch (e) { /* غير موجودة */ }
    }
    const keys = Object.keys(globals);
    // eslint-disable-next-line no-new-func
    const built = new Function(...keys, `${bodies.join('\n')}\nreturn { ${names.join(', ')} };`)(...keys.map(k => globals[k]));
    Object.assign(globals, built);

    return { globals, captured, store, window: win };
}

export async function captureVoucherFn(fnName, args, state = {}) {
    const { globals, captured, store } = buildVoucherWorld(state);
    let result = null, error = null;
    try { result = await globals[fnName](...args); }
    catch (e) { error = { message: e.message, name: e.name }; }
    return { result, error, captured, store };
}
