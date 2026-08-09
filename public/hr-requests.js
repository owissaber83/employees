// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🎫 [HR-REQ]  مركز الطلبات والتذاكر (HR Helpdesk / Requests Hub)            ║
// ║  تذاكر الموظفين: شكوى/استفسار HR/دعم تقني/طلب مستند — بحالة وتتبّع ومحادثة.  ║
// ║  آمن من الأساس: tickets/{empKey}/{id} — الموظف يرى/يفتح تذاكره فقط، والموارد ║
// ║  البشرية/المدير يرون كل التذاكر ويعالجونها. ملف كلاسيكي يعتمد على globals.    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
'use strict';

const TK_TYPES = {
    complaint: { label: 'شكوى', icon: '⚠️', color: '#c0392b' },
    hr_inquiry: { label: 'استفسار موارد بشرية', icon: '👥', color: '#8e44ad' },
    it_support: { label: 'دعم تقني', icon: '💻', color: '#2d6a9f' },
    doc_request: { label: 'طلب مستند', icon: '📄', color: '#16a085' },
    finance: { label: 'استفسار مالي', icon: '💰', color: '#d35400' },
    other: { label: 'أخرى', icon: '📌', color: '#7f8c8d' }
};
const TK_STATUS = {
    open: { label: 'مفتوحة', color: '#e67e22', bg: '#fef6ee' },
    in_progress: { label: 'قيد المعالجة', color: '#2d6a9f', bg: '#eef5fb' },
    resolved: { label: 'تمّت المعالجة', color: '#1e8449', bg: '#eafaf1' },
    closed: { label: 'مغلقة', color: '#7f8c8d', bg: '#f2f4f6' }
};
const TK_PRIORITY = { low: { label: 'منخفضة', color: '#7f8c8d' }, normal: { label: 'عادية', color: '#2d6a9f' }, high: { label: 'عالية', color: '#e67e22' }, urgent: { label: 'عاجلة', color: '#c0392b' } };

