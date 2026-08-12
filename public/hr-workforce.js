// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🩺 التأمين الطبي · ✈️ الانتداب وبدل السفر · 🪜 السلم الوظيفي والدرجات    ║
// ║  وحدة ثانوية تعتمد على globals من app.js. بياناتها تُعزَل تلقائياً للمستأجر. ║
// ╠══════════════════════════════════════════════════════════════════════════╣
// ║  الفهرس:                                                                  ║
// ║   [HRW1] التأمين الطبي   — renderMedIns   · pg-medinsurance              ║
// ║   [HRW2] الانتداب والسفر — renderTrips    · pg-businesstrips             ║
// ║   [HRW3] السلم الوظيفي   — renderGrades   · داخل صفحة الإدارات            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

function wfEsc(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function wfMoney(v) { return (typeof fmt === 'function') ? fmt(Number(v) || 0) : (Number(v) || 0).toLocaleString('en'); }
function wfToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function wfInp() { return 'padding:8px;border:1.5px solid var(--hr-bd2);border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;width:100%'; }
function wfCanHR() { return myP?.role === 'admin' || (typeof can === 'function' && (can('view_employees') || can('edit_settings'))); }
function wfEmpName(k) { const e = (window.emp || {})[k]; return e ? (e.name || '—') : '—'; }
// أيام حتى تاريخ (سالب = مضى)
function wfDaysTo(d) { if (!d) return null; return Math.round((new Date(d + 'T00:00:00') - new Date(wfToday() + 'T00:00:00')) / 86400000); }
function wfEmpOptions(sel) {
    return Object.entries(window.emp || {})
        .filter(([, e]) => e.status !== 'inactive')
        .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'))
        .map(([k, e]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${wfEsc(e.name || '-')}</option>`).join('');
}
// نافذة ديناميكية — نفس نمط hsEnsureSurveyModal في hr-suite.js.
// تُعاد البناء في كل فتح لأن محتوى النموذج يعتمد على السجل المُحرَّر.
function wfModal(id, title, bodyHtml, footerHtml, titleCol) {
    const old = document.getElementById(id); if (old) old.remove();
    const d = document.createElement('div');
    d.id = id;
    d.style.cssText = 'display:flex;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:${titleCol || 'var(--hr-pri)'};font-size:18px">${title}</h3>
            <button onclick="wfClose('${id}')" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;line-height:1">×</button>
        </div>
        ${bodyHtml}
        <div style="display:flex;gap:8px;margin-top:16px">${footerHtml}<button class="btn" style="background:var(--hr-sf1)" onclick="wfClose('${id}')">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
    // 🔍 كل قائمة منسدلة في نوافذ هذه الوحدة تصير قابلة للبحث — قوائم الموظفين
    // والمشاريع تنمو مع الوقت. data-ss="1" يفرض البحث بلا انتظار عتبة العدد.
    if (typeof ssAutoEnhance === 'function') {
        d.querySelectorAll('select').forEach(s => s.setAttribute('data-ss', '1'));
        ssAutoEnhance(d);
    }
}
window.wfClose = function (id) { const d = document.getElementById(id); if (d) d.remove(); };

function wfKpi(ic, lb, vl, col, sub) {
    return `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)">
        <div style="font-size:12px;color:var(--hr-muted)">${ic} ${lb}</div>
        <div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${vl}</div>
        ${sub ? `<div style="font-size:10.5px;color:var(--hr-muted);margin-top:2px">${sub}</div>` : ''}
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  [HRW1] 🩺 التأمين الطبي
//  ledger/medInsurance/{key} = { empKey, insurer, policyNo, cls, from, to,
//                                annualCost, dependents:[{name,relation}], notes }
//  ملاحظة: حقل الموظف eMedIns هو «تكلفة شهرية» في حساب التكلفة — مكمّل لا بديل.
// ═══════════════════════════════════════════════════════════════════════════
const MI_CLASSES = { vip: '💎 VIP', a: '🅰️ الفئة A', b: '🅱️ الفئة B', c: '🅲 الفئة C' };

window.renderMedIns = function () {
    const c = document.getElementById('pg-medinsurance'); if (!c) return;
    if (!wfCanHR()) { c.innerHTML = '<div class="card">🔒 لا تملك صلاحية عرض هذا القسم.</div>'; return; }
    window._miF = window._miF || { q: '', status: '' };
    const f = window._miF;
    const all = Object.entries(window.medInsurance || {}).map(([k, r]) => ({ k, ...r }));

    const statusOf = r => {
        const d = wfDaysTo(r.to);
        if (d === null) return { key: 'none', label: 'بلا تاريخ', col: 'var(--hr-muted)' };
        if (d < 0) return { key: 'expired', label: 'منتهية', col: 'var(--hr-danger)' };
        if (d <= 30) return { key: 'soon', label: `تنتهي خلال ${d} يوم`, col: 'var(--hr-warn)' };
        return { key: 'active', label: 'سارية', col: 'var(--hr-ok-d)' };
    };

    const rows = all.filter(r => {
        const nm = wfEmpName(r.empKey).toLowerCase();
        const hit = !f.q || nm.includes(f.q.toLowerCase()) || (r.policyNo || '').toLowerCase().includes(f.q.toLowerCase()) || (r.insurer || '').toLowerCase().includes(f.q.toLowerCase());
        return hit && (!f.status || statusOf(r).key === f.status);
    }).sort((a, b) => (a.to || '9999').localeCompare(b.to || '9999'));

    const activeEmps = Object.entries(window.emp || {}).filter(([, e]) => e.status !== 'inactive');
    // نحصرها في الموظفين النشطين حتى يتّسق البسط مع المقام («N من M نشط»)
    const activeSet = new Set(activeEmps.map(([k]) => k));
    const coveredKeys = new Set(all.filter(r => ['active', 'soon'].includes(statusOf(r).key) && activeSet.has(r.empKey)).map(r => r.empKey));
    const uncovered = activeEmps.filter(([k]) => !coveredKeys.has(k));
    const expiring = all.filter(r => statusOf(r).key === 'soon').length;
    const expired = all.filter(r => statusOf(r).key === 'expired').length;
    const totalDeps = all.reduce((s, r) => s + ((r.dependents || []).length), 0);

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:var(--hr-pri)">🩺 التأمين الطبي</div>
            <button class="btn b-p" onclick="miOpen()" style="font-weight:800">➕ إضافة وثيقة</button>
        </div>
        <div class="hr-info" style="margin-bottom:14px">
            التأمين الصحي <b>إلزامي</b> على صاحب العمل وفق نظام الضمان الصحي التعاوني. سجّل الوثيقة والفئة والمرافقين وتاريخ الانتهاء لتتابع التجديد قبل انقطاع التغطية.
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${wfKpi('🛡️', 'موظفون مغطّون', coveredKeys.size, 'var(--hr-ok-d)', `من ${activeEmps.length} نشط`)}
            ${wfKpi('⚠️', 'بلا تغطية', uncovered.length, uncovered.length ? 'var(--hr-danger)' : 'var(--hr-muted)')}
            ${wfKpi('⏳', 'تنتهي خلال 30 يوم', expiring, expiring ? 'var(--hr-warn)' : 'var(--hr-muted)')}
            ${wfKpi('🔴', 'منتهية', expired, expired ? 'var(--hr-danger)' : 'var(--hr-muted)')}
            ${wfKpi('👨‍👩‍👧', 'المرافقون', totalDeps, 'var(--hr-alt)')}
        </div>
        ${uncovered.length ? `<div class="card" style="margin-bottom:14px;border-right:5px solid var(--hr-danger)">
            <div style="font-weight:800;color:var(--hr-danger);font-size:13.5px;margin-bottom:8px">⚠️ ${uncovered.length} موظف نشط بلا تغطية تأمينية سارية</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${uncovered.slice(0, 25).map(([k, e]) => `<span style="background:color-mix(in srgb, var(--hr-danger) 9.41%, transparent);color:var(--hr-danger);border-radius:9px;padding:3px 10px;font-size:11.5px;font-weight:700">${wfEsc(e.name || '-')}</span>`).join('')}${uncovered.length > 25 ? `<span style="color:var(--hr-muted);font-size:11.5px;padding:3px">+${uncovered.length - 25} آخرين</span>` : ''}</div>
        </div>` : ''}
        <div class="card">
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
                <input type="text" value="${wfEsc(f.q)}" oninput="window._miF.q=this.value;renderMedIns()" placeholder="🔍 ابحث باسم الموظف أو رقم الوثيقة أو شركة التأمين..." style="${wfInp()};flex:1;min-width:220px">
                <select onchange="window._miF.status=this.value;renderMedIns()" style="${wfInp()};width:auto">
                    <option value="">كل الحالات</option>
                    <option value="active" ${f.status === 'active' ? 'selected' : ''}>سارية</option>
                    <option value="soon" ${f.status === 'soon' ? 'selected' : ''}>تنتهي قريباً</option>
                    <option value="expired" ${f.status === 'expired' ? 'selected' : ''}>منتهية</option>
                </select>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <thead><tr style="text-align:right"><th style="padding:9px">الموظف</th><th>شركة التأمين</th><th>رقم الوثيقة</th><th>الفئة</th><th>الانتهاء</th><th>المرافقون</th><th>التكلفة السنوية</th><th>الحالة</th><th></th></tr></thead>
                <tbody>${rows.length ? rows.map(r => {
                    const st = statusOf(r);
                    return `<tr>
                        <td style="padding:8px 9px;font-weight:700;color:var(--hr-ink)">${wfEsc(wfEmpName(r.empKey))}</td>
                        <td>${wfEsc(r.insurer || '—')}</td>
                        <td style="font-family:monospace">${wfEsc(r.policyNo || '—')}</td>
                        <td>${MI_CLASSES[r.cls] || '—'}</td>
                        <td style="white-space:nowrap">${wfEsc(r.to || '—')}</td>
                        <td style="text-align:center">${(r.dependents || []).length || '—'}</td>
                        <td style="text-align:left;font-weight:700">${r.annualCost ? wfMoney(r.annualCost) : '—'}</td>
                        <td><span style="background:color-mix(in srgb, ${st.col} 9.41%, transparent);color:${st.col};padding:2px 9px;border-radius:9px;font-size:11px;font-weight:700;white-space:nowrap">${st.label}</span></td>
                        <td style="text-align:left;white-space:nowrap">
                            <button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="miOpen('${r.k}')">✏️</button>
                            <button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="miDelete('${r.k}')">🗑️</button>
                        </td>
                    </tr>`;
                }).join('') : '<tr><td colspan="9" style="text-align:center;color:#aaa;padding:24px">لا وثائق مطابقة</td></tr>'}</tbody>
            </table>
        </div>
    </div>`;
};

window.miOpen = function (key) {
    const r = key ? (window.medInsurance || {})[key] : null;
    window._miDeps = r ? JSON.parse(JSON.stringify(r.dependents || [])) : [];
    window._miKey = key || '';
    wfModal('wfMiModal', `${key ? '✏️ تعديل' : '➕ إضافة'} وثيقة تأمين طبي`, `
        <div class="form-grid sm">
            <div class="fg"><label>الموظف *</label><select id="miEmp" style="${wfInp()}"><option value="">— اختر —</option>${wfEmpOptions(r?.empKey)}</select></div>
            <div class="fg"><label>شركة التأمين *</label><input id="miInsurer" value="${wfEsc(r?.insurer || '')}" style="${wfInp()}"></div>
            <div class="fg"><label>رقم الوثيقة</label><input id="miPolicy" value="${wfEsc(r?.policyNo || '')}" style="${wfInp()}"></div>
            <div class="fg"><label>الفئة</label><select id="miCls" style="${wfInp()}">${Object.entries(MI_CLASSES).map(([k, v]) => `<option value="${k}" ${r?.cls === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="fg"><label>من *</label><input type="date" id="miFrom" value="${wfEsc(r?.from || '')}" style="${wfInp()}"></div>
            <div class="fg"><label>إلى *</label><input type="date" id="miTo" value="${wfEsc(r?.to || '')}" style="${wfInp()}"></div>
            <div class="fg"><label>التكلفة السنوية (ريال)</label><input type="number" step="0.01" id="miCost" value="${r?.annualCost || ''}" style="${wfInp()}"></div>
        </div>
        <div style="margin-top:14px">
            <label style="font-size:13px;font-weight:700;color:var(--hr-pri);display:block;margin-bottom:6px">👨‍👩‍👧 المرافقون</label>
            <div id="miDepsList"></div>
            <button class="btn" style="background:var(--hr-sf1);margin-top:6px;font-size:12px" onclick="miAddDep()">➕ إضافة مرافق</button>
        </div>
        <div class="fg" style="margin-top:12px"><label>ملاحظات</label><textarea id="miNotes" rows="2" style="${wfInp()};resize:vertical">${wfEsc(r?.notes || '')}</textarea></div>
    `, `<button class="btn b-p" onclick="miSave()" style="flex:1;font-weight:800">💾 حفظ</button>`);
    miRenderDeps();
};

window.miAddDep = function () { window._miDeps.push({ name: '', relation: 'spouse' }); miRenderDeps(); };
window.miRemoveDep = function (i) { window._miDeps.splice(i, 1); miRenderDeps(); };
window.miRenderDeps = function () {
    const box = document.getElementById('miDepsList'); if (!box) return;
    const REL = { spouse: 'زوج/زوجة', child: 'ابن/ابنة', parent: 'والد/والدة', other: 'أخرى' };
    box.innerHTML = window._miDeps.length ? window._miDeps.map((d, i) => `
        <div style="display:flex;gap:6px;margin-bottom:5px;align-items:center">
            <input value="${wfEsc(d.name)}" oninput="window._miDeps[${i}].name=this.value" placeholder="الاسم" style="${wfInp()};flex:1">
            <select onchange="window._miDeps[${i}].relation=this.value" style="${wfInp()};width:auto">${Object.entries(REL).map(([k, v]) => `<option value="${k}" ${d.relation === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            <button class="btn b-r" style="padding:4px 9px;font-size:11px" onclick="miRemoveDep(${i})">✕</button>
        </div>`).join('') : '<div style="color:var(--hr-muted);font-size:12px;padding:4px">لا مرافقين</div>';
};

window.miSave = async function () {
    const empKey = document.getElementById('miEmp')?.value || '';
    const insurer = (document.getElementById('miInsurer')?.value || '').trim();
    const from = document.getElementById('miFrom')?.value || '';
    const to = document.getElementById('miTo')?.value || '';
    if (!empKey || !insurer || !from || !to) { toast('الموظف وشركة التأمين والتواريخ مطلوبة', 'er'); return; }
    if (to < from) { toast('تاريخ الانتهاء قبل البداية', 'er'); return; }
    const rec = {
        empKey, insurer,
        policyNo: (document.getElementById('miPolicy')?.value || '').trim(),
        cls: document.getElementById('miCls')?.value || 'b',
        from, to,
        annualCost: parseFloat(document.getElementById('miCost')?.value) || 0,
        dependents: (window._miDeps || []).filter(d => (d.name || '').trim()),
        notes: (document.getElementById('miNotes')?.value || '').trim(),
        updatedBy: curU?.uid || '', updatedAt: new Date().toISOString()
    };
    try {
        if (window._miKey) await update(ref(db, 'ledger/medInsurance/' + window._miKey), rec);
        else await push(R.medIns, rec);
        if (typeof logAudit === 'function') logAudit(window._miKey ? 'update' : 'create', 'hr', `تأمين طبي: ${wfEmpName(empKey)} — ${insurer}`);
        wfClose('wfMiModal'); toast('💾 حُفظت الوثيقة', 'ok');
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.miDelete = function (key) {
    const r = (window.medInsurance || {})[key];
    cf2(`حذف وثيقة تأمين "${wfEmpName(r?.empKey)}"؟`, async () => {
        try {
            await remove(ref(db, 'ledger/medInsurance/' + key));
            if (typeof logAudit === 'function') logAudit('delete', 'hr', `حذف وثيقة تأمين: ${wfEmpName(r?.empKey)}`);
            toast('🗑️ حُذفت', 'ok');
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  [HRW2] ✈️ الانتداب وبدل السفر
//  ledger/businessTrips/{key} = { empKey, destination, purpose, projectId,
//    from, to, days, perDiem, transport, accommodation, other, total,
//    status, approval }
//  موصول بمحرّك الموافقات (النوع 'trip') — بلا سياسة مفعّلة يبقى اعتماداً بخطوة.
// ═══════════════════════════════════════════════════════════════════════════
const TRIP_STATUS = {
    pending: { label: '⏳ بانتظار الاعتماد', col: 'var(--hr-warn)' },
    approved: { label: '✅ معتمد', col: 'var(--hr-ok-d)' },
    rejected: { label: '❌ مرفوض', col: 'var(--hr-danger)' },
    settled: { label: '💰 مُصفّى', col: 'var(--hr-blue)' }
};

function tripDays(from, to) {
    if (!from || !to) return 0;
    return Math.max(1, Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000) + 1);
}
function tripTotal(t) {
    const d = tripDays(t.from, t.to);
    return (parseFloat(t.perDiem) || 0) * d + (parseFloat(t.transport) || 0) + (parseFloat(t.accommodation) || 0) + (parseFloat(t.other) || 0);
}
window.tripDays = tripDays;

window.renderTrips = function () {
    const c = document.getElementById('pg-businesstrips'); if (!c) return;
    const isHR = wfCanHR();
    window._trF = window._trF || { emp: '', status: '' };
    const f = window._trF;
    const myKey = myP?.empKey || '';
    let all = Object.entries(window.businessTrips || {}).map(([k, t]) => ({ k, ...t }));
    // الموظف غير HR يرى انتداباته فقط
    if (!isHR) all = all.filter(t => t.empKey === myKey);

    const rows = all.filter(t => (!f.emp || t.empKey === f.emp) && (!f.status || (t.status || 'pending') === f.status))
        .sort((a, b) => (b.from || '').localeCompare(a.from || ''));

    const pending = all.filter(t => (t.status || 'pending') === 'pending');
    const approved = all.filter(t => t.status === 'approved');
    const totalApproved = approved.reduce((s, t) => s + tripTotal(t), 0);
    const yr = String(new Date().getFullYear());
    const thisYearCost = all.filter(t => (t.from || '').startsWith(yr) && ['approved', 'settled'].includes(t.status))
        .reduce((s, t) => s + tripTotal(t), 0);

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:var(--hr-pri)">✈️ الانتداب وبدل السفر</div>
            <button class="btn b-p" onclick="trOpen()" style="font-weight:800">➕ طلب انتداب</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${wfKpi('⏳', 'بانتظار الاعتماد', pending.length, pending.length ? 'var(--hr-warn)' : 'var(--hr-muted)')}
            ${wfKpi('✅', 'معتمدة', approved.length, 'var(--hr-ok-d)')}
            ${wfKpi('💰', 'قيمة المعتمدة', wfMoney(totalApproved), 'var(--hr-blue)', 'ريال')}
            ${wfKpi('📅', `تكلفة ${yr}`, wfMoney(thisYearCost), 'var(--hr-alt)', 'معتمدة ومُصفّاة')}
        </div>
        <div class="card">
            ${isHR ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
                <select onchange="window._trF.emp=this.value;renderTrips()" style="${wfInp()};width:auto"><option value="">كل الموظفين</option>${wfEmpOptions(f.emp)}</select>
                <select onchange="window._trF.status=this.value;renderTrips()" style="${wfInp()};width:auto">
                    <option value="">كل الحالات</option>
                    ${Object.entries(TRIP_STATUS).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
                </select>
            </div>` : ''}
            <table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <thead><tr style="text-align:right"><th style="padding:9px">الموظف</th><th>الوجهة</th><th>المشروع</th><th>من</th><th>إلى</th><th>الأيام</th><th>البدل/يوم</th><th>الإجمالي</th><th>الحالة</th><th></th></tr></thead>
                <tbody>${rows.length ? rows.map(t => {
                    const st = TRIP_STATUS[t.status || 'pending'] || TRIP_STATUS.pending;
                    const prj = (window.projects || {})[t.projectId];
                    const canAct = isHR || (typeof apvCanAct === 'function' && apvCanAct(t));
                    return `<tr>
                        <td style="padding:8px 9px;font-weight:700;color:var(--hr-ink)">${wfEsc(wfEmpName(t.empKey))}</td>
                        <td>${wfEsc(t.destination || '—')}</td>
                        <td style="font-size:11.5px;color:var(--hr-muted)">${wfEsc(prj?.name || '—')}</td>
                        <td style="white-space:nowrap">${wfEsc(t.from || '—')}</td>
                        <td style="white-space:nowrap">${wfEsc(t.to || '—')}</td>
                        <td style="text-align:center;font-weight:700">${tripDays(t.from, t.to)}</td>
                        <td style="text-align:left">${wfMoney(t.perDiem)}</td>
                        <td style="text-align:left;font-weight:800;color:var(--hr-pri2)">${wfMoney(tripTotal(t))}</td>
                        <td><span style="background:color-mix(in srgb, ${st.col} 9.41%, transparent);color:${st.col};padding:2px 9px;border-radius:9px;font-size:11px;font-weight:700;white-space:nowrap">${st.label}</span>
                            ${typeof apvStatusHtml === 'function' ? apvStatusHtml(t) : ''}</td>
                        <td style="text-align:left;white-space:nowrap">
                            ${(t.status || 'pending') === 'pending' && canAct ? `
                                <button class="btn b-g" style="padding:3px 8px;font-size:11px" onclick="trDecide('${t.k}',true)">✅</button>
                                <button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="trDecide('${t.k}',false)">❌</button>` : ''}
                            ${isHR && t.status === 'approved' ? `<button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="trSettle('${t.k}')">💰 تصفية</button>` : ''}
                            ${isHR ? `<button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="trDelete('${t.k}')">🗑️</button>` : ''}
                        </td>
                    </tr>`;
                }).join('') : '<tr><td colspan="10" style="text-align:center;color:#aaa;padding:24px">لا انتدابات</td></tr>'}</tbody>
            </table>
        </div>
    </div>`;
};

window.trOpen = function () {
    const isHR = wfCanHR();
    const prjOpts = Object.entries(window.projects || {})
        .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'))
        .map(([k, p]) => `<option value="${k}">${wfEsc(p.name || '-')}</option>`).join('');
    wfModal('wfTrModal', '✈️ طلب انتداب', `
        <div class="form-grid sm">
            ${isHR ? `<div class="fg"><label>الموظف *</label><select id="trEmp" style="${wfInp()}"><option value="">— اختر —</option>${wfEmpOptions()}</select></div>` : ''}
            <div class="fg"><label>الوجهة *</label><input id="trDest" placeholder="مثال: الرياض" style="${wfInp()}"></div>
            <div class="fg"><label>المشروع (اختياري)</label><select id="trPrj" style="${wfInp()}"><option value="">— بدون —</option>${prjOpts}</select></div>
            <div class="fg"><label>من *</label><input type="date" id="trFrom" oninput="trCalc()" style="${wfInp()}"></div>
            <div class="fg"><label>إلى *</label><input type="date" id="trTo" oninput="trCalc()" style="${wfInp()}"></div>
            <div class="fg"><label>بدل الانتداب اليومي (ريال) *</label><input type="number" step="0.01" id="trPerDiem" value="0" oninput="trCalc()" style="${wfInp()}"></div>
            <div class="fg"><label>تذاكر/مواصلات</label><input type="number" step="0.01" id="trTransport" value="0" oninput="trCalc()" style="${wfInp()}"></div>
            <div class="fg"><label>سكن</label><input type="number" step="0.01" id="trAccom" value="0" oninput="trCalc()" style="${wfInp()}"></div>
            <div class="fg"><label>أخرى</label><input type="number" step="0.01" id="trOther" value="0" oninput="trCalc()" style="${wfInp()}"></div>
        </div>
        <div class="fg" style="margin-top:10px"><label>الغرض *</label><textarea id="trPurpose" rows="2" style="${wfInp()};resize:vertical"></textarea></div>
        <div id="trCalcBox" style="margin-top:12px;background:var(--hr-sf3);border:1.5px solid var(--hr-bd);border-radius:8px;padding:10px;font-size:13px"></div>
    `, `<button class="btn b-p" onclick="trSave()" style="flex:1;font-weight:800">📤 إرسال الطلب</button>`);
    trCalc();
};

window.trCalc = function () {
    const box = document.getElementById('trCalcBox'); if (!box) return;
    const g = id => parseFloat(document.getElementById(id)?.value) || 0;
    const from = document.getElementById('trFrom')?.value || '';
    const to = document.getElementById('trTo')?.value || '';
    if (from && to && to < from) { box.innerHTML = '<span style="color:var(--hr-danger);font-weight:700">⚠️ تاريخ العودة قبل الذهاب</span>'; return; }
    const d = tripDays(from, to);
    const perDiemTotal = g('trPerDiem') * d;
    const total = perDiemTotal + g('trTransport') + g('trAccom') + g('trOther');
    box.innerHTML = `<b>${d}</b> يوم × <b>${wfMoney(g('trPerDiem'))}</b> = <b>${wfMoney(perDiemTotal)}</b> بدل انتداب
        <span style="color:var(--hr-muted)"> · مواصلات ${wfMoney(g('trTransport'))} · سكن ${wfMoney(g('trAccom'))} · أخرى ${wfMoney(g('trOther'))}</span>
        <div style="margin-top:6px;font-size:16px;font-weight:900;color:var(--hr-pri2)">الإجمالي: ${wfMoney(total)} ريال</div>`;
};

window.trSave = async function () {
    const isHR = wfCanHR();
    const empKey = isHR ? (document.getElementById('trEmp')?.value || '') : (myP?.empKey || '');
    const destination = (document.getElementById('trDest')?.value || '').trim();
    const from = document.getElementById('trFrom')?.value || '';
    const to = document.getElementById('trTo')?.value || '';
    const purpose = (document.getElementById('trPurpose')?.value || '').trim();
    if (!empKey) { toast('حدّد الموظف', 'er'); return; }
    if (!destination || !from || !to || !purpose) { toast('الوجهة والتواريخ والغرض مطلوبة', 'er'); return; }
    if (to < from) { toast('تاريخ العودة قبل الذهاب', 'er'); return; }
    const g = id => parseFloat(document.getElementById(id)?.value) || 0;
    const rec = {
        empKey, destination, purpose,
        projectId: document.getElementById('trPrj')?.value || '',
        from, to,
        perDiem: g('trPerDiem'), transport: g('trTransport'),
        accommodation: g('trAccom'), other: g('trOther'),
        status: 'pending',
        requestedBy: curU?.uid || '', requestedAt: new Date().toISOString()
    };
    // اربط سلسلة الموافقات إن كانت مفعّلة لهذا النوع
    if (typeof apvInit === 'function') {
        try { const ap = apvInit('trip', (window.emp || {})[empKey]); if (ap) rec.approval = ap; } catch (e) { }
    }
    try {
        await push(R.trips, rec);
        if (typeof logAudit === 'function') logAudit('create', 'hr', `طلب انتداب: ${wfEmpName(empKey)} → ${destination}`);
        wfClose('wfTrModal'); toast('📤 أُرسل الطلب', 'ok');
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.trDecide = function (key, approve) {
    const t = (window.businessTrips || {})[key]; if (!t) return;
    cf2(`${approve ? 'اعتماد' : 'رفض'} انتداب "${wfEmpName(t.empKey)}"؟`, async () => {
        try {
            // إن كانت سلسلة موافقات مفعّلة، مرّرها للمحرّك (يتولّى التقدّم والحالة)
            if (typeof apvActive === 'function' && apvActive('trip') && typeof apvDecide === 'function') {
                await apvDecide('trip', key, { ...t, k: key }, approve, '');
            } else {
                await update(ref(db, 'ledger/businessTrips/' + key), {
                    status: approve ? 'approved' : 'rejected',
                    decidedBy: myP?.name || '', decidedAt: new Date().toISOString()
                });
            }
            if (typeof logAudit === 'function') logAudit(approve ? 'approve' : 'reject', 'hr', `انتداب ${wfEmpName(t.empKey)} → ${t.destination}`);
            toast(approve ? '✅ اعتُمد' : '❌ رُفض', 'ok');
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

window.trSettle = function (key) {
    const t = (window.businessTrips || {})[key]; if (!t) return;
    cf2(`تصفية انتداب "${wfEmpName(t.empKey)}" بمبلغ ${wfMoney(tripTotal(t))} ريال؟`, async () => {
        try {
            await update(ref(db, 'ledger/businessTrips/' + key), {
                status: 'settled', settledAmount: tripTotal(t),
                settledBy: myP?.name || '', settledAt: new Date().toISOString()
            });
            if (typeof logAudit === 'function') logAudit('update', 'hr', `تصفية انتداب: ${wfEmpName(t.empKey)} — ${wfMoney(tripTotal(t))}`);
            toast('💰 صُفّي', 'ok');
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

window.trDelete = function (key) {
    const t = (window.businessTrips || {})[key];
    cf2(`حذف انتداب "${wfEmpName(t?.empKey)}"؟`, async () => {
        try {
            await remove(ref(db, 'ledger/businessTrips/' + key));
            if (typeof logAudit === 'function') logAudit('delete', 'hr', `حذف انتداب: ${wfEmpName(t?.empKey)}`);
            toast('🗑️ حُذف', 'ok');
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  [HRW3] 🪜 السلم الوظيفي والدرجات — بطاقة داخل صفحة الإدارات
//  ledger/salaryGrades/{key} = { code, name, minSalary, midSalary, maxSalary }
//  الموظف يُربط بدرجة عبر emp.gradeId، ويُنبَّه إن خرج راتبه عن النطاق.
// ═══════════════════════════════════════════════════════════════════════════
window.renderGrades = function () {
    const c = document.getElementById('gradesCard'); if (!c) return;
    const canEdit = myP?.role === 'admin' || (typeof can === 'function' && can('edit_settings'));
    const grades = Object.entries(window.salaryGrades || {}).map(([k, g]) => ({ k, ...g }))
        .sort((a, b) => (a.code || '').localeCompare(b.code || '', 'ar', { numeric: true }));

    // من خرج راتبه عن نطاق درجته؟
    const outliers = [];
    Object.entries(window.emp || {}).forEach(([k, e]) => {
        if (e.status === 'inactive' || !e.gradeId) return;
        const g = (window.salaryGrades || {})[e.gradeId]; if (!g) return;
        const sal = parseFloat(e.salary) || 0;
        const mn = parseFloat(g.minSalary) || 0, mx = parseFloat(g.maxSalary) || 0;
        if (mn && sal < mn) outliers.push({ name: e.name, sal, g, dir: 'تحت' });
        else if (mx && sal > mx) outliers.push({ name: e.name, sal, g, dir: 'فوق' });
    });
    const assigned = Object.values(window.emp || {}).filter(e => e.status !== 'inactive' && e.gradeId).length;
    const activeCount = Object.values(window.emp || {}).filter(e => e.status !== 'inactive').length;

    c.innerHTML = `<div class="card" style="border-right:5px solid var(--hr-alt)">
        <div class="c-tl">🪜 السلم الوظيفي والدرجات</div>
        <div class="hr-info" style="margin-bottom:14px">
            درجات وظيفية بنطاق راتب (أدنى · متوسط · أعلى) تُربط بالموظف من نموذجه. تمنع اجتهاد الرواتب الفردي وتكشف من خرج عن نطاق درجته.
        </div>
        ${canEdit ? `<div class="form-grid sm">
            <div class="fg"><label>الرمز *</label><input id="grCode" placeholder="G1" style="${wfInp()}"></div>
            <div class="fg"><label>المسمّى *</label><input id="grName" placeholder="مهندس أول" style="${wfInp()}"></div>
            <div class="fg"><label>أدنى راتب</label><input type="number" step="0.01" id="grMin" style="${wfInp()}"></div>
            <div class="fg"><label>المتوسط</label><input type="number" step="0.01" id="grMid" style="${wfInp()}"></div>
            <div class="fg"><label>أعلى راتب</label><input type="number" step="0.01" id="grMax" style="${wfInp()}"></div>
        </div>
        <div class="card-actions"><button class="btn b-p" onclick="grSave()">➕ إضافة درجة</button></div>` : ''}
        <div style="margin-top:12px;font-size:12px;color:var(--hr-muted)">${grades.length} درجة · ${assigned} من ${activeCount} موظف نشط مُسنَد لدرجة</div>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px">
            <thead><tr style="text-align:right"><th style="padding:8px">الرمز</th><th>المسمّى</th><th>أدنى</th><th>متوسط</th><th>أعلى</th><th>الموظفون</th>${canEdit ? '<th></th>' : ''}</tr></thead>
            <tbody>${grades.length ? grades.map(g => {
                const n = Object.values(window.emp || {}).filter(e => e.status !== 'inactive' && e.gradeId === g.k).length;
                return `<tr>
                    <td style="padding:8px;font-weight:800;color:var(--hr-alt)">${wfEsc(g.code || '—')}</td>
                    <td style="font-weight:700;color:var(--hr-ink)">${wfEsc(g.name || '—')}</td>
                    <td style="text-align:left">${g.minSalary ? wfMoney(g.minSalary) : '—'}</td>
                    <td style="text-align:left">${g.midSalary ? wfMoney(g.midSalary) : '—'}</td>
                    <td style="text-align:left">${g.maxSalary ? wfMoney(g.maxSalary) : '—'}</td>
                    <td style="text-align:center;font-weight:700">${n || '—'}</td>
                    ${canEdit ? `<td style="text-align:left"><button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="grDelete('${g.k}')">🗑️</button></td>` : ''}
                </tr>`;
            }).join('') : `<tr><td colspan="${canEdit ? 7 : 6}" style="text-align:center;color:#aaa;padding:20px">لا درجات مسجّلة</td></tr>`}</tbody>
        </table>
        ${outliers.length ? `<div style="margin-top:12px;background:color-mix(in srgb, var(--hr-warn) 9.41%, transparent);border:1.5px solid var(--hr-warn);border-radius:8px;padding:10px">
            <div style="font-weight:800;color:var(--hr-warn-d);font-size:12.5px;margin-bottom:6px">⚠️ ${outliers.length} موظف راتبه خارج نطاق درجته</div>
            ${outliers.slice(0, 12).map(o => `<div style="font-size:12px;color:var(--hr-ink)">• ${wfEsc(o.name)} — ${wfMoney(o.sal)} (${o.dir} نطاق ${wfEsc(o.g.code || '')}: ${wfMoney(o.g.minSalary)}–${wfMoney(o.g.maxSalary)})</div>`).join('')}
            ${outliers.length > 12 ? `<div style="font-size:11.5px;color:var(--hr-muted);margin-top:4px">+${outliers.length - 12} آخرين</div>` : ''}
        </div>` : ''}
    </div>`;
};

window.grSave = async function () {
    if (!(myP?.role === 'admin' || (typeof can === 'function' && can('edit_settings')))) { toast('ليس لديك صلاحية', 'er'); return; }
    const code = (document.getElementById('grCode')?.value || '').trim();
    const name = (document.getElementById('grName')?.value || '').trim();
    if (!code || !name) { toast('الرمز والمسمّى مطلوبان', 'er'); return; }
    const mn = parseFloat(document.getElementById('grMin')?.value) || 0;
    const mx = parseFloat(document.getElementById('grMax')?.value) || 0;
    if (mn && mx && mx < mn) { toast('أعلى راتب أقل من أدناه', 'er'); return; }
    try {
        await push(R.grades, {
            code, name, minSalary: mn,
            midSalary: parseFloat(document.getElementById('grMid')?.value) || 0,
            maxSalary: mx,
            addedAt: new Date().toISOString()
        });
        if (typeof logAudit === 'function') logAudit('create', 'hr', `درجة وظيفية: ${code} — ${name}`);
        ['grCode', 'grName', 'grMin', 'grMid', 'grMax'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        toast('🪜 أُضيفت الدرجة', 'ok');
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.grDelete = function (key) {
    const g = (window.salaryGrades || {})[key];
    const used = Object.values(window.emp || {}).filter(e => e.gradeId === key).length;
    cf2(`حذف الدرجة "${g?.code || ''} — ${g?.name || ''}"؟${used ? `\n\n⚠️ مُسنَدة إلى ${used} موظف؛ سيبقون بلا درجة.` : ''}`, async () => {
        try {
            await remove(ref(db, 'ledger/salaryGrades/' + key));
            if (typeof logAudit === 'function') logAudit('delete', 'hr', `حذف درجة وظيفية: ${g?.code || key}`);
            toast('🗑️ حُذفت', 'ok');
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// يملأ قائمة الدرجات في نموذج الموظف (يُستدعى عند فتح النموذج)
window.grFillEmpSelect = function (selected) {
    const sel = document.getElementById('eGrade'); if (!sel) return;
    const grades = Object.entries(window.salaryGrades || {})
        .sort((a, b) => (a[1].code || '').localeCompare(b[1].code || '', 'ar', { numeric: true }));
    sel.innerHTML = '<option value="">— بلا درجة —</option>' + grades.map(([k, g]) =>
        `<option value="${k}" ${selected === k ? 'selected' : ''}>${wfEsc(g.code || '')} — ${wfEsc(g.name || '')}${g.minSalary || g.maxSalary ? ` (${wfMoney(g.minSalary)}–${wfMoney(g.maxSalary)})` : ''}</option>`).join('');
};
