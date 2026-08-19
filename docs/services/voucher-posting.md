# خدمة الترحيل — `postVoucher` (Phase 7 Step B)

> **الحالة:** شفرة جديدة **بجانب** القديم، غير موصولة بواجهة الإنتاج (§15 من
> تعليمات Phase 7 Step B). `postVoucher`/`createJournalForVoucher`/
> `allocateToInvoices` في `accounting.js` تبقى كما هي، تعمل كالمعتاد. هذا
> مستند تصميم لطبقة موازية مُختبَرة، لا تبديلاً لشيء قائم.

## لماذا السند بعد فاتورة المشتريات

Phase 7 Step A (اكتشاف بحت، بلا كتابة كود) رتّب المسارات المتبقية وخلص إلى
أن سند القبض/الصرف هو الخطوة المنطقية التالية بعد Phase 6: يعيد استخدام كل
أدوات Phase 6 (`assertBalanced`، `validateJournal`، idempotency عبر
`status`) **ويضيف** مشكلة واحدة جديدة لم تظهر في فاتورة واحدة: تخصيص مبلغ
السند على **N فاتورة متغيّرة العدد**، بلا سقف في القديم (§الاكتشاف الحرج
أدناه) — راجع `docs/services/voucher-allocation.md` للتفصيل الكامل.

## البنية

```
Legacy UI (postVoucher في accounting.js)     ← لم يُلمَس، يبقى المسار الحيّ
                                                │
                                                │  [Phase 7: غير موصول بعد]
                                                ▼
createPostVoucherService(deps)     src/services/accounting/posting/postVoucher.js
        │
        ├─ 1. تحميل السند (deps.getVoucher)
        ├─ 2. حلّ حساب الصندوق/البنك + حساب الطرف (عميل receipt / مورد payment)
        │      عبر chartOfAccountsRepo (Phase 3) + resolveCustomerReceivableAccountCode
        │      (جديد Phase 7) / resolveVendorPayableAccountCode (Phase 6، معاد استخدامها)
        ├─ 3. معاينة القيد برقم مؤقّت (Domain، نفس نمط §11 من Phase 6)
        ├─ 4. validateJournal + assertBalanced (Domain — من Phase 6 حرفياً، بلا تكرار)
        ├─ 5. validateAllocationSet(voucher.allocations) — فحص بنيوي قبل أي I/O
        └─ 6. voucherPostingRepo.postVoucherAtomic({ voucherKey, voucherType, allocations, buildJournal })
                    │
                    ▼
        FirebaseVoucherPostingRepository   src/repositories/firebase/FirebaseVoucherPostingRepository.js
        (المستودع الوحيد الذي يعرف RTDB لهذا المسار)
                    │
                    ▼
              Firebase RTDB (نفس المسارات القائمة تماماً — راجع الجدول أدناه)
```

**محايدة التخزين مُثبَتة لا مفترَضة:** `InMemoryVoucherPostingRepository`
(`src/repositories/memory/`) ينفّذ نفس العقد بلا Firebase إطلاقاً، وتمرّ عليه
نفس منطق الخدمة (`tests/golden-master/voucher.test.mjs` يستخدمه مباشرةً).

## العقد

```js
const service = createPostVoucherService({
  chartOfAccountsRepo,   // من Phase 3 — بلا تعديل
  voucherPostingRepo,    // جديد Phase 7 — Firebase أو InMemory
  getVoucher,             // (key, type) => Promise<voucher|null>
  getCustomer,            // (id) => Promise<customer|null>  — لسندات receipt
  getVendor,              // (id) => Promise<vendor|null>    — لسندات payment
  cfg,                    // { baseCurrencyCode, arApMode }
  currentUser              // { uid }
});

const result = await service({ voucherKey: 'RV-123', voucherType: 'receipt' });
// { success:true, journalId, journalNumber, sourceId, idempotencyKey, alreadyPosted, allocationResults }
```

لا `toast`/`alert`/`window.*`/DOM في أي مكان في هذه السلسلة. الأخطاء
مُصنَّفة (`ValidationError`، `MissingAccountError`، `UnbalancedJournalError`،
`DuplicatePostingError`، `AllocationConflictError` [جديد]، `AtomicityError`)
— المهايئ (Legacy الحالي عبر جسر مستقبلي، أو React لاحقاً) هو من يترجمها
لرسالة مستخدم.

## المسارات RTDB — كلها موجودة أصلاً، لا حقل جديد

