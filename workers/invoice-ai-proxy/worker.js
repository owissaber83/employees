/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  🔐 وسيط قراءة الفواتير بالذكاء الاصطناعي — Cloudflare Worker              ║
 * ║  ────────────────────────────────────────────────────────────────────────  ║
 * ║  سبب وجوده: النظام المحاسبي تطبيق ثابت (static) بلا خادم، ونشر Cloud       ║
 * ║  Functions معطّل على خطة Spark. بدون هذا الوسيط يضطر المتصفح لاستدعاء       ║
 * ║  Anthropic مباشرةً ومعه المفتاح — وهو ما يمنعه متطلّب الأمان صراحةً.         ║
 * ║                                                                            ║
 * ║  المفتاح يعيش هنا فقط (Worker Secret) ولا يصل المتصفح إطلاقاً.              ║
 * ║                                                                            ║
 * ║  ما يفعله:                                                                 ║
 * ║   1. يتحقّق من رمز هوية Firebase (توقيع RS256 + المُصدِر + الجمهور + المدة)  ║
 * ║   2. يحدّ من المعدّل لكل مستخدم (منع استنزاف الرصيد)                        ║
 * ║   3. يقيّد الطلب: نموذج من قائمة مسموحة · سقف توكنات · حجم ملف · نوع ملف     ║
 * ║   4. يمرّر إلى Anthropic ويعيد المحتوى والاستهلاك فقط                        ║
 * ║   5. لا يسجّل محتوى الفواتير إطلاقاً (بيانات مالية حسّاسة)                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * النشر:  انظر README.md في هذا المجلد.
 */

// ── الضوابط ────────────────────────────────────────────────────────────────
const ALLOWED_MODELS = new Set([
    'claude-opus-5',
    'claude-sonnet-5',
    'claude-haiku-4-5'
]);
const ALLOWED_MEDIA = new Set([
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
]);
const MAX_TOKENS_CAP = 16000;
const MAX_FILE_BYTES = 12 * 1024 * 1024;      // 12 م.ب قبل base64
const RATE_PER_MIN = 12;                       // طلب/دقيقة لكل مستخدم
const RATE_PER_DAY = 400;                      // طلب/يوم لكل مستخدم
// شكل مفتاح Anthropic: بادئة ثابتة ثم جسم طويل. نفحصه قبل الإرسال لنميّز
// «مفتاح مقصوص أو ملوّث» عن «مفتاح مُبطَل» — الحالتان تحتاجان علاجين مختلفين.
const KEY_SHAPE = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

// ── Gemini (Google AI) — المزوّد المجاني الافتراضي ───────────────────────────
// نماذج Flash فقط: سريعة، رخيصة، ولها طبقة مجانية سخية تكفي قراءة الفواتير.
const ALLOWED_GEMINI_MODELS = new Set([
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
]);
// مفتاح Google AI Studio يبدأ بـAIza ثم جسم طويل. نفحص الشكل قبل الإرسال.
const GEMINI_KEY_SHAPE = /^AIza[A-Za-z0-9_-]{20,}$/;

// نستخدم نقطة JWK لا نقطة شهادات X.509: يستوردها WebCrypto مباشرةً بلا تحليل ASN.1.
// (النسخة الأولى حلّلت X.509 يدوياً وفشلت على كل مفاتيح Google — فرُفض كل طلب.)
const GOOGLE_JWK = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// ── أدوات ──────────────────────────────────────────────────────────────────
const enc = new TextEncoder();

function cors(env, extra) {
    const origin = env.ALLOWED_ORIGIN || '*';
    return Object.assign({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    }, extra || {});
}

function json(body, status, env) {
    return new Response(JSON.stringify(body), {
        status: status || 200,
        headers: cors(env, { 'content-type': 'application/json; charset=utf-8' })
    });
}

