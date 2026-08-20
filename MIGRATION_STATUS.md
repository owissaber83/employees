# MIGRATION_STATUS.md — حالة الترحيل

**آخر تحديث:** 2026-08-20 (Phase 7 Step D — خدمتا الإشعار الدائن والمدين)
**آخر تحديث سابق:** 2026-08-19 (Phase 7 Step C — خدمة ترحيل فاتورة المبيعات: قيد + مخزون في كتابة ذرّية واحدة)
**آخر تحديث سابق:** 2026-08-19 (Phase 7 Step B — خدمة ترحيل السند: تخصيص متعدّد الفواتير + تعويض) · **المرجع:** [`docs/HANDOFF.md`](docs/HANDOFF.md)
**آخر تحديث سابق:** 2026-08-19 (Phase 6 — خدمات التطبيق: ترحيل ذرّي + Idempotency) · **الفرع:** `feat/ai-invoice-system-v2` (مدفوع) · **الوسم:** `migration/baseline`

## المراحل

| # | المرحلة | الحالة |
|---|---|---|
| 0 | التدقيق (Audit) | ✅ مكتمل |
| 1 | السلامة وخط الأساس | ✅ مكتمل |
| 2 | استخلاص النطاق المحاسبي | 🟡 جارٍ — شجرة الحسابات + منطق ترحيل فاتورة المشتريات النقيّ (Phase 6) |
| 3 | طبقة Repository | 🟡 جارٍ — شجرة الحسابات + `JournalPostingRepository` (Phase 6) |
| 4 | Golden Master — بناء القيود وسلامة الترحيل | ✅ مكتمل (103 تأكيداً) |
| 5 | Golden Master — دفتر الأستاذ · ميزان المراجعة · أرصدة الأطراف | ✅ مكتمل (98 تأكيداً) |
| 6 | خدمات التطبيق — ترحيل ذرّي + Idempotency (فاتورة المشتريات) | ✅ مكتمل — 98 تأكيداً (انظر §خدمات التطبيق أدناه). **غير موصول بالإنتاج بعد** |
| 7-A | اكتشاف بحت — ترتيب أولويات مسارات الترحيل المتبقّية | ✅ مكتمل — تقرير فقط، بلا كود |
| 7-B | خدمة ترحيل السند — تخصيص متعدّد الفواتير + تعويض (Saga) | ✅ مكتمل — 153 تأكيداً جديداً (انظر §Phase 7 Step B أدناه). **غير موصول بالإنتاج بعد** |
| 7-C | خدمة ترحيل فاتورة المبيعات — قيد + حركات مخزون في كتابة ذرّية واحدة | ✅ **مكتمل هذا التحديث** — 307 تأكيداً جديداً (انظر §Phase 7 Step C أدناه). **غير موصول بالإنتاج بعد** |
| 7-D | خدمتا الإشعار الدائن والمدين — مطالبة بالإنشاء · سعة متبقّية · كتابة ذرّية | ✅ **مكتمل هذا التحديث** — 480 تأكيداً جديداً (انظر §Phase 7 Step D أدناه). **غير موصول بالإنتاج بعد** |
| 7-E+ | أساس React / بقيّة مسارات الترحيل (PMC، قيد يدوي) | 🔴 لم تبدأ — قرار المالك التالي |

> ⚠️ **ملاحظة ترقيم:** `MIGRATION_PLAN.md` يُرقِّم "خدمات الأعمال" كـPhase 4
> و"Golden Master" كـPhase 5 (بُدِّلا بموافقة المالك 2026-08-19)، بينما
> `docs/HANDOFF.md` يُسمّي جولة القيود "Phase 4" وجولة الأرصدة (هذا التحديث)
> "Phase 5" — وهذا الترقيم الفعلي المُتَّبع فعلياً في الإيداعات والأوامر
> (`npm run test:gm:*`). لم يُوحَّد الترقيمان عمداً — التغيير الآن يُخاطر
> بإرباك أكبر من إبقائه. **الأسماء (لا الأرقام) هي المرجع الموثوق دائماً.**

## الوحدات

