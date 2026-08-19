# MIGRATION_STATUS.md — حالة الترحيل

**آخر تحديث:** 2026-08-19 (Phase 5 — Golden Master الأرصدة) · **المرجع:** [`docs/HANDOFF.md`](docs/HANDOFF.md)
**آخر تحديث سابق:** 2026-08-19 (تسليم) · **الفرع:** `feat/ai-invoice-system-v2` (مدفوع) · **الوسم:** `migration/baseline`

## المراحل

| # | المرحلة | الحالة |
|---|---|---|
| 0 | التدقيق (Audit) | ✅ مكتمل |
| 1 | السلامة وخط الأساس | ✅ مكتمل |
| 2 | استخلاص النطاق المحاسبي | 🟡 جارٍ — شجرة الحسابات فقط (6 وحدات متبقّية) |
| 3 | طبقة Repository | 🟡 جارٍ — شجرة الحسابات فقط |
| 4 | Golden Master — بناء القيود وسلامة الترحيل | ✅ مكتمل (103 تأكيداً) |
| 5 | Golden Master — دفتر الأستاذ · ميزان المراجعة · أرصدة الأطراف | ✅ **مكتمل هذا التحديث** (98 تأكيداً — انظر §الأرصدة أدناه) |
| 6 | خدمات الأعمال (Application Services) | 🔴 لم تبدأ |
| 7 | أساس React | 🔴 لم تبدأ |
| 8+ | ترحيل الوحدات | 🔴 لم تبدأ |

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
| فواتير المبيعات · المشتريات | 🔴 قديم | Legacy |
| سندات القبض · الصرف | 🔴 قديم | Legacy |
| المخزون · المخازن | 🔴 قديم | Legacy |
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
| `domain/accounting/posting` | 🔴 لم يبدأ (السلوك مُوثَّق — `ACCOUNTING_INTEGRITY_FIX_PLAN.md §3–5،9`) |
| `domain/accounting/ledger` | 🔴 الاستخلاص لم يبدأ · ✅ **السلوك موصَّف بالكامل** (`coaAccountOps` — Golden Master، `docs/accounting/ledger.md`) |
| `domain/accounting/trialBalance` | 🔴 الاستخلاص لم يبدأ · ✅ **السلوك موصَّف بالكامل** (`tbCalcBalances`/`calcFSBalances` — Golden Master، `docs/accounting/trial-balance.md`، BUG-005) |
| `domain/accounting/balances` | 🔴 الاستخلاص لم يبدأ · ✅ **السلوك موصَّف بالكامل** (`calcCustomerBalance`/`calcVendorBalance` — Golden Master، BUG-007) |
| `domain/accounting/validation` | 🔴 لم يبدأ |
| `calc.js` · `aiinvoice-engine.js` · `pdfeditor-engine.js` | ✅ نقيّة سابقاً |
| `application/` | 🔴 غير موجود |
| `repositories/` | 🔴 غير موجود |
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
— لم يتغيّر (Phase 5 لا تمسّ `public/`، فلا أثر على هذا الرقم).
مسار الترحيل الكامل الآن: 125 (`test:domain`) + 201 (`test:gm:all`) = **326 تأكيداً**.
التفصيل الكامل في [`docs/BASELINE.md`](docs/BASELINE.md) و[`docs/accounting/golden-master.md`](docs/accounting/golden-master.md).

## عيوب جديدة اكتُشفت في Phase 5

`BUGS_TO_FIX.md`: **BUG-005** (فجوة `tbCalcBalances`/`calcFSBalances`) ·
**BUG-006** (`ensureStdAccount` غير Idempotent تحت تزامن) · **BUG-007**
(قيد مكرَّر يظهر في ميزان المراجعة، لا يظهر في رصيد الطرف). **لم يُصلَح أيٌّ
منها عمداً** — نفس قاعدة Phase 4.
