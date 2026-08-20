# خدمة إصدار الإشعار الدائن — Phase 7 Step D

> **الحالة:** مُنفَّذة ومُثبتة · **غير موصولة بالإنتاج**. المسار الحيّ ما زال
> `submitCreditNote` في `public/accounting.js` بلا أي تعديل.

## 1. المعمارية

```
UI / Legacy (لاحقاً)
        │  returnQuantities تُمرَّر صراحةً — لا قراءة من DOM
        ▼
src/services/accounting/posting/postCreditNote.js
        ├──▶ domain/accounting/credit-note/computeCreditNote.js      (نواة مشتركة)
        ├──▶ domain/accounting/credit-note/validateCreditNote.js
        ├──▶ domain/accounting/credit-note/buildCreditNoteJournal.js
        ├──▶ domain/accounting/credit-note/resolveCreditNoteAccounts.js
        ├──▶ domain/accounting/notes/computeNoteCapacity.js          (حارس التجاوز)
        ├──▶ domain/inventory/planCreditNoteMovements.js
        └──▶ domain/accounting/posting/{validateJournal,assertBalanced}.js  (مُعاد استخدامها)
        ▼
repositories/contracts/CreditNotePostingRepository.js
        ├──▶ firebase/FirebaseCreditNotePostingRepository.js  → notePostingBase.js
        └──▶ memory/InMemoryCreditNotePostingRepository.js
```

**حدود مُلتزَمة:** الدومين والخدمة بلا Firebase · بلا DOM · بلا `window`/`document` ·
بلا `toast`. المستودع وحده يعرف RTDB، وعبر منفذ محقون (`createRtdbPort`) فيمرّ كل مسار
عبر غلافَي `ref()`/`scopeUpdates()` الواعيَين بالمستأجر.

## 2. الاستخدام

```js
const post = createPostCreditNoteService({
    chartOfAccountsRepo, creditNotePostingRepo,
    getSalesInvoice, getCustomer, getInventorySnapshot,
    cfg: { baseCurrencyCode: 'SAR', arApMode: 'aggregate' }, currentUser: { uid }
});

const noteKey = push(ref(db, 'ledger/creditNotes')).key;   // ← مرساة Idempotency
const r = await post({ noteKey, invoiceKey, returnQuantities: [1, 5], reason: 'مرتجع' });
```

⚠️ **`noteKey` مسؤولية المستدعي** ويجب إعادة استخدامه حرفياً عند إعادة المحاولة —
وإلا صار كل استدعاء إشعاراً جديداً مشروعاً. `push(ref).key` يُولّد محلّياً بلا كتابة.

## 3. القيد المُنتَج

مطابق حرفياً للقديم (54 تأكيداً في `tests/golden-master/credit-note.test.mjs`):

```
مدين   الإيرادات (salesAccountCode ‖ 4100)  = netBeforeTax × fx  (+ فرق التقريب)
مدين   ضريبة المخرجات (2140)                = vatTotal × fx      [إن > 0]
دائن   العملاء (custReceivableAccount)      = grandTotal × fx
```

- `fx = 1` إن كانت عملة المستند فارغة أو مساوية للعملة الدفترية.
- تسوية التقريب على **سطر الإيراد** ومن مجموع **المدين**.
- **لا فرز للسطور** — الترتيب صحيح بحكم البناء.
- **لا عكس للاحتجاز (1131) ولا للدفعة المقدمة (2150)** — القديم لا يعكسهما،
  وهذه الخدمة لا تعكسهما. قرار محاسبي معلّق **D3**.

## 4. حساب المبالغ

`computeCreditNote` منقولة حرفياً من `cnCompute` — مع تمرير `returnQuantities` بدل DOM:

