# PROJECT HANDOFF

> ⚠️ لا تعتمد على ذاكرة محادثة. هذا الملف + `MIGRATION_CONTEXT.md` +
> `MIGRATION_STATUS.md` + `MIGRATION_PLAN.md` كافية لمتابعة العمل من الصفر.
>
> ⚠️ **ملاحظة تسمية:** يوجد `HANDOFF.md` آخر في جذر المستودع — وهو خاص بمشروع
> **Academy** ولا علاقة له بترحيل ERP. هذا الملف (`docs/HANDOFF.md`) هو المرجع.

## Date
2026-08-19

## Current Branch
`feat/ai-invoice-system-v2` — مدفوع ومتزامن مع `origin`.

## Current Commit
`9cd3e07` — `test(gm): Phase 4 — Golden Master وشبكة أمان المحاسبة`

## Current Tag
`migration/baseline` — خط الأساس قبل الترحيل (مدفوع).

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
| 4 · Golden Master | 🟡 جارية — بناء القيود وسلامة الترحيل |
| 5 · خدمات الأعمال | 🔴 لم تبدأ |
| 6 · أساس React | 🔴 لم تبدأ |
| 7+ · ترحيل الوحدات | 🔴 لم تبدأ |

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

## Files Created

```
src/domain/accounting/chartOfAccounts/   types · hierarchy · validation · index
src/repositories/                        contracts · firebase · memory
src/package.json                         { "type": "module" }
tests/characterization/                  legacy-loader · chartOfAccounts · date-behavior
tests/repositories/                      fakeRtdb · contract.suite · chartOfAccounts
tests/golden-master/                     capture · canonical · journal · posting-integrity · snapshots/
tests/fixtures/                          accounting/world.mjs · 3 ملفات JSON
docs/BASELINE.md · docs/domain/*.md · docs/accounting/golden-master.md
PROJECT_AUDIT.md · ARCHITECTURE_PROPOSAL.md · MIGRATION_PLAN.md · MIGRATION_STATUS.md
ACCOUNTING_INTEGRITY_AUDIT.md · ACCOUNTING_INTEGRITY_FIX_PLAN.md
BUGS_TO_FIX.md · PRODUCTION_ISSUES.md · DEAD_CODE_CANDIDATES.md
```

## Files Modified
`package.json` — **سكربتات اختبار فقط**، لا اعتماديات. لا شيء غيره.

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
| الترحيل والتكرار والفشل الجزئي | ✅ **مُحلَّل وموثّق** (لم يُصلَح) |
| دفتر الأستاذ | 🔴 **لم يُغطَّ** |
| ميزان المراجعة | 🔴 **لم يُغطَّ** |
| أرصدة العملاء والموردين | 🔴 **لم تُغطَّ** |
| إشعارات دائن/مدين · شهادة مقاول باطن · القيد اليدوي | 🔴 لم تُغطَّ |

**لم يُغيَّر أي سلوك محاسبي.**

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
| 5 | دفتر الأستاذ وميزان المراجعة بلا شبكة أمان | 🔴 |
| 6 | النطاق والمستودعات غير موصولة ⇒ نسختان من المنطق | 🟠 مخفّف: الاختبار التوصيفي كاشف انحراف |
| 7 | 5 اختبارات أمان حمراء (بوابة المشروع) — **فشل آمن لا ثغرة** | 🟠 |
| 8 | تعارضات iCloud داخل المستودع | 🟠 |

## Known Bugs
`BUGS_TO_FIX.md`:
- **BUG-001** إزاحة التاريخ (UTC بدل محلي) — 188 تكراراً في 182 سطراً
- **BUG-002** حجز رمز الحساب لا يُحرَّر عند الحذف ⇒ الرمز يُحرق للأبد
- **BUG-003** `saveInvItem` مُعرَّفة مرتين بسلوكين مختلفين؛ الأولى ميتة
- **BUG-004** `createJournalForPMC` مكرّرة (متطابقة حرفياً)

`PRODUCTION_ISSUES.md`: بوابة المشروع **P1** · غياب النسخ الاحتياطي **P0**

**لم يُصلَح أيٌّ منها عمداً.**

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
npm run test:gm            # 74 · Golden Master القيود
npm run test:gm:posting    # 29 · سلامة الترحيل
npm run test:gm:all        # الاثنان معاً

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
**استكمال Phase 4** — جولة Golden Master ثانية تغطّي `calcFSBalances` ← دفتر
الأستاذ ← ميزان المراجعة ← أرصدة العملاء والموردين.

**السبب:** ميزان المراجعة هو **بوابة القبول** لأي إصلاح لاحق. إصلاح الذرّية
(Phase 5) بلا شبكة أمان عليه يخالف المبدأ المتّفق عليه.

**لا تبدأها بلا أمر.**

## Exact Resume Point

**Resume from Phase 4 (continuation).**

أول ما يُفعل:
1. اقرأ `docs/accounting/golden-master.md` §17 (الفجوات) و`ACCOUNTING_INTEGRITY_FIX_PLAN.md`
2. شغّل `npm run test:gm:all && npm run test:domain` — يجب أن تكون خضراء (228)
3. التقط `calcFSBalances` بتوسيع `tests/golden-master/capture.mjs`
4. ثم دفتر الأستاذ ← ميزان المراجعة ← أرصدة الأطراف

**سؤالان مفتوحان بانتظار قرار المالك:**
- هل يُستكمل Golden Master للميزان والأرصدة قبل Phase 5؟ (توصيتي: نعم)
- `ensureStdAccount` تُنشئ حسابات في الشجرة كأثر جانبي للترحيل بلا موافقة —
  يبقى أم يتحوّل إلى اقتراح يتطلّب تأكيداً؟
