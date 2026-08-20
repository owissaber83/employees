// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تخطيط حركات مخزون الإشعار المدين (إخراج) — نقيّة                   [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لـ`createReturnMovementsForDN` (accounting.js:16294).             ║
// ║                                                                              ║
// ║  🔴 **فرق مؤكَّد عن الإشعار الدائن — ليس سهواً ولا يُوحَّد:**                       ║
// ║  التكلفة هنا `parseFloat(line.unitPrice) ‖ 0` **مباشرةً** — بلا متوسط مرجّح       ║
// ║  متحرّك إطلاقاً. `calcInvItemMovingAvg` **لا تُستدعى** في هذا المسار القديم.       ║
// ║  المنطق: سطر فاتورة المشتريات يحمل سعر **الشراء** أصلاً، فالمرتجع للمورد يخرج     ║
// ║  بنفس التكلفة التي دخل بها.                                                    ║
// ║                                                                              ║
// ║  ⚠️ لكن هذا يُحدث انحرافاً في قيمة المخزون متى اختلف سعر السطر عن المتوسط         ║
// ║  الجاري. **سلوك قائم — لا يُغيَّر هنا.** مُسجَّل كقرار محاسبي معلّق **D4**         ║
// ║  (docs/services/debit-note-inventory.md). لا تُوحَّد السياستان بلا قرار مالك.     ║
// ║                                                                              ║
// ║  🔎 محفوظ حرفياً: `warehouseId` لا يُكتب · لا فحص كفاية رصيد (يسمح بالسالب) ·     ║
// ║  الكمّية صفر تُنتج حركة بصفر · نفس قواعد التخطّي.                                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/**
 * @param {object} p
 * @param {string} p.noteKey · @param {object} p.note · @param {object} p.items
 * @param {string} p.now · @param {string} p.userId
 * @returns {{movements:Array<object>, warnings:string[], skipped:number}}
 */
export function planDebitNoteMovements({ noteKey, note, items, now, userId }) {
    const out = [];
    const warnings = [];
    let skipped = 0;

    const lines = (note && note.lines) || [];
    if (!lines.length) return { movements: out, warnings, skipped };

    for (const line of lines) {
        if (!line || !line.itemId) { skipped++; continue; }
        const item = (items || {})[line.itemId];
        if (!item || item.type === 'service') { skipped++; continue; }

        out.push({
            date: note.date,
            type: 'out',
            itemId: line.itemId,
            qty: parseFloat(line.qty) || 0,
            unitPrice: parseFloat(line.unitPrice) || 0,   // ⚠️ سعر السطر — لا متوسط متحرّك (D4)
            projectId: note.projectId || '',
            reason: 'purchase_return',
            description: `مرتجع مشتريات - إشعار مدين ${note.number}${line.description ? ' - ' + line.description : ''}`,
            sourceType: 'debit_note',
            sourceKey: noteKey,
            createdAt: now,
            createdBy: userId
        });
    }
    return { movements: out, warnings, skipped };
}
