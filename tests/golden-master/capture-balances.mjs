// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · مِشجب الأرصدة — دفتر الأستاذ · ميزان المراجعة ·               ║
// ║  أرصدة العملاء والموردين                                          [Phase 5]  ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يُشغّل دوال القراءة من public/accounting.js **كما هي**: calcFSBalances ·      ║
// ║  coaAccountOps · coaBalanceRows · tbCalcBalances · calcCustomerBalance ·       ║
// ║  calcVendorBalance · ensureStdAccount — بحقن الحالة واعتراض أي كتابة.          ║
// ║                                                                              ║
// ║  الفارق عن capture.mjs (Phase 4): هذه دوال **قراءة** لا **بناء قيد** — تعتمد   ║
// ║  على حالة عامة إضافية (`tbState`) وذاكرة تخزين مؤقت وحدوية (`_fsBalancesCache`، ║
// ║  `_custRenderMemo`) يجب حقنها كي تُقرأ الأسماء الحرّة داخل الجسم المُستخرَج.     ║
// ║                                                                              ║
// ║  🔒 لا كتابة في أي قاعدة بيانات. كل الكتابات (بما فيها ensureStdAccount) تُعترَض. ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { extractFunction, extractConst } from '../characterization/legacy-loader.mjs';

/** الدوال التي تُحمَّل من الشفرة القديمة نفسها — بترتيب لا يهم لأنها تُجمَع في نطاق واحد. */
const BALANCE_FNS = [
    'fsIsOpeningEntry',        // تصنيف القيد الافتتاحي — يستدعيها calcFSBalances وtbCalcBalances
    'ccLineMatchesProject',    // فلترة سطر بحسب المشروع — window.name = function (نمط بديل، legacy-loader يدعمه الآن)
    'calcFSBalances',          // محرّك الأرصدة المشترك (قائمة الدخل والمركز المالي)
    'coaAccountOps',           // دفتر الأستاذ لحساب واحد — حركات + رصيد ما قبل الفترة
    'coaBalanceRows',          // ميزان المراجعة الهرمي (يستدعي calcFSBalances)
    'tbCalcBalances',          // ميزان المراجعة المخصَّص — يقرأ tbState لا معاملات
    'calcCustomerBalance',     // رصيد عميل — مبني على الفواتير لا القيود
    'calcVendorBalance',       // رصيد مورد — نفس النمط
    'ensureStdAccount'         // ⚠️ غير متزامنة وتكتب — تُحمَّل من القديم لتُلتقَط كتابتها الحقيقية
];

/**
 * يبني «عالم الأرصدة» — أوسع من عالم Phase 4 لأن هذه الدوال تقرأ حالة أكبر.
 * @param {object} state
 * @returns {{globals, captured, window}}
 */
export function buildBalancesWorld(state = {}) {
    const captured = { pushes: [], updates: [], toasts: [], audits: [] };

    const win = {
        chartOfAccounts: state.chartOfAccounts || {},
        journalEntries: state.journalEntries || {},
        customers: state.customers || {},
        vendors: state.vendors || {},
        salesInvoices: state.salesInvoices || {},
        purchaseInvoices: state.purchaseInvoices || {}
    };

    const cfg = state.cfg || { baseCurrencyCode: 'SAR' };
    let pushSeq = 0;

    const globals = {
        window: win,
        cfg,
        curU: state.curU || { uid: 'test-user' },
        db: { __capture: true },

        // ── اعتراض الكتابات (ensureStdAccount فقط يكتب من بين هذه الدوال) ──────
        ref: (_db, path) => ({ path }),
        push: async (r, data) => {
            const key = `auto-${++pushSeq}`;
            captured.pushes.push({ path: r && r.path, key, data });
            return { key };
        },
        update: async (r, patch) => { captured.updates.push({ path: r && r.path, patch }); },

        R: { coa: { path: 'ledger/chartOfAccounts' } },

        toast: (m, t) => captured.toasts.push({ message: String(m), type: t || '' }),
        esc: s => String(s == null ? '' : s),
        logAudit: (...a) => captured.audits.push(a),

        // ── حالة ميزان المراجعة — module-scope `let tbState` في الأصل، مُحقَنة هنا ─
        // القيم الافتراضية مطابقة حرفياً لِـ`let tbState = {...}` في accounting.js:11742
        tbState: state.tbState || {
            fromDate: '', toDate: '', includeStatuses: ['posted'],
            showZero: false, groupBy: 'type', costCenter: '', projectId: ''
        },

        // ── تخزين مؤقت وحدوي — كل استدعاء يبدأ بكاش فارغ كي لا تتسرّب حالة بين الاختبارات ─
        // [Phase 5 · multi-tenant.test.mjs] قابل للحقن عمداً — يتيح محاكاة مرجع كاش
        // مشترك عبر عالمين (سيناريو تبديل مستأجر بلا إعادة تهيئة) لإثبات أن فحص
        // مرجع journalEntries وحده كافٍ لإسقاط الكاش القديم دون حاجة لتصفيره يدوياً.
        _fsBalancesCache: state._fsBalancesCache || { je: null, coa: null, map: new Map() },
        _custRenderMemo: null   // null ⇒ calcCustomerBalance تحسب دائماً، لا تقرأ ذاكرة عرض وهمية
    };

    try { globals.DEFAULT_ACCOUNTS = extractConst('DEFAULT_ACCOUNTS'); } catch (e) { globals.DEFAULT_ACCOUNTS = []; }

    // ⚠️ تُجمَّع كل الدوال في **نطاق واحد** — نفس درس Phase 4: coaBalanceRows تستدعي
    // calcFSBalances، وكلتاهما تستدعي fsIsOpeningEntry وربما ccLineMatchesProject.
    const bodies = [];
    const names = [];
    for (const name of BALANCE_FNS) {
        try { bodies.push(extractFunction(name)); names.push(name); }
        catch (e) { /* غير موجودة بهذا الاسم في هذا الملف — تبقى غير معرّفة عمداً */ }
    }
    const keys = Object.keys(globals);
    // eslint-disable-next-line no-new-func
    const built = new Function(...keys,
        `${bodies.join('\n')}\nreturn { ${names.join(', ')} };`)(...keys.map(k => globals[k]));
    Object.assign(globals, built);

    return { globals, captured, window: win, loaded: names };
}

/**
 * يستدعي دالة أرصدة محمَّلة ويعيد نتيجتها + ما التُقط من كتابات.
 * @param {string} fnName
 * @param {any[]} args
 * @param {object} state
 */
export async function captureBalanceFn(fnName, args, state = {}) {
    const { globals, captured, loaded } = buildBalancesWorld(state);
    if (!loaded.includes(fnName)) throw new Error(`لم تُحمَّل الدالة: ${fnName} (تحقّق من BALANCE_FNS أو من وجودها في accounting.js)`);
    let result = null, error = null;
    try { result = await globals[fnName](...args); }
    catch (e) { error = { message: e.message, name: e.name, stack: e.stack }; }
    return { result, error, captured };
}
