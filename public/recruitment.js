// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🧲  التوظيف والتعيين (Recruitment / ATS + Onboarding)                       ║
// ║  وحدة ثانوية تعتمد على globals من app.js. بياناتها تُعزَل تلقائياً للمستأجر.   ║
// ║  الشواغر ← المرشّحون (مراحل) ← تحويل لموظف + قوائم التعيين/إخلاء الطرف.        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// مراحل المرشّح
const RC_STAGES = {
    new: { label: '🆕 جديد', color: '#3498db' },
    screening: { label: '🔎 فرز', color: '#9b59b6' },
    interview: { label: '🗣️ مقابلة', color: '#e67e22' },
    offer: { label: '📄 عرض', color: '#f39c12' },
    hired: { label: '✅ تعيين', color: '#27ae60' },
    rejected: { label: '❌ مرفوض', color: '#c0392b' }
};
const RC_STAGE_ORDER = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];
const RC_JOB_STATUS = {
    open: { label: '🟢 مفتوح', color: '#27ae60' },
    onhold: { label: '⏸️ معلّق', color: '#e67e22' },
    closed: { label: '⚫ مغلق', color: '#7f8c8d' }
};
const RC_ONBOARD_TPL = ['توقيع عقد العمل', 'فتح حساب بنكي (IBAN)', 'تسجيل التأمينات الاجتماعية (GOSI)', 'التأمين الطبي', 'إصدار/نقل الإقامة', 'تسليم العهدة (لابتوب/هاتف/أدوات)', 'التعريف بسياسات الشركة', 'تحديد المدير المباشر والقسم', 'الإضافة إلى الحضور والمسير'];
const RC_OFFBOARD_TPL = ['خطاب الاستقالة/الإنهاء', 'تسليم العهد المستلمة', 'تسوية السلف والقروض', 'مخالصة نهاية الخدمة', 'إلغاء الإقامة/التأشيرة', 'إلغاء التأمين الطبي', 'مقابلة إنهاء الخدمة (Exit)', 'تعطيل الحسابات والصلاحيات', 'الإزالة من المسير'];

function rcEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function rcMoney(v) { return (typeof fmt === 'function') ? fmt(Number(v) || 0) : (Number(v) || 0).toLocaleString('en'); }
function rcJobs() { return window.jobPostings || {}; }
function rcCands() { return window.candidates || {}; }
function rcOnb() { return window.onboardings || {}; }
function rcJobName(id) { const j = rcJobs()[id]; return j ? (j.title || '—') : '—'; }
function rcInp() { return 'padding:8px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box'; }
function rcCan(p) { return (typeof can !== 'function') || can(p); }

