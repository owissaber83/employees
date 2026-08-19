# خدمة الترحيل — `postPurchaseInvoice` (Phase 6)

> **الحالة:** شفرة جديدة **بجانب** القديم، غير موصولة بواجهة الإنتاج (§15).
> `postPInv`/`createJournalForPInv` في `accounting.js` تبقيان كما هما، تعملان
> كالمعتاد. هذا مستند تصميم لطبقة موازية مُختبَرة، لا تبديلاً لشيء قائم.

## لماذا فاتورة المشتريات فقط في هذه الجولة

الأصل خطّط لسبعة مسارات (`posting/postInvoice.js` + إخوتها لكل مستند). بعد
القراءة الفعلية لسبعة الدوال في `accounting.js`، اتّضح أن:

- فاتورة المشتريات (`createJournalForPInv`) **لا تستدعي `ensureStdAccount`**
  (خلافاً لفاتورة المبيعات) — تفشل بوضوح إن غاب الحساب بدل الإنشاء التلقائي.
  هذا يجعلها المسار **الأنظف** لإثبات النمط المعماري بمعزل عن BUG-006.
- الفواتير هي المسار الذي غطّته Golden Master (Phase 4/5) بأعمق تفصيل —
  فالمقارنة السلوكية (§11) لها مرجع جاهز ومُختبَر.

**القرار:** بناء النمط الكامل (Domain → Idempotency → Atomicity → Repository)
لمسار واحد بعمق كامل ودقّة مُثبَتة، بدل سبعة مسارات سطحية غير مُختبَرة بنفس
الصرامة. فاتورة المبيعات وسندات القبض/الصرف وإشعارات الدائن/المدين وPMC
**تتبع نفس البنية حرفياً** — الفارق الوحيد بينها وبين المشتريات هو دالة بناء
القيد النقيّة (`buildXJournal`) وربما تعامل مع `ensureStdAccount` (البند
المؤجَّل، §22). راجع «التوصية لـPhase 7» في نهاية هذا الملف.

## البنية

```
Legacy UI (postPInv في accounting.js)     ← لم يُلمَس، يبقى المسار الحيّ
                                             │
                                             │  [Phase 6: غير موصول بعد]
                                             ▼
createPostPurchaseInvoiceService(deps)    src/services/accounting/posting/postPurchaseInvoice.js
        │
        ├─ 1. تحميل الفاتورة (deps.getInvoice)
        ├─ 2. حلّ الحسابات (deps.chartOfAccountsRepo — Phase 3، بلا تعديل)
        ├─ 3. معاينة القيد برقم مؤقّت (Domain، §11 — يكشف الأعطال قبل حجز رقم حقيقي)
        ├─ 4. validateJournal + assertBalanced (Domain)
        └─ 5. journalPostingRepo.postPurchaseInvoiceAtomic({ invoiceKey, buildJournal })
                    │
                    ▼
        FirebaseJournalPostingRepository        src/repositories/firebase/FirebaseJournalPostingRepository.js
        (المستودع الوحيد الذي يعرف RTDB)
                    │
                    ▼
              Firebase RTDB (نفس المسارات القائمة تماماً — §16)
```

**محايدة التخزين مُثبَتة لا مفترَضة:** `InMemoryJournalPostingRepository`
(`src/repositories/memory/`) ينفّذ نفس العقد بلا Firebase إطلاقاً، وتمرّ عليه
نفس منطق الخدمة. هذا هو الشرط العملي لاستبدال RTDB بـPostgreSQL لاحقاً (§21)
دون تغيير خدمة التطبيق سطراً واحداً.

## العقد

```js
const service = createPostPurchaseInvoiceService({
  chartOfAccountsRepo,   // من Phase 3 — بلا تعديل
  journalPostingRepo,    // جديد Phase 6 — Firebase أو InMemory
  getInvoice,             // (key) => Promise<invoice|null>
  getVendor,              // (id)  => Promise<vendor|null>
  cfg,                    // { baseCurrencyCode, arApMode }
  currentUser              // { uid }
});

const result = await service({ invoiceKey: 'PINV-123' });
// { success:true, journalId, journalNumber, sourceId, idempotencyKey, alreadyPosted }
```

لا `toast`/`alert`/`window.*`/DOM في أي مكان في هذه السلسلة (§19). الأخطاء
مُصنَّفة (`ValidationError`، `MissingAccountError`، `UnbalancedJournalError`،
`DuplicatePostingError`، `AtomicityError`) — المهايئ (Legacy الحالي عبر جسر
مستقبلي، أو React لاحقاً) هو من يترجمها لرسالة مستخدم.

## حدود موثَّقة (لا يُخفى شيء — §29 «Final Instruction»)

| الحدّ | التفصيل |
|---|---|
| لا `fallback` لـ`getExpenseAccountForType` | الفاتورة يجب أن تحمل `debitAccountCode` صراحةً — وإلا `ValidationError`. الأثر عملياً محدود: فحص فعلي على `tests/fixtures/accounting/world.mjs` وبيانات Golden Master يُظهر أن هذا الحقل مُعبَّأ دائماً في المسارات المُختبَرة |
| `ensureStdAccount` غير مُستدعاة | مطابق لسلوك `createJournalForPInv` الفعلي (لا تستدعيها أصلاً) — BUG-006 لا يمسّ هذا المسار بحكم عدم الاستخدام، لا بحكم إصلاح |
| حركات المخزون (`createInventoryMovementsForPInv`) | **غير مُضمَّنة في الكتابة الذرّية** في هذا الإصدار. الفواتير في نطاق الاختبار الحالي بلا `lines`/`itemId` (Golden Master لا يمرّ بهذا المسار). موصى به لـPhase 7 |
| مورد بلا `groupAccount` صالح | `resolveVendorPayableAccountCode` تُرجع `'2110'` — مطابقة مُثبَتة لـ`vendPayableAccount` (`tests/characterization/resolveVendorPayableAccount.test.mjs`) |

## التوصية لـPhase 7 (لا تُنفَّذ الآن)

1. `buildSalesInvoiceJournal` — نفس نمط `buildPurchaseInvoiceJournal`، لكنها
   **تتقاطع مع BUG-006** (تستدعي `ensureStdAccount` في الأصل). يحتاج قراراً
   صريحاً: تعطيل الإنشاء التلقائي في المسار الجديد (سلوك مختلف عن القديم،
   يتطلّب موافقة) أم نقل `ensureStdAccount` نفسها إلى معاملة آمنة من التزامن
   أولاً (يُغلق BUG-006 من جذره).
2. `buildVoucherJournal` (سند قبض/صرف) — تعقيد إضافي: تخصيص الدفعة على عدّة
   فواتير (`ACCOUNTING_INTEGRITY_FIX_PLAN.md §4`، سيناريو n+2 كتابة).
3. حركات المخزون — تحتاج حجز رقم حركة ذرّي **لكل صنف** قبل الكتابة الذرّية
   النهائية (نفس نمط حجز رقم القيد، مُطبَّق تكرارياً).
4. إشعار الدائن/المدين وشهادة المقاول — لم تُقرأ دوالها الفعلية في هذه
   الجولة؛ يلزم نفس منهجية §11 (قراءة → توصيف → مقارنة) قبل أي بناء.
