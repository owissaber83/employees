// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ⏱️  تسجيل الأوقات (Timesheets) — ساعات العمل على المشاريع/المهام            ║
// ║  وحدة ثانوية تعتمد على globals من app.js. بياناتها تُعزَل تلقائياً للمستأجر.   ║
// ║  تكلفة الساعة تُشتق من راتب الموظف الإجمالي ÷ ساعات العمل الشهرية القياسية.   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

window.TS_MONTHLY_HOURS = 208; // 26 يوم × 8 ساعات — أساس اشتقاق تكلفة الساعة (قابلة للتعديل لكل إدخال)

function tsMoney(v) { return (typeof fmt === 'function') ? fmt(Number(v) || 0) : (Number(v) || 0).toLocaleString('en'); }
function tsEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function tsAll() { return window.timesheets || {}; }
function tsEmpName(id) { const e = (window.emp || {})[id]; return e ? (e.name || '—') : '—'; }
function tsPrjName(id) { const p = (window.projects || {})[id]; return p ? (p.name || '—') : '—'; }
// الراتب الإجمالي (أساسي + بدلات) لاشتقاق تكلفة الساعة
function tsEmpGross(e) { if (!e) return 0; return (parseFloat(e.salary) || 0) + (parseFloat(e.houseAllow) || 0) + (parseFloat(e.transAllow) || 0) + (parseFloat(e.phoneAllow) || 0) + (parseFloat(e.natureAllow) || 0) + (parseFloat(e.repAllow) || 0); }
window.tsEmpRate = function (empId) { const g = tsEmpGross((window.emp || {})[empId]); return g > 0 ? Math.round((g / window.TS_MONTHLY_HOURS) * 100) / 100 : 0; };

function tsDefaultFilter() {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), emp: '', project: '' };
}

