# اكتشاف مسار الإشعار المدين — Phase 7 Step D

> **الحالة:** اكتشاف مكتمل · **لا سطر تنفيذ كُتب بعد** · الشفرة القديمة لم تُلمَس.
> **المرجع المشترك:** [`credit-note-discovery.md`](credit-note-discovery.md) — يحوي جدول
> التتبّع الموحّد وتحليل Idempotency والترقيم والقواعد. **هذا الملف يوثّق ما يخصّ
> الإشعار المدين وحده، وما يختلف فيه عن الدائن.** لم يُفترَض التماثل في أي نقطة.

## 1. المسار الفعلي

```
openDebitNote(key)            :16181   حارس: status==='posted' && !fullyDebited
      ↓ (المستخدم يحرّر كميات الإرجاع في DOM)
dnCompute(key)                :16211   ⚠️ يقرأ الكميات من DOM مباشرةً
      ↓
submitDebitNote()             :16237   نقطة الدخول
      ├── generateDNNumber()           :16175  max(cache)+1 — بلا معاملة
      ├── push  ledger/debitNotes/{k}
      ├── createJournalForDebitNote()  :16262
      ├── createReturnMovementsForDN() :16294
      └── update ledger/purchaseInvoices/{inv}
```

## 2. القيد — مُتحقَّق منه بتشغيل الدالة الحقيقية

مُدخَل الاختبار: `netBeforeTax=2000` · `vatTotal=300` · `grandTotal=2300` · `fx=1`.
الناتج الفعلي من `createJournalForDebitNote` المُحمَّلة من الملف الحيّ:

| # | الحساب | مدين | دائن |
|---|---|---:|---:|
| 0 | `2110` الموردون (`vendPayableAccount(vendorId)`) | 2300 | 0 |
| 1 | `5110` المصروف (`expenseAccountCode ‖ 5110`) | 0 | 2000 |
| 2 | `1180` ضريبة المدخلات | 0 | 300 |

`totalDebit = totalCredit = grandBase` · `sourceType='debit_note'` · `status='posted'`.

- **ترتيب السطور ثابت** (الموردون أولاً) ولا يُعاد فرزه — بخلاف فاتورة المبيعات التي
  تُفرَز «كل المدين ثم كل الدائن». هنا الترتيب صحيح بحكم البناء لا بحكم الفرز.
- **تسوية التقريب** على `lines[1]` (المصروف)، محسوبة من مجموع **الدائن**:
  `rd = round2(grandBase − Σcredit)` ثم `lines[1].credit += rd` إن `|rd| ≥ 0.01`.
- **عند غياب `1180`** تُضمّ الضريبة إلى سطر المصروف (`lines[1].credit += cvt(vatTotal)`)
  بلا أي تنبيه — يُبقي القيد متوازناً لكن يُفقد عكس ضريبة المدخلات.

### حلّ الحسابات — بحث فقط، بلا إنشاء

```js
const apAcc  = accounts.find(a => a.code === vendPayableAccount(dn.vendorId));
const vatAcc = accounts.find(a => a.code === '1180');
const expCode = dn.expenseAccountCode || '5110';
const expAcc = accounts.find(a => a.code === expCode) || accounts.find(a => a.code === '5110');
```

⚠️ **مسار الإشعارات لا يستدعي `ensureStdAccount` إطلاقاً** — لا في CN ولا في DN. هذا
اكتشاف مهمّ: قرار Step C («الخدمة الموازية لا تُنشئ حسابات») ينطبق هنا **بلا أي فرق
سلوكي عن القديم** — أي أن المنع في هذه المرحلة سلوك **محفوظ (A)** لا تحسين أمان (C).

`expenseAccountCode` يُشتقّ عند إنشاء المستند (:16247):
`inv.debitAccountCode ‖ getExpenseAccountForType(inv.expenseType) ‖ '5110'`.
خريطة `getExpenseAccountForType` (:موقعها في الملف): `materials→5110` · `services→5120` ·
`equipment_rent→5130` · `subcontractor→5140` · `transport→5220` · `utilities→5330` ·
`rent→5320` · `other→5190` · وأي شيء آخر `→5190`.

