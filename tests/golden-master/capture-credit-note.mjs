// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · مِشجب الإشعار الدائن (والمدين)                     [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يُشغّل دوال الإشعارات من public/accounting.js **كما هي**: `cnCompute` ·          ║
// ║  `createJournalForCreditNote` · `createReturnMovementsForCN` · `submitCreditNote` ║
// ║  ونظائرها المدينة — بحقن الحالة واعتراض كل كتابة.                              ║
// ║                                                                              ║
// ║  ⚠️ الفارق الجوهري عن مشاجب Phase 4–7-C: `cnCompute`/`dnCompute` تقرآن كميات    ║
// ║  الإرجاع من **DOM** مباشرةً (`getElementById('cnQty'+i)`). لذلك يُحقن هنا        ║
// ║  `document` وهمي يُرجع القيم المطلوبة — وهذا ما يجعل مقارنة الدالة النقيّة        ║
// ║  الجديدة بالسلوك القديم **الحقيقي** ممكنة أصلاً، بدل نسخ المنطق يدوياً.          ║
// ║                                                                              ║
// ║  🔒 لا كتابة في أي قاعدة بيانات. كل الكتابات تُعترَض وتُسجَّل في الذاكرة.          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { extractFunction, extractConst } from '../characterization/legacy-loader.mjs';

/** دوال مساعدة تُحمَّل من الشفرة القديمة نفسها — لا تُستنسخ. */
const HELPERS = [
    'custReceivableAccount', 'vendPayableAccount', 'arApMode', 'baseCurrencyCode',
    'getExpenseAccountForType',
    'mainWarehouseId', 'whIdOfMovement', 'invMovDate',
    'calcInvItemBalance', 'calcInvItemMovingAvg'
];

/**
 * `document` وهمي — يخدم `cnQty{i}` · `dnQty{i}` · حقول النموذج · عناصر العرض.
 * @param {{quantities?:number[], invoiceKey?:string, reason?:string, prefix:'cn'|'dn'}} p
 */
function fakeDocument({ quantities, invoiceKey, reason, prefix }) {
    const sink = () => ({ textContent: '', value: '' });
    return {
        getElementById(id) {
            const qm = new RegExp(`^${prefix}Qty(\\d+)$`).exec(id);
            if (qm) {
                // ⚠️ `quantities === undefined` ⇒ نُرجع null فيرتدّ القديم إلى الكمّية الأصلية
                //    (`rq ? … : origQty`) — وهذا مسار حقيقي يجب أن يبقى قابلاً للاختبار.
                if (!quantities) return null;
                const v = quantities[Number(qm[1])];
                return v === undefined ? null : { value: String(v) };
            }
            if (id === `${prefix}InvKey`) return { value: invoiceKey || '' };
            if (id === `${prefix}Reason`) return { value: reason == null ? '' : String(reason) };
            if (id === 'taskEditorOverlay') return { remove() {} };
            return sink();
        }
    };
}

/**
 * يبني «عالماً» يُشغَّل داخله القديم.
 * @param {object} state {chartOfAccounts, customers, vendors, salesInvoices, purchaseInvoices,
 *                        inventoryItems, inventoryMovements, warehouses, creditNotes, debitNotes, cfg, curU}
 * @param {{prefix:'cn'|'dn', quantities?:number[], invoiceKey?:string, reason?:string}} ui
 */
