// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ⚖️  الجزاءات والإنذارات + 🏛️ الهيكل التنظيمي (HR Extra)                     ║
// ║  وحدة ثانوية تعتمد على globals من app.js. بياناتها تُعزَل تلقائياً للمستأجر.   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── أنواع الجزاءات (سلّم تأديبي وفق لائحة تنظيم العمل) ───────────────────────
const DISC_TYPES = {
    notice: { label: '📝 تنبيه', color: '#3498db', sev: 1 },
    warning: { label: '⚠️ إنذار كتابي', color: '#e67e22', sev: 2 },
    fine: { label: '💸 غرامة/خصم', color: '#e74c3c', sev: 3 },
    denyRaise: { label: '⛔ حرمان علاوة/ترقية', color: '#9b59b6', sev: 3 },
    suspend: { label: '🚫 إيقاف عن العمل', color: '#c0392b', sev: 4 },
    dismiss: { label: '🔴 فصل من الخدمة', color: '#7b0000', sev: 5 }
};
const DISC_TYPE_ORDER = ['notice', 'warning', 'fine', 'denyRaise', 'suspend', 'dismiss'];

function hxEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function hxMoney(v) { return (typeof fmt === 'function') ? fmt(Number(v) || 0) : (Number(v) || 0).toLocaleString('en'); }
function hxDisc() { return window.disciplinary || {}; }
function hxEmpName(id) { const e = (window.emp || {})[id]; return e ? (e.name || '—') : '—'; }
function hxInp() { return 'padding:8px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box'; }
function hxMyName() { try { return (window.curU && (window.myP?.name || window.curU.displayName)) || ''; } catch (e) { return ''; } }

