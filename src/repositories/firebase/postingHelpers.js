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

// ═══════════════════════════════════════════════════════════════════════════════
// [Phase 7-D] إشعارات الإرجاع (دائن/مدين)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * حجز رقم إشعار بمعاملة خادمية — **قرار المالك رقم 2 (مُوافَق عليه)**.
 * يستبدل `max(cache)+1` غير الآمن في `generateCNNumber`/`generateDNNumber` (BUG-011).
 * المسار داخل مجموعة `counters` القائمة: `ledger/counters/{cn|dn}/{year}` —
 * لا مجموعة جديدة ولا تغيير مخطّط. فجوات الترقيم مقبولة صراحةً؛ التكرار ليس كذلك.
 * @param {'cn'|'dn'} kind
 */
export async function reserveNoteNumber(port, kind) {
    const year = new Date().getFullYear();
    const prefix = kind === 'cn' ? 'CN-' : 'DN-';
    let result;
    try {
        result = await port.runTransaction(port.ref(port.db, `ledger/counters/${kind}/${year}`),
            current => (typeof current === 'number' ? current : 0) + 1);
    } catch (e) { throw translateRtdbError(e); }
    return `${prefix}${year}-${String(result.snapshot.val()).padStart(5, '0')}`;
}

/**
 * بوّابة Idempotency للإشعارات — **قرار المالك رقم 1 (مُوافَق عليه)**.
 * الإشعار لا يملك حالة `draft` سابقة (القديم يُنشئه بـ`push` مباشرةً بحالة `posted`)،
 * فالمطالبة هنا **بالإنشاء** لا بالانتقال: معاملة خادمية على حقل `status` الموجود.
 *
 *   غائب   → 'draft'   (نملك المطالبة؛ الكتابة الذرّية النهائية تُحوّلها إلى 'posted')
 *   'draft'  → إجهاض    (طرف آخر يعمل الآن، أو محاولة سابقة فشلت ولم يُحرَّر قيدها)
 *   'posted' → إجهاض    (مُرحَّل بالفعل)
 *
 * ⚠️ ليست `read → if not posted → write` — الإجهاض يقع داخل المعاملة الخادمية نفسها.
 */
export async function claimNoteCreation(port, statusRefPath) {
    try {
        return await port.runTransaction(port.ref(port.db, statusRefPath),
            current => (current == null ? 'draft' : undefined));
    } catch (e) { throw translateRtdbError(e); }
}

/**
 * تحرير مطالبة لم تكتمل — أفضل جهد. يُزيل عقدة الإشعار كاملةً (لا تحمل وقتها إلا
 * `status: 'draft'`) كي تصلح إعادة المحاولة بنفس `noteKey`.
 * لا نرمي إن فشل التحرير؛ الخطأ الأصلي هو ما يُبلَّغ (نفس سياسة safeRollbackStatus).
 */
export async function releaseNoteClaim(port, noteRefPath) {
    try { await port.remove(port.ref(port.db, noteRefPath)); }
    catch (e) { /* أفضل جهد — يُوثَّق كحدّ معروف */ }
}
