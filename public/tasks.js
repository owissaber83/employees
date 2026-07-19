// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   🗓️  [TASKS]  وحدة المهام والتنبيهات                                        ║
// ║   مهام رئيسية/فرعية متداخلة + تذكيرات مجدولة (مرة/يومي/أسبوعي/شهري)            ║
// ║   تظهر التنبيهات داخل البرنامج في وقتها وتُرتَّب بالأولوية والتاريخ              ║
// ║   يعمل مع app.js عبر المتغيرات العامة: R, db, ref, set, push, update,        ║
// ║   remove, onValue, $, toast, curU                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

window.tasksData = window.tasksData || {};
window._tasksState = window._tasksState || { filter: 'all', expand: {}, scope: 'mine', view: 'list', calAnchor: Date.now(), calMode: 'month', search: '', tagFilter: '', selMode: false, selected: {} };
const TASK_TEMPLATES_REF = () => ref(db, 'ledger/taskTemplates');
// قوالب مدمجة جاهزة (قوائم تدقيق متكررة)
const TASK_BUILTIN_TEMPLATES = {
    _newProject: { name: 'افتتاح مشروع جديد', items: ['استلام الموقع ومحضر التسليم', 'اعتماد الجدول الزمني', 'فتح ملف المشروع والعقود', 'تعيين فريق المشروع', 'إعداد الموازنة التقديرية', 'تأمين التراخيص والتصاريح'] },
    _monthClose: { name: 'إقفال شهري محاسبي', items: ['تسوية البنوك', 'مطابقة الموردين والعملاء', 'ترحيل الإهلاكات والمخصصات', 'مراجعة المصروفات المستحقة', 'إعداد إقرار ضريبة القيمة المضافة', 'إصدار القوائم المالية'] },
    _newEmp: { name: 'تعيين موظف جديد', items: ['توقيع العقد', 'فتح ملف الموظف', 'إصدار بطاقة/صلاحيات الدخول', 'التسجيل في التأمينات', 'تجهيز مكان العمل والأدوات', 'جلسة تعريف بالنظام'] }
};

const TASK_PRIO = {
    urgent: { label: 'عاجل', color: '#c0392b', rank: 0 },
    high: { label: 'مرتفع', color: '#e67e22', rank: 1 },
    medium: { label: 'متوسط', color: '#2d6a9f', rank: 2 },
    low: { label: 'منخفض', color: '#16a085', rank: 3 }
};
const TASK_STATUS = { open: { label: 'مفتوحة', color: '#888' }, doing: { label: 'قيد التنفيذ', color: '#2d6a9f' }, done: { label: 'مكتملة', color: '#16a34a' } };
const TASK_WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const TASK_REM_TYPE = { once: 'مرة واحدة', daily: 'يومي', weekly: 'أسبوعي (يوم واحد)', weekdays: 'أيام محددة من الأسبوع', monthly: 'شهري', everyN: 'كل (ن) يوم/أسبوع' };
const TASK_LEAD = { 0: 'بدون تنبيه مسبق', 15: 'قبل 15 دقيقة', 30: 'قبل 30 دقيقة', 60: 'قبل ساعة', 180: 'قبل 3 ساعات', 1440: 'قبل يوم', 2880: 'قبل يومين' };
// ربط المهمة بكيانات النظام (ERP)
const TASK_LINK_TYPES = {
    project: { label: 'مشروع', icon: '📁', data: () => window.projects || {}, open: id => window.openProjectDetail && openProjectDetail(id) },
    vendor: { label: 'مورّد', icon: '🏢', data: () => window.vendors || {}, open: id => window.openVendorCatalog && openVendorCatalog(id) },
    employee: { label: 'موظف', icon: '👷', data: () => window.emp || {}, open: id => window.viewEmp && viewEmp(id) },
    customer: { label: 'عميل', icon: '🤝', data: () => window.customers || {}, open: id => { if (typeof nav === 'function') nav('customers', document.getElementById('n-customers')); } }
};
const TASK_TAG_COLORS = ['#5b2c6f', '#2d6a9f', '#16a085', '#e67e22', '#c0392b', '#8e44ad', '#27ae60', '#d35400', '#2c3e50', '#c2185b'];
function tasksTagColor(tag) { let h = 0; for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0; return TASK_TAG_COLORS[h % TASK_TAG_COLORS.length]; }
function tasksAllTags() { const s = new Set(); Object.values(window.tasksData || {}).forEach(t => (t && Array.isArray(t.tags) ? t.tags : []).forEach(x => s.add(x))); return [...s].sort((a, b) => a.localeCompare(b, 'ar')); }
function tasksLinkLabel(t) { if (!t.linkType || !t.linkId) return ''; const def = TASK_LINK_TYPES[t.linkType]; if (!def) return ''; return def.icon + ' ' + (t.linkName || (def.data()[t.linkId] && def.data()[t.linkId].name) || t.linkType); }

// ── أدوات الوقت ─────────────────
function tasksParseTime(s) { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? { h: +m[1], mn: +m[2] } : { h: 9, mn: 0 }; }
function tasksAtToday(base, h, mn) { const d = new Date(base); d.setHours(h, mn, 0, 0); return d.getTime(); }
function tasksDateAt(dateStr, h, mn) { const p = (dateStr || '').split('-').map(Number); if (p.length < 3) return null; return new Date(p[0], p[1] - 1, p[2], h, mn, 0, 0).getTime(); }
function tasksMonthDayAt(y, m, dom, h, mn) { const days = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(dom, days), h, mn, 0, 0).getTime(); }
function tasksFmtDateTime(ms) { if (!ms) return '—'; try { return new Date(ms).toLocaleString('ar-EG', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return new Date(ms).toLocaleString(); } }

function tasksUntilMs(rem) { if (!rem || !rem.until) return Infinity; const p = rem.until.split('-').map(Number); if (p.length < 3) return Infinity; return new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999).getTime(); }
function tasksWeekdaySet(rem) {
    if (rem.type === 'weekly') return [+rem.weekday];
    if (rem.type === 'weekdays') return (Array.isArray(rem.weekdays) ? rem.weekdays.map(Number) : []);
    return null;
}
function tasksLastOccurrence(rem, atMs) {
    if (!rem) return null; const { h, mn } = tasksParseTime(rem.time); const until = tasksUntilMs(rem);
    let t = null;
    if (rem.type === 'once') { t = tasksDateAt(rem.date, h, mn); return (t != null && t <= atMs) ? t : null; }
    if (rem.type === 'daily') { t = tasksAtToday(atMs, h, mn); if (t > atMs) t -= 86400000; }
    else if (rem.type === 'weekly' || rem.type === 'weekdays') { const set = tasksWeekdaySet(rem); if (!set || !set.length) return null; for (let b = 0; b <= 14; b++) { const d = new Date(atMs); d.setDate(d.getDate() - b); if (!set.includes(d.getDay())) continue; const c = tasksAtToday(d.getTime(), h, mn); if (c <= atMs) { t = c; break; } } }
    else if (rem.type === 'monthly') { const dom = +rem.dayOfMonth || 1; const d = new Date(atMs); t = tasksMonthDayAt(d.getFullYear(), d.getMonth(), dom, h, mn); if (t > atMs) { let m = d.getMonth() - 1, y = d.getFullYear(); if (m < 0) { m = 11; y--; } t = tasksMonthDayAt(y, m, dom, h, mn); } }
    else if (rem.type === 'everyN') { const anchor = tasksDateAt(rem.date, h, mn); if (anchor == null || atMs < anchor) return null; const stepDays = (rem.unit === 'week' ? 7 : 1) * (+rem.interval || 1); const k = Math.floor((atMs - anchor) / (stepDays * 86400000)); t = anchor + k * stepDays * 86400000; }
    if (t == null) return null;
    return t <= until ? t : null; // تجاوز تاريخ الانتهاء
}
function tasksNextOccurrence(rem, fromMs) {
    if (!rem || !rem.enabled) return null; const { h, mn } = tasksParseTime(rem.time); const until = tasksUntilMs(rem);
    let t = null;
    if (rem.type === 'once') { t = tasksDateAt(rem.date, h, mn); t = (t != null && t >= fromMs) ? t : null; }
    else if (rem.type === 'daily') { t = tasksAtToday(fromMs, h, mn); if (t < fromMs) t += 86400000; }
    else if (rem.type === 'weekly' || rem.type === 'weekdays') { const set = tasksWeekdaySet(rem); if (!set || !set.length) return null; for (let f = 0; f <= 14; f++) { const d = new Date(fromMs); d.setDate(d.getDate() + f); if (!set.includes(d.getDay())) continue; const c = tasksAtToday(d.getTime(), h, mn); if (c >= fromMs) { t = c; break; } } }
    else if (rem.type === 'monthly') { const dom = +rem.dayOfMonth || 1; const d = new Date(fromMs); t = tasksMonthDayAt(d.getFullYear(), d.getMonth(), dom, h, mn); if (t < fromMs) { let m = d.getMonth() + 1, y = d.getFullYear(); if (m > 11) { m = 0; y++; } t = tasksMonthDayAt(y, m, dom, h, mn); } }
    else if (rem.type === 'everyN') { const anchor = tasksDateAt(rem.date, h, mn); if (anchor == null) return null; const stepDays = (rem.unit === 'week' ? 7 : 1) * (+rem.interval || 1); if (fromMs <= anchor) t = anchor; else { const k = Math.ceil((fromMs - anchor) / (stepDays * 86400000)); t = anchor + k * stepDays * 86400000; } }
    if (t == null) return null;
    return t <= until ? t : null;
}
function tasksReminderLabel(rem) {
    if (!rem || !rem.enabled) return '';
    const t = rem.time || '09:00';
    let base = '';
    if (rem.type === 'once') base = `مرة: ${rem.date || '؟'} ${t}`;
    else if (rem.type === 'daily') base = `يومياً ${t}`;
    else if (rem.type === 'weekly') base = `كل ${TASK_WEEKDAYS[+rem.weekday] || '؟'} ${t}`;
    else if (rem.type === 'weekdays') base = `أيام ${(rem.weekdays || []).map(d => TASK_WEEKDAYS[+d]).join('، ')} ${t}`;
    else if (rem.type === 'monthly') base = `شهرياً يوم ${rem.dayOfMonth || 1} ${t}`;
    else if (rem.type === 'everyN') base = `كل ${rem.interval || 1} ${rem.unit === 'week' ? 'أسبوع' : 'يوم'} ${t}`;
    if (rem.lead) base += ` (تنبيه مسبق ${rem.lead >= 1440 ? (rem.lead / 1440) + 'ي' : rem.lead >= 60 ? (rem.lead / 60) + 'س' : rem.lead + 'د'})`;
    return base;
}
function tasksMine(t) { const me = (window.curU && window.curU.uid) || ''; const a = t.assignedTo || ''; if (!a) return true; return a === me || (t.createdBy || '') === me; }
function tasksUserName(uid) { const u = (window.us || {})[uid]; return u ? (u.name || u.email || uid) : ''; }
// ── الصلاحيات (تعتمد نظام الأدوار الحالي) ─────────────────
function tasksCan(p) { const mp = window.myP; if (!mp || mp.active === false) return false; if (mp.role === 'admin') return true; return (mp.permissions || []).includes(p); }
function tasksCanManageAll() { return tasksCan('manage_tasks'); } // المدير/المخوّل يرى ويدير كل المهام
function tasksMe() { return (window.curU && window.curU.uid) || ''; }
function tasksCanSee(t) { if (tasksCanManageAll()) return true; const me = tasksMe(); if (!me) return true; return (t.createdBy || '') === me || (t.assignedTo || '') === me || !t.createdBy; }
function tasksCanEdit(t) { if (tasksCanManageAll()) return true; const me = tasksMe(); if (!me) return true; return (t.createdBy || '') === me || (t.assignedTo || '') === me; }
function tasksCanDelete(t) { if (tasksCanManageAll()) return true; const me = tasksMe(); if (!me) return true; return (t.createdBy || '') === me; }

// ── الهيكل الشجري ─────────────────
function tasksChildren(parentKey) {
    const arr = Object.entries(window.tasksData || {})
        .filter(([, t]) => t && (t.parent || '') === (parentKey || ''))
        .map(([k, t]) => ({ k, ...t }));
    const manual = arr.some(t => typeof t.order === 'number'); // وضع الترتيب اليدوي إن وُجد
    return arr.sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (b.status === 'done' && a.status !== 'done') return -1;
        if (manual) return ((typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999)) || ((a.createdAt || 0) - (b.createdAt || 0));
        const pa = (TASK_PRIO[a.priority] || TASK_PRIO.medium).rank, pb = (TASK_PRIO[b.priority] || TASK_PRIO.medium).rank;
        const da = a.dueDate ? Date.parse(a.dueDate + 'T' + (a.dueTime || '23:59')) : Infinity;
        const dbb = b.dueDate ? Date.parse(b.dueDate + 'T' + (b.dueTime || '23:59')) : Infinity;
        if (da !== dbb) return da - dbb;
        if (pa !== pb) return pa - pb;
        return (a.createdAt || 0) - (b.createdAt || 0);
    });
}
function tasksDescendants(key, acc) { acc = acc || []; Object.entries(window.tasksData || {}).forEach(([k, t]) => { if (t && t.parent === key) { acc.push(k); tasksDescendants(k, acc); } }); return acc; }
function tasksProgress(key) { const kids = tasksChildren(key); if (!kids.length) return null; const done = kids.filter(c => c.status === 'done').length; return { done, total: kids.length, pct: Math.round(done / kids.length * 100) }; }

// ── محرّك التنبيهات ─────────────────
function tasksCheckReminders() {
    if (!window.tasksData) return;
    const now = Date.now(); const due = [];
    Object.entries(window.tasksData).forEach(([k, t]) => {
        if (!t || t.status === 'done') return;
        if (!tasksMine(t)) return; // تظهر فقط للمعنيّ بها أو منشئها
        const rem = t.reminder; if (!rem || !rem.enabled) return;
        const lead = (rem.lead || 0) * 60000;
        let fireOcc = null;
        const last = tasksLastOccurrence(rem, now + lead); // نطاق موسّع بمقدار التنبيه المسبق
        if (last != null && last > (rem.lastFiredAt || 0) && (last - lead) <= now) fireOcc = last;
        if (rem.snoozeUntil && now >= rem.snoozeUntil && rem.snoozeUntil > (rem.lastFiredAt || 0)) fireOcc = Math.max(fireOcc || 0, rem.snoozeUntil);
        if (fireOcc) due.push({ k, t, occ: fireOcc });
    });
    if (!due.length) return;
    due.forEach(d => { try { set(ref(db, 'ledger/tasks/' + d.k + '/reminder/lastFiredAt'), d.occ); set(ref(db, 'ledger/tasks/' + d.k + '/reminder/snoozeUntil'), null); } catch (e) { } });
    tasksShowAlert(due);
    tasksUpdateBadge();
}

function tasksBeep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); setTimeout(() => { o.stop(); a.close(); }, 350); } catch (e) { } }

