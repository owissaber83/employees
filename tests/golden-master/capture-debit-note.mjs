// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · مِشجب الإشعار المدين                                [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يعيد استخدام بنّاء العالم من `capture-credit-note.mjs` حرفياً — الدوال القديمة  ║
// ║  للإشعارين تعيش في نفس الكتلة وتشترك في نفس المساعدات و`document` الوهمي.       ║
// ║  **لا نسخة موازية من المِشجب** (§6: لا تكرار للبنية التحتية القائمة).            ║
// ║                                                                              ║
// ║  ⚠️ الاشتراك في المِشجب **لا يعني افتراض تماثل السلوك**: كل دالة مدينة تُشغَّل      ║
// ║  وتُقارَن على حدة، والفروق المؤكَّدة (تكلفة المخزون · حساب الضريبة · سطر التقريب) ║
// ║  مُختبَرة صراحةً في tests/golden-master/debit-note.test.mjs.                     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export { buildNotesWorld, captureNotes, canonicalMovement, canonicalCompute } from './capture-credit-note.mjs';

/** يُشغّل دالة إشعار مدين — نفس العقد لكن ببادئة DOM الصحيحة (`dn`). */
export async function captureDebit(fnNames, entry, args, state = {}, ui = {}) {
    const { captureNotes } = await import('./capture-credit-note.mjs');
    return captureNotes(fnNames, entry, args, state, { ...ui, prefix: 'dn' });
}