| القاعدة | السلوك |
|---|---|
| كمّية غائبة (`undefined`) | ترتدّ إلى الكمّية الأصلية (مسار `rq ? … : origQty`) |
| كمّية أعلى من الأصلية | تُقصّ إلى الأصلية |
| كمّية سالبة | تُقصّ إلى صفر |
| الخصم الرأسي | يُوزَّع بنسبة `discount / Σtotal` |
| الضريبة | `lineNet × (1 − نسبة الخصم) × vatRate` ثم تقريب نهائي واحد |
| `subTotal` | يُراكم أسطراً مقرَّبة لكنه **هو نفسه لا يُقرَّب** |
| سطر بكمّية إرجاع صفر | يُحتسب في المبالغ لكن **لا يدخل** قائمة السطور |

## 5. الفروق المقصودة عن القديم

| # | صنف | الفرق | الإثبات |
|---|---|---|---|
| C1 | C | **يرفض الترحيل عند غياب أي حساب مطلوب** بدل كتابة مستند ومخزون وتحديث فاتورة بلا قيد (BUG-010) | `failure [B]` |
| C2 | C | **ترقيم بمعاملة خادمية** (`counters/cn/{year}`) بدل `max(cache)+1` (BUG-011) | `char [2]` |
| C3 | C | **تحديث الفاتورة داخل معاملة** ⇒ لا ضياع تحديث (BUG-012) | `idempotency [4]` · `allocation [4]` |
| C4 | C | **رفض التجاوز** بحساب المتبقّي من الحالة اللحظية (BUG-013) | `allocation [1][3]` |
| B1 | B | `returnQuantities` وسيط صريح بدل DOM | `gm [1]` |
| B2 | B | الأوصاف بلا `esc()` (ترميز HTML — طبقة عرض، بلا أثر مالي) | `gm [2]` |
| A1 | A | **لا إنشاء حسابات** — القديم لا يستدعي `ensureStdAccount` هنا أصلاً | `resolveCreditNoteAccounts.js` |
| A2 | A | حارسا `status==='posted'` و`!fullyCredited` محفوظان | `failure [D3]` · `allocation [5]` |
| A3 | A | ضمّ الضريبة للإيراد عند غياب 2140 — منقول في الدومين (غير قابل للوصول عبر الخدمة) | `gm [3]` |
| A4 | A | القصّ إلى `grandTotal` عند الإلغاء الكامل | `char [3] 33` |
| D3 | D | عدم عكس الاحتجاز والدفعة المقدمة — **معلّق** | — |

## 6. الحدود المعروفة

1. **العدّادات خارج الذرّية** — فشل بعد الحجز يُنتج فجوة ترقيم (مقبولة صراحةً).
2. **تعويض الفاتورة أفضل جهد** — إن فشل التعويض نفسه يبقى `creditedAmount` مُخصَّصاً
   بلا مستند ولا قيد، ويلزم تدخّل يدوي (مُختبَر: `failure [J]`).
3. **مطالبة عالقة**: إن فشل تحرير المطالبة، تبقى عقدة الإشعار بحالة `draft` وتُرفض
   إعادة المحاولة بنفس المفتاح — الحلّ مفتاح جديد.
4. **الخدمة لا تُطبّق ضوابط الواجهة** (الصلاحيات · قفل الفترة · التأكيد) — مسؤولية المهايئ.
5. **BUG-014 غير مُعالَج** — `calcCustomerBalance` تستبعد الفاتورة المُلغاة بالكامل بما
   فيها `paidAmount`. توصيف فقط (راجع `debit-note-posting.md §5`).

## 7. الأداء

`npm run svc:notes:perf`. أرقام حساب نقيّ (ليست زمن RTDB): بناء القيد ~0.0003 ms ·
حساب المبالغ ~0.0002 ms · حارس السعة ~0.00004 ms · الخدمة الكاملة ~0.14 ms.
زمن الإنتاج تحكمه **(4 + N)** رحلة شبكية.

## 8. الرجوع

لا شيء موصول بالإنتاج: `git revert <commit>` كافٍ.
