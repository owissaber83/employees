// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ✅ [HR-APV]  محرّك مسارات الموافقات متعددة المستويات (Approval Workflows)   ║
// ║  قابل للتهيئة لكل نوع طلب (إجازة/إذن/سلفة/خطاب/مصروفات): مدير الإدارة →       ║
// ║  الموارد البشرية → المدير العام. اختياري لكل شركة — بلا تهيئة يبقى السلوك     ║
// ║  القديم (اعتماد بخطوة واحدة) فلا ينكسر شيء. ملف كلاسيكي يعتمد على globals.     ║
// ╚══════════════════════════════════════════════════════════════════════════╝
'use strict';

// أنواع الطلبات المدعومة + المجموعة التي تُخزَّن فيها.
// (السلف يُنشئها HR مباشرة بلا تقديم موظف — تُوصَل لاحقاً عند الحاجة.)
const APV_TYPES = {
    leave: { label: 'طلبات الإجازة', icon: '🌴', col: 'leaves' },
    permission: { label: 'الأذونات والاستئذان', icon: '🕘', col: 'permissions' },
    letter: { label: 'طلبات خطابات HR', icon: '📄', col: 'hrLetters' },
    expense: { label: 'مطالبات المصروفات', icon: '🧾', col: 'employeeExpenses' },
    trip: { label: 'طلبات الانتداب والسفر', icon: '✈️', col: 'businessTrips' }
};
// الأدوار التي يصحّ أن تكون معتمِدة (خطوة role)
const APV_ROLES = { hr_officer: '👥 موظف موارد بشرية', admin_officer: '📋 موظف إداري', finance_manager: '💰 مدير مالي', executive_director: '👔 مدير تنفيذي', project_manager: '📋 مدير مشروع', admin: '🛡️ مدير النظام' };
const APV_KINDS = { direct_manager: 'المدير المباشر (للموظف)', dept_manager: 'مدير الإدارة (للموظف)', role: 'دور محدَّد', user: 'مستخدم محدَّد' };

