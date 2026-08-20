# نموذج Idempotency للإشعارين — فهرس

- [`credit-note-idempotency.md`](credit-note-idempotency.md) — آلة الحالة الكاملة،
  ولماذا `status` الموجود يكفي مرساةً، والحدّ الصريح: «تكرار بمفتاح جديد ليس تكراراً»
- [`debit-note-idempotency.md`](debit-note-idempotency.md) — نفس النموذج على `debitNotes`

**الآلة:** معاملة خادمية على `{creditNotes|debitNotes}/{noteKey}/status` —
غائب → `draft` (نملك المطالبة) · `draft` → إجهاض · `posted` → إجهاض مع النتيجة الأصلية.
الانتقال `draft → posted` يقع في الكتابة الذرّية النهائية.
