// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🌴  سياسات الإجازات المخصّصة (Leave Policies)                              ║
// ║  وحدة ثانوية تعتمد على globals من app.js. بياناتها تُعزَل تلقائياً للمستأجر.   ║
// ║  أسلوب آمن: السياسة قالب أرصدة يُطبَّق على حقول الموظف (leaveAnnual/Sick/     ║
// ║  Emergency) عند الإسناد — دون أي تغيير في منطق احتساب الرصيد القائم.          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

function lpEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function lpAll() { return window.leavePolicies || {}; }
function lpInp() { return 'padding:8px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box'; }

window.renderLeavePolicies = function () {
    const c = document.getElementById('pg-leavepolicies'); if (!c) return;
    window._lpTab = window._lpTab || 'defs';
    const tab = window._lpTab;
    const tabBtn = (id, label) => `<button onclick="window._lpTab='${id}';renderLeavePolicies()" style="background:${tab === id ? '#16a085' : '#eef2f7'};color:${tab === id ? '#fff' : '#555'};border:none;padding:9px 18px;border-radius:9px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer">${label}</button>`;
    const pols = Object.values(lpAll());
    let assignedCount = 0; Object.values(window.emp || {}).forEach(e => { if (e.leavePolicyId && lpAll()[e.leavePolicyId]) assignedCount++; });
    const activeEmps = Object.values(window.emp || {}).filter(e => (e.status || 'active') === 'active').length;
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;
    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">🌴 سياسات الإجازات</div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('📋', 'عدد السياسات', pols.length, '#16a085')}
            ${kpi('👥', 'موظفون بسياسة', assignedCount, '#2980b9')}
            ${kpi('❔', 'بلا سياسة', activeEmps - assignedCount, (activeEmps - assignedCount) ? '#e67e22' : '#95a5a6')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${tabBtn('defs', '📋 تعريف السياسات')}${tabBtn('assign', '👥 إسناد الموظفين')}</div>
        <div id="lpTabBody"></div>
    </div>`;
    if (tab === 'defs') lpRenderDefs(); else lpRenderAssign();
};

// ── تعريف السياسات ───────────────────────────────────────────────────────────
function lpRenderDefs() {
    const body = document.getElementById('lpTabBody'); if (!body) return;
    const rows = Object.entries(lpAll()).map(([k, p]) => ({ k, ...p }));
    let cntBy = {}; Object.values(window.emp || {}).forEach(e => { if (e.leavePolicyId) cntBy[e.leavePolicyId] = (cntBy[e.leavePolicyId] || 0) + 1; });
    body.innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn b-g" onclick="lpOpen()" style="font-weight:800">➕ إضافة سياسة</button></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
        ${rows.length ? rows.map(p => `<div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden;border-top:3px solid #16a085">
            <div style="padding:12px 14px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center">
                <div style="font-weight:800;color:#0e7c66;font-size:14px">🌴 ${lpEsc(p.name)}</div>
                <div style="white-space:nowrap"><button class="btn" onclick="lpOpen('${p.k}')" style="font-size:11px;padding:3px 7px">✏️</button> <button class="btn b-r" onclick="lpDelete('${p.k}')" style="font-size:11px;padding:3px 7px">🗑️</button></div>
            </div>
            <div style="padding:12px 14px;font-size:12.5px;color:#555;line-height:1.9">
                🏖️ سنوية: <b>${p.annual ?? 21}</b> يوم · 🏥 مرضية: <b>${p.sick ?? 30}</b> · ⚡ اضطرارية: <b>${p.emergency ?? 5}</b><br>
                ${p.probationMonths ? `⏳ فترة تجربة: ${p.probationMonths} شهر<br>` : ''}
                ${p.description ? `<span style="color:#888">${lpEsc(p.description)}</span><br>` : ''}
                👥 مُطبَّقة على: <b>${cntBy[p.k] || 0}</b> موظف
            </div>
        </div>`).join('') : '<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:24px">لا سياسات — أضف سياسة (مثل: موظفون · إداريون · عمالة)</div>'}
        </div>`;
}
window.lpOpen = function (key) {
    lpEnsureModal();
    const p = key ? lpAll()[key] : null;
    document.getElementById('lpKey').value = key || '';
    document.getElementById('lpModalTitle').textContent = p ? '✏️ تعديل سياسة' : '🌴 إضافة سياسة';
    document.getElementById('lpName').value = p?.name || '';
    document.getElementById('lpAnnual').value = p?.annual ?? 21;
    document.getElementById('lpSick').value = p?.sick ?? 30;
    document.getElementById('lpEmergency').value = p?.emergency ?? 5;
    document.getElementById('lpProbation').value = p?.probationMonths ?? 3;
    document.getElementById('lpDesc').value = p?.description || '';
    document.getElementById('lpModal').style.display = 'flex';
};
window.lpClose = function () { const m = document.getElementById('lpModal'); if (m) m.style.display = 'none'; };
function lpEnsureModal() {
    if (document.getElementById('lpModal')) return;
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const d = document.createElement('div');
    d.id = 'lpModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:480px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 id="lpModalTitle" style="margin:0;color:#0e7c66;font-size:18px">🌴 إضافة سياسة</h3><button onclick="lpClose()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <input id="lpKey" type="hidden">
        ${fg('اسم السياسة *', `<input id="lpName" placeholder="مثال: الموظفون الدائمون / العمالة" style="width:100%;${lpInp()}">`)}
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            ${fg('سنوية (يوم)', `<input id="lpAnnual" type="number" min="0" style="width:100%;${lpInp()}">`)}
            ${fg('مرضية (يوم)', `<input id="lpSick" type="number" min="0" style="width:100%;${lpInp()}">`)}
            ${fg('اضطرارية (يوم)', `<input id="lpEmergency" type="number" min="0" style="width:100%;${lpInp()}">`)}
        </div>
        ${fg('فترة التجربة (شهر)', `<input id="lpProbation" type="number" min="0" style="width:100%;${lpInp()}">`)}
        ${fg('وصف/ملاحظات', `<textarea id="lpDesc" rows="2" style="width:100%;${lpInp()};resize:vertical"></textarea>`)}
        <div style="background:#eafaf1;border-radius:8px;padding:9px 12px;font-size:11px;color:#1e8449;margin-bottom:12px">💡 عند إسناد السياسة لموظف تُطبَّق هذه الأرصدة على بطاقته. الترحيل السنوي للرصيد يبقى بالنظام التراكمي القائم.</div>
        <div style="display:flex;gap:8px"><button class="btn b-g" onclick="lpSave()" style="flex:1;font-weight:800">💾 حفظ</button><button class="btn" onclick="lpClose()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.lpSave = async function () {
    const key = document.getElementById('lpKey').value;
    const name = document.getElementById('lpName').value.trim();
    if (!name) { toast('⚠️ اسم السياسة مطلوب', 'er'); return; }
    const data = {
        name, annual: parseFloat(document.getElementById('lpAnnual').value) || 0,
        sick: parseFloat(document.getElementById('lpSick').value) || 0,
        emergency: parseFloat(document.getElementById('lpEmergency').value) || 0,
        probationMonths: parseInt(document.getElementById('lpProbation').value) || 0,
        description: document.getElementById('lpDesc').value.trim(), updatedAt: new Date().toISOString()
    };
    try {
        if (key) await window.update(window.ref(window.db, 'ledger/leavePolicies/' + key), data);
        else await window.push(window.R.leavePolicies, data);
        toast('✓ تم الحفظ', 'ok'); lpClose();
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.lpDelete = async function (key) {
    let n = 0; Object.values(window.emp || {}).forEach(e => { if (e.leavePolicyId === key) n++; });
    if (!(await cf2(n ? `${n} موظف مُطبَّقة عليهم — الحذف لا يغيّر أرصدتهم الحالية. متابعة؟` : 'حذف هذه السياسة؟'))) return;
    try { await window.remove(window.ref(window.db, 'ledger/leavePolicies/' + key)); toast('🗑️ تم الحذف', 'ok'); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// ── إسناد الموظفين ───────────────────────────────────────────────────────────
function lpRenderAssign() {
    const body = document.getElementById('lpTabBody'); if (!body) return;
    const pols = Object.entries(lpAll());
    if (!pols.length) { body.innerHTML = '<div style="text-align:center;color:#aaa;padding:24px">عرّف سياسة واحدة أولاً من تبويب «تعريف السياسات»</div>'; return; }
    const emps = Object.entries(window.emp || {}).filter(([, e]) => (e.status || 'active') === 'active').sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'));
    const optsFor = sel => '<option value="">— بلا سياسة —</option>' + pols.map(([k, p]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${lpEsc(p.name)}</option>`).join('');
    const bulkOpts = pols.map(([k, p]) => `<option value="${k}">${lpEsc(p.name)}</option>`).join('');
    body.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;background:#fff;padding:12px 14px;border-radius:10px;margin-bottom:14px">
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">إسناد جماعي</label><select id="lpBulkSel" style="${lpInp()}">${bulkOpts}</select></div>
            <button class="btn" onclick="lpBulkAssign(false)" style="background:#eafaf1;color:#0e7c66;font-weight:700">أسند غير المُسنَدين</button>
            <button class="btn" onclick="lpBulkAssign(true)" style="background:#eafaf1;color:#0e7c66;font-weight:700">أسند الكل</button>
        </div>
        <div style="background:#fff3e0;border-radius:10px;padding:9px 14px;font-size:11.5px;color:#7d4e00;margin-bottom:12px">⚠️ إسناد سياسة يستبدل أرصدة (السنوية/المرضية/الاضطرارية) الحالية ببطاقة الموظف بقيم السياسة.</div>
        <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <thead><tr style="background:#f4f6f9;color:#555;text-align:right"><th style="padding:9px">الموظف</th><th>الأرصدة الحالية (سنوية/مرضية/اضطرارية)</th><th style="width:200px">السياسة</th></tr></thead>
                <tbody>${emps.map(([k, e]) => `<tr style="border-bottom:1px solid #f3f3f3">
                    <td style="padding:8px 9px;font-weight:700">${lpEsc(e.name)}</td>
                    <td style="color:#666">${e.leaveAnnual ?? 21} / ${e.leaveSick ?? 30} / ${e.leaveEmergency ?? 5}</td>
                    <td><select onchange="lpAssign('${k}',this.value)" style="width:100%;${lpInp()}">${optsFor(e.leavePolicyId || '')}</select></td>
                </tr>`).join('')}</tbody>
            </table>
        </div>`;
}
// إسناد سياسة لموظف = تطبيق أرصدتها على حقوله
window.lpAssign = async function (empKey, policyId) {
    try {
        if (policyId) {
            const p = lpAll()[policyId]; if (!p) return;
            await window.update(window.ref(window.db, 'ledger/employees/' + empKey), {
                leavePolicyId: policyId, leaveAnnual: p.annual ?? 21, leaveSick: p.sick ?? 30, leaveEmergency: p.emergency ?? 5
            });
        } else {
            await window.update(window.ref(window.db, 'ledger/employees/' + empKey), { leavePolicyId: '' });
        }
        toast('✓ تم الإسناد', 'ok');
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.lpBulkAssign = async function (all) {
    const policyId = document.getElementById('lpBulkSel')?.value; if (!policyId) { toast('اختر سياسة', 'er'); return; }
    const p = lpAll()[policyId]; if (!p) return;
    const emps = Object.entries(window.emp || {}).filter(([, e]) => (e.status || 'active') === 'active' && (all || !e.leavePolicyId));
    if (!emps.length) { toast('لا موظفين مطابقين', 'er'); return; }
    if (!(await cf2(`تطبيق سياسة «${p.name}» على ${emps.length} موظف؟ سيستبدل أرصدتهم الحالية.`))) return;
    try {
        const updates = {};
        emps.forEach(([k]) => { updates[`${k}/leavePolicyId`] = policyId; updates[`${k}/leaveAnnual`] = p.annual ?? 21; updates[`${k}/leaveSick`] = p.sick ?? 30; updates[`${k}/leaveEmergency`] = p.emergency ?? 5; });
        await window.update(window.R.emp, updates);
        toast(`✓ طُبّقت على ${emps.length} موظف`, 'ok');
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

console.log('✅ Leave-policies module loaded');