function tasksShowAlert(due) {
    const dnd = tasksInDnd(); // ساعات الإزعاج: تكتم الصوت وإشعار المتصفح فقط
    if (!dnd) tasksBeep();
    // إشعارات المتصفح (تظهر حتى لو كان التبويب في الخلفية)
    if (!dnd && window.Notification && Notification.permission === 'granted') {
        due.forEach(d => { try { const n = new Notification('🔔 ' + (d.t.title || 'تنبيه مهمة'), { body: ((d.t.reminder && d.t.reminder.note) || d.t.notes || '') + ' — ' + tasksFmtDateTime(d.occ), tag: 'task-' + d.k, requireInteraction: true }); n.onclick = () => { window.focus(); window.tasksGotoTask(d.k); n.close(); }; } catch (e) { } });
    }
    let ov = document.getElementById('tasksAlertOverlay');
    const items = due.map(d => {
        const p = TASK_PRIO[d.t.priority] || TASK_PRIO.medium;
        return `<div data-k="${d.k}" style="border-right:4px solid ${p.color};background:#fff;border-radius:10px;padding:12px 14px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="background:${p.color};color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px">${p.label}</span>
                <span style="font-size:14px;font-weight:900;color:#1a3a5c">${(d.t.title || 'مهمة')}</span>
            </div>
            ${(d.t.reminder && d.t.reminder.note) ? `<div style="font-size:12px;color:#444;margin-top:5px;line-height:1.7">${d.t.reminder.note}</div>` : ''}
            ${d.t.notes ? `<div style="font-size:11px;color:#777;margin-top:4px">${d.t.notes}</div>` : ''}
            <div style="font-size:10px;color:#999;margin-top:5px">⏰ ${tasksFmtDateTime(d.occ)} · ${tasksReminderLabel(d.t.reminder)}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
                <button onclick="tasksAckReminder('${d.k}')" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer">✓ تم</button>
                <button onclick="tasksCompleteFromAlert('${d.k}')" style="background:#2d6a9f;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer">✅ إنهاء المهمة</button>
                <button onclick="tasksSnoozeReminder('${d.k}',10)" style="background:#f0f0f0;color:#555;border:none;border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer">⏲ 10 د</button>
                <button onclick="tasksSnoozeReminder('${d.k}',60)" style="background:#f0f0f0;color:#555;border:none;border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer">⏲ ساعة</button>
                <button onclick="tasksGotoTask('${d.k}')" style="background:#eef;color:#5b2c6f;border:none;border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer">↗ عرض</button>
            </div>
        </div>`;
    }).join('');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'tasksAlertOverlay';
        ov.style = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;width:380px;max-width:92vw;max-height:80vh;overflow:auto;background:linear-gradient(135deg,#fff6e9,#fff);border:1px solid #f0c419;border-radius:14px;padding:14px;box-shadow:0 16px 48px rgba(0,0,0,.28)';
        document.body.appendChild(ov);
    }
    ov.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:15px;font-weight:900;color:#7d4e00">🔔 تنبيهات مستحقة (${due.length})</div>
        <button onclick="document.getElementById('tasksAlertOverlay').remove()" style="background:none;border:none;cursor:pointer;font-size:16px;color:#999">✖</button>
    </div>${items}`;
}
window.tasksAckReminder = function (k) { const el = document.querySelector(`#tasksAlertOverlay [data-k="${k}"]`); if (el) el.remove(); const ov = document.getElementById('tasksAlertOverlay'); if (ov && !ov.querySelector('[data-k]')) ov.remove(); tasksUpdateBadge(); };
window.tasksCompleteFromAlert = function (k) { tasksToggleDone(k, true); tasksAckReminder(k); };
window.tasksSnoozeReminder = function (k, mins) { try { set(ref(db, 'ledger/tasks/' + k + '/reminder/snoozeUntil'), Date.now() + mins * 60000); set(ref(db, 'ledger/tasks/' + k + '/reminder/lastFiredAt'), Date.now()); } catch (e) { } window.tasksAckReminder(k); toast(`⏲ سيُذكّرك مجدداً بعد ${mins >= 60 ? 'ساعة' : mins + ' دقيقة'}`, 'ok', 3000); };
window.tasksGotoTask = function (k) { window.tasksAckReminder(k); if (typeof nav === 'function') nav('tasks', document.getElementById('n-tasks')); setTimeout(() => { const row = document.getElementById('taskrow-' + k); if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.style.transition = 'background .3s'; row.style.background = '#fff7d6'; setTimeout(() => row.style.background = '', 1600); } }, 300); };

function tasksUpdateBadge() {
    const now = Date.now(); let n = 0;
    Object.values(window.tasksData || {}).forEach(t => {
        if (!t || t.status === 'done') return; if (!tasksMine(t)) return;
        const dd = t.dueDate ? Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')) : null;
        if (dd && dd < now) { n++; return; }
        const rem = t.reminder; if (rem && rem.enabled) { const last = tasksLastOccurrence(rem, now); if (last != null && last > (rem.lastFiredAt || 0)) n++; }
    });
    const b = document.getElementById('tasksBadge'); if (b) { if (n > 0) { b.textContent = n; b.style.display = ''; } else b.style.display = 'none'; }
}
window.tasksRequestNotif = function () {
    if (!window.Notification) { toast('⚠️ متصفحك لا يدعم الإشعارات', 'er'); return; }
    Notification.requestPermission().then(p => { toast(p === 'granted' ? '✅ تم تفعيل إشعارات المتصفح' : 'لم يُمنح الإذن للإشعارات', p === 'granted' ? 'ok' : 'wn', 4000); renderTasks(); });
};

// ── عرض الصفحة ─────────────────
window.tasksSetFilter = function (f) { window._tasksState.filter = f; renderTasks(); };
window.tasksToggleExpand = function (k) { window._tasksState.expand[k] = !window._tasksState.expand[k]; renderTasks(); };

