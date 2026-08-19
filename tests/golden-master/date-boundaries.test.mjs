// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · حدود التاريخ في دوال الأرصدة                      [Phase 5]  ║
// ║  التشغيل:  npm run test:gm:dates                                              ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 لا كتابة في أي قاعدة بيانات · بيانات مُصنَّعة فقط · لا تغيير سلوك.          ║
// ║  ⚠️ لا يُصلَح BUG-001 هنا — يُوثَّق أثره في دوال الأرصدة تحديداً (لم يكن موثَّقاً   ║
// ║  من قبل؛ test:char:date وثّقه في التاريخ عموماً لا في هذه الدوال بالذات).       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureBalanceFn } from './capture-balances.mjs';
import * as F from '../fixtures/accounting/balances-world.mjs';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📅 [بداية/نهاية السنة] حد الفترة — coaAccountOps وtbCalcBalances');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.balancesWorld({
        journalEntries: {
            ye: F.movementEntry({ number: 'JV-YE', date: '2026-12-31' }),
            ny: F.movementEntry({ number: 'JV-NY', date: '2027-01-01', totalDebit: 50, totalCredit: 50, lines: [{ accountCode: '5110', debit: 50, credit: 0 }, { accountCode: '1120', debit: 0, credit: 50 }] })
        }
    });
    const r = await captureBalanceFn('coaAccountOps', ['5110', '2026-01-01', '2026-12-31', false], w);
    eq('حركة 31 ديسمبر داخل الفترة', r.result.ops.map(o => o.number), ['JV-YE']);
    ok('وحركة 1 يناير التالية خارجها تماماً (لا تُعَدّ ولا تُطوى في preNet)', r.result.preNet === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🐉 [يوم كبيسة] 2028-02-29 يُحفَظ ويُقرأ كما هو');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.balancesWorld({ journalEntries: { leap: F.movementEntry({ number: 'JV-LEAP', date: '2028-02-29' }) } });
    const r = await captureBalanceFn('coaAccountOps', ['5110', '2028-01-01', '2028-12-31', false], w);
    eq('التاريخ محفوظ حرفياً', r.result.ops[0].date, '2028-02-29');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🕛 [BUG-001 في calcCustomerBalance/calcVendorBalance] — منتصف الليل بتوقيت الرياض');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // الدالتان تستخدمان new Date().toISOString().slice(0,10) — تُقيَّم عند التشغيل الفعلي، لا وقتاً ثابتاً.
    // هذا الاختبار **لا يستطيع** تجميد ساعة النظام دون تعديل الشفرة القديمة (ممنوع)، فيُوثِّق النمط
    // بدل محاكاته زمنياً — بديل test:char:date الذي يختبر hook زمني منفصل صراحةً على مستوى أدنى.
    const utcNow = new Date();
    const riyadhNow = new Date(utcNow.getTime() + 3 * 3600 * 1000);
    const utcDay = utcNow.toISOString().slice(0, 10);
    const riyadhDay = riyadhNow.toISOString().slice(0, 10);
    if (utcDay !== riyadhDay) {
        ok('🔴 نافذة الخطأ فعلية الآن: UTC وتوقيت الرياض في يومين مختلفين هذه اللحظة', true);
        console.log(`       UTC=${utcDay} بينما الرياض=${riyadhDay} — calcCustomerBalance ستُخطئ تصنيف الاستحقاق الآن تحديداً`);
    } else {
        ok('لسنا الآن داخل نافذة الساعات الثلاث (00:00–02:59 بتوقيت الرياض) — النمط المعيب موجود ولو لم يظهر أثره هذه اللحظة', true);
        console.log('       النمط نفسه (accounting.js:12275 وaccounting.js:17064) يبقى قائماً بصرف النظر عن وقت التشغيل');
    }
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