// ── الصفحة الرئيسية (تبويبات) ────────────────────────────────────────────────
window.renderRecruitment = function () {
    const c = document.getElementById('pg-recruitment'); if (!c) return;
    window._rcTab = window._rcTab || 'jobs';
    const tab = window._rcTab;
    const tabBtn = (id, label) => `<button onclick="window._rcTab='${id}';renderRecruitment()" style="background:${tab === id ? '#16679a' : '#eef2f7'};color:${tab === id ? '#fff' : '#555'};border:none;padding:9px 18px;border-radius:9px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer">${label}</button>`;

    // مؤشرات
    const jobs = Object.values(rcJobs());
    const openJobs = jobs.filter(j => (j.status || 'open') === 'open');
    const openSeats = openJobs.reduce((s, j) => s + (parseInt(j.count) || 1), 0);
    const cands = Object.values(rcCands());
    const active = cands.filter(c2 => c2.stage !== 'rejected' && c2.stage !== 'hired');
    const inInterview = cands.filter(c2 => c2.stage === 'interview' || c2.stage === 'offer').length;
    const hired = cands.filter(c2 => c2.stage === 'hired').length;
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">🧲 التوظيف والتعيين</div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('🧲', 'شواغر مفتوحة', openJobs.length, '#2980b9')}
            ${kpi('🪑', 'إجمالي المقاعد المطلوبة', openSeats, '#8e44ad')}
            ${kpi('🧑‍💼', 'مرشّحون قيد التوظيف', active.length, '#e67e22')}
            ${kpi('🗣️', 'مقابلة/عرض', inInterview, '#f39c12')}
            ${kpi('✅', 'تم تعيينهم', hired, '#27ae60')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
            ${tabBtn('jobs', '🧲 الشواغر')}
            ${tabBtn('candidates', '🧑‍💼 المرشّحون')}
            ${tabBtn('onboard', '📋 التعيين وإخلاء الطرف')}
        </div>
        <div id="rcTabBody"></div>
    </div>`;
    if (tab === 'jobs') rcRenderJobs();
    else if (tab === 'candidates') rcRenderCandidates();
    else rcRenderOnboard();
};

// ── تبويب الشواغر ────────────────────────────────────────────────────────────
function rcRenderJobs() {
    const body = document.getElementById('rcTabBody'); if (!body) return;
    const rows = Object.entries(rcJobs()).map(([k, j]) => ({ k, ...j })).sort((a, b) => (b.postedDate || '').localeCompare(a.postedDate || ''));
    const applicants = k => Object.values(rcCands()).filter(c2 => c2.jobKey === k).length;
    body.innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">${rcCan('manage_employees') || rcCan('view_employees') ? '<button class="btn b-g" onclick="rcOpenJob()" style="font-weight:800">➕ إضافة شاغر</button>' : ''}</div>
        <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <thead><tr style="background:#f4f6f9;color:#555;text-align:right">
                    <th style="padding:9px">المسمى</th><th>القسم</th><th>العدد</th><th>النوع</th><th>الموقع</th><th>المرشّحون</th><th>الحالة</th><th></th>
                </tr></thead>
                <tbody>${rows.length ? rows.map(j => `<tr style="border-bottom:1px solid #f3f3f3">
                    <td style="padding:8px 9px;font-weight:700">${rcEsc(j.title)}</td>
                    <td>${rcEsc(j.dept || '—')}</td>
                    <td style="text-align:center">${j.count || 1}</td>
                    <td>${rcEsc(j.type || '—')}</td>
                    <td>${rcEsc(j.location || '—')}</td>
                    <td style="text-align:center"><button class="btn" onclick="window._rcTab='candidates';window._rcCandJob='${j.k}';renderRecruitment()" style="font-size:11px;padding:3px 9px;background:#eef5fb;color:#2d6a9f">${applicants(j.k)} مرشّح</button></td>
                    <td><span style="background:${(RC_JOB_STATUS[j.status] || RC_JOB_STATUS.open).color}20;color:${(RC_JOB_STATUS[j.status] || RC_JOB_STATUS.open).color};padding:2px 9px;border-radius:8px;font-size:11px;font-weight:700">${(RC_JOB_STATUS[j.status] || RC_JOB_STATUS.open).label}</span></td>
                    <td style="text-align:left;white-space:nowrap"><button class="btn" onclick="rcOpenJob('${j.k}')" style="font-size:11px;padding:3px 7px">✏️</button> <button class="btn b-r" onclick="rcDeleteJob('${j.k}')" style="font-size:11px;padding:3px 7px">🗑️</button></td>
                </tr>`).join('') : '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:24px">لا شواغر — أضف أول شاغر</td></tr>'}</tbody>
            </table>
        </div>`;
}
window.rcOpenJob = function (key) {
    rcEnsureJobModal();
    const j = key ? rcJobs()[key] : null;
    document.getElementById('rcJobKey').value = key || '';
    document.getElementById('rcJobModalTitle').textContent = j ? '✏️ تعديل شاغر' : '🧲 إضافة شاغر';
    // قائمة الأقسام
    const depts = Object.values(window.departments || {}).map(d => d.name).filter(Boolean);
    const dl = document.getElementById('rcJobDeptList'); if (dl) dl.innerHTML = depts.map(d => `<option value="${rcEsc(d)}">`).join('');
    const prjs = Object.entries(window.projects || {}).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'));
    document.getElementById('rcJobPrj').innerHTML = '<option value="">— بدون مشروع —</option>' + prjs.map(([k, p]) => `<option value="${k}">${rcEsc(p.name)}</option>`).join('');
    document.getElementById('rcJobTitle').value = j?.title || '';
    document.getElementById('rcJobDept').value = j?.dept || '';
    document.getElementById('rcJobPrj').value = j?.projectId || '';
    document.getElementById('rcJobCount').value = j?.count ?? 1;
    document.getElementById('rcJobType').value = j?.type || 'دوام كامل';
    document.getElementById('rcJobLoc').value = j?.location || '';
    document.getElementById('rcJobStatus').value = j?.status || 'open';
    document.getElementById('rcJobReq').value = j?.requirements || '';
    document.getElementById('rcJobDesc').value = j?.description || '';
    document.getElementById('rcJobModal').style.display = 'flex';
};
window.rcCloseJob = function () { const m = document.getElementById('rcJobModal'); if (m) m.style.display = 'none'; };
function rcEnsureJobModal() {
    if (document.getElementById('rcJobModal')) return;
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const d = document.createElement('div');
    d.id = 'rcJobModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:600px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 id="rcJobModalTitle" style="margin:0;color:#2d6a9f;font-size:18px">🧲 إضافة شاغر</h3><button onclick="rcCloseJob()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <input id="rcJobKey" type="hidden">
        ${fg('المسمى الوظيفي *', `<input id="rcJobTitle" style="width:100%;${rcInp()}">`)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('القسم', `<input id="rcJobDept" list="rcJobDeptList" style="width:100%;${rcInp()}"><datalist id="rcJobDeptList"></datalist>`)}
            ${fg('المشروع', `<select id="rcJobPrj" style="width:100%;${rcInp()}"></select>`)}
            ${fg('عدد المطلوب', `<input id="rcJobCount" type="number" min="1" value="1" style="width:100%;${rcInp()}">`)}
            ${fg('نوع التعاقد', `<select id="rcJobType" style="width:100%;${rcInp()}"><option>دوام كامل</option><option>دوام جزئي</option><option>عقد مؤقت</option><option>تدريب</option></select>`)}
            ${fg('الموقع', `<input id="rcJobLoc" style="width:100%;${rcInp()}">`)}
            ${fg('الحالة', `<select id="rcJobStatus" style="width:100%;${rcInp()}"><option value="open">🟢 مفتوح</option><option value="onhold">⏸️ معلّق</option><option value="closed">⚫ مغلق</option></select>`)}
        </div>
        ${fg('المتطلبات', `<textarea id="rcJobReq" rows="2" style="width:100%;${rcInp()};resize:vertical"></textarea>`)}
        ${fg('الوصف الوظيفي', `<textarea id="rcJobDesc" rows="2" style="width:100%;${rcInp()};resize:vertical"></textarea>`)}
        <div style="display:flex;gap:8px"><button class="btn b-g" onclick="rcSaveJob()" style="flex:1;font-weight:800">💾 حفظ</button><button class="btn" onclick="rcCloseJob()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.rcSaveJob = async function () {
    const key = document.getElementById('rcJobKey').value;
    const title = document.getElementById('rcJobTitle').value.trim();
    if (!title) { toast('⚠️ المسمى الوظيفي مطلوب', 'er'); return; }
    const data = {
        title, dept: document.getElementById('rcJobDept').value.trim(), projectId: document.getElementById('rcJobPrj').value,
        count: parseInt(document.getElementById('rcJobCount').value) || 1, type: document.getElementById('rcJobType').value,
        location: document.getElementById('rcJobLoc').value.trim(), status: document.getElementById('rcJobStatus').value,
        requirements: document.getElementById('rcJobReq').value.trim(), description: document.getElementById('rcJobDesc').value.trim(),
        updatedAt: new Date().toISOString()
    };
    try {
        if (key) await window.update(window.ref(window.db, 'ledger/jobPostings/' + key), data);
        else { data.postedDate = new Date().toISOString().slice(0, 10); data.createdBy = (window.curU && window.curU.uid) || ''; await window.push(window.R.jobPostings, data); }
        toast('✓ تم الحفظ', 'ok'); rcCloseJob();
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.rcDeleteJob = async function (key) {
    const n = Object.values(rcCands()).filter(c2 => c2.jobKey === key).length;
    if (!(await cf2(n ? `لهذا الشاغر ${n} مرشّح — حذف الشاغر لا يحذفهم. متابعة؟` : 'حذف هذا الشاغر؟'))) return;
    try { await window.remove(window.ref(window.db, 'ledger/jobPostings/' + key)); toast('🗑️ تم الحذف', 'ok'); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// ── تبويب المرشّحين ──────────────────────────────────────────────────────────
function rcRenderCandidates() {
    const body = document.getElementById('rcTabBody'); if (!body) return;
    window._rcCandJob = window._rcCandJob || '';
    window._rcCandStage = window._rcCandStage || '';
    const jobF = window._rcCandJob, stageF = window._rcCandStage;
    const rows = Object.entries(rcCands()).map(([k, c2]) => ({ k, ...c2 }))
        .filter(c2 => (!jobF || c2.jobKey === jobF) && (!stageF || (c2.stage || 'new') === stageF))
        .sort((a, b) => (b.appliedDate || '').localeCompare(a.appliedDate || ''));
    const jobOpts = Object.entries(rcJobs()).map(([k, j]) => `<option value="${k}" ${jobF === k ? 'selected' : ''}>${rcEsc(j.title)}</option>`).join('');
    const stageOpts = RC_STAGE_ORDER.map(s => `<option value="${s}" ${stageF === s ? 'selected' : ''}>${RC_STAGES[s].label}</option>`).join('');
    const stars = n => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    body.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;background:#fff;padding:12px 14px;border-radius:10px;margin-bottom:14px">
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">الشاغر</label><select onchange="window._rcCandJob=this.value;renderRecruitment()" style="${rcInp()}"><option value="">كل الشواغر</option>${jobOpts}</select></div>
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">المرحلة</label><select onchange="window._rcCandStage=this.value;renderRecruitment()" style="${rcInp()}"><option value="">كل المراحل</option>${stageOpts}</select></div>
            <button class="btn" onclick="window._rcCandJob='';window._rcCandStage='';renderRecruitment()" style="background:#f0f0f0">↺ إعادة ضبط</button>
            <div style="flex:1"></div>
            <button class="btn b-g" onclick="rcOpenCand()" style="font-weight:800">➕ إضافة مرشّح</button>
        </div>
        <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <thead><tr style="background:#f4f6f9;color:#555;text-align:right">
                    <th style="padding:9px">الاسم</th><th>الشاغر</th><th>الجوال</th><th>الراتب المتوقع</th><th>التقييم</th><th>المرحلة</th><th></th>
                </tr></thead>
                <tbody>${rows.length ? rows.map(c2 => {
        const st = RC_STAGES[c2.stage] || RC_STAGES.new;
        return `<tr style="border-bottom:1px solid #f3f3f3">
                    <td style="padding:8px 9px;font-weight:700">${rcEsc(c2.name)}${c2.hiredEmpKey ? ' <span style="color:#27ae60;font-size:11px">↪ موظف</span>' : ''}</td>
                    <td style="color:#666">${rcEsc(rcJobName(c2.jobKey))}</td>
                    <td style="direction:ltr;text-align:right">${rcEsc(c2.phone || '—')}</td>
                    <td style="text-align:center">${c2.expectedSalary ? rcMoney(c2.expectedSalary) : '—'}</td>
                    <td style="text-align:center;color:#f39c12;letter-spacing:1px">${stars(parseInt(c2.rating) || 0)}</td>
                    <td><select onchange="rcSetStage('${c2.k}',this.value)" style="border:1.5px solid ${st.color};color:${st.color};border-radius:8px;padding:3px 6px;font-family:inherit;font-size:11px;font-weight:700;background:${st.color}12">${RC_STAGE_ORDER.map(s => `<option value="${s}" ${(c2.stage || 'new') === s ? 'selected' : ''}>${RC_STAGES[s].label}</option>`).join('')}</select></td>
                    <td style="text-align:left;white-space:nowrap">
                        ${c2.stage === 'hired' && !c2.hiredEmpKey ? `<button class="btn b-g" onclick="rcConvertToEmp('${c2.k}')" style="font-size:11px;padding:3px 8px">👷 تحويل لموظف</button> ` : ''}
                        <button class="btn" onclick="rcOpenCand('${c2.k}')" style="font-size:11px;padding:3px 7px">✏️</button>
                        <button class="btn b-r" onclick="rcDeleteCand('${c2.k}')" style="font-size:11px;padding:3px 7px">🗑️</button>
                    </td>
                </tr>`;
    }).join('') : '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px">لا مرشّحون بعد</td></tr>'}</tbody>
            </table>
        </div>`;
}
window.rcSetStage = async function (key, stage) {
    try { await window.update(window.ref(window.db, 'ledger/candidates/' + key), { stage }); toast('✓ ' + (RC_STAGES[stage]?.label || stage), 'ok'); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.rcOpenCand = function (key) {
    rcEnsureCandModal();
    const c2 = key ? rcCands()[key] : null;
    document.getElementById('rcCandKey').value = key || '';
    document.getElementById('rcCandModalTitle').textContent = c2 ? '✏️ تعديل مرشّح' : '🧑‍💼 إضافة مرشّح';
    const jobOpts = '<option value="">— اختر —</option>' + Object.entries(rcJobs()).map(([k, j]) => `<option value="${k}">${rcEsc(j.title)}</option>`).join('');
    document.getElementById('rcCandJobSel').innerHTML = jobOpts;
    document.getElementById('rcCandName').value = c2?.name || '';
    document.getElementById('rcCandJobSel').value = c2?.jobKey || (window._rcCandJob || '');
    document.getElementById('rcCandPhone').value = c2?.phone || '';
    document.getElementById('rcCandEmail').value = c2?.email || '';
    document.getElementById('rcCandNat').value = c2?.nationality || '';
    document.getElementById('rcCandSource').value = c2?.source || '';
    document.getElementById('rcCandSalary').value = c2?.expectedSalary ?? '';
    document.getElementById('rcCandStage').value = c2?.stage || 'new';
    document.getElementById('rcCandRating').value = c2?.rating || 0;
    document.getElementById('rcCandCv').value = c2?.cvUrl || '';
    document.getElementById('rcCandNotes').value = c2?.notes || '';
    window._rcIntv = Array.isArray(c2?.interviews) ? JSON.parse(JSON.stringify(c2.interviews)) : [];
    rcRenderIntv();
    document.getElementById('rcCandModal').style.display = 'flex';
};
window.rcCloseCand = function () { const m = document.getElementById('rcCandModal'); if (m) m.style.display = 'none'; };
function rcRenderIntv() {
    const box = document.getElementById('rcIntvList'); if (!box) return;
    const iv = window._rcIntv || [];
    box.innerHTML = (iv.length ? iv.map((it, i) => `<div style="display:flex;gap:6px;align-items:center;margin-bottom:5px;font-size:12px;background:#f7f9fb;padding:6px 8px;border-radius:8px">
        <span style="flex:1">🗣️ ${rcEsc(it.date || '')} · ${rcEsc(it.type || '')} · ${rcEsc(it.interviewer || '')} — <b style="color:${it.result === 'pass' ? '#27ae60' : it.result === 'fail' ? '#c0392b' : '#888'}">${it.result === 'pass' ? 'ناجح' : it.result === 'fail' ? 'غير مناسب' : 'قيد التقييم'}</b>${it.notes ? ' · ' + rcEsc(it.notes) : ''}</span>
        <button class="btn b-r" onclick="rcDelIntv(${i})" style="font-size:10px;padding:2px 6px">✕</button></div>`).join('') : '<div style="color:#aaa;font-size:12px">لا مقابلات مسجّلة</div>');
}
window.rcDelIntv = function (i) { window._rcIntv.splice(i, 1); rcRenderIntv(); };
window.rcAddIntv = function () {
    const date = document.getElementById('rcIntvDate').value;
    const type = document.getElementById('rcIntvType').value.trim();
    if (!date) { toast('⚠️ حدّد تاريخ المقابلة', 'er'); return; }
    window._rcIntv = window._rcIntv || [];
    window._rcIntv.push({ date, type: type || 'مقابلة', interviewer: document.getElementById('rcIntvBy').value.trim(), result: document.getElementById('rcIntvResult').value, notes: document.getElementById('rcIntvNotes').value.trim() });
    document.getElementById('rcIntvDate').value = ''; document.getElementById('rcIntvType').value = ''; document.getElementById('rcIntvBy').value = ''; document.getElementById('rcIntvNotes').value = '';
    rcRenderIntv();
};
function rcEnsureCandModal() {
    if (document.getElementById('rcCandModal')) return;
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const d = document.createElement('div');
    d.id = 'rcCandModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 id="rcCandModalTitle" style="margin:0;color:#2d6a9f;font-size:18px">🧑‍💼 إضافة مرشّح</h3><button onclick="rcCloseCand()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <input id="rcCandKey" type="hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('الاسم *', `<input id="rcCandName" style="width:100%;${rcInp()}">`)}
            ${fg('الشاغر', `<select id="rcCandJobSel" style="width:100%;${rcInp()}"></select>`)}
            ${fg('الجوال', `<input id="rcCandPhone" style="width:100%;${rcInp()};direction:ltr;text-align:right">`)}
            ${fg('البريد', `<input id="rcCandEmail" style="width:100%;${rcInp()};direction:ltr;text-align:right">`)}
            ${fg('الجنسية', `<input id="rcCandNat" placeholder="سعودي / مصري..." style="width:100%;${rcInp()}">`)}
            ${fg('مصدر التقديم', `<input id="rcCandSource" placeholder="لينكدإن / توصية / موقع..." style="width:100%;${rcInp()}">`)}
            ${fg('الراتب المتوقع', `<input id="rcCandSalary" type="number" min="0" style="width:100%;${rcInp()}">`)}
            ${fg('المرحلة', `<select id="rcCandStage" style="width:100%;${rcInp()}">${RC_STAGE_ORDER.map(s => `<option value="${s}">${RC_STAGES[s].label}</option>`).join('')}</select>`)}
            ${fg('التقييم', `<select id="rcCandRating" style="width:100%;${rcInp()}"><option value="0">— بدون —</option><option value="1">★☆☆☆☆</option><option value="2">★★☆☆☆</option><option value="3">★★★☆☆</option><option value="4">★★★★☆</option><option value="5">★★★★★</option></select>`)}
            ${fg('رابط السيرة الذاتية', `<input id="rcCandCv" placeholder="https://..." style="width:100%;${rcInp()};direction:ltr;text-align:right">`)}
        </div>
        ${fg('ملاحظات', `<textarea id="rcCandNotes" rows="2" style="width:100%;${rcInp()};resize:vertical"></textarea>`)}
        <div style="border-top:1px solid #eee;margin:6px 0 12px;padding-top:12px">
            <div style="font-size:13px;font-weight:800;color:#2d6a9f;margin-bottom:8px">🗣️ المقابلات</div>
            <div id="rcIntvList" style="margin-bottom:8px"></div>
            <div style="display:grid;grid-template-columns:auto 1fr 1fr auto;gap:6px;align-items:end">
                <input id="rcIntvDate" type="date" style="${rcInp()}">
                <input id="rcIntvType" placeholder="نوع (فني/HR)" style="${rcInp()}">
                <input id="rcIntvBy" placeholder="المُقابِل" style="${rcInp()}">
                <select id="rcIntvResult" style="${rcInp()}"><option value="pending">قيد التقييم</option><option value="pass">ناجح</option><option value="fail">غير مناسب</option></select>
            </div>
            <div style="display:flex;gap:6px;margin-top:6px"><input id="rcIntvNotes" placeholder="ملاحظات المقابلة" style="flex:1;${rcInp()}"><button class="btn" onclick="rcAddIntv()" style="background:#eef5fb;color:#2d6a9f;font-weight:700">➕ إضافة مقابلة</button></div>
        </div>
        <div style="display:flex;gap:8px"><button class="btn b-g" onclick="rcSaveCand()" style="flex:1;font-weight:800">💾 حفظ</button><button class="btn" onclick="rcCloseCand()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.rcSaveCand = async function () {
    const key = document.getElementById('rcCandKey').value;
    const name = document.getElementById('rcCandName').value.trim();
    if (!name) { toast('⚠️ اسم المرشّح مطلوب', 'er'); return; }
    const data = {
        name, jobKey: document.getElementById('rcCandJobSel').value, phone: document.getElementById('rcCandPhone').value.trim(),
        email: document.getElementById('rcCandEmail').value.trim(), nationality: document.getElementById('rcCandNat').value.trim(),
        source: document.getElementById('rcCandSource').value.trim(), expectedSalary: parseFloat(document.getElementById('rcCandSalary').value) || 0,
        stage: document.getElementById('rcCandStage').value, rating: parseInt(document.getElementById('rcCandRating').value) || 0,
        cvUrl: document.getElementById('rcCandCv').value.trim(), notes: document.getElementById('rcCandNotes').value.trim(),
        interviews: window._rcIntv || [], updatedAt: new Date().toISOString()
    };
    try {
        if (key) await window.update(window.ref(window.db, 'ledger/candidates/' + key), data);
        else { data.appliedDate = new Date().toISOString().slice(0, 10); data.createdBy = (window.curU && window.curU.uid) || ''; await window.push(window.R.candidates, data); }
        toast('✓ تم الحفظ', 'ok'); rcCloseCand();
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.rcDeleteCand = async function (key) {
    if (!(await cf2('حذف هذا المرشّح؟'))) return;
    try { await window.remove(window.ref(window.db, 'ledger/candidates/' + key)); toast('🗑️ تم الحذف', 'ok'); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
// تحويل المرشّح المُعيَّن إلى موظف: يفتح نموذج الموظف مملوءاً مسبقاً
window.rcConvertToEmp = function (key) {
    const c2 = rcCands()[key]; if (!c2) return;
    if (typeof window.openEmpM !== 'function') { toast('نموذج الموظف غير متاح', 'er'); return; }
    window.openEmpM();
    const set = (id, v) => { const el = document.getElementById(id); if (el != null && v != null && v !== '') el.value = v; };
    set('eNm', c2.name);
    set('eJob', rcJobs()[c2.jobKey]?.title || '');
    set('eNat', c2.nationality);
    set('eSalary', c2.expectedSalary || '');
    const j = rcJobs()[c2.jobKey];
    if (j?.dept) set('eDept', j.dept);
    if (typeof calcEmpSummary === 'function') calcEmpSummary();
    // اربط المرشّح بأنه حُوّل (لن نعرف مفتاح الموظف الجديد إلا بعد الحفظ اليدوي)
    window.update(window.ref(window.db, 'ledger/candidates/' + key), { hiredEmpKey: 'pending', stage: 'hired' }).catch(() => { });
    toast('📋 عُبّئ نموذج الموظف من بيانات المرشّح — أكمل واحفظ', 'ok');
};

// ── تبويب التعيين وإخلاء الطرف ───────────────────────────────────────────────
function rcRenderOnboard() {
    const body = document.getElementById('rcTabBody'); if (!body) return;
    const rows = Object.entries(rcOnb()).map(([k, o]) => ({ k, ...o }))
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    const prog = o => { const its = Object.values(o.items || {}); const done = its.filter(i => i.done).length; return { done, total: its.length, pct: its.length ? Math.round(done / its.length * 100) : 0 }; };
    body.innerHTML = `
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px">
            <button class="btn b-g" onclick="rcOpenNewChecklist('onboarding')" style="font-weight:800">➕ قائمة تعيين</button>
            <button class="btn" onclick="rcOpenNewChecklist('offboarding')" style="background:#fdecea;color:#c0392b;border:1.5px solid #f5b7b1;font-weight:800">➕ قائمة إخلاء طرف</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px">
        ${rows.length ? rows.map(o => {
        const p = prog(o); const off = o.type === 'offboarding';
        const col = off ? '#c0392b' : '#27ae60';
        return `<div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.05);border-top:3px solid ${col}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <div><div style="font-weight:800;color:#1a3a5c;font-size:14px">${rcEsc(o.empName || '—')}</div><div style="font-size:11px;color:#888">${off ? '🚪 إخلاء طرف' : '🎯 تعيين'} · ${rcEsc(o.startDate || '')}</div></div>
                    <button class="btn b-r" onclick="rcDeleteChecklist('${o.k}')" style="font-size:11px;padding:3px 7px">🗑️</button>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                    <div style="flex:1;background:#eef1f5;border-radius:6px;height:8px;overflow:hidden"><div style="width:${p.pct}%;background:${col};height:100%"></div></div>
                    <span style="font-size:12px;font-weight:800;color:${col}">${p.pct}%</span>
                </div>
                <div>${Object.entries(o.items || {}).map(([id, it]) => `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12.5px;cursor:pointer">
                    <input type="checkbox" ${it.done ? 'checked' : ''} onchange="rcToggleItem('${o.k}','${id}',this.checked)" style="width:15px;height:15px;cursor:pointer">
                    <span style="${it.done ? 'text-decoration:line-through;color:#aaa' : 'color:#444'}">${rcEsc(it.label)}</span>
                </label>`).join('')}</div>
            </div>`;
    }).join('') : '<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:30px">لا قوائم — أنشئ قائمة تعيين أو إخلاء طرف لموظف</div>'}
        </div>`;
}
window.rcOpenNewChecklist = async function (type) {
    const emps = Object.entries(window.emp || {}).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'));
    if (!emps.length) { toast('⚠️ لا يوجد موظفون', 'er'); return; }
    rcEnsureChecklistModal();
    document.getElementById('rcChkType').value = type;
    document.getElementById('rcChkTitle').textContent = type === 'offboarding' ? '🚪 قائمة إخلاء طرف' : '🎯 قائمة تعيين جديدة';
    document.getElementById('rcChkEmp').innerHTML = '<option value="">— اختر الموظف —</option>' + emps.map(([k, e]) => `<option value="${k}">${rcEsc(e.name)}</option>`).join('');
    document.getElementById('rcChkDate').value = new Date().toISOString().slice(0, 10);
    const tpl = type === 'offboarding' ? RC_OFFBOARD_TPL : RC_ONBOARD_TPL;
    document.getElementById('rcChkItems').value = tpl.join('\n');
    document.getElementById('rcChkModal').style.display = 'flex';
};
window.rcCloseChecklist = function () { const m = document.getElementById('rcChkModal'); if (m) m.style.display = 'none'; };
function rcEnsureChecklistModal() {
    if (document.getElementById('rcChkModal')) return;
    const d = document.createElement('div');
    d.id = 'rcChkModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 id="rcChkTitle" style="margin:0;color:#2d6a9f;font-size:18px">🎯 قائمة تعيين جديدة</h3><button onclick="rcCloseChecklist()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <input id="rcChkType" type="hidden">
        <div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">الموظف *</label><select id="rcChkEmp" style="width:100%;${rcInp()}"></select></div>
        <div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">التاريخ</label><input id="rcChkDate" type="date" style="width:100%;${rcInp()}"></div>
        <div style="margin-bottom:14px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">بنود القائمة (سطر لكل بند)</label><textarea id="rcChkItems" rows="9" style="width:100%;${rcInp()};resize:vertical"></textarea></div>
        <div style="display:flex;gap:8px"><button class="btn b-g" onclick="rcSaveChecklist()" style="flex:1;font-weight:800">💾 إنشاء القائمة</button><button class="btn" onclick="rcCloseChecklist()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.rcSaveChecklist = async function () {
    const empKey = document.getElementById('rcChkEmp').value;
    if (!empKey) { toast('⚠️ اختر الموظف', 'er'); return; }
    const type = document.getElementById('rcChkType').value;
    const labels = document.getElementById('rcChkItems').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!labels.length) { toast('⚠️ أضف بنداً واحداً على الأقل', 'er'); return; }
    const items = {}; labels.forEach((l, i) => { items['i' + i] = { label: l, done: false }; });
    const data = {
        empKey, empName: (window.emp || {})[empKey]?.name || '', type,
        startDate: document.getElementById('rcChkDate').value || new Date().toISOString().slice(0, 10),
        status: 'in_progress', items, createdAt: new Date().toISOString()
    };
    try { await window.push(window.R.onboardings, data); toast('✓ أُنشئت القائمة', 'ok'); rcCloseChecklist(); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.rcToggleItem = async function (ok, id, done) {
    const o = rcOnb()[ok]; if (!o) return;
    const items = o.items || {};
    if (items[id]) { items[id].done = done; items[id].doneAt = done ? new Date().toISOString() : null; }
    const all = Object.values(items).every(i => i.done);
    try { await window.update(window.ref(window.db, 'ledger/onboardings/' + ok), { items, status: all ? 'completed' : 'in_progress' }); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.rcDeleteChecklist = async function (ok) {
    if (!(await cf2('حذف هذه القائمة؟'))) return;
    try { await window.remove(window.ref(window.db, 'ledger/onboardings/' + ok)); toast('🗑️ تم الحذف', 'ok'); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

console.log('✅ Recruitment module loaded');
