# DATA_FLOW_ARCHITECTURE.md — تدفّق البيانات

> ثلاث حالات: الحالية (كما هي فعلاً) · المستهدفة (نهاية هذا المشروع) · المستقبلية (بعد الانتقال لقاعدة علائقية).

---

## 1. التدفّق الحالي — كما هو مقيس

```
المستخدم
   │
   ▼
index.html  ── onclick="postPInv('key')" ──┐   2,522 معالجاً مضمّناً
   │                                        │
   ▼                                        ▼
دالة عامة على window  (2,356 متغيّراً/دالة عامة)
   │
   ├─ تقرأ الحالة:   window.purchaseInvoices · window.chartOfAccounts · window.vendors
   ├─ تفحص الصلاحية: can('post_purchase_invoice')          ← الواجهة
   ├─ تحسب المحاسبة: بناء السطور واختيار الحسابات          ← مختلط بالعرض
   ├─ تكتب:          update(ref(db, 'ledger/...'))          ← مباشرةً
   └─ ترسم:          innerHTML = '...'                      ← 975 موضعاً
   │
   ▼
غلاف ref()  ──→  tenants/$tid/ledger/…      ← نقطة عزل المستأجرين الوحيدة ✅
   │
   ▼
Firebase RTDB
   │
   ▼
onValue (97 مستمعاً)  ──→  يملأ window.*  ──→  دوال العرض تعيد الرسم
```

### خصائص هذا التدفّق

| | |
|---|---|
| ✅ | نقطة عزل مستأجرين واحدة (`ref`/`scopeUpdates`) |
| ✅ | الصلاحيات مُنفَّذة في القاعدة أيضاً (`permsMap`) لا في الواجهة وحدها |
| 🔴 | لا حدّ بين العرض والمنطق والبيانات — الطبقات الثلاث في دالة واحدة |
| 🔴 | الحالة عامة ومشتركة — أي وحدة تقرأ وتكتب حالة أي وحدة أخرى |
| 🔴 | كل مجموعة محمّلة كاملة في الذاكرة (97 مستمعاً) |
| 🔴 | لا حالات تحميل/فراغ/خطأ منهجية |

### مثال ملموس — ترحيل فاتورة مشتريات اليوم

```
onclick="postPInv(key)"
   ▼
window.postPInv(key)
   ├─ can('post_purchase_invoice')                    ← صلاحية
   ├─ window.purchaseInvoices[key]                    ← حالة عامة
   ├─ cf2('هل تريد الترحيل؟')                          ← عرض
   ├─ createJournalForPInv()                          ← منطق محاسبي
   │     ├─ window.chartOfAccounts  ← حالة عامة
   │     ├─ vendPayableAccount()    ← قاعدة عمل
   │     ├─ بناء lines[]            ← منطق محاسبي
   │     ├─ push(R.jrn, …)          ← كتابة ١
   │     └─ update(pinv/$key, …)    ← كتابة ٢
   ├─ update(pinv/$key, {status:'posted'})            ← كتابة ٣
   ├─ createInventoryMovementsForPInv()               ← كتابة ٤
   └─ toast('✅ تم الترحيل')                           ← عرض
```

**ست مسؤوليات في دالة واحدة، وأربع كتابات غير ذرّية.** هذا هو ما تفكّكه المراحل 2–4.

---

## 2. التدفّق المستهدف — نهاية هذا المشروع

```
الواجهة القديمة (اليوم)  │  جزر React (لاحقاً)
        └──────────┬──────────┘
                   ▼
        Application Service  (Use Case)
        ├─ التحقق من الصلاحية
        ├─ حدود المعاملة
        └─ التنسيق والتدقيق
                   ▼
             Domain  (نقيّ)
        ├─ لا DOM · لا شبكة · لا Firebase
        └─ قابل للاختبار في Node وحده
                   ▼
        Repository Contract  (واجهة مجرّدة)
                   ▼
        FirebaseRtdbRepository
        └─ تحديث ذرّي متعدّد المسارات
                   ▼
        Firebase RTDB  ← يبقى مصدر الحقيقة الوحيد
```

