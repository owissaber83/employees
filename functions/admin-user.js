#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   admin-user.js — أداة محلية لإدارة حسابات المستخدمين (بلا Cloud Functions)
   ────────────────────────────────────────────────────────────────────────
   تعمل على الخطة المجانية (Spark): Firebase Admin SDK لا يتطلّب Blaze،
   إنما الذي يتطلّبه هو *استضافة* الدوال السحابية فقط.

   التجهيز (مرّة واحدة):
     1) Firebase Console ← ⚙️ Project settings ← Service accounts
        ← "Generate new private key" ← احفظ الملف باسم:
           functions/serviceAccountKey.json
        ⚠️ هذا الملف مفتاح سيادي — لا تشاركه ولا ترفعه لأي مستودع
           (مُستثنى في .gitignore).
     2) cd functions && npm install   (مرّة واحدة)

   الاستخدام:
     node admin-user.js find <email>
     node admin-user.js set-password <email> <newPassword>
     node admin-user.js set-email <oldEmail> <newEmail>
     node admin-user.js list <tenantIdOrEmail>
   ════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DB_URL = 'https://emplyeeapp-1dc64-default-rtdb.firebaseio.com';
const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');

function die(msg) { console.error('\n❌ ' + msg + '\n'); process.exit(1); }
function ok(msg) { console.log('\n✅ ' + msg + '\n'); }

// سياسة كلمة المرور (مطابقة لسياسة البرنامج): 8+ · حرف كبير · صغير · رقم · رمز
function passwordProblem(p) {
    p = String(p || '');
    if (p.length < 8) return 'كلمة المرور يجب ألا تقل عن 8 أحرف';
    if (!/[A-Z]/.test(p)) return 'يجب أن تحتوي حرفاً إنجليزياً كبيراً (A-Z)';
    if (!/[a-z]/.test(p)) return 'يجب أن تحتوي حرفاً إنجليزياً صغيراً (a-z)';
    if (!/[0-9]/.test(p)) return 'يجب أن تحتوي رقماً';
    if (!/[^A-Za-z0-9]/.test(p)) return 'يجب أن تحتوي رمزاً (مثل ! @ # $ %)';
    return null;
}

function initAdmin() {
    if (!fs.existsSync(KEY_PATH)) {
        die('لم أجد مفتاح حساب الخدمة: functions/serviceAccountKey.json\n' +
            '   حمّله من: Firebase Console ← Project settings ← Service accounts ← Generate new private key');
    }
    const sa = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL: DB_URL });
    return admin;
}

// يجلب المستخدم من Auth + سجلّه في قاعدة البيانات (الشركة/الاسم/الدور)
async function resolveUser(email) {
    let user;
    try { user = await admin.auth().getUserByEmail(String(email).trim().toLowerCase()); }
    catch (e) { die('لا يوجد حساب بهذا البريد: ' + email); }
    const db = admin.database();
    const tid = (await db.ref('userIndex/' + user.uid + '/tenantId').get()).val();
    let rec = null;
    if (tid) rec = (await db.ref('tenants/' + tid + '/ledger/users/' + user.uid).get()).val();
    return { user, tid, rec };
}

function printUser({ user, tid, rec }) {
    console.log('──────────────────────────────────────────');
    console.log('  البريد   : ' + user.email);
    console.log('  UID      : ' + user.uid);
    console.log('  الشركة   : ' + (tid || '— غير مرتبط —'));
    console.log('  الاسم    : ' + ((rec && rec.name) || '—'));
    console.log('  الدور    : ' + ((rec && rec.role) || '—'));
    console.log('  الحالة   : ' + (rec ? (rec.active === false ? '🚫 موقوف' : '✅ نشط') : '—'));
    console.log('  معطّل؟   : ' + (user.disabled ? 'نعم (Auth)' : 'لا'));
    console.log('──────────────────────────────────────────');
}

async function cmdFind(email) {
    const info = await resolveUser(email);
    printUser(info);
}

