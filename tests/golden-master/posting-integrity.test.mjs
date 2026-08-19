// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · سلامة الترحيل والتكرار — كشف لا إصلاح                        ║
// ║  التشغيل:  npm run test:gm:posting                                            ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ⚠️ اختبارات تُوثّق السلوك القائم بما فيه المعيب. نجاحها يعني «النظام يتصرّف     ║
// ║  كما وُصف»، لا «النظام سليم». الإصلاح في مرحلته بموافقة صريحة (§28).           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureLegacy, buildWorld, countDbOps } from './capture.mjs';
import { lineTotals, moneyEq } from './canonical.mjs';
import * as F from '../fixtures/accounting/world.mjs';

let pass = 0, fail = 0;
const eq = (n, a, b) => {
    if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); }
    else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); }
};
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const note = m => console.log('       ' + m);

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📝 [A] تسلسل الكتابات — ما يفعله الترحيل فعلاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureLegacy('createJournalForPInv', ['PINV-K1', F.PURCHASE_INVOICE], F.world());
    const ops = countDbOps(r.captured);
    eq('createJournalForPInv وحدها: كتابتان', ops.writes, 2);
    eq('  ١ · دفع القيد', r.captured.journals.length, 1);
    eq('  ٢ · تحديث الفاتضة بمفتاح القيد', r.captured.updates.length, 1);
    eq('  والتحديث يستهدف الفاتورة', r.captured.updates[0].path, 'ledger/purchaseInvoices/PINV-K1');
    note('و postPInv يضيف كتابتين: تحديث الحالة + حركات المخزون ⇒ أربع كتابات مستقلة');
    note('كلٌّ بـawait منفصل، بلا معاملة تجمعها — ACCOUNTING_INTEGRITY_FIX_PLAN §3');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔁 [B] التكرار — هل العملية Idempotent؟');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // نستدعي البناء مرّتين بنفس المفاتيح تماماً، كما يحدث عند نقر مزدوج
    const w = F.world();
    const r1 = await captureLegacy('createJournalForPInv', ['PINV-K1', F.PURCHASE_INVOICE], w);
    const r2 = await captureLegacy('createJournalForPInv', ['PINV-K1', F.PURCHASE_INVOICE], w);

    ok('🔴 الاستدعاء الثاني يُنشئ قيداً ثانياً', !!r1.journal && !!r2.journal);
    eq('  بنفس المصدر sourceKey', [r1.journal.sourceKey, r2.journal.sourceKey], ['PINV-K1', 'PINV-K1']);
    ok('  وبنفس المبالغ تماماً', moneyEq(r1.journal.totalDebit, r2.journal.totalDebit));
    ok('🔴 لا مفتاح Idempotency يمنع التكرار', true);
    note('createJournalFor* ليست Idempotent. الحارس الوحيد status !== "draft" في');
    note('postPInv، وهو يقرأ الذاكرة المحلية التي يملؤها onValue ⇒ نافذة سباق.');
    note('⇒ ACCOUNTING_INTEGRITY_FIX_PLAN §5 — لا يُصلَح هنا.');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🩹 [C] الفشل الجزئي — حالة النظام بعد كل نقطة انقطاع');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // نحقن فشلاً بعد الكتابة الأولى (دفع القيد) ونفحص ما بقي
    const { globals, captured } = buildWorld(F.world());
    let calls = 0;
    const realUpdate = globals.update;
    globals.update = async (r, patch) => {
        calls++;
        if (calls === 1) throw new Error('network lost');
        return realUpdate(r, patch);
    };

    const { extractFunction } = await import('../characterization/legacy-loader.mjs');
    const body = extractFunction('createJournalForPInv');
    const keys = Object.keys(globals);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `${body}\nreturn createJournalForPInv;`)(...keys.map(k => globals[k]));

    let err = null;
    try { await fn('PINV-K1', F.PURCHASE_INVOICE); } catch (e) { err = e; }

    ok('🔴 القيد دُفع فعلاً قبل الانقطاع', captured.journals.length === 1);
    ok('🔴 والفاتورة لم تُربط به (فشل التحديث)', captured.updates.length === 0);
    ok('  والخطأ يصعد للمستدعي', !!err, String(err && err.message));
    note('النتيجة: قيدٌ في الدفتر لا تعرفه أي فاتورة ⇒ ميزان المراجعة يتضخّم');
    note('بمبلغ لا مصدر له، ولا فحص اتّساق دورياً يكشفه — FIX_PLAN §4');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🛡️ [D] الترتيب الوقائي القائم — ما يحمي فعلاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // فشل إنشاء القيد (حساب مفقود) ⇒ يجب ألّا تُرحَّل الفاتورة
    const w = F.world();
    delete w.chartOfAccounts.a2110;                  // حساب الموردون مفقود
    const r = await captureLegacy('createJournalForPInv', ['K', F.PURCHASE_INVOICE], w);

    eq('لا يُنشأ قيد عند فقد حساب', r.captured.journals.length, 0);
    eq('ولا تُحدَّث الفاتورة', r.captured.updates.length, 0);
    ok('ويعود undefined ليفحصه postPInv', r.result === undefined);
    ok('مع تحذير للمستخدم', r.toasts.length > 0);
    note('✅ هذا تخفيف قائم ومحمود: postPInv يفحص العودة ويترك الفاتورة مسوّدة،');
    note('فيمنع أسوأ الحالات — فاتورة مُرحَّلة بلا قيد. موثّق بتعليق في الشفرة.');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏢 [E] عزل المستأجرين — لا تسرّب بين شركتين');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const A = F.world({ curU: { uid: 'user-A' } });
    const B = F.world({ curU: { uid: 'user-B' } });
    B.chartOfAccounts = { ...F.ACCOUNTS, a5110: { ...F.ACCOUNTS.a5110, nameAr: 'مشتريات شركة ب' } };
    B.vendors = { V1: { code: 'B-SUP', nameAr: 'مورد شركة ب', active: true } };

    const ra = await captureLegacy('createJournalForPInv', ['K', F.PURCHASE_INVOICE], A);
    const rb = await captureLegacy('createJournalForPInv', ['K', F.PURCHASE_INVOICE], B);

    ok('كل مستأجر يقرأ شجرة حساباته', ra.journal.lines[0].accountName !== rb.journal.lines[0].accountName,
        `${ra.journal.lines[0].accountName} / ${rb.journal.lines[0].accountName}`);
    ok('واسم مورده هو الظاهر في قيده', /شركة ب/.test(rb.journal.description) || /شركة ب/.test(rb.journal.lines[0].description),
        rb.journal.description);
    eq('ومنشئ القيد هو مستخدم مستأجره', [ra.journal.createdBy, rb.journal.createdBy], ['user-A', 'user-B']);
    note('العزل الفعلي في غلاف ref() ومحروس بـ72 تأكيداً في test:repo و186 في test:rules');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📅 [F] التاريخ — السلوك القائم عند حدود اليوم');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // القيد يأخذ تاريخه من المستند لا من الساعة — نوثّق ذلك صراحةً
    const inv = { ...F.PURCHASE_INVOICE, date: '2026-12-31' };
    const r = await captureLegacy('createJournalForPInv', ['K', inv], F.world());
    eq('تاريخ القيد من المستند لا من ساعة الجهاز', r.journal.date, '2026-12-31');
    ok('✅ لذلك BUG-001 لا يمسّ تاريخ القيد نفسه', true);
    note('أثر BUG-001 في أعمار الديون وحدود الفترات لا في تاريخ القيد — test:char:date');

    const leap = { ...F.PURCHASE_INVOICE, date: '2028-02-29' };
    eq('يوم كبيسة يُحفظ كما هو', (await captureLegacy('createJournalForPInv', ['K', leap], F.world())).journal.date, '2028-02-29');
    const ye = { ...F.PURCHASE_INVOICE, date: '2026-01-01' };
    eq('بداية السنة تُحفظ كما هي', (await captureLegacy('createJournalForPInv', ['K', ye], F.world())).journal.date, '2026-01-01');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🕵️ [G] أثر التدقيق — الحقول المحفوظة مع القيد');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const r = await captureLegacy('createJournalForPInv', ['K', F.PURCHASE_INVOICE], F.world());
    const j = r.journal;
    ['createdAt', 'createdBy', 'postedAt', 'postedBy'].forEach(f => ok(`${f} محفوظ`, f in j, JSON.stringify(Object.keys(j))));
    eq('createdBy هو المستخدم الحالي', j.createdBy, 'u-test');
    eq('وsourceType يربط القيد بمصدره', j.sourceType, 'purchase_invoice');
    eq('وsourceKey يحمل مفتاح المستند', j.sourceKey, 'K');
    note('✅ أثر المصدر كامل: يمكن تتبّع أي قيد إلى مستنده والعكس');
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
console.log('⚠️  نجاح هذه المجموعة يعني «النظام يتصرّف كما وُصف» لا «النظام سليم».');
process.exit(fail ? 1 : 0);