| الوحدة | الحالة | مصدر الحقيقة |
|---|---|---|
| المصادقة | 🔴 قديم | Legacy |
| لوحة التحكم | 🔴 قديم | Legacy |
| شجرة الحسابات | 🔴 قديم | Legacy |
| قيود اليومية | 🔴 قديم | Legacy |
| دفتر الأستاذ · ميزان المراجعة | 🔴 قديم | Legacy |
| القوائم المالية | 🔴 قديم | Legacy |
| العملاء · الذمم المدينة | 🔴 قديم | Legacy |
| الموردون · الذمم الدائنة | 🔴 قديم | Legacy |
| فواتير المبيعات · المشتريات | 🔴 قديم (خدمتان موازيتان جاهزتان غير موصولتين) | Legacy |
| الإشعارات الدائنة · المدينة | 🔴 قديم (خدمتان موازيتان جاهزتان غير موصولتين) | Legacy |
| سندات القبض · الصرف | 🔴 قديم | Legacy |
| المخزون · المخازن | 🔴 قديم · ✅ **التقييم مستخلَص ومُثبت** (`domain/inventory`) | Legacy |
| الأصول الثابتة | 🔴 قديم | Legacy |
| الضرائب (قيمة مضافة · زكاة · استقطاع) | 🔴 قديم | Legacy |
| المشاريع · المستخلصات | 🔴 قديم | Legacy |
| الموارد البشرية · الرواتب · الحضور | 🔴 قديم | Legacy |
| المشتريات · أوامر الشراء | 🔴 قديم | Legacy |
| التقارير | 🔴 قديم | Legacy |
| الإعدادات · الصلاحيات | 🔴 قديم | Legacy |
| محرر PDF | ⚪ خارج النطاق | Legacy (مُطبَّق الطبقات فعلاً) |
| قراءة الفواتير بالذكاء الاصطناعي | ⚪ خارج النطاق | Legacy (مُطبَّق الطبقات فعلاً) |

**المفتاح:** ✅ مكتمل · 🟡 قيد العمل · 🔴 لم يبدأ · ⚠️ معطّل/محجوب · ⚪ خارج النطاق

## الطبقات المستخلصة

| الطبقة | التغطية |
|---|---|
| `domain/accounting/chartOfAccounts` | ✅ **مستخلَص ومُثبت** (types · hierarchy · validation) |
| `repositories/contracts` + `firebase` + `memory` | ✅ **شجرة الحسابات** — عقد واحد، تنفيذان |
| `domain/accounting/journalEntry` | 🔴 لم يبدأ (لكن السلوك مُوثَّق بالكامل عبر Golden Master §4) |
| `domain/accounting/posting` | 🟡 **مستخلَص جزئياً** — مشتريات (P6) · سند (P7-B) · **مبيعات (P7-C)** · تحقّق + توازن |
| `domain/accounting/ledger` | 🔴 الاستخلاص لم يبدأ · ✅ **السلوك موصَّف بالكامل** (`coaAccountOps` — Golden Master، `docs/accounting/ledger.md`) |
| `domain/accounting/trialBalance` | 🔴 الاستخلاص لم يبدأ · ✅ **السلوك موصَّف بالكامل** (`tbCalcBalances`/`calcFSBalances` — Golden Master، `docs/accounting/trial-balance.md`، BUG-005) |
| `domain/accounting/balances` | 🔴 الاستخلاص لم يبدأ · ✅ **السلوك موصَّف بالكامل** (`calcCustomerBalance`/`calcVendorBalance` — Golden Master، BUG-007) |
| `domain/inventory` | ✅ **مستخلَص ومُثبت** (P7-C/D) — المتوسط المتحرّك · الرصيد · تخطيط حركات البيع والمرتجعات |
| `domain/accounting/{notes,credit-note,debit-note}` | ✅ **مستخلَص ومُثبت** (P7-D) — المبالغ · السعة · القيدان · حلّ الحسابات |
| `domain/accounting/validation` | 🔴 لم يبدأ |
| `calc.js` · `aiinvoice-engine.js` · `pdfeditor-engine.js` | ✅ نقيّة سابقاً |
| `application/` (`src/services/`) | 🟡 خمس خدمات — مشتريات · سند · مبيعات · **إشعار دائن · إشعار مدين** |
| `repositories/` | 🟡 ستة عقود، تنفيذان لكلٍّ (Firebase + ذاكرة) |
| نظام التصميم | 🔴 غير موجود |

