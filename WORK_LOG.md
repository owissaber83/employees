# WORK_LOG — سجل العمل (لاستكمال العمل من أي جهاز)

آخر تحديث: 2026-07-14 · آخر commit مرجعي: `c2d39c7`

> اقرأ هذا الملف عند الاستكمال على جهاز آخر. الكود كله على `main` في GitHub
> (`git pull origin main` أولاً). هذا الملف ملخّص سياق — التفاصيل في الـcommits.

---

## ⏳ إجراءات معلّقة (افعلها أولاً)

- **نشر قواعد قاعدة البيانات** — `database.rules.json` عُدِّل ولم يُنشر بعد. النشر التلقائي (GitHub Actions) ينشر **الاستضافة فقط**. شغّل مرة واحدة:
  ```bash
  firebase deploy --only database
  ```
  بدونه: (1) حفظ باقة العميل من لوحة المشغّل (`meta/modules`) يفشل، (2) تشديد أمان المجموعات الحساسة لا يُفعَّل. باقي النظام يعمل بالافتراضات (كل الأقسام ظاهرة).

---

## ما أُنجز في هذه الجولة (كله على `main`)

### الموارد البشرية — مقابل المنافسين (اكتمل)
- **[HR-GOSI]** (app.js): محرّك تأمينات آلي (سعودي 9.75%/11.75% · غير سعودي 2% شركة) على أساس (أساسي+سكن، حد 1500–45000). أسلوب آمن: يعكس المبلغ إلى نسبة مكافئة من الأساسي دون تغيير معادلة المسير. زر فردي + مودال جماعي. النِسَب في `ledger/settings/gosi`.
- **Timesheets** (timesheets.js): كان موجوداً — أُضيف فقط **توليد الأوقات من الحضور** (`tsOpenAttImport`) مع منع تكرار عبر `source:'attendance'`+`attKey`.
- **recruitment.js** (جديد): ATS كامل — شواغر/مرشّحون بمراحل/مقابلات + قوائم تعيين وإخلاء طرف + تحويل مرشّح لموظف. صفحة `pg-recruitment`.
- **hr-extra.js** (جديد): سجل الجزاءات والإنذارات (`pg-disciplinary`) + الهيكل التنظيمي (`pg-orgchart`) المشتقّ من الإدارات والموظفين.

### الموجة الثانية (فجوات المقارنة المتبقية)
- **[HR-ESS]** (app.js): الخدمة الذاتية للموظف — أُعيد تصميمها كـ**تطبيق جوال** (إطار 460px، ترويسة متدرّجة، ٥ تبويبات: 🏠 الرئيسية · 🌴 إجازة · 🕘 إذن · 💰 الراتب · 📁 ملفّي). تعرض: حضور/انصراف، أرصدة وطلبات الإجازات والأذونات، القسائم، السلف، مكوّنات الراتب، المستندات (بتنبيهات انتهاء)، العُهد، وتقديم مصروفات. الدوال: `renderSelfService`, `essSubmit{Leave,Perm,Expense}`, `essViewPayslip`.
- **shifts.js** (جديد): تعريف ورديات + إسناد (`roster`) + تحليل التأخير (حضور فعلي مقابل بداية الوردية+سماح). صفحة `pg-shifts`.
- **leave-policies.js** (جديد): سياسات إجازات تُطبَّق على حقول الموظف عند الإسناد (أسلوب آمن). صفحة `pg-leavepolicies`.
- **biometric-import.js** (جديد): استيراد ملف بصمة Excel/CSV (كشف أعمدة مرن، مطابقة بالرقم/الاسم، تجميع أول=دخول/آخر=خروج، معاينة). زر في بطاقة إدارة الحضور. المنطق القابل للاختبار: `bioBuildRows(arr)`.
- **إصلاح:** الأذونات المعلّقة لم تكن تظهر في الجرس/صندوق الموافقات — أُضيفت. وأنواع الإذن في ESS صُحّحت لمفاتيح `PERM_TYPES` الرسمية.

### التجهيز للبيع (Go-to-market)
- **[MODULES]** (app.js): باقات يتحكم بها **المالك** لكل عميل. `MODULE_DEFS` (٨ وحدات) → مجموعات القائمة. تُخزَّن في `tenants/{tid}/meta/modules`، تُقرأ عند الدخول → `window.appModules`. `applyModuleVisibility()` تُخفي المعطّل للجميع. **حارس nav()**: `buildPageModuleMap()`+`isPageModuleEnabled()` يمنع الوصول لصفحات الوحدات المعطّلة من أي مسار. لوحة المشغّل: زر «🧩 الأقسام» → `opsOpenModules`/`opsSaveModules` (مع زرّي باقة: «HR+مشاريع تشغيلي» و«مقاولات مالية»).
- **وضع الموظف الخالص** (app.js initApp): دور `employee` → إخفاء الشريط الجانبي والعلوي كليًّا والفتح مباشرة على ESS (تطبيق خالص) + زر خروج داخل الترويسة.
- **[EMP-INVITE]** (app.js): زر «📲 دعوة للتطبيق» بكل موظف (للمدير) — يُنشئ حساب Auth بدور `employee` عبر مصادقة ثانوية، يربط `userIndex` + `emp.email/userId`، ويولّد رابطاً ورسالة واتساب جاهزة. `inviteEmployee`/`doInviteEmployee`/`essShowShare`.

### ترقية الصلاحيات
أُضيفت ٥ صلاحيات: `view_recruitment`, `view_disciplinary`, `view_org_chart`, `manage_shifts`, `manage_leave_policies` — في مصفوفة الصلاحيات (PG) + `pm` + إخفاء القائمة + preset `hr_officer` (والمدير عبر `ALL_P`).

---

## مجموعات بيانات جديدة (تحت `ledger/*`)
`jobPostings` · `candidates` · `onboardings` · `disciplinary` · `shifts` · `roster` · `leavePolicies` · (وإعداد `settings/gosi` + `tenants/{tid}/meta/modules`)

قواعد الأمان (database.rules.json): المجموعات الحساسة (disciplinary/candidates/jobPostings/onboardings) = admin/hr_officer قراءة+كتابة. (shifts/roster/leavePolicies) = قراءة للأعضاء، كتابة admin/hr_officer. **ملاحظة:** `leaves`/`permissions`/`attendance` تُركت مفتوحة (ESS يحتاج كتابة الموظف) — التحسين اللاحق: قصر كتابة الموظف على سجله فقط.

---

## أفكار للاستكمال (لم تُنفَّذ)
- إشعارات داخل التطبيق للموظف عند اعتماد/رفض طلبه.
- دعوة جماعية لكل الموظفين دفعة واحدة.
- تشديد `leaves`/`permissions`/`attendance` بمطابقة `empKey` مع الحساب.
- وحدات HR إضافية: تدريب · تذاكر سفر.
- لوحات/تقارير HR أقوى (دوران، تحليلات).

---

## تذكيرات تقنية (من CLAUDE.md)
- لا build/bundler — `public/` تُخدَم كما هي. عند تعديل ملف JS **بمّط `?v=` في index.html**.
- الملفات الثانوية (recruitment/hr-extra/shifts/leave-policies/biometric-import/timesheets .js) تعتمد على globals من app.js عبر `window`.
- التنقّل السريع في app.js/accounting.js عبر أكواد الأقسام: ابحث `[HR-ESS]` `[MODULES]` `[EMP-INVITE]` `[HR-GOSI]`.
- سير git: `git pull` قبل البدء، فرع للميزة، دمج ff في main، `git push` (النشر تلقائي للاستضافة).
