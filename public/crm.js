// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🤝  CRM — إدارة علاقات العملاء (فرص البيع وخط الأنابيب)                     ║
// ║  وحدة ثانوية: تعتمد على globals من app.js (db, ref, R, push, update, remove, ║
// ║  $, toast, fmt, cf2, curU, can). بياناتها تُعزَل تلقائياً للمستأجر الحالي.    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// مراحل خط الأنابيب (الفرص المفتوحة)
window.CRM_STAGES = [
    { id: 'new', label: '🆕 جديد', color: '#3498db' },
    { id: 'contacted', label: '📞 تواصل', color: '#9b59b6' },
    { id: 'quoted', label: '📄 عرض سعر', color: '#f39c12' },
    { id: 'negotiation', label: '🤝 تفاوض', color: '#e67e22' }
];
window.CRM_SOURCES = ['إحالة', 'الموقع الإلكتروني', 'مكالمة واردة', 'معرض/فعالية', 'وسائل التواصل', 'عميل حالي', 'أخرى'];
// احتمالية الإغلاق لكل مرحلة (للقيمة المرجّحة)
window.CRM_STAGE_PROB = { new: 10, contacted: 30, quoted: 50, negotiation: 75 };
window.CRM_ACTIVITY_TYPES = { call: '📞 مكالمة', meeting: '🤝 اجتماع', email: '📧 بريد', whatsapp: '💬 واتساب', note: '📝 ملاحظة' };
function crmToday() { return new Date().toISOString().slice(0, 10); }
function crmDigits(p) { return String(p || '').replace(/[^\d]/g, ''); }

function crmMoney(v) { return (typeof fmt === 'function') ? fmt(Number(v) || 0) : (Number(v) || 0).toLocaleString('en'); }
function crmEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function crmAll() { return window.crmOpportunities || {}; }
function crmStageInfo(id) { return window.CRM_STAGES.find(s => s.id === id) || { id, label: id, color: '#888' }; }