## الاختبارات

| المجموعة | التأكيدات | الحالة |
|---|---|---|
| `test:rules` | 310 | 🔴 **5 فاشلة** (بوابة المشروع — سابقة، فشل آمن) |
| `test:calc` | 27 | ✅ |
| `test:pdf:e2e` | 52 | ✅ |
| `test:pdf` | 102 | ✅ |
| `test:ai` | 165 | ✅ |
| `test:ai:page` | 120 | ✅ |
| `test:ai:e2e` | 34 | ✅ |
| `test:proxy` | 36 | ✅ |
| `test:char` (توصيفي — شجرة الحسابات) | 44 | ✅ **جديد** |
| `test:char:date` (توصيفي — التاريخ) | 9 | ✅ |
| `test:repo` (عقد المستودعات) | 72 | ✅ |
| `test:gm` (Golden Master — القيود) | 74 | ✅ |
| `test:gm:posting` (سلامة الترحيل) | 29 | ✅ |
| `test:gm:tb` (ميزان المراجعة) | 17 | ✅ **جديد Phase 5** |
| `test:gm:ledger` (دفتر الأستاذ) | 19 | ✅ **جديد Phase 5** |
| `test:gm:customer` (رصيد العميل) | 16 | ✅ **جديد Phase 5** |
| `test:gm:supplier` (رصيد المورد) | 9 | ✅ **جديد Phase 5** |
| `test:gm:tenant` (عزل المستأجرين — كاش الأرصدة) | 6 | ✅ **جديد Phase 5** |
| `test:gm:dates` (حدود التاريخ) | 4 | ✅ **جديد Phase 5** |
| `test:gm:precision` (الدقّة المالية) | 8 | ✅ **جديد Phase 5** |
| `test:gm:idem` (التكرار — الأثر على التقارير) | 9 | ✅ **جديد Phase 5** |
| `test:gm:failure` (حقن الفشل — الأثر على التقارير) | 4 | ✅ **جديد Phase 5** |
| `test:gm:mutation` (إثبات حساسية الشبكة) | 6 | ✅ **جديد Phase 5** |
| **`test:gm:all` (الإجمالي)** | **201** | ✅ |

**الإجمالي المقيس في خط الأساس (Phase 1):** 846 ناجح · 5 فاشل · `lint` نظيف
— لم يتغيّر (لا Phase 5 ولا Phase 6 تمسّان `public/`، فلا أثر على هذا الرقم).

## خدمات التطبيق — Phase 6

| المجموعة | التأكيدات | الحالة |
|---|---:|---|
| `test:char:vendaccount` (توصيفي — حساب المورد المستحَق) | 6 | ✅ **جديد** |
| `test:char:pinvjournal` (توصيفي — بناء قيد فاتورة المشتريات) | 26 | ✅ **جديد** |
| `test:svc:atomicity` (الذرّية) | 14 | ✅ **جديد** |
| `test:svc:idempotency` (Idempotency + تزامن حقيقي) | 16 | ✅ **جديد** |
| `test:svc:integrity` (تكامل القيد) | 15 | ✅ **جديد** |
| `test:svc:tenant` (عزل المستأجرين — كتابة ذرّية) | 13 | ✅ **جديد** |
| `test:svc:failure` (حقن فشل شامل) | 8 | ✅ **جديد** |
| **الإجمالي (`test:domain` +32 · `test:svc:all` 66)** | **98** | ✅ |

مسار الترحيل الكامل الآن: 157 (`test:domain`، بعد +32) + 201 (`test:gm:all`)
+ 66 (`test:svc:all`) = **424 تأكيداً**. التفصيل: [`docs/services/`](docs/services/)
و[`docs/accounting/golden-master.md`](docs/accounting/golden-master.md).

**🔴→✅ يُثبت عملياً إغلاق جذر BUG-007** (على مسار موازٍ غير موصول بالإنتاج
— لا على `postPInv` القديمة نفسها): طلبان متزامنان حقيقيان (`Promise.all`)
على نفس الفاتورة ⇒ **قيد واحد فقط**، لا اثنان. راجع `docs/services/idempotency.md`.