window.renderTasks = function () {
    const pg = $('pg-tasks'); if (!pg) return;
    const now = Date.now();
    const all = Object.entries(window.tasksData || {}).map(([k, t]) => ({ k, ...t })).filter(t => tasksInScope(t));
    const open = all.filter(t => t.status !== 'done');
    const overdue = open.filter(t => t.dueDate && Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')) < now);
    const doneCount = all.length - open.length;
    const upcoming = all.filter(t => t.status !== 'done' && t.reminder && t.reminder.enabled)
        .map(t => ({ ...t, nextAt: tasksNextOccurrence(t.reminder, now) }))
        .filter(t => t.nextAt != null)
        .sort((a, b) => (a.nextAt - b.nextAt) || ((TASK_PRIO[a.priority] || TASK_PRIO.medium).rank - (TASK_PRIO[b.priority] || TASK_PRIO.medium).rank));

    const st = window._tasksState;
    const card = (label, val, color) => `<div class="card" style="padding:12px 14px;text-align:center;border-top:3px solid ${color}"><div style="font-size:11px;color:#666">${label}</div><div style="font-size:22px;font-weight:900;color:${color}">${val}</div></div>`;
    const fbtn = (id, label) => `<button class="btn ${st.filter === id ? 'pri' : ''}" onclick="tasksSetFilter('${id}')" style="${st.filter === id ? 'background:#5b2c6f;color:#fff' : ''};padding:7px 14px;font-size:12px;font-weight:700">${label}</button>`;
    const scbtn = (id, label) => `<button class="btn" onclick="tasksSetScope('${id}')" style="${st.scope === id ? 'background:#2d6a9f;color:#fff' : 'background:#eef2f7;color:#445'};padding:6px 14px;font-size:12px;font-weight:700;border-radius:20px">${label}</button>`;
    const notifOn = window.Notification && Notification.permission === 'granted';
    const notifBtn = window.Notification ? `<button class="btn" onclick="tasksRequestNotif()" title="${notifOn ? 'إشعارات المتصفح مفعّلة' : 'فعّل إشعارات المتصفح'}" style="background:${notifOn ? '#16a34a' : '#eef2f7'};color:${notifOn ? '#fff' : '#445'};padding:6px 12px;font-size:12px;font-weight:700;border-radius:20px">${notifOn ? '🔔 إشعارات مفعّلة' : '🔕 تفعيل الإشعارات'}</button>` : '';
    const viewBtn = (id, label) => `<button class="btn" onclick="tasksSetView('${id}')" style="${st.view === id ? 'background:#5b2c6f;color:#fff' : 'background:#eef2f7;color:#445'};padding:6px 14px;font-size:12px;font-weight:700;border-radius:20px">${label}</button>`;
    const controlBar = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <div style="display:flex;gap:6px;flex-wrap:wrap">${scbtn('mine', '👤 تنبيهاتي')} ${scbtn('assigned', '📤 عيّنتها')} ${tasksCanManageAll() ? scbtn('all', '🌐 الكل') : ''}</div>
        <div style="flex:1"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${viewBtn('list', '📋 قائمة')} ${viewBtn('myday', '🎯 يومي')} ${viewBtn('kanban', '📊 لوحة')} ${viewBtn('calendar', '🗓️ تقويم')} ${viewBtn('stats', '📈 إحصائيات')}</div>
        ${notifBtn}
        ${st.selMode ? `<button class="btn" onclick="tasksToggleSelMode()" style="background:#c0392b;color:#fff;padding:6px 12px;font-size:12px;font-weight:700;border-radius:20px">✖ إنهاء التحديد</button>` : `<button class="btn" onclick="tasksToggleSelMode()" title="تحديد متعدد" style="background:#eef2f7;color:#445;padding:6px 12px;font-size:12px;font-weight:700;border-radius:20px">☑️ تحديد</button>`}
        <button class="btn" onclick="tasksOpenTemplates()" title="قوالب المهام" style="background:#eef2f7;color:#445;padding:6px 12px;font-size:12px;font-weight:700;border-radius:20px">🧩 قوالب</button>
        <button class="btn" onclick="tasksPrint()" title="طباعة" style="background:#eef2f7;color:#445;padding:6px 12px;font-size:12px;font-weight:700;border-radius:20px">🖨️ طباعة</button>
        <button class="btn" onclick="tasksExportExcel()" title="تصدير Excel" style="background:#eef2f7;color:#445;padding:6px 12px;font-size:12px;font-weight:700;border-radius:20px">📊 Excel</button>
        <button class="btn" onclick="tasksDailyAgenda()" title="أجندة اليوم" style="background:#eef2f7;color:#445;padding:6px 12px;font-size:12px;font-weight:700;border-radius:20px">📅 أجندة اليوم</button>
        <button class="btn" onclick="tasksExportICS()" title="تصدير تقويم ICS (Outlook/Google)" style="background:#eef2f7;color:#445;padding:6px 12px;font-size:12px;font-weight:700;border-radius:20px">📆 ICS</button>
        <button class="btn" onclick="tasksOpenSettings()" title="إعدادات التنبيهات (الإزعاج/التصعيد)" style="background:#eef2f7;color:#445;padding:6px 12px;font-size:12px;font-weight:700;border-radius:20px">⚙️</button>
        <input id="tasksSearchBox" value="${(st.search || '').replace(/"/g, '&quot;')}" oninput="tasksSearchInput(this.value)" placeholder="🔍 بحث…" style="flex:1;min-width:160px;padding:7px 10px;border:1.5px solid #d0d7e0;border-radius:20px;font-family:inherit;font-size:12.5px">
    </div>`;

    const upcomingPanel = upcoming.length ? `
        <div class="card" style="padding:14px;margin-bottom:14px">
            <div style="font-size:14px;font-weight:900;color:#7d4e00;margin-bottom:10px">🔔 التنبيهات القادمة (مرتّبة بالتاريخ والأولوية)</div>
            <div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow:auto">
                ${upcoming.slice(0, 30).map(t => { const p = TASK_PRIO[t.priority] || TASK_PRIO.medium; const soon = t.nextAt - now < 86400000; return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:6px 8px;background:${soon ? '#fff7d6' : '#f8fafc'};border-radius:8px">
                    <span style="width:9px;height:9px;border-radius:50%;background:${p.color};flex:none"></span>
                    <span style="font-weight:700;color:#1a3a5c;flex:1">${t.title || 'مهمة'}</span>
                    <span style="font-size:10px;color:#888">${tasksReminderLabel(t.reminder)}</span>
                    <span style="font-size:10px;color:${soon ? '#c0392b' : '#666'};font-weight:700">${tasksFmtDateTime(t.nextAt)}</span>
                </div>`; }).join('')}
            </div>
        </div>` : '';

    let html = `
        <div class="card" style="background:linear-gradient(135deg,#5b2c6f,#8e44ad);color:#fff;padding:18px 22px;border-radius:12px;margin-bottom:14px">
            <h2 style="margin:0;display:flex;align-items:center;gap:8px">🗓️ المهام والتنبيهات</h2>
            <div style="opacity:.92;margin-top:4px;font-size:13px">نظّم مهامك الرئيسية والفرعية، واضبط تذكيرات تظهر داخل البرنامج في وقتها بالضبط</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">
            ${card('مهام مفتوحة', open.length, '#2d6a9f')}
            ${card('متأخرة', overdue.length, overdue.length ? '#c0392b' : '#16a34a')}
            ${card('تنبيهات قادمة', upcoming.length, '#e67e22')}
            ${card('مكتملة', doneCount, '#16a34a')}
        </div>
        ${controlBar}
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <input id="taskQuickTitle" placeholder="أضف مهمة رئيسية سريعة…" onkeydown="if(event.key==='Enter')tasksQuickAdd()" style="flex:1;min-width:200px;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px">
                <select id="taskQuickPrio" style="padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:12px">
                    ${Object.entries(TASK_PRIO).map(([k, p]) => `<option value="${k}" ${k === 'medium' ? 'selected' : ''}>${p.label}</option>`).join('')}
                </select>
                <button class="btn" onclick="tasksQuickAdd()" style="background:#16a34a;color:#fff;padding:9px 16px;font-weight:800">➕ إضافة</button>
                <button class="btn" onclick="tasksOpenEditor('','')" style="background:#5b2c6f;color:#fff;padding:9px 16px;font-weight:800">🛠️ مهمة بتفاصيل وتنبيه</button>
            </div>
        </div>
        <div id="tasksMainArea">${tasksMainAreaHtml(upcomingPanel)}</div>
    `;
    pg.innerHTML = html;
};

// منطقة المحتوى القابلة لإعادة الرسم وحدها (بحث/وسوم/عرض)
function tasksMainAreaHtml(upcomingPanel) {
    const st = window._tasksState;
    const fbtn = (id, label) => `<button class="btn ${st.filter === id ? 'pri' : ''}" onclick="tasksSetFilter('${id}')" style="${st.filter === id ? 'background:#5b2c6f;color:#fff' : ''};padding:7px 14px;font-size:12px;font-weight:700">${label}</button>`;
    if (upcomingPanel == null) { // أعيد بناؤه عند الاستدعاء من البحث
        const now = Date.now();
        const up = Object.entries(window.tasksData || {}).map(([k, t]) => ({ k, ...t })).filter(t => tasksInScope(t) && t.status !== 'done' && t.reminder && t.reminder.enabled)
            .map(t => ({ ...t, nextAt: tasksNextOccurrence(t.reminder, now) })).filter(t => t.nextAt != null)
            .sort((a, b) => (a.nextAt - b.nextAt) || ((TASK_PRIO[a.priority] || TASK_PRIO.medium).rank - (TASK_PRIO[b.priority] || TASK_PRIO.medium).rank));
        upcomingPanel = up.length ? `<div class="card" style="padding:14px;margin-bottom:14px"><div style="font-size:14px;font-weight:900;color:#7d4e00;margin-bottom:10px">🔔 التنبيهات القادمة</div><div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow:auto">${up.slice(0, 30).map(t => { const p = TASK_PRIO[t.priority] || TASK_PRIO.medium; const soon = t.nextAt - now < 86400000; return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:6px 8px;background:${soon ? '#fff7d6' : '#f8fafc'};border-radius:8px"><span style="width:9px;height:9px;border-radius:50%;background:${p.color};flex:none"></span><span style="font-weight:700;color:#1a3a5c;flex:1">${t.title || 'مهمة'}</span><span style="font-size:10px;color:#888">${tasksReminderLabel(t.reminder)}</span><span style="font-size:10px;color:${soon ? '#c0392b' : '#666'};font-weight:700">${tasksFmtDateTime(t.nextAt)}</span></div>`; }).join('')}</div></div>` : '';
    }
    // شريط الوسوم (البحث موجود في شريط التحكم لتفادي فقد التركيز)
    const tags = tasksAllTags();
    const tagBar = (tags.length || st.search) ? `<div class="card" style="padding:8px 14px;margin-bottom:12px">
        ${st.search ? `<div style="font-size:11px;color:#888;margin-bottom:${tags.length ? '6px' : '0'}">نتائج البحث عن: «${(st.search || '').replace(/</g, '&lt;')}»</div>` : ''}
        ${tags.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${tags.map(tg => `<button onclick="tasksSetTag('${tg.replace(/'/g, "\\'")}')" style="border:none;cursor:pointer;font-size:11px;font-weight:700;border-radius:14px;padding:3px 10px;color:#fff;background:${tasksTagColor(tg)};opacity:${st.tagFilter && st.tagFilter !== tg ? '.4' : '1'};${st.tagFilter === tg ? 'outline:2px solid #333' : ''}">🏷️ ${tg}</button>`).join('')}${st.tagFilter ? `<button onclick="tasksSetTag('${st.tagFilter.replace(/'/g, "\\'")}')" style="border:none;cursor:pointer;font-size:11px;border-radius:14px;padding:3px 10px;background:#eee">✖ إلغاء الوسم</button>` : ''}</div>` : ''}
    </div>` : '';
    const bulkBar = st.selMode ? tasksBulkBar() : '';
    if (st.view === 'calendar') return tagBar + tasksRenderCalendar();
    if (st.view === 'kanban') return tagBar + tasksRenderKanban();
    if (st.view === 'stats') return tagBar + tasksRenderStats();
    if (st.view === 'myday') return tagBar + bulkBar + tasksRenderMyDay();
    return `${upcomingPanel}${tagBar}${bulkBar}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            ${fbtn('all', 'الكل')} ${fbtn('today', 'اليوم')} ${fbtn('overdue', '⚠️ متأخرة')} ${fbtn('upcoming', '🔔 لها تنبيه')} ${fbtn('done', '✅ مكتملة')}
        </div>
        <div class="card" style="padding:10px 6px">${tasksRenderTree('') || '<div style="text-align:center;color:#999;padding:30px">لا توجد مهام مطابقة.</div>'}</div>`;
}

window.tasksSetScope = function (s) { window._tasksState.scope = s; renderTasks(); };
window.tasksSetView = function (v) { window._tasksState.view = v; renderTasks(); };
window.tasksSearchInput = function (val) { window._tasksState.search = val; const c = document.getElementById('tasksMainArea'); if (c) c.innerHTML = tasksMainAreaHtml(); };
window.tasksSetTag = function (tag) { window._tasksState.tagFilter = (window._tasksState.tagFilter === tag) ? '' : tag; renderTasks(); };
window.tasksOpenLink = function (k) { const t = window.tasksData[k]; if (!t || !t.linkType) return; const def = TASK_LINK_TYPES[t.linkType]; if (def && def.open) def.open(t.linkId); };
// سجل النشاط
function tasksMeName() { return (window.myP && window.myP.name) || (window.curU && window.curU.email) || 'النظام'; }
function tasksLogActivity(k, action) { try { const uid = (window.curU && window.curU.uid) || 'system'; push(ref(db, 'ledger/tasks/' + k + '/activity'), { at: Date.now(), by: uid, byName: tasksMeName(), action }); } catch (e) { } }
window.tasksAddComment = function (k) {
    const el = $('tkCommentBox'); if (!el) return; const text = (el.value || '').trim(); if (!text) return;
    const uid = (window.curU && window.curU.uid) || 'system';
    push(ref(db, 'ledger/tasks/' + k + '/comments'), { at: Date.now(), by: uid, byName: tasksMeName(), text }).then(() => { el.value = ''; toast('💬 أُضيف التعليق', 'ok', 2000); setTimeout(() => tasksOpenEditor('', k), 150); }).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
// ── تحديد متعدد + إجراءات جماعية ─────────────────
window.tasksToggleSelMode = function () { const st = window._tasksState; st.selMode = !st.selMode; if (!st.selMode) st.selected = {}; renderTasks(); };
window.tasksToggleSelect = function (k, on) { window._tasksState.selected[k] = on; const c = document.getElementById('tasksMainArea'); if (c) c.innerHTML = tasksMainAreaHtml(); };
window.tasksSelectAllVisible = function () { const st = window._tasksState; Object.entries(window.tasksData || {}).forEach(([k, t]) => { if (tasksInScope(t) && tasksMatchesFilter({ k, ...t })) st.selected[k] = true; }); renderTasks(); };
window.tasksClearSelection = function () { window._tasksState.selected = {}; renderTasks(); };
function tasksSelectedKeys() { const s = window._tasksState.selected || {}; return Object.keys(s).filter(k => s[k] && window.tasksData[k]); }
function tasksBulkBar() {
    const n = tasksSelectedKeys().length; const inp = 'padding:6px;border:1px solid #cdd;border-radius:6px;font-family:inherit;font-size:12px';
    return `<div class="card" style="padding:10px 14px;margin-bottom:12px;background:#eef6ff;border:1px solid #bcdcf5">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <span style="font-weight:800;color:#2d6a9f">☑️ محدد: ${n}</span>
            <button class="btn" onclick="tasksSelectAllVisible()" style="background:#dbe9f7;padding:5px 10px;font-size:11px">تحديد الظاهر</button>
            <button class="btn" onclick="tasksClearSelection()" style="background:#eee;padding:5px 10px;font-size:11px">مسح</button>
            <span style="width:1px;height:20px;background:#bcd"></span>
            <select id="tkBulkStatus" style="${inp}"><option value="">الحالة…</option>${Object.entries(TASK_STATUS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select>
            <button class="btn" onclick="tasksBulk('status',document.getElementById('tkBulkStatus').value)" style="background:#2d6a9f;color:#fff;padding:5px 10px;font-size:11px">تطبيق</button>
            <select id="tkBulkPrio" style="${inp}"><option value="">الأولوية…</option>${Object.entries(TASK_PRIO).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('')}</select>
            <button class="btn" onclick="tasksBulk('priority',document.getElementById('tkBulkPrio').value)" style="background:#2d6a9f;color:#fff;padding:5px 10px;font-size:11px">تطبيق</button>
            <select id="tkBulkAssign" style="${inp}">${tasksAssigneeOptions('')}</select>
            <button class="btn" onclick="tasksBulk('assign',document.getElementById('tkBulkAssign').value)" style="background:#2d6a9f;color:#fff;padding:5px 10px;font-size:11px">تعيين</button>
            <button class="btn" onclick="tasksBulk('delete')" style="background:#c0392b;color:#fff;padding:5px 10px;font-size:11px">🗑️ حذف</button>
        </div></div>`;
}
window.tasksBulk = function (action, value) {
    const keys = tasksSelectedKeys(); if (!keys.length) { toast('⚠️ لم تحدد أي مهمة', 'er'); return; }
    const now = Date.now(); const upd = {};
    if (action === 'delete') { if (!confirm('حذف ' + keys.length + ' مهمة (وفروعها) نهائياً؟')) return; keys.forEach(k => { upd['ledger/tasks/' + k] = null; tasksDescendants(k).forEach(c => upd['ledger/tasks/' + c] = null); }); }
    else if (action === 'status') { if (!value) return; keys.forEach(k => { upd['ledger/tasks/' + k + '/status'] = value; upd['ledger/tasks/' + k + '/completedAt'] = value === 'done' ? now : null; if (value === 'done') tasksDescendants(k).forEach(c => { upd['ledger/tasks/' + c + '/status'] = 'done'; upd['ledger/tasks/' + c + '/completedAt'] = now; }); tasksLogActivity(k, 'تغيير جماعي للحالة → ' + TASK_STATUS[value].label); }); }
    else if (action === 'priority') { if (!value) return; keys.forEach(k => { upd['ledger/tasks/' + k + '/priority'] = value; }); }
    else if (action === 'assign') { const nm = value ? tasksUserName(value) : ''; keys.forEach(k => { upd['ledger/tasks/' + k + '/assignedTo'] = value || null; upd['ledger/tasks/' + k + '/assignedName'] = value ? nm : null; tasksLogActivity(k, value ? 'عُيّنت إلى ' + nm + ' (جماعي)' : 'أُلغي التعيين (جماعي)'); }); }
    update(ref(db), upd).then(() => { toast('✅ تم تطبيق الإجراء على ' + keys.length + ' مهمة', 'ok'); window._tasksState.selected = {}; tasksUpdateBadge(); renderTasks(); }).catch(e => toast('❌ ' + (e.message || e), 'er'));
};

// ── عرض «يومي» (تركيز) ─────────────────
function tasksMiniCard(t) {
    const p = TASK_PRIO[t.priority] || TASK_PRIO.medium; const blk = tasksBlockerState(t);
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border:1px solid #eee;border-right:4px solid ${p.color};border-radius:9px;margin-bottom:8px">
        <input type="checkbox" onchange="tasksToggleDone('${t.k}',this.checked)" style="width:17px;height:17px;accent-color:#16a34a;cursor:pointer">
        <div style="flex:1;min-width:0;cursor:pointer" onclick="tasksOpenEditor('','${t.k}')">
            <div style="font-size:13px;font-weight:700;color:#1a3a5c">${(t.title || 'مهمة').replace(/</g, '&lt;')}</div>
            <div style="font-size:10.5px;color:#888;display:flex;gap:10px;flex-wrap:wrap;margin-top:2px">
                ${t.dueDate ? `<span>📅 ${t.dueDate}${t.dueTime ? ' ' + t.dueTime : ''}</span>` : ''}
                ${(t.reminder && t.reminder.enabled) ? `<span style="color:#7d4e00">🔔 ${tasksReminderLabel(t.reminder)}</span>` : ''}
                ${t.assignedTo ? `<span style="color:#2d6a9f">👤 ${(t.assignedName || '').replace(/</g, '&lt;')}</span>` : ''}
                ${blk.open ? `<span style="color:#c0392b">🔒 معطّلة</span>` : ''}
                ${tasksBadges(t)}
            </div>
        </div>
        <span style="font-size:10px;color:${p.color};font-weight:700">${p.label}</span>
    </div>`;
}
function tasksRenderMyDay() {
    const now = Date.now(); const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const todayStr = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
    const all = Object.entries(window.tasksData || {}).map(([k, t]) => ({ k, ...t })).filter(t => tasksInScope(t) && tasksMatchesSearchTag(t) && t.status !== 'done');
    const overdue = all.filter(t => t.dueDate && Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')) < now).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    const todayDue = all.filter(t => t.dueDate === todayStr && !overdue.includes(t));
    const remToday = tasksDayItems(d0.getTime()).filter(it => it.kind === 'rem' && it.t.status !== 'done');
    const noDate = all.filter(t => !t.dueDate && !(t.reminder && t.reminder.enabled)).sort((a, b) => (TASK_PRIO[a.priority] || TASK_PRIO.medium).rank - (TASK_PRIO[b.priority] || TASK_PRIO.medium).rank).slice(0, 8);
    const sec = (title, color, body, count) => `<div class="card" style="padding:14px;margin-bottom:12px"><div style="font-size:14px;font-weight:900;color:${color};margin-bottom:10px">${title} <span style="font-size:12px;color:#999">(${count})</span></div>${body || '<div style="color:#bbb;font-size:12px;text-align:center;padding:14px">لا شيء 🎉</div>'}</div>`;
    return `<div style="font-size:12px;color:#666;margin-bottom:10px">🎯 تركيز اليوم — ${d0.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        ${sec('⚠️ متأخرة', '#c0392b', overdue.map(tasksMiniCard).join(''), overdue.length)}
        ${sec('📅 مستحقة اليوم', '#2d6a9f', todayDue.map(tasksMiniCard).join(''), todayDue.length)}
        ${sec('🔔 تنبيهات اليوم', '#7d4e00', remToday.map(it => tasksMiniCard(it.t)).join(''), remToday.length)}
        ${noDate.length ? sec('💡 بلا موعد (مقترحات)', '#16a085', noDate.map(tasksMiniCard).join(''), noDate.length) : ''}`;
}

// ── لوحة الإحصائيات والتحليل ─────────────────
function tasksRenderStats() {
    const all = Object.entries(window.tasksData || {}).map(([k, t]) => ({ k, ...t })).filter(t => tasksInScope(t) && tasksMatchesSearchTag(t));
    const now = Date.now(); const total = all.length; const done = all.filter(t => t.status === 'done').length;
    const open = all.filter(t => t.status !== 'done');
    const overdue = open.filter(t => t.dueDate && Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')) < now).length;
    const weekEnd = now + 7 * 86400000; const dueWeek = open.filter(t => t.dueDate && Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')) >= now && Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')) <= weekEnd).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    // بيانات الرسوم
    const byStatus = { open: 0, doing: 0, done: 0 }; all.forEach(t => byStatus[t.status || 'open'] = (byStatus[t.status || 'open'] || 0) + 1);
    const byPrio = { urgent: 0, high: 0, medium: 0, low: 0 }; open.forEach(t => byPrio[t.priority || 'medium']++);
    const byAssignee = {}; open.forEach(t => { const nm = t.assignedName || (t.assignedTo ? tasksUserName(t.assignedTo) : 'غير معيّنة'); byAssignee[nm] = (byAssignee[nm] || 0) + 1; });
    const last7 = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); const s = d.getTime(), e = s + 86400000; last7.push({ label: d.toLocaleDateString('ar-EG', { weekday: 'short' }), n: all.filter(t => t.completedAt && t.completedAt >= s && t.completedAt < e).length }); }
    window._tasksStatsData = { byStatus, byPrio, byAssignee, last7 };
    setTimeout(tasksDrawStatsCharts, 60);
    const kpi = (lbl, val, color) => `<div class="card" style="padding:14px;text-align:center;border-top:3px solid ${color}"><div style="font-size:11px;color:#666">${lbl}</div><div style="font-size:24px;font-weight:900;color:${color}">${val}</div></div>`;
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">
            ${kpi('إجمالي المهام', total, '#5b2c6f')}${kpi('نسبة الإنجاز', pct + '%', pct >= 70 ? '#16a34a' : pct >= 40 ? '#e67e22' : '#c0392b')}${kpi('متأخرة', overdue, overdue ? '#c0392b' : '#16a34a')}${kpi('تستحق هذا الأسبوع', dueWeek, '#2d6a9f')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
            <div class="card" style="padding:14px"><div style="font-weight:800;color:#1a3a5c;margin-bottom:8px;font-size:13px">حسب الحالة</div><canvas id="tkChartStatus" height="200"></canvas></div>
            <div class="card" style="padding:14px"><div style="font-weight:800;color:#1a3a5c;margin-bottom:8px;font-size:13px">المفتوحة حسب الأولوية</div><canvas id="tkChartPrio" height="200"></canvas></div>
            <div class="card" style="padding:14px"><div style="font-weight:800;color:#1a3a5c;margin-bottom:8px;font-size:13px">توزيع العبء (مهام مفتوحة)</div><canvas id="tkChartAssignee" height="200"></canvas></div>
            <div class="card" style="padding:14px"><div style="font-weight:800;color:#1a3a5c;margin-bottom:8px;font-size:13px">المُنجز خلال 7 أيام</div><canvas id="tkChartTrend" height="200"></canvas></div>
        </div>`;
}
window._tasksCharts = window._tasksCharts || {};
function tasksDrawStatsCharts() {
    if (!window.Chart) { const a = document.getElementById('tkChartStatus'); if (a) a.parentElement.innerHTML = '<div style="color:#999;font-size:12px">مكتبة الرسوم غير محمّلة</div>'; return; }
    const d = window._tasksStatsData; if (!d) return;
    Object.values(window._tasksCharts).forEach(c => { try { c.destroy(); } catch (e) { } }); window._tasksCharts = {};
    const mk = (id, cfg) => { const el = document.getElementById(id); if (el) window._tasksCharts[id] = new Chart(el, cfg); };
    Chart.defaults.font.family = "'Segoe UI',Tahoma,sans-serif";
    mk('tkChartStatus', { type: 'doughnut', data: { labels: ['مفتوحة', 'قيد التنفيذ', 'مكتملة'], datasets: [{ data: [d.byStatus.open || 0, d.byStatus.doing || 0, d.byStatus.done || 0], backgroundColor: ['#888', '#2d6a9f', '#16a34a'] }] }, options: { plugins: { legend: { position: 'bottom', rtl: true, labels: { font: { size: 11 } } } } } });
    mk('tkChartPrio', { type: 'bar', data: { labels: ['عاجل', 'مرتفع', 'متوسط', 'منخفض'], datasets: [{ data: [d.byPrio.urgent, d.byPrio.high, d.byPrio.medium, d.byPrio.low], backgroundColor: ['#c0392b', '#e67e22', '#2d6a9f', '#16a085'] }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    const an = Object.keys(d.byAssignee), av = Object.values(d.byAssignee);
    mk('tkChartAssignee', { type: 'bar', data: { labels: an, datasets: [{ data: av, backgroundColor: '#5b2c6f' }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } } });
    mk('tkChartTrend', { type: 'line', data: { labels: d.last7.map(x => x.label), datasets: [{ data: d.last7.map(x => x.n), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.15)', fill: true, tension: .35 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
}

// ── ويدجت لوحة البداية ─────────────────
window.tasksRenderHomeWidget = function () {
    const el = document.getElementById('tasksHomeWidget'); if (!el) return;
    if (!window.tasksData || !Object.keys(window.tasksData).length) { el.innerHTML = ''; return; }
    const now = Date.now(); const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const todayStr = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
    const mine = Object.entries(window.tasksData).map(([k, t]) => ({ k, ...t })).filter(t => tasksInScope(t) && t.status !== 'done');
    const overdue = mine.filter(t => t.dueDate && Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')) < now);
    const today = mine.filter(t => t.dueDate === todayStr && !overdue.includes(t));
    const upcoming = mine.filter(t => t.reminder && t.reminder.enabled).map(t => ({ ...t, nextAt: tasksNextOccurrence(t.reminder, now) })).filter(t => t.nextAt != null && t.nextAt < now + 3 * 86400000).sort((a, b) => a.nextAt - b.nextAt);
    if (!overdue.length && !today.length && !upcoming.length) { el.innerHTML = ''; return; }
    const top = [...overdue.map(t => ({ t, tag: 'متأخرة', c: '#c0392b' })), ...today.map(t => ({ t, tag: 'اليوم', c: '#2d6a9f' })), ...upcoming.map(t => ({ t, tag: tasksFmtDateTime(t.nextAt), c: '#7d4e00' }))].slice(0, 6);
    el.innerHTML = `<div style="background:linear-gradient(135deg,#faf5ff,#fff);border:1.5px solid #e2d4f0;border-radius:14px;padding:16px 20px;box-shadow:0 4px 14px rgba(0,0,0,.05)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px"><div style="font-size:26px">🗓️</div><div><div style="font-size:15px;font-weight:800;color:#5b2c6f">مهامك اليوم</div><div style="font-size:12px;color:#666;margin-top:2px">${overdue.length ? `<span style="color:#c0392b;font-weight:700">${overdue.length} متأخرة</span> · ` : ''}${today.length} مستحقة اليوم · ${upcoming.length} تنبيه قريب</div></div></div>
            <button class="btn" style="padding:7px 14px;font-size:12px;background:#5b2c6f;color:#fff" onclick="nav('tasks',document.getElementById('n-tasks'))">📋 فتح المهام</button>
        </div>
        <div style="display:grid;gap:7px">${top.map(({ t, tag, c }) => { const p = TASK_PRIO[t.priority] || TASK_PRIO.medium; return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border-radius:9px;border-right:4px solid ${p.color};cursor:pointer" onclick="nav('tasks',document.getElementById('n-tasks'))"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:#1a3a5c">${(t.title || 'مهمة').replace(/</g, '&lt;')}</div></div><div style="background:${c}18;color:${c};padding:4px 11px;border-radius:9px;font-size:11px;font-weight:700;white-space:nowrap">${tag}</div></div>`; }).join('')}</div>
    </div>`;
};

// ── المشاركة (واتساب/بريد) ─────────────────
function tasksAgendaText() {
    const d = new Date(); d.setHours(0, 0, 0, 0); const items = tasksDayItems(d.getTime());
    let txt = '📅 أجندة ' + d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }) + '\n';
    if (!items.length) txt += '— لا توجد بنود اليوم'; else items.forEach(it => { txt += (it.kind === 'rem' ? '🔔 ' : '📌 ') + (it.time ? it.time + ' — ' : '') + (it.t.title || '') + (it.t.assignedName ? ' (' + it.t.assignedName + ')' : '') + '\n'; });
    return txt.trim();
}
window.tasksShareAgenda = function (mode) { const txt = tasksAgendaText(); if (mode === 'email') location.href = 'mailto:?subject=' + encodeURIComponent('أجندة اليوم') + '&body=' + encodeURIComponent(txt); else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank'); };
window.tasksShareTask = function (k, mode) {
    const t = window.tasksData[k]; if (!t) return;
    let txt = '📌 ' + (t.title || 'مهمة') + '\n';
    if (t.dueDate) txt += 'الاستحقاق: ' + t.dueDate + (t.dueTime ? ' ' + t.dueTime : '') + '\n';
    txt += 'الأولوية: ' + (TASK_PRIO[t.priority] || TASK_PRIO.medium).label + ' · الحالة: ' + (TASK_STATUS[t.status] || TASK_STATUS.open).label + '\n';
    if (t.assignedName) txt += 'المسؤول: ' + t.assignedName + '\n';
    if (t.reminder && t.reminder.enabled) txt += 'تذكير: ' + tasksReminderLabel(t.reminder) + '\n';
    if (t.notes) txt += '\n' + t.notes;
    if (mode === 'email') location.href = 'mailto:?subject=' + encodeURIComponent(t.title || 'مهمة') + '&body=' + encodeURIComponent(txt.trim()); else window.open('https://wa.me/?text=' + encodeURIComponent(txt.trim()), '_blank');
};

// ── القوالب (قوائم تدقيق متكررة) ─────────────────
window.tasksOpenTemplates = function () {
    document.getElementById('taskEditorOverlay')?.remove();
    const custom = window.tasksTemplates || {};
    const builtinHtml = Object.entries(TASK_BUILTIN_TEMPLATES).map(([id, t]) => tasksTemplateRow(id, t, true)).join('');
    const customHtml = Object.entries(custom).map(([id, t]) => tasksTemplateRow(id, t, false)).join('') || '<div style="color:#bbb;font-size:12px;padding:8px">لا توجد قوالب مخصصة بعد</div>';
    const ov = document.createElement('div'); ov.id = 'taskEditorOverlay';
    ov.style = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px';
    const inp = 'width:100%;padding:8px;border:1px solid #d0d7e0;border-radius:7px;font-family:inherit;font-size:13px';
    ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="background:linear-gradient(135deg,#5b2c6f,#8e44ad);color:#fff;padding:14px 18px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center"><div style="font-size:15px;font-weight:900">🧩 قوالب المهام</div><button onclick="tasksCloseEditor()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:7px;cursor:pointer">✖</button></div>
        <div style="padding:18px;max-height:72vh;overflow:auto">
            <div style="font-size:12px;font-weight:800;color:#5b2c6f;margin-bottom:6px">قوالب جاهزة</div>${builtinHtml}
            <div style="font-size:12px;font-weight:800;color:#5b2c6f;margin:14px 0 6px">قوالبي المخصصة</div>${customHtml}
            <div style="border-top:1px solid #eee;margin-top:14px;padding-top:12px">
                <div style="font-size:12px;font-weight:800;color:#5b2c6f;margin-bottom:6px">➕ إنشاء قالب جديد</div>
                <input id="tplName" placeholder="اسم القالب (مثال: تجهيز اجتماع)" style="${inp};margin-bottom:8px">
                <textarea id="tplItems" rows="5" placeholder="عنوان كل مهمة فرعية في سطر…" style="${inp}"></textarea>
                <button class="btn" onclick="tasksSaveTemplate()" style="background:#16a34a;color:#fff;padding:8px 18px;font-weight:800;margin-top:8px">💾 حفظ القالب</button>
            </div>
        </div></div>`;
    document.body.appendChild(ov);
};
function tasksTemplateRow(id, t, builtin) {
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f7f7fb;border-radius:8px;margin-bottom:6px">
        <div style="flex:1"><div style="font-size:13px;font-weight:700;color:#1a3a5c">${(t.name || '').replace(/</g, '&lt;')}</div><div style="font-size:10.5px;color:#888">${(t.items || []).length} مهمة فرعية</div></div>
        <button class="btn" onclick="tasksApplyTemplate('${id}',${builtin})" style="background:#2d6a9f;color:#fff;padding:5px 12px;font-size:11px;font-weight:700">إنشاء</button>
        ${builtin ? '' : `<button class="btn" onclick="tasksDeleteTemplate('${id}')" style="background:#f0e0e0;color:#c0392b;padding:5px 10px;font-size:11px">🗑️</button>`}
    </div>`;
}
window.tasksSaveTemplate = function () {
    const name = ($('tplName').value || '').trim(); const items = ($('tplItems').value || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!name || !items.length) { toast('⚠️ أدخل اسم القالب وعنصراً واحداً على الأقل', 'er'); return; }
    push(TASK_TEMPLATES_REF(), { name, items, createdAt: Date.now() }).then(() => { toast('✅ تم حفظ القالب', 'ok'); tasksOpenTemplates(); }).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.tasksDeleteTemplate = function (id) { if (!confirm('حذف هذا القالب؟')) return; remove(ref(db, 'ledger/taskTemplates/' + id)).then(() => { toast('🗑️ حُذف القالب', 'ok'); tasksOpenTemplates(); }).catch(e => toast('❌ ' + (e.message || e), 'er')); };
window.tasksApplyTemplate = function (id, builtin) {
    const tpl = builtin ? TASK_BUILTIN_TEMPLATES[id] : (window.tasksTemplates || {})[id]; if (!tpl) return;
    const uid = (window.curU && window.curU.uid) || 'system'; const now = Date.now();
    push(R.tasks, { title: tpl.name, parent: '', priority: 'medium', status: 'open', notes: 'أُنشئت من قالب', reminder: { enabled: false }, createdAt: now, createdBy: uid, updatedAt: now }).then(r => {
        const pk = r.key; tasksLogActivity(pk, 'أُنشئت من قالب «' + tpl.name + '»');
        const ups = {}; (tpl.items || []).forEach((it, i) => { const nk = push(R.tasks).key; ups['ledger/tasks/' + nk] = { title: it, parent: pk, priority: 'medium', status: 'open', reminder: { enabled: false }, createdAt: now + i + 1, createdBy: uid, updatedAt: now }; });
        return update(ref(db), ups);
    }).then(() => { toast('✅ تم إنشاء المهمة وفروعها من القالب', 'ok', 3000); tasksCloseEditor(); }).catch(e => toast('❌ ' + (e.message || e), 'er'));
};

window.tasksCalNav = function (dir) {
    const st = window._tasksState; const d = new Date(st.calAnchor);
    if (st.calMode === 'week') d.setDate(d.getDate() + dir * 7); else d.setMonth(d.getMonth() + dir);
    st.calAnchor = d.getTime(); renderTasks();
};
window.tasksCalToday = function () { window._tasksState.calAnchor = Date.now(); renderTasks(); };
window.tasksCalMode = function (m) { window._tasksState.calMode = m; renderTasks(); };

// يجمع بنود اليوم: المهام المستحقة + مواعيد التذكيرات الواقعة في ذلك اليوم
function tasksDayItems(dayStart) {
    const dayEnd = dayStart + 86400000; const items = [];
    const d = new Date(dayStart); const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    Object.entries(window.tasksData || {}).forEach(([k, t]) => {
        if (!t || !tasksInScope(t) || !tasksMatchesSearchTag({ k, ...t })) return;
        if (t.dueDate === ds) items.push({ k, t, kind: 'due', at: Date.parse(ds + 'T' + (t.dueTime || '09:00')) || dayStart, time: t.dueTime || '' });
        const rem = t.reminder;
        if (rem && rem.enabled && t.status !== 'done') { const occ = tasksNextOccurrence(rem, dayStart); if (occ != null && occ < dayEnd) items.push({ k, t, kind: 'rem', at: occ, time: rem.time || '' }); }
    });
    return items.sort((a, b) => a.at - b.at);
}

function tasksRenderCalendar() {
    const st = window._tasksState; const anchor = new Date(st.calAnchor);
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    let gridStart, gridDays, title;
    if (st.calMode === 'week') {
        const s = new Date(anchor); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - s.getDay());
        gridStart = s.getTime(); gridDays = 7; title = `أسبوع ${s.getDate()} ${monthNames[s.getMonth()]} ${s.getFullYear()}`;
    } else {
        const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        const s = new Date(first); s.setDate(1 - first.getDay()); s.setHours(0, 0, 0, 0);
        gridStart = s.getTime(); gridDays = 42; title = `${monthNames[anchor.getMonth()]} ${anchor.getFullYear()}`;
    }
    const todayStr = (() => { const n = new Date(); return n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate(); })();
    const head = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn" onclick="tasksCalNav(-1)" style="background:#eef2f7;padding:6px 12px;font-weight:800">‹ السابق</button>
        <button class="btn" onclick="tasksCalToday()" style="background:#5b2c6f;color:#fff;padding:6px 12px;font-weight:700">اليوم</button>
        <button class="btn" onclick="tasksCalNav(1)" style="background:#eef2f7;padding:6px 12px;font-weight:800">التالي ›</button>
        <div style="font-size:15px;font-weight:900;color:#5b2c6f;flex:1;text-align:center">${title}</div>
        <div style="display:flex;gap:5px">
            <button class="btn" onclick="tasksCalMode('month')" style="${st.calMode === 'month' ? 'background:#2d6a9f;color:#fff' : 'background:#eef2f7'};padding:5px 12px;font-size:12px;font-weight:700">شهر</button>
            <button class="btn" onclick="tasksCalMode('week')" style="${st.calMode === 'week' ? 'background:#2d6a9f;color:#fff' : 'background:#eef2f7'};padding:5px 12px;font-size:12px;font-weight:700">أسبوع</button>
        </div>
    </div>`;
    const dowHead = TASK_WEEKDAYS.map(w => `<div style="text-align:center;font-size:11px;font-weight:800;color:#5b2c6f;padding:6px 0">${w}</div>`).join('');
    let cells = '';
    const cellMinH = st.calMode === 'week' ? '160px' : '92px';
    for (let i = 0; i < gridDays; i++) {
        const dayStart = gridStart + i * 86400000; const dd = new Date(dayStart);
        const inMonth = st.calMode === 'week' || dd.getMonth() === anchor.getMonth();
        const isToday = (dd.getFullYear() + '-' + (dd.getMonth() + 1) + '-' + dd.getDate()) === todayStr;
        const items = tasksDayItems(dayStart);
        const ds = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
        const chips = items.slice(0, st.calMode === 'week' ? 12 : 4).map(it => {
            const p = TASK_PRIO[it.t.priority] || TASK_PRIO.medium; const done = it.t.status === 'done';
            const icon = it.kind === 'rem' ? '🔔' : '📌';
            return `<div onclick="tasksOpenEditor('','${it.k}')" title="${(it.t.title || '').replace(/"/g, '&quot;')}" style="display:flex;align-items:center;gap:3px;font-size:10px;background:${done ? '#eee' : p.color + '22'};border-right:3px solid ${p.color};border-radius:4px;padding:2px 5px;margin-bottom:2px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${done ? 'text-decoration:line-through;color:#999' : 'color:#333'}">${icon}${it.time ? ' ' + it.time : ''} ${(it.t.title || 'مهمة')}</div>`;
        }).join('');
        const more = items.length > (st.calMode === 'week' ? 12 : 4) ? `<div style="font-size:9px;color:#888">+${items.length - (st.calMode === 'week' ? 12 : 4)} أخرى</div>` : '';
        cells += `<div onclick="if(event.target===this)tasksCalAdd('${ds}')" style="min-height:${cellMinH};border:1px solid #eef0f3;border-radius:6px;padding:4px;background:${isToday ? '#fff7d6' : inMonth ? '#fff' : '#fafafa'};opacity:${inMonth ? 1 : .55};cursor:pointer;overflow:hidden">
            <div style="font-size:11px;font-weight:${isToday ? '900' : '700'};color:${isToday ? '#c0392b' : '#555'};margin-bottom:3px">${dd.getDate()}</div>
            ${chips}${more}
        </div>`;
    }
    return `<div class="card" style="padding:14px">${head}
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${dowHead}${cells}</div>
        <div style="font-size:10.5px;color:#888;margin-top:10px;display:flex;gap:14px;flex-wrap:wrap"><span>📌 استحقاق مهمة</span><span>🔔 موعد تذكير</span><span>انقر يوماً فارغاً لإضافة مهمة فيه — أو بنداً لفتحه</span></div>
    </div>`;
}
window.tasksCalAdd = function (ds) { tasksOpenEditor('', ''); setTimeout(() => { const el = $('tkDueDate'); if (el) el.value = ds; }, 60); };

// شارات صغيرة مشتركة (وسوم/ربط) للبطاقات والصفوف
function tasksBadges(t) {
    const link = tasksLinkLabel(t);
    let h = '';
    if (link) h += `<span onclick="event.stopPropagation();tasksOpenLink('${t.k}')" title="فتح ${link}" style="cursor:pointer;color:#2d6a9f;background:#eaf2fb;border-radius:6px;padding:1px 7px;font-size:10px;font-weight:700">${link}</span>`;
    (Array.isArray(t.tags) ? t.tags : []).forEach(tg => h += `<span style="color:#fff;background:${tasksTagColor(tg)};border-radius:10px;padding:1px 8px;font-size:9.5px;font-weight:700">🏷️${tg}</span>`);
    if (Array.isArray(t.attachments) && t.attachments.length) h += `<span title="مرفقات" style="color:#6b4e9e">📎 ${t.attachments.length}</span>`;
    return h;
}

// ── عرض لوحة كانبان (سحب وإفلات بين الحالات) ─────────────────
function tasksRenderKanban() {
    const cols = [['open', '#888'], ['doing', '#2d6a9f'], ['done', '#16a34a']];
    const all = Object.entries(window.tasksData || {}).map(([k, t]) => ({ k, ...t })).filter(t => tasksInScope(t) && tasksMatchesSearchTag(t));
    const now = Date.now();
    const colHtml = cols.map(([sk, color]) => {
        const items = all.filter(t => (t.status || 'open') === sk).sort((a, b) => (TASK_PRIO[a.priority] || TASK_PRIO.medium).rank - (TASK_PRIO[b.priority] || TASK_PRIO.medium).rank);
        const cards = items.map(t => {
            const p = TASK_PRIO[t.priority] || TASK_PRIO.medium;
            const dueMs = t.dueDate ? Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')) : null;
            const overdue = dueMs && dueMs < now && sk !== 'done';
            const badges = tasksBadges(t);
            return `<div draggable="true" ondragstart="tasksDragStart(event,'${t.k}')" onclick="tasksOpenEditor('','${t.k}')" style="background:#fff;border:1px solid #e6e9ee;border-right:4px solid ${p.color};border-radius:8px;padding:8px 10px;margin-bottom:8px;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,.06)">
                <div style="font-size:12.5px;font-weight:700;color:#1a3a5c;margin-bottom:4px">${(t.title || 'مهمة').replace(/</g, '&lt;')}</div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;font-size:10px;color:#888">
                    <span style="color:${p.color};font-weight:700">${p.label}</span>
                    ${t.dueDate ? `<span style="color:${overdue ? '#c0392b' : '#888'}">📅 ${t.dueDate}</span>` : ''}
                    ${t.assignedTo ? `<span style="color:#2d6a9f">👤 ${(t.assignedName || tasksUserName(t.assignedTo) || '').replace(/</g, '&lt;')}</span>` : ''}
                    ${(t.reminder && t.reminder.enabled) ? '<span style="color:#7d4e00">🔔</span>' : ''}
                    ${badges}
                </div>
            </div>`;
        }).join('');
        return `<div ondragover="event.preventDefault()" ondrop="tasksDrop(event,'${sk}')" style="flex:1;min-width:230px;background:#f5f7fa;border-radius:10px;padding:10px">
            <div style="display:flex;align-items:center;gap:6px;font-weight:900;font-size:13px;color:${color};margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${color}33">
                <span style="width:9px;height:9px;border-radius:50%;background:${color}"></span>${TASK_STATUS[sk].label} <span style="background:${color};color:#fff;border-radius:10px;padding:0 8px;font-size:11px">${items.length}</span>
            </div>
            ${cards || '<div style="text-align:center;color:#bbb;font-size:11px;padding:20px 0">— اسحب مهمة هنا —</div>'}
        </div>`;
    }).join('');
    return `<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start">${colHtml}</div>
        <div style="font-size:10.5px;color:#888;margin-top:8px">اسحب البطاقات بين الأعمدة لتغيير الحالة — أو انقر بطاقة لفتحها.</div>`;
}
window.tasksDragStart = function (ev, k) { ev.dataTransfer.setData('text/plain', k); ev.dataTransfer.effectAllowed = 'move'; };
window.tasksDrop = function (ev, status) {
    ev.preventDefault(); const k = ev.dataTransfer.getData('text/plain'); const t = window.tasksData[k]; if (!t || (t.status || 'open') === status) return;
    if (status === 'done') { const blk = tasksBlockerState(t); if (blk.open) { toast('🔒 لا يمكن الإكمال — يجب إنجاز ' + blk.open + ' مهمة مرتبطة أولاً', 'er', 4500); renderTasks(); return; } }
    if (status === 'done' && t.repeatOnComplete && t.reminder && t.reminder.enabled && t.reminder.type !== 'once') { tasksToggleDone(k, true); return; }
    const upd = { ['ledger/tasks/' + k + '/status']: status, ['ledger/tasks/' + k + '/updatedAt']: Date.now() };
    if (status === 'done') { upd['ledger/tasks/' + k + '/completedAt'] = Date.now(); tasksDescendants(k).forEach(ck => { upd['ledger/tasks/' + ck + '/status'] = 'done'; upd['ledger/tasks/' + ck + '/completedAt'] = Date.now(); }); }
    else if (t.status === 'done') upd['ledger/tasks/' + k + '/completedAt'] = null;
    tasksLogActivity(k, status === 'done' ? 'أكمل المهمة' : 'نقلها إلى «' + TASK_STATUS[status].label + '»');
    update(ref(db), upd).then(() => tasksUpdateBadge()).catch(e => toast('❌ ' + (e.message || e), 'er'));
};

// ── طباعة / تصدير / أجندة اليوم ─────────────────
function tasksFlatForExport() {
    const now = Date.now();
    return Object.entries(window.tasksData || {}).map(([k, t]) => ({ k, ...t })).filter(t => tasksInScope(t) && tasksMatchesSearchTag(t))
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (TASK_PRIO[a.priority] || TASK_PRIO.medium).rank - (TASK_PRIO[b.priority] || TASK_PRIO.medium).rank);
}
window.tasksPrint = function () {
    const rows = tasksFlatForExport();
    const co = (window.gbrCfg && (window.gbrCfg.companyName || window.gbrCfg.name)) || 'بنيان للمقاولات';
    const trs = rows.map(t => { const p = TASK_PRIO[t.priority] || TASK_PRIO.medium; const s = TASK_STATUS[t.status] || TASK_STATUS.open; return `<tr><td>${(t.title || '').replace(/</g, '&lt;')}</td><td style="color:${p.color}">${p.label}</td><td>${s.label}</td><td>${t.dueDate || '—'}${t.dueTime ? ' ' + t.dueTime : ''}</td><td>${(t.assignedName || '').replace(/</g, '&lt;') || '—'}</td><td>${(tasksLinkLabel(t) || '—')}</td><td>${t.reminder && t.reminder.enabled ? tasksReminderLabel(t.reminder) : '—'}</td></tr>`; }).join('');
    const w = window.open('', '_blank');
    w.document.write(`<html dir="rtl" lang="ar"><head><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet"><meta charset="utf-8"><title>قائمة المهام</title><style>body{font-family:'Segoe UI',Tahoma,sans-serif;padding:24px;direction:rtl}h1{color:#5b2c6f;font-size:20px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:14px}th,td{border:1px solid #ccc;padding:7px;text-align:right}th{background:#5b2c6f;color:#fff}tr:nth-child(even){background:#f7f7fb}@media print{button{display:none}}</style></head><body><h1>🗓️ قائمة المهام — ${co}</h1><div style="font-size:12px;color:#666">تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')} · عدد المهام: ${rows.length}</div><button onclick="print()" style="margin-top:10px;padding:8px 18px;background:#5b2c6f;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨️ طباعة</button><table><thead><tr><th>المهمة</th><th>الأولوية</th><th>الحالة</th><th>الاستحقاق</th><th>المُعيَّن</th><th>مرتبطة بـ</th><th>التذكير</th></tr></thead><tbody>${trs || '<tr><td colspan="7" style="text-align:center">لا توجد مهام</td></tr>'}</tbody></table></body></html>`);
    w.document.close();
};
window.tasksExportExcel = function () {
    if (!window.XLSX) { toast('⚠️ مكتبة Excel غير محمّلة', 'er'); return; }
    const rows = tasksFlatForExport().map(t => ({
        'المهمة': t.title || '', 'الأولوية': (TASK_PRIO[t.priority] || TASK_PRIO.medium).label, 'الحالة': (TASK_STATUS[t.status] || TASK_STATUS.open).label,
        'تاريخ الاستحقاق': t.dueDate || '', 'الوقت': t.dueTime || '', 'المُعيَّن إليه': t.assignedName || '', 'مرتبطة بـ': tasksLinkLabel(t) || '',
        'الوسوم': (t.tags || []).join('، '), 'التذكير': t.reminder && t.reminder.enabled ? tasksReminderLabel(t.reminder) : '', 'ملاحظات': t.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'المهام');
    XLSX.writeFile(wb, 'tasks_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    toast('📊 تم التصدير', 'ok');
};
function tasksIcsDate(ms) { const d = new Date(ms); const p = n => String(n).padStart(2, '0'); return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + '00Z'; }
function tasksIcsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
window.tasksExportICS = function () {
    const rows = tasksFlatForExport(); const now = Date.now(); const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GBR//Tasks//AR', 'CALSCALE:GREGORIAN']; let n = 0;
    rows.forEach(t => {
        if (t.dueDate) { const start = Date.parse(t.dueDate + 'T' + (t.dueTime || '09:00')); if (!isNaN(start)) { lines.push('BEGIN:VEVENT', 'UID:task-' + t.k + '@gbr', 'DTSTAMP:' + tasksIcsDate(now), 'DTSTART:' + tasksIcsDate(start), 'DTEND:' + tasksIcsDate(start + 3600000), 'SUMMARY:' + tasksIcsEsc('📌 ' + (t.title || '')), 'DESCRIPTION:' + tasksIcsEsc((t.notes || '') + (t.assignedName ? '\nالمسؤول: ' + t.assignedName : '')), 'END:VEVENT'); n++; } }
        if (t.reminder && t.reminder.enabled) { const occ = tasksNextOccurrence(t.reminder, now); if (occ != null) { lines.push('BEGIN:VEVENT', 'UID:rem-' + t.k + '@gbr', 'DTSTAMP:' + tasksIcsDate(now), 'DTSTART:' + tasksIcsDate(occ), 'DTEND:' + tasksIcsDate(occ + 1800000), 'SUMMARY:' + tasksIcsEsc('🔔 ' + (t.title || ''))); if (t.reminder.lead) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + tasksIcsEsc(t.title || ''), 'TRIGGER:-PT' + t.reminder.lead + 'M', 'END:VALARM'); lines.push('END:VEVENT'); n++; } }
    });
    lines.push('END:VCALENDAR');
    if (!n) { toast('⚠️ لا توجد مهام بتواريخ أو تذكيرات للتصدير', 'er'); return; }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'tasks_' + new Date().toISOString().slice(0, 10) + '.ics'; a.click(); URL.revokeObjectURL(url); toast('📆 تم تصدير ملف التقويم (' + n + ' حدث)', 'ok');
};
function tasksParseAttach(text) { return (text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf('|'); if (i >= 0) { const name = l.slice(0, i).trim(), url = l.slice(i + 1).trim(); return { name: name || url, url }; } return { name: l, url: l }; }).filter(a => a.url); }

// ── الإعدادات: ساعات الإزعاج + التصعيد الآلي ─────────────────
function tasksSettings() { try { return Object.assign({ dndEnabled: false, dndFrom: '22:00', dndTo: '07:00', escalate: true }, JSON.parse(localStorage.getItem('gbrTasksSettings') || '{}')); } catch (e) { return { dndEnabled: false, dndFrom: '22:00', dndTo: '07:00', escalate: true }; } }
function tasksInDnd() { const s = tasksSettings(); if (!s.dndEnabled) return false; const pm = t => { const m = /(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : 0; }; const n = new Date(); const cur = n.getHours() * 60 + n.getMinutes(); const f = pm(s.dndFrom), to = pm(s.dndTo); if (f === to) return false; return f < to ? (cur >= f && cur < to) : (cur >= f || cur < to); }
window.tasksOpenSettings = function () {
    document.getElementById('taskEditorOverlay')?.remove(); const s = tasksSettings();
    const ov = document.createElement('div'); ov.id = 'taskEditorOverlay';
    ov.style = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px';
    const inp = 'padding:8px;border:1px solid #d0d7e0;border-radius:7px;font-family:inherit;font-size:13px';
    ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="background:linear-gradient(135deg,#5b2c6f,#8e44ad);color:#fff;padding:14px 18px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center"><div style="font-size:15px;font-weight:900">⚙️ إعدادات التنبيهات</div><button onclick="tasksCloseEditor()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:7px;cursor:pointer">✖</button></div>
        <div style="padding:18px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#1a3a5c;cursor:pointer;margin-bottom:10px"><input type="checkbox" id="tkSetDnd" ${s.dndEnabled ? 'checked' : ''} style="width:17px;height:17px;accent-color:#5b2c6f">🔕 تفعيل ساعات الإزعاج (كتم الصوت وإشعارات المتصفح)</label>
            <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;padding-right:25px">
                <div><label style="font-size:11px;color:#666">من</label><br><input type="time" id="tkSetFrom" value="${s.dndFrom}" style="${inp}"></div>
                <div><label style="font-size:11px;color:#666">إلى</label><br><input type="time" id="tkSetTo" value="${s.dndTo}" style="${inp}"></div>
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#1a3a5c;cursor:pointer;margin-bottom:6px"><input type="checkbox" id="tkSetEsc" ${s.escalate ? 'checked' : ''} style="width:17px;height:17px;accent-color:#c0392b">⬆️ تصعيد المتأخرات تلقائياً</label>
            <div style="font-size:11px;color:#888;padding-right:25px;margin-bottom:16px">ترفع أولوية المهمة المتأخرة درجة واحدة يومياً (حتى «عاجل»)، وتعيد تنبيهك بها مرة كل يوم.</div>
            <div style="display:flex;gap:10px"><button class="btn" onclick="tasksSaveSettings()" style="background:#5b2c6f;color:#fff;padding:9px 24px;font-weight:800">💾 حفظ</button><button class="btn" onclick="tasksCloseEditor()" style="background:#f0f0f0;padding:9px 24px">إلغاء</button></div>
        </div></div>`;
    document.body.appendChild(ov);
};
window.tasksSaveSettings = function () {
    const s = { dndEnabled: $('tkSetDnd').checked, dndFrom: $('tkSetFrom').value || '22:00', dndTo: $('tkSetTo').value || '07:00', escalate: $('tkSetEsc').checked };
    localStorage.setItem('gbrTasksSettings', JSON.stringify(s)); tasksCloseEditor(); toast('✅ حُفظت الإعدادات', 'ok');
};
function tasksTodayStr() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
function tasksCheckEscalations() {
    const s = tasksSettings(); if (s.escalate === false) return;
    const now = Date.now(); const today = tasksTodayStr(); const order = ['low', 'medium', 'high', 'urgent']; const notify = [];
    Object.entries(window.tasksData || {}).forEach(([k, t]) => {
        if (!t || t.status === 'done' || !t.dueDate) return; if (!tasksMine(t) || !tasksCanEdit(t)) return;
        const due = Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')); if (isNaN(due) || due >= now) return;
        if (t.escalatedOn === today) return;
        const upd = {}; const idx = order.indexOf(t.priority || 'medium');
        if (idx < order.length - 1) { upd['ledger/tasks/' + k + '/priority'] = order[idx + 1]; tasksLogActivity(k, 'تصعيد تلقائي للأولوية → ' + TASK_PRIO[order[idx + 1]].label + ' (متأخرة)'); }
        upd['ledger/tasks/' + k + '/escalatedOn'] = today;
        update(ref(db), upd).catch(() => { });
        notify.push({ k, t, occ: due });
    });
    if (notify.length) tasksShowAlert(notify);
}
window.tasksDailyAgenda = function () {
    const d = new Date(); d.setHours(0, 0, 0, 0); const items = tasksDayItems(d.getTime());
    const co = (window.gbrCfg && (window.gbrCfg.companyName || window.gbrCfg.name)) || 'بنيان للمقاولات';
    const list = items.map(it => { const p = TASK_PRIO[it.t.priority] || TASK_PRIO.medium; const done = it.t.status === 'done'; return `<div style="display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #eee"><span style="width:10px;height:10px;border-radius:50%;background:${p.color}"></span><span style="font-weight:700;min-width:48px">${it.time || '—'}</span><span style="flex:1;${done ? 'text-decoration:line-through;color:#999' : ''}">${it.kind === 'rem' ? '🔔 ' : '📌 '}${(it.t.title || '').replace(/</g, '&lt;')}</span><span style="font-size:11px;color:#888">${it.t.assignedName || ''}</span></div>`; }).join('');
    document.getElementById('taskEditorOverlay')?.remove();
    const ov = document.createElement('div'); ov.id = 'taskEditorOverlay';
    ov.style = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px';
    ov.innerHTML = `<div id="agendaCard" style="background:#fff;border-radius:14px;max-width:560px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="background:linear-gradient(135deg,#5b2c6f,#8e44ad);color:#fff;padding:14px 18px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:15px;font-weight:900">📅 أجندة اليوم — ${d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <button onclick="tasksCloseEditor()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:7px;cursor:pointer">✖</button>
        </div>
        <div style="padding:14px 18px;max-height:70vh;overflow:auto"><div style="font-size:12px;color:#666;margin-bottom:8px">${co} · ${items.length} بند اليوم</div>${list || '<div style="text-align:center;color:#999;padding:30px">لا توجد بنود مجدولة اليوم 🎉</div>'}</div>
        <div style="padding:12px 18px;display:flex;gap:10px;border-top:1px solid #eee;flex-wrap:wrap"><button class="btn" onclick="tasksPrintAgenda()" style="background:#5b2c6f;color:#fff;padding:8px 18px;font-weight:800">🖨️ طباعة</button><button class="btn" onclick="tasksShareAgenda()" style="background:#25d366;color:#fff;padding:8px 18px;font-weight:800">📲 واتساب</button><button class="btn" onclick="tasksShareAgenda('email')" style="background:#2d6a9f;color:#fff;padding:8px 18px;font-weight:800">✉️ بريد</button><button class="btn" onclick="tasksCloseEditor()" style="background:#f0f0f0;padding:8px 18px">إغلاق</button></div>
    </div>`;
    document.body.appendChild(ov);
};
window.tasksPrintAgenda = function () { const c = document.getElementById('agendaCard'); if (!c) return; const w = window.open('', '_blank'); w.document.write(`<html dir="rtl" lang="ar"><head><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet"><meta charset="utf-8"><title>أجندة اليوم</title><style>body{font-family:'Segoe UI',Tahoma,sans-serif;padding:20px;direction:rtl}</style></head><body>${c.innerHTML}<script>setTimeout(()=>print(),200)<\/script></body></html>`); w.document.close(); };

function tasksInScope(t) {
    if (!tasksCanSee(t)) return false; // بوابة الصلاحيات: غير المخوّل لا يرى مهام الآخرين
    const sc = window._tasksState.scope || 'mine'; const me = (window.curU && window.curU.uid) || '';
    if (sc === 'all') return true;
    if (sc === 'assigned') return !!(t.assignedTo && t.assignedTo !== me && (t.createdBy === me || !me));
    return !t.assignedTo || t.assignedTo === me || (t.createdBy === me); // تنبيهاتي
}
function tasksMatchesSearchTag(t) {
    const st = window._tasksState;
    const q = (st.search || '').trim().toLowerCase();
    if (q) { const hay = ((t.title || '') + ' ' + (t.notes || '') + ' ' + (t.assignedName || '') + ' ' + (t.linkName || '') + ' ' + ((t.tags || []).join(' '))).toLowerCase(); if (!hay.includes(q)) return false; }
    if (st.tagFilter) { if (!(Array.isArray(t.tags) && t.tags.includes(st.tagFilter))) return false; }
    return true;
}
function tasksMatchesFilter(t) {
    if (!tasksInScope(t)) return false;
    if (!tasksMatchesSearchTag(t)) return false;
    const f = window._tasksState.filter; const now = Date.now();
    if (f === 'all') return true;
    if (f === 'done') return t.status === 'done';
    if (t.status === 'done') return false;
    if (f === 'overdue') return t.dueDate && Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')) < now;
    if (f === 'upcoming') return t.reminder && t.reminder.enabled;
    if (f === 'today') { if (!t.dueDate) return false; const d = new Date(); const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); return t.dueDate === todayStr; }
    return true;
}
// يعرض العقدة إذا طابقت الفلتر أو كان أحد أحفادها مطابقاً
function tasksBranchVisible(key) {
    const t = window.tasksData[key]; if (!t) return false;
    if (tasksMatchesFilter({ k: key, ...t })) return true;
    return tasksChildren(key).some(c => tasksBranchVisible(c.k));
}

function tasksRenderTree(parentKey, depth) {
    depth = depth || 0;
    const kids = tasksChildren(parentKey);
    let html = '';
    kids.forEach(t => {
        if (!tasksBranchVisible(t.k)) return;
        const p = TASK_PRIO[t.priority] || TASK_PRIO.medium;
        const childKids = tasksChildren(t.k);
        const hasKids = childKids.length > 0;
        const expanded = !window._tasksState.expand[t.k]; // افتراضي موسّع (true في الخريطة = مطوي)
        const prog = tasksProgress(t.k);
        const now = Date.now();
        const dueMs = t.dueDate ? Date.parse(t.dueDate + 'T' + (t.dueTime || '23:59')) : null;
        const overdue = dueMs && dueMs < now && t.status !== 'done';
        const done = t.status === 'done';
        const nextRem = (t.reminder && t.reminder.enabled) ? tasksNextOccurrence(t.reminder, now) : null;
        const sel = window._tasksState.selMode; const blk = tasksBlockerState(t);
        html += `<div id="taskrow-${t.k}" draggable="true" ondragstart="tasksRowDrag(event,'${t.k}')" ondragover="event.preventDefault()" ondrop="tasksRowDrop(event,'${t.k}')" style="display:flex;align-items:flex-start;gap:8px;padding:8px 6px;border-bottom:1px solid #f3f3f3;margin-right:${depth * 22}px;${depth ? 'border-right:2px solid #eee;padding-right:10px' : ''};${sel && window._tasksState.selected[t.k] ? 'background:#eef6ff' : ''}">
            <span title="اسحب لإعادة الترتيب" style="cursor:grab;color:#ccc;margin-top:4px;flex:none;font-size:13px">⠿</span>
            ${sel ? `<input type="checkbox" ${window._tasksState.selected[t.k] ? 'checked' : ''} onchange="tasksToggleSelect('${t.k}',this.checked)" style="margin-top:3px;width:16px;height:16px;accent-color:#2d6a9f;flex:none;cursor:pointer" title="تحديد">` : ''}
            <input type="checkbox" ${done ? 'checked' : ''} onchange="tasksToggleDone('${t.k}', this.checked)" style="margin-top:3px;width:17px;height:17px;accent-color:#16a34a;flex:none;cursor:pointer">
            <span title="الأولوية: ${p.label}" style="width:10px;height:10px;border-radius:50%;background:${p.color};margin-top:6px;flex:none"></span>
            <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    ${hasKids ? `<span onclick="tasksToggleExpand('${t.k}')" style="cursor:pointer;color:#888;font-size:11px">${expanded ? '▼' : '▶'}</span>` : ''}
                    <span style="font-size:13.5px;font-weight:${depth ? '600' : '800'};color:#1a3a5c;${done ? 'text-decoration:line-through;color:#999' : ''}">${t.title || 'مهمة'}</span>
                    ${prog ? `<span style="font-size:10px;color:#666;background:#eef;border-radius:6px;padding:1px 7px">${prog.done}/${prog.total} (${prog.pct}%)</span>` : ''}
                    ${t.status === 'doing' ? `<span style="font-size:9px;background:#2d6a9f;color:#fff;border-radius:5px;padding:1px 6px">قيد التنفيذ</span>` : ''}
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:3px;font-size:10.5px;color:#888">
                    ${t.dueDate ? `<span style="color:${overdue ? '#c0392b' : '#666'};font-weight:${overdue ? '700' : '400'}">📅 ${t.dueDate}${t.dueTime ? ' ' + t.dueTime : ''}${overdue ? ' (متأخرة)' : ''}</span>` : ''}
                    ${(t.reminder && t.reminder.enabled) ? `<span style="color:#7d4e00">🔔 ${tasksReminderLabel(t.reminder)}${nextRem ? ' · التالي ' + tasksFmtDateTime(nextRem) : ''}</span>` : ''}
                    ${t.assignedTo ? `<span style="color:#2d6a9f">👤 ${(t.assignedName || tasksUserName(t.assignedTo) || 'معيّنة').replace(/</g, '&lt;')}</span>` : ''}
                    ${t.repeatOnComplete ? `<span title="تتجدد عند الإكمال" style="color:#16a085">🔁${t.repeatCount ? ' ×' + t.repeatCount : ''}</span>` : ''}
                    ${blk.total ? `<span title="${blk.open ? 'معطّلة بـ ' + blk.open + ' مهمة غير منجزة' : 'كل المتطلبات منجزة'}" style="color:${blk.open ? '#c0392b' : '#16a34a'}">${blk.open ? '🔒' : '🔓'} ${blk.done}/${blk.total}</span>` : ''}
                    ${(t.comments && Object.keys(t.comments).length) ? `<span style="color:#2d6a9f">💬 ${Object.keys(t.comments).length}</span>` : ''}
                    ${t.notes ? `<span title="${(t.notes || '').replace(/"/g, '&quot;')}">📝 ملاحظة</span>` : ''}
                    ${tasksBadges(t)}
                </div>
            </div>
            <div style="display:flex;gap:2px;flex:none">
                <button onclick="tasksQuickSubToggle('${t.k}')" title="إضافة فرعية سريعة" style="background:none;border:none;cursor:pointer;font-size:13px;color:#16a085">⚡</button>
                <button onclick="tasksOpenEditor('${t.k}','')" title="مهمة فرعية بتفاصيل" style="background:none;border:none;cursor:pointer;font-size:13px;color:#16a34a">➕</button>
                ${tasksCanEdit(t) ? `<button onclick="tasksOpenEditor('','${t.k}')" title="تعديل" style="background:none;border:none;cursor:pointer;font-size:13px;color:#2d6a9f">✏️</button>` : ''}
                ${tasksCanDelete(t) ? `<button onclick="tasksDelete('${t.k}')" title="حذف" style="background:none;border:none;cursor:pointer;font-size:13px;color:#c0392b">🗑️</button>` : ''}
            </div>
        </div>
        <div id="qsub-${t.k}" style="display:none;margin-right:${(depth + 1) * 22}px;padding:5px 8px;gap:6px">
            <input id="qsubInput-${t.k}" onkeydown="if(event.key==='Enter')tasksQuickSub('${t.k}')" placeholder="عنوان مهمة فرعية ثم Enter…" style="width:70%;padding:6px 8px;border:1px solid #cfe0d6;border-radius:7px;font-family:inherit;font-size:12px">
            <button onclick="tasksQuickSub('${t.k}')" class="btn" style="background:#16a085;color:#fff;padding:6px 12px;font-size:11px;font-weight:700">إضافة</button>
        </div>`;
        if (hasKids && expanded) html += tasksRenderTree(t.k, depth + 1);
    });
    return html;
}

// ── إضافة سريعة ─────────────────
window.tasksQuickAdd = function () {
    const el = $('taskQuickTitle'); if (!el) return; const title = (el.value || '').trim(); if (!title) { toast('⚠️ اكتب عنوان المهمة', 'er'); return; }
    const prio = ($('taskQuickPrio') && $('taskQuickPrio').value) || 'medium';
    const uid = (typeof curU !== 'undefined' && curU && curU.uid) ? curU.uid : 'system'; const now = Date.now();
    push(R.tasks, { title, parent: '', priority: prio, status: 'open', notes: '', dueDate: '', dueTime: '', reminder: { enabled: false }, createdAt: now, createdBy: uid, updatedAt: now })
        .then(r => { if (r && r.key) tasksLogActivity(r.key, 'أنشأ المهمة'); el.value = ''; toast('✅ تمت إضافة المهمة', 'ok', 2500); }).catch(e => toast('❌ خطأ: ' + (e.message || e), 'er'));
};
// إضافة فرعية سريعة (بدون فتح المحرّر)
window.tasksQuickSubToggle = function (k) { const el = document.getElementById('qsub-' + k); if (!el) return; const show = el.style.display === 'none' || !el.style.display; el.style.display = show ? 'flex' : 'none'; if (show) { const inp = document.getElementById('qsubInput-' + k); if (inp) inp.focus(); } };
window.tasksQuickSub = function (parentKey) {
    const inp = document.getElementById('qsubInput-' + parentKey); if (!inp) return; const title = (inp.value || '').trim(); if (!title) { toast('⚠️ اكتب عنوان المهمة الفرعية', 'er'); return; }
    const uid = (window.curU && window.curU.uid) || 'system'; const now = Date.now();
    push(R.tasks, { title, parent: parentKey, priority: 'medium', status: 'open', notes: '', dueDate: '', dueTime: '', reminder: { enabled: false }, createdAt: now, createdBy: uid, updatedAt: now })
        .then(r => { if (r && r.key) tasksLogActivity(r.key, 'أنشأ مهمة فرعية'); inp.value = ''; toast('✅ أُضيفت المهمة الفرعية', 'ok', 2000); }).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
// السحب لإعادة الترتيب ضمن نفس المستوى
window.tasksRowDrag = function (ev, k) { ev.dataTransfer.setData('application/x-task-reorder', k); ev.dataTransfer.effectAllowed = 'move'; ev.stopPropagation(); };
window.tasksRowDrop = function (ev, targetK) {
    const src = ev.dataTransfer.getData('application/x-task-reorder'); if (!src || src === targetK) return;
    ev.preventDefault(); ev.stopPropagation();
    const s = window.tasksData[src], tg = window.tasksData[targetK]; if (!s || !tg) return;
    if ((s.parent || '') !== (tg.parent || '')) { toast('⚠️ يمكن إعادة الترتيب ضمن نفس المستوى فقط', 'er'); return; }
    const sibs = tasksChildren(s.parent || '').map(x => x.k).filter(x => x !== src);
    const ti = sibs.indexOf(targetK); sibs.splice(ti < 0 ? sibs.length : ti, 0, src);
    const upd = {}; sibs.forEach((k, i) => upd['ledger/tasks/' + k + '/order'] = i);
    update(ref(db), upd).then(() => toast('↕️ أُعيد الترتيب', 'ok', 1500)).catch(e => toast('❌ ' + (e.message || e), 'er'));
};

function tasksBlockerState(t) {
    const ids = Array.isArray(t.blockedBy) ? t.blockedBy : []; let done = 0, open = 0, total = 0;
    ids.forEach(id => { const b = window.tasksData[id]; if (!b) return; total++; if (b.status === 'done') done++; else open++; });
    return { total, done, open };
}
window.tasksToggleDone = function (k, checked) {
    const t = window.tasksData[k]; if (!t) return;
    const now = Date.now();
    // تبعيات: لا يُسمح بالإكمال قبل إنجاز المهام المعطِّلة
    if (checked) { const blk = tasksBlockerState(t); if (blk.open) { toast('🔒 لا يمكن إكمال المهمة — يجب إنجاز ' + blk.open + ' مهمة مرتبطة أولاً', 'er', 4500); renderTasks(); return; } }
    // مهمة متجددة: الإكمال يدفعها للموعد التالي بدل إغلاقها
    if (checked && t.repeatOnComplete && t.reminder && t.reminder.enabled && t.reminder.type !== 'once') {
        const next = tasksNextOccurrence(t.reminder, now + 60000);
        if (next != null) {
            const d = new Date(next); const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            const upd = {};
            upd['ledger/tasks/' + k + '/status'] = 'open';
            upd['ledger/tasks/' + k + '/dueDate'] = ds;
            upd['ledger/tasks/' + k + '/dueTime'] = t.reminder.time || '';
            upd['ledger/tasks/' + k + '/reminder/lastFiredAt'] = now; // أعد التهيئة ليطلق في الدورة القادمة
            upd['ledger/tasks/' + k + '/reminder/snoozeUntil'] = null;
            upd['ledger/tasks/' + k + '/repeatCount'] = (t.repeatCount || 0) + 1;
            upd['ledger/tasks/' + k + '/lastCompletedAt'] = now;
            tasksLogActivity(k, 'أكمل المهمة وجُدّدت إلى ' + tasksFmtDateTime(next));
            update(ref(db), upd).then(() => { toast('🔁 تم الإكمال — جُدّدت المهمة لـ ' + tasksFmtDateTime(next), 'ok', 3500); tasksUpdateBadge(); }).catch(e => toast('❌ خطأ: ' + (e.message || e), 'er'));
            return;
        }
    }
    const updates = {};
    updates['ledger/tasks/' + k + '/status'] = checked ? 'done' : 'open';
    updates['ledger/tasks/' + k + '/completedAt'] = checked ? now : null;
    if (checked) { tasksDescendants(k).forEach(ck => { updates['ledger/tasks/' + ck + '/status'] = 'done'; updates['ledger/tasks/' + ck + '/completedAt'] = now; }); } // إكمال المهمة يكمل فروعها
    tasksLogActivity(k, checked ? 'أكمل المهمة' : 'أعاد فتح المهمة');
    update(ref(db), updates).then(() => tasksUpdateBadge()).catch(e => toast('❌ خطأ: ' + (e.message || e), 'er'));
};

window.tasksDelete = function (k) {
    const t = window.tasksData[k]; if (!t) return;
    if (!tasksCanDelete(t)) { toast('🚫 لا تملك صلاحية حذف هذه المهمة', 'er'); return; }
    const desc = tasksDescendants(k);
    if (!confirm(`حذف هذه المهمة${desc.length ? ' و' + desc.length + ' مهمة فرعية' : ''} نهائياً؟`)) return;
    const updates = {}; updates['ledger/tasks/' + k] = null; desc.forEach(ck => updates['ledger/tasks/' + ck] = null);
    update(ref(db), updates).then(() => { toast('🗑️ تم الحذف', 'ok'); tasksUpdateBadge(); }).catch(e => toast('❌ خطأ: ' + (e.message || e), 'er'));
};

// ── محرّر المهمة (نافذة ديناميكية) ─────────────────
window.tasksOpenEditor = function (parentKey, editKey) {
    document.getElementById('taskEditorOverlay')?.remove();
    const cur = (editKey && window.tasksData[editKey]) ? window.tasksData[editKey] : null;
    const rem = (cur && cur.reminder) ? cur.reminder : { enabled: false };
    const title = cur ? 'تعديل مهمة' : (parentKey ? 'مهمة فرعية جديدة' : 'مهمة جديدة');
    const parentName = parentKey && window.tasksData[parentKey] ? window.tasksData[parentKey].title : '';
    const v = (x) => x == null ? '' : String(x).replace(/"/g, '&quot;');
    const ov = document.createElement('div');
    ov.id = 'taskEditorOverlay';
    ov.style = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px';
    const inp = 'width:100%;padding:8px;border:1px solid #d0d7e0;border-radius:7px;font-family:inherit;font-size:13px';
    ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:540px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="background:linear-gradient(135deg,#5b2c6f,#8e44ad);color:#fff;padding:14px 18px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:15px;font-weight:900">🗓️ ${title}${parentName ? ' — ضمن: ' + parentName : ''}</div>
            <button onclick="tasksCloseEditor()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:7px;cursor:pointer">✖</button>
        </div>
        <div style="padding:18px;max-height:72vh;overflow:auto">
            <input type="hidden" id="tkEditKey" value="${editKey || ''}">
            <input type="hidden" id="tkParent" value="${parentKey || (cur ? (cur.parent || '') : '')}">
            <label style="font-size:11px;color:#666;font-weight:700">عنوان المهمة *</label>
            <input id="tkTitle" value="${cur ? v(cur.title) : ''}" style="${inp};margin-bottom:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                <div><label style="font-size:11px;color:#666;font-weight:700">الأولوية</label>
                    <select id="tkPrio" style="${inp}">${Object.entries(TASK_PRIO).map(([k, p]) => `<option value="${k}" ${cur && cur.priority === k ? 'selected' : (k === 'medium' && !cur ? 'selected' : '')}>${p.label}</option>`).join('')}</select></div>
                <div><label style="font-size:11px;color:#666;font-weight:700">الحالة</label>
                    <select id="tkStatus" style="${inp}">${Object.entries(TASK_STATUS).map(([k, s]) => `<option value="${k}" ${cur && cur.status === k ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
                <div><label style="font-size:11px;color:#666;font-weight:700">تاريخ الاستحقاق</label>
                    <input id="tkDueDate" type="date" value="${cur ? v(cur.dueDate) : ''}" style="${inp}"></div>
                <div><label style="font-size:11px;color:#666;font-weight:700">الوقت</label>
                    <input id="tkDueTime" type="time" value="${cur ? v(cur.dueTime) : ''}" style="${inp}"></div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
                <button type="button" class="btn" onclick="tasksDuePreset(0)" style="background:#eef2f7;padding:4px 12px;font-size:11px">اليوم</button>
                <button type="button" class="btn" onclick="tasksDuePreset(1)" style="background:#eef2f7;padding:4px 12px;font-size:11px">غداً</button>
                <button type="button" class="btn" onclick="tasksDuePreset(7)" style="background:#eef2f7;padding:4px 12px;font-size:11px">بعد أسبوع</button>
                <button type="button" class="btn" onclick="tasksDuePreset(-1)" style="background:#f3f3f3;padding:4px 12px;font-size:11px">مسح التاريخ</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                <div><label style="font-size:11px;color:#666;font-weight:700">👤 تعيين إلى</label>
                    <select id="tkAssign" style="${inp}">${tasksAssigneeOptions(cur ? cur.assignedTo : '')}</select></div>
                <div style="display:flex;align-items:flex-end"><label style="font-size:11.5px;color:#444;display:flex;align-items:center;gap:6px;cursor:pointer;padding-bottom:6px"><input type="checkbox" id="tkRepeat" ${cur && cur.repeatOnComplete ? 'checked' : ''} style="width:16px;height:16px;accent-color:#16a34a">🔁 تتجدّد تلقائياً عند الإكمال</label></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                <div><label style="font-size:11px;color:#666;font-weight:700">🔗 ربط بكيان</label>
                    <select id="tkLinkType" onchange="tasksLinkTypeChange()" style="${inp}"><option value="">— بدون —</option>${Object.entries(TASK_LINK_TYPES).map(([k, d]) => `<option value="${k}" ${cur && cur.linkType === k ? 'selected' : ''}>${d.icon} ${d.label}</option>`).join('')}</select></div>
                <div id="tkLinkIdWrap" style="display:${cur && cur.linkType ? 'block' : 'none'}"><label style="font-size:11px;color:#666;font-weight:700">العنصر المرتبط</label>
                    <select id="tkLinkId" style="${inp}">${cur && cur.linkType ? tasksLinkEntityOptions(cur.linkType, cur.linkId) : ''}</select></div>
            </div>
            <label style="font-size:11px;color:#666;font-weight:700">🏷️ وسوم (افصل بفاصلة)</label>
            <input id="tkTags" value="${cur && Array.isArray(cur.tags) ? cur.tags.join('، ') : ''}" placeholder="مثال: عاجل، مالية، متابعة" style="${inp};margin-bottom:10px">
            <label style="font-size:11px;color:#666;font-weight:700">🔒 معطّلة بـ (لا تُكمل قبل إنجاز)</label>
            <select id="tkBlockedBy" multiple size="3" style="${inp};margin-bottom:10px;height:auto">${tasksDependencyOptions(editKey, cur ? cur.blockedBy : [])}</select>
            <label style="font-size:11px;color:#666;font-weight:700">ملاحظات</label>
            <textarea id="tkNotes" rows="2" style="${inp};margin-bottom:10px">${cur ? v(cur.notes) : ''}</textarea>
            <label style="font-size:11px;color:#666;font-weight:700">📎 مرفقات (رابط لكل سطر — أو «الاسم | الرابط»)</label>
            ${cur && Array.isArray(cur.attachments) && cur.attachments.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 6px">${cur.attachments.map(a => `<a href="${(a.url || '').replace(/"/g, '&quot;')}" target="_blank" style="font-size:11px;background:#eaf2fb;color:#2d6a9f;border-radius:8px;padding:3px 9px;text-decoration:none">📎 ${(a.name || a.url).replace(/</g, '&lt;')}</a>`).join('')}</div>` : ''}
            <textarea id="tkAttach" rows="2" placeholder="مثال: عقد المشروع | https://drive.google.com/..." style="${inp};margin-bottom:12px">${cur && Array.isArray(cur.attachments) ? cur.attachments.map(a => (a.name && a.name !== a.url ? a.name + ' | ' + a.url : a.url)).join('\n') : ''}</textarea>

            <div style="border:1.5px solid #f0c419;border-radius:10px;padding:12px;background:#fffdf5">
                <div style="font-size:13px;font-weight:800;color:#7d4e00;margin-bottom:8px">🔔 التذكير</div>
                <label style="font-size:11px;color:#666;font-weight:700">نوع التذكير</label>
                <select id="tkRemType" onchange="tasksReminderTypeChange()" style="${inp};margin-bottom:10px">
                    <option value="none" ${!rem.enabled ? 'selected' : ''}>بدون تذكير</option>
                    ${Object.entries(TASK_REM_TYPE).map(([k, lbl]) => `<option value="${k}" ${rem.enabled && rem.type === k ? 'selected' : ''}>${lbl}</option>`).join('')}
                </select>
                <div id="tkRemFields" style="display:${rem.enabled ? 'block' : 'none'}">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                        <div id="tkRemDateWrap"><label style="font-size:11px;color:#666">التاريخ${rem.type === 'everyN' ? ' (بداية)' : ''}</label><input id="tkRemDate" type="date" value="${v(rem.date)}" style="${inp}"></div>
                        <div id="tkRemWeekdayWrap"><label style="font-size:11px;color:#666">اليوم</label><select id="tkRemWeekday" style="${inp}">${TASK_WEEKDAYS.map((w, i) => `<option value="${i}" ${+rem.weekday === i ? 'selected' : ''}>${w}</option>`).join('')}</select></div>
                        <div id="tkRemDomWrap"><label style="font-size:11px;color:#666">يوم الشهر</label><input id="tkRemDom" type="number" min="1" max="31" value="${rem.dayOfMonth || 1}" style="${inp}"></div>
                        <div><label style="font-size:11px;color:#666">الساعة</label><input id="tkRemTime" type="time" value="${rem.time || '13:00'}" style="${inp}"></div>
                    </div>
                    <div id="tkRemWeekdaysWrap" style="margin-top:8px;display:none">
                        <label style="font-size:11px;color:#666;display:block;margin-bottom:4px">أيام الأسبوع (اختر واحداً أو أكثر)</label>
                        <div style="display:flex;flex-wrap:wrap;gap:6px">${TASK_WEEKDAYS.map((w, i) => `<label style="font-size:11px;display:flex;align-items:center;gap:3px;background:#fff;border:1px solid #e0d8b8;border-radius:6px;padding:3px 7px;cursor:pointer"><input type="checkbox" class="tkWd" value="${i}" ${(rem.weekdays || []).map(Number).includes(i) ? 'checked' : ''}>${w}</label>`).join('')}</div>
                    </div>
                    <div id="tkRemEveryNWrap" style="margin-top:8px;display:none">
                        <label style="font-size:11px;color:#666;display:block;margin-bottom:4px">يتكرر كل</label>
                        <div style="display:flex;gap:8px;align-items:center">
                            <input id="tkRemInterval" type="number" min="1" value="${rem.interval || 2}" style="${inp};width:90px">
                            <select id="tkRemUnit" style="${inp};width:120px"><option value="day" ${rem.unit !== 'week' ? 'selected' : ''}>يوم</option><option value="week" ${rem.unit === 'week' ? 'selected' : ''}>أسبوع</option></select>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
                        <div><label style="font-size:11px;color:#666">⏰ تنبيه مسبق</label><select id="tkRemLead" style="${inp}">${Object.entries(TASK_LEAD).map(([k, lbl]) => `<option value="${k}" ${(+(rem.lead || 0)) === +k ? 'selected' : ''}>${lbl}</option>`).join('')}</select></div>
                        <div id="tkRemUntilWrap"><label style="font-size:11px;color:#666">ينتهي في (اختياري)</label><input id="tkRemUntil" type="date" value="${v(rem.until)}" style="${inp}"></div>
                    </div>
                    <label style="font-size:11px;color:#666;margin-top:8px;display:block">نص التذكير (ما الذي يجب فعله/تذكيره)</label>
                    <input id="tkRemNote" value="${v(rem.note)}" placeholder="مثال: تذكير المدير باعتماد المستخلص" style="${inp}">
                    <div style="font-size:10px;color:#999;margin-top:6px">سيظهر التنبيه داخل البرنامج في الوقت المحدد بالضبط${window.Notification && Notification.permission === 'granted' ? ' وكإشعار في المتصفح' : ''}.</div>
                </div>
            </div>
            ${editKey ? tasksActivityCommentsHtml(editKey) : ''}
            <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;align-items:center">
                <button class="btn" onclick="tasksSaveEditor()" style="background:#5b2c6f;color:#fff;padding:9px 24px;font-weight:800">💾 حفظ</button>
                <button class="btn" onclick="tasksCloseEditor()" style="background:#f0f0f0;color:#555;padding:9px 24px;font-weight:700">إلغاء</button>
                ${editKey ? `<div style="flex:1"></div><button class="btn" title="مشاركة عبر واتساب" onclick="tasksShareTask('${editKey}')" style="background:#25d366;color:#fff;padding:9px 14px;font-weight:700">📲</button><button class="btn" title="مشاركة عبر البريد" onclick="tasksShareTask('${editKey}','email')" style="background:#2d6a9f;color:#fff;padding:9px 14px;font-weight:700">✉️</button>` : ''}
            </div>
        </div>
    </div>`;
    document.body.appendChild(ov);
    tasksReminderTypeChange();
};
window.tasksCloseEditor = function () { document.getElementById('taskEditorOverlay')?.remove(); };
function tasksLinkEntityOptions(type, sel) {
    const def = TASK_LINK_TYPES[type]; if (!def) return '';
    const data = def.data();
    const entries = Object.entries(data).map(([id, o]) => ({ id, name: (o && (o.name || o.title || o.fullName)) || id })).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
    return `<option value="">— اختر —</option>` + entries.map(e => `<option value="${e.id}" ${sel === e.id ? 'selected' : ''}>${String(e.name).replace(/</g, '&lt;')}</option>`).join('');
}
window.tasksLinkTypeChange = function () {
    const type = ($('tkLinkType') || {}).value || ''; const wrap = $('tkLinkIdWrap'); const sel = $('tkLinkId');
    if (wrap) wrap.style.display = type ? 'block' : 'none';
    if (sel) sel.innerHTML = type ? tasksLinkEntityOptions(type, '') : '';
};
function tasksActivityCommentsHtml(k) {
    const t = window.tasksData[k] || {};
    const acts = t.activity ? Object.values(t.activity).sort((a, b) => b.at - a.at).slice(0, 12) : [];
    const coms = t.comments ? Object.values(t.comments).sort((a, b) => a.at - b.at) : [];
    const actHtml = acts.length ? acts.map(a => `<div style="font-size:10.5px;color:#888;padding:2px 0">• ${(a.byName || '').replace(/</g, '&lt;')} — ${(a.action || '').replace(/</g, '&lt;')} <span style="color:#bbb">(${tasksFmtDateTime(a.at)})</span></div>`).join('') : '<div style="font-size:10.5px;color:#bbb">لا يوجد نشاط بعد</div>';
    const comHtml = coms.length ? coms.map(c => `<div style="background:#f5f7fa;border-radius:8px;padding:6px 9px;margin-bottom:6px"><div style="font-size:12px;color:#222">${(c.text || '').replace(/</g, '&lt;')}</div><div style="font-size:9.5px;color:#999;margin-top:2px">${(c.byName || '').replace(/</g, '&lt;')} · ${tasksFmtDateTime(c.at)}</div></div>`).join('') : '<div style="font-size:10.5px;color:#bbb;margin-bottom:6px">لا توجد تعليقات</div>';
    return `<div style="margin-top:14px;border-top:1px solid #eee;padding-top:12px">
        <div style="font-size:13px;font-weight:800;color:#5b2c6f;margin-bottom:6px">💬 التعليقات</div>
        ${comHtml}
        <div style="display:flex;gap:6px;margin-top:4px"><input id="tkCommentBox" placeholder="اكتب تعليقاً…" onkeydown="if(event.key==='Enter')tasksAddComment('${k}')" style="flex:1;padding:7px;border:1px solid #d0d7e0;border-radius:7px;font-family:inherit;font-size:12px"><button class="btn" onclick="tasksAddComment('${k}')" style="background:#2d6a9f;color:#fff;padding:7px 14px;font-weight:700">إضافة</button></div>
        <details style="margin-top:12px"><summary style="font-size:12px;font-weight:700;color:#666;cursor:pointer">📜 سجل النشاط (${acts.length})</summary><div style="margin-top:6px">${actHtml}</div></details>
    </div>`;
}
function tasksAssigneeOptions(sel) {
    const users = window.us || {};
    let opts = `<option value="">— غير معيّنة (تظهر للجميع) —</option>`;
    Object.entries(users).forEach(([uid, u]) => { if (!u) return; const nm = (u.name || u.email || uid); opts += `<option value="${uid}" ${sel === uid ? 'selected' : ''}>${nm.replace(/</g, '&lt;')}</option>`; });
    return opts;
}
function tasksDependencyOptions(editKey, sel) {
    sel = Array.isArray(sel) ? sel : [];
    const exclude = new Set([editKey]); if (editKey) tasksDescendants(editKey).forEach(d => exclude.add(d));
    const opts = Object.entries(window.tasksData || {}).filter(([k]) => !exclude.has(k)).map(([k, t]) => ({ k, name: t.title || 'مهمة', done: t.status === 'done' })).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    if (!opts.length) return '<option disabled>لا توجد مهام أخرى</option>';
    return opts.map(o => `<option value="${o.k}" ${sel.includes(o.k) ? 'selected' : ''}>${o.done ? '✓ ' : ''}${o.name.replace(/</g, '&lt;')}</option>`).join('');
}
window.tasksDuePreset = function (days) { const el = $('tkDueDate'); if (!el) return; if (days < 0) { el.value = ''; return; } const d = new Date(); d.setDate(d.getDate() + days); el.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
window.tasksReminderTypeChange = function () {
    const type = $('tkRemType') ? $('tkRemType').value : 'none';
    const fields = $('tkRemFields'); if (fields) fields.style.display = type === 'none' ? 'none' : 'block';
    const show = (id, on) => { const w = $(id); if (w) w.style.display = on ? '' : 'none'; };
    show('tkRemDateWrap', type === 'once' || type === 'everyN');
    show('tkRemWeekdayWrap', type === 'weekly');
    show('tkRemDomWrap', type === 'monthly');
    show('tkRemWeekdaysWrap', type === 'weekdays');
    show('tkRemEveryNWrap', type === 'everyN');
    show('tkRemUntilWrap', type !== 'once'); // تاريخ الانتهاء يخص التكرار فقط
};
window.tasksSaveEditor = function () {
    const title = ($('tkTitle').value || '').trim(); if (!title) { toast('⚠️ عنوان المهمة مطلوب', 'er'); return; }
    const editKey = $('tkEditKey').value, parent = $('tkParent').value || '';
    if (editKey && window.tasksData[editKey] && !tasksCanEdit(window.tasksData[editKey])) { toast('🚫 لا تملك صلاحية تعديل هذه المهمة', 'er'); return; }
    const remType = $('tkRemType').value;
    let reminder = { enabled: false };
    if (remType !== 'none') {
        reminder = { enabled: true, type: remType, time: $('tkRemTime').value || '13:00', note: ($('tkRemNote').value || '').trim(), lead: parseInt(($('tkRemLead') || {}).value || '0') || 0 };
        if (remType === 'once' || remType === 'everyN') reminder.date = $('tkRemDate').value || '';
        if (remType === 'weekly') reminder.weekday = parseInt($('tkRemWeekday').value);
        if (remType === 'monthly') reminder.dayOfMonth = parseInt($('tkRemDom').value) || 1;
        if (remType === 'weekdays') {
            reminder.weekdays = Array.from(document.querySelectorAll('.tkWd:checked')).map(c => +c.value);
            if (!reminder.weekdays.length) { toast('⚠️ اختر يوماً واحداً على الأقل من أيام الأسبوع', 'er'); return; }
        }
        if (remType === 'everyN') { reminder.interval = parseInt($('tkRemInterval').value) || 1; reminder.unit = $('tkRemUnit').value || 'day'; if (!reminder.date) { toast('⚠️ حدّد تاريخ البداية للتكرار', 'er'); return; } }
        if (remType !== 'once') { const u = ($('tkRemUntil') || {}).value || ''; if (u) reminder.until = u; }
        // التذكير الجديد/المعدّل يبدأ من الآن (لا يُطلق المواعيد الفائتة من اليوم)
        reminder.lastFiredAt = Date.now(); reminder.snoozeUntil = null;
    }
    const uid = (typeof curU !== 'undefined' && curU && curU.uid) ? curU.uid : 'system'; const now = Date.now();
    const assignedTo = ($('tkAssign') || {}).value || '';
    const linkType = ($('tkLinkType') || {}).value || ''; const linkId = ($('tkLinkId') || {}).value || '';
    const linkName = (linkType && linkId && TASK_LINK_TYPES[linkType] && TASK_LINK_TYPES[linkType].data()[linkId]) ? (TASK_LINK_TYPES[linkType].data()[linkId].name || TASK_LINK_TYPES[linkType].data()[linkId].title || '') : '';
    const tags = (($('tkTags') || {}).value || '').split(/[،,]/).map(s => s.trim()).filter(Boolean);
    const blockedBy = $('tkBlockedBy') ? Array.from($('tkBlockedBy').selectedOptions).map(o => o.value).filter(Boolean) : [];
    const attachments = tasksParseAttach(($('tkAttach') || {}).value || '');
    const data = {
        title, parent, priority: $('tkPrio').value, status: $('tkStatus').value,
        dueDate: $('tkDueDate').value || '', dueTime: $('tkDueTime').value || '',
        notes: ($('tkNotes').value || '').trim(), reminder, updatedAt: now, updatedBy: uid,
        assignedTo, assignedName: assignedTo ? tasksUserName(assignedTo) : '',
        repeatOnComplete: !!($('tkRepeat') && $('tkRepeat').checked),
        linkType: linkType || null, linkId: (linkType && linkId) ? linkId : null, linkName: (linkType && linkId) ? linkName : null,
        tags: tags.length ? tags : null, blockedBy: blockedBy.length ? blockedBy : null,
        attachments: attachments.length ? attachments : null
    };
    let p;
    if (editKey) {
        const cur = window.tasksData[editKey] || {};
        // حافظ على lastFiredAt إن لم يتغيّر جدول التذكير (تجنّب إعادة الإطلاق)
        if (reminder.enabled && cur.reminder && cur.reminder.enabled && cur.reminder.type === reminder.type && cur.reminder.time === reminder.time && cur.reminder.date === reminder.date && cur.reminder.weekday === reminder.weekday && cur.reminder.dayOfMonth === reminder.dayOfMonth && (cur.reminder.lead || 0) === reminder.lead && JSON.stringify(cur.reminder.weekdays || null) === JSON.stringify(reminder.weekdays || null) && cur.reminder.interval === reminder.interval && cur.reminder.unit === reminder.unit) {
            reminder.lastFiredAt = cur.reminder.lastFiredAt || 0;
        }
        p = update(ref(db, 'ledger/tasks/' + editKey), data);
    } else { data.createdAt = now; data.createdBy = uid; p = push(R.tasks, data); }
    p.then(r => { const key = editKey || (r && r.key); if (key) tasksLogActivity(key, editKey ? 'عدّل المهمة' : 'أنشأ المهمة'); tasksCloseEditor(); toast('✅ تم الحفظ', 'ok', 2500); tasksUpdateBadge(); }).catch(e => toast('❌ خطأ في الحفظ: ' + (e.message || e), 'er'));
};

// ── تهيئة كسولة: مستمع Firebase + محرّك التنبيهات (يعمل في كل الصفحات) ─────────────────
(function tasksInit() {
    if (window._tasksInitDone) return;
    if (!window.R || !window.onValue || !window.R.tasks || !window.db) { setTimeout(tasksInit, 700); return; }
    window._tasksInitDone = true;
    try {
        onValue(R.tasks, sn => {
            window.tasksData = sn.val() || {}; tasksUpdateBadge();
            if ($('pg-tasks') && $('pg-tasks').classList.contains('act')) renderTasks();
            if ($('pg-dashboard') && $('pg-dashboard').classList.contains('act') && window.tasksRenderHomeWidget) tasksRenderHomeWidget();
        });
        onValue(TASK_TEMPLATES_REF(), sn => { window.tasksTemplates = sn.val() || {}; });
        // اعتراض التنقّل لعرض ويدجت المهام في لوحة البداية
        if (typeof window.nav === 'function' && !window._tasksNavWrapped) {
            window._tasksNavWrapped = true; const _origNav = window.nav;
            window.nav = function (pg) { const r = _origNav.apply(this, arguments); if (pg === 'dashboard' && window.tasksRenderHomeWidget) setTimeout(tasksRenderHomeWidget, 60); return r; };
        }
        setTimeout(() => { if (window.tasksRenderHomeWidget) tasksRenderHomeWidget(); }, 1500);
        setInterval(tasksCheckReminders, 30000);
        setTimeout(tasksCheckReminders, 4000);
        setInterval(tasksCheckEscalations, 5 * 60000); // فحص التصعيد كل 5 دقائق (محمي بمرة/يوم)
        setTimeout(tasksCheckEscalations, 8000);
    } catch (e) { console.warn('tasks init failed', e); }
})();

console.log('✅ Tasks & Reminders module [TASKS] loaded');
