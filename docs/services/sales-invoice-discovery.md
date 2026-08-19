# اكتشاف مسار ترحيل فاتورة المبيعات — Phase 7 Step C

> **الحالة:** اكتشاف مكتمل · لا تعديل واحد على الشفرة القديمة.
> **المصدر الوحيد:** قراءة `public/accounting.js` الحيّ (لا افتراض من التعليمات).

## 1. المواقع الفعلية المُتحقَّق منها

| الدالة | الموقع | ملاحظة |
|---|---|---|
| `postSInv` | `public/accounting.js:16650` (`window.postSInv`) | نقطة الدخول من الواجهة |
| `createJournalForSInv` | `public/accounting.js:16511` | تُصدَّر `window.createJournalForSInv` (:13960) |
| `createInventoryMovementsForSInv` | `public/accounting.js:21670` | تُستدعى **بعد** كتابة الحالة |
| `ensureStdAccount` | `public/accounting.js:16497` | تُنشئ الحساب القياسي الناقص |
| `custReceivableAccount` | `public/accounting.js:13176` | 1130 أو حساب المجموعة |
| `arApMode` | `public/accounting.js:13172` | `'aggregate'` افتراضاً |
| `baseCurrencyCode` | `public/accounting.js:3461` | `'SAR'` افتراضاً |
| `generateJrnNumberAtomic` | `public/accounting.js:3364` | معاملة على `ledger/counters/jrn/{prefix}/{year}` |
| `generateInvMovNumberAtomic` | `public/accounting.js:20342` | معاملة على `ledger/counters/invmov/{type}/{year}` |
| `calcInvItemMovingAvg` | `public/accounting.js:20394` | المتوسط المرجّح المتحرّك — أساس تكلفة الخروج |
| `calcInvItemBalance` | `public/accounting.js:20367` | فحص كفاية الرصيد (**تنبيه فقط**) |
| `unpostSInv` | `public/accounting.js:16695` | خارج نطاق Step C — للتوثيق فقط |

**مستدعو `createJournalForSInv` الثلاثة:**
1. `postSInv` (:16676) — ترحيل مسودة (نطاق Step C).
2. `saveSInv` — الحالة العادية (:15919) — حفظ+ترحيل في خطوة واحدة.
3. `saveSInv` — تعديل فاتورة **مرحّلة** (:15858) — قيد جديد + إلغاء القديم.

> Step C يستهدف (1) فقط. (2) و(3) موثَّقان هنا لأنهما يشتركان في نفس دالة البناء، فأي
> تغيير على البناء كان سيمسّهما — ولهذا لم يُغيَّر شيء في القديم.

## 2. جدول التتبّع الكامل

