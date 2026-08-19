# PROJECT HANDOFF

> ⚠️ لا تعتمد على ذاكرة محادثة. هذا الملف + `MIGRATION_CONTEXT.md` +
> `MIGRATION_STATUS.md` + `MIGRATION_PLAN.md` كافية لمتابعة العمل من الصفر.
>
> ⚠️ **ملاحظة تسمية:** يوجد `HANDOFF.md` آخر في جذر المستودع — وهو خاص بمشروع
> **Academy** ولا علاقة له بترحيل ERP. هذا الملف (`docs/HANDOFF.md`) هو المرجع.

## Date
2026-08-19 (Phase 5 — Golden Master الأرصدة)

## Current Branch
`feat/ai-invoice-system-v2` — مدفوع ومتزامن مع `origin`.

## Current Commit
هذا الإيداع نفسه — `test(gm): Phase 5 — Golden Master دفتر الأستاذ وميزان
المراجعة وأرصدة الأطراف`. شغّل `git log -1 --oneline` للهاش الفعلي (لا
يُكتب هنا حرفياً لتفادي مرجعية ذاتية — هذا الملف جزء من الإيداع الذي يصفه،
تماماً كما كانت `9cd3e07` أدناه سابقاً بالنسبة لإيداع Phase 4).
**سلف مباشر:** `295d758` — `docs: نقطة تسليم — تجهيز المشروع للمتابعة من جهاز آخر`
(وهو نفسه إيداع تال لـ`9cd3e07` — Phase 4 الأصلية).

## Current Tag
`migration/baseline` — خط الأساس قبل الترحيل (مدفوع). **لم يتغيّر في Phase 5.**

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
| 5 · Golden Master — دفتر الأستاذ · ميزان المراجعة · أرصدة الأطراف | ✅ **مكتملة الآن** |
| 6 · خدمات الأعمال | 🔴 لم تبدأ |
| 7 · أساس React | 🔴 لم تبدأ |
| 8+ · ترحيل الوحدات | 🔴 لم تبدأ |

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
PROJECT_AUDIT.md · ARCHITECTURE_PROPOSAL.md · MIGRATION_PLAN.md · MIGRATION_STATUS.md
ACCOUNTING_INTEGRITY_AUDIT.md · ACCOUNTING_INTEGRITY_FIX_PLAN.md
BUGS_TO_FIX.md · PRODUCTION_ISSUES.md · DEAD_CODE_CANDIDATES.md
```

## Files Modified
- `package.json` — سكربتات اختبار فقط (11 سكربت Phase 5 جديد)، لا اعتماديات.
- `tests/characterization/legacy-loader.mjs` — **[Phase 5]** إضافيّتان بحتتان،
  0 تغيير سلوكي على أي مطابقة كانت تنجح من قبل (مُتحقَّق منه: 228/228 من
  Phase 4 بقيت خضراء): (1) `extractFunction` تدعم الآن نمط `window.name =
  function(...)` كاحتياطي بعد النمط الأصلي. (2) `extractConst` تدعم الآن
  ثوابت مصفوفية (`[...]`) لا كائنية (`{...}`) فقط — كانت تلتقط بصمت العنصر
  الأول فقط من أي ثابت مصفوفي (`DEFAULT_ACCOUNTS`) دون رمي استثناء.
- `MIGRATION_STATUS.md` · `ACCOUNTING_INTEGRITY_AUDIT.md` (§9 جديد) ·
  `ACCOUNTING_INTEGRITY_FIX_PLAN.md` (§9 جديد) · `BUGS_TO_FIX.md`
  (BUG-005/006/007) · `docs/accounting/golden-master.md` (§17 محدَّثة + §19–26 جديدة).

## Production Files
🔒 **لم تتغيّر إطلاقاً.** لا ملف واحد في `public/`. مُتحقَّق منه آلياً قبل كل
إيداع من المراحل الأربع.

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

**لم يُغيَّر أي سلوك محاسبي — Phase 4 وPhase 5 معاً.**

## Architecture

**المبنيّ فعلاً:**
```
الواجهة القديمة (تعمل كما هي)  ──→  Firebase RTDB     ← المسار الحيّ اليوم

