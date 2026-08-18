// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  اختبار حدّ الأمان في وسيط قراءة الفواتير — التحقّق من رمز هوية Firebase        ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ينشأ لأن النسخة الأولى حلّلت شهادات X.509 يدوياً (ASN.1) وفشلت على كل         ║
// ║  مفاتيح Google الفعلية — فرُفض كل طلب برسالة «انتهت جلستك» المضلّلة.            ║
// ║  المسار كان غير مُختبَر إطلاقاً. هنا نولّد مفتاحاً ونوقّع رموزاً حقيقية.          ║
// ║  التشغيل: npm run test:proxy                                                  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
import worker, { verifyFirebaseToken, toGeminiSchema, geminiErrorType } from '../workers/invoice-ai-proxy/worker.js';

const PROJECT = 'emplyeeapp-1dc64';
const KID = 'test-kid-1';
let pass = 0, fail = 0;

const b64url = buf => Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ── مفتاح توقيع محلّي يقوم مقام مفتاح Google ──────────────────────────────────
const kp = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']);
const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
Object.assign(pubJwk, { kid: KID, alg: 'RS256', use: 'sig' });
delete pubJwk.key_ops; delete pubJwk.ext;

// مفتاح دخيل — لتزوير التوقيع
const kpEvil = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']);

// نعترض fetch لنقدّم مجموعة JWK بدل الاتصال بـGoogle
let jwkServed = { keys: [pubJwk] };
let jwkStatus = 200;
globalThis.fetch = async () => ({
    ok: jwkStatus === 200, status: jwkStatus,
    json: async () => jwkServed,
    headers: { get: () => 'public, max-age=3600' }
});

const now = () => Math.floor(Date.now() / 1000);

async function mint(claims, opts) {
    const o = opts || {};
    const header = { alg: o.alg || 'RS256', kid: o.kid || KID, typ: 'JWT' };
    const payload = Object.assign({
        sub: 'uid-123', email: 'user@example.com',
        aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT,
        iat: now() - 60, exp: now() + 3600
    }, claims);
    const signing = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5',
        o.evil ? kpEvil.privateKey : kp.privateKey, new TextEncoder().encode(signing));
    return signing + '.' + b64url(sig);
}

const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log('  ❌ ' + name + (detail ? '  → ' + detail : '')); }
};

/** يتوقّع رفضاً بسبب بعينه — لا مجرّد «رفض ما». */
async function rejects(name, token, expectReason) {
    try {
        await verifyFirebaseToken(token, PROJECT);
        ok(name, false, 'قُبل وكان يجب أن يُرفض');
    } catch (e) {
        ok(name, e.message === expectReason, `السبب «${e.message}» بدل «${expectReason}»`);
    }
}

console.log('\n🔐 التحقّق من رمز هوية Firebase');

// ── المسار السليم — هذا بالضبط ما كان مكسوراً ──────────────────────────────
try {
    const r = await verifyFirebaseToken(await mint(), PROJECT);
    ok('رمز صحيح يُقبل', r && r.uid === 'uid-123', JSON.stringify(r));
    ok('يُستخرج البريد', r && r.email === 'user@example.com', JSON.stringify(r));
} catch (e) {
    ok('رمز صحيح يُقبل', false, e.message);
    ok('يُستخرج البريد', false, e.message);
}