| Function | Input | Output | Reads | Writes | Accounting | Inventory | Tenant | Concurrency | Idempotency |
|---|---|---|---|---|---|---|---|---|---|
| `postSInv(key, silent)` | مفتاح الفاتورة | `undefined` (آثار جانبية) | `window.salesInvoices` · `window.customers` · `myP` · `curU` · `localStorage` (حد الاعتماد) | `salesInvoices/{k}` (needsApproval أو status/postedAt/postedBy) | غير مباشر عبر `createJournalForSInv` | غير مباشر عبر `createInventoryMovementsForSInv` | عبر غلاف `ref()` | 🔴 **لا قفل** — يقرأ الحالة من ذاكرة المتصفّح ثم يكتب | 🔴 **غير idempotent** — نافذة سباق كاملة |
| `createJournalForSInv(invKey, inv)` | مفتاح + كائن الفاتورة | `jrnRef` أو `undefined` | `window.chartOfAccounts` · `window.customers` · `cfg` · `DEFAULT_ACCOUNTS` | `push(R.jrn)` ثم `update(salesInvoices/{k})` — **كتابتان منفصلتان** | ✅ القيد كاملاً | ❌ لا شيء | عبر `ref()` | 🔴 كتابتان غير ذرّيتين | 🔴 كل استدعاء يُنشئ قيداً جديداً |
| `ensureStdAccount(code)` | رمز حساب | كائن الحساب أو `null` | `window.chartOfAccounts` (ذاكرة) · `DEFAULT_ACCOUNTS` | `push(R.coa)` عند الغياب | يُنشئ حساباً | ❌ | عبر `ref()` | 🔴 **BUG-006** — قراءة/كتابة بلا معاملة | 🔴 نداءان متزامنان ⇒ حسابان مكرّران |
| `custReceivableAccount(id)` | معرّف العميل | رمز حساب (نصّ) | `window.customers` · `window.chartOfAccounts` · `cfg` | لا شيء | حلّ حساب | ❌ | ❌ | ✅ نقيّة | ✅ |
| `generateJrnNumberAtomic(book)` | رمز الدفتر | رقم القيد | `window.journalEntries` (البذرة) | `runTransaction` على العدّاد | ترقيم | ❌ | عبر `ref()` | ✅ معاملة خادمية حقيقية | ⚠️ الرقم يُحرَق عند الفشل اللاحق |
| `createInventoryMovementsForSInv(k, inv)` | مفتاح + الفاتورة | `undefined` | `window.inventoryItems` · `window.inventoryMovements` · `window.warehouses` | `push(R.invmov)` × N + معاملة عدّاد × N | ❌ **لا قيد محاسبي إطلاقاً** | ✅ حركة خروج لكل سطر | عبر `ref()` | 🔴 N كتابة مستقلّة | 🔴 كل نداء يُنشئ N حركة جديدة |
| `calcInvItemMovingAvg(item, wh)` | معرّف الصنف | `{balance, avgCost, value, history}` | `inventoryItems` · `inventoryMovements` · `warehouses` | لا شيء | ❌ | تقييم | ❌ | ✅ نقيّة (على لقطة الذاكرة) | ✅ |
| `calcInvItemBalance(item, wh)` | معرّف الصنف | `{balance, avgCost, …}` | نفس ما سبق | لا شيء | ❌ | فحص كفاية — **تنبيه فقط، لا يمنع** | ❌ | ✅ نقيّة | ✅ |

## 3. مجموعة الكتابة الكاملة للترحيل الواحد

| # | المسار | الآلية في القديم | ذرّي مع غيره؟ |
|---|---|---|---|
| 1 | `ledger/counters/jrn/JV/{year}` | `runTransaction` | ✅ بذاته · ❌ مع الباقي |
| 2 | `ledger/journalEntries/{jid}` | `push` | ❌ |
| 3 | `ledger/salesInvoices/{k}/journalEntryKey` + `journalEntryNumber` | `update` منفصل | ❌ |
| 4 | `ledger/salesInvoices/{k}/status` + `postedAt` + `postedBy` | `update` منفصل | ❌ |
| 5 | `ledger/counters/invmov/out/{year}` × N | `runTransaction` × N | ✅ بذاته · ❌ مع الباقي |
| 6 | `ledger/inventoryMovements/{mid}` × N | `push` × N | ❌ |
| 7 | `ledger/chartOfAccounts/{new}` (0–6 حساب) | `push` من `ensureStdAccount` | ❌ |

**النتيجة:** ترحيل فاتورة بثلاثة أصناف = **3 + 2×3 = 9 عمليات كتابة/معاملة مستقلّة**،
أي 8 نقاط فشل تترك حالة جزئية.

## 4. الحسابات المطلوبة وترتيب استدعاء `ensureStdAccount`

| # | الرمز | الشرط | يُستدعى `ensureStdAccount`؟ |
|---|---|---|---|
| 1 | `custReceivableAccount(customerId)` (غالباً `1130`) | دائماً | نعم إن غاب |
| 2 | `1130` (رجوع ثانٍ) | إن فشل (1) | نعم |
| 3 | `inv.salesAccountCode ‖ '4100'` | دائماً | نعم إن غاب |
| 4 | `4100` (رجوع ثانٍ) | إن فشل (3) | نعم |
| 5 | `2140` | `vatTotal > 0` **فقط** | نعم |
| 6 | `1131` | `retentionAmount×fx > 0.005` | نعم |
| 7 | `2150` | `advanceRecoveryAmount×fx > 0.005` | نعم |

**أقصى عدد نداءات في ترحيل واحد: 6.** كل نداء = قراءة من `window.chartOfAccounts`
(لقطة ذاكرة يحدّثها `onValue`) ثم `push` إن غاب.