// ── الصفحة الرئيسية ─────────────────────────────────────────────────────────
window.renderTimesheets = function () {
    const c = document.getElementById('pg-timesheets'); if (!c) return;
    window._tsFilter = window._tsFilter || tsDefaultFilter();
    const f = window._tsFilter;
    const rows = Object.entries(tsAll()).map(([k, t]) => ({ k, ...t }))
        .filter(t => (!f.from || (t.date || '') >= f.from) && (!f.to || (t.date || '') <= f.to) && (!f.emp || t.employeeId === f.emp) && (!f.project || t.projectId === f.project))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const totalHours = rows.reduce((s, t) => s + (parseFloat(t.hours) || 0), 0);
    const totalCost = rows.reduce((s, t) => s + (parseFloat(t.cost) || 0), 0);
    const billHours = rows.filter(t => t.billable).reduce((s, t) => s + (parseFloat(t.hours) || 0), 0);

    const empOpts = Object.entries(window.emp || {}).filter(([, e]) => e.active !== false).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar')).map(([k, e]) => `<option value="${k}" ${f.emp === k ? 'selected' : ''}>${tsEsc(e.name)}</option>`).join('');
    const prjOpts = Object.entries(window.projects || {}).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar')).map(([k, p]) => `<option value="${k}" ${f.project === k ? 'selected' : ''}>${tsEsc(p.name)}</option>`).join('');
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">⏱️ تسجيل الأوقات</div>
            <div style="display:flex;gap:8px"><button class="btn" onclick="tsExportExcel()" style="background:#f0f5fa;border:1.5px solid #d0d7e0">📊 Excel</button><button class="btn b-g" onclick="tsOpenEditor()" style="font-weight:800">➕ تسجيل وقت</button></div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('⏱️', 'إجمالي الساعات', totalHours.toFixed(1), '#2980b9')}
            ${kpi('💰', 'تكلفة العمالة', tsMoney(totalCost), '#16a085')}
            ${kpi('🧾', 'ساعات قابلة للفوترة', billHours.toFixed(1), '#8e44ad')}
            ${kpi('📋', 'عدد الإدخالات', rows.length, '#e67e22')}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;background:#fff;padding:12px 14px;border-radius:10px;margin-bottom:14px">
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">من تاريخ</label><input type="date" value="${f.from}" onchange="window._tsFilter.from=this.value;renderTimesheets()" style="padding:7px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px"></div>
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">إلى تاريخ</label><input type="date" value="${f.to}" onchange="window._tsFilter.to=this.value;renderTimesheets()" style="padding:7px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px"></div>
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">الموظف</label><select onchange="window._tsFilter.emp=this.value;renderTimesheets()" style="padding:7px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px"><option value="">الكل</option>${empOpts}</select></div>
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">المشروع</label><select onchange="window._tsFilter.project=this.value;renderTimesheets()" style="padding:7px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px"><option value="">الكل</option>${prjOpts}</select></div>
            <button class="btn" onclick="window._tsFilter=null;renderTimesheets()" style="background:#f0f0f0">↺ إعادة ضبط</button>
        </div>
        <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <thead><tr style="background:#f4f6f9;color:#555">
                    <th style="padding:9px;text-align:right">التاريخ</th><th style="text-align:right">الموظف</th><th style="text-align:right">المشروع</th><th style="text-align:right">المهمة</th><th>الساعات</th><th>تكلفة الساعة</th><th>التكلفة</th><th>فوترة</th><th></th>
                </tr></thead>
                <tbody>${rows.length ? rows.map(t => `<tr style="border-bottom:1px solid #f3f3f3">
                    <td style="padding:8px 9px;white-space:nowrap">${t.date || '—'}</td>
                    <td>${tsEsc(t.employeeName || tsEmpName(t.employeeId))}</td>
                    <td>${tsEsc(t.projectName || tsPrjName(t.projectId))}</td>
                    <td style="color:#666">${tsEsc(t.taskTitle || '—')}</td>
                    <td style="text-align:center;font-weight:700">${(parseFloat(t.hours) || 0).toFixed(1)}</td>
                    <td style="text-align:center;color:#888">${tsMoney(t.hourlyRate)}</td>
                    <td style="text-align:center;font-weight:700;color:#16a085">${tsMoney(t.cost)}</td>
                    <td style="text-align:center">${t.billable ? '✅' : '—'}</td>
                    <td style="text-align:left;white-space:nowrap"><button class="btn" onclick="tsOpenEditor('${t.k}')" style="font-size:11px;padding:3px 7px">✏️</button> <button class="btn b-r" onclick="tsDelete('${t.k}')" style="font-size:11px;padding:3px 7px">🗑️</button></td>
                </tr>${t.description ? `<tr><td colspan="9" style="padding:0 9px 8px;color:#999;font-size:11px">📝 ${tsEsc(t.description)}</td></tr>` : ''}`).join('') : '<tr><td colspan="9" style="text-align:center;color:#aaa;padding:24px">لا توجد إدخالات في هذه الفترة</td></tr>'}</tbody>
            </table>
        </div>
    </div>`;
};

// ── المُحرّر ─────────────────────────────────────────────────────────────────
function tsEnsureModal() {
    if (document.getElementById('tsModal')) return;
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const d = document.createElement('div');
    d.id = 'tsModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 id="tsModalTitle" style="margin:0;color:#2d6a9f;font-size:18px">⏱️ تسجيل وقت</h3><button onclick="tsCloseEditor()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <input id="tsKey" type="hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('التاريخ *', '<input id="tsDate" type="date" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box">')}
            ${fg('الساعات *', '<input id="tsHours" type="number" step="0.25" min="0" placeholder="8" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box">')}
        </div>
        ${fg('الموظف *', '<select id="tsEmp" onchange="tsOnEmpChange()" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px"></select>')}
        ${fg('المشروع *', '<select id="tsPrj" onchange="tsPopulateTasks()" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px"></select>')}
        ${fg('المهمة (اختياري)', '<select id="tsTask" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px"></select>')}
        ${fg('تكلفة الساعة (تُحتسب تلقائياً من الراتب)', '<input id="tsRate" type="number" step="0.01" min="0" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box">')}
        ${fg('الوصف', '<textarea id="tsDesc" rows="2" placeholder="ماذا أنجزت..." style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;resize:vertical"></textarea>')}
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:14px;cursor:pointer"><input id="tsBillable" type="checkbox"> ساعات قابلة للفوترة على العميل</label>
        <div style="display:flex;gap:8px"><button class="btn b-g" onclick="tsSave()" style="flex:1;font-weight:800">💾 حفظ</button><button class="btn" onclick="tsCloseEditor()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.tsCloseEditor = function () { const m = document.getElementById('tsModal'); if (m) m.style.display = 'none'; };
window.tsPopulateTasks = function (selected) {
    const pid = document.getElementById('tsPrj').value;
    const tasks = (window.projectTasks || {})[pid] || {};
    const opts = ['<option value="">— بدون مهمة —</option>'].concat(Object.entries(tasks).map(([k, t]) => `<option value="${k}" ${selected === k ? 'selected' : ''}>${tsEsc(t.title || k)}</option>`));
    document.getElementById('tsTask').innerHTML = opts.join('');
};
window.tsOnEmpChange = function () {
    const rate = window.tsEmpRate(document.getElementById('tsEmp').value);
    if (rate) document.getElementById('tsRate').value = rate;
};
window.tsOpenEditor = function (key, presetProject) {
    tsEnsureModal();
    const t = key ? tsAll()[key] : null;
    document.getElementById('tsModalTitle').textContent = t ? '✏️ تعديل وقت مسجّل' : '⏱️ تسجيل وقت';
    document.getElementById('tsKey').value = key || '';
    // قوائم الموظفين والمشاريع
    const emps = Object.entries(window.emp || {}).filter(([, e]) => e.active !== false).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'));
    document.getElementById('tsEmp').innerHTML = '<option value="">— اختر —</option>' + emps.map(([k, e]) => `<option value="${k}">${tsEsc(e.name)}</option>`).join('');
    const prjs = Object.entries(window.projects || {}).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'));
    document.getElementById('tsPrj').innerHTML = '<option value="">— اختر —</option>' + prjs.map(([k, p]) => `<option value="${k}">${tsEsc(p.name)}</option>`).join('');
    document.getElementById('tsDate').value = t?.date || new Date().toISOString().slice(0, 10);
    document.getElementById('tsHours').value = t?.hours ?? '';
    document.getElementById('tsEmp').value = t?.employeeId || '';
    document.getElementById('tsPrj').value = t?.projectId || presetProject || '';
    tsPopulateTasks(t?.taskKey);
    document.getElementById('tsRate').value = t?.hourlyRate ?? (t?.employeeId ? window.tsEmpRate(t.employeeId) : '');
    document.getElementById('tsDesc').value = t?.description || '';
    document.getElementById('tsBillable').checked = !!t?.billable;
    document.getElementById('tsModal').style.display = 'flex';
};
window.tsSave = async function () {
    const key = document.getElementById('tsKey').value;
    const employeeId = document.getElementById('tsEmp').value;
    const projectId = document.getElementById('tsPrj').value;
    const date = document.getElementById('tsDate').value;
    const hours = parseFloat(document.getElementById('tsHours').value) || 0;
    if (!date || !employeeId || !projectId || hours <= 0) { toast('⚠️ التاريخ والموظف والمشروع والساعات مطلوبة', 'er'); return; }
    const hourlyRate = parseFloat(document.getElementById('tsRate').value) || 0;
    const taskKey = document.getElementById('tsTask').value || '';
    const tasks = (window.projectTasks || {})[projectId] || {};
    const data = {
        date, employeeId, employeeName: tsEmpName(employeeId), projectId, projectName: tsPrjName(projectId),
        taskKey, taskTitle: taskKey ? (tasks[taskKey]?.title || '') : '',
        hours, hourlyRate, cost: Math.round(hours * hourlyRate * 100) / 100,
        billable: document.getElementById('tsBillable').checked,
        description: document.getElementById('tsDesc').value.trim(),
        updatedAt: new Date().toISOString(), updatedBy: (window.curU && window.curU.uid) || ''
    };
    try {
        if (key) { await window.update(window.ref(window.db, 'ledger/timesheets/' + key), data); toast('✓ تم التحديث', 'ok'); }
        else { data.createdAt = new Date().toISOString(); data.createdBy = (window.curU && window.curU.uid) || ''; await window.push(window.R.timesheets, data); toast('✓ سُجّل الوقت', 'ok'); }
        tsCloseEditor();
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.tsDelete = async function (key) {
    if (!(await cf2('حذف هذا الإدخال؟'))) return;
    try { await window.remove(window.ref(window.db, 'ledger/timesheets/' + key)); toast('🗑️ تم الحذف', 'ok'); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.tsExportExcel = function () {
    const f = window._tsFilter || tsDefaultFilter();
    const rows = Object.values(tsAll()).filter(t => (!f.from || (t.date || '') >= f.from) && (!f.to || (t.date || '') <= f.to) && (!f.emp || t.employeeId === f.emp) && (!f.project || t.projectId === f.project)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (!rows.length) { toast('⚠️ لا بيانات للتصدير', 'er'); return; }
    if (typeof XLSX === 'undefined') { toast('⚠️ مكتبة Excel غير محمّلة', 'er'); return; }
    const data = rows.map(t => ({ 'التاريخ': t.date || '', 'الموظف': t.employeeName || tsEmpName(t.employeeId), 'المشروع': t.projectName || tsPrjName(t.projectId), 'المهمة': t.taskTitle || '', 'الساعات': parseFloat(t.hours) || 0, 'تكلفة الساعة': parseFloat(t.hourlyRate) || 0, 'التكلفة': parseFloat(t.cost) || 0, 'قابل للفوترة': t.billable ? 'نعم' : 'لا', 'الوصف': t.description || '' }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأوقات'); XLSX.writeFile(wb, `الأوقات_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('✅ تم التصدير', 'ok');
};

