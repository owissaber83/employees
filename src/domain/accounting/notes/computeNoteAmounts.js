// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  حساب مبالغ إشعار الإرجاع — نقيّة، منقولة من cnCompute/dnCompute    [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية للمنطق في accounting.js:16074 (`cnCompute`) و:16211 (`dnCompute`). ║
// ║                                                                              ║
// ║  🔴 **الفرق البنيوي الوحيد (مُصنَّف B):** القديم يقرأ كميات الإرجاع من DOM        ║
// ║  (`getElementById('cnQty'+i).value`) — منطق مالي حقيقي مدفون في طبقة العرض.     ║
// ║  هنا تُمرَّر `returnQuantities` **صراحةً كوسيط**. لا `document`، لا `window`.     ║
// ║  التطابق مع القديم مُثبَت بتشغيل الدالة الحقيقية بحقن DOM وهمي —                 ║
// ║  tests/golden-master/credit-note.test.mjs · debit-note.test.mjs.               ║
// ║                                                                              ║
// ║  ⚠️ **الدالتان القديمتان متطابقتان رياضياً حرفاً بحرف** — أُثبت ذلك بالمقارنة     ║
// ║  التشغيلية لا بالافتراض (§8 من تعليمات Step D: «لا تفترض التماثل»). لذلك         ║
// ║  نواة واحدة مشتركة بدل نسختين تتباعدان، وكل مسار يُختبَر على حدة.                ║
// ║                                                                              ║
// ║  🔎 تفاصيل تكسر التطابق لو أُهملت:                                             ║
// ║   • `subTotal` يُراكم أسطراً **مقرَّبة** لكنه هو نفسه **لا يُقرَّب**.               ║
// ║   • الضريبة تُحسب على `lineNet × (1 − نسبة الخصم الرأسي)` قبل التقريب النهائي.    ║
// ║   • السطر يدخل القائمة فقط إن `retQty > 0` — لكنه يُحتسب في المبالغ دائماً.      ║
// ║   • كمّية غير مذكورة (`undefined`) ⇒ رجوع إلى الكمّية الأصلية (مسار `rq ? … : `). ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2 } from '../../../../public/calc.js';

/**
 * @param {object} p
 * @param {object} p.invoice  الفاتورة المصدر — يجب أن تحمل `lines` و`discount`
 * @param {Array<number>|null|undefined} p.returnQuantities
 *        كمّية الإرجاع لكل سطر بالترتيب. عنصر `undefined` أو مصفوفة غائبة ⇒ الكمّية
 *        الأصلية لذلك السطر (مطابقة لمسار `rq ? … : origQty` في القديم).
 * @returns {{subTotal:number, discount:number, netBeforeTax:number, vatTotal:number, grandTotal:number, lines:Array}}
 */
export function computeNoteAmounts({ invoice, returnQuantities }) {
    const invLines = (invoice && invoice.lines) || [];
    const subTotalInv = invLines.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);
    const hdrRatio = subTotalInv > 0 ? ((parseFloat(invoice.discount) || 0) / subTotalInv) : 0;

    let subTotal = 0, vatTotal = 0;
    const lines = [];

    invLines.forEach((l, i) => {
        const origQty = parseFloat(l.qty) || 0;
        // مطابقة `const rq = document.getElementById(...); rq ? clamp(rq.value) : origQty`
        const raw = returnQuantities ? returnQuantities[i] : undefined;
        const retQty = raw === undefined || raw === null
            ? origQty
            : Math.min(origQty, Math.max(0, parseFloat(raw) || 0));

        const ratio = origQty > 0 ? retQty / origQty : 0;
        const lineNet = round2((parseFloat(l.total) || 0) * ratio);
        subTotal += lineNet;                                             // ⚠️ بلا تقريب تراكمي
        vatTotal += lineNet * (1 - hdrRatio) * ((parseFloat(l.vatRate) || 0) / 100);
        if (retQty > 0) lines.push({ ...l, qty: retQty, total: lineNet });
    });

    const discount = round2(subTotal * hdrRatio);
    const netBeforeTax = round2(subTotal - discount);
    vatTotal = round2(vatTotal);
    const grandTotal = round2(netBeforeTax + vatTotal);

    return { subTotal, discount, netBeforeTax, vatTotal, grandTotal, lines };
}
