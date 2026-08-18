// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║   🤖 قراءة الفواتير بالذكاء الاصطناعي — الواجهة (UI Layer)                     ║
// ║   ────────────────────────────────────────────────────────────────────────    ║
// ║   [UI-PAGE]   الصفحة الرئيسية: الرفع + قائمة الفواتير + المؤشرات               ║
// ║   [UI-QUEUE]  معالجة متعدّدة مستقلة — فشل فاتورة لا يُسقط البقية (§29)          ║
// ║   [UI-REVIEW] شاشة «مراجعة الفاتورة المستخرجة» (§12) بأقسامها الخمسة           ║
// ║   [UI-EDIT]   التحرير + تسجيل كل تغيير في أثر التدقيق (§13)                    ║
// ║   [UI-LINK]   ربط المورّد والأصناف (§14 §15)                                   ║
// ║   [UI-CONV]   الاعتماد والتحويل لفاتورة مشتريات ثم الترحيل (§17 §23)           ║
// ║   [UI-EXPORT] تصدير Excel (5 أوراق) و PDF (§21 §22)                           ║
// ║   [UI-ADMIN]  الإعدادات · سجل المعالجة · لوحة التكلفة (§31 §32 §33)            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
/* global AINV, XLSX */

(function () {
    'use strict';

    const esc = window.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const $ = id => document.getElementById(id);
    const toast = (m, t, d) => (window.toast ? window.toast(m, t, d) : console.log(m));
    const fmt = n => (window.fmt ? window.fmt(n) : (Number(n) || 0).toFixed(2));
    const nz = v => (v == null || v === '' ? null : v);

    const AIU = window.AIU = { current: null, tab: 'all', queue: [], busy: false };

    const CAN_VIEW = () => (typeof window.can === 'function' ? window.can('ai_invoice') : true);
    const CAN_RUN = () => (typeof window.can === 'function' ? window.can('ai_invoice_process') : true);
    const CAN_APPROVE = () => (typeof window.can === 'function' ? window.can('ai_invoice_approve') : true);
    const IS_ADMIN = () => (window.myP && window.myP.role === 'admin');

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-PAGE] الصفحة الرئيسية
    // ═══════════════════════════════════════════════════════════════════════════
    window.renderAiInvoices = function () {
        const pg = $('pg-aiinvoices'); if (!pg) return;
        if (!CAN_VIEW()) { pg.innerHTML = '<div class="empty"><div class="ei">🚫</div><p>لا تملك صلاحية الوصول إلى قراءة الفواتير</p></div>'; return; }
        if (AIU.current) { renderReview(); return; }

        const ready = AINV.Config.ready();
        const recs = Object.entries(window.aiInvoices || {}).sort((a, b) => (b[1].uploadedAt || 0) - (a[1].uploadedAt || 0));
        const byStatus = {};
        recs.forEach(([, r]) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
        const filtered = AIU.tab === 'all' ? recs : recs.filter(([, r]) => r.status === AIU.tab);

        pg.innerHTML = `
        <div id="aiRoot">
            ${ready.ok
                ? (IS_ADMIN() ? `<div class="ai-ready">
                    ✅ <b>الوحدة جاهزة</b> <span class="ai-meta">— المحرك: ${esc((AINV.Config.get().provider || 'gemini') === 'gemini' ? ('Gemini · ' + (AINV.Config.get().geminiModel || 'gemini-2.5-flash')) : ('Claude · ' + AINV.Config.get().model))}</span>
                    <span style="flex:1"></span>
                    <button class="btn" onclick="aiSettings()">⚙️ الإعدادات</button>
                  </div>` : '')
                : `<div class="ai-warn">
                    ⚠️ <b>الوحدة غير جاهزة</b> — ${esc(ready.reason)}
                    ${IS_ADMIN() ? '<button class="btn b-b" style="margin-inline-start:10px" onclick="aiSettings()">⚙️ فتح الإعدادات</button>' : ''}
                  </div>`}

            <div class="card ai-hero">
                <div class="ai-hero-txt">
                    <h2>🤖 قراءة الفواتير بالذكاء الاصطناعي</h2>
                    <p>ارفع فواتير الموردين — صوراً أو PDF — ليقرأها المحرك ويستخرج بياناتها، ثم <b>يتحقّق النظام من كل عملية حسابية بنفسه</b> ويعرضها لمراجعتك قبل أي اعتماد أو ترحيل.</p>
                    <div class="ai-hero-tags">
                        <span>🔐 المفتاح لا يصل المتصفح</span><span>🧮 الحساب في النظام لا في النموذج</span>
                        <span>🇸🇦 قواعد الفوترة السعودية</span><span>👤 لا ترحيل بلا موافقتك</span><span>🕵️ أثر تدقيق كامل</span>
                    </div>
                </div>
                <div class="ai-drop ${ready.ok && CAN_RUN() ? '' : 'off'}" id="aiDrop">
                    <div class="ai-drop-ic">📥</div>
                    <div class="ai-drop-t">اسحب الفواتير هنا</div>
                    <div class="ai-drop-s">يمكنك رفع عدة ملفات دفعة واحدة</div>
                    <button class="btn b-g" ${ready.ok && CAN_RUN() ? '' : 'disabled'} onclick="document.getElementById('aiFileInput').click()">📂 اختر ملفات</button>
                    <input type="file" id="aiFileInput" multiple accept="application/pdf,image/jpeg,image/png,image/webp" style="display:none" onchange="aiHandleFiles(this.files);this.value=''">
                    <div class="ai-drop-hint">PDF · JPG · PNG · WEBP — حتى ${AINV.Config.get().maxFileMB} م.ب للملف</div>
                </div>
            </div>

            <div id="aiQueue"></div>

            <div class="card">
                <div class="tlb">
                    <div class="c-tl" style="margin:0;border:none;padding:0">🗂️ الفواتير المقروءة <span class="badge">${recs.length}</span></div>
                    <span style="flex:1"></span>
                    <input type="text" id="aiSearch" class="ai-inp" style="max-width:240px" placeholder="🔍 مورّد / رقم فاتورة…" oninput="aiFilterList()">
                    <button class="btn" onclick="aiExportAllExcel()">📊 تصدير القائمة</button>
                    ${IS_ADMIN() ? '<button class="btn" onclick="aiProcessingLog()">📋 سجل المعالجة</button>' : ''}
                    ${IS_ADMIN() ? '<button class="btn" onclick="aiSettings()">⚙️ الإعدادات</button>' : ''}
                </div>
                <div class="ai-tabs">
                    ${tabBtn('all', 'الكل', recs.length)}
                    ${['needs_review', 'validated', 'approved', 'posted', 'failed', 'rejected'].map(s => tabBtn(s, AINV.STATUS[s].ar, byStatus[s] || 0)).join('')}
                </div>
                ${filtered.length === 0
                ? '<div class="empty"><div class="ei">📄</div><p>لا فواتير في هذا التصنيف</p></div>'
                : `<div class="tw"><table class="ai-tbl" id="aiTbl">
                    <thead><tr>
                        <th>الحالة</th><th>المورّد</th><th>رقم الفاتورة</th><th>التاريخ</th>
                        <th class="n">قبل الضريبة</th><th class="n">الضريبة</th><th class="n">الإجمالي</th>
                        <th class="n">الثقة</th><th>الإجراء</th>
                    </tr></thead>
                    <tbody>${filtered.map(([k, r]) => row(k, r)).join('')}</tbody>
                </table></div>`}
            </div>
        </div>`;

        setupDrop();
        renderQueue();
    };

    function tabBtn(id, label, n) {
        return `<button class="ai-tab ${AIU.tab === id ? 'act' : ''}" onclick="aiTab('${id}')">${esc(label)} <i>${n}</i></button>`;
    }
    window.aiTab = t => { AIU.tab = t; window.renderAiInvoices(); };

    function row(k, r) {
        const e = r.extracted || {}, c = r.confidence || {}, t = (e.totals || {});
        const st = AINV.STATUS[r.status] || AINV.STATUS.uploaded;
        const comp = (r.validation && r.validation.computed) || {};
        const conf = c.overall == null ? null : c.overall;
        const th = AINV.Config.get().confidenceThreshold;
        return `<tr data-search="${esc(((e.supplier && e.supplier.name) || '') + ' ' + (e.number || '') + ' ' + (r.fileName || ''))}">
            <td><span class="ai-st" style="--c:${st.color}">${esc(st.ar)}</span></td>
            <td>${esc((e.supplier && e.supplier.name) || r.fileName || '—')}${r.vendorKey ? ' <span class="ai-ok" title="مربوط بمورّد في النظام">🔗</span>' : ''}</td>
            <td>${esc(e.number || '—')}</td>
            <td>${esc(e.date || '—')}</td>
            <td class="n">${comp.taxable != null ? fmt(comp.taxable) : '—'}</td>
            <td class="n">${comp.vat != null ? fmt(comp.vat) : '—'}</td>
            <td class="n"><b>${comp.grandTotal != null ? fmt(comp.grandTotal) : '—'}</b></td>
            <td class="n">${conf == null ? '—' : `<span class="ai-conf ${conf >= th ? 'hi' : conf >= 60 ? 'md' : 'lo'}">${conf}%</span>`}</td>
            <td class="ai-acts">
                <button class="btn b-b" onclick="aiOpen('${esc(k)}')">👁️ مراجعة</button>
                ${r.status === 'failed' && CAN_RUN() ? `<button class="btn" onclick="aiRetry('${esc(k)}')" title="إعادة المحاولة">🔄</button>` : ''}
                ${CAN_APPROVE() ? `<button class="btn b-r" onclick="aiDelete('${esc(k)}')" title="حذف">🗑️</button>` : ''}
            </td>
        </tr>`;
    }

    window.aiFilterList = function () {
        const q = ($('aiSearch').value || '').trim().toLowerCase();
        document.querySelectorAll('#aiTbl tbody tr').forEach(tr => {
            tr.style.display = !q || (tr.dataset.search || '').toLowerCase().includes(q) ? '' : 'none';
        });
    };

    function setupDrop() {
        const dz = $('aiDrop'); if (!dz) return;
        ['dragenter', 'dragover'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add('over'); }));
        ['dragleave', 'drop'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.remove('over'); }));
        dz.addEventListener('drop', ev => {
            const f = ev.dataTransfer && ev.dataTransfer.files;
            if (f && f.length) window.aiHandleFiles(f);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-QUEUE] المعالجة المتعدّدة
    // ───────────────────────────────────────────────────────────────────────────
    // كل ملف يُعالَج في مساره الخاص؛ فشل واحد لا يوقف الباقي (§29). المعالجة
    // متسلسلة عمداً لاحترام حدّ المعدّل في الوسيط وعدم استنزاف الرصيد دفعة واحدة.
    // ═══════════════════════════════════════════════════════════════════════════
    window.aiHandleFiles = async function (fileList) {
        if (!CAN_RUN()) { toast('🚫 لا تملك صلاحية معالجة الفواتير', 'er'); return; }
        const ready = AINV.Config.ready();
        if (!ready.ok) { toast('⚠️ ' + ready.reason, 'er', 9000); return; }

        const files = Array.from(fileList || []);
        if (!files.length) return;
        if (files.length > 25 && !confirm(`سيُعالَج ${files.length} ملفاً. المتابعة؟`)) return;

        files.forEach(f => {
            const chk = AINV.validateFile(f);
            AIU.queue.push({
                id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                file: f, name: f.name, size: f.size,
                state: chk.ok ? 'waiting' : 'invalid',
                msg: chk.ok ? 'في الانتظار' : chk.reason,
                mediaType: chk.mediaType, pct: 0
            });
        });
        renderQueue();
        if (!AIU.busy) pump();
    };

    async function pump() {
        AIU.busy = true;
        while (true) {
            const job = AIU.queue.find(j => j.state === 'waiting');
            if (!job) break;
            await processOne(job);
        }
        AIU.busy = false;
        renderQueue();
        window.renderAiInvoices();
    }

    async function processOne(job) {
        const cfg = AINV.Config.get();
        const set = (state, msg, pct) => { job.state = state; job.msg = msg; if (pct != null) job.pct = pct; renderQueue(); };
        let recId = null;
        const t0 = Date.now();

        try {
            set('running', 'جارٍ رفع الملف الأصلي…', 0.08);
            // نحفظ السجل أولاً كي لا يضيع أثر المحاولة حتى لو فشلت لاحقاً
            let up = { url: '' };
            try { up = await AINV.Store.uploadFile(job.file); }
            catch (e) { /* التخزين اختياري — نكمل ونُنبّه لاحقاً */ }

            recId = await AINV.Store.create({
                status: 'processing', fileName: job.name, fileSize: job.size, fileType: job.mediaType,
                fileUrl: up.url || '', fileProvider: up.provider || '',
                uploadedAt: Date.now(),
                uploadedBy: (window.curU && window.curU.email) || '',
                uploadedByName: (window.myP && window.myP.name) || '',
                model: (cfg.provider === 'anthropic' ? cfg.model : cfg.geminiModel), retryCount: 0, edits: []
            });
            job.recId = recId;

            set('running', 'جارٍ قراءة الملف…', 0.2);
            const b64 = await AINV.fileToBase64(job.file);

            // استخراج مع إعادة المحاولة والسقوط إلى OCR المحلي عند نفاد حصّة Gemini
            const out = await AINV.extractInvoice(job.file, b64, job.mediaType, (m, p) => set('running', m, p));

            set('running', 'جارٍ التحقق الحسابي…', 0.9);
            const inv = AINV.map(out.data);
            const validation = AINV.validate(inv);
            const confidence = AINV.confidence(inv, validation);
            const vm = cfg.autoMatchVendor ? AINV.matchVendor(inv.supplier) : { key: '', reason: '' };
            const itemMatches = AINV.matchItems(inv.items);
            const dups = AINV.findDuplicates(inv, vm.key, recId);

            const low = AINV.lowFields(confidence);
            // قراءة OCR تقديرية دائماً — تُعرَض للمراجعة مهما كانت النتيجة
            const status = (!validation.ok || low.length || dups.length || out.viaOcr) ? 'needs_review' : 'validated';

            await AINV.Store.update(recId, {
                status, viaOcr: !!out.viaOcr,
                extracted: JSON.parse(JSON.stringify(inv)),
                validation: { errors: validation.errors, warnings: validation.warnings, computed: validation.computed, ok: validation.ok },
                confidence, lowFields: low,
                vendorKey: vm.key || '', vendorMatch: { score: vm.score || 0, reason: vm.reason || '', exact: !!vm.exact },
                itemMatches: itemMatches.map(m => ({ key: m.key, score: m.score, reason: m.reason, exact: !!m.exact })),
                duplicates: dups.map(d => ({ kind: d.kind, where: d.where, key: d.key, why: d.why })),
                model: out.model, usage: out.usage || null,
                estCost: AINV.estimateCost(out.model, out.usage),
                processingMs: Date.now() - t0,
                extractedAt: Date.now()
            });

            await AINV.Store.log(recId, {
                event: 'extracted', model: out.model, ms: Date.now() - t0,
                inputTokens: (out.usage && out.usage.input_tokens) || 0,
                outputTokens: (out.usage && out.usage.output_tokens) || 0,
                estCost: AINV.estimateCost(out.model, out.usage),
                errors: validation.errors.length, warnings: validation.warnings.length, confidence: confidence.overall
            });
            await AINV.Audit.log('استخراج فاتورة', `قُرئت «${job.name}» — ${inv.supplier.name || 'مورّد غير محدّد'} · ${inv.number || 'بلا رقم'} · ${validation.computed.grandTotal} ${inv.currency}`, { aiInvoiceId: recId });

            set('done', out.viaOcr
                ? '🔤 قُرئت بالـOCR المجاني — راجِع كل الحقول وأضِف البنود قبل الاعتماد'
                : (validation.ok && !low.length && !dups.length ? '✅ جاهزة للمراجعة' : `⚠️ تحتاج مراجعة (${validation.errors.length} خطأ · ${low.length} حقل منخفض الثقة${dups.length ? ` · ${dups.length} تكرار محتمل` : ''})`), 1);
        } catch (e) {
            const msg = (e && e.message) || 'خطأ غير معروف';
            set('failed', msg, 1);
            if (recId) {
                await AINV.Store.update(recId, { status: 'failed', error: msg, errorCode: e.code || '', processingMs: Date.now() - t0 }).catch(() => { });
                await AINV.Store.log(recId, { event: 'failed', error: msg, code: e.code || '', ms: Date.now() - t0 }).catch(() => { });
            }
            await AINV.Audit.log('فشل استخراج فاتورة', `«${job.name}» — ${msg}`, { aiInvoiceId: recId || null }).catch(() => { });
        }
    }

    function renderQueue() {
        const host = $('aiQueue'); if (!host) return;
        const active = AIU.queue.filter(j => j.state !== 'cleared');
        if (!active.length) { host.innerHTML = ''; return; }
        const running = active.filter(j => j.state === 'running' || j.state === 'waiting').length;
        host.innerHTML = `<div class="card ai-queue">
            <div class="tlb"><div class="c-tl" style="margin:0;border:none;padding:0">⏳ المعالجة <span class="badge">${active.length}</span></div>
            <span style="flex:1"></span>
            ${running === 0 ? '<button class="btn" onclick="aiClearQueue()">مسح المكتمل</button>' : `<span class="ai-meta">${running} متبقٍّ…</span>`}</div>
            ${active.map(j => `<div class="ai-job ${j.state}">
                <div class="aj-name">${esc(j.name)}</div>
                <div class="aj-bar"><i style="width:${Math.round((j.pct || 0) * 100)}%"></i></div>
                <div class="aj-msg">${esc(j.msg)}</div>
                ${j.recId && j.state === 'done' ? `<button class="btn b-b" onclick="aiOpen('${esc(j.recId)}')">مراجعة</button>` : ''}
            </div>`).join('')}
        </div>`;
    }
    window.aiClearQueue = function () {
        AIU.queue = AIU.queue.filter(j => j.state === 'running' || j.state === 'waiting');
        renderQueue();
    };

    window.aiRetry = async function (id) {
        const r = (window.aiInvoices || {})[id];
        if (!r) return;
        toast('ℹ️ أعد رفع الملف — لا يُحتفظ بالملف الأصلي في المتصفح بعد المعالجة', 'ok', 7000);
        await AINV.Store.update(id, { retryCount: (r.retryCount || 0) + 1 });
    };

    window.aiDelete = async function (id) {
        const r = (window.aiInvoices || {})[id] || {};
        const e = r.extracted || {};
        if (r.status === 'posted') { toast('🚫 لا يمكن حذف فاتورة مُرحَّلة — ألغِ القيد أولاً', 'er', 7000); return; }
        if (!confirm(`حذف سجل الفاتورة «${e.number || r.fileName || ''}»؟\n\nملاحظة: الملف الأصلي على خادم التخزين لا يُحذف بهذا الإجراء.`)) return;
        try {
            await AINV.Store.remove(id);
            await AINV.Audit.log('حذف سجل استخراج', `حُذف سجل «${e.number || r.fileName || ''}» — الملف الأصلي بقي على التخزين`, { aiInvoiceId: id });
            toast('✅ حُذف السجل', 'ok');
            window.renderAiInvoices();
        } catch (err) { toast('تعذّر الحذف: ' + err.message, 'er', 7000); }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-REVIEW] شاشة المراجعة
    // ═══════════════════════════════════════════════════════════════════════════
    window.aiOpen = function (id) {
        const r = (window.aiInvoices || {})[id];
        if (!r) { toast('السجل غير موجود', 'er'); return; }
        AIU.current = JSON.parse(JSON.stringify(Object.assign({ id }, r)));
        AIU.current.id = id;
        if (!AIU.current.extracted) { toast('لا بيانات مستخرَجة لهذا السجل', 'er'); AIU.current = null; return; }
        renderReview();
    };
    window.aiClose = function () {
        if (AIU.dirty && !confirm('هناك تعديلات غير محفوظة. الخروج؟')) return;
        AIU.current = null; AIU.dirty = false;
        window.renderAiInvoices();
    };

    /** يعيد الحساب والتحقق بعد أي تعديل — الحقيقة تُشتقّ دائماً لا تُخزَّن. */
    function revalidate() {
        const c = AIU.current;
        c.validation = AINV.validate(c.extracted);
        c.confidence = AINV.confidence(c.extracted, c.validation);
        c.lowFields = AINV.lowFields(c.confidence);
        c.duplicates = AINV.findDuplicates(c.extracted, c.vendorKey, c.id)
            .map(d => ({ kind: d.kind, where: d.where, key: d.key, why: d.why }));
    }

    function renderReview() {
        const pg = $('pg-aiinvoices'); const c = AIU.current;
        revalidate();
        const inv = c.extracted, v = c.validation, comp = v.computed, conf = c.confidence;
        const th = AINV.Config.get().confidenceThreshold;
        const st = AINV.STATUS[c.status] || AINV.STATUS.uploaded;
        const locked = c.status === 'posted' || c.status === 'approved';

        pg.innerHTML = `
        <div class="ai-review">
            <div class="ai-rv-bar">
                <button class="btn" onclick="aiClose()">↩︎ رجوع</button>
                <div class="ai-rv-title">مراجعة الفاتورة المستخرجة</div>
                <span class="ai-st" style="--c:${st.color}">${esc(st.ar)}</span>
                <span class="ai-conf ${conf.overall >= th ? 'hi' : conf.overall >= 60 ? 'md' : 'lo'}" title="الثقة الكلية">${conf.overall}%</span>
                <span style="flex:1"></span>
                <button class="btn" onclick="aiExportExcel()">📊 Excel</button>
                <button class="btn" onclick="aiExportPdf()">📄 PDF</button>
                ${locked ? '' : `<button class="btn b-b" onclick="aiSaveDraft()">💾 حفظ مسوّدة</button>`}
                ${locked || !CAN_APPROVE() ? '' : `<button class="btn b-g" onclick="aiApprove()">✅ اعتماد</button>`}
                ${locked || !CAN_APPROVE() ? '' : `<button class="btn b-r" onclick="aiReject()">✖️ رفض</button>`}
                ${c.status === 'approved' && !c.linkedPInvKey ? `<button class="btn b-g" onclick="aiConvert()">🔄 تحويل إلى فاتورة مشتريات</button>` : ''}
                ${c.linkedPInvKey ? `<button class="btn b-b" onclick="aiGoToPInv()">📋 فتح فاتورة المشتريات للترحيل</button>` : ''}
            </div>
            ${c.linkedPInvKey ? `<div class="ai-banner ok">✅ حُوِّلت إلى فاتورة مشتريات <b>مسوّدة</b>.
                الترحيل المحاسبي لا يتم من هنا — افتحها من صفحة فواتير المشتريات وراجعها ثم رحّلها بموافقتك.</div>` : ''}

            ${banners(c, v, th)}

            <div class="ai-rv-grid">
                <div class="ai-rv-doc">
                    <div class="ai-sec">📎 المستند الأصلي</div>
                    ${c.fileUrl
                ? (String(c.fileType || '').includes('pdf')
                    ? `<iframe class="ai-doc-frame" src="${esc(c.fileUrl)}#view=FitH" title="المستند"></iframe>`
                    : `<div class="ai-doc-img"><img src="${esc(c.fileUrl)}" id="aiDocImg" alt="المستند" style="transform:rotate(0deg) scale(1)"></div>`)
                : '<div class="ai-nofile">لم يُحفظ الملف الأصلي — التخزين غير مهيّأ في الإعدادات</div>'}
                    <div class="ai-doc-tools">
                        ${c.fileUrl ? `<button class="btn" onclick="aiDocZoom(0.2)">＋</button>
                        <button class="btn" onclick="aiDocZoom(-0.2)">－</button>
                        <button class="btn" onclick="aiDocRotate()">⟳</button>
                        <a class="btn b-b" href="${esc(c.fileUrl)}" target="_blank" rel="noopener">⤢ فتح</a>
                        <a class="btn" href="${esc(c.fileUrl)}" download>⬇️</a>` : ''}
                    </div>
                    <div class="ai-meta">${esc(c.fileName || '')} · ${c.fileSize ? (c.fileSize / 1024).toFixed(0) + ' ك.ب' : ''}
                        · رُفعت ${c.uploadedAt ? new Date(c.uploadedAt).toLocaleString('ar-EG') : ''} بواسطة ${esc(c.uploadedByName || c.uploadedBy || '')}</div>
                </div>

                <div class="ai-rv-data">
                    ${vendorSection(c, conf, th)}
                    ${invoiceSection(inv, conf, th, locked)}
                    ${itemsSection(c, comp, locked)}
                    ${totalsSection(inv, comp)}
                    ${auditSection(c)}
                </div>
            </div>
        </div>`;
    }

    function banners(c, v, th) {
        let h = '';
        if (v.errors.length) {
            h += `<div class="ai-banner err">
                <b>⛔ ${v.errors.length} خطأ في التحقق — لا يمكن الاعتماد قبل معالجتها</b>
                <ul>${v.errors.slice(0, 8).map(e => `<li>${e.line ? `بند ${e.line}: ` : ''}${esc(e.msg)}</li>`).join('')}</ul>
                ${v.errors.length > 8 ? `<div class="ai-meta">…و${v.errors.length - 8} غيرها</div>` : ''}
            </div>`;
        }
        if ((c.duplicates || []).length) {
            h += `<div class="ai-banner warn">
                <b>♻️ قد تكون هذه الفاتورة مكرّرة</b>
                <ul>${c.duplicates.map(d => `<li>${esc(d.where)}: ${esc(d.why)} <button class="ai-lnk" onclick="aiShowDup('${esc(d.kind)}','${esc(d.key)}')">عرض السابقة</button></li>`).join('')}</ul>
            </div>`;
        }
        const low = c.lowFields || [];
        if (low.length) {
            const names = { invoice_number: 'رقم الفاتورة', invoice_date: 'التاريخ', supplier_name: 'اسم المورّد', supplier_vat_number: 'الرقم الضريبي', items: 'الأصناف', totals: 'الإجماليات' };
            h += `<div class="ai-banner info">⚠️ حقول استُخرجت بثقة أقل من ${th}% — راجعها بعناية: <b>${low.map(k => esc(names[k] || k)).join('، ')}</b></div>`;
        }
        if (v.warnings.length) {
            h += `<details class="ai-banner note"><summary>ℹ️ ${v.warnings.length} ملاحظة</summary>
                <ul>${v.warnings.map(w => `<li>${esc(w.msg)}</li>`).join('')}</ul></details>`;
        }
        return h;
    }

    function chip(conf, key, th) {
        if (conf[key] == null) return '';
        const v = conf[key];
        return `<span class="ai-badge ${v >= th ? 'hi' : v >= 60 ? 'md' : 'lo'}" title="استخرجه الذكاء الاصطناعي بثقة ${v}% — انقر للتفاصيل" onclick="aiFieldInfo('${key}')">AI ${v}%</span>`;
    }

    function fld(label, path, value, conf, key, th, locked, type) {
        return `<label class="ai-f">
            <span class="ai-f-l">${esc(label)} ${conf && key ? chip(conf, key, th) : ''}</span>
            <input type="${type || 'text'}" value="${esc(value == null ? '' : value)}" ${locked ? 'disabled' : ''}
                   data-path="${esc(path)}" onchange="aiEdit(this)">
        </label>`;
    }

    function vendorSection(c, conf, th) {
        const s = c.extracted.supplier;
        const vm = c.vendorMatch || {};
        const vendors = Object.entries(window.vendors || {});
        return `<div class="ai-sec">🏭 بيانات المورّد</div>
        <div class="ai-match ${c.vendorKey ? 'ok' : 'new'}">
            ${c.vendorKey
                ? `✅ <b>تم العثور على مورّد مطابق</b> — ${esc((window.vendors[c.vendorKey] || {}).nameAr || '')} <span class="ai-meta">(${esc(vm.reason || '')})</span>`
                : `🆕 <b>مورّد جديد</b> — ${esc(vm.reason || 'لم يُعثر على مطابق')}`}
            <div class="ai-row">
                <select id="aiVendorSel" onchange="aiSetVendor(this.value)" data-ss="1">
                    <option value="">— بلا ربط —</option>
                    ${vendors.map(([k, v]) => `<option value="${esc(k)}" ${k === c.vendorKey ? 'selected' : ''}>${esc(v.nameAr || v.nameEn || k)}</option>`).join('')}
                </select>
                ${c.vendorKey ? '' : '<button class="btn b-g" onclick="aiCreateVendor()">➕ إنشاء مورّد جديد</button>'}
            </div>
            <div class="ai-meta">لا يُنشأ مورّد تلقائياً — القرار لك.</div>
        </div>
        <div class="ai-grid2">
            ${fld('اسم المورّد', 'supplier.name', s.name, conf, 'supplier_name', th, false)}
            ${fld('الرقم الضريبي', 'supplier.vatNumber', s.vatNumber, conf, 'supplier_vat_number', th, false)}
            ${fld('السجل التجاري', 'supplier.crNumber', s.crNumber, null, null, th, false)}
            ${fld('الهاتف', 'supplier.phone', s.phone, null, null, th, false)}
            ${fld('العنوان', 'supplier.address', s.address, null, null, th, false)}
            ${fld('الآيبان', 'supplier.iban', s.iban, null, null, th, false)}
        </div>`;
    }

    function invoiceSection(inv, conf, th, locked) {
        const types = { tax_invoice: 'فاتورة ضريبية', simplified_tax_invoice: 'فاتورة ضريبية مبسّطة', credit_note: 'إشعار دائن', debit_note: 'إشعار مدين', proforma: 'فاتورة مبدئية', quotation: 'عرض سعر', delivery_note: 'سند تسليم', other: 'أخرى' };
        return `<div class="ai-sec">🧾 بيانات الفاتورة</div>
        <div class="ai-grid2">
            ${fld('رقم الفاتورة', 'number', inv.number, conf, 'invoice_number', th, locked)}
            ${fld('تاريخ الفاتورة', 'date', inv.date, conf, 'invoice_date', th, locked, 'date')}
            ${fld('تاريخ الاستحقاق', 'dueDate', inv.dueDate, null, null, th, locked, 'date')}
            <label class="ai-f"><span class="ai-f-l">نوع الفاتورة</span>
                <select data-path="docType" onchange="aiEdit(this)" ${locked ? 'disabled' : ''}>
                    ${Object.entries(types).map(([k, l]) => `<option value="${k}" ${inv.docType === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}
                </select></label>
            ${fld('العملة', 'currency', inv.currency, null, null, th, locked)}
            ${fld('رقم أمر الشراء', 'poNumber', inv.poNumber, null, null, th, locked)}
            ${fld('رقم العقد', 'contractNumber', inv.contractNumber, null, null, th, locked)}
            ${inv.hijriDate ? `<label class="ai-f"><span class="ai-f-l">التاريخ الهجري (كما ورد)</span><input value="${esc(inv.hijriDate)}" disabled></label>` : ''}
        </div>
        <div class="ai-sec">🧑‍💼 بيانات العميل (كما وردت في الفاتورة)</div>
        <div class="ai-grid2">
            ${fld('اسم العميل', 'customer.name', inv.customer.name, null, null, th, locked)}
            ${fld('الرقم الضريبي للعميل', 'customer.vatNumber', inv.customer.vatNumber, null, null, th, locked)}
        </div>`;
    }

    function itemsSection(c, comp, locked) {
        const items = c.extracted.items;
        const errByLine = {};
        (c.validation.errors || []).forEach(e => { if (e.line) (errByLine[e.line] = errByLine[e.line] || []).push(e); });
        return `<div class="ai-sec">📦 الأصناف <span class="badge">${items.length}</span>
            ${locked ? '' : '<button class="btn" style="float:inline-end" onclick="aiAddLine()">➕ بند</button>'}</div>
        <div class="tw"><table class="ai-lines">
            <thead><tr>
                <th>الصنف</th><th>مطابقة</th><th class="n">الكمية</th><th>الوحدة</th><th class="n">السعر</th>
                <th class="n">الخصم</th><th class="n">قبل الضريبة</th><th class="n">%</th><th class="n">الضريبة</th><th class="n">بعد الضريبة</th>${locked ? '' : '<th></th>'}
            </tr></thead>
            <tbody>${items.map((l, i) => {
            const cc = comp.lines[i] || {};
            const m = (c.itemMatches || [])[i] || {};
            const bad = errByLine[i + 1];
            return `<tr class="${bad ? 'bad' : ''}" title="${bad ? esc(bad.map(x => x.msg).join(' · ')) : ''}">
                    <td><input class="wide" value="${esc(l.description || '')}" data-path="items.${i}.description" onchange="aiEdit(this)" ${locked ? 'disabled' : ''}></td>
                    <td class="ai-imatch">${m.key ? `<span class="ai-ok" title="${esc(m.reason || '')}">🔗 ${esc(((window.invItems || window.items || {})[m.key] || {}).nameAr || 'مرتبط')}</span>` : `<span class="ai-new" title="${esc(m.reason || '')}">🆕 جديد</span>`}</td>
                    <td class="n"><input class="num" value="${nz(l.qty) == null ? '' : l.qty}" data-path="items.${i}.qty" onchange="aiEdit(this)" ${locked ? 'disabled' : ''}></td>
                    <td><input class="sm" value="${esc(l.unit || '')}" data-path="items.${i}.unit" onchange="aiEdit(this)" ${locked ? 'disabled' : ''}></td>
                    <td class="n"><input class="num" value="${nz(l.unitPrice) == null ? '' : l.unitPrice}" data-path="items.${i}.unitPrice" onchange="aiEdit(this)" ${locked ? 'disabled' : ''}></td>
                    <td class="n"><input class="num" value="${nz(l.discount) == null ? '' : l.discount}" data-path="items.${i}.discount" onchange="aiEdit(this)" ${locked ? 'disabled' : ''}></td>
                    <td class="n calc">${fmt(cc.taxable)}</td>
                    <td class="n"><input class="num sm" value="${nz(l.vatRate) == null ? '' : l.vatRate}" data-path="items.${i}.vatRate" onchange="aiEdit(this)" ${locked ? 'disabled' : ''}></td>
                    <td class="n calc">${fmt(cc.vatAmount)}</td>
                    <td class="n calc"><b>${fmt(cc.lineTotal)}</b></td>
                    ${locked ? '' : `<td><button class="ai-x" onclick="aiDelLine(${i})" title="حذف البند">✕</button></td>`}
                </tr>`;
        }).join('')}</tbody>
        </table></div>
        <div class="ai-meta">الأعمدة الرمادية <b>محسوبة في النظام</b> من الكمية والسعر والنسبة — لا تُؤخذ من الذكاء الاصطناعي.</div>`;
    }

    function totalsSection(inv, comp) {
        const t = inv.totals;
        const cmpRow = (label, written, calc) => {
            const diff = written != null && Math.abs(written - calc) > AINV.TOL_TOTAL;
            return `<tr class="${diff ? 'bad' : ''}">
                <td>${esc(label)}</td>
                <td class="n">${written == null ? '<span class="ai-meta">غير مذكور</span>' : fmt(written)}</td>
                <td class="n"><b>${fmt(calc)}</b></td>
                <td class="n">${diff ? `<span class="ai-diff">${fmt(written - calc)}</span>` : '✓'}</td>
            </tr>`;
        };
        return `<div class="ai-sec">💰 الإجماليات</div>
        <table class="ai-totals">
            <thead><tr><th></th><th class="n">المكتوب في الفاتورة</th><th class="n">المحسوب في النظام</th><th class="n">الفرق</th></tr></thead>
            <tbody>
                ${cmpRow('الإجمالي قبل الخصم', t.subtotalBeforeDiscount, comp.subtotal)}
                ${cmpRow('الخصم', t.discount, comp.discount)}
                ${cmpRow('المبلغ الخاضع للضريبة', t.taxable, comp.taxable)}
                ${cmpRow('ضريبة القيمة المضافة', t.vat, comp.vat)}
                ${cmpRow('الإجمالي شامل الضريبة', t.grandTotal, comp.grandTotal)}
            </tbody>
        </table>
        ${comp.rates.length > 1 ? `<div class="ai-rates"><b>تفصيل نسب الضريبة:</b>
            ${comp.rates.map(r => `<span class="ai-rate">${r.rate}% على ${fmt(r.taxable)} = ${fmt(r.vat)} <i>(${r.count} بند)</i></span>`).join('')}</div>` : ''}
        <div class="ai-meta">🔒 القيم المعتمدة في القيد المحاسبي هي <b>المحسوبة في النظام</b> دائماً.</div>`;
    }

    function auditSection(c) {
        const edits = c.edits || [];
        return `<div class="ai-sec">🕵️ أثر التدقيق ${edits.length ? `<span class="badge">${edits.length}</span>` : ''}</div>
        ${edits.length === 0
                ? '<div class="ai-meta">لم تُعدَّل أي قيمة استخرجها الذكاء الاصطناعي بعد.</div>'
                : `<table class="ai-audit"><thead><tr><th>الحقل</th><th>قيمة الذكاء الاصطناعي</th><th>قيمة المستخدم</th><th>بواسطة</th><th>الوقت</th></tr></thead>
            <tbody>${edits.slice(-30).reverse().map(e => `<tr>
                <td>${esc(e.field)}</td><td class="old">${esc(e.aiValue || '—')}</td><td class="new">${esc(e.userValue || '—')}</td>
                <td>${esc(e.by || '')}</td><td>${e.at ? new Date(e.at).toLocaleString('ar-EG') : ''}</td></tr>`).join('')}</tbody></table>`}
        <div class="ai-meta">النموذج: ${esc(c.model || '—')} · زمن المعالجة: ${c.processingMs ? (c.processingMs / 1000).toFixed(1) + ' ث' : '—'}
            ${c.usage ? ` · التوكنات: ${(c.usage.input_tokens || 0) + (c.usage.output_tokens || 0)}` : ''}
            ${c.estCost ? ` · التكلفة التقديرية: $${c.estCost}` : ''}</div>`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-EDIT] التحرير مع أثر التدقيق
    // ═══════════════════════════════════════════════════════════════════════════
    function getPath(o, p) { return p.split('.').reduce((x, k) => (x == null ? x : x[k]), o); }
    function setPath(o, p, v) {
        const ks = p.split('.'); const last = ks.pop();
        const t = ks.reduce((x, k) => x[k], o);
        t[last] = v;
    }
    const NUM_PATHS = /\.(qty|unitPrice|discount|vatRate|taxable|vatAmount|total)$/;

    window.aiEdit = function (el) {
        const c = AIU.current; if (!c) return;
        const path = el.dataset.path;
        const before = getPath(c.extracted, path);
        let val = el.value;
        if (NUM_PATHS.test(path)) val = val === '' ? null : AINV.num(val);
        if (path === 'date' || path === 'dueDate') val = AINV.normDate(val) || val;
        if (String(before == null ? '' : before) === String(val == null ? '' : val)) return;

        setPath(c.extracted, path, val);
        c.edits = AINV.Audit.field(c, path, before, val);
        AIU.dirty = true;
        renderReview();
    };

    window.aiAddLine = function () {
        AIU.current.extracted.items.push({ idx: AIU.current.extracted.items.length, code: '', description: '', qty: 1, unit: '', unitPrice: 0, discount: null, taxable: null, vatRate: 15, vatAmount: null, total: null });
        AIU.current.itemMatches = AINV.matchItems(AIU.current.extracted.items).map(m => ({ key: m.key, score: m.score, reason: m.reason, exact: !!m.exact }));
        AIU.dirty = true; renderReview();
    };
    window.aiDelLine = function (i) {
        const c = AIU.current;
        const l = c.extracted.items[i];
        c.edits = AINV.Audit.field(c, `items.${i}`, (l && l.description) || '', '[محذوف]');
        c.extracted.items.splice(i, 1);
        c.itemMatches = AINV.matchItems(c.extracted.items).map(m => ({ key: m.key, score: m.score, reason: m.reason, exact: !!m.exact }));
        AIU.dirty = true; renderReview();
    };

    window.aiSetVendor = function (key) {
        const c = AIU.current;
        c.edits = AINV.Audit.field(c, 'vendorKey', c.vendorKey || '', key || '');
        c.vendorKey = key;
        AIU.dirty = true; renderReview();
    };

    window.aiCreateVendor = function () {
        const s = AIU.current.extracted.supplier;
        if (typeof window.openVendorModal === 'function') { window.openVendorModal(null, { nameAr: s.name, vatNumber: s.vatNumber, crNumber: s.crNumber, phone: s.phone, address: s.address }); return; }
        toast('ℹ️ افتح صفحة «الموردون» وأنشئ المورّد ببياناته، ثم عد واربطه هنا', 'ok', 9000);
    };

    window.aiFieldInfo = function (key) {
        const c = AIU.current, conf = c.confidence;
        const edit = (c.edits || []).filter(e => e.field.includes(key.replace('supplier_', 'supplier.').replace('invoice_', ''))).pop();
        alert(`الحقل: ${key}\nثقة الاستخراج: ${conf[key]}%\n` +
            (edit ? `قيمة الذكاء الاصطناعي الأصلية: ${edit.aiValue}\nقيمتك: ${edit.userValue}` : 'لم تُعدَّل هذه القيمة'));
    };

    window.aiDocZoom = function (d) {
        const img = $('aiDocImg'); if (!img) return;
        AIU.zoom = Math.max(0.3, Math.min(4, (AIU.zoom || 1) + d));
        img.style.transform = `rotate(${AIU.rot || 0}deg) scale(${AIU.zoom})`;
    };
    window.aiDocRotate = function () {
        const img = $('aiDocImg'); if (!img) return;
        AIU.rot = ((AIU.rot || 0) + 90) % 360;
        img.style.transform = `rotate(${AIU.rot}deg) scale(${AIU.zoom || 1})`;
    };

    window.aiShowDup = function (kind, key) {
        const rec = kind === 'pinv' ? (window.pinv || {})[key] : (window.aiInvoices || {})[key];
        if (!rec) { toast('السجل غير موجود', 'er'); return; }
        const e = rec.extracted || rec;
        alert(`الفاتورة السابقة:\n\nالرقم: ${e.vendorRef || e.number || '—'}\nالتاريخ: ${e.date || '—'}\nالإجمالي: ${fmt((e.totals && e.totals.grandTotal) || e.grandTotal)}\nالحالة: ${rec.status || '—'}`);
    };

    console.log('✅ AI Invoice UI [AIU] loaded');
})();
