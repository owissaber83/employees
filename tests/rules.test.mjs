// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🔒 اختبارات قواعد أمان Firebase RTDB — عزل المستأجرين، الأدوار، الاشتراك    ║
// ║  التشغيل:  npm run test:rules   (يتطلب Java + firebase-tools + npm install) ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update } from 'firebase/database';
import { readFileSync } from 'node:fs';

const FUTURE = Date.now() + 30 * 24 * 3600 * 1000;   // اشتراك سارٍ
const PAST = Date.now() - 24 * 3600 * 1000;          // اشتراك منتهٍ

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-gbr-rules',
  database: { rules: readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8') },
});

// ── بذر بيانات أولية (بتجاوز القواعد) ──────────────────────────────────────
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.database();
  await set(ref(db, 'operators/op1'), true);
  // المستأجر A (اشتراك سارٍ) — مدير، محاسب، مشاهد
  await set(ref(db, 'tenants/A/meta'), { createdBy: 'adminA', accessUntil: FUTURE });
  await set(ref(db, 'tenants/A/ledger/users/adminA'), { role: 'admin', active: true });
  await set(ref(db, 'tenants/A/ledger/users/acctA'), { role: 'accountant', active: true });
  await set(ref(db, 'tenants/A/ledger/users/viewerA'), { role: 'viewer', active: true });
  await set(ref(db, 'tenants/A/ledger/journalEntries/j1'), { number: 'JV-1' });
  await set(ref(db, 'tenants/A/ledger/auditLog/e1'), { action: 'seed' });
  await set(ref(db, 'tenants/A/ledger/_errorLog/err1'), { kind: 'js-error', message: 'seed' });
  // المستأجر B (منفصل تماماً)
  await set(ref(db, 'tenants/B/meta'), { createdBy: 'adminB', accessUntil: FUTURE });
  await set(ref(db, 'tenants/B/ledger/users/adminB'), { role: 'admin', active: true });
  await set(ref(db, 'tenants/B/ledger/journalEntries/j2'), { number: 'JV-B' });
  // المستأجر منتهي الاشتراك
  await set(ref(db, 'tenants/EXP/meta'), { createdBy: 'adminE', accessUntil: PAST });
  await set(ref(db, 'tenants/EXP/ledger/users/adminE'), { role: 'admin', active: true });
});

// ── سياقات المستخدمين ──────────────────────────────────────────────────────
const db = {
  unauth: testEnv.unauthenticatedContext().database(),
  adminA: testEnv.authenticatedContext('adminA').database(),
  acctA: testEnv.authenticatedContext('acctA').database(),
  viewerA: testEnv.authenticatedContext('viewerA').database(),
  adminE: testEnv.authenticatedContext('adminE').database(),
  stranger: testEnv.authenticatedContext('stranger').database(),  // مصادَق لكن غير عضو في أي مستأجر
  op: testEnv.authenticatedContext('op1').database(),
};

// ── مُشغّل اختبارات مبسّط ───────────────────────────────────────────────────
let pass = 0, fail = 0;
async function test(name, promise) {
  try { await promise; console.log('  ✅ ' + name); pass++; }
  catch (e) { console.log('  ❌ ' + name + '\n       ' + (e.message || e)); fail++; }
}

console.log('\n🔒 عزل المستأجرين (الأهم):');
await test('عضو A لا يقرأ قيود B', assertFails(get(ref(db.adminA, 'tenants/B/ledger/journalEntries'))));
await test('عضو A لا يكتب في قيود B', assertFails(set(ref(db.adminA, 'tenants/B/ledger/journalEntries/hack'), { number: 'HACK' })));
await test('عضو A لا يقرأ قائمة كل المستأجرين', assertFails(get(ref(db.adminA, 'tenants'))));

console.log('\n🔑 المصادقة والعضوية:');
await test('غير المصادَق لا يقرأ قيود A', assertFails(get(ref(db.unauth, 'tenants/A/ledger/journalEntries'))));
await test('غير المصادَق لا يكتب في A', assertFails(set(ref(db.unauth, 'tenants/A/ledger/journalEntries/x'), { number: 'X' })));
await test('مستخدم غريب (غير عضو) لا يقرأ قيود A', assertFails(get(ref(db.stranger, 'tenants/A/ledger/journalEntries'))));

