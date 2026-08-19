// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تقييم المخزون — نقيّة، منقولة من calcInvItemMovingAvg/Balance      [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لـaccounting.js:20367 (`calcInvItemBalance`) و:20394             ║
// ║  (`calcInvItemMovingAvg`) و:20354–20363 (`whIdOfMovement`/`mainWarehouseId`)   ║
// ║  و:20392 (`invMovDate`) — بلا `window`: الحالة تُحقن كوسائط.                    ║
// ║                                                                              ║
// ║  لماذا تُنقل أصلاً: تكلفة سطر حركة الخروج في ترحيل فاتورة المبيعات تُحسب من       ║
// ║  `calcInvItemMovingAvg(...).avgCost` — فبدونها لا يمكن بناء حركة المخزون بنفس    ║
// ║  القيمة، ولا إثبات التطابق مع القديم.                                          ║
// ║                                                                              ║
// ║  ⚠️ مُثبتة بالمقارنة الفعلية: tests/characterization/inventoryValuation.test.mjs ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/** معرّف افتراضي يُستخدم قبل إنشاء أي مخزن — منقول حرفياً (accounting.js:20353). */
export const WAREHOUSE_MAIN_FALLBACK = 'main';

export function mainWarehouseId(warehouses) {
    const entry = Object.entries(warehouses || {}).find(([, w]) => w && w.type === 'main');
    return entry ? entry[0] : null;
}

export function whIdOfMovement(m, warehouses) {
    return (m && m.warehouseId) || mainWarehouseId(warehouses) || WAREHOUSE_MAIN_FALLBACK;
}

export function invMovDate(m) {
    return (m && m.date) || ((m && m.createdAt) || '').slice(0, 10) || '1900-01-01';
}

const EMPTY_BALANCE = { opening: 0, totalIn: 0, totalOut: 0, balance: 0, totalInValue: 0, totalOutValue: 0, avgCost: 0 };

/**
 * رصيد الصنف — منقولة حرفياً من `calcInvItemBalance`.
 * @param {{itemKey:string, warehouseId?:string, items:object, movements:object, warehouses:object}} p
 */
export function calcItemBalance({ itemKey, warehouseId, items, movements, warehouses }) {
    const item = (items || {})[itemKey];
    if (!item) return { ...EMPTY_BALANCE };
    if (item.type === 'service') return { ...EMPTY_BALANCE };

    const main = mainWarehouseId(warehouses);
    const opening = (!warehouseId || warehouseId === main || (!main && warehouseId === WAREHOUSE_MAIN_FALLBACK))
        ? (parseFloat(item.openingQty) || 0) : 0;
    let totalIn = 0, totalOut = 0, totalInValue = 0, totalOutValue = 0;

    Object.values(movements || {}).forEach(m => {
        if (!m || m.itemId !== itemKey) return;
        if (warehouseId && whIdOfMovement(m, warehouses) !== warehouseId) return;
        const qty = parseFloat(m.qty) || 0;
        const val = qty * (parseFloat(m.unitPrice) || 0);
        if (m.type === 'in') { totalIn += qty; totalInValue += val; }
        else { totalOut += qty; totalOutValue += val; }
    });

    const balance = opening + totalIn - totalOut;
    const avgCost = totalIn > 0 ? (totalInValue / totalIn) : (parseFloat(item.costPrice) || 0);
    return { opening, totalIn, totalOut, balance, totalInValue, totalOutValue, avgCost };
}

/**
 * المتوسط المرجّح المتحرّك — منقولة حرفياً من `calcInvItemMovingAvg`.
 * @param {{itemKey:string, warehouseId?:string, items:object, movements:object, warehouses:object}} p
 * @returns {{balance:number, avgCost:number, value:number, history:Array}}
 */
export function calcItemMovingAvg({ itemKey, warehouseId, items, movements, warehouses }) {
    const item = (items || {})[itemKey];
    if (!item || item.type === 'service') return { balance: 0, avgCost: 0, value: 0, history: [] };

    const main = mainWarehouseId(warehouses);
    const openingQty = (!warehouseId || warehouseId === main || (!main && warehouseId === WAREHOUSE_MAIN_FALLBACK))
        ? (parseFloat(item.openingQty) || 0) : 0;
    const openingCost = parseFloat(item.costPrice) || 0;
    let qty = openingQty;
    let value = openingQty * openingCost;
    let avg = openingCost;
    const history = [];
    if (openingQty > 0) history.push({ date: 'افتتاحي', type: 'open', qty: openingQty, price: openingCost, runQty: qty, runAvg: avg, runValue: value });

    const moves = Object.values(movements || {})
        .filter(m => m && m.itemId === itemKey && (!warehouseId || whIdOfMovement(m, warehouses) === warehouseId))
        .sort((a, b) => invMovDate(a).localeCompare(invMovDate(b)) || ((a.createdAt || '').localeCompare(b.createdAt || '')));

    moves.forEach(m => {
        const q = parseFloat(m.qty) || 0;
        if (m.type === 'in') {
            const p = parseFloat(m.unitPrice) || 0;
            value += q * p; qty += q; avg = qty > 0 ? value / qty : p;
            history.push({ date: invMovDate(m), type: 'in', qty: q, price: p, runQty: qty, runAvg: avg, runValue: value, ref: m.refNo || m.reference || '' });
        } else {
            const outCost = avg;
            value -= q * outCost; qty -= q;
            if (qty < 0) qty = 0;
            if (qty === 0) value = 0;
            history.push({ date: invMovDate(m), type: 'out', qty: q, price: outCost, runQty: qty, runAvg: avg, runValue: value, ref: m.refNo || m.reference || '' });
        }
    });

    return { balance: qty, avgCost: avg, value, history };
}
