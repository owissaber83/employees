// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  مِشجب التقاط السلوك القديم — Legacy Capture Method                           ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يُشغّل دوال بناء القيود من public/accounting.js **كما هي**، بحقن الحالة        ║
// ║  واعتراض كل كتابة، فيلتقط ما يُنتجه النظام فعلاً — بلا متصفح وبلا قاعدة بيانات. ║
// ║                                                                              ║
// ║  المبدأ: لا نسخ يدوي للمنطق. النسخ يوثّق قراءتي؛ التشغيل يوثّق السلوك.          ║
// ║  والدوال المساعدة الحقيقية (vendPayableAccount · baseCurrencyCode …) تُحمَّل     ║
// ║  من الملف القديم أيضاً — لا تُستبدل بجذوع، وإلا التقطنا سلوكاً لم يقع قط.       ║
// ║                                                                              ║
// ║  🔒 لا كتابة في أي قاعدة بيانات. كل الكتابات تُعترَض وتُسجَّل.                   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { extractFunction, extractConst } from '../characterization/legacy-loader.mjs';

/** دوال مساعدة تُحمَّل من الشفرة القديمة نفسها لا تُستنسخ. */
const LEGACY_HELPERS = [
    'vendPayableAccount', 'custReceivableAccount', 'baseCurrencyCode',
    'getPMCCategoryInfo', 'arApMode', 'getExpenseAccountForType',
    // ⚠️ ensureStdAccount تُحمَّل من القديم لا تُجذَّع: هي التي تنشئ الحساب
    // القياسي الناقص وتعيد **كائن حساب** لا رمزاً. تجذيعها برمز نصّي كان
    // يُنتج accountCode = undefined في القيد — عطلٌ في المِشجب يُقرأ خطأً
    // على أنه عطل في النظام.
    'ensureStdAccount'
];

/**
 * يبني «عالماً» يُشغَّل داخله القديم.
 * @param {object} state {chartOfAccounts, vendors, customers, ...}
 * @returns {{globals, captured}}
 */
export function buildWorld(state = {}) {
    const captured = {
        journals: [],      // ما دُفع إلى R.jrn
        updates: [],       // كل update(ref(...), patch)
        toasts: [],        // الرسائل — جزء من السلوك الملحوظ
        audits: [],
        pushes: []         // أي push آخر
    };

    const win = {
        chartOfAccounts: state.chartOfAccounts || {},
        vendors: state.vendors || {},
        customers: state.customers || {},
        journalEntries: state.journalEntries || {},
        purchaseInvoices: state.purchaseInvoices || {},
        salesInvoices: state.salesInvoices || {},
        supplierGroups: state.supplierGroups || {},
        customerGroups: state.customerGroups || {},
        projects: state.projects || {}
    };

    const cfg = state.cfg || { baseCurrencyCode: 'SAR' };
    let jrnSeq = 0;

    const globals = {
        window: win,
        cfg,
        curU: state.curU || { uid: 'test-user' },
        db: { __capture: true },

        // ── اعتراض الكتابات ──────────────────────────────────────────────────
        ref: (_db, path) => ({ path }),
        push: async (r, data) => {
            const key = `jrn-${++jrnSeq}`;
            const entry = { __path: r && r.path, key, data };
            if (String(r && r.path).includes('journalEntries')) captured.journals.push(entry);
            else captured.pushes.push(entry);
            return { key };
        },
        update: async (r, patch) => { captured.updates.push({ path: r && r.path, patch }); },
        remove: async r => { captured.updates.push({ path: r && r.path, removed: true }); },
        runTransaction: async (_r, fn) => ({ committed: true, snapshot: { val: () => fn(null) } }),

        R: { jrn: { path: 'ledger/journalEntries' } },

        // ── واجهة وهمية ──────────────────────────────────────────────────────
        toast: (m, t) => captured.toasts.push({ message: String(m), type: t || '' }),
        esc: s => String(s == null ? '' : s),
        fmt: n => (Number(n) || 0).toFixed(2),
        logAudit: (...a) => captured.audits.push(a),

        // ── ترقيم القيد: ثابت كي تكون اللقطة قابلة لإعادة الإنتاج ────────────
        generateJrnNumberAtomic: async () => state.jrnNumber || 'JV-TEST-0001',

        // ── حسابات قياسية ────────────────────────────────────────────────────
        cashAccountCode: state.cashAccountCode || (() => '1110'),
        salesAccountCode: state.salesAccountCode || (() => '4110'),
        expenseAccountCode: state.expenseAccountCode || (() => '5110')
    };

    // الثوابت والدوال المساعدة من الشفرة القديمة نفسها
    try { globals.DEFAULT_ACCOUNTS = extractConst('DEFAULT_ACCOUNTS'); } catch (e) { globals.DEFAULT_ACCOUNTS = {}; }
    try { globals.COA_TYPES = extractConst('COA_TYPES'); } catch (e) { /* اختياري */ }

    // ⚠️ تُجمَّع المساعدات في **نطاق واحد** لا كلٌّ على حدة: بعضها يستدعي بعضاً
    // (vendPayableAccount ← arApMode). التجميع المنفصل يجعل الاستدعاء المتبادل
    // مرجعاً غير معرّف، فيفشل الالتقاط بسبب المِشجب لا بسبب الشفرة القديمة.
    const bodies = [];
    const names = [];
    for (const name of LEGACY_HELPERS) {
        try { bodies.push(extractFunction(name)); names.push(name); }
        catch (e) { /* غير موجود في هذا الملف — يبقى غير معرّف عمداً */ }
    }
    if (names.length) {
        const keys = Object.keys(globals);
        // eslint-disable-next-line no-new-func
        const built = new Function(...keys,
            `${bodies.join('\n')}\nreturn { ${names.join(', ')} };`)(...keys.map(k => globals[k]));
        Object.assign(globals, built);
    }

    return { globals, captured, window: win };
}

/**
 * يُشغّل دالة قديمة داخل العالم ويعيد ما التُقط.
 * @returns {Promise<{result, journal, journalLines, updates, toasts, error, captured}>}
 */
export async function captureLegacy(fnName, args, state = {}) {
    const { globals, captured } = buildWorld(state);
    const body = extractFunction(fnName);
    const keys = Object.keys(globals);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `${body}\nreturn ${fnName};`)(...keys.map(k => globals[k]));

    let result = null, error = null;
    try { result = await fn(...args); }
    catch (e) { error = { message: e.message, name: e.name }; }

    const journal = captured.journals.length ? captured.journals[0].data : null;
    return {
        result, error, captured,
        journal,
        journalLines: journal ? (journal.lines || []) : [],
        updates: captured.updates,
        toasts: captured.toasts
    };
}

/** يعدّ عمليات القاعدة — لخط أساس الأداء (§19). */
export function countDbOps(captured) {
    return {
        writes: captured.journals.length + captured.pushes.length + captured.updates.length,
        pushes: captured.journals.length + captured.pushes.length,
        updates: captured.updates.length,
        reads: 0   // الدوال المُلتقَطة تقرأ من الذاكرة لا من القاعدة
    };
}
