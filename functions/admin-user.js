#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   admin-user.js — أداة محلية لإدارة حسابات المستخدمين (بلا Cloud Functions)
   ────────────────────────────────────────────────────────────────────────
   تعمل على الخطة المجانية (Spark): Firebase Admin SDK لا يتطلّب Blaze،
   إنما الذي يتطلّبه هو *استضافة* الدوال السحابية فقط.

   🔑 المفتاح يبقى *خارج المشروع* (لا داخل مجلد iCloud) — التجهيز مرّة واحدة:
     1) Firebase Console ← ⚙️ Project settings ← Service accounts
        ← "Generate new private key"
     2) احفظه خارج المشروع، والمسار الافتراضي الآمن:
           ~/.gbr/serviceAccountKey.json
        (مجلد مخفي في منزلك — لا يتزامن مع iCloud ولا يدخل المستودع)
        mkdir -p ~/.gbr && mv ~/Downloads/<الملف>.json ~/.gbr/serviceAccountKey.json
        chmod 600 ~/.gbr/serviceAccountKey.json
     3) cd functions && npm install   (مرّة واحدة)

   ترتيب البحث عن المفتاح:
     --key <path>  ←  $GOOGLE_APPLICATION_CREDENTIALS  ←  ~/.gbr/serviceAccountKey.json
     ←  اعتماد التطبيق الافتراضي (gcloud ADC إن وُجد)

   الاستخدام:
     node admin-user.js find <email>
     node admin-user.js set-password <email> <newPassword>
     node admin-user.js set-email <oldEmail> <newEmail>
     node admin-user.js list <tenantIdOrEmail>
     (أضف --key /path/to/key.json لأي أمر لتحديد المفتاح يدوياً)
   ════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const os = require('os');
const admin = require('firebase-admin');

const DB_URL = 'https://emplyeeapp-1dc64-default-rtdb.firebaseio.com';
const HOME_KEY = path.join(os.homedir(), '.gbr', 'serviceAccountKey.json');

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

// يبحث عن المفتاح خارج المشروع فقط (لا يُخزَّن داخل المستودع/iCloud)
function resolveKeyPath(cliKey) {
    const candidates = [cliKey, process.env.GOOGLE_APPLICATION_CREDENTIALS, HOME_KEY].filter(Boolean);
    for (const p of candidates) {
        const abs = p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(p);
        if (fs.existsSync(abs)) return abs;
    }
    return null;
}

function initAdmin(cliKey) {
    const keyPath = resolveKeyPath(cliKey);
    if (keyPath) {
        let sa;
        try { sa = JSON.parse(fs.readFileSync(keyPath, 'utf8')); }
        catch (e) { die('تعذّرت قراءة ملف المفتاح: ' + keyPath + '\n   ' + e.message); }
        if (!sa.private_key || !sa.client_email) die('الملف ليس مفتاح حساب خدمة صحيحاً: ' + keyPath);
        admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL: DB_URL });
        console.log('🔑 المفتاح: ' + keyPath);
        return admin;
    }
    // اعتماد التطبيق الافتراضي (gcloud ADC) — فقط إن كانت موجودة فعلاً
    const adcPath = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(adcPath)) {
        admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: DB_URL });
        console.log('🔑 المصادقة: اعتماد التطبيق الافتراضي (gcloud ADC)');
        return admin;
    }

    die('لم أجد مفتاح حساب خدمة. المفتاح يجب أن يبقى *خارج المشروع*.\n\n' +
        '   الطريقة الموصى بها:\n' +
        '     1) Firebase Console ← Project settings ← Service accounts ← Generate new private key\n' +
        '     2) mkdir -p ~/.gbr && mv ~/Downloads/<الملف>.json ~/.gbr/serviceAccountKey.json\n' +
        '     3) chmod 600 ~/.gbr/serviceAccountKey.json\n\n' +
        '   أو حدّده يدوياً:  node admin-user.js <أمر> ... --key /مسار/المفتاح.json\n' +
        '   أو عبر البيئة:    export GOOGLE_APPLICATION_CREDENTIALS=/مسار/المفتاح.json');
}

// يجلب المستخدم من Auth + سجلّه في قاعدة البيانات (الشركة/الاسم/الدور)
async function resolveUser(email) {
    let user;
    try { user = await admin.auth().getUserByEmail(String(email).trim().toLowerCase()); }
    catch (e) {
        const code = (e && e.code) || '', msg = (e && e.message) || String(e);
        if (/user-not-found/i.test(code + msg)) die('لا يوجد حساب بهذا البريد: ' + email);
        if (/credential|default credentials|invalid_grant|UNAUTHENTICATED|permission|PERMISSION_DENIED|invalid_client/i.test(code + ' ' + msg))
            die('تعذّرت المصادقة مع Firebase — تحقّق من صلاحية مفتاح حساب الخدمة.\n   التفاصيل: ' + msg);
        die('خطأ أثناء قراءة الحساب: ' + msg);
    }
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
    // استخراج --key ثم بقية الوسائط
    const argv = process.argv.slice(2);
    let cliKey = null;
    const ki = argv.indexOf('--key');
    if (ki !== -1) { cliKey = argv[ki + 1]; argv.splice(ki, 2); }
    const [cmd, a, b] = argv;
    if (!cmd || ['-h', '--help', 'help'].includes(cmd)) {
        console.log(`
🔧 أداة إدارة المستخدمين (محلية — بلا Blaze)

  node admin-user.js find <email>                     عرض بيانات مستخدم
  node admin-user.js set-password <email> <password>   تغيير كلمة المرور
  node admin-user.js set-email <oldEmail> <newEmail>   تغيير بريد الدخول
  node admin-user.js list <tenantId | anyEmail>        سرد مستخدمي شركة

  سياسة كلمة المرور: 8+ أحرف · حرف كبير · حرف صغير · رقم · رمز

🔑 المفتاح يبقى خارج المشروع. ترتيب البحث:
  --key <path>  ←  $GOOGLE_APPLICATION_CREDENTIALS  ←  ~/.gbr/serviceAccountKey.json  ←  ADC
  التجهيز:  mkdir -p ~/.gbr && mv ~/Downloads/<الملف>.json ~/.gbr/serviceAccountKey.json
`);
        process.exit(0);
    }
    initAdmin(cliKey);
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
