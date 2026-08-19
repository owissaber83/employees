// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تخطيط حركات مخزون فاتورة المبيعات — نقيّة                          [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لـaccounting.js:21670 (`createInventoryMovementsForSInv`) —       ║
// ║  **باستثناء** الكتابة (`push`) وحجز الأرقام (`generateInvMovNumberAtomic`)،     ║
// ║  وهما مسؤولية المستودع. هنا نُنتج «خطّة» الحركات فقط: كائنات جاهزة بلا `number`. ║
// ║                                                                              ║
// ║  🔎 قواعد التخطّي منقولة كما هي (لا تُشدَّد ولا تُرخَّى):                          ║
// ║    • لا `itemId` ⇒ تخطٍّ    • الصنف غير موجود ⇒ تخطٍّ    • `type === 'service'` ⇒ تخطٍّ ║
// ║    • **الكمّية صفر لا تُرفض** — القديم يكتب حركة بكمّية 0 (سلوك محفوظ، صنف A).     ║
// ║    • نقص الرصيد ⇒ **تحذير فقط، لا منع** (`qty > balance + 0.001`).              ║
// ║    • `warehouseId` لا يُكتب إطلاقاً — الحقل غائب في سجل القديم.                  ║
// ║                                                                              ║
// ║  ⚠️ سلسلة تكلفة الخروج (COGS) منقولة بالترتيب نفسه:                            ║
// ║      movingAvg.avgCost > 0  ←  item.costPrice  ←  line.unitPrice  ←  0          ║
// ║                                                                              ║
// ║  🔴 القديم يُحدِّث تكلفة كل سطر من **نفس لقطة الحركات** (لا يضيف حركات هذه         ║
// ║  الفاتورة إلى الحساب أثناء الحلقة، لأن `window.inventoryMovements` لا تتحدّث     ║
// ║  إلا بحدث onValue لاحق). محفوظ حرفياً هنا: اللقطة ثابتة طوال التخطيط.           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { calcItemBalance, calcItemMovingAvg } from './movingAverage.js';

/**
 * @param {object} p
 * @param {string} p.invoiceKey
 * @param {object} p.invoice     يجب أن يحمل `lines` و`date` و`number` و`projectId`
 * @param {object} p.items       لقطة `inventoryItems`
 * @param {object} p.movements   لقطة `inventoryMovements`
 * @param {object} p.warehouses  لقطة `warehouses`
 * @param {string} p.now         ISO
 * @param {string} p.userId
 * @returns {{movements:Array<object>, warnings:string[], skipped:number}}
 */
export function planSalesInvoiceMovements({ invoiceKey, invoice, items, movements, warehouses, now, userId }) {
    const out = [];
    const warnings = [];
    let skipped = 0;

    const lines = (invoice && invoice.lines) || [];
    if (!lines.length) return { movements: out, warnings, skipped };

    for (const line of lines) {
        if (!line || !line.itemId) { skipped++; continue; }
        const item = (items || {})[line.itemId];
        if (!item) { skipped++; continue; }
        if (item.type === 'service') { skipped++; continue; }   // الخدمات لا تُخصم من المخزون

        const bal = calcItemBalance({ itemKey: line.itemId, items, movements, warehouses });
        const qty = parseFloat(line.qty) || 0;
        if (qty > bal.balance + 0.001) {
            // تنبيه فقط — **لا يمنع الترحيل** (سلوك القديم محفوظ حرفياً، صنف A)
            warnings.push(`${item.nameAr}: مطلوب ${qty} والرصيد ${bal.balance}`);
        }

        const movingAvg = calcItemMovingAvg({ itemKey: line.itemId, items, movements, warehouses });
        const cogsPrice = movingAvg.avgCost > 0
            ? movingAvg.avgCost
            : (parseFloat(item.costPrice) || parseFloat(line.unitPrice) || 0);

        out.push({
            date: invoice.date,
            type: 'out',
            itemId: line.itemId,
            qty,
            unitPrice: cogsPrice,                          // تكلفة الخروج
            salePrice: parseFloat(line.unitPrice) || 0,    // سعر البيع للمرجعية
            projectId: invoice.projectId || '',
            reason: 'sale',
            description: `بيع - فاتورة ${invoice.number}${line.description ? ' - ' + line.description : ''}`,
            notes: `مرتبط تلقائياً بفاتورة مبيعات ${invoice.number}`,
            sourceType: 'sales_invoice',
            sourceKey: invoiceKey,
            createdAt: now,
            createdBy: userId
        });
    }

    return { movements: out, warnings, skipped };
}

/**
 * يختم الخطّة بأرقام الحركات المحجوزة (`OUT-{year}-{00001}`) — يفصل الحجز (مستودع)
 * عن البناء (نقيّ). الترتيب مضمون 1:1 مع ترتيب الخطّة.
 * @param {Array<object>} plan
 * @param {string[]} numbers
 */
export function withMovementNumbers(plan, numbers) {
    if (!Array.isArray(numbers) || numbers.length !== plan.length) {
        throw new Error(`عدد أرقام الحركات (${(numbers || []).length}) لا يطابق عدد الحركات المخطّطة (${plan.length})`);
    }
    return plan.map((m, i) => ({ number: numbers[i], ...m }));
}