### إجابات §5 من التعليمات

1. **أي حسابات؟** الجدول أعلاه (1130/حساب المجموعة · 4100/`salesAccountCode` · 2140 · 1131 · 2150).
2. **متى؟** داخل `createJournalForSInv`، **بعد** بدء الترحيل وقبل بناء السطور.
3. **هل تُنشئ؟** نعم — `push(R.coa)` من `DEFAULT_ACCOUNTS`.
4. **هل الحساب متاح فوراً للنداء التالي؟** 🔴 **لا.** الدالة تعيد `rec` المحلّي، لكن
   `window.chartOfAccounts` لا تتحدّث إلا بعد وصول حدث `onValue`. نداءان متتاليان لنفس
   الرمز داخل نفس الترحيل ⇒ **حسابان**. (لا يقع فعلياً في هذا المسار لأن كل رمز يُطلب
   مرّة واحدة، لكن الخطر بنيوي.)
5. **هل يُمكن للترحيلات المتزامنة إنشاء مكرّرات؟** ✅ **نعم** — هذا هو BUG-006 حرفياً.
   شركة جديدة بلا 2140، ترحيل فاتورتين معاً ⇒ حسابا 2140.
6. **هل تستطيع الخدمة الجديدة حلّ الحسابات قبل الترحيل؟** ✅ نعم — عبر
   `ChartOfAccountsRepository.getByCode` قبل أي كتابة.
7. **هل يمكن فصل الإنشاء عن الترحيل؟** ✅ نعم.
8. **هل يمكن تضمين الإنشاء بأمان في الخدمة؟** ❌ **لا** — لا يوجد في المخطط الحالي
   قيد فرادة على `code` (المجموعة `ledger/chartOfAccounts` مفاتيحها push-ids، والرمز حقل
   عادي). ضمان الفرادة يحتاج مخططاً جديداً (فهرس `coaByCode/{code}`) — **وهو ممنوع
   صراحةً في §18**.
9. **هل يدعم المخطط الحالي حلاً ذرّياً؟** ❌ لا.

**القرار المُتَّخذ (لا اجتهاد، ولا مخطط جديد):** الخدمة الجديدة **لا تُنشئ حسابات
إطلاقاً**. تحلّ الموجود، وترفض الترحيل بـ`MissingAccountError` إن غاب حساب. لا مكرّرات
لأن لا إنشاء أصلاً. الإنشاء يبقى إجراءً بشرياً منفصلاً في شجرة الحسابات.
👈 فرق مُصنَّف **C — تحسين أمان مقصود** (موثَّق ومُختبَر).

## 5. القيد المحاسبي الفعلي (كما يبنيه القديم)

```
مدين   العملاء (1130 أو حساب المجموعة)   = (grandTotal − retention) × fx
مدين   محتجزات ضمان (1131)               = retentionAmount × fx        [إن > 0.005]
مدين   دفعات مقدمة من العملاء (2150)      = advanceRecoveryAmount × fx  [إن > 0.005]
دائن   الإيرادات (salesAccountCode ‖ 4100) = netBeforeTax × fx (+ فرق التقريب)
دائن   ضريبة المخرجات (2140)              = vatTotal × fx               [إن > 0]
```

- **إجمالي القيد** = `round2(grandBase + advBase)` — استرداد الدفعة سطر مدين **إضافي**
  خارج إجمالي الفاتورة (لأنه مطروح من الوعاء قبل الضريبة).
- **استرداد الدفعة لا يُطرح من ذمّة العميل** (تعليق صريح في القديم :16565).
- **تسوية التقريب** تُضاف إلى `lines[1]` (= سطر الإيراد) قبل الفرز.
- **الفرز النهائي:** كل المدين ثم كل الدائن — `sort` مستقرّ **بعد** التسوية.
- **العملة:** `fx = 1` إن كانت عملة الفاتورة = العملة الدفترية، وإلا `exchangeRate ‖ 1`.
- **حالات الحدّ:** غياب 2140 مع `vatTotal>0` ⇒ الضريبة **تُضمّ إلى الإيراد** (تنبيه صريح
  + `logAudit`) — إيراد منتفخ وإقرار ضريبي خاطئ، لكنه **سلوك قائم لا يُغيَّر في القديم**.

