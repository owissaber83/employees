// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   📊  [FINMODELS]  النماذج المالية والتخطيط — التدفقات النقدية المتوقعة       ║
// ║   جداول قابلة للإدخال: الإيرادات (المستخلصات) · المصروفات · التدفق النقدي      ║
// ║   + دفعات التحصيل (عملاء) ودفعات السداد (موردون) + لوحة مجمّعة + Excel/طباعة   ║
// ║   وحدة مستقلة تعتمد على المتغيرات العامة: R, db, ref, push, update, remove,   ║
// ║   onValue, $, toast, fmt, projects, progressBillings, payrolls, customers,  ║
// ║   vendors, XLSX, Chart                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

window.fmData = window.fmData || { revenue: {}, expenses: {}, collections: {}, payments: {}, settings: {}, baselines: {}, categories: {}, actuals: {}, budget: {} };
window._fmState = window._fmState || { tab: 'dashboard', period: 'month', scenario: { pctAdj: 0, expAdj: 0, inDelay: 0, outDelay: 0 }, cmpBaseline: '', source: 'external', actualMode: 'system', budgetYear: String(new Date().getFullYear()) };
if (window._fmState.scenario && window._fmState.scenario.expAdj == null) window._fmState.scenario.expAdj = 0;
if (!window._fmState.budgetYear) window._fmState.budgetYear = String(new Date().getFullYear());

