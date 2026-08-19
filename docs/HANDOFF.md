# PROJECT HANDOFF

> ⚠️ لا تعتمد على ذاكرة محادثة. هذا الملف + `MIGRATION_CONTEXT.md` +
> `MIGRATION_STATUS.md` + `MIGRATION_PLAN.md` كافية لمتابعة العمل من الصفر.
>
> ⚠️ **ملاحظة تسمية:** يوجد `HANDOFF.md` آخر في جذر المستودع — وهو خاص بمشروع
> **Academy** ولا علاقة له بترحيل ERP. هذا الملف (`docs/HANDOFF.md`) هو المرجع.

## Date
2026-08-19 (Phase 7 Step B — خدمة ترحيل سند القبض/الصرف: تخصيص متعدّد الفواتير + تعويض)

## Current Branch
`feat/ai-invoice-system-v2` — مدفوع ومتزامن مع `origin`.

## Current Commit
هذا الإيداع نفسه — `feat: phase 7 step b voucher posting service`.
شغّل `git log -1 --oneline` للهاش الفعلي (نفس سبب عدم كتابته حرفياً في
المراحل السابقة — الملف جزء من الإيداع الذي يصفه).
**سلف مباشر:** `15f8054` — Phase 6 (خدمات التطبيق: ترحيل فاتورة المشتريات).

## Current Tag
`migration/baseline` — خط الأساس قبل الترحيل (مدفوع). **لم يتغيّر في Phase 6.**

## Project Status
نظام ERP محاسبي عربي (RTL) يعمل في الإنتاج على Firebase Hosting + Realtime
Database، خطة Spark. **يعمل الآن تماماً كما كان قبل بدء الترحيل** — لم تُعدَّل
أي شفرة إنتاج في أي مرحلة.

بُنيت طبقات معمارية **بجانب** النظام القائم لا فوقه: نطاق محاسبي نقيّ، طبقة
مستودعات، وشبكة أمان Golden Master. **لم تُوصَل بالإنتاج بعد** — الوصل يحتاج
خطوة بناء (Phase 6).

## Migration Status

| Phase | الحالة |
|---|---|
| 0 · التدقيق | ✅ مكتملة |
| 1 · السلامة وخط الأساس | ✅ مكتملة |
| 2 · استخلاص النطاق المحاسبي | 🟡 جارية — شجرة الحسابات فقط |
| 3 · طبقة Repository | 🟡 جارية — شجرة الحسابات فقط |
| 4 · Golden Master — بناء القيود وسلامة الترحيل | ✅ مكتملة |
| 5 · Golden Master — دفتر الأستاذ · ميزان المراجعة · أرصدة الأطراف | ✅ مكتملة |
| 6 · خدمات التطبيق — ترحيل ذرّي + Idempotency (فاتورة المشتريات فقط) | ✅ مكتملة — غير موصولة بالإنتاج |
| 7-A · اكتشاف بحت — ترتيب أولويات مسارات الترحيل المتبقّية | ✅ مكتملة — تقرير فقط، بلا كود |
| 7-B · خدمة ترحيل السند — تخصيص متعدّد الفواتير + تعويض (Saga) | ✅ **مكتملة الآن — غير موصولة بالإنتاج** |
| 8 · أساس React | 🔴 لم تبدأ |
| 9+ · ترحيل الوحدات | 🔴 لم تبدأ |

