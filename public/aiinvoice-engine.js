// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║   🤖 قراءة الفواتير بالذكاء الاصطناعي — طبقة المحرك (Engine Layer)             ║
// ║   ────────────────────────────────────────────────────────────────────────    ║
// ║   [AI-CFG]   الإعدادات (تعيش في ledger/settings.aiInvoice)                    ║
// ║   [AI-SCHEMA] مخطّط الاستخراج المنظّم + التوجيه                                ║
// ║   [AI-CALL]  الاستدعاء عبر الوسيط الآمن (المفتاح لا يلمس المتصفح)              ║
// ║   [AI-MAP]   تطبيع الرد إلى نموذج داخلي ثابت                                  ║
// ║   [AI-CALC]  ★ الحساب والتحقق — بالكود لا بالنموذج (المتطلّب §10 §27)          ║
// ║   [AI-SA]    قواعد الفاتورة السعودية (رقم ضريبي · س.ت · أنواع الفواتير)        ║
// ║   [AI-CONF]  تقدير الثقة: ثقة النموذج ∧ إشارات النظام                          ║
// ║   [AI-MATCH] مطابقة الموردين والأصناف بالنظام                                  ║
// ║   [AI-DUP]   كشف التكرار                                                      ║
// ║   [AI-CONV]  التحويل إلى فاتورة مشتريات + القيد المحاسبي                       ║
// ║   [AI-STORE] التخزين والحالات وسجل المعالجة والتدقيق والتكلفة                   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

