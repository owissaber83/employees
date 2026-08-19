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

## 🔎 عدم تماثل موثَّق مع `calcCustomerBalance` — لا `fullyCredited`

`calcCustomerBalance` تفحص `inv.fullyCredited` وتستبعد الفاتورة كلياً عند
`true`. **`calcVendorBalance` لا تملك أي حقل مماثل** — لا `fullyDebited` ولا
شبيهه. حقل `fullyCredited` على فاتورة مشتريات، لو وُجد، **بلا أي أثر على
الحساب**. مُثبَت تنفيذياً في `tests/golden-master/supplier-balances.test.mjs`.

**ليس عطلاً مؤكَّداً** — قد يكون غياب مسار عملي لإشعار كامل من مورد أصلاً
(القرار خارج نطاق Phase 5). يستحق سؤالاً لمالك المنتج قبل أي قرار.

## نفس BUG-001

`new Date().toISOString().slice(0,10)` — نفس نمط UTC. مصدر إضافي موثَّق
لأثر BUG-001، هذه المرّة في سياق أرصدة الموردين.

## التغطية

`tests/golden-master/supplier-balances.test.mjs` — 9 تأكيدات: مورد غير
موجود · فاتورة متأخّرة · سداد جزئي/كامل · إشعار مدين · عدم تماثل fullyCredited.