// ── الرفض: كل فحص أمني بمفرده ──────────────────────────────────────────────
await rejects('توقيع مزوّر يُرفض', await mint({}, { evil: true }), 'bad_signature');
await rejects('رمز منتهٍ يُرفض', await mint({ exp: now() - 10 }), 'token_expired');
await rejects('جمهور خاطئ يُرفض', await mint({ aud: 'other-project' }), 'bad_audience');
await rejects('مُصدِر خاطئ يُرفض', await mint({ iss: 'https://evil.example/' + PROJECT }), 'bad_issuer');
await rejects('بلا هوية موضوع يُرفض', await mint({ sub: '' }), 'no_subject');
await rejects('معرّف مفتاح مجهول يُرفض', await mint({}, { kid: 'nope' }), 'unknown_kid');
await rejects('رمز مشوّه يُرفض', 'abc.def', 'malformed_token');
await rejects('رمز فارغ يُرفض', '', 'malformed_token');
// ثلاثة أجزاء لكنها ليست JSON — يجب ألا يتسرّب نصّ خطأ التحليل الخام
await rejects('ثلاثة أجزاء غير صالحة تُرفض', 'not.a.token', 'malformed_token');
await rejects('رأس ليس كائناً يُرفض', b64url('"x"') + '.' + b64url('{}') + '.AA', 'malformed_token');

// خوارزمية «none» — هجوم كلاسيكي على JWT
{
    const h = b64url(JSON.stringify({ alg: 'none', kid: KID, typ: 'JWT' }));
    const p = b64url(JSON.stringify({ sub: 'attacker', aud: PROJECT,
        iss: 'https://securetoken.google.com/' + PROJECT, iat: now() - 60, exp: now() + 3600 }));
    await rejects('خوارزمية none تُرفض', h + '.' + p + '.', 'bad_alg');
}

// ── متانة جلب المفاتيح ─────────────────────────────────────────────────────
console.log('\n🌐 جلب مفاتيح Google');
{
    const mod = await import('../workers/invoice-ai-proxy/worker.js');
    jwkServed = { keys: [] };                       // ردّ فارغ
    jwkStatus = 200;
    // نُبطل الذاكرة المؤقتة بانتظار انتهاء صلاحيتها ليس ممكناً هنا، فنفحص عبر رمز جديد
    // (المفاتيح مخزّنة، لذا نتحقّق فقط أن المسار الناجح ما زال يعمل بعد التخزين)
    try {
        const r = await verifyFirebaseToken(await mint(), PROJECT);
        ok('المفاتيح المخزّنة تُعاد بلا جلب جديد', r.uid === 'uid-123');
    } catch (e) { ok('المفاتيح المخزّنة تُعاد بلا جلب جديد', false, e.message); }
    void mod;
}

// ── مفتاح Anthropic: التنظيف وفحص الشكل وعدم التسريب ───────────────────────
// invalid x-api-key من Anthropic لا يميّز «مفتاح مُبطَل» عن «مفتاح التصق به سطر
// جديد عند اللصق» — والعلاجان مختلفان. نفحص الشكل عندنا ونُبلغ بلا كشف.
console.log('\n🔑 مفتاح Anthropic');
{
    const GOOD = 'sk-ant-api03-' + 'a'.repeat(80);
    const envOf = k => ({ ANTHROPIC_API_KEY: k, FIREBASE_PROJECT_ID: PROJECT, ALLOWED_ORIGIN: '*' });
    const getHealth = async k => {
        const res = await worker.fetch(new Request('https://x/', { method: 'GET' }), envOf(k));
        return { body: await res.clone().json(), raw: await res.text() };
    };

    const clean = await getHealth(GOOD);
    ok('مفتاح سليم: مضبوط وشكله صالح',
        clean.body.keyConfigured === true && clean.body.keyFormatValid === true, JSON.stringify(clean.body));
    ok('فحص الصحّة لا يسرّب المفتاح', !clean.raw.includes(GOOD) && !clean.raw.includes('sk-ant'), clean.raw);

    const padded = await getHealth('\n  ' + GOOD + '  \n');
    ok('مسافات وأسطر جديدة تُنظَّف', padded.body.keyFormatValid === true, JSON.stringify(padded.body));

    const cut = await getHealth('sk-ant-api03-abc');
    ok('مفتاح مقصوص يُرصد', cut.body.keyConfigured === true && cut.body.keyFormatValid === false, JSON.stringify(cut.body));

    const none = await getHealth('   ');
    ok('مفتاح فارغ يُرصد', none.body.keyConfigured === false && none.body.keyFormatValid === false, JSON.stringify(none.body));

    // POST بمفتاح مشوّه: يُرفض قبل أي رحلة إلى Anthropic، وبلا كشف
    let reachedAnthropic = false;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (u, o) => {
        if (String(u).includes('api.anthropic.com')) { reachedAnthropic = true; }
        return realFetch(u, o);
    };
    const res = await worker.fetch(new Request('https://x/', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + await mint() },
        body: JSON.stringify({ fileB64: 'AAAA', mediaType: 'image/png' })
    }), envOf('sk-ant-cut'));
    const txt = await res.text();
    globalThis.fetch = realFetch;

    ok('POST بمفتاح مشوّه يُرفض بسبب مميّز', txt.includes('bad_api_key_format'), txt);
    ok('ولا يُنفق رحلة إلى Anthropic', reachedAnthropic === false);
    ok('ولا يسرّب المفتاح في الرد', !txt.includes('sk-ant-cut'), txt);
}

