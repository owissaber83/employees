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
  await set(ref(db, 'tenants/A/ledger/users/pmA'), { role: 'project_manager', active: true });   // دور غير محاسبي وغير موظف (لاختبار تصليب كتابة المالية)
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
  // [أمان C] ردّ استبيان لزميل (E2) + علامة "أجاب" لزميل — لاختبار سرّية الاستبيانات
  await set(ref(db, 'tenants/A/ledger/surveyResponses/sr_e2'), { surveyId: 'sv1', empKey: 'E2', answers: { enps: 3 } });
  await set(ref(db, 'tenants/A/ledger/surveyDone/E2/sv1'), true);
  // [HR-REQ] تذكرة لموظف آخر (E2) مُسندة لمدير مشروع (pmA) — لاختبار إسناد التذاكر لغير HR
  await set(ref(db, 'tenants/A/ledger/tickets/E2/tA1'), { subject: 'تذكرة زميل', empKey: 'E2', assigneeUid: 'pmA', status: 'in_progress' });
  await set(ref(db, 'tenants/A/ledger/ticketAssignments/pmA/E2_tA1'), { empKey: 'E2', ticketId: 'tA1', subject: 'تذكرة زميل' });
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
  pmA: testEnv.authenticatedContext('pmA').database(),               // مدير مشروع (غير محاسبي)
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

