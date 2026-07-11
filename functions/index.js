// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  دوال خادمية (Cloud Functions) — تتطلب خطة Blaze                           ║
// ║  نشرها:  firebase deploy --only functions                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();

// 💾 نسخة احتياطية يومية لكامل قاعدة البيانات → Cloud Storage (JSON)، وحذف ما يزيد عن 30 يوماً
exports.dailyBackup = onSchedule({ schedule: 'every day 03:00', timeZone: 'Asia/Riyadh', region: 'us-central1' }, async () => {
  const snap = await admin.database().ref('/').get();
  const stamp = new Date().toISOString().slice(0, 10);
  const bucket = admin.storage().bucket();
  await bucket.file('backups/backup-' + stamp + '.json').save(JSON.stringify(snap.val() || {}), { contentType: 'application/json' });
  // تنظيف النسخ الأقدم من 30 يوماً
  const [files] = await bucket.getFiles({ prefix: 'backups/' });
  const cutoff = Date.now() - 30 * 86400000;
  await Promise.all(files.filter(f => {
    const m = f.name.match(/backup-(\d{4}-\d{2}-\d{2})\.json/);
    return m && new Date(m[1]).getTime() < cutoff;
  }).map(f => f.delete().catch(() => { })));
  console.log('نسخة احتياطية: backups/backup-' + stamp + '.json');
});

// 🏷️ مزامنة معرّف الشركة كـ custom claim — تتيح قواعد Storage عزلاً حقيقياً بين الشركات
exports.syncTenantClaim = onCall({ region: 'us-central1' }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  const tid = (await admin.database().ref('userIndex/' + uid + '/tenantId').get()).val();
  if (!tid) throw new HttpsError('not-found', 'المستخدم غير مرتبط بشركة');
  await admin.auth().setCustomUserClaims(uid, { tenantId: tid });
  return { tenantId: tid };
});

// 🔒 ضبط كلمة مرور مستخدم مباشرةً — للمدير فقط، وضمن نفس الشركة (المستأجر)
//    مفيد للمستخدمين بلا بريد إلكتروني يمكنهم استقباله (يخبرهم المدير بكلمة المرور الجديدة مباشرةً).
exports.adminSetUserPassword = onCall({ region: 'us-central1' }, async (req) => {
  const callerUid = req.auth && req.auth.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const uid = req.data && req.data.uid;
  const newPassword = req.data && req.data.newPassword;
  if (!uid || !newPassword || String(newPassword).length < 6) {
    throw new HttpsError('invalid-argument', 'بيانات غير صحيحة — كلمة المرور 6 أحرف على الأقل');
  }

  const db = admin.database();
  // تحقّق أن المتصل والمستهدف في نفس الشركة (المستأجر)
  const callerTid = (await db.ref('userIndex/' + callerUid + '/tenantId').get()).val();
  const targetTid = (await db.ref('userIndex/' + uid + '/tenantId').get()).val();
  if (!callerTid || callerTid !== targetTid) {
    throw new HttpsError('permission-denied', 'المستخدم ليس ضمن شركتك');
  }
  // تحقّق أن المتصل مدير في هذه الشركة، وأن المستهدف عضو فيها
  const callerRole = (await db.ref('tenants/' + callerTid + '/ledger/users/' + callerUid + '/role').get()).val();
  if (callerRole !== 'admin') throw new HttpsError('permission-denied', 'هذه العملية للمدير فقط');
  const targetExists = (await db.ref('tenants/' + targetTid + '/ledger/users/' + uid).get()).exists();
  if (!targetExists) throw new HttpsError('not-found', 'المستخدم غير موجود في شركتك');

  await admin.auth().updateUser(uid, { password: String(newPassword) });
  return { ok: true };
});