src/domain/       نقيّ · مختبَر · غير موصول           ← مبنيّ
src/repositories/ عقد + تنفيذان · غير موصول            ← مبنيّ
```

**المستهدف (لم يُبنَ بعد):**
```
Legacy UI / React → Application Services → Domain → Repository → RTDB
```
الناقص: **طبقة Application Services** (Phase 5) و**الوصل بالإنتاج** (Phase 6).

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
| 2 | الترحيل أربع كتابات غير ذرّية ⇒ قيد يتيم عند الفشل | 🔴 |
| 3 | لا Idempotency ⇒ نقر مزدوج يُنتج قيدين ⇒ احتمال سداد مرّتين | 🔴 |
| 4 | حراسة توازن القيد على الترويسة فقط (RTDB عاجزة بنيوياً عن جمع السطور) | 🔴 |
| 5 | دفتر الأستاذ وميزان المراجعة | ✅ **صار لهما شبكة أمان (Phase 5)** — الخطر بقي، الرصد تحسَّن |
| 6 | النطاق والمستودعات غير موصولة ⇒ نسختان من المنطق | 🟠 مخفّف: الاختبار التوصيفي كاشف انحراف |
| 7 | 5 اختبارات أمان حمراء (بوابة المشروع) — **فشل آمن لا ثغرة** | 🟠 |
| 8 | تعارضات iCloud داخل المستودع | 🟠 |
| 9 | **[Phase 5]** BUG-005: `tbCalcBalances`/`calcFSBalances` يختلفان على حركة سابقة للفترة غير مُعلَّمة — تقريران مختلفان لنفس البيانات | 🔴 |
| 10 | **[Phase 5]** BUG-007: قيد مكرَّر يظهر في ميزان المراجعة بينما رصيد الطرف يبقى "صحيحاً" — تناقض صامت بين شاشتين، يرفع إلحاح إصلاح §3/§5 في `ACCOUNTING_INTEGRITY_FIX_PLAN.md` | 🔴 |
| 11 | **[Phase 5]** BUG-006: `ensureStdAccount` غير Idempotent تحت تزامن — قد يُنشئ حسابين قياسيين بنفس الرمز | 🔴 |
| 12 | **[Phase 5]** لا فحص اتّساق دوري بين دفتر الأستاذ والمستندات — يجعل 9/10/11 غير قابلة للاكتشاف تلقائياً في الإنتاج | 🔴 |

## Known Bugs
`BUGS_TO_FIX.md`:
- **BUG-001** إزاحة التاريخ (UTC بدل محلي) — 188 تكراراً في 182 سطراً (Phase 5: مصدران إضافيان مؤكَّدان في `calcCustomerBalance`/`calcVendorBalance`)
- **BUG-002** حجز رمز الحساب لا يُحرَّر عند الحذف ⇒ الرمز يُحرق للأبد
- **BUG-003** `saveInvItem` مُعرَّفة مرتين بسلوكين مختلفين؛ الأولى ميتة
- **BUG-004** `createJournalForPMC` مكرّرة (متطابقة حرفياً)
- **BUG-005** [Phase 5] `tbCalcBalances`/`calcFSBalances` يختلفان على حركة سابقة للفترة غير مُعلَّمة افتتاحياً
- **BUG-006** [Phase 5] `ensureStdAccount` غير Idempotent تحت تزامن حقيقي
- **BUG-007** [Phase 5] قيد مكرَّر يظهر في ميزان المراجعة، لا في رصيد الطرف — تناقض صامت بين شاشتين

`PRODUCTION_ISSUES.md`: بوابة المشروع **P1** · غياب النسخ الاحتياطي **P0**

**لم يُصلَح أيٌّ منها عمداً — Phase 4 وPhase 5 معاً.**

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
npm run gm:perf              # خط أساس الأداء — تقرير أرقام لا اختبار نجاح/فشل

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

**Golden Master للأرصدة اكتمل (Phase 5).** الخطوتان المحتملتان التاليتان —
بانتظار قرار المالك، لا تُبدأ أيّهما بلا أمر:

**أ) استكمال Golden Master** — التغطية المؤجَّلة (`docs/accounting/golden-master.md`
§17): إشعار دائن/مدين · شهادة مقاول باطن · القيد اليدوي · تكاليف المشاريع ·
تدفّق كامل من فاتورة واحدة عبر القيد ← الدفتر ← الميزان (لا الأثر عبر
شاشتين فقط كما فعلت هذه الجولة).

**ب) البدء بخدمات الأعمال** (Phase 6 هنا / Phase 4 في `MIGRATION_PLAN.md`) —
نقطة ترحيل مركزية + `assertBalanced` حقيقية + Idempotency، **الآن مدعومة
بشبكة أمان أوسع بكثير** من التي كانت متوفّرة قبل هذه الجولة: أي إصلاح
للذرّية يمكن التحقّق من أثره على ميزان المراجعة ودفتر الأستاذ وأرصدة
الأطراف معاً، لا القيد المُنشَأ فقط.

**توصيتي:** (ب) — الفجوة الأخطر الآن ليست غياب التغطية بل **القابلية
للاستغلال**: BUG-005/006/007 كلها تعتمد على غياب الذرّية/Idempotency
الأصلي (Phase 4 §8). إصلاحه يُغلق ثلاثتها معاً، بينما (أ) توسيع تغطية أفقي
لمجالات أصغر أثراً مالياً (شهادات المقاولين، الإشعارات).

## Exact Resume Point

**Resume from Phase 6 (خدمات الأعمال) — أو Phase 5 استكمال، حسب قرار المالك.**

أول ما يُفعل بغضّ النظر عن القرار:
1. اقرأ `docs/accounting/golden-master.md` §17–§26 (الفجوات والاكتشافات) و`ACCOUNTING_INTEGRITY_FIX_PLAN.md §9`
2. شغّل `npm run test:gm:all && npm run test:domain` — يجب أن تكون خضراء (326 = 201+125)
3. اقرأ `BUGS_TO_FIX.md BUG-005/006/007` كاملة قبل أي عمل على الذرّية — أثرها الآن موثَّق على مستوى التقارير لا الكتابات فقط

**إن اختير (ب):** ابدأ بـ`ACCOUNTING_INTEGRITY_FIX_PLAN.md §3` (الذرّية) —
نقطة الترحيل المركزية أولاً، ثم `assertBalanced` (§2)، ثم Idempotency (§5).
كل تغيير يُقاس بـ`npm run test:gm:all` قبل وبعد — أي فرق في نتيجة أي
اختبار **موصوف بما فيه المعيب** (مثل [B] في `posting-integrity.test.mjs`
أو [الأثر المالي المتباين] في `idempotency.test.mjs`) هو **الهدف المقصود**
لا انحداراً — تلك الاختبارات صُمِّمت لتفشل بعد الإصلاح، لا لتبقى خضراء.

**سؤالان مفتوحان بانتظار قرار المالك:**
- (أ) أم (ب) أعلاه؟
- `ensureStdAccount` تُنشئ حسابات في الشجرة كأثر جانبي للترحيل بلا موافقة،
  وقد ثبت في Phase 5 أنها قد تُنشئ **نسختين** بنفس الرمز تحت تزامن (BUG-006) —
  يبقى التصميم أم يتحوّل إلى اقتراح يتطلّب تأكيداً + قفل تفاؤلي يمنع BUG-006؟
