# رصيد العميل — `calcCustomerBalance` (Phase 5)

> توصيف سلوك قائم. لا يُغيَّر شيء هنا.

## الموقع والتوقيع

`public/accounting.js:12268` — `function calcCustomerBalance(customerKey)`.

## ⚠️ مبنيّة على الفواتير لا على القيود

خلافاً لـ`tbCalcBalances`/`coaAccountOps` (تقرآن `journalEntries`)،
`calcCustomerBalance` تقرأ `window.customers[key]` و`window.salesInvoices`
**مباشرةً**. هذا يعني: **قيد محاسبي مكرَّر أو يتيم في دفتر الأستاذ لا يظهر
أثره هنا إطلاقاً** — الشاشتان تستهلكان مصدرَي بيانات مختلفين جذرياً على نفس
الحدث المحاسبي. مُثبَت تنفيذياً وبأثره الكامل في
`tests/golden-master/idempotency.test.mjs §[الأثر المالي المتباين]`.

## المدخلات والخوارزمية

```
opening = customer.openingBalance
لكل فاتورة مبيعات بنفس customerId وstatus==='posted' وfullyCredited!==true:
  invoiced += grandTotal
  paid     += paidAmount
  credited += creditedAmount        ← إشعار دائن جزئي
  إن dueDate < today(UTC) والمتبقّي > 0.01: overdue += المتبقّي
balance = opening + invoiced - paid - credited
```

**ذاكرة تخزين مؤقّت خارجية:** `_custRenderMemo` (module-scope) — تُفعَّل
لحظة رسم قائمة العملاء وتُصفَّر فوراً بعد (`accounting.js:12395`/`12483`).
**دورة حياة مقيَّدة بجولة رسم واحدة** — لا تُبقي حالة عبر تبديل مستأجر أو
عبر جلسات (المستأجَر يُبدَّل بإعادة تحميل كاملة للصفحة أصلاً). لا خطر تسرّب
مثبَت. مُتحقَّق منه بقراءة الشفرة، لا حاجة لاختبار تنفيذي إضافي.

## 🔴 BUG-001 — نفس نمط التاريخ المحلي

`const today = new Date().toISOString().slice(0, 10);` — UTC لا توقيت الرياض.
بين 00:00–02:59 بتوقيت الرياض هذا يُعطي «أمس»، فيُصنَّف `overdue` خطأً. هذه
الدالة **مصدر إضافي** لأثر BUG-001 لم يكن موثَّقاً سابقاً (التوثيق القائم في
`ACCOUNTING_INTEGRITY_AUDIT.md §4.3` يذكر 188 موضعاً عاماً، هذه الدالة إحداها
تحديداً في سياق أرصدة العملاء).

## fullyCredited — استبعاد كلّي لا تصفير

فاتورة `fullyCredited: true` **تُستبعَد بالكامل** من الحساب — لا تُضاف حتى
بصفر. `docs/accounting/supplier-balances.md` يوثّق أن الجانب المقابل
(الموردون) لا يملك حقلاً مماثلاً.

## التغطية

`tests/golden-master/customer-balances.test.mjs` — 16 تأكيداً: عميل غير
موجود · افتتاحي فقط · فاتورة متأخّرة · سداد جزئي/كامل · إشعار دائن جزئي/كامل ·
نافذة BUG-001.
