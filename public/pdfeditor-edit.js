// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║   📄 Professional PDF Editor — محرك التحرير (Editing Layer)                    ║
// ║   ────────────────────────────────────────────────────────────────────────    ║
// ║   [ED-TOOL]  أدوات المحرر والتبديل بينها                                       ║
// ║   [ED-SEL]   أداة التحديد: صندوق + 8 مقابض + مقبض دوران                        ║
// ║   [ED-TEXT]  تحرير النص الحقيقي: نقر → صندوق تحرير → استبدال ذكي               ║
// ║   [ED-OBJ]   الكائنات: نص جديد · صور · أشكال · تعليقات · تواقيع · أختام         ║
// ║   [ED-LAYER] الطبقات: تقديم/تأخير                                             ║
// ║   [ED-STYLE] لوحة الفحص · نسخ/لصق النمط · مطابقة الأصل                         ║
// ║   [ED-COLOR] منتقي ألوان احترافي + القطّارة + ألوان المستند                     ║
// ║   [ED-INSP]  اللوحة اليمنى بتبويباتها الخمسة                                   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
/* global PDFE, PDE */

(function () {
    'use strict';

    const esc = window.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const $ = id => document.getElementById(id);
    const toast = (m, t, d) => PDE.toast(m, t, d);
    const num = v => Math.round((+v || 0) * 100) / 100;

    let _objSeq = 0;
    const newId = () => 'o' + Date.now().toString(36) + (_objSeq++);

    // ═══════════════════════════════════════════════════════════════════════════
    // [ED-TOOL] الأدوات
    // ═══════════════════════════════════════════════════════════════════════════
    const TOOL_HINT = {
        select: 'انقر أي عنصر لتحديده وتحريره',
        text: 'انقر أي نص لتحريره مباشرةً — نقرة واحدة تكفي',
        addtext: 'انقر في المكان الذي تريد إضافة نص فيه',
        image: 'انقر لاختيار صورة وإدراجها',
        shape: 'اسحب لرسم مستطيل (Shift = دائرة)',
        line: 'اسحب لرسم خط',
        highlight: 'اسحب فوق النص لتظليله',
        underline: 'اسحب فوق النص لتسطيره',
        strike: 'اسحب فوق النص لشطبه',
        comment: 'انقر لإضافة تعليق',
        link: 'اسحب لتحديد منطقة الرابط',
        sign: 'انقر لإضافة توقيع',
        stamp: 'انقر لإضافة ختم',
        redact: 'اسحب فوق البيانات الحسّاسة — ستُزال فعلياً من الملف',
        eyedrop: 'انقر أي نقطة لقراءة لونها الحقيقي'
    };

    window.pdeSetTool = function (t) {
        if (t !== 'select' && !PDE.canEdit()) { toast('🚫 لا تملك صلاحية التحرير', 'er'); return; }
        // أدوات تفتح نافذة مباشرة بدل تغيير الوضع
        if (t === 'watermark') return window.pdeWatermarkDialog();
        if (t === 'qr') return window.pdeQRDialog();
        if (t === 'pages') return window.pdePagesDialog();
        if (t === 'merge') return window.pdeMergeDialog();

        PDE.tool = t;
        document.querySelectorAll('.pde-tool').forEach(b => b.classList.toggle('act', b.dataset.tool === t));
        const wrap = $('pdeCanvasWrap');
        if (wrap) wrap.dataset.tool = t;
        PDE.status(TOOL_HINT[t] || '');
        if (t !== 'select') clearSelection();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [ED-SEL] التحديد
    // ═══════════════════════════════════════════════════════════════════════════

    function clearSelection() {
        document.querySelectorAll('.pde-sel-box').forEach(b => b.remove());
        document.querySelectorAll('.pde-selected').forEach(e => e.classList.remove('pde-selected'));
        PDE.selection = null;
        window.pdeRenderInspector();
        hideFloatBar();
    }
    PDE.clearSelection = clearSelection;

    /**
     * يحدّد عنصراً ويرسم صندوق التحديد بمقابضه الثمانية ومقبض الدوران (§13).
     */
    function select(el, kind, model) {
        clearSelection();
        el.classList.add('pde-selected');
        PDE.selection = { kind, el, model };
        drawSelBox(el, kind !== 'text' || (model && model._isObject));
        window.pdeRenderInspector();
        // الشريط العائم اختياري — لا يجوز أن يُسقط التحديد إن أخفق
        if (kind === 'text' || (model && model.kind === 'text')) {
            try { showFloatBar(el, model); } catch (e) { console.warn('تعذّر بناء شريط النص:', e && e.message); }
        }
    }
    PDE.select = select;

    function drawSelBox(el, resizable) {
        const layer = el.parentElement;
        const box = document.createElement('div');
        box.className = 'pde-sel-box';
        Object.assign(box.style, { left: el.style.left, top: el.style.top, width: el.offsetWidth + 'px', height: el.offsetHeight + 'px' });
        if (resizable) {
            ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(h => {
                const g = document.createElement('i'); g.className = 'pde-h pde-h-' + h; g.dataset.h = h; box.appendChild(g);
            });
            const r = document.createElement('i'); r.className = 'pde-h pde-h-rot'; r.dataset.h = 'rot'; r.title = 'تدوير'; box.appendChild(r);
        }
        layer.appendChild(box);
        if (resizable) bindHandles(box, el);
    }

    function refreshSelBox() {
        const s = PDE.selection; if (!s) return;
        const box = s.el.parentElement.querySelector('.pde-sel-box');
        if (box) Object.assign(box.style, { left: s.el.style.left, top: s.el.style.top, width: s.el.offsetWidth + 'px', height: s.el.offsetHeight + 'px' });
    }
    PDE.refreshSelBox = refreshSelBox;

    /** يربط مقابض التغيير والدوران بسحب الفأرة. */
    function bindHandles(box, el) {
        box.querySelectorAll('.pde-h').forEach(h => {
            h.addEventListener('mousedown', e => {
                e.preventDefault(); e.stopPropagation();
                const dir = h.dataset.h;
                const st = { x: e.clientX, y: e.clientY, l: parseFloat(el.style.left), t: parseFloat(el.style.top), w: el.offsetWidth, ht: el.offsetHeight };
                const model = PDE.selection && PDE.selection.model;
                const move = ev => {
                    const dx = ev.clientX - st.x, dy = ev.clientY - st.y;
                    if (dir === 'rot') {
                        const cx = st.l + st.w / 2, cy = st.t + st.ht / 2;
                        const rect = el.parentElement.getBoundingClientRect();
                        const ang = Math.atan2((ev.clientY - rect.top) - cy, (ev.clientX - rect.left) - cx) * 180 / Math.PI + 90;
                        const snapped = ev.shiftKey ? Math.round(ang / 15) * 15 : Math.round(ang);
                        el.style.transform = `rotate(${snapped}deg)`;
                        if (model) model.rotation = -snapped;
                    } else {
                        let l = st.l, t = st.t, w = st.w, ht = st.ht;
                        if (dir.includes('e')) w = Math.max(8, st.w + dx);
                        if (dir.includes('s')) ht = Math.max(6, st.ht + dy);
                        if (dir.includes('w')) { w = Math.max(8, st.w - dx); l = st.l + (st.w - w); }
                        if (dir.includes('n')) { ht = Math.max(6, st.ht - dy); t = st.t + (st.ht - ht); }
                        Object.assign(el.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: ht + 'px' });
                        if (model && model.kind === 'text') el.style.fontSize = (model.fontSize * PDE.scale * (ht / st.ht)) + 'px';
                    }
                    refreshSelBox();
                };
                const up = () => {
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', up);
                    commitGeometry(el);
                };
                document.addEventListener('mousemove', move);
                document.addEventListener('mouseup', up);
            });
        });
    }

    /** يثبّت الموضع/الحجم بعد السحب في نموذج الكائن. */
    function commitGeometry(el) {
        const s = PDE.selection; if (!s || !s.model) return;
        const n = +el.dataset.page;
        const a = PDE.analysis.pages[n - 1];
        const g = PDE.cssToPdf(a, parseFloat(el.style.left), parseFloat(el.style.top), el.offsetWidth, el.offsetHeight);
        const m = s.model;
        if (m._isObject) {
            m.x = num(g.x); m.y = num(g.y); m.w = num(g.w); m.h = num(g.h);
            if (m.kind === 'text') m.fontSize = num(m.h / (m.lineGapRatio || 1.25));
        } else if (s.kind === 'image') {
            recordImageTransform(m, n, g);
        } else if (s.kind === 'text') {
            m._movedTo = { x: num(g.x), y: num(g.y + g.h * 0.22) };
            m._boxWidth = num(g.w);
            markTextEdited(m, n);
        }
        PDE.dirty = true;
        window.pdeRenderInspector();
    }

    function recordImageTransform(im, page, g) {
        im._t = { x: num(g.x), y: num(g.y), w: num(g.w), h: num(g.h), rotation: im.rotation || 0 };
        pushOp(PDFE.Ops.make('image.transform', { page, x: g.x, y: g.y, w: g.w, h: g.h, rotation: im.rotation || 0 }));
    }

    /** السحب لتحريك عنصر محدّد. */
    function bindDrag(el) {
        el.addEventListener('mousedown', e => {
            if (PDE.tool !== 'select' || e.target.classList.contains('pde-h')) return;
            if (el.isContentEditable) return;
            const st = { x: e.clientX, y: e.clientY, l: parseFloat(el.style.left) || 0, t: parseFloat(el.style.top) || 0, at: Date.now() };
            let moved = false;
            const move = ev => {
                const dx = ev.clientX - st.x, dy = ev.clientY - st.y;
                // عتبة أوسع + مهلة: اهتزاز اليد بين نقرتي النقر المزدوج كان يُحسب
                // «تحريكاً» فيسجّل عملية ويُربك التحرير.
                if (!moved && (Math.hypot(dx, dy) < 6 || Date.now() - st.at < 120)) return;
                moved = true;
                el.style.left = (st.l + dx) + 'px';
                el.style.top = (st.t + dy) + 'px';
                refreshSelBox();
            };
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                if (moved) commitGeometry(el);
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // معالجات النقر على الصفحة — يربطها UI بعد رسم كل صفحة
    // ═══════════════════════════════════════════════════════════════════════════
    window.pdeAttachPageHandlers = function (pageEl, layer, a, n) {
        layer.querySelectorAll('.pde-txt').forEach(el => {
            const it = findItem(n, el.dataset.id);
            if (!it) return;
            el.addEventListener('click', ev => {
                ev.stopPropagation();
                if (PDE.tool === 'text') return beginTextEdit(el, it, n);
                if (PDE.tool !== 'select') return;
                // نقرة على عنصر محدَّد بالفعل ⇒ ادخل التحرير مباشرة.
                // يجعل الوصول للتحرير لا يعتمد على إتقان النقر المزدوج.
                if (PDE.selection && PDE.selection.el === el) return beginTextEdit(el, it, n);
                return select(el, 'text', it);
            });
            el.addEventListener('dblclick', ev => { ev.stopPropagation(); beginTextEdit(el, it, n); });
            bindDrag(el);
        });
        layer.querySelectorAll('.pde-img').forEach(el => {
            const im = a.images[+el.dataset.idx];
            el.addEventListener('click', ev => { ev.stopPropagation(); if (PDE.tool === 'select' || PDE.tool === 'text') select(el, 'image', im); });
            bindDrag(el);
        });
        layer.querySelectorAll('.pde-obj[data-oid]').forEach(el => {
            const o = PDE.objects.find(x => x.id === el.dataset.oid);
            if (!o) return;
            el.addEventListener('click', ev => {
                ev.stopPropagation();
                if (PDE.tool === 'select' || PDE.tool === 'text') select(el, 'object', o);
            });
            el.addEventListener('dblclick', ev => {
                ev.stopPropagation();
                if (o.kind === 'text') beginObjectTextEdit(el, o);
                else if (o.sub === 'comment') editComment(o);
            });
            bindDrag(el);
        });
        bindCanvasTools(pageEl, layer, a, n);
    };

    function findItem(n, id) {
        const a = PDE.analysis.pages[n - 1];
        return (a.items.find(i => i.id === id)) || ((PDE.ocrPages.get(n) || []).find(i => i.id === id));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // [ED-TEXT] تحرير النص الحقيقي (§10 §7)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * يحوّل عنصر النص إلى صندوق تحرير مباشر.
     * عند الخروج: إن تغيّر النص نسجّل عملية text.edit تحافظ على
     * الموضع والخط والحجم واللون والمحاذاة والاتجاه — مع ملاءمة تلقائية.
     */
    function beginTextEdit(el, it, n) {
        if (!PDE.canEdit()) { toast('🚫 لا تملك صلاحية التحرير', 'er'); return; }
        // العنصر قيد التحرير أصلاً: استدعاء ثانٍ كان يسجّل معالج blur إضافياً
        // فتُحتسب العملية مرتين في التاريخ وتتكرّر في التصدير.
        if (el.classList.contains('editing')) { el.focus(); return; }
        if (it.state === 'image-based') { toast('⚠️ هذا النص جزء من صورة — شغّل OCR أولاً', 'er', 5000); return; }
        clearSelection();
        const before = it._newText != null ? it._newText : it.str;
        el.contentEditable = 'true';
        el.classList.add('editing');
        el.spellcheck = false;
        el.focus();
        // تحديد كامل النص عند البدء — يسهّل الاستبدال الكامل
        const r = document.createRange(); r.selectNodeContents(el);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);

        const finish = () => {
            el.removeEventListener('blur', finish);
            el.removeEventListener('keydown', keyer);
            el.contentEditable = 'false';
            el.classList.remove('editing');
            const after = el.textContent;
            if (after === before) { hideFloatBar(); return; }
            applyTextChange(it, n, before, after, el);
        };
        const keyer = ev => {
            if (ev.key === 'Escape') { el.textContent = before; el.blur(); }
            if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); el.blur(); }
        };
        // ⚠️ الترتيب مقصود: معالجا الحفظ يُسجَّلان **قبل** بناء شريط الأدوات.
        // شريط الأدوات مجرّد وسيلة راحة؛ لو أخفق (مكتبة ناقصة، خط غريب، عنصر
        // غير متوقّع) فلا يجوز أن يمنع حفظ ما كتبه المستخدم — وهذا ما كان يحدث:
        // خطأ واحد في showFloatBar كان يُلغي تسجيل blur فيضيع التعديل بصمت.
        el.addEventListener('blur', finish);
        el.addEventListener('keydown', keyer);
        try { showFloatBar(el, it); }
        catch (e) { console.warn('تعذّر بناء شريط النص — التحرير يعمل:', e && e.message); }
    }
    PDE.beginTextEdit = beginTextEdit;

    /** يسجّل تغيير نص مع كل خصائص الاستبدال الذكي (§7). */
    function applyTextChange(it, n, before, after, el) {
        const fit = PDFE.Style.autoFit(it, after, { boxWidth: it._boxWidth || it.w });
        it._newText = after;
        it._edited = true;
        it._fit = fit;
        const pos = it._movedTo || { x: it.x, y: it.y };

        // نص أُفرغ = محذوف: نُخفي صندوقه من الطبقة كي لا يبقى مربّع فارغ
        // يعترض النقر على ما تحته ويربك المستخدم.
        it._deleted = !after.trim();
        const op = PDFE.Ops.make(after.trim() ? 'text.edit' : 'text.delete', {
            page: n, itemId: it.id, opIndex: it.ocr ? -1 : it.opIndex,
            opIndexes: it.ocr ? null : (it.opIndexes || null),
            oldText: before, newText: after,
            x: pos.x, y: pos.y,
            boxWidth: it._boxWidth || it.w,
            box: { x: it.x, y: it.y, w: Math.max(it.w, it._boxWidth || 0) },
            fontSize: fit.fontSize, fontFamily: it.fontFamily,
            bold: it.bold, italic: it.italic, underline: it.underline,
            color: it.color, opacity: it.opacity, bgColor: it.bgColor,
            align: it.align, dir: it.dir, angle: it.angle,
            charSpacing: fit.charSpacing
        });
        pushOp(op);
        if (el) {
            el.classList.add('edited');
            el.textContent = after;
            if (it._deleted) { el.style.display = 'none'; PDE.clearSelection(); }
        }
        PDE.status(after.trim() ? `✅ عُدّل النص — سيُزال الأصل من بنية الملف عند الحفظ` : '🗑️ سيُحذف النص من الملف');
        hideFloatBar();
    }

    function markTextEdited(it, n) {
        if (it._edited) {
            // حدّثنا الموضع فقط — نستبدل آخر عملية بدل تكديس عمليات
            applyTextChange(it, n, it.str, it._newText != null ? it._newText : it.str, null);
        } else {
            applyTextChange(it, n, it.str, it.str, null);
        }
    }

    /** يطبّق تغييراً تنسيقياً على النص المحدّد (من الشريط العائم أو اللوحة). */
    window.pdeStyleSelected = function (patch) {
        const s = PDE.selection; if (!s) { toast('حدّد نصاً أولاً', 'er'); return; }
        const m = s.model;
        Object.assign(m, patch);
        const n = +s.el.dataset.page;
        if (m._isObject) {
            PDE.refreshLayer(n);
            pushOp(PDFE.Ops.make('text.style', { page: n, objectId: m.id, patch }));
        } else {
            const el = s.el;
            if (patch.fontFamily) el.style.fontFamily = `"${patch.fontFamily}", Tahoma, Arial, sans-serif`;
            if (patch.fontSize) el.style.fontSize = (patch.fontSize * PDE.scale) + 'px';
            // اللون عبر المتغيّر لا مباشرةً — وإلا اخترقت الطبقةُ شفافيتَها وطُبع النص مرتين
            if (patch.color) el.style.setProperty('--pde-c', patch.color);
            if (patch.bold !== undefined) el.style.fontWeight = patch.bold ? '700' : '400';
            if (patch.italic !== undefined) el.style.fontStyle = patch.italic ? 'italic' : 'normal';
            if (patch.align) el.style.textAlign = patch.align;
            if (patch.charSpacing !== undefined) el.style.letterSpacing = patch.charSpacing * PDE.scale + 'px';
            if (patch.underline !== undefined || patch.strike !== undefined) {
                el.style.textDecoration = [(m.underline ? 'underline' : ''), (m.strike ? 'line-through' : '')].filter(Boolean).join(' ');
            }
            if (patch.bgColor) el.style.setProperty('--pde-bgc', patch.bgColor);
            markTextEdited(m, n);
        }
        PDE.dirty = true;
        window.pdeRenderInspector();
    };

    // ── الشريط العائم عند تحديد النص (§15) ──────────────────────────────────
    function showFloatBar(el, m) {
        let bar = $('pdeFloatBar');
        if (!bar) { bar = document.createElement('div'); bar.id = 'pdeFloatBar'; bar.className = 'pde-float'; document.body.appendChild(bar); }
        const fonts = Array.from(PDE.analysis.fonts.values()).map(f => f.family);
        const uniq = Array.from(new Set(fonts.concat(PDFE.Style.SAFE_FONTS)));
        bar.innerHTML = `
            <select onchange="pdeStyleSelected({fontFamily:this.value})" title="الخط">
                ${uniq.map(f => `<option value="${esc(f)}" ${f === m.fontFamily ? 'selected' : ''}>${esc(f)}</option>`).join('')}
            </select>
            <input type="number" step="0.5" min="4" max="200" value="${m.fontSize}" onchange="pdeStyleSelected({fontSize:+this.value})" title="الحجم" style="width:56px">
            <button class="${m.bold ? 'on' : ''}" onclick="pdeStyleSelected({bold:!PDE.selection.model.bold});this.classList.toggle('on')" title="عريض"><b>B</b></button>
            <button class="${m.italic ? 'on' : ''}" onclick="pdeStyleSelected({italic:!PDE.selection.model.italic});this.classList.toggle('on')" title="مائل"><i>I</i></button>
            <button class="${m.underline ? 'on' : ''}" onclick="pdeStyleSelected({underline:!PDE.selection.model.underline});this.classList.toggle('on')" title="تسطير"><u>U</u></button>
            <button class="${m.strike ? 'on' : ''}" onclick="pdeStyleSelected({strike:!PDE.selection.model.strike});this.classList.toggle('on')" title="شطب"><s>S</s></button>
            <span class="sep"></span>
            <button onclick="pdeColorPicker(c=>pdeStyleSelected({color:c}),PDE.selection.model.color)" title="لون النص"><span class="sw" style="background:${esc(m.color)}"></span>A</button>
            <button onclick="pdeColorPicker(c=>pdeStyleSelected({bgColor:c}),PDE.selection.model.bgColor||'#FFFF00')" title="لون الخلفية">▧</button>
            <span class="sep"></span>
            <button onclick="pdeStyleSelected({align:'right'})" title="لليمين">⇥</button>
            <button onclick="pdeStyleSelected({align:'center'})" title="توسيط">≡</button>
            <button onclick="pdeStyleSelected({align:'left'})" title="لليسار">⇤</button>
            <button onclick="pdeStyleSelected({dir:PDE.selection.model.dir==='rtl'?'ltr':'rtl'})" title="اتجاه النص">⇄</button>
            <span class="sep"></span>
            <button onclick="pdeCopyStyle()" title="نسخ النمط">🎨</button>
            <button onclick="pdePasteStyle()" title="لصق النمط" ${PDE.clipStyle ? '' : 'disabled'}>🪣</button>
            <button onclick="pdeMatchOriginal()" title="مطابقة النمط الأصلي المحيط">🎯</button>`;
        const r = el.getBoundingClientRect();
        bar.style.display = 'flex';
        const bw = bar.offsetWidth || 620, bh = bar.offsetHeight || 38;
        bar.style.left = Math.max(8, Math.min(window.innerWidth - bw - 8, r.left + r.width / 2 - bw / 2)) + 'px';
        // ⚠️ لا يجوز أن يغطّي الشريط النصَّ نفسه: كان يُثبَّت عند أعلى النافذة حين
        // يضيق المكان فوق العنصر، فيلتقط النقرة الثانية ويبدو النص «لا يستجيب».
        const above = r.top - bh - 10;
        bar.style.top = (above >= 8 ? above : Math.min(window.innerHeight - bh - 8, r.bottom + 10)) + 'px';
        if (typeof window.ssEnhance === 'function') { /* القوائم هنا قصيرة ومباشرة */ }
    }
    function hideFloatBar() { const b = $('pdeFloatBar'); if (b) b.style.display = 'none'; }
    PDE.hideFloatBar = hideFloatBar;

    // ═══════════════════════════════════════════════════════════════════════════
    // [ED-STYLE] نسخ/لصق النمط · مطابقة الأصل (§5 §6)
    // ═══════════════════════════════════════════════════════════════════════════

    window.pdeCopyStyle = function () {
        const s = PDE.selection; if (!s || !s.model) { toast('حدّد نصاً أولاً', 'er'); return; }
        PDE.clipStyle = PDFE.Style.extract(s.model);
        toast(`🎨 نُسخ النمط: ${PDE.clipStyle.fontFamily} · ${PDE.clipStyle.fontSize} · ${PDE.clipStyle.color}`, 'ok', 4000);
        window.pdeRenderInspector();
    };

    window.pdePasteStyle = function () {
        if (!PDE.clipStyle) { toast('انسخ نمطاً أولاً', 'er'); return; }
        const s = PDE.selection; if (!s || !s.model) { toast('حدّد النص الهدف أولاً', 'er'); return; }
        window.pdeStyleSelected(Object.assign({}, PDE.clipStyle));
        toast('✅ طُبّق النمط', 'ok');
    };

    window.pdeMatchOriginal = function () {
        const s = PDE.selection; if (!s || !s.model) { toast('حدّد العنصر أولاً', 'er'); return; }
        const n = +s.el.dataset.page;
        const a = PDE.analysis.pages[n - 1];
        const m = s.model;
        const cx = m.x + (m.w || 0) / 2, cy = m.y;
        const hit = PDFE.Style.matchOriginal(a, cx, cy, 160);
        if (!hit) {
            const common = PDE.analysis.styles[0];
            if (!common) { toast('لا يوجد نص مرجعي في هذه الصفحة', 'er'); return; }
            window.pdeStyleSelected({ fontFamily: common.family, fontSize: common.size, color: common.color, bold: common.bold, italic: common.italic, align: common.align });
            toast('🎯 طُبّق نمط المتن الأشيع في المستند', 'ok', 4500);
            return;
        }
        window.pdeStyleSelected(hit.style);
        toast(`🎯 طُوبق النمط من النص المجاور: «${hit.source.str.slice(0, 24)}»`, 'ok', 5000);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [ED-OBJ] الكائنات الجديدة
    // ═══════════════════════════════════════════════════════════════════════════

    function addObject(o) {
        o.id = o.id || newId();
        o._isObject = true;
        o.z = PDE.objects.length;
        PDE.objects.push(o);
        PDE.refreshLayer(o.page);
        PDE.dirty = true;
        return o;
    }
    PDE.addObject = addObject;

    function pushOp(op) {
        PDE.history.push(op);
        PDE.dirty = true;
        PDE.refreshUndoBtns();
    }
    PDE.pushOp = pushOp;

    /** يبني عملية تصدير من كائن مضاف. */
    function opFromObject(o) {
        const base = { page: o.page, x: o.x, y: o.y, w: o.w, h: o.h, opacity: o.opacity, rotation: o.rotation, objectId: o.id };
        if (o.kind === 'text') return PDFE.Ops.make('text.add', Object.assign(base, {
            text: o.text, fontSize: o.fontSize, fontFamily: o.fontFamily, bold: o.bold, italic: o.italic,
            underline: o.underline, strike: o.strike, color: o.color, align: o.align, dir: o.dir,
            charSpacing: o.charSpacing, boxWidth: o.w, y: o.y + o.h - o.fontSize
        }));
        if (o.kind === 'image') return PDFE.Ops.make('image.add', Object.assign(base, { dataUrl: o.dataUrl }));
        if (o.kind === 'sign') return PDFE.Ops.make('sign.add', Object.assign(base, { dataUrl: o.dataUrl }));
        if (o.kind === 'stamp') return PDFE.Ops.make('stamp.add', Object.assign(base, { dataUrl: o.dataUrl, label: o.label }));
        if (o.kind === 'qr') return PDFE.Ops.make('qr.add', Object.assign(base, { dataUrl: o.dataUrl, content: o.content }));
        if (o.kind === 'shape') return PDFE.Ops.make('shape.add', Object.assign(base, { shape: o.shape, fill: o.fill, stroke: o.stroke, lineWidth: o.lineWidth, x2: o.x2, y2: o.y2 }));
        if (o.kind === 'annot') {
            const t = { highlight: 'annot.highlight', underline: 'annot.underline', strike: 'annot.strike', comment: 'annot.comment', link: 'annot.link', redact: 'redact' }[o.sub];
            return PDFE.Ops.make(t, Object.assign(base, { color: o.color, text: o.text, url: o.url, showBorder: o.showBorder, fillColor: o.fillColor, oldText: o.oldText, opIndex: o.opIndex, box: o.box, fontSize: o.fontSize }));
        }
        return null;
    }
    PDE.opFromObject = opFromObject;

    /** رسم بالسحب على الصفحة (أشكال/تظليل/تنقيح/رابط). */
    function bindCanvasTools(pageEl, layer, a, n) {
        layer.addEventListener('mousedown', e => {
            if (e.target !== layer) return;
            const t = PDE.tool;
            // «تحديد» و«تحرير نص» لا يرسمان شيئاً على الفراغ — النقر خارج أي عنصر
            // يلغي التحديد فقط. (كان وضع التحرير يسقط لأدوات السحب فيرسم مستطيلاً وهمياً.)
            if (t === 'select' || t === 'text') { clearSelection(); return; }
            const rect = layer.getBoundingClientRect();
            const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

            if (t === 'eyedrop') return doEyedrop(n, sx, sy);
            if (t === 'addtext') return placeNewText(n, a, sx, sy);
            if (t === 'image') return window.pdeInsertImage(n, a, sx, sy);
            if (t === 'sign') return window.pdeSignDialog(n, a, sx, sy);
            if (t === 'stamp') return window.pdeStampDialog(n, a, sx, sy);
            if (t === 'comment') return placeComment(n, a, sx, sy);

            // أدوات السحب
            const ghost = document.createElement('div');
            ghost.className = 'pde-ghost';
            Object.assign(ghost.style, { left: sx + 'px', top: sy + 'px', width: '0px', height: '0px' });
            if (t === 'redact') ghost.style.background = 'rgba(0,0,0,.75)';
            layer.appendChild(ghost);

            const move = ev => {
                const cx = ev.clientX - rect.left, cy = ev.clientY - rect.top;
                let w = cx - sx, h = cy - sy;
                if (ev.shiftKey && (t === 'shape')) h = Math.sign(h) * Math.abs(w);
                Object.assign(ghost.style, {
                    left: Math.min(sx, sx + w) + 'px', top: Math.min(sy, sy + h) + 'px',
                    width: Math.abs(w) + 'px', height: Math.abs(h) + 'px'
                });
            };
            const up = ev => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                const L = parseFloat(ghost.style.left), T = parseFloat(ghost.style.top);
                const W = parseFloat(ghost.style.width), H = parseFloat(ghost.style.height);
                ghost.remove();
                if (W < 4 && H < 4) return;
                const g = PDE.cssToPdf(a, L, T, W, Math.max(H, 4));
                finishDragTool(t, n, a, g, ev, { L, T, W, H });
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    }

    function finishDragTool(t, n, a, g, ev, css) {
        if (t === 'shape' || t === 'line') {
            const o = addObject({
                kind: 'shape', page: n, shape: t === 'line' ? 'line' : (ev.shiftKey ? 'ellipse' : 'rect'),
                x: num(g.x), y: num(g.y), w: num(g.w), h: num(g.h),
                x2: num(g.x + g.w), y2: num(g.y),
                fill: t === 'line' ? null : PDE.lastFill || null,
                stroke: PDE.lastStroke || '#1F4E78', lineWidth: 1.2, opacity: 1
            });
            pushOp(opFromObject(o));
            return;
        }
        if (t === 'highlight' || t === 'underline' || t === 'strike') {
            const colors = { highlight: '#FFEB3B', underline: '#D32F2F', strike: '#D32F2F' };
            const o = addObject({
                kind: 'annot', sub: t, page: n,
                x: num(g.x), y: num(t === 'underline' ? g.y : g.y), w: num(g.w), h: num(g.h),
                color: colors[t], opacity: t === 'highlight' ? 0.42 : 1, lineWidth: 1.1
            });
            pushOp(opFromObject(o));
            return;
        }
        if (t === 'link') {
            const url = prompt('أدخل رابط الوجهة (URL):', 'https://');
            if (!url || !/^https?:\/\//i.test(url)) { if (url) toast('⚠️ الرابط يجب أن يبدأ بـ http:// أو https://', 'er'); return; }
            const o = addObject({ kind: 'annot', sub: 'link', page: n, x: num(g.x), y: num(g.y), w: num(g.w), h: num(g.h), url, showBorder: true });
            pushOp(opFromObject(o));
            return;
        }
        if (t === 'redact') return doRedact(n, a, g, css);
    }

    // ── التنقيح الآمن (§22) ────────────────────────────────────────────────
    /**
     * يجمع كل عناصر النص داخل المنطقة، يسجّلها للإزالة الفعلية من تدفّق
     * المحتوى، ويضع مربّعاً معتِماً فوقها. التحقق بعد التصدير يؤكّد الإزالة.
     */
    function doRedact(n, a, g, css) {
        const inside = a.items.filter(it => !it._deleted &&
            it.x + it.w > g.x && it.x < g.x + g.w &&
            it.y + it.fontSize > g.y && it.y < g.y + g.h);
        if (!inside.length && !confirm('لا يوجد نص قابل للاستخراج في هذه المنطقة (قد تكون صورة).\nوضع مربّع تعتيم فقط؟')) return;

        inside.forEach(it => {
            it._deleted = true;
            pushOp(PDFE.Ops.make('redact', {
                page: n, itemId: it.id, opIndex: it.opIndex,
            opIndexes: it.ocr ? null : (it.opIndexes || null),
                oldText: it.str, fontSize: it.fontSize,
                box: { x: it.x, y: it.y, w: it.w },
                x: it.x, y: it.y, w: it.w, h: it.fontSize * 1.3,
                fillColor: '#000000'
            }));
        });
        addObject({ kind: 'annot', sub: 'redact', page: n, x: num(g.x), y: num(g.y), w: num(g.w), h: num(g.h), fillColor: '#000000' });
        PDE.refreshLayer(n);
        toast(`🔒 سيُنقَّح ${inside.length} عنصر نصي — يُزال فعلياً من الملف عند الحفظ`, 'ok', 6000);
    }

    // ── نص جديد ──────────────────────────────────────────────────────────
    function placeNewText(n, a, sx, sy) {
        const g = PDE.cssToPdf(a, sx, sy, 190 * PDE.scale, 20 * PDE.scale);
        // يبدأ بنمط المتن الأشيع — ثم يستطيع المستخدم «مطابقة الأصل»
        const near = PDFE.Style.matchOriginal(a, g.x, g.y, 150);
        const st = near ? near.style : (PDE.analysis.styles[0] || { family: 'Amiri', size: 11, color: '#000000' });
        const o = addObject({
            kind: 'text', page: n, text: 'نص جديد',
            x: num(g.x), y: num(g.y), w: num(g.w), h: num(g.h),
            fontSize: st.fontSize || st.size || 11,
            fontFamily: st.fontFamily || st.family || 'Amiri',
            bold: !!st.bold, italic: !!st.italic,
            color: st.color || '#000000',
            align: st.align || 'right', dir: 'rtl',
            charSpacing: 0, lineGapRatio: st.lineGapRatio || 1.25, opacity: 1
        });
        pushOp(opFromObject(o));
        setTimeout(() => {
            const el = document.querySelector(`.pde-obj[data-oid="${o.id}"]`);
            if (el) { select(el, 'object', o); beginObjectTextEdit(el, o); }
        }, 60);
        window.pdeSetTool('select');
    }

    function beginObjectTextEdit(el, o) {
        el.contentEditable = 'true';
        el.classList.add('editing');
        el.focus();
        const r = document.createRange(); r.selectNodeContents(el);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        const done = () => {
            el.removeEventListener('blur', done);
            el.contentEditable = 'false';
            el.classList.remove('editing');
            o.text = el.textContent;
            replaceObjectOp(o);
        };
        el.addEventListener('blur', done);
    }

    /** يستبدل عملية كائن موجودة بدل تكديس عمليات لنفس الكائن. */
    function replaceObjectOp(o) {
        const stack = PDE.history.stack;
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].objectId === o.id) { stack[i] = opFromObject(o); PDE.dirty = true; return; }
        }
        pushOp(opFromObject(o));
    }
    PDE.replaceObjectOp = replaceObjectOp;

    function placeComment(n, a, sx, sy) {
        const text = prompt('نص التعليق:');
        if (!text) return;
        const g = PDE.cssToPdf(a, sx, sy, 160 * PDE.scale, 48 * PDE.scale);
        const o = addObject({ kind: 'annot', sub: 'comment', page: n, x: num(g.x), y: num(g.y), w: num(g.w), h: num(g.h), text, color: '#FFF9C4' });
        pushOp(opFromObject(o));
        window.pdeSetTool('select');
    }

    function editComment(o) {
        const t = prompt('تعديل التعليق:', o.text);
        if (t == null) return;
        o.text = t;
        replaceObjectOp(o);
        PDE.refreshLayer(o.page);
    }

    /** إدراج صورة (§11). */
    window.pdeInsertImage = function (n, a, sx, sy) {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = () => {
            const f = inp.files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const maxW = 200;
                    const ratio = img.naturalHeight / img.naturalWidth;
                    const w = Math.min(maxW, img.naturalWidth * 0.6), h = w * ratio;
                    const g = PDE.cssToPdf(a, sx, sy, w * PDE.scale, h * PDE.scale);
                    const o = addObject({ kind: 'image', page: n, dataUrl: rd.result, x: num(g.x), y: num(g.y), w: num(w), h: num(h), opacity: 1, rotation: 0, name: f.name });
                    pushOp(opFromObject(o));
                    window.pdeSetTool('select');
                };
                img.src = rd.result;
            };
            rd.readAsDataURL(f);
        };
        inp.click();
    };

    /** حذف/استبدال صورة أصلية (§11). */
    window.pdeDeleteImage = function () {
        const s = PDE.selection; if (!s || s.kind !== 'image') return;
        const n = +s.el.dataset.page;
        const im = s.model;
        im._deleted = true;
        pushOp(PDFE.Ops.make('image.delete', { page: n, x: im.x, y: im.y, w: im.w, h: im.h, bgColor: '#FFFFFF' }));
        PDE.refreshLayer(n);
        clearSelection();
        toast('🗑️ حُذفت الصورة', 'ok');
    };

    window.pdeReplaceImage = function () {
        const s = PDE.selection; if (!s || s.kind !== 'image') return;
        const n = +s.el.dataset.page, im = s.model;
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = () => {
            const f = inp.files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = () => {
                im._deleted = true;
                pushOp(PDFE.Ops.make('image.delete', { page: n, x: im.x, y: im.y, w: im.w, h: im.h, bgColor: '#FFFFFF' }));
                const o = addObject({ kind: 'image', page: n, dataUrl: rd.result, x: im.x, y: im.y, w: im.w, h: im.h, opacity: 1, rotation: 0 });
                pushOp(opFromObject(o));
                clearSelection();
                toast('🔄 استُبدلت الصورة', 'ok');
            };
            rd.readAsDataURL(f);
        };
        inp.click();
    };

    /** حذف العنصر المحدّد (مفتاح Delete). */
    window.pdeDeleteSelected = function () {
        const s = PDE.selection; if (!s) return;
        if (!PDE.canEdit()) { toast('🚫 لا تملك صلاحية التحرير', 'er'); return; }
        const n = +s.el.dataset.page;
        if (s.kind === 'image') return window.pdeDeleteImage();
        if (s.kind === 'object') {
            s.model._deleted = true;
            const st = PDE.history.stack;
            for (let i = st.length - 1; i >= 0; i--) if (st[i].objectId === s.model.id) { st.splice(i, 1); break; }
            PDE.history._fire();
            PDE.refreshLayer(n);
            clearSelection();
            return;
        }
        if (s.kind === 'text') {
            const it = s.model;
            it._deleted = true;
            applyTextChange(it, n, it.str, '', null);
            PDE.refreshLayer(n);
            clearSelection();
            toast('🗑️ سيُزال النص من بنية الملف عند الحفظ', 'ok', 5000);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [ED-LAYER] الطبقات (§12)
    // ═══════════════════════════════════════════════════════════════════════════
    window.pdeLayerMove = function (dir) {
        const s = PDE.selection; if (!s || !s.model || !s.model._isObject) { toast('حدّد كائناً مضافاً أولاً', 'er'); return; }
        const list = PDE.objects.filter(o => o.page === s.model.page && !o._deleted).sort((a, b) => a.z - b.z);
        const i = list.indexOf(s.model);
        if (i < 0) return;
        let j = dir === 'front' ? list.length - 1 : dir === 'back' ? 0 : Math.max(0, Math.min(list.length - 1, i + dir));
        if (i === j) return;
        list.splice(j, 0, list.splice(i, 1)[0]);
        list.forEach((o, k) => { o.z = k; });
        PDE.refreshLayer(s.model.page);
        PDE.dirty = true;
        window.pdeRenderInspector();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [ED-COLOR] منتقي الألوان والقطّارة (§16 §17)
    // ═══════════════════════════════════════════════════════════════════════════

    window.pdeColorPicker = function (onPick, initial) {
        const cur = initial || '#000000';
        const docColors = Array.from(PDE.analysis.colors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 24);
        const rgb = PDFE.hexToRgb(cur), hsl = PDFE.rgbToHsl(rgb.r, rgb.g, rgb.b);
        let ov = $('pdeColorOv');
        if (!ov) { ov = document.createElement('div'); ov.id = 'pdeColorOv'; ov.className = 'pde-modal'; document.body.appendChild(ov); }
        ov.innerHTML = `<div class="pde-modal-box" style="max-width:430px">
            <div class="pde-modal-h">🎨 منتقي الألوان<button onclick="pdeCloseModal('pdeColorOv')">✕</button></div>
            <div class="pde-modal-b">
                <div class="pde-cp-preview" id="pdeCpPrev" style="background:${esc(cur)}"></div>
                <input type="color" id="pdeCpNative" value="${esc(cur)}" oninput="pdeCpSync(this.value,'native')" style="width:100%;height:42px;border:none;background:none;cursor:pointer">
                <div class="pde-fgrid">
                    <label>HEX<input id="pdeCpHex" value="${esc(cur)}" dir="ltr" oninput="pdeCpSync(this.value,'hex')"></label>
                    <label>RGB<input id="pdeCpRgb" value="${rgb.r}, ${rgb.g}, ${rgb.b}" dir="ltr" oninput="pdeCpSync(this.value,'rgb')"></label>
                    <label>HSL<input id="pdeCpHsl" value="${hsl.h}, ${hsl.s}%, ${hsl.l}%" dir="ltr" readonly></label>
                    <label>الشفافية<input type="range" id="pdeCpAlpha" min="0" max="100" value="100" oninput="document.getElementById('pdeCpAlphaV').textContent=this.value+'%'"><span id="pdeCpAlphaV">100%</span></label>
                </div>
                <div class="pde-cp-sec">🎯 ألوان من المستند</div>
                <div class="pde-swatches">
                    ${docColors.map(([h, c]) => `<button class="pde-sw" style="background:${esc(h)}" title="${esc(h)} — ${esc(PDFE.colorName(h))} (${c} مرة)" onclick="pdeCpSync('${esc(h)}','hex')"></button>`).join('')}
                </div>
                <div class="pde-cp-sec">🧰 ألوان قياسية</div>
                <div class="pde-swatches">
                    ${['#000000', '#FFFFFF', '#1F4E78', '#2E75B6', '#D9EAF7', '#595959', '#808080', '#C00000', '#E74C3C', '#27AE60', '#F39C12', '#8E44AD']
                .map(h => `<button class="pde-sw" style="background:${h}" title="${h} — ${esc(PDFE.colorName(h))}" onclick="pdeCpSync('${h}','hex')"></button>`).join('')}
                </div>
                <button class="btn b-b" style="width:100%;margin-top:10px" onclick="pdeCpEyedrop()">💉 التقاط لون من المستند (قطّارة)</button>
            </div>
            <div class="pde-modal-f">
                <button class="btn" onclick="pdeCloseModal('pdeColorOv')">إلغاء</button>
                <button class="btn b-g" onclick="pdeCpConfirm()">تطبيق</button>
            </div>
        </div>`;
        ov.classList.add('show');
        PDE._cpValue = cur;
        PDE._cpCallback = onPick;
    };

    window.pdeCpSync = function (val, from) {
        let hex = val;
        if (from === 'rgb') {
            const p = String(val).split(/[, ]+/).map(Number);
            if (p.length < 3 || p.some(isNaN)) return;
            hex = PDFE.toHex(p[0], p[1], p[2]);
        }
        if (!/^#?[0-9a-f]{6}$/i.test(hex.replace('#', '').padStart(6, '0')) && !/^#[0-9a-f]{6}$/i.test(hex)) {
            if (!/^#?[0-9a-f]{3}$/i.test(hex)) return;
        }
        if (hex[0] !== '#') hex = '#' + hex;
        const rgb = PDFE.hexToRgb(hex), hsl = PDFE.rgbToHsl(rgb.r, rgb.g, rgb.b);
        PDE._cpValue = hex.toUpperCase();
        $('pdeCpPrev').style.background = hex;
        if (from !== 'hex') $('pdeCpHex').value = PDE._cpValue;
        if (from !== 'rgb') $('pdeCpRgb').value = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        if (from !== 'native') $('pdeCpNative').value = hex;
        $('pdeCpHsl').value = `${hsl.h}, ${hsl.s}%, ${hsl.l}%`;
    };

    window.pdeCpConfirm = function () {
        const cb = PDE._cpCallback;
        window.pdeCloseModal('pdeColorOv');
        if (cb) cb(PDE._cpValue);
    };

    window.pdeCpEyedrop = function () {
        window.pdeCloseModal('pdeColorOv');
        PDE._eyedropTo = c => { window.pdeColorPicker(PDE._cpCallback, c); };
        window.pdeSetTool('eyedrop');
        toast('💉 انقر أي نقطة داخل المستند لالتقاط لونها', 'ok', 5000);
    };

    function doEyedrop(n, sx, sy) {
        const canvas = PDE.canvases.get(n);
        if (!canvas) return;
        const dpr = canvas.width / parseFloat(canvas.style.width);
        const r = PDFE.Parser.pickColor(canvas, sx * dpr, sy * dpr);
        window.pdeSetTool('select');
        if (!r) { toast('تعذّرت قراءة اللون', 'er'); return; }
        if (PDE._eyedropTo) { const f = PDE._eyedropTo; PDE._eyedropTo = null; f(r.hex); return; }
        PDE.lastPicked = r;
        toast(`💉 ${r.hex} — ${r.name} · RGB(${r.rgb.r},${r.rgb.g},${r.rgb.b}) · HSL(${r.hsl.h},${r.hsl.s}%,${r.hsl.l}%)`, 'ok', 8000);
        window.pdeRenderInspector();
    }

    window.pdeCloseModal = function (id) { const e = $(id); if (e) e.classList.remove('show'); };

    // ═══════════════════════════════════════════════════════════════════════════
    // [ED-INSP] اللوحة اليمنى
    // ═══════════════════════════════════════════════════════════════════════════

    PDE.inspectorTab = 'props';
    window.pdeInspTab = function (t) { PDE.inspectorTab = t; window.pdeRenderInspector(); };

    window.pdeRenderInspector = function () {
        const host = $('pdeInspector'); if (!host) return;
        const tabs = [['props', '⚙️', 'الخصائص'], ['design', '🎨', 'نظام التصميم'], ['fonts', '🔤', 'الخطوط'], ['layers', '🗂️', 'الطبقات'], ['doc', '📋', 'المستند']];
        host.innerHTML = `<div class="pde-insp-tabs">${tabs.map(t =>
            `<button class="${PDE.inspectorTab === t[0] ? 'act' : ''}" onclick="pdeInspTab('${t[0]}')" title="${esc(t[2])}"><span>${t[1]}</span><i>${esc(t[2])}</i></button>`).join('')}</div>
            <div class="pde-insp-body" id="pdeInspBody"></div>`;
        const b = $('pdeInspBody');
        b.innerHTML = { props: propsPanel, design: designPanel, fonts: fontsPanel, layers: layersPanel, doc: docPanel }[PDE.inspectorTab]();
    };

    function propsPanel() {
        const s = PDE.selection;
        if (!s) {
            const st = PDE.clipStyle;
            return `<div class="pde-insp-empty">
                <div class="ei">🖱️</div>
                <p>حدّد عنصراً لعرض خصائصه وتحريره</p>
                ${st ? `<div class="pde-clip">🎨 نمط منسوخ في الحافظة:<br><b>${esc(st.fontFamily)}</b> · ${st.fontSize} · <span class="sw" style="background:${esc(st.color)}"></span> ${esc(st.color)}
                    <button class="btn" style="margin-top:8px;width:100%" onclick="PDE.clipStyle=null;pdeRenderInspector()">مسح الحافظة</button></div>` : ''}
                ${PDE.lastPicked ? `<div class="pde-clip">💉 آخر لون ملتقط:<br><span class="sw" style="background:${esc(PDE.lastPicked.hex)}"></span> <b>${esc(PDE.lastPicked.hex)}</b> — ${esc(PDE.lastPicked.name)}</div>` : ''}
            </div>`;
        }
        const m = s.model;
        const isTxt = s.kind === 'text' || m.kind === 'text';
        const isImg = s.kind === 'image' || m.kind === 'image' || m.kind === 'sign' || m.kind === 'stamp' || m.kind === 'qr';
        const n = +s.el.dataset.page;
        const stateLbl = { editable: '✅ قابل للتحرير مباشرة', ocr: '🔍 نص OCR (طبقة مضافة)', 'image-based': '🖼️ نص داخل صورة — غير قابل للتحرير' };

        let h = `<div class="pde-sec">📌 ${isTxt ? 'نص' : isImg ? 'صورة/كائن' : 'كائن'} — صفحة ${n}</div>`;
        if (!m._isObject && s.kind === 'text') {
            h += `<div class="pde-state pde-state-${m.state || 'editable'}">${stateLbl[m.state] || stateLbl.editable}</div>`;
        }
        h += `<div class="pde-grid2">
            <label>X<input type="number" step="0.5" value="${num(m.x)}" onchange="pdeSetGeom('x',+this.value)"></label>
            <label>Y<input type="number" step="0.5" value="${num(m.y)}" onchange="pdeSetGeom('y',+this.value)"></label>
            <label>العرض<input type="number" step="0.5" value="${num(m.w)}" onchange="pdeSetGeom('w',+this.value)"></label>
            <label>الارتفاع<input type="number" step="0.5" value="${num(m.h || m.fontSize * 1.25)}" onchange="pdeSetGeom('h',+this.value)"></label>
            <label>الدوران<input type="number" step="1" value="${num(m.rotation || -(m.angle || 0))}" onchange="pdeSetGeom('rotation',+this.value)"></label>
            <label>الشفافية<input type="number" step="0.05" min="0" max="1" value="${m.opacity == null ? 1 : m.opacity}" onchange="pdeSetGeom('opacity',+this.value)"></label>
        </div>`;

        if (isTxt) {
            const fonts = Array.from(new Set(Array.from(PDE.analysis.fonts.values()).map(f => f.family).concat(PDFE.Style.SAFE_FONTS)));
            h += `<div class="pde-sec">🔤 التنسيق</div>
            <label class="pde-f">الخط<select data-ss="1" onchange="pdeStyleSelected({fontFamily:this.value})">${fonts.map(f => `<option ${f === m.fontFamily ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
            <div class="pde-grid2">
                <label>الحجم<input type="number" step="0.5" value="${m.fontSize}" onchange="pdeStyleSelected({fontSize:+this.value})"></label>
                <label>تباعد الحروف<input type="number" step="0.1" value="${num(m.charSpacing || 0)}" onchange="pdeStyleSelected({charSpacing:+this.value})"></label>
                <label>تباعد الأسطر<input type="number" step="0.05" value="${num(m.lineGapRatio || 1.25)}" onchange="pdeStyleSelected({lineGapRatio:+this.value})"></label>
                <label>الاتجاه<select onchange="pdeStyleSelected({dir:this.value})"><option value="rtl" ${m.dir === 'rtl' ? 'selected' : ''}>عربي RTL</option><option value="ltr" ${m.dir !== 'rtl' ? 'selected' : ''}>لاتيني LTR</option></select></label>
            </div>
            <div class="pde-row">
                <button class="pde-mini ${m.bold ? 'on' : ''}" onclick="pdeStyleSelected({bold:!PDE.selection.model.bold})"><b>B</b></button>
                <button class="pde-mini ${m.italic ? 'on' : ''}" onclick="pdeStyleSelected({italic:!PDE.selection.model.italic})"><i>I</i></button>
                <button class="pde-mini ${m.underline ? 'on' : ''}" onclick="pdeStyleSelected({underline:!PDE.selection.model.underline})"><u>U</u></button>
                <button class="pde-mini ${m.strike ? 'on' : ''}" onclick="pdeStyleSelected({strike:!PDE.selection.model.strike})"><s>S</s></button>
                <button class="pde-mini ${m.align === 'right' ? 'on' : ''}" onclick="pdeStyleSelected({align:'right'})">⇥</button>
                <button class="pde-mini ${m.align === 'center' ? 'on' : ''}" onclick="pdeStyleSelected({align:'center'})">≡</button>
                <button class="pde-mini ${m.align === 'left' ? 'on' : ''}" onclick="pdeStyleSelected({align:'left'})">⇤</button>
            </div>
            <div class="pde-row">
                <button class="pde-colbtn" onclick="pdeColorPicker(c=>pdeStyleSelected({color:c}),PDE.selection.model.color)"><span class="sw" style="background:${esc(m.color)}"></span> لون النص ${esc(m.color)}</button>
            </div>
            <div class="pde-row">
                <button class="pde-colbtn" onclick="pdeColorPicker(c=>pdeStyleSelected({bgColor:c}),PDE.selection.model.bgColor||'#FFFF00')"><span class="sw" style="background:${esc(m.bgColor || 'transparent')}"></span> لون الخلفية</button>
            </div>
            <div class="pde-sec">🎨 النمط</div>
            <div class="pde-row">
                <button class="btn" onclick="pdeCopyStyle()">🎨 نسخ النمط</button>
                <button class="btn" onclick="pdePasteStyle()" ${PDE.clipStyle ? '' : 'disabled'}>🪣 لصق النمط</button>
            </div>
            <button class="btn b-b" style="width:100%;margin-top:6px" onclick="pdeMatchOriginal()">🎯 مطابقة النمط الأصلي المحيط</button>
            <div class="pde-meta">اللغة: ${esc(m.lang || '')} · ${m.rtl ? 'يمين→يسار' : 'يسار→يمين'}${m.confidence ? ` · ثقة OCR ${m.confidence}%` : ''}</div>`;
        }

        if (s.kind === 'image') {
            h += `<div class="pde-sec">🖼️ أدوات الصورة</div>
            <div class="pde-row">
                <button class="btn" onclick="pdeReplaceImage()">🔄 استبدال</button>
                <button class="btn b-r" onclick="pdeDeleteImage()">🗑️ حذف</button>
            </div>
            <div class="pde-meta">أبعاد أصلية: ${Math.round(m.w)}×${Math.round(m.h)} نقطة · دوران ${m.rotation || 0}°${m.mask ? ' · قناع شفاف' : ''}</div>`;
        }

        if (m._isObject) {
            h += `<div class="pde-sec">🗂️ الطبقة</div>
            <div class="pde-row">
                <button class="pde-mini" onclick="pdeLayerMove('front')" title="للمقدمة">⤒</button>
                <button class="pde-mini" onclick="pdeLayerMove(1)" title="تقديم">↑</button>
                <button class="pde-mini" onclick="pdeLayerMove(-1)" title="تأخير">↓</button>
                <button class="pde-mini" onclick="pdeLayerMove('back')" title="للخلفية">⤓</button>
            </div>`;
        }
        h += `<button class="btn b-r" style="width:100%;margin-top:12px" onclick="pdeDeleteSelected()">🗑️ حذف العنصر (Delete)</button>`;
        return h;
    }

    window.pdeSetGeom = function (k, v) {
        const s = PDE.selection; if (!s) return;
        const m = s.model;
        if (k === 'rotation') { m.rotation = v; s.el.style.transform = `rotate(${-v}deg)`; }
        else m[k] = v;
        const n = +s.el.dataset.page;
        const a = PDE.analysis.pages[n - 1];
        const box = PDE.pdfToCss(a, m.x, m.y, m.w, m.h || m.fontSize * 1.25);
        Object.assign(s.el.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px', opacity: m.opacity == null ? 1 : m.opacity });
        refreshSelBox();
        if (m._isObject) replaceObjectOp(m); else if (s.kind === 'image') recordImageTransform(m, n, m); else markTextEdited(m, n);
    };

    // ── لوحة نظام التصميم (§3 §59) ─────────────────────────────────────────
    function designPanel() {
        const d = PDE.design;
        const colors = Array.from(PDE.analysis.colors.entries()).sort((a, b) => b[1] - a[1]);
        let h = `<div class="pde-sec">🎨 ألوان المستند <span class="badge">${colors.length}</span></div>
        <div class="pde-colorcards">${colors.slice(0, 18).map(([hex, c]) => `
            <div class="pde-colorcard" onclick="pdeUseColor('${esc(hex)}')" title="اضغط لتطبيقه على المحدّد">
                <div class="cc-chip" style="background:${esc(hex)}"></div>
                <div class="cc-name">${esc(PDFE.colorName(hex))}</div>
                <div class="cc-hex">${esc(hex)}</div>
                <div class="cc-n">${c} مرة</div>
            </div>`).join('')}</div>`;

        h += `<div class="pde-sec">🧩 أنماط المستند <span class="badge">${PDE.analysis.styles.length}</span></div>`;
        for (const g of d.groups) {
            h += `<div class="pde-dgroup"><div class="pde-dgroup-h">${esc(g.label)} <span class="badge">${g.styles.length}</span></div>`;
            h += g.styles.slice(0, 8).map(st => `
                <div class="pde-style" onclick="pdeApplyStyleKey('${esc(st.key)}')" title="اضغط لتطبيق هذا النمط على العنصر المحدّد">
                    <div class="ps-prev" style="font-family:'${esc(st.family)}',Tahoma;font-size:${Math.min(19, Math.max(10, st.size))}px;color:${esc(st.color)};font-weight:${st.bold ? 700 : 400};font-style:${st.italic ? 'italic' : 'normal'}">${esc(st.samples[0] || 'نموذج Sample 123')}</div>
                    <div class="ps-meta">${esc(st.family)} · ${st.size}pt · <span class="sw" style="background:${esc(st.color)}"></span>${esc(st.color)}${st.bold ? ' · عريض' : ''} · ${st.count} مرة</div>
                </div>`).join('');
            h += '</div>';
        }
        h += `<button class="btn b-b" style="width:100%;margin-top:10px" onclick="pdeSaveStyleTemplate()">💾 حفظ التنسيق كقالب</button>`;
        return h;
    }

    window.pdeUseColor = function (hex) {
        if (!PDE.selection) { navigator.clipboard && navigator.clipboard.writeText(hex); toast(`نُسخ ${hex} — حدّد عنصراً لتطبيقه`, 'ok'); return; }
        window.pdeStyleSelected({ color: hex });
    };

    window.pdeApplyStyleKey = function (key) {
        const st = PDE.analysis.styles.find(s => s.key === key); if (!st) return;
        if (!PDE.selection) { toast('حدّد عنصراً أولاً لتطبيق النمط عليه', 'er'); return; }
        window.pdeStyleSelected({ fontFamily: st.family, fontSize: st.size, color: st.color, bold: st.bold, italic: st.italic, align: st.align });
        toast('✅ طُبّق النمط', 'ok');
    };

    /** حفظ نمط المستند كقالب قابل لإعادة الاستخدام (§45). */
    window.pdeSaveStyleTemplate = async function () {
        const name = prompt('اسم القالب (مثال: نمط فواتير الشركة):');
        if (!name) return;
        try {
            await window.push(window.ref(window.db, 'ledger/pdfStyles'), {
                name,
                createdAt: Date.now(),
                by: (window.curU && window.curU.email) || '',
                sourceDoc: PDE.doc.name,
                fonts: Array.from(PDE.analysis.fonts.values()).map(f => ({ family: f.family, bold: f.bold, count: f.count })),
                colors: Array.from(PDE.analysis.colors.entries()).map(([h, c]) => ({ hex: h, count: c })),
                styles: PDE.analysis.styles.slice(0, 30).map(s => ({ key: s.key, family: s.family, size: s.size, color: s.color, bold: s.bold, align: s.align }))
            });
            toast('✅ حُفظ القالب «' + name + '»', 'ok');
            PDFE.Audit.log('حفظ قالب تنسيق', `حُفظ قالب «${name}» من «${PDE.doc.name}»`);
        } catch (e) { toast('تعذّر الحفظ: ' + e.message, 'er', 6000); }
    };

    // ── لوحة الخطوط (§18 §19) ──────────────────────────────────────────────
    function fontsPanel() {
        const fonts = Array.from(PDE.analysis.fonts.values()).sort((a, b) => b.count - a.count);
        let h = `<div class="pde-sec">🔤 الخطوط المستخدمة في هذا الملف <span class="badge">${fonts.length}</span></div>`;
        h += fonts.map(f => {
            const inst = PDFE.Style.isInstalled(f.family);
            const sizes = Array.from(f.sizes).sort((a, b) => a - b);
            return `<div class="pde-font ${inst ? '' : 'missing'}">
                <div class="pf-name">${esc(f.family)}${f.bold ? ' <b>Bold</b>' : ''}${f.italic ? ' <i>Italic</i>' : ''}</div>
                <div class="pf-prev" style="font-family:'${esc(f.family)}',Tahoma,Arial">أبجد هوز — Abcd 123</div>
                <div class="pf-meta">${f.count} استخدام · مقاسات: ${sizes.slice(0, 6).join('، ')}${sizes.length > 6 ? '…' : ''}</div>
                <div class="pf-status">${inst ? '<span class="ok">✅ مثبّت على الجهاز</span>' : '<span class="warn">⚠️ غير مثبّت — سيُستبدل بصرياً</span>'}</div>
                ${inst ? '' : `<div class="pf-sub">بدائل مقترحة: ${PDFE.Style.suggestSubstitutes(f.family).slice(0, 4).map(s => `<span class="${s.installed ? 'ok' : ''}">${esc(s.name)}</span>`).join(' · ')}</div>`}
            </div>`;
        }).join('');

        h += `<div class="pde-sec">📝 خط التضمين للنص العربي الجديد</div>
        <select data-ss="1" onchange="PDE.arabicFont=this.value" class="pde-f-sel">
            ${Object.entries(PDFE.AR_FONTS).map(([k, v]) => `<option value="${k}" ${(PDE.arabicFont || 'Amiri') === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}
        </select>
        <div class="pde-meta">يُضمَّن هذا الخط في الملف الناتج ليعرض النص العربي الجديد بشكل صحيح على أي جهاز.</div>`;
        return h;
    }

    // ── لوحة الطبقات (§12) ────────────────────────────────────────────────
    function layersPanel() {
        const n = PDE.page;
        const a = PDE.analysis.pages[n - 1];
        if (!a) return '<div class="pde-insp-empty"><p>الصفحة غير محلَّلة بعد</p></div>';
        const objs = PDE.objects.filter(o => o.page === n && !o._deleted).sort((a2, b) => b.z - a2.z);
        const icon = { text: '🅣', image: '🖼️', shape: '⬜', sign: '✍️', stamp: '🏷️', qr: '▦', annot: '💬' };
        let h = `<div class="pde-sec">🗂️ طبقات صفحة ${n}</div>`;
        h += objs.length ? objs.map(o => `
            <div class="pde-layerrow ${PDE.selection && PDE.selection.model === o ? 'act' : ''}" onclick="pdeSelectObject('${esc(o.id)}')">
                <span>${icon[o.kind] || '▪'}</span>
                <span class="lr-name">${esc(o.kind === 'text' ? o.text : o.kind === 'annot' ? (o.sub + (o.text ? ': ' + o.text : '')) : (o.label || o.name || o.kind))}</span>
                <span class="lr-z">${o.z}</span>
            </div>`).join('') : '<div class="pde-meta">لا كائنات مضافة في هذه الصفحة</div>';
        h += `<div class="pde-sec">📄 المحتوى الأصلي</div>
        <div class="pde-layerrow static"><span>🅣</span><span class="lr-name">نصوص أصلية</span><span class="lr-z">${a.items.filter(i => !i._deleted).length}</span></div>
        <div class="pde-layerrow static"><span>🖼️</span><span class="lr-name">صور</span><span class="lr-z">${a.images.filter(i => !i._deleted).length}</span></div>
        <div class="pde-layerrow static"><span>▱</span><span class="lr-name">أشكال ورسوم متجهة</span><span class="lr-z">${a.shapes.length}</span></div>
        <div class="pde-layerrow static"><span>📊</span><span class="lr-name">جداول مكتشفة</span><span class="lr-z">${PDFE.Parser.detectTables(a).length}</span></div>`;
        return h;
    }

    window.pdeSelectObject = function (id) {
        const el = document.querySelector(`.pde-obj[data-oid="${id}"]`);
        const o = PDE.objects.find(x => x.id === id);
        if (el && o) select(el, 'object', o);
    };

    // ── لوحة المستند (§32 §34 §38) ────────────────────────────────────────
    function docPanel() {
        const i = PDE.ctx.info || {};
        const sum = PDFE.Parser.summary(PDE.analysis);
        const d = PDE.doc || {};
        const row = (k, v) => `<div class="pde-kv"><span>${esc(k)}</span><b>${esc(v == null || v === '' ? '—' : String(v))}</b></div>`;
        let h = `<div class="pde-sec">📊 تحليل المستند</div>
            ${row('نوع المستند', sum.docType)}${row('اللغة', sum.language)}
            ${row('الصفحات', sum.pages)}${row('الخطوط المكتشفة', sum.fonts)}
            ${row('الألوان المكتشفة', sum.colors)}${row('الصور', sum.images)}
            ${row('الجداول', sum.tables)}${row('كتل النص', sum.textBlocks)}
            ${row('الأشكال المتجهة', sum.shapes)}${sum.scannedPages ? row('صفحات ممسوحة ضوئياً', sum.scannedPages) : ''}
        <div class="pde-sec">📋 خصائص الملف (قابلة للتعديل)</div>
            <label class="pde-f">العنوان<input id="pdeMetaTitle" value="${esc(i.Title || '')}"></label>
            <label class="pde-f">المؤلف<input id="pdeMetaAuthor" value="${esc(i.Author || '')}"></label>
            <label class="pde-f">الموضوع<input id="pdeMetaSubject" value="${esc(i.Subject || '')}"></label>
            <label class="pde-f">كلمات مفتاحية<input id="pdeMetaKeywords" value="${esc(i.Keywords || '')}"></label>
            <button class="btn b-b" style="width:100%;margin-top:6px" onclick="pdeSaveMeta()">حفظ الخصائص</button>
            ${row('المنتج (Producer)', i.Producer)}${row('المنشئ (Creator)', i.Creator)}
            ${row('إصدار PDF', i.PDFFormatVersion)}${row('تاريخ الإنشاء', i.CreationDate)}
        <div class="pde-sec">🔗 الربط بالنظام المحاسبي</div>`;
        if (d.linkType) {
            h += row('نوع المستند', d.linkLabel || d.linkType) + row('المعرّف', d.linkId) +
                (d.project ? row('المشروع', d.project) : '') + (d.party ? row('الجهة', d.party) : '') +
                (d.amount ? row('المبلغ', d.amount) : '') + (d.docNumber ? row('رقم المستند', d.docNumber) : '') +
                row('أنشأه', d.createdByName || d.createdBy || '');
        } else {
            h += `<div class="pde-meta">هذا المستند غير مربوط بسجل في النظام.</div>
                  <button class="btn b-b" style="width:100%;margin-top:6px" onclick="pdeLinkDialog()">🔗 ربط بفاتورة / عقد / مستخلص</button>`;
        }
        h += `<div class="pde-sec">🕘 النُّسخ والتدقيق</div>
            <button class="btn" style="width:100%" onclick="pdeShowVersions(PDE.doc.id)" ${d.id ? '' : 'disabled'}>سجل النُّسخ والمقارنة</button>
            ${d.id ? '' : '<div class="pde-meta">احفظ المستند في النظام أولاً لتفعيل سجل النُّسخ.</div>'}`;
        return h;
    }

    window.pdeSaveMeta = function () {
        const op = PDFE.Ops.make('doc.meta', {
            title: $('pdeMetaTitle').value, author: $('pdeMetaAuthor').value,
            subject: $('pdeMetaSubject').value, keywords: $('pdeMetaKeywords').value,
            creator: 'نظام حساب الأستاذ — GBR'
        });
        pushOp(op);
        toast('✅ ستُطبَّق الخصائص عند الحفظ', 'ok');
    };

    console.log('✅ PDF Editor Edit [ED] loaded');
})();
