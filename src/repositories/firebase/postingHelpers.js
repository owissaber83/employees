// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  أدوات مشتركة بين مستودعات الترحيل الذرّي على RTDB                    [Phase 7] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  استُخرجت من FirebaseJournalPostingRepository (Phase 6) بلا تغيير سلوك — نفس    ║
// ║  الرسائل، نفس الحدود الموثَّقة (best-effort poll/rollback) — لإعادة الاستخدام في   ║
// ║  FirebaseVoucherPostingRepository بدل تكرار نفس المنطق (طُلب صراحةً في تعليمات   ║
// ║  Phase 7 Step B: «reuse existing abstractions... rather than duplicating them»). ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { translateRtdbError } from '../contracts/errors.js';

const counterPath = (prefix, year) => `ledger/counters/jrn/${prefix}/${year}`;

/** نفس آلية generateJrnNumberAtomic (accounting.js:3364) — عدّاد مشترك بين كل أنواع القيود. */
export async function reserveJournalNumber(port, prefix) {
    const year = new Date().getFullYear();
    let result;
    try {
        result = await port.runTransaction(port.ref(port.db, counterPath(prefix, year)),
            current => (typeof current === 'number' ? current : 0) + 1);
    } catch (e) { throw translateRtdbError(e); }
    return `${prefix}-${year}-${String(result.snapshot.val()).padStart(5, '0')}`;
}

/** بوّابة Idempotency الآمنة من التزامن — تحاول قلب status من 'draft' إلى 'posted'. */
export async function claimDraftToPosted(port, statusRefPath) {
    try {
        return await port.runTransaction(port.ref(port.db, statusRefPath),
            current => (current === 'draft' ? 'posted' : undefined));
    } catch (e) { throw translateRtdbError(e); }
}

/**
 * بعد فشل مطالبة الحالة — يقرأ السجل، وإن كان `posted` بلا حقل الربط بعد (نافذة سباق
 * حقيقية: طرف آخر ما زال ينهي كتابته الذرّية) يعيد المحاولة عدداً محدوداً بتأخير قصير.
 * لا ضمان مطلق — أفضل جهد موثَّق (docs/services/idempotency.md «حدود معروفة»).
 */
export async function pollForPostedLink(port, recordPath, linkField = 'journalEntryKey', attempts = 5, delayMs = 15) {
    for (let i = 0; i < attempts; i++) {
        let snap;
        try { snap = await port.get(port.ref(port.db, recordPath)); }
        catch (e) { return null; }
        const v = snap && snap.exists() ? snap.val() : null;
        if (!v) return null;
        if (v.status !== 'posted') return v;
        if (v[linkField]) return v;
        if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
    return null;
}

/** أفضل جهد — لا نرمي إن فشل الاسترجاع نفسه؛ الخطأ الأصلي هو ما يُبلَّغ. */
export async function safeRollbackStatus(port, recordPath, status = 'draft') {
    try { await port.update(port.ref(port.db, recordPath), { status }); }
    catch (e) { /* أفضل جهد فقط — يُوثَّق كحدّ معروف، لا يُخفي الخطأ الأصلي */ }
}

/**
 * [Phase 7-C] حجز رقم حركة مخزون — نفس آلية generateInvMovNumberAtomic
 * (accounting.js:20342) ومسار العدّاد نفسه `ledger/counters/invmov/{type}/{year}`.
 * ⚠️ لا بذرة (`seed`) من الذاكرة هنا: القديم يبذر العدّاد من `window.inventoryMovements`
 * عند أول استخدام، وهي لقطة متصفّح لا تملكها طبقة المستودع. الأثر الوحيد أن العدّاد
 * يبدأ من 1 على قاعدة بلا عدّاد سابق — فرق مُصنَّف B (ترقيم لا مال)، موثَّق في
 * docs/services/sales-invoice-inventory.md. نفس ما فعله reserveJournalNumber في Phase 6.
 */
export async function reserveInventoryMovementNumber(port, type = 'out') {
    const year = new Date().getFullYear();
    const prefix = type === 'in' ? 'IN-' : 'OUT-';
    let result;
    try {
        result = await port.runTransaction(port.ref(port.db, `ledger/counters/invmov/${type}/${year}`),
            current => (typeof current === 'number' ? current : 0) + 1);
    } catch (e) { throw translateRtdbError(e); }
    return `${prefix}${year}-${String(result.snapshot.val()).padStart(5, '0')}`;
}
