// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  اختبار توصيفي — تقييم المخزون: الجديد مقابل القديم الحيّ           [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يقارن src/domain/inventory/movingAverage.js بـ`calcInvItemMovingAvg` و         ║
// ║  `calcInvItemBalance` المُحمَّلتين من public/accounting.js نفسه. أي انحراف — في    ║
// ║  الجديد أو في القديم — يكسر هذا الاختبار فوراً.                                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { loadLegacyFunction, extractFunction } from './legacy-loader.mjs';
import { calcItemMovingAvg, calcItemBalance, mainWarehouseId, whIdOfMovement } from '../../src/domain/inventory/movingAverage.js';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const near = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 1e-9;

/** يبني نسخة القديم بنفس الحالة المحقونة. */
function legacyPair(state) {
    const win = {
        inventoryItems: state.items || {},
        inventoryMovements: state.movements || {},
        warehouses: state.warehouses || {}
    };
    const globals = { window: win, WAREHOUSE_MAIN_FALLBACK: 'main' };
    const names = ['mainWarehouseId', 'whIdOfMovement', 'invMovDate', 'calcInvItemBalance', 'calcInvItemMovingAvg'];
    const bodies = names.map(n => extractFunction(n));
    const keys = Object.keys(globals);
    // eslint-disable-next-line no-new-func
    return new Function(...keys, `${bodies.join('\n')}\nreturn { ${names.join(', ')} };`)(...keys.map(k => globals[k]));
}

const WORLDS = [
    {
        name: 'رصيد افتتاحي + إدخال واحد',
        items: { A: { nameAr: 'أ', type: 'material', openingQty: 10, costPrice: 80 } },
        movements: { m1: { itemId: 'A', type: 'in', qty: 20, unitPrice: 90, date: '2026-01-05' } },
        warehouses: {}, probe: 'A'
    },
    {
        name: 'إدخالان بسعرين ثم إخراج',
        items: { A: { nameAr: 'أ', type: 'material', openingQty: 0, costPrice: 0 } },
        movements: {
            m1: { itemId: 'A', type: 'in', qty: 10, unitPrice: 100, date: '2026-01-01' },
            m2: { itemId: 'A', type: 'in', qty: 10, unitPrice: 200, date: '2026-01-02' },
            m3: { itemId: 'A', type: 'out', qty: 5, unitPrice: 150, date: '2026-01-03' }
        },
        warehouses: {}, probe: 'A'
    },
    {
        name: 'دورة رصيد صفري ثم شراء بسعر مختلف (فارق المتوسط التراكمي)',
        items: { A: { nameAr: 'أ', type: 'material', openingQty: 0, costPrice: 0 } },
        movements: {
            m1: { itemId: 'A', type: 'in', qty: 10, unitPrice: 100, date: '2026-01-01' },
            m2: { itemId: 'A', type: 'out', qty: 10, unitPrice: 100, date: '2026-01-02' },
            m3: { itemId: 'A', type: 'in', qty: 10, unitPrice: 500, date: '2026-01-03' }
        },
        warehouses: {}, probe: 'A'
    },
    {
        name: 'إخراج يتجاوز الرصيد (سالب يُقصّ إلى صفر)',
        items: { A: { nameAr: 'أ', type: 'material', openingQty: 5, costPrice: 50 } },
        movements: { m1: { itemId: 'A', type: 'out', qty: 50, unitPrice: 50, date: '2026-01-02' } },
        warehouses: {}, probe: 'A'
    },
    {
        name: 'صنف خدمي — لا مخزون',
        items: { S: { nameAr: 'خدمة', type: 'service' } },
        movements: {}, warehouses: {}, probe: 'S'
    },
    {
        name: 'صنف غير موجود',
        items: {}, movements: {}, warehouses: {}, probe: 'GHOST'
    },
    {
        name: 'مخازن متعدّدة — المخزن الرئيسي يحمل الافتتاحي',
        items: { A: { nameAr: 'أ', type: 'material', openingQty: 7, costPrice: 30 } },
        movements: {
            m1: { itemId: 'A', type: 'in', qty: 4, unitPrice: 40, date: '2026-01-01', warehouseId: 'W2' },
            m2: { itemId: 'A', type: 'in', qty: 6, unitPrice: 60, date: '2026-01-02' }
        },
        warehouses: { W1: { type: 'main' }, W2: { type: 'branch' } }, probe: 'A'
    },
    {
        name: 'ترتيب زمني مقلوب في المفاتيح — الفرز بالتاريخ هو الحاكم',
        items: { A: { nameAr: 'أ', type: 'material', openingQty: 0, costPrice: 0 } },
        movements: {
            z: { itemId: 'A', type: 'in', qty: 10, unitPrice: 300, date: '2026-05-01' },
            a: { itemId: 'A', type: 'in', qty: 10, unitPrice: 100, date: '2026-01-01' }
        },
        warehouses: {}, probe: 'A'
    },
    {
        name: 'حركة بلا تاريخ — تُشتقّ من createdAt',
        items: { A: { nameAr: 'أ', type: 'material', openingQty: 0, costPrice: 0 } },
        movements: {
            m1: { itemId: 'A', type: 'in', qty: 10, unitPrice: 100, createdAt: '2026-02-01T00:00:00.000Z' },
            m2: { itemId: 'A', type: 'in', qty: 10, unitPrice: 300, date: '2026-03-01' }
        },
        warehouses: {}, probe: 'A'
    }
];

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  اختبار توصيفي — تقييم المخزون · Phase 7 Step C           ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

