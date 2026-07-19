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
  await set(ref(db, 'tenants/A/ledger/users/deadAdminA'), { role: 'admin', active: false });   // مدير مُوقَف (لاختبار علم active)
  await set(ref(db, 'tenants/A/ledger/announcements/a1'), { title: 'إعلان' });                  // تحت $other (يقرؤه الموظف)
  await set(ref(db, 'tenants/A/ledger/journalEntries/j1'), { number: 'JV-1' });
  // قيد مُرحَّل (لاختبار الحصانة) + قفل فترة (لاختبار قفل الفترة)
  await set(ref(db, 'tenants/A/ledger/journalEntries/jp'), { number: 'JV-P', status: 'posted', date: '2026-05-10', period: '2026-05', totalDebit: 100, totalCredit: 100 });
  await set(ref(db, 'tenants/A/ledger/periodLocks/2026-03'), { locked: true });
  // موظف خدمة ذاتية + قناته الخاصة (لاختبار العزل بين الموظفين)
  await set(ref(db, 'tenants/A/ledger/users/empU'), { role: 'employee', active: true, empKey: 'E1' });
  await set(ref(db, 'tenants/A/ledger/myData/E1'), { profile: { name: 'موظفي' } });
  await set(ref(db, 'tenants/A/ledger/myData/E2'), { profile: { name: 'موظف آخر' } });
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
  deadAdminA: testEnv.authenticatedContext('deadAdminA').database(),   // مدير مُوقَف (active:false)
  adminE: testEnv.authenticatedContext('adminE').database(),
  stranger: testEnv.authenticatedContext('stranger').database(),  // مصادَق لكن غير عضو في أي مستأجر
  op: testEnv.authenticatedContext('op1').database(),
  empU: testEnv.authenticatedContext('empU').database(),          // موظف خدمة ذاتية (empKey=E1)
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

