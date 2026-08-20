# نموذج الذرّية للإشعارين — فهرس

> ملف فهرسة. النموذج **واحد** (محرّك `notePostingBase.js` مشترك بإعدادات مختلفة)،
> لكنه مُوثَّق لكل مسار بمساراته وحقوله الفعلية:

- [`credit-note-atomicity.md`](credit-note-atomicity.md) — التصنيف الكامل
  (ATOMIC · TRANSACTIONAL · COMPENSATED · READ-ONLY)، وما **ليس** ذرّياً بصراحة
- [`debit-note-atomicity.md`](debit-note-atomicity.md) — نفس النموذج بمجموعات
  `debitNotes`/`purchaseInvoices` وعدّاد `counters/dn` واتجاه `invmov/out`

**الخلاصة:** كتابة ذرّية واحدة تضمّ المستند + القيد + كل حركات المخزون. العدّادات
وتحديث الفاتورة المصدر **خارجها** — معاملات مستقلّة بتعويض أفضل جهد، موثَّق لا مُدَّعى.
