// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · التكرار (Idempotency) — دوال الأرصدة و ensureStdAccount  [Phase 5] ║
// ║  التشغيل:  npm run test:gm:idem                                               ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ⚠️ اختبارات تُوثّق السلوك القائم بما فيه المعيب. نجاحها يعني «النظام يتصرّف     ║
// ║  كما وُصف»، لا «النظام سليم». لا يُصلَح شيء هنا (§20). يبني على اكتشاف Phase 4  ║
// ║  [B] (posting-integrity.test.mjs): إرسال مزدوج لفاتورة يُنتج قيدين. هذا الملف   ║
// ║  يجيب سؤالاً لم تُجِبه Phase 4: **أين يظهر أثر القيدين فعلياً، وأين لا يظهر؟**   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureBalanceFn } from './capture-balances.mjs';
import * as F from '../fixtures/accounting/balances-world.mjs';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const note = m => console.log('       ' + m);

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [ensureStdAccount] استدعاءان متتاليان لحساب قياسي غير موجود بعد');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // نستدعي المِشجب مرّتين بنفس chartOfAccounts (الناقصة) — تماماً كما يحدث في الإنتاج
    // حين تُستدعى ensureStdAccount مرّتين قبل أن يُعيد onValue تحديث window.chartOfAccounts
    // (الفاصل الزمني بين push() الأول واكتمال جولة RTDB الكاملة).
    const missingCoa = {};
    const r1 = await captureBalanceFn('ensureStdAccount', ['1130'], { chartOfAccounts: missingCoa });
    const r2 = await captureBalanceFn('ensureStdAccount', ['1130'], { chartOfAccounts: missingCoa });   // نفس الحالة — لم تُحدَّث بعد

    ok('🔴 الاستدعاء الأول ينشئ الحساب', r1.captured.pushes.length === 1);
    ok('🔴 والثاني — بنفس الحالة الناقصة — ينشئه مرّة أخرى', r2.captured.pushes.length === 1);
    eq('  بنفس الرمز 1130 في الاثنين', [r1.captured.pushes[0].data.code, r2.captured.pushes[0].data.code], ['1130', '1130']);
    // ⚠️ ملاحظة عن المِشجب: عدّاد المفاتيح الوهمي هنا يُصفَّر لكل استدعاء `captureBalanceFn`
    // منفصل — فالمفتاحان الوهميّان قد يتطابقان صدفةً هنا رغم أن push() الحقيقي في Firebase
    // يولّد مفتاحاً عالمياً فريداً في كل مرّة بلا استثناء (طابع زمني + عشوائية). الأثر
    // الحقيقي (سطران بنفس الرمز 1130 في القاعدة الفعلية) لا يتأثر بهذا التبسيط في المِشجب.
    ok('🔴 وفي كل الأحوال: كتابتان منفصلتان تماماً — لا ربط بينهما، لا فحص وجود بينهما', r1.captured.pushes[0] !== r2.captured.pushes[0]);
    note('ensureStdAccount ليست Idempotent إن استُدعيت قبل تحديث window.chartOfAccounts.');
    note('النتيجة الواقعية: حسابان قياسيان بنفس الرمز 1130 في الشجرة — يُفسِد شجرة الحسابات لا الدفتر مباشرةً.');
    note('⇒ مُسجَّل: BUG-006 في BUGS_TO_FIX.md — لا يُصلَح في Phase 5.');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n✅ [ensureStdAccount] استدعاء ثانٍ بعد أن يعكس window.chartOfAccounts الإنشاء الأول');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // نحاكي التحديث الذي يفترض المشجب أنه سيحدث في الإنتاج بعد onValue
    const r1 = await captureBalanceFn('ensureStdAccount', ['1130'], { chartOfAccounts: {} });
    const created = r1.captured.pushes[0].data;
    const r2 = await captureBalanceFn('ensureStdAccount', ['1130'], { chartOfAccounts: { auto1: created } });   // الحالة أصبحت مُحدَّثة الآن
    eq('لا كتابة ثانية — الحساب أصبح موجوداً', r2.captured.pushes.length, 0);
    eq('وتُعاد نفس البيانات الموجودة', r2.result.code, '1130');
    note('✅ Idempotent بشرط واحد: تحديث window.chartOfAccounts بين الاستدعاءين — وهذا ما لا يضمنه التزامن.');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [الأثر المالي المتباين] قيد مكرَّر — أين يظهر وأين لا يظهر');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // نحاكي ناتج Phase 4 [B] مباشرةً: نفس الفاتورة تُرحَّل مرّتين ⇒ قيدان بنفس sourceKey.
    // نحقن القيدين الاثنين في window.journalEntries (كما ستكونان فعلاً في RTDB بعد push مرّتين)
    // بينما نُبقي purchaseInvoices بفاتورة واحدة فقط (الفاتورة نفسها، غير مضاعَفة — هي مستند واحد).
    const dup1 = F.movementEntry({ number: 'JV-1', sourceType: 'purchase_invoice', sourceKey: 'PINV-1', lines: [{ accountCode: '5110', debit: 11500, credit: 0 }, { accountCode: '2110', debit: 0, credit: 11500 }], totalDebit: 11500, totalCredit: 11500 });
    const dup2 = F.movementEntry({ number: 'JV-2', sourceType: 'purchase_invoice', sourceKey: 'PINV-1', lines: [{ accountCode: '5110', debit: 11500, credit: 0 }, { accountCode: '2110', debit: 0, credit: 11500 }], totalDebit: 11500, totalCredit: 11500 });

    const w = F.balancesWorld({
        journalEntries: { j1: dup1, j2: dup2 },
        vendors: { V1: { code: 'SUP-01', nameAr: 'مورد', openingBalance: 0 } },
        purchaseInvoices: { p1: F.purchaseInvoice() }   // فاتورة واحدة فقط، 11,500، غير مدفوعة
    });

    const rTb = await captureBalanceFn('tbCalcBalances', [], w);
    const rBal = await captureBalanceFn('calcVendorBalance', ['V1'], w);

    const payables = rTb.result.displayBalances.find(b => b.account.code === '2110');
    ok('🔴 ميزان المراجعة: حساب الموردين يُظهر 23,000 (القيدان معاً) لا 11,500', payables.credit === 23000, `فعلياً: ${payables.credit}`);
    ok('🔴 التوازن الإجمالي يبقى ✅ متوازناً — القيدان كلاهما صحيح البناء، فالتكرار لا يكسر التوازن', rTb.result.debitCreditBalance === true);
    console.log('       ⇒ لا فحص اتّساق يكشف هذا: ميزان المراجعة متوازن ومصدَّق، والرقم فيه خاطئ بالكامل');

    ok('✅ بينما رصيد المورد (المبني على الفاتورة لا القيد) يبقى صحيحاً: 11,500', rBal.result.invoiced === 11500);
    note('🔴🔴 الأثر الأخطر: محاسب يفتح شاشة "أرصدة الموردين" فيرى 11,500 صحيحاً تماماً،');
    note('بينما ميزان المراجعة يحمل صمتاً 23,000 لنفس المورد — تناقض بين شاشتين لا تنبيه بينهما.');
    note('⇒ مُسجَّل: BUG-007 في BUGS_TO_FIX.md، ويُحدِّث ACCOUNTING_INTEGRITY_FIX_PLAN.md §5.');
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
console.log('⚠️  نجاح هذه المجموعة يعني «النظام يتصرّف كما وُصف» لا «النظام سليم».');
process.exit(fail ? 1 : 0);