async function cmdSetPassword(email, newPassword) {
    const problem = passwordProblem(newPassword);
    if (problem) die(problem);
    const info = await resolveUser(email);
    printUser(info);
    await admin.auth().updateUser(info.user.uid, { password: String(newPassword) });
    // أثر تدقيقي داخل الشركة (اختياري — لا يُعطّل العملية إن فشل)
    if (info.tid) {
        try {
            await admin.database().ref('tenants/' + info.tid + '/ledger/users/' + info.user.uid)
                .update({ pwdChangedAt: new Date().toISOString(), pwdChangedBy: 'support-cli' });
        } catch (e) { /* تجاهل */ }
    }
    ok('تم تغيير كلمة المرور للمستخدم ' + info.user.email + '\n   أبلغه بها ليسجّل الدخول فوراً.');
}

async function cmdSetEmail(oldEmail, newEmail) {
    newEmail = String(newEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) die('بريد إلكتروني جديد غير صحيح');
    const info = await resolveUser(oldEmail);
    printUser(info);
    // منع التعارض مع حساب آخر
    try {
        const other = await admin.auth().getUserByEmail(newEmail);
        if (other && other.uid !== info.user.uid) die('البريد الجديد مستخدم لحساب آخر: ' + newEmail);
    } catch (e) { /* غير موجود = متاح */ }

    await admin.auth().updateUser(info.user.uid, { email: newEmail, emailVerified: false });
    const updates = {};
    if (info.tid) updates['tenants/' + info.tid + '/ledger/users/' + info.user.uid + '/email'] = newEmail;
    updates['userIndex/' + info.user.uid + '/email'] = newEmail;
    await admin.database().ref('/').update(updates);
    ok('تم تحديث بريد الدخول:\n   ' + oldEmail + '  ←  ' + newEmail + '\n   يسجّل الدخول بالبريد الجديد فوراً.');
}

async function cmdList(arg) {
    const db = admin.database();
    let tid = arg;
    if (String(arg).includes('@')) { const info = await resolveUser(arg); tid = info.tid; }
    if (!tid) die('لم أتمكن من تحديد الشركة');
    const users = (await db.ref('tenants/' + tid + '/ledger/users').get()).val() || {};
    console.log('\n👥 مستخدمو الشركة ' + tid + ':\n');
    Object.entries(users).forEach(([uid, u]) => {
        console.log('  • ' + (u.email || '—').padEnd(34) + ' | ' + (u.role || '—').padEnd(16) +
            ' | ' + (u.active === false ? '🚫 موقوف' : '✅ نشط') + ' | ' + (u.name || ''));
    });
    console.log('');
}

(async function main() {
    const [, , cmd, a, b] = process.argv;
    if (!cmd || ['-h', '--help', 'help'].includes(cmd)) {
        console.log(`
🔧 أداة إدارة المستخدمين (محلية — بلا Blaze)

  node admin-user.js find <email>                     عرض بيانات مستخدم
  node admin-user.js set-password <email> <password>   تغيير كلمة المرور
  node admin-user.js set-email <oldEmail> <newEmail>   تغيير بريد الدخول
  node admin-user.js list <tenantId | anyEmail>        سرد مستخدمي شركة

  سياسة كلمة المرور: 8+ أحرف · حرف كبير · حرف صغير · رقم · رمز
`);
        process.exit(0);
    }
    initAdmin();
    try {
        if (cmd === 'find') { if (!a) die('الاستخدام: find <email>'); await cmdFind(a); }
        else if (cmd === 'set-password') { if (!a || !b) die('الاستخدام: set-password <email> <newPassword>'); await cmdSetPassword(a, b); }
        else if (cmd === 'set-email') { if (!a || !b) die('الاستخدام: set-email <oldEmail> <newEmail>'); await cmdSetEmail(a, b); }
        else if (cmd === 'list') { if (!a) die('الاستخدام: list <tenantId | anyEmail>'); await cmdList(a); }
        else die('أمر غير معروف: ' + cmd + '  (جرّب: --help)');
    } catch (e) {
        die((e && e.message) || String(e));
    }
    process.exit(0);
})();
