// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · عزل المستأجرين في دوال الأرصدة                    [Phase 5]  ║
// ║  التشغيل:  npm run test:gm:tenant                                             ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 لا كتابة في أي قاعدة بيانات · بيانات مُصنَّعة فقط · لا تغيير سلوك.          ║
// ║  الفارق عن [E] في posting-integrity.test.mjs (Phase 4): هناك تحقّقنا أن كل      ║
// ║  استدعاء منفصل يقرأ بياناته فقط (بديهي: كل عالم مُنشأ من جديد). هنا نختبر       ║
// ║  الحالة الأخطر فعلياً: هل **الكاش المشترك** (`_fsBalancesCache`) يُسرِّب بيانات   ║
// ║  مستأجر إلى استعلام مستأجر آخر لو استُخدم نفس مرجع الكاش عبر تبديل مستأجر؟      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { captureBalanceFn } from './capture-balances.mjs';
import * as F from '../fixtures/accounting/balances-world.mjs';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏢 [أساسي] عالمان منفصلان لا يتشاركان شيئاً (بديهي — يوثّق لا يكتشف)');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const A = F.balancesWorld({ journalEntries: { j1: F.movementEntry() } });                // مصروف 300 لشركة A
    const B = F.balancesWorld({ journalEntries: { j1: F.movementEntry({ totalDebit: 900, totalCredit: 900, lines: [{ accountCode: '5110', debit: 900, credit: 0 }, { accountCode: '1120', debit: 0, credit: 900 }] }) } }); // 900 لشركة B

    const ra = await captureBalanceFn('calcFSBalances', ['', '', ['posted']], A);
    const rb = await captureBalanceFn('calcFSBalances', ['', '', ['posted']], B);
    eq('مصروف مستأجر A = 300', ra.result.balances['5110'].periodDebit, 300);
    eq('مصروف مستأجر B = 900 — مستقلّ تماماً', rb.result.balances['5110'].periodDebit, 900);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔴 [الحالة الحرجة] كاش calcFSBalances مشترك عبر تبديل مستأجر متخيَّل');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // نحاكي أسوأ سيناريو: مرجع _fsBalancesCache واحد يُمرَّر عمداً بين استدعاءين
    // بمرجعَي journalEntries مختلفين — تماماً كما لو نُسي إعادة تهيئة الكاش عند buildRefs()
    const sharedCache = { je: null, coa: null, map: new Map() };

    const jeA = { j1: F.movementEntry() };                                                    // 300 — مستأجر A
    const jeB = { j1: F.movementEntry({ totalDebit: 900, totalCredit: 900, lines: [{ accountCode: '5110', debit: 900, credit: 0 }, { accountCode: '1120', debit: 0, credit: 900 }] }) }; // 900 — مستأجر B

    const worldA = F.balancesWorld({ journalEntries: jeA, _fsBalancesCache: sharedCache });
    const worldB = F.balancesWorld({ journalEntries: jeB, _fsBalancesCache: sharedCache });

    const ra = await captureBalanceFn('calcFSBalances', ['', '', ['posted']], worldA);
    const rb = await captureBalanceFn('calcFSBalances', ['', '', ['posted']], worldB);

    eq('استعلام A يُنتج 300', ra.result.balances['5110'].periodDebit, 300);
    ok('✅ استعلام B **لا يُعيد نتيجة A المخزَّنة** رغم مشاركة مرجع الكاش — 900 لا 300',
        rb.result.balances['5110'].periodDebit === 900, `فعلياً: ${rb.result.balances['5110'].periodDebit}`);
    console.log('       ⇒ التحقّق من مرجع window.journalEntries (`_fsBalancesCache.je !== journalEntries`) يُفشل الكاش القديم فعلياً');
    console.log('       عند تغيّر المرجع — وهو ما يضمنه onValue بإعادة بناء الكائن مع كل لقطة جديدة');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏢 [رصيد عميل] رمز مطابق بين مستأجرين — لا تسرّب بفضل عزل الحالة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // نفس معرّف العميل 'C1' في شركتين مختلفتين تماماً — سيناريو واقعي (المفاتيح تُنشَأ بمعزل)
    const A = F.balancesWorld({ customers: { C1: { code: 'CUS-01', nameAr: 'عميل A', openingBalance: 100 } } });
    const B = F.balancesWorld({ customers: { C1: { code: 'CUS-01', nameAr: 'عميل B', openingBalance: 9999 } } });
    const ra = await captureBalanceFn('calcCustomerBalance', ['C1'], A);
    const rb = await captureBalanceFn('calcCustomerBalance', ['C1'], B);
    eq('رصيد C1 لدى A = 100', ra.result.opening, 100);
    eq('رصيد C1 لدى B = 9999 — لا خلط رغم تطابق المفتاح', rb.result.opening, 9999);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