> ⚠️ ترقيم `MIGRATION_PLAN.md` يختلف عن هذا الملف بعد Phase 4 (بدّل "خدمات
> الأعمال" و"Golden Master" مكانيهما بموافقة المالك). لم يُوحَّد عمداً —
> **الأسماء لا الأرقام هي المرجع**. راجع `MIGRATION_STATUS.md` للتفصيل.

## Completed Work

**التدقيق (Phase 0):** قياس فعلي للمشروع — 137,941 سطراً مخدوماً · 9.3 م.ب ·
142 صفحة · 2,522 معالج `onclick` مضمّناً · 975 `innerHTML` · 2,356 متغيّراً
عاماً · 130 مجموعة RTDB · 97 مستمع `onValue`. (`CLAUDE.md` كان يقول 23,000
سطراً و51 صفحة — أي متأخّر عن الواقع بأكثر من الضعف.)

**خط الأساس (Phase 1):** وسم `migration/baseline` · توثيق التشغيل والنشر
والتراجع · بيانات مُصنَّعة · قياس 846 تأكيداً ناجحاً و5 فاشلة.

**النطاق (Phase 2):** `src/domain/accounting/chartOfAccounts/` — نقيّة تماماً
(بلا DOM · window · Firebase · React). 44 اختباراً توصيفياً **يُشغّل الشفرة
القديمة نفسها** ويقارن.

**المستودعات (Phase 3):** عقد + تنفيذ Firebase + تنفيذ ذاكرة. 72 تأكيداً، منها
مجموعة عقد واحدة يجتازها التنفيذان — برهان حياد التخزين.

**Golden Master (Phase 4):** مِشجب يُشغّل دوال `accounting.js` بحقن الحالة
واعتراض الكتابة. 103 تأكيداً + 5 لقطات ثابتة.

**Golden Master — الأرصدة (Phase 5):** مِشجب موازٍ (`capture-balances.mjs`)
يُشغّل `tbCalcBalances` · `calcFSBalances` · `coaAccountOps` ·
`calcCustomerBalance` · `calcVendorBalance` · `ensureStdAccount` — 98
تأكيداً + لقطتان. اكتشف 3 أعطال جديدة (BUG-005/006/007) وأصلح عطلين
كامنين في أدوات المِشجب المشتركة نفسها (`legacy-loader.mjs`) بلا مسّ لأي
مطابقة كانت تنجح من قبل — 228 تأكيداً من Phase 4 بقيت خضراء بعدهما. خط
أساس أداء أول مرّة (100/1,000/10,000 قيد — خطّي، لا انفجار تربيعي) واختبار
طفرة يُثبت أن الشبكة حسّاسة فعلاً (بصمة `sha256` لـ`accounting.js` قبل/بعد
متطابقة — الملف الحقيقي لم يُمَسّ).

**خدمات التطبيق (Phase 6):** طبقة كاملة — Domain (بناء قيد نقيّ + تحقّق) ←
Repository (`JournalPostingRepository`) ← Service (`postPurchaseInvoice`) —
لفاتورة المشتريات فقط (سبب القرار: `docs/services/posting.md`). 98 تأكيداً
جديداً، منها اختباران توصيفيان (LEGACY BEHAVIOR TEST) يثبتان أن منطق البناء
النقيّ الجديد **مطابق حرفياً** للقديم على 32 حالة، وخمس مجموعات NEW SAFETY
INVARIANT TEST (66 تأكيداً) على محاكي RTDB واقعي جديد
(`tests/services/fakePostingRtdb.mjs`) يطبّق `ref()`/`scopeUpdates()` من
`app.js` حرفياً. **اكتشاف أثناء الاختبار لا افتراضاً:** أول تصميم لبوّابة
Idempotency كان به سباق حقيقي (الخاسر يقرأ الفاتورة قبل أن ينهي الفائز
كتابته) — اكتُشف بـ`Promise.all` فعلي، أُصلح بمحاولات محدودة موثَّقة كحدّ لا
كحلّ مثالي (`docs/services/idempotency.md`). **غير موصولة بالإنتاج** (§15) —
`postPInv`/`createJournalForPInv` القديمتان لم تُلمَسا حرفاً واحداً.

**اكتشاف بحت (Phase 7-A):** ترتيب أولويات المسارات السبعة المتبقّية —
تقرير فقط، بلا كتابة كود. خلص إلى سند القبض/الصرف كالخطوة التالية (يعيد
استخدام كل أدوات Phase 6 ويضيف مشكلة N فاتورة واحدة جديدة).

**خدمة ترحيل السند (Phase 7 Step B):** نفس نمط Phase 6 معمارياً +
`src/domain/accounting/allocation/computeAllocation.js` (منطق تخصيص نقيّ
جديد) + `VoucherPostingRepository` (عقد جديد، Firebase/InMemory). **الاكتشاف
الحرج قبل أي بناء:** `allocateToInvoices` القديمة **لا تفحص تجاوز رصيد
الفاتورة إطلاقاً** — مُثبَت بتشغيل الدالة الحقيقية (تخصيص 6000 ثم 7000 على
فاتورة 10000 ⇒ `paidAmount: 13000`، `error: null`) — مُسجَّل كـBUG-008 جديد.
الخدمة الجديدة ترفض التجاوز صراحةً (`AllocationConflictError`) كتحسين أمان
مقصود (تصنيف C)، مُختبَر تنفيذياً بسباق حقيقي (`Promise.all`، سندان مختلفان
6000/7000 على نفس الفاتورة ⇒ واحد فقط ينجح — أبداً 13000). لأن N فاتورة
متغيّرة العدد لا تدعمها RTDB بذرّية حرفية، النموذج **تعويضي (Saga)**: N
معاملة تخصيص مستقلّة آمنة من التزامن كلٌّ بمفردها + كتابة ذرّية نهائية
واحدة؛ فشل جزئي ⇒ تعويض عكسي صريح موثَّق كاتساق نهائي لا فوري
(`docs/services/voucher-atomicity.md`). أدوات Idempotency المشتركة استُخرجت
إلى `src/repositories/firebase/postingHelpers.js` وأُعيد استخدامها في
`FirebaseJournalPostingRepository` (Phase 6) بلا أي تغيير سلوك — مُتحقَّق
(`test:svc:all` 66/66 كما هي بعد الاستخراج). 153 تأكيداً جديداً. **غير
موصولة بالإنتاج** — `postVoucher`/`createJournalForVoucher`/
`allocateToInvoices` القديمة لم تُلمَس حرفاً واحداً.

## Files Created

```
src/domain/accounting/chartOfAccounts/   types · hierarchy · validation · index
src/repositories/                        contracts · firebase · memory
src/package.json                         { "type": "module" }
tests/characterization/                  legacy-loader · chartOfAccounts · date-behavior
tests/repositories/                      fakeRtdb · contract.suite · chartOfAccounts
tests/golden-master/                     capture · canonical · journal · posting-integrity · snapshots/   ← Phase 4
tests/golden-master/                     capture-balances · canonical-balances ·                          ← Phase 5
                                          trial-balance.test · ledger.test · customer-balances.test ·
                                          supplier-balances.test · multi-tenant.test · date-boundaries.test ·
                                          precision.test · idempotency.test · failure-injection.test ·
                                          mutation.test · perf-baseline.mjs · snapshots/ (2 جديدة)
tests/fixtures/accounting/               world.mjs (Phase 4) · balances-world.mjs (Phase 5، ملف منفصل)
docs/BASELINE.md · docs/domain/*.md · docs/accounting/golden-master.md                                     ← Phase 4
docs/accounting/{balances,ledger,trial-balance,customer-balances,supplier-balances,ensureStdAccount}.md    ← Phase 5
src/domain/accounting/posting/           assertBalanced · validateJournal ·                                ← Phase 6
                                          resolveVendorPayableAccount · buildPurchaseInvoiceJournal
src/services/accounting/                 errors/{AccountingError,ValidationError,                          ← Phase 6
                                          DuplicatePostingError,AtomicityError} ·
                                          idempotency/idempotencyKey · posting/postPurchaseInvoice
src/repositories/contracts/              JournalPostingRepository.js                                        ← Phase 6
src/repositories/firebase/               FirebaseJournalPostingRepository.js                                ← Phase 6
src/repositories/memory/                 InMemoryJournalPostingRepository.js                                ← Phase 6
tests/characterization/                  resolveVendorPayableAccount.test · buildPurchaseInvoiceJournal.test ← Phase 6
tests/services/                          testKit · fakePostingRtdb · perf-baseline ·                        ← Phase 6
                                          postPurchaseInvoice.{atomicity,idempotency,multiTenant,
                                          failureInjection}.test · journalIntegrity.test
docs/services/{posting,atomicity,idempotency,integrity}.md                                                  ← Phase 6
src/domain/accounting/posting/           resolveCustomerReceivableAccount · buildVoucherJournal              ← Phase 7-B
src/domain/accounting/allocation/        computeAllocation.js (computeInvoiceAllocation·validateAllocationSet) ← Phase 7-B
src/services/accounting/errors/          AllocationConflictError.js                                          ← Phase 7-B
src/services/accounting/posting/         postVoucher.js                                                      ← Phase 7-B
src/repositories/contracts/              VoucherPostingRepository.js                                         ← Phase 7-B
src/repositories/firebase/               FirebaseVoucherPostingRepository.js · postingHelpers.js (مشترك)     ← Phase 7-B
src/repositories/memory/                 InMemoryVoucherPostingRepository.js                                 ← Phase 7-B
tests/characterization/                  resolveCustomerReceivableAccount.test · buildVoucherJournal.test ·  ← Phase 7-B
                                          allocateToInvoices.test (يُثبت BUG-008)
tests/services/                          voucherTestKit · postVoucher.{atomicity,idempotency,allocation,     ← Phase 7-B
                                          multiTenant,failureInjection}.test · voucher-perf-baseline.mjs
tests/golden-master/                     capture-voucher.mjs · voucher.test.mjs                              ← Phase 7-B
docs/services/{voucher-posting,voucher-atomicity,voucher-allocation}.md                                      ← Phase 7-B
PROJECT_AUDIT.md · ARCHITECTURE_PROPOSAL.md · MIGRATION_PLAN.md · MIGRATION_STATUS.md
ACCOUNTING_INTEGRITY_AUDIT.md · ACCOUNTING_INTEGRITY_FIX_PLAN.md
BUGS_TO_FIX.md · PRODUCTION_ISSUES.md · DEAD_CODE_CANDIDATES.md
```

## Files Modified
- `package.json` — سكربتات اختبار فقط (Phase 5: 11 + Phase 6: 12 سكربت جديد)، لا اعتماديات.
- `tests/characterization/legacy-loader.mjs` — **[Phase 5]** إضافيّتان بحتتان،
  0 تغيير سلوكي على أي مطابقة كانت تنجح من قبل (مُتحقَّق منه: 228/228 من
  Phase 4 بقيت خضراء): (1) `extractFunction` تدعم الآن نمط `window.name =
  function(...)` كاحتياطي بعد النمط الأصلي. (2) `extractConst` تدعم الآن
  ثوابت مصفوفية (`[...]`) لا كائنية (`{...}`) فقط — كانت تلتقط بصمت العنصر
  الأول فقط من أي ثابت مصفوفي (`DEFAULT_ACCOUNTS`) دون رمي استثناء.
- `MIGRATION_STATUS.md` · `ACCOUNTING_INTEGRITY_AUDIT.md` (§9 جديد) ·
  `ACCOUNTING_INTEGRITY_FIX_PLAN.md` (§9 جديد) · `BUGS_TO_FIX.md`
  (BUG-005/006/007 محدَّثة بملاحظات Phase 6) · `docs/accounting/golden-master.md` (§17 محدَّثة + §19–26 جديدة) ·
  `src/repositories/index.js` — **[Phase 6]** تصدير `JournalPostingRepository`
  والتنفيذين الجديدين (إضافة بحتة، لا تغيير على التصديرات القائمة).
- **[Phase 7-B]** `src/repositories/firebase/FirebaseJournalPostingRepository.js`
  — إعادة هيكلة داخلية بحتة: استبدال 3 دوال خاصة مكرَّرة
  (`_reserveJournalNumber`/`_pollForPostedLink`/`_safeRollbackStatus`) بنداء
  للأدوات المشتركة الجديدة في `postingHelpers.js`. **صفر تغيير سلوكي** —
  مُتحقَّق: `test:svc:all` بقيت 66/66 خضراء بعد إعادة الهيكلة مباشرةً.
  `src/repositories/index.js` — تصدير `VoucherPostingRepository` والتنفيذين
  الجديدين (إضافة بحتة). `docs/accounting/supplier-balances.md` — تصحيح
  واقعي من Phase 7-A (`fullyDebited` موجود ويُكتَب فعلاً، لكن
  `calcVendorBalance` لا تقرؤه). `BUGS_TO_FIX.md` — BUG-008 جديد.
  `docs/MIGRATION_CONTEXT.md` · `MIGRATION_STATUS.md` — محدَّثان بالكامل.
  `package.json` — 15 سكربت اختبار جديد (بلا حذف أي سكربت قائم).

## Production Files
🔒 **لم تتغيّر إطلاقاً.** لا ملف واحد في `public/`. مُتحقَّق منه آلياً قبل كل
إيداع من كل المراحل حتى الآن — بما فيها Phase 6.

## Database
- **Firebase RTDB** هو مصدر الحقيقة الوحيد · خطة Spark
- **المخطّط:** لم يتغيّر · **أسماء الحقول:** لم تتغيّر
- **`database.rules.json`:** لم يُمسّ في أي مرحلة
- **عزل المستأجرين:** `tenants/$tid/ledger/*` عبر غلافَي `ref()`/`scopeUpdates()`
  في `app.js:172` — **مستهلَكان كما هما، لم يُعادا كتابتهما**
- **لا Dual Write · لا Database Migration**

## Accounting

| المجال | الحالة |
|---|---|
| بناء القيود (مشتريات · مبيعات · صرف · قبض) | ✅ مغطّى بـGolden Master + لقطات |
| توازن المدين/الدائن | ✅ ثوابت على 0 → 999,999.99 |
| الترحيل والتكرار والفشل الجزئي | ✅ مُحلَّل وموثّق + ✅ **الآن مُتتبَّع أثره حتى التقارير (Phase 5)** |
| دفتر الأستاذ (`coaAccountOps`) | ✅ **مغطّى** — 19 تأكيداً |
| ميزان المراجعة (`tbCalcBalances`/`calcFSBalances`) | ✅ **مغطّى** — 17 تأكيداً + BUG-005 مكتشَف |
| أرصدة العملاء والموردين | ✅ **مغطّاة** — 25 تأكيداً + BUG-007 مكتشَف |
| عزل المستأجرين لدوال الأرصدة (كاش مشترك) | ✅ مغطّى — 6 تأكيدات، مطمئن |
| `ensureStdAccount` | ✅ موثَّقة بالكامل + BUG-006 مكتشَف |
| خط أساس الأداء | ✅ أول قياس — خطّي حتى 10,000 قيد |
| إشعارات دائن/مدين · شهادة مقاول باطن · القيد اليدوي | 🔴 لم تُغطَّ بعد |
| تدفّق كامل عبر الوحدات (فاتورة ← قيد ← دفتر ← ميزان، مستند واحد) | 🟡 مُغطّى جزئياً فقط (الأثر عبر شاشتين لا تتبّعاً كاملاً من الفاتورة) |
| تكاليف المشاريع | 🔴 لم تُغطَّ |
| **ترحيل ذرّي + Idempotent لفاتورة المشتريات** | ✅ **[Phase 6] مبنيّ ومُختبَر — غير موصول بالإنتاج** |
| **ترحيل سند قبض/صرف + تخصيص N فاتورة (تعويضي)** | ✅ **[Phase 7-B] مبنيّ ومُختبَر — غير موصول بالإنتاج** |

**لم يُغيَّر أي سلوك محاسبي على المسار الحيّ — كل المراحل حتى الآن.**
Phase 6 وPhase 7-B أضافتا شفرة **موازية جديدة** فقط؛ `accounting.js` كما هو حرفياً.

## Architecture

**المبنيّ فعلاً:**
```
الواجهة القديمة (تعمل كما هي)  ──→  Firebase RTDB     ← المسار الحيّ اليوم

src/domain/       نقيّ · مختبَر · غير موصول           ← مبنيّ (chartOfAccounts + posting + allocation)
src/repositories/ عقد + تنفيذان · غير موصول            ← مبنيّ (ChartOfAccounts + JournalPosting + VoucherPosting)
src/services/     postPurchaseInvoice · postVoucher · غير موصولتين ← مبنيّتان [Phase 6 · Phase 7-B]
```

**المستهدف — مبنيّ الآن لمسارين، غير موصول بعد:**
```
Legacy UI / React → Application Services → Domain → Repository → RTDB
                     ├─ postPurchaseInvoice ─┘  فاتورة المشتريات (Phase 6)
                     └─ postVoucher ──────────┘  سند قبض/صرف + تخصيص N فاتورة (Phase 7-B)
```
الناقص: **الوصل بالإنتاج** (بوّابة موافقة منفصلة — لا تلقائية بعد أي مرحلة)
و**توسيع النمط** لبقية المسارات (فاتورة مبيعات، إشعارات دائن/مدين، PMC، قيد
يدوي — `docs/services/voucher-posting.md`).

## React
**React migration NOT STARTED.** لا React ولا Vite ولا خطوة بناء ولا أي ملف
`.jsx` في المشروع.

## PostgreSQL / Oracle
**Database migration NOT STARTED.** لم يُنفَّذ PostgreSQL ولا Oracle. لم تتغيّر
قاعدة البيانات. طبقة المستودعات صُمِّمت لتجعل الاستبدال ممكناً لاحقاً — وهذا
كل ما حدث.

## Firebase
✅ **Firebase Realtime Database ما زال مصدر البيانات الحالي والوحيد.**
Auth · Hosting · RTDB تعمل كما هي. Storage معطّل (Spark) والملفات على Cloudinary.
Cloud Functions موجودة في الشفرة وغير منشورة (Spark).

## Known Risks

| # | الخطر | الخطورة |
|---|---|---|
| 1 | **لا نسخ احتياطي خادمي** — `dailyBackup` غير منشورة (Spark) | 🔴 **P0** |
| 2 | الترحيل أربع كتابات غير ذرّية ⇒ قيد يتيم عند الفشل — **[Phase 6] الحل مبنيّ ومُختبَر لفاتورة المشتريات، غير موصول بالمسار الحيّ** | 🔴 على المسار الحيّ |
| 3 | لا Idempotency ⇒ نقر مزدوج يُنتج قيدين — **[Phase 6] نفس الملاحظة: حلّ مُثبَت بتزامن حقيقي، غير موصول** | 🔴 على المسار الحيّ |
| 4 | حراسة توازن القيد على الترويسة فقط (RTDB عاجزة بنيوياً عن جمع السطور) — **[Phase 6] `assertBalanced` تفحص السطور فعلياً في الخدمة الجديدة، غير موصولة** | 🔴 في `database.rules.json` كما هو |
| 5 | دفتر الأستاذ وميزان المراجعة | ✅ **صار لهما شبكة أمان (Phase 5)** — الخطر بقي، الرصد تحسَّن |
| 6 | النطاق والمستودعات غير موصولة ⇒ نسختان من المنطق | 🟠 مخفّف: الاختبار التوصيفي كاشف انحراف |
| 7 | 5 اختبارات أمان حمراء (بوابة المشروع) — **فشل آمن لا ثغرة** | 🟠 |
| 8 | تعارضات iCloud داخل المستودع | 🟠 |
| 9 | **[Phase 5]** BUG-005: `tbCalcBalances`/`calcFSBalances` يختلفان على حركة سابقة للفترة غير مُعلَّمة — تقريران مختلفان لنفس البيانات | 🔴 |
| 10 | **[Phase 5]** BUG-007: قيد مكرَّر يظهر في ميزان المراجعة بينما رصيد الطرف يبقى "صحيحاً" — تناقض صامت بين شاشتين، يرفع إلحاح إصلاح §3/§5 في `ACCOUNTING_INTEGRITY_FIX_PLAN.md` | 🔴 |
| 11 | **[Phase 5]** BUG-006: `ensureStdAccount` غير Idempotent تحت تزامن — قد يُنشئ حسابين قياسيين بنفس الرمز | 🔴 |
| 12 | **[Phase 5]** لا فحص اتّساق دوري بين دفتر الأستاذ والمستندات — يجعل 9/10/11 غير قابلة للاكتشاف تلقائياً في الإنتاج | 🔴 |
| 13 | **[Phase 6]** نافذة سباق موثَّقة: طلب Idempotent خاسر قد يقرأ الفاتورة قبل اكتمال كتابة الفائز ⇒ يعود بـ`journalId:null` (مخفَّف بمحاولات محدودة 5×15ms، ليس ضماناً مطلقاً — لا Cloud Functions على Spark) | 🟡 لا تكرار كتابة، معلومة استجابة ناقصة فقط |
| 14 | **[Phase 7-B]** BUG-008 جديد: `allocateToInvoices` تقبل تجاوز رصيد الفاتورة بلا أي فحص، حتى تحت سباق حقيقي بين سندين — الحل مبنيّ ومُختبَر (`AllocationConflictError`)، غير موصول بالمسار الحيّ | 🔴 على المسار الحيّ |
| 15 | **[Phase 7-B]** نموذج التعويض (Saga) لتخصيص السند اتساق نهائي لا فوري — نافذة قصيرة أثناء التعويض قد تكون فيها بعض الفواتير مُعوَّضة والبعض لا (موثَّق، `docs/services/voucher-atomicity.md`) | 🟡 موثَّق كحدّ تصميمي، لا يُخفى |

## Known Bugs
`BUGS_TO_FIX.md`:
- **BUG-001** إزاحة التاريخ (UTC بدل محلي) — 188 تكراراً في 182 سطراً (Phase 5: مصدران إضافيان مؤكَّدان في `calcCustomerBalance`/`calcVendorBalance`)
- **BUG-002** حجز رمز الحساب لا يُحرَّر عند الحذف ⇒ الرمز يُحرق للأبد
- **BUG-003** `saveInvItem` مُعرَّفة مرتين بسلوكين مختلفين؛ الأولى ميتة
- **BUG-004** `createJournalForPMC` مكرّرة (متطابقة حرفياً)
- **BUG-005** [Phase 5] `tbCalcBalances`/`calcFSBalances` يختلفان على حركة سابقة للفترة غير مُعلَّمة افتتاحياً
- **BUG-006** [Phase 5] `ensureStdAccount` غير Idempotent تحت تزامن حقيقي
- **BUG-007** [Phase 5] قيد مكرَّر يظهر في ميزان المراجعة، لا في رصيد الطرف — تناقض صامت بين شاشتين
- **BUG-008** [Phase 7-B] `allocateToInvoices` تقبل تجاوز رصيد الفاتورة بلا أي حدّ — حتى تحت سباق حقيقي

`PRODUCTION_ISSUES.md`: بوابة المشروع **P1** · غياب النسخ الاحتياطي **P0**

**لم يُصلَح أيٌّ منها عمداً — كل المراحل حتى الآن.**

## Important Decisions

1. **Legacy = مصدر الحقيقة السلوكي** لا مصدر الصحّة المحاسبية. ما يبدو خطأً
   يُسجَّل ولا يُصلَح أثناء الالتقاط.
2. **حقن الاعتماديات لا الاستيراد:** المستودع لا يستورد Firebase إطلاقاً. لو
   فعل لحصل على `ref` الخام بلا بادئة المستأجر ⇒ **كسر صامت لعزل الشركات**.
3. **`__key` حقل مشتقّ** يُجرَّد قبل كل كتابة — يمنع تلويث المخطّط.
4. **الاختبار التوصيفي يقرأ الملف الحيّ** ⇒ أي تعديل على الشفرة القديمة يكسره
   فوراً. (مُتحقَّق منه بتعديل نسخة مُصطنعة.)
5. **الالتقاط بالتشغيل لا بالنسخ اليدوي.** أثبت جدواه: التقط خطأين في افتراضاتي
   أنا (`ensureStdAccount` تعيد كائناً لا رمزاً · ضريبة المخرجات 2140 لا 2180).
6. **لا Dual Write · لا تغيير مخطّط · لا تغيير قواعد أمان.**
7. **الاستراتيجية: «النطاق أولاً ثم جزر React»** لا Strangler من الواجهة —
   لأن 2,356 متغيّراً عاماً تجعل أي جزيرة مبكرة معتمدة على جسر هشّ.
8. **مساران متوازيان للأصول** حين يبدأ React: `public/` يبقى بلا بناء،
   و`public/dist/` يُودَع في git كي لا ينكسر النشر التلقائي.

## Do Not Change

بلا موافقة صريحة:
1. ❌ `database.rules.json` وقيمه الحرفية (`'approved'` · `'posted'` · `permsMap`)
2. ❌ مخطّط RTDB وأسماء الحقول
3. ❌ غلافا `ref()` و`scopeUpdates()` في `app.js:172`
4. ❌ مصفوفة الـ119 صلاحية
5. ❌ `public/calc.js`
6. ❌ أي معادلة مالية قبل تغطيتها باختبار
7. ❌ حذف أي ملف قبل إثبات (سجّل في `DEAD_CODE_CANDIDATES.md`)
8. ❌ دفع `main` أو النشر للإنتاج
9. ❌ إصلاح أي بند في `BUGS_TO_FIX.md` بلا مسار §6

## Commands

```bash
# اختبارات مسار الترحيل (Node فقط — سريعة، بلا شبكة)
npm run test:char          # 44 · توصيفي شجرة الحسابات
npm run test:char:date     #  9 · توصيفي سلوك التاريخ
npm run test:repo          # 72 · عقد المستودعات
npm run test:domain        # الثلاثة معاً
npm run test:gm             # 74 · Golden Master القيود (Phase 4)
npm run test:gm:posting     # 29 · سلامة الترحيل (Phase 4)
npm run test:gm:tb          # 17 · ميزان المراجعة (Phase 5)
npm run test:gm:ledger      # 19 · دفتر الأستاذ (Phase 5)
npm run test:gm:customer    #  16 · رصيد العميل (Phase 5)
npm run test:gm:supplier    #   9 · رصيد المورد (Phase 5)
npm run test:gm:tenant      #   6 · عزل المستأجرين — كاش الأرصدة (Phase 5)
npm run test:gm:dates       #   4 · حدود التاريخ (Phase 5)
npm run test:gm:precision   #   8 · الدقّة المالية (Phase 5)
npm run test:gm:idem        #   9 · التكرار — الأثر على التقارير (Phase 5)
npm run test:gm:failure     #   4 · حقن الفشل — الأثر على التقارير (Phase 5)
npm run test:gm:mutation    #   6 · إثبات حساسية الشبكة (Phase 5)
npm run test:gm:balances    # الاثنا عشر أعلاه (Phase 5) معاً — 98
npm run test:gm:all         # Phase 4 + Phase 5 معاً — 201
npm run gm:perf              # خط أساس أداء الأرصدة (Phase 5) — تقرير أرقام لا اختبار نجاح/فشل

# خدمات التطبيق — الترحيل الذرّي (Phase 6)
npm run test:char:vendaccount  #  6 · توصيفي — حساب المورد المستحَق
npm run test:char:pinvjournal  # 26 · توصيفي — بناء قيد فاتورة المشتريات (مدمَجان في test:domain)
npm run test:svc:atomicity     # 14 · الذرّية
npm run test:svc:idempotency   # 16 · Idempotency + تزامن حقيقي (Promise.all)
npm run test:svc:integrity     # 15 · تكامل القيد (assertBalanced/validateJournal)
npm run test:svc:tenant        # 13 · عزل المستأجرين — كتابة ذرّية
npm run test:svc:failure       #  8 · حقن فشل شامل
npm run test:svc:all           # الخمسة أعلاه معاً — 66
npm run svc:perf                # خط أساس أداء الترحيل (Phase 6) — تقرير أرقام

# خدمة السند — تخصيص متعدّد الفواتير (Phase 7 Step B)
npm run test:char:custaccount     #  6 · توصيفي — حساب العميل المستحَق
npm run test:char:voucherjournal  # 27 · توصيفي — بناء قيد السند
npm run test:char:allocation      # 15 · توصيفي — allocateToInvoices (يُثبت BUG-008)
npm run test:gm:voucher           #  7 · Golden Master — الجديد مقابل القديم + تصنيف الفرق
npm run test:svc:voucher:atomicity   # 21 · الذرّية + التعويض
npm run test:svc:voucher:idempotency # 19 · Idempotency + تزامن حقيقي
npm run test:svc:allocation          # 26 · تخصيص N فاتورة + رفض التجاوز + سباق حقيقي
npm run test:svc:voucher:tenant      # 16 · عزل المستأجرين
npm run test:svc:voucher:failure     # 16 · حقن فشل شامل
npm run test:svc:voucher:all         # الخمسة أعلاه معاً — 98
npm run test:phase7                  # كل جديد Phase 7-B مجمَّعاً — 153
npm run test:migration               # الكل مجمَّعاً (كل المراحل)
npm run svc:voucher:perf             # خط أساس أداء ترحيل السند + N تخصيص — تقرير أرقام

# اختبارات النظام القائم
npm run test:calc          # 27
npm run test:pdf           # 102
npm run test:ai            # 165
npm run test:proxy         # 36
npm run test:rules         # 310 ✅ / 5 ❌ — يتطلّب محاكي Firebase + Java
npm run test:pdf:e2e       # 52  · Chrome حقيقي (يتخطّى إن غاب)
npm run test:ai:e2e        # 34  · Chrome حقيقي
npm run test:ai:page       # 120 · Chrome حقيقي

npm run lint               # eslint --quiet · نظيف

firebase serve             # تشغيل محلي (يخدم public/) — تحديث قسري للمتصفح
```

**لا يوجد أمر build** — المشروع بلا خطوة بناء عمداً.
**لا تنفّذ** `npm run deploy` ولا `firebase deploy` — نشر إنتاج.

## Environment Requirements

| | المُثبَّت هنا | ملاحظة |
|---|---|---|
| Node | v25.2.1 | ≥20 كافٍ · لا `engines` محدّد |
| npm | 11.14.1 | |
| Java | OpenJDK 24 | **يلزم لـ`test:rules` فقط** (محاكي Firebase) |
| Firebase CLI | 15.22.4 | `npm i -g firebase-tools` |
| Chrome | — | لاختبارات المتصفح · تتخطّى تلقائياً إن غاب · `CHROME_PATH` للمسار المخصّص |

**الاعتماديات:** `npm install` — واحدة للتشغيل (`firebase`) وثلاث للتطوير.

**متغيّرات البيئة:** **لا يوجد أي متغيّر بيئة مطلوب.** إعداد Firebase مضمّن في
`public/app.js` كـ**مفتاح ويب علني بطبيعته** (أمانه من قواعد الأمان وتقييد
النطاق، لا من إخفائه). لا ملف `.env` ولا أسرار في المستودع.

**VS Code:** لا امتدادات إلزامية.

## Next Recommended Step

**خدمة ترحيل السند اكتملت ومُختبَرة (Phase 7 Step B) — غير موصولة
بالإنتاج.** نفس المسارات المحتملة التالية كما بعد Phase 6، بانتظار قرار
المالك، لا يُبدأ أيّ منها بلا أمر صريح (كل واحد بوّابة موافقة منفصلة):

**أ) توسيع النمط أفقياً** — فاتورة المبيعات (تتقاطع مع BUG-006/`ensureStdAccount`
— قرار مطلوب أولاً)، ثم إشعارات دائن/مدين، ثم PMC، ثم القيد اليدوي (الأعقد
— موافقة فرعية إضافية). راجع `docs/services/voucher-posting.md` للتفصيل.

