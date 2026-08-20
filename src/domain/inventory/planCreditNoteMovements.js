// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تخطيط حركات مخزون الإشعار الدائن (إدخال) — نقيّة                   [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لـ`createReturnMovementsForCN` (accounting.js:16157) —            ║
// ║  **باستثناء** الكتابة وحجز الأرقام (مسؤولية المستودع).                          ║
// ║                                                                              ║
// ║  التقييم: **المتوسط المرجّح المتحرّك** — يُعاد استخدام `movingAverage.js`         ║
// ║  المستخلَصة والمُثبتة في Step C. **لا نسخة موازية من منطق التقييم** (§18).       ║
// ║      movingAvg.avgCost > 0  ←  item.costPrice  ←  line.unitPrice  ←  0          ║
// ║  (سطر فاتورة المبيعات يحمل سعر **البيع**، فلا يصلح كتكلفة — ولهذا المتوسط.)      ║
// ║                                                                              ║
// ║  🔎 محفوظ حرفياً: `warehouseId` لا يُكتب · لا `salePrice` · لا فحص رصيد ·         ║
// ║  الكمّية صفر تُنتج حركة بصفر · التخطّي: `!itemId` ‖ `!item` ‖ `type==='service'`. ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { calcItemMovingAvg } from './movingAverage.js';

/**
 * @param {object} p
 * @param {string} p.noteKey
 * @param {object} p.note   يجب أن يحمل `lines` · `date` · `number` · `projectId`
 * @param {object} p.items · @param {object} p.movements · @param {object} p.warehouses
 * @param {string} p.now · @param {string} p.userId
 * @returns {{movements:Array<object>, warnings:string[], skipped:number}}
 */
export function planCreditNoteMovements({ noteKey, note, items, movements, warehouses, now, userId }) {
    const out = [];
    const warnings = [];
    let skipped = 0;

    const lines = (note && note.lines) || [];
    if (!lines.length) return { movements: out, warnings, skipped };

    for (const line of lines) {
        if (!line || !line.itemId) { skipped++; continue; }
        const item = (items || {})[line.itemId];
        if (!item || item.type === 'service') { skipped++; continue; }

        const movingAvg = calcItemMovingAvg({ itemKey: line.itemId, items, movements, warehouses });
        const cogs = movingAvg.avgCost > 0
            ? movingAvg.avgCost
            : (parseFloat(item.costPrice) || parseFloat(line.unitPrice) || 0);

        out.push({
            date: note.date,
            type: 'in',
            itemId: line.itemId,
            qty: parseFloat(line.qty) || 0,
            unitPrice: cogs,
            projectId: note.projectId || '',
            reason: 'sales_return',
            description: `مرتجع - إشعار دائن ${note.number}${line.description ? ' - ' + line.description : ''}`,
            sourceType: 'credit_note',
            sourceKey: noteKey,
            createdAt: now,
            createdBy: userId
        });
    }
    return { movements: out, warnings, skipped };
}
