// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║   📄 Professional PDF Editor — طبقة المحرك (Engine Layer)                      ║
// ║   ────────────────────────────────────────────────────────────────────────    ║
// ║   طبقات مفصولة تماماً عن الواجهة (pdfeditor.js). لا تلمس DOM إطلاقاً.            ║
// ║                                                                              ║
// ║   [PE-LIB]  تحميل المكتبات الكسول (pdf-lib · fontkit · خطوط عربية)             ║
// ║   [PE-AR]   العربية: تصنيف ثنائي الاتجاه (bidi) + تقطيع لمقاطع اتجاهية          ║
// ║   [PE-PARSE] محلّل المستند: نصوص/صور/أشكال/صفحات + ألوان + خطوط                 ║
// ║   [PE-STYLE] ذكاء الأنماط: بصمة نمط · نظام تصميم · مطابقة الأصل · بدائل الخطوط  ║
// ║   [PE-CS]   جراحة تدفّق المحتوى (Content-Stream Surgery) — إزالة نص حقيقية        ║
// ║   [PE-OPS]  نموذج عمليات التحرير القابل للتسلسل (Serializable Ops)              ║
// ║   [PE-HIST] محرك التاريخ (Undo/Redo)                                          ║
// ║   [PE-ENG]  واجهة PdfEngine المجرّدة + المحرك المحلي + منفذ Apryse (معطّل)       ║
// ║   [PE-EXP]  محرك التصدير عبر pdf-lib + التحقق النهائي                          ║
// ║   [PE-OCR]  طبقة OCR (Tesseract) للملفات الممسوحة ضوئياً                        ║
// ║   [PE-STORE] طبقة التخزين: Cloudinary (ثنائي) + RTDB (وصفي/نُسخ)               ║
// ║   [PE-AUDIT] طبقة التدقيق — تكتب في R.auditLog الموجود                         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
/* global pdfjsLib, Tesseract */

