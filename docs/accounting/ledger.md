# دفتر الأستاذ لحساب واحد — `coaAccountOps` (Phase 5)

> توصيف سلوك قائم. لا يُغيَّر شيء هنا.

## الموقع والتوقيع

`public/accounting.js:1382` — `function coaAccountOps(code, from, to, includeDraft)`.
تُستهلَك من `coaRenderOpsPanel` (سطر 1405) التي تحسب **الرصيد الجاري** —
`coaAccountOps` نفسها لا تحسبه، تُعيد الحركات مرتَّبة فقط + `preNet`.

## المدخلات

`window.journalEntries` فقط. لا تقرأ `window.chartOfAccounts` (الحساب
المطلوب يُمرَّر كرمز `code` جاهز من المستدعي).

## الخوارزمية

1. لكل قيد: تُستبعَد `status === 'cancelled'` دائماً. إن `!includeDraft` تُستبعَد
   غير `posted` أيضاً.
2. لكل سطر بنفس `accountCode`: التاريخ الفعلي = `line.date || e.date`
   (🔎 انظر أدناه). إن `to && date > to` يُستبعَد السطر كلياً (لا preNet ولا ops).
3. إن `fsIsOpeningEntry(e)` أو `date < from`: يُطوى في `preNet` (رصيد ما قبل
   الفترة) ولا يظهر كسطر.
4. وإلا: يُضاف لمصفوفة `ops` — `{entryKey, date, number, description,
   costCenter, projectId, debit, credit, status}`.
5. `ops` تُرتَّب بالتاريخ ثم رقم القيد.

**الرصيد الجاري** (في `coaRenderOpsPanel`، ليس في `coaAccountOps`):
`opening = account.openingBalance + preNet`، ثم لكل عملية بالترتيب:
`running += debit - credit`.

## 🔎 اكتشاف — دعم `line.date` مستقلّ عن تاريخ القيد

`coaAccountOps` تقرأ `line.date || e.date` — أي أن سطراً منفرداً داخل قيد
يمكن أن يحمل تاريخاً مختلفاً عن ترويسة القيد، فيؤثّر في أي فترة يقع ضمنها
**لهذا السطر تحديداً** بمعزل عن بقية سطور نفس القيد. هذا **غير موثَّق** في
`ACCOUNTING_INTEGRITY_AUDIT.md §1.2` (بنية القيد). مسارات إنشاء القيود
السبعة المُلتقَطة في Phase 4 لا تبني `line.date` — فمن غير الواضح إن كانت هذه
قدرة مُستخدَمة فعلياً (ربما مخصَّصة للقيد اليدوي، غير مُلتقَط بعد) أو بقية
كود ميت. مُثبَت تنفيذياً في `tests/golden-master/ledger.test.mjs §[Z]`.
**ليست عطلاً** — توثيق سلوك حقيقي غير مسجَّل سابقاً.

## التغطية

`tests/golden-master/ledger.test.mjs` — 19 تأكيداً: دفتر فارغ · رصيد جارٍ
متسلسل عبر حركتين · افتتاحي مزدوج (ثابت + قيد) · رقم/بيان/تاريخ القيد · تاريخ
سطري مستقلّ · تضمين/استبعاد المسودات · استبعاد الملغاة دائماً.