## عيوب — الحالة بعد Phase 6

`BUGS_TO_FIX.md`: **BUG-005** (فجوة `tbCalcBalances`/`calcFSBalances`) —
غير مُصلَح، لم يُلمَس في Phase 6. **BUG-006** (`ensureStdAccount` غير
Idempotent) — غير مُصلَح، الدالة لم تُعدَّل؛ مسار المشتريات الجديد لا
يستدعيها أصلاً فلا يتأثّر بها. **BUG-007** (قيد مكرَّر) — **غير مُصلَح على
المسار الحيّ** (`postPInv` القديمة كما هي تماماً)؛ جذره **مُثبَت قابلاً
للحل** في خدمة موازية مُختبَرة، غير موصولة بعد. تفاصيل كاملة في `BUGS_TO_FIX.md`.

## خدمة ترحيل السند — Phase 7 Step B

خدمة موازية جديدة (`createPostVoucherService`) ترحّل سند قبض/صرف وتخصّص
مبلغه على N فاتورة — **غير موصولة بالإنتاج**، `postVoucher`/
`createJournalForVoucher`/`allocateToInvoices` في `accounting.js` لم تُلمَس.

**البنية:** `src/services/accounting/posting/postVoucher.js` (الخدمة) →
`src/domain/accounting/posting/buildVoucherJournal.js` +
`src/domain/accounting/posting/resolveCustomerReceivableAccount.js` (بناء نقيّ) →
`src/domain/accounting/allocation/computeAllocation.js` (منطق التخصيص النقيّ) →
`src/repositories/contracts/VoucherPostingRepository.js` (عقد) →
`FirebaseVoucherPostingRepository`/`InMemoryVoucherPostingRepository` (تنفيذان).
`src/repositories/firebase/postingHelpers.js` جديد أيضاً — استُخرجت منه أدوات
Idempotency المشتركة (`claimDraftToPosted`/`pollForPostedLink`/
`safeRollbackStatus`/`reserveJournalNumber`)، وأُعيد استخدامها في
`FirebaseJournalPostingRepository` (Phase 6) بلا أي تغيير سلوك (تحقّق
بإعادة تشغيل `test:svc:all` — 66/66 كما هي).

**الاكتشاف الحرج:** `allocateToInvoices` القديمة **لا تفحص تجاوز رصيد
الفاتورة إطلاقاً** — مُثبَت تنفيذياً (`tests/characterization/allocateToInvoices.test.mjs`)،
مُسجَّل كـ**BUG-008 جديد** في `BUGS_TO_FIX.md`. الخدمة الجديدة ترفض التجاوز
صراحةً (`AllocationConflictError`) — فرق مقصود، مصنَّف (C) في
`docs/services/voucher-allocation.md`.

**نموذج الاتساق:** ليست ذرّية N+1 حرفية (RTDB لا تدعمها بنيوياً لعقد متغيّر
الطول) — بل ثلاث طبقات: بوّابة Idempotency (`runTransaction` على `status`) ·
N معاملة تخصيص مستقلّة آمنة من التزامن كلٌّ بمفردها (`runTransaction` لكل
فاتورة، ترفض التجاوز حتى تحت سباق حقيقي) · كتابة ذرّية نهائية واحدة (قيد +
ربط السند). فشل جزئي ⇒ **تعويض عكسي صريح** (Saga) لكل ما نجح، موثَّق بصراحة
في `docs/services/voucher-atomicity.md` كنموذج اتساق نهائي لا فوري.

**مُثبَت تنفيذياً بسباق حقيقي:** سندان مختلفان (6000 و7000 على فاتورة
رصيدها 10000) عبر `Promise.all` حقيقي على نفس الفاتورة ⇒ **واحد فقط
ينجح** — الرصيد النهائي 6000 أو 7000 بالضبط، أبداً 13000 (القديم كان يقبل
كليهما). `tests/services/postVoucher.allocation.test.mjs` «السباق الحقيقي».

**التوثيق:** [`docs/services/voucher-posting.md`](docs/services/voucher-posting.md) ·
[`docs/services/voucher-atomicity.md`](docs/services/voucher-atomicity.md) ·
[`docs/services/voucher-allocation.md`](docs/services/voucher-allocation.md)