// ── العرض الرئيسي: مؤشرات + لوحة خط الأنابيب ────────────────────────────────
window.renderCRM = function () {
    const c = document.getElementById('pg-crm'); if (!c) return;
    if (window._crmView === 'reports') { crmRenderReports(c); return; }
    const opps = crmAll();
    const arr = Object.entries(opps).map(([k, o]) => ({ k, ...o }));
    const open = arr.filter(o => (o.status || 'open') === 'open');
    const won = arr.filter(o => o.status === 'won');
    const lost = arr.filter(o => o.status === 'lost');
    const openValue = open.reduce((s, o) => s + (parseFloat(o.value) || 0), 0);
    const mk = new Date().toISOString().slice(0, 7);
    const wonMonth = won.filter(o => (o.wonAt || '').slice(0, 7) === mk);
    const wonMonthVal = wonMonth.reduce((s, o) => s + (parseFloat(o.value) || 0), 0);
    const winRate = (won.length + lost.length) ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
    const weighted = open.reduce((s, o) => s + (parseFloat(o.value) || 0) * ((window.CRM_STAGE_PROB[o.stage || 'new'] || 0) / 100), 0);
    const today = crmToday();
    const needFollow = open.filter(o => o.nextFollowUp && o.nextFollowUp <= today);

    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;

    const showClosed = window._crmShowClosed;
    let html = `
    <div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <input id="crmSearch" type="text" placeholder="🔍 ابحث باسم الفرصة أو العميل..." oninput="window._crmSearch=this.value;renderCRM()" value="${crmEsc(window._crmSearch || '')}" style="padding:8px 12px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;min-width:240px">
                <button class="btn" onclick="window._crmShowClosed=!window._crmShowClosed;renderCRM()" style="background:${showClosed ? '#1f618d' : '#f0f5fa'};color:${showClosed ? '#fff' : '#1a3a5c'};border:1.5px solid #d0d7e0">${showClosed ? '✓ ' : ''}📁 عرض المغلقة</button>
                <button class="btn" onclick="window._crmView='reports';renderCRM()" style="background:#8e44ad;color:#fff">📊 التقارير</button>
            </div>
            <button class="btn b-g" onclick="crmOpenEditor()" style="font-weight:800">➕ فرصة جديدة</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
            ${kpi('🔵', 'فرص مفتوحة', open.length, '#3498db')}
            ${kpi('💰', 'قيمة خط الأنابيب', crmMoney(openValue), '#16a085')}
            ${kpi('⚖️', 'القيمة المرجّحة', crmMoney(weighted), '#2980b9')}
            ${kpi('🔔', 'تحتاج متابعة', needFollow.length, needFollow.length ? '#e74c3c' : '#95a5a6')}
            ${kpi('🏆', 'مكسوبة هذا الشهر', `${wonMonth.length} · ${crmMoney(wonMonthVal)}`, '#27ae60')}
            ${kpi('📊', 'معدّل الفوز', winRate + '%', '#8e44ad')}
        </div>`;

    const q = (window._crmSearch || '').trim().toLowerCase();
    const matches = (o) => !q || (o.title || '').toLowerCase().includes(q) || (o.customerName || '').toLowerCase().includes(q);

    // لوحة المراحل (الفرص المفتوحة)
    html += `<div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px">`;
    window.CRM_STAGES.forEach(st => {
        const col = open.filter(o => (o.stage || 'new') === st.id && matches(o)).sort((a, b) => (parseFloat(b.value) || 0) - (parseFloat(a.value) || 0));
        const colVal = col.reduce((s, o) => s + (parseFloat(o.value) || 0), 0);
        html += `<div style="flex:1;min-width:240px;background:#f4f6f9;border-radius:12px;padding:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:0 4px">
                <span style="font-weight:800;color:${st.color};font-size:13px">${st.label}</span>
                <span style="font-size:11px;color:#888">${col.length} · ${crmMoney(colVal)}</span>
            </div>
            ${col.map(o => crmCard(o)).join('') || '<div style="text-align:center;color:#bbb;font-size:12px;padding:18px 0">— لا فرص —</div>'}
        </div>`;
    });
    html += `</div>`;

    // المغلقة (مكسوبة/مخسورة)
    if (showClosed) {
        const closed = arr.filter(o => o.status === 'won' || o.status === 'lost').filter(matches).sort((a, b) => (b.closedAt || b.wonAt || b.lostAt || '').localeCompare(a.closedAt || a.wonAt || a.lostAt || ''));
        html += `<div style="margin-top:18px;background:#fff;border-radius:12px;padding:14px">
            <div style="font-weight:800;color:#1a3a5c;margin-bottom:10px">📁 الفرص المغلقة (${closed.length})</div>
            ${closed.map(o => {
                const wonO = o.status === 'won';
                return `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 10px;border-bottom:1px solid #f0f0f0">
                    <div><strong>${crmEsc(o.title)}</strong> <span style="color:#888;font-size:12px">— ${crmEsc(o.customerName)}</span> ${wonO ? '<span style="background:#27ae60;color:#fff;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:700">مكسوبة</span>' : `<span style="background:#c0392b;color:#fff;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:700">مخسورة</span>`}</div>
                    <div style="display:flex;gap:8px;align-items:center"><span style="font-weight:700;color:${wonO ? '#27ae60' : '#c0392b'}">${crmMoney(o.value)}</span><button class="btn" onclick="crmReopen('${o.k}')" style="font-size:11px;padding:3px 8px" title="إعادة فتح">↩️</button><button class="btn b-r" onclick="crmDelete('${o.k}')" style="font-size:11px;padding:3px 8px">🗑️</button></div>
                </div>`;
            }).join('') || '<div style="color:#bbb;text-align:center;padding:14px">لا توجد فرص مغلقة</div>'}
        </div>`;
    }

    html += `</div>`;
    const wasSearch = document.activeElement && document.activeElement.id === 'crmSearch';
    c.innerHTML = html;
    crmEnsureModal();
    if (wasSearch) { const si = document.getElementById('crmSearch'); if (si) { si.focus(); try { si.setSelectionRange(si.value.length, si.value.length); } catch (e) { } } }
};

