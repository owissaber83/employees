# الأرصدة — `calcFSBalances` والمعمارية العامة (Phase 5)

> توصيف سلوك قائم. لا يُغيَّر شيء هنا. راجع أيضاً: `docs/accounting/trial-balance.md`
> (`tbCalcBalances`) · `docs/accounting/ledger.md` (`coaAccountOps`) ·
> `docs/accounting/customer-balances.md` · `docs/accounting/supplier-balances.md`.

## لماذا `calcFSBalances` هي نقطة البداية (وليست الهدف الوحيد)

طُلب البدء بـ`calcFSBalances` لأنها — كما تبيَّن فعلياً بعد القراءة — **محرّك
مشترك** تستهلكه `coaBalanceRows` (كشف الأرصدة الهرمي) وقائمة الدخل
(`buildIncomeStatement`) والمركز المالي (`buildBalanceSheet`) وتحليل
القطاعات (`segIncome`). **لكنها ليست** الدالة المُستخدَمة فعلياً لميزان
المراجعة المخصَّص (تلك `tbCalcBalances`، مستقلّة تماماً — انظر
`trial-balance.md` لفجوة BUG-005 بينهما) ولا لدفتر الأستاذ لحساب واحد (تلك
`coaAccountOps`، مستقلّة أيضاً). لهذا وُثِّقت الأربع بمستندات منفصلة بدل
معاملتها كدالة واحدة بأربعة أسماء.

## الموقع والتوقيع

`public/accounting.js:23169` —
`function calcFSBalances(fromDate, toDate, statuses, costCenter, projectId)`.

## المدخلات

| | |
|---|---|
| `window.chartOfAccounts` · `window.journalEntries` | الحالة الأساسية |
| `fromDate`/`toDate` | حدود الفترة (نصّية `YYYY-MM-DD`) |
| `statuses` | مصفوفة — أي حالات قيد تُحتسَب (`['posted']` عادة) |
| `costCenter`/`projectId` | فلترة **حسابات الإيراد/المصروف فقط** — لا تؤثّر على الأصول/الخصوم |

## التخزين المؤقّت — `_fsBalancesCache`

متغيّر وحدوي (`let _fsBalancesCache`) يُبطَل تلقائياً بمجرّد تغيّر **مرجع**
`window.journalEntries` أو `window.chartOfAccounts` (لا محتواهما — مقارنة
`!==` على المرجع). ثم يُخزَّن الناتج بمفتاح مركَّب من كل المعاملات.

**مُتحقَّق منه فعلياً لا مفترَضاً** (`tests/golden-master/multi-tenant.test.mjs`):
تمرير **نفس مرجع الكاش** بين استعلامين بمرجعَي `journalEntries` مختلفين
(محاكاة أسوأ سيناريو تبديل مستأجر) **لا يُسرِّب** نتيجة الاستعلام الأول —
فحص المرجع كافٍ وحده. هذا يعني أن سلامة الكاش عبر تبديل المستأجرين تعتمد
كلياً على أن `onValue` يُعيد بناء `window.journalEntries` ككائن جديد مع كل
لقطة (لا التعديل في مكانه) — وهذا مضمون فعلاً في نمط Firebase RTDB القياسي.

## الحساب الأساسي

لكل حساب: `opening` (ثابت الحساب) + `beforeDebit/beforeCredit` (حركات
سابقة على `fromDate` أو مُعلَّمة افتتاحياً) → `periodOpening`. ثم
`periodDebit/periodCredit` (حركات داخل الفترة) → `closing`. `naturalOpening`/
`naturalClosing`/`naturalMovement` تعكس الإشارة للحسابات الدائنة الطبيعة
(خصوم/حقوق/إيرادات) كي يظهر رصيد موجب منطقياً في العرض.

**لا تقريب داخلي** — نفس ملاحظة `tbCalcBalances` (`precision.test.mjs`).

## الأداء

قياس خطّي واضح، بلا انفجار تربيعي حتى 10,000 قيد
(`tests/golden-master/perf-baseline.mjs`). **مع ميزة إضافية**: التخزين
المؤقّت يجعل الاستدعاءات المتكرّرة بنفس المعاملات فورية تقريباً — قيمة عملية
حقيقية لصفحة تعرض نفس الفترة في عدة تبويبات متزامنة (قائمة الدخل + المركز
المالي + كشف الأرصدة قد تستدعيها جميعاً بنفس `fromDate/toDate`).

## التغطية

مُختبَرة ضمن `tests/golden-master/multi-tenant.test.mjs` (سلامة الكاش) و
`tests/golden-master/trial-balance.test.mjs §[Y]` (الفجوة مقابل `tbCalcBalances`)
و`tests/golden-master/precision.test.mjs` (الدقّة). لا ملف مخصَّص منفرد لها —
سلوكها الأساسي (فتح/إغلاق الفترة، الرصيد الافتتاحي) مطابق لما اختُبر في
`trial-balance.test.mjs` مع فارق BUG-005 الموثَّق.