// ── تبويب الأوقات في ملف المشروع ────────────────────────────────────────────
window.tsProjectData = function (pid) {
    const rows = Object.values(tsAll()).filter(t => t.projectId === pid);
    const hours = rows.reduce((s, t) => s + (parseFloat(t.hours) || 0), 0);
    const cost = rows.reduce((s, t) => s + (parseFloat(t.cost) || 0), 0);
    return { rows, hours, cost };
};
window.pdRenderTimesheets = function (pid) {
    const pane = document.getElementById('pd-tab-timesheets'); if (!pane) return;
    const { rows, hours, cost } = window.tsProjectData(pid);
    // تجميع حسب الموظف
    const byEmp = {};
    rows.forEach(t => { const id = t.employeeId; byEmp[id] = byEmp[id] || { name: t.employeeName || tsEmpName(id), hours: 0, cost: 0 }; byEmp[id].hours += parseFloat(t.hours) || 0; byEmp[id].cost += parseFloat(t.cost) || 0; });
    const empRows = Object.values(byEmp).sort((a, b) => b.cost - a.cost);
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;
    pane.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:15px;font-weight:800;color:#1a3a5c">⏱️ الأوقات المسجّلة على المشروع</div>
            <button class="btn b-g" onclick="tsOpenEditor('', '${pid}')">➕ تسجيل وقت لهذا المشروع</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
            ${kpi('⏱️', 'إجمالي الساعات', hours.toFixed(1), '#2980b9')}
            ${kpi('💰', 'تكلفة العمالة الفعلية', tsMoney(cost), '#16a085')}
            ${kpi('👷', 'عدد العاملين', empRows.length, '#e67e22')}
        </div>
        <div style="background:#eaf4fb;border-radius:10px;padding:12px 16px;font-size:12.5px;color:#2d6a9f;margin-bottom:14px">💡 هذه تكلفة العمالة محسوبة من <strong>ساعات العمل الفعلية</strong>. ملاحظة: تكلفة العمالة في تحليل الأداء (EVM) تُحتسب حالياً من الرواتب الموزّعة على المشروع؛ يمكن لاحقاً اعتماد التايم شيت كمصدر بديل لتكلفة العمالة لتفادي الازدواج.</div>
        <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#f4f6f9;color:#555"><th style="padding:9px;text-align:right">الموظف</th><th>الساعات</th><th style="text-align:left;padding-left:16px">التكلفة</th></tr></thead>
                <tbody>${empRows.length ? empRows.map(e => `<tr style="border-bottom:1px solid #f3f3f3"><td style="padding:9px">${tsEsc(e.name)}</td><td style="text-align:center;font-weight:700">${e.hours.toFixed(1)}</td><td style="text-align:left;padding-left:16px;font-weight:700;color:#16a085">${tsMoney(e.cost)}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center;color:#aaa;padding:24px">لا أوقات مسجّلة لهذا المشروع بعد</td></tr>'}</tbody>
            </table>
        </div>`;
};

// ── 👥 عبء العمل والموارد (Resource Workload) ───────────────────────────────
// ساعات العمل المتاحة في الفترة (باستثناء الجمعة والسبت) × 8 ساعات/يوم
function wlWorkHours(from, to) {
    let d = new Date(from), end = new Date(to), days = 0;
    if (isNaN(d) || isNaN(end) || d > end) return 0;
    while (d <= end) { const wd = d.getDay(); if (wd !== 5 && wd !== 6) days++; d.setDate(d.getDate() + 1); }
    return days * 8;
}
window.renderWorkload = function () {
    const c = document.getElementById('pg-workload'); if (!c) return;
    const now = new Date();
    window._wlPeriod = window._wlPeriod || { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
    const f = window._wlPeriod;
    const today = new Date().toISOString().slice(0, 10);
    const cap = wlWorkHours(f.from, f.to);
    // المهام المفتوحة لكل موظف عبر كل المشاريع
    const tByEmp = {};
    Object.entries(window.projectTasks || {}).forEach(([pid, tasks]) => {
        Object.entries(tasks || {}).forEach(([tk, t]) => { if (t.assigneeId && t.status !== 'done') { (tByEmp[t.assigneeId] = tByEmp[t.assigneeId] || []).push({ pid, tk, ...t }); } });
    });
    // الساعات المسجّلة في الفترة لكل موظف
    const hByEmp = {};
    Object.values(window.timesheets || {}).forEach(ts => { if ((ts.date || '') >= f.from && (ts.date || '') <= f.to) hByEmp[ts.employeeId] = (hByEmp[ts.employeeId] || 0) + (parseFloat(ts.hours) || 0); });
    let rows = Object.entries(window.emp || {}).filter(([, e]) => e.active !== false).map(([id, e]) => {
        const ts = (tByEmp[id] || []).sort((a, b) => (a.dueDate || 'zzz').localeCompare(b.dueDate || 'zzz'));
        const overdue = ts.filter(t => t.dueDate && t.dueDate < today).length;
        const logged = hByEmp[id] || 0;
        const util = cap > 0 ? Math.round(logged / cap * 100) : 0;
        return { id, name: e.name || '—', openTasks: ts.length, overdue, logged, util, tasks: ts };
    });
    rows.sort((a, b) => (b.openTasks - a.openTasks) || (b.util - a.util));
    const overloaded = rows.filter(r => r.util > 100).length;
    const idle = rows.filter(r => r.openTasks === 0 && r.logged === 0).length;
    const totalLogged = rows.reduce((s, r) => s + r.logged, 0);
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;
    const utilColor = u => u > 100 ? '#c0392b' : u > 75 ? '#e67e22' : u > 0 ? '#27ae60' : '#95a5a6';

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">👥 عبء العمل والموارد</div>
            <div style="display:flex;gap:8px;align-items:end">
                <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">من</label><input type="date" value="${f.from}" onchange="window._wlPeriod.from=this.value;renderWorkload()" style="padding:7px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px"></div>
                <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">إلى</label><input type="date" value="${f.to}" onchange="window._wlPeriod.to=this.value;renderWorkload()" style="padding:7px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px"></div>
            </div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
            ${kpi('👷', 'الموظفون النشطون', rows.length, '#2980b9')}
            ${kpi('🔴', 'متجاوزون الطاقة', overloaded, overloaded ? '#c0392b' : '#95a5a6')}
            ${kpi('💤', 'متفرّغون (بلا تكليف)', idle, '#7f8c8d')}
            ${kpi('⏱️', 'إجمالي الساعات المسجّلة', totalLogged.toFixed(0) + ` / ${cap}`, '#16a085')}
        </div>
        <div style="font-size:11px;color:#999;margin-bottom:14px">💡 الطاقة المتاحة في الفترة = ${cap} ساعة (أيام العمل ما عدا الجمعة/السبت × 8 ساعات). نسبة الاستغلال = الساعات المسجّلة ÷ الطاقة.</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
        ${rows.length ? rows.map(r => {
            const barW = Math.min(100, r.util);
            return `<div style="background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.05)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <div style="font-weight:800;color:#1a3a5c;font-size:14px">${tsEsc(r.name)}</div>
                    <span style="background:${utilColor(r.util)};color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:800">${r.util}%${r.util > 100 ? ' ⚠️' : ''}</span>
                </div>
                <div style="background:#eef1f5;border-radius:6px;height:8px;overflow:hidden;margin-bottom:10px"><div style="width:${barW}%;background:${utilColor(r.util)};height:100%"></div></div>
                <div style="display:flex;gap:12px;font-size:12px;color:#555;margin-bottom:10px;flex-wrap:wrap">
                    <span>📋 <strong>${r.openTasks}</strong> مهمة مفتوحة</span>
                    ${r.overdue ? `<span style="color:#c0392b">⏰ <strong>${r.overdue}</strong> متأخرة</span>` : ''}
                    <span>⏱️ <strong>${r.logged.toFixed(1)}</strong> / ${cap} ساعة</span>
                </div>
                ${r.tasks.length ? `<div style="border-top:1px solid #f3f3f3;padding-top:8px">${r.tasks.slice(0, 4).map(t => {
                    const od = t.dueDate && t.dueDate < today;
                    return `<div onclick="nav('projects');setTimeout(()=>window.openProjectDetail&&window.openProjectDetail('${t.pid}'),200)" title="فتح ملف المشروع" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;font-size:12px;cursor:pointer">
                        <span style="color:#1a3a5c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tsEsc(t.title || '—')} <span style="color:#aaa">· ${tsEsc(tsPrjName(t.pid))}</span></span>
                        <span style="color:${od ? '#c0392b' : '#888'};white-space:nowrap;font-size:11px">${t.dueDate || '—'}${od ? ' ⚠️' : ''}</span>
                    </div>`;
                }).join('')}${r.tasks.length > 4 ? `<div style="font-size:11px;color:#888;padding-top:4px">+${r.tasks.length - 4} مهمة أخرى</div>` : ''}</div>` : '<div style="color:#aaa;font-size:12px;border-top:1px solid #f3f3f3;padding-top:8px">لا مهام مكلّف بها 💤</div>'}
            </div>`;
        }).join('') : '<div style="text-align:center;color:#aaa;padding:30px">لا يوجد موظفون نشطون</div>'}
        </div>
    </div>`;
};

console.log('✅ Timesheets module loaded');
