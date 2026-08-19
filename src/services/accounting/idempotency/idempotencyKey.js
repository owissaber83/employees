// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  مفتاح Idempotency الحتمي                                             [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §8: «نفس طلب الترحيل المنطقي يجب أن يُنتج نفس المفتاح دائماً» — لا طابع زمني،   ║
// ║  لا UUID عشوائي. `sourceType:sourceId:operation` — قابل لإعادة الإنتاج تماماً    ║
// ║  ويُقارَن كسلسلة نصّية بسيطة.                                                   ║
// ║                                                                              ║
// ║  ⚠️ هذا المفتاح **وصفي** في هذا الإصدار — الآلية الفعلية التي تمنع الترحيل      ║
// ║  المزدوج هي معاملة الحالة الذرّية في FirebaseJournalPostingRepository (حقل      ║
// ║  status الموجود، لا سجل idempotency جديد). راجع docs/services/idempotency.md    ║
// ║  §«لماذا لا سجل idempotency منفصل» — قرار موثَّق لتفادي تغيير المخطّط (§9).      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/**
 * @param {{sourceType:string, sourceId:string, operation:string}} p
 * @returns {string} مثال: 'purchaseInvoice:INV-12345:POST'
 */
export function buildIdempotencyKey({ sourceType, sourceId, operation }) {
    if (!sourceType || !sourceId || !operation) {
        throw new Error('buildIdempotencyKey: sourceType وsourceId وoperation كلها مطلوبة');
    }
    return `${sourceType}:${sourceId}:${operation}`;
}
