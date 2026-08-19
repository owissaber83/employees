# رصيد المورد — `calcVendorBalance` (Phase 5)

> توصيف سلوك قائم. لا يُغيَّر شيء هنا.

## الموقع والتوقيع

`public/accounting.js:17058` — `function calcVendorBalance(vendorKey)`.

## نفس نمط `calcCustomerBalance` — مبنيّة على الفواتير لا القيود

تقرأ `window.vendors[key]` و`window.purchaseInvoices` مباشرةً. نفس أثر
العزل عن دفتر الأستاذ الموثَّق في `docs/accounting/customer-balances.md`.

## الخوارزمية

```
opening = vendor.openingBalance
لكل فاتورة مشتريات بنفس vendorId وstatus==='posted':
  debited = فاتورة.debitedAmount        ← إشعار مدين (مرتجع للمورد)
  grand   = grandTotal - debited
  invoiced += grand
  paid     += paidAmount
  إن dueDate < today(UTC) وpaid < grand-0.01: overdue += grand - paid
balance = opening + invoiced - paid
```

## 🔴 [تصحيح Phase 7] عدم تماثل أخطر ممّا وُصف في Phase 5 — الحقل موجود ومكتوب، لكنه مُتجاهَل

**تصحيح دقيق:** الصياغة الأصلية هنا (Phase 5) قالت إن `calcVendorBalance`
"لا تملك حقلاً مماثلاً لـ`fullyDebited`" — هذا غير دقيق. اكتشاف Phase 7
(قراءة `submitDebitNote`، `accounting.js:16254`) يُثبت أن الحقل **موجود
ويُكتب فعلياً** من مسار إنتاجي حقيقي:

```js
// accounting.js:16254 — submitDebitNote
if (isFull) { upd.fullyDebited = true; upd.debitedAmount = ...; }
await update(ref(db, 'ledger/purchaseInvoices/' + key), upd);
```

**المشكلة الحقيقية إذن ليست غياب الحقل، بل أن `calcVendorBalance` لا
تقرؤه إطلاقاً** (`tests/golden-master/supplier-balances.test.mjs` يُثبت
ذلك تنفيذياً) — بينما `calcCustomerBalance` المقابلة **تفحص** `fullyCredited`
وتستبعد الفاتورة كلياً عند `true`. أي أن فاتورة مشتريات صدر عليها إشعار
مدين كامل (`fullyDebited: true`) **تبقى تُحسَب في رصيد المورد** كأنها لم
تُرتجَع — عكس ما يحدث تماماً على جانب العملاء لنفس السيناريو.

**هذا يرفع تصنيف الخطورة** من "قد يكون غياب مسار عملي" إلى: **مسار عملي
موجود فعلاً (`submitDebitNote` يعمل ويُستخدَم)، ونتيجته تُكتب، وشاشة رصيد
المورد تتجاهلها بصمت.** لم يُصلَح — يخضع لنفس قاعدة §6 (توثيق → اختبار →
موافقة) قبل أي تعديل على `calcVendorBalance`.

## نفس BUG-001

`new Date().toISOString().slice(0,10)` — نفس نمط UTC. مصدر إضافي موثَّق
لأثر BUG-001، هذه المرّة في سياق أرصدة الموردين.

## التغطية

`tests/golden-master/supplier-balances.test.mjs` — 9 تأكيدات: مورد غير
موجود · فاتورة متأخّرة · سداد جزئي/كامل · إشعار مدين · عدم تماثل fullyCredited.
