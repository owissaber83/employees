# تكامل القيد — `assertBalanced` و`validateJournal` (Phase 6)

> يُغلق `ACCOUNTING_INTEGRITY_FIX_PLAN.md §1`/§2 على مستوى الخدمة الجديدة —
> **لا** على مستوى `database.rules.json` (لم تُلمَس، ولن — §18).

## الثغرة الأصلية (Phase 4، مُثبَتة بالتشغيل)

`database.rules.json` تحرس فقط:
```
newData.child('totalDebit').val() === newData.child('totalCredit').val()
```
مقارنة رقمين في الترويسة. RTDB **لا تملك بنيوياً** جمعاً على مصفوفة —
`tests/golden-master/journal.test.mjs §[5]` أثبت أن قيداً ترويسته
`1000/1000` وسطوره الفعلية `5000/5000` (موزَّعة اختلالاً) **يجتاز** هذه
الحراسة.

## الحل — فحص من السطور لا من الترويسة

```js
// src/domain/accounting/posting/assertBalanced.js
export function assertBalanced(journal) {
    const t = lineTotals(journal.lines);              // ← يُحسَب من السطور فعلياً
    if (!moneyEq(t.debit, t.credit)) throw new UnbalancedJournalError(...);
    if (!moneyEq(headerDebit, headerCredit)) throw new UnbalancedJournalError(...);
    // 🔴 الفحص الحاسم: مجموع السطور يُقارَن بالترويسة، لا العكس
    if (!moneyEq(t.debit, headerDebit) || !moneyEq(t.credit, headerCredit)) {
        throw new UnbalancedJournalError(...);
    }
}
```

نفس القيد المزوَّر من journal.test.mjs §[5] يُثبَت رفضه هنا صراحةً —
`tests/services/journalIntegrity.test.mjs` قسم «الثغرة المُغلَقة».

## سياسة الدقّة — مستوردة لا مُعاد اختراعها

`round2`/`moneyEq` مستوردتان من `public/calc.js` مباشرةً (نفس المصدر الذي
استخدمته `tests/golden-master/canonical.mjs` في Phase 4/5) — **لا نسخة
ثالثة موازية**. التسامح `0.01` كما هو، `Math.round(n*100)/100` كما هو.
مُثبَت: `moneyEq(1000, 1000.005)===true` (ضمن التسامح) و
`moneyEq(1000, 1000.02)===false` (يتجاوزه) — `tests/services/journalIntegrity.test.mjs`.

## `validateJournal` — بنية قبل توازن

فحوص بنيوية بحتة، **قبل** حتى استدعاء `assertBalanced`:

| الفحص | الرفض عند |
|---|---|
| سطر واحد على الأقل | `lines.length === 0` |
| رمز حساب على كل سطر | `!line.accountCode` |
| مبلغ رقمي | `!Number.isFinite(debit/credit)` |
| لا سالب | `debit < 0 \|\| credit < 0` |
| لا مدين ودائن معاً على سطر | `debit > 0 && credit > 0` |
| لا سطر صفري بالكامل | `debit === 0 && credit === 0` |
| إجمالي الترويسة رقمي | `!Number.isFinite(totalDebit/totalCredit)` |

**لا إصلاح صامت في أي مكان** — كل عطل يُرفَض بخطأ مُصنَّف (`ValidationError`)
يحمل `index`/`line`/القيم الفعلية، لا يُعدَّل شيء تلقائياً (§10 صراحةً).

## متى يُستدعَيان

`postPurchaseInvoice.js` يستدعيهما **مرّتين منطقياً**: مرّة على معاينة
برقم مؤقّت (يكشف الأعطال قبل حجز رقم قيد حقيقي — `docs/services/atomicity.md`)،
ومرّة ضمنية عبر `buildJournal` الممرَّرة للمستودع (بناء نهائي بالرقم
الحقيقي — لن يفشل بعد أن نجحت المعاينة، بفرض عدم تغيّر المدخلات بين
الخطوتين المتزامنتين تماماً).

## التغطية

`tests/services/journalIntegrity.test.mjs` — 15 تأكيداً: متوازن · غير
متوازن · الثغرة المُغلَقة (ترويسة/سطور) · صفري · حساب مفقود · مبلغ غير
صالح · مدين ودائن معاً · سالب · حدّ التسامح (0.005 يمرّ، 0.02 يُرفض) ·
بلا سطور. + `docs/accounting/*` (Phase 5) لفحوص التكامل على مستوى
التقارير (ميزان المراجعة، الأرصدة).