function apvEsc(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function apvPolicies() { return window.approvalPolicies || {}; }
function apvPolicy(type) { return apvPolicies()[type] || null; }
function apvActive(type) { const p = apvPolicy(type); return !!(p && p.enabled && Array.isArray(p.steps) && p.steps.length); }
function apvMyName() { return (window.myP && window.myP.name) || (window.curU && window.curU.email) || ''; }
function apvUsers() { return window.us || window.users || {}; }

// اسم معروض للمعتمِد في خطوة
function apvStepApproverLabel(s) {
    if (!s) return '';
    if (s.kind === 'direct_manager') return 'المدير المباشر للموظف';
    if (s.kind === 'dept_manager') return 'مدير إدارة الموظف';
    if (s.kind === 'role') return APV_ROLES[s.role] || s.role || 'دور';
    if (s.kind === 'user') return s.userName || (apvUsers()[s.userId] && apvUsers()[s.userId].name) || 'مستخدم';
    return '';
}

// مدير إدارة الموظف: emp.dept → القسم المطابق → managerId (وهو empKey للمدير)
function apvDeptManagerEmpKey(emp) {
    if (!emp || !emp.dept) return null;
    const depts = window.departments || {};
    for (const k in depts) { const d = depts[k]; if (d && (d.name === emp.dept || k === emp.dept) && d.managerId) return d.managerId; }
    return null;
}

// بناء كائن الموافقة عند إنشاء الطلب — أو null لو لا سياسة مفعّلة (فيبقى السلوك القديم)
function apvInit(type, emp) {
    if (!apvActive(type)) return null;
    const steps = apvPolicy(type).steps.map(s => ({
        name: s.name || apvStepApproverLabel(s), kind: s.kind,
        role: s.role || null, userId: s.userId || null, userName: s.userName || null,
        decision: 'pending', by: null, byName: null, at: null, comment: null
    }));
    return { type, cur: 0, status: 'pending', startedAt: new Date().toISOString(), steps };
}

// الخطوة الحالية المعلّقة (أو null)
function apvCurStep(rec) { const a = rec && rec.approval; return (a && a.status === 'pending' && a.steps && a.steps[a.cur]) ? a.steps[a.cur] : null; }

// هل المستخدم الحالي هو معتمِد الخطوة الحالية؟ (المدير مخوّل دائماً كتجاوز إداري)
function apvCanAct(rec) {
    const s = apvCurStep(rec); if (!s) return false;
    const p = window.myP; if (!p || p.active === false) return false;
    if (p.role === 'admin') return true;                                   // تجاوز إداري
    if (s.kind === 'role') return p.role === s.role;
    if (s.kind === 'user') return (window.curU && window.curU.uid) === s.userId;
    if (s.kind === 'direct_manager') { const emp = (window.emp || {})[rec.empKey]; const mk = emp ? emp.managerId : null; return !!(mk && p.empKey === mk); }
    if (s.kind === 'dept_manager') { const emp = (window.emp || {})[rec.empKey]; const mk = emp ? apvDeptManagerEmpKey(emp) : null; return !!(mk && p.empKey === mk); }
    return false;
}

// نصّ حالة الموافقة للعرض
window.apvStatusHtml = function (rec) {
    const a = rec && rec.approval; if (!a) return '';
    if (a.status === 'approved') return '<span style="background:var(--hr-sf-ok);color:var(--hr-ok-d);padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">✅ مُعتمد بالكامل</span>';
    if (a.status === 'rejected') return '<span style="background:#fdecea;color:var(--hr-danger);padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">❌ مرفوض</span>';
    const s = a.steps[a.cur];
    return `<span style="background:var(--hr-sf3);color:var(--hr-pri2);padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">⏳ الخطوة ${a.cur + 1}/${a.steps.length}: ${apvEsc(s ? (s.name || apvStepApproverLabel(s)) : '')}</span>`;
};
window.apvActive = apvActive;
window.apvInit = apvInit;
window.apvCanAct = apvCanAct;
window.apvCurStep = apvCurStep;

// اتخاذ قرار على خطوة (اعتماد/رفض) — يقدّم السلسلة ويعكس الحالة النهائية على الطلب
window.apvDecide = async function (type, key, rec, approve, comment) {
    const meta = APV_TYPES[type]; if (!meta) return;
    const a = rec.approval; if (!a || a.status !== 'pending') { toast('الطلب لم يعُد بانتظار قرارك', 'wn'); return; }
    if (!apvCanAct(rec)) { toast('🚫 لست معتمِد الخطوة الحالية', 'er'); return; }
    const now = new Date().toISOString();
    a.steps[a.cur] = { ...a.steps[a.cur], decision: approve ? 'approved' : 'rejected', by: (window.curU && window.curU.uid) || null, byName: apvMyName(), at: now, comment: comment || null };
    const patch = { approval: a };
    if (!approve) {
        a.status = 'rejected';
        patch.status = 'rejected'; patch.rejectedBy = apvMyName(); patch.rejectedAt = now; patch.rejectionReason = comment || 'بدون سبب';
    } else if (a.cur + 1 >= a.steps.length) {
        a.status = 'approved'; a.cur = a.steps.length - 1;
        patch.status = 'approved'; patch.approvedBy = apvMyName(); patch.approvedAt = now;
    } else {
        a.cur += 1; // إلى الخطوة التالية — يبقى الطلب pending
    }
    try {
        await window.update(window.ref(window.db, 'ledger/' + meta.col + '/' + key), patch);
        toast(approve ? (a.status === 'approved' ? '✅ اعتماد نهائي' : '✅ اعتُمدت خطوتك — أُحيل للخطوة التالية') : '❌ تم الرفض', 'ok');
    } catch (e) { toast('خطأ: ' + (e.message || e), 'er'); }
};

// كل الطلبات المعلّقة بانتظار قرار المستخدم الحالي (لصندوق الموافقات والجرس)
window.apvMyPending = function () {
    const out = [];
    for (const type in APV_TYPES) {
        const col = window[APV_TYPES[type].col === 'hrLetters' ? 'hrLetters' : APV_TYPES[type].col] || {};
        for (const k in col) { const rec = col[k]; if (rec && rec.approval && rec.approval.status === 'pending' && apvCanAct(rec)) out.push({ type, key: k, rec }); }
    }
    return out;
};

// ══════════════════════════════════════════════════════════════════════════
// صفحة التهيئة: pg-approvalflows — تعريف سلسلة الاعتماد لكل نوع طلب (HR/admin)
// ══════════════════════════════════════════════════════════════════════════
function apvCanManage() { const p = window.myP; return !!(p && (p.role === 'admin' || p.role === 'hr_officer')); }

window.renderApprovalFlows = function () {
    const c = document.getElementById('pg-approvalflows'); if (!c) return;
    if (!apvCanManage()) { c.innerHTML = '<div class="card" style="padding:30px;text-align:center;color:var(--hr-danger)">🚫 هذه الصفحة متاحة للموارد البشرية/المدير فقط</div>'; return; }

    const typeCard = (type) => {
        const meta = APV_TYPES[type]; const p = apvPolicy(type) || { enabled: false, steps: [] };
        const steps = Array.isArray(p.steps) ? p.steps : [];
        const stepRow = (s, i) => `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f7fafc;border:1px solid #e6edf3;border-radius:9px;margin-bottom:6px">
            <span style="background:var(--hr-pri2);color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none">${i + 1}</span>
            <span style="flex:1;font-size:13px;font-weight:700;color:var(--hr-ink)">${apvEsc(s.name || apvStepApproverLabel(s))}</span>
            <span style="font-size:11.5px;color:#5b7185">${apvEsc(apvStepApproverLabel(s))}</span>
            <button class="btn b-r" style="padding:2px 8px;font-size:11px" onclick="apvRemoveStep('${type}',${i})">🗑️</button>
        </div>`;
        return `<div class="card" style="margin-bottom:14px;border-right:5px solid ${p.enabled ? 'var(--hr-acc)' : '#c3ccd6'}">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <div class="c-tl" style="margin:0">${meta.icon} ${apvEsc(meta.label)}</div>
                <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;cursor:pointer;color:${p.enabled ? 'var(--hr-acc)' : '#7d8a97'}">
                    <input type="checkbox" ${p.enabled ? 'checked' : ''} onchange="apvToggle('${type}',this.checked)" style="width:16px;height:16px;cursor:pointer">
                    ${p.enabled ? 'مسار مفعّل' : 'مسار مُعطّل (اعتماد بخطوة واحدة)'}
                </label>
            </div>
            <div style="margin-top:10px">${steps.length ? steps.map(stepRow).join('') : '<div style="color:#aaa;font-size:12.5px;padding:6px 2px">لا خطوات بعد — أضف خطوة اعتماد واحدة أو أكثر.</div>'}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:end;margin-top:8px;padding-top:10px;border-top:1px dashed #e2e8ee">
                <div class="fg" style="margin:0"><label style="font-size:11px">نوع المعتمِد</label>
                    <select id="apvKind_${type}" onchange="apvKindChanged('${type}')" style="min-width:150px">${Object.entries(APV_KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
                <div class="fg" style="margin:0" id="apvRoleWrap_${type}"><label style="font-size:11px">الدور</label>
                    <select id="apvRole_${type}" style="min-width:150px">${Object.entries(APV_ROLES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
                <div class="fg" style="margin:0;display:none" id="apvUserWrap_${type}"><label style="font-size:11px">المستخدم</label>
                    <select id="apvUser_${type}" style="min-width:170px">${Object.entries(apvUsers()).filter(([, u]) => u && u.active !== false).map(([uid, u]) => `<option value="${uid}">${apvEsc(u.name || uid)}</option>`).join('')}</select></div>
                <button class="btn b-g" style="padding:6px 12px;font-size:12px;font-weight:800" onclick="apvAddStep('${type}')">➕ أضف خطوة</button>
            </div>
        </div>`;
    };

    c.innerHTML = `<div style="padding:0 4px">
        <div style="font-size:16px;font-weight:800;color:var(--hr-pri);margin-bottom:6px">✅ مسارات الموافقات</div>
        <div style="font-size:12.5px;color:#66788a;margin-bottom:14px;line-height:1.7">حدِّد سلسلة الاعتماد لكل نوع طلب. تُطبَّق السلسلة على الطلبات <b>الجديدة</b> بعد التفعيل؛ الطلبات القائمة تُكمل مسارها القديم. بلا تفعيل، يبقى الاعتماد بخطوة واحدة كالمعتاد.</div>
        ${Object.keys(APV_TYPES).map(typeCard).join('')}
    </div>`;
    // إظهار/إخفاء حقل الدور/المستخدم حسب النوع لكل بطاقة
    Object.keys(APV_TYPES).forEach(t => apvKindChanged(t));
};

window.apvKindChanged = function (type) {
    const kind = document.getElementById('apvKind_' + type)?.value;
    const rw = document.getElementById('apvRoleWrap_' + type), uw = document.getElementById('apvUserWrap_' + type);
    if (rw) rw.style.display = kind === 'role' ? '' : 'none';
    if (uw) uw.style.display = kind === 'user' ? '' : 'none';
};

async function apvSavePolicy(type, policy) {
    try { await window.set(window.ref(window.db, 'ledger/approvalPolicies/' + type), policy); }
    catch (e) { toast('خطأ في الحفظ: ' + (e.message || e), 'er'); }
}

window.apvToggle = function (type, on) {
    const p = apvPolicy(type) || { steps: [] };
    if (on && (!p.steps || !p.steps.length)) { toast('أضف خطوة اعتماد واحدة على الأقل قبل التفعيل', 'wn'); if (typeof renderApprovalFlows === 'function') renderApprovalFlows(); return; }
    apvSavePolicy(type, { ...p, enabled: !!on, updatedAt: new Date().toISOString(), updatedBy: apvMyName() });
};

window.apvAddStep = function (type) {
    const kind = document.getElementById('apvKind_' + type)?.value || 'role';
    const step = { kind };
    if (kind === 'role') { step.role = document.getElementById('apvRole_' + type)?.value || 'hr_officer'; }
    else if (kind === 'user') { const uid = document.getElementById('apvUser_' + type)?.value; if (!uid) { toast('اختر مستخدماً', 'er'); return; } step.userId = uid; step.userName = (apvUsers()[uid] && apvUsers()[uid].name) || ''; }
    step.name = apvStepApproverLabel(step);
    const p = apvPolicy(type) || { enabled: false, steps: [] };
    const steps = Array.isArray(p.steps) ? p.steps.slice() : [];
    steps.push(step);
    apvSavePolicy(type, { ...p, steps, updatedAt: new Date().toISOString(), updatedBy: apvMyName() });
};

window.apvRemoveStep = function (type, i) {
    const p = apvPolicy(type); if (!p || !Array.isArray(p.steps)) return;
    const steps = p.steps.slice(); steps.splice(i, 1);
    const enabled = steps.length ? p.enabled : false;   // تعطيل تلقائي لو لم تبقَ خطوات
    apvSavePolicy(type, { ...p, steps, enabled, updatedAt: new Date().toISOString(), updatedBy: apvMyName() });
};
