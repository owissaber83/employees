// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   ✏️  تأشير المخططات + الحصر (Markup & Takeoff) — HTML5 canvas               ║
// ║   تأشير: دبابيس/مستطيل/سهم/رسم حر/نص. حصر: معايرة مقياس + قياس أطوال/مساحات.  ║
// ║   الإحداثيات مُطبَّعة (0..1)؛ القياس يُحسب بالبكسل الأصلي × عامل المقياس.        ║
// ║   يُحفظ في ledger/projectMarkups: { annotations:[...], scale:{factor,unit} }.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
(function () {
    const MK = { pid: null, key: null, canvas: null, ctx: null, img: null, imgW: 1000, imgH: 700, anns: [], tool: 'pin', color: '#e74c3c', drawing: false, draft: null, start: null, scale: null, building: null, hover: null, keyH: null };

    // ── تبويب: قائمة المخططات المؤشَّرة ──
    window.pdRenderMarkupTab = function (pid) {
        const pane = document.getElementById('pd-tab-markup'); if (!pane) return;
        const all = Object.entries((window.projectMarkups || {})[pid] || {}).sort((a, b) => (b[1].updatedAt || b[1].createdAt || '').localeCompare(a[1].updatedAt || a[1].createdAt || ''));
        pane.innerHTML = `
        <div class="card">
            <div class="tlb"><div class="c-tl" style="margin:0;border:none;padding:0">✏️ تأشير المخططات والحصر (Markup & Takeoff)</div>
                <button class="btn b-g" onclick="pdOpenMarkupAdd('${pid}')">➕ مخطط جديد</button></div>
            <div style="font-size:11px;color:#888;margin:8px 0 12px">أضف صورة مخطط ثم أشّر وقِس: 📍 دبابيس · مستطيل · سهم · رسم حر · نص، و📐 معايرة المقياس ثم 📏 قياس أطوال و⬛ مساحات تلقائياً مع جدول حصر.</div>
            ${all.length === 0 ? '<div class="empty"><div class="ei">✏️</div><p>لا مخططات بعد — أضف صورة مخطط للبدء بالتأشير والحصر</p></div>' : `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
            ${all.map(([k, m]) => { const nQ = (m.annotations || []).filter(a => a.type === 'length' || a.type === 'area').length; return `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">
                <div style="height:130px;background:#f1f3f5;position:relative;cursor:pointer" onclick="pdOpenMarkupEditor('${pid}','${k}')" title="افتح للتأشير والحصر">
                    <img src="${m.imageUrl}" style="width:100%;height:130px;object-fit:cover;display:block" onerror="this.style.display='none';this.parentElement.style.display='flex';this.parentElement.style.alignItems='center';this.parentElement.style.justifyContent='center';this.parentElement.innerHTML='<span style=&quot;font-size:28px&quot;>🖼️</span>'">
                    <span style="position:absolute;bottom:6px;right:6px;background:#1a3a5c;color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">✏️ ${(m.annotations || []).length}${nQ ? ` · 📏 ${nQ}` : ''}${m.scale ? ' · مُعايَر' : ''}</span>
                </div>
                <div style="padding:10px">
                    <div style="font-size:13px;font-weight:700;color:#1a3a5c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name || 'مخطط'}</div>
                    <div style="font-size:11px;color:#888;margin-top:2px">${m.category || ''}</div>
                    <div style="display:flex;gap:6px;margin-top:8px">
                        <button class="btn b-b" style="padding:4px 8px;font-size:11px;flex:1" onclick="pdOpenMarkupEditor('${pid}','${k}')">✏️ فتح</button>
                        <button class="btn b-r" style="padding:4px 8px;font-size:11px" onclick="pdDeleteMarkup('${pid}','${k}')">🗑️</button>
                    </div>
                </div>
            </div>`; }).join('')}
            </div>`}
        </div>`;
    };

    window.pdOpenMarkupAdd = function (pid) {
        let ov = document.getElementById('mkAddOverlay'); if (!ov) { ov = document.createElement('div'); ov.id = 'mkAddOverlay'; document.body.appendChild(ov); }
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px';
        ov.innerHTML = `<div dir="rtl" style="background:#fff;border-radius:16px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4)">
            <div style="background:linear-gradient(135deg,#8e44ad,#5b2c6f);color:#fff;padding:15px 20px;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center"><b>✏️ مخطط جديد للتأشير والحصر</b><button onclick="document.getElementById('mkAddOverlay').remove()" style="border:0;background:rgba(255,255,255,.2);color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px">✕</button></div>
            <div style="padding:20px">
                <div style="margin-bottom:10px"><label style="${lblStyle()}">اسم المخطط *</label><input id="mk-name" placeholder="مثال: مخطط الدور الأرضي" style="${inputStyle()}"></div>
                <div style="margin-bottom:10px"><label style="${lblStyle()}">رابط صورة المخطط *</label><input id="mk-img" placeholder="https://.../plan.jpg" style="${inputStyle()}"></div>
                <div style="margin-bottom:14px"><label style="${lblStyle()}">التصنيف</label><input id="mk-cat" placeholder="معماري / إنشائي / كهرباء..." style="${inputStyle()}"></div>
                <div style="font-size:11px;color:#888;margin-bottom:12px">💡 استخدم رابطاً مباشراً لصورة (JPG/PNG). صدّر المخطط كصورة من AutoCAD/Revit أو صوّره وارفعه لاستضافة صور.</div>
                <div style="display:flex;gap:8px"><button class="btn b-g" onclick="pdSaveMarkupNew('${pid}')" style="flex:1">💾 إضافة وفتح</button><button class="btn" onclick="document.getElementById('mkAddOverlay').remove()" style="background:#ecf0f1;color:#555">إلغاء</button></div>
            </div></div>`;
        setTimeout(() => { const n = document.getElementById('mk-name'); if (n) n.focus(); }, 30);
    };
    window.pdSaveMarkupNew = async function (pid) {
        const name = document.getElementById('mk-name')?.value.trim();
        const imageUrl = document.getElementById('mk-img')?.value.trim();
        if (!name) { toast('أدخل اسم المخطط', 'er'); return; }
        if (!/^https?:\/\//i.test(imageUrl || '')) { toast('أدخل رابط صورة صالحاً يبدأ بـ http', 'er'); return; }
        try {
            const r = await push(ref(db, `ledger/projectMarkups/${pid}`), { name, imageUrl, category: document.getElementById('mk-cat')?.value.trim() || '', annotations: [], createdAt: new Date().toISOString(), by: window.myP?.name || window.curU?.email || '' });
            document.getElementById('mkAddOverlay')?.remove();
            toast('تم — جارٍ فتح المحرّر...', 'ok');
            setTimeout(() => pdOpenMarkupEditor(pid, r.key), 250);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    };
    window.pdDeleteMarkup = function (pid, key) {
        cf2('حذف هذا المخطط وكل تأشيراته وقياساته؟', async () => {
            try { await remove(ref(db, `ledger/projectMarkups/${pid}/${key}`)); toast('تم الحذف', 'ok'); setTimeout(() => pdRenderTab('markup'), 300); }
            catch (e) { toast('خطأ: ' + e.message, 'er'); }
        });
    };

    // ── محرّر التأشير والحصر ──
    window.pdOpenMarkupEditor = function (pid, key) {
        const m = ((window.projectMarkups || {})[pid] || {})[key]; if (!m) { toast('المخطط غير موجود', 'er'); return; }
        MK.pid = pid; MK.key = key; MK.anns = JSON.parse(JSON.stringify(m.annotations || [])); MK.tool = 'pin'; MK.color = '#e74c3c';
        MK.draft = null; MK.drawing = false; MK.scale = m.scale || null; MK.building = null; MK.hover = null;
        let ov = document.getElementById('mkEditor'); if (!ov) { ov = document.createElement('div'); ov.id = 'mkEditor'; document.body.appendChild(ov); }
        ov.style.cssText = 'position:fixed;inset:0;background:#2b2b2b;z-index:99999;display:flex;flex-direction:column';
        const tb = (t, ic, label) => `<button onclick="pdMkTool('${t}')" id="mk-tool-${t}" title="${label}" style="background:${MK.tool === t ? '#8e44ad' : '#444'};color:#fff;border:0;border-radius:8px;padding:8px 11px;cursor:pointer;font-size:14px;font-family:inherit">${ic}</button>`;
        const sep = '<span style="width:1px;height:24px;background:#555;margin:0 4px;display:inline-block"></span>';
        const colors = ['#e74c3c', '#f39c12', '#27ae60', '#2980b9', '#8e44ad', '#111111', '#ffffff'];
        ov.innerHTML = `
            <div style="background:#1a1a1a;color:#fff;padding:9px 14px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <span style="font-weight:800;margin-inline-end:6px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">✏️ ${m.name || 'مخطط'}</span>
                ${tb('select', '🖐️', 'تحديد')}${tb('pin', '📍', 'دبوس بملاحظة')}${tb('rect', '▭', 'مستطيل')}${tb('arrow', '↗', 'سهم')}${tb('pen', '✎', 'رسم حر')}${tb('text', '🅣', 'نص')}
                ${sep}${tb('calibrate', '📐', 'معايرة المقياس (ارسم خطاً بطول معلوم)')}${tb('length', '📏', 'قياس طول (نقاط متتالية)')}${tb('area', '⬛', 'قياس مساحة (مضلّع)')}
                <span style="margin-inline-start:8px;display:flex;gap:4px">${colors.map(c => `<span data-c="${c}" onclick="pdMkColor('${c}')" title="لون" style="width:22px;height:22px;border-radius:50%;background:${c};border:2px solid ${MK.color === c ? '#fff' : '#666'};cursor:pointer;display:inline-block"></span>`).join('')}</span>
                <span style="flex:1"></span>
                <span id="mk-scalebadge" style="font-size:11px;background:#333;padding:5px 10px;border-radius:8px">${mkScaleText()}</span>
                <button onclick="pdMkTakeoff()" style="background:#16a085;color:#fff;border:0;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700">📋 الحصر</button>
                <button onclick="pdMkUndo()" style="background:#444;color:#fff;border:0;border-radius:8px;padding:8px 11px;cursor:pointer">↶</button>
                <button onclick="pdMkClear()" style="background:#444;color:#fff;border:0;border-radius:8px;padding:8px 11px;cursor:pointer">🧹</button>
                <button onclick="pdMkSave()" style="background:#27ae60;color:#fff;border:0;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:800">💾 حفظ</button>
                <button onclick="pdMkClose()" style="background:#c0392b;color:#fff;border:0;border-radius:8px;padding:8px 11px;cursor:pointer">✕</button>
            </div>
            <div style="flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:16px">
                <canvas id="mk-canvas" style="background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.5);touch-action:none;cursor:crosshair;max-width:none"></canvas>
            </div>
            <div id="mk-hint" style="background:#1a1a1a;color:#aaa;font-size:11px;padding:6px 14px;text-align:center">⏳ جارٍ تحميل الصورة...</div>`;
        MK.canvas = document.getElementById('mk-canvas'); MK.ctx = MK.canvas.getContext('2d');
        const img = new Image();
        img.onload = () => { MK.img = img; MK.imgW = img.naturalWidth || 1000; MK.imgH = img.naturalHeight || 700; mkFit(); mkRedraw(); mkHint(); };
        img.onerror = () => { const h = document.getElementById('mk-hint'); if (h) h.innerHTML = '⚠️ تعذّر تحميل الصورة — تأكد أن الرابط مباشر لصورة (JPG/PNG) وعام.'; };
        img.src = m.imageUrl;
        mkBind();
        MK.keyH = e => { if (e.key === 'Escape') { if (MK.building) { MK.building = null; MK.hover = null; mkRedraw(); } else pdMkClose(); } else if (e.key === 'Enter' && MK.building) mkFinishBuild(); };
        document.addEventListener('keydown', MK.keyH);
    };

    function mkHint() {
        const h = document.getElementById('mk-hint'); if (!h) return;
        const t = MK.tool;
        if (t === 'calibrate') h.textContent = '📐 المعايرة: ارسم خطاً على بُعد معلوم في المخطط (مثل طول جدار)، ثم أدخل طوله الفعلي ووحدته.';
        else if (t === 'length') h.textContent = '📏 الطول: انقر نقاطاً متتالية على طول الخط، وانقر مزدوجاً (أو Enter) للإنهاء. Esc للإلغاء.';
        else if (t === 'area') h.textContent = '⬛ المساحة: انقر رؤوس المضلّع، وانقر مزدوجاً (أو Enter) للإغلاق والحساب. Esc للإلغاء.';
        else h.textContent = 'اختر أداة وأشّر. الدبوس/النص يطلبان ملاحظة. 📋 الحصر يعرض جدول الكميات. 💾 للحفظ.';
    }
    function mkScaleText() { return MK.scale ? `📐 المقياس: 1px ≈ ${(MK.scale.factor).toPrecision(3)} ${MK.scale.unit}` : '📐 غير مُعايَر'; }
    function mkUpdateScaleBadge() { const b = document.getElementById('mk-scalebadge'); if (b) b.textContent = mkScaleText(); }

    function mkFit() {
        const maxW = Math.min(window.innerWidth - 40, MK.imgW), maxH = window.innerHeight - 130;
        let scale = maxW / MK.imgW; if (MK.imgH * scale > maxH) scale = maxH / MK.imgH;
        MK.canvas.width = Math.max(50, Math.round(MK.imgW * scale));
        MK.canvas.height = Math.max(50, Math.round(MK.imgH * scale));
    }
    const DX = x => x * MK.canvas.width, DY = y => y * MK.canvas.height;
    function mkPos(e) { const r = MK.canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; }

    // ── قياسات (بالبكسل الأصلي للصورة) ──
    function segPx(a, b) { return Math.hypot((b.x - a.x) * MK.imgW, (b.y - a.y) * MK.imgH); }
    function polyLenPx(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += segPx(pts[i - 1], pts[i]); return L; }
    function polyAreaPx(pts) { let A = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += (p.x * MK.imgW) * (q.y * MK.imgH) - (q.x * MK.imgW) * (p.y * MK.imgH); } return Math.abs(A / 2); }
    function realLen(px) { return MK.scale ? px * MK.scale.factor : null; }
    function realArea(px2) { return MK.scale ? px2 * MK.scale.factor * MK.scale.factor : null; }
    function fmtQ(v) { return (Math.round(v * 100) / 100).toLocaleString('en-US'); }
    function annLenVal(a) { const v = realLen(polyLenPx(a.points || [])); return v == null ? 'بلا مقياس' : `${fmtQ(v)} ${MK.scale.unit}`; }
    function annAreaVal(a) { const v = realArea(polyAreaPx(a.points || [])); return v == null ? 'بلا مقياس' : `${fmtQ(v)} ${MK.scale.unit}²`; }

    // ── رسم ──
    function mkArrow(ctx, x1, y1, x2, y2) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const ang = Math.atan2(y2 - y1, x2 - x1), h = 11;
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - h * Math.cos(ang - Math.PI / 6), y2 - h * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(x2 - h * Math.cos(ang + Math.PI / 6), y2 - h * Math.sin(ang + Math.PI / 6));
        ctx.closePath(); ctx.fill();
    }
    function mkPin(ctx, x, y, color) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y - 13); ctx.arc(x, y - 20, 8, Math.PI * 0.85, Math.PI * 0.15, false); ctx.closePath();
        ctx.fillStyle = color; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 20, 3.2, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    }
    function mkLabel(ctx, x, y, text) {
        if (!text) return; ctx.font = 'bold 13px Tahoma';
        const w = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(20,30,45,.82)'; ctx.fillRect(x - 3, y - 14, w + 8, 19);
        ctx.fillStyle = '#fff'; ctx.fillText(text, x + 1, y);
    }
    function mkVerts(ctx, pts, color) { ctx.fillStyle = color; pts.forEach(p => { ctx.beginPath(); ctx.arc(DX(p.x), DY(p.y), 3.5, 0, Math.PI * 2); ctx.fill(); }); }
    function mkCentroid(pts) { let x = 0, y = 0; pts.forEach(p => { x += p.x; y += p.y; }); return { x: x / pts.length, y: y / pts.length }; }

    function mkDrawAnn(ctx, a) {
        ctx.lineWidth = 2.5; ctx.strokeStyle = a.color || '#e74c3c'; ctx.fillStyle = a.color || '#e74c3c';
        if (a.type === 'rect') ctx.strokeRect(DX(a.x), DY(a.y), DX(a.w), DY(a.h));
        else if (a.type === 'arrow' || a.type === 'measure' || a.type === 'scaleref') {
            mkArrow(ctx, DX(a.x1), DY(a.y1), DX(a.x2), DY(a.y2));
            if (a.label) mkLabel(ctx, (DX(a.x1) + DX(a.x2)) / 2, (DY(a.y1) + DY(a.y2)) / 2 - 4, a.label);
        }
        else if (a.type === 'pen') { ctx.beginPath(); (a.points || []).forEach((p, i) => { const px = DX(p.x), py = DY(p.y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); }
        else if (a.type === 'pin') { mkPin(ctx, DX(a.x), DY(a.y), a.color); if (a.label) mkLabel(ctx, DX(a.x) + 12, DY(a.y) - 22, a.label); }
        else if (a.type === 'text') mkLabel(ctx, DX(a.x), DY(a.y), a.label || '');
        else if (a.type === 'length') {
            const pts = a.points || []; ctx.beginPath(); pts.forEach((p, i) => { i ? ctx.lineTo(DX(p.x), DY(p.y)) : ctx.moveTo(DX(p.x), DY(p.y)); }); ctx.stroke(); mkVerts(ctx, pts, a.color);
            if (pts.length) { const mid = pts[Math.floor(pts.length / 2)]; mkLabel(ctx, DX(mid.x) + 6, DY(mid.y) - 6, `${a.name ? a.name + ': ' : ''}${annLenVal(a)}`); }
        }
        else if (a.type === 'area') {
            const pts = a.points || []; if (pts.length) { ctx.beginPath(); pts.forEach((p, i) => { i ? ctx.lineTo(DX(p.x), DY(p.y)) : ctx.moveTo(DX(p.x), DY(p.y)); }); ctx.closePath(); ctx.globalAlpha = .18; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); mkVerts(ctx, pts, a.color); const c = mkCentroid(pts); mkLabel(ctx, DX(c.x) - 20, DY(c.y), `${a.name ? a.name + ': ' : ''}${annAreaVal(a)}`); }
        }
    }
    function mkDrawBuilding(ctx) {
        const b = MK.building; if (!b) return; const pts = b.points.slice();
        ctx.lineWidth = 2.5; ctx.strokeStyle = b.color; ctx.fillStyle = b.color;
        ctx.beginPath(); pts.forEach((p, i) => { i ? ctx.lineTo(DX(p.x), DY(p.y)) : ctx.moveTo(DX(p.x), DY(p.y)); }); ctx.stroke();
        if (MK.hover && pts.length) {
            ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(DX(pts[pts.length - 1].x), DY(pts[pts.length - 1].y)); ctx.lineTo(DX(MK.hover.x), DY(MK.hover.y));
            if (b.type === 'area' && pts.length > 1) ctx.lineTo(DX(pts[0].x), DY(pts[0].y));
            ctx.stroke(); ctx.setLineDash([]);
        }
        mkVerts(ctx, pts, b.color);
    }
    function mkRedraw() {
        const ctx = MK.ctx; if (!ctx) return;
        ctx.clearRect(0, 0, MK.canvas.width, MK.canvas.height);
        if (MK.img) ctx.drawImage(MK.img, 0, 0, MK.canvas.width, MK.canvas.height);
        MK.anns.forEach(a => mkDrawAnn(ctx, a));
        if (MK.draft) mkDrawAnn(ctx, MK.draft);
        mkDrawBuilding(ctx);
    }

    // ── تفاعل ──
    function nearFirst(p) { const b = MK.building; if (!b || !b.points.length) return false; const f = b.points[0]; return Math.hypot((p.x - f.x) * MK.canvas.width, (p.y - f.y) * MK.canvas.height) < 12; }
    function mkFinishBuild() {
        const b = MK.building; if (!b) return; const min = b.type === 'area' ? 3 : 2;
        if (b.points.length >= min) { const name = prompt('اسم البند (اختياري):', '') || ''; b.name = name; MK.anns.push(b); }
        MK.building = null; MK.hover = null; mkRedraw();
    }
    function mkBind() {
        const c = MK.canvas;
        c.onpointerdown = e => {
            e.preventDefault(); const p = mkPos(e);
            if (MK.tool === 'select') return;
            if (MK.tool === 'length' || MK.tool === 'area') {
                if (!MK.building) MK.building = { type: MK.tool, color: MK.color, points: [p] };
                else if (nearFirst(p) && MK.building.points.length >= (MK.tool === 'area' ? 3 : 2)) return mkFinishBuild();
                else MK.building.points.push(p);
                mkRedraw(); return;
            }
            if (MK.tool === 'pin') { const label = prompt('ملاحظة الدبوس:', ''); if (label !== null) { MK.anns.push({ type: 'pin', color: MK.color, x: p.x, y: p.y, label }); mkRedraw(); } return; }
            if (MK.tool === 'text') { const label = prompt('النص:', ''); if (label) { MK.anns.push({ type: 'text', color: MK.color, x: p.x, y: p.y, label }); mkRedraw(); } return; }
            MK.drawing = true; MK.start = p;
            if (MK.tool === 'pen') MK.draft = { type: 'pen', color: MK.color, points: [p] };
            else if (MK.tool === 'rect') MK.draft = { type: 'rect', color: MK.color, x: p.x, y: p.y, w: 0, h: 0 };
            else MK.draft = { type: MK.tool === 'calibrate' ? 'calibrate' : MK.tool, color: MK.color, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
            try { c.setPointerCapture(e.pointerId); } catch (_) { }
        };
        c.onpointermove = e => {
            const p = mkPos(e);
            if (MK.building) { MK.hover = p; mkRedraw(); return; }
            if (!MK.drawing || !MK.draft) return;
            if (MK.draft.type === 'pen') MK.draft.points.push(p);
            else if (MK.draft.type === 'rect') { MK.draft.w = p.x - MK.start.x; MK.draft.h = p.y - MK.start.y; }
            else { MK.draft.x2 = p.x; MK.draft.y2 = p.y; }
            mkRedraw();
        };
        c.onpointerup = () => {
            if (!MK.drawing) return; MK.drawing = false; const d = MK.draft; MK.draft = null;
            if (!d) { mkRedraw(); return; }
            if (d.type === 'calibrate') {
                const px = segPx({ x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 });
                if (px < 2) { mkRedraw(); return; }
                const rl = parseFloat(prompt('الطول الفعلي لخط المعايرة (رقم):', '') || '');
                if (!rl || rl <= 0) { mkRedraw(); return; }
                const unit = (prompt('الوحدة (م / سم / قدم):', 'م') || 'م').trim();
                MK.scale = { factor: rl / px, unit, realLen: rl, natPx: px };
                MK.anns.push({ type: 'scaleref', color: d.color, x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, label: `مقياس: ${fmtQ(rl)} ${unit}` });
                mkUpdateScaleBadge(); toast('تمّت المعايرة ✓ — الآن قِس الأطوال والمساحات', 'ok', 4000); mkRedraw(); return;
            }
            if (d.type === 'rect') { if (d.w < 0) { d.x += d.w; d.w = -d.w; } if (d.h < 0) { d.y += d.h; d.h = -d.h; } if (d.w < 0.004 && d.h < 0.004) { mkRedraw(); return; } }
            if (d.type === 'pen' && (d.points || []).length < 2) { mkRedraw(); return; }
            MK.anns.push(d); mkRedraw();
        };
        c.ondblclick = () => { if (MK.building) mkFinishBuild(); };
    }

    window.pdMkTool = function (t) {
        if (MK.building && t !== MK.building.type) { MK.building = null; MK.hover = null; mkRedraw(); }
        MK.tool = t;
        ['select', 'pin', 'rect', 'arrow', 'pen', 'text', 'calibrate', 'length', 'area'].forEach(x => { const b = document.getElementById('mk-tool-' + x); if (b) b.style.background = x === t ? '#8e44ad' : '#444'; });
        if (MK.canvas) MK.canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
        mkHint();
    };
    window.pdMkColor = function (c) { MK.color = c; document.querySelectorAll('#mkEditor span[data-c]').forEach(s => { s.style.border = '2px solid ' + (s.dataset.c === c ? '#fff' : '#666'); }); };
    window.pdMkUndo = function () { if (MK.building) { MK.building.points.pop(); if (!MK.building.points.length) MK.building = null; } else MK.anns.pop(); mkRedraw(); };
    window.pdMkClear = function () { if (MK.anns.length && !confirm('مسح كل التأشيرات والقياسات؟')) return; MK.anns = []; MK.building = null; mkRedraw(); };
    window.pdMkSave = async function () {
        try { await update(ref(db, `ledger/projectMarkups/${MK.pid}/${MK.key}`), { annotations: MK.anns, scale: MK.scale || null, updatedAt: new Date().toISOString() }); toast('تم حفظ التأشير والحصر ✓', 'ok'); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    };
    window.pdMkClose = function () {
        const ov = document.getElementById('mkEditor'); if (ov) ov.remove();
        if (MK.keyH) { document.removeEventListener('keydown', MK.keyH); MK.keyH = null; }
        if (typeof pdRenderTab === 'function' && document.getElementById('pg-projectdetail')?.classList.contains('act')) pdRenderTab('markup');
    };

    // ── جدول الحصر (Takeoff) ──
    window.pdMkTakeoff = function () {
        const lengths = MK.anns.filter(a => a.type === 'length'), areas = MK.anns.filter(a => a.type === 'area');
        let ov = document.getElementById('mkTakeoff'); if (!ov) { ov = document.createElement('div'); ov.id = 'mkTakeoff'; document.body.appendChild(ov); }
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:100000;padding:16px';
        const totLen = MK.scale ? lengths.reduce((s, a) => s + realLen(polyLenPx(a.points || [])), 0) : null;
        const totArea = MK.scale ? areas.reduce((s, a) => s + realArea(polyAreaPx(a.points || [])), 0) : null;
        const u = MK.scale ? MK.scale.unit : '';
        const rowsL = lengths.map((a, i) => `<tr style="border-top:1px solid #eee"><td style="padding:6px 10px">📏 ${a.name || 'طول ' + (i + 1)}</td><td style="padding:6px 10px;text-align:left;font-weight:700">${annLenVal(a)}</td></tr>`).join('');
        const rowsA = areas.map((a, i) => `<tr style="border-top:1px solid #eee"><td style="padding:6px 10px">⬛ ${a.name || 'مساحة ' + (i + 1)}</td><td style="padding:6px 10px;text-align:left;font-weight:700">${annAreaVal(a)}</td></tr>`).join('');
        ov.innerHTML = `<div dir="rtl" style="background:#fff;border-radius:16px;max-width:560px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
            <div style="background:linear-gradient(135deg,#16a085,#0e6b5e);color:#fff;padding:15px 20px;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center"><b>📋 جدول الحصر (Takeoff)</b><button onclick="document.getElementById('mkTakeoff').remove()" style="border:0;background:rgba(255,255,255,.2);color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px">✕</button></div>
            <div style="padding:20px">
                ${!MK.scale ? '<div style="background:#fdf2e9;border:1px dashed #e67e22;border-radius:8px;padding:12px;color:#7d4e00;font-size:12px;margin-bottom:14px">⚠️ لم يُعايَر المقياس بعد — استخدم أداة 📐 «معايرة المقياس» أولاً لتحويل القياسات إلى وحدات حقيقية.</div>' : `<div style="font-size:12px;color:#16a085;margin-bottom:12px">${mkScaleText()}</div>`}
                ${lengths.length ? `<div style="font-weight:800;color:#1a3a5c;margin:6px 0">الأطوال (${lengths.length})</div><table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${rowsL}${totLen != null ? `<tr style="border-top:2px solid #16a085;background:#f4faf8"><td style="padding:7px 10px;font-weight:800">الإجمالي</td><td style="padding:7px 10px;text-align:left;font-weight:900;color:#16a085">${fmtQ(totLen)} ${u}</td></tr>` : ''}</tbody></table>` : ''}
                ${areas.length ? `<div style="font-weight:800;color:#1a3a5c;margin:14px 0 6px">المساحات (${areas.length})</div><table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${rowsA}${totArea != null ? `<tr style="border-top:2px solid #16a085;background:#f4faf8"><td style="padding:7px 10px;font-weight:800">الإجمالي</td><td style="padding:7px 10px;text-align:left;font-weight:900;color:#16a085">${fmtQ(totArea)} ${u}²</td></tr>` : ''}</tbody></table>` : ''}
                ${!lengths.length && !areas.length ? '<div style="color:#999;text-align:center;padding:20px;font-size:13px">لا قياسات بعد — استخدم أدوات 📏 الطول و⬛ المساحة.</div>' : ''}
                <div style="font-size:11px;color:#888;margin-top:14px">💡 القياسات مقرّبة وتعتمد دقة المعايرة ووضوح المخطط — للأغراض التقديرية والحصر المبدئي.</div>
            </div></div>`;
    };

    console.log('✅ Markup & Takeoff module loaded');
})();