### نفس المثال بعد إعادة الهيكلة

```
onclick="postPInv(key)"           ← القديم يبقى كما هو
        ▼
postPurchaseInvoice(key)          [Application]
 ├─ requirePermission('post_purchase_invoice')
 ├─ fiscalPeriod.assertOpen(inv.date)          [Domain]
 ├─ entry = buildPurchaseEntry(inv, accounts)  [Domain]  ← نقيّ ومختبَر
 ├─ assertBalanced(entry)                      [Domain]  ← يفحص مجموع السطور 🔴→✅
 ├─ idempotencyKey = `pinv:${key}`                       ← يمنع القيد المزدوج
 ▼
JournalRepository.postWithSource({ entry, invoiceKey, movements })
 └─ update(ref(db), {                          ← كتابة واحدة ذرّية
      'ledger/journalEntries/$new': entry,
      'ledger/purchaseInvoices/$key/status': 'posted',
      'ledger/purchaseInvoices/$key/journalEntryKey': '$new',
      'ledger/inventoryMovements/…': movements
    })
        ▼
AuditService.record()
```

**المكاسب:** الذرّية · فحص التوازن الحقيقي · منع التكرار · منطق مختبَر بلا متصفح · **بلا تغيير في مخطّط قاعدة البيانات**.

---

## 3. التدفّق المستقبلي — بعد الانتقال لقاعدة علائقية

> **خارج نطاق هذا المشروع.** يُرسم هنا فقط لإثبات أن الطبقات المبنيّة الآن تحتمله.

```
React
  ▼
Application Service        ← لا يتغيّر
  ▼
Domain                     ← لا يتغيّر
  ▼
Repository Contract        ← لا يتغيّر
  ▼
PostgresJournalRepository  ← التنفيذ الوحيد الذي يُستبدَل
  ▼
Backend API
  ▼
PostgreSQL / Oracle
```

### نقطة التبديل الوحيدة

```js
// contracts/JournalRepository.js
export class JournalRepository {
  async getById(id) {}
  async listByPeriod(from, to) {}
  async postWithSource({ entry, sourceType, sourceKey, sideEffects }) {}
  async trialBalance(asOf) {}
}
```

`trialBalance` مُصمَّم عمداً كطريقة على المستودع لا كحساب في الواجهة:

| | RTDB اليوم | PostgreSQL غداً |
|---|---|---|
| التنفيذ | جلب القيود + تجميع في الذاكرة | `SELECT … GROUP BY` واحد |
| الواجهة | **لا تتغيّر** | **لا تتغيّر** |

وقواعد لا تستطيع RTDB فرضها (مجموع السطور = الترويسة، المفاتيح الأجنبية) تنتقل من طبقة Domain إلى قيود في القاعدة نفسها — **دون أن يفقد Domain قيمته**، لأنه يبقى خط الدفاع الأول وأسرع اختبار.

---

## 4. قواعد حاكمة أثناء الانتقال

| # | القاعدة |
|---|---|
| 1 | **مصدر حقيقة واحد:** Firebase RTDB طوال المشروع |
| 2 | **ممنوع Dual Write** — لا يكتب نظامان لنفس البيانات |
| 3 | **ممنوع تغيير المخطّط** في هذا المشروع |
| 4 | **لا تسريب:** لا يظهر `DataSnapshot` ولا `ref` فوق طبقة Repository |
| 5 | **الطبقة لا تعرف ما فوقها:** Domain لا يعرف React ولا Firebase |
| 6 | **الصلاحية مرّتان:** في Application وفي قواعد الأمان — الواجهة ليست مصدر ثقة |
| 7 | **القديم يستهلك الجديد:** `accounting.js` يستدعي Domain — فلا ازدواج في المنطق |
