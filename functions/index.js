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
// 🔐 تفويض العملية: يسمح لمدير الشركة (على المستهدف في شركته) أو لمشغّل المنصّة (الدعم الفني).
// يُرجع tenantId للمستهدف عند السماح، ويرمي خطأ عند المنع.
async function assertAdminOrOperator(callerUid, targetUid) {
  const db = admin.database();
  const targetTid = (await db.ref('userIndex/' + targetUid + '/tenantId').get()).val();
  if (!targetTid) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const targetExists = (await db.ref('tenants/' + targetTid + '/ledger/users/' + targetUid).get()).exists();
  if (!targetExists) throw new HttpsError('not-found', 'المستخدم غير موجود في الشركة');
  // 👑 الدعم الفني (مشغّل المنصّة) مسموح على أي شركة
  const isOperator = (await db.ref('operators/' + callerUid).get()).val() === true;
  if (isOperator) return targetTid;
  // وإلا: يجب أن يكون المتصل مديراً في نفس شركة المستهدف
  const callerTid = (await db.ref('userIndex/' + callerUid + '/tenantId').get()).val();
  if (!callerTid || callerTid !== targetTid) throw new HttpsError('permission-denied', 'المستخدم ليس ضمن شركتك');
  const callerRole = (await db.ref('tenants/' + callerTid + '/ledger/users/' + callerUid + '/role').get()).val();
  if (callerRole !== 'admin') throw new HttpsError('permission-denied', 'هذه العملية للمدير فقط');
  return targetTid;
}

exports.adminSetUserPassword = onCall({ region: 'us-central1' }, async (req) => {
  const callerUid = req.auth && req.auth.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const uid = req.data && req.data.uid;
  const newPassword = req.data && req.data.newPassword;
  if (!uid || !newPassword || String(newPassword).length < 6) {
    throw new HttpsError('invalid-argument', 'بيانات غير صحيحة — كلمة المرور 6 أحرف على الأقل');
  }

  await assertAdminOrOperator(callerUid, uid);
  await admin.auth().updateUser(uid, { password: String(newPassword) });
  return { ok: true };
});

// ✉️ تحديث بريد دخول مستخدم (للمدير أو الدعم الفني) — يُحدّث Auth + سجل المستخدم + userIndex
exports.adminUpdateUserEmail = onCall({ region: 'us-central1' }, async (req) => {
  const callerUid = req.auth && req.auth.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const uid = req.data && req.data.uid;
  const newEmail = String((req.data && req.data.newEmail) || '').trim().toLowerCase();
  if (!uid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new HttpsError('invalid-argument', 'بريد إلكتروني غير صحيح');
  }

  const targetTid = await assertAdminOrOperator(callerUid, uid);

  // منع التعارض مع بريد مستخدم آخر
  try {
    const existing = await admin.auth().getUserByEmail(newEmail);
    if (existing && existing.uid !== uid) throw new HttpsError('already-exists', 'البريد مستخدم لحساب آخر');
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    // auth/user-not-found = البريد متاح، نكمل
  }

  await admin.auth().updateUser(uid, { email: newEmail, emailVerified: false });
  const db = admin.database();
  const updates = {};
  updates['tenants/' + targetTid + '/ledger/users/' + uid + '/email'] = newEmail;
  updates['userIndex/' + uid + '/email'] = newEmail;
  await db.ref('/').update(updates);
  return { ok: true };
});
