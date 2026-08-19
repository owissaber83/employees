# ميزان المراجعة — `tbCalcBalances` (Phase 5)

> توصيف سلوك قائم. لا يُغيَّر شيء هنا. `docs/accounting/golden-master.md` §17
> يُحدَّث بإغلاق الفجوة رقم 1 جزئياً (دفتر الأستاذ وميزان المراجعة).

## الموقع والتوقيع

`public/accounting.js:11754` — `function tbCalcBalances()`. **بلا معاملات** —
تقرأ حالة عامة `let tbState` (سطر 11742) بدل استقبال باراميترات، خلافاً لـ
`calcFSBalances(fromDate, toDate, statuses, costCenter, projectId)`.

```js
let tbState = {
    fromDate: '', toDate: '', includeStatuses: ['posted'],
    showZero: false, groupBy: 'type', costCenter: '', projectId: ''
};
```

## المدخلات (Inputs)

| المصدر | الحقل |
|---|---|
| `window.chartOfAccounts` | كل الحسابات — تُستبعَد الحسابات `nature==='header'` من الحساب المباشر |
| `window.journalEntries` | كل القيود، تُصفَّى بـ`tbState.includeStatuses` |
| `tbState.fromDate/toDate` | حدود الفترة |
| `tbState.costCenter/projectId` | فلترة على مستوى السطر (تحتاج `ccLineMatchesProject`) |
| `tbState.showZero` | إظهار/إخفاء الحسابات بلا حركة |

## الخوارزمية (كما تُنفَّذ فعلياً)

1. لكل حساب غير-header: `{opening: account.openingBalance, debit:0, credit:0}`.
2. لكل قيد ضمن `includeStatuses`: إن `fsIsOpeningEntry(e)` تُطوى حركته في
   `opening` مباشرةً (`b.opening += debit - credit`)؛ وإلا إن كان تاريخه
   `< fromDate` **يُستبعَد القيد كلياً** (🔴 انظر أدناه)؛ وإلا يُضاف لـ`debit`/`credit`.
3. `netBalance = opening + debit - credit`.
4. `finalDebit`/`finalCredit`: عمود واحد فقط يُملأ حسب إشارة `netBalance`.
5. `isAnomaly`: `true` إذا انعكست إشارة الرصيد عن الطبيعة المتوقّعة لنوع الحساب
   (مصروف/أصل يُفترض موجباً، خصم/حقوق/إيراد يُفترض سالباً بعد الحساب الداخلي).
   **إشارة عرض فقط — لا تمنع شيئاً ولا تُفرَض في القاعدة.**

## 🔴 BUG-005 — فجوة بين `tbCalcBalances` و`calcFSBalances`

قيد بتاريخ سابق للفترة **وغير مُعلَّم افتتاحياً** (`sourceType !== 'opening'`):

| المحرّك | السلوك |
|---|---|
| `calcFSBalances` | يُطوى في `beforeDebit/beforeCredit` ⇒ يدخل ضمن `periodOpening` |
| `tbCalcBalances` | **يُستبعَد بالكامل** — لا افتتاحي ولا حركة |

مُثبَت تنفيذياً في `tests/golden-master/trial-balance.test.mjs` §[Y].
**الأثر:** ميزان مراجعة لفترة تبدأ منتصف السنة (fromDate مضبوط) قد يستبعد
حركات سابقة حقيقية لم تُعلَّم افتتاحياً — بينما قائمة الدخل/المركز المالي
المبنيّان على `calcFSBalances` يطويانها بصمت في الرصيد الافتتاحي. **نفس
البيانات، تقريران مختلفان.** مُسجَّل في `BUGS_TO_FIX.md` — لا يُصلَح في Phase 5.

## علاقتها بـ`coaBalanceRows`

`coaBalanceRows` (سطر 1088) هي التي تُنتج التجميع **الهرمي** (حساب أب يجمع
فروعه) — وهي تستدعي `calcFSBalances` لا `tbCalcBalances`. الدالتان مستقلّتان
تماماً ولا تتشاركان منطقاً؛ هذا سبب إضافي لوجود BUG-005 — أي إصلاح مستقبلي
يجب أن يوحّد المصدر لا أن يُرقِّع كل دالة على حدة (Phase 7+، ليس الآن).

## الدقّة المالية

لا تقريب داخلي (`Math.round`) في أي مرحلة من `tbCalcBalances` — القيم تُمرَّر
كما هي من `line.debit`/`line.credit`. التقريب يحدث فقط عند **بناء** القيد
(`accounting.js` مسارات الإنشاء السبعة) أو عند **العرض** (`fmt()`). مُثبَت في
`tests/golden-master/precision.test.mjs`.

## الأداء

قياس خطّي واضح (`tests/golden-master/perf-baseline.mjs`، Node، بيانات مُصنَّعة):
100 قيد ≈ 0.02ms · 1,000 ≈ 0.14ms · 10,000 ≈ 1.8ms لكل استدعاء. لا انفجار
تربيعي عند هذا الحجم.

## التغطية

`tests/golden-master/trial-balance.test.mjs` — 17 تأكيداً: حساب بلا حركة ·
حركة مدين/دائن/مختلطة · رصيد افتتاحي + قيد افتتاحي صريح · حساب أب مقابل
`coaBalanceRows` · أنواع الحسابات و`isAnomaly` · فجوة BUG-005.