## 3. 🔴 القيد قد لا يُنشأ والمسار يمضي

```js
if (!apAcc || !expAcc) { toast('⚠️ الإشعار سُجّل لكن تعذّر القيد: …', 'wn', 8000); return; }
```

و`submitDebitNote` (:16249) **لا تفحص النتيجة**. أُثبت تشغيلياً على النظير الدائن:
شجرة حسابات ناقصة ⇒ **صفر قيد · صفر استثناء · تنبيه `wn` عابر فقط**، والمسار يكمل
فيكتب المستند والمخزون ويُحدِّث `debitedAmount`/`fullyDebited`.

⇒ رصيد المورد يُنقَص و`دفتر الأستاذ` لا يتغيّر. مُسجَّل كـ**BUG-010** (يشمل المسارين).

## 4. حركة المخزون — الفرق الجوهري عن الإشعار الدائن

الناتج الفعلي من `createReturnMovementsForDN`:

```json
{ "number":"OUT-…", "date":"…", "type":"out", "itemId":"IT1", "qty":2,
  "unitPrice":1000, "projectId":"P1", "reason":"purchase_return",
  "description":"مرتجع مشتريات - إشعار مدين DN-… - حديد",
  "sourceType":"debit_note", "sourceKey":"DN1", "createdAt":"…", "createdBy":"…" }
```

| الجانب | Debit Note | Credit Note (للمقارنة) |
|---|---|---|
| الاتجاه | `out` | `in` |
| السبب | `purchase_return` | `sales_return` |
| **التكلفة** | **`parseFloat(line.unitPrice) ‖ 0` — سعر السطر مباشرةً** | `calcInvItemMovingAvg().avgCost` ← `costPrice` ← `unitPrice` ← 0 |
| استدعاء المتوسط المتحرّك | ❌ **لا يُستدعى إطلاقاً** | ✅ يُستدعى |
| `salePrice` | ❌ غير موجود | ❌ غير موجود (بخلاف حركة البيع) |
| `warehouseId` | ❌ لا يُكتب | ❌ لا يُكتب |
| فحص كفاية الرصيد | ❌ لا يوجد | لا ينطبق (إدخال) |
| قواعد التخطّي | `!line.itemId` ‖ `!item` ‖ `type==='service'` | مطابقة |
| الكمّية صفر | تُكتب حركة بصفر | تُكتب حركة بصفر |
| ابتلاع الخطأ | `try/catch` + `console.error` ثم يكمل | مطابق |

**فرق التكلفة مقصود لا سهو:** سطر فاتورة المشتريات يحمل سعر الشراء أصلاً، فالمرتجع
للمورد يخرج بنفس التكلفة التي دخل بها. سطر فاتورة المبيعات يحمل سعر **البيع**، فلا يصلح
كتكلفة ويلزم المتوسط المتحرّك. **يُحفظ كما هو — تصنيف A.**

⚠️ لكن له أثراً محاسبياً حقيقياً: خروج بسعر السطر بينما التقييم الجاري بالمتوسط المتحرّك
يُحدث انحرافاً في قيمة المخزون إن اختلف السعران. **سلوك قائم، لا يُغيَّر، ويُسجَّل كقرار
معلّق D4.**

## 5. أثر الإشعار المدين على رصيد المورد

`calcVendorBalance` (:17069):
```js
const debited = round2(inv.debitedAmount || 0);
const grand   = round2((inv.grandTotal || 0) - debited);
invoiced += grand;  paid += invPaid;
```

**لا فحص لـ`fullyDebited` إطلاقاً** — الحقل يُكتب لكن لا يُقرأ هنا. الإلغاء الكامل يتحقّق
ضمنياً لأن `debitedAmount = grandTotal ⇒ grand = 0`.

