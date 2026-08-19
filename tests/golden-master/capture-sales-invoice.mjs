// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · مِشجب فاتورة المبيعات (قيد + مخزون)                [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يُشغّل `createJournalForSInv` و`createInventoryMovementsForSInv` من             ║
// ║  public/accounting.js **كما هما** — بحقن الحالة واعتراض كل كتابة.               ║
// ║                                                                              ║
// ║  الفارق عن capture.mjs (Phase 4): تلك لا تعرف المخزون إطلاقاً. هنا يُبنى عالم    ║
// ║  يشمل `inventoryItems` · `inventoryMovements` · `warehouses` وكل دوال التقييم   ║
// ║  الحقيقية (`calcInvItemMovingAvg` · `calcInvItemBalance` · `whIdOfMovement` …)  ║
// ║  **مُحمَّلة من الملف القديم لا مُجذَّعة** — تجذيعها يلتقط سلوكاً لم يقع قط.         ║
// ║                                                                              ║
// ║  🔒 لا كتابة في أي قاعدة بيانات. كل الكتابات تُعترَض وتُسجَّل في الذاكرة.          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { extractFunction, extractConst, readLegacy } from '../characterization/legacy-loader.mjs';

/** دوال مساعدة تُحمَّل من الشفرة القديمة نفسها — لا تُستنسخ. */
const HELPERS = [
    'custReceivableAccount', 'vendPayableAccount', 'arApMode', 'baseCurrencyCode',
    'ensureStdAccount',
    // ── المخزون ──
    'mainWarehouseId', 'whIdOfMovement', 'invMovDate',
    'calcInvItemBalance', 'calcInvItemMovingAvg'
];

/** يقرأ القيمة الحرفية لـWAREHOUSE_MAIN_FALLBACK من الملف الحيّ — لا نسخة ثابتة تتعفّن. */
function readWarehouseFallback() {
    const m = /const\s+WAREHOUSE_MAIN_FALLBACK\s*=\s*'([^']*)'/.exec(readLegacy());
    if (!m) throw new Error('لم يُعثر على WAREHOUSE_MAIN_FALLBACK في الملف القديم');
    return m[1];
}

/**
 * @param {object} state {chartOfAccounts, customers, inventoryItems, inventoryMovements, warehouses, cfg, curU, jrnNumber}
 */
export function buildSalesWorld(state = {}) {
    const captured = { journals: [], movements: [], updates: [], toasts: [], audits: [], coaCreated: [], pushes: [] };

    const win = {
        chartOfAccounts: state.chartOfAccounts || {},
        customers: state.customers || {},
        vendors: state.vendors || {},
        customerGroups: state.customerGroups || {},
        supplierGroups: state.supplierGroups || {},
        salesInvoices: state.salesInvoices || {},
        journalEntries: state.journalEntries || {},
        inventoryItems: state.inventoryItems || {},
        inventoryMovements: state.inventoryMovements || {},
        warehouses: state.warehouses || {}
    };

    const cfg = state.cfg || { baseCurrencyCode: 'SAR' };
    let seq = 0, movSeq = 0;

    const globals = {
        window: win, cfg,
        curU: state.curU || { uid: 'u-test' },
        db: { __capture: true },
        WAREHOUSE_MAIN_FALLBACK: readWarehouseFallback(),

        ref: (_db, path) => ({ path }),
        push: async (r, data) => {
            const path = String((r && r.path) || '');
            const key = `k-${++seq}`;
            const entry = { __path: path, key, data };
            if (path.includes('journalEntries')) captured.journals.push(entry);
            else if (path.includes('inventoryMovements')) captured.movements.push(entry);
            else if (path.includes('chartOfAccounts')) {
                captured.coaCreated.push(entry);
                // القديم يعتمد على وصول الحساب لاحقاً عبر onValue — نحاكي ذلك بإضافته
                // للقطة كي تعكس اللقطةُ ما تعكسه ذاكرة المتصفّح بعد الحدث.
                win.chartOfAccounts[key] = data;
            } else captured.pushes.push(entry);
            return { key };
        },
        update: async (r, patch) => { captured.updates.push({ path: r && r.path, patch }); },
        remove: async r => { captured.updates.push({ path: r && r.path, removed: true }); },
        runTransaction: async (_r, fn) => { const v = fn(null); return { committed: true, snapshot: { val: () => v } }; },

        R: { jrn: { path: 'ledger/journalEntries' }, coa: { path: 'ledger/chartOfAccounts' }, invmov: { path: 'ledger/inventoryMovements' } },

        toast: (m, t) => captured.toasts.push({ message: String(m), type: t || '' }),
        esc: s => String(s == null ? '' : s),
        fmt: n => (Number(n) || 0).toFixed(2),
        logAudit: (...a) => captured.audits.push(a),
        console,

        // ترقيم ثابت كي تكون اللقطة قابلة لإعادة الإنتاج
        generateJrnNumberAtomic: async () => state.jrnNumber || 'JV-TEST-0001',
        generateInvMovNumberAtomic: async () => `OUT-TEST-${String(++movSeq).padStart(5, '0')}`
    };

    try { globals.DEFAULT_ACCOUNTS = extractConst('DEFAULT_ACCOUNTS'); } catch (e) { globals.DEFAULT_ACCOUNTS = []; }

    // ⚠️ تُجمَّع المساعدات في نطاق واحد لا كلٌّ على حدة — بعضها يستدعي بعضاً
    // (calcInvItemMovingAvg ← whIdOfMovement ← mainWarehouseId).
    const bodies = [], names = [];
    for (const name of HELPERS) {
        try { bodies.push(extractFunction(name)); names.push(name); }
        catch (e) { /* غير موجودة — تبقى غير معرَّفة عمداً */ }
    }
    if (names.length) {
        const keys = Object.keys(globals);
        // eslint-disable-next-line no-new-func
        const built = new Function(...keys, `${bodies.join('\n')}\nreturn { ${names.join(', ')} };`)(...keys.map(k => globals[k]));
        Object.assign(globals, built);
    }

    return { globals, captured, window: win };
}

/** يُشغّل دالة قديمة داخل عالم المبيعات ويعيد ما التُقط. */
export async function captureSales(fnName, args, state = {}) {
    const { globals, captured, window: win } = buildSalesWorld(state);
    const body = extractFunction(fnName);
    const keys = Object.keys(globals);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `${body}\nreturn ${fnName};`)(...keys.map(k => globals[k]));

    let result = null, error = null;
    try { result = await fn(...args); }
    catch (e) { error = { message: e.message, name: e.name }; }

    const journal = captured.journals.length ? captured.journals[0].data : null;
    return {
        result, error, captured, window: win,
        journal,
        journalLines: journal ? (journal.lines || []) : [],
        movements: captured.movements.map(m => m.data),
        updates: captured.updates,
        toasts: captured.toasts
    };
}

/** تمثيل معياري لحركة مخزون — يُسقط ما يتغيّر بين تشغيل وآخر فقط. */
export function canonicalMovement(m) {
    if (!m) return null;
    const out = {};
    ['date', 'type', 'itemId', 'projectId', 'reason', 'description', 'notes', 'sourceType', 'sourceKey', 'createdBy']
        .forEach(k => { if (k in m) out[k] = m[k]; });
    ['qty', 'unitPrice', 'salePrice'].forEach(k => { if (k in m) out[k] = Math.round((Number(m[k]) || 0) * 1e6) / 1e6; });
    out.hasWarehouseId = 'warehouseId' in m;   // فرق بنيوي حقيقي لو ظهر — لا يُخفى
    return out;
}