(function () {
    'use strict';

    const AINV = window.AINV = window.AINV || {};
    AINV.VERSION = '1.0.0';

    const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
    const num = v => {
        if (v == null || v === '') return null;
        const t = AINV.toLatinDigits(String(v)).replace(/[,٬،\s]/g, '').replace(/[^\d.\-]/g, '');
        if (!t || t === '-' || t === '.') return null;
        const n = parseFloat(t);
        return isNaN(n) ? null : n;
    };
    AINV.r2 = r2; AINV.num = num;

    /** يحوّل الأرقام العربية-الهندية والفارسية إلى لاتينية. */
    AINV.toLatinDigits = function (s) {
        return String(s == null ? '' : s)
            .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
            .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-CFG] الإعدادات
    // ═══════════════════════════════════════════════════════════════════════════
    const DEFAULTS = {
        enabled: true,
        proxyUrl: '',                // وسيط Cloudflare — اختياري (يلزم لـAnthropic فقط)
        provider: 'gemini',          // gemini (مجاني، افتراضي) | anthropic
        geminiKey: '',               // مفتاح Gemini — نداء مباشر من المتصفح بلا Worker
                                     // (يُقيَّد بالنطاق في Google؛ المقايضة مقبولة لمفتاح مجاني)
        model: 'claude-opus-5',      // نموذج Anthropic حين provider=anthropic
        geminiModel: 'gemini-2.5-flash', // نموذج Gemini حين provider=gemini
        ocrFallback: true,           // عند نفاد حصّة Gemini → OCR محلي مجاني (Tesseract)
        effort: 'high',
        maxTokens: 8000,
        maxFileMB: 10,
        confidenceThreshold: 85,
        retryCount: 2,
        timeoutMs: 120000,
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        autoMatchVendor: true,
        blockOnArithmetic: true,      // لا يُعتمد ما لم تتوازن الإجماليات
        blockOnDuplicate: false       // التكرار تحذير لا مانع (يقرّره المستخدم)
    };
    AINV.DEFAULTS = DEFAULTS;

    AINV.Config = {
        get() {
            const c = (window.cfg && window.cfg.aiInvoice) || {};
            return Object.assign({}, DEFAULTS, c);
        },
        async save(patch) {
            const next = Object.assign({}, AINV.Config.get(), patch);
            await window.update(window.ref(window.db, 'ledger/settings'), { aiInvoice: next });
            if (window.cfg) window.cfg.aiInvoice = next;
            return next;
        },
        /** هل الوحدة جاهزة للعمل فعلاً؟ */
        ready() {
            const c = AINV.Config.get();
            if (!c.enabled) return { ok: false, reason: 'الوحدة معطّلة من الإعدادات' };
            const prov = c.provider || 'gemini';
            if (prov === 'gemini') {
                // Gemini المباشر يكفيه المفتاح؛ ويقبل الوسيط أيضاً إن وُجد.
                if (c.geminiKey && c.geminiKey.trim()) return { ok: true };
                if (c.proxyUrl && /^https:\/\//i.test(c.proxyUrl)) return { ok: true };
                return { ok: false, reason: 'ضع مفتاح Gemini في الإعدادات (يبدأ بـAIza) — أو رابط وسيط' };
            }
            // Anthropic مدفوع: لا يوضع مفتاحه في المتصفح — يلزم الوسيط.
            if (!c.proxyUrl) return { ok: false, reason: 'Anthropic يتطلّب الوسيط — انشر الـWorker وضع رابطه، أو استخدم Gemini' };
            if (!/^https:\/\//i.test(c.proxyUrl)) return { ok: false, reason: 'رابط الوسيط يجب أن يبدأ بـ https://' };
            return { ok: true };
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-SCHEMA] مخطّط الاستخراج
    // ───────────────────────────────────────────────────────────────────────────
    // نستخدم الإخراج المنظّم (structured outputs) لا مجرّد مطالبة النموذج بـJSON:
    // يضمن مطابقة الشكل ويُلغي كل منطق «حاول تفسير الرد».
    // ملاحظة مقصودة: لا نطلب من النموذج أي مجموع أو حاصل ضرب نعتمد عليه —
    // نطلب ما هو **مكتوب في المستند** فقط، والحساب يجري عندنا (§27).
    // ═══════════════════════════════════════════════════════════════════════════
    const S = (type, desc, extra) => Object.assign({ type, description: desc }, extra || {});
    const numOrNull = d => ({ type: ['number', 'null'], description: d });
    const strOrNull = d => ({ type: ['string', 'null'], description: d });

    AINV.SCHEMA = {
        type: 'object',
        additionalProperties: false,
        required: ['document', 'supplier', 'customer', 'items', 'totals', 'confidence', 'warnings'],
        properties: {
            document: {
                type: 'object', additionalProperties: false,
                required: ['document_type', 'invoice_number', 'invoice_date', 'currency'],
                properties: {
                    document_type: S('string', 'نوع المستند كما هو معلن فيه', { enum: ['tax_invoice', 'simplified_tax_invoice', 'credit_note', 'debit_note', 'proforma', 'quotation', 'delivery_note', 'other'] }),
                    invoice_number: strOrNull('رقم الفاتورة كما هو مكتوب'),
                    invoice_date: strOrNull('تاريخ الفاتورة بصيغة YYYY-MM-DD ميلادي. إن كان المذكور هجرياً فحوّله وضع الأصل في hijri_date'),
                    hijri_date: strOrNull('التاريخ الهجري كما هو مكتوب إن وُجد'),
                    due_date: strOrNull('تاريخ الاستحقاق YYYY-MM-DD'),
                    purchase_order_number: strOrNull('رقم أمر الشراء'),
                    contract_number: strOrNull('رقم العقد'),
                    reference_number: strOrNull('أي رقم مرجعي آخر'),
                    currency: S('string', 'رمز العملة ISO مثل SAR')
                }
            },
            supplier: {
                type: 'object', additionalProperties: false,
                required: ['name', 'vat_number'],
                properties: {
                    name: strOrNull('اسم المورد/البائع كما هو مكتوب'),
                    legal_name: strOrNull('الاسم النظامي الكامل إن اختلف'),
                    vat_number: strOrNull('الرقم الضريبي للبائع — أرقام فقط'),
                    commercial_registration: strOrNull('رقم السجل التجاري — أرقام فقط'),
                    address: strOrNull('العنوان'),
                    phone: strOrNull('الهاتف'),
                    email: strOrNull('البريد'),
                    iban: strOrNull('الآيبان إن وُجد')
                }
            },
            customer: {
                type: 'object', additionalProperties: false,
                required: ['name'],
                properties: {
                    name: strOrNull('اسم العميل/المشتري'),
                    vat_number: strOrNull('الرقم الضريبي للعميل'),
                    commercial_registration: strOrNull('السجل التجاري للعميل'),
                    address: strOrNull('عنوان العميل')
                }
            },
            items: {
                type: 'array',
                description: 'كل سطر من جدول البنود على حدة. لا تدمج بنوداً مختلفة أبداً.',
                items: {
                    type: 'object', additionalProperties: false,
                    required: ['description', 'quantity', 'unit_price'],
                    properties: {
                        item_code: strOrNull('كود/رقم الصنف إن وُجد'),
                        description: S('string', 'وصف الصنف كاملاً كما هو مكتوب'),
                        quantity: numOrNull('الكمية'),
                        unit: strOrNull('الوحدة (قطعة، متر، طن…)'),
                        unit_price: numOrNull('سعر الوحدة قبل الضريبة'),
                        discount: numOrNull('قيمة الخصم على هذا البند (لا نسبة)'),
                        taxable_amount: numOrNull('المبلغ الخاضع للضريبة لهذا البند كما هو مكتوب'),
                        vat_rate: numOrNull('نسبة الضريبة لهذا البند كنسبة مئوية (15 تعني 15%)'),
                        vat_amount: numOrNull('قيمة الضريبة لهذا البند كما هي مكتوبة'),
                        total_amount: numOrNull('إجمالي البند شامل الضريبة كما هو مكتوب')
                    }
                }
            },
            totals: {
                type: 'object', additionalProperties: false,
                required: ['grand_total'],
                properties: {
                    subtotal_before_discount: numOrNull('الإجمالي قبل الخصم'),
                    total_discount: numOrNull('إجمالي الخصم'),
                    taxable_amount: numOrNull('إجمالي المبلغ الخاضع للضريبة'),
                    vat_amount: numOrNull('إجمالي ضريبة القيمة المضافة'),
                    grand_total: numOrNull('الإجمالي النهائي شامل الضريبة'),
                    amount_paid: numOrNull('المدفوع'),
                    amount_due: numOrNull('المتبقي')
                }
            },
            vat_breakdown: {
                type: 'array',
                description: 'إن كانت الفاتورة تحوي أكثر من نسبة ضريبة، فصّلها هنا. اتركها فارغة إن كانت نسبة واحدة.',
                items: {
                    type: 'object', additionalProperties: false,
                    required: ['rate'],
                    properties: {
                        rate: numOrNull('النسبة المئوية'),
                        taxable_amount: numOrNull('الخاضع للضريبة بهذه النسبة'),
                        vat_amount: numOrNull('الضريبة بهذه النسبة')
                    }
                }
            },
            confidence: {
                type: 'object', additionalProperties: false,
                required: ['overall'],
                description: 'ثقتك في كل حقل من 0 إلى 100. كن صادقاً: القيمة المنخفضة أنفع من ثقة زائفة.',
                properties: {
                    overall: numOrNull(''), invoice_number: numOrNull(''), invoice_date: numOrNull(''),
                    supplier_name: numOrNull(''), supplier_vat_number: numOrNull(''),
                    items: numOrNull(''), totals: numOrNull('')
                }
            },
            document_quality: S('string', 'جودة المستند للقراءة', { enum: ['good', 'fair', 'poor', 'unreadable'] }),
            is_invoice: S('boolean', 'هل هذا مستند فاتورة/إشعار فعلاً؟ ضع false لأي مستند آخر.'),
            language: strOrNull('لغة المستند: عربي / إنجليزي / عربي وإنجليزي'),
            warnings: {
                type: 'array', description: 'أي شيء لاحظته: نص غير واضح، حقل ناقص، تعارض ظاهر.',
                items: { type: 'string' }
            }
        }
    };

    AINV.PROMPT = [
        'أنت خبير قراءة فواتير محاسبية سعودية. اقرأ هذا المستند واستخرج بياناته بدقّة تامة.',
        '',
        'قواعد صارمة:',
        '• استخرج ما هو **مكتوب في المستند حرفياً**. لا تحسب ولا تستنتج ولا تصحّح أي رقم.',
        '  إن كان المستند يحوي خطأً حسابياً فانقله كما هو — التحقّق يجري في نظام آخر.',
        '• إن لم يوجد حقل، ضع null. لا تخمّن ولا تملأ بقيمة افتراضية.',
        '• الأرقام بصيغة عشرية لاتينية بنقطة، بلا فواصل آلاف ولا رموز عملة.',
        '• استخرج **كل** سطور جدول البنود دون استثناء ودون دمج بندين في سطر.',
        '• نسبة الضريبة كنسبة مئوية: اكتب 15 لا 0.15. **لا تفترض 15% أبداً** — انقل النسبة المكتوبة،',
        '  وإن كان البند معفياً أو صفرياً فاكتب 0. إن اختلفت النسب بين البنود فعبّئ vat_breakdown.',
        '• الرقم الضريبي السعودي 15 رقماً؛ السجل التجاري 10 أرقام. انقل الأرقام فقط بلا فواصل.',
        '• التاريخ ميلادي YYYY-MM-DD. إن كان المكتوب هجرياً فحوّله وضع الأصل في hijri_date.',
        '• ميّز البائع عن المشتري بدقّة: البائع هو مُصدِر الفاتورة.',
        '• درجات الثقة يجب أن تعكس وضوح المستند فعلاً. لا تعطِ 100 لحقل قرأته بصعوبة.',
        '• إن لم يكن المستند فاتورة أو إشعاراً دائناً/مديناً، ضع is_invoice=false واترك الباقي فارغاً.'
    ].join('\n');

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-CALL] الاستدعاء عبر الوسيط
    // ═══════════════════════════════════════════════════════════════════════════

    AINV.fileToBase64 = function (file) {
        return new Promise((resolve, reject) => {
            const rd = new FileReader();
            rd.onload = () => { const s = String(rd.result); resolve(s.slice(s.indexOf(',') + 1)); };
            rd.onerror = () => reject(new Error('تعذّرت قراءة الملف'));
            rd.readAsDataURL(file);
        });
    };

    /** فحص الملف قبل الإرسال (§4). */
    AINV.validateFile = function (file) {
        const c = AINV.Config.get();
        const type = file.type || '';
        const okType = c.allowedTypes.includes(type) ||
            /\.(pdf|jpe?g|png|webp)$/i.test(file.name || '');
        if (!okType) return { ok: false, reason: `نوع الملف غير مدعوم (${type || 'غير معروف'}) — المدعوم: PDF · JPG · PNG · WEBP` };
        if (!file.size) return { ok: false, reason: 'الملف فارغ أو تالف' };
        const mb = file.size / 1048576;
        if (mb > c.maxFileMB) return { ok: false, reason: `حجم الملف ${mb.toFixed(1)} م.ب يتجاوز الحد ${c.maxFileMB} م.ب` };
        return { ok: true, mediaType: type || guessType(file.name) };
    };
    function guessType(name) {
        const e = String(name || '').toLowerCase();
        if (e.endsWith('.pdf')) return 'application/pdf';
        if (e.endsWith('.png')) return 'image/png';
        if (e.endsWith('.webp')) return 'image/webp';
        return 'image/jpeg';
    }

    /** يجلب رمز هوية Firebase الحالي — يتحقّق منه الوسيط. */
    async function idToken() {
        const u = window.curU;
        if (!u || typeof u.getIdToken !== 'function') throw new Error('لم يُعثر على جلسة مستخدم — أعد تسجيل الدخول');
        return u.getIdToken();
    }

    /**
     * يستدعي الوسيط لاستخراج فاتورة واحدة.
     * @returns {{data:object, usage:object, model:string, elapsedMs:number}}
     */
    AINV.callProxy = async function (fileB64, mediaType, onProgress) {
        const c = AINV.Config.get();
        const ready = AINV.Config.ready();
        if (!ready.ok) throw new Error(ready.reason);

        const token = await idToken();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), c.timeoutMs);
        onProgress && onProgress('جارٍ الإرسال إلى المحرك…', 0.35);

        let res, body;
        try {
            res = await fetch(c.proxyUrl.replace(/\/+$/, '') + '/', {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
                body: JSON.stringify({
                    fileB64, mediaType,
                    provider: c.provider || 'gemini',
                    model: (c.provider === 'anthropic') ? c.model : (c.geminiModel || 'gemini-2.5-flash'),
                    maxTokens: c.maxTokens, effort: c.effort,
                    prompt: AINV.PROMPT, schema: AINV.SCHEMA
                }),
                signal: ctrl.signal
            });
            body = await res.json().catch(() => ({}));
        } catch (e) {
            clearTimeout(timer);
            if (e.name === 'AbortError') throw new Error(`انتهت المهلة (${Math.round(c.timeoutMs / 1000)} ثانية) — الملف كبير أو الاتصال بطيء`);
            throw new Error('تعذّر الوصول إلى الوسيط الآمن — تحقّق من الرابط ومن أن الـWorker منشور');
        }
        clearTimeout(timer);

        if (!res.ok) throw proxyError(res.status, body);
        if (body.stop_reason === 'refusal') {
            const e = new Error('رفض النموذج معالجة هذا المستند' + (body.stop_details && body.stop_details.category ? ` (${body.stop_details.category})` : ''));
            e.code = 'REFUSAL'; throw e;
        }

        onProgress && onProgress('جارٍ تفسير النتيجة…', 0.85);
        const text = (body.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
        let data = null;
        try { data = JSON.parse(text); }
        catch (e) { const m = text.match(/\{[\s\S]*\}/); if (m) { try { data = JSON.parse(m[0]); } catch (e2) { /* يسقط أدناه */ } } }
        if (!data) { const e = new Error('تعذّر تفسير رد المحرك'); e.code = 'PARSE'; throw e; }

        return { data, usage: body.usage || {}, model: body.model, elapsedMs: body.elapsedMs || 0 };
    };

    // الوسيط يردّ سبباً دقيقاً مع 401؛ نعرضه بدل افتراض «انتهت الجلسة».
    // (خطأ في التحقّق داخل الوسيط كان يظهر كجلسة منتهية ويُرسل المستخدم لتسجيل
    //  خروج لا يُصلح شيئاً — التمييز هنا يوفّر ساعات تشخيص.)
    const AUTH_REASONS = {
        token_expired: 'انتهت جلستك — سجّل الخروج ثم الدخول مرة أخرى',
        token_future: 'ساعة جهازك غير مضبوطة — صحّح التاريخ والوقت ثم أعد المحاولة',
        bad_audience: 'الوسيط مضبوط على مشروع Firebase آخر — صحّح FIREBASE_PROJECT_ID في wrangler.toml وأعد النشر',
        bad_issuer: 'الوسيط مضبوط على مشروع Firebase آخر — صحّح FIREBASE_PROJECT_ID في wrangler.toml وأعد النشر',
        bad_signature: 'رُفض توقيع رمز الهوية — أعد نشر الوسيط بأحدث نسخة',
        unknown_kid: 'مفاتيح Google لدى الوسيط قديمة — أعد نشر الوسيط',
        jwk_fetch_failed: 'تعذّر على الوسيط جلب مفاتيح Google — أعد المحاولة بعد قليل',
        malformed_token: 'رمز الهوية غير صالح — سجّل الخروج ثم الدخول مرة أخرى',
        bad_alg: 'رمز الهوية غير صالح — سجّل الخروج ثم الدخول مرة أخرى'
    };

    // أخطاء Anthropic تصل بنوعها؛ نحوّلها إلى إجراء بدل نصّ إنجليزي خام.
    // أشيعها بفارق كبير: مفتاح خاطئ في الوسيط — والمستخدم لا يملك تخمين ذلك.
    const UPSTREAM_TYPES = {
        authentication_error: 'المفتاح المحفوظ في الوسيط غير صالح. '
            + 'لـGemini: npx wrangler secret put GEMINI_API_KEY (من aistudio.google.com). '
            + 'لـAnthropic: npx wrangler secret put ANTHROPIC_API_KEY (من console.anthropic.com).',
        permission_error: 'المفتاح لا يملك صلاحية هذا النموذج — تحقّق من حسابك.',
        billing_error: 'رصيد حساب Anthropic غير كافٍ — أضف رصيداً من console.anthropic.com، أو حوّل المحرّك إلى Gemini المجاني من الإعدادات.',
        quota_exhausted: 'نفدت حصّة Gemini المجانية لهذه الفترة — يجري التحويل إلى القراءة المحلية المجانية (OCR)، أو انتظر تجدّد الحصّة.',
        rate_limit_error: 'تجاوزت حدّ الطلبات — انتظر قليلاً ثم أعد المحاولة.',
        overloaded_error: 'المحرك مزدحم حالياً — أعد المحاولة بعد قليل.',
        bad_request: 'رفض المحرّك الطلب (قد يكون الملف غير مقروء أو المخطّط غير مقبول).',
        not_found_error: 'النموذج المختار غير متاح لحسابك — اختر نموذجاً آخر من الإعدادات.'
    };

    function proxyError(status, body) {
        const map = {
            unauthorized: (body && AUTH_REASONS[body.reason])
                || (body && body.reason ? `رفض الوسيط الجلسة (${body.reason}) — أعد نشر الوسيط بأحدث نسخة` : null)
                || 'انتهت جلستك — سجّل الخروج ثم الدخول مرة أخرى',
            rate_limited: (body && body.message) || 'تجاوزت حد الاستخدام — انتظر قليلاً',
            file_too_large: 'الملف أكبر من الحد المسموح في الوسيط',
            unsupported_media: 'نوع الملف غير مدعوم',
            proxy_not_configured: 'الوسيط غير مكتمل الإعداد — لم يُضبط مفتاح Anthropic فيه',
            bad_api_key_format: 'المفتاح المحفوظ في الوسيط مقصوص أو ملوّث بمسافات (لا يبدأ بـsk-ant- أو أقصر من اللازم). '
                + 'أعد لصقه كاملاً: npx wrangler secret put ANTHROPIC_API_KEY',
            upstream_unreachable: 'تعذّر وصول الوسيط إلى المحرك — أعد المحاولة',
            upstream_error: (body && UPSTREAM_TYPES[body.type])
                || ('خطأ من المحرك: ' + ((body && body.message) || ''))
        };
        const e = new Error(map[body && body.error] || `فشل الاتصال بالوسيط (رمز ${status})`);
        e.code = (body && body.error) || 'HTTP_' + status;
        e.upstreamType = (body && body.type) || '';   // نوع خطأ المحرّك — يقرؤه سقوط OCR
        e.provider = (body && body.provider) || '';
        e.retryable = status === 429 || status >= 500;
        // نفاد حصّة Gemini ليس قابلاً لإعادة المحاولة فوراً — بل يستدعي السقوط إلى OCR.
        if (e.upstreamType === 'quota_exhausted') e.retryable = false;
        return e;
    }

    // ── Gemini المباشر (بلا Worker) ──────────────────────────────────────────
    // المفتاح في الإعدادات ويُقيَّد بالنطاق في Google. نبني نفس طلب الوسيط هنا.

    const JSON_TO_GEMINI_TYPE = { object: 'OBJECT', array: 'ARRAY', string: 'STRING', number: 'NUMBER', integer: 'INTEGER', boolean: 'BOOLEAN' };
    /** يحوّل JSON Schema إلى مخطّط Gemini (لا يقبل union types ولا additionalProperties). */
    AINV.toGeminiSchema = function toGeminiSchema(s) {
        if (!s || typeof s !== 'object') return { type: 'STRING' };
        let type = s.type, nullable = false;
        if (Array.isArray(type)) { nullable = type.includes('null'); type = type.find(t => t !== 'null') || 'string'; }
        const out = {};
        const gt = JSON_TO_GEMINI_TYPE[type];
        if (gt) out.type = gt;
        if (nullable) out.nullable = true;
        if (s.description) out.description = String(s.description).slice(0, 512);
        if (Array.isArray(s.enum) && s.enum.length) out.enum = s.enum.map(String);
        if (out.type === 'OBJECT') {
            out.properties = {}; const props = s.properties || {};
            for (const k of Object.keys(props)) out.properties[k] = toGeminiSchema(props[k]);
            if (Array.isArray(s.required) && s.required.length) out.required = s.required.slice();
        } else if (out.type === 'ARRAY') { out.items = toGeminiSchema(s.items || { type: 'string' }); }
        return out;
    };

    function geminiDirectError(status, body) {
        const st = (body && body.error && body.error.status) || '';
        const msg = ((body && body.error && body.error.message) || '').toLowerCase();
        let type = 'api_error';
        if (status === 429 || st === 'RESOURCE_EXHAUSTED') type = 'quota_exhausted';
        else if (st === 'PERMISSION_DENIED' && !msg.includes('api key')) type = 'permission_error';
        else if (msg.includes('api key not valid') || msg.includes('api_key_invalid') || st === 'UNAUTHENTICATED' || status === 403) type = 'authentication_error';
        else if (status >= 500 || st === 'UNAVAILABLE') type = 'overloaded_error';
        else if (status === 400) type = 'bad_request';
        const MAP = {
            quota_exhausted: 'نفدت حصّة Gemini المجانية لهذه الفترة — يجري التحويل إلى القراءة المحلية المجانية (OCR)، أو انتظر تجدّد الحصّة.',
            permission_error: 'مفتاح Gemini لا يملك صلاحية هذا النموذج — تحقّق من حسابك.',
            authentication_error: 'مفتاح Gemini غير صالح أو مقيَّد بنطاق آخر — تأكّد من المفتاح ومن أن تقييد النطاق في Google يشمل نطاق تطبيقك.',
            overloaded_error: 'Gemini مزدحم حالياً — أعد المحاولة بعد قليل.',
            bad_request: 'رفض Gemini الطلب (قد يكون الملف غير مقروء).',
            api_error: 'خطأ من Gemini: ' + ((body && body.error && body.error.message) || '')
        };
        const e = new Error(MAP[type] || MAP.api_error);
        e.code = 'upstream_error'; e.upstreamType = type; e.provider = 'gemini';
        e.retryable = status === 429 || status >= 500;
        if (type === 'quota_exhausted') e.retryable = false;
        return e;
    }

    /** يستدعي Gemini مباشرةً من المتصفح. نفس عقد callProxy: {data,usage,model,elapsedMs}. */
    AINV.callGeminiDirect = async function (fileB64, mediaType, onProgress) {
        const c = AINV.Config.get();
        const key = (c.geminiKey || '').trim();
        if (!key) throw new Error('لم يُضبط مفتاح Gemini في الإعدادات');
        const model = c.geminiModel || 'gemini-2.5-flash';
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), c.timeoutMs);
        onProgress && onProgress('جارٍ الإرسال إلى Gemini…', 0.35);

        const payload = {
            contents: [{
                role: 'user', parts: [
                    { inline_data: { mime_type: mediaType, data: fileB64 } },
                    { text: AINV.PROMPT + '\n\nأعِد النتيجة ككائن JSON صالح فقط، دون أي نص خارج JSON.' }
                ]
            }],
            generationConfig: {
                maxOutputTokens: c.maxTokens, temperature: 0,
                responseMimeType: 'application/json',
                responseSchema: AINV.toGeminiSchema(AINV.SCHEMA)
            }
        };

        let res, body;
        try {
            res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
                body: JSON.stringify(payload),
                signal: ctrl.signal
            });
            body = await res.json().catch(() => ({}));
        } catch (e) {
            clearTimeout(timer);
            if (e.name === 'AbortError') throw new Error(`انتهت المهلة (${Math.round(c.timeoutMs / 1000)} ثانية) — الملف كبير أو الاتصال بطيء`);
            throw new Error('تعذّر الوصول إلى Gemini — تحقّق من الاتصال بالإنترنت');
        }
        clearTimeout(timer);
        if (!res.ok) throw geminiDirectError(res.status, body);

        const cand = (body.candidates && body.candidates[0]) || null;
        const fr = cand && cand.finishReason;
        const blocked = body.promptFeedback && body.promptFeedback.blockReason;
        if (fr === 'SAFETY' || fr === 'RECITATION' || blocked) {
            const e = new Error('رفض النموذج معالجة هذا المستند' + (blocked ? ` (${blocked})` : '')); e.code = 'REFUSAL'; throw e;
        }
        onProgress && onProgress('جارٍ تفسير النتيجة…', 0.85);
        const text = ((cand && cand.content && cand.content.parts) || []).map(p => p.text || '').join('');
        let data = null;
        try { data = JSON.parse(text); }
        catch (e) { const m = text.match(/\{[\s\S]*\}/); if (m) { try { data = JSON.parse(m[0]); } catch (e2) { /* يسقط أدناه */ } } }
        if (!data) { const e = new Error('تعذّر تفسير رد Gemini'); e.code = 'PARSE'; throw e; }

        const um = body.usageMetadata || {};
        return { data, usage: { input_tokens: um.promptTokenCount || 0, output_tokens: um.candidatesTokenCount || 0 }, model, elapsedMs: 0 };
    };

    /** يوجّه النداء: Gemini مباشر إن وُجد مفتاحه، وإلا عبر الوسيط. */
    AINV.callModel = function (fileB64, mediaType, onProgress) {
        const c = AINV.Config.get();
        if ((c.provider || 'gemini') === 'gemini' && c.geminiKey && c.geminiKey.trim()) {
            return AINV.callGeminiDirect(fileB64, mediaType, onProgress);
        }
        return AINV.callProxy(fileB64, mediaType, onProgress);
    };

    /**
     * الاستخراج الكامل مع إعادة المحاولة والسقوط إلى OCR.
     * المسار: Gemini (المجاني) → عند نفاد الحصّة → Tesseract محلي مجاني.
     * @returns {{data, usage, model, elapsedMs, viaOcr?}}
     */
    AINV.extractInvoice = async function (file, fileB64, mediaType, onProgress) {
        const c = AINV.Config.get();
        const retries = Math.max(0, c.retryCount || 0);
        let attempt = 0, lastErr = null;
        while (attempt <= retries) {
            try {
                return await AINV.callModel(fileB64, mediaType, onProgress);
            } catch (e) {
                lastErr = e;
                // نفاد حصّة Gemini المجانية → القراءة المحلية المجانية (OCR)
                const quota = e.upstreamType === 'quota_exhausted' || e.code === 'rate_limited';
                if (quota && c.ocrFallback && (c.provider || 'gemini') === 'gemini') {
                    onProgress && onProgress('نفدت حصّة Gemini — قراءة محلية مجانية (OCR)…', 0.42);
                    try { return await AINV.ocrExtract(file, mediaType, onProgress); }
                    catch (e2) { e.message += ' — وتعذّرت القراءة المحلية أيضاً: ' + (e2.message || ''); throw e; }
                }
                attempt++;
                if (!e.retryable || attempt > retries) throw e;
                onProgress && onProgress(`تعذّر الاتصال — إعادة المحاولة ${attempt}/${retries}…`, 0.4);
                await new Promise(r => setTimeout(r, 1200 * attempt));
            }
        }
        throw lastErr || new Error('فشل غير معروف');
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-OCR] القراءة المحلية المجانية (Tesseract) — احتياط عند نفاد حصّة Gemini
    // ───────────────────────────────────────────────────────────────────────────
    // Tesseract.js وpdf.js محمّلان عالمياً من index.html. OCR يقرأ النصّ الخام فقط،
    // فالحقول تقديرية ومُعلَّمة بثقة منخفضة وتحذير — تُراجَع يدوياً قبل الاعتماد.
    // ═══════════════════════════════════════════════════════════════════════════

    /** يشغّل OCR على الملف ويعيد بنية raw متوافقة مع AINV.map. */
    AINV.ocrExtract = async function (file, mediaType, onProgress) {
        const T = window.Tesseract;
        if (!T) throw new Error('محرّك القراءة المحلية (OCR) غير محمّل — تحقّق من الاتصال بالإنترنت وأعد تحميل الصفحة');

        const recog = async (image, label) => {
            const res = await T.recognize(image, 'ara+eng', {
                logger: m => {
                    if (onProgress && m.status === 'recognizing text') {
                        onProgress(`قراءة محلية (OCR) — ${label} ${Math.round((m.progress || 0) * 100)}%`, 0.5 + (m.progress || 0) * 0.4);
                    }
                }
            });
            return (res && res.data && res.data.text) || '';
        };

        let text = '';
        if (mediaType === 'application/pdf') {
            const pdfjs = window.pdfjsLib;
            if (!pdfjs) throw new Error('مكتبة عرض PDF غير محمّلة — تعذّرت القراءة المحلية للـPDF');
            const buf = new Uint8Array(await file.arrayBuffer());
            const pdf = await pdfjs.getDocument({ data: buf }).promise;
            const pages = Math.min(pdf.numPages, 3);   // أول 3 صفحات فقط (زمن المعالجة)
            for (let i = 1; i <= pages; i++) {
                const page = await pdf.getPage(i);
                const vp = page.getViewport({ scale: 2 });
                const cv = document.createElement('canvas');
                cv.width = vp.width; cv.height = vp.height;
                await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
                text += '\n' + await recog(cv, `صفحة ${i}/${pages}`);
            }
        } else {
            text = await recog(file, 'صورة');
        }

        return {
            data: AINV.parseOcrText(text),
            usage: { input_tokens: 0, output_tokens: 0 },
            model: 'tesseract-ocr', elapsedMs: 0, viaOcr: true, rawText: text
        };
    };

    /** يستخرج ما أمكن من نصّ OCR خام → بنية raw (بثقة منخفضة وتحذير). */
    AINV.parseOcrText = function (rawText) {
        const text = AINV.toLatinDigits(String(rawText || ''));
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const low = s => String(s).toLowerCase();

        const numsIn = line => {
            const out = [], re = /-?\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;
            let m; while ((m = re.exec(line))) { const v = parseFloat(m[0].replace(/[,\s]/g, '')); if (!isNaN(v)) out.push(v); }
            return out;
        };
        const lastNumOn = labels => {
            for (const line of lines) if (labels.some(k => low(line).includes(k))) { const ns = numsIn(line); if (ns.length) return ns[ns.length - 1]; }
            return null;
        };
        const maxNumOn = labels => {
            let best = null;
            for (const line of lines) if (labels.some(k => low(line).includes(k))) { const ns = numsIn(line); if (ns.length) { const v = Math.max.apply(null, ns); if (best == null || v > best) best = v; } }
            return best;
        };

        const vatNumber = (text.match(/\b(3\d{14})\b/) || text.match(/\b(\d{15})\b/) || [])[1] || null;
        const crNumber = (text.match(/\b(\d{10})\b/) || [])[1] || null;

        let invoiceNumber = null;
        for (const line of lines) {
            const m = line.match(/(?:فاتورة\s*(?:ضريبية)?\s*رقم|رقم\s*الفاتورة|invoice\s*(?:no|number|#)|inv\s*#?)\s*[:#\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]*)/i);
            if (m && m[1]) { invoiceNumber = m[1]; break; }
        }

        let invoiceDate = null;
        const dm = text.match(/\b(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})\b/) || text.match(/\b(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4})\b/);
        if (dm) invoiceDate = dm[1];

        let currency = 'SAR';
        if (/\bUSD\b|دولار|\$/i.test(text)) currency = 'USD';
        else if (/\bEUR\b|يورو|€/i.test(text)) currency = 'EUR';

        const grand = maxNumOn(['الاجمالي شامل', 'الإجمالي شامل', 'شامل الضريبة', 'الاجمالي الكلي', 'الإجمالي الكلي', 'المجموع الكلي', 'المستحق', 'grand total', 'total amount', 'total due', 'amount due', 'الاجمالي', 'الإجمالي', 'المجموع', 'total']);
        const vat = lastNumOn(['ضريبة القيمة المضافة', 'القيمة المضافة', 'ضريبة القيمه', 'الضريبة', 'الضريبه', 'vat', 'tax']);
        const taxable = lastNumOn(['الاجمالي الخاضع', 'الإجمالي الخاضع', 'الخاضع للضريبة', 'قبل الضريبة', 'المبلغ الخاضع', 'subtotal', 'sub total', 'net amount', 'الصافي']);

        let supplierName = null;
        for (const line of lines.slice(0, 8)) {
            const letters = (line.match(/[A-Za-z؀-ۿ]/g) || []).length;
            const dg = (line.match(/\d/g) || []).length;
            if (letters >= 4 && dg <= 2 && !/فاتورة|invoice|tax|ضريب/i.test(line)) { supplierName = line; break; }
        }

        return {
            is_invoice: true,
            document_quality: 'poor',
            language: /[؀-ۿ]/.test(text) ? 'ar' : 'en',
            document: {
                document_type: 'other', invoice_number: invoiceNumber, invoice_date: invoiceDate,
                hijri_date: null, due_date: null, purchase_order_number: null,
                contract_number: null, reference_number: null, currency
            },
            supplier: { name: supplierName, legal_name: null, vat_number: vatNumber, commercial_registration: crNumber, address: null, phone: null, email: null, iban: null },
            customer: { name: null, vat_number: null, commercial_registration: null, address: null },
            items: [],
            totals: { subtotal_before_discount: null, total_discount: null, taxable_amount: taxable, vat_amount: vat, grand_total: grand, amount_paid: null, amount_due: null },
            vat_breakdown: [],
            confidence: { overall: 35 },
            warnings: [
                '⚠️ قُرئت محلياً بالـOCR المجاني (لا بالذكاء الاصطناعي) — كل الحقول تقديرية.',
                'راجِع الأرقام يدوياً وأضِف بنود الجدول قبل الاعتماد.'
            ]
        };
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-MAP] التطبيع إلى نموذج داخلي
    // ═══════════════════════════════════════════════════════════════════════════

    const digits = s => AINV.toLatinDigits(String(s == null ? '' : s)).replace(/\D/g, '');

    /** يطبّع تاريخاً إلى YYYY-MM-DD محلياً (لا نستخدم toISOString — ينزاح يوماً). */
    AINV.normDate = function (s) {
        return AINV.parseDate(s).date;
    };

    /**
     * يحلّل تاريخاً ويبلّغ عن غموضه.
     * الافتراض يوم/شهر (المتّبع في الفواتير السعودية)، لكن حين يكون الطرفان ≤ 12
     * فالتاريخ **غامض فعلاً** (3/2 = 3 فبراير أم 2 مارس؟) وخطؤه ينقل الفاتورة
     * إلى فترة ضريبية خاطئة — لذلك نرفعه للمستخدم بدل ابتلاعه بصمت.
     * @returns {{date:string, ambiguous:boolean, alt:string}}
     */
    AINV.parseDate = function (s) {
        const none = { date: '', ambiguous: false, alt: '' };
        if (!s) return none;
        const t = AINV.toLatinDigits(String(s)).trim();
        const pad = n => String(n).padStart(2, '0');

        let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
        if (m) return { date: `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`, ambiguous: false, alt: '' };

        m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(t);
        if (m) {
            const a = +m[1], b = +m[2], y = m[3];
            if (a > 12 && b <= 12) return { date: `${y}-${pad(b)}-${pad(a)}`, ambiguous: false, alt: '' };
            if (b > 12 && a <= 12) return { date: `${y}-${pad(a)}-${pad(b)}`, ambiguous: false, alt: '' };
            // كلاهما ≤ 12 ⇒ غامض. نأخذ يوم/شهر ونعرض البديل.
            return {
                date: `${y}-${pad(b)}-${pad(a)}`,
                ambiguous: a !== b,
                alt: a === b ? '' : `${y}-${pad(a)}-${pad(b)}`
            };
        }
        return none;
    };

    AINV.map = function (raw) {
        const doc = raw.document || {}, sup = raw.supplier || {}, cus = raw.customer || {}, tot = raw.totals || {};
        const dateInfo = AINV.parseDate(doc.invoice_date);
        const items = (Array.isArray(raw.items) ? raw.items : []).map((it, i) => ({
            idx: i,
            code: String(it.item_code || '').trim(),
            description: String(it.description || '').trim(),
            qty: num(it.quantity),
            unit: String(it.unit || '').trim(),
            unitPrice: num(it.unit_price),
            discount: num(it.discount),
            taxable: num(it.taxable_amount),
            vatRate: num(it.vat_rate),
            vatAmount: num(it.vat_amount),
            total: num(it.total_amount)
        })).filter(l => l.description || l.unitPrice != null || l.total != null);

        return {
            isInvoice: raw.is_invoice !== false,
            docType: doc.document_type || 'other',
            quality: raw.document_quality || 'fair',
            language: raw.language || '',
            number: String(doc.invoice_number || '').trim(),
            date: dateInfo.date,
            dateAmbiguous: dateInfo.ambiguous,
            dateAlt: dateInfo.alt,
            hijriDate: String(doc.hijri_date || '').trim(),
            dueDate: AINV.normDate(doc.due_date),
            poNumber: String(doc.purchase_order_number || '').trim(),
            contractNumber: String(doc.contract_number || '').trim(),
            reference: String(doc.reference_number || '').trim(),
            currency: String(doc.currency || 'SAR').trim().toUpperCase(),
            supplier: {
                name: String(sup.name || '').trim(),
                legalName: String(sup.legal_name || '').trim(),
                vatNumber: digits(sup.vat_number),
                crNumber: digits(sup.commercial_registration),
                address: String(sup.address || '').trim(),
                phone: String(sup.phone || '').trim(),
                email: String(sup.email || '').trim(),
                iban: String(sup.iban || '').replace(/\s/g, '').toUpperCase()
            },
            customer: {
                name: String(cus.name || '').trim(),
                vatNumber: digits(cus.vat_number),
                crNumber: digits(cus.commercial_registration),
                address: String(cus.address || '').trim()
            },
            items,
            totals: {
                subtotalBeforeDiscount: num(tot.subtotal_before_discount),
                discount: num(tot.total_discount),
                taxable: num(tot.taxable_amount),
                vat: num(tot.vat_amount),
                grandTotal: num(tot.grand_total),
                paid: num(tot.amount_paid),
                due: num(tot.amount_due)
            },
            vatBreakdown: (Array.isArray(raw.vat_breakdown) ? raw.vat_breakdown : [])
                .map(b => ({ rate: num(b.rate), taxable: num(b.taxable_amount), vat: num(b.vat_amount) }))
                .filter(b => b.rate != null),
            modelConfidence: raw.confidence || {},
            modelWarnings: Array.isArray(raw.warnings) ? raw.warnings.filter(Boolean) : []
        };
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-CALC] ★ الحساب والتحقق — بالكود لا بالنموذج
    // ───────────────────────────────────────────────────────────────────────────
    // المتطلّب §10 و§27 صريح: النموذج يقرأ، والنظام يحسب. لذلك نعيد احتساب كل
    // سطر وكل مجموع من المدخلات الأولية (كمية × سعر) ونقارنها بما نقله النموذج.
    // أي فارق يتجاوز التسامح يصبح خطأ تحقّق يمنع الاعتماد.
    // ═══════════════════════════════════════════════════════════════════════════
    const TOL_LINE = 0.02;      // تسامح تقريب لكل بند
    const TOL_TOTAL = 0.05;     // تسامح تقريب للإجماليات
    AINV.TOL_LINE = TOL_LINE; AINV.TOL_TOTAL = TOL_TOTAL;

    /**
     * يعيد احتساب بند واحد من الأساس.
     * @returns {{lineSubtotal, taxable, vatAmount, lineTotal, issues:[]}}
     */
    AINV.computeLine = function (line) {
        const issues = [];
        const qty = line.qty == null ? 1 : line.qty;
        const price = line.unitPrice == null ? 0 : line.unitPrice;
        const disc = line.discount == null ? 0 : line.discount;

        const lineSubtotal = r2(qty * price);
        const taxable = r2(lineSubtotal - disc);
        // النسبة: المكتوبة إن وُجدت، وإلا نستنتجها من المبلغ المكتوب، وإلا 0.
        let rate = line.vatRate;
        if (rate == null && line.vatAmount != null && taxable) rate = r2(line.vatAmount / taxable * 100);
        if (rate == null) rate = 0;
        const vatAmount = r2(taxable * rate / 100);
        const lineTotal = r2(taxable + vatAmount);

        if (line.taxable != null && Math.abs(line.taxable - taxable) > TOL_LINE) {
            issues.push({ field: 'taxable', expected: taxable, found: line.taxable, msg: `الخاضع للضريبة المكتوب ${line.taxable} لا يساوي (الكمية × السعر − الخصم) = ${taxable}` });
        }
        if (line.vatAmount != null && Math.abs(line.vatAmount - vatAmount) > TOL_LINE) {
            issues.push({ field: 'vatAmount', expected: vatAmount, found: line.vatAmount, msg: `ضريبة البند المكتوبة ${line.vatAmount} لا تساوي ${taxable} × ${rate}% = ${vatAmount}` });
        }
        if (line.total != null && Math.abs(line.total - lineTotal) > TOL_LINE) {
            issues.push({ field: 'total', expected: lineTotal, found: line.total, msg: `إجمالي البند المكتوب ${line.total} لا يساوي ${taxable} + ${vatAmount} = ${lineTotal}` });
        }
        return { qty, price, discount: disc, rate, lineSubtotal, taxable, vatAmount, lineTotal, issues };
    };

    /**
     * يعيد احتساب الفاتورة كاملة ويقارنها بالمنقول.
     * @returns {{computed:object, errors:[], warnings:[]}}
     */
    AINV.recompute = function (inv) {
        const errors = [], warnings = [];
        const lines = inv.items.map((l, i) => {
            const c = AINV.computeLine(l);
            c.issues.forEach(is => errors.push(Object.assign({ line: i + 1, desc: l.description }, is)));
            return c;
        });

        const sumSubtotal = r2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
        const sumDiscount = r2(lines.reduce((s, l) => s + l.discount, 0));
        const sumTaxable = r2(lines.reduce((s, l) => s + l.taxable, 0));
        const sumVat = r2(lines.reduce((s, l) => s + l.vatAmount, 0));
        const sumTotal = r2(lines.reduce((s, l) => s + l.lineTotal, 0));

        // تجميع حسب النسبة (§6: أكثر من نسبة ضريبة تُعالَج منفصلة)
        const byRate = {};
        lines.forEach(l => {
            const k = String(l.rate);
            byRate[k] = byRate[k] || { rate: l.rate, taxable: 0, vat: 0, count: 0 };
            byRate[k].taxable = r2(byRate[k].taxable + l.taxable);
            byRate[k].vat = r2(byRate[k].vat + l.vatAmount);
            byRate[k].count++;
        });
        const rates = Object.values(byRate).sort((a, b) => a.rate - b.rate);

        const t = inv.totals;
        const cmp = (label, found, expected, key) => {
            if (found == null) { warnings.push({ field: key, msg: `${label} غير مذكور في المستند — احتُسب من البنود: ${expected}` }); return; }
            if (Math.abs(found - expected) > TOL_TOTAL) {
                errors.push({ field: key, expected, found, msg: `${label} المكتوب ${found} لا يطابق مجموع البنود ${expected} (فرق ${r2(found - expected)})` });
            }
        };
        cmp('المبلغ الخاضع للضريبة', t.taxable, sumTaxable, 'taxable');
        cmp('إجمالي الضريبة', t.vat, sumVat, 'vat');
        cmp('الإجمالي النهائي', t.grandTotal, sumTotal, 'grandTotal');
        if (t.discount != null && sumDiscount && Math.abs(t.discount - sumDiscount) > TOL_TOTAL) {
            errors.push({ field: 'discount', expected: sumDiscount, found: t.discount, msg: `إجمالي الخصم المكتوب ${t.discount} لا يطابق مجموع خصومات البنود ${sumDiscount}` });
        }

        // العلاقة الجوهرية: خاضع + ضريبة = إجمالي
        if (t.taxable != null && t.vat != null && t.grandTotal != null) {
            const chk = r2(t.taxable + t.vat);
            if (Math.abs(chk - t.grandTotal) > TOL_TOTAL) {
                errors.push({ field: 'grandTotal', expected: chk, found: t.grandTotal, msg: `الإجماليات المكتوبة غير متوازنة: ${t.taxable} + ${t.vat} = ${chk} ≠ ${t.grandTotal}` });
            }
        }
        if (t.paid != null && t.due != null && t.grandTotal != null) {
            const chk = r2(t.paid + t.due);
            if (Math.abs(chk - t.grandTotal) > TOL_TOTAL) {
                warnings.push({ field: 'due', msg: `المدفوع ${t.paid} + المتبقي ${t.due} = ${chk} لا يساوي الإجمالي ${t.grandTotal}` });
            }
        }
        if (!inv.items.length) errors.push({ field: 'items', msg: 'لم يُستخرج أي بند من الفاتورة' });

        return {
            computed: {
                lines, subtotal: sumSubtotal, discount: sumDiscount,
                taxable: sumTaxable, vat: sumVat, grandTotal: sumTotal, rates
            },
            errors, warnings
        };
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-SA] قواعد الفاتورة السعودية
    // ═══════════════════════════════════════════════════════════════════════════
    AINV.Saudi = {
        /** الرقم الضريبي السعودي: 15 رقماً يبدأ بـ3 وينتهي بـ3. */
        checkVat(v) {
            const d = digits(v);
            if (!d) return { ok: null, msg: '' };
            if (d.length !== 15) return { ok: false, msg: `الرقم الضريبي ${d} طوله ${d.length} — يجب أن يكون 15 رقماً` };
            if (d[0] !== '3' || d[14] !== '3') return { ok: false, msg: `الرقم الضريبي ${d} يجب أن يبدأ وينتهي بالرقم 3` };
            return { ok: true, msg: '' };
        },
        /** السجل التجاري: 10 أرقام. */
        checkCr(v) {
            const d = digits(v);
            if (!d) return { ok: null, msg: '' };
            if (d.length !== 10) return { ok: false, msg: `السجل التجاري ${d} طوله ${d.length} — يجب أن يكون 10 أرقام` };
            return { ok: true, msg: '' };
        },
        /** الفاتورة الضريبية (B2B) تُلزم بالرقم الضريبي للطرفين. */
        checkType(inv) {
            const out = [];
            if (inv.docType === 'tax_invoice') {
                if (!inv.supplier.vatNumber) out.push('فاتورة ضريبية بلا رقم ضريبي للمورّد — لا تصلح لخصم ضريبة المدخلات');
                if (!inv.customer.vatNumber) out.push('فاتورة ضريبية بلا رقم ضريبي للعميل — راجع صحّة الفاتورة');
            }
            if (inv.docType === 'proforma' || inv.docType === 'quotation') {
                out.push('هذا مستند عرض سعر/فاتورة مبدئية لا فاتورة ضريبية — لا يصلح للترحيل المحاسبي');
            }
            if (inv.docType === 'delivery_note') out.push('هذا سند تسليم لا فاتورة');
            return out;
        },
        /** نسبة الضريبة: نحذّر عند الاختلاف عن نسبة النظام دون فرضها (§7). */
        checkRates(rates) {
            const std = 15;
            const out = [];
            rates.forEach(r => {
                if (r.rate === 0) out.push(`بنود بنسبة 0% (${r.count} بند) — تأكّد أنها معفاة أو صفرية فعلاً`);
                else if (Math.abs(r.rate - std) > 0.01) out.push(`نسبة ضريبة غير معتادة ${r.rate}% على ${r.count} بند — النسبة القياسية ${std}%`);
            });
            if (rates.length > 1) out.push(`الفاتورة تحوي ${rates.length} نسب ضريبة مختلفة — عولجت كل نسبة على حدة`);
            return out;
        }
    };

    /** التحقق الشامل: حسابي + سعودي + سلامة البيانات. */
    AINV.validate = function (inv) {
        const rc = AINV.recompute(inv);
        const errors = rc.errors.slice(), warnings = rc.warnings.slice();

        if (!inv.isInvoice) errors.push({ field: 'document', msg: 'لم يتم التعرّف على مستند فاتورة صالح' });
        if (inv.quality === 'unreadable') errors.push({ field: 'document', msg: 'جودة المستند غير كافية لاستخراج البيانات بدقّة' });
        else if (inv.quality === 'poor') warnings.push({ field: 'document', msg: 'جودة المستند ضعيفة — راجع كل حقل بعناية' });

        if (!inv.number) errors.push({ field: 'number', msg: 'رقم الفاتورة غير مستخرَج' });
        if (!inv.date) errors.push({ field: 'date', msg: 'تاريخ الفاتورة غير مستخرَج' });
        else {
            const d = new Date(inv.date + 'T00:00:00');
            if (isNaN(d)) errors.push({ field: 'date', msg: 'تاريخ الفاتورة غير صالح' });
            else {
                const now = new Date(); now.setHours(23, 59, 59, 999);
                if (d > now) warnings.push({ field: 'date', msg: 'تاريخ الفاتورة في المستقبل' });
                if (d < new Date(now.getFullYear() - 5, 0, 1)) warnings.push({ field: 'date', msg: 'تاريخ الفاتورة أقدم من خمس سنوات' });
            }
        }
        if (inv.dateAmbiguous) {
            warnings.push({
                field: 'date',
                msg: `تاريخ الفاتورة غامض في المستند — قُرئ ${inv.date} وقد يكون ${inv.dateAlt}. تأكّد منه: الخطأ ينقل الفاتورة لفترة ضريبية أخرى.`
            });
        }
        if (inv.dueDate && inv.date && inv.dueDate < inv.date) warnings.push({ field: 'dueDate', msg: 'تاريخ الاستحقاق قبل تاريخ الفاتورة' });
        if (!inv.supplier.name) errors.push({ field: 'supplier.name', msg: 'اسم المورّد غير مستخرَج' });

        const v = AINV.Saudi.checkVat(inv.supplier.vatNumber);
        if (v.ok === false) warnings.push({ field: 'supplier.vatNumber', msg: v.msg });
        const cv = AINV.Saudi.checkVat(inv.customer.vatNumber);
        if (cv.ok === false) warnings.push({ field: 'customer.vatNumber', msg: cv.msg });
        const cr = AINV.Saudi.checkCr(inv.supplier.crNumber);
        if (cr.ok === false) warnings.push({ field: 'supplier.crNumber', msg: cr.msg });

        AINV.Saudi.checkType(inv).forEach(m => warnings.push({ field: 'docType', msg: m }));
        AINV.Saudi.checkRates(rc.computed.rates).forEach(m => warnings.push({ field: 'vatRate', msg: m }));

        const co = (window.cfg && window.cfg.currency) || 'SAR';
        if (inv.currency && inv.currency !== co) warnings.push({ field: 'currency', msg: `عملة الفاتورة ${inv.currency} تختلف عن عملة النظام ${co}` });

        (inv.modelWarnings || []).forEach(m => warnings.push({ field: 'ai', msg: '🤖 ' + m }));

        return { computed: rc.computed, errors, warnings, ok: errors.length === 0 };
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-CONF] الثقة
    // ───────────────────────────────────────────────────────────────────────────
    // لا نعتمد على ثقة النموذج وحدها (قد تكون واثقة وهي مخطئة). نأخذ الأدنى بين
    // ثقة النموذج وإشارات نظامية قابلة للتحقّق: هل الرقم الضريبي بالشكل الصحيح؟
    // هل التاريخ صالح؟ هل الحساب متوازن؟
    // ═══════════════════════════════════════════════════════════════════════════
    AINV.confidence = function (inv, validation) {
        const mc = inv.modelConfidence || {};
        const g = k => { const n = num(mc[k]); return n == null ? null : Math.max(0, Math.min(100, n)); };
        const hasErr = f => validation.errors.some(e => e.field === f || String(e.field).startsWith(f + '.'));

        const sys = {
            invoice_number: inv.number ? (/^[\w\-/]{2,}$/.test(inv.number) ? 95 : 70) : 0,
            invoice_date: inv.date ? 95 : 0,
            supplier_name: inv.supplier.name ? (inv.supplier.name.length > 3 ? 92 : 65) : 0,
            supplier_vat_number: inv.supplier.vatNumber
                ? (AINV.Saudi.checkVat(inv.supplier.vatNumber).ok ? 98 : 45) : 0,
            items: inv.items.length ? (hasErr('items') ? 40 : 90) : 0,
            totals: validation.errors.some(e => ['taxable', 'vat', 'grandTotal', 'discount'].includes(e.field)) ? 35 : 95
        };

        const out = {};
        Object.keys(sys).forEach(k => {
            const m = g(k);
            out[k] = m == null ? sys[k] : Math.round(Math.min(m, sys[k]));
        });
        const vals = Object.values(out);
        const modelOverall = g('overall');
        const computed = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        out.overall = modelOverall == null ? computed : Math.round(Math.min(modelOverall, computed));

        // جودة المستند سقف إضافي
        const cap = { good: 100, fair: 92, poor: 70, unreadable: 30 }[inv.quality] || 90;
        Object.keys(out).forEach(k => { out[k] = Math.min(out[k], cap); });
        return out;
    };

    AINV.lowFields = function (conf) {
        const th = AINV.Config.get().confidenceThreshold;
        return Object.entries(conf).filter(([k, v]) => k !== 'overall' && v < th).map(([k]) => k);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-MATCH] مطابقة الموردين والأصناف (§14 §15)
    // ═══════════════════════════════════════════════════════════════════════════
    function norm(s) {
        return String(s || '').toLowerCase()
            .replace(/[ًٌٍَُِّْٰ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
            .replace(/\b(شركة|مؤسسة|مصنع|company|co|est|establishment|ltd|llc|for|and|the|contracting|trading)\b/g, '')
            .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    }
    /** تشابه توكنات (Jaccard) — أمتن من المسافة الحرفية للأسماء التجارية. */
    function sim(a, b) {
        const A = new Set(norm(a).split(' ').filter(x => x.length > 1));
        const B = new Set(norm(b).split(' ').filter(x => x.length > 1));
        if (!A.size || !B.size) return 0;
        let inter = 0; A.forEach(x => { if (B.has(x)) inter++; });
        return inter / (A.size + B.size - inter);
    }
    AINV.sim = sim;

    /**
     * يبحث عن المورّد في النظام. الرقم الضريبي مطابقة قاطعة؛ الاسم ترشيح.
     * لا يُنشئ مورّداً أبداً — القرار للمستخدم (§14).
     */
    AINV.matchVendor = function (supplier) {
        const vendors = window.vendors || {};
        const entries = Object.entries(vendors);
        const vat = digits(supplier.vatNumber), cr = digits(supplier.crNumber);

        if (vat) {
            const hit = entries.find(([, v]) => digits(v.vatNumber || v.vat) === vat);
            if (hit) return { key: hit[0], vendor: hit[1], score: 1, reason: 'تطابق الرقم الضريبي', exact: true };
        }
        if (cr) {
            const hit = entries.find(([, v]) => digits(v.crNumber || v.cr) === cr);
            if (hit) return { key: hit[0], vendor: hit[1], score: 1, reason: 'تطابق السجل التجاري', exact: true };
        }
        let best = null, bestScore = 0;
        entries.forEach(([k, v]) => {
            const nm = v.nameAr || v.nameEn || v.name || '';
            const s = sim(supplier.name, nm);
            if (s > bestScore) { bestScore = s; best = { key: k, vendor: v }; }
        });
        if (best && bestScore >= 0.5) {
            return Object.assign(best, { score: bestScore, reason: `تشابه الاسم ${Math.round(bestScore * 100)}%`, exact: false });
        }
        return { key: '', vendor: null, score: bestScore, reason: 'مورّد جديد — لم يُعثر على مطابق', exact: false };
    };

    /** يطابق كل بند بصنف في النظام. لا يُنشئ صنفاً أبداً (§15). */
    AINV.matchItems = function (items) {
        const cat = window.invItems || window.items || {};
        const entries = Object.entries(cat);
        return items.map(l => {
            if (l.code) {
                const hit = entries.find(([, it]) => String(it.code || it.sku || '').trim().toLowerCase() === l.code.toLowerCase());
                if (hit) return { key: hit[0], item: hit[1], score: 1, reason: 'تطابق الكود', exact: true };
            }
            let best = null, bestScore = 0;
            entries.forEach(([k, it]) => {
                const nm = it.nameAr || it.nameEn || it.name || '';
                const s = sim(l.description, nm);
                if (s > bestScore) { bestScore = s; best = { key: k, item: it }; }
            });
            if (best && bestScore >= 0.6) return Object.assign(best, { score: bestScore, reason: `تشابه الاسم ${Math.round(bestScore * 100)}%`, exact: false });
            return { key: '', item: null, score: bestScore, reason: 'صنف جديد', exact: false };
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-DUP] كشف التكرار (§20)
    // ═══════════════════════════════════════════════════════════════════════════
    AINV.findDuplicates = function (inv, vendorKey, selfId) {
        const hits = [];
        const push = (kind, where, key, rec, why) => hits.push({ kind, where, key, rec, why });
        const numKey = String(inv.number || '').trim().toLowerCase();
        const total = inv.totals.grandTotal;

        // 1) فواتير المشتريات المسجّلة
        Object.entries(window.pinv || {}).forEach(([k, p]) => {
            const pn = String(p.vendorRef || p.number || '').trim().toLowerCase();
            const sameNum = numKey && pn === numKey;
            const sameVendor = vendorKey && p.vendorKey === vendorKey;
            const sameTotal = total != null && p.grandTotal != null && Math.abs(p.grandTotal - total) < 0.05;
            const sameDate = inv.date && p.date === inv.date;
            if (sameNum && sameVendor) push('pinv', 'فواتير المشتريات', k, p, 'نفس المورّد ونفس رقم فاتورة المورّد');
            else if (sameNum && sameTotal) push('pinv', 'فواتير المشتريات', k, p, 'نفس رقم الفاتورة ونفس الإجمالي');
            else if (sameVendor && sameTotal && sameDate) push('pinv', 'فواتير المشتريات', k, p, 'نفس المورّد والتاريخ والإجمالي');
        });

        // 2) فواتير مقروءة سابقاً بالذكاء الاصطناعي
        Object.entries(window.aiInvoices || {}).forEach(([k, a]) => {
            if (k === selfId || a.status === 'rejected' || a.status === 'failed') return;
            const e = a.extracted || {};
            const an = String(e.number || '').trim().toLowerCase();
            const at = e.totals && e.totals.grandTotal;
            const sameNum = numKey && an === numKey;
            const sameVat = inv.supplier.vatNumber && e.supplier && digits(e.supplier.vatNumber) === digits(inv.supplier.vatNumber);
            const sameTotal = total != null && at != null && Math.abs(at - total) < 0.05;
            if (sameNum && (sameVat || sameTotal)) push('ai', 'الفواتير المقروءة', k, a, 'نفس رقم الفاتورة ونفس المورّد/الإجمالي');
        });

        return hits;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-CONV] التحويل إلى فاتورة مشتريات (§23)
    // ───────────────────────────────────────────────────────────────────────────
    // نبني نفس الشكل الذي يكتبه savePInv تماماً كي يعمل معه postPInv والقيد
    // المحاسبي القائم بلا أي تعديل عليهما.
    // ═══════════════════════════════════════════════════════════════════════════
    AINV.toPurchaseInvoice = function (rec) {
        const inv = rec.extracted, comp = (rec.validation && rec.validation.computed) || AINV.recompute(inv).computed;
        const now = Date.now();
        const uid = (window.curU && window.curU.uid) || '';
        return {
            number: '',                                   // يولّده النظام عند الحفظ
            vendorRef: inv.number,
            vendorKey: rec.vendorKey || '',
            date: inv.date,
            dueDate: inv.dueDate || '',
            poNumber: inv.poNumber || '',
            currency: inv.currency || 'SAR',
            projectKey: rec.projectKey || '',
            expenseType: rec.expenseType || '',
            lines: comp.lines.map((c, i) => {
                const l = inv.items[i] || {};
                return {
                    itemKey: (rec.itemMatches && rec.itemMatches[i] && rec.itemMatches[i].key) || '',
                    code: l.code || '',
                    description: l.description || '',
                    unit: l.unit || '',
                    qty: c.qty,
                    unitPrice: c.price,
                    discount: c.discount,
                    vatRate: c.rate,
                    vatAmount: c.vatAmount,
                    net: c.taxable,
                    total: c.lineTotal
                };
            }),
            subtotal: comp.taxable,
            discountTotal: comp.discount,
            vatTotal: comp.vat,
            grandTotal: comp.grandTotal,
            notes: `📄 مُستخرَجة آلياً من مستند مرفوع (ثقة ${rec.confidence && rec.confidence.overall}%)`,
            // أثر المصدر — يربط السجل المحاسبي بالمستند الأصلي ونتيجة الاستخراج (§34)
            sourceType: 'ai_extraction',
            sourceId: rec.id,
            sourceFileUrl: rec.fileUrl || '',
            status: 'draft',
            createdAt: now, createdBy: uid, updatedAt: now, updatedBy: uid
        };
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AI-STORE] التخزين والحالات والسجل والتكلفة
    // ═══════════════════════════════════════════════════════════════════════════
    AINV.STATUS = {
        uploaded: { ar: 'مرفوعة', color: '#7a8899' },
        processing: { ar: 'قيد المعالجة', color: '#2E75B6' },
        extracted: { ar: 'مستخرَجة', color: '#0F7B8A' },
        needs_review: { ar: 'تحتاج مراجعة', color: '#D97706' },
        validated: { ar: 'مُتحقَّقة', color: '#1B8A4B' },
        draft: { ar: 'مسوّدة', color: '#7F8C8D' },
        approved: { ar: 'معتمدة', color: '#1B8A4B' },
        posted: { ar: 'مُرحَّلة', color: '#12336B' },
        rejected: { ar: 'مرفوضة', color: '#C0392B' },
        failed: { ar: 'فشلت', color: '#C0392B' }
    };

    function refs() {
        const R = window.R;
        if (!R || !R.aiInvoices) throw new Error('سجلات قراءة الفواتير غير مهيّأة في قاعدة البيانات');
        return R;
    }

    AINV.Store = {
        async create(rec) { const r = await window.push(refs().aiInvoices, rec); return r.key; },
        update(id, patch) { return window.update(window.ref(window.db, 'ledger/aiInvoices/' + id), patch); },
        async remove(id) {
            await window.remove(window.ref(window.db, 'ledger/aiInvoices/' + id));
            await window.remove(window.ref(window.db, 'ledger/aiInvoiceLog/' + id)).catch(() => { });
        },
        /** يرفع الملف الأصلي ويعيد رابطه (§25: الملف والسجل كيانان منفصلان). */
        async uploadFile(file) {
            if (typeof window.cloudinaryUpload !== 'function' || !window.isCloudinaryConfigured || !window.isCloudinaryConfigured()) {
                return { url: '', provider: '', note: 'التخزين غير مهيّأ — لم يُحفظ الملف الأصلي' };
            }
            const r = await window.cloudinaryUpload(file);
            return { url: r.url, size: r.size, provider: 'cloudinary', providerId: r.publicId };
        },
        /** سجل المعالجة للمدير (§31) — بلا أي محتوى مالي. */
        log(id, entry) {
            const clean = Object.assign({ at: Date.now(), by: (window.curU && window.curU.email) || '' }, entry);
            Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
            return window.push(window.ref(window.db, 'ledger/aiInvoiceLog/' + id), clean);
        }
    };

    /** تسعير تقريبي — للقياس والرقابة لا للفوترة (§33). */
    AINV.PRICING = {
        'claude-opus-5': { in: 5, out: 25 },
        'claude-sonnet-5': { in: 3, out: 15 },
        'claude-haiku-4-5': { in: 1, out: 5 },
        // أسعار Gemini بالطبقة المدفوعة (للطبقة المجانية = صفر فعلياً؛ نعرضها
        // للرقابة فقط). Flash أرخص بمراحل من Claude.
        'gemini-2.5-flash': { in: 0.30, out: 2.50 },
        'gemini-2.5-flash-lite': { in: 0.10, out: 0.40 },
        'gemini-2.0-flash': { in: 0.10, out: 0.40 },
        'gemini-1.5-flash': { in: 0.075, out: 0.30 },
        'tesseract-ocr': { in: 0, out: 0 }   // OCR محلي — بلا تكلفة إطلاقاً
    };
    AINV.estimateCost = function (model, usage) {
        const p = AINV.PRICING[model] || AINV.PRICING['claude-opus-5'];
        const inTok = (usage && (usage.input_tokens || 0)) + (usage && (usage.cache_read_input_tokens || 0)) * 0.1;
        const outTok = (usage && usage.output_tokens) || 0;
        return Math.round(((inTok / 1e6) * p.in + (outTok / 1e6) * p.out) * 10000) / 10000;
    };

    // ── سجل التدقيق (§13 §19 §36) ─────────────────────────────────────────
    AINV.Audit = {
        async log(action, description, extra) {
            try {
                const u = window.curU || {}, p = window.myP || {};
                const rec = Object.assign({
                    at: Date.now(), by: u.email || '', byName: p.name || u.email || '',
                    module: 'قراءة الفواتير بالذكاء الاصطناعي', action, description
                }, extra || {});
                Object.keys(rec).forEach(k => { if (rec[k] === undefined) delete rec[k]; });
                await window.push(refs().auditLog, rec);
            } catch (e) { console.warn('تعذّر تسجيل التدقيق:', e && e.message); }
        },
        /** يسجّل تعديل المستخدم على قيمة استخرجها الذكاء الاصطناعي. */
        field(rec, field, oldV, newV) {
            const edits = (rec.edits || []).slice();
            edits.push({
                field, aiValue: oldV == null ? '' : String(oldV), userValue: newV == null ? '' : String(newV),
                at: Date.now(), by: (window.curU && window.curU.email) || ''
            });
            return edits;
        }
    };

    console.log('✅ AI Invoice Engine [AI] v' + AINV.VERSION + ' loaded');
})();