for (const w of WORLDS) {
    const L = legacyPair(w);
    const args = { itemKey: w.probe, items: w.items, movements: w.movements, warehouses: w.warehouses };

    const legacyMA = L.calcInvItemMovingAvg(w.probe);
    const nextMA = calcItemMovingAvg(args);
    ok(`${w.name} — المتوسط المتحرّك: avgCost`, near(legacyMA.avgCost, nextMA.avgCost), `قديم=${legacyMA.avgCost} جديد=${nextMA.avgCost}`);
    ok(`${w.name} — المتوسط المتحرّك: balance/value`, near(legacyMA.balance, nextMA.balance) && near(legacyMA.value, nextMA.value),
        `قديم=${legacyMA.balance}/${legacyMA.value} جديد=${nextMA.balance}/${nextMA.value}`);
    ok(`${w.name} — طول سجل الحركة`, legacyMA.history.length === nextMA.history.length);

    const legacyBal = L.calcInvItemBalance(w.probe);
    const nextBal = calcItemBalance(args);
    ok(`${w.name} — الرصيد الكمّي`, near(legacyBal.balance, nextBal.balance), `قديم=${legacyBal.balance} جديد=${nextBal.balance}`);
    ok(`${w.name} — متوسط التكلفة التراكمي`, near(legacyBal.avgCost, nextBal.avgCost), `قديم=${legacyBal.avgCost} جديد=${nextBal.avgCost}`);

    // نفس الاستعلام لكن بمخزن محدّد — يمسّ مسار whIdOfMovement/mainWarehouseId
    const wh = Object.keys(w.warehouses)[0];
    if (wh) {
        const lb = L.calcInvItemBalance(w.probe, wh);
        const nb = calcItemBalance({ ...args, warehouseId: wh });
        ok(`${w.name} — الرصيد داخل مخزن محدّد (${wh})`, near(lb.balance, nb.balance), `قديم=${lb.balance} جديد=${nb.balance}`);
    }
}

{
    const L = legacyPair({ items: {}, movements: {}, warehouses: { W1: { type: 'branch' }, W2: { type: 'main' } } });
    ok('mainWarehouseId يطابق القديم', L.mainWarehouseId() === mainWarehouseId({ W1: { type: 'branch' }, W2: { type: 'main' } }));
    const whs = { W1: { type: 'branch' }, W2: { type: 'main' } };
    const L2 = legacyPair({ items: {}, movements: {}, warehouses: whs });
    ok('whIdOfMovement — بلا warehouseId يرجع للرئيسي', L2.whIdOfMovement({}) === whIdOfMovement({}, whs));
    const L3 = legacyPair({ items: {}, movements: {}, warehouses: {} });
    ok('whIdOfMovement — بلا مخازن إطلاقاً يرجع لـmain', L3.whIdOfMovement({}) === whIdOfMovement({}, {}));
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