(function () {
    'use strict';

    const PDFE = window.PDFE = window.PDFE || {};
    PDFE.VERSION = '1.0.0';
    // رقم البناء مقروءاً من وسم السكربت نفسه — يُعرض في شريط الحالة كي يتأكّد
    // المستخدم بنظرة أنه يشغّل النسخة المنشورة لا نسخة عالقة في ذاكرة المتصفح.
    PDFE.BUILD = (function () {
        try {
            const el = document.querySelector('script[src*="pdfeditor-engine.js"]');
            const m = el && /[?&]v=([^&"']+)/.exec(el.getAttribute('src') || '');
            return m ? m[1] : 'dev';
        } catch (e) { return 'dev'; }
    })();

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-LIB] تحميل المكتبات الكسول
    // لا نحمّل pdf-lib/fontkit/الخطوط إلا عند أول فتح للمحرر — حفاظاً على زمن الإقلاع.
    // ═══════════════════════════════════════════════════════════════════════════
    const CDN = {
        pdfLib: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
        fontkit: 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',
        pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    };

    // خطوط عربية للتضمين في المخرَج.
    // ⚠️ لكل خط **سلسلة مصادر** لا مصدراً واحداً: روابط الخطوط على CDN تموت بصمت
    // (روابط GitHub raw القديمة أصبحت 404) وحينها ينهار التصدير العربي كلياً.
    // نجرّب المصادر بالترتيب ونكتفي بأول ناجح. الصيغة WOFF مدعومة في fontkit.
    const AR_FONTS = {
        Amiri: {
            label: 'Amiri (نسخي)',
            regular: [
                'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.2.5/files/amiri-arabic-400-normal.woff',
                'https://cdn.jsdelivr.net/npm/@fontsource/amiri/files/amiri-arabic-400-normal.woff'
            ],
            bold: [
                'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.2.5/files/amiri-arabic-700-normal.woff',
                'https://cdn.jsdelivr.net/npm/@fontsource/amiri/files/amiri-arabic-700-normal.woff'
            ]
        },
        Cairo: {
            label: 'Cairo (حديث)',
            regular: [
                'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.2.5/files/cairo-arabic-400-normal.woff',
                'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.19/files/cairo-arabic-400-normal.woff'
            ],
            bold: [
                'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.2.5/files/cairo-arabic-700-normal.woff',
                'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.19/files/cairo-arabic-700-normal.woff'
            ]
        },
        Tajawal: {
            label: 'Tajawal (واجهات)',
            regular: ['https://cdn.jsdelivr.net/npm/@fontsource/tajawal@5.2.5/files/tajawal-arabic-400-normal.woff'],
            bold: ['https://cdn.jsdelivr.net/npm/@fontsource/tajawal@5.2.5/files/tajawal-arabic-700-normal.woff']
        },
        NotoSansArabic: {
            label: 'Noto Sans Arabic',
            regular: ['https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-arabic@5.2.5/files/noto-sans-arabic-arabic-400-normal.woff'],
            bold: ['https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-arabic@5.2.5/files/noto-sans-arabic-arabic-700-normal.woff']
        }
    };
    PDFE.AR_FONTS = AR_FONTS;

    const _scriptCache = {};
    function loadScript(src) {
        if (_scriptCache[src]) return _scriptCache[src];
        _scriptCache[src] = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve();
            s.onerror = () => { delete _scriptCache[src]; reject(new Error('تعذّر تحميل المكتبة من الإنترنت: ' + src)); };
            document.head.appendChild(s);
        });
        return _scriptCache[src];
    }

    const _bufCache = {};
    async function loadBuffer(url) {
        if (_bufCache[url]) return _bufCache[url];
        _bufCache[url] = (async () => {
            const res = await fetch(url);
            if (!res.ok) throw new Error('تعذّر تحميل الملف: ' + url);
            return new Uint8Array(await res.arrayBuffer());
        })();
        try { return await _bufCache[url]; } catch (e) { delete _bufCache[url]; throw e; }
    }

    PDFE.libs = {
        /** يضمن جاهزية pdf.js وعامله (worker). */
        ensurePdfJs() {
            if (typeof pdfjsLib === 'undefined') throw new Error('مكتبة عرض PDF (pdf.js) غير محمّلة — تحقّق من الاتصال بالإنترنت ثم أعد تحميل الصفحة');
            try { pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker; } catch (e) { /* بيئة بلا عامل — pdf.js يعمل على الخيط الرئيسي */ }
            return pdfjsLib;
        },
        /** يحمّل pdf-lib + fontkit (لازمان للكتابة/التصدير فقط). */
        async ensurePdfLib() {
            if (!window.PDFLib) await loadScript(CDN.pdfLib);
            if (!window.PDFLib) throw new Error('تعذّر تحميل محرك كتابة PDF (pdf-lib)');
            if (!window.fontkit) { try { await loadScript(CDN.fontkit); } catch (e) { /* التضمين العربي سيتعطّل فقط */ } }
            return window.PDFLib;
        },
        /**
         * يحمّل ملف خط عربي لتضمينه في المخرَج.
         * يجرّب مصادر العائلة المطلوبة بالترتيب، ثم بقية العائلات كملاذ أخير —
         * حتى لا يُسقط رابطٌ ميت واحد كل التصدير العربي.
         * @returns {{bytes:Uint8Array, family:string, substituted:boolean}}
         */
        async loadArabicFont(family, bold) {
            const order = [family && AR_FONTS[family] ? family : 'Amiri']
                .concat(Object.keys(AR_FONTS).filter(k => k !== family));
            let lastErr = null;
            for (const fam of order) {
                const f = AR_FONTS[fam];
                const urls = [].concat((bold ? f.bold : f.regular) || [], f.regular || []);
                for (const url of urls) {
                    try {
                        const bytes = await loadBuffer(url);
                        if (bytes && bytes.length > 2000) return { bytes, family: fam, substituted: fam !== family };
                    } catch (e) { lastErr = e; }
                }
            }
            throw new Error('تعذّر تحميل أي خط عربي للتضمين — تحقّق من الاتصال بالإنترنت' + (lastErr ? ' (' + lastErr.message + ')' : ''));
        },
        hasTesseract() { return typeof Tesseract !== 'undefined'; },

        /**
         * يتحقّق مبكراً (عند فتح المستند) من جاهزية كتابة العربية في المخرَج.
         * الغرض: ألّا يكتشف المستخدم عطل الخط **بعد** ساعة تحرير عند التصدير.
         * @returns {{ok:boolean, reason:string, family:string}}
         */
        async checkArabicReady(family) {
            try { await PDFE.libs.ensurePdfLib(); }
            catch (e) { return { ok: false, reason: 'تعذّر تحميل محرك كتابة PDF (pdf-lib): ' + e.message }; }
            if (!window.fontkit) {
                return { ok: false, reason: 'تعذّر تحميل مكتبة تضمين الخطوط (fontkit) من cdn.jsdelivr.net — قد يحجبها مانع إعلانات أو جدار حماية.' };
            }
            try {
                const r = await PDFE.libs.loadArabicFont(family || 'Amiri', false);
                return { ok: true, reason: '', family: r.family, substituted: r.substituted };
            } catch (e) {
                return { ok: false, reason: e.message };
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-AR] العربية — التصنيف ثنائي الاتجاه وإعادة الترتيب البصري
    // ───────────────────────────────────────────────────────────────────────────
    // fontkit (داخل pdf-lib) يقوم بتشكيل الحروف العربية (GSUB: init/medi/fina)
    // تلقائياً، لكنه **لا** يعيد ترتيب النص منطقياً→بصرياً. لذلك ننفّذ هنا
    // مجموعة فرعية عملية من خوارزمية UBA كافية للمستندات المالية:
    // نص عربي + إنجليزي + أرقام + عملات + علامات ترقيم.
    // المخرَج: مقاطع اتجاهية مرتّبة بصرياً من اليسار لليمين — ترسم بالتتابع.
    // ═══════════════════════════════════════════════════════════════════════════
    const AR = PDFE.Arabic = {};

    const RE_ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
    const RE_HEBREW = /[֐-׿]/;
    const RE_LATIN = /[A-Za-zÀ-ɏ]/;

    AR.hasArabic = s => RE_ARABIC.test(s || '');
    AR.hasRTL = s => RE_ARABIC.test(s || '') || RE_HEBREW.test(s || '');

    /** تصنيف حرف واحد إلى صنف ثنائي الاتجاه مبسّط. */
    function bidiClass(ch) {
        const c = ch.charCodeAt(0);
        if (RE_ARABIC.test(ch)) {
            // التشكيل والعلامات المدمجة تتبع ما قبلها
            if ((c >= 0x064B && c <= 0x065F) || c === 0x0670 || (c >= 0x06D6 && c <= 0x06ED)) return 'NSM';
            if (c >= 0x0660 && c <= 0x0669) return 'AN';       // أرقام هندية ٠-٩
            if (c >= 0x06F0 && c <= 0x06F9) return 'AN';       // أرقام فارسية
            if (c === 0x060C || c === 0x061B || c === 0x061F) return 'ON'; // ، ؛ ؟
            return 'AL';
        }
        if (RE_HEBREW.test(ch)) return 'R';
        if (ch >= '0' && ch <= '9') return 'EN';
        if (RE_LATIN.test(ch)) return 'L';
        if (ch === '+' || ch === '-') return 'ES';
        if (ch === ',' || ch === '.' || ch === ':' || ch === '/') return 'CS';
        if (ch === '%' || ch === '$' || ch === '#' || ch === ' ' || ch === '﷼') return 'ET';
        if (ch === ' ' || ch === '\t' || ch === '\n') return 'WS';
        return 'ON';
    }

    /**
     * يحسب مستوى ثنائي الاتجاه لكل حرف.
     * 0 = يسار→يمين · 1 = يمين→يسار · 2 = رقم لاتيني داخل نص عربي (يُرسم LTR لكنه يوضع RTL)
     */
    function resolveLevels(text, baseRTL) {
        const n = text.length;
        const cls = new Array(n);
        for (let i = 0; i < n; i++) cls[i] = bidiClass(text[i]);

        // 1) العلامات غير المتباعدة (NSM) تأخذ صنف ما قبلها
        for (let i = 0; i < n; i++) if (cls[i] === 'NSM') cls[i] = i > 0 ? cls[i - 1] : (baseRTL ? 'AL' : 'L');

        // 2) EN بعد AL تصبح AN (أرقام عربية سياقياً)، لكنها تبقى تُرسم LTR
        let lastStrong = baseRTL ? 'AL' : 'L';
        for (let i = 0; i < n; i++) {
            const c = cls[i];
            if (c === 'L' || c === 'R' || c === 'AL') lastStrong = c;
            else if (c === 'EN' && lastStrong === 'AL') cls[i] = 'EN_AR';
        }

        // 3) الفواصل بين رقمين تصبح جزءاً من الرقم (125,500.00)
        for (let i = 1; i < n - 1; i++) {
            const isNum = x => x === 'EN' || x === 'EN_AR' || x === 'AN';
            if ((cls[i] === 'CS' || cls[i] === 'ES') && isNum(cls[i - 1]) && cls[i - 1] === cls[i + 1]) cls[i] = cls[i - 1];
            if (cls[i] === 'ET' && (isNum(cls[i - 1]) || isNum(cls[i + 1]))) cls[i] = isNum(cls[i - 1]) ? cls[i - 1] : cls[i + 1];
        }

        // 4) المحايدات: تأخذ الاتجاه إن تطابق جاراها، وإلا الاتجاه الأساسي
        const strongOf = c => (c === 'L' ? 'L' : (c === 'R' || c === 'AL') ? 'R' : (c === 'AN' || c === 'EN_AR') ? 'R' : c === 'EN' ? 'L' : null);
        let i = 0;
        while (i < n) {
            if (strongOf(cls[i]) !== null) { i++; continue; }
            let j = i; while (j < n && strongOf(cls[j]) === null) j++;
            const before = i > 0 ? strongOf(cls[i - 1]) : (baseRTL ? 'R' : 'L');
            const after = j < n ? strongOf(cls[j]) : (baseRTL ? 'R' : 'L');
            const fill = (before === after && before !== null) ? before : (baseRTL ? 'R' : 'L');
            for (let k = i; k < j; k++) cls[k] = fill === 'R' ? 'R_N' : 'L_N';
            i = j;
        }

        // 5) المستويات النهائية
        const lv = new Array(n);
        for (let k = 0; k < n; k++) {
            const c = cls[k];
            // نص لاتيني داخل فقرة عربية = تضمين LTR (مستوى 2): يُقرأ يساراً→يميناً
            // لكنه يُوضع ضمن التدفّق RTL. إعطاؤه 0 يقذفه لطرف السطر الخاطئ.
            if (c === 'L' || c === 'L_N') lv[k] = baseRTL ? 2 : 0;
            else if (c === 'R' || c === 'AL' || c === 'R_N') lv[k] = 1;
            else if (c === 'AN' || c === 'EN_AR') lv[k] = 2;   // رقم داخل عربي: LTR داخلياً، موضع RTL
            else if (c === 'EN') lv[k] = baseRTL ? 2 : 0;
            else lv[k] = baseRTL ? 1 : 0;
        }
        // في نص أساسه LTR لا يوجد مستوى 2 حقيقي
        if (!baseRTL) for (let k = 0; k < n; k++) if (lv[k] === 2) lv[k] = 0;
        return lv;
    }

    /**
     * يقسّم النص إلى مقاطع اتجاهية **مرتّبة بصرياً من اليسار إلى اليمين**.
     * كل مقطع: { text, rtl } — يُرسم بالترتيب مع تراكم العرض.
     * @param {string} text النص بالترتيب المنطقي (كما يكتبه المستخدم)
     * @param {'rtl'|'ltr'|'auto'} dir
     * @returns {{text:string,rtl:boolean}[]}
     */
    AR.visualRuns = function (text, dir) {
        if (!text) return [];
        const baseRTL = dir === 'rtl' ? true : dir === 'ltr' ? false : AR.hasRTL(text);
        const lv = resolveLevels(text, baseRTL);

        // بناء مقاطع متجانسة المستوى
        const runs = [];
        let start = 0;
        for (let i = 1; i <= text.length; i++) {
            if (i === text.length || lv[i] !== lv[start]) {
                runs.push({ text: text.slice(start, i), level: lv[start] });
                start = i;
            }
        }
        // قاعدة L2: اعكس المقاطع من أعلى مستوى نزولاً حتى أدنى مستوى فردي
        const maxL = runs.reduce((m, r) => Math.max(m, r.level), 0);
        const minOdd = runs.reduce((m, r) => (r.level % 2 ? Math.min(m, r.level) : m), 99);
        for (let level = maxL; level >= Math.min(minOdd, maxL); level--) {
            if (level === 99) break;
            let i2 = 0;
            while (i2 < runs.length) {
                if (runs[i2].level < level) { i2++; continue; }
                let j = i2; while (j < runs.length && runs[j].level >= level) j++;
                const seg = runs.slice(i2, j).reverse();
                for (let k = 0; k < seg.length; k++) runs[i2 + k] = seg[k];
                i2 = j;
            }
        }
        return runs.map(r => ({ text: r.text, rtl: r.level === 1 }));
    };

    /** نص جاهز للعرض في عنصر DOM (المتصفح يتولى bidi بنفسه — نُرجعه كما هو). */
    AR.forDom = t => t;

    /** يكشف اتجاه فقرة. */
    AR.detectDir = function (text) {
        let r = 0, l = 0;
        for (const ch of (text || '')) { const c = bidiClass(ch); if (c === 'AL' || c === 'R') r++; else if (c === 'L') l++; }
        return r > l ? 'rtl' : 'ltr';
    };

    /** يكشف لغة النص (للعرض في لوحة الفحص). */
    AR.detectLang = function (text) {
        const ar = RE_ARABIC.test(text), la = RE_LATIN.test(text);
        return ar && la ? 'عربي + إنجليزي' : ar ? 'عربي' : la ? 'إنجليزي' : 'أرقام/رموز';
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-PARSE] محلّل المستند
    // ═══════════════════════════════════════════════════════════════════════════
    const P = PDFE.Parser = {};

    const clamp255 = v => Math.max(0, Math.min(255, Math.round(v)));
    const toHex = (r, g, b) => '#' + [r, g, b].map(v => clamp255(v).toString(16).padStart(2, '0')).join('').toUpperCase();
    PDFE.toHex = toHex;

    PDFE.hexToRgb = function (hex) {
        const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(hex || '').trim());
        if (!m) return { r: 0, g: 0, b: 0 };
        let h = m[1]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    };

    PDFE.rgbToHsl = function (r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        let h = 0, s = 0; const l = (mx + mn) / 2;
        if (mx !== mn) {
            const d = mx - mn;
            s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
            h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    };

    /** اسم عربي وصفي للّون — يُستخدم في بطاقات الألوان (§3). */
    PDFE.colorName = function (hex) {
        const { r, g, b } = PDFE.hexToRgb(hex);
        const { h, s, l } = PDFE.rgbToHsl(r, g, b);
        if (l >= 96) return 'أبيض';
        if (l <= 8) return 'أسود';
        if (s <= 10) return l > 70 ? 'رمادي فاتح' : l > 40 ? 'رمادي' : 'رمادي داكن';
        const tone = l < 32 ? 'داكن' : l > 68 ? 'فاتح' : '';
        const base = h < 15 || h >= 345 ? 'أحمر' : h < 42 ? 'برتقالي' : h < 68 ? 'أصفر' : h < 160 ? 'أخضر'
            : h < 200 ? 'تركوازي' : h < 255 ? 'أزرق' : h < 290 ? 'بنفسجي' : 'وردي';
        return (base + ' ' + tone).trim();
    };

    /** يستخرج عائلة الخط ووزنه وميلانه من اسم الخط داخل PDF. */
    P.parseFontName = function (raw) {
        let name = String(raw || '').replace(/^[A-Z]{6}\+/, '');   // إزالة بادئة المجموعة الجزئية ABCDEF+
        const lower = name.toLowerCase();
        const bold = /bold|black|heavy|semibold|demibold|[-,]bd\b|700|800|900/.test(lower);
        const italic = /italic|oblique|[-,]it\b/.test(lower);
        let family = name.replace(/[-_,]?(regular|bold|black|heavy|semibold|demibold|light|medium|italic|oblique|mt|ps|std|pro)/gi, '')
            .replace(/[-_,]+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
        if (!family) family = name || 'Unknown';
        return { name, family, bold, italic };
    };

    /**
     * يمشي على قائمة عمليات الصفحة لاستخراج:
     * · لون التعبئة عند كل عملية إظهار نص (بالترتيب) → لون النص الحقيقي
     * · الصور مع مصفوفة التحويل (الموضع/الحجم/الدوران)
     * · الأشكال (مستطيلات/خطوط/مسارات)
     */
    async function walkOperators(page) {
        const OPS = pdfjsLib.OPS;
        const opList = await page.getOperatorList();
        const fn = opList.fnArray, ar = opList.argsArray;

        const stack = [];
        let ctm = [1, 0, 0, 1, 0, 0];
        let fill = '#000000', stroke = '#000000', alpha = 1, lineWidth = 1;
        let curFont = null;
        const textColors = [];   // بالترتيب: لون كل عملية إظهار نص
        const textFonts = [];
        const images = [];
        const shapes = [];

        const mul = (m1, m2) => [
            m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1],
            m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3],
            m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
        ];
        const gray = g => toHex(g * 255, g * 255, g * 255);
        const cmyk = (c, m, y, k) => toHex(255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - y) * (1 - k));

        for (let i = 0; i < fn.length; i++) {
            const op = fn[i], a = ar[i];
            switch (op) {
                case OPS.save: stack.push({ ctm: ctm.slice(), fill, stroke, alpha, lineWidth }); break;
                case OPS.restore: { const s = stack.pop(); if (s) { ctm = s.ctm; fill = s.fill; stroke = s.stroke; alpha = s.alpha; lineWidth = s.lineWidth; } break; }
                case OPS.transform: ctm = mul(ctm, a); break;
                case OPS.setLineWidth: lineWidth = a[0]; break;
                case OPS.setFillRGBColor: fill = toHex(a[0], a[1], a[2]); break;
                case OPS.setFillGray: fill = gray(a[0]); break;
                case OPS.setFillCMYKColor: fill = cmyk(a[0], a[1], a[2], a[3]); break;
                case OPS.setStrokeRGBColor: stroke = toHex(a[0], a[1], a[2]); break;
                case OPS.setStrokeGray: stroke = gray(a[0]); break;
                case OPS.setStrokeCMYKColor: stroke = cmyk(a[0], a[1], a[2], a[3]); break;
                case OPS.setGState:
                    (a[0] || []).forEach(([k, v]) => { if (k === 'ca' && typeof v === 'number') alpha = v; if (k === 'LW') lineWidth = v; });
                    break;
                case OPS.setFont: curFont = a[0]; break;
                case OPS.showText:
                case OPS.showSpacedText:
                case OPS.nextLineShowText:
                case OPS.nextLineSetSpacingShowText:
                    textColors.push({ color: fill, alpha, opIndex: i });
                    textFonts.push(curFont);
                    break;
                case OPS.paintImageXObject:
                case OPS.paintJpegXObject:
                case OPS.paintImageMaskXObject:
                case OPS.paintInlineImageXObject: {
                    const w = Math.hypot(ctm[0], ctm[1]), h = Math.hypot(ctm[2], ctm[3]);
                    images.push({
                        objId: typeof a[0] === 'string' ? a[0] : null,
                        inline: op === OPS.paintInlineImageXObject,
                        mask: op === OPS.paintImageMaskXObject,
                        ctm: ctm.slice(),
                        x: ctm[4], y: ctm[5], w, h,
                        rotation: Math.round(Math.atan2(ctm[1], ctm[0]) * 180 / Math.PI),
                        opacity: alpha, opIndex: i
                    });
                    break;
                }
                case OPS.constructPath: {
                    // a = [ops[], args[]] — نستخرج المستطيلات والخطوط فقط (المفيد بصرياً)
                    const pops = a[0] || [], pargs = a[1] || [];
                    let ai = 0, pts = [];
                    for (const po of pops) {
                        if (po === OPS.rectangle) {
                            const [x, y, w, h] = pargs.slice(ai, ai + 4); ai += 4;
                            const p1 = [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
                            shapes.push({ kind: Math.abs(h) < 1.5 ? 'line' : Math.abs(w) < 1.5 ? 'line' : 'rect', x: p1[0], y: p1[1], w: w * ctm[0], h: h * ctm[3], fill, stroke, lineWidth, opacity: alpha, opIndex: i });
                        } else if (po === OPS.moveTo || po === OPS.lineTo) {
                            const [x, y] = pargs.slice(ai, ai + 2); ai += 2;
                            pts.push([ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]);
                        } else if (po === OPS.curveTo) { ai += 6; }
                        else if (po === OPS.curveTo2 || po === OPS.curveTo3) { ai += 4; }
                    }
                    if (pts.length === 2) {
                        shapes.push({ kind: 'line', x: pts[0][0], y: pts[0][1], x2: pts[1][0], y2: pts[1][1], w: pts[1][0] - pts[0][0], h: pts[1][1] - pts[0][1], fill, stroke, lineWidth, opacity: alpha, opIndex: i });
                    } else if (pts.length > 2) {
                        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
                        shapes.push({ kind: 'path', x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), points: pts.length, fill, stroke, lineWidth, opacity: alpha, opIndex: i });
                    }
                    break;
                }
                default: break;
            }
        }
        return { textColors, textFonts, images, shapes };
    }

    /**
     * يحلّل صفحة واحدة تحليلاً كاملاً.
     * @returns {object} وصف الصفحة: نصوص بأنماطها، صور، أشكال، أبعاد.
     */
    P.analyzePage = async function (pdf, pageNum) {
        const page = await pdf.getPage(pageNum);
        const vp = page.getViewport({ scale: 1 });
        const rotation = page.rotate || 0;
        const [tc, ops] = await Promise.all([page.getTextContent(), walkOperators(page)]);

        const styles = tc.styles || {};
        const items = [];
        let ti = 0;
        for (const it of tc.items) {
            if (it.type === 'beginMarkedContent' || it.type === 'endMarkedContent') continue;
            const str = it.str;
            const tr = it.transform || [1, 0, 0, 1, 0, 0];
            const fontSize = Math.hypot(tr[2], tr[3]) || Math.abs(tr[3]) || 10;
            const angle = Math.round(Math.atan2(tr[1], tr[0]) * 180 / Math.PI);
            const sty = styles[it.fontName] || {};
            const fi = P.parseFontName(sty.fontFamily || it.fontName);
            const col = ops.textColors[ti] || {};
            ti++;
            if (!str || !str.trim()) continue;    // نتخطّى الفراغات لكن نستهلك المؤشّر للحفاظ على المحاذاة
            items.push({
                id: 'p' + pageNum + 't' + (items.length),
                page: pageNum,
                str,
                x: tr[4],
                y: tr[5],                                  // إحداثي PDF: من أسفل الصفحة
                w: it.width || 0,
                h: it.height || fontSize,
                fontRef: it.fontName,
                fontName: fi.name,
                fontFamily: fi.family,
                fontSize: Math.round(fontSize * 10) / 10,
                bold: fi.bold || /bold/i.test(sty.fontFamily || ''),
                italic: fi.italic,
                color: col.color || '#000000',
                opacity: col.alpha == null ? 1 : col.alpha,
                bgColor: null,                              // يُملأ لاحقاً بالمعاينة من اللوحة
                angle,
                dir: it.dir || (AR.hasRTL(str) ? 'rtl' : 'ltr'),
                rtl: AR.hasRTL(str),
                lang: AR.detectLang(str),
                charSpacing: 0,
                opIndex: ti - 1,                            // ترتيب عملية إظهار النص — أساس الجراحة
                editable: true,
                state: 'editable'
            });
        }

        // دمج الحروف/المقاطع المتجاورة في وحدات تحرير معقولة (قبل حساب التخطيط)
        const merged = mergeRuns(items);

        // تقدير تباعد الأسطر والمحاذاة من التجميع
        estimateLayout(merged, vp.width, vp.height);

        // كشف الصفحة الممسوحة ضوئياً: نص شبه معدوم + صورة تغطي الصفحة
        const textChars = merged.reduce((s, i2) => s + i2.str.length, 0);
        const bigImage = ops.images.some(im => im.w > vp.width * 0.7 && im.h > vp.height * 0.7);
        const isScanned = textChars < 25 && (bigImage || ops.images.length > 0);

        return {
            n: pageNum,
            width: vp.width,
            height: vp.height,
            // مرجع تحقّق الجراحة: عدد عمليات إظهار النص كما رصدتها قائمة عمليات
            // pdf.js (وهي تدخل Form XObjects). **ليس** عدد عناصر النص — فـ pdf.js
            // قد يدمج أو يقسّم العناصر، وهو الترقيم الذي يفهرس إليه opIndex.
            opCount: ops.textColors.length,
            rotation,
            orientation: vp.width > vp.height ? 'أفقي (Landscape)' : 'رأسي (Portrait)',
            size: pageSizeName(vp.width, vp.height),
            items: merged,
            rawItems: items,                            // العناصر قبل الدمج (للتشخيص)
            images: ops.images,
            shapes: ops.shapes,
            isScanned,
            textChars,
            _page: page
        };
    };

    /**
     * يدمج العناصر المتجاورة على نفس السطر وبنفس النمط في «مقطع» واحد قابل للتحرير.
     * ───────────────────────────────────────────────────────────────────────
     * لماذا: كثير من مولّدات PDF — خصوصاً العربية — ترسم كل حرف بعملية إظهار
     * مستقلة لضبط التشكيل والتموضع. بدون دمج يصل النص إلى المحرر مفتّتاً
     * حرفاً حرفاً فيستحيل تحريره (بينما تأتي الأرقام ككتلة واحدة لأنها تُرسم
     * بعملية واحدة). نحتفظ بكل فهارس العمليات الأصلية في `opIndexes` كي
     * تُزال **جميعاً** عند التعديل، وإلا بقيت بقايا الحروف في الملف.
     */
    function mergeRuns(items) {
        if (items.length < 2) return items.map(it => Object.assign(it, { opIndexes: [it.opIndex] }));
        const MAX_RUN = 220;                       // لا ندمج سطراً كاملاً في وحدة عملاقة
        const sameStyle = (a, b) =>
            a.fontRef === b.fontRef &&
            Math.abs(a.fontSize - b.fontSize) < 0.6 &&
            a.color === b.color && a.bold === b.bold && a.italic === b.italic &&
            a.angle === b.angle;

        const out = [];
        let cur = null;
        for (const it of items) {
            if (cur && cur.str.length < MAX_RUN && sameStyle(cur, it) &&
                Math.abs(cur.y - it.y) <= Math.max(1.2, cur.fontSize * 0.3)) {
                // الفجوة الأفقية مقيسة من الجهتين — الرسم قد يمضي يميناً أو يساراً
                const gapRight = it.x - (cur.x + cur.w);
                const gapLeft = cur.x - (it.x + it.w);
                const gap = Math.max(gapRight, gapLeft);
                if (gap <= cur.fontSize * 0.7) {
                    // فجوة تُقارب المسافة ⇒ نُدرج فراغاً كي لا تلتصق الكلمات
                    const needSpace = gap > cur.fontSize * 0.18 && !/\s$/.test(cur.str) && !/^\s/.test(it.str);
                    cur.str += (needSpace ? ' ' : '') + it.str;
                    const left = Math.min(cur.x, it.x);
                    const right = Math.max(cur.x + cur.w, it.x + it.w);
                    cur.x = left; cur.w = right - left;
                    cur.h = Math.max(cur.h, it.h);
                    cur.opIndexes.push(it.opIndex);
                    cur.rtl = cur.rtl || it.rtl;
                    continue;
                }
            }
            cur = Object.assign({}, it, { opIndexes: [it.opIndex] });
            out.push(cur);
        }
        out.forEach((it, i) => {
            it.id = 'p' + it.page + 't' + i;
            it.lang = AR.detectLang(it.str);
            it.dir = it.rtl ? 'rtl' : 'ltr';
        });
        return out;
    }

    /** يستنتج تباعد الأسطر والمحاذاة وحجم صندوق النص لكل عنصر. */
    function estimateLayout(items, pw) {
        if (!items.length) return;
        // تجميع حسب السطر (تقارب y)
        const lines = [];
        const sorted = items.slice().sort((a, b) => b.y - a.y || a.x - b.x);
        for (const it of sorted) {
            const ln = lines.find(l => Math.abs(l.y - it.y) <= Math.max(2, it.fontSize * 0.35));
            if (ln) { ln.items.push(it); ln.y = (ln.y * (ln.items.length - 1) + it.y) / ln.items.length; }
            else lines.push({ y: it.y, items: [it] });
        }
        lines.sort((a, b) => b.y - a.y);
        for (let i = 0; i < lines.length; i++) {
            const gap = i < lines.length - 1 ? lines[i].y - lines[i + 1].y : null;
            const L = lines[i];
            const xs = L.items.map(t => t.x), rights = L.items.map(t => t.x + t.w);
            const left = Math.min(...xs), right = Math.max(...rights);
            const center = (left + right) / 2;
            let align = 'left';
            if (Math.abs(center - pw / 2) < pw * 0.06) align = 'center';
            else if (pw - right < left * 0.6) align = 'right';
            else if (L.items[0].rtl) align = 'right';
            for (const it of L.items) {
                it.lineHeight = gap ? Math.round(gap * 10) / 10 : Math.round(it.fontSize * 1.2 * 10) / 10;
                it.lineGapRatio = gap ? Math.round((gap / it.fontSize) * 100) / 100 : 1.2;
                it.align = align;
                it.lineIndex = i;
                // تباعد الحروف التقديري: (العرض الفعلي − العرض المتوقع) ÷ عدد الحروف
                const expect = it.str.length * it.fontSize * 0.5;
                it.charSpacing = it.str.length > 1 ? Math.round(((it.w - expect) / it.str.length) * 100) / 100 : 0;
            }
        }
    }

    function pageSizeName(w, h) {
        const mm = v => v * 25.4 / 72;
        const W = Math.round(mm(Math.min(w, h))), H = Math.round(mm(Math.max(w, h)));
        const near = (a, b) => Math.abs(a - b) <= 3;
        if (near(W, 210) && near(H, 297)) return 'A4';
        if (near(W, 148) && near(H, 210)) return 'A5';
        if (near(W, 297) && near(H, 420)) return 'A3';
        if (near(W, 216) && near(H, 279)) return 'Letter';
        if (near(W, 216) && near(H, 356)) return 'Legal';
        return W + '×' + H + ' مم';
    }

    /**
     * يحلّل المستند كاملاً + يبني فهارس الخطوط والألوان والأنماط.
     * التحليل كسول للصفحات الكثيرة: يحلّل أول N صفحة فوراً والباقي عند الطلب.
     */
    P.analyzeDocument = async function (pdf, opts) {
        opts = opts || {};
        const total = pdf.numPages;
        const eager = Math.min(total, opts.eagerPages || (total > 60 ? 12 : total));
        const pages = new Array(total).fill(null);
        for (let n = 1; n <= eager; n++) {
            pages[n - 1] = await P.analyzePage(pdf, n);
            if (opts.onProgress) opts.onProgress(n, eager, total);
        }
        const analysis = {
            total, pages, analyzedCount: eager, _pdf: pdf,
            fonts: new Map(), colors: new Map(), styles: [], missingFonts: []
        };
        P.reindex(analysis);
        return analysis;
    };

    /** يحلّل صفحة مؤجّلة عند الحاجة (Lazy) ثم يعيد بناء الفهارس. */
    P.ensurePage = async function (analysis, n) {
        if (analysis.pages[n - 1]) return analysis.pages[n - 1];
        analysis.pages[n - 1] = await P.analyzePage(analysis._pdf, n);
        analysis.analyzedCount++;
        P.reindex(analysis);
        return analysis.pages[n - 1];
    };

    /** يعيد بناء فهارس الخطوط/الألوان/الأنماط من الصفحات المحلَّلة. */
    P.reindex = function (analysis) {
        const fonts = new Map(), colors = new Map(), styleMap = new Map();
        for (const pg of analysis.pages) {
            if (!pg) continue;
            for (const it of pg.items) {
                const fk = it.fontFamily + (it.bold ? ' Bold' : '') + (it.italic ? ' Italic' : '');
                if (!fonts.has(fk)) fonts.set(fk, { key: fk, family: it.fontFamily, bold: it.bold, italic: it.italic, count: 0, sizes: new Set(), raw: it.fontName });
                const f = fonts.get(fk); f.count++; f.sizes.add(it.fontSize);
                colors.set(it.color, (colors.get(it.color) || 0) + 1);
                const sk = PDFE.Style.key(it);
                if (!styleMap.has(sk)) styleMap.set(sk, { key: sk, font: fk, family: it.fontFamily, size: it.fontSize, color: it.color, bold: it.bold, italic: it.italic, align: it.align, lineGapRatio: it.lineGapRatio, count: 0, samples: [] });
                const s = styleMap.get(sk); s.count++;
                if (s.samples.length < 4) s.samples.push(it.str.slice(0, 40));
            }
            for (const sh of pg.shapes) {
                if (sh.fill) colors.set(sh.fill, (colors.get(sh.fill) || 0) + 1);
            }
        }
        analysis.fonts = fonts;
        analysis.colors = colors;
        analysis.styles = Array.from(styleMap.values()).sort((a, b) => b.count - a.count);
        analysis.missingFonts = Array.from(fonts.values())
            .map(f => ({ ...f, installed: PDFE.Style.isInstalled(f.family) }))
            .filter(f => !f.installed);
        return analysis;
    };

    /** أدوات إحصاء لزر «تحليل المستند» (§38). */
    P.summary = function (analysis) {
        const pgs = analysis.pages.filter(Boolean);
        const texts = pgs.reduce((s, p) => s + p.items.length, 0);
        const imgs = pgs.reduce((s, p) => s + p.images.length, 0);
        const shapes = pgs.reduce((s, p) => s + p.shapes.length, 0);
        const scanned = pgs.filter(p => p.isScanned).length;
        const allText = pgs.flatMap(p => p.items.map(i => i.str)).join(' ');
        return {
            pages: analysis.total,
            analyzed: pgs.length,
            fonts: analysis.fonts.size,
            colors: analysis.colors.size,
            images: imgs,
            shapes,
            textBlocks: texts,
            tables: pgs.reduce((s, p) => s + P.detectTables(p).length, 0),
            scannedPages: scanned,
            language: AR.detectLang(allText),
            docType: P.guessDocType(allText)
        };
    };

    /** تخمين نوع المستند من محتواه — لتلميحات التكامل المحاسبي (§33). */
    P.guessDocType = function (text) {
        const t = (text || '').toLowerCase();
        const has = (...w) => w.some(x => t.includes(x));
        if (has('مستخلص', 'progress billing', 'payment certificate', 'شهادة دفع')) return 'مستخلص / شهادة دفع';
        if (has('عقد', 'contract', 'اتفاقية', 'agreement')) return 'عقد / اتفاقية';
        if (has('أمر شراء', 'purchase order', 'p.o.')) return 'أمر شراء';
        if (has('عرض سعر', 'quotation', 'quote')) return 'عرض سعر';
        if (has('سند قبض', 'receipt voucher')) return 'سند قبض';
        if (has('سند صرف', 'payment voucher')) return 'سند صرف';
        if (has('فاتورة', 'invoice', 'tax invoice', 'ضريبية')) return 'فاتورة';
        if (has('كشف حساب', 'statement of account')) return 'كشف حساب';
        return 'مستند عام';
    };

    /**
     * كشف الجداول (§44) — heuristic: أعمدة متكرّرة من عناصر متحاذية أفقياً
     * عبر ثلاثة أسطر متتالية على الأقل.
     */
    P.detectTables = function (pageAnalysis) {
        const items = pageAnalysis.items;
        if (items.length < 9) return [];
        const lines = new Map();
        items.forEach(it => {
            const k = Math.round(it.y / 3);
            if (!lines.has(k)) lines.set(k, []);
            lines.get(k).push(it);
        });
        const rows = Array.from(lines.entries()).map(([k, v]) => ({ y: k * 3, cells: v.sort((a, b) => a.x - b.x) }))
            .filter(r => r.cells.length >= 3).sort((a, b) => b.y - a.y);
        if (rows.length < 3) return [];

        const tables = []; let cur = null;
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const colKey = r.cells.map(c => Math.round(c.x / 12)).join(',');
            if (cur && cur.colKey === colKey && Math.abs(cur.lastY - r.y) < 60) { cur.rows.push(r); cur.lastY = r.y; }
            else { if (cur && cur.rows.length >= 3) tables.push(cur); cur = { colKey, rows: [r], lastY: r.y }; }
        }
        if (cur && cur.rows.length >= 3) tables.push(cur);

        return tables.map((t, idx) => {
            const all = t.rows.flatMap(r => r.cells);
            const xs = all.map(c => c.x), rs = all.map(c => c.x + c.w), ys = all.map(c => c.y);
            return {
                id: 'tbl' + pageAnalysis.n + '_' + idx,
                page: pageAnalysis.n,
                x: Math.min(...xs), y: Math.min(...ys),
                w: Math.max(...rs) - Math.min(...xs),
                h: Math.max(...ys) - Math.min(...ys) + (t.rows[0].cells[0].fontSize || 10),
                rows: t.rows.length,
                cols: Math.max(...t.rows.map(r => r.cells.length)),
                cells: t.rows.map(r => r.cells.map(c => ({ id: c.id, text: c.str, x: c.x, y: c.y, w: c.w })))
            };
        });
    };

    /**
     * يعاين لون الخلفية خلف كل عنصر نصي من اللوحة المرسومة (§2 Background Color).
     * يُستدعى بعد رسم الصفحة على canvas.
     */
    P.sampleBackgrounds = function (pageAnalysis, canvas, scale) {
        let ctx; try { ctx = canvas.getContext('2d', { willReadFrequently: true }); } catch (e) { return; }
        const H = pageAnalysis.height;
        for (const it of pageAnalysis.items) {
            try {
                const cx = Math.round((it.x + it.w / 2) * scale);
                const cy = Math.round((H - it.y - it.fontSize * 1.15) * scale);
                const bw = Math.max(4, Math.round(Math.min(it.w, 40) * scale));
                const bh = Math.max(4, Math.round(it.fontSize * 1.3 * scale));
                const sx = Math.max(0, cx - bw / 2), sy = Math.max(0, cy);
                if (sx + bw > canvas.width || sy + bh > canvas.height) continue;
                const d = ctx.getImageData(sx, sy, bw, bh).data;
                const freq = new Map();
                for (let i = 0; i < d.length; i += 4) {
                    const k = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3);
                    freq.set(k, (freq.get(k) || 0) + 1);
                }
                let best = null, bc = 0;
                freq.forEach((v, k) => { if (v > bc) { bc = v; best = k; } });
                if (best) {
                    const [r, g, b] = best.split(',').map(v => parseInt(v, 10) << 3);
                    it.bgColor = toHex(r, g, b);
                }
            } catch (e) { /* getImageData قد يفشل مع لوحات ضخمة — نتجاهل */ }
        }
    };

    /** يقرأ لون بكسل واحد من اللوحة — أداة القطّارة (§17). */
    P.pickColor = function (canvas, px, py) {
        try {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const d = ctx.getImageData(Math.round(px), Math.round(py), 1, 1).data;
            const hex = toHex(d[0], d[1], d[2]);
            return { hex, rgb: { r: d[0], g: d[1], b: d[2] }, hsl: PDFE.rgbToHsl(d[0], d[1], d[2]), name: PDFE.colorName(hex) };
        } catch (e) { return null; }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-STYLE] ذكاء الأنماط
    // ═══════════════════════════════════════════════════════════════════════════
    const S = PDFE.Style = {};

    /** بصمة النمط — أساس التجميع في «نظام التصميم» وفي Copy/Paste Style. */
    S.key = it => [it.fontFamily, Math.round(it.fontSize * 2) / 2, it.color, it.bold ? 'B' : '', it.italic ? 'I' : ''].join('|');

    /** الحقول التي تُنسخ في «نسخ النمط» (§5). */
    S.COPYABLE = ['fontFamily', 'fontSize', 'color', 'bold', 'italic', 'underline', 'align', 'charSpacing', 'lineGapRatio', 'bgColor', 'opacity'];

    S.extract = function (it) {
        const o = {};
        S.COPYABLE.forEach(k => { if (it[k] !== undefined) o[k] = it[k]; });
        return o;
    };

    S.apply = function (target, style) {
        S.COPYABLE.forEach(k => { if (style[k] !== undefined) target[k] = style[k]; });
        return target;
    };

    /** قائمة الخطوط المتاحة للاستبدال — تُفحص فعلياً بقياس العرض. */
    S.SAFE_FONTS = ['Arial', 'Helvetica', 'Tahoma', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia',
        'Segoe UI', 'Calibri', 'Cairo', 'Tajawal', 'Amiri', 'Noto Sans', 'Liberation Sans'];

    const _instCache = {};
    /** يكشف إن كان الخط مثبّتاً فعلاً على الجهاز (بقياس عرض نص مرجعي). */
    S.isInstalled = function (family) {
        if (!family) return false;
        if (_instCache[family] !== undefined) return _instCache[family];
        try {
            const c = document.createElement('canvas').getContext('2d');
            const probe = 'mmmmmmmmmmlliWWW0Oسسسسسم';
            const base = {};
            ['monospace', 'serif', 'sans-serif'].forEach(b => { c.font = '72px ' + b; base[b] = c.measureText(probe).width; });
            const hit = ['monospace', 'serif', 'sans-serif'].some(b => {
                c.font = '72px "' + family + '",' + b;
                return Math.abs(c.measureText(probe).width - base[b]) > 0.5;
            });
            _instCache[family] = hit;
            return hit;
        } catch (e) { return false; }
    };

    /** يقترح أقرب بديل بصري للخط غير المثبّت (§19). */
    S.suggestSubstitutes = function (family) {
        const f = String(family || '').toLowerCase();
        const arabic = /arabic|amiri|cairo|tajawal|noto naskh|dubai|gess|droid arabic|traditional arabic|simplified arabic/.test(f);
        const serif = /times|georgia|garamond|book|serif|roman|minion|amiri|naskh/.test(f);
        const mono = /courier|mono|consol/.test(f);
        let pool;
        if (arabic) pool = ['Cairo', 'Tajawal', 'Amiri', 'Noto Sans Arabic', 'Tahoma'];
        else if (mono) pool = ['Courier New', 'Consolas', 'Liberation Mono'];
        else if (serif) pool = ['Times New Roman', 'Georgia', 'Liberation Serif', 'Noto Serif'];
        else pool = ['Arial', 'Helvetica', 'Liberation Sans', 'Noto Sans', 'Segoe UI'];
        return pool.map(p => ({ name: p, installed: S.isInstalled(p) }))
            .sort((a, b) => (b.installed ? 1 : 0) - (a.installed ? 1 : 0));
    };

    /**
     * «مطابقة النمط الأصلي» (§6) — يبحث عن أقرب عنصر نصي حول نقطة ما
     * ويعيد نمطه، مع مراعاة القرب الرأسي (نفس السطر) قبل الأفقي.
     */
    S.matchOriginal = function (pageAnalysis, x, y, radius) {
        const R2 = radius || 140;
        let best = null, bestD = Infinity;
        for (const it of pageAnalysis.items) {
            const dy = Math.abs((it.y + it.fontSize / 2) - y);
            const dx = Math.abs((it.x + it.w / 2) - x);
            if (dy > R2 || dx > R2 * 2.2) continue;
            const d = dy * 2.6 + dx;      // وزن أعلى للقرب الرأسي — النص المجاور في نفس السطر أولى
            if (d < bestD) { bestD = d; best = it; }
        }
        if (!best) {
            // لا جوار: نستخدم النمط الأكثر شيوعاً في المستند (نمط المتن)
            return null;
        }
        return { style: S.extract(best), source: best };
    };

    /**
     * «نظام تصميم المستند» (§59) — يصنّف الأنماط المكتشفة إلى أدوار
     * (عنوان/متن/أرقام/تواريخ/رأس/تذييل/خلايا جدول).
     */
    S.buildDesignSystem = function (analysis) {
        const pgs = analysis.pages.filter(Boolean);
        if (!pgs.length) return { groups: [] };
        const sizes = analysis.styles.map(s => s.size);
        const bodySize = mode(sizes) || 10;
        const maxSize = Math.max(...sizes, bodySize);

        const roleOf = st => {
            const sample = (st.samples[0] || '');
            if (st.size >= Math.max(bodySize * 1.55, maxSize * 0.8)) return 'headings';
            if (st.size >= bodySize * 1.18) return 'subheadings';
            if (/^[\d\s.,()\-+]+$/.test(sample) && sample.length > 1) return 'numbers';
            if (/\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}/.test(sample)) return 'dates';
            return 'body';
        };

        const groups = {
            headings: { id: 'headings', label: '🔠 العناوين الرئيسية', styles: [] },
            subheadings: { id: 'subheadings', label: '🔡 العناوين الفرعية', styles: [] },
            body: { id: 'body', label: '📝 نص المتن', styles: [] },
            numbers: { id: 'numbers', label: '🔢 الأرقام والمبالغ', styles: [] },
            dates: { id: 'dates', label: '📅 التواريخ', styles: [] },
            tables: { id: 'tables', label: '📊 خلايا الجداول', styles: [] },
            header: { id: 'header', label: '⬆️ الترويسة (Header)', styles: [] },
            footer: { id: 'footer', label: '⬇️ التذييل (Footer)', styles: [] }
        };

        // أنماط الترويسة/التذييل تُستنتج من الموضع الرأسي
        const zone = new Map();
        for (const pg of pgs) {
            for (const it of pg.items) {
                const k = S.key(it);
                const rel = it.y / pg.height;
                const z = rel > 0.88 ? 'header' : rel < 0.1 ? 'footer' : null;
                if (z) zone.set(k, z);
            }
        }
        const tableKeys = new Set();
        for (const pg of pgs) for (const t of P.detectTables(pg)) for (const row of t.cells) for (const c of row) {
            const it = pg.items.find(i => i.id === c.id); if (it) tableKeys.add(S.key(it));
        }

        for (const st of analysis.styles) {
            if (zone.get(st.key) === 'header') groups.header.styles.push(st);
            else if (zone.get(st.key) === 'footer') groups.footer.styles.push(st);
            else if (tableKeys.has(st.key)) groups.tables.styles.push(st);
            else groups[roleOf(st)].styles.push(st);
        }
        return {
            bodySize,
            groups: Object.values(groups).filter(g => g.styles.length)
        };
    };

    function mode(arr) {
        const m = new Map(); let best = null, bc = 0;
        arr.forEach(v => { const c = (m.get(v) || 0) + 1; m.set(v, c); if (c > bc) { bc = c; best = v; } });
        return best;
    }

    /**
     * «الاستبدال الذكي» (§7) — يحسب نمط النص البديل مع ملاءمة تلقائية
     * إذا اختلف الطول، دون كسر حدود الصندوق الأصلي.
     */
    S.autoFit = function (item, newText, opts) {
        opts = opts || {};
        const boxW = opts.boxWidth || item.w;
        if (!boxW || !newText) return { fontSize: item.fontSize, charSpacing: item.charSpacing || 0, scale: 1 };
        // العرض التقريبي لكل حرف من النص الأصلي (أدق من أي تقدير عام)
        const unit = item.str.length ? item.w / item.str.length : item.fontSize * 0.5;
        const want = unit * newText.length;
        if (want <= boxW * 1.01) return { fontSize: item.fontSize, charSpacing: item.charSpacing || 0, scale: 1 };
        const ratio = boxW / want;
        // أولاً نضيّق التباعد، ثم نصغّر الخط — بحد أدنى 72% حفاظاً على المقروئية
        if (ratio >= 0.94) return { fontSize: item.fontSize, charSpacing: (item.charSpacing || 0) - unit * (1 - ratio), scale: 1 };
        return { fontSize: Math.max(item.fontSize * 0.72, item.fontSize * ratio), charSpacing: 0, scale: ratio };
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-CS] جراحة تدفّق المحتوى — إزالة النص الأصلي فعلياً
    // ───────────────────────────────────────────────────────────────────────────
    // هذه هي النواة التي تجعل التحرير «حقيقياً» بدل تغطية النص بمستطيل أبيض (§49):
    // نفكّ تدفّق محتوى الصفحة، نحدّد عملية إظهار النص رقم N، ونفرّغ معاملها
    // النصّي. النتيجة: الحروف تختفي من بنية الملف ولا يمكن تحديدها أو نسخها
    // أو استخراجها — وهو المطلوب أيضاً في التنقيح الآمن (§22).
    // إن فشلت الجراحة، يتولّى التصدير بديلاً آمناً (§50).
    // ═══════════════════════════════════════════════════════════════════════════
    const CS = PDFE.CS = {};

    const WS = new Set([0x00, 0x09, 0x0A, 0x0C, 0x0D, 0x20]);
    const DELIM = new Set([0x28, 0x29, 0x3C, 0x3E, 0x5B, 0x5D, 0x7B, 0x7D, 0x2F, 0x25]);

    /**
     * يجزّئ تدفّق محتوى إلى رموز مع مواضعها بالبايت.
     * يتعامل بأمان مع: النصوص الحرفية والمتداخلة، النصوص الست عشرية،
     * الأسماء، المصفوفات، القواميس، التعليقات، والصور المضمّنة (BI…ID…EI).
     */
    CS.tokenize = function (bytes) {
        const toks = [];
        let i = 0; const n = bytes.length;
        while (i < n) {
            const c = bytes[i];
            if (WS.has(c)) { i++; continue; }
            const start = i;
            if (c === 0x25) {                                   // % تعليق
                while (i < n && bytes[i] !== 0x0A && bytes[i] !== 0x0D) i++;
                continue;
            }
            if (c === 0x28) {                                   // ( نص حرفي
                let depth = 0;
                while (i < n) {
                    const b = bytes[i];
                    if (b === 0x5C) { i += 2; continue; }        // \ تخطٍّ
                    if (b === 0x28) depth++;
                    else if (b === 0x29) { depth--; if (depth === 0) { i++; break; } }
                    i++;
                }
                toks.push({ t: 'str', start, end: i });
                continue;
            }
            if (c === 0x3C && bytes[i + 1] === 0x3C) {          // << قاموس
                toks.push({ t: 'op', start, end: i + 2, v: '<<' }); i += 2; continue;
            }
            if (c === 0x3C) {                                   // < نص ست عشري
                while (i < n && bytes[i] !== 0x3E) i++;
                i++;
                toks.push({ t: 'str', start, end: i });
                continue;
            }
            if (c === 0x3E && bytes[i + 1] === 0x3E) { toks.push({ t: 'op', start, end: i + 2, v: '>>' }); i += 2; continue; }
            if (c === 0x5B) { toks.push({ t: '[', start, end: i + 1 }); i++; continue; }
            if (c === 0x5D) { toks.push({ t: ']', start, end: i + 1 }); i++; continue; }
            if (c === 0x2F) {                                   // /اسم
                i++;
                while (i < n && !WS.has(bytes[i]) && !DELIM.has(bytes[i])) i++;
                toks.push({ t: 'name', start, end: i });
                continue;
            }
            // رقم أو معامل
            while (i < n && !WS.has(bytes[i]) && !DELIM.has(bytes[i])) i++;
            if (i === start) i++;                               // حماية من الدوران اللانهائي
            const v = latin1(bytes, start, i);
            if (/^[+\-.\d]/.test(v)) toks.push({ t: 'num', start, end: i, v });
            else {
                toks.push({ t: 'op', start, end: i, v });
                if (v === 'BI') {                               // صورة مضمّنة: نقفز حتى EI
                    let j = i;
                    while (j < n - 1) {
                        if (bytes[j] === 0x45 && bytes[j + 1] === 0x49 && (j + 2 >= n || WS.has(bytes[j + 2])) && WS.has(bytes[j - 1])) { j += 2; break; }
                        j++;
                    }
                    toks.push({ t: 'op', start: i, end: j, v: 'EI_BLOB' });
                    i = j;
                }
            }
        }
        return toks;
    };

    function latin1(bytes, s, e) {
        let out = '';
        for (let i = s; i < e; i++) out += String.fromCharCode(bytes[i]);
        return out;
    }

    /** يفكّ نصاً حرفياً `(...)` إلى بايتات خامّة (بدون تفسير ترميز الخط). */
    CS.decodeLiteral = function (bytes, start, end) {
        const out = [];
        for (let i = start + 1; i < end - 1; i++) {
            let b = bytes[i];
            if (b === 0x5C) {
                const nx = bytes[++i];
                const map = { 0x6E: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12 };
                if (map[nx] !== undefined) out.push(map[nx]);
                else if (nx >= 0x30 && nx <= 0x37) {            // \ooo ثماني
                    let oct = String.fromCharCode(nx);
                    for (let k = 0; k < 2 && bytes[i + 1] >= 0x30 && bytes[i + 1] <= 0x37; k++) oct += String.fromCharCode(bytes[++i]);
                    out.push(parseInt(oct, 8) & 0xFF);
                } else if (nx === 0x0A) { /* سطر مُتابَع */ }
                else out.push(nx);
                continue;
            }
            out.push(b);
        }
        return out;
    };

    /**
     * يرصد كل عمليات إظهار النص في التدفّق بالترتيب، مع مدى معاملاتها بالبايت
     * وطولها التقريبي بالحروف (لأغراض التحقق من المطابقة).
     */
    CS.findTextOps = function (bytes) {
        const toks = CS.tokenize(bytes);
        const ops = [];
        for (let i = 0; i < toks.length; i++) {
            const t = toks[i];
            if (t.t !== 'op') continue;
            const v = t.v;
            if (v === 'Tj' || v === "'") {
                const arg = toks[i - 1];
                if (arg && arg.t === 'str') ops.push({ op: v, argStart: arg.start, argEnd: arg.end, kind: 'str', glyphs: glyphCount(bytes, arg) });
            } else if (v === '"') {
                const arg = toks[i - 1];
                if (arg && arg.t === 'str') ops.push({ op: v, argStart: arg.start, argEnd: arg.end, kind: 'str', glyphs: glyphCount(bytes, arg) });
            } else if (v === 'TJ') {
                // نرجع للخلف حتى '[' المقابل
                let depth = 0, j = i - 1, close = -1, open = -1;
                for (; j >= 0; j--) {
                    if (toks[j].t === ']') { if (close < 0) close = toks[j].end; depth++; }
                    else if (toks[j].t === '[') { depth--; if (depth === 0) { open = toks[j].start; break; } }
                }
                if (open >= 0 && close > open) {
                    let g = 0;
                    for (let k = j; k <= i; k++) if (toks[k].t === 'str') g += glyphCount(bytes, toks[k]);
                    ops.push({ op: 'TJ', argStart: open, argEnd: close, kind: 'arr', glyphs: g });
                }
            }
        }
        return ops;
    };

    function glyphCount(bytes, tok) {
        if (bytes[tok.start] === 0x3C) return Math.floor((tok.end - tok.start - 2) / 4) || (tok.end - tok.start - 2);
        return CS.decodeLiteral(bytes, tok.start, tok.end).length;
    }

    /**
     * يفرّغ عمليات إظهار النص المحدّدة (بفهارسها) من التدفّق.
     * @param {Uint8Array} bytes التدفّق الأصلي
     * @param {Set<number>} indices فهارس العمليات المراد إزالتها
     * @returns {{bytes:Uint8Array, removed:number}}
     */
    CS.blankTextOps = function (bytes, indices) {
        const ops = CS.findTextOps(bytes);
        const targets = [];
        indices.forEach(idx => { if (ops[idx]) targets.push(ops[idx]); });
        if (!targets.length) return { bytes, removed: 0, total: ops.length };
        targets.sort((a, b) => a.argStart - b.argStart);

        const parts = [];
        let cursor = 0;
        for (const t of targets) {
            parts.push(bytes.subarray(cursor, t.argStart));
            parts.push(new Uint8Array(t.kind === 'arr' ? [0x5B, 0x5D] : [0x28, 0x29]));  // [] أو ()
            cursor = t.argEnd;
        }
        parts.push(bytes.subarray(cursor));
        const len = parts.reduce((s, p) => s + p.length, 0);
        const out = new Uint8Array(len);
        let o = 0;
        for (const p of parts) { out.set(p, o); o += p.length; }
        return { bytes: out, removed: targets.length, total: ops.length };
    };

    /**
     * يجمع **كل** عمليات إظهار النص التي تراها pdf.js لهذه الصفحة، بالترتيب نفسه.
     * ───────────────────────────────────────────────────────────────────────
     * لماذا هذا ضروري: كثير من الفواتير والقوالب تضع محتواها داخل
     * Form XObject ويستدعيها تدفّق الصفحة بـ `/Name Do`. قراءة تدفّق الصفحة
     * وحده تُظهر عمليات أقل بكثير مما تراه pdf.js، فينزاح الترقيم وتُفرَّغ
     * عمليةٌ **خاطئة** بينما يبقى النص المستهدف — أسوأ من عدم الجراحة أصلاً.
     * نمشي هنا كما يمشي pdf.js: ندخل الـ XObject عند نقطة استدعائه بالضبط.
     *
     * @returns {{entries:Array, streams:Map}|null}
     *   entries: [{ key, argStart, argEnd, kind }] بالترتيب العالمي
     *   streams: key → { bytes, stream, kind:'page'|'xobj' }
     */
    CS.collectTextOps = function (PDFLib, page) {
        const ctx = page.node.context;
        const streams = new Map();
        const entries = [];
        const seen = new Set();          // حماية من التداخل الدائري

        const pageBytes = CS.readPageContent(PDFLib, page);
        if (!pageBytes) return null;
        streams.set('page', { bytes: pageBytes, stream: null, kind: 'page' });

        function resourcesOf(node) {
            try {
                const r = node.get(PDFLib.PDFName.of('Resources'));
                return r ? (r instanceof PDFLib.PDFRef ? ctx.lookup(r) : r) : null;
            } catch (e) { return null; }
        }
        function xobjectNamed(res, name) {
            if (!res) return null;
            try {
                const xd = res.get(PDFLib.PDFName.of('XObject'));
                const dict = xd instanceof PDFLib.PDFRef ? ctx.lookup(xd) : xd;
                if (!dict) return null;
                const ref = dict.get(PDFLib.PDFName.of(name));
                if (!ref) return null;
                return { ref, obj: ref instanceof PDFLib.PDFRef ? ctx.lookup(ref) : ref };
            } catch (e) { return null; }
        }

        function walk(bytes, key, res, depth) {
            if (depth > 6) return;
            const toks = CS.tokenize(bytes);
            for (let i = 0; i < toks.length; i++) {
                const t = toks[i];
                if (t.t !== 'op') continue;
                const v = t.v;
                if (v === 'Tj' || v === "'" || v === '"') {
                    const arg = toks[i - 1];
                    if (arg && arg.t === 'str') entries.push({ key, argStart: arg.start, argEnd: arg.end, kind: 'str' });
                } else if (v === 'TJ') {
                    let depth2 = 0, j = i - 1, close = -1, open = -1;
                    for (; j >= 0; j--) {
                        if (toks[j].t === ']') { if (close < 0) close = toks[j].end; depth2++; }
                        else if (toks[j].t === '[') { depth2--; if (depth2 === 0) { open = toks[j].start; break; } }
                    }
                    if (open >= 0 && close > open) entries.push({ key, argStart: open, argEnd: close, kind: 'arr' });
                } else if (v === 'Do') {
                    // ندخل الـ XObject من نوع Form عند نقطة استدعائه — كما يفعل pdf.js
                    const nameTok = toks[i - 1];
                    if (!nameTok || nameTok.t !== 'name') continue;
                    const name = latin1(bytes, nameTok.start + 1, nameTok.end);
                    const hit = xobjectNamed(res, name);
                    if (!hit || !hit.obj) continue;
                    let sub = null;
                    try { sub = hit.obj.dict && hit.obj.dict.get(PDFLib.PDFName.of('Subtype')); } catch (e) { /* ليس تدفّقاً */ }
                    if (!sub || String(sub) !== '/Form') continue;
                    // مفتاح ثابت لكل XObject: تمثيل المرجع النصي ("12 0 R") — لا دالة tag()
                    const idKey = 'xobj:' + String(hit.ref) + ':' + name;
                    if (seen.has(idKey)) continue;
                    const xb = decodeStream(PDFLib, hit.obj);
                    if (!xb) continue;
                    seen.add(idKey);
                    if (!streams.has(idKey)) streams.set(idKey, { bytes: xb, stream: hit.obj, kind: 'xobj' });
                    walk(xb, idKey, resourcesOf(hit.obj.dict) || res, depth + 1);
                }
            }
        }

        walk(pageBytes, 'page', resourcesOf(page.node), 0);
        return { entries, streams };
    };

    /**
     * يفرّغ عمليات إظهار النص بفهارسها العالمية عبر الصفحة وكل XObjects فيها.
     * @returns {{removed:number, total:number, writes:Array}}
     */
    CS.blankGlobal = function (collected, indices) {
        const { entries, streams } = collected;
        const byStream = new Map();
        let removed = 0;
        indices.forEach(idx => {
            const e = entries[idx];
            if (!e) return;
            if (!byStream.has(e.key)) byStream.set(e.key, []);
            byStream.get(e.key).push(e);
            removed++;
        });
        const writes = [];
        byStream.forEach((list, key) => {
            const src = streams.get(key);
            if (!src) return;
            list.sort((a, b) => a.argStart - b.argStart);
            const parts = [];
            let cursor = 0;
            for (const e of list) {
                parts.push(src.bytes.subarray(cursor, e.argStart));
                parts.push(new Uint8Array(e.kind === 'arr' ? [0x5B, 0x5D] : [0x28, 0x29]));
                cursor = e.argEnd;
            }
            parts.push(src.bytes.subarray(cursor));
            const len = parts.reduce((s, p) => s + p.length, 0);
            const out = new Uint8Array(len);
            let o = 0;
            for (const p of parts) { out.set(p, o); o += p.length; }
            writes.push({ key, kind: src.kind, stream: src.stream, bytes: out });
        });
        return { removed, total: entries.length, writes };
    };

    /** يكتب نتائج الجراحة إلى مواضعها (تدفّق الصفحة أو تدفّق XObject). */
    CS.applyWrites = function (PDFLib, page, writes) {
        for (const w of writes) {
            if (w.kind === 'page') { CS.writePageContent(PDFLib, page, w.bytes); continue; }
            // XObject: نكتب المحتوى خاماً وننزع المرشّح كي يبقى الملف صالحاً
            const d = w.stream.dict;
            d.delete(PDFLib.PDFName.of('Filter'));
            d.delete(PDFLib.PDFName.of('DecodeParms'));
            w.stream.contents = w.bytes;
            d.set(PDFLib.PDFName.of('Length'), page.node.context.obj(w.bytes.length));
        }
    };

    /** يقرأ محتوى الصفحة كبايتات موحّدة (يدمج المصفوفات). */
    CS.readPageContent = function (PDFLib, page) {
        const ctx = page.node.context;
        const contents = page.node.get(PDFLib.PDFName.of('Contents'));
        const resolved = contents instanceof PDFLib.PDFRef ? ctx.lookup(contents) : contents;
        const streams = [];
        if (!resolved) return null;
        if (resolved.constructor && resolved.constructor.name === 'PDFArray' || typeof resolved.asArray === 'function') {
            const arr = typeof resolved.asArray === 'function' ? resolved.asArray() : [];
            arr.forEach(r => { const s = ctx.lookup(r); if (s) streams.push(s); });
        } else streams.push(resolved);

        const decoded = [];
        for (const s of streams) {
            const bytes = decodeStream(PDFLib, s);
            if (!bytes) return null;                            // مرشّح غير مدعوم → لا جراحة
            decoded.push(bytes);
        }
        if (!decoded.length) return null;
        if (decoded.length === 1) return decoded[0];
        const total = decoded.reduce((s, d) => s + d.length + 1, 0);
        const out = new Uint8Array(total);
        let o = 0;
        decoded.forEach(d => { out.set(d, o); o += d.length; out[o++] = 0x0A; });
        return out;
    };

    function decodeStream(PDFLib, stream) {
        try {
            if (typeof PDFLib.decodePDFRawStream === 'function' && stream instanceof PDFLib.PDFRawStream) {
                return PDFLib.decodePDFRawStream(stream).decode();
            }
            if (typeof stream.getContents === 'function') {
                const filt = stream.dict && stream.dict.get(PDFLib.PDFName.of('Filter'));
                if (!filt) return stream.getContents();          // غير مضغوط
            }
        } catch (e) { /* يسقط للبديل */ }
        return null;
    }

    /** يكتب محتوى صفحة جديداً (غير مضغوط لتفادي أي فقد). */
    CS.writePageContent = function (PDFLib, page, bytes) {
        const ctx = page.node.context;
        const stream = ctx.flateStream ? ctx.flateStream(bytes) : ctx.stream(bytes);
        const ref = ctx.register(stream);
        page.node.set(PDFLib.PDFName.of('Contents'), ref);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-OPS] نموذج عمليات التحرير
    // كل تعديل = كائن قابل للتسلسل → يُخزَّن في RTDB → يتيح Undo وإعادة التطبيق
    // والمقارنة بين النُّسخ (§39) وسجل التدقيق التفصيلي (§36).
    // ═══════════════════════════════════════════════════════════════════════════
    const O = PDFE.Ops = {};
    let _opSeq = 0;
    O.make = function (type, data) {
        return Object.assign({ id: 'op' + (Date.now().toString(36)) + (_opSeq++), type, at: Date.now() }, data);
    };

    /** وصف عربي مقروء للعملية — يظهر في التاريخ وسجل التدقيق. */
    O.describe = function (op) {
        const p = op.page ? ` (صفحة ${op.page})` : '';
        const t = {
            'text.edit': () => `تعديل نص${p}: «${trunc(op.oldText)}» ← «${trunc(op.newText)}»`,
            'text.delete': () => `حذف نص${p}: «${trunc(op.oldText)}»`,
            'text.add': () => `إضافة نص${p}: «${trunc(op.text)}»`,
            'text.style': () => `تغيير تنسيق نص${p}`,
            'text.move': () => `تحريك نص${p}`,
            'image.add': () => `إضافة صورة${p}`,
            'image.delete': () => `حذف صورة${p}`,
            'image.replace': () => `استبدال صورة${p}`,
            'image.transform': () => `تعديل صورة${p} (موضع/حجم/دوران)`,
            'shape.add': () => `إضافة شكل${p}`,
            'annot.highlight': () => `تظليل${p}`,
            'annot.underline': () => `تسطير${p}`,
            'annot.strike': () => `شطب${p}`,
            'annot.comment': () => `تعليق${p}: «${trunc(op.text)}»`,
            'annot.link': () => `إضافة رابط${p}`,
            'sign.add': () => `إضافة توقيع${p}`,
            'stamp.add': () => `إضافة ختم «${op.label || ''}»${p}`,
            'qr.add': () => `إضافة رمز QR${p}`,
            'watermark': () => `علامة مائية «${trunc(op.text)}»`,
            'redact': () => `🔒 تنقيح آمن${p}: «${trunc(op.oldText)}»`,
            'page.delete': () => `حذف صفحة ${op.page}`,
            'page.insert': () => `إدراج صفحة عند ${op.at}`,
            'page.rotate': () => `تدوير صفحة ${op.page} بمقدار ${op.deg}°`,
            'page.reorder': () => 'إعادة ترتيب الصفحات',
            'page.crop': () => `قص صفحة ${op.page}`,
            'page.duplicate': () => `تكرار صفحة ${op.page}`,
            'doc.merge': () => `دمج ملف: ${op.name || ''}`,
            'doc.meta': () => 'تعديل خصائص المستند',
            'doc.protect': () => 'تفعيل حماية بكلمة مرور'
        };
        return (t[op.type] || (() => op.type))();
    };
    const trunc = s => { s = String(s == null ? '' : s); return s.length > 42 ? s.slice(0, 42) + '…' : s; };

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-HIST] محرك التاريخ (Undo/Redo) — §26
    // ═══════════════════════════════════════════════════════════════════════════
    PDFE.History = class History {
        constructor(limit) { this.stack = []; this.idx = -1; this.limit = limit || 300; this.onChange = null; }
        push(op) {
            this.stack = this.stack.slice(0, this.idx + 1);
            this.stack.push(op);
            if (this.stack.length > this.limit) this.stack.shift();
            this.idx = this.stack.length - 1;
            this._fire();
        }
        canUndo() { return this.idx >= 0; }
        canRedo() { return this.idx < this.stack.length - 1; }
        undo() { if (!this.canUndo()) return null; const op = this.stack[this.idx--]; this._fire(); return op; }
        redo() { if (!this.canRedo()) return null; const op = this.stack[++this.idx]; this._fire(); return op; }
        /** العمليات الفعّالة حالياً (حتى المؤشّر) — هي ما يُصدَّر. */
        active() { return this.stack.slice(0, this.idx + 1); }
        clear() { this.stack = []; this.idx = -1; this._fire(); }
        _fire() { if (this.onChange) try { this.onChange(this); } catch (e) { /* لا نُسقط المحرر بسبب مستمع */ } }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-OCR] طبقة OCR — §9
    // ═══════════════════════════════════════════════════════════════════════════
    PDFE.OCR = {
        available() { return typeof Tesseract !== 'undefined'; },
        /**
         * يشغّل OCR على لوحة صفحة مرسومة ويعيد كتلاً نصية بإحداثيات PDF.
         * @param {HTMLCanvasElement} canvas الصفحة مرسومة بمقياس scale
         */
        async recognizePage(canvas, pageAnalysis, scale, onProgress) {
            if (!PDFE.OCR.available()) throw new Error('محرّك القراءة الضوئية (OCR) غير محمّل — تحقّق من الاتصال بالإنترنت');
            const res = await Tesseract.recognize(canvas, 'ara+eng', {
                logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(m.progress); }
            });
            const H = pageAnalysis.height;
            const words = (res.data && res.data.words) || [];
            const lines = (res.data && res.data.lines) || [];
            const src = lines.length ? lines : words;
            return src.filter(w => (w.text || '').trim() && (w.confidence == null || w.confidence > 45)).map((w, i) => {
                const b = w.bbox || {};
                const x = (b.x0 || 0) / scale;
                const yTop = (b.y0 || 0) / scale;
                const h = ((b.y1 || 0) - (b.y0 || 0)) / scale;
                return {
                    id: 'ocr' + pageAnalysis.n + '_' + i,
                    page: pageAnalysis.n,
                    str: (w.text || '').trim(),
                    x, y: H - yTop - h,
                    w: ((b.x1 || 0) - (b.x0 || 0)) / scale,
                    h,
                    fontSize: Math.round(h * 0.82 * 10) / 10,
                    fontFamily: AR.hasArabic(w.text) ? 'Amiri' : 'Helvetica',
                    bold: false, italic: false,
                    color: '#000000', opacity: 1,
                    align: AR.hasRTL(w.text) ? 'right' : 'left',
                    dir: AR.hasRTL(w.text) ? 'rtl' : 'ltr',
                    rtl: AR.hasRTL(w.text),
                    lang: AR.detectLang(w.text),
                    confidence: Math.round(w.confidence || 0),
                    lineGapRatio: 1.2, charSpacing: 0, angle: 0,
                    ocr: true, opIndex: -1,
                    editable: true, state: 'ocr'
                };
            });
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-STORE] طبقة التخزين
    // الثنائي → Cloudinary (Firebase Storage معطّل على خطة Spark).
    // الوصفي/النُّسخ/العمليات → RTDB.
    // الواجهة موحّدة: عند الترقية لـ Blaze يكفي تسجيل منفذ 'firebase'.
    // ═══════════════════════════════════════════════════════════════════════════
    const ST = PDFE.Storage = { adapters: {}, current: 'cloudinary' };

    ST.register = function (name, adapter) { ST.adapters[name] = adapter; };
    ST.use = function (name) { if (!ST.adapters[name]) throw new Error('منفذ تخزين غير معروف: ' + name); ST.current = name; };
    ST.adapter = function () { return ST.adapters[ST.current]; };

    ST.register('cloudinary', {
        label: 'Cloudinary',
        available: () => typeof window.isCloudinaryConfigured === 'function' && window.isCloudinaryConfigured(),
        hint: 'اضبط اسم السحابة و Upload Preset في الإعدادات ⚙️ → التكاملات',
        async upload(bytes, name) {
            if (typeof window.cloudinaryUpload !== 'function') throw new Error('خدمة الرفع غير متاحة');
            const file = new File([bytes], name || ('document-' + Date.now() + '.pdf'), { type: 'application/pdf' });
            const r = await window.cloudinaryUpload(file);
            return { url: r.url, size: r.size, providerId: r.publicId, provider: 'cloudinary' };
        }
    });

    // منفذ Firebase Storage — جاهز، يُفعَّل تلقائياً عند الترقية لخطة Blaze.
    ST.register('firebase', {
        label: 'Firebase Storage',
        available: () => typeof window.uploadCompanyFile === 'function',
        hint: 'يتطلب ترقية المشروع لخطة Blaze وتفعيل Storage',
        async upload(bytes, name) {
            const file = new File([bytes], name, { type: 'application/pdf' });
            const r = await window.uploadCompanyFile(file, 'pdf-editor');
            return { url: r.url, size: file.size, providerId: r.path, provider: 'firebase' };
        }
    });

    /** يختار تلقائياً أول منفذ متاح. */
    ST.autoSelect = function () {
        for (const k of ['firebase', 'cloudinary']) if (ST.adapters[k] && ST.adapters[k].available()) { ST.current = k; return k; }
        ST.current = 'cloudinary';
        return null;
    };

    ST.upload = async function (bytes, name) {
        const a = ST.adapter();
        if (!a.available()) throw new Error('التخزين غير مهيّأ — ' + a.hint);
        return a.upload(bytes, name);
    };

    // ── سجلات RTDB ──────────────────────────────────────────────────────────
    function refs() {
        const R = window.R;
        if (!R || !R.pdfDocs) throw new Error('سجلات محرر PDF غير مهيّأة في قاعدة البيانات');
        return R;
    }

    ST.saveDoc = async function (meta) {
        const r = await window.push(refs().pdfDocs, meta);
        return r.key;
    };
    ST.updateDoc = function (docId, patch) {
        return window.update(window.ref(window.db, 'ledger/pdfDocuments/' + docId), patch);
    };
    ST.deleteDoc = async function (docId) {
        await window.remove(window.ref(window.db, 'ledger/pdfDocuments/' + docId));
        await window.remove(window.ref(window.db, 'ledger/pdfVersions/' + docId));
        await window.remove(window.ref(window.db, 'ledger/pdfEdits/' + docId));
    };
    ST.saveVersion = async function (docId, ver) {
        const r = await window.push(window.ref(window.db, 'ledger/pdfVersions/' + docId), ver);
        return r.key;
    };
    ST.saveOps = function (docId, verId, ops) {
        // العمليات قد تكون كبيرة — نخزّنها منفصلة عن الوصف حتى لا تُثقل القوائم
        return window.set(window.ref(window.db, 'ledger/pdfEdits/' + docId + '/' + verId), { ops, at: Date.now() });
    };
    ST.loadOps = async function (docId, verId) {
        const sn = await window.get(window.ref(window.db, 'ledger/pdfEdits/' + docId + '/' + verId));
        return sn.exists() ? (sn.val().ops || []) : [];
    };

    /** يجلب ملف PDF من رابط (نُسخة سابقة/مرفق داخل النظام). */
    ST.fetchBytes = async function (url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('تعذّر تحميل الملف (رمز ' + res.status + ') — تحقّق من الرابط أو الصلاحيات');
        return new Uint8Array(await res.arrayBuffer());
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-AUDIT] طبقة التدقيق — §35 §36
    // تكتب في R.auditLog الموجود بدل إنشاء سجل موازٍ.
    // ═══════════════════════════════════════════════════════════════════════════
    PDFE.Audit = {
        async log(action, description, extra) {
            try {
                const u = window.curU || {};
                const p = window.myP || {};
                const rec = Object.assign({
                    at: Date.now(),
                    by: u.email || '',
                    byName: p.name || u.email || '',
                    module: 'محرر PDF',
                    action,
                    description
                }, extra || {});
                // RTDB يرفض أي قيمة undefined ويُسقط الكتابة كلها (مثلاً docId لمستند
                // لم يُحفظ في النظام بعد). ننظّف قبل الإرسال بدل فقد سجل التدقيق.
                Object.keys(rec).forEach(k => { if (rec[k] === undefined) delete rec[k]; });
                await window.push(refs().auditLog, rec);
            } catch (e) { console.warn('تعذّر تسجيل التدقيق:', e && e.message); }
        },
        /** سجل تفصيلي للتغييرات: قبل/بعد لكل عملية (§36). */
        async logOps(docName, docId, ops) {
            if (!ops.length) return;
            const lines = ops.slice(0, 40).map(o => O.describe(o));
            await PDFE.Audit.log('تعديل مستند PDF',
                `«${docName}» — ${ops.length} تعديل: ${lines.join(' · ')}${ops.length > 40 ? ' …' : ''}`,
                { docId: docId || null, opCount: ops.length });
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-ENG] واجهة المحرك المجرّدة (§48)
    // ───────────────────────────────────────────────────────────────────────────
    // الواجهة تفصل تماماً بين UI ومحرك PDF. المحرك المحلي (pdf.js + pdf-lib)
    // مجاني ويعمل الآن. عند شراء ترخيص Apryse/PDFTron يكفي إكمال المنفذ أدناه
    // وتغيير سطر PDFE.Engine.use('apryse') — الواجهة كلها تبقى كما هي.
    // ═══════════════════════════════════════════════════════════════════════════
    const E = PDFE.Engine = { impls: {}, current: 'local' };
    E.register = (name, impl) => { E.impls[name] = impl; };
    E.use = name => { if (!E.impls[name]) throw new Error('محرك غير مسجَّل: ' + name); E.current = name; };
    E.get = () => E.impls[E.current];
    E.capabilities = () => E.get().capabilities();

    /** المحرك المحلي المجاني — pdf.js للقراءة/العرض + pdf-lib للكتابة. */
    const LocalEngine = {
        name: 'local',
        label: 'المحرك المحلي (pdf.js + pdf-lib)',
        capabilities: () => ({
            nativeTextEdit: 'surgery',      // إزالة حقيقية من التدفّق + إعادة رسم vector
            vectorShapeEdit: false,
            formFields: 'read',
            trueRedaction: true,
            encryption: 'read',             // فك الحماية بكلمة مرور صحيحة فقط
            ocr: PDFE.OCR.available()
        }),

        /** يفتح مستنداً ويعيد سياقاً كاملاً. */
        async load(bytes, opts) {
            opts = opts || {};
            const lib = PDFE.libs.ensurePdfJs();
            let pdf;
            try {
                pdf = await lib.getDocument({
                    data: bytes.slice(0),                 // pdf.js يستهلك المخزن — ننسخه
                    password: opts.password || undefined,
                    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                    cMapPacked: true
                }).promise;
            } catch (e) {
                throw translateLoadError(e);
            }
            const meta = await pdf.getMetadata().catch(() => ({ info: {} }));
            return {
                pdf,
                bytes,
                numPages: pdf.numPages,
                info: (meta && meta.info) || {},
                encrypted: !!(opts.password),
                fingerprint: (pdf.fingerprints && pdf.fingerprints[0]) || ''
            };
        },

        analyze(ctx, opts) { return P.analyzeDocument(ctx.pdf, opts); },

        /** يرسم صفحة على لوحة بمقياس محدّد. */
        async renderPage(ctx, pageNum, scale, canvas, extra) {
            const page = await ctx.pdf.getPage(pageNum);
            const vp = page.getViewport({ scale, rotation: extra && extra.rotation != null ? extra.rotation : undefined });
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(vp.width * dpr);
            canvas.height = Math.floor(vp.height * dpr);
            canvas.style.width = Math.floor(vp.width) + 'px';
            canvas.style.height = Math.floor(vp.height) + 'px';
            const c2d = canvas.getContext('2d', { willReadFrequently: true });
            c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
            const task = page.render({ canvasContext: c2d, viewport: vp });
            await task.promise;
            return { width: vp.width, height: vp.height, dpr };
        },

        export: (ctx, ops, opts) => PDFE.Export.build(ctx, ops, opts)
    };
    E.register('local', LocalEngine);

    /**
     * منفذ Apryse/PDFTron — غير مفعّل (يتطلب ترخيصاً تجارياً).
     * الغرض من وجوده: إثبات أن الواجهة قابلة للتبديل فعلاً دون لمس UI.
     * لتفعيله: حمّل WebViewer، أكمل الدوال، ثم PDFE.Engine.use('apryse').
     */
    E.register('apryse', {
        name: 'apryse',
        label: 'Apryse WebViewer (يتطلب ترخيصاً)',
        licensed: false,
        capabilities: () => ({ nativeTextEdit: 'native', vectorShapeEdit: true, formFields: 'edit', trueRedaction: true, encryption: 'full', ocr: true }),
        async load() { throw new Error('محرك Apryse غير مفعّل — يتطلب ترخيصاً تجارياً. النظام يعمل حالياً بالمحرك المحلي المجاني.'); },
        analyze() { throw new Error('محرك Apryse غير مفعّل'); },
        renderPage() { throw new Error('محرك Apryse غير مفعّل'); },
        export() { throw new Error('محرك Apryse غير مفعّل'); }
    });

    /** يحوّل أخطاء pdf.js التقنية إلى رسائل عربية واضحة (§51). */
    function translateLoadError(e) {
        const n = (e && e.name) || '';
        const m = (e && e.message) || '';
        if (n === 'PasswordException' || /password/i.test(m)) {
            const need = /incorrect/i.test(m) ? 'كلمة المرور غير صحيحة' : 'هذا الملف محمي بكلمة مرور';
            const err = new Error(need); err.code = 'PASSWORD'; return err;
        }
        if (n === 'InvalidPDFException' || /invalid pdf|corrupt/i.test(m)) {
            const err = new Error('الملف تالف أو ليس ملف PDF صالحاً — جرّب ملفاً آخر'); err.code = 'CORRUPT'; return err;
        }
        if (/missing pdf|unexpected server response/i.test(m)) {
            const err = new Error('تعذّر الوصول إلى الملف — تحقّق من الرابط والاتصال'); err.code = 'FETCH'; return err;
        }
        const err = new Error('تعذّر فتح الملف: ' + (m || 'خطأ غير معروف')); err.code = 'UNKNOWN'; return err;
    }
    PDFE.translateLoadError = translateLoadError;

    // ═══════════════════════════════════════════════════════════════════════════
    // [PE-EXP] محرك التصدير
    // ───────────────────────────────────────────────────────────────────────────
    // الترتيب مهم: جراحة النص أولاً (على أرقام الصفحات الأصلية)، ثم الرسم،
    // ثم عمليات الصفحات (حذف/ترتيب/إدراج) — لأن الأخيرة تغيّر الفهارس.
    // ═══════════════════════════════════════════════════════════════════════════
    const X = PDFE.Export = {};

    X.build = async function (ctx, ops, opts) {
        opts = opts || {};
        const PDFLib = await PDFE.libs.ensurePdfLib();
        const { PDFDocument, degrees, rgb, StandardFonts } = PDFLib;

        const doc = await PDFDocument.load(ctx.bytes.slice(0), { ignoreEncryption: true, updateMetadata: false });
        if (window.fontkit) { try { doc.registerFontkit(window.fontkit); } catch (e) { /* التضمين العربي فقط سيتعطّل */ } }

        // `dropped` = نصوص طلب المستخدم كتابتها ولم تُرسم فعلاً (خط ناقص مثلاً).
        // وجودها يعني أن المخرَج **ينقصه عمل المستخدم**، ويجب ألا يمرّ بصمت.
        const report = { surgery: { attempted: 0, applied: 0, fallback: 0 }, drawn: 0, requested: 0, warnings: [], dropped: [] };
        const fontCache = new Map();

        /**
         * يضمّن/يعيد خطاً مناسباً للنص (عربي ← خط مضمّن، لاتيني ← قياسي أو مضمّن).
         * @returns {{font:object, arabic:boolean, ok:boolean}} — ok=false يعني أن
         * النص العربي **لا يمكن رسمه**؛ على المستدعي تخطّيه لا محاولة رسمه بخط
         * لاتيني (WinAnsi يرمي استثناءً عند أول حرف عربي فيُسقط التصدير كله).
         */
        async function getFont(spec) {
            const arabic = AR.hasArabic(spec.text || '');
            const family = arabic ? (opts.arabicFont || 'Amiri') : (spec.fontFamily || 'Helvetica');
            const bold = !!spec.bold, italic = !!spec.italic;
            const key = (arabic ? 'AR:' : 'LA:') + family + (bold ? 'B' : '') + (italic ? 'I' : '');
            if (fontCache.has(key)) return fontCache.get(key);

            let font, ok = true;
            if (arabic) {
                if (!window.fontkit) {
                    report.warnings.push('مكتبة تضمين الخطوط (fontkit) لم تُحمَّل — تعذّر رسم النص العربي الجديد. تحقّق من الاتصال بالإنترنت وأعد المحاولة.');
                    const res0 = { font: await doc.embedFont(StandardFonts.Helvetica), arabic: true, ok: false };
                    fontCache.set(key, res0);
                    return res0;
                }
                try {
                    const r = await PDFE.libs.loadArabicFont(AR_FONTS[family] ? family : 'Amiri', bold);
                    font = await doc.embedFont(r.bytes, { subset: true });
                    if (r.substituted) report.warnings.push(`الخط «${family}» غير متاح — استُبدل بـ «${r.family}» للنص العربي`);
                } catch (e) {
                    report.warnings.push('تعذّر تحميل أي خط عربي للتضمين — لم يُرسم النص العربي الجديد. تحقّق من الاتصال بالإنترنت ثم أعد الحفظ.');
                    font = await doc.embedFont(StandardFonts.Helvetica);
                    ok = false;
                }
            } else {
                const std = bold && italic ? StandardFonts.HelveticaBoldOblique : bold ? StandardFonts.HelveticaBold
                    : italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica;
                const serif = /times|georgia|serif|roman/i.test(family);
                const mono = /courier|mono/i.test(family);
                const pick = serif ? (bold && italic ? StandardFonts.TimesRomanBoldItalic : bold ? StandardFonts.TimesRomanBold : italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman)
                    : mono ? (bold ? StandardFonts.CourierBold : StandardFonts.Courier) : std;
                font = await doc.embedFont(pick);
            }
            const res = { font, arabic, ok };
            fontCache.set(key, res);
            return res;
        }

        const hex = h => { const c = PDFE.hexToRgb(h); return rgb(c.r / 255, c.g / 255, c.b / 255); };

        // ── 1) جراحة النص: إزالة حقيقية من تدفّق المحتوى ─────────────────────
        // عدد عمليات إظهار النص التي رصدها المحلّل لكل صفحة — مرجع التحقق من
        // أن ترقيمنا يطابق ترقيم pdf.js قبل أن نلمس أي بايت.
        const opCountByPage = new Map(opts.opCounts || []);
        const removeByPage = new Map();       // page → Set(opIndex)
        const coverFallback = [];             // ما فشلت جراحته → تغطية بلون الخلفية
        for (const op of ops) {
            if (op.type === 'text.edit' || op.type === 'text.delete' || op.type === 'redact') {
                // مقطع مدموج ⇒ عدة عمليات؛ إزالة واحدة منها تترك بقية الحروف
                const idxs = (op.opIndexes && op.opIndexes.length) ? op.opIndexes
                    : (op.opIndex != null && op.opIndex >= 0 ? [op.opIndex] : null);
                if (!idxs) { coverFallback.push(op); continue; }
                if (!removeByPage.has(op.page)) removeByPage.set(op.page, new Set());
                idxs.forEach(i => removeByPage.get(op.page).add(i));
            }
        }

        for (const [pageNum, idxSet] of removeByPage) {
            report.surgery.attempted += idxSet.size;
            const page = doc.getPage(pageNum - 1);
            let ok = false;
            try {
                // نجمع العمليات عبر تدفّق الصفحة **وكل Form XObjects** بالترتيب
                // الذي تراه pdf.js، وإلا انزاح الترقيم وفُرِّغت عملية خاطئة.
                const col = CS.collectTextOps(PDFLib, page);
                if (col) {
                    const expected = opCountByPage.get(pageNum);
                    // 🔒 حارس السلامة: إن لم يتطابق العدد فالفهارس غير موثوقة.
                    // محو النص الخطأ أسوأ بكثير من عدم المحو — ننتقل للبديل الآمن.
                    if (expected != null && col.entries.length !== expected) {
                        report.warnings.push(
                            `صفحة ${pageNum}: بنية المستند لا تسمح بالإزالة الدقيقة ` +
                            `(${col.entries.length} عملية مقابل ${expected} عنصر) — استُخدم البديل الآمن حمايةً من حذف نص خاطئ.`);
                    } else {
                        const maxIdx = Math.max(...idxSet);
                        if (maxIdx < col.entries.length) {
                            const res = CS.blankGlobal(col, idxSet);
                            if (res.removed === idxSet.size) {
                                CS.applyWrites(PDFLib, page, res.writes);
                                report.surgery.applied += res.removed;
                                ok = true;
                            }
                        }
                    }
                }
            } catch (e) {
                report.warnings.push('تعذّرت الجراحة في صفحة ' + pageNum + ' — استُخدم البديل الآمن');
            }
            if (!ok) {
                report.surgery.fallback += idxSet.size;
                ops.filter(o => o.page === pageNum &&
                    ((o.opIndexes || []).some(i => idxSet.has(i)) || idxSet.has(o.opIndex)))
                    .forEach(o => coverFallback.push(o));
            }
        }

        // البديل (§50): تغطية بلون الخلفية المعايَن — يبقى المخرَج vector.
        for (const op of coverFallback) {
            const page = doc.getPage(op.page - 1);
            const b = op.box || {};
            if (b.w == null) continue;
            page.drawRectangle({
                x: b.x - 0.6, y: b.y - Math.max(1, (op.fontSize || 10) * 0.24),
                width: b.w + 1.2, height: (op.fontSize || 10) * 1.28,
                color: hex(op.bgColor || '#FFFFFF')
            });
        }

        // التنقيح الآمن (§22): مربّع معتِم فوق موضع النص المُزال — بعد إزالته فعلياً.
        for (const op of ops.filter(o => o.type === 'redact')) {
            const page = doc.getPage(op.page - 1);
            const b = op.box || {};
            if (b.w == null) continue;
            page.drawRectangle({
                x: b.x - 1, y: b.y - Math.max(1, (op.fontSize || 10) * 0.26),
                width: b.w + 2, height: (op.fontSize || 10) * 1.3,
                color: hex(op.fillColor || '#000000')
            });
        }

        // ── 2) رسم النصوص (معدّلة/جديدة) بترتيب بصري صحيح ────────────────────
        /**
         * يرسم نصاً مع دعم كامل للعربية: تقطيع اتجاهي ثم رسم كل مقطع
         * بموضعه المحسوب. fontkit يتكفّل بتشكيل الحروف داخل كل مقطع.
         */
        async function drawText(page, spec) {
            const text = String(spec.text == null ? '' : spec.text);
            if (!text.trim()) return;
            const size = spec.fontSize || 11;
            const color = hex(spec.color || '#000000');
            const runs = AR.visualRuns(text, spec.dir || (AR.hasRTL(text) ? 'rtl' : 'ltr'));

            // قياس كل مقطع بخطّه لتحديد العرض الكلي
            const measured = [];
            let totalW = 0;
            for (const r of runs) {
                const f = await getFont({ text: r.text, fontFamily: spec.fontFamily, bold: spec.bold, italic: spec.italic });
                let w;
                try { w = f.ok ? f.font.widthOfTextAtSize(r.text, size) : r.text.length * size * 0.52; }
                catch (e) { w = r.text.length * size * 0.5; }
                const cs = (spec.charSpacing || 0) * r.text.length;
                measured.push({ run: r, font: f.font, ok: f.ok, w: w + cs });
                totalW += w + cs;
            }

            // المحاذاة داخل الصندوق
            const boxW = spec.boxWidth || totalW;
            let x = spec.x;
            if (spec.align === 'center') x = spec.x + (boxW - totalW) / 2;
            else if (spec.align === 'right') x = spec.x + (boxW - totalW);

            const opacity = spec.opacity == null ? 1 : spec.opacity;
            let anyDrawn = false;
            for (const m of measured) {
                // خط عربي غير متاح ⇒ نتخطّى المقطع بدل رسمه بخط WinAnsi (يرمي ويُسقط التصدير)
                if (!m.ok) report.dropped.push(m.run.text);
                if (m.ok) {
                    try {
                        page.drawText(m.run.text, {
                            x, y: spec.y, size, font: m.font, color, opacity,
                            rotate: spec.angle ? degrees(spec.angle) : undefined
                        });
                        anyDrawn = true;
                    } catch (e) {
                        report.warnings.push('تعذّر رسم نص: ' + trunc(m.run.text));
                    }
                }
                x += m.w;
            }
            if (anyDrawn) report.drawn++;
            else return;   // لا نرسم تسطيراً أو شطباً تحت نص لم يُرسَم

            // التسطير والشطب يُرسمان كخطوط vector
            if (spec.underline) page.drawLine({ start: { x: spec.x, y: spec.y - size * 0.13 }, end: { x: spec.x + totalW, y: spec.y - size * 0.13 }, thickness: Math.max(0.5, size * 0.055), color });
            if (spec.strike) page.drawLine({ start: { x: spec.x, y: spec.y + size * 0.3 }, end: { x: spec.x + totalW, y: spec.y + size * 0.3 }, thickness: Math.max(0.5, size * 0.055), color });
        }

        for (const op of ops) {
            if (op.type !== 'text.edit' && op.type !== 'text.add' && op.type !== 'text.style' && op.type !== 'text.move') continue;
            if (op.type === 'text.edit' && !String(op.newText || '').trim()) continue;   // تعديل لنص فارغ = حذف
            report.requested++;
            const page = doc.getPage(op.page - 1);
            await drawText(page, {
                text: op.newText != null ? op.newText : op.text,
                x: op.x, y: op.y,
                boxWidth: op.boxWidth,
                fontSize: op.fontSize, fontFamily: op.fontFamily,
                bold: op.bold, italic: op.italic, underline: op.underline, strike: op.strike,
                color: op.color, opacity: op.opacity,
                align: op.align, dir: op.dir, angle: op.angle, charSpacing: op.charSpacing
            });
            // خلفية النص (§ تغيير لون الخلفية) — تُرسم قبل النص منطقياً، لكن
            // pdf-lib يرسم بالترتيب؛ لذلك نرسمها هنا فقط عند طلبها صراحةً بمستوى خلفي.
        }

        // ── 3) الأشكال والتعليقات ────────────────────────────────────────────
        for (const op of ops) {
            const page = op.page ? doc.getPage(op.page - 1) : null;
            switch (op.type) {
                case 'shape.add': {
                    const o = { x: op.x, y: op.y, width: op.w, height: op.h, opacity: op.opacity == null ? 1 : op.opacity };
                    if (op.shape === 'line') page.drawLine({ start: { x: op.x, y: op.y }, end: { x: op.x2, y: op.y2 }, thickness: op.lineWidth || 1, color: hex(op.stroke || '#000000'), opacity: o.opacity });
                    else if (op.shape === 'ellipse') page.drawEllipse({ x: op.x + op.w / 2, y: op.y + op.h / 2, xScale: Math.abs(op.w / 2), yScale: Math.abs(op.h / 2), color: op.fill ? hex(op.fill) : undefined, borderColor: hex(op.stroke || '#000000'), borderWidth: op.lineWidth || 1, opacity: o.opacity });
                    else page.drawRectangle(Object.assign(o, { color: op.fill ? hex(op.fill) : undefined, borderColor: hex(op.stroke || '#000000'), borderWidth: op.lineWidth || 1 }));
                    break;
                }
                case 'annot.highlight':
                    page.drawRectangle({ x: op.x, y: op.y, width: op.w, height: op.h, color: hex(op.color || '#FFEB3B'), opacity: op.opacity == null ? 0.42 : op.opacity });
                    break;
                case 'annot.underline':
                    page.drawLine({ start: { x: op.x, y: op.y }, end: { x: op.x + op.w, y: op.y }, thickness: op.lineWidth || 1.1, color: hex(op.color || '#D32F2F') });
                    break;
                case 'annot.strike':
                    page.drawLine({ start: { x: op.x, y: op.y + op.h / 2 }, end: { x: op.x + op.w, y: op.y + op.h / 2 }, thickness: op.lineWidth || 1.1, color: hex(op.color || '#D32F2F') });
                    break;
                case 'annot.comment': {
                    // تعليق مرئي: مربّع ملاحظة + النص (يبقى قابلاً للبحث)
                    const pad = 5, w = op.w || 150;
                    page.drawRectangle({ x: op.x, y: op.y, width: w, height: op.h || 46, color: hex('#FFF9C4'), borderColor: hex('#FBC02D'), borderWidth: 0.8, opacity: 0.96 });
                    await drawText(page, { text: op.text, x: op.x + pad, y: op.y + (op.h || 46) - 13, boxWidth: w - pad * 2, fontSize: 8.5, color: '#5D4037', align: AR.hasRTL(op.text) ? 'right' : 'left' });
                    break;
                }
                case 'annot.link': {
                    const ctxDoc = doc.context;
                    const annot = ctxDoc.obj({
                        Type: 'Annot', Subtype: 'Link',
                        Rect: [op.x, op.y, op.x + op.w, op.y + op.h],
                        Border: [0, 0, op.showBorder ? 1 : 0],
                        A: ctxDoc.obj({ Type: 'Action', S: 'URI', URI: PDFLib.PDFString.of(op.url) })
                    });
                    const arr = page.node.Annots() || ctxDoc.obj([]);
                    arr.push(ctxDoc.register(annot));
                    page.node.set(PDFLib.PDFName.of('Annots'), arr);
                    if (op.showBorder) page.drawRectangle({ x: op.x, y: op.y, width: op.w, height: op.h, borderColor: hex('#1565C0'), borderWidth: 0.7 });
                    break;
                }
                default: break;
            }
        }

        // ── 4) الصور والتواقيع والأختام ورموز QR ─────────────────────────────
        for (const op of ops) {
            if (!['image.add', 'image.replace', 'sign.add', 'stamp.add', 'qr.add', 'watermark'].includes(op.type)) continue;
            if (op.type === 'watermark' && !op.dataUrl) continue;   // العلامة النصية تُعالَج لاحقاً
            try {
                const pages = op.allPages ? doc.getPages() : [doc.getPage(op.page - 1)];
                const img = await embedImage(doc, op.dataUrl);
                if (!img) continue;
                for (const pg of pages) {
                    pg.drawImage(img, {
                        x: op.x, y: op.y, width: op.w, height: op.h,
                        opacity: op.opacity == null ? 1 : op.opacity,
                        rotate: op.rotation ? degrees(op.rotation) : undefined
                    });
                }
            } catch (e) { report.warnings.push('تعذّرت إضافة صورة/ختم: ' + (e.message || '')); }
        }

        // حذف الصور الأصلية: نغطّي موضعها بلون الخلفية (لا يمكن نزع XObject
        // بأمان دون كسر التدفّق — وهذا هو البديل القياسي).
        for (const op of ops.filter(o => o.type === 'image.delete')) {
            const page = doc.getPage(op.page - 1);
            page.drawRectangle({ x: op.x, y: op.y, width: op.w, height: op.h, color: hex(op.bgColor || '#FFFFFF') });
        }

        // ── 5) العلامة المائية النصية (§25) ──────────────────────────────────
        for (const op of ops.filter(o => o.type === 'watermark' && !o.dataUrl)) {
            const targets = op.pages === 'all' ? doc.getPages()
                : op.pages === 'current' ? [doc.getPage(op.page - 1)]
                    : (op.pageList || []).map(n => doc.getPage(n - 1));
            const f0 = await getFont({ text: op.text, fontFamily: op.fontFamily, bold: true });
            for (const pg of targets) {
                const { width, height } = pg.getSize();
                const size = op.fontSize || Math.min(width, height) * 0.13;
                let tw; try { tw = f0.ok ? f0.font.widthOfTextAtSize(op.text, size) : op.text.length * size * 0.52; } catch (e) { tw = op.text.length * size * 0.5; }
                const pos = op.position || 'center';
                const px = pos === 'center' ? (width - tw) / 2 : pos === 'topleft' ? 30 : pos === 'bottomright' ? width - tw - 30 : (width - tw) / 2;
                const py = pos === 'center' ? height / 2 : pos === 'topleft' ? height - 60 : pos === 'bottomright' ? 40 : height / 2;
                const runs = AR.visualRuns(op.text, AR.hasRTL(op.text) ? 'rtl' : 'ltr');
                let cx = px;
                for (const r of runs) {
                    const f = await getFont({ text: r.text, fontFamily: op.fontFamily, bold: true });
                    // محميّ: علامة مائية عربية بلا خط متاح كانت تُسقط التصدير كله
                    if (f.ok) {
                        try {
                            pg.drawText(r.text, {
                                x: cx, y: py, size, font: f.font,
                                color: hex(op.color || '#9E9E9E'),
                                opacity: op.opacity == null ? 0.18 : op.opacity,
                                rotate: degrees(op.rotation == null ? 45 : op.rotation)
                            });
                        } catch (e) { report.warnings.push('تعذّر رسم العلامة المائية: ' + trunc(r.text)); }
                    }
                    try { cx += f.ok ? f.font.widthOfTextAtSize(r.text, size) : r.text.length * size * 0.52; } catch (e) { cx += r.text.length * size * 0.5; }
                }
            }
        }

        // ── 6) عمليات الصفحات (آخر شيء — تغيّر الفهارس) ──────────────────────
        // دمج ملفات خارجية
        for (const op of ops.filter(o => o.type === 'doc.merge')) {
            try {
                const src = await PDFDocument.load(op.bytes, { ignoreEncryption: true });
                const copied = await doc.copyPages(src, src.getPageIndices());
                copied.forEach(p => doc.addPage(p));
            } catch (e) { report.warnings.push('تعذّر دمج الملف ' + (op.name || '') + ': ' + e.message); }
        }
        for (const op of ops.filter(o => o.type === 'page.insert')) {
            const at = Math.max(0, Math.min(doc.getPageCount(), op.at || doc.getPageCount()));
            const p = doc.insertPage(at, op.size || undefined);
            if (op.bgColor) p.drawRectangle({ x: 0, y: 0, width: p.getWidth(), height: p.getHeight(), color: hex(op.bgColor) });
        }
        for (const op of ops.filter(o => o.type === 'page.duplicate')) {
            try {
                const [copy] = await doc.copyPages(doc, [op.page - 1]);
                doc.insertPage(op.page, copy);
            } catch (e) { report.warnings.push('تعذّر تكرار الصفحة ' + op.page); }
        }
        for (const op of ops.filter(o => o.type === 'page.rotate')) {
            try {
                const p = doc.getPage(op.page - 1);
                p.setRotation(degrees(((p.getRotation().angle || 0) + op.deg) % 360));
            } catch (e) { /* صفحة أُزيلت */ }
        }
        for (const op of ops.filter(o => o.type === 'page.crop')) {
            try {
                const p = doc.getPage(op.page - 1);
                p.setCropBox(op.x, op.y, op.w, op.h);
            } catch (e) { report.warnings.push('تعذّر قص الصفحة ' + op.page); }
        }
        // حذف الصفحات (تنازلياً حتى لا تنزاح الفهارس)
        const delPages = ops.filter(o => o.type === 'page.delete').map(o => o.page).sort((a, b) => b - a);
        for (const n of delPages) { try { if (doc.getPageCount() > 1) doc.removePage(n - 1); } catch (e) { /* حُذفت */ } }
        // إعادة الترتيب: آخر عملية ترتيب هي الفعّالة
        const reorder = ops.filter(o => o.type === 'page.reorder').pop();
        if (reorder && Array.isArray(reorder.order)) {
            try {
                const cur = doc.getPages();
                if (reorder.order.length === cur.length) {
                    const wanted = reorder.order.map(n => cur[n - 1]).filter(Boolean);
                    cur.forEach(() => doc.removePage(0));
                    wanted.forEach(p => doc.addPage(p));
                }
            } catch (e) { report.warnings.push('تعذّرت إعادة ترتيب الصفحات'); }
        }
        // استخراج صفحات محدّدة فقط
        const extract = ops.filter(o => o.type === 'page.extract').pop();
        if (extract && Array.isArray(extract.pages) && extract.pages.length) {
            const keep = new Set(extract.pages);
            for (let i = doc.getPageCount(); i >= 1; i--) if (!keep.has(i)) { try { doc.removePage(i - 1); } catch (e) { /* تجاهل */ } }
        }

        // ── 7) البيانات الوصفية (§32) ────────────────────────────────────────
        const meta = ops.filter(o => o.type === 'doc.meta').pop();
        try {
            doc.setProducer('نظام حساب الأستاذ — GBR · محرر PDF الاحترافي');
            doc.setModificationDate(new Date());
            if (meta) {
                if (meta.title != null) doc.setTitle(meta.title);
                if (meta.author != null) doc.setAuthor(meta.author);
                if (meta.subject != null) doc.setSubject(meta.subject);
                if (meta.keywords != null) doc.setKeywords(String(meta.keywords).split(/[,،]\s*/).filter(Boolean));
                if (meta.creator != null) doc.setCreator(meta.creator);
            }
        } catch (e) { /* بعض الملفات لا تقبل تعديل الوصف */ }

        // ── 8) الحفظ ─────────────────────────────────────────────────────────
        const out = await doc.save({
            useObjectStreams: opts.compress !== false,      // ضغط PDF (§ ضغط)
            addDefaultPage: false
        });
        return { bytes: out, report };
    };

    /** يضمّن صورة من data URL بالكشف التلقائي للنوع. */
    async function embedImage(doc, dataUrl) {
        if (!dataUrl) return null;
        const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl);
        if (!m) return null;
        let type = m[1].toLowerCase();
        let payload = dataUrl;
        if (type === 'webp') { payload = await webpToPng(dataUrl); type = 'png'; }
        return type === 'png' ? doc.embedPng(payload) : doc.embedJpg(payload);
    }

    function webpToPng(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                c.getContext('2d').drawImage(img, 0, 0);
                resolve(c.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('تعذّر تحويل الصورة'));
            img.src = dataUrl;
        });
    }
    PDFE.embedImage = embedImage;

    /**
     * التحقق النهائي قبل التسليم (§55) + التحقق من نجاح الجراحة (§50).
     * إن ثبت بقاء نص كان يجب إزالته، يُبلَّغ المستدعي ليعيد البناء بالبديل الآمن.
     */
    X.validate = async function (bytes, expect) {
        const result = { ok: true, pages: 0, textSearchable: false, errors: [], warnings: [], leaked: [] };
        try {
            const lib = PDFE.libs.ensurePdfJs();
            const pdf = await lib.getDocument({ data: bytes.slice(0) }).promise;
            result.pages = pdf.numPages;
            if (expect && expect.pageCount && expect.pageCount !== pdf.numPages) {
                result.warnings.push(`عدد الصفحات ${pdf.numPages} بدل المتوقّع ${expect.pageCount}`);
            }
            let all = '';
            const scan = Math.min(pdf.numPages, 25);
            for (let n = 1; n <= scan; n++) {
                const pg = await pdf.getPage(n);
                const tc = await pg.getTextContent();
                all += tc.items.map(i => i.str).join(' ') + '\n';
            }
            result.textSearchable = all.replace(/\s/g, '').length > 0;
            // هل تسرّب نص كان يجب حذفه/تنقيحه؟
            if (expect && expect.mustNotContain) {
                const norm = all.replace(/\s+/g, ' ');
                for (const s of expect.mustNotContain) {
                    const t = String(s || '').replace(/\s+/g, ' ').trim();
                    if (t.length >= 3 && norm.includes(t)) result.leaked.push(t);
                }
                if (result.leaked.length) {
                    result.ok = false;
                    result.errors.push(`لم تُزَل ${result.leaked.length} قطعة نصية من بنية الملف`);
                }
            }
            await pdf.destroy();
        } catch (e) {
            result.ok = false;
            result.errors.push('الملف الناتج لا يُفتح: ' + (e.message || ''));
        }
        return result;
    };

    /**
     * تصدير كامل مع الشبكة الأمانية:
     * يبني، يتحقّق، وإن تسرّب نص أعاد البناء مجبراً البديل الآمن (تغطية).
     */
    X.buildSafe = async function (ctx, ops, opts) {
        opts = opts || {};
        let r = await X.build(ctx, ops.slice(), opts);
        const mustNot = ops.filter(o => o.type === 'redact' || o.type === 'text.delete' || o.type === 'text.edit')
            .map(o => o.oldText).filter(t => t && String(t).trim().length >= 3);
        const v = await X.validate(r.bytes, { mustNot: null, mustNotContain: mustNot, pageCount: opts.expectPages });

        if (!v.ok && v.leaked.length) {
            // الجراحة لم تصب الهدف — نعيد البناء بإجبار البديل (opIndex = -1)
            const forced = ops.map(o => (o.type === 'redact' || o.type === 'text.delete' || o.type === 'text.edit')
                ? Object.assign({}, o, { opIndex: -1, opIndexes: null }) : o);
            r = await X.build(ctx, forced, opts);
            r.report.surgery.fallback += v.leaked.length;
            r.report.warnings.push('تعذّرت الإزالة من بنية الملف لبعض النصوص — طُبّق البديل الآمن (تغطية بلون الخلفية). النص المُغطّى قد يبقى قابلاً للاستخراج؛ للتنقيح القانوني الكامل استخدم «تسطيح الصفحة».');
            r.validation = await X.validate(r.bytes, { pageCount: opts.expectPages });
            r.validation.degraded = true;
        } else {
            r.validation = v;
        }

        // ── حاجز الأمان: لا نُسلّم ملفاً ابتلع عمل المستخدم بصمت ──────────────
        // كان التصدير ينجح ظاهرياً بينما تُسقَط النصوص التي تعذّر رسمها (خط عربي
        // لم يُحمَّل مثلاً)، فيحصل المستخدم على ملف بلا تعديلاته وبلا أي إشعار.
        // الآن نرفع خطأً واضحاً يذكر ما سقط بالضبط وسببه المرجّح.
        if (r.report.dropped.length) {
            const sample = r.report.dropped.slice(0, 3).map(t => '«' + trunc(t) + '»').join(' · ');
            const err = new Error(
                `تعذّر كتابة ${r.report.dropped.length} نص في الملف الناتج (${sample}) — لم يُحفظ التصدير حمايةً لعملك.\n\n` +
                'السبب الأرجح: تعذّر تحميل الخط العربي المطلوب لتضمينه في الملف. ' +
                'تحقّق من الاتصال بالإنترنت (أو من مانع الإعلانات إن كان يحجب cdn.jsdelivr.net) ثم أعد المحاولة.'
            );
            err.code = 'DROPPED_TEXT';
            err.dropped = r.report.dropped;
            err.report = r.report;
            throw err;
        }
        return r;
    };

    /** يبني قائمة تغييرات للمقارنة بين نسختين (§39). */
    X.diffOps = function (opsA, opsB) {
        const key = o => o.type + '|' + (o.page || '') + '|' + (o.id || '');
        const A = new Map(opsA.map(o => [key(o), o]));
        const B = new Map(opsB.map(o => [key(o), o]));
        const added = [], removed = [];
        B.forEach((v, k) => { if (!A.has(k)) added.push(v); });
        A.forEach((v, k) => { if (!B.has(k)) removed.push(v); });
        return { added, removed };
    };

    console.log('✅ PDF Editor Engine [PE] v' + PDFE.VERSION + ' build ' + PDFE.BUILD + ' loaded — pdf.js + pdf-lib · engine=' + E.current);
})();