// بطاقة فرصة في اللوحة
function crmCard(o) {
    const due = o.expectedClose ? new Date(o.expectedClose) : null;
    const overdue = due && due < new Date();
    const stageOpts = window.CRM_STAGES.map(s => `<option value="${s.id}" ${(o.stage || 'new') === s.id ? 'selected' : ''}>${s.label}</option>`).join('');
    const today = crmToday();
    // شارة المتابعة
    let followBadge = '';
    if (o.nextFollowUp) {
        if (o.nextFollowUp < today) followBadge = `<span style="background:#e74c3c;color:#fff;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:700">⏰ متابعة متأخرة</span>`;
        else if (o.nextFollowUp === today) followBadge = `<span style="background:#e67e22;color:#fff;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:700">🔔 متابعة اليوم</span>`;
        else followBadge = `<span style="background:#eaf2f8;color:#2980b9;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:700">📆 ${o.nextFollowUp}</span>`;
    }
    const ph = crmDigits(o.phone);
    const contact = `<div style="display:flex;gap:5px;margin-top:6px">
        ${o.phone ? `<a href="tel:${crmEsc(o.phone)}" title="اتصال" style="text-decoration:none;background:#eafaf1;color:#27ae60;border-radius:6px;padding:3px 8px;font-size:12px">📞</a>` : ''}
        ${ph ? `<a href="https://wa.me/${ph}" target="_blank" title="واتساب" style="text-decoration:none;background:#e8f8ef;color:#25d366;border-radius:6px;padding:3px 8px;font-size:12px">💬</a>` : ''}
        ${o.email ? `<a href="mailto:${crmEsc(o.email)}" title="بريد" style="text-decoration:none;background:#eef3fb;color:#2980b9;border-radius:6px;padding:3px 8px;font-size:12px">📧</a>` : ''}
        <button class="btn" onclick="crmOpenDetail('${o.k}')" title="التفاصيل والأنشطة" style="margin-inline-start:auto;font-size:11px;padding:3px 8px;background:#f4f6f9">👁️ تفاصيل</button>
    </div>`;
    return `<div style="background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <div style="font-weight:800;color:#1a3a5c;font-size:13px;cursor:pointer" onclick="crmOpenDetail('${o.k}')">${crmEsc(o.title)}</div>
        <div style="font-size:12px;color:#666;margin-top:2px">🏢 ${crmEsc(o.customerName)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;flex-wrap:wrap;gap:4px">
            <span style="font-weight:800;color:#16a085;font-size:13px">${crmMoney(o.value)}</span>
            ${followBadge || (due ? `<span style="font-size:10px;color:${overdue ? '#c0392b' : '#888'}">📅 ${o.expectedClose}</span>` : '')}
        </div>
        ${contact}
        <select onchange="crmSetStage('${o.k}',this.value)" style="width:100%;margin-top:7px;padding:4px;border:1px solid #e0e0e0;border-radius:6px;font-family:inherit;font-size:11px">${stageOpts}</select>
        <div style="display:flex;gap:4px;margin-top:6px">
            <button class="btn b-g" onclick="crmMarkWon('${o.k}')" style="flex:1;font-size:11px;padding:4px" title="فرصة مكسوبة">🏆 ربح</button>
            <button class="btn b-o" onclick="crmMarkLost('${o.k}')" style="flex:1;font-size:11px;padding:4px" title="فرصة مخسورة">❌ خسارة</button>
            <button class="btn" onclick="crmOpenEditor('${o.k}')" style="font-size:11px;padding:4px" title="تعديل">✏️</button>
        </div>
    </div>`;
}