function b64urlToBytes(s) {
    const pad = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(pad + '='.repeat((4 - pad.length % 4) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

// ── التحقق من رمز هوية Firebase ────────────────────────────────────────────
// نتحقّق من التوقيع بمفاتيح Google العامة، ثم من المُصدِر والجمهور والصلاحية.
// بدون ذلك يستطيع أي شخص على الإنترنت استهلاك رصيد Anthropic الخاص بك.
let _keyCache = { until: 0, keys: null };

/** خريطة kid → JWK من Google، مع احترام cache-control الوارد. */
async function googleKeys() {
    const now = Date.now();
    if (_keyCache.keys && now < _keyCache.until) return _keyCache.keys;

    const res = await fetch(GOOGLE_JWK);
    if (!res.ok) throw new Error('jwk_fetch_failed');
    const body = await res.json();
    if (!body || !Array.isArray(body.keys) || !body.keys.length) throw new Error('jwk_empty');

    const map = {};
    for (const k of body.keys) if (k && k.kid) map[k.kid] = k;

    // Google تُدوّر المفاتيح؛ نتبع max-age المعلن بدل رقم ثابت (بحدّ أدنى ساعة).
    const cc = res.headers.get('cache-control') || '';
    const m = cc.match(/max-age=(\d+)/);
    const ttl = Math.max(3600, m ? parseInt(m[1], 10) : 3600) * 1000;

    _keyCache = { until: now + ttl, keys: map };
    return map;
}

/** @returns {{uid:string, email:string}} أو يرمي خطأ. */
async function verifyFirebaseToken(token, projectId) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('malformed_token');
    // فكّ الترميز قد يرمي على مدخلات عشوائية — نوحّده تحت malformed_token
    // حتى لا يتسرّب نصّ خطأ خام إلى الرد.
    let header, payload;
    try {
        const dec = new TextDecoder();
        header = JSON.parse(dec.decode(b64urlToBytes(parts[0])));
        payload = JSON.parse(dec.decode(b64urlToBytes(parts[1])));
    } catch (e) { throw new Error('malformed_token'); }
    if (!header || !payload || typeof header !== 'object' || typeof payload !== 'object') {
        throw new Error('malformed_token');
    }

    if (header.alg !== 'RS256') throw new Error('bad_alg');
    const keys = await googleKeys();
    const jwk = keys[header.kid];
    if (!jwk) throw new Error('unknown_kid');

    const key = await crypto.subtle.importKey(
        'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5', key,
        b64urlToBytes(parts[2]),
        enc.encode(parts[0] + '.' + parts[1])
    );
    if (!ok) throw new Error('bad_signature');

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) throw new Error('token_expired');
    if (payload.iat > now + 300) throw new Error('token_future');
    if (payload.aud !== projectId) throw new Error('bad_audience');
    if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('bad_issuer');
    if (!payload.sub) throw new Error('no_subject');

    return { uid: payload.sub, email: payload.email || '' };
}

// ── تحديد المعدّل ──────────────────────────────────────────────────────────
// يستخدم KV إن كان مربوطاً؛ وإلا يسقط لعدّاد داخل الذاكرة (أضعف لكنه لا يعطّل).
const _memCounts = new Map();

async function rateLimit(env, uid) {
    const minKey = `rl:m:${uid}:${Math.floor(Date.now() / 60000)}`;
    const dayKey = `rl:d:${uid}:${new Date().toISOString().slice(0, 10)}`;

    if (env.RATE_KV) {
        const [m, d] = await Promise.all([env.RATE_KV.get(minKey), env.RATE_KV.get(dayKey)]);
        const mc = (parseInt(m || '0', 10) || 0) + 1;
        const dc = (parseInt(d || '0', 10) || 0) + 1;
        if (mc > RATE_PER_MIN) return { ok: false, scope: 'minute', limit: RATE_PER_MIN };
        if (dc > RATE_PER_DAY) return { ok: false, scope: 'day', limit: RATE_PER_DAY };
        await Promise.all([
            env.RATE_KV.put(minKey, String(mc), { expirationTtl: 120 }),
            env.RATE_KV.put(dayKey, String(dc), { expirationTtl: 90000 })
        ]);
        return { ok: true };
    }

    const now = Date.now();
    const rec = _memCounts.get(uid) || { minAt: now, min: 0, dayAt: now, day: 0 };
    if (now - rec.minAt > 60000) { rec.minAt = now; rec.min = 0; }
    if (now - rec.dayAt > 86400000) { rec.dayAt = now; rec.day = 0; }
    rec.min++; rec.day++;
    _memCounts.set(uid, rec);
    if (rec.min > RATE_PER_MIN) return { ok: false, scope: 'minute', limit: RATE_PER_MIN };
    if (rec.day > RATE_PER_DAY) return { ok: false, scope: 'day', limit: RATE_PER_DAY };
    return { ok: true };
}

// ── Gemini: تحويل مخطّط JSON Schema إلى مخطّط Gemini ─────────────────────────
// Gemini لا يقبل union types مثل ['string','null'] ولا additionalProperties؛
// نحوّل الأنواع إلى حروف كبيرة ونعبّر عن القابلية للـnull بـnullable.
const JSON_TO_GEMINI_TYPE = {
    object: 'OBJECT', array: 'ARRAY', string: 'STRING',
    number: 'NUMBER', integer: 'INTEGER', boolean: 'BOOLEAN'
};
function toGeminiSchema(s) {
    if (!s || typeof s !== 'object') return { type: 'STRING' };
    let type = s.type, nullable = false;
    if (Array.isArray(type)) {
        nullable = type.includes('null');
        type = type.find(t => t !== 'null') || 'string';
    }
    const out = {};
    const gt = JSON_TO_GEMINI_TYPE[type];
    if (gt) out.type = gt;
    if (nullable) out.nullable = true;
    if (s.description) out.description = String(s.description).slice(0, 512);
    if (Array.isArray(s.enum) && s.enum.length) out.enum = s.enum.map(String);
    if (out.type === 'OBJECT') {
        const props = s.properties || {};
        out.properties = {};
        for (const k of Object.keys(props)) out.properties[k] = toGeminiSchema(props[k]);
        if (Array.isArray(s.required) && s.required.length) out.required = s.required.slice();
    } else if (out.type === 'ARRAY') {
        out.items = toGeminiSchema(s.items || { type: 'string' });
    }
    return out;
}

// يحوّل نوع خطأ Gemini إلى نوع موحّد. quota_exhausted هو الإشارة التي يعتمدها
// المتصفح للسقوط إلى OCR المحلي المجاني عند نفاد الحصّة.
function geminiErrorType(status, data) {
    const st = (data && data.error && data.error.status) || '';
    const msg = ((data && data.error && data.error.message) || '').toLowerCase();
    if (status === 429 || st === 'RESOURCE_EXHAUSTED') return 'quota_exhausted';
    if (st === 'PERMISSION_DENIED') return 'permission_error';
    if (msg.includes('api key not valid') || msg.includes('api_key_invalid') || st === 'UNAUTHENTICATED') return 'authentication_error';
    if (status >= 500 || st === 'UNAVAILABLE') return 'overloaded_error';
    if (status === 400) return 'bad_request';
    return 'api_error';
}

async function callGemini(env, { model, fileB64, mediaType, prompt, schema, maxTokens }) {
    const key = String(env.GEMINI_API_KEY || '').trim();
    const useModel = ALLOWED_GEMINI_MODELS.has(model) ? model : 'gemini-2.5-flash';
    const genConfig = { maxOutputTokens: maxTokens, temperature: 0, responseMimeType: 'application/json' };
    if (schema) { try { genConfig.responseSchema = toGeminiSchema(schema); } catch (e) { /* نكتفي بـresponseMimeType */ } }
    const payload = {
        contents: [{
            role: 'user', parts: [
                { inline_data: { mime_type: mediaType, data: fileB64 } },
                { text: prompt + '\n\nأعِد النتيجة ككائن JSON صالح فقط، دون أي نص خارج JSON.' }
            ]
        }],
        generationConfig: genConfig
    };
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
        + encodeURIComponent(useModel) + ':generateContent';
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    return { res, data, useModel };
}

// ── المعالج ────────────────────────────────────────────────────────────────
export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
        // اللصق يجرّ معه مسافة أو سطراً جديداً كثيراً، وAnthropic ترفضه عندئذ
        // بـinvalid x-api-key دون تمييز — فننظّفه قبل أي استخدام.
        const anthropicKey = String(env.ANTHROPIC_API_KEY || '').trim();
        const geminiKey = String(env.GEMINI_API_KEY || '').trim();

        if (request.method === 'GET') {
            // فحص صحّة بلا أسرار — لاختبار الاتصال من صفحة الإعدادات.
            // نُبلغ عن حالة كل مفتاح كقيم منطقية فقط: لا طول ولا حرف منه إطلاقاً.
            return json({
                ok: true, service: 'invoice-ai-proxy',
                providers: {
                    gemini: {
                        keyConfigured: geminiKey.length > 0,
                        keyFormatValid: GEMINI_KEY_SHAPE.test(geminiKey),
                        models: [...ALLOWED_GEMINI_MODELS]
                    },
                    anthropic: {
                        keyConfigured: anthropicKey.length > 0,
                        keyFormatValid: KEY_SHAPE.test(anthropicKey),
                        models: [...ALLOWED_MODELS]
                    }
                },
                // حقول توافقية مع نسخة الواجهة السابقة (تقرأ Anthropic فقط)
                models: [...ALLOWED_MODELS],
                keyConfigured: anthropicKey.length > 0,
                keyFormatValid: KEY_SHAPE.test(anthropicKey)
            }, 200, env);
        }
        if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, env);

        if (!env.FIREBASE_PROJECT_ID) return json({ error: 'proxy_not_configured', message: 'FIREBASE_PROJECT_ID غير مضبوط' }, 500, env);

        // 1) الهوية
        const auth = request.headers.get('authorization') || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        let user;
        try {
            user = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
        } catch (e) {
            return json({ error: 'unauthorized', reason: e.message }, 401, env);
        }

        // 2) المعدّل
        const rl = await rateLimit(env, user.uid);
        if (!rl.ok) {
            return json({
                error: 'rate_limited', scope: rl.scope, limit: rl.limit,
                message: rl.scope === 'minute'
                    ? `تجاوزت ${rl.limit} فاتورة في الدقيقة — انتظر قليلاً`
                    : `تجاوزت ${rl.limit} فاتورة اليوم`
            }, 429, env);
        }

        // 3) الطلب والقيود (مشتركة بين المزوّدين)
        let body;
        try { body = await request.json(); } catch (e) { return json({ error: 'bad_json' }, 400, env); }

        const { fileB64, mediaType, model, maxTokens, effort, prompt, schema, provider } = body || {};

        // نختار المزوّد أولاً ونفحص مفتاحه قبل أي شيء آخر: خطأ الإعداد أهمّ من
        // خطأ المدخلات، ولا نُنفق رحلة إلى المحرّك بمفتاح مشوّه (ولا نكشفه).
        const useProvider = provider === 'anthropic' ? 'anthropic'
            : provider === 'gemini' ? 'gemini'
                : (geminiKey ? 'gemini' : 'anthropic');
        if (useProvider === 'gemini') {
            if (!geminiKey) return json({ error: 'proxy_not_configured', provider: 'gemini', message: 'GEMINI_API_KEY secret غير مضبوط في الـWorker' }, 500, env);
            if (!GEMINI_KEY_SHAPE.test(geminiKey)) return json({ error: 'bad_api_key_format', provider: 'gemini' }, 500, env);
        } else {
            if (!anthropicKey) return json({ error: 'proxy_not_configured', provider: 'anthropic', message: 'ANTHROPIC_API_KEY secret غير مضبوط في الـWorker' }, 500, env);
            if (!KEY_SHAPE.test(anthropicKey)) return json({ error: 'bad_api_key_format', provider: 'anthropic' }, 500, env);
        }

        if (!fileB64 || typeof fileB64 !== 'string') return json({ error: 'missing_file' }, 400, env);
        if (!ALLOWED_MEDIA.has(mediaType)) return json({ error: 'unsupported_media', mediaType }, 400, env);
        const approxBytes = Math.floor(fileB64.length * 0.75);
        if (approxBytes > MAX_FILE_BYTES) {
            return json({ error: 'file_too_large', maxBytes: MAX_FILE_BYTES, bytes: approxBytes }, 413, env);
        }
        const useMax = Math.min(Math.max(parseInt(maxTokens, 10) || 8000, 1024), MAX_TOKENS_CAP);
        if (typeof prompt !== 'string' || prompt.length > 20000) return json({ error: 'bad_prompt' }, 400, env);
        if (schema && typeof schema !== 'object') return json({ error: 'bad_schema' }, 400, env);

        const started = Date.now();

        // ── المسار Gemini (المجاني) ──────────────────────────────────────────
        if (useProvider === 'gemini') {
            let g;
            try { g = await callGemini(env, { model, fileB64, mediaType, prompt, schema, maxTokens: useMax }); }
            catch (e) { return json({ error: 'upstream_unreachable', provider: 'gemini' }, 502, env); }
            if (!g.res.ok) {
                const t = geminiErrorType(g.res.status, g.data);
                const m = (g.data && g.data.error && g.data.error.message) || '';
                return json({ error: 'upstream_error', provider: 'gemini', type: t, message: String(m).slice(0, 300), status: g.res.status }, g.res.status === 429 ? 429 : 502, env);
            }
            const cand = (g.data.candidates && g.data.candidates[0]) || null;
            const fr = cand && cand.finishReason;
            const blocked = (g.data.promptFeedback && g.data.promptFeedback.blockReason) || null;
            if (fr === 'SAFETY' || fr === 'RECITATION' || blocked) {
                return json({
                    ok: true, model: g.useModel, stop_reason: 'refusal',
                    stop_details: { category: fr || blocked }, content: [], usage: null,
                    elapsedMs: Date.now() - started
                }, 200, env);
            }
            const text = ((cand && cand.content && cand.content.parts) || []).map(p => p.text || '').join('');
            const um = g.data.usageMetadata || {};
            return json({
                ok: true, model: g.useModel,
                stop_reason: fr === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn',
                stop_details: null,
                content: [{ type: 'text', text }],
                usage: { input_tokens: um.promptTokenCount || 0, output_tokens: um.candidatesTokenCount || 0 },
                elapsedMs: Date.now() - started
            }, 200, env);
        }

        // ── المسار Anthropic (Claude) ────────────────────────────────────────
        const apiKey = anthropicKey;
        const useModel = ALLOWED_MODELS.has(model) ? model : 'claude-opus-5';

        const block = mediaType === 'application/pdf'
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileB64 } }
            : { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileB64 } };

        const payload = {
            model: useModel,
            max_tokens: useMax,
            messages: [{ role: 'user', content: [block, { type: 'text', text: prompt }] }]
        };
        // إخراج منظّم وفق مخطّط ثابت — أدق بكثير من مطالبة النموذج بـ JSON نصياً
        if (schema) payload.output_config = { format: { type: 'json_schema', schema } };
        if (effort && ['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) {
            payload.output_config = Object.assign({}, payload.output_config, { effort });
        }

        // 4) التمرير
        let res, data;
        try {
            res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(payload)
            });
            data = await res.json();
        } catch (e) {
            return json({ error: 'upstream_unreachable' }, 502, env);
        }

        if (!res.ok) {
            // لا نمرّر تفاصيل داخلية قد تحوي أثراً من المفتاح
            const t = (data && data.error && data.error.type) || 'api_error';
            const m = (data && data.error && data.error.message) || '';
            return json({ error: 'upstream_error', type: t, message: String(m).slice(0, 300), status: res.status }, res.status === 429 ? 429 : 502, env);
        }

        // 5) الرد — المحتوى والاستهلاك فقط. لا تسجيل لمحتوى الفاتورة إطلاقاً.
        return json({
            ok: true,
            model: data.model || useModel,
            stop_reason: data.stop_reason,
            stop_details: data.stop_details || null,
            content: data.content || [],
            usage: data.usage || null,
            elapsedMs: Date.now() - started
        }, 200, env);
    }
};

// يُصدَّر للاختبار فقط (tests/aiproxy.test.mjs) — لا يستخدمه وقت التشغيل.
export { verifyFirebaseToken, googleKeys, toGeminiSchema, geminiErrorType };
