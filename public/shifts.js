// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🕗  الورديات والجداول (Shifts / Rostering) + قواعد التأخير                  ║
// ║  وحدة ثانوية تعتمد على globals من app.js. بياناتها تُعزَل تلقائياً للمستأجر.   ║
// ║  تحليل الالتزام يقارن وقت الحضور الفعلي بوقت بداية الوردية + دقائق السماح.     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const SH_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']; // index = getDay()
const SH_DEFAULT_WORKDAYS = [0, 1, 2, 3, 4]; // الأحد–الخميس

function shEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function shAll() { return window.shifts || {}; }
function shRoster() { return window.roster || {}; }
function shEmpName(id) { const e = (window.emp || {})[id]; return e ? (e.name || '—') : '—'; }
function shInp() { return 'padding:8px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box'; }
function shMins(hhmm) { if (!hhmm || hhmm.indexOf(':') < 0) return null; const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function shFmtMins(t) { if (t == null) return '—'; const h = Math.floor(t / 60), m = t % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
function shEmpShiftId(empKey) { const r = shRoster()[empKey]; return r && r.shiftId ? r.shiftId : ''; }

// ── الصفحة الرئيسية (تبويبات) ────────────────────────────────────────────────
window.renderShifts = function () {
    const c = document.getElementById('pg-shifts'); if (!c) return;
    window._shTab = window._shTab || 'defs';
    const tab = window._shTab;
    const tabBtn = (id, label) => `<button onclick="window._shTab='${id}';renderShifts()" style="background:${tab === id ? '#16679a' : '#eef2f7'};color:${tab === id ? '#fff' : '#555'};border:none;padding:9px 18px;border-radius:9px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer">${label}</button>`;
    const shifts = Object.values(shAll());
    const emps = Object.values(window.emp || {}).filter(e => (e.status || 'active') === 'active');
    let assignedCount = 0; Object.keys(window.emp || {}).forEach(k => { if ((window.emp[k].status || 'active') === 'active' && shEmpShiftId(k)) assignedCount++; });
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">🕗 الورديات والجداول</div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('🕗', 'عدد الورديات', shifts.length, '#2980b9')}
            ${kpi('👥', 'موظفون مُسنَدون', assignedCount, '#16a085')}
            ${kpi('❔', 'بلا وردية', emps.length - assignedCount, (emps.length - assignedCount) ? '#e67e22' : '#95a5a6')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
            ${tabBtn('defs', '🕗 تعريف الورديات')}
            ${tabBtn('assign', '👥 إسناد الموظفين')}
            ${tabBtn('compliance', '📊 تحليل الالتزام')}
        </div>
        <div id="shTabBody"></div>
    </div>`;
    if (tab === 'defs') shRenderDefs();
    else if (tab === 'assign') shRenderAssign();
    else shRenderCompliance();
};

// ── تبويب تعريف الورديات ─────────────────────────────────────────────────────
function shRenderDefs() {
    const body = document.getElementById('shTabBody'); if (!body) return;
    const rows = Object.entries(shAll()).map(([k, s]) => ({ k, ...s }));
    let cntByShift = {}; Object.keys(window.emp || {}).forEach(ek => { const sid = shEmpShiftId(ek); if (sid) cntByShift[sid] = (cntByShift[sid] || 0) + 1; });
    body.innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn b-g" onclick="shOpenShift()" style="font-weight:800">➕ إضافة وردية</button></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
        ${rows.length ? rows.map(s => {
        const col = s.color || '#2980b9';
        const days = (s.workDays || SH_DEFAULT_WORKDAYS).map(d => SH_DAYS[d]?.slice(0, 3)).join(' · ');
        return `<div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden;border-top:3px solid ${col}">
            <div style="padding:12px 14px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center">
                <div style="font-weight:800;color:${col};font-size:14px">🕗 ${shEsc(s.name)}</div>
                <div style="white-space:nowrap"><button class="btn" onclick="shOpenShift('${s.k}')" style="font-size:11px;padding:3px 7px">✏️</button> <button class="btn b-r" onclick="shDeleteShift('${s.k}')" style="font-size:11px;padding:3px 7px">🗑️</button></div>
            </div>
            <div style="padding:12px 14px;font-size:12.5px;color:#555;line-height:1.9">
                ⏰ <b>${s.startTime || '—'}</b> ← <b>${s.endTime || '—'}</b>${s.breakMins ? ` · استراحة ${s.breakMins}د` : ''}<br>
                🟢 سماح تأخير: <b>${s.graceMins || 0}</b> دقيقة<br>
                🎛️ نافذة الحضور: <b>${s.openBefore ?? 30}د</b> قبل ← <b>${s.lateLimit ?? 120}د</b> بعد · خروج حتى <b>${s.closeOut ?? 120}د</b> بعد النهاية<br>
                ⏱️ الإضافي: <b>${s.otAllowed ? (s.otAfter ? `بعد ${s.otAfter}د` : 'مسموح') : 'غير مسموح'}</b><br>
                📅 ${days}<br>
                👥 مُسنَد إليها: <b>${cntByShift[s.k] || 0}</b> موظف
            </div>
        </div>`;
    }).join('') : '<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:24px">لا ورديات — أضف أول وردية (صباحية/مسائية...)</div>'}
        </div>`;
}
window.shOpenShift = function (key) {
    shEnsureShiftModal();
    const s = key ? shAll()[key] : null;
    document.getElementById('shKey').value = key || '';
    document.getElementById('shModalTitle').textContent = s ? '✏️ تعديل وردية' : '🕗 إضافة وردية';
    document.getElementById('shName').value = s?.name || '';
    document.getElementById('shStart').value = s?.startTime || '08:00';
    document.getElementById('shEnd').value = s?.endTime || '17:00';
    document.getElementById('shBreak').value = s?.breakMins ?? 60;
    document.getElementById('shGrace').value = s?.graceMins ?? 15;
    document.getElementById('shColor').value = s?.color || '#2980b9';
    document.getElementById('shOpenBefore').value = s?.openBefore ?? 30;
    document.getElementById('shLateLimit').value = s?.lateLimit ?? 120;
    document.getElementById('shCloseOut').value = s?.closeOut ?? 120;
    const otOn = !!s?.otAllowed;
    document.getElementById('shOtAllowed').checked = otOn;
    document.getElementById('shOtAfter').value = s?.otAfter ?? 0;
    document.getElementById('shOtRow').style.display = otOn ? 'block' : 'none';
    const wd = s?.workDays || SH_DEFAULT_WORKDAYS;
    SH_DAYS.forEach((_, i) => { const cb = document.getElementById('shWd' + i); if (cb) cb.checked = wd.includes(i); });
    document.getElementById('shModal').style.display = 'flex';
};
window.shCloseShift = function () { const m = document.getElementById('shModal'); if (m) m.style.display = 'none'; };
function shEnsureShiftModal() {
    if (document.getElementById('shModal')) return;
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const d = document.createElement('div');
    d.id = 'shModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    const days = SH_DAYS.map((n, i) => `<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;background:#f4f7fa;padding:5px 9px;border-radius:8px;cursor:pointer"><input type="checkbox" id="shWd${i}"> ${n}</label>`).join(' ');
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 id="shModalTitle" style="margin:0;color:#2d6a9f;font-size:18px">🕗 إضافة وردية</h3><button onclick="shCloseShift()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <input id="shKey" type="hidden">
        ${fg('اسم الوردية *', `<input id="shName" placeholder="صباحية / مسائية / ليلية..." style="width:100%;${shInp()}">`)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('بداية الدوام', `<input id="shStart" type="time" style="width:100%;${shInp()}">`)}
            ${fg('نهاية الدوام', `<input id="shEnd" type="time" style="width:100%;${shInp()}">`)}
            ${fg('الاستراحة (دقائق)', `<input id="shBreak" type="number" min="0" style="width:100%;${shInp()}">`)}
            ${fg('سماح التأخير (دقائق)', `<input id="shGrace" type="number" min="0" style="width:100%;${shInp()}">`)}
        </div>
        ${fg('أيام العمل', `<div style="display:flex;flex-wrap:wrap;gap:6px">${days}</div>`)}
        <div style="background:#fbfcfe;border:1px solid #e3eef7;border-radius:10px;padding:10px 12px;margin-bottom:10px">
            <div style="font-size:12px;font-weight:800;color:#5b6b7b;margin-bottom:8px">🎛️ نافذة الحضور</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                ${fg('يظهر زر الحضور قبل الدوام بـ (دقائق)', `<input id="shOpenBefore" type="number" min="0" placeholder="30" style="width:100%;${shInp()}">`)}
                ${fg('آخر وقت للحضور بعد البداية بـ (دقائق)', `<input id="shLateLimit" type="number" min="0" placeholder="120" style="width:100%;${shInp()}">`)}
            </div>
        </div>
        <div style="background:#f7fbff;border:1px solid #e3eef7;border-radius:10px;padding:10px 12px;margin-bottom:10px">
            <div style="font-size:12px;font-weight:800;color:#2d6a9f;margin-bottom:8px">⭐ ما بعد نهاية الدوام</div>
            ${fg('الوقت المسموح للانصراف بعد النهاية بـ (دقائق)', `<input id="shCloseOut" type="number" min="0" placeholder="120" style="width:100%;${shInp()}">`)}
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#2d6a9f;cursor:pointer;margin:6px 0 8px"><input type="checkbox" id="shOtAllowed" onchange="document.getElementById('shOtRow').style.display=this.checked?'block':'none'"> ⏱️ يُحتسب العمل بعد الدوام عملاً إضافياً</label>
            <div id="shOtRow" style="display:none">
                ${fg('يبدأ احتساب الإضافي بعد النهاية بـ (دقائق)', `<input id="shOtAfter" type="number" min="0" placeholder="0 = فوراً بعد الدوام" style="width:100%;${shInp()}">`)}
            </div>
        </div>
        ${fg('اللون', `<input id="shColor" type="color" value="#2980b9" style="width:60px;height:36px;border:1px solid #ddd;border-radius:8px;cursor:pointer">`)}
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn b-g" onclick="shSaveShift()" style="flex:1;font-weight:800">💾 حفظ</button><button class="btn" onclick="shCloseShift()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.shSaveShift = async function () {
    const key = document.getElementById('shKey').value;
    const name = document.getElementById('shName').value.trim();
    if (!name) { toast('⚠️ اسم الوردية مطلوب', 'er'); return; }
    const workDays = []; SH_DAYS.forEach((_, i) => { if (document.getElementById('shWd' + i)?.checked) workDays.push(i); });
    const data = {
        name, startTime: document.getElementById('shStart').value, endTime: document.getElementById('shEnd').value,
        breakMins: parseInt(document.getElementById('shBreak').value) || 0, graceMins: parseInt(document.getElementById('shGrace').value) || 0,
        openBefore: parseInt(document.getElementById('shOpenBefore').value) || 0, lateLimit: parseInt(document.getElementById('shLateLimit').value) || 0, closeOut: parseInt(document.getElementById('shCloseOut').value) || 0,
        otAllowed: !!document.getElementById('shOtAllowed').checked, otAfter: parseInt(document.getElementById('shOtAfter').value) || 0,
        workDays: workDays.length ? workDays : SH_DEFAULT_WORKDAYS, color: document.getElementById('shColor').value, active: true, updatedAt: new Date().toISOString()
    };
    try {
        if (key) await window.update(window.ref(window.db, 'ledger/shifts/' + key), data);
        else await window.push(window.R.shifts, data);
        toast('✓ تم الحفظ', 'ok'); shCloseShift();
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.shDeleteShift = async function (key) {
    let n = 0; Object.keys(window.emp || {}).forEach(ek => { if (shEmpShiftId(ek) === key) n++; });
    if (!(await cf2(n ? `${n} موظف مُسنَد لهذه الوردية — سيصبحون بلا وردية. حذف؟` : 'حذف هذه الوردية؟'))) return;
    try { await window.remove(window.ref(window.db, 'ledger/shifts/' + key)); toast('🗑️ تم الحذف', 'ok'); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// ── تبويب إسناد الموظفين ─────────────────────────────────────────────────────
function shRenderAssign() {
    const body = document.getElementById('shTabBody'); if (!body) return;
    const shifts = Object.entries(shAll());
    if (!shifts.length) { body.innerHTML = '<div style="text-align:center;color:#aaa;padding:24px">عرّف وردية واحدة أولاً من تبويب «تعريف الورديات»</div>'; return; }
    const emps = Object.entries(window.emp || {}).filter(([, e]) => (e.status || 'active') === 'active').sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'));
    const optsFor = sel => '<option value="">— بلا وردية —</option>' + shifts.map(([k, s]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${shEsc(s.name)}</option>`).join('');
    const bulkOpts = shifts.map(([k, s]) => `<option value="${k}">${shEsc(s.name)}</option>`).join('');
    body.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;background:#fff;padding:12px 14px;border-radius:10px;margin-bottom:14px">
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">إسناد جماعي</label><select id="shBulkSel" style="${shInp()}">${bulkOpts}</select></div>
            <button class="btn" onclick="shBulkAssign(false)" style="background:#eef5fb;color:#2d6a9f;font-weight:700">أسند غير المُسنَدين</button>
            <button class="btn" onclick="shBulkAssign(true)" style="background:#eef5fb;color:#2d6a9f;font-weight:700">أسند الكل</button>
        </div>
        <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <thead><tr style="background:#f4f6f9;color:#555;text-align:right"><th style="padding:9px">الموظف</th><th>القسم</th><th style="width:200px">الوردية</th></tr></thead>
                <tbody>${emps.map(([k, e]) => `<tr style="border-bottom:1px solid #f3f3f3">
                    <td style="padding:8px 9px;font-weight:700">${shEsc(e.name)}</td>
                    <td style="color:#666">${shEsc(e.dept || '—')}</td>
                    <td><select onchange="shAssign('${k}',this.value)" style="width:100%;${shInp()}">${optsFor(shEmpShiftId(k))}</select></td>
                </tr>`).join('')}</tbody>
            </table>
        </div>`;
}
window.shAssign = async function (empKey, shiftId) {
    try {
        if (shiftId) await window.set(window.ref(window.db, 'ledger/roster/' + empKey), { shiftId, effectiveFrom: new Date().toISOString().slice(0, 10) });
        else await window.remove(window.ref(window.db, 'ledger/roster/' + empKey));
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.shBulkAssign = async function (all) {
    const shiftId = document.getElementById('shBulkSel')?.value; if (!shiftId) { toast('اختر وردية', 'er'); return; }
    const emps = Object.entries(window.emp || {}).filter(([k, e]) => (e.status || 'active') === 'active' && (all || !shEmpShiftId(k)));
    if (!emps.length) { toast('لا موظفين مطابقين', 'er'); return; }
    if (!(await cf2(`إسناد ${emps.length} موظف إلى هذه الوردية؟`))) return;
    try {
        const updates = {}; emps.forEach(([k]) => { updates[k] = { shiftId, effectiveFrom: new Date().toISOString().slice(0, 10) }; });
        await window.update(window.R.roster, updates);
        toast(`✓ أُسند ${emps.length} موظف`, 'ok');
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// ── تبويب تحليل الالتزام (التأخير) ───────────────────────────────────────────
function shRenderCompliance() {
    const body = document.getElementById('shTabBody'); if (!body) return;
    window._shMonth = window._shMonth || new Date().toISOString().slice(0, 7);
    const month = window._shMonth;
    const att = Object.values(window.attendance || {}).filter(a => a.checkIn && (a.date || '').slice(0, 7) === month);
    // تجميع لكل موظف
    const byEmp = {};
    att.forEach(a => {
        const sid = shEmpShiftId(a.employeeId); const s = sid ? shAll()[sid] : null;
        const rec = byEmp[a.employeeId] = byEmp[a.employeeId] || { name: a.employeeName || shEmpName(a.employeeId), shift: s ? s.name : null, present: 0, late: 0, lateMins: 0, noShift: !s };
        rec.present++;
        if (s) {
            const startMins = shMins(s.startTime); const grace = s.graceMins || 0;
            const ci = new Date(a.checkIn); const ciMins = ci.getHours() * 60 + ci.getMinutes();
            if (startMins != null && ciMins > startMins + grace) { rec.late++; rec.lateMins += (ciMins - startMins); }
        }
    });
    const rows = Object.values(byEmp).sort((a, b) => b.lateMins - a.lateMins);
    const totLate = rows.reduce((s, r) => s + r.late, 0);
    const totLateMins = rows.reduce((s, r) => s + r.lateMins, 0);
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;
    body.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;background:#fff;padding:12px 14px;border-radius:10px;margin-bottom:14px">
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">الشهر</label><input type="month" value="${month}" onchange="window._shMonth=this.value;renderShifts()" style="${shInp()}"></div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('📋', 'أيام حضور', att.length, '#2980b9')}
            ${kpi('⏰', 'حالات تأخير', totLate, totLate ? '#e67e22' : '#27ae60')}
            ${kpi('⏱️', 'إجمالي دقائق التأخير', totLateMins, totLateMins ? '#c0392b' : '#27ae60')}
        </div>
        <div style="background:#eaf4fb;border-radius:10px;padding:10px 14px;font-size:11.5px;color:#2d6a9f;margin-bottom:12px">💡 التأخير = وقت الحضور الفعلي بعد (بداية الوردية + سماح التأخير). الموظفون بلا وردية لا يُحتسب لهم تأخير.</div>
        <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <thead><tr style="background:#f4f6f9;color:#555;text-align:right"><th style="padding:9px">الموظف</th><th>الوردية</th><th>أيام الحضور</th><th>أيام التأخير</th><th>إجمالي التأخير (د)</th><th>متوسط التأخير</th></tr></thead>
                <tbody>${rows.length ? rows.map(r => `<tr style="border-bottom:1px solid #f3f3f3">
                    <td style="padding:8px 9px;font-weight:700">${shEsc(r.name)}</td>
                    <td style="color:${r.shift ? '#555' : '#c0392b'}">${r.shift ? shEsc(r.shift) : 'بلا وردية'}</td>
                    <td style="text-align:center">${r.present}</td>
                    <td style="text-align:center;color:${r.late ? '#e67e22' : '#27ae60'};font-weight:700">${r.late}</td>
                    <td style="text-align:center;color:${r.lateMins ? '#c0392b' : '#27ae60'};font-weight:700">${r.lateMins}</td>
                    <td style="text-align:center;color:#888">${r.late ? Math.round(r.lateMins / r.late) + ' د' : '—'}</td>
                </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:24px">لا سجلات حضور في هذا الشهر</td></tr>'}</tbody>
            </table>
        </div>`;
}

console.log('✅ Shifts module loaded');