const FM_MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const FM_EXP_CATS = { salaries: '👷 الرواتب', fixed: '🏢 مصروفات ثابتة أخرى', indirect: '📊 مصروفات غير مباشرة' };
// الفئات المدمجة (المدمجة + المخصّصة التي يضيفها المستخدم)
function fmAllExpCats() { const m = Object.assign({}, FM_EXP_CATS); Object.entries(window.fmData.categories || {}).forEach(([k, v]) => { m[k] = (v && v.label) || v || k; }); return m; }
function fmCatLabel(k) { return fmAllExpCats()[k] || k || ''; }
window.fmAddCategory = function () {
    const label = prompt('🏷️ اسم الفئة الجديدة (مثال: إيجارات، تأمينات، تسويق):', '');
    if (!label || !label.trim()) return;
    push(fmRef('categories'), { label: ('🏷️ ' + label.trim()), createdAt: Date.now() }).then(() => toast('✅ أُضيفت الفئة', 'ok')).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.fmDeleteCategory = function (key) { if (!confirm('حذف هذه الفئة؟ (لن تتأثر السطور المسجّلة بها)')) return; remove(ref(db, FM_BASE + '/categories/' + key)).catch(e => toast('❌ ' + (e.message || e), 'er')); };
window.fmManageCategories = function () {
    const custom = Object.entries(window.fmData.categories || {});
    document.getElementById('taskEditorOverlay')?.remove();
    const ov = document.createElement('div'); ov.id = 'taskEditorOverlay';
    ov.style = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9992;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px';
    ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="background:linear-gradient(135deg,#0e6251,#16a085);color:#fff;padding:14px 18px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center"><div style="font-size:15px;font-weight:900">🏷️ إدارة فئات المصروفات</div><button onclick="document.getElementById('taskEditorOverlay').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:7px;cursor:pointer">✖</button></div>
        <div style="padding:16px">
            <div style="font-size:12px;color:#666;margin-bottom:8px">الفئات المدمجة (ثابتة):</div>
            ${Object.values(FM_EXP_CATS).map(v => `<span style="display:inline-block;background:#eef2f0;color:#0e6251;border-radius:8px;padding:3px 10px;font-size:11px;margin:2px">${v}</span>`).join('')}
            <div style="font-size:12px;color:#666;margin:12px 0 6px">الفئات المخصّصة:</div>
            ${custom.length ? custom.map(([k, v]) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #eee"><span style="font-size:13px;font-weight:700;color:#1a3a5c">${fmEsc((v && v.label) || v)}</span><button onclick="fmDeleteCategory('${k}')" style="background:#fdecea;color:#c0392b;border:none;border-radius:5px;padding:4px 9px;cursor:pointer;font-size:11px">🗑️</button></div>`).join('') : '<div style="color:#999;font-size:12px">لا توجد فئات مخصّصة بعد</div>'}
            <button class="btn" onclick="fmAddCategory()" style="background:#16a34a;color:#fff;padding:8px 18px;font-weight:800;margin-top:12px">➕ إضافة فئة جديدة</button>
        </div></div>`;
    document.body.appendChild(ov);
};
const FM_BASE = 'ledger/finModels';

function fmRef(table) { return ref(db, FM_BASE + '/' + table); }
function fmMonthLabel(ym) { if (!ym) return '—'; const p = ym.split('-'); return (FM_MONTHS_AR[(+p[1]) - 1] || p[1]) + ' ' + p[0]; }
function fmNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function fmEsc(s) { return (s == null ? '' : String(s)).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function fmSource() { return window._fmState.source || 'external'; }
function fmIsInternal() { return fmSource() === 'internal'; }
function fmList(table) {
    if (fmIsInternal()) return fmInternalRows(table);
    // الأحدث في الأعلى (فرز تنازلي بتاريخ الإنشاء)
    return Object.entries(window.fmData[table] || {}).map(([k, v]) => ({ k, ...v })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
// الرصيد الافتتاحي: داخلي = المركز النقدي الفعلي · خارجي = الإدخال اليدوي
function fmOpening() {
    if (fmIsInternal()) { try { return (typeof cffCashPosition === 'function') ? cffCashPosition() : 0; } catch (e) { return 0; } }
    return fmNum((window.fmData.settings || {}).openingBalance);
}
// اشتقاق الصفوف تلقائياً من بيانات البرنامج (للوضع الداخلي — للقراءة فقط)
function fmInternalRows(table) {
    const out = []; let i = 0; const K = () => 'int' + (i++);
    if (table === 'revenue') {
        Object.values(window.progressBillings || {}).forEach(b => {
            if (b.status !== 'approved' && b.status !== 'paid') return;
            const amt = fmNum(b.netAmount || b.currentAmount); if (amt <= 0) return;
            out.push({ k: K(), projectName: b.projectName || (window.projects?.[b.projectId]?.name) || '', month: b.month || (b.date || '').slice(0, 7), claimValue: amt, collectionPct: 100, collectionDate: b.dueDate || b.date || '', notes: 'مستخلص ' + (b.number || '') });
        });
    } else if (table === 'expenses') {
        Object.values(window.payrolls || {}).forEach(p => { if (p.status !== 'approved' && p.status !== 'paid') return; const amt = fmNum(p.totalNet || p.totalNetPay || p.netTotal || (p.rows ? Object.values(p.rows).reduce((s, r) => s + fmNum(r.netPay || r.net), 0) : 0)); if (amt <= 0) return; out.push({ k: K(), category: 'salaries', name: 'رواتب ' + (p.month || p.period || ''), month: p.month || p.period || '', amount: amt, dueDate: (p.month ? p.month + '-28' : ''), notes: 'مسير ' + (p.number || '') }); });
        Object.values(window.recurringJournals || {}).forEach(t => { if (t.active === false) return; const amt = (t.lines || []).reduce((s, l) => s + fmNum(l.debit), 0); if (amt <= 0) return; const m = new Date().toISOString().slice(0, 7); out.push({ k: K(), category: 'fixed', name: t.description || t.name || 'قيد متكرر', month: m, amount: amt, dueDate: m + '-01', notes: 'متكرر' }); });
        Object.values(window.indirectCosts || {}).forEach(c => { const amt = fmNum(c.amount || c.total); if (amt <= 0) return; const m = c.month || (c.date || '').slice(0, 7); out.push({ k: K(), category: 'indirect', name: c.description || c.name || 'تكلفة غير مباشرة', month: m, amount: amt, dueDate: c.date || (m ? m + '-28' : ''), notes: '' }); });
        Object.values(window.employeeExpenses || {}).forEach(e => { if (e.status && e.status !== 'approved' && e.status !== 'paid') return; const amt = fmNum(e.amount); if (amt <= 0) return; out.push({ k: K(), category: 'indirect', name: e.description || 'مصروف موظف', month: (e.date || '').slice(0, 7), amount: amt, dueDate: e.date || '', notes: 'مصروف موظف' }); });
    } else if (table === 'collections') {
        Object.values(window.salesInvoices || {}).forEach(inv => { if (inv.status !== 'posted' || inv.fullyCredited) return; const rem = Math.round(((fmNum(inv.grandTotal)) - (fmNum(inv.paidAmount)) - (fmNum(inv.creditedAmount))) * 100) / 100; if (rem <= 0.5) return; out.push({ k: K(), customerName: (window.customers?.[inv.customerId]?.nameAr) || '', description: 'فاتورة ' + (inv.number || ''), amount: rem, dueDate: inv.dueDate || inv.date || '', status: 'expected', notes: '' }); });
    } else if (table === 'payments') {
        Object.values(window.purchaseInvoices || {}).forEach(inv => { if (inv.status !== 'posted') return; const rem = Math.round(((fmNum(inv.grandTotal)) - (fmNum(inv.paidAmount))) * 100) / 100; if (rem <= 0.5) return; out.push({ k: K(), vendorName: (window.vendors?.[inv.vendorId]?.nameAr || window.vendors?.[inv.vendorId]?.name) || '', description: 'فاتورة ' + (inv.number || inv.vendorRef || ''), amount: rem, dueDate: inv.dueDate || inv.date || '', status: 'expected', notes: '' }); });
    }
    return out;
}

// المتوقع تحصيله من سطر الإيراد (قيمة المستخلص × نسبة التحصيل)
function fmRevExpected(r) { return Math.round(fmNum(r.claimValue) * fmNum(r.collectionPct) / 100 * 100) / 100; }

// خيارات القوائم المنسدلة القابلة للبحث (مصفوفات {v,l}) — تُستهلك بنوع العمود 'combo'
function fmProjOpts() { return Object.values(window.projects || {}).map(p => ({ v: p.name, l: p.name })).filter(o => o.v); }
function fmCustOpts() { return Object.values(window.customers || {}).map(c => ({ v: c.nameAr || c.code, l: c.nameAr || c.code })).filter(o => o.v); }
function fmVendOpts() { return Object.values(window.vendors || {}).map(v => ({ v: v.nameAr || v.name || v.code, l: v.nameAr || v.name || v.code })).filter(o => o.v); }

// ── تعريفات الجداول (محرك عام) ─────────────────
function fmTableDefs() {
    return {
        revenue: {
            title: 'جدول الإيرادات المتوقعة (المستخلصات المعتمدة)', icon: '💰', color: '#16a085',
            cols: [
                { key: 'projectName', label: 'اسم المشروع', type: 'combo', opts: fmProjOpts, w: '180px' },
                { key: 'month', label: 'الشهر', type: 'month', w: '120px' },
                { key: 'claimValue', label: 'قيمة المستخلص', type: 'num', w: '120px' },
                { key: 'collectionPct', label: 'نسبة التحصيل %', type: 'num', w: '100px' },
                { key: 'collectionDate', label: 'تاريخ التحصيل', type: 'date', w: '130px' },
                { key: '_expected', label: 'المتوقع تحصيله', type: 'calc', calc: fmRevExpected, w: '120px' },
                { key: 'notes', label: 'ملاحظات', type: 'text', w: '140px' }
            ]
        },
        expenses: {
            title: 'جدول المصروفات', icon: '💸', color: '#c0392b',
            cols: [
                { key: 'category', label: 'الفئة', type: 'select', options: Object.entries(fmAllExpCats()).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''), w: '170px' },
                { key: 'name', label: 'البيان', type: 'text', w: '200px' },
                { key: 'month', label: 'الشهر', type: 'month', w: '120px' },
                { key: 'amount', label: 'القيمة', type: 'num', w: '120px' },
                { key: 'dueDate', label: 'تاريخ السداد', type: 'date', w: '130px' },
                { key: 'notes', label: 'ملاحظات', type: 'text', w: '140px' }
            ]
        },
        collections: {
            title: 'دفعات التحصيل المتوقعة (من العملاء)', icon: '🤝', color: '#2d6a9f',
            cols: [
                { key: 'customerName', label: 'العميل', type: 'combo', opts: fmCustOpts, w: '180px' },
                { key: 'description', label: 'البيان', type: 'text', w: '180px' },
                { key: 'amount', label: 'المبلغ', type: 'num', w: '120px' },
                { key: 'dueDate', label: 'تاريخ التحصيل', type: 'date', w: '130px' },
                { key: 'status', label: 'الحالة', type: 'select', options: '<option value="expected">⏳ متوقع</option><option value="done">✅ محصّل</option>', w: '110px' },
                { key: 'notes', label: 'ملاحظات', type: 'text', w: '140px' }
            ]
        },
        payments: {
            title: 'دفعات السداد المتوقعة (للموردين)', icon: '🏢', color: '#e67e22',
            cols: [
                { key: 'vendorName', label: 'المورّد', type: 'combo', opts: fmVendOpts, w: '180px' },
                { key: 'description', label: 'البيان', type: 'text', w: '180px' },
                { key: 'amount', label: 'المبلغ', type: 'num', w: '120px' },
                { key: 'dueDate', label: 'تاريخ السداد', type: 'date', w: '130px' },
                { key: 'status', label: 'الحالة', type: 'select', options: '<option value="expected">⏳ متوقع</option><option value="done">✅ مسدّد</option>', w: '110px' },
                { key: 'notes', label: 'ملاحظات', type: 'text', w: '140px' }
            ]
        }
    };
}

// القيمة المتوقعة (المخطّطة) لسطر حسب الجدول
function fmPlanned(table, r) { return table === 'revenue' ? fmRevExpected(r) : fmNum(r.amount); }
// «محصّل إضافي» (تبويب التحصيل فقط): يُضاف للفعلي فقط — المتوقع يبقى المبلغ الأصلي
function fmExtra(table, r) { return table === 'collections' ? fmNum(r.extra) : 0; }
function fmActualVal(table, r) { return Math.round((fmNum(r.actual) + fmExtra(table, r)) * 100) / 100; }
function fmPlannedEff(table, r) { return fmPlanned(table, r); }
// أعمدة الجدول مع إدراج عمودي «الفعلي» و«الفرق» بعد المتوقع (الوضع الخارجي فقط)
function fmTableCols(table) {
    const def = fmTableDefs()[table];
    if (fmIsInternal()) return def.cols;
    const plannedKey = { revenue: '_expected', expenses: 'amount', collections: 'amount', payments: 'amount' }[table];
    const outflow = (table === 'expenses' || table === 'payments');
    const cols = def.cols.slice();
    const idx = cols.findIndex(c => c.key === plannedKey);
    const ins = [{ key: 'actual', label: '✍️ الفعلي', type: 'num', w: '110px' }];
    if (table === 'collections') ins.push({ key: 'extra', label: '➕ محصّل إضافي', type: 'num', w: '120px' });
    ins.push({ key: '_diff', label: 'الفرق', type: 'diff', outflow, calc: r => Math.round((fmActualVal(table, r) - fmPlannedEff(table, r)) * 100) / 100 });
    cols.splice(idx + 1, 0, ...ins);
    return cols;
}

// ── قائمة منسدلة قابلة للبحث (combobox) — تُستخدم في كل قوائم النماذج المالية ──
let _fmComboSeq = 0;
window._fmComboReg = window._fmComboReg || {};
function fmComboHtml(optsArr, value, onPick, ph) {
    const id = 'fmcb' + (_fmComboSeq++);
    window._fmComboReg[id] = { opts: optsArr || [], pick: onPick };
    const cur = (optsArr || []).find(o => o.v === value);
    const lbl = cur ? cur.l : (value || '');
    return `<div class="fmcombo" style="position:relative">
        <input id="${id}" class="fmcombo-inp" type="text" autocomplete="off" value="${fmEsc(lbl)}" data-val="${fmEsc(value || '')}" placeholder="${ph || '🔍 ابحث واختر…'}" onfocus="fmComboShow('${id}',false)" oninput="fmComboShow('${id}',true)" onkeydown="fmComboKey(event,'${id}')" onblur="fmComboHide('${id}')" style="width:100%;padding:5px 8px;border:1px solid #d0d7e0;border-radius:5px;font-family:inherit;font-size:11px;background:#fff"></div>`;
}
window.fmComboShow = function (id, filter) {
    const inp = document.getElementById(id); const reg = window._fmComboReg[id]; if (!inp || !reg) return;
    const q = (inp.value || '').trim().toLowerCase();
    const filtered = (filter && q) ? reg.opts.filter(o => (o.l || '').toLowerCase().includes(q) || (o.v || '').toLowerCase().includes(q)) : reg.opts;
    let panel = document.getElementById('fmComboPanel');
    if (!panel) { panel = document.createElement('div'); panel.id = 'fmComboPanel'; document.body.appendChild(panel); }
    const r = inp.getBoundingClientRect();
    panel.style.cssText = `position:fixed;z-index:99999;left:${r.left}px;top:${r.bottom + 2}px;width:${Math.max(r.width, 190)}px;max-height:240px;overflow:auto;background:#fff;border:1px solid #c0d0e0;border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.18);font-size:12px`;
    panel.dataset.owner = id;
    panel.innerHTML = filtered.length ? filtered.map(o => `<div class="fmcombo-opt" data-v="${fmEsc(o.v)}" onmousedown="fmComboPick('${id}',this.getAttribute('data-v'))" style="padding:7px 10px;cursor:pointer;border-bottom:1px solid #f0f3f7;text-align:right">${fmEsc(o.l)}</div>`).join('') : '<div style="padding:8px 10px;color:#999">لا نتائج مطابقة</div>';
};
window.fmComboPick = function (id, val) {
    const inp = document.getElementById(id); const reg = window._fmComboReg[id];
    const panel = document.getElementById('fmComboPanel'); if (panel) panel.remove();
    if (!inp || !reg) return;
    const o = reg.opts.find(x => x.v === val);
    inp.value = o ? o.l : val; inp.dataset.val = val;
    if (typeof reg.pick === 'function') reg.pick(val);
};
window.fmComboHide = function (id) {
    setTimeout(() => {
        const panel = document.getElementById('fmComboPanel'); if (panel && panel.dataset.owner === id) panel.remove();
        const inp = document.getElementById(id); const reg = window._fmComboReg[id];
        if (inp && reg) { const cur = reg.opts.find(o => o.v === (inp.dataset.val || '')); inp.value = cur ? cur.l : (inp.dataset.val || ''); }
    }, 180);
};
window.fmComboKey = function (e, id) {
    const panel = document.getElementById('fmComboPanel');
    if (e.key === 'Escape') { if (panel) panel.remove(); e.target.blur(); }
    else if (e.key === 'Enter' && panel) { const first = panel.querySelector('.fmcombo-opt'); if (first) { e.preventDefault(); fmComboPick(id, first.getAttribute('data-v')); } }
};
(function fmComboSetup() {
    if (document.getElementById('fmComboStyle')) return;
    const s = document.createElement('style'); s.id = 'fmComboStyle';
    s.textContent = '.fmcombo-opt:hover{background:#eaf2fb}.fmcombo-inp:focus{outline:none;border-color:#16a085;box-shadow:0 0 0 2px rgba(22,160,133,.15)}';
    document.head.appendChild(s);
    const close = () => { const p = document.getElementById('fmComboPanel'); if (p) p.remove(); };
    window.addEventListener('scroll', close, true); window.addEventListener('resize', close);
})();

// ── خلية إدخال عامة ─────────────────
function fmCell(table, rowKey, col, row) {
    const v = row[col.key];
    const oc = `onchange="fmUpdate('${table}','${rowKey}','${col.key}',this.value)"`;
    if (col.type === 'diff') { const dv = col.calc(row); const fav = col.outflow ? dv <= 0 : dv >= 0; return `<td style="padding:4px 6px;text-align:left;direction:ltr;font-weight:800;color:${fav ? '#27ae60' : '#c0392b'};background:${fav ? '#eafaf3' : '#fdecea'}">${dv >= 0 ? '+' : ''}${fmt(dv)}</td>`; }
    if (col.type === 'calc') return `<td style="padding:4px 6px;text-align:left;direction:ltr;font-weight:800;color:#16a085;background:#eafaf3">${fmt(col.calc(row))}</td>`;
    if (col.type === 'select') return `<td style="padding:3px 5px"><select ${oc} style="width:100%;padding:5px;border:1px solid #d0d7e0;border-radius:5px;font-family:inherit;font-size:11px">${col.options.replace(`value="${fmEsc(v)}"`, `value="${fmEsc(v)}" selected`)}</select></td>`;
    if (col.type === 'combo') { const optsArr = typeof col.opts === 'function' ? col.opts() : (col.opts || []); return `<td style="padding:3px 5px">${fmComboHtml(optsArr, v, function (val) { fmUpdate(table, rowKey, col.key, val); })}</td>`; }
    if (col.type === 'num') return `<td style="padding:3px 5px"><input type="number" step="0.01" value="${v == null ? '' : v}" ${oc} style="width:100%;padding:5px;border:1px solid #d0d7e0;border-radius:5px;text-align:left;direction:ltr;font-size:12px;font-weight:700"></td>`;
    if (col.type === 'date') return `<td style="padding:3px 5px"><input type="date" value="${fmEsc(v)}" ${oc} style="width:100%;padding:5px;border:1px solid #d0d7e0;border-radius:5px;font-size:11px"></td>`;
    if (col.type === 'month') return `<td style="padding:3px 5px"><input type="month" value="${fmEsc(v)}" ${oc} style="width:100%;padding:5px;border:1px solid #d0d7e0;border-radius:5px;font-size:11px"></td>`;
    return `<td style="padding:3px 5px"><input type="text" value="${fmEsc(v)}" ${oc} style="width:100%;padding:5px;border:1px solid #d0d7e0;border-radius:5px;font-size:12px"></td>`;
}

window.fmUpdate = function (table, key, field, value) {
    update(ref(db, FM_BASE + '/' + table + '/' + key), { [field]: value, updatedAt: Date.now() })
        .then(() => { if (['claimValue', 'collectionPct', 'amount', 'category', 'month', 'actual', 'extra', 'customerName'].includes(field)) fmSoftRefresh(); })
        .catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.fmAddRow = function (table) {
    const seed = { createdAt: Date.now() };
    if (table === 'expenses') seed.category = 'fixed';
    if (table === 'collections' || table === 'payments') seed.status = 'expected';
    push(fmRef(table), seed).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.fmDeleteRow = function (table, key) { if (!confirm('حذف هذا السطر؟')) return; remove(ref(db, FM_BASE + '/' + table + '/' + key)).catch(e => toast('❌ ' + (e.message || e), 'er')); };

function fmSoftRefresh() { if ($('pg-finmodels') && $('pg-finmodels').classList.contains('act')) renderFinModels(); }

// تكرار سطر (الأحدث للأعلى)
window.fmDuplicateRow = function (table, key) { const r = (window.fmData[table] || {})[key]; if (!r) return; const c = Object.assign({}, r); delete c.k; c.createdAt = Date.now(); c.updatedAt = Date.now(); push(fmRef(table), c).catch(e => toast('❌ ' + (e.message || e), 'er')); };
// بحث داخل جدول (إخفاء بدون إعادة رسم) + إعادة حساب الإجماليات على الظاهر فقط
window.fmFilterTable = function (table, q) {
    q = (q || '').trim().toLowerCase();
    const tb = document.getElementById('fmtbody-' + table); if (!tb) return;
    const outflow = (table === 'expenses' || table === 'payments');
    let shown = 0, total = 0, totalAct = 0, mPlan = 0, mAct = 0; const cm = new Date().toISOString().slice(0, 7);
    tb.querySelectorAll('tr[data-fmsearch]').forEach(tr => {
        const m = !q || (tr.getAttribute('data-fmsearch') || '').includes(q);
        tr.style.display = m ? '' : 'none';
        if (m) { shown++; const p = parseFloat(tr.getAttribute('data-fmamount')) || 0; const a = parseFloat(tr.getAttribute('data-fmactual')) || 0; total += p; totalAct += a; if ((tr.getAttribute('data-fmmonth') || '') === cm) { mPlan += p; mAct += a; } }
    });
    const diff = Math.round((totalAct - total) * 100) / 100; const mDiff = Math.round((mAct - mPlan) * 100) / 100;
    const dc = (diff === 0 ? true : (outflow ? diff <= 0 : diff >= 0)) ? '#27ae60' : '#c0392b';
    const mdc = (mDiff === 0 ? true : (outflow ? mDiff <= 0 : mDiff >= 0)) ? '#27ae60' : '#c0392b';
    const set = (id, v, col) => { const el = document.getElementById(id); if (el) { el.textContent = v; if (col) el.style.color = col; } };
    set('fmCount-' + table, shown); set('fmFootCnt-' + table, shown);
    set('fmTotalChip-' + table, fmt(total)); set('fmFootTotal-' + table, fmt(total));
    set('fmActualChip-' + table, fmt(totalAct)); set('fmFootAct-' + table, fmt(totalAct));
    set('fmDiffChip-' + table, (diff >= 0 ? '+' : '') + fmt(diff), dc); set('fmFootDiff-' + table, (diff >= 0 ? '+' : '') + fmt(diff), dc);
    set('fmMonthChip-' + table, fmt(mPlan)); set('fmMonthActChip-' + table, fmt(mAct));
    set('fmMonthDiffChip-' + table, (mDiff >= 0 ? '+' : '') + fmt(mDiff), mdc);
};

// ── جدول عام قابل للإدخال ─────────────────
function fmRenderTable(table) {
    const def = fmTableDefs()[table]; const cols = fmTableCols(table); const rows = fmList(table); const ro = fmIsInternal();
    const outflow = (table === 'expenses' || table === 'payments');
    const plannedOf = r => fmPlannedEff(table, r); const actualOf = r => fmActualVal(table, r);
    let total = 0, totalAct = 0; rows.forEach(r => { total += plannedOf(r); totalAct += actualOf(r); });
    const totalDiff = Math.round((totalAct - total) * 100) / 100;
    const curMonth = new Date().toISOString().slice(0, 7);
    const monthOf = r => (r.collectionDate || r.dueDate || '').slice(0, 7) || r.month || '';
    const mRows = rows.filter(r => monthOf(r) === curMonth);
    const thisMonth = mRows.reduce((s, r) => s + plannedOf(r), 0); const thisMonthAct = mRows.reduce((s, r) => s + actualOf(r), 0);
    const head = cols.map(c => `<th style="padding:8px 6px;text-align:center;color:#fff;font-size:11.5px;${c.w ? 'min-width:' + c.w : ''}">${c.label}</th>`).join('');
    const rowSearch = r => cols.map(c => (c.type === 'calc' || c.type === 'diff') ? fmt(c.calc(r)) : c.key === 'category' ? fmCatLabel(r[c.key]) : c.type === 'month' ? (fmMonthLabel(r[c.key]) + ' ' + (r[c.key] || '')) : (r[c.key] == null ? '' : r[c.key])).join(' ').toLowerCase();
    const roCell = (c, r) => { let v = r[c.key]; if (c.type === 'calc') v = fmt(c.calc(r)); else if (c.key === 'category') v = fmCatLabel(v); else if (c.key === 'status') v = v === 'done' ? '✅ تم' : '⏳ متوقع'; else if (c.type === 'month') v = fmMonthLabel(v); else if (c.type === 'num') v = v != null ? fmt(v) : '—'; else v = v == null || v === '' ? '—' : v; return `<td style="padding:7px 6px;${c.type === 'num' || c.type === 'calc' ? 'text-align:left;direction:ltr;font-weight:700' : 'text-align:center'};${c.type === 'calc' ? 'color:#16a085;background:#eafaf3' : ''}">${fmEsc(v)}</td>`; };
    const fav = totalDiff === 0 ? true : (outflow ? totalDiff <= 0 : totalDiff >= 0); const diffColor = fav ? '#27ae60' : '#c0392b';
    const body = rows.length ? rows.map(r => `<tr data-fmsearch="${fmEsc(rowSearch(r))}" data-fmamount="${plannedOf(r)}" data-fmactual="${actualOf(r)}" data-fmmonth="${fmEsc(monthOf(r))}" style="border-bottom:1px solid #eef2f5">
        ${cols.map(c => ro ? roCell(c, r) : fmCell(table, r.k, c, r)).join('')}
        ${ro ? '' : `<td style="padding:3px 5px;text-align:center;white-space:nowrap"><button onclick="fmDuplicateRow('${table}','${r.k}')" title="تكرار" style="background:#eaf2fb;color:#2d6a9f;border:none;border-radius:5px;padding:5px 7px;cursor:pointer;font-size:11px">⧉</button> <button onclick="fmDeleteRow('${table}','${r.k}')" title="حذف" style="background:#fdecea;color:#c0392b;border:none;border-radius:5px;padding:5px 7px;cursor:pointer;font-size:11px">🗑️</button></td>`}
    </tr>`).join('') : `<tr><td colspan="${cols.length + 1}" style="text-align:center;color:#999;padding:24px">${ro ? 'لا توجد بيانات في البرنامج لهذا الجدول' : 'لا توجد سطور — أضف سطراً أو استورد من Excel'}</td></tr>`;
    const seedBtn = table === 'revenue' ? `<button class="btn" onclick="fmSeedRevenue()" style="background:#0e6251;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📥 نسخ المستخلصات للخارجي</button>`
        : table === 'expenses' ? `<button class="btn" onclick="fmSeedSalaries()" style="background:#0e6251;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📥 نسخ الرواتب للخارجي</button>`
            : table === 'collections' ? `<button class="btn" onclick="fmSeedReceivables()" style="background:#0e6251;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📥 نسخ ذمم العملاء</button>`
                : table === 'payments' ? `<button class="btn" onclick="fmSeedPayables()" style="background:#0e6251;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📥 نسخ ذمم الموردين</button>` : '';
    const catBtn = (table === 'expenses' && !ro) ? `<button class="btn" onclick="fmManageCategories()" style="background:#8e44ad;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">🏷️ الفئات</button>` : '';
    const actions = ro
        ? `<button class="btn" onclick="fmExportExcel('${table}')" style="background:#1d6f42;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📊 تصدير</button><button class="btn" onclick="fmPrintTable('${table}')" style="background:#1a3a5c;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">🖨️ طباعة</button>`
        : `<button class="btn" onclick="fmAddRow('${table}')" style="background:#16a34a;color:#fff;padding:7px 14px;font-size:12px;font-weight:800">➕ سطر جديد</button>${catBtn}${seedBtn}<button class="btn" onclick="fmExportExcel('${table}')" style="background:#1d6f42;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📊 تصدير</button><label class="btn" style="background:#eef2f0;color:#0e6251;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer">📂 استيراد<input type="file" accept=".xlsx,.xls" style="display:none" onchange="fmImportExcel('${table}',this.files[0]);this.value=''"></label><button class="btn" onclick="fmPrintTable('${table}')" style="background:#1a3a5c;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">🖨️ طباعة</button>`;
    const chip = (l, v, c) => `<div style="background:#f8fafc;border-radius:8px;padding:6px 12px;border-bottom:2px solid ${c}"><span style="font-size:10px;color:#666">${l}</span> <b style="color:${c};font-size:13px">${v}</b></div>`;
    return `<div class="card" style="padding:14px">
        ${ro ? '<div style="background:#eaf2fb;border-right:4px solid #2d6a9f;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#1f618d;font-weight:700">🔗 وضع داخلي: هذه البيانات مشتقّة تلقائياً من البرنامج (للقراءة فقط). للتعديل اليدوي بدّل إلى «خارجي».</div>' : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div style="font-size:15px;font-weight:900;color:${def.color}">${def.icon} ${def.title}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${actions}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
            <input id="fmSearch-${table}" oninput="fmFilterTable('${table}',this.value)" placeholder="🔍 بحث في ${def.title}…" style="flex:1;min-width:180px;padding:8px 12px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:12.5px">
            ${chip('عدد السطور', `<span id="fmCount-${table}">${rows.length}</span>`, '#1a3a5c')}
            ${chip('المتوقع', `<span id="fmTotalChip-${table}">${fmt(total)}</span>`, def.color)}
            ${ro ? '' : chip('✍️ الفعلي', `<span id="fmActualChip-${table}">${fmt(totalAct)}</span>`, '#0e6251')}
            ${ro ? '' : chip('الفرق', `<span id="fmDiffChip-${table}" style="color:${diffColor}">${totalDiff >= 0 ? '+' : ''}${fmt(totalDiff)}</span>`, diffColor)}
        </div>
        ${ro ? '' : `<div style="background:#eef6f3;border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:12.5px">
            <b style="color:#0e6251">📅 مقارنة الشهر الحالي (${fmMonthLabel(curMonth)}):</b>
            <span>المتوقع <b style="color:${def.color}"><span id="fmMonthChip-${table}">${fmt(thisMonth)}</span></b></span>
            <span>الفعلي <b style="color:#0e6251"><span id="fmMonthActChip-${table}">${fmt(thisMonthAct)}</span></b></span>
            <span>الفرق <b id="fmMonthDiffChip-${table}" style="color:${(outflow ? (thisMonthAct - thisMonth) <= 0 : (thisMonthAct - thisMonth) >= 0) ? '#27ae60' : '#c0392b'}">${(thisMonthAct - thisMonth) >= 0 ? '+' : ''}${fmt(thisMonthAct - thisMonth)}</b></span>
        </div>`}
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:860px">
            <thead><tr style="background:linear-gradient(135deg,${def.color},${def.color}cc)">${head}<th style="padding:8px 6px;color:#fff">⚙️</th></tr></thead>
            <tbody id="fmtbody-${table}">${body}</tbody>
            <tfoot><tr style="background:#f0f5fa;font-weight:900;color:#1a3a5c;border-top:2px solid ${def.color}"><td colspan="${cols.length}" style="padding:9px;text-align:left">${ro ? `الإجمالي: <span id="fmFootTotal-${table}">${fmt(total)} ر.س (${rows.length} سطر)</span>` : `المتوقع <span id="fmFootTotal-${table}">${fmt(total)}</span> · الفعلي <span id="fmFootAct-${table}" style="color:#0e6251">${fmt(totalAct)}</span> · الفرق <span id="fmFootDiff-${table}" style="color:${diffColor}">${totalDiff >= 0 ? '+' : ''}${fmt(totalDiff)}</span> · (<span id="fmFootCnt-${table}">${rows.length}</span> سطر)`}</td><td></td></tr></tfoot>
        </table></div>
        ${table === 'expenses' ? fmExpenseBreakdown(rows) : ''}
    </div>`;
}
// تحليل المصروفات حسب الفئة (تحت الجدول)
function fmExpenseBreakdown(rows) {
    const by = {}; rows.forEach(r => { const k = r.category || 'fixed'; by[k] = (by[k] || 0) + fmNum(r.amount); });
    const entries = Object.entries(by).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '';
    const grand = entries.reduce((s, [, v]) => s + v, 0);
    return `<div style="margin-top:12px;background:#faf8fc;border-radius:10px;padding:12px"><div style="font-weight:800;color:#5b2c6f;font-size:13px;margin-bottom:8px">📊 المصروفات حسب الفئة</div>
        ${entries.map(([k, v]) => { const p = grand ? Math.round(v / grand * 100) : 0; return `<div style="margin-bottom:7px"><div style="display:flex;justify-content:space-between;font-size:12px"><span style="font-weight:700">${fmEsc(fmCatLabel(k))}</span><span style="font-weight:800">${fmt(v)} (${p}%)</span></div><div style="background:#eee;border-radius:6px;height:7px;margin-top:2px;overflow:hidden"><div style="width:${p}%;height:100%;background:#8e44ad"></div></div></div>`; }).join('')}
    </div>`;
}

// ── 🤝 دفعات التحصيل: ملخّص كروت لكل عميل + شاشة إدخال منفصلة ──
window.fmFilterCollCards = function (q) {
    q = (q || '').trim().toLowerCase();
    let shown = 0, total = 0, act = 0;
    document.querySelectorAll('#fmCollCards .fmcoll-card').forEach(card => {
        const m = !q || (card.getAttribute('data-custname') || '').includes(q);
        card.style.display = m ? '' : 'none';
        if (m) { shown++; total += parseFloat(card.getAttribute('data-planned')) || 0; act += parseFloat(card.getAttribute('data-actual')) || 0; }
    });
    const diff = Math.round((act - total) * 100) / 100; const dc = diff >= 0 ? '#27ae60' : '#c0392b';
    const set = (id, val, col) => { const el = document.getElementById(id); if (el) { el.textContent = val; if (col) el.style.color = col; } };
    set('fmCollCustCount', shown); set('fmCollTotal', fmt(total)); set('fmCollAct', fmt(act)); set('fmCollDiff', (diff >= 0 ? '+' : '') + fmt(diff), dc);
};
// تبويب التحصيل = شاشتان: 📊 ملخّص العملاء (كروت) · 📝 إدخال الدفعات (جدول)
window.fmSetCollView = function (v) { window._fmState.collView = v; fmSoftRefresh(); };
window.fmCollOpenEntry = function (encName) {
    window._fmState.collView = 'entry'; fmSoftRefresh();
    const name = encName ? decodeURIComponent(encName) : '';
    setTimeout(() => { const s = document.getElementById('fmSearch-collections'); if (s) { s.value = name; fmFilterTable('collections', name); s.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 90);
};
function fmRenderCollections() {
    const v = window._fmState.collView || 'cards';
    const seg = (id, l) => `<button onclick="fmSetCollView('${id}')" style="${v === id ? 'background:#0e6251;color:#fff' : 'background:#eef2f0;color:#0e6251'};border:none;padding:8px 16px;font-weight:800;font-size:13px;border-radius:9px;cursor:pointer">${l}</button>`;
    const toggle = `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">${seg('cards', '📊 ملخّص العملاء (كروت)')}${seg('entry', '📝 إدخال الدفعات')}</div>`;
    return toggle + (v === 'entry' ? fmRenderTable('collections') : fmRenderCollectionsSummary());
}
function fmRenderCollectionsSummary() {
    const table = 'collections';
    const def = fmTableDefs()[table]; const rows = fmList(table); const ro = fmIsInternal();
    const plannedOf = r => fmPlannedEff(table, r); const actualOf = r => fmActualVal(table, r);
    let total = 0, totalAct = 0; rows.forEach(r => { total += plannedOf(r); totalAct += actualOf(r); });
    const totalDiff = Math.round((totalAct - total) * 100) / 100; const diffColor = totalDiff >= 0 ? '#27ae60' : '#c0392b';
    // تجميع الصفوف حسب العميل
    const groups = {}; rows.forEach(r => { const name = (r.customerName || '').trim() || '— غير محدّد —'; (groups[name] = groups[name] || []).push(r); });
    const names = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'ar'));
    const stat = (l, val, c) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed #eef2f5"><span style="font-size:12px;color:#666">${l}</span><b style="font-size:13px;color:${c};direction:ltr">${val}</b></div>`;
    const cards = names.map(name => {
        const grp = groups[name];
        let cT = 0, cA = 0; grp.forEach(r => { cT += plannedOf(r); cA += actualOf(r); });
        const cD = Math.round((cA - cT) * 100) / 100; const cdc = cD >= 0 ? '#27ae60' : '#c0392b';
        const pct = cT > 0 ? Math.min(100, Math.round(cA / cT * 100)) : (cA > 0 ? 100 : 0);
        const safeName = encodeURIComponent(name === '— غير محدّد —' ? '' : name);
        return `<div class="fmcoll-card" data-custname="${fmEsc(name.toLowerCase())}" data-planned="${cT}" data-actual="${cA}" onclick="fmCollOpenEntry('${safeName}')" title="اضغط لعرض/تعديل دفعات هذا العميل" style="cursor:pointer;border:1px solid #e3e9f0;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);transition:transform .1s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
            <div style="background:linear-gradient(135deg,#2d6a9f,#1f618d);color:#fff;padding:11px 14px">
                <div style="font-size:14px;font-weight:900;line-height:1.3">🤝 ${fmEsc(name)}</div>
                <div style="font-size:11px;opacity:.85;margin-top:2px">${grp.length} دفعة</div>
            </div>
            <div style="padding:11px 14px">
                ${stat('إجمالي الدفعات (المتوقع)', fmt(cT), '#2d6a9f')}
                ${stat('إجمالي المحصّل (الفعلي)', fmt(cA), '#0e6251')}
                ${stat('الصافي (الفرق)', (cD >= 0 ? '+' : '') + fmt(cD), cdc)}
                <div style="margin-top:9px"><div style="display:flex;justify-content:space-between;font-size:10.5px;color:#888;margin-bottom:3px"><span>نسبة التحصيل</span><span>${pct}%</span></div><div style="background:#eef2f5;border-radius:6px;height:7px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${pct >= 100 ? '#27ae60' : '#2d6a9f'}"></div></div></div>
            </div>
        </div>`;
    }).join('');
    const chip = (l, val, c) => `<div style="background:#f8fafc;border-radius:8px;padding:6px 12px;border-bottom:2px solid ${c}"><span style="font-size:10px;color:#666">${l}</span> <b style="color:${c};font-size:13px">${val}</b></div>`;
    const actions = `<button class="btn" onclick="fmSetCollView('entry')" style="background:#16a34a;color:#fff;padding:7px 14px;font-size:12px;font-weight:800">➕ إدخال دفعة</button><button class="btn" onclick="fmExportExcel('collections')" style="background:#1d6f42;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📊 تصدير</button><button class="btn" onclick="fmPrintTable('collections')" style="background:#1a3a5c;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">🖨️ طباعة</button>`;
    return `<div class="card" style="padding:14px">
        ${ro ? '<div style="background:#eaf2fb;border-right:4px solid #2d6a9f;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#1f618d;font-weight:700">🔗 وضع داخلي: بيانات مشتقّة تلقائياً (للقراءة فقط).</div>' : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div style="font-size:15px;font-weight:900;color:${def.color}">${def.icon} ملخّص التحصيل لكل عميل</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${actions}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
            <input id="fmCollSearch" oninput="fmFilterCollCards(this.value)" placeholder="🔍 ابحث عن عميل…" style="flex:1;min-width:220px;padding:9px 14px;border:1.5px solid #d0d7e0;border-radius:9px;font-family:inherit;font-size:13px">
            ${chip('عدد العملاء', `<span id="fmCollCustCount">${names.length}</span>`, '#1a3a5c')}
            ${chip('إجمالي الدفعات', `<span id="fmCollTotal">${fmt(total)}</span>`, def.color)}
            ${chip('إجمالي المحصّل', `<span id="fmCollAct">${fmt(totalAct)}</span>`, '#0e6251')}
            ${chip('الصافي', `<span id="fmCollDiff" style="color:${diffColor}">${totalDiff >= 0 ? '+' : ''}${fmt(totalDiff)}</span>`, diffColor)}
        </div>
        <div id="fmCollCards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">${names.length ? cards : '<div style="text-align:center;color:#999;padding:30px;grid-column:1/-1">لا توجد دفعات تحصيل — افتح «📝 إدخال الدفعات» لإضافة سطور</div>'}</div>
    </div>`;
}

// ── حساب التدفق النقدي الشهري (مع دعم سيناريو) ─────────────────
// يُرجع شهر YYYY-MM بعد إزاحة التاريخ بعدد أيام (للتأخير/التسريع)
function fmShiftMonth(dateStr, fallbackMonth, days) {
    let d = null;
    if (dateStr) d = new Date(dateStr); else if (fallbackMonth) d = new Date(fallbackMonth + '-15');
    if (!d || isNaN(d.getTime())) return fallbackMonth || '';
    if (days) d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 7);
}
function fmCashflow(sc) {
    sc = sc || window._fmState.scenario || { pctAdj: 0, expAdj: 0, inDelay: 0, outDelay: 0 };
    const inFactor = 1 + (fmNum(sc.pctAdj) / 100);
    const outFactor = 1 + (fmNum(sc.expAdj) / 100);
    const inDelay = fmNum(sc.inDelay), outDelay = fmNum(sc.outDelay);
    const opening = fmOpening();
    const inMap = {}, outMap = {}; const addIn = (m, v) => { if (m) inMap[m] = (inMap[m] || 0) + v; }; const addOut = (m, v) => { if (m) outMap[m] = (outMap[m] || 0) + v; };
    fmList('revenue').forEach(r => addIn(fmShiftMonth(r.collectionDate, r.month, inDelay), fmRevExpected(r) * inFactor));
    fmList('collections').forEach(r => addIn(fmShiftMonth(r.dueDate, null, inDelay), fmNum(r.amount) * inFactor));
    fmList('expenses').forEach(r => addOut(fmShiftMonth(r.dueDate, r.month, outDelay), fmNum(r.amount) * outFactor));
    fmList('payments').forEach(r => addOut(fmShiftMonth(r.dueDate, null, outDelay), fmNum(r.amount) * outFactor));
    // ── مخصّصات اختيارية (محتجزات / ضريبة / زكاة) — تُدرَج فقط إذا فُعّلت في الإعدادات ──
    const stg = window.fmData.settings || {};
    if (stg.includeRetention) fmRetentionSchedule().forEach(r => { if (r.releaseMonth && r.retentionHeld > 0) addIn(fmShiftMonth(r.releaseMonth, null, inDelay), r.retentionHeld); });
    if (stg.includeVAT) fmVatSchedule().forEach(q => { if (!q.settleMonth) return; if (q.net >= 0) addOut(q.settleMonth, q.net); else addIn(q.settleMonth, -q.net); });
    if (stg.includeZakat && fmNum(stg.zakatEstimate) > 0) { const zm = stg.zakatMonth || (String(new Date().getFullYear()) + '-12'); addOut(zm, fmNum(stg.zakatEstimate)); }
    const months = [...new Set([...Object.keys(inMap), ...Object.keys(outMap)])].filter(Boolean).sort();
    let run = opening;
    const rows = months.map(m => { const tin = Math.round((inMap[m] || 0) * 100) / 100, tout = Math.round((outMap[m] || 0) * 100) / 100, net = Math.round((tin - tout) * 100) / 100; run = Math.round((run + net) * 100) / 100; return { m, in: tin, out: tout, net, run }; });
    return { opening, rows, totalIn: rows.reduce((s, r) => s + r.in, 0), totalOut: rows.reduce((s, r) => s + r.out, 0), closing: run, minRun: rows.length ? Math.min(opening, ...rows.map(r => r.run)) : opening };
}
// تجميع صفوف شهرية إلى ربعي/سنوي (الرصيد = آخر فترة)
function fmGroupRows(rows, period) {
    if (period === 'month' || !period) return rows.map(r => ({ label: fmMonthLabel(r.m), in: r.in, out: r.out, net: r.net, run: r.run }));
    const key = (m) => { const [y, mo] = m.split('-'); return period === 'year' ? y : (y + '-Q' + (Math.floor((+mo - 1) / 3) + 1)); };
    const lbl = (k) => period === 'year' ? ('سنة ' + k) : (k.replace('-Q', ' — الربع '));
    const map = {}; const order = [];
    rows.forEach(r => { const k = key(r.m); if (!map[k]) { map[k] = { label: lbl(k), in: 0, out: 0, net: 0, run: r.run }; order.push(k); } map[k].in += r.in; map[k].out += r.out; map[k].net += r.net; map[k].run = r.run; });
    return order.map(k => map[k]);
}
// مؤشرات السيولة
function fmLiquidity(cf) {
    const runwayIdx = cf.rows.findIndex(r => r.run < 0);
    const financingGap = Math.max(0, -cf.minRun);
    const coverage = cf.totalOut > 0 ? cf.totalIn / cf.totalOut : (cf.totalIn > 0 ? 999 : 0);
    const threshold = fmNum((window.fmData.settings || {}).minBalance);
    const breachIdx = threshold > 0 ? cf.rows.findIndex(r => r.run < threshold) : -1;
    const avgNet = cf.rows.length ? cf.rows.reduce((s, r) => s + r.net, 0) / cf.rows.length : 0;
    const avgBurn = cf.rows.length ? cf.rows.reduce((s, r) => s + r.out, 0) / cf.rows.length : 0;
    const runwayMonths = avgNet < 0 ? Math.floor(cf.opening / -avgNet) : null;
    return { runwayIdx, runwayLabel: runwayIdx < 0 ? 'آمن خلال الأفق' : ('ينفد في ' + fmMonthLabel(cf.rows[runwayIdx].m)), financingGap, coverage, threshold, breachIdx, breachLabel: breachIdx >= 0 ? fmMonthLabel(cf.rows[breachIdx].m) : '', avgNet, avgBurn, runwayMonths };
}
window.fmSetScenario = function (field, v) { window._fmState.scenario[field] = fmNum(v); fmSoftRefresh(); };
window.fmScenarioPreset = function (p) {
    if (p === 'opt') window._fmState.scenario = { pctAdj: 5, expAdj: -3, inDelay: -7, outDelay: 10 };
    else if (p === 'pess') window._fmState.scenario = { pctAdj: -20, expAdj: 10, inDelay: 30, outDelay: -5 };
    else window._fmState.scenario = { pctAdj: 0, expAdj: 0, inDelay: 0, outDelay: 0 };
    fmSoftRefresh();
};
window.fmSetPeriod = function (p) { window._fmState.period = p; fmSoftRefresh(); };
window.fmSetMinBalance = function (v) { update(fmRef('settings'), { minBalance: fmNum(v) }).then(fmSoftRefresh).catch(e => toast('❌ ' + (e.message || e), 'er')); };

function fmRenderCashflow() {
    const st = window._fmState; const sc = st.scenario;
    const cf = fmCashflow(sc); const liq = fmLiquidity(cf);
    const grouped = fmGroupRows(cf.rows, st.period);
    const pBtn = (id, l) => `<button class="btn" onclick="fmSetPeriod('${id}')" style="${st.period === id ? 'background:#0e6251;color:#fff' : 'background:#eef2f0;color:#0e6251'};padding:5px 11px;font-size:11px;font-weight:700;border-radius:7px">${l}</button>`;
    const scBtn = (p, l, c) => `<button class="btn" onclick="fmScenarioPreset('${p}')" style="background:${c};color:#fff;padding:5px 11px;font-size:11px;font-weight:700;border-radius:7px">${l}</button>`;
    const liqCard = (l, v, c, ic) => `<div style="background:#fff;border-radius:10px;padding:10px;text-align:center;border-bottom:3px solid ${c}"><div style="font-size:10.5px;color:#666">${ic} ${l}</div><div style="font-size:15px;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`;
    return `<div class="card" style="padding:14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div style="font-size:14px;font-weight:900;color:#5b2c6f">🎯 سيناريو وتحليل حساسية</div>
            <div style="display:flex;gap:6px">${scBtn('opt', '🟢 تفاؤلي', '#27ae60')} ${scBtn('base', '⚪ أساسي', '#7f8c8d')} ${scBtn('pess', '🔴 متشائم', '#c0392b')}</div>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
            <div><label style="font-size:11px;color:#666">تعديل نسبة التحصيل %</label><br><input type="number" value="${sc.pctAdj}" onchange="fmSetScenario('pctAdj',this.value)" style="width:90px;padding:5px;border:1px solid #d0d7e0;border-radius:6px;text-align:center"> </div>
            <div><label style="font-size:11px;color:#666">تضخّم المصروفات %</label><br><input type="number" value="${sc.expAdj || 0}" onchange="fmSetScenario('expAdj',this.value)" style="width:90px;padding:5px;border:1px solid #d0d7e0;border-radius:6px;text-align:center"></div>
            <div><label style="font-size:11px;color:#666">تأخير التحصيل (أيام)</label><br><input type="number" value="${sc.inDelay}" onchange="fmSetScenario('inDelay',this.value)" style="width:90px;padding:5px;border:1px solid #d0d7e0;border-radius:6px;text-align:center"></div>
            <div><label style="font-size:11px;color:#666">تأخير السداد (أيام)</label><br><input type="number" value="${sc.outDelay}" onchange="fmSetScenario('outDelay',this.value)" style="width:90px;padding:5px;border:1px solid #d0d7e0;border-radius:6px;text-align:center"></div>
            <div style="font-size:11px;color:#888">قيم موجبة = تأخير لاحق · سالبة = تسريع</div>
        </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:14px">
        ${liqCard('فترة التغطية (Runway)', liq.runwayMonths != null ? liq.runwayMonths + ' شهر' : '∞', liq.runwayMonths != null && liq.runwayMonths < 3 ? '#c0392b' : '#27ae60', '⏳')}
        ${liqCard('فجوة التمويل المطلوبة', fmt(liq.financingGap), liq.financingGap > 0 ? '#c0392b' : '#27ae60', '🏦')}
        ${liqCard('نسبة تغطية التدفقات', (liq.coverage >= 999 ? '∞' : liq.coverage.toFixed(2) + '×'), liq.coverage >= 1 ? '#27ae60' : '#c0392b', '⚖️')}
        ${liqCard('أدنى رصيد متوقع', fmt(cf.minRun), cf.minRun < 0 ? '#c0392b' : '#27ae60', cf.minRun < 0 ? '⚠️' : '✅')}
        ${liqCard('نفاد السيولة', liq.runwayLabel, liq.runwayIdx >= 0 ? '#c0392b' : '#27ae60', '🚦')}
    </div>
    <div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
            <div style="font-size:15px;font-weight:900;color:#1a3a5c">🔄 جدول التدفقات النقدية المتوقعة</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <span style="font-size:11px;color:#666">التجميع:</span>${pBtn('month', 'شهري')} ${pBtn('quarter', 'ربعي')} ${pBtn('year', 'سنوي')}
                <span style="width:1px;height:18px;background:#ddd"></span>
                ${fmIsInternal()
            ? `<span style="font-size:12px;color:#1f618d;font-weight:700">💰 افتتاحي (المركز النقدي الفعلي): ${fmt(cf.opening)}</span>`
            : `<label style="font-size:12px;color:#666">💰 افتتاحي</label><input type="number" step="0.01" value="${cf.opening}" onchange="fmSetOpening(this.value)" style="width:110px;padding:6px;border:1.5px solid #d0d7e0;border-radius:6px;text-align:left;direction:ltr;font-weight:700">`}
                <label style="font-size:12px;color:#666" title="تنبيه عند هبوط الرصيد تحته">🔔 حد أدنى</label>
                <input type="number" step="0.01" value="${liq.threshold}" onchange="fmSetMinBalance(this.value)" style="width:100px;padding:6px;border:1.5px solid #f0c419;border-radius:6px;text-align:left;direction:ltr;font-weight:700">
                <button class="btn" onclick="fmPrintCashflow()" style="background:#1a3a5c;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">🖨️ طباعة</button>
                <button class="btn" onclick="fmExportCashflow()" style="background:#1d6f42;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📊 تصدير</button>
            </div>
        </div>
        ${cf.minRun < 0 ? `<div style="background:#fdecea;border-right:4px solid #c0392b;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#922b21;font-weight:700">⚠️ تحذير سيولة: الرصيد المتوقع يصبح سالباً (${fmt(cf.minRun)}) — ${liq.runwayLabel}. فجوة التمويل المطلوبة ${fmt(liq.financingGap)}.</div>` : ''}
        ${(liq.breachIdx >= 0 && cf.minRun >= 0) ? `<div style="background:#fff8e1;border-right:4px solid #f39c12;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#7d6608;font-weight:700">🔔 الرصيد المتوقع يهبط تحت الحد الأدنى (${fmt(liq.threshold)}) في ${liq.breachLabel}.</div>` : ''}
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:620px">
            <thead><tr style="background:linear-gradient(135deg,#1a3a5c,#2c3e50);color:#fff">
                <th style="padding:10px;text-align:right">الفترة</th><th style="padding:10px;text-align:center">+ إجمالي التحصيلات</th><th style="padding:10px;text-align:center">− إجمالي التدفقات الخارجة</th><th style="padding:10px;text-align:center">= صافي التدفق</th><th style="padding:10px;text-align:center">الرصيد المتوقع</th>
            </tr></thead>
            <tbody>
                <tr style="background:#f4f6f8;font-weight:700"><td style="padding:9px 11px">رصيد افتتاحي</td><td></td><td></td><td></td><td style="padding:9px 11px;text-align:center">${fmt(cf.opening)}</td></tr>
                ${grouped.length ? grouped.map(r => `<tr style="border-bottom:1px solid #f0f0f0">
                    <td style="padding:9px 11px;font-weight:700">${r.label}</td>
                    <td style="padding:9px 11px;text-align:center;color:#27ae60;font-weight:700">${r.in ? fmt(r.in) : '-'}</td>
                    <td style="padding:9px 11px;text-align:center;color:#c0392b;font-weight:700">${r.out ? fmt(r.out) : '-'}</td>
                    <td style="padding:9px 11px;text-align:center;font-weight:700;color:${r.net >= 0 ? '#27ae60' : '#c0392b'}">${fmt(r.net)}</td>
                    <td style="padding:9px 11px;text-align:center;font-weight:900;color:${r.run < 0 ? '#c0392b' : '#1a3a5c'}">${fmt(r.run)}</td>
                </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:#999;padding:24px">أدخل بيانات الإيرادات والمصروفات لتظهر التدفقات</td></tr>`}
            </tbody>
            <tfoot><tr style="background:#1a3a5c;color:#fff;font-weight:900"><td style="padding:10px">الإجمالي</td><td style="padding:10px;text-align:center">${fmt(cf.totalIn)}</td><td style="padding:10px;text-align:center">${fmt(cf.totalOut)}</td><td style="padding:10px;text-align:center">${fmt(cf.totalIn - cf.totalOut)}</td><td style="padding:10px;text-align:center">${fmt(cf.closing)}</td></tr></tfoot>
        </table></div>
        <div style="font-size:11px;color:#888;margin-top:8px">💡 يطبّق السيناريو الحالي على التحصيلات والمواعيد. الرصيد المتوقع = الافتتاحي + صافي التدفقات التراكمي.</div>
    </div>
    ${fmScenarioCompare()}
    ${fmProvisionsPanel()}`;
}
// ── مقارنة السيناريوهات جنباً إلى جنب ──
function fmScenarioCompare() {
    const presets = [
        { id: 'opt', label: '🟢 تفاؤلي', sc: { pctAdj: 5, expAdj: -3, inDelay: -7, outDelay: 10 } },
        { id: 'base', label: '⚪ أساسي', sc: { pctAdj: 0, expAdj: 0, inDelay: 0, outDelay: 0 } },
        { id: 'pess', label: '🔴 متشائم', sc: { pctAdj: -20, expAdj: 10, inDelay: 30, outDelay: -5 } }
    ];
    const cols = presets.map(p => { const cf = fmCashflow(p.sc); const liq = fmLiquidity(cf); return { ...p, cf, liq }; });
    const row = (label, fn, fmtFn) => `<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:8px 10px;font-weight:700;color:#1a3a5c">${label}</td>${cols.map(c => `<td style="padding:8px 10px;text-align:center;font-weight:700">${(fmtFn || fmt)(fn(c))}</td>`).join('')}</tr>`;
    const colorClosing = v => `<span style="color:${v < 0 ? '#c0392b' : '#27ae60'}">${fmt(v)}</span>`;
    return `<div class="card" style="padding:14px;margin-top:14px">
        <div style="font-size:14px;font-weight:900;color:#5b2c6f;margin-bottom:10px">🎛️ مقارنة السيناريوهات جنباً إلى جنب</div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:520px">
            <thead><tr style="background:linear-gradient(135deg,#5b2c6f,#8e44ad);color:#fff"><th style="padding:9px;text-align:right">المؤشر</th>${cols.map(c => `<th style="padding:9px;text-align:center">${c.label}</th>`).join('')}</tr></thead>
            <tbody>
                ${row('الرصيد الختامي المتوقع', c => c.cf.closing, colorClosing)}
                ${row('أدنى رصيد متوقع', c => c.cf.minRun, colorClosing)}
                ${row('فجوة التمويل المطلوبة', c => c.liq.financingGap)}
                ${row('إجمالي التحصيلات', c => c.cf.totalIn)}
                ${row('إجمالي المدفوعات', c => c.cf.totalOut)}
                ${row('نسبة تغطية التدفقات', c => c.liq.coverage, v => v >= 999 ? '∞' : v.toFixed(2) + '×')}
            </tbody>
        </table></div>
        <div style="font-size:11px;color:#888;margin-top:8px">💡 يحسب الثلاثة دفعة واحدة دون تغيير سيناريوك الحالي بالأعلى.</div>
    </div>`;
}
// ── لوحة المخصّصات: المحتجزات والدفعات المقدمة + الضريبة والزكاة ──
function fmProvisionsPanel() {
    const stg = window.fmData.settings || {};
    const ret = fmRetentionSchedule(); const vat = fmVatSchedule();
    const totRet = ret.reduce((s, r) => s + r.retentionHeld, 0); const totAdv = ret.reduce((s, r) => s + Math.max(0, r.advanceOutstanding), 0);
    const totVatNet = vat.reduce((s, q) => s + q.net, 0);
    const sw = (field, label) => `<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;cursor:pointer;color:#1a3a5c"><input type="checkbox" ${stg[field] ? 'checked' : ''} onchange="fmToggleSetting('${field}')"> ${label}</label>`;
    const retRows = ret.length ? ret.map(r => `<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:7px 9px;font-weight:700">${fmEsc(r.name)}</td><td style="padding:7px 9px;text-align:left;direction:ltr;color:#c0392b;font-weight:700">${fmt(r.retentionHeld)}</td><td style="padding:7px 9px;text-align:center">${r.releaseMonth ? fmMonthLabel(r.releaseMonth) : '<span style="color:#e67e22">⚠️ لا تاريخ تسليم</span>'}</td><td style="padding:7px 9px;text-align:left;direction:ltr;color:#e67e22">${r.advanceOutstanding > 0 ? fmt(r.advanceOutstanding) : '—'}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#999;padding:18px">لا توجد محتجزات في المستخلصات المعتمدة</td></tr>';
    const vatRows = vat.length ? vat.map(q => `<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:7px 9px;font-weight:700">${q.label}</td><td style="padding:7px 9px;text-align:left;direction:ltr;color:#16a085">${fmt(q.output)}</td><td style="padding:7px 9px;text-align:left;direction:ltr;color:#c0392b">${fmt(q.input)}</td><td style="padding:7px 9px;text-align:left;direction:ltr;font-weight:800;color:${q.net >= 0 ? '#c0392b' : '#27ae60'}">${fmt(q.net)}</td><td style="padding:7px 9px;text-align:center">${q.settleMonth ? fmMonthLabel(q.settleMonth) : '—'}</td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:#999;padding:18px">لا توجد فواتير مرحّلة لاحتساب الضريبة</td></tr>';
    return `<div class="card" style="padding:14px;margin-top:14px">
        <div style="font-size:14px;font-weight:900;color:#0e6251;margin-bottom:6px">🔒 المحتجزات والدفعات المقدمة</div>
        <div style="background:#eef6f3;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#0e6655">${sw('includeRetention', 'إدراج تحرير المحتجزات في التدفق النقدي')} — يُجدول تحرير المحتجز عند (تاريخ التسليم النهائي + شهور الضمان) لكل مشروع. إجمالي المحتجز: <b>${fmt(totRet)}</b> · دفعات مقدمة غير مستردة: <b>${fmt(totAdv)}</b></div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:480px">
            <thead><tr style="background:#0e6251;color:#fff"><th style="padding:8px;text-align:right">المشروع</th><th style="padding:8px">المحتجز المحبوس</th><th style="padding:8px">شهر التحرير المتوقع</th><th style="padding:8px">دفعة مقدمة متبقية</th></tr></thead>
            <tbody>${retRows}</tbody>
        </table></div>
        <div style="font-size:14px;font-weight:900;color:#1a3a5c;margin:16px 0 6px">🧾 ضريبة القيمة المضافة والزكاة</div>
        <div style="background:#eaf2fb;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#1f618d;display:flex;flex-wrap:wrap;gap:14px;align-items:center">
            ${sw('includeVAT', 'إدراج صافي الضريبة كتدفق خارج (ربع سنوي)')}
            ${sw('includeZakat', 'إدراج الزكاة')}
            <span style="display:inline-flex;align-items:center;gap:5px">تقدير الزكاة السنوي <input type="number" step="0.01" value="${fmNum(stg.zakatEstimate) || ''}" onchange="fmSetSetting('zakatEstimate',this.value)" style="width:110px;padding:4px;border:1px solid #d0d7e0;border-radius:5px;text-align:left;direction:ltr"></span>
            <span style="display:inline-flex;align-items:center;gap:5px">شهر سداد الزكاة <input type="month" value="${stg.zakatMonth || (new Date().getFullYear() + '-12')}" onchange="fmSetSetting('zakatMonth',this.value)" style="padding:4px;border:1px solid #d0d7e0;border-radius:5px"></span>
        </div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:540px">
            <thead><tr style="background:#1a3a5c;color:#fff"><th style="padding:8px;text-align:right">الفترة الضريبية</th><th style="padding:8px">ضريبة المخرجات</th><th style="padding:8px">ضريبة المدخلات</th><th style="padding:8px">الصافي المستحق</th><th style="padding:8px">شهر السداد</th></tr></thead>
            <tbody>${vatRows}</tbody>
            <tfoot><tr style="background:#f0f5fa;font-weight:900;color:#1a3a5c"><td style="padding:8px">إجمالي صافي الضريبة</td><td colspan="2"></td><td style="padding:8px;text-align:left;direction:ltr;color:${totVatNet >= 0 ? '#c0392b' : '#27ae60'}">${fmt(totVatNet)}</td><td></td></tr></tfoot>
        </table></div>
        <div style="font-size:11px;color:#888;margin-top:8px">💡 ضريبة المخرجات من فواتير المبيعات المرحّلة، والمدخلات من فواتير المشتريات المرحّلة. الصافي الموجب = مستحق للهيئة، السالب = رصيد قابل للاسترداد.</div>
    </div>`;
}
window.fmSetOpening = function (v) { update(fmRef('settings'), { openingBalance: fmNum(v) }).then(fmSoftRefresh).catch(e => toast('❌ ' + (e.message || e), 'er')); };
window.fmSetSetting = function (field, v) {
    const val = (typeof v === 'boolean') ? v : (field === 'zakatMonth' ? v : fmNum(v));
    update(fmRef('settings'), { [field]: val }).then(fmSoftRefresh).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.fmToggleSetting = function (field) { update(fmRef('settings'), { [field]: !((window.fmData.settings || {})[field]) }).then(fmSoftRefresh).catch(e => toast('❌ ' + (e.message || e), 'er')); };

// ── 🔒 جدول المحتجزات والدفعات المقدمة (مشتق من المستخلصات المعتمدة) ──
function fmRetentionSchedule() {
    const byProj = {};
    Object.values(window.progressBillings || {}).forEach(b => {
        if (b.status !== 'approved' && b.status !== 'paid') return;
        const pid = b.projectId || ('_' + (b.projectName || 'بدون مشروع'));
        const o = byProj[pid] = byProj[pid] || { ret: 0, advRec: 0, name: b.projectName || '' };
        o.ret += fmNum(b.retentionAmount); o.advRec += fmNum(b.advanceRecoveryAmount);
    });
    return Object.entries(byProj).map(([pid, v]) => {
        const p = (window.projects || {})[pid] || {};
        const base = p.finalHandover || p.endDate || '';
        const releaseMonth = base ? fmShiftMonth(base, null, (fmNum(p.warrantyMonths) || 0) * 30) : '';
        const advTotal = fmNum(p.advancePayment);
        return { pid, name: p.name || v.name || 'بدون مشروع', retentionHeld: Math.round(v.ret * 100) / 100, releaseMonth, advanceTotal: advTotal, advanceOutstanding: Math.round((advTotal - v.advRec) * 100) / 100 };
    }).filter(r => r.retentionHeld > 0.5 || r.advanceOutstanding > 0.5);
}
// ── 🧾 جدول صافي ضريبة القيمة المضافة (ربع سنوي) ──
function fmVatSchedule() {
    const out = {}, inp = {};
    Object.values(window.salesInvoices || {}).forEach(inv => { if (inv.status !== 'posted') return; const m = (inv.date || '').slice(0, 7); if (m) out[m] = (out[m] || 0) + fmNum(inv.vatAmount); });
    Object.values(window.purchaseInvoices || {}).forEach(inv => { if (inv.status !== 'posted') return; const m = (inv.date || '').slice(0, 7); if (m) inp[m] = (inp[m] || 0) + fmNum(inv.vatAmount); });
    const q = {}; const addQ = (m, f, v) => { const [y, mo] = m.split('-'); const qq = y + '-Q' + (Math.floor((+mo - 1) / 3) + 1); (q[qq] = q[qq] || { out: 0, inp: 0 })[f] += v; };
    Object.entries(out).forEach(([m, v]) => addQ(m, 'out', v)); Object.entries(inp).forEach(([m, v]) => addQ(m, 'inp', v));
    return Object.keys(q).sort().map(qq => { const v = q[qq]; const net = Math.round((v.out - v.inp) * 100) / 100; const [y, qn] = qq.split('-Q'); const endMo = (+qn) * 3; const settleMonth = fmShiftMonth(y + '-' + String(endMo).padStart(2, '0') + '-28', null, 30); return { quarter: qq, label: 'الربع ' + qn + ' / ' + y, output: Math.round(v.out * 100) / 100, input: Math.round(v.inp * 100) / 100, net, settleMonth }; });
}

// ── فعلي مقابل متوقع (Variance) ─────────────────
// مصدر الفعلي: 'system' (تلقائي من سندات القبض/الصرف) أو 'manual' (إدخال يدوي)
window.fmSetActualMode = function (m) { window._fmState.actualMode = m; fmSoftRefresh(); };
window.fmSetActual = function (month, field, v) {
    if (!month) return;
    update(ref(db, FM_BASE + '/actuals/' + month), { [field]: fmNum(v), updatedAt: Date.now() }).then(fmSoftRefresh).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
function fmVariance() {
    const mode = window._fmState.actualMode || 'system';
    const cf = fmCashflow({ pctAdj: 0, inDelay: 0, outDelay: 0 }); // الخطة الأساسية
    const fMap = {}; cf.rows.forEach(r => fMap[r.m] = { fin: r.in, fout: r.out });
    const aIn = {}, aOut = {};
    if (mode === 'manual') {
        Object.entries(window.fmData.actuals || {}).forEach(([m, a]) => { if (!a) return; aIn[m] = fmNum(a.in); aOut[m] = fmNum(a.out); });
    } else {
        Object.values(window.receipts || {}).forEach(r => { if (r.status !== 'posted') return; const m = (r.date || '').slice(0, 7); if (m) aIn[m] = (aIn[m] || 0) + fmNum(r.amount); });
        Object.values(window.payments || {}).forEach(p => { if (p.status !== 'posted') return; const m = (p.date || '').slice(0, 7); if (m) aOut[m] = (aOut[m] || 0) + fmNum(p.amount); });
    }
    const months = [...new Set([...Object.keys(fMap), ...Object.keys(aIn), ...Object.keys(aOut)])].filter(Boolean).sort();
    const rows = months.map(m => { const fin = (fMap[m] || {}).fin || 0, fout = (fMap[m] || {}).fout || 0, ain = aIn[m] || 0, aout = aOut[m] || 0; return { m, fin, ain, fout, aout, inPct: fin > 0 ? Math.round(ain / fin * 100) : null, outPct: fout > 0 ? Math.round(aout / fout * 100) : null }; });
    rows.mode = mode; return rows;
}
function fmRenderVariance() {
    const rows = fmVariance(); const mode = rows.mode || 'system'; const manual = mode === 'manual';
    const tIn = rows.reduce((s, r) => s + r.fin, 0), tAin = rows.reduce((s, r) => s + r.ain, 0);
    const tOut = rows.reduce((s, r) => s + r.fout, 0), tAout = rows.reduce((s, r) => s + r.aout, 0);
    const achv = tIn > 0 ? Math.round(tAin / tIn * 100) : 0;
    const vcell = (a, f) => { const d = a - f; const c = d >= 0 ? '#27ae60' : '#c0392b'; return `<td style="padding:8px;text-align:center;font-weight:700;color:${c}">${d >= 0 ? '+' : ''}${fmt(d)}</td>`; };
    const mBtn = (id, l) => `<button onclick="fmSetActualMode('${id}')" style="${mode === id ? 'background:#1a3a5c;color:#fff' : 'background:#eef2f0;color:#1a3a5c'};border:none;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer">${l}</button>`;
    const ain = (m, v) => manual ? `<input type="number" step="0.01" value="${v || ''}" onchange="fmSetActual('${m}','in',this.value)" style="width:110px;padding:5px;border:1px solid #16a085;border-radius:5px;text-align:left;direction:ltr;font-weight:700;color:#16a085">` : `<span style="color:#16a085;font-weight:700">${fmt(v)}</span>`;
    const aout = (m, v) => manual ? `<input type="number" step="0.01" value="${v || ''}" onchange="fmSetActual('${m}','out',this.value)" style="width:110px;padding:5px;border:1px solid #c0392b;border-radius:5px;text-align:left;direction:ltr;font-weight:700;color:#c0392b">` : `<span style="color:#c0392b;font-weight:700">${fmt(v)}</span>`;
    return `<div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
            <div style="font-size:15px;font-weight:900;color:#1a3a5c">📐 فعلي مقابل متوقع (Variance)</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <span style="font-size:11px;color:#666">مصدر الفعلي:</span>${mBtn('system', '🔗 من النظام')} ${mBtn('manual', '✍️ يدوي')}
                <button class="btn" onclick="fmPrintVariance()" style="background:#1a3a5c;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">🖨️ طباعة</button>
            </div>
        </div>
        ${manual ? '<div style="background:#fff8e1;border-right:4px solid #f39c12;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#7d6608;font-weight:700">✍️ وضع الإدخال اليدوي: اكتب القيم الفعلية لكل شهر في الخلايا الخضراء/الحمراء، وستُقارن تلقائياً بالمخطط. تُحفظ فوراً.</div>' : '<div style="background:#eafaf3;border-right:4px solid #16a085;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#0e6655;font-weight:700">🔗 وضع النظام: الفعلي يُقرأ تلقائياً من سندات القبض (تحصيلات) وسندات الصرف (مدفوعات) المرحّلة.</div>'}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px">
            <div style="background:#eafaf3;border-radius:10px;padding:10px;text-align:center"><div style="font-size:11px;color:#0e6655">تحصيلات: متوقع</div><div style="font-size:15px;font-weight:900;color:#16a085">${fmt(tIn)}</div></div>
            <div style="background:#eafaf3;border-radius:10px;padding:10px;text-align:center"><div style="font-size:11px;color:#0e6655">تحصيلات: فعلي</div><div style="font-size:15px;font-weight:900;color:#16a085">${fmt(tAin)}</div></div>
            <div style="background:#fdecea;border-radius:10px;padding:10px;text-align:center"><div style="font-size:11px;color:#922b21">مدفوعات: متوقع</div><div style="font-size:15px;font-weight:900;color:#c0392b">${fmt(tOut)}</div></div>
            <div style="background:#fdecea;border-radius:10px;padding:10px;text-align:center"><div style="font-size:11px;color:#922b21">مدفوعات: فعلي</div><div style="font-size:15px;font-weight:900;color:#c0392b">${fmt(tAout)}</div></div>
            <div style="background:#eaf2fb;border-radius:10px;padding:10px;text-align:center"><div style="font-size:11px;color:#1f618d">نسبة إنجاز التحصيل</div><div style="font-size:15px;font-weight:900;color:${achv >= 90 ? '#27ae60' : achv >= 60 ? '#f39c12' : '#c0392b'}">${achv}%</div></div>
        </div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:760px">
            <thead><tr style="background:linear-gradient(135deg,#1a3a5c,#2c3e50);color:#fff">
                <th style="padding:9px;text-align:right">الشهر</th><th style="padding:9px;text-align:center">تحصيل متوقع</th><th style="padding:9px;text-align:center">تحصيل فعلي</th><th style="padding:9px;text-align:center">انحراف</th><th style="padding:9px;text-align:center">إنجاز%</th><th style="padding:9px;text-align:center">سداد متوقع</th><th style="padding:9px;text-align:center">سداد فعلي</th><th style="padding:9px;text-align:center">انحراف</th>
            </tr></thead>
            <tbody>${rows.length ? rows.map(r => `<tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:8px;font-weight:700">${fmMonthLabel(r.m)}</td>
                <td style="padding:8px;text-align:center">${fmt(r.fin)}</td><td style="padding:8px;text-align:center">${ain(r.m, r.ain)}</td>${vcell(r.ain, r.fin)}
                <td style="padding:8px;text-align:center;font-weight:700;color:${r.inPct == null ? '#999' : r.inPct >= 90 ? '#27ae60' : r.inPct >= 60 ? '#f39c12' : '#c0392b'}">${r.inPct == null ? '—' : r.inPct + '%'}</td>
                <td style="padding:8px;text-align:center">${fmt(r.fout)}</td><td style="padding:8px;text-align:center">${aout(r.m, r.aout)}</td>${vcell(r.aout, r.fout)}
            </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;color:#999;padding:24px">لا توجد بيانات — أدخل الخطة أولاً، ثم اختر مصدر الفعلي (يدوي أو من النظام)</td></tr>`}</tbody>
        </table></div>
        <div style="font-size:11px;color:#888;margin-top:8px">💡 الانحراف الموجب في التحصيل لصالحك (حصّلت أكثر من المخطط)، وفي السداد يعني صرفاً أعلى من المخطط. «إنجاز%» = الفعلي ÷ المتوقع للتحصيل.</div>
    </div>`;
}
window.fmPrintVariance = function () {
    const rows = fmVariance();
    const inner = `<table><thead><tr><th>الشهر</th><th>تحصيل متوقع</th><th>تحصيل فعلي</th><th>انحراف</th><th>إنجاز%</th><th>سداد متوقع</th><th>سداد فعلي</th><th>انحراف</th></tr></thead><tbody>${rows.map(r => `<tr><td>${fmMonthLabel(r.m)}</td><td style="text-align:left">${fmt(r.fin)}</td><td style="text-align:left">${fmt(r.ain)}</td><td style="text-align:left">${fmt(r.ain - r.fin)}</td><td style="text-align:center">${r.inPct == null ? '—' : r.inPct + '%'}</td><td style="text-align:left">${fmt(r.fout)}</td><td style="text-align:left">${fmt(r.aout)}</td><td style="text-align:left">${fmt(r.aout - r.fout)}</td></tr>`).join('')}</tbody></table>`;
    fmPrintHtml('فعلي مقابل متوقع — تحليل الانحرافات', inner);
};

// ── نسخ الموازنة (Baselines) ─────────────────
window.fmSaveBaseline = function () {
    const label = prompt('📌 اسم نسخة الموازنة:', 'موازنة ' + new Date().toISOString().slice(0, 7));
    if (!label) return;
    const snap = { label: label.trim(), date: new Date().toISOString(), revenue: window.fmData.revenue || {}, expenses: window.fmData.expenses || {}, collections: window.fmData.collections || {}, payments: window.fmData.payments || {}, opening: fmNum((window.fmData.settings || {}).openingBalance) };
    push(fmRef('baselines'), snap).then(() => toast('✅ حُفظت نسخة الموازنة', 'ok')).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.fmCompareBaseline = function (key) { window._fmState.cmpBaseline = key; fmSoftRefresh(); };
window.fmDeleteBaseline = function (key) { if (!confirm('حذف نسخة الموازنة؟')) return; remove(ref(db, FM_BASE + '/baselines/' + key)).catch(e => toast('❌ ' + (e.message || e), 'er')); };
function fmBaselineTotals(bl) {
    const rev = Object.values(bl.revenue || {}).reduce((s, r) => s + fmRevExpected(r), 0);
    const exp = Object.values(bl.expenses || {}).reduce((s, r) => s + fmNum(r.amount), 0);
    const col = Object.values(bl.collections || {}).reduce((s, r) => s + fmNum(r.amount), 0);
    const pay = Object.values(bl.payments || {}).reduce((s, r) => s + fmNum(r.amount), 0);
    return { rev, exp, col, pay, totalIn: rev + col, totalOut: exp + pay };
}

// ── اللوحة المجمّعة ─────────────────
function fmRenderDashboard() {
    const cf = fmCashflow();
    const revTotal = fmList('revenue').reduce((s, r) => s + fmRevExpected(r), 0);
    const expByCat = {};
    fmList('expenses').forEach(r => { const k = r.category || 'fixed'; expByCat[k] = (expByCat[k] || 0) + fmNum(r.amount); });
    const expTotal = Object.values(expByCat).reduce((s, v) => s + v, 0);
    const colTotal = fmList('collections').reduce((s, r) => s + fmNum(r.amount), 0);
    const payTotal = fmList('payments').reduce((s, r) => s + fmNum(r.amount), 0);
    const totalIn = revTotal + colTotal, totalOut = expTotal + payTotal;
    const kpi = (l, v, c, ic) => `<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);border-bottom:3px solid ${c}"><div style="font-size:11px;color:#666">${ic} ${l}</div><div style="font-size:19px;font-weight:900;color:${c};margin-top:3px">${fmt(v)}</div></div>`;
    window._fmChartData = { months: cf.rows.map(r => fmMonthLabel(r.m)), inn: cf.rows.map(r => r.in), out: cf.rows.map(r => r.out), run: cf.rows.map(r => r.run), expCat: expByCat };
    setTimeout(fmDrawCharts, 60);
    return `
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
            <input id="fmGSearch" oninput="fmGlobalSearch(this.value)" placeholder="🔍 بحث شامل في كل النماذج (إيرادات، مصروفات، تحصيل، سداد)…" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d0d7e0;border-radius:9px;font-family:inherit;font-size:13px">
            <div id="fmGSResults" style="margin-top:8px"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">
            ${kpi('الرصيد الافتتاحي', cf.opening, '#1a3a5c', '💰')}
            ${kpi('إجمالي التحصيلات المتوقعة', totalIn, '#16a085', '⬇️')}
            ${kpi('إجمالي المدفوعات المتوقعة', totalOut, '#c0392b', '⬆️')}
            ${kpi('صافي التدفق', totalIn - totalOut, (totalIn - totalOut) >= 0 ? '#27ae60' : '#c0392b', '🔄')}
            ${kpi('الرصيد الختامي المتوقع', cf.closing, cf.closing >= 0 ? '#2d6a9f' : '#c0392b', '🏁')}
            ${kpi('أدنى رصيد متوقع', cf.minRun, cf.minRun < 0 ? '#c0392b' : '#27ae60', cf.minRun < 0 ? '⚠️' : '✅')}
        </div>
        ${cf.minRun < 0 ? `<div style="background:#fdecea;border-right:4px solid #c0392b;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#922b21;font-weight:700">⚠️ تحذير سيولة: السيولة المتوقعة تصبح سالبة (${fmt(cf.minRun)}). يلزم تسريع التحصيل أو تأجيل المدفوعات.</div>` : ''}
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
            <div class="card" style="padding:14px"><div style="font-weight:800;color:#1a3a5c;margin-bottom:8px">📈 التدفق النقدي الشهري</div><canvas id="fmChartFlow" height="200"></canvas></div>
            <div class="card" style="padding:14px"><div style="font-weight:800;color:#1a3a5c;margin-bottom:8px">💸 المصروفات حسب الفئة</div><canvas id="fmChartExp" height="200"></canvas></div>
        </div>
        <div class="card" style="padding:14px;margin-bottom:14px">
            <div style="font-weight:800;color:#1a3a5c;margin-bottom:10px">📋 ملخّص النماذج</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
                ${(() => { const palette = ['#8e44ad', '#e67e22', '#d35400', '#16a085', '#c0392b', '#2980b9', '#7f8c8d']; const catCards = Object.entries(expByCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v], i) => [fmCatLabel(k), v, palette[i % palette.length], 'expenses']); return [['💰 الإيرادات المتوقعة (المستخلصات)', revTotal, '#16a085', 'revenue'], ...catCards, ['🤝 دفعات التحصيل', colTotal, '#2d6a9f', 'collections'], ['🏢 دفعات السداد', payTotal, '#c0392b', 'payments']].map(([l, v, c, t]) => `<div onclick="fmTab('${t}')" style="cursor:pointer;background:#f8fafc;border-radius:10px;padding:11px;border-right:4px solid ${c}"><div style="font-size:11px;color:#666">${l}</div><div style="font-size:16px;font-weight:900;color:${c}">${fmt(v)}</div></div>`).join(''); })()}
            </div>
        </div>
        ${fmRenderBaselinePanel(totalIn, totalOut)}`;
}
// لوحة مقارنة نسخ الموازنة
function fmRenderBaselinePanel(curIn, curOut) {
    const bls = Object.entries(window.fmData.baselines || {});
    const opts = bls.map(([k, b]) => `<option value="${k}" ${window._fmState.cmpBaseline === k ? 'selected' : ''}>${fmEsc(b.label)} (${(b.date || '').slice(0, 10)})</option>`).join('');
    let cmp = '';
    const selKey = window._fmState.cmpBaseline; const bl = selKey && window.fmData.baselines ? window.fmData.baselines[selKey] : null;
    if (bl) {
        const bt = fmBaselineTotals(bl);
        const vr = (cur, base, good) => { const d = cur - base; const pct = base ? Math.round(d / base * 100) : 0; const fav = good === 'up' ? d >= 0 : d <= 0; return `<span style="color:${fav ? '#27ae60' : '#c0392b'};font-weight:700">${d >= 0 ? '+' : ''}${fmt(d)} (${pct >= 0 ? '+' : ''}${pct}%)</span>`; };
        cmp = `<div style="overflow-x:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:520px">
            <thead><tr style="background:#0e6251;color:#fff"><th style="padding:8px;text-align:right">البند</th><th style="padding:8px;text-align:center">النسخة المحفوظة</th><th style="padding:8px;text-align:center">الحالي</th><th style="padding:8px;text-align:center">الفرق</th></tr></thead>
            <tbody>
                <tr style="border-bottom:1px solid #eee"><td style="padding:8px">إجمالي التحصيلات المتوقعة</td><td style="padding:8px;text-align:center">${fmt(bt.totalIn)}</td><td style="padding:8px;text-align:center">${fmt(curIn)}</td><td style="padding:8px;text-align:center">${vr(curIn, bt.totalIn, 'up')}</td></tr>
                <tr style="border-bottom:1px solid #eee"><td style="padding:8px">إجمالي المدفوعات المتوقعة</td><td style="padding:8px;text-align:center">${fmt(bt.totalOut)}</td><td style="padding:8px;text-align:center">${fmt(curOut)}</td><td style="padding:8px;text-align:center">${vr(curOut, bt.totalOut, 'down')}</td></tr>
                <tr style="font-weight:800;background:#f4f6f8"><td style="padding:8px">صافي التدفق</td><td style="padding:8px;text-align:center">${fmt(bt.totalIn - bt.totalOut)}</td><td style="padding:8px;text-align:center">${fmt(curIn - curOut)}</td><td style="padding:8px;text-align:center">${vr(curIn - curOut, bt.totalIn - bt.totalOut, 'up')}</td></tr>
            </tbody></table></div>
            <button class="btn" onclick="fmDeleteBaseline('${selKey}')" style="background:#fdecea;color:#c0392b;padding:5px 12px;font-size:11px;margin-top:8px">🗑️ حذف هذه النسخة</button>`;
    }
    return `<div class="card" style="padding:14px;margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div style="font-weight:800;color:#1a3a5c">🧭 مقارنة بنسخة موازنة محفوظة (Baseline)</div>
            <div style="display:flex;gap:6px;align-items:center">
                <select onchange="fmCompareBaseline(this.value)" style="padding:6px;border:1px solid #d0d7e0;border-radius:6px;font-size:12px"><option value="">— اختر نسخة للمقارنة —</option>${opts}</select>
                <button class="btn" onclick="fmSaveBaseline()" style="background:#0e6251;color:#fff;padding:6px 12px;font-size:12px;font-weight:700">💾 حفظ النسخة الحالية</button>
            </div>
        </div>
        ${bls.length ? cmp : '<div style="font-size:12px;color:#999;margin-top:8px">لا توجد نسخ محفوظة بعد — احفظ النسخة الحالية كموازنة أساس لتقارن بها لاحقاً.</div>'}
    </div>`;
}
window._fmCharts = window._fmCharts || {};
function fmDrawCharts() {
    if (!window.Chart) return; Object.values(window._fmCharts).forEach(c => { try { c.destroy(); } catch (e) { } }); window._fmCharts = {};
    const d = window._fmChartData || {}; const mk = (id, cfg) => { const el = document.getElementById(id); if (el) window._fmCharts[id] = new Chart(el, cfg); };
    Chart.defaults.font.family = "'Segoe UI',Tahoma,sans-serif";
    mk('fmChartFlow', { type: 'bar', data: { labels: d.months || [], datasets: [{ type: 'bar', label: 'تحصيلات', data: d.inn || [], backgroundColor: '#16a085' }, { type: 'bar', label: 'مدفوعات', data: d.out || [], backgroundColor: '#c0392b' }, { type: 'line', label: 'الرصيد المتوقع', data: d.run || [], borderColor: '#2d6a9f', backgroundColor: 'rgba(45,106,159,.12)', fill: true, tension: .35 }] }, options: { plugins: { legend: { position: 'bottom', rtl: true, labels: { font: { size: 10 } } } }, scales: { y: { beginAtZero: true } } } });
    const ec = d.expCat || {}; const ecE = Object.entries(ec).filter(([, v]) => v > 0); const pal = ['#8e44ad', '#e67e22', '#d35400', '#16a085', '#c0392b', '#2980b9', '#7f8c8d'];
    mk('fmChartExp', { type: 'doughnut', data: { labels: ecE.map(([k]) => fmCatLabel(k)), datasets: [{ data: ecE.map(([, v]) => v), backgroundColor: ecE.map((_, i) => pal[i % pal.length]) }] }, options: { plugins: { legend: { position: 'bottom', rtl: true, labels: { font: { size: 10 } } } } } });
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   📅  الموازنة التقديرية السنوية (الفئة × 12 شهر) — طبقة مستقلة معتمدة        ║
// ║   + موازنة مقابل فعلي حسب الفئة + YTD + تنبؤ متجدّد لنهاية السنة + رسوم        ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function fmBudgetYear() { return window._fmState.budgetYear || String(new Date().getFullYear()); }
function fmBudgetYearData(y) { return (window.fmData.budget || {})[y || fmBudgetYear()] || {}; }
function fmBudgetLocked() { const m = fmBudgetYearData()._meta; return !!(m && m.locked); }
// بنود الموازنة: سطر الإيرادات + فئات المصروفات (المدمجة + المخصّصة)
function fmBudgetLineDefs() {
    return [{ key: '_rev', label: '💰 الإيرادات', kind: 'in' },
    ...Object.entries(fmAllExpCats()).map(([k, v]) => ({ key: k, label: v, kind: 'out' }))];
}
function fmBudgetMonths(lineKey, y) { const d = fmBudgetYearData(y)[lineKey] || {}; const m = d.months || {}; const arr = []; for (let i = 0; i < 12; i++) arr.push(fmNum(m[i])); return arr; }
function fmBudgetRowTotal(lineKey, y) { return fmBudgetMonths(lineKey, y).reduce((s, v) => s + v, 0); }
// الفعلي المسجّل (حقل «الفعلي» في جداول الإيراد/المصروف) موزّعاً على البنود والأشهر لسنة معيّنة
function fmBudgetActualsForYear(y) {
    const out = {}; const add = (lk, mi, v) => { if (mi < 0 || mi > 11 || !v) return; (out[lk] = out[lk] || {})[mi] = (out[lk][mi] || 0) + v; };
    Object.values(window.fmData.revenue || {}).forEach(r => { const ym = (r.collectionDate || r.month || '').slice(0, 7); if (ym.slice(0, 4) !== y) return; add('_rev', (+ym.slice(5, 7)) - 1, fmNum(r.actual)); });
    Object.values(window.fmData.expenses || {}).forEach(r => { const ym = (r.dueDate || r.month || '').slice(0, 7); if (ym.slice(0, 4) !== y) return; add(r.category || 'fixed', (+ym.slice(5, 7)) - 1, fmNum(r.actual)); });
    return out;
}
function fmBudgetActualMonths(lineKey, y) { const a = (fmBudgetActualsForYear(y || fmBudgetYear())[lineKey]) || {}; const arr = []; for (let i = 0; i < 12; i++) arr.push(fmNum(a[i])); return arr; }

window.fmBudgetSetYear = function (y) { window._fmState.budgetYear = String(y); fmSoftRefresh(); };
window.fmBudgetSetCell = function (lineKey, mi, v) {
    if (fmBudgetLocked()) { toast('🔒 الموازنة معتمدة ومقفلة — ألغِ القفل للتعديل', 'wn'); fmSoftRefresh(); return; }
    update(ref(db, FM_BASE + '/budget/' + fmBudgetYear() + '/' + lineKey + '/months'), { [mi]: fmNum(v) })
        .then(() => update(ref(db, FM_BASE + '/budget/' + fmBudgetYear() + '/' + lineKey), { updatedAt: Date.now() }))
        .then(fmSoftRefresh).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.fmBudgetToggleLock = function () {
    const locked = fmBudgetLocked();
    if (!locked && !confirm('اعتماد وقفل موازنة سنة ' + fmBudgetYear() + '؟ لن تُعدَّل الخلايا حتى يُلغى القفل.')) return;
    update(ref(db, FM_BASE + '/budget/' + fmBudgetYear() + '/_meta'), { locked: !locked, lockedAt: Date.now(), lockedBy: (window.curU && (window.curU.name || window.curU.email)) || '' })
        .then(() => toast(locked ? '🔓 أُلغي قفل الموازنة' : '🔒 اعتُمدت الموازنة وقُفلت', 'ok')).then(fmSoftRefresh).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
// توزيع مبلغ سنوي على 12 شهراً وفق طريقة
function fmBudgetSpread(annual, method, growthPct, lineKey) {
    annual = fmNum(annual); const arr = new Array(12).fill(0);
    if (method === 'growth') {
        const g = fmNum(growthPct) / 100; let w = [], sw = 0; for (let i = 0; i < 12; i++) { const x = Math.pow(1 + g, i); w.push(x); sw += x; }
        for (let i = 0; i < 12; i++) arr[i] = Math.round(annual * w[i] / sw * 100) / 100;
    } else if (method === 'copy') {
        const py = String((+fmBudgetYear()) - 1); const pm = fmBudgetActualMonths(lineKey, py); const sw = pm.reduce((s, v) => s + v, 0);
        if (sw > 0) { for (let i = 0; i < 12; i++) arr[i] = Math.round(annual * pm[i] / sw * 100) / 100; }
        else { for (let i = 0; i < 12; i++) arr[i] = Math.round(annual / 12 * 100) / 100; }
    } else { for (let i = 0; i < 12; i++) arr[i] = Math.round(annual / 12 * 100) / 100; }
    return arr;
}
window.fmBudgetDistribute = function (lineKey) {
    if (fmBudgetLocked()) { toast('🔒 الموازنة معتمدة ومقفلة', 'wn'); return; }
    const def = fmBudgetLineDefs().find(d => d.key === lineKey); if (!def) return;
    document.getElementById('taskEditorOverlay')?.remove();
    const ov = document.createElement('div'); ov.id = 'taskEditorOverlay';
    ov.style = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9992;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px';
    ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="background:linear-gradient(135deg,#0e6251,#16a085);color:#fff;padding:14px 18px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:900">📐 توزيع موازنة: ${fmEsc(def.label)}</div><button onclick="document.getElementById('taskEditorOverlay').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:7px;cursor:pointer">✖</button></div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
            <div><label style="font-size:12px;color:#666;font-weight:700">المبلغ السنوي الإجمالي</label><input id="fmBdAnnual" type="number" step="0.01" value="${fmBudgetRowTotal(lineKey) || ''}" style="width:100%;box-sizing:border-box;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;text-align:left;direction:ltr;font-weight:700;margin-top:4px"></div>
            <div><label style="font-size:12px;color:#666;font-weight:700">طريقة التوزيع</label>
                <select id="fmBdMethod" onchange="document.getElementById('fmBdGrowthWrap').style.display=this.value==='growth'?'block':'none'" style="width:100%;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;margin-top:4px;font-family:inherit">
                    <option value="even">↔️ متساوٍ على 12 شهراً</option>
                    <option value="growth">📈 نمو شهري بنسبة %</option>
                    <option value="copy">🔁 حسب فعلي العام السابق (${(+fmBudgetYear()) - 1})</option>
                </select></div>
            <div id="fmBdGrowthWrap" style="display:none"><label style="font-size:12px;color:#666;font-weight:700">نسبة النمو الشهري %</label><input id="fmBdGrowth" type="number" step="0.1" value="2" style="width:100%;box-sizing:border-box;padding:9px;border:1.5px solid #d0d7e0;border-radius:8px;text-align:left;direction:ltr;margin-top:4px"></div>
            <button class="btn" onclick="fmBudgetApplyDistribute('${lineKey}')" style="background:#16a34a;color:#fff;padding:10px;font-weight:800">✅ توزيع وحفظ</button>
        </div></div>`;
    document.body.appendChild(ov);
};
window.fmBudgetApplyDistribute = function (lineKey) {
    const annual = document.getElementById('fmBdAnnual')?.value;
    const method = document.getElementById('fmBdMethod')?.value || 'even';
    const growth = document.getElementById('fmBdGrowth')?.value || 0;
    const arr = fmBudgetSpread(annual, method, growth, lineKey);
    const months = {}; arr.forEach((v, i) => months[i] = v);
    update(ref(db, FM_BASE + '/budget/' + fmBudgetYear() + '/' + lineKey), { months, dist: method, annualInput: fmNum(annual), growthPct: fmNum(growth), updatedAt: Date.now() })
        .then(() => { document.getElementById('taskEditorOverlay')?.remove(); toast('✅ وُزّعت الموازنة', 'ok'); fmSoftRefresh(); })
        .catch(e => toast('❌ ' + (e.message || e), 'er'));
};
// تحليل الموازنة مقابل الفعلي + YTD + تنبؤ نهاية السنة
function fmBudgetAnalysis() {
    const y = fmBudgetYear(); const yr = +y; const now = new Date();
    const curY = now.getFullYear(); const ytdLast = yr < curY ? 11 : yr > curY ? -1 : now.getMonth();
    return fmBudgetLineDefs().map(d => {
        const bm = fmBudgetMonths(d.key, y); const am = fmBudgetActualMonths(d.key, y);
        const budget = bm.reduce((s, v) => s + v, 0);
        const ytdBudget = bm.reduce((s, v, i) => s + (i <= ytdLast ? v : 0), 0);
        const ytdActual = am.reduce((s, v, i) => s + (i <= ytdLast ? v : 0), 0);
        const remBudget = bm.reduce((s, v, i) => s + (i > ytdLast ? v : 0), 0);
        const forecast = ytdActual + remBudget; // تنبؤ متجدّد
        return { ...d, budget, ytdBudget, ytdActual, remBudget, forecast, ytdVar: ytdActual - ytdBudget, fcVar: forecast - budget, achv: ytdBudget > 0 ? Math.round(ytdActual / ytdBudget * 100) : null };
    });
}
function fmRenderBudget() {
    const y = fmBudgetYear(); const locked = fmBudgetLocked(); const lines = fmBudgetLineDefs();
    const curY = new Date().getFullYear(); const years = []; for (let i = -1; i <= 2; i++) years.push(String(curY + i));
    if (!years.includes(y)) years.push(y);
    const colTot = new Array(12).fill(0); const actTot = new Array(12).fill(0);
    lines.forEach(d => { const bm = fmBudgetMonths(d.key, y); const am = fmBudgetActualMonths(d.key, y); const sgn = d.kind === 'in' ? 1 : -1; bm.forEach((v, i) => colTot[i] += sgn * v); am.forEach((v, i) => actTot[i] += sgn * v); });
    const grand = colTot.reduce((s, v) => s + v, 0);
    const cellInput = (d, i, v) => locked
        ? `<td style="padding:5px 4px;text-align:left;direction:ltr;font-size:11.5px;${v ? '' : 'color:#bbb'}">${v ? fmt(v) : '—'}</td>`
        : `<td style="padding:2px"><input type="number" step="0.01" value="${v || ''}" onchange="fmBudgetSetCell('${d.key}',${i},this.value)" style="width:78px;padding:4px;border:1px solid #e0e6ee;border-radius:4px;text-align:left;direction:ltr;font-size:11px"></td>`;
    const head = `<th style="padding:8px 6px;text-align:right;color:#fff;position:sticky;right:0;background:#0e6251;min-width:150px">البند</th>` + FM_MONTHS_AR.map(m => `<th style="padding:8px 4px;color:#fff;font-size:10.5px;min-width:78px">${m}</th>`).join('') + `<th style="padding:8px 6px;color:#fff;background:#0a4a3e;min-width:95px">الإجمالي</th>${locked ? '' : '<th style="padding:8px;color:#fff">⚙️</th>'}`;
    const body = lines.map(d => {
        const bm = fmBudgetMonths(d.key, y); const tot = bm.reduce((s, v) => s + v, 0);
        return `<tr style="border-bottom:1px solid #eef2f5;${d.kind === 'in' ? 'background:#f3fbf8' : ''}">
            <td style="padding:6px 8px;font-weight:700;color:${d.kind === 'in' ? '#0e6251' : '#1a3a5c'};position:sticky;right:0;background:${d.kind === 'in' ? '#eafaf3' : '#fff'};font-size:12px">${fmEsc(d.label)}</td>
            ${bm.map((v, i) => cellInput(d, i, v)).join('')}
            <td style="padding:6px;text-align:left;direction:ltr;font-weight:900;color:${d.kind === 'in' ? '#16a085' : '#c0392b'};background:#f7faf9">${fmt(tot)}</td>
            ${locked ? '' : `<td style="padding:4px;text-align:center"><button onclick="fmBudgetDistribute('${d.key}')" title="توزيع مبلغ سنوي" style="background:#eaf2fb;color:#2d6a9f;border:none;border-radius:5px;padding:5px 7px;cursor:pointer;font-size:11px">📐</button></td>`}
        </tr>`;
    }).join('');
    const foot = `<td style="padding:8px;font-weight:900;color:#fff;position:sticky;right:0;background:#1a3a5c">صافي الموازنة</td>` + colTot.map(v => `<td style="padding:8px 4px;text-align:left;direction:ltr;font-weight:800;color:${v >= 0 ? '#27ae60' : '#ffb4a8'}">${fmt(v)}</td>`).join('') + `<td style="padding:8px;text-align:left;direction:ltr;font-weight:900;color:${grand >= 0 ? '#7CFFCB' : '#ffb4a8'}">${fmt(grand)}</td>${locked ? '' : '<td></td>'}`;
    const grid = `<div class="card" style="padding:14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div style="font-size:15px;font-weight:900;color:#0e6251">📅 شبكة الموازنة التقديرية السنوية ${locked ? '<span style="background:#fdecea;color:#c0392b;border-radius:6px;padding:2px 8px;font-size:11px">🔒 معتمدة</span>' : ''}</div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <label style="font-size:12px;color:#666">السنة</label>
                <select onchange="fmBudgetSetYear(this.value)" style="padding:6px 10px;border:1px solid #d0d7e0;border-radius:7px;font-weight:700">${years.sort().map(yy => `<option value="${yy}" ${yy === y ? 'selected' : ''}>${yy}</option>`).join('')}</select>
                <button class="btn" onclick="fmBudgetToggleLock()" style="background:${locked ? '#7f8c8d' : '#0e6251'};color:#fff;padding:7px 13px;font-size:12px;font-weight:700">${locked ? '🔓 إلغاء الاعتماد' : '🔒 اعتماد وقفل'}</button>
                <button class="btn" onclick="fmExportBudget()" style="background:#1d6f42;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📊 تصدير</button>
                <button class="btn" onclick="fmPrintBudget()" style="background:#1a3a5c;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">🖨️ طباعة</button>
            </div>
        </div>
        <div style="background:#eef6f3;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#0e6655">💡 أدخل القيمة الشهرية مباشرة، أو اضغط 📐 لإدخال مبلغ سنوي وتوزيعه تلقائياً (متساوٍ / نمو% / حسب فعلي العام السابق). «اعتماد وقفل» يثبّت الموازنة كهدف رسمي.</div>
        <div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:11.5px;width:100%;min-width:1100px">
            <thead><tr style="background:linear-gradient(135deg,#0e6251,#16a085)">${head}</tr></thead>
            <tbody>${body}</tbody>
            <tfoot><tr style="background:#1a3a5c;color:#fff">${foot}</tr></tfoot>
        </table></div>
    </div>`;
    // ── تحليل الموازنة مقابل الفعلي + التنبؤ ──
    const an = fmBudgetAnalysis();
    const tBudget = an.reduce((s, r) => s + (r.kind === 'in' ? r.budget : 0), 0) - an.reduce((s, r) => s + (r.kind === 'out' ? r.budget : 0), 0);
    const tFc = an.reduce((s, r) => s + (r.kind === 'in' ? r.forecast : 0), 0) - an.reduce((s, r) => s + (r.kind === 'out' ? r.forecast : 0), 0);
    const arow = r => {
        const overspend = r.kind === 'out' && r.fcVar > 0; const underrev = r.kind === 'in' && r.fcVar < 0;
        const fcCol = (overspend || underrev) ? '#c0392b' : '#27ae60';
        const ytdBad = r.kind === 'out' ? r.ytdVar > 0 : r.ytdVar < 0; const ytdCol = r.ytdVar === 0 ? '#666' : (ytdBad ? '#c0392b' : '#27ae60');
        const ac = r.achv == null ? '#999' : (r.kind === 'out' ? (r.achv > 105 ? '#c0392b' : r.achv > 90 ? '#f39c12' : '#27ae60') : (r.achv >= 90 ? '#27ae60' : r.achv >= 60 ? '#f39c12' : '#c0392b'));
        return `<tr style="border-bottom:1px solid #f0f0f0;${r.kind === 'in' ? 'background:#f3fbf8' : ''}">
            <td style="padding:7px 8px;font-weight:700;color:${r.kind === 'in' ? '#0e6251' : '#1a3a5c'}">${fmEsc(r.label)}</td>
            <td style="padding:7px;text-align:left;direction:ltr">${fmt(r.budget)}</td>
            <td style="padding:7px;text-align:left;direction:ltr;color:#777">${fmt(r.ytdBudget)}</td>
            <td style="padding:7px;text-align:left;direction:ltr;font-weight:700">${fmt(r.ytdActual)}</td>
            <td style="padding:7px;text-align:left;direction:ltr;font-weight:700;color:${ytdCol}">${r.ytdVar >= 0 ? '+' : ''}${fmt(r.ytdVar)}</td>
            <td style="padding:7px;text-align:center;font-weight:800;color:${ac}">${r.achv == null ? '—' : r.achv + '%'}</td>
            <td style="padding:7px;text-align:left;direction:ltr;font-weight:800;color:#1a3a5c">${fmt(r.forecast)}</td>
            <td style="padding:7px;text-align:left;direction:ltr;font-weight:800;color:${fcCol}">${r.fcVar >= 0 ? '+' : ''}${fmt(r.fcVar)}</td>
        </tr>`;
    };
    window._fmBudgetChart = { labels: an.map(r => r.label), budget: an.map(r => r.budget), forecast: an.map(r => r.forecast), kinds: an.map(r => r.kind), revLine: an.find(r => r.key === '_rev') };
    setTimeout(fmDrawBudgetCharts, 60);
    const analysis = `<div class="card" style="padding:14px;margin-bottom:14px">
        <div style="font-size:15px;font-weight:900;color:#1a3a5c;margin-bottom:6px">📐 الموازنة مقابل الفعلي والتنبؤ بنهاية السنة (${y})</div>
        <div style="background:#eaf2fb;border-right:4px solid #2d6a9f;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#1f618d">🔗 «الفعلي» يُقرأ من حقل الفعلي في جدولي الإيرادات والمصروفات (التبويبان 💰 و💸) حسب الفئة والشهر. «التنبؤ» = الفعلي حتى الشهر الحالي + موازنة الأشهر المتبقية.</div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:820px">
            <thead><tr style="background:linear-gradient(135deg,#1a3a5c,#2c3e50);color:#fff">
                <th style="padding:9px;text-align:right">البند</th><th style="padding:9px">موازنة السنة</th><th style="padding:9px">موازنة حتى الآن</th><th style="padding:9px">فعلي YTD</th><th style="padding:9px">انحراف YTD</th><th style="padding:9px">إنجاز%</th><th style="padding:9px">متوقع نهاية السنة</th><th style="padding:9px">انحراف متوقع</th>
            </tr></thead>
            <tbody>${an.map(arow).join('')}</tbody>
            <tfoot><tr style="background:#f0f5fa;font-weight:900;color:#1a3a5c;border-top:2px solid #1a3a5c">
                <td style="padding:9px">صافي الموازنة (إيراد − مصروف)</td><td style="padding:9px;text-align:left;direction:ltr">${fmt(tBudget)}</td><td colspan="4"></td><td style="padding:9px;text-align:left;direction:ltr">${fmt(tFc)}</td><td style="padding:9px;text-align:left;direction:ltr;color:${(tFc - tBudget) >= 0 ? '#27ae60' : '#c0392b'}">${(tFc - tBudget) >= 0 ? '+' : ''}${fmt(tFc - tBudget)}</td>
            </tr></tfoot>
        </table></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="card" style="padding:14px"><div style="font-weight:800;color:#1a3a5c;margin-bottom:8px">📊 الموازنة مقابل المتوقع (حسب البند)</div><canvas id="fmBdChartBar" height="200"></canvas></div>
        <div class="card" style="padding:14px"><div style="font-weight:800;color:#1a3a5c;margin-bottom:8px">📈 منحنى إنجاز الإيرادات التراكمي</div><canvas id="fmBdChartCum" height="200"></canvas></div>
    </div>`;
    return grid + analysis;
}
function fmDrawBudgetCharts() {
    if (!window.Chart) return;
    ['fmBdChartBar', 'fmBdChartCum'].forEach(id => { if (window._fmCharts[id]) { try { window._fmCharts[id].destroy(); } catch (e) { } delete window._fmCharts[id]; } });
    const d = window._fmBudgetChart || {}; const mk = (id, cfg) => { const el = document.getElementById(id); if (el) window._fmCharts[id] = new Chart(el, cfg); };
    mk('fmBdChartBar', { type: 'bar', data: { labels: d.labels || [], datasets: [{ label: 'الموازنة', data: d.budget || [], backgroundColor: '#2d6a9f' }, { label: 'المتوقع (تنبؤ)', data: d.forecast || [], backgroundColor: (d.kinds || []).map((k, i) => { const over = k === 'out' ? (d.forecast[i] > d.budget[i]) : (d.forecast[i] < d.budget[i]); return over ? '#c0392b' : '#27ae60'; }) }] }, options: { plugins: { legend: { position: 'bottom', rtl: true, labels: { font: { size: 10 } } } }, scales: { y: { beginAtZero: true } } } });
    const rl = d.revLine; if (rl) {
        const y = fmBudgetYear(); const bm = fmBudgetMonths('_rev', y); const am = fmBudgetActualMonths('_rev', y);
        const curY = new Date().getFullYear(); const ytdLast = (+y) < curY ? 11 : (+y) > curY ? -1 : new Date().getMonth();
        let cb = 0, ca = 0; const cumB = [], cumA = [];
        for (let i = 0; i < 12; i++) { cb += bm[i]; cumB.push(Math.round(cb * 100) / 100); if (i <= ytdLast) { ca += am[i]; cumA.push(Math.round(ca * 100) / 100); } else cumA.push(null); }
        mk('fmBdChartCum', { type: 'line', data: { labels: FM_MONTHS_AR, datasets: [{ label: 'الموازنة التراكمية', data: cumB, borderColor: '#2d6a9f', backgroundColor: 'rgba(45,106,159,.1)', fill: true, tension: .3 }, { label: 'الفعلي التراكمي', data: cumA, borderColor: '#16a085', backgroundColor: 'rgba(22,160,133,.12)', fill: true, tension: .3 }] }, options: { plugins: { legend: { position: 'bottom', rtl: true, labels: { font: { size: 10 } } } }, scales: { y: { beginAtZero: true } } } });
    }
}
// تصدير/طباعة الموازنة
function fmBudgetAOA() {
    const y = fmBudgetYear(); const lines = fmBudgetLineDefs();
    const header = ['البند', ...FM_MONTHS_AR, 'الإجمالي'];
    const data = lines.map(d => { const bm = fmBudgetMonths(d.key, y); return [d.label, ...bm, bm.reduce((s, v) => s + v, 0)]; });
    const an = fmBudgetAnalysis();
    const sep = [[], ['تحليل الموازنة مقابل الفعلي والتنبؤ'], ['البند', 'موازنة السنة', 'موازنة حتى الآن', 'فعلي YTD', 'انحراف YTD', 'إنجاز%', 'متوقع نهاية السنة', 'انحراف متوقع'],
    ...an.map(r => [r.label, r.budget, r.ytdBudget, r.ytdActual, r.ytdVar, r.achv == null ? '' : r.achv + '%', r.forecast, r.fcVar])];
    return [header, ...data, ...sep];
}
window.fmExportBudget = function () {
    if (!window.XLSX) { toast('⚠️ مكتبة Excel غير محمّلة', 'er'); return; }
    const ws = XLSX.utils.aoa_to_sheet(fmBudgetAOA()); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'الموازنة ' + fmBudgetYear());
    XLSX.writeFile(wb, 'budget_' + fmBudgetYear() + '.xlsx'); toast('📊 تم التصدير', 'ok');
};
window.fmPrintBudget = function () {
    const aoa = fmBudgetAOA();
    const html = `<table><thead><tr>${aoa[0].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${aoa.slice(1).map(r => r.length ? `<tr>${r.map((c, i) => `<td style="${i > 0 && typeof c === 'number' ? 'text-align:left;direction:ltr' : ''}">${typeof c === 'number' ? fmt(c) : fmEsc(c)}</td>`).join('')}</tr>` : '<tr><td colspan="14"></td></tr>').join('')}</tbody></table>`;
    fmPrintHtml('الموازنة التقديرية السنوية ' + fmBudgetYear(), html);
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   🏗️  ربحية المشاريع — الموازنة مقابل الفعلي (إيراد/تكلفة/هامش) لكل مشروع    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function fmProjectProfit() {
    return Object.entries(window.projects || {}).map(([pid, p]) => {
        const contract = fmNum(p.contractValue || p.budget);
        const baseCost = fmNum(p.matBudgetEstimate ?? p.matBudget) + fmNum(p.laborCost) + fmNum(p.equipCost) + fmNum(p.subcontractors) + fmNum(p.indirectCost);
        const budgetCost = Math.round((baseCost * (1 + fmNum(p.contingency) / 100)) * 100) / 100;
        const budgetMargin = contract - budgetCost;
        // الفعلي: الإيراد = العمل المنفّذ بالمستخلصات المعتمدة · التكلفة = مصروفات المشروع + المشتريات + مصروفات الموظفين
        let actRev = 0;
        Object.values(window.progressBillings || {}).forEach(b => { if ((b.projectId === pid) && (b.status === 'approved' || b.status === 'paid')) actRev += fmNum(b.currentAmount); });
        let actCost = 0;
        Object.values((window.projectExpenses || {})[pid] || {}).forEach(e => actCost += fmNum(e.amount || e.total));
        Object.values(window.matPurchases || {}).forEach(m => { if (m.projectId === pid || (m.project && m.project.id === pid)) actCost += fmNum(m.purchasedQty) * fmNum(m.purchasedUnitPrice); });
        Object.values(window.employeeExpenses || {}).forEach(e => { if (e.projectId === pid && (!e.status || e.status === 'approved' || e.status === 'paid')) actCost += fmNum(e.amount); });
        actCost = Math.round(actCost * 100) / 100;
        const actMargin = Math.round((actRev - actCost) * 100) / 100;
        return { pid, name: p.name || p.code || pid, status: p.status || '', contract, budgetCost, budgetMargin, budgetMarginPct: contract ? Math.round(budgetMargin / contract * 100) : null, targetMargin: p.targetMargin ?? null, actRev, actCost, actMargin, actMarginPct: actRev ? Math.round(actMargin / actRev * 100) : null, completion: contract ? Math.round(actRev / contract * 100) : null };
    }).sort((a, b) => b.contract - a.contract);
}
function fmRenderProjects() {
    const rows = fmProjectProfit();
    const t = rows.reduce((a, r) => { a.contract += r.contract; a.bCost += r.budgetCost; a.bMargin += r.budgetMargin; a.aRev += r.actRev; a.aCost += r.actCost; a.aMargin += r.actMargin; return a; }, { contract: 0, bCost: 0, bMargin: 0, aRev: 0, aCost: 0, aMargin: 0 });
    const mc = v => v == null ? '#999' : v < 0 ? '#c0392b' : v < 10 ? '#f39c12' : '#27ae60';
    window._fmProjChart = { labels: rows.slice(0, 10).map(r => r.name), contract: rows.slice(0, 10).map(r => r.contract), cost: rows.slice(0, 10).map(r => r.actCost), rev: rows.slice(0, 10).map(r => r.actRev) };
    setTimeout(fmDrawProjChart, 60);
    const body = rows.length ? rows.map(r => `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:7px 9px;font-weight:700;color:#1a3a5c">${fmEsc(r.name)}</td>
        <td style="padding:7px;text-align:left;direction:ltr;font-weight:700">${fmt(r.contract)}</td>
        <td style="padding:7px;text-align:left;direction:ltr;color:#777">${fmt(r.budgetCost)}</td>
        <td style="padding:7px;text-align:center;font-weight:700;color:${mc(r.budgetMarginPct)}">${r.budgetMarginPct == null ? '—' : r.budgetMarginPct + '%'}</td>
        <td style="padding:7px;text-align:left;direction:ltr;font-weight:700;color:#16a085">${fmt(r.actRev)}</td>
        <td style="padding:7px;text-align:left;direction:ltr;font-weight:700;color:#c0392b">${fmt(r.actCost)}</td>
        <td style="padding:7px;text-align:left;direction:ltr;font-weight:800;color:${r.actMargin < 0 ? '#c0392b' : '#27ae60'}">${fmt(r.actMargin)}</td>
        <td style="padding:7px;text-align:center;font-weight:800;color:${mc(r.actMarginPct)}">${r.actMarginPct == null ? '—' : r.actMarginPct + '%'}</td>
        <td style="padding:7px;text-align:center"><div style="background:#eee;border-radius:6px;height:8px;overflow:hidden;min-width:60px"><div style="width:${Math.min(100, r.completion || 0)}%;height:100%;background:#2d6a9f"></div></div><span style="font-size:10px;color:#666">${r.completion == null ? '—' : r.completion + '%'}</span></td>
    </tr>`).join('') : '<tr><td colspan="9" style="text-align:center;color:#999;padding:24px">لا توجد مشاريع</td></tr>';
    return `<div class="card" style="padding:14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
            <div style="font-size:15px;font-weight:900;color:#1a3a5c">🏗️ ربحية المشاريع — الموازنة مقابل الفعلي</div>
            <div style="display:flex;gap:6px"><button class="btn" onclick="fmExportProjects()" style="background:#1d6f42;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📊 تصدير</button><button class="btn" onclick="fmPrintProjects()" style="background:#1a3a5c;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">🖨️ طباعة</button></div>
        </div>
        <div style="background:#eaf2fb;border-right:4px solid #2d6a9f;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#1f618d">💡 الموازنة من تقديرات تكاليف المشروع. الفعلي: الإيراد = المستخلصات المعتمدة · التكلفة = مصروفات المشروع + المشتريات + مصروفات الموظفين المرتبطة. النسبة = الإنجاز مقابل قيمة العقد.</div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:880px">
            <thead><tr style="background:linear-gradient(135deg,#1a3a5c,#2c3e50);color:#fff">
                <th style="padding:9px;text-align:right">المشروع</th><th style="padding:9px">قيمة العقد</th><th style="padding:9px">تكلفة الموازنة</th><th style="padding:9px">هامش الموازنة%</th><th style="padding:9px">إيراد فعلي</th><th style="padding:9px">تكلفة فعلية</th><th style="padding:9px">هامش فعلي</th><th style="padding:9px">هامش%</th><th style="padding:9px">الإنجاز</th>
            </tr></thead>
            <tbody>${body}</tbody>
            <tfoot><tr style="background:#f0f5fa;font-weight:900;color:#1a3a5c;border-top:2px solid #1a3a5c">
                <td style="padding:8px">الإجمالي</td><td style="padding:8px;text-align:left;direction:ltr">${fmt(t.contract)}</td><td style="padding:8px;text-align:left;direction:ltr">${fmt(t.bCost)}</td><td style="padding:8px;text-align:center">${t.contract ? Math.round(t.bMargin / t.contract * 100) + '%' : '—'}</td><td style="padding:8px;text-align:left;direction:ltr;color:#16a085">${fmt(t.aRev)}</td><td style="padding:8px;text-align:left;direction:ltr;color:#c0392b">${fmt(t.aCost)}</td><td style="padding:8px;text-align:left;direction:ltr;color:${t.aMargin < 0 ? '#c0392b' : '#27ae60'}">${fmt(t.aMargin)}</td><td style="padding:8px;text-align:center">${t.aRev ? Math.round(t.aMargin / t.aRev * 100) + '%' : '—'}</td><td></td>
            </tr></tfoot>
        </table></div>
        <div class="card" style="padding:14px;margin-top:14px"><div style="font-weight:800;color:#1a3a5c;margin-bottom:8px">📊 العقد مقابل الإيراد والتكلفة الفعلية (أكبر 10 مشاريع)</div><canvas id="fmProjChart" height="160"></canvas></div>
    </div>`;
}
function fmDrawProjChart() {
    if (!window.Chart) return; if (window._fmCharts['fmProjChart']) { try { window._fmCharts['fmProjChart'].destroy(); } catch (e) { } delete window._fmCharts['fmProjChart']; }
    const d = window._fmProjChart || {}; const el = document.getElementById('fmProjChart'); if (!el) return;
    window._fmCharts['fmProjChart'] = new Chart(el, { type: 'bar', data: { labels: d.labels || [], datasets: [{ label: 'قيمة العقد', data: d.contract || [], backgroundColor: '#2d6a9f' }, { label: 'إيراد فعلي', data: d.rev || [], backgroundColor: '#16a085' }, { label: 'تكلفة فعلية', data: d.cost || [], backgroundColor: '#c0392b' }] }, options: { plugins: { legend: { position: 'bottom', rtl: true, labels: { font: { size: 10 } } } }, scales: { y: { beginAtZero: true } } } });
}
function fmProjectsAOA() {
    const rows = fmProjectProfit();
    return [['المشروع', 'قيمة العقد', 'تكلفة الموازنة', 'هامش الموازنة', 'هامش الموازنة%', 'إيراد فعلي', 'تكلفة فعلية', 'هامش فعلي', 'هامش فعلي%', 'الإنجاز%'],
    ...rows.map(r => [r.name, r.contract, r.budgetCost, r.budgetMargin, r.budgetMarginPct, r.actRev, r.actCost, r.actMargin, r.actMarginPct, r.completion])];
}
window.fmExportProjects = function () { if (!window.XLSX) { toast('⚠️ مكتبة Excel غير محمّلة', 'er'); return; } const ws = XLSX.utils.aoa_to_sheet(fmProjectsAOA()); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'ربحية المشاريع'); XLSX.writeFile(wb, 'projects_profit_' + new Date().toISOString().slice(0, 10) + '.xlsx'); toast('📊 تم التصدير', 'ok'); };
window.fmPrintProjects = function () { const aoa = fmProjectsAOA(); const html = `<table><thead><tr>${aoa[0].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${aoa.slice(1).map(r => `<tr>${r.map((c, i) => `<td style="${i > 0 ? 'text-align:left;direction:ltr' : ''}">${typeof c === 'number' ? fmt(c) : fmEsc(c == null ? '—' : c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; fmPrintHtml('ربحية المشاريع — الموازنة مقابل الفعلي', html); };

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   📋  جدول دفعات العقد (المستخلصات حسب نسب الإنجاز) — يعيد استخدام            ║
// ║   ledger/projectPaymentSchedule + حقل «المحصّل» اليدوي + المتبقّي + نسخ للتحصيل ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function fmContractValue(p) { return fmNum((p && (p.contractValue || p.budget)) || 0); }
function fmContractProjId() {
    const projs = window.projects || {};
    let pid = window._fmState.contractProj;
    if (pid && projs[pid]) return pid;
    // افتراضياً: أول مشروع له جدول دفعات، وإلا أول مشروع
    const withSched = Object.keys(window.projectPaymentSchedule || {}).find(k => projs[k]);
    return withSched || Object.keys(projs)[0] || '';
}
window.fmContractSetProj = function (pid) { window._fmState.contractProj = pid; fmSoftRefresh(); };
window.fmContractAddRow = function (pid) { if (!pid) { toast('اختر مشروعاً أولاً', 'wn'); return; } push(ref(db, 'ledger/projectPaymentSchedule/' + pid), { description: '', percentage: 0, collected: 0, createdAt: Date.now() }).catch(e => toast('❌ ' + (e.message || e), 'er')); };
window.fmContractUpdate = function (pid, key, field, value) {
    const val = (field === 'description') ? value : fmNum(value);
    update(ref(db, 'ledger/projectPaymentSchedule/' + pid + '/' + key), { [field]: val, updatedAt: Date.now() })
        .then(() => { if (field !== 'description') fmSoftRefresh(); }).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.fmContractDeleteRow = function (pid, key) { if (!confirm('حذف هذه الدفعة؟')) return; remove(ref(db, 'ledger/projectPaymentSchedule/' + pid + '/' + key)).catch(e => toast('❌ ' + (e.message || e), 'er')); };
window.fmContractPushCollections = function (pid) {
    const p = (window.projects || {})[pid]; if (!p) return;
    const cv = fmContractValue(p); const sched = (window.projectPaymentSchedule || {})[pid] || {};
    const rows = Object.values(sched).map(s => { const amt = cv * fmNum(s.percentage) / 100; return { desc: s.description, rem: Math.round((amt - fmNum(s.collected)) * 100) / 100 }; }).filter(r => r.rem > 0.5);
    if (!rows.length) { toast('⚠️ لا توجد مبالغ متبقّية للنسخ', 'wn'); return; }
    if (!confirm(`نسخ ${rows.length} دفعة متبقّية (إجمالي ${fmt(rows.reduce((s, r) => s + r.rem, 0))}) إلى دفعات التحصيل المتوقعة؟`)) return;
    const ups = {}; const cust = p.clientName || p.ownerName || p.owner || '';
    rows.forEach(r => { const k = push(fmRef('collections')).key; ups['finModels/collections/' + k] = { customerName: cust, description: (p.name || '') + ' — ' + (r.desc || 'دفعة عقد'), amount: r.rem, dueDate: '', status: 'expected', notes: 'من جدول دفعات العقد', createdAt: Date.now() }; });
    update(ref(db, 'ledger'), ups).then(() => { toast('✅ نُسخت للتحصيل المتوقع', 'ok'); window._fmState.tab = 'collections'; renderFinModels(); }).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
function fmContractRows(pid) {
    const p = (window.projects || {})[pid] || {}; const cv = fmContractValue(p);
    const sched = (window.projectPaymentSchedule || {})[pid] || {};
    return Object.entries(sched).map(([k, s]) => { const pct = fmNum(s.percentage); const amount = Math.round(cv * pct / 100 * 100) / 100; const collected = fmNum(s.collected); return { k, description: s.description || '', percentage: pct, amount, collected, remaining: Math.round((amount - collected) * 100) / 100, createdAt: s.createdAt || 0 }; }).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}
function fmRenderContractSchedule() {
    const projs = window.projects || {}; const pid = fmContractProjId(); const p = projs[pid] || {}; const cv = fmContractValue(p);
    const projComboOpts = Object.entries(projs).map(([k, pr]) => ({ v: k, l: pr.name || pr.code || k }));
    const rows = fmContractRows(pid);
    const tPct = rows.reduce((s, r) => s + r.percentage, 0); const tAmt = rows.reduce((s, r) => s + r.amount, 0);
    const tCol = rows.reduce((s, r) => s + r.collected, 0); const tRem = rows.reduce((s, r) => s + r.remaining, 0);
    const pctOk = Math.abs(tPct - 100) < 0.01;
    const inp = (k, field, v, extra) => `<input ${extra || ''} value="${v == null ? '' : fmEsc(String(v))}" onchange="fmContractUpdate('${pid}','${k}','${field}',this.value)" style="width:100%;box-sizing:border-box;padding:6px;border:1px solid #d0d7e0;border-radius:5px;font-family:inherit;font-size:12px${field !== 'description' ? ';text-align:left;direction:ltr;font-weight:700' : ''}">`;
    const body = rows.length ? rows.map((r, i) => `<tr style="border-bottom:1px solid #eef2f5">
        <td style="padding:5px 6px;text-align:center;color:#888;font-weight:700">${i + 1}</td>
        <td style="padding:3px 5px">${inp(r.k, 'description', r.description, 'type=text placeholder=وصف الدفعة')}</td>
        <td style="padding:3px 5px;width:90px">${inp(r.k, 'percentage', r.percentage, 'type=number step=0.01')}</td>
        <td style="padding:6px;text-align:left;direction:ltr;font-weight:800;color:#2d6a9f;background:#eaf2fb">${fmt(r.amount)}</td>
        <td style="padding:3px 5px;width:120px">${inp(r.k, 'collected', r.collected, 'type=number step=0.01')}</td>
        <td style="padding:6px;text-align:left;direction:ltr;font-weight:800;color:${r.remaining > 0 ? '#c0392b' : '#27ae60'};background:${r.remaining > 0 ? '#fdecea' : '#eafaf3'}">${fmt(r.remaining)}</td>
        <td style="padding:6px;text-align:center">${r.remaining <= 0.5 ? '<span style="color:#27ae60;font-weight:700;font-size:11px">✅ مكتمل</span>' : r.collected > 0 ? '<span style="color:#f39c12;font-weight:700;font-size:11px">⏳ جزئي</span>' : '<span style="color:#999;font-size:11px">— لم يُحصّل</span>'}</td>
        <td style="padding:4px;text-align:center"><button onclick="fmContractDeleteRow('${pid}','${r.k}')" title="حذف" style="background:#fdecea;color:#c0392b;border:none;border-radius:5px;padding:5px 7px;cursor:pointer;font-size:11px">🗑️</button></td>
    </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;color:#999;padding:24px">لا توجد دفعات لهذا المشروع — أضف دفعة، أو عرّفها من ملف المشروع</td></tr>`;
    return `<div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div style="font-size:15px;font-weight:900;color:#1a3a5c">📋 جدول دفعات العقد (حسب نسب الإنجاز)</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                <label style="font-size:12px;color:#666">المشروع</label>
                <div style="width:240px">${projComboOpts.length ? fmComboHtml(projComboOpts, pid, function (val) { fmContractSetProj(val); }, '🔍 اختر مشروعاً…') : '<span style="font-size:12px;color:#999">لا توجد مشاريع</span>'}</div>
                <button class="btn" onclick="fmContractAddRow('${pid}')" style="background:#16a34a;color:#fff;padding:7px 13px;font-size:12px;font-weight:800">➕ دفعة</button>
                <button class="btn" onclick="fmContractPushCollections('${pid}')" style="background:#2d6a9f;color:#fff;padding:7px 13px;font-size:12px;font-weight:700" title="نسخ المتبقّي إلى دفعات التحصيل المتوقعة">🤝 نسخ المتبقّي للتحصيل</button>
                <button class="btn" onclick="fmExportContract('${pid}')" style="background:#1d6f42;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">📊 تصدير</button>
                <button class="btn" onclick="fmPrintContract('${pid}')" style="background:#1a3a5c;color:#fff;padding:7px 13px;font-size:12px;font-weight:700">🖨️ طباعة</button>
            </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;font-size:12.5px">
            <div style="background:#f8fafc;border-radius:8px;padding:6px 12px;border-bottom:2px solid #1a3a5c"><span style="font-size:10px;color:#666">قيمة العقد</span> <b style="color:#1a3a5c">${fmt(cv)}</b></div>
            <div style="background:#f8fafc;border-radius:8px;padding:6px 12px;border-bottom:2px solid ${pctOk ? '#27ae60' : '#c0392b'}"><span style="font-size:10px;color:#666">مجموع النسب</span> <b style="color:${pctOk ? '#27ae60' : '#c0392b'}">${tPct.toFixed(2)}%${pctOk ? ' ✓' : ' ⚠️'}</b></div>
            <div style="background:#eaf2fb;border-radius:8px;padding:6px 12px;border-bottom:2px solid #2d6a9f"><span style="font-size:10px;color:#666">إجمالي الدفعات</span> <b style="color:#2d6a9f">${fmt(tAmt)}</b></div>
            <div style="background:#eafaf3;border-radius:8px;padding:6px 12px;border-bottom:2px solid #16a085"><span style="font-size:10px;color:#666">المحصّل</span> <b style="color:#16a085">${fmt(tCol)}</b></div>
            <div style="background:#fdecea;border-radius:8px;padding:6px 12px;border-bottom:2px solid #c0392b"><span style="font-size:10px;color:#666">المتبقّي</span> <b style="color:#c0392b">${fmt(tRem)}</b></div>
        </div>
        ${!pctOk && rows.length ? `<div style="background:#fff8e1;border-right:4px solid #f39c12;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#7d6608;font-weight:700">⚠️ مجموع النسب ${tPct.toFixed(2)}% ولا يساوي 100% — راجع الدفعات.</div>` : ''}
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:760px">
            <thead><tr style="background:linear-gradient(135deg,#1a3a5c,#2c3e50);color:#fff">
                <th style="padding:8px 6px">م</th><th style="padding:8px 6px;text-align:right">وصف الدفعة</th><th style="padding:8px 6px">النسبة %</th><th style="padding:8px 6px">قيمة الدفعة</th><th style="padding:8px 6px">المحصّل</th><th style="padding:8px 6px">المتبقّي</th><th style="padding:8px 6px">الحالة</th><th style="padding:8px 6px">⚙️</th>
            </tr></thead>
            <tbody>${body}</tbody>
            <tfoot><tr style="background:#f0f5fa;font-weight:900;color:#1a3a5c;border-top:2px solid #1a3a5c">
                <td colspan="2" style="padding:9px;text-align:right">الإجمالي</td>
                <td style="padding:9px;text-align:center;color:${pctOk ? '#27ae60' : '#c0392b'}">${tPct.toFixed(2)}%</td>
                <td style="padding:9px;text-align:left;direction:ltr;color:#2d6a9f">${fmt(tAmt)}</td>
                <td style="padding:9px;text-align:left;direction:ltr;color:#16a085">${fmt(tCol)}</td>
                <td style="padding:9px;text-align:left;direction:ltr;color:#c0392b">${fmt(tRem)}</td>
                <td colspan="2"></td>
            </tr></tfoot>
        </table></div>
        <div style="font-size:11px;color:#888;margin-top:8px">💡 هذا الجدول يشارك بياناته مع «جدول الدفعات التعاقدية» في ملف المشروع. قيمة الدفعة = النسبة × قيمة العقد. «نسخ المتبقّي للتحصيل» يضيف الدفعات غير المحصّلة إلى تبويب دفعات التحصيل المتوقعة.</div>
    </div>`;
}
function fmContractAOA(pid) {
    const rows = fmContractRows(pid); const p = (window.projects || {})[pid] || {};
    return [['مشروع: ' + (p.name || ''), 'قيمة العقد: ' + fmContractValue(p)], [], ['م', 'وصف الدفعة', 'النسبة %', 'قيمة الدفعة', 'المحصّل', 'المتبقّي'],
    ...rows.map((r, i) => [i + 1, r.description, r.percentage, r.amount, r.collected, r.remaining])];
}
window.fmExportContract = function (pid) { if (!window.XLSX) { toast('⚠️ مكتبة Excel غير محمّلة', 'er'); return; } const ws = XLSX.utils.aoa_to_sheet(fmContractAOA(pid)); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'دفعات العقد'); XLSX.writeFile(wb, 'contract_payments_' + new Date().toISOString().slice(0, 10) + '.xlsx'); toast('📊 تم التصدير', 'ok'); };
window.fmPrintContract = function (pid) {
    const rows = fmContractRows(pid); const p = (window.projects || {})[pid] || {};
    const html = `<div style="font-size:13px;margin-bottom:8px">المشروع: <b>${fmEsc(p.name || '')}</b> · قيمة العقد: <b>${fmt(fmContractValue(p))}</b></div>
        <table><thead><tr><th>م</th><th>وصف الدفعة</th><th>النسبة %</th><th>قيمة الدفعة</th><th>المحصّل</th><th>المتبقّي</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${fmEsc(r.description)}</td><td style="text-align:center">${r.percentage}%</td><td style="text-align:left">${fmt(r.amount)}</td><td style="text-align:left">${fmt(r.collected)}</td><td style="text-align:left">${fmt(r.remaining)}</td></tr>`).join('')}
        </tbody></table>`;
    fmPrintHtml('جدول دفعات العقد — ' + (p.name || ''), html);
};

// ── العرض الرئيسي ─────────────────
window.fmTab = function (t) { window._fmState.tab = t; renderFinModels(); };
window.fmSetSource = function (s) { window._fmState.source = s; renderFinModels(); };
// بحث شامل عبر كل الجداول (يُملأ نتائجه دون إعادة رسم الصندوق)
window.fmGlobalSearch = function (q) {
    const box = document.getElementById('fmGSResults'); if (!box) return;
    q = (q || '').trim().toLowerCase(); if (!q) { box.innerHTML = ''; return; }
    const meta = { revenue: { ic: '💰', name: 'إيراد', col: '#16a085', amt: r => fmRevExpected(r), label: r => r.projectName || r.notes || '' }, expenses: { ic: '💸', name: 'مصروف', col: '#c0392b', amt: r => fmNum(r.amount), label: r => (fmCatLabel(r.category) + ' — ' + (r.name || '')) }, collections: { ic: '🤝', name: 'تحصيل', col: '#2d6a9f', amt: r => fmNum(r.amount), label: r => (r.customerName || '') + ' ' + (r.description || '') }, payments: { ic: '🏢', name: 'سداد', col: '#e67e22', amt: r => fmNum(r.amount), label: r => (r.vendorName || '') + ' ' + (r.description || '') } };
    const res = [];
    ['revenue', 'expenses', 'collections', 'payments'].forEach(t => { const m = meta[t]; fmList(t).forEach(r => { const hay = (m.label(r) + ' ' + (r.month || '') + ' ' + (r.dueDate || r.collectionDate || '') + ' ' + (r.notes || '')).toLowerCase(); if (hay.includes(q)) res.push({ t, m, r }); }); });
    if (!res.length) { box.innerHTML = '<div style="color:#999;font-size:12px;padding:6px">لا نتائج</div>'; return; }
    box.innerHTML = `<div style="font-size:11px;color:#888;margin-bottom:4px">${res.length} نتيجة</div>` + res.slice(0, 40).map(({ t, m, r }) => `<div onclick="fmTab('${t}')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #f2f5f8;font-size:12px"><span style="background:${m.col}18;color:${m.col};border-radius:6px;padding:1px 7px;font-weight:700;font-size:10px">${m.ic} ${m.name}</span><span style="flex:1;color:#1a3a5c">${fmEsc(m.label(r))}</span><span style="color:#666">${r.month ? fmMonthLabel(r.month) : (r.dueDate || r.collectionDate || '')}</span><b style="color:${m.col};direction:ltr">${fmt(m.amt(r))}</b></div>`).join('');
};
window.renderFinModels = function () {
    const c = $('pg-finmodels'); if (!c) return;
    window._fmComboReg = {}; // إعادة ضبط سجل القوائم المنسدلة عند كل رسم
    const st = window._fmState; const tab = st.tab || 'dashboard';
    const tb = (id, label) => `<button class="btn" onclick="fmTab('${id}')" style="${tab === id ? 'background:#0e6251;color:#fff' : 'background:#eef2f0;color:#0e6251'};padding:9px 16px;font-weight:800;font-size:13px;border-radius:9px">${label}</button>`;
    const internal = fmIsInternal();
    const srcBtn = (id, label, desc) => `<button onclick="fmSetSource('${id}')" style="flex:1;min-width:200px;text-align:right;cursor:pointer;border:2px solid ${st.source === id ? '#fff' : 'rgba(255,255,255,.35)'};background:${st.source === id ? 'rgba(255,255,255,.22)' : 'transparent'};color:#fff;border-radius:11px;padding:11px 14px"><div style="font-weight:900;font-size:14px">${label}</div><div style="font-size:11px;opacity:.9;margin-top:2px">${desc}</div></button>`;
    let view = '';
    if (tab === 'dashboard') view = fmRenderDashboard();
    else if (tab === 'budget') view = fmRenderBudget();
    else if (tab === 'projects') view = fmRenderProjects();
    else if (tab === 'contractsch') view = fmRenderContractSchedule();
    else if (tab === 'cashflow') view = fmRenderCashflow();
    else if (tab === 'variance') view = fmRenderVariance();
    else if (tab === 'collections') view = fmRenderCollections();
    else view = fmRenderTable(tab);
    c.innerHTML = `
        <div style="background:linear-gradient(135deg,#0e6251,#16a085);color:#fff;border-radius:16px;padding:18px 22px;margin-bottom:14px;box-shadow:0 6px 20px rgba(22,160,133,.25)">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                <div><div style="font-size:11px;opacity:.85;letter-spacing:1px">FINANCIAL MODELS</div><h1 style="margin:4px 0 0;font-size:23px;font-weight:900">📊 النماذج المالية والتخطيط</h1><div style="font-size:12px;opacity:.95;margin-top:4px">الإيرادات المتوقعة (المستخلصات) · المصروفات · التدفقات النقدية · دفعات التحصيل والسداد</div></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">${internal ? '' : '<button class="btn" onclick="fmSaveBaseline()" style="background:rgba(255,255,255,.2);color:#fff;padding:9px 14px;font-weight:700" title="حفظ نسخة موازنة للمقارنة">💾 نسخة موازنة</button>'}<button class="btn" onclick="fmExportAll()" style="background:#fff;color:#0e6251;padding:9px 16px;font-weight:800">📊 تصدير الكل Excel</button><button class="btn" onclick="fmPrintAll()" style="background:rgba(255,255,255,.2);color:#fff;padding:9px 16px;font-weight:700">🖨️ طباعة شاملة</button></div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
                ${srcBtn('internal', '🔗 داخلي — من بيانات البرنامج', 'مشتق تلقائياً: المستخلصات، الرواتب، الفواتير، المركز النقدي')}
                ${srcBtn('external', '✍️ خارجي — إدخال يدوي وExcel', 'جداول قابلة للتعبئة + استيراد/تصدير Excel + نسخ موازنة')}
            </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            ${tb('dashboard', '📊 لوحة مجمّعة')} ${tb('budget', '📅 الموازنة السنوية')} ${tb('projects', '🏗️ ربحية المشاريع')} ${tb('contractsch', '📋 جدول دفعات العقد')} ${tb('revenue', '💰 الإيرادات (المستخلصات)')} ${tb('expenses', '💸 المصروفات')} ${tb('cashflow', '🔄 التدفقات النقدية')} ${tb('variance', '📐 فعلي مقابل متوقع')} ${tb('collections', '🤝 دفعات التحصيل')} ${tb('payments', '🏢 دفعات السداد')}
        </div>
        <div id="fmViewArea">${view}</div>`;
};

// ── الاستيراد من بيانات النظام ─────────────────
window.fmSeedRevenue = function () {
    const bills = Object.values(window.progressBillings || {}).filter(b => b.status === 'approved');
    if (!bills.length) { toast('⚠️ لا توجد مستخلصات معتمدة', 'wn'); return; }
    if (!confirm(`استيراد ${bills.length} مستخلص معتمد كإيرادات متوقعة؟`)) return;
    const ups = {};
    bills.forEach(b => { const k = push(fmRef('revenue')).key; ups['finModels/revenue/' + k] = { projectName: b.projectName || (window.projects?.[b.projectId]?.name) || '', month: (b.month || (b.date || '').slice(0, 7)), claimValue: fmNum(b.netAmount || b.currentAmount), collectionPct: 100, collectionDate: b.dueDate || b.date || '', notes: 'مستخلص ' + (b.number || ''), createdAt: Date.now() }; });
    update(ref(db, 'ledger'), ups).then(() => toast('✅ استُوردت المستخلصات', 'ok')).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.fmSeedSalaries = function () {
    const runs = Object.values(window.payrolls || {}).filter(p => p.status === 'approved' || p.status === 'paid');
    if (!runs.length) { toast('⚠️ لا توجد مسيرات رواتب معتمدة', 'wn'); return; }
    if (!confirm(`استيراد إجمالي ${runs.length} مسير رواتب كمصروفات (رواتب)؟`)) return;
    const ups = {};
    runs.forEach(p => { const tot = fmNum(p.totalNet || p.totalNetPay || p.netTotal || (p.rows ? Object.values(p.rows).reduce((s, r) => s + fmNum(r.netPay || r.net), 0) : 0)); const k = push(fmRef('expenses')).key; ups['finModels/expenses/' + k] = { category: 'salaries', name: 'رواتب ' + (p.month || p.period || ''), month: p.month || (p.period || ''), amount: tot, dueDate: (p.month ? p.month + '-28' : ''), notes: 'مسير ' + (p.number || ''), createdAt: Date.now() }; });
    update(ref(db, 'ledger'), ups).then(() => toast('✅ استُوردت الرواتب', 'ok')).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.fmSeedReceivables = function () {
    const custs = Object.entries(window.customers || {}); let n = 0; const ups = {};
    custs.forEach(([key, c]) => { const bal = (typeof calcCustomerBalance === 'function') ? calcCustomerBalance(key).balance : 0; if (bal > 0.5) { const k = push(fmRef('collections')).key; ups['finModels/collections/' + k] = { customerName: c.nameAr || c.code, description: 'رصيد مستحق', amount: Math.round(bal * 100) / 100, dueDate: '', status: 'expected', createdAt: Date.now() }; n++; } });
    if (!n) { toast('⚠️ لا توجد أرصدة عملاء مدينة', 'wn'); return; }
    if (!confirm(`استيراد أرصدة ${n} عميل كدفعات تحصيل متوقعة؟`)) return;
    update(ref(db, 'ledger'), ups).then(() => toast('✅ استُوردت ذمم العملاء', 'ok')).catch(e => toast('❌ ' + (e.message || e), 'er'));
};
window.fmSeedPayables = function () {
    const vends = Object.entries(window.vendors || {}); let n = 0; const ups = {};
    vends.forEach(([key, v]) => { const bal = (typeof calcVendorBalance === 'function') ? calcVendorBalance(key).balance : 0; if (bal > 0.5) { const k = push(fmRef('payments')).key; ups['finModels/payments/' + k] = { vendorName: v.nameAr || v.name || v.code, description: 'رصيد مستحق', amount: Math.round(bal * 100) / 100, dueDate: '', status: 'expected', createdAt: Date.now() }; n++; } });
    if (!n) { toast('⚠️ لا توجد أرصدة موردين دائنة', 'wn'); return; }
    if (!confirm(`استيراد أرصدة ${n} مورّد كدفعات سداد متوقعة؟`)) return;
    update(ref(db, 'ledger'), ups).then(() => toast('✅ استُوردت ذمم الموردين', 'ok')).catch(e => toast('❌ ' + (e.message || e), 'er'));
};

// ── Excel: تصدير/استيراد/طباعة ─────────────────
function fmTableToAOA(table) {
    const cols = fmTableCols(table); const rows = fmList(table);
    const header = cols.map(c => c.label);
    const data = rows.map(r => cols.map(c => (c.type === 'calc' || c.type === 'diff') ? c.calc(r) : (c.key === 'category' ? fmCatLabel(r[c.key]) : (r[c.key] == null ? '' : r[c.key]))));
    return [header, ...data];
}
window.fmExportExcel = function (table) {
    if (!window.XLSX) { toast('⚠️ مكتبة Excel غير محمّلة', 'er'); return; }
    const ws = XLSX.utils.aoa_to_sheet(fmTableToAOA(table)); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, table);
    XLSX.writeFile(wb, 'finmodel_' + table + '_' + new Date().toISOString().slice(0, 10) + '.xlsx'); toast('📊 تم التصدير', 'ok');
};
window.fmExportAll = function () {
    if (!window.XLSX) { toast('⚠️ مكتبة Excel غير محمّلة', 'er'); return; }
    const wb = XLSX.utils.book_new();
    ['revenue', 'expenses', 'collections', 'payments'].forEach(t => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fmTableToAOA(t)), { revenue: 'الإيرادات', expenses: 'المصروفات', collections: 'التحصيل', payments: 'السداد' }[t]));
    const cf = fmCashflow(); const cfa = [['الشهر', 'التحصيلات', 'التدفقات الخارجة', 'صافي التدفق', 'الرصيد المتوقع'], ['رصيد افتتاحي', '', '', '', cf.opening], ...cf.rows.map(r => [fmMonthLabel(r.m), r.in, r.out, r.net, r.run])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cfa), 'التدفق النقدي');
    XLSX.writeFile(wb, 'finmodels_all_' + new Date().toISOString().slice(0, 10) + '.xlsx'); toast('📊 تم تصدير كل النماذج', 'ok');
};
window.fmImportExcel = function (table, file) {
    if (!file || !window.XLSX) return;
    const def = { cols: fmTableCols(table) };
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
            if (!aoa.length) { toast('⚠️ الملف فارغ', 'er'); return; }
            const header = aoa[0].map(h => String(h || '').trim());
            const colByLabel = {}; def.cols.forEach(c => { const idx = header.findIndex(h => h === c.label); if (idx >= 0) colByLabel[c.key] = idx; });
            const catRev = {}; Object.entries(fmAllExpCats()).forEach(([k, v]) => catRev[v] = k);
            const ups = {}; let n = 0;
            aoa.slice(1).forEach(row => {
                if (!row || !row.length) return;
                const rec = { createdAt: Date.now() }; let any = false;
                def.cols.forEach(c => { if (c.type === 'calc' || c.type === 'diff') return; const idx = colByLabel[c.key]; if (idx == null) return; let val = row[idx]; if (val == null || val === '') return; if (c.key === 'category') val = catRev[val] || (fmAllExpCats()[val] ? val : 'fixed'); rec[c.key] = (c.type === 'num') ? fmNum(val) : String(val); any = true; });
                if (any) { const k = push(fmRef(table)).key; ups['finModels/' + table + '/' + k] = rec; n++; }
            });
            if (!n) { toast('⚠️ لم يُقرأ أي سطر — تأكد من تطابق رؤوس الأعمدة', 'er'); return; }
            update(ref(db, 'ledger'), ups).then(() => toast(`✅ استُورد ${n} سطر`, 'ok', 4000)).catch(er => toast('❌ ' + (er.message || er), 'er'));
        } catch (err) { toast('❌ خطأ في قراءة الملف: ' + (err.message || err), 'er'); }
    };
    reader.readAsArrayBuffer(file);
};

function fmPrintHtml(title, inner) {
    const co = (window.gbrCfg && (window.gbrCfg.companyAr || window.gbrCfg.companyEn)) || 'بنيان للمقاولات';
    const w = window.open('', '_blank');
    w.document.write(`<html dir="rtl" lang="ar"><head><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet"><meta charset="utf-8"><title>${title}</title><style>body{font-family:'Tajawal',Tahoma,Arial,sans-serif;padding:22px;direction:rtl;color:#1a3a5c}h1{font-size:19px;color:#0e6251}table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:10px}th,td{border:1px solid #ccc;padding:6px;text-align:right}th{background:#0e6251;color:#fff}tfoot td{background:#f0f5fa;font-weight:900}@page{size:A4 landscape;margin:1.2cm}</style></head><body><h1>${title} — ${co}</h1><div style="font-size:12px;color:#666">بتاريخ ${new Date().toLocaleDateString('ar-SA')}</div>${inner}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
}
function fmTablePrintHtml(table) {
    const def = fmTableDefs()[table]; const aoa = fmTableToAOA(table);
    const head = aoa[0].map(h => `<th>${h}</th>`).join('');
    const body = aoa.slice(1).map(r => `<tr>${r.map((c, i) => `<td style="${i >= 2 ? 'text-align:left;direction:ltr' : ''}">${typeof c === 'number' ? fmt(c) : fmEsc(c)}</td>`).join('')}</tr>`).join('');
    return `<h2 style="font-size:15px;margin-top:14px;color:${def.color}">${def.icon} ${def.title}</h2><table><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="' + aoa[0].length + '" style="text-align:center">لا بيانات</td></tr>'}</tbody></table>`;
}
window.fmPrintTable = function (table) { fmPrintHtml(fmTableDefs()[table].title, fmTablePrintHtml(table)); };
window.fmPrintCashflow = function () {
    const cf = fmCashflow();
    const inner = `<table><thead><tr><th>الشهر</th><th>التحصيلات</th><th>التدفقات الخارجة</th><th>صافي التدفق</th><th>الرصيد المتوقع</th></tr></thead><tbody>
        <tr><td>رصيد افتتاحي</td><td></td><td></td><td></td><td style="text-align:left;direction:ltr">${fmt(cf.opening)}</td></tr>
        ${cf.rows.map(r => `<tr><td>${fmMonthLabel(r.m)}</td><td style="text-align:left;direction:ltr">${fmt(r.in)}</td><td style="text-align:left;direction:ltr">${fmt(r.out)}</td><td style="text-align:left;direction:ltr">${fmt(r.net)}</td><td style="text-align:left;direction:ltr">${fmt(r.run)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td>الإجمالي</td><td style="text-align:left;direction:ltr">${fmt(cf.totalIn)}</td><td style="text-align:left;direction:ltr">${fmt(cf.totalOut)}</td><td style="text-align:left;direction:ltr">${fmt(cf.totalIn - cf.totalOut)}</td><td style="text-align:left;direction:ltr">${fmt(cf.closing)}</td></tr></tfoot></table>`;
    fmPrintHtml('جدول التدفقات النقدية المتوقعة', inner);
};
window.fmExportCashflow = function () {
    if (!window.XLSX) { toast('⚠️ مكتبة Excel غير محمّلة', 'er'); return; }
    const cf = fmCashflow(); const aoa = [['الشهر', 'التحصيلات', 'التدفقات الخارجة', 'صافي التدفق', 'الرصيد المتوقع'], ['رصيد افتتاحي', '', '', '', cf.opening], ...cf.rows.map(r => [fmMonthLabel(r.m), r.in, r.out, r.net, r.run])];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'التدفق النقدي'); XLSX.writeFile(wb, 'cashflow_' + new Date().toISOString().slice(0, 10) + '.xlsx');
};
window.fmPrintAll = function () {
    const cf = fmCashflow();
    const cfInner = `<h2 style="font-size:15px;margin-top:14px;color:#1a3a5c">🔄 جدول التدفقات النقدية المتوقعة</h2><table><thead><tr><th>الشهر</th><th>التحصيلات</th><th>التدفقات الخارجة</th><th>صافي التدفق</th><th>الرصيد المتوقع</th></tr></thead><tbody><tr><td>رصيد افتتاحي</td><td></td><td></td><td></td><td style="text-align:left">${fmt(cf.opening)}</td></tr>${cf.rows.map(r => `<tr><td>${fmMonthLabel(r.m)}</td><td style="text-align:left">${fmt(r.in)}</td><td style="text-align:left">${fmt(r.out)}</td><td style="text-align:left">${fmt(r.net)}</td><td style="text-align:left">${fmt(r.run)}</td></tr>`).join('')}</tbody></table>`;
    fmPrintHtml('النماذج المالية الشاملة', fmTablePrintHtml('revenue') + fmTablePrintHtml('expenses') + cfInner + fmTablePrintHtml('collections') + fmTablePrintHtml('payments'));
};

// ── 🔔 تنبيهات مالية للجرس (تُستدعى من refreshNotifBell في app.js) ──
window.fmAlertItems = function () {
    try {
        const items = [];
        const cf = fmCashflow({ pctAdj: 0, expAdj: 0, inDelay: 0, outDelay: 0 });
        const liq = fmLiquidity(cf);
        if (cf.minRun < 0) items.push({ icon: '⚠️', text: `تحذير سيولة: الرصيد المتوقع يصبح سالباً (${fmt(cf.minRun)}) — ${liq.runwayLabel}`, page: 'finmodels', el: 'n-finmodels' });
        else if (liq.breachIdx >= 0) items.push({ icon: '🔔', text: `السيولة تهبط تحت الحد الأدنى في ${liq.breachLabel}`, page: 'finmodels', el: 'n-finmodels' });
        // تجاوز الموازنة المتوقع (بنود المصروفات)
        const over = fmBudgetAnalysis().filter(r => r.kind === 'out' && r.budget > 0 && r.fcVar > r.budget * 0.05);
        if (over.length) items.push({ icon: '📉', text: `${over.length} بند مصروف متوقَّع تجاوزه للموازنة (${over.slice(0, 2).map(r => r.label).join('، ')}${over.length > 2 ? '…' : ''})`, page: 'finmodels', el: 'n-finmodels' });
        return items;
    } catch (e) { return []; }
};

// ── تهيئة كسولة ─────────────────
(function fmInit() {
    if (window._fmInitDone) return;
    if (!window.R || !window.onValue || !window.db) { setTimeout(fmInit, 700); return; }
    window._fmInitDone = true;
    try {
        ['revenue', 'expenses', 'collections', 'payments', 'settings', 'baselines', 'categories', 'actuals', 'budget'].forEach(t => {
            onValue(fmRef(t), sn => { window.fmData[t] = sn.val() || {}; if ($('pg-finmodels') && $('pg-finmodels').classList.contains('act')) renderFinModels(); });
        });
        // جدول دفعات العقد (يُشارك بياناته مع ملف المشروع) — يحدّثه app.js أيضاً
        onValue(ref(db, 'ledger/projectPaymentSchedule'), sn => { window.projectPaymentSchedule = sn.val() || {}; if ($('pg-finmodels') && $('pg-finmodels').classList.contains('act')) renderFinModels(); });
    } catch (e) { console.warn('finmodels init failed', e); }
})();

console.log('✅ Financial Models module [FINMODELS] loaded');