console.log('\n🔒 حصانة القيد المُرحَّل (posted immutability):');
// محاسب: يُمنع من تعديل محتوى قيد مُرحَّل (يبقى posted بمحتوى مختلف)
await test('محاسب A لا يعدّل قيدًا مُرحَّلًا (يبقى posted)', assertFails(set(ref(db.acctA, 'tenants/A/ledger/journalEntries/jp'), { number: 'HACK', status: 'posted', date: '2026-05-10', period: '2026-05', totalDebit: 999, totalCredit: 1 })));
// محاسب: يُمنع من إرجاع قيد مُرحَّل إلى مسودة (un-posting)
await test('محاسب A لا يُرجع قيدًا مُرحَّلًا إلى مسودة', assertFails(update(ref(db.acctA, 'tenants/A/ledger/journalEntries/jp'), { status: 'draft' })));
// مدير: يُسمح له بتعديل قيد مُرحَّل (دور موثوق) — قبل الإلغاء ليبقى posted
await test('مدير A يعدّل قيدًا مُرحَّلًا (مسموح للمدير)', assertSucceeds(update(ref(db.adminA, 'tenants/A/ledger/journalEntries/jp'), { description: 'تعديل إداري' })));
// محاسب: يُسمح له بإلغاء القيد المُرحَّل (posted → cancelled)
await test('محاسب A يُلغي قيدًا مُرحَّلًا (posted → cancelled)', assertSucceeds(update(ref(db.acctA, 'tenants/A/ledger/journalEntries/jp'), { status: 'cancelled', cancelReason: 'تصحيح' })));
// إنشاء قيد جديد وتعديل مسودة لا يتأثران
await test('محاسب A يُنشئ قيدًا جديدًا (غير متأثر)', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/journalEntries/jnew'), { number: 'JV-N', status: 'draft', date: '2026-06-01', period: '2026-06' })));

console.log('\n🔒 قفل الفترة (period lock) — للقيود التي تحمل حقل period:');
// محاسب: يُمنع من الكتابة في فترة مقفلة
await test('محاسب A لا يكتب قيدًا في فترة مقفلة (2026-03)', assertFails(set(ref(db.acctA, 'tenants/A/ledger/journalEntries/jlock'), { number: 'JV-L', status: 'posted', date: '2026-03-15', period: '2026-03', totalDebit: 50, totalCredit: 50 })));
// محاسب: يُسمح بالكتابة في فترة غير مقفلة
await test('محاسب A يكتب قيدًا في فترة غير مقفلة (2026-04)', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/journalEntries/jok'), { number: 'JV-K', status: 'posted', date: '2026-04-15', period: '2026-04', totalDebit: 50, totalCredit: 50 })));
// تزوير الفترة: تاريخ في فترة مقفلة لكن period مزوّر لفترة أخرى → يُرفض (beginsWith)
await test('محاسب A لا يزوّر الفترة (تاريخ 2026-03 وperiod 2026-04)', assertFails(set(ref(db.acctA, 'tenants/A/ledger/journalEntries/jforge'), { number: 'JV-F', status: 'posted', date: '2026-03-20', period: '2026-04', totalDebit: 50, totalCredit: 50 })));
// مدير: يتجاوز قفل الفترة (دور موثوق)
await test('مدير A يكتب في فترة مقفلة (استثناء المدير)', assertSucceeds(set(ref(db.adminA, 'tenants/A/ledger/journalEntries/jadminlock'), { number: 'JV-AL', status: 'posted', date: '2026-03-25', period: '2026-03', totalDebit: 50, totalCredit: 50 })));

console.log('\n🙋 قناة الموظف الخاصة (myData) — عزل بين الموظفين:');
await test('موظف E1 يقرأ قناته الخاصة myData/E1', assertSucceeds(get(ref(db.empU, 'tenants/A/ledger/myData/E1'))));
await test('موظف E1 لا يقرأ قناة موظف آخر myData/E2', assertFails(get(ref(db.empU, 'tenants/A/ledger/myData/E2'))));
await test('موظف E1 لا يكتب في قناته (الكتابة للإدارة فقط)', assertFails(set(ref(db.empU, 'tenants/A/ledger/myData/E1'), { profile: { name: 'عبث' } })));
await test('موظف E1 لا يقرأ جدول الموظفين (خصوصية الرواتب)', assertFails(get(ref(db.empU, 'tenants/A/ledger/employees'))));
await test('موظف E1 لا يقرأ المسيرات (خصوصية الرواتب)', assertFails(get(ref(db.empU, 'tenants/A/ledger/payrolls'))));
await test('مدير A يكتب قناة الموظف myData/E1', assertSucceeds(set(ref(db.adminA, 'tenants/A/ledger/myData/E1'), { profile: { name: 'محدّث' } })));
await test('غريب لا يقرأ قناة موظف A', assertFails(get(ref(db.stranger, 'tenants/A/ledger/myData/E1'))));
await test('موظف A لا يقرأ قناة موظف في B (عزل المستأجر)', assertFails(get(ref(db.empU, 'tenants/B/ledger/myData/E1'))));

console.log('\n🎯 النطاق الجغرافي (geofence):');
await test('موظف A يقرأ إعداد النطاق (للتحقق من موقعه)', assertSucceeds(get(ref(db.empU, 'tenants/A/ledger/geofence'))));
await test('موظف A لا يعبث بإعداد النطاق (للإدارة فقط)', assertFails(set(ref(db.empU, 'tenants/A/ledger/geofence'), { enabled: false })));
await test('مدير A يضبط النطاق الجغرافي', assertSucceeds(set(ref(db.adminA, 'tenants/A/ledger/geofence'), { enabled: true, mode: 'block' })));

console.log('\n🚫 علم الإيقاف (active:false) — الحساب المُوقَف لا يكتب [H1]:');
await test('مدير مُوقَف لا يكتب قيدًا', assertFails(set(ref(db.deadAdminA, 'tenants/A/ledger/journalEntries/jdead'), { number: 'JV-D', status: 'draft', date: '2026-06-01', period: '2026-06' })));
await test('مدير مُوقَف لا يكتب موظفًا', assertFails(set(ref(db.deadAdminA, 'tenants/A/ledger/employees/edead'), { name: 'x' })));
await test('مدير مُوقَف لا يكتب في $other (مشاريع)', assertFails(set(ref(db.deadAdminA, 'tenants/A/ledger/projects/pdead'), { name: 'x' })));
await test('مدير مُوقَف لا يعدّل مستخدمًا (تصعيد)', assertFails(update(ref(db.deadAdminA, 'tenants/A/ledger/users/acctA'), { role: 'admin' })));
await test('مدير مُوقَف لا يزال يقرأ (القراءة غير مقيّدة بـ active)', assertSucceeds(get(ref(db.deadAdminA, 'tenants/A/ledger/journalEntries'))));

console.log('\n🙋 أقل صلاحية داخل الشركة — الموظف يكتب خدمته الذاتية فقط [H3]:');
// مسموح: مجموعات الخدمة الذاتية السبع
await test('موظف يقدّم طلب إجازة (leaves)', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/leaves/lv1'), { empKey: 'E1', type: 'annual', status: 'pending' })));
await test('موظف يسجّل حضورًا (attendance)', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/attendance/at1'), { employeeId: 'E1', date: '2026-07-19' })));
await test('موظف يطلب تصحيح حضور (attendanceRequests)', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/attendanceRequests/ar1'), { empKey: 'E1', status: 'pending' })));
await test('موظف يقدّم طلب إذن (permissions)', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/permissions/pm1'), { empKey: 'E1', status: 'pending' })));
await test('موظف يقدّم مطالبة مصروفات (employeeExpenses)', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/employeeExpenses/ex1'), { empId: 'E1', amount: 100, status: 'draft' })));
await test('موظف يطلب خطابًا (hrLetters)', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/hrLetters/hl1'), { empKey: 'E1', status: 'pending' })));
await test('موظف يجيب استبيانًا (surveyResponses)', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/surveyResponses/sr1'), { empKey: 'E1', answers: {} })));
// ممنوع: الكتابة في المجموعات الحسّاسة تحت $other
await test('موظف لا يكتب في الموردين (suppliers → $other)', assertFails(set(ref(db.empU, 'tenants/A/ledger/suppliers/sup1'), { name: 'مورد وهمي' })));
await test('موظف لا يكتب في العملاء (customers → $other)', assertFails(set(ref(db.empU, 'tenants/A/ledger/customers/c1'), { name: 'x' })));
await test('موظف لا يكتب في فواتير الشراء (purchaseInvoices → $other)', assertFails(set(ref(db.empU, 'tenants/A/ledger/purchaseInvoices/pi1'), { total: 9999 })));
await test('موظف لا يكتب في المدفوعات (payments → $other)', assertFails(set(ref(db.empU, 'tenants/A/ledger/payments/pay1'), { amount: 9999 })));
await test('موظف لا يكتب قيدًا (journalEntries)', assertFails(set(ref(db.empU, 'tenants/A/ledger/journalEntries/jemp'), { number: 'X', status: 'draft', date: '2026-06-01', period: '2026-06' })));
// القراءة العامة لم تُكسَر: الموظف يقرأ الإعلانات ($other read)
await test('موظف يقرأ الإعلانات (لم تُكسَر القراءة)', assertSucceeds(get(ref(db.empU, 'tenants/A/ledger/announcements'))));
// المشاهد (viewer) لا يكتب حتى في الخدمة الذاتية
await test('مشاهد لا يكتب طلب إجازة (viewer محجوب حتى من الذاتية)', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/leaves/lv2'), { type: 'annual' })));
await test('مشاهد لا يكتب في الموردين ($other)', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/suppliers/sup2'), { name: 'x' })));
// عزل المستأجر يبقى ساريًا حتى على الخدمة الذاتية
await test('موظف A لا يكتب إجازة في شركة B (عزل)', assertFails(set(ref(db.empU, 'tenants/B/ledger/leaves/hack'), { type: 'annual' })));

await testEnv.cleanup();
console.log(`\n═══ النتيجة: ${pass} ناجح · ${fail} فاشل ═══`);
process.exit(fail ? 1 : 0);