### الاختبارات — Phase 7 Step B

| المجموعة | التأكيدات | الحالة |
|---|---:|---|
| `test:char:custaccount` (توصيفي — حساب العميل المستحَق) | 6 | ✅ **جديد** |
| `test:char:voucherjournal` (توصيفي — بناء قيد السند) | 27 | ✅ **جديد** |
| `test:char:allocation` (توصيفي — `allocateToInvoices`، يُثبت BUG-008) | 15 | ✅ **جديد** |
| `test:gm:voucher` (Golden Master — الجديد مقابل القديم + تصنيف الفرق) | 7 | ✅ **جديد** |
| `test:svc:voucher:atomicity` | 21 | ✅ **جديد** |
| `test:svc:voucher:idempotency` | 19 | ✅ **جديد** |
| `test:svc:allocation` (تخصيص N فاتورة + سباق حقيقي) | 26 | ✅ **جديد** |
| `test:svc:voucher:tenant` | 16 | ✅ **جديد** |
| `test:svc:voucher:failure` | 16 | ✅ **جديد** |
| **الإجمالي (`test:phase7`)** | **153** | ✅ |

مسار الترحيل الكامل الآن: 157 (`test:domain`، +48 توصيف Phase 7) + 208
(`test:gm:all`، +7) + 164 (`test:svc:all`+`test:svc:voucher:all`، +98) —
راجع `npm run test:migration` للتشغيل الكامل. لا فشل واحد في أي مجموعة.

**عدّة الاختبار المشتركة:** `tests/services/voucherTestKit.mjs` (يعيد
استخدام `fakePostingRtdb.mjs` من Phase 6 حرفياً) و
`tests/golden-master/capture-voucher.mjs` (حصاد سلوك القديم الحقيقي عبر
`legacy-loader.mjs`، بامتداد يدعم `get`/`update` حقيقيَّين على متجر ذاكرة —
`allocateToInvoices` تقرأ قبل أن تكتب، خلافاً لما احتاجته Phase 4).

## خدمة ترحيل فاتورة المبيعات — Phase 7 Step C

خدمة موازية جديدة (`createPostSalesInvoiceService`) ترحّل فاتورة مبيعات:
تبني القيد، تخطّط حركات المخزون، وتكتبها **كلها في تحديث ذرّي واحد** —
**غير موصولة بالإنتاج**؛ `postSInv`/`createJournalForSInv`/
`createInventoryMovementsForSInv` في `accounting.js` لم تُلمَس حرفاً واحداً.

**البنية:** `src/services/accounting/posting/postSalesInvoice.js` (الخدمة) →
`domain/accounting/posting/buildSalesInvoiceJournal.js` +
`resolveSalesRevenueAccount.js` + `domain/inventory/planSalesInvoiceMovements.js`
+ `movingAverage.js` → `repositories/contracts/SalesInvoicePostingRepository.js`
→ تنفيذا Firebase والذاكرة.

**ما يُضمَن فعلياً:**
- **كتابة ذرّية واحدة** تضمّ القيد + ربط الفاتورة + **كل** حركات المخزون.
  القديم يفعلها في **3 + 2N** عملية مستقلّة (8 نقاط فشل لفاتورة بثلاثة أصناف).
- **Idempotency آمنة من التزامن** عبر `runTransaction` على `status` — 2 و5 و10
  طلبات متزامنة ⇒ ترحيل واحد بالضبط، قيد واحد، مجموعة حركات واحدة.
- **صفر إنشاء حسابات** — يعزل مسار المبيعات عن BUG-006 كلّياً (القديم يستدعي
  `ensureStdAccount` حتى ستّ مرّات في الترحيل الواحد).
- **عزل مستأجرين مُثبَت** على متجر مشترك: نفس مفتاح الفاتورة في مستأجرَين،
  ترحيل متزامن ⇒ صفر تسرّب في الفاتورة والقيد والمخزون والعدّادات.

**القيد مطابق للقديم حرفياً** — 41 تأكيد Golden Master بتشغيل الدالة القديمة
الحقيقية من الملف الحيّ: ضريبة عادية/صفر/حدود تقريب · عملة أجنبية · احتجاز ·
دفعة مقدمة · مجموعات حسابات العملاء · عميل مفقود · مبالغ نصّية.