| المسار | الحالة |
|---|---|
| `ledger/receipts/{key}` · `ledger/payments/{key}` | موجودة أصلاً |
| `ledger/receipts/{key}/status` · `.../journalEntryKey` · `.../journalEntryNumber` · `.../postedAt` · `.../postedBy` | موجودة أصلاً (`postVoucher` في accounting.js:20004 تكتبها) |
| `ledger/salesInvoices/{key}/paidAmount` · `ledger/purchaseInvoices/{key}/paidAmount` | موجودة أصلاً (`allocateToInvoices`، accounting.js:19731) |
| `ledger/journalEntries/{key}` · `ledger/counters/jrn/{prefix}/{year}` | موجودة أصلاً |

**لا حقل جديد. لا مجموعة جديدة (لا `postingLocks/`). لا تعديل على
`database.rules.json`.**

## تكامل القيد — معاد استخدام حرفياً من Phase 6

`buildVoucherJournal` (نقيّة) تُبنى ثم تمرّ عبر **نفس** `validateJournal` و
`assertBalanced` من `src/domain/accounting/posting/` — لم يُنسَخ أي منطق
جديد لهذا الفحص. راجع `docs/services/integrity.md` (Phase 6) — لا تغيير هنا.

## عزل المستأجرين — نفس آلية Phase 6 حرفياً

كل مسار يبدأ بـ`ledger/` يمرّ عبر `ref()`/`scopeUpdates()` المحقونتَين (نفس
`rtdbPort.js`) — لا استيراد Firebase مباشر، لا بناء مسار مستأجر يدوي في أي
مكان في هذا المسار. مُثبَت تنفيذياً على متجر RTDB مشترك حقيقي في
`tests/services/postVoucher.multiTenant.test.mjs` (16 تأكيداً)، بما في ذلك
سباق حقيقي (`Promise.all`) بين مستأجرَين مختلفَين على نفس مفتاح الفاتورة —
صفر تفاعل بينهما.

## حدود موثَّقة (لا يُخفى شيء)

| الحدّ | التفصيل |
|---|---|
| `cashAccountCode` مطلوب صراحةً على السند | لا fallback — نفس انضباط `debitAccountCode` في Phase 6 |
| `ensureStdAccount` غير مُستدعاة | مطابق لسلوك `custReceivableAccount`/`vendPayableAccount` الفعلي (لا تستدعيها) |
| رفض تجاوز رصيد الفاتورة | **فرق مقصود عن القديم** — راجع `docs/services/voucher-allocation.md` بالتفصيل الكامل (تصنيف C) |
| فاتورة تخصيص غير موجودة | تُرفَض صراحةً (`ValidationError`) — القديم كان "يتجاوز بصمت" (`console.warn` فقط) — فرق مقصود، نفس منطق تصنيف C |
| الاتساق أثناء التنفيذ (لا بعده) | راجع `docs/services/voucher-atomicity.md` «نموذج الاتساق» — ليست ذرّية N+1 حرفية |

## المرجع التنفيذي

- `src/services/accounting/posting/postVoucher.js` — الخدمة
- `src/repositories/contracts/VoucherPostingRepository.js` — العقد
- `src/repositories/firebase/FirebaseVoucherPostingRepository.js` — التنفيذ الحقيقي
- `src/repositories/memory/InMemoryVoucherPostingRepository.js` — تنفيذ الاختبار
- `src/domain/accounting/posting/buildVoucherJournal.js` — بناء القيد النقيّ
- `src/domain/accounting/posting/resolveCustomerReceivableAccount.js` — حلّ حساب العميل
- `src/domain/accounting/allocation/computeAllocation.js` — منطق التخصيص النقيّ (راجع voucher-allocation.md)

## الاختبارات

```
npm run test:phase7          # كل اختبارات Phase 7 (توصيف + Golden Master + خدمة)
npm run test:char:custaccount    # 6  — توصيف custReceivableAccount
npm run test:char:voucherjournal # 27 — توصيف createJournalForVoucher
npm run test:char:allocation     # 15 — توصيف allocateToInvoices (يُثبت غياب سقف التجاوز)
npm run test:gm:voucher          # 7  — Golden Master: الجديد مقابل القديم
npm run test:svc:voucher:all     # 98 — atomicity + idempotency + allocation + tenant + failure
npm run svc:voucher:perf         # خط أساس أداء — تقرير أرقام
```