**لا حساب مخزون ولا حساب تكلفة بضاعة مباعة (COGS) في القيد — إطلاقاً.**
تُوثَّق هذه النتيجة صراحةً لأن التعليمات افترضت وجودهما: المشتريات تُصرَف مباشرة
لحساب مصروف (`debitAccountCode` في `createJournalForPInv`)، والمخزون يُتابَع كمّياً
وقيمياً في `ledger/inventoryMovements` فقط — نظام جرد **دوري** لا مستمر. أي إضافة قيد
COGS ستكون **تغييراً في السياسة المحاسبية** — ممنوع (§18).

## 6. حركة المخزون الفعلية

لكل سطر في `inv.lines`:
- يُتخطّى السطر إن: لا `itemId`، أو الصنف غير موجود، أو `item.type === 'service'`.
- `qty = parseFloat(line.qty) || 0` — **الكمّية صفر لا تُرفض؛ تُكتب حركة بكمّية 0.**
- فحص الرصيد: `qty > balance + 0.001` ⇒ **تنبيه فقط، لا يمنع الترحيل** (يسمح بالسالب).
- `unitPrice` (تكلفة الخروج) = `movingAvg.avgCost` إن > 0، وإلا `item.costPrice`، وإلا `line.unitPrice`، وإلا 0.
- `salePrice = line.unitPrice`.
- `warehouseId` **لا يُكتب إطلاقاً** — الحركة بلا مخزن؛ `whIdOfMovement` ترجعها للمخزن الرئيسي لاحقاً.
- `projectId = inv.projectId ‖ ''` · `reason: 'sale'` · `type: 'out'` ·
  `sourceType: 'sales_invoice'` · `sourceKey: invKey`.
- كل حركة تحصل على رقمها بمعاملة عدّاد مستقلّة (`OUT-{year}-{00001}`).
- **`try/catch` حول كل حركة يبتلع الخطأ** (`console.error` فقط) ⇒ فشل حركة واحدة يترك
  الفاتورة مرحّلة بحركات ناقصة، بصمت.

## 7. مخاطر التزامن والذرّية في القديم (توصيف لا إصلاح)

| # | الخطر | الأثر المالي |
|---|---|---|
| A | لا قفل حالة — `if (inv.status !== 'draft')` على لقطة ذاكرة | تبويبان ⇒ **قيدان + حركتا مخزون** لنفس الفاتورة (BUG-007) |
| B | القيد يُكتب قبل الحالة | فشل بينهما ⇒ قيد يتيم + فاتورة مسودة ⇒ ميزان مراجعة منتفخ |
| C | المخزون بعد الحالة | فشل ⇒ فاتورة مرحّلة بلا حركة مخزون |
| D | `ensureStdAccount` بلا معاملة | حسابات قياسية مكرّرة (BUG-006) |
| E | ابتلاع خطأ حركة المخزون | نقص صامت في المخزون |
| F | أرقام العدّادات تُحجز قبل النجاح | فجوات ترقيم عند الفشل (مقبول — نفس سلوك الجديد) |

## 8. الخلاصة — لا شرط توقّف من §24

- ✅ لا حاجة لتغيير مخطط: مسار `status` موجود ⇒ `runTransaction` يكفي لـIdempotency.
- ✅ القيد + الربط + كل حركات المخزون يمكن كتابتها في **`update` واحد متعدّد المسارات**
  (مفاتيح `push` تُولَّد محلّياً بلا كتابة) — ذرّية حقيقية لِما عدا العدّادات.
- ⚠️ العدّادات (`jrn` · `invmov`) تبقى معاملات منفصلة سابقة — تُحرق أرقام عند الفشل.
  حدّ موثَّق، مطابق لسلوك القديم، لا يمسّ صحّة الأرصدة.
- ✅ `ensureStdAccount` تُعزَل بالكامل: الخدمة لا تُنشئ حسابات (فرق C).
- ✅ لا قرار محاسبي معلّق يمنع التنفيذ (غياب COGS = سياسة قائمة تُحفَظ كما هي).
