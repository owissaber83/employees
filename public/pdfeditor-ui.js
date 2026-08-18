// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║   📄 Professional PDF Editor — الهيكل والعرض (UI Shell & Render Layer)         ║
// ║   ────────────────────────────────────────────────────────────────────────    ║
// ║   [UI-STATE] حالة المحرر المشتركة (window.PDE)                                 ║
// ║   [UI-LIB]   شاشة المكتبة: المستندات المحفوظة · الرفع · الفتح من النظام         ║
// ║   [UI-OPEN]  فتح المستند: كلمة المرور · التحليل · كشف الممسوح ضوئياً            ║
// ║   [UI-SHELL] هيكل مساحة العمل: شريط علوي · أدوات · ثلاث لوحات · شريط حالة       ║
// ║   [UI-RENDER] العرض الافتراضي (Virtualized) — صفحات عند الحاجة فقط              ║
// ║   [UI-LAYER] طبقة العناصر فوق اللوحة: نصوص · صور · أشكال                       ║
// ║   [UI-THUMB] الصفحات المصغّرة + السحب والإفلات لإعادة الترتيب                   ║
// ║   [UI-ZOOM]  التكبير والملاءمة والتنقل                                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
/* global PDFE */

(function () {
    'use strict';

    const esc = window.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const $ = id => document.getElementById(id);

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-STATE] حالة المحرر
    // ═══════════════════════════════════════════════════════════════════════════
    const PDE = window.PDE = {
        ctx: null,              // سياق المحرك (pdf.js document + bytes)
        analysis: null,         // نتيجة التحليل الكامل
        design: null,           // نظام تصميم المستند
        doc: null,              // وصف المستند المحفوظ { id, name, url, link… }
        history: null,          // PDFE.History
        scale: 1.25,
        page: 1,                // الصفحة الظاهرة حالياً
        tool: 'select',
        selection: null,        // { kind:'text'|'image'|'object'|'page', item, el }
        clipStyle: null,        // حافظة النمط (Copy Style)
        clipText: null,
        rendered: new Set(),    // صفحات مرسومة فعلاً
        canvases: new Map(),    // n → canvas
        pageEls: new Map(),     // n → wrapper
        objects: [],            // كائنات مضافة (نصوص/صور/أشكال) كطبقات
        pageOrder: [],          // ترتيب الصفحات الحالي (أرقام أصلية)
        deletedPages: new Set(),
        pageRotation: new Map(),// n → درجة إضافية
        dirty: false,
        busy: false,
        showTextLayer: true,
        searchHits: [],
        searchIdx: -1,
        ocrPages: new Map(),    // n → عناصر OCR
        _autoSaveTimer: null
    };

    const CAN_EDIT = () => (typeof window.can === 'function' ? window.can('pdf_editor_edit') || window.can('pdf_editor') : true);
    const CAN_VIEW = () => (typeof window.can === 'function' ? window.can('pdf_editor') : true);
    PDE.canEdit = CAN_EDIT;
    PDE.canView = CAN_VIEW;

    const toast = (m, t, d) => (window.toast ? window.toast(m, t, d) : console.log(m));
    PDE.toast = toast;

    /** يعرض/يخفي طبقة الانشغال مع رسالة. */
    PDE.busyOn = function (msg) {
        PDE.busy = true;
        let el = $('pdeBusy');
        if (!el) {
            el = document.createElement('div');
            el.id = 'pdeBusy';
            el.className = 'pde-busy';
            document.body.appendChild(el);
        }
        el.innerHTML = `<div class="pde-busy-box"><div class="pde-spin"></div><div id="pdeBusyMsg">${esc(msg || 'جارٍ العمل…')}</div><div class="pde-busy-bar"><i id="pdeBusyBar"></i></div></div>`;
        el.classList.add('show');
    };
    PDE.busyMsg = function (msg, pct) {
        const m = $('pdeBusyMsg'); if (m) m.textContent = msg;
        const b = $('pdeBusyBar'); if (b && pct != null) b.style.width = Math.max(0, Math.min(100, pct * 100)) + '%';
    };
    PDE.busyOff = function () { PDE.busy = false; const el = $('pdeBusy'); if (el) el.classList.remove('show'); };

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-LIB] شاشة المكتبة
    // ═══════════════════════════════════════════════════════════════════════════

    /** نقطة الدخول — يستدعيها nav() عند فتح صفحة المحرر. */
    window.renderPdfEditor = function () {
        const pg = $('pg-pdfeditor');
        if (!pg) return;
        if (!CAN_VIEW()) { pg.innerHTML = '<div class="empty"><div class="ei">🚫</div><p>لا تملك صلاحية الوصول إلى محرر PDF</p></div>'; return; }
        if (PDE.ctx) { showWorkspace(); return; }
        renderLibrary();
    };

    function renderLibrary() {
        const pg = $('pg-pdfeditor');
        const docs = Object.entries(window.pdfDocs || {})
            .sort((a, b) => (b[1].updatedAt || b[1].createdAt || 0) - (a[1].updatedAt || a[1].createdAt || 0));
        const store = PDFE.Storage.adapter();
        const storeOk = store.available();

        pg.innerHTML = `
        <div id="pdeLibrary">
            <div class="card pde-hero">
                <div class="pde-hero-txt">
                    <h2>📄 محرر PDF الاحترافي</h2>
                    <p>افتح أي مستند PDF — فاتورة، عقد، مستخلص، أمر شراء — وحرّر نصوصه وصوره وصفحاته مباشرة، مع الحفاظ على بنية الملف الأصلية وقابلية البحث والنسخ.</p>
                    <div class="pde-hero-tags">
                        <span>✏️ تحرير نص حقيقي</span><span>🎨 كشف الخطوط والألوان</span><span>🔤 دعم عربي RTL كامل</span>
                        <span>🖼️ تحرير الصور</span><span>📑 إدارة الصفحات</span><span>🔒 تنقيح آمن</span><span>🕵️ سجل تدقيق</span>
                    </div>
                </div>
                <div class="pde-hero-drop" id="pdeDrop">
                    <div class="pde-drop-ic">📥</div>
                    <div class="pde-drop-t">اسحب ملف PDF هنا</div>
                    <div class="pde-drop-s">أو</div>
                    <button class="btn b-g" onclick="document.getElementById('pdeFileInput').click()">📂 اختر ملفاً</button>
                    <input type="file" id="pdeFileInput" accept="application/pdf,.pdf" style="display:none" onchange="pdeHandleFileInput(this)">
                    <div class="pde-drop-or">
                        <input type="url" id="pdeUrlInput" placeholder="أو الصق رابط ملف PDF…" dir="ltr">
                        <button class="btn b-b" onclick="pdeOpenFromUrlInput()">فتح</button>
                    </div>
                </div>
            </div>

            ${storeOk ? '' : `<div class="pde-warn">⚠️ <b>التخزين غير مهيّأ</b> — يمكنك التحرير والتنزيل الآن، لكن الحفظ داخل النظام معطّل. ${esc(store.hint)}</div>`}

            <div class="card">
                <div class="tlb">
                    <div class="c-tl" style="margin:0;border:none;padding:0">🗂️ مستنداتي <span class="badge">${docs.length}</span></div>
                    <input type="text" id="pdeLibSearch" placeholder="🔍 ابحث بالاسم أو النوع…" oninput="pdeFilterLibrary()" class="pde-inp" style="max-width:280px">
                </div>
                ${docs.length === 0
                ? '<div class="empty"><div class="ei">📄</div><p>لا مستندات بعد — ارفع ملف PDF للبدء</p></div>'
                : `<div class="pde-grid" id="pdeLibGrid">${docs.map(([k, d]) => libCard(k, d)).join('')}</div>`}
            </div>
        </div>
        <div id="pdeWorkspace" style="display:none"></div>`;

        setupDropZone();
    }

    function libCard(key, d) {
        const vers = Object.keys((window.pdfVersions || {})[key] || {}).length;
        const link = d.linkType ? `<span class="pde-chip">${esc(d.linkLabel || d.linkType)}</span>` : '';
        return `<div class="pde-card" data-name="${esc((d.name || '') + ' ' + (d.docType || ''))}">
            <div class="pde-card-top" onclick="pdeOpenSaved('${esc(key)}')">
                <div class="pde-card-ic">📄</div>
                <div class="pde-card-badges">${d.pages ? `<span>${d.pages} صفحة</span>` : ''}${vers ? `<span>v${vers}</span>` : ''}</div>
            </div>
            <div class="pde-card-body">
                <div class="pde-card-name" title="${esc(d.name || '')}">${esc(d.name || 'مستند')}</div>
                <div class="pde-card-meta">${esc(d.docType || 'مستند عام')}${link}</div>
                <div class="pde-card-sub">${d.updatedAt ? new Date(d.updatedAt).toLocaleString('ar-EG') : ''}</div>
                <div class="pde-card-acts">
                    <button class="btn b-b" onclick="pdeOpenSaved('${esc(key)}')">✏️ فتح</button>
                    <button class="btn" onclick="pdeShowVersions('${esc(key)}')" title="سجل النُّسخ">🕘</button>
                    ${CAN_EDIT() ? `<button class="btn b-r" onclick="pdeDeleteDoc('${esc(key)}')" title="حذف">🗑️</button>` : ''}
                </div>
            </div>
        </div>`;
    }

    window.pdeFilterLibrary = function () {
        const q = ($('pdeLibSearch').value || '').trim().toLowerCase();
        document.querySelectorAll('#pdeLibGrid .pde-card').forEach(c => {
            c.style.display = !q || (c.dataset.name || '').toLowerCase().includes(q) ? '' : 'none';
        });
    };

    function setupDropZone() {
        const dz = $('pdeDrop'); if (!dz) return;
        ['dragenter', 'dragover'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add('over'); }));
        ['dragleave', 'drop'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.remove('over'); }));
        dz.addEventListener('drop', ev => {
            const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
            if (f) openLocalFile(f);
        });
    }

    window.pdeHandleFileInput = function (input) {
        const f = input.files && input.files[0];
        input.value = '';
        if (f) openLocalFile(f);
    };

    window.pdeOpenFromUrlInput = function () {
        const u = ($('pdeUrlInput').value || '').trim();
        if (!u) { toast('الصق رابط ملف PDF أولاً', 'er'); return; }
        PDE.openUrl(u, { name: decodeURIComponent(u.split('/').pop().split('?')[0]) || 'مستند.pdf' });
    };

    window.pdeOpenSaved = async function (key) {
        const d = (window.pdfDocs || {})[key];
        if (!d) { toast('المستند غير موجود', 'er'); return; }
        // نفتح آخر نسخة إن وُجدت، وإلا الأصل
        const vers = Object.entries((window.pdfVersions || {})[key] || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
        const url = vers.length ? vers[0][1].url : d.url;
        PDE.openUrl(url, Object.assign({}, d, { id: key }));
    };

    window.pdeDeleteDoc = async function (key) {
        const d = (window.pdfDocs || {})[key] || {};
        if (!confirm(`حذف «${d.name || 'المستند'}» وكل نُسخه من النظام؟\n\nالملف نفسه يبقى على خادم التخزين، لكن يختفي من المكتبة.`)) return;
        try {
            await PDFE.Storage.deleteDoc(key);
            await PDFE.Audit.log('حذف مستند PDF', `حُذف «${d.name || ''}» من مكتبة محرر PDF`, { docId: key });
            toast('✅ حُذف المستند', 'ok');
            renderLibrary();
        } catch (e) { toast('تعذّر الحذف: ' + e.message, 'er', 6000); }
    };

    async function openLocalFile(file) {
        if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
            toast('⚠️ الملف ليس PDF — اختر ملفاً بامتداد .pdf', 'er', 5000); return;
        }
        if (file.size > 60 * 1024 * 1024) {
            if (!confirm('الملف كبير (' + (file.size / 1048576).toFixed(1) + ' م.ب) وقد يبطئ المتصفح. المتابعة؟')) return;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        PDE.open(bytes, { name: file.name, size: file.size, localOnly: true });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-OPEN] فتح المستند
    // ═══════════════════════════════════════════════════════════════════════════

    PDE.openUrl = async function (url, meta) {
        PDE.busyOn('جارٍ تحميل الملف…');
        try {
            const bytes = await PDFE.Storage.fetchBytes(url);
            await PDE.open(bytes, Object.assign({ url }, meta || {}));
        } catch (e) {
            PDE.busyOff();
            toast('❌ ' + e.message, 'er', 7000);
        }
    };

    /**
     * يفتح مستنداً من بايتات: يحاول التحميل، يطلب كلمة المرور إن لزم،
     * ثم يحلّل ويبني مساحة العمل.
     */
    PDE.open = async function (bytes, meta, password) {
        meta = meta || {};
        PDE.busyOn('جارٍ فتح المستند…');
        const engine = PDFE.Engine.get();
        let ctx;
        try {
            ctx = await engine.load(bytes, { password });
        } catch (e) {
            PDE.busyOff();
            if (e.code === 'PASSWORD') {
                const pw = prompt(e.message + '\n\nأدخل كلمة مرور فتح الملف:');
                if (pw) return PDE.open(bytes, meta, pw);
                return;
            }
            toast('❌ ' + e.message, 'er', 8000);
            return;
        }

        try {
            PDE.busyMsg('جارٍ تحليل المستند…', 0.05);
            const analysis = await engine.analyze(ctx, {
                eagerPages: ctx.numPages > 60 ? 12 : ctx.numPages,
                onProgress: (n, eager) => PDE.busyMsg(`تحليل الصفحة ${n} من ${eager}…`, 0.05 + 0.8 * (n / eager))
            });

            PDE.ctx = ctx;
            PDE.analysis = analysis;
            PDE.design = PDFE.Style.buildDesignSystem(analysis);
            PDE.doc = Object.assign({ name: 'مستند.pdf' }, meta);
            PDE.history = new PDFE.History(400);
            PDE.history.onChange = () => { PDE.dirty = PDE.history.canUndo(); refreshUndoBtns(); };
            PDE.scale = 1.25;
            PDE.page = 1;
            // الأداة الافتراضية = «تحرير نص»: الغرض الأول من فتح المستند هو تعديل
            // نصوصه، فنقرة واحدة تفتح التحرير مباشرةً بلا خطوة تحديد وسيطة.
            PDE.tool = 'text';
            PDE.selection = null;
            PDE.objects = [];
            PDE.rendered.clear(); PDE.canvases.clear(); PDE.pageEls.clear();
            PDE.pageOrder = Array.from({ length: ctx.numPages }, (_, i) => i + 1);
            PDE.deletedPages.clear(); PDE.pageRotation.clear(); PDE.ocrPages.clear();
            PDE.dirty = false;

            PDE.busyMsg('جارٍ بناء المحرر…', 0.9);
            buildWorkspace();
            PDE.busyOff();

            const scanned = analysis.pages.filter(p => p && p.isScanned).length;
            if (scanned) {
                setTimeout(() => showScannedBanner(scanned), 400);
            }
            // تحقّق مبكر من جاهزية الخط العربي — لا ننتظر التصدير ليكتشف المستخدم العطل
            checkArabicReadiness();
            PDFE.Audit.log('فتح مستند PDF', `فُتح «${PDE.doc.name}» (${ctx.numPages} صفحة) في المحرر`, { docId: PDE.doc.id || null });
        } catch (e) {
            PDE.busyOff();
            console.error(e);
            toast('❌ تعذّر تحليل المستند: ' + (e.message || ''), 'er', 8000);
        }
    };

    /**
     * يفحص جاهزية كتابة العربية فور فتح المستند ويحذّر بوضوح إن تعذّرت،
     * بدل ترك المستخدم يحرّر ثم يفاجأ بتصدير ناقص.
     */
    async function checkArabicReadiness() {
        try {
            const r = await PDFE.libs.checkArabicReady(PDE.arabicFont || 'Amiri');
            PDE.arabicReady = r.ok;
            if (r.ok) { PDE.status('✅ جاهز — خط العربية «' + r.family + '» مُحمَّل للتضمين'); return; }
            const bar = $('pdeArabicBanner');
            if (!bar) return;
            bar.style.display = 'flex';
            bar.innerHTML = `<span>⛔ <b>تحرير النصوص العربية غير جاهز</b> — ${esc(r.reason)}
                <br>يمكنك التحرير الآن، لكن <b>لن يُحفظ أي نص عربي جديد في الملف المصدَّر</b> حتى يُحلّ هذا.</span>
                <span style="flex:1"></span>
                <button class="btn b-g" onclick="pdeRetryArabic()">🔄 إعادة المحاولة</button>
                <button class="btn" onclick="this.parentElement.style.display='none'">✕</button>`;
        } catch (e) { /* الفحص مساعِد فقط */ }
    }
    PDE.checkArabicReadiness = checkArabicReadiness;

    window.pdeRetryArabic = function () {
        const bar = $('pdeArabicBanner'); if (bar) bar.style.display = 'none';
        toast('🔄 جارٍ إعادة محاولة تحميل الخط العربي…', 'ok');
        checkArabicReadiness().then(() => { if (PDE.arabicReady) toast('✅ جاهز — يمكنك تحرير النصوص العربية', 'ok', 5000); });
    };

    function showScannedBanner(count) {
        const bar = $('pdeScanBanner');
        if (!bar) return;
        bar.style.display = 'flex';
        bar.innerHTML = `<span>🖨️ <b>مستند ممسوح ضوئياً</b> — ${count} صفحة بلا نص قابل للتحرير. شغّل القراءة الضوئية لتحويلها إلى نص قابل للتعديل.</span>
            <span style="flex:1"></span>
            <button class="btn b-g" onclick="pdeRunOCR()">🔍 تفعيل تحرير OCR</button>
            <button class="btn" onclick="this.parentElement.style.display='none'">✕</button>`;
    }

    /** يغلق المستند ويعود للمكتبة. */
    window.pdeCloseDoc = function () {
        if (PDE.dirty && !confirm('هناك تعديلات غير محفوظة. الخروج بدون حفظ؟')) return;
        try { if (PDE.ctx && PDE.ctx.pdf) PDE.ctx.pdf.destroy(); } catch (e) { /* مغلق مسبقاً */ }
        PDE.ctx = null; PDE.analysis = null; PDE.doc = null; PDE.history = null;
        PDE.rendered.clear(); PDE.canvases.clear(); PDE.pageEls.clear();
        clearInterval(PDE._autoSaveTimer);
        renderLibrary();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-SHELL] هيكل مساحة العمل
    // ═══════════════════════════════════════════════════════════════════════════

    function showWorkspace() { $('pdeLibrary').style.display = 'none'; $('pdeWorkspace').style.display = ''; }

    function buildWorkspace() {
        const lib = $('pdeLibrary'); if (lib) lib.style.display = 'none';
        const ws = $('pdeWorkspace');
        ws.style.display = '';
        ws.innerHTML = `
        <div class="pde-app" id="pdeApp">
            <div class="pde-topbar">
                <button class="pde-tb-btn" onclick="pdeCloseDoc()" title="رجوع للمكتبة">↩︎</button>
                <div class="pde-title" title="${esc(PDE.doc.name)}">📄 ${esc(PDE.doc.name)}</div>
                <span class="pde-dot" id="pdeDirtyDot" title="تعديلات غير محفوظة"></span>
                <div class="pde-tb-sep"></div>
                <button class="pde-tb-btn" id="pdeUndoBtn" onclick="pdeUndo()" title="تراجع (Ctrl+Z)" disabled>↶</button>
                <button class="pde-tb-btn" id="pdeRedoBtn" onclick="pdeRedo()" title="إعادة (Ctrl+Y)" disabled>↷</button>
                <div class="pde-tb-sep"></div>
                <button class="pde-tb-btn" onclick="pdeToggleSearch()" title="بحث واستبدال (Ctrl+F)">🔍</button>
                <button class="pde-tb-btn" onclick="pdeAnalyzeDialog()" title="تحليل المستند">📊</button>
                <span style="flex:1"></span>
                <button class="btn b-b" onclick="pdeDownload()" title="تنزيل نسخة (Ctrl+S)">⬇️ تنزيل</button>
                <button class="btn b-g" onclick="pdeSaveToSystem()" title="حفظ نسخة داخل النظام">💾 حفظ في النظام</button>
                <button class="pde-tb-btn" onclick="pdeExportMenu()" title="تصدير وطباعة">⋯</button>
            </div>

            <div class="pde-tools" id="pdeTools">${toolbarHTML()}</div>

            <div class="pde-banner pde-banner-err" id="pdeArabicBanner" style="display:none"></div>
            <div class="pde-banner" id="pdeScanBanner" style="display:none"></div>
            <div class="pde-searchbar" id="pdeSearchBar" style="display:none"></div>

            <div class="pde-body">
                <aside class="pde-left" id="pdeThumbs"></aside>
                <main class="pde-center" id="pdeCanvasWrap"><div class="pde-pages" id="pdePages"></div></main>
                <aside class="pde-right" id="pdeInspector"></aside>
            </div>

            <div class="pde-status">
                <button class="pde-tb-btn" onclick="pdeGoPage(PDE.page-1)" title="السابق">▶</button>
                <span class="pde-status-pg">صفحة <input id="pdePageNum" type="number" min="1" value="1" onchange="pdeGoPage(+this.value)"> / <b id="pdePageTotal">${PDE.ctx.numPages}</b></span>
                <button class="pde-tb-btn" onclick="pdeGoPage(PDE.page+1)" title="التالي">◀</button>
                <span style="flex:1"></span>
                <span id="pdeStatusMsg" class="pde-status-msg"></span>
                <span style="flex:1"></span>
                <button class="pde-tb-btn" onclick="pdeZoom(-1)">−</button>
                <span class="pde-zoom" id="pdeZoomLbl">125%</span>
                <button class="pde-tb-btn" onclick="pdeZoom(1)">+</button>
                <button class="pde-tb-btn" onclick="pdeFit('width')" title="ملاءمة العرض">↔</button>
                <button class="pde-tb-btn" onclick="pdeFit('page')" title="ملاءمة الصفحة">⛶</button>
                <label class="pde-toggle" title="إظهار طبقة النص القابلة للتحرير"><input type="checkbox" id="pdeTextLayerTgl" checked onchange="pdeToggleTextLayer(this.checked)"> طبقة النص</label>
                <span class="pde-build" title="رقم بناء المحرر — إن لم يطابق آخر نسخة فالمتصفح يعرض نسخة مخزّنة (Ctrl+Shift+R)">⚙︎ ${esc(PDFE.BUILD)}</span>
            </div>
        </div>`;

        buildPageSlots();
        if (typeof window.pdeSetTool === 'function') window.pdeSetTool(PDE.canEdit() ? 'text' : 'select');
        window.pdeRenderThumbs();
        window.pdeRenderInspector();
        attachScrollVirtualizer();
        renderVisiblePages();
        window.pdeBindShortcuts();
        startAutoSave();
    }

    function toolbarHTML() {
        const T = [
            ['select', '🖱️', 'تحديد'],
            ['text', '✏️', 'تحرير نص'],
            ['addtext', '🆕', 'إضافة نص'],
            ['image', '🖼️', 'صورة'],
            ['shape', '⬜', 'شكل'],
            ['line', '📏', 'خط'],
            null,
            ['highlight', '🖍️', 'تظليل'],
            ['underline', '⎁', 'تسطير'],
            ['strike', '⎀', 'شطب'],
            ['comment', '💬', 'تعليق'],
            ['link', '🔗', 'رابط'],
            null,
            ['sign', '✍️', 'توقيع'],
            ['stamp', '🏷️', 'ختم'],
            ['watermark', '💧', 'علامة مائية'],
            ['qr', '▦', 'رمز QR'],
            null,
            ['redact', '🔒', 'تنقيح آمن'],
            ['eyedrop', '💉', 'قطّارة لون'],
            null,
            ['pages', '📑', 'إدارة الصفحات'],
            ['merge', '🔗', 'دمج ملف']
        ];
        const dis = CAN_EDIT() ? '' : 'disabled title="لا تملك صلاحية التحرير"';
        return T.map(t => t === null ? '<div class="pde-tb-sep"></div>'
            : `<button class="pde-tool ${t[0] === 'text' ? 'act' : ''}" data-tool="${t[0]}" onclick="pdeSetTool('${t[0]}')" title="${esc(t[2])}" ${t[0] === 'select' ? '' : dis}><span>${t[1]}</span><i>${esc(t[2])}</i></button>`).join('');
    }

    function refreshUndoBtns() {
        const u = $('pdeUndoBtn'), r = $('pdeRedoBtn'), d = $('pdeDirtyDot');
        if (u) u.disabled = !PDE.history.canUndo();
        if (r) r.disabled = !PDE.history.canRedo();
        if (d) d.classList.toggle('on', PDE.dirty);
    }
    PDE.refreshUndoBtns = refreshUndoBtns;

    PDE.status = function (msg) { const s = $('pdeStatusMsg'); if (s) s.textContent = msg || ''; };

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-RENDER] العرض الافتراضي
    // ───────────────────────────────────────────────────────────────────────────
    // نُنشئ «مقاعد» فارغة بأبعاد كل صفحة فوراً (فيبقى شريط التمرير صحيحاً)،
    // ولا نرسم إلا الصفحات القريبة من نافذة العرض. يجعل ملف 500 صفحة يفتح فوراً.
    // ═══════════════════════════════════════════════════════════════════════════

    function buildPageSlots() {
        const host = $('pdePages');
        host.innerHTML = '';
        PDE.pageEls.clear();
        for (const n of PDE.pageOrder) {
            if (PDE.deletedPages.has(n)) continue;
            const a = PDE.analysis.pages[n - 1];
            const w = a ? a.width : 595, h = a ? a.height : 842;
            const wrap = document.createElement('div');
            wrap.className = 'pde-page';
            wrap.dataset.page = n;
            wrap.style.width = Math.round(w * PDE.scale) + 'px';
            wrap.style.height = Math.round(h * PDE.scale) + 'px';
            wrap.innerHTML = `<div class="pde-page-ph">صفحة ${n}</div>`;
            host.appendChild(wrap);
            PDE.pageEls.set(n, wrap);
        }
    }
    PDE.buildPageSlots = buildPageSlots;

    function attachScrollVirtualizer() {
        const wrap = $('pdeCanvasWrap');
        let t = null;
        wrap.addEventListener('scroll', () => {
            clearTimeout(t);
            t = setTimeout(() => { renderVisiblePages(); trackCurrentPage(); }, 90);
        }, { passive: true });
    }

    function trackCurrentPage() {
        const wrap = $('pdeCanvasWrap');
        const mid = wrap.scrollTop + wrap.clientHeight / 2;
        let cur = PDE.page;
        for (const [n, el] of PDE.pageEls) {
            if (el.offsetTop <= mid && el.offsetTop + el.offsetHeight >= mid) { cur = n; break; }
        }
        if (cur !== PDE.page) {
            PDE.page = cur;
            const inp = $('pdePageNum'); if (inp) inp.value = cur;
            document.querySelectorAll('.pde-thumb').forEach(t => t.classList.toggle('act', +t.dataset.page === cur));
        }
    }

    async function renderVisiblePages() {
        const wrap = $('pdeCanvasWrap'); if (!wrap) return;
        const top = wrap.scrollTop - wrap.clientHeight;
        const bot = wrap.scrollTop + wrap.clientHeight * 2;
        for (const [n, el] of PDE.pageEls) {
            const visible = el.offsetTop + el.offsetHeight >= top && el.offsetTop <= bot;
            if (visible && !PDE.rendered.has(n)) await renderPage(n);
            else if (!visible && PDE.rendered.has(n) && PDE.pageEls.size > 8) unloadPage(n);
        }
    }
    PDE.renderVisiblePages = renderVisiblePages;

    /** يفرّغ لوحة صفحة بعيدة عن العرض لتحرير الذاكرة (ملفات 100+ صفحة). */
    function unloadPage(n) {
        const el = PDE.pageEls.get(n); if (!el) return;
        const a = PDE.analysis.pages[n - 1];
        el.innerHTML = `<div class="pde-page-ph">صفحة ${n}</div>`;
        el.style.height = Math.round((a ? a.height : 842) * PDE.scale) + 'px';
        PDE.rendered.delete(n);
        PDE.canvases.delete(n);
    }

    /** يرسم صفحة كاملة: لوحة + طبقة العناصر. */
    async function renderPage(n) {
        const el = PDE.pageEls.get(n); if (!el) return;
        PDE.rendered.add(n);
        const a = await PDFE.Parser.ensurePage(PDE.analysis, n);
        el.innerHTML = '';
        el.style.width = Math.round(a.width * PDE.scale) + 'px';
        el.style.height = Math.round(a.height * PDE.scale) + 'px';

        const canvas = document.createElement('canvas');
        canvas.className = 'pde-canvas';
        el.appendChild(canvas);
        PDE.canvases.set(n, canvas);

        const layer = document.createElement('div');
        layer.className = 'pde-layer';
        layer.dataset.page = n;
        el.appendChild(layer);

        const num = document.createElement('div');
        num.className = 'pde-page-num';
        num.textContent = n;
        el.appendChild(num);

        try {
            const extraRot = PDE.pageRotation.get(n) || 0;
            await PDFE.Engine.get().renderPage(PDE.ctx, n, PDE.scale, canvas, { rotation: (a.rotation + extraRot) % 360 });
            // معاينة ألوان الخلفيات مرة واحدة لكل صفحة (تُستخدم في تغطية النص المحذوف)
            if (!a._bgSampled) { PDFE.Parser.sampleBackgrounds(a, canvas, PDE.scale); a._bgSampled = true; }
        } catch (e) {
            el.innerHTML = `<div class="pde-page-err">⚠️ تعذّر عرض الصفحة ${n}<br><small>${esc(e.message || '')}</small></div>`;
            return;
        }

        buildLayer(layer, a, n);
        if (window.pdeAttachPageHandlers) window.pdeAttachPageHandlers(el, layer, a, n);
    }
    PDE.renderPage = renderPage;

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-LAYER] طبقة العناصر فوق اللوحة
    // ═══════════════════════════════════════════════════════════════════════════

    /** يحوّل إحداثيات PDF (أصلها أسفل اليسار) إلى إحداثيات CSS. */
    PDE.pdfToCss = function (a, x, y, w, h) {
        const s = PDE.scale;
        return { left: x * s, top: (a.height - y - h) * s, width: w * s, height: h * s };
    };
    /** والعكس — من CSS إلى PDF. */
    PDE.cssToPdf = function (a, left, top, w, h) {
        const s = PDE.scale;
        return { x: left / s, y: a.height - (top / s) - (h / s), w: w / s, h: h / s };
    };

    function buildLayer(layer, a, n) {
        const frag = document.createDocumentFragment();

        // 1) عناصر النص الأصلية (قابلة للنقر والتحرير)
        if (PDE.showTextLayer) {
            for (const it of a.items) {
                if (it._deleted) continue;
                frag.appendChild(textEl(it, a));
            }
        }
        // 2) عناصر OCR المكتشفة (إن وُجدت)
        for (const it of (PDE.ocrPages.get(n) || [])) {
            if (it._deleted) continue;
            frag.appendChild(textEl(it, a, true));
        }
        // 3) الصور الأصلية
        for (let i = 0; i < a.images.length; i++) {
            const im = a.images[i];
            if (im._deleted || im.w < 6 || im.h < 6) continue;
            const box = PDE.pdfToCss(a, im.x, im.y, im.w, im.h);
            const d = document.createElement('div');
            d.className = 'pde-obj pde-img';
            d.dataset.kind = 'image'; d.dataset.page = n; d.dataset.idx = i;
            Object.assign(d.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
            d.title = `صورة ${Math.round(im.w)}×${Math.round(im.h)} نقطة`;
            frag.appendChild(d);
        }
        // 4) الكائنات المضافة في هذه الجلسة (نصوص/صور/أشكال/أختام)
        for (const o of PDE.objects) {
            if (o.page !== n || o._deleted) continue;
            frag.appendChild(objectEl(o, a));
        }
        layer.appendChild(frag);
    }
    PDE.buildLayer = buildLayer;

    function textEl(it, a, isOcr) {
        const s = PDE.scale;
        const box = PDE.pdfToCss(a, it.x, it.y - it.fontSize * 0.22, it.w, it.fontSize * 1.24);
        const d = document.createElement('div');
        d.className = 'pde-txt' + (isOcr ? ' ocr' : '') + (it._edited ? ' edited' : '');
        d.dataset.kind = 'text';
        d.dataset.page = it.page;
        d.dataset.id = it.id;
        d.dir = it.rtl ? 'rtl' : 'ltr';
        d.textContent = it._newText != null ? it._newText : it.str;
        Object.assign(d.style, {
            left: box.left + 'px', top: box.top + 'px',
            width: Math.max(box.width, 6) + 'px', height: box.height + 'px',
            fontSize: (it.fontSize * s) + 'px',
            // سلسلة بدائل عربية حقيقية: لو لم يكن خط المستند مثبَّتاً فالمتصفح
            // يسقط على خط لاتيني لا يعرض العربية، فيبدو النص عند التحرير مختلفاً تماماً.
            fontFamily: it.rtl
                ? `"${it.fontFamily}", "Amiri", "Cairo", "Tajawal", "Noto Naskh Arabic", Tahoma, "Segoe UI", sans-serif`
                : `"${it.fontFamily}", Arial, Helvetica, sans-serif`,
            fontWeight: it.bold ? '700' : '400',
            fontStyle: it.italic ? 'italic' : 'normal',
            textAlign: it.align || (it.rtl ? 'right' : 'left'),
            letterSpacing: (it.charSpacing || 0) * s + 'px',
            transform: it.angle ? `rotate(${-it.angle}deg)` : ''
        });
        // ⚠️ اللون **لا يُضبط مباشرةً** على العنصر: طبقة النص شفافة فوق اللوحة
        // (النص الأصلي مرسوم على اللوحة نفسها). أي `style.color` مضمَّن يهزم
        // `color: transparent` في CSS فيُطبع النص مرتين بإزاحة — نصّ مشوّه.
        // نمرّره كمتغيّر، وCSS يكشفه فقط عند .editing/.edited.
        d.style.setProperty('--pde-c', it.color || '#000000');
        d.style.setProperty('--pde-bgc', it.bgColor || '#FFFFFF');
        if (it.state) d.dataset.state = it.state;
        return d;
    }
    PDE.textEl = textEl;

    function objectEl(o, a) {
        const box = PDE.pdfToCss(a, o.x, o.y, o.w, o.h);
        const d = document.createElement('div');
        d.className = 'pde-obj pde-obj-' + o.kind;
        d.dataset.kind = 'object'; d.dataset.oid = o.id; d.dataset.page = o.page;
        Object.assign(d.style, {
            left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px',
            opacity: o.opacity == null ? 1 : o.opacity,
            transform: o.rotation ? `rotate(${-o.rotation}deg)` : '',
            zIndex: 20 + (o.z || 0)
        });
        if (o.kind === 'text') {
            d.textContent = o.text;
            d.dir = o.dir || 'rtl';
            Object.assign(d.style, {
                fontSize: (o.fontSize * PDE.scale) + 'px',
                fontFamily: `"${o.fontFamily}", Tahoma, Arial, sans-serif`,
                fontWeight: o.bold ? '700' : '400',
                fontStyle: o.italic ? 'italic' : 'normal',
                textDecoration: [o.underline ? 'underline' : '', o.strike ? 'line-through' : ''].filter(Boolean).join(' '),
                color: o.color,
                background: o.bgColor || 'transparent',
                textAlign: o.align || 'right',
                letterSpacing: (o.charSpacing || 0) * PDE.scale + 'px',
                lineHeight: (o.lineGapRatio || 1.25)
            });
        } else if (o.kind === 'image' || o.kind === 'sign' || o.kind === 'stamp' || o.kind === 'qr') {
            d.style.backgroundImage = `url("${o.dataUrl}")`;
            d.style.backgroundSize = '100% 100%';
        } else if (o.kind === 'shape') {
            if (o.shape === 'line') {
                d.style.background = 'transparent';
                d.innerHTML = `<svg width="100%" height="100%" style="overflow:visible"><line x1="0" y1="0" x2="100%" y2="100%" stroke="${esc(o.stroke)}" stroke-width="${(o.lineWidth || 1) * PDE.scale}"/></svg>`;
            } else {
                d.style.background = o.fill || 'transparent';
                d.style.border = `${Math.max(1, (o.lineWidth || 1) * PDE.scale)}px solid ${o.stroke || '#000'}`;
                if (o.shape === 'ellipse') d.style.borderRadius = '50%';
            }
        } else if (o.kind === 'annot') {
            if (o.sub === 'highlight') d.style.background = o.color, d.style.opacity = o.opacity == null ? 0.42 : o.opacity;
            else if (o.sub === 'underline') d.style.borderBottom = `${Math.max(1, (o.lineWidth || 1.1) * PDE.scale)}px solid ${o.color}`;
            else if (o.sub === 'strike') d.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center"><div style="height:${Math.max(1, (o.lineWidth || 1.1) * PDE.scale)}px;width:100%;background:${esc(o.color)}"></div></div>`;
            else if (o.sub === 'comment') {
                d.className += ' pde-comment';
                d.innerHTML = `<div class="pde-cm-pin">💬</div><div class="pde-cm-body">${esc(o.text)}</div>`;
            } else if (o.sub === 'link') {
                d.className += ' pde-link';
                d.title = o.url;
            } else if (o.sub === 'redact') {
                d.style.background = o.fillColor || '#000';
            }
        }
        return d;
    }
    PDE.objectEl = objectEl;

    /** يعيد بناء طبقة صفحة واحدة (بعد تعديل). */
    PDE.refreshLayer = function (n) {
        const el = PDE.pageEls.get(n); if (!el) return;
        const layer = el.querySelector('.pde-layer'); if (!layer) return;
        const a = PDE.analysis.pages[n - 1]; if (!a) return;
        layer.innerHTML = '';
        buildLayer(layer, a, n);
        if (window.pdeAttachPageHandlers) window.pdeAttachPageHandlers(el, layer, a, n);
    };

    /** يعيد بناء كل الصفحات المرسومة. */
    PDE.refreshAllLayers = function () { PDE.rendered.forEach(n => PDE.refreshLayer(n)); };

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-THUMB] الصفحات المصغّرة
    // ═══════════════════════════════════════════════════════════════════════════

    window.pdeRenderThumbs = function () {
        const host = $('pdeThumbs'); if (!host) return;
        const list = PDE.pageOrder.filter(n => !PDE.deletedPages.has(n));
        host.innerHTML = `<div class="pde-thumb-head">📑 الصفحات <span class="badge">${list.length}</span>
            ${CAN_EDIT() ? '<button class="pde-tb-btn" onclick="pdeAddBlankPage()" title="إضافة صفحة فارغة">➕</button>' : ''}</div>
        <div class="pde-thumb-list" id="pdeThumbList">${list.map(n => thumbHTML(n)).join('')}</div>`;
        list.forEach(n => renderThumbCanvas(n));
        if (CAN_EDIT()) enableThumbDrag();
    };

    function thumbHTML(n) {
        const a = PDE.analysis.pages[n - 1];
        const rot = PDE.pageRotation.get(n) || 0;
        return `<div class="pde-thumb ${n === PDE.page ? 'act' : ''}" data-page="${n}" draggable="${CAN_EDIT()}" onclick="pdeGoPage(${n})">
            <div class="pde-thumb-box"><canvas id="pdeTh${n}"></canvas></div>
            <div class="pde-thumb-lbl">${n}${rot ? ` <small>${rot}°</small>` : ''}</div>
            ${CAN_EDIT() ? `<div class="pde-thumb-acts">
                <button onclick="event.stopPropagation();pdeRotatePage(${n},90)" title="تدوير 90°">↻</button>
                <button onclick="event.stopPropagation();pdeDuplicatePage(${n})" title="تكرار">⧉</button>
                <button onclick="event.stopPropagation();pdeExtractPage(${n})" title="استخراج">⤓</button>
                <button onclick="event.stopPropagation();pdeDeletePage(${n})" title="حذف" class="dg">🗑</button>
            </div>` : ''}
            ${a && a.isScanned ? '<span class="pde-thumb-flag" title="صفحة ممسوحة ضوئياً">🖨️</span>' : ''}
        </div>`;
    }

    async function renderThumbCanvas(n) {
        const c = $('pdeTh' + n); if (!c) return;
        try {
            const a = PDE.analysis.pages[n - 1];
            const target = 132;
            const sc = a ? target / a.height : 0.18;
            await PDFE.Engine.get().renderPage(PDE.ctx, n, sc, c, { rotation: ((a ? a.rotation : 0) + (PDE.pageRotation.get(n) || 0)) % 360 });
        } catch (e) { c.parentElement.innerHTML = '<div class="pde-thumb-err">⚠️</div>'; }
    }

    /** السحب والإفلات لإعادة ترتيب الصفحات (§20). */
    function enableThumbDrag() {
        const list = $('pdeThumbList'); if (!list) return;
        let dragged = null;
        list.querySelectorAll('.pde-thumb').forEach(t => {
            t.addEventListener('dragstart', e => { dragged = t; t.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
            t.addEventListener('dragend', () => { t.classList.remove('dragging'); list.querySelectorAll('.pde-thumb').forEach(x => x.classList.remove('over')); });
            t.addEventListener('dragover', e => { e.preventDefault(); if (t !== dragged) t.classList.add('over'); });
            t.addEventListener('dragleave', () => t.classList.remove('over'));
            t.addEventListener('drop', e => {
                e.preventDefault(); t.classList.remove('over');
                if (!dragged || dragged === t) return;
                const from = +dragged.dataset.page, to = +t.dataset.page;
                const order = PDE.pageOrder.filter(n => !PDE.deletedPages.has(n));
                const fi = order.indexOf(from), ti = order.indexOf(to);
                if (fi < 0 || ti < 0) return;
                order.splice(ti, 0, order.splice(fi, 1)[0]);
                PDE.pageOrder = order.concat(PDE.pageOrder.filter(n => PDE.deletedPages.has(n)));
                PDE.history.push(PDFE.Ops.make('page.reorder', { order: order.slice() }));
                PDE.dirty = true;
                window.pdeRenderThumbs();
                buildPageSlots(); PDE.rendered.clear(); renderVisiblePages();
                toast('✅ أُعيد ترتيب الصفحات', 'ok');
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-ZOOM] التكبير والتنقل
    // ═══════════════════════════════════════════════════════════════════════════

    const ZOOMS = [0.25, 0.4, 0.5, 0.66, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

    window.pdeZoom = function (dir) {
        const i = ZOOMS.findIndex(z => Math.abs(z - PDE.scale) < 0.02);
        let ni = i < 0 ? ZOOMS.findIndex(z => z > PDE.scale) : i + dir;
        ni = Math.max(0, Math.min(ZOOMS.length - 1, ni));
        PDE.setScale(ZOOMS[ni]);
    };

    window.pdeFit = function (mode) {
        const wrap = $('pdeCanvasWrap'); const a = PDE.analysis.pages[PDE.page - 1];
        if (!wrap || !a) return;
        const pad = 56;
        PDE.setScale(mode === 'width' ? (wrap.clientWidth - pad) / a.width
            : Math.min((wrap.clientWidth - pad) / a.width, (wrap.clientHeight - pad) / a.height));
    };

    PDE.setScale = function (s) {
        PDE.scale = Math.max(0.15, Math.min(6, s));
        $('pdeZoomLbl').textContent = Math.round(PDE.scale * 100) + '%';
        const cur = PDE.page;
        buildPageSlots();
        PDE.rendered.clear(); PDE.canvases.clear();
        renderVisiblePages().then(() => window.pdeGoPage(cur, true));
    };

    window.pdeGoPage = function (n, noScrollAnim) {
        n = Math.max(1, Math.min(PDE.ctx.numPages, +n || 1));
        if (PDE.deletedPages.has(n)) { const alt = PDE.pageOrder.find(p => !PDE.deletedPages.has(p)); if (alt) n = alt; else return; }
        PDE.page = n;
        $('pdePageNum').value = n;
        const el = PDE.pageEls.get(n);
        if (el) $('pdeCanvasWrap').scrollTo({ top: el.offsetTop - 12, behavior: noScrollAnim ? 'auto' : 'smooth' });
        document.querySelectorAll('.pde-thumb').forEach(t => t.classList.toggle('act', +t.dataset.page === n));
        setTimeout(renderVisiblePages, 60);
    };

    window.pdeToggleTextLayer = function (on) {
        PDE.showTextLayer = on;
        PDE.refreshAllLayers();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // الحفظ التلقائي (§28) — يحفظ العمليات فقط، لا يستبدل الأصل أبداً
    // ═══════════════════════════════════════════════════════════════════════════
    function startAutoSave() {
        clearInterval(PDE._autoSaveTimer);
        PDE._autoSaveTimer = setInterval(() => {
            if (!PDE.dirty || !PDE.doc || !PDE.doc.id || PDE.busy) return;
            const ops = PDE.history.active();
            if (!ops.length) return;
            // مسوّدة العمليات فقط — سريعة وخفيفة، ولا تلمس الأصل ولا تنشئ نسخة
            window.set(window.ref(window.db, 'ledger/pdfEdits/' + PDE.doc.id + '/_draft'), {
                ops: JSON.parse(JSON.stringify(ops.map(stripHeavy))),
                at: Date.now(),
                by: (window.curU && window.curU.email) || ''
            }).then(() => PDE.status('💾 حُفظت المسوّدة تلقائياً ' + new Date().toLocaleTimeString('ar-EG')))
                .catch(() => { /* الحفظ التلقائي لا يزعج المستخدم عند الفشل */ });
        }, 45000);
    }
    /** يزيل البيانات الثقيلة (صور base64) قبل التخزين في RTDB. */
    function stripHeavy(op) {
        const o = Object.assign({}, op);
        if (o.dataUrl && o.dataUrl.length > 4000) o.dataUrl = '[image]';
        if (o.bytes) delete o.bytes;
        return o;
    }
    PDE.stripHeavy = stripHeavy;

    console.log('✅ PDF Editor UI [UI] loaded');
})();