**ب) وصل مُتحكَّم بالإنتاج** — فاتورة المشتريات و/أو السند، خلف عَلَم ميزة،
مع خطة تراجع فورية (`git revert` وحده كافٍ — لا تغيير مخطّط). هذا **قرار
مستقلّ تماماً** عن اكتمال الاختبارات — «الوصل خطوة مُتحكَّمة منفصلة»، لا
تلقائية بعد نجاح أي مرحلة.

**ج) الانتقال إلى Phase 8 (أساس React)** — تأجيل توسيع الخدمات، بناء طبقة
العرض فوق ما استقرّ (النطاق + المستودعات + خدمتا المشتريات والسند) كنموذج
يُثبت الجزيرة الأولى قبل تكرار النمط عبر بقية المسارات.

**لا توصية مفروضة هذه المرّة** — الثلاثة صحيحة هندسياً، والاختيار يعتمد
على أولوية عمل (نضج المحاسبة أم واجهة حديثة أم قرار الوصل) لا على معيار
تقني حاسم.

## Exact Resume Point

**Resume from: قرار المالك بين (أ)/(ب)/(ج) أعلاه.**

أول ما يُفعل بغضّ النظر عن القرار:
1. اقرأ `docs/services/{posting,atomicity,idempotency,integrity}.md` (Phase 6)
   و`docs/services/{voucher-posting,voucher-atomicity,voucher-allocation}.md` (Phase 7-B) كاملة