console.log('\n👥 الأدوار:');
await test('محاسب A يقرأ قيود A', assertSucceeds(get(ref(db.acctA, 'tenants/A/ledger/journalEntries'))));
await test('محاسب A يكتب قيدًا في A', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/journalEntries/j3'), { number: 'JV-3' })));
await test('مشاهد A (viewer) لا يكتب قيدًا', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/journalEntries/j4'), { number: 'JV-4' })));
await test('محاسب A لا يقرأ سجل التدقيق (admin فقط)', assertFails(get(ref(db.acctA, 'tenants/A/ledger/auditLog'))));
await test('مدير A يقرأ سجل التدقيق', assertSucceeds(get(ref(db.adminA, 'tenants/A/ledger/auditLog'))));

console.log('\n💳 بوابة الاشتراك والمشغّل:');
await test('اشتراك منتهٍ يمنع الكتابة', assertFails(set(ref(db.adminE, 'tenants/EXP/ledger/journalEntries/jx'), { number: 'X' })));
await test('المشغّل (operator) يقرأ قائمة المستأجرين', assertSucceeds(get(ref(db.op, 'tenants'))));

console.log('\n🐞 سجل الأخطاء (_errorLog):');
await test('عضو A يُنشئ سجل خطأ (إلحاق)', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/_errorLog/e_new'), { kind: 'js-error', message: 'm' })));
await test('مدير A يقرأ سجل الأخطاء', assertSucceeds(get(ref(db.adminA, 'tenants/A/ledger/_errorLog'))));
await test('محاسب A لا يقرأ سجل الأخطاء (admin/operator فقط)', assertFails(get(ref(db.acctA, 'tenants/A/ledger/_errorLog'))));
await test('لا يمكن تعديل سجل خطأ موجود (إلحاق فقط)', assertFails(set(ref(db.acctA, 'tenants/A/ledger/_errorLog/err1'), { message: 'tampered' })));
await test('عضو A لا يكتب في سجل أخطاء B (عزل)', assertFails(set(ref(db.adminA, 'tenants/B/ledger/_errorLog/x'), { message: 'x' })));
await test('المشغّل يقرأ سجل أخطاء أي شركة', assertSucceeds(get(ref(db.op, 'tenants/A/ledger/_errorLog'))));
await test('المشغّل يعلّم خطأً كمحلول (تعديل مسموح للمشغّل)', assertSucceeds(update(ref(db.op, 'tenants/A/ledger/_errorLog/err1'), { resolved: true })));

console.log('\n💾 النسخ الاحتياطي (قراءة ledger كاملاً):');
await test('مدير A يقرأ كامل ledger (للنسخ الاحتياطي)', assertSucceeds(get(ref(db.adminA, 'tenants/A/ledger'))));
await test('محاسب A لا يقرأ كامل ledger (للمدير فقط)', assertFails(get(ref(db.acctA, 'tenants/A/ledger'))));
await test('عضو A لا يقرأ كامل ledger لشركة B', assertFails(get(ref(db.adminA, 'tenants/B/ledger'))));
await test('مدير A يستبدل مجموعة كاملة (كتابة الاسترجاع)', assertSucceeds(set(ref(db.adminA, 'tenants/A/ledger/projects'), { p1: { name: 'مشروع' } })));
await test('مدير A لا يستبدل مجموعة في شركة B (عزل الاسترجاع)', assertFails(set(ref(db.adminA, 'tenants/B/ledger/projects'), { p1: { name: 'x' } })));

console.log('\n🔗 مطابقة الحسابات (jrnRecon):');
await test('محاسب A يكتب مطابقة', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/jrnRecon/m1'), { account: '1130', amount: 100 })));
await test('محاسب A يقرأ المطابقات', assertSucceeds(get(ref(db.acctA, 'tenants/A/ledger/jrnRecon'))));
await test('مدير A يقرأ المطابقات', assertSucceeds(get(ref(db.adminA, 'tenants/A/ledger/jrnRecon'))));
await test('مشاهد A لا يكتب مطابقة', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/jrnRecon/m2'), { account: '1130' })));
await test('مشاهد A لا يقرأ المطابقات (admin/accountant فقط)', assertFails(get(ref(db.viewerA, 'tenants/A/ledger/jrnRecon'))));
await test('اشتراك منتهٍ يمنع كتابة المطابقة', assertFails(set(ref(db.adminE, 'tenants/EXP/ledger/jrnRecon/m3'), { account: 'x' })));
await test('عضو A لا يكتب مطابقة في B (عزل)', assertFails(set(ref(db.adminA, 'tenants/B/ledger/jrnRecon/hack'), { account: 'x' })));

console.log('\n👥 مجموعات العملاء/الموردين:');
await test('محاسب A يكتب مجموعة عملاء', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/customerGroups/g1'), { name: 'عملاء الرياض', accountCode: '1130-01' })));
await test('عضو A يقرأ مجموعات العملاء', assertSucceeds(get(ref(db.acctA, 'tenants/A/ledger/customerGroups'))));
await test('مشاهد A لا يكتب مجموعة', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/customerGroups/g2'), { name: 'x' })));
await test('محاسب A يكتب مجموعة موردين', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/supplierGroups/s1'), { name: 'موردو المواد', accountCode: '2110-01' })));
await test('اشتراك منتهٍ يمنع كتابة مجموعة', assertFails(set(ref(db.adminE, 'tenants/EXP/ledger/customerGroups/g3'), { name: 'x' })));
await test('عضو A لا يكتب مجموعة في B (عزل)', assertFails(set(ref(db.adminA, 'tenants/B/ledger/customerGroups/hack'), { name: 'x' })));

console.log('\n🎯 مقاييس MPM (mpmDefs):');
await test('محاسب A يكتب مقياس MPM', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/mpmDefs/m1'), { name: 'الربح التشغيلي المُعدّل', base: 'operatingProfit' })));
await test('عضو A يقرأ مقاييس MPM', assertSucceeds(get(ref(db.acctA, 'tenants/A/ledger/mpmDefs'))));
await test('مشاهد A لا يكتب مقياس MPM', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/mpmDefs/m2'), { name: 'x' })));
await test('اشتراك منتهٍ يمنع كتابة مقياس MPM', assertFails(set(ref(db.adminE, 'tenants/EXP/ledger/mpmDefs/m3'), { name: 'x' })));
await test('عضو A لا يكتب مقياس MPM في B (عزل)', assertFails(set(ref(db.adminA, 'tenants/B/ledger/mpmDefs/hack'), { name: 'x' })));

await testEnv.cleanup();
console.log(`\n═══ النتيجة: ${pass} ناجح · ${fail} فاشل ═══`);
process.exit(fail ? 1 : 0);
