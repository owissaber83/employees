// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║   📄 Professional PDF Editor — الإدخال/الإخراج والعمليات (IO & Ops Layer)      ║
// ║   ────────────────────────────────────────────────────────────────────────    ║
// ║   [IO-SEARCH] البحث والاستبدال (عربي/إنجليزي/أرقام)                            ║
// ║   [IO-PAGE]   إدارة الصفحات: حذف · تدوير · تكرار · استخراج · إدراج · قص        ║
// ║   [IO-DOC]    دمج · تقسيم                                                     ║
// ║   [IO-OCR]    القراءة الضوئية للصفحات الممسوحة                                 ║
// ║   [IO-ASSET]  التوقيع · الختم · العلامة المائية · رمز QR · أدوات محاسبية        ║
// ║   [IO-EXPORT] البناء · التحقق · التنزيل · الطباعة · تصدير الصفحات والصور        ║
// ║   [IO-SAVE]   الحفظ في النظام · النُّسخ · المقارنة · الربط بالسجلات              ║
// ║   [IO-KEYS]   اختصارات لوحة المفاتيح وإتاحة الوصول                             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
/* global PDFE, PDE, qrcode */

(function () {
    'use strict';

    const esc = window.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const $ = id => document.getElementById(id);
    const toast = (m, t, d) => PDE.toast(m, t, d);
    const num = v => Math.round((+v || 0) * 100) / 100;
    const fileSafe = s => String(s || 'document').replace(/[\\/:*?"<>|]+/g, '_').replace(/\.pdf$/i, '');

    // ═══════════════════════════════════════════════════════════════════════════
    // [IO-SEARCH] البحث والاستبدال (§21)
    // ═══════════════════════════════════════════════════════════════════════════

    /** تطبيع للبحث العربي: يزيل التشكيل ويوحّد الألف والهاء/التاء المربوطة. */
    function normAr(s) {
        return String(s || '')
            .replace(/[ً-ْٰـ]/g, '')
            .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
            .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
            .replace(/\s+/g, ' ')
            .toLowerCase().trim();
    }
    PDE.normAr = normAr;

    window.pdeToggleSearch = function () {
        const bar = $('pdeSearchBar');
        if (bar.style.display !== 'none') { bar.style.display = 'none'; clearHits(); return; }
        bar.style.display = 'flex';
        bar.innerHTML = `
            <input id="pdeQ" placeholder="🔍 ابحث في المستند…" oninput="pdeSearchRun()" onkeydown="if(event.key==='Enter')pdeSearchNext(event.shiftKey?-1:1)">
            <input id="pdeR" placeholder="↔️ استبدل بـ…" ${PDE.canEdit() ? '' : 'disabled'}>
            <label class="pde-toggle"><input type="checkbox" id="pdeQCase" onchange="pdeSearchRun()"> مطابقة الحالة</label>
            <label class="pde-toggle"><input type="checkbox" id="pdeQWhole" onchange="pdeSearchRun()"> كلمة كاملة</label>
            <span id="pdeQCount" class="pde-qcount">—</span>
            <button class="pde-tb-btn" onclick="pdeSearchNext(-1)" title="السابق">▲</button>
            <button class="pde-tb-btn" onclick="pdeSearchNext(1)" title="التالي">▼</button>
            <button class="btn b-b" onclick="pdeReplaceOne()" ${PDE.canEdit() ? '' : 'disabled'}>استبدال</button>
            <button class="btn b-g" onclick="pdeReplaceAll()" ${PDE.canEdit() ? '' : 'disabled'}>استبدال الكل</button>
            <button class="pde-tb-btn" onclick="pdeToggleSearch()">✕</button>`;
        $('pdeQ').focus();
    };

    function clearHits() {
        PDE.searchHits = []; PDE.searchIdx = -1;
        document.querySelectorAll('.pde-txt.hit,.pde-txt.hit-cur').forEach(e => e.classList.remove('hit', 'hit-cur'));
    }

    window.pdeSearchRun = async function () {
        const q = $('pdeQ').value;
        clearHits();
        if (!q || q.length < 1) { $('pdeQCount').textContent = '—'; return; }
        const cs = $('pdeQCase').checked, whole = $('pdeQWhole').checked;
        const needle = cs ? q.trim() : normAr(q);

        // نحلّل كل الصفحات عند أول بحث حتى يكون البحث شاملاً فعلاً
        if (PDE.analysis.analyzedCount < PDE.analysis.total) {
            PDE.busyOn('جارٍ تحليل باقي الصفحات للبحث الشامل…');
            for (let n = 1; n <= PDE.analysis.total; n++) {
                if (!PDE.analysis.pages[n - 1]) {
                    await PDFE.Parser.ensurePage(PDE.analysis, n);
                    PDE.busyMsg(`تحليل الصفحة ${n} من ${PDE.analysis.total}…`, n / PDE.analysis.total);
                }
            }
            PDE.busyOff();
        }

        const hits = [];
        for (const pg of PDE.analysis.pages) {
            if (!pg) continue;
            const pool = pg.items.concat(PDE.ocrPages.get(pg.n) || []);
            for (const it of pool) {
                if (it._deleted) continue;
                const cur = it._newText != null ? it._newText : it.str;
                const hay = cs ? cur : normAr(cur);
                let idx = hay.indexOf(needle);
                while (idx >= 0) {
                    const okWhole = !whole || ((idx === 0 || /[\s،.,:؛()]/.test(hay[idx - 1])) &&
                        (idx + needle.length >= hay.length || /[\s،.,:؛()]/.test(hay[idx + needle.length])));
                    if (okWhole) hits.push({ page: pg.n, item: it, at: idx });
                    idx = hay.indexOf(needle, idx + 1);
                }
            }
        }
        PDE.searchHits = hits;
        PDE.searchIdx = hits.length ? 0 : -1;
        $('pdeQCount').textContent = hits.length ? `${hits.length} نتيجة` : 'لا نتائج';
        paintHits();
        if (hits.length) window.pdeSearchNext(0);
    };

    function paintHits() {
        const pages = new Set(PDE.searchHits.map(h => h.page));
        pages.forEach(n => { if (PDE.rendered.has(n)) markPage(n); });
    }
    function markPage(n) {
        const el = PDE.pageEls.get(n); if (!el) return;
        const ids = new Set(PDE.searchHits.filter(h => h.page === n).map(h => h.item.id));
        el.querySelectorAll('.pde-txt').forEach(t => t.classList.toggle('hit', ids.has(t.dataset.id)));
    }

    window.pdeSearchNext = async function (dir) {
        if (!PDE.searchHits.length) return;
        PDE.searchIdx = (PDE.searchIdx + dir + PDE.searchHits.length) % PDE.searchHits.length;
        const h = PDE.searchHits[PDE.searchIdx];
        $('pdeQCount').textContent = `${PDE.searchIdx + 1} / ${PDE.searchHits.length}`;
        window.pdeGoPage(h.page);
        setTimeout(() => {
            markPage(h.page);
            document.querySelectorAll('.pde-txt.hit-cur').forEach(e => e.classList.remove('hit-cur'));
            const el = PDE.pageEls.get(h.page) && PDE.pageEls.get(h.page).querySelector(`.pde-txt[data-id="${h.item.id}"]`);
            if (el) { el.classList.add('hit-cur'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        }, 320);
    };

    window.pdeReplaceOne = function () {
        if (PDE.searchIdx < 0) { toast('لا نتيجة محدّدة', 'er'); return; }
        const h = PDE.searchHits[PDE.searchIdx];
        doReplace(h, $('pdeQ').value, $('pdeR').value);
        toast('✅ استُبدلت نتيجة واحدة', 'ok');
        window.pdeSearchRun();
    };

    window.pdeReplaceAll = function () {
        const q = $('pdeQ').value, r = $('pdeR').value;
        if (!q) return;
        if (!confirm(`استبدال «${q}» بـ «${r}» في ${PDE.searchHits.length} موضع عبر المستند؟\n\nسيُزال النص الأصلي فعلياً من بنية الملف مع الحفاظ على الخط والحجم واللون والموضع.`)) return;
        // نجمّع حسب العنصر حتى لا نستبدل في نفس العنصر مرتين
        const byItem = new Map();
        PDE.searchHits.forEach(h => { if (!byItem.has(h.item)) byItem.set(h.item, h); });
        let count = 0;
        byItem.forEach(h => { count += countIn(h.item, q); doReplace(h, q, r, true); });
        toast(`✅ استُبدل ${count} موضع في ${byItem.size} عنصر`, 'ok', 6000);
        PDE.refreshAllLayers();
        window.pdeSearchRun();
    };

    function countIn(item, q) {
        const cur = item._newText != null ? item._newText : item.str;
        const cs = $('pdeQCase') && $('pdeQCase').checked;
        const hay = cs ? cur : normAr(cur), needle = cs ? q : normAr(q);
        let c = 0, i = hay.indexOf(needle);
        while (i >= 0) { c++; i = hay.indexOf(needle, i + 1); }
        return c;
    }

    /** الاستبدال الذكي: يحافظ على كل خصائص النص الأصلي (§7). */
    function doReplace(hit, q, r, all) {
        const it = hit.item;
        const before = it._newText != null ? it._newText : it.str;
        const cs = $('pdeQCase') && $('pdeQCase').checked;
        let after;
        if (cs) {
            after = all ? before.split(q).join(r) : before.replace(q, r);
        } else {
            // استبدال حسّاس للتطبيع العربي: نطابق على النص المطبَّع ونقصّ من الأصلي
            const nb = normAr(before), nq = normAr(q);
            let out = '', i = 0;
            while (i < before.length) {
                if (normAr(before.slice(i, i + q.length)) === nq || nb.slice(i, i + nq.length) === nq) {
                    out += r; i += q.length;
                    if (!all) { out += before.slice(i); break; }
                } else { out += before[i]; i++; }
            }
            after = out;
        }
        const n = hit.page;
        const fit = PDFE.Style.autoFit(it, after, { boxWidth: it.w });
        it._newText = after; it._edited = true;
        PDE.pushOp(PDFE.Ops.make(after.trim() ? 'text.edit' : 'text.delete', {
            page: n, itemId: it.id, opIndex: it.ocr ? -1 : it.opIndex,
            opIndexes: it.ocr ? null : (it.opIndexes || null),
            oldText: it.str, newText: after,
            x: it.x, y: it.y, boxWidth: it.w,
            box: { x: it.x, y: it.y, w: it.w },
            fontSize: fit.fontSize, fontFamily: it.fontFamily,
            bold: it.bold, italic: it.italic, color: it.color, opacity: it.opacity,
            bgColor: it.bgColor, align: it.align, dir: it.dir, angle: it.angle,
            charSpacing: fit.charSpacing
        }));
        if (!all) PDE.refreshLayer(n);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // [IO-PAGE] إدارة الصفحات (§20)
    // ═══════════════════════════════════════════════════════════════════════════

    window.pdeDeletePage = function (n) {
        const live = PDE.pageOrder.filter(p => !PDE.deletedPages.has(p));
        if (live.length <= 1) { toast('لا يمكن حذف آخر صفحة', 'er'); return; }
        if (!confirm(`حذف الصفحة ${n}؟`)) return;
        PDE.deletedPages.add(n);
        PDE.pushOp(PDFE.Ops.make('page.delete', { page: n }));
        rebuildPages();
        toast(`🗑️ حُذفت الصفحة ${n}`, 'ok');
    };

    window.pdeRotatePage = function (n, deg) {
        PDE.pageRotation.set(n, ((PDE.pageRotation.get(n) || 0) + deg) % 360);
        PDE.pushOp(PDFE.Ops.make('page.rotate', { page: n, deg }));
        PDE.rendered.delete(n);
        rebuildPages();
    };

    window.pdeDuplicatePage = function (n) {
        PDE.pushOp(PDFE.Ops.make('page.duplicate', { page: n }));
        toast(`⧉ ستُكرَّر الصفحة ${n} عند الحفظ`, 'ok', 5000);
    };

    window.pdeAddBlankPage = function () {
        const at = PDE.page;
        PDE.pushOp(PDFE.Ops.make('page.insert', { at, bgColor: '#FFFFFF' }));
        toast(`➕ ستُدرج صفحة فارغة بعد الصفحة ${at} عند الحفظ`, 'ok', 5000);
    };

    /** استخراج صفحة واحدة كملف PDF مستقل (§20). */
    window.pdeExtractPage = async function (n) {
        await exportPages([n], `${fileSafe(PDE.doc.name)}-صفحة-${n}.pdf`);
    };

    function rebuildPages() {
        PDE.buildPageSlots();
        PDE.rendered.clear(); PDE.canvases.clear();
        PDE.renderVisiblePages();
        window.pdeRenderThumbs();
    }

    /** نافذة إدارة الصفحات الشاملة. */
    window.pdePagesDialog = function () {
        const live = PDE.pageOrder.filter(p => !PDE.deletedPages.has(p));
        openModal('pdePagesOv', '📑 إدارة الصفحات', `
            <div class="pde-meta">حدّد الصفحات ثم اختر إجراءً. لإعادة الترتيب استخدم السحب والإفلات في الشريط الجانبي.</div>
            <div class="pde-pagesel" id="pdePageSel">
                ${live.map(n => `<label class="pde-pagechk"><input type="checkbox" value="${n}" checked> صفحة ${n}</label>`).join('')}
            </div>
            <div class="pde-row" style="flex-wrap:wrap;margin-top:12px">
                <button class="btn" onclick="pdePageSelAll(true)">تحديد الكل</button>
                <button class="btn" onclick="pdePageSelAll(false)">إلغاء التحديد</button>
                <button class="btn" onclick="pdePageSelOdd(1)">الفردية</button>
                <button class="btn" onclick="pdePageSelOdd(0)">الزوجية</button>
            </div>
            <div class="pde-sec">الإجراءات</div>
            <div class="pde-row" style="flex-wrap:wrap">
                <button class="btn b-b" onclick="pdeBulkExtract()">⤓ استخراج المحدّد كملف</button>
                <button class="btn b-b" onclick="pdeBulkRotate(90)">↻ تدوير 90°</button>
                <button class="btn b-b" onclick="pdeBulkRotate(180)">↻ تدوير 180°</button>
                <button class="btn b-r" onclick="pdeBulkDelete()">🗑️ حذف المحدّد</button>
                <button class="btn b-g" onclick="pdeSplitDialog()">✂️ تقسيم الملف</button>
            </div>`, `<button class="btn" onclick="pdeCloseModal('pdePagesOv')">إغلاق</button>`);
    };

    const selPages = () => Array.from(document.querySelectorAll('#pdePageSel input:checked')).map(i => +i.value);
    window.pdePageSelAll = v => document.querySelectorAll('#pdePageSel input').forEach(i => { i.checked = v; });
    window.pdePageSelOdd = odd => document.querySelectorAll('#pdePageSel input').forEach(i => { i.checked = (+i.value % 2) === odd; });

    window.pdeBulkExtract = async function () {
        const p = selPages(); if (!p.length) { toast('حدّد صفحة واحدة على الأقل', 'er'); return; }
        window.pdeCloseModal('pdePagesOv');
        await exportPages(p, `${fileSafe(PDE.doc.name)}-مستخرج-${p.length}صفحة.pdf`);
    };
    window.pdeBulkRotate = function (deg) {
        selPages().forEach(n => window.pdeRotatePage(n, deg));
        window.pdeCloseModal('pdePagesOv');
    };
    window.pdeBulkDelete = function () {
        const p = selPages();
        const live = PDE.pageOrder.filter(x => !PDE.deletedPages.has(x));
        if (p.length >= live.length) { toast('لا يمكن حذف كل الصفحات', 'er'); return; }
        if (!confirm(`حذف ${p.length} صفحة؟`)) return;
        p.forEach(n => { PDE.deletedPages.add(n); PDE.pushOp(PDFE.Ops.make('page.delete', { page: n })); });
        window.pdeCloseModal('pdePagesOv');
        rebuildPages();
        toast(`🗑️ حُذفت ${p.length} صفحة`, 'ok');
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [IO-DOC] الدمج والتقسيم
    // ═══════════════════════════════════════════════════════════════════════════

    window.pdeMergeDialog = function () {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'application/pdf,.pdf'; inp.multiple = true;
        inp.onchange = async () => {
            const files = Array.from(inp.files || []);
            if (!files.length) return;
            for (const f of files) {
                const bytes = new Uint8Array(await f.arrayBuffer());
                PDE.pushOp(PDFE.Ops.make('doc.merge', { name: f.name, bytes }));
            }
            toast(`🔗 سيُدمج ${files.length} ملف في نهاية المستند عند الحفظ`, 'ok', 6000);
        };
        inp.click();
    };

    window.pdeSplitDialog = function () {
        window.pdeCloseModal('pdePagesOv');
        const total = PDE.pageOrder.filter(n => !PDE.deletedPages.has(n)).length;
        openModal('pdeSplitOv', '✂️ تقسيم الملف', `
            <label class="pde-f">طريقة التقسيم
                <select id="pdeSplitMode" onchange="document.getElementById('pdeSplitEvery').style.display=this.value==='every'?'':'none'">
                    <option value="every">كل N صفحة في ملف</option>
                    <option value="each">كل صفحة في ملف مستقل</option>
                    <option value="half">نصفين</option>
                </select></label>
            <label class="pde-f" id="pdeSplitEvery">عدد الصفحات في كل ملف<input type="number" id="pdeSplitN" min="1" max="${total}" value="1"></label>
            <div class="pde-meta">إجمالي الصفحات: ${total}. ستُنزَّل الملفات الناتجة تباعاً.</div>`,
            `<button class="btn" onclick="pdeCloseModal('pdeSplitOv')">إلغاء</button>
             <button class="btn b-g" onclick="pdeRunSplit()">✂️ تقسيم وتنزيل</button>`);
    };

    window.pdeRunSplit = async function () {
        const mode = $('pdeSplitMode').value;
        const live = PDE.pageOrder.filter(n => !PDE.deletedPages.has(n));
        let groups = [];
        if (mode === 'each') groups = live.map(n => [n]);
        else if (mode === 'half') { const h = Math.ceil(live.length / 2); groups = [live.slice(0, h), live.slice(h)]; }
        else { const N = Math.max(1, +$('pdeSplitN').value || 1); for (let i = 0; i < live.length; i += N) groups.push(live.slice(i, i + N)); }
        window.pdeCloseModal('pdeSplitOv');
        if (groups.length > 40 && !confirm(`سيُنشأ ${groups.length} ملف. المتابعة؟`)) return;
        PDE.busyOn('جارٍ التقسيم…');
        try {
            for (let i = 0; i < groups.length; i++) {
                PDE.busyMsg(`إنشاء الملف ${i + 1} من ${groups.length}…`, (i + 1) / groups.length);
                await exportPages(groups[i], `${fileSafe(PDE.doc.name)}-جزء${i + 1}.pdf`, true);
            }
            PDE.busyOff();
            toast(`✅ أُنشئ ${groups.length} ملف`, 'ok');
            PDFE.Audit.log('تقسيم PDF', `قُسّم «${PDE.doc.name}» إلى ${groups.length} ملف`);
        } catch (e) { PDE.busyOff(); toast('تعذّر التقسيم: ' + e.message, 'er', 7000); }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [IO-OCR] القراءة الضوئية (§9)
    // ═══════════════════════════════════════════════════════════════════════════

    window.pdeRunOCR = async function () {
        if (!PDFE.OCR.available()) { toast('❌ محرّك OCR غير محمّل — تحقّق من الاتصال بالإنترنت ثم أعد تحميل الصفحة', 'er', 8000); return; }
        const scanned = PDE.analysis.pages.filter(p => p && p.isScanned).map(p => p.n);
        const targets = scanned.length ? scanned : [PDE.page];
        if (!confirm(`تشغيل القراءة الضوئية على ${targets.length} صفحة؟\n\nقد يستغرق حتى دقيقة لكل صفحة. النص الناتج يصبح قابلاً للتحرير والبحث، ويُضاف كطبقة نصية فوق الصورة الأصلية دون المساس بها.`)) return;

        PDE.busyOn('جارٍ تجهيز القراءة الضوئية…');
        try {
            for (let i = 0; i < targets.length; i++) {
                const n = targets[i];
                PDE.busyMsg(`الصفحة ${n} (${i + 1}/${targets.length}) — جارٍ التجهيز…`, i / targets.length);
                const a = await PDFE.Parser.ensurePage(PDE.analysis, n);
                // نرسم بدقة عالية لتحسين دقة التعرّف
                const c = document.createElement('canvas');
                const ocrScale = 2.2;
                await PDFE.Engine.get().renderPage(PDE.ctx, n, ocrScale, c, {});
                const items = await PDFE.OCR.recognizePage(c, a, ocrScale,
                    p => PDE.busyMsg(`الصفحة ${n} (${i + 1}/${targets.length}) — قراءة ${Math.round(p * 100)}%`, (i + p) / targets.length));
                PDE.ocrPages.set(n, items);
                a.isScanned = false;
                PDE.refreshLayer(n);
            }
            PDE.busyOff();
            const total = targets.reduce((s, n) => s + (PDE.ocrPages.get(n) || []).length, 0);
            toast(`✅ اكتُشف ${total} عنصر نصي — أصبح قابلاً للتحرير والبحث`, 'ok', 7000);
            const b = $('pdeScanBanner'); if (b) b.style.display = 'none';
            PDFE.Audit.log('تشغيل OCR', `شُغّلت القراءة الضوئية على ${targets.length} صفحة في «${PDE.doc.name}» — ${total} عنصر`);
        } catch (e) {
            PDE.busyOff();
            toast('❌ تعذّرت القراءة الضوئية: ' + (e.message || ''), 'er', 8000);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [IO-ASSET] التوقيع · الختم · العلامة المائية · QR
    // ═══════════════════════════════════════════════════════════════════════════

    function openModal(id, title, body, footer, wide) {
        let ov = $(id);
        if (!ov) { ov = document.createElement('div'); ov.id = id; ov.className = 'pde-modal'; document.body.appendChild(ov); }
        ov.innerHTML = `<div class="pde-modal-box" style="max-width:${wide || 520}px">
            <div class="pde-modal-h">${title}<button onclick="pdeCloseModal('${id}')">✕</button></div>
            <div class="pde-modal-b">${body}</div>
            <div class="pde-modal-f">${footer || ''}</div></div>`;
        ov.classList.add('show');
        return ov;
    }
    PDE.openModal = openModal;

    /** التوقيع: رسم · رفع · كتابة (§23). */
    window.pdeSignDialog = function (n, a, sx, sy) {
        PDE._place = { n, a, sx, sy };
        openModal('pdeSignOv', '✍️ إضافة توقيع', `
            <div class="pde-tabs" id="pdeSignTabs">
                <button class="act" onclick="pdeSignTab('draw',this)">🖊️ رسم</button>
                <button onclick="pdeSignTab('upload',this)">📂 رفع صورة</button>
                <button onclick="pdeSignTab('type',this)">⌨️ كتابة</button>
            </div>
            <div id="pdeSignDraw">
                <canvas id="pdeSignCanvas" width="440" height="170" class="pde-sigcanvas"></canvas>
                <div class="pde-row">
                    <button class="btn" onclick="pdeSignClear()">🧹 مسح</button>
                    <label class="pde-toggle">اللون <input type="color" id="pdeSignColor" value="#12336B" onchange="PDE._sigColor=this.value"></label>
                    <label class="pde-toggle">السماكة <input type="range" id="pdeSignW" min="1" max="8" value="2.5"></label>
                </div>
            </div>
            <div id="pdeSignUpload" style="display:none">
                <input type="file" accept="image/*" id="pdeSignFile" onchange="pdeSignUpload(this)">
                <div id="pdeSignPrev" class="pde-sigprev"></div>
                <div class="pde-meta">يُفضّل صورة PNG بخلفية شفافة.</div>
            </div>
            <div id="pdeSignType" style="display:none">
                <input id="pdeSignText" placeholder="اكتب الاسم…" oninput="pdeSignTypePrev()" class="pde-inp">
                <select id="pdeSignFont" onchange="pdeSignTypePrev()" class="pde-inp" style="margin-top:8px">
                    <option value="Amiri">Amiri — نسخي</option><option value="Cairo">Cairo — حديث</option>
                    <option value="Georgia">Georgia — لاتيني</option><option value="Brush Script MT">Brush Script — يدوي</option>
                </select>
                <div id="pdeSignTypePrev" class="pde-sigprev"></div>
            </div>`,
            `<button class="btn" onclick="pdeCloseModal('pdeSignOv')">إلغاء</button>
             <button class="btn b-g" onclick="pdeSignApply()">✅ إضافة التوقيع</button>`, 520);
        initSignCanvas();
    };

    let _sigTab = 'draw';
    window.pdeSignTab = function (t, btn) {
        _sigTab = t;
        document.querySelectorAll('#pdeSignTabs button').forEach(b => b.classList.remove('act'));
        btn.classList.add('act');
        ['draw', 'upload', 'type'].forEach(k => { const e = $('pdeSign' + k[0].toUpperCase() + k.slice(1)); if (e) e.style.display = k === t ? '' : 'none'; });
    };

    function initSignCanvas() {
        const c = $('pdeSignCanvas'); if (!c) return;
        const ctx = c.getContext('2d');
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        let drawing = false;
        const pos = e => { const r = c.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
        const start = e => { e.preventDefault(); drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
        const move = e => {
            if (!drawing) return; e.preventDefault();
            const p = pos(e);
            ctx.strokeStyle = PDE._sigColor || '#12336B';
            ctx.lineWidth = +($('pdeSignW') || {}).value || 2.5;
            ctx.lineTo(p.x, p.y); ctx.stroke();
        };
        const end = () => { drawing = false; };
        ['mousedown', 'touchstart'].forEach(e => c.addEventListener(e, start, { passive: false }));
        ['mousemove', 'touchmove'].forEach(e => c.addEventListener(e, move, { passive: false }));
        ['mouseup', 'mouseleave', 'touchend'].forEach(e => c.addEventListener(e, end));
    }
    window.pdeSignClear = function () { const c = $('pdeSignCanvas'); c.getContext('2d').clearRect(0, 0, c.width, c.height); };

    window.pdeSignUpload = function (inp) {
        const f = inp.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { PDE._sigUpload = rd.result; $('pdeSignPrev').innerHTML = `<img src="${esc(rd.result)}" style="max-width:100%;max-height:150px">`; };
        rd.readAsDataURL(f);
    };

    window.pdeSignTypePrev = function () {
        const t = $('pdeSignText').value, f = $('pdeSignFont').value;
        $('pdeSignTypePrev').innerHTML = `<div style="font-family:'${esc(f)}',cursive;font-size:38px;color:#12336B;padding:12px">${esc(t)}</div>`;
    };

    window.pdeSignApply = function () {
        let dataUrl = null, w = 150, h = 55;
        if (_sigTab === 'draw') {
            const c = $('pdeSignCanvas');
            const trimmed = trimCanvas(c);
            if (!trimmed) { toast('ارسم التوقيع أولاً', 'er'); return; }
            dataUrl = trimmed.dataUrl; w = 150; h = 150 * (trimmed.h / trimmed.w);
        } else if (_sigTab === 'upload') {
            if (!PDE._sigUpload) { toast('اختر صورة التوقيع', 'er'); return; }
            dataUrl = PDE._sigUpload;
        } else {
            const t = $('pdeSignText').value; if (!t.trim()) { toast('اكتب الاسم', 'er'); return; }
            const c = document.createElement('canvas'); c.width = 600; c.height = 160;
            const x = c.getContext('2d');
            x.fillStyle = '#12336B'; x.font = `62px "${$('pdeSignFont').value}", cursive`;
            x.textAlign = 'center'; x.textBaseline = 'middle';
            x.fillText(t, 300, 82);
            const tr = trimCanvas(c);
            dataUrl = tr ? tr.dataUrl : c.toDataURL('image/png');
            w = 160; h = tr ? 160 * (tr.h / tr.w) : 45;
        }
        window.pdeCloseModal('pdeSignOv');
        placeAsset('sign', dataUrl, w, h, 'توقيع');
    };

    /** يقصّ الفراغ الشفاف حول الرسم — توقيع أنظف. */
    function trimCanvas(c) {
        const ctx = c.getContext('2d');
        let d; try { d = ctx.getImageData(0, 0, c.width, c.height); } catch (e) { return null; }
        let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0, found = false;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
            if (d.data[(y * c.width + x) * 4 + 3] > 12) { found = true; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (!found) return null;
        const pad = 4;
        const w = Math.min(c.width, x1 - x0 + pad * 2), h = Math.min(c.height, y1 - y0 + pad * 2);
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        o.getContext('2d').drawImage(c, Math.max(0, x0 - pad), Math.max(0, y0 - pad), w, h, 0, 0, w, h);
        return { dataUrl: o.toDataURL('image/png'), w, h };
    }

    function placeAsset(kind, dataUrl, w, h, label, content) {
        const p = PDE._place || { n: PDE.page, a: PDE.analysis.pages[PDE.page - 1], sx: 80, sy: 80 };
        const g = PDE.cssToPdf(p.a, p.sx, p.sy, w * PDE.scale, h * PDE.scale);
        const o = PDE.addObject({ kind, page: p.n, dataUrl, label, content, x: num(g.x), y: num(g.y), w: num(w), h: num(h), opacity: 1, rotation: 0 });
        PDE.pushOp(PDE.opFromObject(o));
        window.pdeSetTool('select');
        toast(`✅ أُضيف ${label}`, 'ok');
    }

    // ── الأختام (§24) ──────────────────────────────────────────────────────
    const STAMPS = [
        { k: 'APPROVED', ar: 'معتمد', c: '#1B8A4B' }, { k: 'PAID', ar: 'مدفوع', c: '#0F7B8A' },
        { k: 'REJECTED', ar: 'مرفوض', c: '#C0392B' }, { k: 'DRAFT', ar: 'مسوّدة', c: '#7F8C8D' },
        { k: 'CONFIDENTIAL', ar: 'سرّي', c: '#8E44AD' }, { k: 'COPY', ar: 'نسخة', c: '#2C3E50' },
        { k: 'URGENT', ar: 'عاجل', c: '#D35400' }, { k: 'RECEIVED', ar: 'مستلم', c: '#2E75B6' },
        { k: 'REVIEWED', ar: 'روجع', c: '#16A085' }, { k: 'CANCELLED', ar: 'ملغى', c: '#95A5A6' }
    ];

    window.pdeStampDialog = function (n, a, sx, sy) {
        PDE._place = { n, a, sx, sy };
        openModal('pdeStampOv', '🏷️ إضافة ختم', `
            <div class="pde-stamps">
                ${STAMPS.map(s => `<button class="pde-stampbtn" style="--sc:${s.c}" onclick="pdeStampApply('${s.k}','${esc(s.ar)}','${s.c}')">
                    <b>${esc(s.ar)}</b><small>${s.k}</small></button>`).join('')}
            </div>
            <div class="pde-sec">✨ ختم مخصّص</div>
            <input id="pdeStampCustom" class="pde-inp" placeholder="نص الختم…">
            <div class="pde-row" style="margin-top:8px">
                <label class="pde-toggle">اللون <input type="color" id="pdeStampColor" value="#C0392B"></label>
                <label class="pde-toggle"><input type="checkbox" id="pdeStampDate" checked> إضافة التاريخ</label>
                <label class="pde-toggle"><input type="checkbox" id="pdeStampUser" checked> إضافة اسم المستخدم</label>
            </div>
            <button class="btn b-g" style="width:100%;margin-top:10px" onclick="pdeStampCustom()">إضافة الختم المخصّص</button>`,
            `<button class="btn" onclick="pdeCloseModal('pdeStampOv')">إلغاء</button>`, 560);
    };

    window.pdeStampApply = function (k, ar, color) {
        const withDate = true;
        const d = new Date().toLocaleDateString('ar-EG');
        const u = (window.myP && window.myP.name) || (window.curU && window.curU.email) || '';
        window.pdeCloseModal('pdeStampOv');
        placeAsset('stamp', renderStamp(ar, k, color, withDate ? d : '', u), 128, 62, `ختم ${ar}`);
    };

    window.pdeStampCustom = function () {
        const t = $('pdeStampCustom').value.trim();
        if (!t) { toast('اكتب نص الختم', 'er'); return; }
        const c = $('pdeStampColor').value;
        const d = $('pdeStampDate').checked ? new Date().toLocaleDateString('ar-EG') : '';
        const u = $('pdeStampUser').checked ? ((window.myP && window.myP.name) || '') : '';
        window.pdeCloseModal('pdeStampOv');
        placeAsset('stamp', renderStamp(t, '', c, d, u), 132, 64, `ختم ${t}`);
    };

    /** يرسم ختماً احترافياً (إطار مزدوج + نص عربي/لاتيني + تاريخ ومستخدم). */
    function renderStamp(ar, en, color, date, user) {
        const W = 520, H = 250;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d');
        x.strokeStyle = color; x.fillStyle = color;
        x.lineWidth = 9; roundRect(x, 12, 12, W - 24, H - 24, 16); x.stroke();
        x.lineWidth = 3; roundRect(x, 26, 26, W - 52, H - 52, 10); x.stroke();
        x.textAlign = 'center';
        const hasSub = !!(date || user);
        x.font = 'bold 62px Tahoma, Arial';
        x.fillText(ar, W / 2, en ? 108 : (hasSub ? 112 : 140));
        if (en) { x.font = 'bold 30px Arial'; x.fillText(en, W / 2, 152); }
        if (hasSub) {
            x.font = '22px Tahoma, Arial';
            const line = [date, user].filter(Boolean).join(' · ');
            x.fillText(line, W / 2, en ? 196 : 176);
        }
        return c.toDataURL('image/png');
    }
    function roundRect(x, l, t, w, h, r) {
        x.beginPath();
        x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.quadraticCurveTo(l + w, t, l + w, t + r);
        x.lineTo(l + w, t + h - r); x.quadraticCurveTo(l + w, t + h, l + w - r, t + h);
        x.lineTo(l + r, t + h); x.quadraticCurveTo(l, t + h, l, t + h - r);
        x.lineTo(l, t + r); x.quadraticCurveTo(l, t, l + r, t); x.closePath();
    }

    // ── العلامة المائية (§25) ──────────────────────────────────────────────
    window.pdeWatermarkDialog = function () {
        openModal('pdeWmOv', '💧 علامة مائية', `
            <div class="pde-tabs" id="pdeWmTabs">
                <button class="act" onclick="pdeWmTab('text',this)">🔤 نصية</button>
                <button onclick="pdeWmTab('image',this)">🖼️ صورة</button>
            </div>
            <div id="pdeWmText">
                <input id="pdeWmTxt" class="pde-inp" placeholder="نص العلامة…" value="نسخة غير معتمدة" oninput="pdeWmPrev()">
                <div class="pde-grid2" style="margin-top:8px">
                    <label>الحجم<input type="number" id="pdeWmSize" value="60" oninput="pdeWmPrev()"></label>
                    <label>الدوران<input type="number" id="pdeWmRot" value="45" oninput="pdeWmPrev()"></label>
                    <label>الشفافية<input type="number" id="pdeWmOp" step="0.05" min="0.02" max="1" value="0.18" oninput="pdeWmPrev()"></label>
                    <label>اللون<input type="color" id="pdeWmColor" value="#9E9E9E" oninput="pdeWmPrev()"></label>
                    <label>الموضع<select id="pdeWmPos"><option value="center">وسط</option><option value="topleft">أعلى</option><option value="bottomright">أسفل</option></select></label>
                    <label>الخط<select id="pdeWmFont"><option>Amiri</option><option>Cairo</option><option>Helvetica</option></select></label>
                </div>
                <div id="pdeWmPreview" class="pde-wmprev"></div>
            </div>
            <div id="pdeWmImage" style="display:none">
                <input type="file" accept="image/*" id="pdeWmFile" onchange="pdeWmImg(this)">
                <div id="pdeWmImgPrev" class="pde-sigprev"></div>
            </div>
            <div class="pde-sec">التطبيق على</div>
            <select id="pdeWmPages" class="pde-inp">
                <option value="all">كل الصفحات</option>
                <option value="current">الصفحة الحالية فقط</option>
                <option value="list">صفحات محدّدة…</option>
            </select>
            <input id="pdeWmList" class="pde-inp" style="margin-top:8px" placeholder="مثال: 1,3,5-8">`,
            `<button class="btn" onclick="pdeCloseModal('pdeWmOv')">إلغاء</button>
             <button class="btn b-g" onclick="pdeWmApply()">💧 تطبيق</button>`, 560);
        window.pdeWmPrev();
    };

    let _wmTab = 'text';
    window.pdeWmTab = function (t, b) {
        _wmTab = t;
        document.querySelectorAll('#pdeWmTabs button').forEach(x => x.classList.remove('act')); b.classList.add('act');
        $('pdeWmText').style.display = t === 'text' ? '' : 'none';
        $('pdeWmImage').style.display = t === 'image' ? '' : 'none';
    };
    window.pdeWmPrev = function () {
        const p = $('pdeWmPreview'); if (!p) return;
        p.innerHTML = `<div style="transform:rotate(-${$('pdeWmRot').value}deg);opacity:${$('pdeWmOp').value};color:${$('pdeWmColor').value};font-size:${Math.min(46, +$('pdeWmSize').value)}px;font-weight:800;font-family:Tahoma">${esc($('pdeWmTxt').value)}</div>`;
    };
    window.pdeWmImg = function (inp) {
        const f = inp.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { PDE._wmImg = rd.result; $('pdeWmImgPrev').innerHTML = `<img src="${esc(rd.result)}" style="max-width:100%;max-height:140px;opacity:.4">`; };
        rd.readAsDataURL(f);
    };

    window.pdeWmApply = function () {
        const scope = $('pdeWmPages').value;
        const pageList = scope === 'list' ? parseRange($('pdeWmList').value) : null;
        if (scope === 'list' && (!pageList || !pageList.length)) { toast('حدّد الصفحات (مثال: 1,3,5-8)', 'er'); return; }
        const base = { pages: scope, pageList, page: PDE.page };
        if (_wmTab === 'image') {
            if (!PDE._wmImg) { toast('اختر صورة العلامة', 'er'); return; }
            const a = PDE.analysis.pages[PDE.page - 1];
            PDE.pushOp(PDFE.Ops.make('watermark', Object.assign(base, {
                dataUrl: PDE._wmImg, allPages: scope === 'all',
                x: a.width * 0.22, y: a.height * 0.38, w: a.width * 0.56, h: a.height * 0.24,
                opacity: 0.16, text: '[صورة]'
            })));
        } else {
            PDE.pushOp(PDFE.Ops.make('watermark', Object.assign(base, {
                text: $('pdeWmTxt').value,
                fontSize: +$('pdeWmSize').value, rotation: +$('pdeWmRot').value,
                opacity: +$('pdeWmOp').value, color: $('pdeWmColor').value,
                position: $('pdeWmPos').value, fontFamily: $('pdeWmFont').value
            })));
        }
        window.pdeCloseModal('pdeWmOv');
        toast('💧 ستُطبَّق العلامة المائية عند الحفظ', 'ok', 5000);
    };

    function parseRange(s) {
        const out = new Set();
        String(s || '').split(/[,،]/).forEach(part => {
            const m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(part);
            if (m) { for (let i = +m[1]; i <= +m[2]; i++) out.add(i); }
            else { const n = parseInt(part, 10); if (n) out.add(n); }
        });
        return Array.from(out).sort((a, b) => a - b);
    }

    // ── رمز QR (§43) + الأدوات المحاسبية (§42) ─────────────────────────────
    window.pdeQRDialog = function () {
        const co = (window.cfg && window.cfg.companyName) || '';
        openModal('pdeQROv', '▦ إضافة رمز QR', `
            <label class="pde-f">المحتوى<textarea id="pdeQRContent" rows="3" class="pde-inp">${esc(co)}</textarea></label>
            <div class="pde-grid2">
                <label>الحجم (نقطة)<input type="number" id="pdeQRSize" value="90" min="30" max="300"></label>
                <label>الهامش<input type="number" id="pdeQRMargin" value="2" min="0" max="8"></label>
                <label>تصحيح الأخطاء<select id="pdeQRECC"><option value="L">L — 7%</option><option value="M" selected>M — 15%</option><option value="Q">Q — 25%</option><option value="H">H — 30%</option></select></label>
            </div>
            <div class="pde-sec">⚡ محتوى سريع</div>
            <div class="pde-row" style="flex-wrap:wrap">
                <button class="btn" onclick="pdeQRQuick('company')">🏢 بيانات الشركة</button>
                <button class="btn" onclick="pdeQRQuick('doc')">📄 رابط المستند</button>
                <button class="btn" onclick="pdeQRQuick('verify')">✅ رمز تحقّق</button>
            </div>
            <div id="pdeQRPrev" class="pde-sigprev"></div>`,
            `<button class="btn" onclick="pdeCloseModal('pdeQROv')">إلغاء</button>
             <button class="btn b-b" onclick="pdeQRPreview()">معاينة</button>
             <button class="btn b-g" onclick="pdeQRApply()">▦ إضافة</button>`);
    };

    window.pdeQRQuick = function (k) {
        const cfg = window.cfg || {};
        const d = PDE.doc || {};
        const v = {
            company: [cfg.companyName, cfg.vatNumber ? 'الرقم الضريبي: ' + cfg.vatNumber : '', cfg.crNumber ? 'س.ت: ' + cfg.crNumber : '', cfg.phone, cfg.email].filter(Boolean).join('\n'),
            doc: d.url || location.origin,
            verify: `${cfg.companyName || ''}|${d.name || ''}|${new Date().toISOString().slice(0, 10)}|${(window.curU && window.curU.email) || ''}`
        }[k];
        $('pdeQRContent').value = v;
        window.pdeQRPreview();
    };

    function makeQR(content, ecc, margin) {
        if (typeof qrcode !== 'function') throw new Error('مكتبة QR غير محمّلة');
        const q = qrcode(0, ecc || 'M');
        q.addData(content);
        q.make();
        return q.createDataURL(8, margin == null ? 2 : margin);
    }

    window.pdeQRPreview = function () {
        try {
            const url = makeQR($('pdeQRContent').value, $('pdeQRECC').value, +$('pdeQRMargin').value);
            $('pdeQRPrev').innerHTML = `<img src="${url}" style="width:150px;image-rendering:pixelated">`;
        } catch (e) { toast('تعذّر توليد الرمز: ' + e.message, 'er'); }
    };

    window.pdeQRApply = function () {
        const c = $('pdeQRContent').value.trim();
        if (!c) { toast('أدخل محتوى الرمز', 'er'); return; }
        try {
            const url = makeQR(c, $('pdeQRECC').value, +$('pdeQRMargin').value);
            const s = Math.max(30, Math.min(300, +$('pdeQRSize').value || 90));
            window.pdeCloseModal('pdeQROv');
            PDE._place = { n: PDE.page, a: PDE.analysis.pages[PDE.page - 1], sx: 60, sy: 60 };
            placeAsset('qr', url, s, s, 'رمز QR', c);
        } catch (e) { toast('تعذّر توليد الرمز: ' + e.message, 'er', 6000); }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [IO-EXPORT] البناء والتصدير (§29 §30 §55)
    // ═══════════════════════════════════════════════════════════════════════════

    /** يجمع كل العمليات الفعّالة الجاهزة للتصدير. */
    function collectOps() {
        return PDE.history.active().slice();
    }

    /** يبني الملف الناتج مع التحقق النهائي. */
    async function buildOutput(extraOps, opts) {
        const ops = collectOps().concat(extraOps || []);
        const live = PDE.pageOrder.filter(n => !PDE.deletedPages.has(n));
        PDE.busyOn('جارٍ بناء ملف PDF…');
        try {
            PDE.busyMsg('تطبيق التعديلات على بنية الملف…', 0.25);
            // أعداد عمليات إظهار النص لكل صفحة — يتحقّق بها المحرك من تطابق
            // ترقيمه مع pdf.js قبل أي إزالة، فلا يمحو نصاً خاطئاً.
            const opCounts = PDE.analysis.pages
                .filter(Boolean).map(pg => [pg.n, pg.opCount]).filter(e => e[1] != null);
            const r = await PDFE.Export.buildSafe(PDE.ctx, ops, Object.assign({
                arabicFont: PDE.arabicFont || 'Amiri',
                expectPages: live.length,
                opCounts
            }, opts || {}));
            PDE.busyMsg('التحقق من سلامة الملف…', 0.9);
            PDE.busyOff();
            return r;
        } catch (e) {
            PDE.busyOff();
            throw e;
        }
    }
    PDE.buildOutput = buildOutput;

    /** يعرض تقرير البناء للمستخدم بلغة واضحة. */
    function reportToast(r) {
        const s = r.report.surgery;
        const v = r.validation || {};
        const bits = [];
        if (s.applied) bits.push(`✅ أُزيل ${s.applied} نص من بنية الملف`);
        if (s.fallback) bits.push(`⚠️ ${s.fallback} استُخدم لها البديل الآمن`);
        if (r.report.drawn) bits.push(`🖊️ رُسم ${r.report.drawn} نص`);
        if (v.pages) bits.push(`📄 ${v.pages} صفحة`);
        if (v.textSearchable) bits.push('🔍 النص قابل للبحث');
        toast(bits.join(' · ') || '✅ تم', v.ok === false ? 'er' : 'ok', 8000);
        (r.report.warnings || []).slice(0, 3).forEach(w => toast('⚠️ ' + w, 'er', 9000));
    }

    function download(bytes, name) {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    PDE.download = download;

    window.pdeDownload = async function () {
        try {
            const r = await buildOutput();
            download(r.bytes, `${fileSafe(PDE.doc.name)}-معدّل.pdf`);
            reportToast(r);
            PDFE.Audit.logOps(PDE.doc.name, PDE.doc.id, collectOps());
        } catch (e) { exportError(e); }
    };


    /** يعرض فشل التصدير بلغة واضحة — وبنافذة مفصّلة إن سقط نص للمستخدم. */
    function exportError(e) {
        if (e && e.code === 'DROPPED_TEXT') {
            openModal('pdeDropOv', '⛔ لم يكتمل التصدير', `
                <div class="pde-warn">لم يُنشأ الملف حمايةً لعملك: تعذّر كتابة <b>${e.dropped.length}</b> نص في الملف الناتج،
                وتسليمه هكذا كان سيعطيك ملفاً بلا تعديلاتك ودون أن تدري.</div>
                <div class="pde-sec">النصوص التي تعذّرت كتابتها</div>
                <ul class="pde-droplist">${e.dropped.slice(0, 12).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
                ${e.dropped.length > 12 ? `<div class="pde-meta">…و${e.dropped.length - 12} غيرها</div>` : ''}
                <div class="pde-sec">السبب الأرجح والحل</div>
                <div class="pde-meta">تعذّر تحميل الخط العربي اللازم لتضمينه في الملف. تحقّق من الاتصال بالإنترنت،
                ومن أن مانع الإعلانات أو جدار الحماية لا يحجب <b>cdn.jsdelivr.net</b>، ثم أعد المحاولة.</div>`,
                `<button class="btn" onclick="pdeCloseModal('pdeDropOv')">إغلاق</button>
                 <button class="btn b-g" onclick="pdeCloseModal('pdeDropOv');pdeRetryArabic()">🔄 إعادة تحميل الخط العربي</button>`, 560);
            return;
        }
        toast('❌ تعذّر التصدير: ' + ((e && e.message) || ''), 'er', 9000);
    }
    PDE.exportError = exportError;

    async function exportPages(pages, filename, noToast) {
        const ops = collectOps().concat([PDFE.Ops.make('page.extract', { pages })]);
        const r = await PDFE.Export.buildSafe(PDE.ctx, ops, { arabicFont: PDE.arabicFont || 'Amiri' });
        download(r.bytes, filename);
        if (!noToast) toast(`⤓ استُخرجت ${pages.length} صفحة`, 'ok');
    }

    window.pdeExportMenu = function () {
        openModal('pdeExpOv', '📤 التصدير والطباعة', `
            <div class="pde-explist">
                <button onclick="pdeDownload();pdeCloseModal('pdeExpOv')"><b>⬇️ تنزيل PDF المعدّل</b><small>الملف كاملاً مع كل التعديلات</small></button>
                <button onclick="pdeSaveToSystem();pdeCloseModal('pdeExpOv')"><b>💾 حفظ نسخة في النظام</b><small>ينشئ نسخة جديدة ويحتفظ بالأصل</small></button>
                <button onclick="pdePagesDialog();pdeCloseModal('pdeExpOv')"><b>⤓ تصدير صفحات محدّدة</b><small>استخراج نطاق صفحات كملف مستقل</small></button>
                <button onclick="pdeExportImages()"><b>🖼️ تصدير الصفحات كصور</b><small>PNG عالي الدقة لكل صفحة</small></button>
                <button onclick="pdeExtractText()"><b>📝 استخراج النص</b><small>ملف نصي بكل محتوى المستند</small></button>
                <button onclick="pdePrint()"><b>🖨️ طباعة</b><small>يفتح نافذة الطباعة بالملف المعدّل</small></button>
                <button onclick="pdeProtectDialog()"><b>🔒 حماية بكلمة مرور</b><small>تقييد الفتح والطباعة والنسخ</small></button>
                <button onclick="pdeValidateNow()"><b>✅ فحص سلامة الملف</b><small>تحقق شامل قبل التسليم</small></button>
            </div>`, `<button class="btn" onclick="pdeCloseModal('pdeExpOv')">إغلاق</button>`, 520);
    };

    window.pdeExportImages = async function () {
        window.pdeCloseModal('pdeExpOv');
        const live = PDE.pageOrder.filter(n => !PDE.deletedPages.has(n));
        if (live.length > 30 && !confirm(`سيُنزَّل ${live.length} ملف صورة. المتابعة؟`)) return;
        PDE.busyOn('جارٍ تصدير الصور…');
        try {
            for (let i = 0; i < live.length; i++) {
                const n = live[i];
                PDE.busyMsg(`الصفحة ${n} (${i + 1}/${live.length})…`, (i + 1) / live.length);
                const c = document.createElement('canvas');
                await PDFE.Engine.get().renderPage(PDE.ctx, n, 2, c, {});
                await new Promise(res => c.toBlob(b => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(b);
                    a.download = `${fileSafe(PDE.doc.name)}-صفحة${n}.png`;
                    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); res();
                }, 'image/png'));
            }
            PDE.busyOff();
            toast(`🖼️ صُدِّرت ${live.length} صورة`, 'ok');
        } catch (e) { PDE.busyOff(); exportError(e); }
    };

    window.pdeExtractText = async function () {
        window.pdeCloseModal('pdeExpOv');
        PDE.busyOn('جارٍ استخراج النص…');
        let out = `${PDE.doc.name}\n${'='.repeat(50)}\n\n`;
        for (let n = 1; n <= PDE.analysis.total; n++) {
            PDE.busyMsg(`الصفحة ${n}…`, n / PDE.analysis.total);
            const a = await PDFE.Parser.ensurePage(PDE.analysis, n);
            const pool = a.items.concat(PDE.ocrPages.get(n) || []).filter(i => !i._deleted);
            const lines = new Map();
            pool.forEach(i => {
                const k = Math.round(i.y / 3);
                if (!lines.has(k)) lines.set(k, []);
                lines.get(k).push(i);
            });
            out += `\n--- صفحة ${n} ---\n`;
            Array.from(lines.entries()).sort((x, y) => y[0] - x[0]).forEach(([, arr]) => {
                arr.sort((p, q) => (p.rtl ? q.x - p.x : p.x - q.x));
                out += arr.map(i => i._newText != null ? i._newText : i.str).join(' ') + '\n';
            });
        }
        PDE.busyOff();
        const b = new Blob([out], { type: 'text/plain;charset=utf-8' });
        const a2 = document.createElement('a');
        a2.href = URL.createObjectURL(b); a2.download = `${fileSafe(PDE.doc.name)}.txt`; a2.click();
        toast('📝 استُخرج النص', 'ok');
    };

    window.pdePrint = async function () {
        window.pdeCloseModal('pdeExpOv');
        try {
            const r = await buildOutput();
            const url = URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' }));
            const w = window.open(url);
            if (!w) { toast('⚠️ المتصفح منع النافذة — اسمح بالنوافذ المنبثقة', 'er', 7000); return; }
            w.addEventListener('load', () => { try { w.print(); } catch (e) { /* بعض المتصفحات تطبع يدوياً */ } });
        } catch (e) { exportError(e); }
    };

    window.pdeValidateNow = async function () {
        window.pdeCloseModal('pdeExpOv');
        try {
            const r = await buildOutput();
            const v = r.validation || {};
            openModal('pdeValOv', '✅ فحص سلامة الملف', `
                <div class="pde-val ${v.ok ? 'ok' : 'bad'}">${v.ok ? '✅ الملف سليم وجاهز للتسليم' : '⚠️ توجد ملاحظات'}</div>
                <div class="pde-kv"><span>يُفتح بشكل صحيح</span><b>${v.errors && v.errors.length ? '❌ لا' : '✅ نعم'}</b></div>
                <div class="pde-kv"><span>عدد الصفحات</span><b>${v.pages || 0}</b></div>
                <div class="pde-kv"><span>النص قابل للبحث</span><b>${v.textSearchable ? '✅ نعم' : '⚠️ لا (مستند صوري)'}</b></div>
                <div class="pde-kv"><span>إزالة النص من البنية</span><b>${r.report.surgery.applied} نجحت · ${r.report.surgery.fallback} بديل</b></div>
                <div class="pde-kv"><span>نصوص مرسومة</span><b>${r.report.drawn}</b></div>
                <div class="pde-kv"><span>حجم الملف</span><b>${(r.bytes.length / 1024).toFixed(0)} ك.ب</b></div>
                ${v.leaked && v.leaked.length ? `<div class="pde-warn">⚠️ لم تُزَل: ${v.leaked.slice(0, 5).map(esc).join(' · ')}</div>` : ''}
                ${(v.errors || []).map(e => `<div class="pde-warn">❌ ${esc(e)}</div>`).join('')}
                ${(v.warnings || []).map(e => `<div class="pde-warn">⚠️ ${esc(e)}</div>`).join('')}
                ${(r.report.warnings || []).map(e => `<div class="pde-warn">⚠️ ${esc(e)}</div>`).join('')}`,
                `<button class="btn" onclick="pdeCloseModal('pdeValOv')">إغلاق</button>`);
        } catch (e) { exportError(e); }
    };

    // ── الحماية (§31) ─────────────────────────────────────────────────────
    window.pdeProtectDialog = function () {
        window.pdeCloseModal('pdeExpOv');
        openModal('pdeProtOv', '🔒 حماية المستند', `
            <div class="pde-warn">ℹ️ التشفير الكامل بكلمة مرور يتطلّب محرّكاً تجارياً. المتاح حالياً: <b>تسجيل قيود الاستخدام في بيانات الملف</b> + <b>تسطيح المحتوى الحسّاس</b> لمنع النسخ والاستخراج.</div>
            <label class="pde-toggle"><input type="checkbox" id="pdeProtFlatten"> 🔐 تسطيح الصفحات (يمنع نسخ النص واستخراجه نهائياً)</label>
            <div class="pde-meta">التسطيح يحوّل الصفحات إلى صور عالية الدقة — يضمن عدم استخراج أي نص، لكنه يفقد قابلية البحث ويكبّر الملف. استخدمه للمستندات المنقّحة قانونياً فقط.</div>
            <div class="pde-sec">الأذونات المسجَّلة</div>
            <label class="pde-toggle"><input type="checkbox" id="pdePermPrint" checked> السماح بالطباعة</label>
            <label class="pde-toggle"><input type="checkbox" id="pdePermCopy" checked> السماح بالنسخ</label>
            <label class="pde-toggle"><input type="checkbox" id="pdePermEdit"> السماح بالتعديل</label>
            <label class="pde-toggle"><input type="checkbox" id="pdePermComment" checked> السماح بالتعليقات</label>`,
            `<button class="btn" onclick="pdeCloseModal('pdeProtOv')">إلغاء</button>
             <button class="btn b-g" onclick="pdeProtectApply()">🔒 تطبيق وتنزيل</button>`);
    };

    window.pdeProtectApply = async function () {
        const flatten = $('pdeProtFlatten').checked;
        const perms = {
            printing: $('pdePermPrint').checked, copying: $('pdePermCopy').checked,
            editing: $('pdePermEdit').checked, commenting: $('pdePermComment').checked
        };
        window.pdeCloseModal('pdeProtOv');
        try {
            if (flatten) return await flattenAndDownload(perms);
            const r = await buildOutput([PDFE.Ops.make('doc.meta', {
                keywords: 'الأذونات: ' + Object.entries(perms).filter(([, v]) => v).map(([k]) => k).join(', ')
            })]);
            download(r.bytes, `${fileSafe(PDE.doc.name)}-محمي.pdf`);
            toast('🔒 سُجّلت قيود الاستخدام في بيانات الملف', 'ok', 6000);
            PDFE.Audit.log('حماية مستند', `طُبّقت قيود الاستخدام على «${PDE.doc.name}»`);
        } catch (e) { toast('تعذّرت الحماية: ' + e.message, 'er', 7000); }
    };

    /**
     * التسطيح: يبني الملف المعدّل، يرسم كل صفحة صورةً، ويعيد تركيبها.
     * يُستخدم فقط كخيار صريح — لأنه يفقد قابلية البحث (§30).
     */
    async function flattenAndDownload(perms) {
        if (!confirm('التسطيح يحوّل المستند إلى صور ويفقد قابلية البحث ونسخ النص نهائياً.\nهذا مطلوب للتنقيح القانوني الكامل. المتابعة؟')) return;
        PDE.busyOn('جارٍ بناء الملف المعدّل…');
        const built = await buildOutput();
        PDE.busyMsg('جارٍ التسطيح…', 0.3);
        const PDFLib = await PDFE.libs.ensurePdfLib();
        const lib = PDFE.libs.ensurePdfJs();
        const src = await lib.getDocument({ data: built.bytes.slice(0) }).promise;
        const out = await PDFLib.PDFDocument.create();
        for (let n = 1; n <= src.numPages; n++) {
            PDE.busyMsg(`تسطيح الصفحة ${n} من ${src.numPages}…`, 0.3 + 0.6 * (n / src.numPages));
            const pg = await src.getPage(n);
            const vp = pg.getViewport({ scale: 2 });
            const c = document.createElement('canvas');
            c.width = vp.width; c.height = vp.height;
            await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            const png = await out.embedPng(c.toDataURL('image/png'));
            const p = out.addPage([vp.width / 2, vp.height / 2]);
            p.drawImage(png, { x: 0, y: 0, width: vp.width / 2, height: vp.height / 2 });
        }
        out.setProducer('نظام حساب الأستاذ — GBR · محرر PDF (مسطَّح)');
        out.setKeywords(['flattened', ...Object.entries(perms).filter(([, v]) => v).map(([k]) => k)]);
        const bytes = await out.save();
        await src.destroy();
        PDE.busyOff();
        download(bytes, `${fileSafe(PDE.doc.name)}-مسطّح-محمي.pdf`);
        toast('🔒 أُنشئ ملف مسطَّح — لا يمكن استخراج أي نص منه', 'ok', 7000);
        PDFE.Audit.log('تسطيح مستند', `سُطّح «${PDE.doc.name}» — منع استخراج النص نهائياً`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // [IO-SAVE] الحفظ والنُّسخ (§27 §28 §34)
    // ═══════════════════════════════════════════════════════════════════════════

    window.pdeSaveToSystem = async function () {
        if (!PDE.canEdit()) { toast('🚫 لا تملك صلاحية الحفظ', 'er'); return; }
        const store = PDFE.Storage.adapter();
        if (!store.available()) { toast('⚠️ التخزين غير مهيّأ — ' + store.hint, 'er', 9000); return; }
        const ops = collectOps();
        if (!ops.length && PDE.doc.id) { toast('لا تعديلات لحفظها', 'ok'); return; }

        const label = prompt('وصف مختصر لهذه النسخة (يظهر في سجل النُّسخ):',
            ops.length ? `${ops.length} تعديل — ${new Date().toLocaleDateString('ar-EG')}` : 'النسخة الأصلية');
        if (label === null) return;

        try {
            const r = await buildOutput();
            PDE.busyOn('جارٍ الرفع إلى التخزين…');
            const up = await PDFE.Storage.upload(r.bytes, `${fileSafe(PDE.doc.name)}-v${Date.now()}.pdf`);
            PDE.busyMsg('جارٍ تسجيل النسخة…', 0.85);

            let docId = PDE.doc.id;
            const sum = PDFE.Parser.summary(PDE.analysis);
            if (!docId) {
                // أول حفظ: نسجّل الأصل ثم النسخة المعدّلة
                docId = await PDFE.Storage.saveDoc({
                    name: PDE.doc.name,
                    url: PDE.doc.url || up.url,          // الأصل إن كان له رابط، وإلا النسخة الأولى
                    originalUrl: PDE.doc.url || up.url,
                    pages: sum.pages, docType: sum.docType, language: sum.language,
                    size: up.size, provider: up.provider,
                    linkType: PDE.doc.linkType || null, linkId: PDE.doc.linkId || null,
                    linkLabel: PDE.doc.linkLabel || null, project: PDE.doc.project || null,
                    party: PDE.doc.party || null, docNumber: PDE.doc.docNumber || null, amount: PDE.doc.amount || null,
                    createdAt: Date.now(), updatedAt: Date.now(),
                    createdBy: (window.curU && window.curU.email) || '',
                    createdByName: (window.myP && window.myP.name) || ''
                });
                PDE.doc.id = docId;
            }

            const verId = await PDFE.Storage.saveVersion(docId, {
                url: up.url, label, at: Date.now(),
                by: (window.curU && window.curU.email) || '',
                byName: (window.myP && window.myP.name) || '',
                opCount: ops.length,
                size: up.size,
                pages: (r.validation && r.validation.pages) || sum.pages,
                changes: ops.slice(0, 60).map(o => PDFE.Ops.describe(o)),
                surgery: r.report.surgery,
                degraded: !!(r.validation && r.validation.degraded)
            });
            await PDFE.Storage.saveOps(docId, verId, ops.map(PDE.stripHeavy));
            await PDFE.Storage.updateDoc(docId, { updatedAt: Date.now(), latestVersion: verId, latestUrl: up.url, pages: sum.pages });
            await window.remove(window.ref(window.db, `ledger/pdfEdits/${docId}/_draft`)).catch(() => { });

            PDE.busyOff();
            PDE.dirty = false;
            PDE.refreshUndoBtns();
            reportToast(r);
            toast('💾 حُفظت النسخة في النظام — الأصل محفوظ كما هو', 'ok', 6000);
            await PDFE.Audit.logOps(PDE.doc.name, docId, ops);
            window.pdeRenderInspector();
        } catch (e) {
            PDE.busyOff();
            exportError(e);
        }
    };

    /** سجل النُّسخ + المقارنة (§27 §39). */
    window.pdeShowVersions = function (docId) {
        if (!docId) { toast('احفظ المستند في النظام أولاً', 'er'); return; }
        const d = (window.pdfDocs || {})[docId] || PDE.doc || {};
        const vers = Object.entries((window.pdfVersions || {})[docId] || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
        openModal('pdeVerOv', `🕘 سجل النُّسخ — ${esc(d.name || '')}`, `
            <div class="pde-verlist">
                <div class="pde-ver original">
                    <div class="v-h"><b>📄 النسخة الأصلية</b><span>Original</span></div>
                    <div class="v-m">${d.createdAt ? new Date(d.createdAt).toLocaleString('ar-EG') : ''} · ${esc(d.createdByName || d.createdBy || '')}</div>
                    <div class="v-a"><button class="btn" onclick="pdeOpenVersion('${esc(d.originalUrl || d.url || '')}','الأصل')">فتح</button></div>
                </div>
                ${vers.map(([k, v], i) => `
                <div class="pde-ver">
                    <div class="v-h"><b>${esc(v.label || 'نسخة')}</b><span>v${vers.length - i}</span></div>
                    <div class="v-m">${v.at ? new Date(v.at).toLocaleString('ar-EG') : ''} · ${esc(v.byName || v.by || '')} · ${v.opCount || 0} تعديل${v.pages ? ` · ${v.pages} صفحة` : ''}${v.degraded ? ' · ⚠️ بديل آمن' : ''}</div>
                    ${(v.changes || []).length ? `<details class="v-ch"><summary>عرض ${v.changes.length} تغيير</summary><ul>${v.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}
                    <div class="v-a">
                        <button class="btn b-b" onclick="pdeOpenVersion('${esc(v.url)}','${esc(v.label || '')}')">فتح</button>
                        <button class="btn" onclick="pdeDownloadVersion('${esc(v.url)}','${esc((d.name || 'doc') + '-' + (v.label || ''))}')">⬇️</button>
                        <button class="btn" onclick="pdeCompareVersion('${esc(docId)}','${esc(k)}')">⚖️ مقارنة</button>
                    </div>
                </div>`).join('')}
            </div>
            ${vers.length ? '' : '<div class="pde-meta">لا نُسخ محفوظة بعد.</div>'}`,
            `<button class="btn" onclick="pdeCloseModal('pdeVerOv')">إغلاق</button>`, 620);
    };

    window.pdeOpenVersion = function (url, label) {
        if (!url) { toast('لا رابط لهذه النسخة', 'er'); return; }
        window.pdeCloseModal('pdeVerOv');
        PDE.openUrl(url, Object.assign({}, PDE.doc, { name: (PDE.doc && PDE.doc.name) || 'مستند.pdf', versionLabel: label }));
    };

    window.pdeDownloadVersion = async function (url, name) {
        try {
            const b = await PDFE.Storage.fetchBytes(url);
            download(b, fileSafe(name) + '.pdf');
        } catch (e) { toast('تعذّر التنزيل: ' + e.message, 'er', 6000); }
    };

    /** مقارنة نسخة بالأصل: يعرض قائمة التغييرات المسجّلة (§39). */
    window.pdeCompareVersion = async function (docId, verId) {
        const v = ((window.pdfVersions || {})[docId] || {})[verId] || {};
        PDE.busyOn('جارٍ تحميل تفاصيل التغييرات…');
        let ops = [];
        try { ops = await PDFE.Storage.loadOps(docId, verId); } catch (e) { /* قد لا تكون محفوظة */ }
        PDE.busyOff();
        const groups = {};
        ops.forEach(o => { (groups[o.type] = groups[o.type] || []).push(o); });
        openModal('pdeCmpOv', `⚖️ مقارنة: الأصل ↔ ${esc(v.label || 'النسخة')}`, `
            <div class="pde-kv"><span>عدد التعديلات</span><b>${ops.length || v.opCount || 0}</b></div>
            <div class="pde-kv"><span>التاريخ</span><b>${v.at ? new Date(v.at).toLocaleString('ar-EG') : '—'}</b></div>
            <div class="pde-kv"><span>المستخدم</span><b>${esc(v.byName || v.by || '—')}</b></div>
            <div class="pde-sec">التغييرات حسب النوع</div>
            ${Object.entries(groups).map(([t, list]) => `
                <details class="v-ch" open><summary>${esc(PDFE.Ops.describe(list[0]).split(':')[0])} <b>(${list.length})</b></summary>
                <table class="pde-difftable"><thead><tr><th>صفحة</th><th>قبل</th><th>بعد</th></tr></thead><tbody>
                ${list.slice(0, 40).map(o => `<tr><td>${o.page || '—'}</td>
                    <td class="old">${esc(o.oldText || '—')}</td>
                    <td class="new">${esc(o.newText != null ? o.newText : (o.text || '—'))}</td></tr>`).join('')}
                </tbody></table></details>`).join('') || '<div class="pde-meta">لا تفاصيل مسجّلة لهذه النسخة.</div>'}`,
            `<button class="btn" onclick="pdeCloseModal('pdeCmpOv')">إغلاق</button>
             <button class="btn b-b" onclick="pdeOpenVersion('${esc(v.url || '')}','${esc(v.label || '')}')">فتح هذه النسخة</button>`, 700);
    };

    /** ربط المستند بسجل داخل النظام المحاسبي (§33 §34). */
    window.pdeLinkDialog = function () {
        const opt = (arr, lbl, val) => arr.map(x => `<option value="${esc(val(x))}">${esc(lbl(x))}</option>`).join('');
        const prj = Object.entries(window.projects || {});
        openModal('pdeLinkOv', '🔗 ربط بسجل في النظام', `
            <label class="pde-f">نوع المستند
                <select id="pdeLinkType" data-ss="1">
                    <option value="">— اختر —</option>
                    <option value="salesInvoice">🧾 فاتورة مبيعات</option>
                    <option value="purchaseInvoice">📋 فاتورة مشتريات</option>
                    <option value="contract">📜 عقد</option>
                    <option value="subcontract">📄 عقد باطن</option>
                    <option value="progressBilling">📑 مستخلص</option>
                    <option value="purchaseOrder">📦 أمر شراء</option>
                    <option value="quotation">💼 عرض سعر</option>
                    <option value="receipt">💵 سند قبض</option>
                    <option value="payment">💸 سند صرف</option>
                    <option value="journalEntry">📒 مرفق قيد يومية</option>
                    <option value="employeeDoc">👷 مستند موظف</option>
                    <option value="projectDoc">📁 مستند مشروع</option>
                    <option value="supplierDoc">🏭 مستند مورّد</option>
                    <option value="customerDoc">🧑‍💼 مستند عميل</option>
                </select></label>
            <label class="pde-f">المشروع (اختياري)
                <select id="pdeLinkProject" data-ss="1"><option value="">— بدون —</option>${opt(prj, p => p[1].name || p[0], p => p[0])}</select></label>
            <div class="pde-grid2">
                <label>رقم المستند<input id="pdeLinkNumber" placeholder="INV-2026-001"></label>
                <label>المبلغ<input id="pdeLinkAmount" type="number" step="0.01" placeholder="0.00"></label>
                <label>الجهة (عميل/مورّد)<input id="pdeLinkParty"></label>
                <label>معرّف السجل<input id="pdeLinkId" placeholder="مفتاح السجل"></label>
            </div>
            <div class="pde-meta">الربط يجعل المستند يظهر مع سجله ويسجّل مصدره في سجل التدقيق.</div>`,
            `<button class="btn" onclick="pdeCloseModal('pdeLinkOv')">إلغاء</button>
             <button class="btn b-g" onclick="pdeLinkApply()">🔗 ربط</button>`);
        if (typeof window.ssEnhance === 'function') {
            window.ssEnhance('pdeLinkType', '🔍 ابحث عن نوع…');
            window.ssEnhance('pdeLinkProject', '🔍 ابحث عن مشروع…');
        }
    };

    window.pdeLinkApply = async function () {
        const t = $('pdeLinkType').value;
        if (!t) { toast('اختر نوع المستند', 'er'); return; }
        const labels = {
            salesInvoice: 'فاتورة مبيعات', purchaseInvoice: 'فاتورة مشتريات', contract: 'عقد', subcontract: 'عقد باطن',
            progressBilling: 'مستخلص', purchaseOrder: 'أمر شراء', quotation: 'عرض سعر', receipt: 'سند قبض',
            payment: 'سند صرف', journalEntry: 'مرفق قيد', employeeDoc: 'مستند موظف', projectDoc: 'مستند مشروع',
            supplierDoc: 'مستند مورّد', customerDoc: 'مستند عميل'
        };
        const pid = $('pdeLinkProject').value;
        Object.assign(PDE.doc, {
            linkType: t, linkLabel: labels[t],
            linkId: $('pdeLinkId').value || null,
            docNumber: $('pdeLinkNumber').value || null,
            amount: $('pdeLinkAmount').value || null,
            party: $('pdeLinkParty').value || null,
            project: pid ? ((window.projects || {})[pid] || {}).name || pid : null,
            projectId: pid || null
        });
        if (PDE.doc.id) {
            await PDFE.Storage.updateDoc(PDE.doc.id, {
                linkType: t, linkLabel: labels[t], linkId: PDE.doc.linkId,
                docNumber: PDE.doc.docNumber, amount: PDE.doc.amount,
                party: PDE.doc.party, project: PDE.doc.project, projectId: PDE.doc.projectId
            });
        }
        window.pdeCloseModal('pdeLinkOv');
        window.pdeRenderInspector();
        toast('🔗 رُبط المستند بـ ' + labels[t], 'ok');
        PDFE.Audit.log('ربط مستند PDF', `رُبط «${PDE.doc.name}» بـ ${labels[t]}${PDE.doc.docNumber ? ' رقم ' + PDE.doc.docNumber : ''}`);
    };

    /** نافذة «تحليل المستند» (§38). */
    window.pdeAnalyzeDialog = async function () {
        if (PDE.analysis.analyzedCount < PDE.analysis.total) {
            PDE.busyOn('جارٍ تحليل كل الصفحات…');
            for (let n = 1; n <= PDE.analysis.total; n++) {
                if (!PDE.analysis.pages[n - 1]) { await PDFE.Parser.ensurePage(PDE.analysis, n); PDE.busyMsg(`الصفحة ${n}…`, n / PDE.analysis.total); }
            }
            PDE.design = PDFE.Style.buildDesignSystem(PDE.analysis);
            PDE.busyOff();
        }
        const s = PDFE.Parser.summary(PDE.analysis);
        const row = (k, v) => `<div class="pde-kv"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`;
        openModal('pdeAnaOv', '📊 تحليل المستند', `
            ${row('نوع المستند', s.docType)}${row('اللغة', s.language)}${row('الصفحات', s.pages)}
            ${row('الخطوط المكتشفة', s.fonts)}${row('الألوان المكتشفة', s.colors)}
            ${row('الصور', s.images)}${row('الجداول المكتشفة', s.tables)}
            ${row('كتل النص', s.textBlocks)}${row('الأشكال المتجهة', s.shapes)}
            ${s.scannedPages ? row('صفحات ممسوحة ضوئياً', s.scannedPages) : ''}
            <div class="pde-sec">🔤 الخطوط</div>
            ${Array.from(PDE.analysis.fonts.values()).sort((a, b) => b.count - a.count).slice(0, 10)
                .map(f => `<div class="pde-kv"><span style="font-family:'${esc(f.family)}',Tahoma">${esc(f.family)}${f.bold ? ' Bold' : ''}${f.italic ? ' Italic' : ''}</span><b>${f.count} استخدام</b></div>`).join('')}
            <div class="pde-sec">🎨 الألوان</div>
            <div class="pde-swatches">${Array.from(PDE.analysis.colors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20)
                .map(([h, c]) => `<button class="pde-sw" style="background:${esc(h)}" title="${esc(h)} — ${esc(PDFE.colorName(h))} (${c})"></button>`).join('')}</div>`,
            `<button class="btn" onclick="pdeCloseModal('pdeAnaOv')">إغلاق</button>
             <button class="btn b-b" onclick="pdeInspTab('design');pdeCloseModal('pdeAnaOv')">🎨 فتح نظام التصميم</button>`, 560);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [IO-KEYS] الاختصارات (§53) وإتاحة الوصول (§54)
    // ═══════════════════════════════════════════════════════════════════════════

    window.pdeUndo = function () {
        const op = PDE.history.undo();
        if (!op) return;
        revertVisual(op);
        PDE.status('↶ تراجع: ' + PDFE.Ops.describe(op));
        PDE.refreshUndoBtns();
    };
    window.pdeRedo = function () {
        const op = PDE.history.redo();
        if (!op) return;
        applyVisual(op);
        PDE.status('↷ إعادة: ' + PDFE.Ops.describe(op));
        PDE.refreshUndoBtns();
    };

    /** يعكس الأثر البصري لعملية عند التراجع (التصدير يعتمد على المكدّس نفسه). */
    function revertVisual(op) {
        const a = op.page ? PDE.analysis.pages[op.page - 1] : null;
        if (op.itemId && a) {
            const it = a.items.find(i => i.id === op.itemId) || (PDE.ocrPages.get(op.page) || []).find(i => i.id === op.itemId);
            if (it) { delete it._newText; it._edited = false; it._deleted = false; }
        }
        if (op.objectId) { const o = PDE.objects.find(x => x.id === op.objectId); if (o) o._deleted = true; }
        if (op.type === 'page.delete') PDE.deletedPages.delete(op.page);
        if (op.type === 'page.rotate') PDE.pageRotation.set(op.page, ((PDE.pageRotation.get(op.page) || 0) - op.deg + 360) % 360);
        if (op.page) PDE.refreshLayer(op.page); else PDE.refreshAllLayers();
        if (op.type.startsWith('page.')) { PDE.rendered.delete(op.page); PDE.buildPageSlots(); PDE.renderVisiblePages(); window.pdeRenderThumbs(); }
    }
    function applyVisual(op) {
        const a = op.page ? PDE.analysis.pages[op.page - 1] : null;
        if (op.itemId && a) {
            const it = a.items.find(i => i.id === op.itemId) || (PDE.ocrPages.get(op.page) || []).find(i => i.id === op.itemId);
            if (it) { it._newText = op.newText; it._edited = true; it._deleted = !String(op.newText || '').trim(); }
        }
        if (op.objectId) { const o = PDE.objects.find(x => x.id === op.objectId); if (o) o._deleted = false; }
        if (op.type === 'page.delete') PDE.deletedPages.add(op.page);
        if (op.type === 'page.rotate') PDE.pageRotation.set(op.page, ((PDE.pageRotation.get(op.page) || 0) + op.deg) % 360);
        if (op.page) PDE.refreshLayer(op.page); else PDE.refreshAllLayers();
        if (op.type.startsWith('page.')) { PDE.rendered.delete(op.page); PDE.buildPageSlots(); PDE.renderVisiblePages(); window.pdeRenderThumbs(); }
    }

    window.pdeBindShortcuts = function () {
        if (PDE._keysBound) return;
        PDE._keysBound = true;
        document.addEventListener('keydown', e => {
            const pg = $('pg-pdfeditor');
            if (!pg || !pg.classList.contains('act') || !PDE.ctx) return;
            const editing = e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
            const mod = e.ctrlKey || e.metaKey;

            if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); return window.pdeUndo(); }
            if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); return window.pdeRedo(); }
            if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); return window.pdeDownload(); }
            if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); return window.pdeToggleSearch(); }
            if (mod && e.key.toLowerCase() === 'h') { e.preventDefault(); window.pdeToggleSearch(); setTimeout(() => { const r = $('pdeR'); if (r) r.focus(); }, 80); return; }
            if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); return window.pdePrint(); }
            if (editing) return;

            if (mod && e.key.toLowerCase() === 'c' && PDE.selection) {
                PDE.clipText = PDE.selection.el.textContent;
                PDE.clipStyle = PDE.selection.model ? PDFE.Style.extract(PDE.selection.model) : null;
                toast('📋 نُسخ النص والنمط', 'ok'); return;
            }
            if (mod && e.key.toLowerCase() === 'v' && PDE.clipStyle && PDE.selection) { e.preventDefault(); return window.pdePasteStyle(); }
            if (mod && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                toast('ℹ️ تحديد الكل غير مدعوم على عناصر PDF — استخدم البحث للعمل على عدة عناصر', 'ok', 5000);
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') { if (PDE.selection) { e.preventDefault(); window.pdeDeleteSelected(); } return; }
            if (e.key === 'Escape') { PDE.clearSelection(); window.pdeSetTool('select'); return; }
            if (e.key === 'PageDown') { e.preventDefault(); return window.pdeGoPage(PDE.page + 1); }
            if (e.key === 'PageUp') { e.preventDefault(); return window.pdeGoPage(PDE.page - 1); }
            if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); return window.pdeZoom(1); }
            if (mod && e.key === '-') { e.preventDefault(); return window.pdeZoom(-1); }
            if (mod && e.key === '0') { e.preventDefault(); return window.pdeFit('page'); }

            // تحريك العنصر المحدّد بالأسهم
            if (PDE.selection && e.key.startsWith('Arrow')) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const el = PDE.selection.el;
                const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                el.style.left = (parseFloat(el.style.left) + dx) + 'px';
                el.style.top = (parseFloat(el.style.top) + dy) + 'px';
                PDE.refreshSelBox();
                clearTimeout(PDE._arrowT);
                PDE._arrowT = setTimeout(() => { const ev = new Event('commit'); el.dispatchEvent(ev); window.pdeSetGeom('x', PDE.selection.model.x); }, 350);
            }
        });
    };

    console.log('✅ PDF Editor IO [IO] loaded');
})();