### 🔴 عدم تماثل حقيقي مع مسار العميل — وله أثر مالي

`calcCustomerBalance` (:12280) يفعل العكس:
```js
if (inv.fullyCredited) return;   // ← يستبعد الفاتورة **كاملةً**، بما فيها paidAmount
```

| السيناريو | العميل (CN) | المورد (DN) |
|---|---|---|
| فاتورة 10,000 · مدفوعة 10,000 · إشعار كامل | الفاتورة تُستبعد كلياً ⇒ مساهمة **0** | `grand=0` لكن `paid=10,000` ⇒ مساهمة **−10,000** |
| الصواب المحاسبي | −10,000 (الشركة مدينة للعميل بالمبلغ المدفوع) | −10,000 ✅ |

⇒ مسار العميل **يُخفي التزاماً بقيمة ما دفعه العميل** على فاتورة أُلغيت بإشعار دائن كامل.
ولا شيء يمنع ذلك: `openCreditNote` لا يفحص `paidAmount` إطلاقاً (بخلاف `unpostSInv` التي
ترفض إن `paid > 0.005`). مُسجَّل كـ**BUG-014**.

## 6. تحديث فاتورة المشتريات المصدر

```js
const upd = { debitNoteNumber: dnNumber };
const keys = Array.isArray(inv.debitNoteKeys) ? inv.debitNoteKeys.slice()
           : (inv.debitNoteKey ? [inv.debitNoteKey] : []);
keys.push(dnRef.key); upd.debitNoteKeys = keys;
if (isFull) { upd.fullyDebited = true; upd.debitedAmount = parseFloat(inv.grandTotal) || 0; }
else        { upd.debitedAmount = round2(prevDebited + c.grandTotal); }
```

- `debitNoteNumber` يحمل **آخر** إشعار فقط (يُدهَس في كل مرّة) — السجل الكامل في المصفوفة.
- توافق رجعي مع حقل مفرد قديم `debitNoteKey`.
- `isFull = (prevDebited + grandTotal) ≥ (inv.grandTotal) − 0.01`.
- في حالة `isFull` **يُقصّ** `debitedAmount` إلى `grandTotal` — نفس آلية القصّ في CN،
  وبنفس النتيجة: **الحقل مقصوص والقيد متجاوَز** (BUG-013، مشروح في المستند الدائن).
- ⚠️ كل ذلك **قراءة-ثم-كتابة من لقطة الذاكرة** ⇒ ضياع تحديث تحت التزامن (BUG-012).

## 7. ما لا يفعله الإشعار المدين

- لا يعكس احتجازاً (`1131`) ولا دفعة مقدمة (`2150`) — لا وجود لهما في مسار المشتريات أصلاً.
- لا يُنشئ حسابات (`ensureStdAccount` غير مستدعاة).
- لا يفحص قفل الفترة (`pcIsLocked`) — بخلاف `unpostSInv` التي تفحصه. **إشعار مدين يمكن
  إصداره على فترة محاسبية مقفلة.** سلوك قائم؛ يُسجَّل كحدّ معروف.
- لا يفحص `paidAmount` قبل الإلغاء الكامل.
- لا مسار حذف/عكس/إلغاء للإشعار بعد إصداره.

## 8. الخلاصة الخاصة بالإشعار المدين

| البند | الحالة |
|---|---|
| القيد | 3 سطور ثابتة الترتيب · مُتحقَّق تشغيلياً |
| حلّ الحسابات | بحث فقط — **منع الإنشاء في الخدمة الجديدة = سلوك محفوظ (A) لا تحسين (C)** |
| المخزون | خروج بسعر السطر، بلا متوسط متحرّك ولا فحص رصيد |
| الترقيم | `max(cache)+1` — مكرّر تحت التزامن (BUG-011) |
| Idempotency | معدومة تماماً |
| الذرّية | صفر — 4 + 2N عملية مستقلّة |
| رصيد المورد | سليم منطقياً (بخلاف مسار العميل — BUG-014) |