// ═══════════════════════════════════════════════════════════════════════════
//  ⚖️  الجزاءات والإنذارات
// ═══════════════════════════════════════════════════════════════════════════
window.renderDisciplinary = function () {
    const c = document.getElementById('pg-disciplinary'); if (!c) return;
    window._hxDisc = window._hxDisc || { emp: '', type: '', year: '' };
    const f = window._hxDisc;
    const yr = new Date().getFullYear();
    const rows = Object.entries(hxDisc()).map(([k, d]) => ({ k, ...d }))
        .filter(d => (!f.emp || d.empKey === f.emp) && (!f.type || d.type === f.type) && (!f.year || (d.date || '').slice(0, 4) === f.year))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const all = Object.values(hxDisc());
    const activeWarn = all.filter(d => (d.status || 'open') === 'open' && DISC_TYPES[d.type] && DISC_TYPES[d.type].sev >= 2).length;
    const thisYear = all.filter(d => (d.date || '').slice(0, 4) === String(yr)).length;
    const totalFines = all.reduce((s, d) => s + (parseFloat(d.penaltyAmount) || 0), 0);

    const empOpts = Object.entries(window.emp || {}).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar')).map(([k, e]) => `<option value="${k}" ${f.emp === k ? 'selected' : ''}>${hxEsc(e.name)}</option>`).join('');
    const typeOpts = DISC_TYPE_ORDER.map(t => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${DISC_TYPES[t].label}</option>`).join('');
    const years = [...new Set(all.map(d => (d.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    const yearOpts = years.map(y => `<option value="${y}" ${f.year === y ? 'selected' : ''}>${y}</option>`).join('');
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">⚖️ الجزاءات والإنذارات</div>
            <button class="btn b-g" onclick="hxOpenDisc()" style="font-weight:800">➕ تسجيل جزاء/إنذار</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('📋', 'إجمالي السجلات', all.length, '#2980b9')}
            ${kpi('⚠️', 'إنذارات نشطة', activeWarn, activeWarn ? '#e67e22' : '#95a5a6')}
            ${kpi('📅', 'هذا العام', thisYear, '#8e44ad')}
            ${kpi('💸', 'إجمالي الغرامات', hxMoney(totalFines), '#e74c3c')}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;background:#fff;padding:12px 14px;border-radius:10px;margin-bottom:14px">
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">الموظف</label><select onchange="window._hxDisc.emp=this.value;renderDisciplinary()" style="${hxInp()}"><option value="">الكل</option>${empOpts}</select></div>
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">النوع</label><select onchange="window._hxDisc.type=this.value;renderDisciplinary()" style="${hxInp()}"><option value="">الكل</option>${typeOpts}</select></div>
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">السنة</label><select onchange="window._hxDisc.year=this.value;renderDisciplinary()" style="${hxInp()}"><option value="">الكل</option>${yearOpts}</select></div>
            <button class="btn" onclick="window._hxDisc={emp:'',type:'',year:''};renderDisciplinary()" style="background:#f0f0f0">↺ إعادة ضبط</button>
        </div>
        <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <thead><tr style="background:#f4f6f9;color:#555;text-align:right">
                    <th style="padding:9px">التاريخ</th><th>الموظف</th><th>النوع</th><th>المخالفة</th><th>الإجراء</th><th>الغرامة</th><th>الحالة</th><th></th>
                </tr></thead>
                <tbody>${rows.length ? rows.map(d => {
        const t = DISC_TYPES[d.type] || DISC_TYPES.notice;
        const open = (d.status || 'open') === 'open';
        return `<tr style="border-bottom:1px solid #f3f3f3">
                    <td style="padding:8px 9px;white-space:nowrap">${d.date || '—'}</td>
                    <td style="font-weight:700">${hxEsc(d.empName || hxEmpName(d.empKey))}</td>
                    <td><span style="background:${t.color}18;color:${t.color};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${t.label}</span></td>
                    <td style="color:#555;max-width:220px">${hxEsc(d.description || '—')}</td>
                    <td style="color:#666">${hxEsc(d.action || '—')}${d.penaltyDays ? ` · ${d.penaltyDays} يوم` : ''}</td>
                    <td style="text-align:center;color:#e74c3c;font-weight:700">${d.penaltyAmount ? hxMoney(d.penaltyAmount) : '—'}</td>
                    <td style="text-align:center"><span style="color:${open ? '#e67e22' : '#7f8c8d'};font-weight:700;font-size:11px">${open ? '🟠 نشط' : '⚫ منتهٍ'}</span>${d.acknowledged ? ' <span title="اطّلع الموظف" style="color:#27ae60">✔</span>' : ''}</td>
                    <td style="text-align:left;white-space:nowrap"><button class="btn" onclick="hxOpenDisc('${d.k}')" style="font-size:11px;padding:3px 7px">✏️</button> <button class="btn b-r" onclick="hxDeleteDisc('${d.k}')" style="font-size:11px;padding:3px 7px">🗑️</button></td>
                </tr>`;
    }).join('') : '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:24px">لا سجلات في هذا الفلتر</td></tr>'}</tbody>
            </table>
        </div>
        <div style="background:#fef9e7;border:1px solid #f9e79f;border-radius:10px;padding:10px 14px;font-size:11.5px;color:#7d5a00;margin-top:12px">💡 الغرامة المسجّلة هنا للتوثيق فقط ولا تُخصم تلقائياً من المسير. لتطبيقها أدخلها في «خصم المخالفات والجزاءات» ببطاقة الموظف.</div>
    </div>`;
};
window.hxOpenDisc = function (key) {
    hxEnsureDiscModal();
    const d = key ? hxDisc()[key] : null;
    document.getElementById('hxDiscKey').value = key || '';
    document.getElementById('hxDiscTitle').textContent = d ? '✏️ تعديل جزاء/إنذار' : '⚖️ تسجيل جزاء/إنذار';
    const emps = Object.entries(window.emp || {}).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'));
    document.getElementById('hxDiscEmp').innerHTML = '<option value="">— اختر الموظف —</option>' + emps.map(([k, e]) => `<option value="${k}">${hxEsc(e.name)}</option>`).join('');
    document.getElementById('hxDiscEmp').value = d?.empKey || '';
    document.getElementById('hxDiscDate').value = d?.date || new Date().toISOString().slice(0, 10);
    document.getElementById('hxDiscType').value = d?.type || 'notice';
    document.getElementById('hxDiscDesc').value = d?.description || '';
    document.getElementById('hxDiscAction').value = d?.action || '';
    document.getElementById('hxDiscAmount').value = d?.penaltyAmount ?? '';
    document.getElementById('hxDiscDays').value = d?.penaltyDays ?? '';
    document.getElementById('hxDiscStatus').value = d?.status || 'open';
    document.getElementById('hxDiscAck').checked = !!d?.acknowledged;
    document.getElementById('hxDiscModal').style.display = 'flex';
};
window.hxCloseDisc = function () { const m = document.getElementById('hxDiscModal'); if (m) m.style.display = 'none'; };
function hxEnsureDiscModal() {
    if (document.getElementById('hxDiscModal')) return;
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const d = document.createElement('div');
    d.id = 'hxDiscModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 id="hxDiscTitle" style="margin:0;color:#c0392b;font-size:18px">⚖️ تسجيل جزاء/إنذار</h3><button onclick="hxCloseDisc()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <input id="hxDiscKey" type="hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('الموظف *', `<select id="hxDiscEmp" style="width:100%;${hxInp()}"></select>`)}
            ${fg('التاريخ *', `<input id="hxDiscDate" type="date" style="width:100%;${hxInp()}">`)}
            ${fg('النوع', `<select id="hxDiscType" style="width:100%;${hxInp()}">${DISC_TYPE_ORDER.map(t => `<option value="${t}">${DISC_TYPES[t].label}</option>`).join('')}</select>`)}
            ${fg('الحالة', `<select id="hxDiscStatus" style="width:100%;${hxInp()}"><option value="open">🟠 نشط</option><option value="closed">⚫ منتهٍ</option></select>`)}
            ${fg('قيمة الغرامة (ريال)', `<input id="hxDiscAmount" type="number" min="0" step="0.01" style="width:100%;${hxInp()}">`)}
            ${fg('عدد أيام الإيقاف', `<input id="hxDiscDays" type="number" min="0" style="width:100%;${hxInp()}">`)}
        </div>
        ${fg('وصف المخالفة *', `<textarea id="hxDiscDesc" rows="2" style="width:100%;${hxInp()};resize:vertical"></textarea>`)}
        ${fg('الإجراء المتّخذ', `<textarea id="hxDiscAction" rows="2" style="width:100%;${hxInp()};resize:vertical"></textarea>`)}
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:14px;cursor:pointer"><input id="hxDiscAck" type="checkbox"> اطّلع الموظف ووقّع على المخالفة</label>
        <div style="display:flex;gap:8px"><button class="btn b-g" onclick="hxSaveDisc()" style="flex:1;font-weight:800">💾 حفظ</button><button class="btn" onclick="hxCloseDisc()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.hxSaveDisc = async function () {
    const key = document.getElementById('hxDiscKey').value;
    const empKey = document.getElementById('hxDiscEmp').value;
    const description = document.getElementById('hxDiscDesc').value.trim();
    if (!empKey) { toast('⚠️ اختر الموظف', 'er'); return; }
    if (!description) { toast('⚠️ وصف المخالفة مطلوب', 'er'); return; }
    const data = {
        empKey, empName: (window.emp || {})[empKey]?.name || '',
        date: document.getElementById('hxDiscDate').value || new Date().toISOString().slice(0, 10),
        type: document.getElementById('hxDiscType').value, description,
        action: document.getElementById('hxDiscAction').value.trim(),
        penaltyAmount: parseFloat(document.getElementById('hxDiscAmount').value) || 0,
        penaltyDays: parseInt(document.getElementById('hxDiscDays').value) || 0,
        status: document.getElementById('hxDiscStatus').value,
        acknowledged: document.getElementById('hxDiscAck').checked,
        updatedAt: new Date().toISOString()
    };
    try {
        if (key) await window.update(window.ref(window.db, 'ledger/disciplinary/' + key), data);
        else { data.issuedBy = hxMyName(); data.createdAt = new Date().toISOString(); await window.push(window.R.disciplinary, data); }
        toast('✓ تم الحفظ', 'ok'); hxCloseDisc();
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.hxDeleteDisc = async function (key) {
    if (!(await cf2('حذف هذا السجل؟'))) return;
    try { await window.remove(window.ref(window.db, 'ledger/disciplinary/' + key)); toast('🗑️ تم الحذف', 'ok'); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  🏛️  الهيكل التنظيمي — مُشتق من الإدارات (ومديروها) + الموظفين
// ═══════════════════════════════════════════════════════════════════════════
window.renderOrgChart = function () {
    const c = document.getElementById('pg-orgchart'); if (!c) return;
    const depts = window.departments || {};
    const emps = Object.entries(window.emp || {}).filter(([, e]) => (e.status || 'active') === 'active');
    const company = window.currentTenantName || (window.gbrCfg && window.gbrCfg.companyName) || 'الشركة';
    // تجميع الموظفين حسب اسم الإدارة (dept على الموظف نص = اسم الإدارة)
    const byDept = {}; const noDept = [];
    emps.forEach(([id, e]) => { const dn = (e.dept || '').trim(); if (dn) { (byDept[dn] = byDept[dn] || []).push({ id, ...e }); } else noDept.push({ id, ...e }); });
    // قائمة الإدارات المعرّفة + أي إدارة ظهرت على موظف وليست معرّفة
    const deptNames = new Set(Object.values(depts).map(d => d.name).filter(Boolean));
    Object.keys(byDept).forEach(n => deptNames.add(n));
    const deptList = [...deptNames].sort((a, b) => a.localeCompare(b, 'ar'));
    const totalActive = emps.length;
    const managerOf = name => { const d = Object.values(depts).find(x => x.name === name); if (!d) return null; return d.managerName || (d.managerId && (window.emp || {})[d.managerId]?.name) || null; };

    const empChip = e => `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 8px;border-radius:7px;background:#f7f9fb;margin-bottom:4px;font-size:12px"><span style="font-weight:600;color:#1a3a5c">${hxEsc(e.name)}</span><span style="color:#999;font-size:11px">${hxEsc(e.job || '')}</span></div>`;
    const deptCard = name => {
        const list = (byDept[name] || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        const mgr = managerOf(name);
        return `<div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden;border-top:3px solid #16a085">
            <div style="background:linear-gradient(135deg,#16a08512,transparent);padding:12px 14px;border-bottom:1px solid #f0f0f0">
                <div style="font-weight:800;color:#0e7c66;font-size:14px">🏢 ${hxEsc(name)}</div>
                <div style="font-size:11.5px;color:#888;margin-top:2px">${mgr ? '👤 المدير: <b style="color:#555">' + hxEsc(mgr) + '</b>' : '<span style="color:#c0392b">بلا مدير محدّد</span>'} · ${list.length} موظف</div>
            </div>
            <div style="padding:10px 12px">${list.length ? list.map(empChip).join('') : '<div style="color:#bbb;font-size:12px;text-align:center;padding:6px">لا موظفين</div>'}</div>
        </div>`;
    };

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">🏛️ الهيكل التنظيمي</div>
            <button class="btn" onclick="window.print()" style="background:#eef2f7">🖨️ طباعة</button>
        </div>
        <div style="text-align:center;margin-bottom:18px">
            <div style="display:inline-block;background:linear-gradient(135deg,#1a3a5c,#2d6a9f);color:#fff;padding:14px 40px;border-radius:14px;font-weight:800;font-size:18px;box-shadow:0 3px 12px rgba(26,58,92,.3)">🏛️ ${hxEsc(company)}</div>
            <div style="font-size:12px;color:#888;margin-top:8px">${deptList.length} إدارة · ${totalActive} موظف نشط</div>
            <div style="width:2px;height:20px;background:#cbd5e1;margin:6px auto 0"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
            ${deptList.length ? deptList.map(deptCard).join('') : '<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:24px">لا إدارات — أضف إدارات وموظفين لعرض الهيكل</div>'}
            ${noDept.length ? `<div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden;border-top:3px solid #95a5a6">
                <div style="background:#95a5a612;padding:12px 14px;border-bottom:1px solid #f0f0f0"><div style="font-weight:800;color:#7f8c8d;font-size:14px">❔ بدون إدارة</div><div style="font-size:11.5px;color:#888;margin-top:2px">${noDept.length} موظف غير مرتبط بإدارة</div></div>
                <div style="padding:10px 12px">${noDept.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar')).map(empChip).join('')}</div>
            </div>` : ''}
        </div>
    </div>`;
};

console.log('✅ HR-Extra module loaded (disciplinary + org chart)');