**اكتشاف جوهري:** لا يوجد **أي** قيد مخزون أو تكلفة بضاعة مباعة في ترحيل
البيع — النظام **جرد دوري** لا مستمر. سياسة قائمة، حُفظت كما هي وسُجّلت كقرار
معلّق (D2).

**التوثيق:** [`docs/services/sales-invoice-discovery.md`](docs/services/sales-invoice-discovery.md) ·
[`sales-invoice-posting.md`](docs/services/sales-invoice-posting.md) ·
[`sales-invoice-atomicity.md`](docs/services/sales-invoice-atomicity.md) ·
[`sales-invoice-idempotency.md`](docs/services/sales-invoice-idempotency.md) ·
[`sales-invoice-inventory.md`](docs/services/sales-invoice-inventory.md)

### الاختبارات — Phase 7 Step C

| المجموعة | التأكيدات | الحالة |
|---|---:|---|
| `test:char:inventory` (توصيفي — تقييم المخزون مقابل القديم) | 49 | ✅ **جديد** |
| `test:gm:sales` (Golden Master — القيد والمخزون: الجديد مقابل القديم) | 41 | ✅ **جديد** |
| `test:svc:sales:atomicity` (كتابة ذرّية واحدة + تعادل التنفيذين) | 34 | ✅ **جديد** |
| `test:svc:sales:idempotency` (تزامن حقيقي 2/5/10 + حماية BUG-007) | 43 | ✅ **جديد** |
| `test:svc:sales:inventory` (اتساق المخزون + لا ازدواج) | 34 | ✅ **جديد** |
| `test:svc:sales:tenant` (عزل المستأجرين) | 38 | ✅ **جديد** |
| `test:svc:sales:failure` (حقن فشل A–M) | 68 | ✅ **جديد** |
| **الإجمالي (`test:phase7c`)** | **307** | ✅ |

مسار الترحيل الكامل الآن (`npm run test:migration`):
254 (`test:domain`) + 249 (`test:gm:all`) + 66 (`test:svc:all`) +
98 (`test:svc:voucher:all`) + 217 (`test:svc:sales`) = **884 تأكيداً · صفر فشل**.

**المجموعات القائمة بعد التغيير:** `test:calc` 27 ✅ · `test:pdf` 102 ✅ ·
`test:ai` 165 ✅ · `test:proxy` 36 ✅ · `lint` نظيف ✅ — لم يتغيّر أي منها
(لا شيء في `public/` مسّه هذا التحديث).

## عيوب — الحالة بعد Phase 7 Step C

**BUG-009 جديد ومُوثَّق:** `createInventoryMovementsForSInv` تبتلع فشل كل
حركة على حدة (`try/catch` + `console.error` فقط) ⇒ فاتورة مرحّلة بقيد سليم
وحركات مخزون ناقصة **بصمت**، ورصيد صنف أعلى من الواقع إلى الأبد.
**غير مُصلَح** (تعديل `public/` ممنوع)؛ جذره مُغلَق في الخدمة الموازية.

**BUG-006** — غير مُصلَح؛ لكن الخدمة الجديدة لا تُنشئ حسابات إطلاقاً فتعزل
مسار المبيعات عنه. **BUG-007** — غير مُصلَح على المسار الحيّ (وهو على المبيعات
أشدّ: يضاعف المخزون أيضاً)؛ مُثبَت قابلاً للحل في الخدمة الموازية.
**BUG-005 · BUG-008** — لم تُلمَسا. التفاصيل في `BUGS_TO_FIX.md`.

## خدمتا الإشعار الدائن والمدين — Phase 7 Step D

خدمتان موازيتان جديدتان (`createPostCreditNoteService` · `createPostDebitNoteService`)
تُصدران إشعار إرجاع وتُرحّلانه — **غير موصولتين بالإنتاج**؛ `submitCreditNote` و
`submitDebitNote` وتوابعهما في `accounting.js` لم تُلمَس بحرف.