// ── تحقّق ثابت: لا بقايا من تحليل X.509 اليدوي ─────────────────────────────
console.log('\n🧹 لا بقايا من الآلية المكسورة');
{
    const fs = await import('fs');
    const src = fs.readFileSync(new URL('../workers/invoice-ai-proxy/worker.js', import.meta.url), 'utf8');
    ok('لا استخراج SPKI يدوي', !/extractSpki|asn1Len/.test(src));
    ok('لا استخدام لنقطة شهادات X.509', !/robot\/v1\/metadata\/x509/.test(src));
    ok('يستورد JWK مباشرةً', /importKey\(\s*\n?\s*'jwk'/.test(src));
}

// ── Gemini: تحويل المخطّط ونوع الخطأ ──────────────────────────────────────
console.log('\n🟢 Gemini — تحويل المخطّط');
{
    const g = toGeminiSchema({
        type: 'object', additionalProperties: false,
        required: ['a', 'b'],
        properties: {
            a: { type: ['number', 'null'], description: 'رقم' },
            b: { type: 'string', enum: ['x', 'y'] },
            c: { type: 'array', items: { type: ['string', 'null'] } }
        }
    });
    ok('object → OBJECT', g.type === 'OBJECT', JSON.stringify(g));
    ok('يُسقِط additionalProperties', !('additionalProperties' in g));
    ok('union [number,null] → NUMBER + nullable', g.properties.a.type === 'NUMBER' && g.properties.a.nullable === true, JSON.stringify(g.properties.a));
    ok('enum يبقى على STRING', g.properties.b.type === 'STRING' && Array.isArray(g.properties.b.enum), JSON.stringify(g.properties.b));
    ok('array عناصره تُحوَّل', g.properties.c.type === 'ARRAY' && g.properties.c.items.type === 'STRING' && g.properties.c.items.nullable === true, JSON.stringify(g.properties.c));
    ok('required يُنقل', Array.isArray(g.required) && g.required.length === 2);
}

console.log('\n🟢 Gemini — تصنيف الأخطاء');
{
    ok('429 → quota_exhausted (إشارة السقوط إلى OCR)', geminiErrorType(429, {}) === 'quota_exhausted');
    ok('RESOURCE_EXHAUSTED → quota_exhausted', geminiErrorType(200, { error: { status: 'RESOURCE_EXHAUSTED' } }) === 'quota_exhausted');
    ok('مفتاح غير صالح → authentication_error', geminiErrorType(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }) === 'authentication_error');
    ok('PERMISSION_DENIED → permission_error', geminiErrorType(403, { error: { status: 'PERMISSION_DENIED' } }) === 'permission_error');
    ok('5xx → overloaded_error', geminiErrorType(503, { error: { status: 'UNAVAILABLE' } }) === 'overloaded_error');
}

console.log(`\n${'═'.repeat(52)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(52)}`);
process.exit(fail ? 1 : 0);