function tkEsc(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function tkMyName() { return (window.myP && window.myP.name) || (window.curU && window.curU.email) || ''; }
function tkCanManage() { const p = window.myP; return !!(p && (p.role === 'admin' || p.role === 'hr_officer')); }
function tkFmtDate(iso) { return iso ? String(iso).slice(0, 16).replace('T', ' ') : ''; }

// كل التذاكر مسطّحة للإدارة: window.tickets = { empKey: { id: {...} } }
function tkAllFlat() {
    const out = []; const all = window.tickets || {};
    for (const ek in all) { const byId = all[ek] || {}; for (const id in byId) { const t = byId[id]; if (t && typeof t === 'object') out.push({ empKey: ek, id, ...t }); } }
    return out;
}
// تذاكر الموظف الحالي: window.myTickets = { id: {...} }
function tkMineFlat() {
    const out = []; const mine = window.myTickets || {};
    for (const id in mine) { const t = mine[id]; if (t && typeof t === 'object') out.push({ empKey: (window.myP && window.myP.empKey) || '', id, ...t }); }
    return out;
}

function tkStatusBadge(st) { const s = TK_STATUS[st] || TK_STATUS.open; return `<span style="background:${s.bg};color:${s.color};padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">${s.label}</span>`; }
function tkTypeBadge(ty) { const t = TK_TYPES[ty] || TK_TYPES.other; return `<span style="color:${t.color};font-weight:700;font-size:12px">${t.icon} ${t.label}</span>`; }
function tkPrioBadge(pr) { const p = TK_PRIORITY[pr] || TK_PRIORITY.normal; return `<span style="color:${p.color};font-weight:700;font-size:11px">● ${p.label}</span>`; }

// ══ إنشاء تذكرة (الموظف من خدمته الذاتية، أو HR بالنيابة) ═══════════════════════
window.tkCreate = async function (opts) {
    const empKey = opts.empKey, empName = opts.empName || '';
    if (!empKey) { toast('حسابك غير مرتبط بسجل موظف', 'er'); return false; }
    const subject = (opts.subject || '').trim(), body = (opts.body || '').trim();
    if (!subject) { toast('⚠️ أدخل عنوان الطلب', 'er'); return false; }
    const rec = {
        empKey, empName, type: opts.type || 'other', priority: opts.priority || 'normal',
        subject, body, status: 'open',
        createdAt: new Date().toISOString(), createdBy: (window.curU && window.curU.uid) || '', createdByName: tkMyName()
    };
    try { await window.push(window.ref(window.db, 'ledger/tickets/' + empKey), rec); toast('✅ تم إرسال الطلب — ستتابع حالته هنا', 'ok'); return true; }
    catch (e) { toast('خطأ: ' + (e.message || e), 'er'); return false; }
};

// إرسال من نموذج الخدمة الذاتية
window.essSubmitTicket = async function () {
    const me = (typeof myEmpContext === 'function') ? myEmpContext() : null;
    if (!me) { toast('حسابك غير مرتبط بسجل موظف', 'er'); return; }
    const ok = await tkCreate({
        empKey: me.key, empName: me.data.name || '',
        type: document.getElementById('essTkType')?.value || 'other',
        priority: document.getElementById('essTkPrio')?.value || 'normal',
        subject: document.getElementById('essTkSubject')?.value || '',
        body: document.getElementById('essTkBody')?.value || ''
    });
    if (ok) { ['essTkSubject', 'essTkBody'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); if (typeof renderSelfService === 'function') renderSelfService(); }
};

// إضافة تعليق/ردّ إلى محادثة التذكرة
window.tkComment = async function (empKey, id, text) {
    text = (text || '').trim(); if (!text) return;
    const c = { by: (window.curU && window.curU.uid) || '', byName: tkMyName(), text, at: new Date().toISOString(), staff: tkCanManage() };
    try { await window.push(window.ref(window.db, 'ledger/tickets/' + empKey + '/' + id + '/comments'), c); }
    catch (e) { toast('خطأ: ' + (e.message || e), 'er'); }
};

// تغيير الحالة / الإسناد (للموارد البشرية)
window.tkSetStatus = async function (empKey, id, status) {
    const patch = { status };
    if (status === 'resolved') { patch.resolvedAt = new Date().toISOString(); patch.resolvedBy = tkMyName(); }
    try { await window.update(window.ref(window.db, 'ledger/tickets/' + empKey + '/' + id), patch); toast('تم التحديث ✓', 'ok'); }
    catch (e) { toast('خطأ: ' + (e.message || e), 'er'); }
};
window.tkAssign = async function (empKey, id) {
    const uid = document.getElementById('tkAssignSel')?.value; const us = window.us || window.users || {};
    try { await window.update(window.ref(window.db, 'ledger/tickets/' + empKey + '/' + id), { assigneeUid: uid || null, assigneeName: (us[uid] && us[uid].name) || '', status: 'in_progress' }); toast('تم الإسناد ✓', 'ok'); }
    catch (e) { toast('خطأ: ' + (e.message || e), 'er'); }
};

// ══ صفحة الإدارة: pg-tickets ══════════════════════════════════════════════════
window._tkFilter = window._tkFilter || { status: '', type: '' };
window.renderTickets = function () {
    const c = document.getElementById('pg-tickets'); if (!c) return;
    if (!tkCanManage()) { c.innerHTML = '<div class="card" style="padding:30px;text-align:center;color:#c0392b">🚫 هذه الصفحة متاحة للموارد البشرية/المدير فقط</div>'; return; }
    const all = tkAllFlat();
    const f = window._tkFilter;
    const shown = all.filter(t => (!f.status || (t.status || 'open') === f.status) && (!f.type || t.type === f.type))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const count = st => all.filter(t => (t.status || 'open') === st).length;

    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:13px 17px;flex:1;min-width:135px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:21px;font-weight:800;color:${col};margin-top:3px">${val}</div></div>`;

    const row = t => `<tr style="border-bottom:1px solid #f2f5f8;cursor:pointer" onclick="tkOpen('${t.empKey}','${t.id}')">
        <td style="padding:8px 10px;font-weight:700">${tkEsc(t.empName || '—')}</td>
        <td style="padding:8px 10px">${tkTypeBadge(t.type)}</td>
        <td style="padding:8px 10px;font-weight:600;color:#243b53">${tkEsc(t.subject || '')}</td>
        <td style="padding:8px 10px">${tkPrioBadge(t.priority)}</td>
        <td style="padding:8px 10px;color:#888;font-size:11px;white-space:nowrap">${tkFmtDate(t.createdAt)}</td>
        <td style="padding:8px 10px;text-align:center">${tkStatusBadge(t.status)}</td>
    </tr>`;

    const filterBtn = (val, label, cur) => `<button class="btn" onclick="tkSetFilter('status','${val}')" style="padding:5px 11px;font-size:12px;${cur === val ? 'background:#2d6a9f;color:#fff' : 'background:#eef2f6;color:#334'}">${label}</button>`;
    const typeOpts = `<option value="">كل الأنواع</option>` + Object.entries(TK_TYPES).map(([k, v]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('');

    c.innerHTML = `<div style="padding:0 4px">
        <div style="font-size:16px;font-weight:800;color:#1a3a5c;margin-bottom:12px">🎫 مركز الطلبات والتذاكر</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('📥', 'مفتوحة', count('open'), '#e67e22')}
            ${kpi('⚙️', 'قيد المعالجة', count('in_progress'), '#2d6a9f')}
            ${kpi('✅', 'تمّت المعالجة', count('resolved'), '#1e8449')}
            ${kpi('🗂️', 'الإجمالي', all.length, '#8e44ad')}
        </div>
        <div class="card">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
                ${filterBtn('', 'الكل', f.status)}${filterBtn('open', 'مفتوحة', f.status)}${filterBtn('in_progress', 'قيد المعالجة', f.status)}${filterBtn('resolved', 'تمّت', f.status)}${filterBtn('closed', 'مغلقة', f.status)}
                <select onchange="tkSetFilter('type',this.value)" style="padding:5px 9px;font-size:12px;margin-right:auto">${typeOpts}</select>
            </div>
            ${shown.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#f0f5fa;text-align:right;color:#1a3a5c"><th style="padding:8px 10px">الموظف</th><th style="padding:8px 10px">النوع</th><th style="padding:8px 10px">الموضوع</th><th style="padding:8px 10px">الأولوية</th><th style="padding:8px 10px">التاريخ</th><th style="padding:8px 10px;text-align:center">الحالة</th></tr></thead>
                <tbody>${shown.map(row).join('')}</tbody></table></div>`
            : '<div style="color:#aaa;text-align:center;padding:26px">لا تذاكر مطابقة للفلتر.</div>'}
        </div>
    </div>`;
};
window.tkSetFilter = function (k, v) { window._tkFilter[k] = v; renderTickets(); };

// نافذة تفصيل التذكرة (محادثة + إجراءات) — للإدارة
window.tkOpen = function (empKey, id) {
    const t = (window.tickets && window.tickets[empKey] && window.tickets[empKey][id]); if (!t) return;
    const comments = t.comments ? Object.values(t.comments).sort((a, b) => (a.at || '').localeCompare(b.at || '')) : [];
    const us = window.us || window.users || {};
    const assignOpts = `<option value="">— بدون إسناد —</option>` + Object.entries(us).filter(([, u]) => u && u.active !== false).map(([uid, u]) => `<option value="${uid}" ${t.assigneeUid === uid ? 'selected' : ''}>${tkEsc(u.name || uid)}</option>`).join('');
    const thread = comments.length ? comments.map(cm => `<div style="margin-bottom:8px;padding:8px 10px;border-radius:9px;background:${cm.staff ? '#eef5fb' : '#f7faf7'};border:1px solid ${cm.staff ? '#dceaf6' : '#e6f0e6'}">
        <div style="font-size:11px;color:#66788a;margin-bottom:3px">${cm.staff ? '🛠️ ' : '🙋 '}${tkEsc(cm.byName || '')} · ${tkFmtDate(cm.at)}</div>
        <div style="font-size:13px;color:#243b53;white-space:pre-wrap">${tkEsc(cm.text)}</div></div>`).join('') : '<div style="color:#aaa;font-size:12.5px;padding:6px 2px">لا ردود بعد.</div>';

    const html = `<div style="max-width:640px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">${tkTypeBadge(t.type)} ${tkPrioBadge(t.priority)} ${tkStatusBadge(t.status)}</div>
        <div style="font-size:16px;font-weight:800;color:#1a3a5c;margin-bottom:4px">${tkEsc(t.subject || '')}</div>
        <div style="font-size:12px;color:#66788a;margin-bottom:10px">👷 ${tkEsc(t.empName || '')} · ${tkFmtDate(t.createdAt)}</div>
        ${t.body ? `<div style="font-size:13px;color:#243b53;white-space:pre-wrap;background:#fafcfe;border:1px solid #eef2f6;border-radius:9px;padding:10px;margin-bottom:12px">${tkEsc(t.body)}</div>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:end;margin-bottom:12px;padding:10px;background:#f7fafc;border-radius:10px">
            <div class="fg" style="margin:0"><label style="font-size:11px">الحالة</label>
                <select id="tkStSel" onchange="tkSetStatus('${empKey}','${id}',this.value)">${Object.entries(TK_STATUS).map(([k, v]) => `<option value="${k}" ${(t.status || 'open') === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
            <div class="fg" style="margin:0"><label style="font-size:11px">الإسناد إلى</label><select id="tkAssignSel">${assignOpts}</select></div>
            <button class="btn b-b" style="padding:6px 12px;font-size:12px" onclick="tkAssign('${empKey}','${id}')">👤 إسناد</button>
        </div>
        <div style="font-weight:700;font-size:13px;color:#243b53;margin-bottom:6px">💬 المحادثة</div>
        <div style="max-height:230px;overflow-y:auto;margin-bottom:10px">${thread}</div>
        <div style="display:flex;gap:6px"><input id="tkReplyInput" placeholder="اكتب رداً..." style="flex:1;padding:8px 10px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit">
            <button class="btn b-g" style="padding:8px 14px;font-weight:800" onclick="tkReplyFromModal('${empKey}','${id}')">📤 إرسال</button></div>
    </div>`;
    if (typeof hsModal === 'function') hsModal('🎫 تفصيل التذكرة', html);
    else { const m = document.getElementById('hsGenModal'); if (m) { const b = document.getElementById('hsGenBody'); if (b) b.innerHTML = html; m.style.display = 'flex'; } }
};
window.tkReplyFromModal = async function (empKey, id) {
    const el = document.getElementById('tkReplyInput'); const v = el ? el.value : '';
    if (!v.trim()) return; await tkComment(empKey, id, v); if (el) el.value = '';
    if (typeof tkOpen === 'function') tkOpen(empKey, id); // إعادة الفتح لتحديث المحادثة
};

// ══ قسم الخدمة الذاتية: نموذج فتح تذكرة + قائمة تذاكري ═══════════════════════════
window.essTicketsHtml = function () {
    const mine = tkMineFlat().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    // أنماط متّسقة مع الخدمة الذاتية (scard / inp / bigBtn)
    const INP = 'padding:12px;border:1.5px solid #d9e0e8;border-radius:11px;font-family:inherit;font-size:14px;box-sizing:border-box;width:100%;background:#fbfcfd';
    const LBL = 'font-size:11.5px;font-weight:800;color:#7a8896;display:block;margin-bottom:5px';
    const typeOpts = Object.entries(TK_TYPES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('');
    const prioOpts = Object.entries(TK_PRIORITY).map(([k, v]) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${v.label}</option>`).join('');
    const mineRows = mine.length ? mine.map(t => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:11px 0;border-bottom:1px solid #f2f5f8">
        <div style="min-width:0">
            <div style="font-weight:800;color:#243b53;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tkTypeBadge(t.type)} · ${tkEsc(t.subject)}</div>
            <div style="color:#8a97a5;font-size:11.5px;margin-top:2px">${tkFmtDate(t.createdAt)}${t.comments ? ' · 💬 ' + Object.keys(t.comments).length : ''}</div>
        </div>
        <div style="flex-shrink:0">${tkStatusBadge(t.status)}</div>
    </div>`).join('') : '<div style="color:#b3bdc7;font-size:12.5px;text-align:center;padding:22px">لا طلبات بعد — افتح طلبك الأول من الأعلى.</div>';

    const card = (inner, extra = '') => `<div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(20,50,80,.06);${extra}">${inner}</div>`;
    const secTitle = t => `<div style="font-size:14px;font-weight:800;color:#1a3a5c;margin:2px 0 12px">${t}</div>`;

    return `${card(`${secTitle('🎫 فتح طلب / تذكرة')}
        <div style="font-size:12px;color:#8a97a5;margin:-6px 0 12px;line-height:1.7">استفسار أو شكوى أو دعم تقني أو طلب مستند — يصل مباشرةً للموارد البشرية وتتابع حالته هنا.</div>
        <div style="display:flex;gap:10px;margin-bottom:11px">
            <div style="flex:1"><label style="${LBL}">النوع</label><select id="essTkType" style="${INP}">${typeOpts}</select></div>
            <div style="flex:1"><label style="${LBL}">الأولوية</label><select id="essTkPrio" style="${INP}">${prioOpts}</select></div>
        </div>
        <div style="margin-bottom:11px"><label style="${LBL}">العنوان *</label><input id="essTkSubject" placeholder="عنوان مختصر للطلب" style="${INP}"></div>
        <div style="margin-bottom:13px"><label style="${LBL}">التفاصيل</label><textarea id="essTkBody" rows="3" placeholder="اشرح طلبك بالتفصيل..." style="${INP};resize:vertical"></textarea></div>
        <button onclick="essSubmitTicket()" style="width:100%;border:none;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,#8e44ad,#6c3483);color:#fff;font-weight:800;font-size:15px;padding:14px;border-radius:13px;box-shadow:0 4px 14px rgba(142,68,173,.3)">📤 إرسال الطلب</button>`, 'margin-bottom:13px')}
    ${card(`${secTitle(`🗂️ طلباتي (${mine.length})`)}${mineRows}`)}`;
};