export function buildNotesWorld(state = {}, ui = { prefix: 'cn' }) {
    const captured = {
        notes: [], journals: [], movements: [], updates: [], toasts: [], confirms: [], pushes: []
    };

    const win = {
        chartOfAccounts: state.chartOfAccounts || {},
        customers: state.customers || {},
        vendors: state.vendors || {},
        customerGroups: state.customerGroups || {},
        supplierGroups: state.supplierGroups || {},
        salesInvoices: state.salesInvoices || {},
        purchaseInvoices: state.purchaseInvoices || {},
        creditNotes: state.creditNotes || {},
        debitNotes: state.debitNotes || {},
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
        WAREHOUSE_MAIN_FALLBACK: 'main',
        console,
        document: fakeDocument(ui),

        ref: (_db, path) => ({ path }),
        push: async (r, data) => {
            const path = String((r && r.path) || '');
            const key = `k-${++seq}`;
            const entry = { __path: path, key, data };
            if (path.includes('journalEntries')) captured.journals.push(entry);
            else if (path.includes('inventoryMovements')) captured.movements.push(entry);
            else if (path.includes('creditNotes') || path.includes('debitNotes')) {
                captured.notes.push(entry);
                // القديم يقرأ اللقطة لاحقاً — نعكس الكتابة كي يعكسها الترقيم التالي
                (path.includes('creditNotes') ? win.creditNotes : win.debitNotes)[key] = data;
            } else captured.pushes.push(entry);
            return { key };
        },
        update: async (r, patch) => { captured.updates.push({ path: r && r.path, patch }); },
        remove: async r => { captured.updates.push({ path: r && r.path, removed: true }); },
        runTransaction: async (_r, fn) => { const v = fn(null); return { committed: true, snapshot: { val: () => v } }; },

        R: {
            jrn: { path: 'ledger/journalEntries' },
            coa: { path: 'ledger/chartOfAccounts' },
            invmov: { path: 'ledger/inventoryMovements' }
        },

        toast: (m, t) => captured.toasts.push({ message: String(m), type: t || '' }),
        esc: s => String(s == null ? '' : s),
        fmt: n => (Number(n) || 0).toFixed(2),
        logAudit: () => {},
        // موافقة المستخدم — تُسجَّل ويُفترض القبول (رفضها مسار واجهة لا محاسبة)
        cf2: async msg => { captured.confirms.push(String(msg)); return state.confirm !== false; },
        renderSalesInvoices: () => {},
        renderPurchaseInvoices: () => {},

        // ترقيم ثابت كي تكون اللقطة قابلة لإعادة الإنتاج
        generateJrnNumberAtomic: async () => state.jrnNumber || 'JV-TEST-0001',
        generateInvMovNumberAtomic: async t => `${t === 'in' ? 'IN' : 'OUT'}-TEST-${String(++movSeq).padStart(5, '0')}`
    };

    try { globals.DEFAULT_ACCOUNTS = extractConst('DEFAULT_ACCOUNTS'); } catch (e) { globals.DEFAULT_ACCOUNTS = []; }

    // ⚠️ تُجمَّع المساعدات في نطاق واحد — بعضها يستدعي بعضاً.
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

/**
 * يُشغّل دالة قديمة (أو أكثر) داخل عالم الإشعارات.
 * @param {string|string[]} fnNames الدالة المطلوبة — أو قائمة تُحمَّل معاً حين تستدعي بعضها
 * @param {string} entry اسم الدالة التي تُستدعى فعلياً
 */
export async function captureNotes(fnNames, entry, args, state = {}, ui = { prefix: 'cn' }) {
    const { globals, captured, window: win } = buildNotesWorld(state, ui);
    const names = Array.isArray(fnNames) ? fnNames : [fnNames];
    const bodies = names.map(n => extractFunction(n));
    const keys = Object.keys(globals);
    // eslint-disable-next-line no-new-func
    const scope = new Function(...keys, `${bodies.join('\n')}\nreturn { ${names.join(', ')} };`)(...keys.map(k => globals[k]));

    let result = null, error = null;
    try { result = await scope[entry](...args); }
    catch (e) { error = { message: e.message, name: e.name }; }

    const journal = captured.journals.length ? captured.journals[0].data : null;
    return {
        result, error, captured, window: win, scope,
        note: captured.notes.length ? captured.notes[0].data : null,
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
    ['date', 'type', 'itemId', 'projectId', 'reason', 'description', 'sourceType', 'sourceKey', 'createdBy']
        .forEach(k => { if (k in m) out[k] = m[k]; });
    ['qty', 'unitPrice'].forEach(k => { if (k in m) out[k] = Math.round((Number(m[k]) || 0) * 1e6) / 1e6; });
    out.hasWarehouseId = 'warehouseId' in m;
    out.hasSalePrice = 'salePrice' in m;
    return out;
}

/** تمثيل معياري لناتج cnCompute/dnCompute. */
export function canonicalCompute(c) {
    if (!c) return null;
    const r = n => Math.round((Number(n) || 0) * 1e6) / 1e6;
    return {
        subTotal: r(c.subTotal), discount: r(c.discount), netBeforeTax: r(c.netBeforeTax),
        vatTotal: r(c.vatTotal), grandTotal: r(c.grandTotal),
        lines: (c.lines || []).map(l => ({ itemId: l.itemId || null, qty: r(l.qty), total: r(l.total), description: l.description || '' }))
    };
}
