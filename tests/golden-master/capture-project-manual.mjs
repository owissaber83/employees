// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · مِشجب PMC والقيد اليدوي                            [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يُشغّل من public/accounting.js **كما هي**: `createJournalForPMC` ·              ║
// ║  `getPMCCategoryInfo` · `jrnBuildFinalLines` · `jrnConvertLinesToBase`.         ║
// ║                                                                              ║
// ║  ⚠️ `jrnBuildFinalLines` تستخدم `Math.random()` لتوليد `_agid` — يُحقَن هنا      ║
// ║  مولّد حتمي عبر استبدال `Math.random` داخل نطاق التشغيل، كي تكون اللقطة قابلة    ║
// ║  لإعادة الإنتاج. لا يُغيَّر شيء في الملف القديم.                                 ║
// ║                                                                              ║
// ║  🔒 لا كتابة في أي قاعدة بيانات.                                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { extractFunction, extractConst } from '../characterization/legacy-loader.mjs';

const HELPERS = ['getPMCCategoryInfo'];

export function buildPMWorld(state = {}) {
    const captured = { journals: [], updates: [], toasts: [], pushes: [] };
    const win = {
        chartOfAccounts: state.chartOfAccounts || {},
        projects: state.projects || {},
        costCenters: state.costCenters || {},
        pmcCustomCategories: state.pmcCustomCategories || {},
        projectMonthlyCosts: state.projectMonthlyCosts || {},
        journalEntries: state.journalEntries || {}
    };
    let seq = 0, rnd = 0;

    const globals = {
        window: win,
        cfg: state.cfg || { currency: 'SAR', baseCurrencyCode: 'SAR' },
        curU: state.curU || { uid: 'u-test' },
        db: { __capture: true },
        console,
        ref: (_db, path) => ({ path }),
        push: async (r, data) => {
            const path = String((r && r.path) || '');
            const key = `k-${++seq}`;
            if (path.includes('journalEntries')) captured.journals.push({ path, key, data });
            else captured.pushes.push({ path, key, data });
            return { key };
        },
        update: async (r, patch) => { captured.updates.push({ path: r && r.path, patch }); },
        runTransaction: async (_r, fn) => { const v = fn(null); return { committed: true, snapshot: { val: () => v } }; },
        R: { jrn: { path: 'ledger/journalEntries' } },
        toast: (m, t) => captured.toasts.push({ message: String(m), type: t || '' }),
        esc: s => String(s == null ? '' : s),
        fmt: n => (Number(n) || 0).toFixed(2),
        generateJrnNumberAtomic: async () => state.jrnNumber || 'JV-TEST-0001',
        // ⚠️ حتمية `_agid` — بديل Math.random داخل النطاق فقط
        Math: Object.create(Math, { random: { value: () => { rnd += 0.111111; return rnd % 1; } } }),
        VAT_OUT_ACC: '2140',
        VAT_IN_ACC: '1180'
    };

    try { globals.PMC_CATEGORIES = extractConst('PMC_CATEGORIES'); } catch (e) { globals.PMC_CATEGORIES = {}; }

    const bodies = [], names = [];
    for (const n of HELPERS) {
        try { bodies.push(extractFunction(n)); names.push(n); } catch (e) { /* اختياري */ }
    }
    if (names.length) {
        const keys = Object.keys(globals);
        // eslint-disable-next-line no-new-func
        Object.assign(globals, new Function(...keys, `${bodies.join('\n')}\nreturn { ${names.join(', ')} };`)(...keys.map(k => globals[k])));
    }
    return { globals, captured, window: win };
}

/** يُشغّل دالة قديمة داخل عالم PMC/القيد اليدوي. */
export async function capturePM(fnNames, entry, args, state = {}) {
    const { globals, captured, window: win } = buildPMWorld(state);
    const names = Array.isArray(fnNames) ? fnNames : [fnNames];
    const bodies = names.map(n => extractFunction(n));
    const keys = Object.keys(globals);
    // eslint-disable-next-line no-new-func
    const scope = new Function(...keys, `${bodies.join('\n')}\nreturn { ${names.join(', ')} };`)(...keys.map(k => globals[k]));

    let result = null, error = null;
    try { result = await scope[entry](...args); }
    catch (e) { error = { message: e.message, name: e.name }; }

    return {
        result, error, captured, window: win, scope,
        journal: captured.journals.length ? captured.journals[0].data : null,
        toasts: captured.toasts
    };
}

/** يُوحِّد معرّفات التوزيع التحليلي كي لا يُعتبر اختلافها اختلافاً حقيقياً. */
export function canonicalLines(lines) {
    const map = new Map();
    return (lines || []).map(l => {
        const o = { ...l };
        if (o._agid) {
            if (!map.has(o._agid)) map.set(o._agid, `AG${map.size + 1}`);
            o._agid = map.get(o._agid);
        }
        ['debit', 'credit', 'fcDebit', 'fcCredit'].forEach(k => {
            if (k in o) o[k] = Math.round((Number(o[k]) || 0) * 1e6) / 1e6;
        });
        return o;
    });
}
