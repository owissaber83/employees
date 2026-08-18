// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║   🤖 نظام استخراج وتدقيق وتصدير الفواتير — طبقة الواجهة (UI Layer)            ║
// ║   ────────────────────────────────────────────────────────────────────────    ║
// ║   [UI-PAGE]   الصفحة الرئيسية: الرفع · مؤشرات · الحصّة اليومية · القائمة        ║
// ║   [UI-QUEUE]  معالجة متعدّدة مستقلة — فشل فاتورة لا يُسقط البقية                ║
// ║   [UI-REVIEW] شاشة المراجعة: الأقسام · المشاكل · QR · المستند جنباً إلى جنب     ║
// ║   [UI-PROV]   شارات مصدر الحقل (Provenance) — من أين جاءت كل قيمة              ║
// ║   [UI-EDIT]   التحرير مع تسجيل كل تغيير في أثر التدقيق                         ║
// ║   [UI-LINK]   ربط المورّد والأصناف بسجلات النظام                               ║
// ║   [UI-DOC]    عارض المستند الأصلي (صورة/PDF) بجانب البيانات                    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
/* global AINV */

(function () {
    'use strict';

    const esc = window.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const $ = id => document.getElementById(id);
    const toast = (m, t, d) => (window.toast ? window.toast(m, t, d) : console.log(m));
    const fmt = n => (window.fmt ? window.fmt(n) : (Number(n) || 0).toFixed(2));

    const AIU = window.AIU = {
        current: null,      // السجل المفتوح في شاشة المراجعة
        tab: 'all',
        queue: [],
        busy: false,
        docPane: true       // إظهار المستند الأصلي بجانب البيانات
    };

    const CAN = a => AINV.may(a);
    const IS_ADMIN = () => (window.myP && window.myP.role === 'admin');

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-PAGE] الصفحة الرئيسية
    // ═══════════════════════════════════════════════════════════════════════════

    window.renderAiInvoices = function () {
        const pg = $('pg-aiinvoices'); if (!pg) return;
        if (!CAN('view')) { pg.innerHTML = '<div class="empty"><div class="ei">🚫</div><p>لا تملك صلاحية الوصول إلى قراءة الفواتير</p></div>'; return; }
        if (AIU.current) { renderReview(); return; }

        const cfg = AINV.Config.get();
        const ready = AINV.Config.ready();
        const recs = AINV.Store.all();
        const byStatus = {};
        recs.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
        const filtered = AIU.tab === 'all' ? recs : recs.filter(r => r.status === AIU.tab);
        const q = AINV.Quota.report();

        // مؤشرات تشغيلية: ما يحتاج تدخّلاً بشرياً الآن
        const needAction = recs.filter(r => ['needs_review', 'extracted', 'failed'].includes(r.status)).length;
        const blocked = recs.filter(r => AINV.Validate.hasBlocking(r.validation_issues)).length;
        const dupes = recs.filter(r => r.duplicate_warning && !r.duplicate_dismissed).length;
        const pendingValue = recs.filter(r => !['posted', 'rejected'].includes(r.status))
            .reduce((s, r) => s + ((r.totals && r.totals.grand_total) || 0), 0);

        pg.innerHTML = `
        <div id="aiRoot">
            ${ready.ok
                ? (IS_ADMIN() ? `<div class="ai-ready">
                    ✅ <b>الوحدة جاهزة</b>
                    <span class="ai-meta">— المحرك: ${esc(engineLabel(cfg))}</span>
                    <span style="flex:1"></span>
                    <button class="btn" onclick="aiQuotaPanel()">📊 الحصّة اليومية</button>
                    <button class="btn" onclick="aiAdminDashboard()">📈 لوحة المدير</button>
                    <button class="btn" onclick="aiSettings()">⚙️ الإعدادات</button>
                  </div>` : '')
                : `<div class="ai-warn">
                    ⚠️ <b>الوحدة غير جاهزة</b> — ${esc(ready.reason)}
                    ${IS_ADMIN() ? '<button class="btn b-b" style="margin-inline-start:10px" onclick="aiSettings()">⚙️ فتح الإعدادات</button>' : ''}
                  </div>`}

            <div class="card ai-hero">
                <div class="ai-hero-txt">
                    <h2>🤖 استخراج وتدقيق وتصدير الفواتير بالذكاء الاصطناعي</h2>
                    <p>ارفع فواتير الموردين — صوراً أو PDF — ليقرأها المحرك ويستخرج بياناتها، ثم
                       <b>يتحقّق النظام من كل عملية حسابية بنفسه</b>، ويفكّ رمز الزكاة والضريبة ويقارنه بوجه الفاتورة،
                       ويعرض كل ذلك لمراجعتك قبل أي اعتماد أو ترحيل.</p>
                    <div class="ai-hero-tags">
                        <span>🧮 الحساب في النظام لا في النموذج</span>
                        <span>🇸🇦 فكّ رمز ZATCA ومطابقته</span>
                        <span>🔎 مصدر كل حقل موثّق</span>
                        <span>👤 لا ترحيل بلا موافقتك</span>
                        <span>🕵️ أثر تدقيق كامل</span>
                    </div>
                </div>
                <div class="ai-drop ${ready.ok && CAN('upload') ? '' : 'off'}" id="aiDrop">
                    <div class="ai-drop-ic">📥</div>
                    <div class="ai-drop-t">اسحب الفواتير هنا</div>
                    <div class="ai-drop-s">يمكنك رفع عدة ملفات دفعة واحدة</div>
                    <button class="btn b-g" ${ready.ok && CAN('upload') ? '' : 'disabled'} onclick="document.getElementById('aiFileInput').click()">📂 اختر ملفات</button>
                    <input type="file" id="aiFileInput" multiple accept="application/pdf,image/jpeg,image/png,image/webp" style="display:none" onchange="aiHandleFiles(this.files);this.value=''">
                    <div class="ai-drop-hint">PDF · JPG · PNG · WEBP — حتى ${cfg.maxFileMB} م.ب للملف</div>
                </div>
            </div>

            ${recs.length ? `<div class="ai-kpis">
                ${kpi('👁️', 'تنتظر مراجعتك', needAction, needAction ? '#D97706' : '#1B8A4B')}
                ${kpi('⛔', 'بها مانع اعتماد', blocked, blocked ? '#C0392B' : '#1B8A4B')}
                ${kpi('👯', 'تكرار محتمل', dupes, dupes ? '#C0392B' : '#1B8A4B')}
                ${kpi('💰', 'قيمة غير مُرحَّلة', fmt(pendingValue), '#12336B')}
            </div>` : ''}

            ${ready.ok && recs.length ? quotaStrip(q) : ''}

            <div id="aiQueue"></div>

            <div class="card">
                <div class="tlb">
                    <div class="c-tl" style="margin:0;border:none;padding:0">🗂️ الفواتير المقروءة <span class="badge">${recs.length}</span></div>
                    <span style="flex:1"></span>
                    <input type="text" id="aiSearch" class="ai-inp" style="max-width:240px" placeholder="🔍 مورّد / رقم فاتورة…" oninput="aiFilterList()">
                    ${recs.length ? '<button class="btn" onclick="aiExportListExcel()">📊 تصدير القائمة</button>' : ''}
                    ${IS_ADMIN() ? '<button class="btn" onclick="aiProcessingLog()">📋 سجل المعالجة</button>' : ''}
                </div>
                <div class="ai-tabs">
                    ${tabBtn('all', 'الكل', recs.length)}
                    ${['needs_review', 'validated', 'approved', 'posted', 'exported', 'rejected', 'failed']
                .map(s => tabBtn(s, AINV.STATUS[s].ar, byStatus[s] || 0)).join('')}
                </div>
                ${filtered.length === 0
                ? `<div class="empty"><div class="ei">📄</div><p>${recs.length ? 'لا فواتير في هذا التصنيف' : 'لم تُرفع أي فاتورة بعد — ابدأ بسحب ملف إلى الأعلى'}</p></div>`
                : `<div class="tw"><table class="ai-tbl" id="aiTbl">
                    <thead><tr>
                        <th>الحالة</th><th>المورّد</th><th>رقم الفاتورة</th><th>النوع</th><th>التاريخ</th>
                        <th class="n">قبل الضريبة</th><th class="n">الضريبة</th><th class="n">الإجمالي</th>
                        <th class="n">الثقة</th><th>تحقّق</th><th>الإجراء</th>
                    </tr></thead>
                    <tbody>${filtered.map(row).join('')}</tbody>
                </table></div>`}
            </div>
        </div>`;

        setupDrop();
        renderQueue();
    };

    function engineLabel(cfg) {
        return (cfg.provider || 'gemini') === 'gemini'
            ? 'Gemini · ' + (cfg.geminiModel || 'gemini-2.5-flash')
            : 'Claude · ' + cfg.model;
    }

    function kpi(icon, label, value, color) {
        return `<div class="ai-kpi" style="border-inline-start-color:${color}">
            <div class="ai-kpi-l">${icon} ${esc(label)}</div>
            <div class="ai-kpi-v" style="color:${color}">${esc(String(value))}</div>
        </div>`;
    }

    /** شريط الاستهلاك اليومي — يعرض ما قِيس فعلاً، والسقف إن كان معروفاً. */
    function quotaStrip(q) {
        const known = q.dailyLimitKnown && q.totalDailyLimit;
        const pct = known ? Math.round((q.totalInvoicesToday / q.totalDailyLimit) * 100) : 0;
        const color = !known ? '#2E75B6' : pct >= 90 ? '#C0392B' : pct >= 70 ? '#D97706' : '#1B8A4B';
        return `<div class="ai-quota-strip" onclick="aiQuotaPanel()" title="اضغط لتفاصيل الاستهلاك لكل نموذج">
            <span class="ai-qs-ic">⚡</span>
            <span><b>${q.totalInvoicesToday}</b> فاتورة اليوم${known ? ` من <b>${q.totalDailyLimit}</b>` : ''}</span>
            ${known ? `<div class="ai-qs-bar"><i style="width:${Math.min(100, pct)}%;background:${color}"></i></div>` : '<span style="flex:1"></span>'}
            <span class="ai-meta">تتجدّد الحصص بعد ${q.hoursUntilReset}س ${q.minutesUntilReset}د</span>
            ${known ? '' : '<span class="ai-pill">السقف اليومي غير معروف</span>'}
            ${q.autoFallbackEnabled ? '<span class="ai-pill ok">سقوط تلقائي بين النماذج</span>' : ''}
        </div>`;
    }

    function tabBtn(id, label, n) {
        return `<button class="ai-tab ${AIU.tab === id ? 'act' : ''}" onclick="aiTab('${id}')">${esc(label)} <i>${n}</i></button>`;
    }
    window.aiTab = t => { AIU.tab = t; window.renderAiInvoices(); };

    function row(r) {
        const st = AINV.STATUS[r.status] || AINV.STATUS.uploaded;
        const t = r.totals || {};
        const sum = AINV.Validate.summary(r.validation_issues);
        const conf = r.confidence_percent;
        const th = Math.round(AINV.Config.get().confidenceThreshold * 100);
        const confClass = conf == null ? '' : (conf >= th ? 'ok' : conf >= th - 15 ? 'wn' : 'er');

        const checks = [];
        if (r.qr_code && r.qr_code.is_zatca_compliant) {
            const bad = AINV.toArray(r.qr_code.mismatches).length;
            checks.push(bad
                ? `<span class="ai-chk er" title="رمز QR يخالف وجه الفاتورة في ${bad} حقل">QR ✗</span>`
                : '<span class="ai-chk ok" title="رمز الزكاة والضريبة مطابق لوجه الفاتورة">QR ✓</span>');
        }
        if (sum.blocking) checks.push(`<span class="ai-chk er" title="${sum.blocking} مانع اعتماد">⛔ ${sum.blocking}</span>`);
        else if (sum.warnings) checks.push(`<span class="ai-chk wn" title="${sum.warnings} تحذير">⚠️ ${sum.warnings}</span>`);
        else if (r.validation_issues) checks.push('<span class="ai-chk ok" title="لا ملاحظات">✓</span>');
        if (r.duplicate_warning && !r.duplicate_dismissed) checks.push('<span class="ai-chk er" title="تكرار محتمل">👯</span>');

        const search = ((r.supplier && r.supplier.name) || '') + ' ' + (r.invoice_number || '') + ' ' + ((r.file_metadata && r.file_metadata.original_filename) || '');

        return `<tr data-search="${esc(search)}">
            <td><span class="ai-badge" style="background:${st.color}1a;color:${st.color};border-color:${st.color}55">${st.icon} ${esc(st.ar)}</span></td>
            <td>${esc((r.supplier && r.supplier.name) || '—')}
                ${r.vendorKey ? '<span class="ai-lnk" title="مربوطة بمورد في النظام">🔗</span>' : '<span class="ai-new" title="لم تُربط بمورد بعد">جديد</span>'}</td>
            <td class="mono">${esc(r.invoice_number || '—')}</td>
            <td><span class="ai-meta">${esc(AINV.DOC_TYPE_AR[r.document_type] || '—')}</span></td>
            <td class="mono">${esc(r.invoice_date || '—')}</td>
            <td class="n">${t.taxable_amount == null ? '—' : fmt(t.taxable_amount)}</td>
            <td class="n">${t.vat_total == null ? '—' : fmt(t.vat_total)}</td>
            <td class="n"><b>${t.grand_total == null ? '—' : fmt(t.grand_total)}</b></td>
            <td class="n">${conf == null ? '—' : `<span class="ai-conf ${confClass}">${conf}%</span>`}</td>
            <td class="ai-checks">${checks.join('') || '—'}</td>
            <td class="ai-acts">
                <button class="btn" onclick="aiOpen('${r.id}')" title="فتح للمراجعة">👁️</button>
                ${CAN('delete') && !AINV.isLocked(r) ? `<button class="btn b-r" onclick="aiDelete('${r.id}')" title="حذف">🗑️</button>` : ''}
            </td>
        </tr>`;
    }

    window.aiFilterList = function () {
        const q = ($('aiSearch').value || '').trim().toLowerCase();
        document.querySelectorAll('#aiTbl tbody tr').forEach(tr => {
            tr.style.display = !q || (tr.dataset.search || '').toLowerCase().includes(q) ? '' : 'none';
        });
    };

    // ── السحب والإفلات ───────────────────────────────────────────────────────
    function setupDrop() {
        const el = $('aiDrop'); if (!el || el.classList.contains('off')) return;
        ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.add('over'); }));
        ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.remove('over'); }));
        el.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files) window.aiHandleFiles(e.dataTransfer.files); });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-QUEUE] معالجة متعدّدة مستقلة
    // ───────────────────────────────────────────────────────────────────────────
    // كل ملف وظيفة قائمة بذاتها: فشل ملف لا يُسقط الدفعة، ولا يُخفي ما نجح.
    // ═══════════════════════════════════════════════════════════════════════════

    window.aiHandleFiles = function (fileList) {
        if (!CAN('upload')) { toast('لا تملك صلاحية رفع الفواتير ومعالجتها', 'er'); return; }
        const ready = AINV.Config.ready();
        if (!ready.ok) { toast('⚠️ ' + ready.reason, 'er', 8000); return; }

        const files = Array.from(fileList || []);
        if (!files.length) return;

        files.forEach(file => {
            const check = AINV.validateFile(file);
            const job = {
                jobId: 'job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                file, name: file.name, size: file.size,
                mediaType: check.mediaType || file.type,
                state: check.ok ? 'queued' : 'error',
                message: check.ok ? 'في الانتظار…' : check.reason,
                progress: 0, recId: ''
            };
            AIU.queue.push(job);
        });

        renderQueue();
        pump();
    };

    /** يعالج المهام واحدة تلو الأخرى — التوازي يستنزف حدّ الطلبات في الدقيقة. */
    async function pump() {
        if (AIU.busy) return;
        AIU.busy = true;
        try {
            for (;;) {
                const job = AIU.queue.find(j => j.state === 'queued');
                if (!job) break;
                await processJob(job);
            }
        } finally {
            AIU.busy = false;
            renderQueue();
            if (!AIU.current) window.renderAiInvoices();
        }
    }

    async function processJob(job) {
        const started = Date.now();
        const set = (state, message, progress) => {
            job.state = state; job.message = message;
            if (progress != null) job.progress = progress;
            renderQueue();
        };

        set('running', 'تحضير الملف…', 0.05);
        let recId = '';
        try {
            const cfg = AINV.Config.get();
            const [b64, sha] = await Promise.all([AINV.fileToBase64(job.file), AINV.sha256(job.file)]);

            // 1) سجل مبدئي — يظهر الملف في القائمة حتى لو فشل الاستخراج بعدها
            set('running', 'إنشاء السجل…', 0.12);
            recId = await AINV.Store.create({
                status: 'processing',
                uploadedAt: Date.now(),
                created_at: new Date().toISOString(),
                created_by: (window.myP && window.myP.name) || (window.curU && window.curU.email) || '',
                file_metadata: {
                    original_filename: job.name, file_size_bytes: job.size,
                    mime_type: job.mediaType, sha256: sha,
                    upload_timestamp: new Date().toISOString()
                }
            });
            job.recId = recId;

            // 2) رفع الملف الأصلي (اختياري — الملف والسجل كيانان منفصلان)
            set('running', 'حفظ الملف الأصلي…', 0.2);
            let fileInfo = { url: '' };
            try { fileInfo = await AINV.Store.uploadFile(job.file); }
            catch (e) { fileInfo = { url: '', note: 'تعذّر حفظ الملف: ' + (e.message || '') }; }

            // 3) الاستخراج
            set('running', 'جارٍ القراءة بالذكاء الاصطناعي…', 0.3);
            const out = await AINV.extractInvoice(job.file, b64, job.mediaType, (msg, p) => set('running', msg, p));

            // 4) التطبيع + التحقق + المطابقة + التكرار
            set('running', 'التحقق الحسابي والمطابقة…', 0.9);
            const doc = AINV.map(out.data, { provider: out.provider, model: out.model, viaOcr: out.viaOcr });
            const issues = AINV.Validate.run(doc);
            const conf = AINV.confidence(doc, issues);

            const vendorMatch = cfg.autoSuggestSupplier ? AINV.Match.supplier(doc.supplier) : { key: '', confidence: 0, match_type: 'NO_MATCH', is_new: true };
            const itemMatches = cfg.autoSuggestItems ? AINV.Match.allItems(doc).map(m => ({ key: m.key, confidence: m.confidence, match_type: m.match_type, name: m.item && m.item.name })) : [];

            const rec = Object.assign({}, doc, {
                id: recId,
                file_metadata: Object.assign({
                    original_filename: job.name, file_size_bytes: job.size,
                    mime_type: job.mediaType, sha256: sha,
                    upload_timestamp: new Date().toISOString(),
                    page_count: out.pageCount || 1
                }, fileInfo.url ? { url: fileInfo.url, storage_provider: fileInfo.provider, storage_id: fileInfo.providerId } : { storage_note: fileInfo.note || '' }),
                validation_issues: issues,
                confidence_percent: conf.percent,
                confidence_overall: conf.overall,
                low_fields: conf.lowFields,
                vendorKey: vendorMatch.key || '',
                vendorMatch: { confidence: vendorMatch.confidence, match_type: vendorMatch.match_type, is_new: vendorMatch.is_new },
                itemMatches,
                processing_job: {
                    job_id: job.jobId, model_used: out.model || '', ai_provider: out.provider || 'gemini',
                    started_at: new Date(started).toISOString(), completed_at: new Date().toISOString(),
                    duration_ms: Date.now() - started,
                    tokens_used: out.usage || {}, estimated_cost_usd: AINV.estimateCost(out.model, out.usage),
                    via_ocr: !!out.viaOcr, retry_count: 0
                }
            });

            const dup = AINV.Dup.detect(rec, window.aiInvoices, recId);
            if (dup) rec.duplicate_warning = dup;
            const dupPInv = AINV.Dup.againstPurchases(rec);
            if (dupPInv) rec.duplicate_purchase = dupPInv;

            // 5) الحالة: لا تُعتبر «مستخرَجة» إلا إن خلت من الموانع وبلغت حدّ الثقة
            const blocking = AINV.Validate.hasBlocking(issues);
            rec.status = (blocking || conf.overall < cfg.confidenceThreshold || dup || out.viaOcr) ? 'needs_review' : 'extracted';
            rec.uploadedAt = Date.now();

            rec.audit_trail = [AINV.Audit.event({
                action: 'AI_EXTRACTION_COMPLETED', action_ar: 'اكتمل الاستخراج بالذكاء الاصطناعي',
                source: out.viaOcr ? 'ocr_extraction' : (out.provider === 'anthropic' ? 'claude_extraction' : 'gemini_extraction'),
                notes: `النموذج: ${out.model} · الثقة: ${conf.percent}% · الملاحظات: ${issues.length}`
            })];

            delete rec.id;
            await AINV.Store.update(recId, rec);

            await AINV.Store.log(recId, {
                event: 'extract', model: out.model, provider: out.provider,
                durationMs: Date.now() - started, tokensIn: (out.usage && out.usage.input_tokens) || 0,
                tokensOut: (out.usage && out.usage.output_tokens) || 0,
                cost: AINV.estimateCost(out.model, out.usage), viaOcr: !!out.viaOcr,
                confidence: conf.percent, issues: issues.length, status: rec.status
            });

            AINV.Audit.log('استخراج فاتورة', `${job.name} — ${doc.invoice_number || 'بلا رقم'} — ثقة ${conf.percent}%`, { recordId: recId });

            set('done', `تمّت القراءة — ثقة ${conf.percent}%${blocking ? ' · بها مانع اعتماد' : ''}`, 1);
            job.recId = recId;

        } catch (e) {
            const msg = (e && e.message) || 'فشل غير معروف';
            set('error', msg, 1);
            if (recId) {
                try {
                    await AINV.Store.update(recId, { status: 'failed', failure_reason: msg });
                    await AINV.Store.log(recId, { event: 'extract_failed', error: msg, code: e && e.code });
                } catch (e2) { /* السجل ثانوي */ }
            }
            console.warn('AI invoice job failed:', e);
        }
    }

    function renderQueue() {
        const el = $('aiQueue'); if (!el) return;
        const active = AIU.queue.filter(j => j.state !== 'dismissed');
        if (!active.length) { el.innerHTML = ''; return; }

        el.innerHTML = `<div class="card ai-queue">
            <div class="tlb">
                <div class="c-tl" style="margin:0;border:none;padding:0">⚙️ قائمة المعالجة <span class="badge">${active.length}</span></div>
                <span style="flex:1"></span>
                ${active.every(j => j.state === 'done' || j.state === 'error') ? '<button class="btn" onclick="aiClearQueue()">🧹 إخفاء المنتهية</button>' : ''}
            </div>
            ${active.map(jobRow).join('')}
        </div>`;
    }

    function jobRow(j) {
        const ICON = { queued: '⏸️', running: '⏳', done: '✅', error: '⚠️' };
        return `<div class="ai-job ${j.state}">
            <div class="ai-job-h">
                <span>${ICON[j.state] || '•'}</span>
                <b>${esc(j.name)}</b>
                <span class="ai-meta">${(j.size / 1048576).toFixed(2)} م.ب</span>
                <span style="flex:1"></span>
                <span class="ai-meta">${esc(j.message)}</span>
                ${j.state === 'done' && j.recId ? `<button class="btn b-g" onclick="aiOpen('${j.recId}')">مراجعة</button>` : ''}
            </div>
            ${j.state === 'running' ? `<div class="ai-job-bar"><i style="width:${Math.round((j.progress || 0) * 100)}%"></i></div>` : ''}
        </div>`;
    }

    window.aiClearQueue = function () {
        AIU.queue = AIU.queue.filter(j => j.state === 'queued' || j.state === 'running');
        renderQueue();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-REVIEW] شاشة مراجعة الفاتورة المستخرجة
    // ═══════════════════════════════════════════════════════════════════════════

    window.aiOpen = function (id) {
        const rec = AINV.Store.normalize(id, (window.aiInvoices || {})[id]);
        if (!rec) { toast('لم يُعثر على السجل', 'er'); return; }
        AIU.current = rec;
        AIU.dirty = false;
        renderReview();
        const pg = $('pg-aiinvoices'); if (pg) pg.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.aiBack = function () {
        if (AIU.dirty && !confirm('لديك تعديلات غير محفوظة — هل تريد الخروج وفقدانها؟')) return;
        AIU.current = null; AIU.dirty = false;
        window.renderAiInvoices();
    };

    function renderReview() {
        const pg = $('pg-aiinvoices'); if (!pg) return;
        const r = AIU.current; if (!r) { window.renderAiInvoices(); return; }

        const st = AINV.STATUS[r.status] || AINV.STATUS.uploaded;
        const locked = AINV.isLocked(r);
        const sum = AINV.Validate.summary(r.validation_issues);
        const comp = AINV.recompute(r).computed;
        const fileUrl = (r.file_metadata && r.file_metadata.url) || '';

        pg.innerHTML = `
        <div id="aiRoot" class="ai-review">
            <div class="ai-rv-bar">
                <button class="btn" onclick="aiBack()">→ رجوع للقائمة</button>
                <span class="ai-badge" style="background:${st.color}1a;color:${st.color};border-color:${st.color}55">${st.icon} ${esc(st.ar)}</span>
                <b class="ai-rv-title">${esc(r.invoice_number || 'بلا رقم')} — ${esc((r.supplier && r.supplier.name) || 'مورد غير محدّد')}</b>
                <span class="ai-meta">${esc(AINV.DOC_TYPE_AR[r.document_type] || '')}</span>
                <span style="flex:1"></span>
                ${r.confidence_percent != null ? `<span class="ai-conf ${confClass(r.confidence_percent)}" title="ثقة النظام (لا ثقة النموذج وحدها)">ثقة ${r.confidence_percent}%</span>` : ''}
                <button class="btn" onclick="aiAuditTrail()" title="من غيّر ماذا ومتى">🕵️ أثر التدقيق</button>
                ${fileUrl ? `<button class="btn" onclick="aiToggleDoc()">${AIU.docPane ? '🗕 إخفاء المستند' : '🗖 عرض المستند'}</button>` : ''}
            </div>

            ${r.duplicate_warning && !r.duplicate_dismissed ? dupBanner(r) : ''}
            ${r.duplicate_purchase ? `<div class="ai-banner er">
                <b>⛔ تكرار مقابل فواتير المشتريات</b><div>${esc(r.duplicate_purchase.message_ar)}</div>
                <button class="btn" onclick="nav('purchaseinvoices')">فتح فواتير المشتريات</button>
            </div>` : ''}
            ${r.status === 'failed' ? `<div class="ai-banner er"><b>⚠️ فشل الاستخراج</b><div>${esc(r.failure_reason || '')}</div>
                ${CAN('upload') ? '<button class="btn b-b" onclick="aiRetry()">↻ إعادة المحاولة</button>' : ''}</div>` : ''}
            ${(r.processing_job && r.processing_job.via_ocr) ? `<div class="ai-banner wn">
                <b>👓 قُرئت بالـOCR المحلي المجاني</b>
                <div>نفدت حصّة النماذج فقُرئ المستند محلياً — كل الحقول تقديرية ويلزم مراجعتها بالكامل قبل الاعتماد.</div></div>` : ''}
            ${AINV.toArray(r.model_warnings).length ? `<div class="ai-banner wn"><b>ملاحظات المحرك على المستند</b>
                <ul>${AINV.toArray(r.model_warnings).map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}

            <div class="ai-rv-grid ${AIU.docPane && fileUrl ? 'with-doc' : ''}">
                <div class="ai-rv-main">
                    ${issuesPanel(r, sum)}
                    ${qrPanel(r)}
                    ${sectionDocument(r, locked)}
                    ${sectionSupplier(r, locked)}
                    ${sectionCustomer(r, locked)}
                    ${sectionItems(r, locked, comp)}
                    ${sectionTotals(r, locked, comp)}
                    ${sectionPosting(r, locked)}
                </div>
                ${AIU.docPane && fileUrl ? `<div class="ai-rv-doc">${docViewer(r)}</div>` : ''}
            </div>

            ${actionBar(r, locked, sum)}
        </div>`;

        const lt = $('aiLinesTbl');
        if (lt) bindResize(lt);

        if (typeof window.ssEnhance === 'function') {
            pg.querySelectorAll('select[data-ss="1"]').forEach(s => { try { window.ssEnhance(s); } catch (e) { /* اختياري */ } });
        }
    }

    function confClass(p) {
        const th = Math.round(AINV.Config.get().confidenceThreshold * 100);
        return p >= th ? 'ok' : p >= th - 15 ? 'wn' : 'er';
    }

    function dupBanner(r) {
        const d = r.duplicate_warning;
        return `<div class="ai-banner er">
            <b>👯 ${d.is_exact_file ? 'نفس الملف مرفوع من قبل' : 'احتمال تكرار'} — تطابق ${Math.round(d.similarity_score * 100)}%</b>
            <div>${esc(d.message_ar)}</div>
            <div class="ai-dup-acts">
                <button class="btn" onclick="aiOpen('${d.existing_invoice_id}')">فتح الفاتورة السابقة</button>
                ${CAN('override') ? `<button class="btn b-b" onclick="aiDismissDup()">ليست تكراراً — تجاهل</button>` : ''}
            </div>
        </div>`;
    }

    // ── لوحة المشاكل ─────────────────────────────────────────────────────────
    function issuesPanel(r, sum) {
        const list = AINV.toArray(r.validation_issues);
        if (!list.length) return `<div class="ai-sec ok-sec"><div class="ai-sec-h">✅ التحقق</div>
            <div class="ai-sec-b"><div class="ai-ok">لم يرصد النظام أي ملاحظة حسابية أو نظامية على هذه الفاتورة.</div></div></div>`;

        const SEV = { ERROR: { ic: '⛔', cls: 'er', ar: 'خطأ' }, WARNING: { ic: '⚠️', cls: 'wn', ar: 'تحذير' }, INFO: { ic: 'ℹ️', cls: 'in', ar: 'ملاحظة' } };
        return `<div class="ai-sec">
            <div class="ai-sec-h">🔍 نتائج التحقق
                <span class="ai-meta">${sum.errors} خطأ · ${sum.warnings} تحذير · ${sum.info} ملاحظة${sum.overridden ? ` · ${sum.overridden} متجاوَز` : ''}</span>
                ${sum.blocking ? `<span class="ai-pill er">${sum.blocking} مانع اعتماد</span>` : '<span class="ai-pill ok">لا مانع للاعتماد</span>'}
            </div>
            <div class="ai-sec-b">
                <div class="ai-issues">
                ${list.map((i, idx) => {
            const s = SEV[i.severity] || SEV.INFO;
            return `<div class="ai-issue ${s.cls} ${i.resolved ? 'resolved' : ''}">
                        <div class="ai-issue-h">
                            <span class="ai-issue-ic">${s.ic}</span>
                            <b>${esc(i.message_ar || i.message)}</b>
                            ${i.blocking && !i.resolved ? '<span class="ai-pill er">يمنع الاعتماد</span>' : ''}
                            ${i.resolved ? '<span class="ai-pill ok">متجاوَز</span>' : ''}
                        </div>
                        <div class="ai-issue-m">
                            <code>${esc(i.code)}</code>
                            ${i.actual_value != null ? `<span>القيمة: <b>${esc(String(i.actual_value))}</b></span>` : ''}
                            ${i.expected_value != null ? `<span>المتوقّع: <b>${esc(String(i.expected_value))}</b></span>` : ''}
                            ${i.resolved && i.override_reason ? `<span class="ai-ovr">تجاوَزه ${esc(i.override_by || '')}: ${esc(i.override_reason)}</span>` : ''}
                        </div>
                        ${i.blocking && !i.resolved && CAN('override') ? `<button class="btn b-w" onclick="aiOverride(${idx})">تجاوُز مسبَّب…</button>` : ''}
                    </div>`;
        }).join('')}
                </div>
            </div>
        </div>`;
    }

    // ── لوحة رمز الزكاة والضريبة ──────────────────────────────────────────────
    function qrPanel(r) {
        const q = r.qr_code;
        if (!q) return `<div class="ai-sec"><div class="ai-sec-h">🇸🇦 رمز الزكاة والضريبة (QR)</div>
            <div class="ai-sec-b"><div class="ai-note">لم يُرصد رمز استجابة سريعة في هذا المستند — لا مقارنة مستقلة ممكنة، اعتمد على المراجعة البصرية.</div></div></div>`;

        if (!q.is_zatca_compliant) return `<div class="ai-sec"><div class="ai-sec-h">🇸🇦 رمز الاستجابة السريعة</div>
            <div class="ai-sec-b"><div class="ai-note">رُصد رمز لكنه ليس بصيغة TLV المعتمدة من الهيئة (قد يكون رابطاً أو نصّاً حرّاً) — لا يصلح للمطابقة.</div></div></div>`;

        const mis = AINV.toArray(q.mismatches);
        const rowQ = (label, qv, dv, bad) => `<tr class="${bad ? 'bad' : ''}">
            <td>${esc(label)}</td><td class="mono">${esc(qv == null ? '—' : String(qv))}</td>
            <td class="mono">${esc(dv == null ? '—' : String(dv))}</td>
            <td>${bad ? '<span class="ai-pill er">مختلف</span>' : '<span class="ai-pill ok">مطابق</span>'}</td></tr>`;
        const has = f => mis.some(m => m.field === f);

        return `<div class="ai-sec ${mis.length ? 'er-sec' : 'ok-sec'}">
            <div class="ai-sec-h">🇸🇦 رمز الزكاة والضريبة (ZATCA QR)
                ${mis.length ? `<span class="ai-pill er">${mis.length} اختلاف عن وجه الفاتورة</span>` : '<span class="ai-pill ok">مطابق تماماً</span>'}
                ${q.has_phase2_signature ? '<span class="ai-pill ok">موقّع — المرحلة الثانية</span>' : '<span class="ai-pill">المرحلة الأولى</span>'}
            </div>
            <div class="ai-sec-b">
                <p class="ai-note">الرمز يُطبع من نظام المورد المحاسبي. اختلافه عمّا هو مطبوع على وجه الفاتورة إشارة جدّية إلى تعديل أو تزوير — وهو ما لا يكشفه أي استخراج نصّي.</p>
                <div class="tw"><table class="ai-tbl sm">
                    <thead><tr><th>الحقل</th><th>في الرمز</th><th>على وجه الفاتورة</th><th>النتيجة</th></tr></thead>
                    <tbody>
                        ${rowQ('اسم البائع', q.seller_name, (r.supplier && r.supplier.name), has('seller_name'))}
                        ${rowQ('الرقم الضريبي', q.vat_registration_number, (r.supplier && r.supplier.vat_number), has('vat_number'))}
                        ${rowQ('الإجمالي شامل الضريبة', q.invoice_total_with_vat, (r.totals && r.totals.grand_total), has('grand_total'))}
                        ${rowQ('مبلغ الضريبة', q.vat_total, (r.totals && r.totals.vat_total), has('vat_total'))}
                        ${q.invoice_timestamp ? `<tr><td>ختم الوقت</td><td class="mono" colspan="3">${esc(q.invoice_timestamp)}</td></tr>` : ''}
                    </tbody>
                </table></div>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-PROV] شارة مصدر الحقل
    // ───────────────────────────────────────────────────────────────────────────
    // كل قيمة تحمل من أين جاءت وبأي ثقة، وإن عدّلها المستخدم تُعرَض قيمة الذكاء
    // الاصطناعي الأصلية إلى جوارها. بلا هذا الأثر تصبح المراجعة توقيعاً على
    // المجهول.
    // ═══════════════════════════════════════════════════════════════════════════

    function provBadge(r, key) {
        const p = (r.provenance || {})[key];
        if (!p) return '';
        const SRC = { qr_code: { ic: '🇸🇦', cls: 'qr' }, user_input: { ic: '✍️', cls: 'usr' }, ocr_extraction: { ic: '👓', cls: 'ocr' }, calculated_value: { ic: '🧮', cls: 'calc' } };
        const s = SRC[p.source] || { ic: '🤖', cls: 'ai' };
        const pct = Math.round(AINV.clamp01(p.confidence) * 100);
        const title = `${AINV.SOURCE_AR[p.source] || p.source} — ثقة ${pct}%`
            + (p.evidence && p.evidence.snippet ? `\nكما ظهر: «${p.evidence.snippet}»` : '')
            + (p.user_modified && p.original_ai_value != null ? `\nقيمة الذكاء الاصطناعي الأصلية: ${p.original_ai_value}` : '');
        return `<span class="ai-prov ${s.cls} ${pct < 80 && !p.user_modified ? 'low' : ''}" title="${esc(title)}">${s.ic} ${pct}%</span>`
            + (p.user_modified ? `<span class="ai-prov-edited" title="${esc('القيمة الأصلية من الذكاء الاصطناعي: ' + (p.original_ai_value == null ? '—' : p.original_ai_value))}">عُدِّل</span>` : '');
    }

    /** حقل نصّي محرَّر مع شارة مصدره. */
    function fld(r, label, path, provKey, locked, type) {
        const v = getPath(r, path);
        return `<div class="ai-f">
            <label class="ai-f-l">${esc(label)} ${provKey ? provBadge(r, provKey) : ''}</label>
            <input class="ai-inp" type="${type || 'text'}" value="${esc(v == null ? '' : v)}"
                ${locked ? 'disabled' : ''} data-path="${esc(path)}" onchange="aiEditField(this)">
        </div>`;
    }

    function getPath(o, path) {
        return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
    }

    // ── القسم 1: بيانات المستند ──────────────────────────────────────────────
    function sectionDocument(r, locked) {
        const types = Object.keys(AINV.DOC_TYPE_AR);
        return `<div class="ai-sec"><div class="ai-sec-h">📄 بيانات المستند</div>
        <div class="ai-sec-b"><div class="ai-grid2">
            <div class="ai-f">
                <label class="ai-f-l">نوع المستند</label>
                <select class="ai-inp" data-ss="1" ${locked ? 'disabled' : ''} data-path="document_type" onchange="aiEditField(this)">
                    ${types.map(t => `<option value="${t}" ${r.document_type === t ? 'selected' : ''}>${esc(AINV.DOC_TYPE_AR[t])}</option>`).join('')}
                </select>
            </div>
            ${fld(r, 'رقم الفاتورة', 'invoice_number', 'invoice_number', locked)}
            ${fld(r, 'تاريخ الفاتورة', 'invoice_date', 'invoice_date', locked, 'date')}
            ${fld(r, 'تاريخ الاستحقاق', 'due_date', 'due_date', locked, 'date')}
            ${fld(r, 'رقم أمر الشراء', 'purchase_order_number', null, locked)}
            ${fld(r, 'الرقم المرجعي', 'reference_number', null, locked)}
            ${fld(r, 'العملة', 'currency', 'currency', locked)}
            ${r.hijri_date ? `<div class="ai-f"><label class="ai-f-l">التاريخ الهجري</label><input class="ai-inp" value="${esc(r.hijri_date)}" disabled></div>` : ''}
        </div>
        ${r.date_ambiguous && r.date_alt ? `<div class="ai-note wn">📅 التاريخ غامض: قد يكون <b>${esc(r.invoice_date)}</b> أو <b>${esc(r.date_alt)}</b> — يحدّد الفترة الضريبية، فأكّده من المستند.
            ${locked ? '' : `<button class="btn" onclick="aiUseAltDate()">استخدم ${esc(r.date_alt)}</button>`}</div>` : ''}
        </div></div>`;
    }

    // ── القسم 2: المورد + الربط ──────────────────────────────────────────────
    function sectionSupplier(r, locked) {
        const m = r.vendorMatch || {};
        const vendors = AINV.Match.systemVendors();
        const tinOk = AINV.Saudi.isValidTIN(r.supplier && r.supplier.vat_number);
        return `<div class="ai-sec"><div class="ai-sec-h">🏭 المورد
            ${r.vendorKey ? '<span class="ai-pill ok">مربوط بالنظام</span>' : '<span class="ai-pill wn">غير مربوط</span>'}
            ${m.match_type && m.match_type !== 'NO_MATCH' ? `<span class="ai-meta">${esc(AINV.Match.MATCH_AR[m.match_type] || '')} — ${Math.round((m.confidence || 0) * 100)}%</span>` : ''}
        </div>
        <div class="ai-sec-b">
            <div class="ai-match">
                <label class="ai-f-l">🔗 ربط بمورد في النظام <span class="ai-meta">(يحدّد كشف الحساب والرصيد الدائن — الربط الخاطئ يفسدهما معاً)</span></label>
                <div class="ai-match-row">
                    <select class="ai-inp" id="aiVendorSel" data-ss="1" ${locked ? 'disabled' : ''} onchange="aiLinkVendor(this.value)">
                        <option value="">— لم يُربط بعد —</option>
                        ${vendors.map(v => `<option value="${esc(v.key)}" ${r.vendorKey === v.key ? 'selected' : ''}>${esc(v.name)}${v.vat_number ? ' · ' + esc(v.vat_number) : ''}</option>`).join('')}
                    </select>
                    ${!locked && CAN('edit') ? '<button class="btn b-g" onclick="aiCreateVendor()">➕ إنشاء مورد جديد من هذه البيانات</button>' : ''}
                </div>
            </div>
            <div class="ai-grid2">
                ${fld(r, 'اسم المورد', 'supplier.name', 'supplier_name', locked)}
                ${fld(r, 'الاسم النظامي', 'supplier.legal_name', null, locked)}
                <div class="ai-f">
                    <label class="ai-f-l">الرقم الضريبي ${provBadge(r, 'supplier_vat')}
                        ${(r.supplier && r.supplier.vat_number) ? (tinOk ? '<span class="ai-pill ok">صيغة سليمة</span>' : '<span class="ai-pill wn">لا يطابق مواصفة الهيئة</span>') : ''}</label>
                    <input class="ai-inp mono" value="${esc((r.supplier && r.supplier.vat_number) || '')}" ${locked ? 'disabled' : ''} data-path="supplier.vat_number" onchange="aiEditField(this)">
                </div>
                ${fld(r, 'السجل التجاري', 'supplier.commercial_registration', 'supplier_cr', locked)}
                ${fld(r, 'الآيبان', 'supplier.iban', null, locked)}
                ${fld(r, 'الهاتف', 'supplier.phone', null, locked)}
                ${fld(r, 'البريد الإلكتروني', 'supplier.email', null, locked)}
                ${fld(r, 'المدينة', 'supplier.city', null, locked)}
            </div>
            ${fld(r, 'العنوان', 'supplier.address', null, locked)}
        </div></div>`;
    }

    // ── القسم 3: العميل ──────────────────────────────────────────────────────
    function sectionCustomer(r, locked) {
        const c = r.customer || {};
        if (!c.name && !c.vat_number && !c.address) return '';
        return `<div class="ai-sec"><div class="ai-sec-h">🧑‍💼 العميل (المشتري)</div>
        <div class="ai-sec-b"><div class="ai-grid2">
            ${fld(r, 'اسم العميل', 'customer.name', null, locked)}
            ${fld(r, 'الرقم الضريبي', 'customer.vat_number', null, locked)}
            ${fld(r, 'السجل التجاري', 'customer.commercial_registration', null, locked)}
            ${fld(r, 'العنوان', 'customer.address', null, locked)}
        </div></div></div>`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // [UI-GRID] جدول البنود — أعمدة قابلة للسحب وتفضيلات تدوم
    // ───────────────────────────────────────────────────────────────────────────
    // أسماء بنود المقاولات طويلة بطبعها («سلك مفرد 4 مم الرياض أحمر»)، وعمودٌ
    // ثابت العرض يقصّها فيراجع المحاسب ما لا يقرأه. الأعرض حلٌّ ناقص لأن الشاشات
    // تختلف — فالتحكّم يُسلَّم للمستخدم ويُحفظ لديه.
    //
    // الأعراض تُطبَّق عبر <colgroup> مع table-layout:fixed: هذه هي الطريقة
    // الوحيدة التي يحترم فيها المتصفح عرضاً محدّداً بدل توزيعه حسب المحتوى.
    // ═══════════════════════════════════════════════════════════════════════════

    const COLS = [
        { k: 'idx', l: '#', w: 34, fixed: true },
        { k: 'item_name', l: 'الوصف', w: 300 },
        { k: 'link', l: 'الربط بالصنف', w: 150, opt: true },
        { k: 'quantity', l: 'الكمية', w: 78, n: true },
        { k: 'unit', l: 'الوحدة', w: 78 },
        { k: 'unit_price', l: 'سعر الوحدة', w: 96, n: true },
        { k: 'discount', l: 'الخصم', w: 84, n: true, opt: true },
        { k: 'taxable', l: 'الخاضع', w: 104, n: true },
        { k: 'vat_rate', l: '%', w: 52, n: true },
        { k: 'vat_amount', l: 'الضريبة', w: 96, n: true },
        { k: 'total', l: 'الإجمالي', w: 108, n: true }
    ];
    const GRID_KEY = 'gbr_ai_lines_grid';

    const Grid = {
        prefs: null,
        load() {
            if (Grid.prefs) return Grid.prefs;
            let saved = {};
            try { saved = JSON.parse(localStorage.getItem(GRID_KEY) || '{}'); } catch (e) { /* تفضيل ثانوي */ }
            Grid.prefs = {
                w: saved.w || {},
                hidden: saved.hidden || {},
                wrap: saved.wrap !== false,      // لفّ النص الطويل — مفعّل افتراضياً
                dense: !!saved.dense
            };
            return Grid.prefs;
        },
        save() { try { localStorage.setItem(GRID_KEY, JSON.stringify(Grid.prefs)); } catch (e) { /* تخزين ممتلئ */ } },
        width(c) { return Grid.load().w[c.k] || c.w; },
        visible() {
            const h = Grid.load().hidden;
            return COLS.filter(c => !h[c.k]);
        },
        reset() { Grid.prefs = { w: {}, hidden: {}, wrap: true, dense: false }; Grid.save(); }
    };

    window.aiGridReset = () => { Grid.reset(); window.aiRenderReview(); };
    window.aiGridWrap = () => { const p = Grid.load(); p.wrap = !p.wrap; Grid.save(); window.aiRenderReview(); };
    window.aiGridDense = () => { const p = Grid.load(); p.dense = !p.dense; Grid.save(); window.aiRenderReview(); };
    window.aiGridToggleCol = k => { const p = Grid.load(); p.hidden[k] = !p.hidden[k]; Grid.save(); window.aiRenderReview(); };

    /** سحب حدّ العمود — يعمل باتجاه RTL (السحب يساراً يوسّع). */
    function bindResize(table) {
        table.querySelectorAll('.ai-rz').forEach(handle => {
            handle.addEventListener('mousedown', startDrag);
            handle.addEventListener('dblclick', autoFit);
        });

        function startDrag(ev) {
            ev.preventDefault(); ev.stopPropagation();
            const k = ev.currentTarget.dataset.col;
            const col = table.querySelector(`col[data-col="${k}"]`);
            if (!col) return;
            const startX = ev.clientX;
            const startW = parseFloat(col.style.width) || 100;
            document.body.classList.add('ai-rz-active');

            const move = e => {
                // RTL: تقدّم المؤشّر يساراً يزيد العرض
                const next = Math.max(40, Math.round(startW + (startX - e.clientX)));
                col.style.width = next + 'px';
            };
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                document.body.classList.remove('ai-rz-active');
                Grid.load().w[k] = parseFloat(col.style.width);
                Grid.save();
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        }

        /** نقر مزدوج على الحدّ = ملاءمة العرض لأطول محتوى في العمود. */
        function autoFit(ev) {
            ev.preventDefault();
            const k = ev.currentTarget.dataset.col;
            const col = table.querySelector(`col[data-col="${k}"]`);
            const idx = Array.from(table.querySelectorAll('col')).indexOf(col);
            if (idx < 0) return;
            let max = 60;
            table.querySelectorAll('tr').forEach(tr => {
                const cell = tr.children[idx];
                if (!cell) return;
                const probe = cell.querySelector('input, select') || cell;
                const w = (probe.tagName === 'INPUT' ? probe.value.length * 7.5 : probe.scrollWidth) + 26;
                if (w > max) max = w;
            });
            col.style.width = Math.min(520, Math.round(max)) + 'px';
            Grid.load().w[k] = parseFloat(col.style.width);
            Grid.save();
        }
    }

    // ── القسم 4: البنود ──────────────────────────────────────────────────────
    function sectionItems(r, locked, comp) {
        const items = AINV.toArray(r.items);
        const matches = AINV.toArray(r.itemMatches);
        const catalog = AINV.Match.systemItems();
        const p = Grid.load();
        const cols = Grid.visible();
        const canEdit = !locked && CAN('edit');

        // مجاميع الأعمدة — تحقّق بصري فوري أن البنود تُنتج إجمالي الفاتورة
        const sums = { taxable: 0, vat_amount: 0, total: 0, quantity: 0, discount: 0 };
        const computed = items.map(it => {
            const c = AINV.computeLine(it);
            sums.taxable += c.taxable; sums.vat_amount += c.vatAmount;
            sums.total += c.lineTotal; sums.quantity += c.qty; sums.discount += c.discount;
            return c;
        });

        const cell = (c, it, i, comp) => {
            const bad = f => comp.issues.some(x => x.field === f);
            const inp = (path, val, extra) => `<input class="ai-inp ${c.n ? 'n' : ''}" value="${esc(val == null ? '' : val)}"
                ${locked ? 'disabled' : ''} data-path="items.${i}.${path}" onchange="aiEditField(this)"
                onkeydown="aiGridKey(event)" ${extra || ''}>`;

            switch (c.k) {
                case 'idx': return `<td class="ai-meta ai-rownum">${i + 1}</td>`;
                case 'item_name': return `<td class="ai-desc">${inp('item_name', it.item_name, `title="${esc(it.item_name || '')}"`)}</td>`;
                case 'link': return `<td>
                    <select class="ai-inp sm" ${locked ? 'disabled' : ''} onchange="aiLinkItem(${i}, this.value)">
                        <option value="">— بلا ربط —</option>
                        ${catalog.map(x => `<option value="${esc(x.key)}" ${(matches[i] || {}).key === x.key ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
                    </select>
                    ${(matches[i] || {}).key ? `<span class="ai-imatch" title="${esc(AINV.Match.MATCH_AR[(matches[i] || {}).match_type] || '')}">${Math.round(((matches[i] || {}).confidence || 0) * 100)}%</span>` : ''}
                </td>`;
                case 'unit': return `<td>${inp('unit', it.unit)}</td>`;
                case 'quantity': return `<td class="n">${inp('quantity', it.quantity)}</td>`;
                case 'unit_price': return `<td class="n">${inp('unit_price', it.unit_price)}</td>`;
                case 'discount': return `<td class="n">${inp('discount', it.discount)}</td>`;
                case 'vat_rate': return `<td class="n">${inp('vat_rate', it.vat_rate)}</td>`;
                case 'taxable': return `<td class="n calc ${bad('taxable_amount') ? 'ai-err-cell' : ''}"
                    title="${bad('taxable_amount') ? 'قرأ النموذج ' + it.taxable_amount + ' — النظام يحسب ' + comp.taxable : 'محسوب بالنظام'}">
                    ${fmt(comp.taxable)}${bad('taxable_amount') ? `<i class="ai-diff">${fmt(it.taxable_amount)}</i>` : ''}</td>`;
                case 'vat_amount': return `<td class="n calc ${bad('vat_amount') ? 'ai-err-cell' : ''}"
                    title="${bad('vat_amount') ? 'قرأ النموذج ' + it.vat_amount + ' — النظام يحسب ' + comp.vatAmount : 'محسوب بالنظام'}">
                    ${fmt(comp.vatAmount)}${bad('vat_amount') ? `<i class="ai-diff">${fmt(it.vat_amount)}</i>` : ''}</td>`;
                case 'total': return `<td class="n calc ${bad('total_amount') ? 'ai-err-cell' : ''}">
                    <b>${fmt(comp.lineTotal)}</b>${bad('total_amount') ? `<i class="ai-diff">${fmt(it.total_amount)}</i>` : ''}</td>`;
                default: return '<td></td>';
            }
        };

        // ⚠️ جمع الكميات عبر وحدات مختلفة (15 لفة + 500 حبة = 515؟) رقمٌ بلا معنى
        // يوهم بدقّة غير موجودة. لا يُجمع إلا حين تتّحد الوحدة فعلاً.
        const units = new Set(items.map(i => String(i.unit || '').trim()).filter(Boolean));
        const oneUnit = units.size === 1;
        const sumOf = k => ({
            quantity: oneUnit ? sums.quantity : null,
            discount: sums.discount, taxable: sums.taxable,
            vat_amount: sums.vat_amount, total: sums.total
        })[k];

        return `<div class="ai-sec"><div class="ai-sec-h">📦 بنود الفاتورة <span class="badge">${items.length}</span>
            <span class="ai-meta">القيم المحسوبة بالنظام تظهر إلى جوار ما قرأه النموذج</span>
            <span style="flex:1"></span>
            <div class="ai-grid-tools">
                <button class="btn sm ${p.wrap ? 'on' : ''}" onclick="aiGridWrap()" title="لفّ أسماء البنود الطويلة على أكثر من سطر بدل قصّها">↩️ لفّ النص</button>
                <button class="btn sm ${p.dense ? 'on' : ''}" onclick="aiGridDense()" title="صفوف أضيق لرؤية بنود أكثر">📏 مضغوط</button>
                <div class="ai-colmenu">
                    <button class="btn sm" onclick="this.parentNode.classList.toggle('open')" title="إظهار وإخفاء الأعمدة">🧩 الأعمدة</button>
                    <div class="ai-colmenu-p">
                        ${COLS.filter(c => c.opt).map(c => `<label><input type="checkbox" ${p.hidden[c.k] ? '' : 'checked'} onchange="aiGridToggleCol('${c.k}')"> ${esc(c.l)}</label>`).join('')}
                        <button class="btn sm" onclick="aiGridReset()">↺ إعادة ضبط الأعمدة</button>
                    </div>
                </div>
                ${canEdit ? `<button class="btn sm" onclick="aiBulkLines()" title="تطبيق نسبة ضريبة أو وحدة على كل البنود دفعة واحدة">⚡ تعديل جماعي</button>` : ''}
                ${canEdit ? '<button class="btn b-g sm" onclick="aiAddLine()">➕ إضافة بند</button>' : ''}
            </div>
        </div>
        <div class="ai-sec-b">
            ${!items.length ? '<div class="ai-note wn">لم تُستخرج بنود — أضِفها يدوياً قبل الاعتماد، فبدونها لا تُنشأ حركات مخزون ولا تفصيل تكلفة.</div>' : ''}
            <div class="tw ai-grid-wrap"><table class="ai-tbl ai-lines ${p.wrap ? 'wrap' : ''} ${p.dense ? 'dense' : ''}" id="aiLinesTbl">
                <colgroup>
                    ${cols.map(c => `<col data-col="${c.k}" style="width:${Grid.width(c)}px">`).join('')}
                    ${canEdit ? '<col style="width:42px">' : ''}
                </colgroup>
                <thead><tr>
                    ${cols.map(c => `<th class="${c.n ? 'n' : ''}">${esc(c.l)}${c.fixed ? '' : `<span class="ai-rz" data-col="${c.k}" title="اسحب لتغيير العرض · انقر مرتين للملاءمة التلقائية"></span>`}</th>`).join('')}
                    ${canEdit ? '<th></th>' : ''}
                </tr></thead>
                <tbody>
                ${items.map((it, i) => `<tr>
                    ${cols.map(c => cell(c, it, i, computed[i])).join('')}
                    ${canEdit ? `<td class="ai-rowacts">
                        <button class="btn b-r xs" onclick="aiDelLine(${i})" title="حذف البند">✕</button>
                        <button class="btn xs" onclick="aiDupLine(${i})" title="تكرار البند">⧉</button>
                        <button class="btn xs" onclick="aiMoveLine(${i},-1)" title="تحريك لأعلى" ${i === 0 ? 'disabled' : ''}>▲</button>
                        <button class="btn xs" onclick="aiMoveLine(${i},1)" title="تحريك لأسفل" ${i === items.length - 1 ? 'disabled' : ''}>▼</button>
                    </td>` : ''}
                </tr>`).join('')}
                </tbody>
                ${items.length ? `<tfoot><tr class="tot">
                    ${cols.map(c => {
                        if (c.k === 'idx') return '<td></td>';
                        if (c.k === 'item_name') return `<td><b>مجموع ${items.length} بنداً</b></td>`;
                        if (c.k === 'quantity' && !oneUnit) return `<td class="n ai-nosum" title="الوحدات مختلفة (${esc(Array.from(units).join(' · '))}) — جمع الكميات عبرها بلا معنى">—</td>`;
                        if (c.k === 'unit' && !oneUnit) return `<td class="ai-meta">${units.size} وحدات</td>`;
                        const v = sumOf(c.k);
                        return v == null ? '<td></td>' : `<td class="n"><b>${fmt(v)}</b></td>`;
                    }).join('')}
                    ${canEdit ? '<td></td>' : ''}
                </tr></tfoot>` : ''}
            </table></div>
            ${items.length ? `<div class="ai-grid-hint">💡 اسحب حدّ أي عمود لتغيير عرضه · انقر الحدّ مرتين لملاءمته تلقائياً · تُحفظ الأعراض لك على هذا الجهاز
                · <kbd>Enter</kbd> ينتقل للصف التالي في نفس العمود</div>` : ''}
        </div></div>`;
    }

    // ── القسم 5: الإجماليات ──────────────────────────────────────────────────
    function sectionTotals(r, locked, comp) {
        const t = r.totals || {};
        const tol = AINV.Config.get().mathTolerance;
        const cmp = (claimed, computed) => {
            if (claimed == null) return '';
            return Math.abs(claimed - computed) > tol
                ? `<span class="ai-pill er" title="النظام يحسب ${fmt(computed)}">النظام: ${fmt(computed)}</span>`
                : '<span class="ai-pill ok">مطابق</span>';
        };
        const line = (label, path, claimed, computed, provKey) => `<div class="ai-tot-row">
            <span class="ai-tot-l">${esc(label)} ${provKey ? provBadge(r, provKey) : ''}</span>
            <input class="ai-inp n" value="${esc(claimed == null ? '' : claimed)}" ${locked ? 'disabled' : ''} data-path="${path}" onchange="aiEditField(this)">
            ${computed == null ? '' : cmp(claimed, computed)}
        </div>`;

        return `<div class="ai-sec"><div class="ai-sec-h">🧮 الإجماليات
            <span class="ai-meta">ما يقرأه النموذج يُقارَن بما يحسبه النظام من البنود — والنظام هو المرجع</span></div>
        <div class="ai-sec-b">
            <div class="ai-totals">
                ${line('المجموع قبل الخصم', 'totals.subtotal', t.subtotal, comp.subtotal)}
                ${line('إجمالي الخصم', 'totals.discount_total', t.discount_total, comp.discount)}
                ${line('المبلغ الخاضع للضريبة', 'totals.taxable_amount', t.taxable_amount, comp.taxable)}
                ${line('إجمالي الضريبة', 'totals.vat_total', t.vat_total, comp.vat, 'totals_vat')}
                ${line('الإجمالي شامل الضريبة', 'totals.grand_total', t.grand_total, comp.grandTotal, 'totals_grand_total')}
                ${line('المدفوع', 'totals.amount_paid', t.amount_paid, null)}
                ${line('المتبقي', 'totals.amount_due', t.amount_due, null)}
            </div>
            ${comp.taxes && comp.taxes.length ? `<div class="ai-tax-brk">
                <b>تفصيل الضريبة حسب النسبة</b> <span class="ai-meta">(أساس الإقرار الضريبي)</span>
                <table class="ai-tbl sm"><thead><tr><th>النسبة</th><th class="n">الوعاء</th><th class="n">الضريبة</th><th>التصنيف</th></tr></thead>
                <tbody>${comp.taxes.map(x => `<tr><td>${x.tax_rate}%</td><td class="n">${fmt(x.taxable_amount)}</td><td class="n">${fmt(x.tax_amount)}</td>
                    <td>${x.tax_category === 'STANDARD' ? 'أساسية' : x.tax_category === 'ZERO_RATED' ? 'صفرية' : esc(x.tax_category)}</td></tr>`).join('')}</tbody></table>
            </div>` : ''}
        </div></div>`;
    }

    // ── القسم 6: الترحيل المحاسبي ────────────────────────────────────────────
    function sectionPosting(r, locked) {
        const EXP = { materials: 'مواد', services: 'خدمات', equipment_rent: 'إيجار معدات', subcontractor: 'مقاولات من الباطن', transport: 'نقل', utilities: 'كهرباء ومياه', rent: 'إيجارات', other: 'أخرى' };
        const projects = window.projects || {};
        return `<div class="ai-sec"><div class="ai-sec-h">📒 التوجيه المحاسبي
            <span class="ai-meta">يحدّد حساب المدين ومركز التكلفة عند الترحيل</span>
            <span style="flex:1"></span>
            <button class="btn" onclick="aiAccountingPreview()">👁️ معاينة القيد</button>
        </div>
        <div class="ai-sec-b"><div class="ai-grid2">
            <div class="ai-f"><label class="ai-f-l">نوع المصروف</label>
                <select class="ai-inp" data-ss="1" ${locked ? 'disabled' : ''} data-path="expenseType" onchange="aiEditField(this)">
                    ${Object.keys(EXP).map(k => `<option value="${k}" ${(r.expenseType || 'materials') === k ? 'selected' : ''}>${esc(EXP[k])}</option>`).join('')}
                </select></div>
            <div class="ai-f"><label class="ai-f-l">المشروع / مركز التكلفة</label>
                <select class="ai-inp" data-ss="1" ${locked ? 'disabled' : ''} data-path="projectKey" onchange="aiEditField(this)">
                    <option value="">— بلا مشروع —</option>
                    ${Object.keys(projects).map(k => `<option value="${esc(k)}" ${r.projectKey === k ? 'selected' : ''}>${esc(projects[k].name || k)}</option>`).join('')}
                </select></div>
        </div></div></div>`;
    }

    // ── عارض المستند الأصلي ──────────────────────────────────────────────────
    function docViewer(r) {
        const url = (r.file_metadata && r.file_metadata.url) || '';
        const mime = (r.file_metadata && r.file_metadata.mime_type) || '';
        const name = (r.file_metadata && r.file_metadata.original_filename) || 'المستند';
        if (!url) return `<div class="ai-nofile">لم يُحفظ الملف الأصلي (التخزين غير مهيّأ)</div>`;
        return `<div class="ai-doc">
            <div class="ai-doc-tools">
                <b>📎 ${esc(name)}</b><span style="flex:1"></span>
                <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">↗ فتح في تبويب</a>
            </div>
            ${mime === 'application/pdf'
                ? `<iframe class="ai-doc-frame" src="${esc(url)}" title="${esc(name)}"></iframe>`
                : `<img class="ai-doc-img" src="${esc(url)}" alt="${esc(name)}">`}
        </div>`;
    }

    window.aiToggleDoc = function () { AIU.docPane = !AIU.docPane; renderReview(); };

    // ── شريط الإجراءات ───────────────────────────────────────────────────────
    function actionBar(r, locked, sum) {
        const canApprove = CAN('approve') && !locked && !sum.blocking;
        const blockedReason = sum.blocking ? `${sum.blocking} مانع اعتماد — عالِجها أو تجاوزها بسبب مسجَّل` : '';
        return `<div class="ai-actionbar">
            <span class="ai-meta">${esc((r.file_metadata && r.file_metadata.original_filename) || '')}
                ${r.processing_job ? ` · ${esc(r.processing_job.model_used || '')} · ${Math.round((r.processing_job.duration_ms || 0) / 1000)}ث` : ''}</span>
            <span style="flex:1"></span>
            <button class="btn" onclick="aiExportExcel()">📊 Excel</button>
            <button class="btn" onclick="aiExportPdf()">📄 PDF</button>
            <button class="btn" onclick="aiExportPayload()">🔌 JSON للتكامل</button>
            ${!locked && CAN('edit') ? '<button class="btn b-b" onclick="aiSaveDraft()">💾 حفظ مسوّدة</button>' : ''}
            ${!locked && CAN('reject') ? '<button class="btn b-r" onclick="aiReject()">⛔ رفض</button>' : ''}
            ${!locked ? `<button class="btn b-g" ${canApprove ? '' : 'disabled'} title="${esc(blockedReason)}" onclick="aiApprove()">✅ اعتماد</button>` : ''}
            ${r.status === 'approved' && CAN('approve') && !r.linkedPInvKey ? '<button class="btn b-g" onclick="aiConvert()">📒 تحويل إلى فاتورة مشتريات</button>' : ''}
            ${r.linkedPInvKey ? `<button class="btn" onclick="nav('purchaseinvoices')">↗ فاتورة المشتريات المرتبطة</button>` : ''}
        </div>`;
    }

    // يعيد رسم الشاشة الحالية أياً كانت — تستدعيه طبقة الإجراءات بعد كل تغيير
    window.aiRerender = function () { if (AIU.current) renderReview(); else window.renderAiInvoices(); };
    window.aiRenderReview = renderReview;

})();