// ── 📊 تقارير CRM التحليلية ────────────────────────────────────────────────
function crmRenderReports(c) {
    const arr = Object.entries(crmAll()).map(([k, o]) => ({ k, ...o }));
    const open = arr.filter(o => (o.status || 'open') === 'open');
    const won = arr.filter(o => o.status === 'won');
    const lost = arr.filter(o => o.status === 'lost');
    const wonVal = won.reduce((s, o) => s + (parseFloat(o.value) || 0), 0);
    const lostVal = lost.reduce((s, o) => s + (parseFloat(o.value) || 0), 0);
    const winRate = (won.length + lost.length) ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
    const avgWon = won.length ? wonVal / won.length : 0;

    const bar = (label, val, max, color, extra) => {
        const pct = max > 0 ? Math.round((val / max) * 100) : 0;
        return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="color:#444;font-weight:600">${label}</span><span style="color:#888">${extra || ''}</span></div>
            <div style="background:#eef1f5;border-radius:6px;height:20px;overflow:hidden"><div style="width:${pct}%;background:${color};height:100%;border-radius:6px;min-width:2px"></div></div>
        </div>`;
    };
    const cardWrap = (title, inner) => `<div style="background:#fff;border:1.5px solid #eef0f3;border-radius:14px;padding:18px 20px;box-shadow:0 2px 8px rgba(0,0,0,.04)"><div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px">${title}</div>${inner}</div>`;
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:140px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:20px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;

    // 1) القمع: الفرص المفتوحة حسب المرحلة
    const maxStageVal = Math.max(1, ...window.CRM_STAGES.map(s => open.filter(o => (o.stage || 'new') === s.id).reduce((a, o) => a + (parseFloat(o.value) || 0), 0)));
    const funnel = window.CRM_STAGES.map(s => {
        const col = open.filter(o => (o.stage || 'new') === s.id);
        const v = col.reduce((a, o) => a + (parseFloat(o.value) || 0), 0);
        return bar(s.label, v, maxStageVal, s.color, `${col.length} فرصة · ${crmMoney(v)}`);
    }).join('') || '<div style="color:#aaa;font-size:12px">لا فرص مفتوحة</div>';

    // 2) حسب المصدر
    const bySource = {};
    arr.forEach(o => { const s = o.source || 'غير محدد'; bySource[s] = bySource[s] || { total: 0, won: 0, wonVal: 0 }; bySource[s].total++; if (o.status === 'won') { bySource[s].won++; bySource[s].wonVal += parseFloat(o.value) || 0; } });
    const srcRows = Object.entries(bySource).sort((a, b) => b[1].total - a[1].total).map(([s, d]) => `<tr style="border-bottom:1px solid #f3f3f3"><td style="padding:7px 4px">${crmEsc(s)}</td><td style="text-align:center">${d.total}</td><td style="text-align:center;color:#27ae60;font-weight:700">${d.won}</td><td style="text-align:left">${crmMoney(d.wonVal)}</td><td style="text-align:center;font-weight:700;color:${d.total && d.won / d.total >= .3 ? '#27ae60' : '#888'}">${d.total ? Math.round(d.won / d.total * 100) : 0}%</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:10px">لا بيانات</td></tr>';

    // 3) تنبؤ المبيعات: القيمة المرجّحة حسب شهر الإغلاق المتوقع
    const fc = {};
    open.forEach(o => { if (!o.expectedClose) return; const m = o.expectedClose.slice(0, 7); const w = (parseFloat(o.value) || 0) * ((window.CRM_STAGE_PROB[o.stage || 'new'] || 0) / 100); fc[m] = (fc[m] || 0) + w; });
    const fcKeys = Object.keys(fc).sort().slice(0, 6);
    const maxFc = Math.max(1, ...fcKeys.map(m => fc[m]));
    const forecast = fcKeys.map(m => bar(m, fc[m], maxFc, '#2980b9', crmMoney(fc[m]))).join('') || '<div style="color:#aaa;font-size:12px">حدّد «تاريخ الإغلاق المتوقع» للفرص لرؤية التنبؤ</div>';

    // 4) المكسوب حسب الشهر (آخر 6 أشهر)
    const months = []; const now = new Date();
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d.toISOString().slice(0, 7)); }
    const wonByM = {}; won.forEach(o => { const m = (o.wonAt || '').slice(0, 7); if (m) wonByM[m] = (wonByM[m] || 0) + (parseFloat(o.value) || 0); });
    const maxWon = Math.max(1, ...months.map(m => wonByM[m] || 0));
    const wonChart = months.map(m => bar(m, wonByM[m] || 0, maxWon, '#27ae60', crmMoney(wonByM[m] || 0))).join('');

    // 5) أسباب الخسارة
    const lostReasons = {}; lost.forEach(o => { const r = (o.lostReason || '').trim() || 'غير محدّد'; lostReasons[r] = (lostReasons[r] || 0) + 1; });
    const lostRows = Object.entries(lostReasons).sort((a, b) => b[1] - a[1]).map(([r, n]) => `<div style="display:flex;justify-content:space-between;padding:6px 4px;border-bottom:1px solid #f3f3f3;font-size:13px"><span>${crmEsc(r)}</span><span style="font-weight:700;color:#c0392b">${n}</span></div>`).join('') || '<div style="color:#aaa;font-size:12px">لا فرص مخسورة</div>';

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">📊 تقارير CRM</div>
            <button class="btn b-b" onclick="window._crmView='board';renderCRM()">📋 العودة لخط الأنابيب</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
            ${kpi('🏆', 'إجمالي المكسوب', crmMoney(wonVal), '#27ae60')}
            ${kpi('📊', 'معدّل الفوز', winRate + '%', '#8e44ad')}
            ${kpi('💼', 'متوسط حجم الصفقة', crmMoney(avgWon), '#2980b9')}
            ${kpi('📉', 'قيمة الفرص المخسورة', crmMoney(lostVal), '#c0392b')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
            ${cardWrap('🔻 القمع — الفرص المفتوحة حسب المرحلة', funnel)}
            ${cardWrap('🔮 تنبؤ المبيعات (قيمة مرجّحة حسب شهر الإغلاق)', forecast)}
            ${cardWrap('🏆 المكسوب حسب الشهر (آخر 6 أشهر)', wonChart)}
            ${cardWrap('❌ أسباب الخسارة', lostRows)}
            ${cardWrap('🔗 الأداء حسب المصدر', `<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="color:#888;font-size:11px"><th style="padding:4px;text-align:right">المصدر</th><th>إجمالي</th><th>مكسوب</th><th style="text-align:left">قيمة المكسوب</th><th>التحويل</th></tr></thead><tbody>${srcRows}</tbody></table>`)}
        </div>
    </div>`;
}

// ── المُحرّر (إضافة/تعديل) ─────────────────────────────────────────────────
function crmEnsureModal() {
    if (document.getElementById('crmModal')) return;
    const stageOpts = window.CRM_STAGES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
    const srcOpts = window.CRM_SOURCES.map(s => `<option value="${s}">${s}</option>`).join('');
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const inp = (id, ph, type) => `<input id="${id}" type="${type || 'text'}" placeholder="${ph || ''}" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box">`;
    const d = document.createElement('div');
    d.id = 'crmModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 id="crmModalTitle" style="margin:0;color:#1f618d;font-size:18px">🤝 فرصة جديدة</h3>
            <button onclick="crmCloseEditor()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button>
        </div>
        <input id="crmKey" type="hidden">
        ${fg('عنوان الفرصة *', inp('crmTitle', 'مثال: توريد معدات لمشروع X'))}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('اسم العميل / الشركة *', inp('crmCustomer', 'اسم العميل'))}
            ${fg('جهة الاتصال', inp('crmContact', 'اسم الشخص'))}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('الجوال', inp('crmPhone', '05xxxxxxxx', 'tel'))}
            ${fg('البريد', inp('crmEmail', 'email@example.com', 'email'))}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('القيمة المتوقعة', inp('crmValue', '0', 'number'))}
            ${fg('تاريخ الإغلاق المتوقع', inp('crmClose', '', 'date'))}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('المرحلة', `<select id="crmStage" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px">${stageOpts}</select>`)}
            ${fg('المصدر', `<select id="crmSource" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px">${srcOpts}</select>`)}
        </div>
        ${fg('ملاحظات', `<textarea id="crmNotes" rows="3" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;resize:vertical"></textarea>`)}
        <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn b-g" onclick="crmSave()" style="flex:1;font-weight:800">💾 حفظ</button>
            <button class="btn" onclick="crmCloseEditor()" style="background:#f0f0f0">إلغاء</button>
        </div>
    </div>`;
    document.body.appendChild(d);
}
window.crmOpenEditor = function (key) {
    crmEnsureModal();
    const o = key ? crmAll()[key] : null;
    document.getElementById('crmModalTitle').textContent = o ? '✏️ تعديل الفرصة' : '🤝 فرصة جديدة';
    document.getElementById('crmKey').value = key || '';
    document.getElementById('crmTitle').value = o?.title || '';
    document.getElementById('crmCustomer').value = o?.customerName || '';
    document.getElementById('crmContact').value = o?.contactName || '';
    document.getElementById('crmPhone').value = o?.phone || '';
    document.getElementById('crmEmail').value = o?.email || '';
    document.getElementById('crmValue').value = o?.value || '';
    document.getElementById('crmClose').value = o?.expectedClose || '';
    document.getElementById('crmStage').value = o?.stage || 'new';
    document.getElementById('crmSource').value = o?.source || window.CRM_SOURCES[0];
    document.getElementById('crmNotes').value = o?.notes || '';
    document.getElementById('crmModal').style.display = 'flex';
};
window.crmCloseEditor = function () { const m = document.getElementById('crmModal'); if (m) m.style.display = 'none'; };

window.crmSave = async function () {
    const key = document.getElementById('crmKey').value;
    const title = document.getElementById('crmTitle').value.trim();
    const customerName = document.getElementById('crmCustomer').value.trim();
    if (!title || !customerName) { toast('⚠️ العنوان واسم العميل مطلوبان', 'er'); return; }
    const data = {
        title, customerName,
        contactName: document.getElementById('crmContact').value.trim(),
        phone: document.getElementById('crmPhone').value.trim(),
        email: document.getElementById('crmEmail').value.trim(),
        value: parseFloat(document.getElementById('crmValue').value) || 0,
        expectedClose: document.getElementById('crmClose').value || '',
        stage: document.getElementById('crmStage').value,
        source: document.getElementById('crmSource').value,
        notes: document.getElementById('crmNotes').value.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: (window.curU && window.curU.uid) || ''
    };
    try {
        if (key) {
            await window.update(window.ref(window.db, 'ledger/crmOpportunities/' + key), data);
            toast('✓ تم تحديث الفرصة', 'ok');
        } else {
            data.status = 'open';
            data.createdAt = new Date().toISOString();
            data.createdBy = (window.curU && window.curU.uid) || '';
            await window.push(window.R.crmOpps, data);
            toast('✓ تم إضافة الفرصة', 'ok');
        }
        crmCloseEditor();
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// تغيير المرحلة من بطاقة اللوحة
window.crmSetStage = async function (key, stage) {
    try { await window.update(window.ref(window.db, 'ledger/crmOpportunities/' + key), { stage, updatedAt: new Date().toISOString() }); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

window.crmMarkWon = async function (key) {
    const o = crmAll()[key]; if (!o) return;
    if (!(await cf2(`تأكيد ربح الفرصة «${o.title}» بقيمة ${crmMoney(o.value)}؟`))) return;
    try {
        await window.update(window.ref(window.db, 'ledger/crmOpportunities/' + key), { status: 'won', wonAt: new Date().toISOString(), closedAt: new Date().toISOString() });
        toast('🏆 مبروك! فرصة مكسوبة', 'ok');
        crmCloseDetail();
        // عرض تحويل الفرصة المكسوبة إلى عميل في النظام
        if (!o.convertedCustomerKey && (await cf2(`هل تريد إضافة «${o.customerName}» إلى قائمة العملاء؟`))) crmConvertToCustomer(key);
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// تحويل فرصة مكسوبة إلى عميل في النظام
window.crmConvertToCustomer = async function (key) {
    const o = crmAll()[key]; if (!o) return;
    const existing = Object.values(window.customers || {}).find(c => (c.nameAr || '').trim() === (o.customerName || '').trim());
    if (existing) { toast('ℹ️ يوجد عميل بنفس الاسم مسبقاً', 'wn'); return; }
    const code = (typeof generateCustomerCode === 'function') ? generateCustomerCode() : ('C-' + Date.now());
    const now = new Date().toISOString();
    const cust = { code, type: 'company', nameAr: o.customerName, nameEn: '', phone: o.phone || '', email: o.email || '', vatNumber: '', crNumber: '', address: '', openingBalance: 0, paymentTerms: 30, creditLimit: 0, notes: `محوّل من فرصة CRM: ${o.title}`, active: true, createdAt: now, createdBy: (window.curU && window.curU.uid) || '' };
    try {
        const r = await window.push(window.R.cust, cust);
        await window.update(window.ref(window.db, 'ledger/crmOpportunities/' + key), { convertedCustomerKey: r.key });
        toast('✅ تم إضافة العميل من الفرصة', 'ok');
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

window.crmMarkLost = async function (key) {
    const o = crmAll()[key]; if (!o) return;
    const reason = prompt('سبب خسارة الفرصة (اختياري):', '');
    if (reason === null) return;
    try {
        await window.update(window.ref(window.db, 'ledger/crmOpportunities/' + key), { status: 'lost', lostReason: reason.trim(), lostAt: new Date().toISOString(), closedAt: new Date().toISOString() });
        toast('سُجّلت الفرصة كمخسورة', 'ok');
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

window.crmReopen = async function (key) {
    try { await window.update(window.ref(window.db, 'ledger/crmOpportunities/' + key), { status: 'open', wonAt: null, lostAt: null, closedAt: null }); toast('↩️ أُعيد فتح الفرصة', 'ok'); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

window.crmDelete = async function (key) {
    const o = crmAll()[key]; if (!o) return;
    if (!(await cf2(`حذف الفرصة «${o.title}» نهائياً؟`))) return;
    try { await window.remove(window.ref(window.db, 'ledger/crmOpportunities/' + key)); toast('🗑️ تم الحذف', 'ok'); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// ── تفاصيل الفرصة + سجل الأنشطة والمتابعات ─────────────────────────────────
function crmEnsureDetail() {
    if (document.getElementById('crmDetailModal')) return;
    const d = document.createElement('div');
    d.id = 'crmDetailModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8100;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = '<div id="crmDetailBox" style="background:#fff;border-radius:14px;max-width:600px;width:100%;max-height:92vh;overflow:auto"></div>';
    d.addEventListener('click', e => { if (e.target === d) crmCloseDetail(); });
    document.body.appendChild(d);
}
window.crmCloseDetail = function () { const m = document.getElementById('crmDetailModal'); if (m) m.style.display = 'none'; };
window.crmOpenDetail = function (key) {
    crmEnsureDetail();
    const o = crmAll()[key]; if (!o) { toast('الفرصة غير موجودة', 'er'); return; }
    window._crmDetailKey = key;
    const st = crmStageInfo(o.stage || 'new');
    const acts = Object.entries(o.activities || {}).map(([ak, a]) => ({ ak, ...a })).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    const ph = crmDigits(o.phone);
    const statusLabel = o.status === 'won' ? '<span style="background:#27ae60;color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700">🏆 مكسوبة</span>' : o.status === 'lost' ? '<span style="background:#c0392b;color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700">❌ مخسورة</span>' : `<span style="background:${st.color};color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700">${st.label}</span>`;
    const actTypeOpts = Object.entries(window.CRM_ACTIVITY_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    document.getElementById('crmDetailBox').innerHTML = `
        <div style="background:linear-gradient(135deg,#1f618d,#2d6a9f);color:#fff;padding:18px 20px;border-radius:14px 14px 0 0">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
                <div><div style="font-size:18px;font-weight:800">${crmEsc(o.title)}</div><div style="font-size:13px;opacity:.9;margin-top:3px">🏢 ${crmEsc(o.customerName)}${o.contactName ? ' · ' + crmEsc(o.contactName) : ''}</div></div>
                <button onclick="crmCloseDetail()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer">×</button>
            </div>
            <div style="display:flex;gap:12px;align-items:center;margin-top:10px;flex-wrap:wrap">${statusLabel}<span style="font-size:18px;font-weight:800">${crmMoney(o.value)}</span>${o.expectedClose ? `<span style="font-size:12px;opacity:.9">📅 إغلاق متوقع: ${o.expectedClose}</span>` : ''}</div>
        </div>
        <div style="padding:18px 20px">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
                ${o.phone ? `<a href="tel:${crmEsc(o.phone)}" style="text-decoration:none;background:#eafaf1;color:#27ae60;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px">📞 اتصال</a>` : ''}
                ${ph ? `<a href="https://wa.me/${ph}" target="_blank" style="text-decoration:none;background:#e8f8ef;color:#1da851;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px">💬 واتساب</a>` : ''}
                ${o.email ? `<a href="mailto:${crmEsc(o.email)}" style="text-decoration:none;background:#eef3fb;color:#2980b9;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px">📧 بريد</a>` : ''}
            </div>
            <div style="background:#f8fafc;border-radius:8px;padding:12px;font-size:13px;line-height:1.9;margin-bottom:16px">
                ${o.phone ? `<div>📞 ${crmEsc(o.phone)}</div>` : ''}${o.email ? `<div>📧 ${crmEsc(o.email)}</div>` : ''}${o.source ? `<div>🔗 المصدر: ${crmEsc(o.source)}</div>` : ''}${o.nextFollowUp ? `<div>🔔 المتابعة القادمة: <strong>${o.nextFollowUp}</strong></div>` : ''}${o.notes ? `<div style="margin-top:6px;color:#555">📝 ${crmEsc(o.notes)}</div>` : ''}${(!o.phone && !o.email && !o.source && !o.notes && !o.nextFollowUp) ? '<span style="color:#aaa">لا توجد تفاصيل إضافية</span>' : ''}
            </div>
            ${o.status === 'open' ? `<div style="background:#fff;border:1.5px solid #e8edf2;border-radius:10px;padding:12px;margin-bottom:16px">
                <div style="font-weight:800;color:#1a3a5c;font-size:13px;margin-bottom:8px">➕ تسجيل نشاط / متابعة</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
                    <select id="crmActType" style="padding:8px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px">${actTypeOpts}</select>
                    <input id="crmActFollow" type="date" title="موعد المتابعة القادمة (اختياري)" style="padding:8px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px">
                </div>
                <textarea id="crmActNote" rows="2" placeholder="تفاصيل النشاط..." style="width:100%;padding:8px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;resize:vertical"></textarea>
                <button class="btn b-g" onclick="crmAddActivity('${key}')" style="margin-top:8px;font-weight:700">💾 إضافة النشاط</button>
            </div>` : ''}
            <div style="font-weight:800;color:#1a3a5c;font-size:13px;margin-bottom:10px">📜 سجل الأنشطة (${acts.length})</div>
            <div style="border-inline-start:2px solid #e8edf2;padding-inline-start:14px">
                ${acts.map(a => `<div style="margin-bottom:12px">
                    <div style="font-size:13px;font-weight:700;color:#1a3a5c">${window.CRM_ACTIVITY_TYPES[a.type] || a.type}</div>
                    ${a.note ? `<div style="font-size:12.5px;color:#555;margin-top:2px">${crmEsc(a.note)}</div>` : ''}
                    <div style="font-size:11px;color:#999;margin-top:2px">${crmEsc(a.byName || '')} · ${a.at ? new Date(a.at).toLocaleString('ar') : ''}${a.followUp ? ' · 🔔 متابعة: ' + a.followUp : ''}</div>
                </div>`).join('') || '<div style="color:#bbb;font-size:12px">لا توجد أنشطة بعد — سجّل أول مكالمة أو متابعة</div>'}
            </div>
            <div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">
                <button class="btn" onclick="crmOpenEditor('${key}')" style="background:#f0f5fa">✏️ تعديل</button>
                ${o.status === 'open' ? `<button class="btn b-g" onclick="crmMarkWon('${key}')">🏆 ربح</button><button class="btn b-o" onclick="crmMarkLost('${key}')">❌ خسارة</button>` : `<button class="btn" onclick="crmReopen('${key}')" style="background:#f0f5fa">↩️ إعادة فتح</button>`}
                <button class="btn b-r" onclick="crmDelete('${key}')" style="margin-inline-start:auto">🗑️ حذف</button>
            </div>
        </div>`;
    document.getElementById('crmDetailModal').style.display = 'flex';
};
window.crmAddActivity = async function (key) {
    const type = document.getElementById('crmActType').value;
    const note = document.getElementById('crmActNote').value.trim();
    const followUp = document.getElementById('crmActFollow').value || '';
    if (!note && !followUp) { toast('⚠️ اكتب تفاصيل النشاط أو حدّد موعد متابعة', 'er'); return; }
    const act = { at: new Date().toISOString(), by: (window.curU && window.curU.uid) || '', byName: (window.myP && window.myP.name) || (window.curU && window.curU.email) || '', type, note };
    if (followUp) act.followUp = followUp;
    try {
        await window.push(window.ref(window.db, 'ledger/crmOpportunities/' + key + '/activities'), act);
        const upd = { updatedAt: new Date().toISOString() };
        if (followUp) upd.nextFollowUp = followUp;
        await window.update(window.ref(window.db, 'ledger/crmOpportunities/' + key), upd);
        toast('✓ سُجّل النشاط', 'ok');
        setTimeout(() => { if (document.getElementById('crmDetailModal')?.style.display === 'flex') crmOpenDetail(key); }, 200);
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// ── ودجت CRM في لوحة التحكم الرئيسية: ملخص خط الأنابيب + متابعات اليوم ───────
window.renderCRMWidget = function () {
    const el = document.getElementById('crmHomeWidget'); if (!el) return;
    const canView = (window.myP && window.myP.role === 'admin') || (typeof window.can === 'function' && window.can('view_customers'));
    const open = Object.entries(window.crmOpportunities || {}).map(([k, o]) => ({ k, ...o })).filter(o => (o.status || 'open') === 'open');
    if (!canView || !open.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    const openValue = open.reduce((s, o) => s + (parseFloat(o.value) || 0), 0);
    const weighted = open.reduce((s, o) => s + (parseFloat(o.value) || 0) * ((window.CRM_STAGE_PROB[o.stage || 'new'] || 0) / 100), 0);
    const today = crmToday();
    const due = open.filter(o => o.nextFollowUp && o.nextFollowUp <= today).sort((a, b) => (a.nextFollowUp || '').localeCompare(b.nextFollowUp || ''));
    const stageRow = window.CRM_STAGES.map(s => { const c = open.filter(o => (o.stage || 'new') === s.id).length; return `<div style="flex:1;text-align:center"><div style="font-size:18px;font-weight:800;color:${s.color}">${c}</div><div style="font-size:10px;color:#888">${s.label}</div></div>`; }).join('');
    el.innerHTML = `<div style="background:#fff;border:1.5px solid #eef0f3;border-radius:14px;padding:16px 20px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
            <div style="font-size:15px;font-weight:800;color:#1a3a5c">🤝 خط أنابيب المبيعات (CRM)</div>
            <button class="btn b-b" style="padding:6px 12px;font-size:12px" onclick="nav('crm',document.getElementById('n-crm'))">فتح CRM ←</button>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px">
            <div style="flex:1;min-width:120px;background:#f4f8fb;border-radius:10px;padding:10px 14px"><div style="font-size:11px;color:#888">فرص مفتوحة</div><div style="font-size:20px;font-weight:800;color:#3498db">${open.length}</div></div>
            <div style="flex:1;min-width:120px;background:#eafaf1;border-radius:10px;padding:10px 14px"><div style="font-size:11px;color:#888">قيمة خط الأنابيب</div><div style="font-size:20px;font-weight:800;color:#16a085">${crmMoney(openValue)}</div></div>
            <div style="flex:1;min-width:120px;background:#eef3fb;border-radius:10px;padding:10px 14px"><div style="font-size:11px;color:#888">القيمة المرجّحة</div><div style="font-size:20px;font-weight:800;color:#2980b9">${crmMoney(weighted)}</div></div>
        </div>
        <div style="display:flex;gap:6px;background:#f8fafc;border-radius:10px;padding:10px;margin-bottom:12px">${stageRow}</div>
        <div style="font-size:13px;font-weight:800;color:#1a3a5c;margin-bottom:8px">🔔 متابعات مستحقة (${due.length})</div>
        ${due.length ? due.slice(0, 5).map(o => {
            const overdue = o.nextFollowUp < today;
            return `<div onclick="crmOpenDetail('${o.k}')" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid #f3f3f3;cursor:pointer" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <div><strong style="font-size:13px;color:#1a3a5c">${crmEsc(o.title)}</strong><div style="font-size:11px;color:#888">🏢 ${crmEsc(o.customerName)}</div></div>
                <span style="font-size:11px;font-weight:700;color:${overdue ? '#e74c3c' : '#e67e22'};white-space:nowrap">${overdue ? '⏰ متأخرة' : '🔔 اليوم'}</span>
            </div>`; }).join('') + (due.length > 5 ? `<div style="text-align:center;font-size:11px;color:#888;padding:6px">+${due.length - 5} أخرى</div>` : '') : '<div style="color:#aaa;font-size:12px;padding:6px">لا متابعات مستحقة اليوم 🎉</div>'}
    </div>`;
};

// شارة المتابعات المستحقة على عنصر القائمة الجانبية
window.updateCRMBadge = function () {
    const b = document.getElementById('crmBadge'); if (!b) return;
    const today = crmToday();
    const n = Object.values(window.crmOpportunities || {}).filter(o => (o.status || 'open') === 'open' && o.nextFollowUp && o.nextFollowUp <= today).length;
    if (n) { b.textContent = n; b.style.display = ''; } else b.style.display = 'none';
};

console.log('✅ CRM module loaded');