**البنية:** `services/accounting/posting/post{Credit,Debit}Note.js` →
`domain/accounting/{notes,credit-note,debit-note}` + `domain/inventory/plan*NoteMovements.js`
→ `repositories/contracts/{Credit,Debit}NotePostingRepository.js` → تنفيذا Firebase والذاكرة
(محرّك مشترك `notePostingBase.js` بإعدادات مختلفة لكل مسار).

**قرارات المالك الأربعة — مُنفَّذة كما اعتُمدت:**
1. **مرساة Idempotency** = `noteKey` يولّده المستدعي + معاملة خادمية على `status`
   (غائب→`draft`، والكتابة الذرّية تُحوّلها إلى `posted`). لا حقل ولا مجموعة جديدة.
2. **الترقيم** بعدّاد معامِلاتي `ledger/counters/{cn|dn}/{year}` داخل `counters` القائمة.
3. **رفض التجاوز** بحساب المتبقّي من الحالة اللحظية للفاتورة داخل معاملة.
4. **D3/D4** لم يُحسما ولم يُنفَّذا — السلوك القديم محفوظ.

**ما يُضمَن فعلياً:**
- كتابة ذرّية واحدة تضمّ المستند + القيد + **كل** حركات المخزون.
- 2 و5 و10 نداءات متزامنة بنفس `noteKey` ⇒ إصدار أصلي واحد بالضبط.
- إشعاران متزامنان لا يتّسع لهما المتبقّي ⇒ واحد ينجح والباقي `AllocationConflictError`.
- إشعاران متكاملان (1725 + 575 على فاتورة 2300) ⇒ كلاهما ينجح والمجموع 2300 بلا ضياع تحديث.
- عزل مستأجرين مُثبَت بنفس `noteKey` ونفس `invoiceKey` متزامناً.

**القيدان مطابقان للقديم حرفياً** — 104 تأكيدات Golden Master بتشغيل الدوال القديمة
الحقيقية (بحقن DOM وهمي لأن `cnCompute`/`dnCompute` تقرآن الكميات من الشاشة).

**التوثيق:** عشر وثائق في [`docs/services/`](docs/services/) —
`{credit,debit}-note-{discovery,posting,atomicity,idempotency,inventory}.md`

### الاختبارات — Phase 7 Step D

| المجموعة | التأكيدات | الحالة |
|---|---:|---|
| `test:char:credit` (ترقيم + سعة + دقّة) | 46 | ✅ **جديد** |
| `test:char:debit` | 46 | ✅ **جديد** |
| `test:gm:credit` (القديم مقابل الجديد + توصيف العيوب) | 54 | ✅ **جديد** |
| `test:gm:debit` | 50 | ✅ **جديد** |
| `test:svc:credit` (idempotency · allocation · atomicity · tenant · failure) | 142 | ✅ **جديد** |
| `test:svc:debit` | 142 | ✅ **جديد** |
| **الإجمالي (`test:phase7:notes`)** | **480** | ✅ |

مسار الترحيل الكامل الآن (`npm run test:migration`): **1364 تأكيداً · صفر فشل**.

**المجموعات القائمة:** `test:calc` 27 ✅ · `test:pdf` 102 ✅ · `test:ai` 165 ✅ ·
`test:proxy` 36 ✅ · `lint` نظيف ✅ — لم يتغيّر أي منها.

## عيوب — الحالة بعد Phase 7 Step D

**خمسة عيوب جديدة مُوثَّقة، صفر إصلاح على المسار الحيّ:**
**BUG-010** الإشعار يصدر بلا قيد عند غياب حساب (رصيد الطرف يتغيّر والدفتر لا) ·
**BUG-011** ترقيم مكرَّر ومُعاد استخدامه · **BUG-012** ضياع تحديث على الفاتورة المصدر ·
**BUG-013** تجاوز الإشعار الثاني ⇒ ذمّة سالبة · **BUG-014** استبعاد الفاتورة المُلغاة
بالكامل بما فيها المدفوع (توصيف فقط بأمر صريح).

الخدمتان الموازيتان **لا تُعيدان إنتاج** BUG-010…013 — وهذا **ليس إصلاحاً**:
المسار الحيّ كما هو تماماً. BUG-014 خارج نطاق الخدمة أصلاً.
