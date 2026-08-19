# تخصيص السند على الفواتير — منطق نقيّ، وفرق مقصود عن القديم (Phase 7)

## الاكتشاف الحرج — القديم بلا سقف إطلاقاً

`allocateToInvoices` (accounting.js:19731) — منطق التخصيص الكامل:

```js
const snap = await get(ref(db, invPath + invKey));
const currentPaid = parseFloat(snap.val().paidAmount) || 0;
const newPaid = Math.round((currentPaid + parseFloat(amt)) * 100) / 100;
await update(ref(db, invPath + invKey), { paidAmount: newPaid });
```

**لا فحص `newPaid > grandTotal` في أي مكان.** لا تحذير، لا `toast`، حتى لا
`console.warn`. مُثبَت تنفيذياً — لا افتراضاً — بتشغيل الدالة الحقيقية عبر
`tests/golden-master/capture-voucher.mjs`:

```
alloc 6000 على فاتورة 10000 → paidAmount: 6000، error: null
alloc 7000 إضافية (13000 إجمالاً) → paidAmount: 13000، error: null، toasts: []
```

`tests/characterization/allocateToInvoices.test.mjs` (15 تأكيداً) يُثبت هذا
رسمياً كـ**LEGACY BEHAVIOR TEST**، ويُثبت أيضاً أن فاتورة تخصيص غير موجودة
تُتجاوَز بـ`console.warn` فقط دون إيقاف بقيّة التخصيصات.

## القرار — رفض صريح، لا إصلاح صامت

تعليمات Phase 7 Step B تطلب صراحةً: *«If the combined allocation exceeds
the invoice balance: the system must reject the conflicting operation
rather than silently overwrite»*. هذا **فرق سلوك مقصود وموثَّق**، وليس
تصحيحاً للقديم يُطبَّق بصمت.

### تصنيف الفرق (§Golden Master من التعليمات — A/B/C/D)

| الخيار | الوصف | ينطبق هنا؟ |
|---|---|---|
| A | خطأ تنفيذ في النقل | ❌ لا — القديم نُقِل بدقّة في `tests/characterization/allocateToInvoices.test.mjs`، والفرق مقصود لا خطأ |
| B | فرق سلوك قديم غير مقصود اكتُشِف بالصدفة | ❌ لا — الفرق مطلوب صراحةً في تعليمات المرحلة، ليس اكتشافاً عرضياً |
| **C** | **تحسين أمان مقصود** | **✅ هذا الخيار — رفض التجاوز بدل قبوله صامتاً، بطلب صريح** |
| D | قاعدة عمل غير موثَّقة اكتُشِفت | ❌ لا — هذه ليست قاعدة عمل مكتشَفة، بل قرار أمان تصميمي |

## المنطق النقيّ

```js
// src/domain/accounting/allocation/computeAllocation.js
export function computeInvoiceAllocation({ invoiceKey, currentPaidAmount, grandTotal, allocatedAmount }) {
    const amt = Number(allocatedAmount);
    if (!Number.isFinite(amt) || amt <= 0) throw new ValidationError(...);
    const next = round2(round2(currentPaidAmount || 0) + amt);
    if (next > round2(grandTotal) + ALLOCATION_TOLERANCE) {   // ALLOCATION_TOLERANCE = 0.01، نفس تسامح النظام
        throw new AllocationConflictError(...);
    }
    return { nextPaidAmount: next, remainingBefore, remainingAfter };
}
```

**نقيّة تماماً** — لا قراءة ولا كتابة هنا. طبقة المستودع
(`FirebaseVoucherPostingRepository`) تستدعيها **داخل** `runTransaction` لكل
فاتورة، فيصبح الفحص آمناً من التزامن فعلياً لا فحصاً على قراءة قديمة —
راجع `docs/services/voucher-atomicity.md` «نموذج التزامن» للتفصيل الكامل.

`validateAllocationSet` تفحص بنية كامل مجموعة التخصيصات (كائن صالح، مفاتيح
غير مكرَّرة، مبالغ موجبة) **قبل** أي معاملة على أي فاتورة — نفس انضباط
`validateJournal` في Phase 6: رفض مبكر بدل كتابة جزئية.

## فرق ثانٍ مقصود — فاتورة تخصيص غير موجودة تُرفَض لا تُتجاوَز

القديم: `console.warn('allocateToInvoices: invoice not found', invKey); continue;`
— يتابع بقيّة التخصيصات وكأن شيئاً لم يحدث. الجديد: `ValidationError` صريحة
تُجهض العملية كاملة (مع تعويض ما نجح سلفاً). **نفس منطق تصنيف C**: في سياق
خدمة تطبيق ذرّية-التصميم (Application Service)، تجاوز صامت لخطأ بيانات
(فاتورة محذوفة/مفتاح خاطئ) أخطر من رفض واضح يوقف العملية ويترك الحالة
متّسقة. القديم لم يكن مصمَّماً كخدمة ذرّية أصلاً؛ الجديد كذلك، فالمعيار
يختلف بالضرورة.

## مُثبَت تنفيذياً — لا افتراضاً

| الاختبار | التأكيدات | ما يُثبته |
|---|---|---|
| `tests/characterization/allocateToInvoices.test.mjs` | 15 | سلوك القديم الحقيقي — بما فيه غياب السقف |
| `tests/golden-master/voucher.test.mjs` | 7 | تطابق تام في المنطقة العادية (بلا تجاوز) + تصنيف صريح للفرق (تجاوز) |
| `tests/services/postVoucher.allocation.test.mjs` | 26 | رفض التجاوز · تعويض جزئي · سباق حقيقي · N فاتورة · سداد جزئي/كامل |
| `tests/services/postVoucher.failureInjection.test.mjs` | جزء من 16 | فاتورة مفقودة · بنية تخصيصات غير صالحة |

## حدود موثَّقة

- **التسامح** — `ALLOCATION_TOLERANCE = 0.01`، نفس `MONEY_TOLERANCE` في
  `assertBalanced.js` (Phase 6) — لا تسامح جديد مستقلّ.
- **العملة الأجنبية** — التخصيص يُقارَن بالمبلغ كما هو مُخزَّن على الفاتورة
  (`grandTotal`/`paidAmount` بعملة الفاتورة)، مطابقاً لسلوك القديم الذي لا
  يحوِّل العملة عند المقارنة أصلاً (`allocateToInvoices` لا تلمس `fx`
  إطلاقاً — التحويل يحدث فقط في بناء القيد `buildVoucherJournal`، لا في
  التخصيص). لم يُغيَّر هذا السلوك.
- **سند بلا تخصيصات** — `validateAllocationSet(null)` تعود بصمت (لا-عملية)
  — مطابق لسلوك `allocateToInvoices` («`if (!allocations ...) return;`»).