2. شغّل `npm run test:migration` — يجب أن تكون خضراء بالكامل (0 فشل في كل مجموعة)
3. اقرأ `docs/services/idempotency.md` قسم «حدّ حقيقي مُكتشَف بالاختبار» قبل أي توسيع لآلية Idempotency — نافذة سباق موثَّقة، ليست موهومة
4. اقرأ `docs/services/voucher-atomicity.md` كاملاً قبل أي توسيع لأي مسار يتضمّن N كتابة متغيّرة العدد — نموذج التعويض (Saga) موثَّق كاتساق نهائي لا فوري، ويجب أن يُطبَّق نفس المنطق لا يُعاد اختراعه

**إن اختير (أ) لفاتورة المبيعات تحديداً:** اقرأ `BUGS_TO_FIX.md BUG-006` و
`docs/accounting/ensureStdAccount.md` أولاً — القرار بشأن `ensureStdAccount`
(يبقى بلا قفل، أم يُضاف قفل تفاؤلي أولاً) يسبق بناء `buildSalesInvoiceJournal`
منطقياً لأن الأخيرة تستدعيها.

**إن اختير (ب):** لا يبدأ بلا موافقة صريحة منفصلة عن موافقة أي مرحلة سابقة.

**سؤال مفتوح بانتظار قرار المالك:**
- `ensureStdAccount` تُنشئ حسابات في الشجرة كأثر جانبي للترحيل بلا موافقة،
  وثبت في Phase 5 أنها قد تُنشئ **نسختين** بنفس الرمز تحت تزامن (BUG-006) —
  يبقى التصميم أم يتحوّل إلى اقتراح يتطلّب تأكيداً + قفل تفاؤلي يمنع BUG-006؟
  (لا يزال مفتوحاً — Phase 6 لم يتطلّب حسمه لأن فاتورة المشتريات لا تستدعيها)
