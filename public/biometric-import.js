// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🖐️  استيراد ملف البصمة (Biometric Import) — بديل عملي لربط الأجهزة          ║
// ║  يقرأ تصدير جهاز البصمة (Excel/CSV): رقم وظيفي/اسم + تاريخ + وقت البصمة،      ║
// ║  يطابق الموظف، ويجمع أول بصمة=دخول وآخرها=خروج لكل يوم → سجلات حضور.          ║
// ║  وحدة ثانوية تعتمد على globals من app.js. البيانات تُعزَل تلقائياً للمستأجر.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

function bioEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function bioInp() { return 'padding:8px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box'; }
function bioPad(n) { return String(n).padStart(2, '0'); }
// كشف عمود من قائمة كلمات مفتاحية في الترويسة
function bioFindCol(headers, keys) {
    for (let i = 0; i < headers.length; i++) { const h = String(headers[i] || '').toLowerCase().trim(); if (keys.some(k => h.includes(k))) return i; }
    return -1;
}
// تطبيع تاريخ خلية (Date أو نص) → YYYY-MM-DD
function bioDateStr(v) {
    if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${bioPad(v.getMonth() + 1)}-${bioPad(v.getDate())}`;
    const s = String(v || '').trim(); if (!s) return '';
    let m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); if (m) return `${m[1]}-${bioPad(+m[2])}-${bioPad(+m[3])}`;
    m = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); if (m) return `${m[3]}-${bioPad(+m[2])}-${bioPad(+m[1])}`;
    return '';
}
// تطبيع وقت خلية (Date أو "HH:MM" أو كسر يوم) → دقائق منذ منتصف الليل، أو null
function bioTimeMins(v) {
    if (v instanceof Date && !isNaN(v)) return v.getHours() * 60 + v.getMinutes();
    if (typeof v === 'number' && v > 0 && v < 1) return Math.round(v * 24 * 60); // كسر يوم من Excel
    const s = String(v || '').trim(); const m = s.match(/(\d{1,2}):(\d{2})/); if (m) return (+m[1]) * 60 + (+m[2]);
    return null;
}
function bioMinsToISO(dateStr, mins) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60).toISOString();
}
// مطابقة معرّف/اسم البصمة بموظف
function bioMatchEmp(id, name) {
    const emps = window.emp || {};
    const idS = String(id || '').trim(), nmS = String(name || '').trim().toLowerCase();
    if (idS) { for (const k in emps) { if (String(emps[k].empId || '').trim() === idS) return { key: k, e: emps[k] }; } }
    if (nmS) { for (const k in emps) { if (String(emps[k].name || '').trim().toLowerCase() === nmS) return { key: k, e: emps[k] }; } }
    return null;
}

// بناء سجلات الحضور من مصفوفة صفوف (array-of-arrays، الصف 0 = ترويسة) — منطق قابل للاختبار
window.bioBuildRows = function (arr) {
    const headers = (arr[0] || []).map(h => String(h || ''));
    const idCol = bioFindCol(headers, ['الرقم', 'رقم', 'الوظيفي', 'id', 'ac-no', 'no', 'معرف', 'كود']);
    const nameCol = bioFindCol(headers, ['الاسم', 'اسم', 'name', 'الموظف']);
    const dateCol = bioFindCol(headers, ['التاريخ', 'تاريخ', 'date', 'day']);
    const timeCol = bioFindCol(headers, ['وقت', 'time', 'البصمة', 'punch', 'الساعة']);
    const dtCol = bioFindCol(headers, ['datetime', 'التاريخ والوقت', 'timestamp', 'الوقت والتاريخ']);
    if (idCol < 0 && nameCol < 0) return { error: 'لم يُعثر على عمود الرقم الوظيفي أو الاسم' };
    if (dateCol < 0 && dtCol < 0) return { error: 'لم يُعثر على عمود التاريخ' };
    const punches = {}; const unmatched = new Set();
    for (let r = 1; r < arr.length; r++) {
        const row = arr[r]; if (!row || !row.length) continue;
        const id = idCol >= 0 ? row[idCol] : ''; const name = nameCol >= 0 ? row[nameCol] : '';
        let dateStr = '', mins = null;
        if (dtCol >= 0) { dateStr = bioDateStr(row[dtCol]); mins = bioTimeMins(row[dtCol]); }
        if (!dateStr && dateCol >= 0) dateStr = bioDateStr(row[dateCol]);
        if (mins == null && timeCol >= 0) mins = bioTimeMins(row[timeCol]);
        if (!dateStr || mins == null) continue;
        const m = bioMatchEmp(id, name);
        if (!m) { if (id || name) unmatched.add(String(id || name)); continue; }
        const k = `${m.key}|${dateStr}`;
        if (!punches[k]) punches[k] = { empKey: m.key, name: m.e.name || name, date: dateStr, mins: [] };
        punches[k].mins.push(mins);
    }
    const existing = window.attendance || {};
    const rows = Object.values(punches).map(p => {
        const inM = Math.min(...p.mins), outM = Math.max(...p.mins);
        const hasOut = p.mins.length > 1 && outM > inM;
        const dup = Object.values(existing).some(a => a.employeeId === p.empKey && a.date === p.date);
        return { empKey: p.empKey, name: p.name, date: p.date, inM, outM: hasOut ? outM : null, hours: hasOut ? Math.round((outM - inM) / 60 * 100) / 100 : 0, dup };
    }).sort((a, b) => (a.date + a.name).localeCompare(b.date + b.name));
    return { rows, unmatched: [...unmatched] };
};

window.openBiometricImport = function () {
    bioEnsureModal();
    window._bioRows = null;
    document.getElementById('bioFileName').textContent = '';
    document.getElementById('bioPreview').innerHTML = '<div style="color:#aaa;text-align:center;padding:20px;font-size:12.5px">ارفع ملف البصمة لعرض المعاينة</div>';
    document.getElementById('bioSummary').innerHTML = '';
    const btn = document.getElementById('bioApplyBtn'); if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
    document.getElementById('bioModal').style.display = 'flex';
};
window.bioClose = function () { const m = document.getElementById('bioModal'); if (m) m.style.display = 'none'; };
function bioEnsureModal() {
    if (document.getElementById('bioModal')) return;
    const d = document.createElement('div');
    d.id = 'bioModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:820px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0;color:#2d6a9f;font-size:18px">🖐️ استيراد ملف البصمة</h3><button onclick="bioClose()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <div style="background:#eaf4fb;border-radius:10px;padding:10px 14px;font-size:12px;color:#2d6a9f;margin-bottom:14px;line-height:1.8">
            ارفع تصدير جهاز البصمة (Excel/CSV). يجب أن يحوي أعمدة: <b>الرقم الوظيفي</b> (أو الاسم) · <b>التاريخ</b> · <b>وقت البصمة</b> (سطر لكل بصمة).
            يُطابَق الموظف بالرقم الوظيفي ثم بالاسم، وتُجمع أول بصمة = دخول وآخرها = خروج لكل يوم. الأيام الموجودة مسبقاً تُتجاوز.
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
            <label class="btn b-b" style="cursor:pointer;font-weight:700">📂 اختر ملف البصمة<input type="file" accept=".xlsx,.xls,.csv" onchange="bioHandleFile(this)" style="display:none"></label>
            <button class="btn" onclick="bioTemplate()" style="background:#eef5fb;color:#2d6a9f;font-weight:700">⬇️ تحميل قالب</button>
            <span id="bioFileName" style="font-size:12px;color:#666"></span>
        </div>
        <div id="bioPreview" style="max-height:320px;overflow:auto;border:1px solid #eee;border-radius:8px"></div>
        <div id="bioSummary" style="margin-top:10px;font-size:12.5px;color:#555"></div>
        <div style="display:flex;gap:8px;margin-top:14px"><button class="btn b-g" id="bioApplyBtn" onclick="bioApply()" style="flex:1;font-weight:800" disabled>💾 إنشاء سجلات الحضور</button><button class="btn" onclick="bioClose()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.bioTemplate = function () {
    if (typeof XLSX === 'undefined') { toast('⚠️ مكتبة Excel غير محمّلة', 'er'); return; }
    const rows = [
        { 'الرقم الوظيفي': '1001', 'الاسم': 'محمد أحمد', 'التاريخ': '2026-07-13', 'وقت البصمة': '08:02' },
        { 'الرقم الوظيفي': '1001', 'الاسم': 'محمد أحمد', 'التاريخ': '2026-07-13', 'وقت البصمة': '17:05' },
        { 'الرقم الوظيفي': '1002', 'الاسم': 'سالم علي', 'التاريخ': '2026-07-13', 'وقت البصمة': '08:40' },
        { 'الرقم الوظيفي': '1002', 'الاسم': 'سالم علي', 'التاريخ': '2026-07-13', 'وقت البصمة': '16:30' }
    ];
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'البصمة'); XLSX.writeFile(wb, 'قالب_البصمة.xlsx');
};
window.bioHandleFile = function (input) {
    const file = input.files && input.files[0]; if (!file) return;
    if (typeof XLSX === 'undefined') { toast('⚠️ مكتبة Excel غير محمّلة', 'er'); return; }
    document.getElementById('bioFileName').textContent = file.name;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const arr = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (!arr.length) { toast('⚠️ الملف فارغ', 'er'); return; }
            const res = window.bioBuildRows(arr);
            if (res.error) { toast('⚠️ ' + res.error, 'er'); return; }
            window._bioRows = res.rows; window._bioUnmatched = res.unmatched;
            bioRenderPreview();
        } catch (e) { toast('❌ خطأ في قراءة الملف: ' + (e.message || e), 'er'); }
    };
    reader.readAsArrayBuffer(file);
    input.value = '';
};
window.bioRenderPreview = function () {
    const rows = window._bioRows || [];
    const create = rows.filter(r => !r.dup);
    const dup = rows.filter(r => r.dup).length;
    const unm = (window._bioUnmatched || []).length;
    const body = rows.length ? rows.map(r => `<tr style="${r.dup ? 'opacity:.5' : ''}">
        <td style="padding:5px 8px;border-bottom:1px solid #f2f2f2;white-space:nowrap">${r.date}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #f2f2f2">${bioEsc(r.name)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #f2f2f2;text-align:center">${bioPad(Math.floor(r.inM / 60))}:${bioPad(r.inM % 60)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #f2f2f2;text-align:center">${r.outM != null ? bioPad(Math.floor(r.outM / 60)) + ':' + bioPad(r.outM % 60) : '—'}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #f2f2f2;text-align:center;font-weight:700">${r.hours.toFixed(1)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #f2f2f2;text-align:center">${r.dup ? '<span style="color:#95a5a6">موجود مسبقاً</span>' : '<span style="color:#16a085">سيُنشأ</span>'}</td>
    </tr>`).join('') : '<tr><td colspan="6" style="padding:16px;text-align:center;color:#aaa">لا بصمات صالحة</td></tr>';
    document.getElementById('bioPreview').innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead style="position:sticky;top:0;background:#f4f7fa"><tr style="text-align:right"><th style="padding:7px 8px">التاريخ</th><th style="padding:7px 8px">الموظف</th><th style="padding:7px 8px;text-align:center">دخول</th><th style="padding:7px 8px;text-align:center">خروج</th><th style="padding:7px 8px;text-align:center">ساعات</th><th style="padding:7px 8px;text-align:center">الحالة</th></tr></thead>
        <tbody>${body}</tbody></table>`;
    document.getElementById('bioSummary').innerHTML = `سيُنشأ: <b style="color:#16a085">${create.length}</b> · موجود مسبقاً: <b>${dup}</b>${unm ? ` · <span style="color:#c0392b">${unm} غير مطابق (رقم/اسم غير موجود بالموظفين)</span>` : ''}`;
    const btn = document.getElementById('bioApplyBtn'); if (btn) { btn.disabled = create.length === 0; btn.style.opacity = create.length === 0 ? '.5' : '1'; }
};
window.bioApply = async function () {
    const create = (window._bioRows || []).filter(r => !r.dup);
    if (!create.length) { toast('⚠️ لا سجلات جديدة', 'er'); return; }
    let n = 0;
    try {
        for (const r of create) {
            const rec = {
                employeeId: r.empKey, employeeName: r.name, date: r.date,
                checkIn: bioMinsToISO(r.date, r.inM), checkOut: r.outM != null ? bioMinsToISO(r.date, r.outM) : null,
                totalHours: r.hours, source: 'biometric'
            };
            await window.push(window.R.att, rec); n++;
        }
        toast(`✅ تم إنشاء ${n} سجل حضور من البصمة`, 'ok');
        bioClose();
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

console.log('✅ Biometric-import module loaded');
