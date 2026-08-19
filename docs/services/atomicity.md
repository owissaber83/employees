# الذرّية — كيف تُحلّ فعلياً (Phase 6)

> يُغلق مباشرةً `ACCOUNTING_INTEGRITY_FIX_PLAN.md §3` و§4، و`BUGS_TO_FIX.md`
> BUG-007 من زاوية الترحيل الفردي (BUG-007 نفسها — أثر القيد المكرَّر على
> تقارير أخرى — لا تُصلَح بهذا وحده؛ انظر §7 «ما هذا لا يحلّه»).

## المشكلة كما وثَّقتها Phase 4

`postPInv` القديمة أربع كتابات مستقلة، كلٌّ بـ`await` منفصل، بلا معاملة:

```
push(القيد) ─await─▶ update(ربط الفاتورة) ─await─▶ update(حالة الفاتورة) ─await─▶ push(حركة المخزون)
```

فشل بعد الكتابة الأولى = **قيد يتيم** لا تعرفه أي فاتورة (مُثبَت في
`tests/golden-master/posting-integrity.test.mjs §[C]` وPhase 5
`failure-injection.test.mjs`).

## الحل — مجموعة كتابة واحدة، ذرّية بحكم RTDB نفسها

```js
// src/repositories/firebase/FirebaseJournalPostingRepository.js
const updates = {
  'ledger/journalEntries/{newId}':               journal,
  'ledger/purchaseInvoices/{key}/journalEntryKey':    journalId,
  'ledger/purchaseInvoices/{key}/journalEntryNumber': journalNumber,
  'ledger/purchaseInvoices/{key}/postedAt':           journal.postedAt,
  'ledger/purchaseInvoices/{key}/postedBy':           journal.postedBy
};
await port.update(port.ref(port.db, '/'), updates);   // نجاح كامل أو فشل كامل — لا حالة وسيطة
```

هذا **نفس** `update(ref(db), {...})` القياسي في RTDB — لا مكتبة جديدة ولا
اعتماد إضافي. `window.update` الحالي في `app.js:202` يُطبِّق `scopeUpdates()`
على مفاتيح هذا الكائن تلقائياً (كل مفتاح يبدأ بـ`ledger/` يُسبَق ببادئة
المستأجر) — **لم نستدعِ `scopeUpdates()` يدوياً في أي مكان**؛ الحقن عبر
`rtdbPort.js` يمرّر الدالة الجاهزة كما هي (نفس مبدأ Phase 3، §7 «مطلق»).

## ماذا يحدث إذا فشل الالتزام؟

`port.update(...)` يرمي استثناءً واحداً لكل الكتابات معاً — RTDB لا تكتب
جزءاً وترفض الباقي. المستودع يستجيب بخطوة واحدة إضافية (غير ذرّية بالضرورة،
لكنها **تراجع لا التزام جديد**):

```js
catch (e) {
    await this._safeRollbackStatus(invoiceKey);   // status ← 'draft' (أفضل جهد)
    throw new AtomicityError(...);
}
```

**لماذا الاسترجاع نفسه ليس "خطوة خامسة غير ذرّية تخالف المبدأ"؟** لأنه يكتب
حقلاً واحداً (`status`) لا مجموعة مسارات، وفشله (نادر جداً — نفس الاتصال
الذي فشل للتوّ) يُوثَّق كحدّ صريح لا يُخفى: الفاتورة قد تبقى `posted` بلا قيد
في أسوأ الحالات النادرة (فشل الكتابة الذرّية ثم فشل الاسترجاع في نفس
اللحظة) — **أفضل من القديم** (حيث القيد اليتيم يُكتب فعلياً ولا استرجاع
إطلاقاً)، **وليس ضماناً مطلقاً**.

## الترتيب الذي يمنع هدر رقم القيد

الحجز الذرّي لرقم القيد (`ledger/counters/jrn/JV/{year}`، نفس آلية
`generateJrnNumberAtomic` تماماً) **يأتي بعد** معاينة القيد بمعامل مؤقّت في
طبقة الخدمة (`postPurchaseInvoice.js`، §11) — لا بعدها. عطل بنيوي (حساب
مفقود، قيد غير متوازن) يُكتشَف **قبل** استهلاك رقم — مُثبَت تنفيذياً في
`tests/services/postPurchaseInvoice.failureInjection.test.mjs §[J]`.

## نتيجة الاختبار — قبل مقابل بعد

| السيناريو | القديم (Phase 4 مُثبَت) | الجديد (Phase 6 مُثبَت) |
|---|---|---|
| فشل بعد الكتابة الأولى | 🔴 قيد يتيم | ✅ لا كتابة أصلاً — الكل أو لا شيء |
| فشل أثناء الالتزام | (لا معادل — كتابات منفصلة أصلاً) | ✅ AtomicityError + استرجاع الحالة |
| إعادة محاولة بعد فشل | 🔴 قيد إضافي محتمل | ✅ ترحيل جديد نظيف، قيد واحد فقط |

`tests/services/postPurchaseInvoice.atomicity.test.mjs` — 14 تأكيداً.

## ما هذا لا يحلّه

- **BUG-005** (فجوة `tbCalcBalances`/`calcFSBalances`) — منطق تقارير منفصل
  تماماً، غير مُلامَس هنا.
- **BUG-007 على المسار القديم** — `postPInv` القديمة ما زالت غير ذرّية؛ هذا
  الحل موجود **بجانبها** لا بدلاً عنها حتى الوصل المُتحكَّم (§15).
- **حركات المخزون** — غير مُضمَّنة في مجموعة الكتابة هذا الإصدار (`docs/services/posting.md`).
