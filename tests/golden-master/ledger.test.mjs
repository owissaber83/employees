// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  Golden Master · دفتر الأستاذ — coaAccountOps                      [Phase 5]  ║
// ║  التشغيل:  npm run test:gm:ledger                                             ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 لا كتابة في أي قاعدة بيانات · بيانات مُصنَّعة فقط · لا تغيير سلوك.          ║
// ║  الرصيد الجاري يُحسَب هنا (canonical-balances.canonicalLedger) تماماً كما        ║
// ║  يحسبه coaRenderOpsPanel في الواجهة — coaAccountOps نفسها لا تحسبه.            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { captureBalanceFn } from './capture-balances.mjs';
import { canonicalLedger, moneyEq } from './canonical-balances.mjs';
import * as F from '../fixtures/accounting/balances-world.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAP = path.join(HERE, 'snapshots');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

let pass = 0, fail = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
function snapshot(name, value) {
    const file = path.join(SNAP, name + '.json');
    const text = JSON.stringify(value, null, 2);
    if (!fs.existsSync(file) || UPDATE) { fs.writeFileSync(file, text + '\n'); console.log(`  📸 لقطة ${UPDATE ? 'مُحدَّثة' : 'مُنشأة'}: ${name}`); return; }
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved === text) { pass++; console.log(`  ✅ لقطة ثابتة: ${name}`); }
    else { fail++; console.log(`  ❌ لقطة تغيّرت: ${name}\n       شغّل UPDATE_SNAPSHOTS=1 بعد التحقّق من أن التغيير مقصود`); }
}

async function ledgerFor(code, from, to, includeDraft, world, opening) {
    const r = await captureBalanceFn('coaAccountOps', [code, from, to, includeDraft], world);
    return { r, gl: canonicalLedger(code, opening, r.result) };
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📖 [A] حساب بلا حركة — دفتر فارغ برصيد افتتاحي فقط');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const { r, gl } = await ledgerFor('2110', '', '', false, F.balancesWorld(), 0);
    eq('بلا خطأ', r.error, null);
    eq('لا حركات', gl.rows.length, 0);
    eq('الافتتاحي = 0 (لا رصيد ثابت ولا حركة سابقة)', gl.opening, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📖 [B–D] حركة مدين ثم دائن — رصيد جارٍ متسلسل');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // 1120 (البنك، افتتاحي 5000): حركتان — قيد افتتاحي +500، ثم حركة عادية -300
    const w = F.balancesWorld({ journalEntries: { open: F.openingEntry(), mv: F.movementEntry() } });
    const { r, gl } = await ledgerFor('1120', '', '', false, w, 5000);
    eq('بلا خطأ', r.error, null);
    eq('حركة واحدة فقط تظهر في الدفتر (القيد الافتتاحي طُوي في preNet)', gl.rows.length, 1);
    eq('الرصيد قبل الفترة = 5000 + 500 (القيد الافتتاحي)', gl.opening, 5500);
    eq('الحركة: دائن 300', gl.rows[0].credit, 300);
    eq('الرصيد الجاري بعدها = 5500 - 300', gl.rows[0].runningBalance, 5200);
    eq('الرصيد الختامي = آخر رصيد جارٍ', gl.closing, 5200);
    snapshot('ledger-bank-two-entries', gl);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📖 [E–F] رصيد افتتاحي على الحساب + قيد افتتاحي صريح معاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.balancesWorld({ journalEntries: { open: F.openingEntry() } });
    const { gl } = await ledgerFor('1120', '', '', false, w, 5000);
    eq('كلاهما يُطوى في preNet: 5000(ثابت) + 500(القيد) = 5500', gl.opening, 5500);
    eq('لا حركات ظاهرة — القيد الافتتاحي لا يظهر كسطر', gl.rows.length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📅 [Q–U] رقم القيد والبيان والتاريخ — كلها من سطر القيد أو ترويسته');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.balancesWorld({ journalEntries: { mv: F.movementEntry() } });
    const { r } = await ledgerFor('5110', '', '', false, w, 0);
    const op = r.result.ops[0];
    eq('رقم القيد', op.number, 'JV-2026-01');
    eq('البيان من السطر إن وُجد', op.description, 'مصروف تشغيلي');
    eq('التاريخ من ترويسة القيد إن لم يوجد تاريخ سطري', op.date, '2026-03-15');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🗓️ [Z] تاريخ سطري مستقلّ عن تاريخ القيد — سلوك غير موثَّق سابقاً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // ⚠️ اكتشاف: coaAccountOps تدعم `line.date` كتاريخ فعلي مستقلّ عن تاريخ ترويسة القيد.
    // هذا غير مذكور في ACCOUNTING_INTEGRITY_AUDIT §1.2 (بنية القيد الموثَّقة) ولا في أي مكان آخر —
    // إما ميزة غير مُستخدَمة فعلياً في مسارات إنشاء القيود السبعة (لا يبني أي منها line.date)، أو
    // مخصَّصة للقيد اليدوي (غير مُلتقَط بعد). نُسجِّلها ملاحظة توثيقية لا عطلاً.
    const w = F.balancesWorld({
        journalEntries: { mv: F.movementEntry({ lines: [{ accountCode: '5110', debit: 300, credit: 0, date: '2026-03-01' }, { accountCode: '1120', debit: 0, credit: 300 }] }) }
    });
    const { r } = await ledgerFor('5110', '', '', false, w, 0);
    eq('🔎 تاريخ السطر يتفوّق على تاريخ ترويسة القيد (2026-03-15)', r.result.ops[0].date, '2026-03-01');
    console.log('       ⇒ موثَّق في docs/accounting/ledger.md — سلوك حقيقي غير مسجَّل سابقاً، لا يُعتبر بحكم البقية عطلاً');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📝 [مسودات] استبعاد/تضمين — و«ملغاة» تُستبعَد دائماً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const w = F.balancesWorld({ journalEntries: { mv: F.movementEntry(), d: F.draftEntry(), c: F.movementEntry({ status: 'cancelled', number: 'JV-CANCEL' }) } });
    const r1 = await captureBalanceFn('coaAccountOps', ['5110', '', '', false], w);
    eq('بلا تضمين المسودات: حركة واحدة فقط (الملغاة مُستبعَدة دائماً)', r1.result.ops.length, 1);
    const r2 = await captureBalanceFn('coaAccountOps', ['5110', '', '', true], w);
    eq('بتضمين المسودات: حركتان (المسوّدة + المرحَّلة) — الملغاة تبقى مُستبعَدة', r2.result.ops.length, 2);
    ok('ولا سطر واحد منسوب لـJV-CANCEL', !r2.result.ops.some(o => o.number === 'JV-CANCEL'));
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