console.log('\n🔢 عدّادات الترقيم التسلسلي (counters — runTransaction للقيود/الفواتير/السندات):');
await test('محاسب A يكتب عدّاد (حجز رقم قيد)', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/counters/jrn/GEN/2026'), 42)));
await test('محاسب A يقرأ العدّادات', assertSucceeds(get(ref(db.acctA, 'tenants/A/ledger/counters'))));
await test('مشاهد A لا يكتب عدّاد', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/counters/jrn/GEN/2026'), 99)));
await test('اشتراك منتهٍ يمنع كتابة عدّاد', assertFails(set(ref(db.adminE, 'tenants/EXP/ledger/counters/jrn/GEN/2026'), 1)));
await test('عضو A لا يكتب عدّاد في B (عزل)', assertFails(set(ref(db.adminA, 'tenants/B/ledger/counters/jrn/GEN/2026'), 1)));

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

console.log('\n⚖️ توازن القيد (debit = credit) على مستوى الخادم — لا يُتّكَل على الواجهة وحدها:');
// قيد مُرحَّل مباشرة (بتجاوز واجهة saveJrnEntry) بمجموع مدين ≠ دائن يجب أن يُرفض من القاعدة نفسها
await test('محاسب A لا يكتب قيدًا مُرحَّلًا غير متزن', assertFails(set(ref(db.acctA, 'tenants/A/ledger/journalEntries/junbal'), { number: 'JV-UNBAL', status: 'posted', date: '2026-06-05', period: '2026-06', totalDebit: 100, totalCredit: 80 })));
// قيد مُرحَّل بلا حقلي totalDebit/totalCredit إطلاقاً يجب أن يُرفض أيضًا (لا إفلات بحذف الحقل)
await test('محاسب A لا يكتب قيدًا مُرحَّلًا بلا مجاميع', assertFails(set(ref(db.acctA, 'tenants/A/ledger/journalEntries/jnototals'), { number: 'JV-NT', status: 'posted', date: '2026-06-05', period: '2026-06' })));
// قيد مُرحَّل متزن فعليًا يُقبل بشكل طبيعي
await test('محاسب A يكتب قيدًا مُرحَّلًا متزنًا', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/journalEntries/jbal'), { number: 'JV-BAL', status: 'posted', date: '2026-06-05', period: '2026-06', totalDebit: 250.5, totalCredit: 250.5 })));
// المسودات (status !== 'posted') ليست جزءًا من دفتر الأستاذ بعد — فحص التوازن لا يُطبَّق عليها
await test('محاسب A يكتب مسودة غير متزنة (فحص التوازن للمُرحَّل فقط)', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/journalEntries/jdraftunbal'), { number: 'JV-DU', status: 'draft', date: '2026-06-05', period: '2026-06', totalDebit: 100, totalCredit: 1 })));

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

console.log('\n👑 الدعم الفني (operator) — إنشاء مستخدم داخل شركة عميل:');
await test('المشغّل يكتب سجل مستخدم في شركة A', assertSucceeds(set(ref(db.op, 'tenants/A/ledger/users/newSup'), { name: 'مستخدم دعم', role: 'admin', permissions: [], active: true })));
await test('المشغّل ينشئ userIndex للمستخدم الجديد (يلزم لتسجيل دخوله)', assertSucceeds(set(ref(db.op, 'userIndex/newSup'), { tenantId: 'A' })));
await test('المشغّل يُلحق في سجل تدقيق الشركة (شفافية)', assertSucceeds(set(ref(db.op, 'tenants/A/ledger/auditLog/sup1'), { action: 'إضافة مستخدم (بواسطة الدعم)', bySupport: true })));
await test('المشغّل لا يعدّل سجل تدقيق موجود (إلحاق فقط حتى للدعم)', assertFails(set(ref(db.op, 'tenants/A/ledger/auditLog/e1'), { action: 'tampered' })));
// الحدود لم تُفتح لغير المشغّل
await test('مدير A لا ينشئ userIndex لشركة B (عزل)', assertFails(set(ref(db.adminA, 'userIndex/foreign'), { tenantId: 'B' })));
await test('محاسب A لا ينشئ userIndex لمستخدم آخر (المدير/المشغّل فقط)', assertFails(set(ref(db.acctA, 'userIndex/someoneElse'), { tenantId: 'A' })));
await test('غريب لا ينشئ userIndex لمستخدم آخر', assertFails(set(ref(db.stranger, 'userIndex/victim'), { tenantId: 'A' })));
await test('المشغّل ما زال لا يكتب قيود اليومية (لم نمنحه بيانات محاسبية)', assertFails(set(ref(db.op, 'tenants/A/ledger/journalEntries/opjv'), { number: 'OP-1', status: 'draft', date: '2026-06-01', period: '2026-06' })));
await test('المشغّل ما زال لا يكتب في الموردين ($other)', assertFails(set(ref(db.op, 'tenants/A/ledger/suppliers/opsup'), { name: 'x' })));

console.log('\n💰 تصليب كتابة المالية [P0] — الكتابة للمحاسب/المدير فقط، والقراءة لم تُكسَر:');
// أدوار غير محاسبية (كانت تكتب المالية تحت $other) صارت ممنوعة من الكتابة
await test('مدير مشروع لا يكتب مدفوعة (payments — تصليب)', assertFails(set(ref(db.pmA, 'tenants/A/ledger/payments/pk1'), { amount: 50000 })));
await test('مدير مشروع لا يكتب سند قبض (receipts — تصليب)', assertFails(set(ref(db.pmA, 'tenants/A/ledger/receipts/rk1'), { amount: 50000 })));
await test('مدير مشروع لا يكتب دفعة عميل مقدمة (customerAdvances — تصليب)', assertFails(set(ref(db.pmA, 'tenants/A/ledger/customerAdvances/ca1'), { amount: 50000 })));
await test('مدير مشروع لا يكتب معاملة (transactions — تصليب)', assertFails(set(ref(db.pmA, 'tenants/A/ledger/transactions/tk1'), { amount: 50000 })));
await test('مدير مشروع لا يكتب إقرار ضريبي (vatRecSessions — تصليب)', assertFails(set(ref(db.pmA, 'tenants/A/ledger/vatRecSessions/v1'), { net: 100 })));
await test('مدير مشروع لا يكتب ضماناً/خطاب ضمان (guarantees — تصليب)', assertFails(set(ref(db.pmA, 'tenants/A/ledger/guarantees/g1'), { amount: 100 })));
await test('مشاهد لا يكتب مدفوعة (payments)', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/payments/pv1'), { amount: 1 })));
// المحاسب/المدير: الكتابة مسموحة كالمعتاد
await test('محاسب A يكتب مدفوعة (payments)', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/payments/pa1'), { amount: 1000, voucherNo: 'PV-1' })));
await test('محاسب A يكتب سند قبض (receipts)', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/receipts/ra1'), { amount: 1000 })));
await test('محاسب A يكتب دفعة عميل مقدمة (customerAdvances)', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/customerAdvances/caa1'), { amount: 1000, customerId: 'c1' })));
await test('محاسب A يكتب شيكاً (cheques)', assertSucceeds(set(ref(db.acctA, 'tenants/A/ledger/cheques/ch1'), { amount: 1000 })));
await test('مدير A يكتب مدفوعة (payments)', assertSucceeds(set(ref(db.adminA, 'tenants/A/ledger/payments/pad1'), { amount: 1000 })));
// القراءة لم تُكسَر: المستمعات العامة تظل حيّة لكل الأدوار (تأجيل سرّية القراءة للمرحلة B)
await test('مدير مشروع ما زال يقرأ المدفوعات (القراءة لم تُكسَر)', assertSucceeds(get(ref(db.pmA, 'tenants/A/ledger/payments'))));
await test('محاسب A يقرأ المدفوعات', assertSucceeds(get(ref(db.acctA, 'tenants/A/ledger/payments'))));
// بوابة الاشتراك المنتهي تسري على المالية المُصلَّبة
await test('اشتراك منتهٍ يمنع كتابة مدفوعة', assertFails(set(ref(db.adminE, 'tenants/EXP/ledger/payments/pex1'), { amount: 1 })));
// عزل المستأجر يسري على المالية المُصلَّبة
await test('محاسب A لا يكتب مدفوعة في شركة B (عزل)', assertFails(set(ref(db.acctA, 'tenants/B/ledger/payments/hack'), { amount: 1 })));
// مدير المشروع ما زال يكتب البيانات التشغيلية المشتركة ($other) — لم نقيّده هناك
await test('مدير مشروع يكتب في المشاريع ($other لم يُقيَّد)', assertSucceeds(set(ref(db.pmA, 'tenants/A/ledger/projects/pmproj'), { name: 'مشروع' })));

console.log('\n🙈 سرّية قراءة المالية [B-3] — تُحجب عن الموظف/المشاهد، وتبقى لأدوار الإدارة:');
// الموظف/المشاهد (الأكثر عدداً والأقل ثقة) لا يقرؤون المالية بعد الآن
await test('موظف لا يقرأ المدفوعات (payments — سرّية)', assertFails(get(ref(db.empU, 'tenants/A/ledger/payments'))));
await test('موظف لا يقرأ المعاملات (transactions — سرّية)', assertFails(get(ref(db.empU, 'tenants/A/ledger/transactions'))));
await test('موظف لا يقرأ سندات القبض (receipts — سرّية)', assertFails(get(ref(db.empU, 'tenants/A/ledger/receipts'))));
await test('موظف لا يقرأ خطابات الضمان (guarantees — سرّية)', assertFails(get(ref(db.empU, 'tenants/A/ledger/guarantees'))));
await test('موظف لا يقرأ الدفعات المقدمة (customerAdvances — سرّية)', assertFails(get(ref(db.empU, 'tenants/A/ledger/customerAdvances'))));
await test('موظف لا يقرأ سجل الاستقطاع (whtRecords — سرّية)', assertFails(get(ref(db.empU, 'tenants/A/ledger/whtRecords'))));
await test('مشاهد لا يقرأ المدفوعات (payments — سرّية)', assertFails(get(ref(db.viewerA, 'tenants/A/ledger/payments'))));
await test('مشاهد لا يقرأ المعاملات (transactions — سرّية)', assertFails(get(ref(db.viewerA, 'tenants/A/ledger/transactions'))));
// أدوار الإدارة (محاسب/مدير/مدير مشروع) تقرأ المالية كالمعتاد — صفر تراجع في واجهة الإدارة
await test('محاسب A يقرأ المعاملات (لم تتأثر الإدارة)', assertSucceeds(get(ref(db.acctA, 'tenants/A/ledger/transactions'))));
await test('مدير A يقرأ الدفعات المقدمة', assertSucceeds(get(ref(db.adminA, 'tenants/A/ledger/customerAdvances'))));
await test('مدير مشروع يقرأ خطابات الضمان (غير موظف/مشاهد)', assertSucceeds(get(ref(db.pmA, 'tenants/A/ledger/guarantees'))));
// الموظف ما زال يقرأ ما يخصّه: الإعلانات (بثّ) والخدمة الذاتية
await test('موظف ما زال يقرأ الإعلانات (بثّ — لم تُحجب)', assertSucceeds(get(ref(db.empU, 'tenants/A/ledger/announcements'))));
await test('موظف ما زال يقرأ طلبات إجازاته (leaves — خدمة ذاتية)', assertSucceeds(get(ref(db.empU, 'tenants/A/ledger/leaves'))));

console.log('\n🕵️ سرّية الاستبيانات [C] — ردود زملائك محجوبة، وعلامة "أجبتُ" خاصة بك:');
// الردود الكاملة للموارد البشرية/المدير فقط — الموظف/المشاهد لا يقرؤونها
await test('موظف لا يقرأ ردود الاستبيانات (سرّية الزملاء)', assertFails(get(ref(db.empU, 'tenants/A/ledger/surveyResponses'))));
await test('موظف لا يقرأ ردّ زميل مفرداً', assertFails(get(ref(db.empU, 'tenants/A/ledger/surveyResponses/sr_e2'))));
await test('مشاهد لا يقرأ ردود الاستبيانات', assertFails(get(ref(db.viewerA, 'tenants/A/ledger/surveyResponses'))));
await test('مدير A يقرأ ردود الاستبيانات (تجميع النتائج)', assertSucceeds(get(ref(db.adminA, 'tenants/A/ledger/surveyResponses'))));
// الموظف ما زال يُرسل ردّه (كتابة) رغم أنه لا يقرأ ردود غيره
await test('موظف يُرسل ردّ استبيان (كتابة مسموحة)', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/surveyResponses/sr_e1'), { surveyId: 'sv1', empKey: 'E1', answers: { enps: 9 } })));
// علامة "أجبتُ" الخاصة (surveyDone/{empKey}) — يقرأ/يكتب علامته فقط
await test('موظف يكتب علامة "أجبتُ" الخاصة به (surveyDone/E1)', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/surveyDone/E1/sv1'), true)));
await test('موظف يقرأ علاماته الخاصة (surveyDone/E1)', assertSucceeds(get(ref(db.empU, 'tenants/A/ledger/surveyDone/E1'))));
await test('موظف لا يقرأ علامات زميل (surveyDone/E2)', assertFails(get(ref(db.empU, 'tenants/A/ledger/surveyDone/E2'))));
await test('موظف لا يكتب علامة زميل (surveyDone/E2 — انتحال)', assertFails(set(ref(db.empU, 'tenants/A/ledger/surveyDone/E2/sv1'), true)));
// المدير يكتب علامات أي موظف (ترحيل لمرة واحدة)
await test('مدير A يكتب علامة أي موظف (ترحيل)', assertSucceeds(set(ref(db.adminA, 'tenants/A/ledger/surveyDone/E1/sv2'), true)));
// عزل المستأجر يسري على العلامات
await test('موظف A لا يكتب علامة في شركة B (عزل)', assertFails(set(ref(db.empU, 'tenants/B/ledger/surveyDone/E1/sv1'), true)));

console.log('\n✅ مسارات الموافقات [HR-APV] — التهيئة للموارد البشرية/المدير، والقراءة للأعضاء:');
await test('مدير A يعرّف سياسة اعتماد إجازة', assertSucceeds(set(ref(db.adminA, 'tenants/A/ledger/approvalPolicies/leave'), { enabled: true, steps: [{ kind: 'role', role: 'hr_officer', name: 'HR' }] })));
await test('عضو A (محاسب) يقرأ سياسات الاعتماد (يحتاجها ليعرف السلسلة)', assertSucceeds(get(ref(db.acctA, 'tenants/A/ledger/approvalPolicies'))));
await test('موظف يقرأ سياسات الاعتماد', assertSucceeds(get(ref(db.empU, 'tenants/A/ledger/approvalPolicies'))));
await test('محاسب A لا يعدّل سياسة اعتماد (HR/admin فقط)', assertFails(set(ref(db.acctA, 'tenants/A/ledger/approvalPolicies/leave'), { enabled: false })));
await test('موظف لا يعدّل سياسة اعتماد', assertFails(set(ref(db.empU, 'tenants/A/ledger/approvalPolicies/leave'), { enabled: false })));
await test('مشاهد لا يعدّل سياسة اعتماد', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/approvalPolicies/leave'), { enabled: false })));
await test('اشتراك منتهٍ يمنع تعديل سياسة الاعتماد', assertFails(set(ref(db.adminE, 'tenants/EXP/ledger/approvalPolicies/leave'), { enabled: true })));
await test('عضو A لا يعدّل سياسة اعتماد في شركة B (عزل)', assertFails(set(ref(db.adminA, 'tenants/B/ledger/approvalPolicies/leave'), { enabled: true })));

console.log('\n🎫 مركز الطلبات والتذاكر [HR-REQ] — الموظف يفتح/يرى تذاكره فقط، والموارد البشرية الكل:');
await test('موظف يفتح تذكرة خاصة به (tickets/E1)', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/tickets/E1/t1'), { type: 'complaint', subject: 'شكوى', status: 'open', empKey: 'E1' })));
await test('موظف يقرأ تذاكره (tickets/E1)', assertSucceeds(get(ref(db.empU, 'tenants/A/ledger/tickets/E1'))));
await test('موظف لا يقرأ تذاكر زميل (tickets/E2)', assertFails(get(ref(db.empU, 'tenants/A/ledger/tickets/E2'))));
await test('موظف لا يفتح تذكرة باسم زميل (انتحال tickets/E2)', assertFails(set(ref(db.empU, 'tenants/A/ledger/tickets/E2/t9'), { subject: 'x' })));
await test('موظف لا يقرأ كل التذاكر (العقدة كاملة — للإدارة)', assertFails(get(ref(db.empU, 'tenants/A/ledger/tickets'))));
await test('مدير A يقرأ كل التذاكر (helpdesk)', assertSucceeds(get(ref(db.adminA, 'tenants/A/ledger/tickets'))));
await test('مدير A يعالج تذكرة موظف (يغيّر الحالة)', assertSucceeds(update(ref(db.adminA, 'tenants/A/ledger/tickets/E1/t1'), { status: 'resolved' })));
await test('محاسب A لا يقرأ كل التذاكر (HR/admin فقط)', assertFails(get(ref(db.acctA, 'tenants/A/ledger/tickets'))));
await test('مشاهد لا يفتح تذكرة (viewer محجوب — ليس صاحب empKey)', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/tickets/VW/t1'), { subject: 'x' })));
await test('موظف A لا يفتح تذكرة في شركة B (عزل)', assertFails(set(ref(db.empU, 'tenants/B/ledger/tickets/E1/t1'), { subject: 'x' })));

console.log('\n👤 إسناد التذاكر لمدير غير HR [HR-REQ]:');
await test('مدير مشروع (مُسنَد إليه) يقرأ التذكرة المسندة', assertSucceeds(get(ref(db.pmA, 'tenants/A/ledger/tickets/E2/tA1'))));
await test('مدير مشروع لا يقرأ فرع تذاكر الموظف كاملاً (غير مالك/HR)', assertFails(get(ref(db.pmA, 'tenants/A/ledger/tickets/E2'))));
await test('مدير مشروع يردّ/يحدّث التذكرة المسندة إليه', assertSucceeds(update(ref(db.pmA, 'tenants/A/ledger/tickets/E2/tA1'), { status: 'resolved' })));
await test('موظف آخر لا يقرأ تذكرة مُسندة لغيره', assertFails(get(ref(db.empU, 'tenants/A/ledger/tickets/E2/tA1'))));
await test('مدير مشروع يقرأ فهرس إسناده الخاص', assertSucceeds(get(ref(db.pmA, 'tenants/A/ledger/ticketAssignments/pmA'))));
await test('مدير مشروع لا يقرأ فهرس إسناد غيره', assertFails(get(ref(db.pmA, 'tenants/A/ledger/ticketAssignments/adminA'))));
await test('مدير A (HR/admin) يكتب فهرس الإسناد', assertSucceeds(set(ref(db.adminA, 'tenants/A/ledger/ticketAssignments/pmA/E2_tX'), { empKey: 'E2', ticketId: 'tX' })));
await test('مدير مشروع لا يكتب فهرس الإسناد (ليس HR)', assertFails(set(ref(db.pmA, 'tenants/A/ledger/ticketAssignments/pmA/hack'), { x: 1 })));
await test('عزل: مدير مشروع لا يقرأ تذكرة مسندة في شركة B', assertFails(get(ref(db.pmA, 'tenants/B/ledger/tickets/E2/tA1'))));

console.log('\n🩺✈️🪜 وحدات القوى العاملة [HRW]:');
// التأمين الطبي — بيانات صحية حسّاسة: الإدارة فقط
await test('مدير A يكتب وثيقة تأمين طبي', assertSucceeds(set(ref(db.adminA, 'tenants/A/ledger/medInsurance/m1'), { empKey: 'E1', insurer: 'شركة', from: '2026-01-01', to: '2026-12-31' })));
await test('مدير A يقرأ وثائق التأمين', assertSucceeds(get(ref(db.adminA, 'tenants/A/ledger/medInsurance'))));
await test('موظف لا يقرأ وثائق التأمين (بيانات صحية)', assertFails(get(ref(db.empU, 'tenants/A/ledger/medInsurance'))));
await test('موظف لا يكتب وثيقة تأمين', assertFails(set(ref(db.empU, 'tenants/A/ledger/medInsurance/hack'), { empKey: 'E1' })));
await test('محاسب لا يقرأ وثائق التأمين', assertFails(get(ref(db.acctA, 'tenants/A/ledger/medInsurance'))));
await test('عزل: مدير A لا يقرأ تأمين شركة B', assertFails(get(ref(db.adminA, 'tenants/B/ledger/medInsurance'))));

// السلم الوظيفي — مرجع يقرؤه الجميع، يكتبه HR/admin
await test('مدير A يكتب درجة وظيفية', assertSucceeds(set(ref(db.adminA, 'tenants/A/ledger/salaryGrades/g1'), { code: 'G1', name: 'مهندس', minSalary: 5000, maxSalary: 9000 })));
await test('موظف يقرأ الدرجات (مرجع عام)', assertSucceeds(get(ref(db.empU, 'tenants/A/ledger/salaryGrades'))));
await test('موظف لا يكتب درجة وظيفية', assertFails(set(ref(db.empU, 'tenants/A/ledger/salaryGrades/hack'), { code: 'X', minSalary: 99999 })));
await test('محاسب لا يكتب درجة وظيفية (HR/admin فقط)', assertFails(set(ref(db.acctA, 'tenants/A/ledger/salaryGrades/g2'), { code: 'G2' })));
await test('عزل: مدير A لا يكتب درجة في شركة B', assertFails(set(ref(db.adminA, 'tenants/B/ledger/salaryGrades/g1'), { code: 'G1' })));

// الانتداب — الموظف ينشئ طلبه (نمط الإجازات)، والمشاهد ممنوع
await test('موظف ينشئ طلب انتداب', assertSucceeds(set(ref(db.empU, 'tenants/A/ledger/businessTrips/t1'), { empKey: 'E1', destination: 'الرياض', from: '2026-03-01', to: '2026-03-03' })));
await test('مدير A يعتمد انتداباً', assertSucceeds(update(ref(db.adminA, 'tenants/A/ledger/businessTrips/t1'), { status: 'approved' })));
await test('مشاهد لا ينشئ انتداباً (viewer)', assertFails(set(ref(db.viewerA, 'tenants/A/ledger/businessTrips/hack'), { empKey: 'VW' })));
await test('مدير مُوقَف لا ينشئ انتداباً (active=false)', assertFails(set(ref(db.deadAdminA, 'tenants/A/ledger/businessTrips/t9'), { empKey: 'E1' })));
await test('عزل: موظف A لا ينشئ انتداباً في شركة B', assertFails(set(ref(db.empU, 'tenants/B/ledger/businessTrips/t1'), { empKey: 'E1' })));

await testEnv.cleanup();
console.log(`\n═══ النتيجة: ${pass} ناجح · ${fail} فاشل ═══`);
process.exit(fail ? 1 : 0);
