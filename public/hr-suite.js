// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🧩 HR Suite — إضافات الموارد البشرية                                        ║
// ║  وحدة ثانوية تعتمد على globals من app.js. بياناتها تُعزَل تلقائياً للمستأجر.   ║
// ║  1) 📄 خطابات الموارد البشرية (تعريف بالراتب/إثبات عمل/شهادة خبرة...)          ║
// ║  (تُضاف لاحقاً: تحليلات HR + السعودة، إعلانات الشركة، فترة التجربة والعقود)     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

function hsEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function hsInp() { return 'padding:8px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box'; }
function hsMoney(v) { return (typeof fmt === 'function') ? fmt(Number(v) || 0) : (Number(v) || 0).toLocaleString('en'); }
function hsCfg() { return window.gbrCfg || {}; }
function hsCoName() { return window.currentTenantName || hsCfg().companyAr || 'الشركة'; }
function hsMyName() { try { return (window.myP && window.myP.name) || (window.curU && window.curU.displayName) || 'إدارة الموارد البشرية'; } catch (e) { return 'إدارة الموارد البشرية'; } }
function hsToday() { return new Date().toISOString().slice(0, 10); }
function hsGDate(d) { try { return new Date((d || hsToday()) + 'T00:00:00').toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return d || ''; } }
function hsHDate(d) { try { return new Date((d || hsToday()) + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-islamic-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) + ' هـ'; } catch (e) { return ''; } }

// مجموع الراتب من مكوّناته المخزّنة على سجل الموظف
function hsSalaryParts(e) {
    const p = {
        basic: parseFloat(e.salary) || 0,
        house: parseFloat(e.houseAllow) || 0,
        trans: parseFloat(e.transAllow) || 0,
        phone: parseFloat(e.phoneAllow) || 0,
        nature: parseFloat(e.natureAllow) || 0,
        rep: parseFloat(e.repAllow) || 0
    };
    p.total = p.basic + p.house + p.trans + p.phone + p.nature + p.rep;
    return p;
}

// ═══════════════════════════════════════════════════════════════════════════
//  📄 خطابات الموارد البشرية
// ═══════════════════════════════════════════════════════════════════════════
const HS_LETTER_TYPES = {
    salary_cert:    { label: '💰 تعريف بالراتب', salary: true,  color: '#16a085' },
    employment:     { label: '🧾 خطاب تعريف / إثبات عمل', salary: false, color: '#2980b9' },
    salary_transfer:{ label: '🏦 تعريف لتحويل الراتب (بنك)', salary: true, color: '#8e44ad' },
    experience:     { label: '📜 شهادة خبرة', salary: false, color: '#e67e22' },
    embassy:        { label: '🛂 تعريف للسفارة / تأشيرة', salary: true, color: '#c0392b' }
};

function hsLetters() { return window.hrLetters || {}; }
function hsCanManage() { const p = window.myP; return p && (p.role === 'admin' || p.role === 'hr_officer' || (typeof can === 'function' && can('view_employees'))); }

window.renderHrLetters = function () {
    const c = document.getElementById('pg-hrletters'); if (!c) return;
    if (!hsCanManage()) { c.innerHTML = '<div class="card" style="padding:30px;text-align:center;color:#c0392b">🚫 هذه الصفحة متاحة للموارد البشرية فقط</div>'; return; }
    window._hsLet = window._hsLet || { emp: '', type: 'salary_cert', addr: '', purpose: '' };
    const f = window._hsLet;
    const all = Object.entries(hsLetters()).map(([k, v]) => ({ k, ...v }));
    const issued = all.filter(l => (l.status || 'issued') === 'issued').sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || ''));
    const pending = all.filter(l => l.status === 'pending').sort((a, b) => (a.requestedAt || '').localeCompare(b.requestedAt || ''));

    const empOpts = Object.entries(window.emp || {}).filter(([, e]) => (e.status || 'active') === 'active' || !e.status)
        .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'))
        .map(([k, e]) => `<option value="${k}" ${f.emp === k ? 'selected' : ''}>${hsEsc(e.name)}${e.empId ? ' · ' + hsEsc(e.empId) : ''}</option>`).join('');
    const typeOpts = Object.entries(HS_LETTER_TYPES).map(([t, d]) => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${esc(d.label)}</option>`).join('');

    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;

    const statusBadge = l => l.status === 'pending'
        ? '<span style="background:#fef9e7;color:#b9770e;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">⏳ طلب موظف</span>'
        : '<span style="background:#eafaf1;color:#1e8449;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">✅ صادر</span>';

    const listRow = l => {
        const t = HS_LETTER_TYPES[l.type] || HS_LETTER_TYPES.employment;
        const e = (window.emp || {})[l.empKey] || {};
        return `<tr style="border-bottom:1px solid #f2f5f8">
            <td style="padding:8px 10px;font-weight:700">${hsEsc(l.empName || e.name || '—')}</td>
            <td style="padding:8px 10px;color:${t.color};font-weight:700;font-size:12px">${esc(t.label)}</td>
            <td style="padding:8px 10px;color:#666;font-size:12px">${hsEsc(l.addressee || 'لمن يهمه الأمر')}</td>
            <td style="padding:8px 10px;color:#888;font-size:11px;white-space:nowrap">${(l.issuedAt || l.requestedAt || '').slice(0, 10)}</td>
            <td style="padding:8px 10px;text-align:center">${statusBadge(l)}</td>
            <td style="padding:8px 10px;text-align:center;white-space:nowrap">
                <button class="btn" onclick="hsPrintLetter('${l.k}')" style="font-size:11px;padding:4px 9px;background:#eef5fb;color:#2d6a9f">🖨️ عرض/طباعة</button>
                ${l.status === 'pending' ? `<button class="btn b-g" onclick="hsIssuePending('${l.k}')" style="font-size:11px;padding:4px 9px">✅ إصدار</button>` : ''}
                <button class="btn b-r" onclick="hsDeleteLetter('${l.k}')" style="font-size:11px;padding:4px 9px">🗑️</button>
            </td>
        </tr>`;
    };

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">📄 خطابات الموارد البشرية</div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('📋', 'خطابات صادرة', issued.length, '#2980b9')}
            ${kpi('⏳', 'طلبات موظفين معلّقة', pending.length, pending.length ? '#e67e22' : '#95a5a6')}
            ${kpi('👷', 'الموظفون', Object.keys(window.emp || {}).length, '#8e44ad')}
        </div>

        <div class="card" style="margin-bottom:16px;border-right:5px solid #16a085">
            <div class="c-tl">✍️ إصدار خطاب جديد</div>
            <div class="form-grid">
                <div class="fg"><label>الموظف *</label><select id="hsLetEmp" onchange="window._hsLet.emp=this.value">${empOpts ? '<option value="">— اختر —</option>' + empOpts : '<option value="">لا يوجد موظفون</option>'}</select></div>
                <div class="fg"><label>نوع الخطاب *</label><select id="hsLetType" onchange="window._hsLet.type=this.value">${typeOpts}</select></div>
                <div class="fg"><label>موجّه إلى (الجهة)</label><input id="hsLetAddr" placeholder="لمن يهمه الأمر / بنك... / سفارة..." value="${hsEsc(f.addr)}"></div>
                <div class="fg"><label>الغرض (اختياري)</label><input id="hsLetPurpose" placeholder="مثال: فتح حساب بنكي / استخراج تأشيرة" value="${hsEsc(f.purpose)}"></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:6px">
                <button class="btn b-g" onclick="hsIssueLetter()" style="font-weight:800">📄 إصدار وطباعة</button>
                <span style="font-size:11.5px;color:#8a97a5;align-self:center">يُنشأ الخطاب برقم مرجعي ويُحفظ في السجل أدناه.</span>
            </div>
        </div>

        ${pending.length ? `<div class="card" style="margin-bottom:16px;border-right:5px solid #e67e22">
            <div class="c-tl">⏳ طلبات خطابات من الموظفين (${pending.length})</div>
            <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#fef6ee;text-align:right;color:#7d4e00"><th style="padding:8px 10px">الموظف</th><th style="padding:8px 10px">النوع</th><th style="padding:8px 10px">الجهة</th><th style="padding:8px 10px">التاريخ</th><th style="padding:8px 10px;text-align:center">الحالة</th><th style="padding:8px 10px;text-align:center">إجراء</th></tr></thead>
                <tbody>${pending.map(listRow).join('')}</tbody>
            </table></div>
        </div>` : ''}

        <div class="card">
            <div class="c-tl">🗂️ سجل الخطابات الصادرة</div>
            ${issued.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#f0f5fa;text-align:right;color:#1a3a5c"><th style="padding:8px 10px">الموظف</th><th style="padding:8px 10px">النوع</th><th style="padding:8px 10px">الجهة</th><th style="padding:8px 10px">التاريخ</th><th style="padding:8px 10px;text-align:center">الحالة</th><th style="padding:8px 10px;text-align:center">إجراء</th></tr></thead>
                <tbody>${issued.map(listRow).join('')}</tbody>
            </table></div>` : '<div style="color:#aaa;text-align:center;padding:22px">لا خطابات صادرة بعد — أصدر أول خطاب من الأعلى.</div>'}
        </div>
    </div>`;
};

// إنشاء رقم مرجعي بسيط للخطاب
function hsRefNo() { const d = new Date(); return `HR-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`; }

window.hsIssueLetter = async function () {
    const empKey = document.getElementById('hsLetEmp')?.value;
    const type = document.getElementById('hsLetType')?.value || 'salary_cert';
    const addressee = document.getElementById('hsLetAddr')?.value.trim() || '';
    const purpose = document.getElementById('hsLetPurpose')?.value.trim() || '';
    if (!empKey) { toast('⚠️ اختر الموظف', 'er'); return; }
    const e = (window.emp || {})[empKey]; if (!e) { toast('الموظف غير موجود', 'er'); return; }
    const rec = { empKey, empName: e.name || '', type, addressee, purpose, refNo: hsRefNo(), status: 'issued', issuedBy: hsMyName(), issuedAt: new Date().toISOString() };
    try {
        const r = await window.push(window.R.hrLetters, rec);
        toast('✅ صدر الخطاب — جارٍ فتح نسخة الطباعة', 'ok');
        hsOpenLetterWindow({ k: r.key, ...rec }, e);
    } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};

window.hsIssuePending = async function (key) {
    const l = hsLetters()[key]; if (!l) return;
    try {
        await window.update(window.ref(window.db, 'ledger/hrLetters/' + key), { status: 'issued', refNo: l.refNo || hsRefNo(), issuedBy: hsMyName(), issuedAt: new Date().toISOString() });
        toast('✅ تم إصدار الخطاب المطلوب', 'ok');
        const e = (window.emp || {})[l.empKey] || {};
        hsOpenLetterWindow({ ...l, k: key, status: 'issued' }, e);
    } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};

window.hsDeleteLetter = function (key) {
    cf2('حذف هذا الخطاب من السجل؟', async () => {
        try { await window.remove(window.ref(window.db, 'ledger/hrLetters/' + key)); toast('حُذف', 'ok'); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
    });
};

window.hsPrintLetter = function (key) {
    const l = hsLetters()[key]; if (!l) { toast('الخطاب غير موجود', 'er'); return; }
    const e = (window.emp || {})[l.empKey] || {};
    hsOpenLetterWindow({ ...l, k: key }, e);
};

// نصّ جسم الخطاب حسب النوع
function hsLetterBody(type, e, l) {
    const name = hsEsc(e.name || '—');
    const job = hsEsc(e.job || 'موظف');
    const dept = e.dept ? ` بقسم ${hsEsc(e.dept)}` : '';
    const nat = hsEsc(e.nationality || '—');
    const idNo = hsEsc(e.iqama || e.iqamaNo || e.nationalId || '—');
    const empId = hsEsc(e.empId || '—');
    const hire = e.hireDate || e.joinDate ? hsGDate((e.hireDate || e.joinDate)) : '—';
    const co = hsEsc(hsCoName());
    const purpose = l.purpose ? ` وذلك بغرض <b>${hsEsc(l.purpose)}</b>` : '';
    switch (type) {
        case 'experience':
            return `تشهد <b>${co}</b> بأن السيد/ة <b>${name}</b> (${nat}) — هوية/إقامة رقم <b>${idNo}</b> — قد عمل لديها بوظيفة <b>${job}</b>${dept}، اعتباراً من تاريخ <b>${hire}</b>، وقد أظهر خلال فترة عمله كفاءةً وحسن سلوك.<br><br>وقد مُنح هذه الشهادة بناءً على طلبه${purpose}، دون أدنى مسؤولية على الشركة.`;
        case 'salary_transfer':
            return `تفيد <b>${co}</b> بأن السيد/ة <b>${name}</b> — الرقم الوظيفي <b>${empId}</b>، هوية/إقامة رقم <b>${idNo}</b> — يعمل لدينا بوظيفة <b>${job}</b>${dept} براتبٍ شهري إجمالي قدره الموضّح أدناه.<br><br>ولا مانع لدينا من تحويل راتبه الشهري إلى حسابه المصرفي${purpose}. حُرّر هذا التعريف بناءً على طلبه.`;
        case 'embassy':
            return `تشهد <b>${co}</b> بأن السيد/ة <b>${name}</b> (${nat}) — هوية/إقامة رقم <b>${idNo}</b> — يعمل لدينا بوظيفة <b>${job}</b>${dept} منذ تاريخ <b>${hire}</b>، براتبٍ شهري موضّح أدناه، وأنه على رأس عمله لدينا.<br><br>ونأمل من سعادتكم التكرّم بمنحه ما يلزم${purpose}. وله حقّ العودة إلى وظيفته بعد انتهاء إجازته.`;
        case 'salary_cert':
            return `تشهد <b>${co}</b> بأن السيد/ة <b>${name}</b> — الرقم الوظيفي <b>${empId}</b>، هوية/إقامة رقم <b>${idNo}</b> — يعمل لدينا بوظيفة <b>${job}</b>${dept} منذ تاريخ <b>${hire}</b>، ويتقاضى راتباً شهرياً إجمالياً موضّحاً في الجدول أدناه${purpose}.<br><br>وقد أُعطي هذا التعريف بناءً على طلبه دون أدنى مسؤولية على الشركة.`;
        default: // employment
            return `تشهد <b>${co}</b> بأن السيد/ة <b>${name}</b> (${nat}) — الرقم الوظيفي <b>${empId}</b>، هوية/إقامة رقم <b>${idNo}</b> — يعمل لدينا بوظيفة <b>${job}</b>${dept}، وهو على رأس عمله لدينا اعتباراً من تاريخ <b>${hire}</b>${purpose}.<br><br>وقد مُنح هذا الخطاب بناءً على طلبه دون أدنى مسؤولية على الشركة.`;
    }
}

function hsOpenLetterWindow(l, e) {
    const cfg = hsCfg();
    const t = HS_LETTER_TYPES[l.type] || HS_LETTER_TYPES.employment;
    const co = hsEsc(hsCoName());
    const coEn = hsEsc(cfg.companyEn || '');
    const sub = [cfg.cr ? 'س.ت: ' + hsEsc(cfg.cr) : '', cfg.vat ? 'ض.ق.م: ' + hsEsc(cfg.vat) : '', cfg.phone ? '📞 ' + hsEsc(cfg.phone) : '', cfg.address ? hsEsc(cfg.address) : ''].filter(Boolean).join(' · ');
    const p = hsSalaryParts(e);
    const salaryTable = t.salary ? `
        <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:13px">
            <thead><tr style="background:#f0f5fa"><th style="border:1px solid #d9e2ec;padding:8px;text-align:right">مكوّن الراتب</th><th style="border:1px solid #d9e2ec;padding:8px;text-align:left;width:140px">المبلغ (ر.س)</th></tr></thead>
            <tbody>
                <tr><td style="border:1px solid #d9e2ec;padding:7px">الراتب الأساسي</td><td style="border:1px solid #d9e2ec;padding:7px;text-align:left">${hsMoney(p.basic)}</td></tr>
                ${p.house ? `<tr><td style="border:1px solid #d9e2ec;padding:7px">بدل السكن</td><td style="border:1px solid #d9e2ec;padding:7px;text-align:left">${hsMoney(p.house)}</td></tr>` : ''}
                ${p.trans ? `<tr><td style="border:1px solid #d9e2ec;padding:7px">بدل النقل</td><td style="border:1px solid #d9e2ec;padding:7px;text-align:left">${hsMoney(p.trans)}</td></tr>` : ''}
                ${p.phone ? `<tr><td style="border:1px solid #d9e2ec;padding:7px">بدل الهاتف</td><td style="border:1px solid #d9e2ec;padding:7px;text-align:left">${hsMoney(p.phone)}</td></tr>` : ''}
                ${p.nature ? `<tr><td style="border:1px solid #d9e2ec;padding:7px">بدل طبيعة عمل</td><td style="border:1px solid #d9e2ec;padding:7px;text-align:left">${hsMoney(p.nature)}</td></tr>` : ''}
                ${p.rep ? `<tr><td style="border:1px solid #d9e2ec;padding:7px">بدل تمثيل</td><td style="border:1px solid #d9e2ec;padding:7px;text-align:left">${hsMoney(p.rep)}</td></tr>` : ''}
                <tr style="background:#eafaf1;font-weight:800"><td style="border:1px solid #d9e2ec;padding:8px">الإجمالي الشهري</td><td style="border:1px solid #d9e2ec;padding:8px;text-align:left">${hsMoney(p.total)}</td></tr>
            </tbody>
        </table>` : '';

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet"><meta charset="utf-8"><title>${esc(t.label)} — ${hsEsc(e.name || '')}</title>
    <style>
      @page { margin: 18mm; }
      body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color:#1a2733; direction:rtl; padding:24px; max-width:820px; margin:0 auto; line-height:2 }
      .hd { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #16679a; padding-bottom:14px; margin-bottom:6px }
      .co { font-size:22px; font-weight:900; color:#16679a }
      .coen { font-size:12px; color:#7b8a99; margin-top:2px; direction:ltr; text-align:right }
      .sub { font-size:10.5px; color:#7b8a99; margin-top:6px }
      .meta { font-size:11.5px; color:#5b6b7b; text-align:left; white-space:nowrap }
      h1 { text-align:center; font-size:19px; color:#16679a; margin:22px 0 6px; text-decoration:underline }
      .addr { font-weight:800; margin:14px 0 4px }
      .body { font-size:14px; text-align:justify }
      .sign { margin-top:46px; display:flex; justify-content:space-between; align-items:flex-end }
      .stamp { width:150px; height:80px; border:1.5px dashed #c3ccd6; border-radius:8px; color:#aab4bf; font-size:11px; display:flex; align-items:center; justify-content:center }
      .noprint { margin-top:26px; text-align:center }
      @media print { .noprint { display:none } body { padding:0 } }
    </style></head><body>
      <div class="hd">
        <div><div class="co">${co}</div>${coEn ? `<div class="coen">${coEn}</div>` : ''}<div class="sub">${sub || ''}</div></div>
        <div class="meta">الرقم المرجعي: <b>${hsEsc(l.refNo || '')}</b><br>التاريخ: ${hsGDate(hsToday())}<br>الموافق: ${hsHDate(hsToday())}</div>
      </div>
      <h1>${t.label.replace(/^[^ ]+ /, '')}</h1>
      <div class="addr">إلى: ${hsEsc(l.addressee || 'من يهمّه الأمر')}</div>
      <div class="addr" style="font-weight:900">السلام عليكم ورحمة الله وبركاته،،</div>
      <div class="body">${hsLetterBody(l.type, e, l)}</div>
      ${salaryTable}
      <div class="body">وتفضلوا بقبول فائق الاحترام والتقدير،،</div>
      <div class="sign">
        <div style="text-align:center;font-size:13px"><div style="font-weight:800">${hsEsc(hsCoName())}</div><div style="color:#5b6b7b;margin-top:2px">إدارة الموارد البشرية</div><div style="margin-top:2px">${hsEsc(l.issuedBy || hsMyName())}</div></div>
        <div class="stamp">ختم الشركة</div>
      </div>
      <div class="noprint"><button onclick="window.print()" style="background:#16679a;color:#fff;border:none;padding:9px 26px;border-radius:8px;cursor:pointer;font-size:14px;font-family:inherit">🖨️ طباعة / حفظ PDF</button></div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast('السماح بالنوافذ المنبثقة مطلوب للطباعة', 'er'); return; }
    w.document.write(html); w.document.close();
}

// ── طلب خطاب من الخدمة الذاتية (يظهر كطلب معلّق لدى الموارد البشرية) ──
window.essRequestLetter = async function () {
    const me = (typeof myEmpContext === 'function') ? myEmpContext() : null;
    if (!me) { toast('حسابك غير مرتبط بسجل موظف', 'er'); return; }
    const type = document.getElementById('essLetterType')?.value || 'salary_cert';
    const addressee = document.getElementById('essLetterAddr')?.value.trim() || '';
    const purpose = document.getElementById('essLetterPurpose')?.value.trim() || '';
    try {
        await window.push(window.R.hrLetters, { empKey: me.key, empName: me.data.name || '', type, addressee, purpose, status: 'pending', requestedAt: new Date().toISOString(), viaSelfService: true });
        toast('✅ أُرسل طلب الخطاب — بانتظار إصداره من الموارد البشرية', 'ok');
        if (document.getElementById('essLetterAddr')) document.getElementById('essLetterAddr').value = '';
        if (document.getElementById('essLetterPurpose')) document.getElementById('essLetterPurpose').value = '';
    } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};
// خيارات نوع الخطاب للخدمة الذاتية (تُستخدم في app.js)
window.hsLetterTypeOptions = function () { return Object.entries(HS_LETTER_TYPES).map(([t, d]) => `<option value="${t}">${esc(d.label)}</option>`).join(''); };
window.hsLetterLabel = function (t) { return (HS_LETTER_TYPES[t] || HS_LETTER_TYPES.employment).label; };

// ═══════════════════════════════════════════════════════════════════════════
//  ⏳ فترة التجربة وتجديد العقود
// ═══════════════════════════════════════════════════════════════════════════
function hsAddMonths(dateStr, m) { const d = new Date((dateStr || hsToday()) + 'T00:00:00'); if (isNaN(d)) return null; d.setMonth(d.getMonth() + (parseInt(m) || 0)); return d.toISOString().slice(0, 10); }
function hsDaysTo(dateStr) { if (!dateStr) return null; const d = new Date(dateStr + 'T00:00:00'); if (isNaN(d)) return null; return Math.ceil((d - new Date(hsToday() + 'T00:00:00')) / 86400000); }
// حساب معلومات فترة التجربة لموظف (وفق نظام العمل السعودي: افتراضياً 90 يوماً)
function hsProbationInfo(e) {
    const hire = e.hireDate || e.joinDate; if (!hire) return null;
    const months = (e.probationMonths != null && e.probationMonths !== '') ? parseInt(e.probationMonths) : 3;
    if (!months) return null;
    const end = hsAddMonths(hire, months);
    return { end, days: hsDaysTo(end), months, confirmed: !!e.probationConfirmed };
}

window.renderProbation = function () {
    const c = document.getElementById('pg-probation'); if (!c) return;
    if (!hsCanManage()) { c.innerHTML = '<div class="card" style="padding:30px;text-align:center;color:#c0392b">🚫 هذه الصفحة متاحة للموارد البشرية فقط</div>'; return; }
    const active = Object.entries(window.emp || {}).filter(([, e]) => (e.status || 'active') === 'active');
    // فترة التجربة: تظهر إن لم تُؤكَّد وباقٍ لها ≤ 30 يوماً أو انتهت
    const prob = active.map(([k, e]) => ({ k, e, p: hsProbationInfo(e) })).filter(x => x.p && !x.p.confirmed && x.p.days != null && x.p.days <= 30)
        .sort((a, b) => a.p.days - b.p.days);
    // العقود: contractEnd خلال 60 يوماً أو منتهٍ
    const cons = active.map(([k, e]) => ({ k, e, days: hsDaysTo(e.contractEnd) })).filter(x => x.e.contractEnd && x.days != null && x.days <= 60)
        .sort((a, b) => a.days - b.days);

    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;
    const daysBadge = d => { const col = d < 0 ? '#c0392b' : d <= 7 ? '#e67e22' : d <= 30 ? '#b9770e' : '#16a085'; const txt = d < 0 ? `منذ ${Math.abs(d)} يوم` : d === 0 ? 'اليوم' : `خلال ${d} يوم`; return `<span style="background:${col}18;color:${col};padding:3px 9px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap">${txt}</span>`; };

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">⏳ فترة التجربة وتجديد العقود</div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('⏳', 'فترات تجربة تنتهي قريباً', prob.length, prob.length ? '#e67e22' : '#95a5a6')}
            ${kpi('📄', 'عقود تحتاج تجديداً', cons.length, cons.length ? '#c0392b' : '#95a5a6')}
        </div>

        <div class="card" style="margin-bottom:16px;border-right:5px solid #e67e22">
            <div class="c-tl">⏳ فترات التجربة (وفق نظام العمل — افتراضياً 90 يوماً)</div>
            ${prob.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#fef6ee;text-align:right;color:#7d4e00"><th style="padding:8px 10px">الموظف</th><th style="padding:8px 10px">المباشرة</th><th style="padding:8px 10px">مدة التجربة</th><th style="padding:8px 10px">تنتهي في</th><th style="padding:8px 10px;text-align:center">المتبقّي</th><th style="padding:8px 10px;text-align:center">إجراء</th></tr></thead>
                <tbody>${prob.map(x => `<tr style="border-bottom:1px solid #f2f5f8">
                    <td style="padding:8px 10px;font-weight:700">${hsEsc(x.e.name || '—')}${x.e.job ? `<div style="font-size:10.5px;color:#95a5a6">${hsEsc(x.e.job)}</div>` : ''}</td>
                    <td style="padding:8px 10px;color:#666;font-size:12px">${hsEsc(x.e.hireDate || x.e.joinDate || '—')}</td>
                    <td style="padding:8px 10px;color:#666">${x.p.months} شهر</td>
                    <td style="padding:8px 10px;font-weight:700">${hsEsc(x.p.end)}</td>
                    <td style="padding:8px 10px;text-align:center">${daysBadge(x.p.days)}</td>
                    <td style="padding:8px 10px;text-align:center;white-space:nowrap">
                        <button class="btn b-g" onclick="hsConfirmProbation('${x.k}')" style="font-size:11px;padding:4px 9px">✅ تثبيت</button>
                        <button class="btn" onclick="hsExtendProbation('${x.k}')" style="font-size:11px;padding:4px 9px;background:#eef5fb;color:#2d6a9f">➕ تمديد</button>
                    </td>
                </tr>`).join('')}</tbody>
            </table></div>` : '<div style="color:#16a085;text-align:center;padding:18px;font-weight:600">✅ لا فترات تجربة تنتهي قريباً</div>'}
        </div>

        <div class="card" style="border-right:5px solid #c0392b">
            <div class="c-tl">📄 العقود التي تحتاج تجديداً (خلال 60 يوماً)</div>
            ${cons.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#fdeeee;text-align:right;color:#922"><th style="padding:8px 10px">الموظف</th><th style="padding:8px 10px">القسم</th><th style="padding:8px 10px">انتهاء العقد</th><th style="padding:8px 10px;text-align:center">المتبقّي</th><th style="padding:8px 10px;text-align:center">إجراء</th></tr></thead>
                <tbody>${cons.map(x => `<tr style="border-bottom:1px solid #f2f5f8">
                    <td style="padding:8px 10px;font-weight:700">${hsEsc(x.e.name || '—')}${x.e.job ? `<div style="font-size:10.5px;color:#95a5a6">${hsEsc(x.e.job)}</div>` : ''}</td>
                    <td style="padding:8px 10px;color:#666;font-size:12px">${hsEsc(x.e.dept || '—')}</td>
                    <td style="padding:8px 10px;font-weight:700">${hsEsc(x.e.contractEnd)}</td>
                    <td style="padding:8px 10px;text-align:center">${daysBadge(x.days)}</td>
                    <td style="padding:8px 10px;text-align:center"><button class="btn b-g" onclick="hsRenewContract('${x.k}')" style="font-size:11px;padding:4px 9px">🔁 تجديد</button></td>
                </tr>`).join('')}</tbody>
            </table></div>` : '<div style="color:#16a085;text-align:center;padding:18px;font-weight:600">✅ لا عقود تحتاج تجديداً قريباً</div>'}
        </div>
    </div>`;
};

function hsUpdateEmp(key, vals) { return window.update(window.ref(window.db, 'ledger/employees/' + key), vals); }
window.hsConfirmProbation = function (key) {
    const e = (window.emp || {})[key] || {};
    cf2(`تثبيت الموظف «${hsEsc(e.name || '')}» واعتماد اجتيازه فترة التجربة؟`, async () => {
        try { await hsUpdateEmp(key, { probationConfirmed: true, probationConfirmedAt: hsToday(), probationConfirmedBy: hsMyName() }); toast('✅ تم التثبيت', 'ok'); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
    });
};
window.hsExtendProbation = async function (key) {
    const e = (window.emp || {})[key] || {};
    const cur = (e.probationMonths != null && e.probationMonths !== '') ? parseInt(e.probationMonths) : 3;
    const v = window.prompt(`إجمالي مدة فترة التجربة بالأشهر للموظف «${e.name || ''}» (الحد النظامي 6 أشهر):`, String(cur));
    if (v == null) return;
    const m = parseInt(v); if (isNaN(m) || m < 0) { toast('قيمة غير صحيحة', 'er'); return; }
    if (m > 6) { toast('⚠️ الحد النظامي لفترة التجربة 180 يوماً (6 أشهر)', 'wn'); }
    try { await hsUpdateEmp(key, { probationMonths: m }); toast('✅ تم تحديث مدة التجربة', 'ok'); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};
window.hsRenewContract = async function (key) {
    const e = (window.emp || {})[key] || {};
    const v = window.prompt(`تاريخ انتهاء العقد الجديد للموظف «${e.name || ''}» (YYYY-MM-DD):`, e.contractEnd || '');
    if (v == null) return;
    const d = String(v).trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast('صيغة التاريخ يجب أن تكون YYYY-MM-DD', 'er'); return; }
    try { await hsUpdateEmp(key, { contractEnd: d }); toast('✅ تم تجديد العقد', 'ok'); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  📢 إعلانات الشركة
// ═══════════════════════════════════════════════════════════════════════════
const HS_ANN_PRIORITY = { normal: { label: '🔵 عادي', color: '#2d6a9f' }, important: { label: '🟠 مهم', color: '#e67e22' }, urgent: { label: '🔴 عاجل', color: '#c0392b' } };
function hsAnns() { return window.announcements || {}; }
// الإعلانات الفعّالة (غير المنتهية) — تُستخدم في الخدمة الذاتية ولوحة التحكم
window.hsActiveAnnouncements = function () {
    const today = hsToday();
    return Object.entries(hsAnns()).map(([k, a]) => ({ k, ...a }))
        .filter(a => a.active !== false && (!a.expiry || a.expiry >= today))
        .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
};

window.renderAnnouncements = function () {
    const c = document.getElementById('pg-announcements'); if (!c) return;
    if (!hsCanManage()) { c.innerHTML = '<div class="card" style="padding:30px;text-align:center;color:#c0392b">🚫 هذه الصفحة متاحة للموارد البشرية فقط</div>'; return; }
    const all = Object.entries(hsAnns()).map(([k, a]) => ({ k, ...a })).sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
    const active = window.hsActiveAnnouncements();
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;
    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">📢 إعلانات الشركة</div>
            <button class="btn b-g" onclick="hsOpenAnnounce()" style="font-weight:800">➕ إعلان جديد</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('📢', 'إعلانات فعّالة', active.length, '#16a085')}
            ${kpi('🗂️', 'إجمالي الإعلانات', all.length, '#2980b9')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
        ${all.length ? all.map(a => {
        const pr = HS_ANN_PRIORITY[a.priority || 'normal'] || HS_ANN_PRIORITY.normal;
        const expired = a.expiry && a.expiry < hsToday();
        const off = a.active === false;
        return `<div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden;border-top:3px solid ${pr.color};opacity:${off || expired ? '.6' : '1'}">
            <div style="padding:12px 14px;border-bottom:1px solid #f0f0f0">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                    <div style="font-weight:800;color:${pr.color};font-size:14px">${hsEsc(a.title || 'إعلان')}</div>
                    <span style="font-size:10px;color:${pr.color};background:${pr.color}18;border-radius:8px;padding:2px 8px;white-space:nowrap">${esc(pr.label)}</span>
                </div>
                <div style="font-size:10.5px;color:#95a5a6;margin-top:3px">${(a.date || a.createdAt || '').slice(0, 10)}${a.expiry ? ` · ينتهي ${a.expiry}` : ''}${off ? ' · موقوف' : expired ? ' · منتهٍ' : ''}</div>
            </div>
            <div style="padding:11px 14px;font-size:12.5px;color:#556;line-height:1.8;white-space:pre-wrap;min-height:42px">${hsEsc(a.body || '')}</div>
            <div style="padding:8px 14px;border-top:1px solid #f5f5f5;display:flex;gap:6px;justify-content:flex-end">
                <button class="btn" onclick="hsOpenAnnounce('${a.k}')" style="font-size:11px;padding:4px 9px">✏️ تعديل</button>
                <button class="btn" onclick="hsToggleAnnounce('${a.k}',${a.active === false})" style="font-size:11px;padding:4px 9px;background:#eef5fb;color:#2d6a9f">${a.active === false ? '▶️ تفعيل' : '⏸️ إيقاف'}</button>
                <button class="btn b-r" onclick="hsDeleteAnnounce('${a.k}')" style="font-size:11px;padding:4px 9px">🗑️</button>
            </div>
        </div>`;
    }).join('') : '<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:24px">لا إعلانات — أنشئ أول إعلان ليظهر للموظفين في خدمتهم الذاتية.</div>'}
        </div>
    </div>`;
};

function hsEnsureAnnModal() {
    if (document.getElementById('hsAnnModal')) return;
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const prOpts = Object.entries(HS_ANN_PRIORITY).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
    const d = document.createElement('div');
    d.id = 'hsAnnModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 id="hsAnnTitle" style="margin:0;color:#16a085;font-size:18px">📢 إعلان جديد</h3><button onclick="hsCloseAnnounce()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <input id="hsAnnKey" type="hidden">
        ${fg('العنوان *', `<input id="hsAnnTitleIn" placeholder="مثال: إجازة عيد الأضحى" style="width:100%;${hsInp()}">`)}
        ${fg('النص', `<textarea id="hsAnnBody" rows="4" placeholder="تفاصيل الإعلان..." style="width:100%;${hsInp()};resize:vertical"></textarea>`)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('الأهمية', `<select id="hsAnnPr" style="width:100%;${hsInp()}">${prOpts}</select>`)}
            ${fg('ينتهي في (اختياري)', `<input id="hsAnnExpiry" type="date" style="width:100%;${hsInp()}">`)}
        </div>
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn b-g" onclick="hsSaveAnnounce()" style="flex:1;font-weight:800">💾 نشر</button><button class="btn" onclick="hsCloseAnnounce()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.hsOpenAnnounce = function (key) {
    hsEnsureAnnModal();
    const a = key ? hsAnns()[key] : null;
    document.getElementById('hsAnnKey').value = key || '';
    document.getElementById('hsAnnTitle').textContent = a ? '✏️ تعديل إعلان' : '📢 إعلان جديد';
    document.getElementById('hsAnnTitleIn').value = a?.title || '';
    document.getElementById('hsAnnBody').value = a?.body || '';
    document.getElementById('hsAnnPr').value = a?.priority || 'normal';
    document.getElementById('hsAnnExpiry').value = a?.expiry || '';
    document.getElementById('hsAnnModal').style.display = 'flex';
};
window.hsCloseAnnounce = function () { const m = document.getElementById('hsAnnModal'); if (m) m.style.display = 'none'; };
window.hsSaveAnnounce = async function () {
    const key = document.getElementById('hsAnnKey').value;
    const title = document.getElementById('hsAnnTitleIn').value.trim();
    if (!title) { toast('⚠️ العنوان مطلوب', 'er'); return; }
    const data = { title, body: document.getElementById('hsAnnBody').value.trim(), priority: document.getElementById('hsAnnPr').value, expiry: document.getElementById('hsAnnExpiry').value || '', active: true, updatedAt: new Date().toISOString() };
    try {
        if (key) await window.update(window.ref(window.db, 'ledger/announcements/' + key), data);
        else await window.push(window.R.announcements, { ...data, date: hsToday(), createdBy: hsMyName(), createdAt: new Date().toISOString() });
        toast('✅ تم النشر', 'ok'); hsCloseAnnounce();
    } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};
window.hsToggleAnnounce = async function (key, on) {
    try { await window.update(window.ref(window.db, 'ledger/announcements/' + key), { active: !!on }); toast(on ? 'فُعّل' : 'أُوقف', 'ok'); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};
window.hsDeleteAnnounce = function (key) {
    cf2('حذف هذا الإعلان؟', async () => { try { await window.remove(window.ref(window.db, 'ledger/announcements/' + key)); toast('حُذف', 'ok'); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); } });
};

// ═══════════════════════════════════════════════════════════════════════════
//  📊 تحليلات الموارد البشرية + السعودة (نطاقات)
// ═══════════════════════════════════════════════════════════════════════════
function hsIsSaudi(nat) { return /^\s*(سعودي|سعوديه|سعودية|saudi|ksa)/i.test(String(nat || '')); }
function hsIsActive(e) { return (e.status || 'active') === 'active'; }
function hsTenureYears(e) { const h = e.hireDate || e.joinDate; if (!h) return null; const d = new Date(h); if (isNaN(d)) return null; return (Date.now() - d.getTime()) / (365.25 * 86400000); }
// نطاق السعودة التقريبي (يعتمد فعلياً على نشاط المنشأة وحجمها لدى وزارة الموارد البشرية)
function hsNitaqatBand(pct) {
    if (pct >= 40) return { label: 'بلاتيني', color: '#7f8c8d', bg: '#ecf0f1' };
    if (pct >= 30) return { label: 'أخضر مرتفع', color: '#1e8449', bg: '#eafaf1' };
    if (pct >= 20) return { label: 'أخضر متوسط', color: '#27ae60', bg: '#eafaf1' };
    if (pct >= 10) return { label: 'أخضر منخفض', color: '#2ecc71', bg: '#f0faf3' };
    if (pct >= 5)  return { label: 'أصفر', color: '#b9770e', bg: '#fef9e7' };
    return { label: 'أحمر', color: '#c0392b', bg: '#fdecea' };
}

window.renderHrAnalytics = function () {
    const c = document.getElementById('pg-hranalytics'); if (!c) return;
    if (!hsCanManage()) { c.innerHTML = '<div class="card" style="padding:30px;text-align:center;color:#c0392b">🚫 هذه الصفحة متاحة للموارد البشرية فقط</div>'; return; }
    const allEmp = Object.values(window.emp || {});
    const active = allEmp.filter(hsIsActive);
    const inactive = allEmp.filter(e => !hsIsActive(e));
    const total = active.length;
    const saudis = active.filter(e => hsIsSaudi(e.nationality)).length;
    const nonSaudis = total - saudis;
    const satzPct = total ? Math.round((saudis / total) * 1000) / 10 : 0;
    const band = hsNitaqatBand(satzPct);
    // تكلفة الرواتب الشهرية (المكوّنات المخزّنة)
    let salaryCost = 0; active.forEach(e => salaryCost += hsSalaryParts(e).total);
    const avgSalary = total ? salaryCost / total : 0;
    // متوسط مدة الخدمة
    const tenures = active.map(hsTenureYears).filter(v => v != null);
    const avgTenure = tenures.length ? (tenures.reduce((a, b) => a + b, 0) / tenures.length) : 0;
    // معدل دوران تقريبي (المنتهية خدمتهم ÷ إجمالي)
    const turnoverPct = allEmp.length ? Math.round((inactive.length / allEmp.length) * 1000) / 10 : 0;
    // انتهاء الإقامات
    const dTo = ds => { if (!ds) return null; const d = new Date(ds); if (isNaN(d)) return null; return Math.ceil((d - new Date(new Date().toISOString().slice(0, 10))) / 86400000); };
    const iqExp = { d30: 0, d60: 0, expired: 0 };
    active.forEach(e => { const dd = dTo(e.iqamaExp); if (dd == null) return; if (dd < 0) iqExp.expired++; else if (dd <= 30) iqExp.d30++; else if (dd <= 60) iqExp.d60++; });

    // تفصيل حسب القسم
    const byDept = {}; active.forEach(e => { const d = e.dept || 'غير محدّد'; (byDept[d] = byDept[d] || { n: 0, s: 0, cost: 0 }); byDept[d].n++; if (hsIsSaudi(e.nationality)) byDept[d].s++; byDept[d].cost += hsSalaryParts(e).total; });
    // تفصيل حسب الجنسية
    const byNat = {}; active.forEach(e => { const n = hsIsSaudi(e.nationality) ? '🇸🇦 سعودي' : (e.nationality || 'غير محدّد'); byNat[n] = (byNat[n] || 0) + 1; });

    const kpi = (icon, label, val, col, sub) => `<div style="background:#fff;border-radius:12px;padding:14px 16px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div>${sub ? `<div style="font-size:10.5px;color:#95a5a6;margin-top:2px">${sub}</div>` : ''}</div>`;
    const bar = (pct, col) => `<div style="background:#eef2f6;border-radius:6px;height:8px;overflow:hidden;min-width:70px"><div style="width:${Math.min(100, pct)}%;height:100%;background:${col}"></div></div>`;

    c.innerHTML = `<div style="padding:0 4px" id="hsAnalyticsPrint">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">📊 تحليلات الموارد البشرية والسعودة</div>
            <button class="btn" onclick="window.print()" style="background:#eef5fb;color:#2d6a9f;font-weight:700">🖨️ طباعة</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('👷', 'إجمالي الموظفين', total, '#2980b9', `${inactive.length ? inactive.length + ' منتهية خدمتهم' : 'الكل على رأس العمل'}`)}
            ${kpi('🇸🇦', 'نسبة السعودة', satzPct + '%', band.color, `${saudis} سعودي / ${nonSaudis} غير سعودي`)}
            ${kpi('💰', 'تكلفة الرواتب/شهر', hsMoney(salaryCost), '#16a085', `متوسط ${hsMoney(avgSalary)} ر`)}
            ${kpi('⏳', 'متوسط مدة الخدمة', avgTenure.toFixed(1) + ' سنة', '#8e44ad')}
            ${kpi('🔄', 'معدل الدوران', turnoverPct + '%', turnoverPct > 15 ? '#e67e22' : '#95a5a6', 'تقريبي (تراكمي)')}
        </div>

        <div class="card" style="margin-bottom:16px;border-right:5px solid ${band.color};background:${band.bg}">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                <div>
                    <div style="font-size:14px;font-weight:800;color:${band.color}">🇸🇦 نطاق السعودة التقريبي: ${esc(band.label)}</div>
                    <div style="font-size:12px;color:#5b6b7b;margin-top:4px">نسبة السعودة الحالية <b>${satzPct}%</b> (${saudis} من ${total}). النطاق الفعلي يعتمد على نشاط المنشأة وحجمها لدى وزارة الموارد البشرية.</div>
                </div>
                <div style="font-size:34px;font-weight:900;color:${band.color}">${satzPct}%</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-bottom:16px">
            <div class="card">
                <div class="c-tl">🏢 التوزيع حسب القسم</div>
                <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
                    <thead><tr style="background:#f0f5fa;text-align:right;color:#1a3a5c"><th style="padding:7px 9px">القسم</th><th style="padding:7px 9px;text-align:center">العدد</th><th style="padding:7px 9px;text-align:center">السعودة</th><th style="padding:7px 9px;text-align:left">التكلفة/شهر</th></tr></thead>
                    <tbody>${Object.entries(byDept).sort((a, b) => b[1].n - a[1].n).map(([d, v]) => `<tr style="border-bottom:1px solid #f2f5f8"><td style="padding:6px 9px;font-weight:700">${hsEsc(d)}</td><td style="padding:6px 9px;text-align:center">${v.n}</td><td style="padding:6px 9px;text-align:center">${v.n ? Math.round(v.s / v.n * 100) : 0}%</td><td style="padding:6px 9px;text-align:left">${hsMoney(v.cost)}</td></tr>`).join('') || '<tr><td colspan="4" style="padding:14px;text-align:center;color:#aaa">لا بيانات</td></tr>'}</tbody>
                </table></div>
            </div>
            <div class="card">
                <div class="c-tl">🌍 التوزيع حسب الجنسية</div>
                ${Object.entries(byNat).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:120px;font-size:12.5px;font-weight:600">${hsEsc(n)}</div>${bar(total ? v / total * 100 : 0, hsIsSaudi(n) ? '#16a085' : '#2980b9')}<div style="font-size:12px;font-weight:700;color:#555;min-width:28px">${v}</div></div>`).join('') || '<div style="color:#aaa;text-align:center;padding:14px">لا بيانات</div>'}
            </div>
        </div>

        <div class="card" style="border-right:5px solid #e67e22">
            <div class="c-tl">📋 انتهاء الإقامات (الموظفون على رأس العمل)</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
                ${kpi('🔴', 'منتهية', iqExp.expired, iqExp.expired ? '#c0392b' : '#95a5a6')}
                ${kpi('🟠', 'خلال 30 يوم', iqExp.d30, iqExp.d30 ? '#e67e22' : '#95a5a6')}
                ${kpi('🟡', 'خلال 60 يوم', iqExp.d60, iqExp.d60 ? '#b9770e' : '#95a5a6')}
            </div>
            <div style="font-size:11.5px;color:#8a97a5;margin-top:8px">للتفاصيل والتنبيهات الكاملة راجع صفحة «⏰ تنبيهات المستندات».</div>
        </div>
    </div>`;
};

// ═══════════════════════════════════════════════════════════════════════════
//  🎯 الأداء المتقدم — الأهداف ومؤشرات الأداء (OKR/KPI) + دورات التقييم
// ═══════════════════════════════════════════════════════════════════════════
const HS_GOAL_TYPES = { okr: { label: '🎯 هدف (OKR)', color: '#8e44ad' }, kpi: { label: '📊 مؤشر (KPI)', color: '#2980b9' } };
function hsGoals() { return window.goals || {}; }
function hsCanPerf() { const p = window.myP; return p && (p.role === 'admin' || p.role === 'hr_officer' || (typeof can === 'function' && (can('view_performance') || can('view_employees')))); }
// الدورة الافتراضية (ربع السنة الحالي)
function hsCurCycle() { const d = new Date(); return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`; }
function hsGoalScore(list) { let w = 0, s = 0; list.forEach(g => { const gw = parseFloat(g.weight) || 0; w += gw; s += gw * (parseFloat(g.progress) || 0); }); return w ? Math.round(s / w) : (list.length ? Math.round(list.reduce((a, g) => a + (parseFloat(g.progress) || 0), 0) / list.length) : 0); }

window.renderGoals = function () {
    const c = document.getElementById('pg-goals'); if (!c) return;
    if (!hsCanPerf()) { c.innerHTML = '<div class="card" style="padding:30px;text-align:center;color:#c0392b">🚫 هذه الصفحة متاحة للموارد البشرية فقط</div>'; return; }
    window._hsGoal = window._hsGoal || { emp: '', cycle: hsCurCycle() };
    const f = window._hsGoal;
    const all = Object.entries(hsGoals()).map(([k, g]) => ({ k, ...g }));
    const cycles = [...new Set(all.map(g => g.cycle).filter(Boolean))].sort().reverse();
    if (!cycles.includes(f.cycle)) cycles.unshift(f.cycle);
    const inCycle = all.filter(g => g.cycle === f.cycle && (!f.emp || g.empKey === f.emp));
    const active = inCycle.filter(g => (g.status || 'active') === 'active');
    const done = inCycle.filter(g => g.status === 'done');
    const avgProg = inCycle.length ? Math.round(inCycle.reduce((a, g) => a + (parseFloat(g.progress) || 0), 0) / inCycle.length) : 0;

    const empOpts = Object.entries(window.emp || {}).filter(([, e]) => (e.status || 'active') === 'active')
        .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar'))
        .map(([k, e]) => `<option value="${k}" ${f.emp === k ? 'selected' : ''}>${hsEsc(e.name)}</option>`).join('');
    const cycleOpts = cycles.map(cy => `<option value="${cy}" ${f.cycle === cy ? 'selected' : ''}>${hsEsc(cy)}</option>`).join('');
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;
    const bar = (pct, col) => `<div style="background:#eef2f6;border-radius:6px;height:9px;overflow:hidden;flex:1;min-width:90px"><div style="width:${Math.min(100, Math.max(0, pct))}%;height:100%;background:${col};transition:width .3s"></div></div>`;

    // تجميع حسب الموظف لعرض النتيجة المرجّحة (بطاقة تقييم الدورة)
    const byEmp = {}; inCycle.forEach(g => { (byEmp[g.empKey] = byEmp[g.empKey] || []).push(g); });

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">🎯 الأهداف ومؤشرات الأداء (OKR/KPI)</div>
            <button class="btn b-g" onclick="hsOpenGoal()" style="font-weight:800">➕ هدف/مؤشر جديد</button>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;background:#fff;padding:12px 14px;border-radius:10px;margin-bottom:14px">
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">دورة التقييم</label><select onchange="window._hsGoal.cycle=this.value;renderGoals()" style="${hsInp()}">${cycleOpts}</select></div>
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">الموظف</label><select onchange="window._hsGoal.emp=this.value;renderGoals()" style="${hsInp()}"><option value="">الكل</option>${empOpts}</select></div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('🎯', 'أهداف نشطة', active.length, '#8e44ad')}
            ${kpi('✅', 'مكتملة', done.length, '#16a085')}
            ${kpi('📈', 'متوسط الإنجاز', avgProg + '%', avgProg >= 70 ? '#16a085' : avgProg >= 40 ? '#e67e22' : '#c0392b')}
        </div>

        ${Object.keys(byEmp).length ? Object.entries(byEmp).sort((a, b) => hsGoalScore(b[1]) - hsGoalScore(a[1])).map(([ek, list]) => {
        const e = (window.emp || {})[ek] || {}; const score = hsGoalScore(list);
        const scol = score >= 70 ? '#16a085' : score >= 40 ? '#e67e22' : '#c0392b';
        return `<div class="card" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
                <div style="font-weight:800;color:#1a3a5c;font-size:14px">👤 ${hsEsc(e.name || '—')} <span style="font-size:11px;color:#95a5a6;font-weight:600">${hsEsc(e.job || '')}</span></div>
                <div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:#888">نتيجة الدورة المرجّحة</span><span style="font-size:20px;font-weight:900;color:${scol}">${score}%</span></div>
            </div>
            ${list.sort((a, b) => (b.weight || 0) - (a.weight || 0)).map(g => {
            const t = HS_GOAL_TYPES[g.type || 'kpi'] || HS_GOAL_TYPES.kpi; const pr = parseFloat(g.progress) || 0;
            const pcol = pr >= 70 ? '#16a085' : pr >= 40 ? '#e67e22' : '#c0392b';
            const st = g.status === 'done' ? '✅' : g.status === 'cancelled' ? '🚫' : '';
            return `<div style="border:1px solid #eef2f6;border-radius:9px;padding:10px 12px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                    <div style="font-weight:700;font-size:13px;color:#243b53">${st} <span style="color:${t.color}">${t.label.split(' ')[0]}</span> ${hsEsc(g.title || '')}${g.target ? ` <span style="font-size:11px;color:#95a5a6">(الهدف: ${hsEsc(g.target)}${g.unit ? ' ' + hsEsc(g.unit) : ''})</span>` : ''}</div>
                    <div style="font-size:11px;color:#95a5a6">وزن ${g.weight || 0}%${g.dueDate ? ` · ${g.dueDate}` : ''}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                    ${bar(pr, pcol)}
                    <span style="font-weight:800;color:${pcol};font-size:13px;min-width:38px">${pr}%</span>
                    <input type="range" min="0" max="100" step="5" value="${pr}" onchange="hsSetGoalProgress('${g.k}',this.value)" style="width:120px;cursor:pointer" title="اسحب لتحديث نسبة الإنجاز">
                    <button class="btn" onclick="hsOpenGoal('${g.k}')" style="font-size:10px;padding:3px 7px">✏️</button>
                    <button class="btn b-r" onclick="hsDeleteGoal('${g.k}')" style="font-size:10px;padding:3px 7px">🗑️</button>
                </div>
            </div>`;
        }).join('')}
        </div>`;
    }).join('') : '<div class="card" style="text-align:center;color:#aaa;padding:26px">لا أهداف في هذه الدورة — أضف أول هدف/مؤشر للموظفين.</div>'}
    </div>`;
};

function hsEnsureGoalModal() {
    if (document.getElementById('hsGoalModal')) return;
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const d = document.createElement('div');
    d.id = 'hsGoalModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:540px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 id="hsGoalTitle" style="margin:0;color:#8e44ad;font-size:18px">🎯 هدف/مؤشر جديد</h3><button onclick="hsCloseGoal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <input id="hsGoalKey" type="hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('الموظف *', `<select id="hsGoalEmp" style="width:100%;${hsInp()}"></select>`)}
            ${fg('دورة التقييم *', `<input id="hsGoalCycle" placeholder="2026-Q3 / 2026-سنوي" style="width:100%;${hsInp()}">`)}
        </div>
        ${fg('العنوان *', `<input id="hsGoalName" placeholder="مثال: رفع رضا العملاء" style="width:100%;${hsInp()}">`)}
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            ${fg('النوع', `<select id="hsGoalType" style="width:100%;${hsInp()}">${Object.entries(HS_GOAL_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select>`)}
            ${fg('الوزن %', `<input id="hsGoalWeight" type="number" min="0" max="100" placeholder="25" style="width:100%;${hsInp()}">`)}
            ${fg('تاريخ الاستحقاق', `<input id="hsGoalDue" type="date" style="width:100%;${hsInp()}">`)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('القيمة المستهدفة', `<input id="hsGoalTarget" placeholder="مثال: 90" style="width:100%;${hsInp()}">`)}
            ${fg('الوحدة', `<input id="hsGoalUnit" placeholder="% / عميل / يوم..." style="width:100%;${hsInp()}">`)}
        </div>
        ${fg('نسبة الإنجاز الحالية %', `<input id="hsGoalProgress" type="number" min="0" max="100" value="0" style="width:100%;${hsInp()}">`)}
        ${fg('الحالة', `<select id="hsGoalStatus" style="width:100%;${hsInp()}"><option value="active">نشط</option><option value="done">مكتمل</option><option value="cancelled">ملغى</option></select>`)}
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn b-g" onclick="hsSaveGoal()" style="flex:1;font-weight:800">💾 حفظ</button><button class="btn" onclick="hsCloseGoal()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.hsOpenGoal = function (key) {
    hsEnsureGoalModal();
    const g = key ? hsGoals()[key] : null;
    const empSel = document.getElementById('hsGoalEmp');
    empSel.innerHTML = '<option value="">— اختر —</option>' + Object.entries(window.emp || {}).filter(([, e]) => (e.status || 'active') === 'active').sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar')).map(([k, e]) => `<option value="${k}">${hsEsc(e.name)}</option>`).join('');
    document.getElementById('hsGoalKey').value = key || '';
    document.getElementById('hsGoalTitle').textContent = g ? '✏️ تعديل هدف/مؤشر' : '🎯 هدف/مؤشر جديد';
    empSel.value = g?.empKey || (window._hsGoal?.emp || '');
    document.getElementById('hsGoalCycle').value = g?.cycle || (window._hsGoal?.cycle || hsCurCycle());
    document.getElementById('hsGoalName').value = g?.title || '';
    document.getElementById('hsGoalType').value = g?.type || 'kpi';
    document.getElementById('hsGoalWeight').value = g?.weight ?? '';
    document.getElementById('hsGoalDue').value = g?.dueDate || '';
    document.getElementById('hsGoalTarget').value = g?.target || '';
    document.getElementById('hsGoalUnit').value = g?.unit || '';
    document.getElementById('hsGoalProgress').value = g?.progress ?? 0;
    document.getElementById('hsGoalStatus').value = g?.status || 'active';
    document.getElementById('hsGoalModal').style.display = 'flex';
};
window.hsCloseGoal = function () { const m = document.getElementById('hsGoalModal'); if (m) m.style.display = 'none'; };
window.hsSaveGoal = async function () {
    const key = document.getElementById('hsGoalKey').value;
    const empKey = document.getElementById('hsGoalEmp').value;
    const title = document.getElementById('hsGoalName').value.trim();
    const cycle = document.getElementById('hsGoalCycle').value.trim();
    if (!empKey) { toast('⚠️ اختر الموظف', 'er'); return; }
    if (!title) { toast('⚠️ العنوان مطلوب', 'er'); return; }
    if (!cycle) { toast('⚠️ دورة التقييم مطلوبة', 'er'); return; }
    const e = (window.emp || {})[empKey] || {};
    const data = {
        empKey, empName: e.name || '', cycle, title, type: document.getElementById('hsGoalType').value,
        weight: parseFloat(document.getElementById('hsGoalWeight').value) || 0,
        dueDate: document.getElementById('hsGoalDue').value || '',
        target: document.getElementById('hsGoalTarget').value.trim(), unit: document.getElementById('hsGoalUnit').value.trim(),
        progress: Math.max(0, Math.min(100, parseFloat(document.getElementById('hsGoalProgress').value) || 0)),
        status: document.getElementById('hsGoalStatus').value, updatedAt: new Date().toISOString()
    };
    try {
        if (key) await window.update(window.ref(window.db, 'ledger/goals/' + key), data);
        else await window.push(window.R.goals, { ...data, createdBy: hsMyName(), createdAt: new Date().toISOString() });
        toast('✅ تم الحفظ', 'ok'); hsCloseGoal();
    } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};
window.hsSetGoalProgress = async function (key, val) {
    const p = Math.max(0, Math.min(100, parseInt(val) || 0));
    try { await window.update(window.ref(window.db, 'ledger/goals/' + key), { progress: p, status: p >= 100 ? 'done' : 'active', updatedAt: new Date().toISOString() }); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};
window.hsDeleteGoal = function (key) {
    cf2('حذف هذا الهدف/المؤشر؟', async () => { try { await window.remove(window.ref(window.db, 'ledger/goals/' + key)); toast('حُذف', 'ok'); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); } });
};
// أهداف الموظف الحالي (للخدمة الذاتية)
window.hsMyGoals = function (empKey) { return Object.entries(hsGoals()).filter(([, g]) => g.empKey === empKey).map(([k, g]) => ({ k, ...g })).sort((a, b) => (b.cycle || '').localeCompare(a.cycle || '')); };

// ═══════════════════════════════════════════════════════════════════════════
//  🎓 التدريب والتطوير — الدورات والشهادات
// ═══════════════════════════════════════════════════════════════════════════
const HS_TRN_TYPES = { internal: 'داخلي', external: 'خارجي', online: 'أونلاين', conference: 'مؤتمر/ورشة' };
const HS_TRN_STATUS = { planned: { label: '📅 مخطّط', color: '#8e44ad' }, ongoing: { label: '🔵 جارٍ', color: '#2980b9' }, completed: { label: '✅ مكتمل', color: '#16a085' }, cancelled: { label: '🚫 ملغى', color: '#95a5a6' } };
function hsTrn() { return window.training || {}; }

window.renderTraining = function () {
    const c = document.getElementById('pg-training'); if (!c) return;
    if (!hsCanManage()) { c.innerHTML = '<div class="card" style="padding:30px;text-align:center;color:#c0392b">🚫 هذه الصفحة متاحة للموارد البشرية فقط</div>'; return; }
    window._hsTrn = window._hsTrn || { emp: '', status: '' };
    const f = window._hsTrn;
    const all = Object.entries(hsTrn()).map(([k, t]) => ({ k, ...t }));
    const rows = all.filter(t => (!f.emp || t.empKey === f.emp) && (!f.status || (t.status || 'planned') === f.status))
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    const completed = all.filter(t => t.status === 'completed').length;
    const ongoing = all.filter(t => (t.status || 'planned') === 'ongoing').length;
    const totalCost = all.reduce((s, t) => s + (parseFloat(t.cost) || 0), 0);
    // شهادات تنتهي خلال 60 يوماً
    const dTo = ds => { if (!ds) return null; const d = new Date(ds); if (isNaN(d)) return null; return Math.ceil((d - new Date(hsToday() + 'T00:00:00')) / 86400000); };
    const expCerts = all.filter(t => t.certExpiry && dTo(t.certExpiry) != null && dTo(t.certExpiry) <= 60);

    const empOpts = Object.entries(window.emp || {}).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar')).map(([k, e]) => `<option value="${k}" ${f.emp === k ? 'selected' : ''}>${hsEsc(e.name)}</option>`).join('');
    const statusFilterOpts = Object.entries(HS_TRN_STATUS).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">🎓 التدريب والتطوير</div>
            <button class="btn b-g" onclick="hsOpenTrn()" style="font-weight:800">➕ دورة/شهادة</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('🎓', 'إجمالي الدورات', all.length, '#2980b9')}
            ${kpi('✅', 'مكتملة', completed, '#16a085')}
            ${kpi('🔵', 'جارية', ongoing, ongoing ? '#2980b9' : '#95a5a6')}
            ${kpi('💰', 'تكلفة التدريب', hsMoney(totalCost), '#8e44ad')}
        </div>
        ${expCerts.length ? `<div class="card" style="margin-bottom:14px;border-right:5px solid #e67e22;background:#fef9f3">
            <div style="font-weight:800;color:#b9770e;font-size:13.5px">⚠️ ${expCerts.length} شهادة تنتهي خلال 60 يوماً</div>
            <div style="font-size:12px;color:#7d4e00;margin-top:5px;line-height:1.9">${expCerts.map(t => `${hsEsc(t.empName || '')} — ${hsEsc(t.certName || t.course || '')} (تنتهي ${t.certExpiry})`).join('<br>')}</div>
        </div>` : ''}
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;background:#fff;padding:12px 14px;border-radius:10px;margin-bottom:14px">
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">الموظف</label><select onchange="window._hsTrn.emp=this.value;renderTraining()" style="${hsInp()}"><option value="">الكل</option>${empOpts}</select></div>
            <div><label style="font-size:11px;color:#888;display:block;margin-bottom:3px">الحالة</label><select onchange="window._hsTrn.status=this.value;renderTraining()" style="${hsInp()}"><option value="">الكل</option>${statusFilterOpts}</select></div>
        </div>
        <div class="card">
            <div class="c-tl">🗂️ سجل التدريب</div>
            ${rows.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
                <thead><tr style="background:#f0f5fa;text-align:right;color:#1a3a5c"><th style="padding:8px 9px">الموظف</th><th style="padding:8px 9px">الدورة</th><th style="padding:8px 9px">النوع</th><th style="padding:8px 9px">الفترة</th><th style="padding:8px 9px;text-align:center">الحالة</th><th style="padding:8px 9px;text-align:center">شهادة</th><th style="padding:8px 9px;text-align:center">إجراء</th></tr></thead>
                <tbody>${rows.map(t => { const st = HS_TRN_STATUS[t.status || 'planned'] || HS_TRN_STATUS.planned; return `<tr style="border-bottom:1px solid #f2f5f8">
                    <td style="padding:7px 9px;font-weight:700">${hsEsc(t.empName || '—')}</td>
                    <td style="padding:7px 9px">${hsEsc(t.course || '—')}${t.provider ? `<div style="font-size:10px;color:#95a5a6">${hsEsc(t.provider)}</div>` : ''}</td>
                    <td style="padding:7px 9px;color:#666">${HS_TRN_TYPES[t.type] || t.type || '—'}</td>
                    <td style="padding:7px 9px;color:#666;font-size:11px;white-space:nowrap">${t.startDate || '—'}${t.endDate ? ' ← ' + t.endDate : ''}</td>
                    <td style="padding:7px 9px;text-align:center"><span style="background:${st.color}18;color:${st.color};padding:2px 8px;border-radius:9px;font-size:11px;font-weight:700;white-space:nowrap">${esc(st.label)}</span></td>
                    <td style="padding:7px 9px;text-align:center">${t.hasCert ? `<span title="${hsEsc(t.certName || '')}${t.certExpiry ? ' · تنتهي ' + t.certExpiry : ''}" style="cursor:help">📜</span>` : '—'}</td>
                    <td style="padding:7px 9px;text-align:center;white-space:nowrap"><button class="btn" onclick="hsOpenTrn('${t.k}')" style="font-size:10px;padding:3px 7px">✏️</button> <button class="btn b-r" onclick="hsDeleteTrn('${t.k}')" style="font-size:10px;padding:3px 7px">🗑️</button></td>
                </tr>`; }).join('')}</tbody>
            </table></div>` : '<div style="color:#aaa;text-align:center;padding:22px">لا سجلات تدريب — أضف أول دورة/شهادة.</div>'}
        </div>
    </div>`;
};

function hsEnsureTrnModal() {
    if (document.getElementById('hsTrnModal')) return;
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const d = document.createElement('div');
    d.id = 'hsTrnModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 id="hsTrnTitle" style="margin:0;color:#2980b9;font-size:18px">🎓 دورة/شهادة جديدة</h3><button onclick="hsCloseTrn()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        <input id="hsTrnKey" type="hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${fg('الموظف *', `<select id="hsTrnEmp" style="width:100%;${hsInp()}"></select>`)}
            ${fg('اسم الدورة *', `<input id="hsTrnCourse" placeholder="مثال: إدارة المشاريع PMP" style="width:100%;${hsInp()}">`)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            ${fg('الجهة المقدّمة', `<input id="hsTrnProvider" placeholder="المعهد/المزوّد" style="width:100%;${hsInp()}">`)}
            ${fg('النوع', `<select id="hsTrnType" style="width:100%;${hsInp()}">${Object.entries(HS_TRN_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`)}
            ${fg('التكلفة (ر.س)', `<input id="hsTrnCost" type="number" min="0" placeholder="0" style="width:100%;${hsInp()}">`)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            ${fg('من تاريخ', `<input id="hsTrnStart" type="date" style="width:100%;${hsInp()}">`)}
            ${fg('إلى تاريخ', `<input id="hsTrnEnd" type="date" style="width:100%;${hsInp()}">`)}
            ${fg('الحالة', `<select id="hsTrnStatus" style="width:100%;${hsInp()}">${Object.entries(HS_TRN_STATUS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select>`)}
        </div>
        <div style="background:#f7fbff;border:1px solid #e3eef7;border-radius:10px;padding:10px 12px;margin-bottom:10px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#2980b9;cursor:pointer;margin-bottom:8px"><input type="checkbox" id="hsTrnHasCert" onchange="document.getElementById('hsTrnCertRow').style.display=this.checked?'grid':'none'"> 📜 نتج عنها شهادة</label>
            <div id="hsTrnCertRow" style="display:none;grid-template-columns:1fr 1fr;gap:10px">
                ${fg('اسم الشهادة', `<input id="hsTrnCertName" placeholder="اسم/رقم الشهادة" style="width:100%;${hsInp()}">`)}
                ${fg('تنتهي في (إن وُجد)', `<input id="hsTrnCertExpiry" type="date" style="width:100%;${hsInp()}">`)}
            </div>
        </div>
        ${fg('ملاحظات', `<input id="hsTrnNotes" placeholder="اختياري" style="width:100%;${hsInp()}">`)}
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn b-g" onclick="hsSaveTrn()" style="flex:1;font-weight:800">💾 حفظ</button><button class="btn" onclick="hsCloseTrn()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.hsOpenTrn = function (key) {
    hsEnsureTrnModal();
    const t = key ? hsTrn()[key] : null;
    const empSel = document.getElementById('hsTrnEmp');
    empSel.innerHTML = '<option value="">— اختر —</option>' + Object.entries(window.emp || {}).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'ar')).map(([k, e]) => `<option value="${k}">${hsEsc(e.name)}</option>`).join('');
    document.getElementById('hsTrnKey').value = key || '';
    document.getElementById('hsTrnTitle').textContent = t ? '✏️ تعديل دورة/شهادة' : '🎓 دورة/شهادة جديدة';
    empSel.value = t?.empKey || (window._hsTrn?.emp || '');
    document.getElementById('hsTrnCourse').value = t?.course || '';
    document.getElementById('hsTrnProvider').value = t?.provider || '';
    document.getElementById('hsTrnType').value = t?.type || 'external';
    document.getElementById('hsTrnCost').value = t?.cost ?? '';
    document.getElementById('hsTrnStart').value = t?.startDate || '';
    document.getElementById('hsTrnEnd').value = t?.endDate || '';
    document.getElementById('hsTrnStatus').value = t?.status || 'planned';
    const hc = !!t?.hasCert;
    document.getElementById('hsTrnHasCert').checked = hc;
    document.getElementById('hsTrnCertRow').style.display = hc ? 'grid' : 'none';
    document.getElementById('hsTrnCertName').value = t?.certName || '';
    document.getElementById('hsTrnCertExpiry').value = t?.certExpiry || '';
    document.getElementById('hsTrnNotes').value = t?.notes || '';
    document.getElementById('hsTrnModal').style.display = 'flex';
};
window.hsCloseTrn = function () { const m = document.getElementById('hsTrnModal'); if (m) m.style.display = 'none'; };
window.hsSaveTrn = async function () {
    const key = document.getElementById('hsTrnKey').value;
    const empKey = document.getElementById('hsTrnEmp').value;
    const course = document.getElementById('hsTrnCourse').value.trim();
    if (!empKey) { toast('⚠️ اختر الموظف', 'er'); return; }
    if (!course) { toast('⚠️ اسم الدورة مطلوب', 'er'); return; }
    const e = (window.emp || {})[empKey] || {};
    const hasCert = document.getElementById('hsTrnHasCert').checked;
    const data = {
        empKey, empName: e.name || '', course, provider: document.getElementById('hsTrnProvider').value.trim(),
        type: document.getElementById('hsTrnType').value, cost: parseFloat(document.getElementById('hsTrnCost').value) || 0,
        startDate: document.getElementById('hsTrnStart').value || '', endDate: document.getElementById('hsTrnEnd').value || '',
        status: document.getElementById('hsTrnStatus').value, hasCert,
        certName: hasCert ? document.getElementById('hsTrnCertName').value.trim() : '', certExpiry: hasCert ? (document.getElementById('hsTrnCertExpiry').value || '') : '',
        notes: document.getElementById('hsTrnNotes').value.trim(), updatedAt: new Date().toISOString()
    };
    try {
        if (key) await window.update(window.ref(window.db, 'ledger/training/' + key), data);
        else await window.push(window.R.training, { ...data, createdBy: hsMyName(), createdAt: new Date().toISOString() });
        toast('✅ تم الحفظ', 'ok'); hsCloseTrn();
    } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};
window.hsDeleteTrn = function (key) {
    cf2('حذف سجل التدريب؟', async () => { try { await window.remove(window.ref(window.db, 'ledger/training/' + key)); toast('حُذف', 'ok'); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); } });
};
// تدريب الموظف الحالي (للخدمة الذاتية)
window.hsMyTraining = function (empKey) { return Object.entries(hsTrn()).filter(([, t]) => t.empKey === empKey).map(([k, t]) => ({ k, ...t })).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')); };

// ═══════════════════════════════════════════════════════════════════════════
//  📝 استبيانات رضا الموظفين (eNPS + تقييم)
// ═══════════════════════════════════════════════════════════════════════════
function hsSurveys() { return window.surveys || {}; }
function hsSurveyResp() { return window.surveyResponses || {}; }
const HS_ENPS_Q = 'ما مدى احتمال أن توصي بالعمل في هذه الشركة لصديق؟ (0 = مستبعد تماماً، 10 = مؤكّد)';
function hsRespOf(sid) { return Object.values(hsSurveyResp()).filter(r => r.surveyId === sid); }
// حساب eNPS من إجابات سؤال 0..10
function hsCalcENPS(resps) {
    const vals = resps.map(r => parseFloat((r.answers || {}).enps)).filter(v => !isNaN(v));
    if (!vals.length) return { score: null, prom: 0, pass: 0, det: 0, n: 0 };
    const prom = vals.filter(v => v >= 9).length, det = vals.filter(v => v <= 6).length, pass = vals.length - prom - det;
    return { score: Math.round((prom / vals.length - det / vals.length) * 100), prom, pass, det, n: vals.length };
}
function hsHasResponded(sid, empKey) { return Object.values(hsSurveyResp()).some(r => r.surveyId === sid && r.empKey === empKey); }

window.renderSurveys = function () {
    const c = document.getElementById('pg-surveys'); if (!c) return;
    if (!hsCanManage()) { c.innerHTML = '<div class="card" style="padding:30px;text-align:center;color:#c0392b">🚫 هذه الصفحة متاحة للموارد البشرية فقط</div>'; return; }
    const all = Object.entries(hsSurveys()).map(([k, s]) => ({ k, ...s })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const activeEmps = Object.values(window.emp || {}).filter(e => (e.status || 'active') === 'active').length;
    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;

    c.innerHTML = `<div style="padding:0 4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
            <div style="font-size:16px;font-weight:800;color:#1a3a5c">📝 استبيانات رضا الموظفين</div>
            <button class="btn b-g" onclick="hsOpenSurvey()" style="font-weight:800">➕ استبيان جديد</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            ${kpi('📝', 'إجمالي الاستبيانات', all.length, '#2980b9')}
            ${kpi('🟢', 'مفتوحة الآن', all.filter(s => s.active !== false).length, '#16a085')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
        ${all.length ? all.map(s => {
        const resps = hsRespOf(s.k); const rate = activeEmps ? Math.round(resps.length / activeEmps * 100) : 0;
        const isEnps = s.type === 'enps';
        const enps = isEnps ? hsCalcENPS(resps) : null;
        let scoreHtml = '';
        if (isEnps) { const sc = enps.score; const col = sc == null ? '#95a5a6' : sc >= 30 ? '#16a085' : sc >= 0 ? '#e67e22' : '#c0392b'; scoreHtml = `<div style="font-size:28px;font-weight:900;color:${col}">${sc == null ? '—' : (sc > 0 ? '+' : '') + sc}</div><div style="font-size:10px;color:#95a5a6">eNPS</div>`; }
        else { const avg = hsSurveyAvg(s, resps); const col = avg == null ? '#95a5a6' : avg >= 4 ? '#16a085' : avg >= 3 ? '#e67e22' : '#c0392b'; scoreHtml = `<div style="font-size:28px;font-weight:900;color:${col}">${avg == null ? '—' : avg.toFixed(1)}</div><div style="font-size:10px;color:#95a5a6">من 5</div>`; }
        const off = s.active === false;
        return `<div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden;border-top:3px solid ${isEnps ? '#8e44ad' : '#2980b9'};opacity:${off ? '.7' : '1'}">
            <div style="padding:12px 14px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;gap:10px">
                <div><div style="font-weight:800;color:#1a3a5c;font-size:14px">${hsEsc(s.title || 'استبيان')}</div><div style="font-size:10.5px;color:#95a5a6;margin-top:2px">${isEnps ? '💜 eNPS' : '⭐ تقييم'}${s.anonymous ? ' · مجهول' : ''}${off ? ' · مغلق' : ''}</div></div>
                <div style="text-align:center">${scoreHtml}</div>
            </div>
            <div style="padding:11px 14px;font-size:12px;color:#556">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>الردود</span><b>${resps.length} / ${activeEmps} (${rate}%)</b></div>
                ${isEnps && enps.n ? `<div style="display:flex;gap:4px;height:8px;border-radius:5px;overflow:hidden;margin-top:5px"><div style="flex:${enps.prom};background:#16a085" title="مروّجون ${enps.prom}"></div><div style="flex:${enps.pass};background:#f1c40f" title="محايدون ${enps.pass}"></div><div style="flex:${enps.det};background:#c0392b" title="منتقدون ${enps.det}"></div></div><div style="font-size:10px;color:#95a5a6;margin-top:3px">🟢 ${enps.prom} مروّج · 🟡 ${enps.pass} محايد · 🔴 ${enps.det} منتقد</div>` : ''}
            </div>
            <div style="padding:8px 14px;border-top:1px solid #f5f5f5;display:flex;gap:6px;justify-content:flex-end">
                <button class="btn" onclick="hsSurveyResults('${s.k}')" style="font-size:11px;padding:4px 9px;background:#eef5fb;color:#2d6a9f">📊 النتائج</button>
                <button class="btn" onclick="hsToggleSurvey('${s.k}',${off})" style="font-size:11px;padding:4px 9px;background:#f4f6f9;color:#555">${off ? '▶️ فتح' : '⏸️ إغلاق'}</button>
                <button class="btn b-r" onclick="hsDeleteSurvey('${s.k}')" style="font-size:11px;padding:4px 9px">🗑️</button>
            </div>
        </div>`;
    }).join('') : '<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:24px">لا استبيانات — أنشئ أول استبيان رضا (eNPS) ليجيب عليه الموظفون في خدمتهم الذاتية.</div>'}
        </div>
    </div>`;
};
function hsSurveyAvg(s, resps) {
    const qs = (s.questions || []).map(q => q.id);
    if (!qs.length || !resps.length) return null;
    let sum = 0, n = 0;
    resps.forEach(r => qs.forEach(qid => { const v = parseFloat((r.answers || {})[qid]); if (!isNaN(v)) { sum += v; n++; } }));
    return n ? sum / n : null;
}
window.hsSurveyResults = function (sid) {
    const s = hsSurveys()[sid]; if (!s) return;
    const resps = hsRespOf(sid);
    let body = '';
    if (s.type === 'enps') {
        const e = hsCalcENPS(resps);
        body = `<div style="text-align:center;padding:10px"><div style="font-size:40px;font-weight:900;color:${e.score == null ? '#95a5a6' : e.score >= 0 ? '#16a085' : '#c0392b'}">${e.score == null ? '—' : (e.score > 0 ? '+' : '') + e.score}</div><div style="color:#888">صافي نقاط ترشيح الموظف (eNPS) · ${e.n} رد</div></div>`;
    } else {
        body = (s.questions || []).map(q => {
            const vals = resps.map(r => parseFloat((r.answers || {})[q.id])).filter(v => !isNaN(v));
            const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
            const col = avg == null ? '#95a5a6' : avg >= 4 ? '#16a085' : avg >= 3 ? '#e67e22' : '#c0392b';
            return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f2f5f8"><span style="font-size:13px">${hsEsc(q.text)}</span><b style="color:${col}">${avg == null ? '—' : avg.toFixed(1)} / 5</b></div>`;
        }).join('');
    }
    const comments = resps.filter(r => (r.comment || '').trim()).map(r => `<div style="background:#f8fafc;border-radius:8px;padding:8px 11px;margin-bottom:6px;font-size:12px;color:#556">💬 ${hsEsc(r.comment)}${!s.anonymous && r.empName ? `<div style="font-size:10px;color:#95a5a6;margin-top:2px">${hsEsc(r.empName)}</div>` : ''}</div>`).join('');
    hsModal(`📊 نتائج: ${hsEsc(s.title || '')}`, `${body}<div style="margin-top:12px;font-size:12px;color:#888;font-weight:700">${resps.length} رد${s.anonymous ? ' · الردود مجهولة' : ''}</div>${comments ? `<div style="margin-top:10px"><div style="font-size:12px;font-weight:700;color:#555;margin-bottom:6px">التعليقات:</div>${comments}</div>` : ''}`);
};

// مودال عام بسيط للعرض
function hsModal(title, html) {
    let m = document.getElementById('hsGenModal');
    if (!m) { m = document.createElement('div'); m.id = 'hsGenModal'; m.style.cssText = 'position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px'; m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; }); document.body.appendChild(m); }
    m.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:90vh;overflow:auto;padding:20px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0;color:#2d6a9f;font-size:17px">${title}</h3><button onclick="document.getElementById('hsGenModal').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>${html}</div>`;
    m.style.display = 'flex';
}

function hsEnsureSurveyModal() {
    if (document.getElementById('hsSurveyModal')) return;
    const fg = (label, inner) => `<div style="margin-bottom:10px"><label style="font-size:12px;color:#555;font-weight:700;display:block;margin-bottom:3px">${label}</label>${inner}</div>`;
    const d = document.createElement('div');
    d.id = 'hsSurveyModal';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:540px;width:100%;max-height:92vh;overflow:auto;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="margin:0;color:#8e44ad;font-size:18px">📝 استبيان جديد</h3><button onclick="hsCloseSurvey()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div>
        ${fg('عنوان الاستبيان *', `<input id="hsSvTitle" placeholder="مثال: استبيان رضا الربع الثالث" style="width:100%;${hsInp()}">`)}
        ${fg('وصف (اختياري)', `<input id="hsSvDesc" placeholder="غرض الاستبيان" style="width:100%;${hsInp()}">`)}
        ${fg('النوع', `<select id="hsSvType" onchange="document.getElementById('hsSvQRow').style.display=this.value==='rating'?'block':'none'" style="width:100%;${hsInp()}"><option value="enps">💜 eNPS — صافي نقاط ترشيح الموظف (سؤال 0–10)</option><option value="rating">⭐ تقييم — أسئلة من 1 إلى 5</option></select>`)}
        <div id="hsSvQRow" style="display:none">${fg('الأسئلة (سؤال في كل سطر)', `<textarea id="hsSvQuestions" rows="4" placeholder="مثال:\nبيئة العمل مريحة\nالإدارة تستمع لملاحظاتي\nالراتب عادل مقابل الجهد" style="width:100%;${hsInp()};resize:vertical"></textarea>`)}</div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#333;cursor:pointer;margin:6px 0 10px"><input type="checkbox" id="hsSvAnon" checked style="width:16px;height:16px"> إخفاء هوية المجيبين (استبيان مجهول)</label>
        <div style="display:flex;gap:8px;margin-top:4px"><button class="btn b-g" onclick="hsSaveSurvey()" style="flex:1;font-weight:800">📤 نشر الاستبيان</button><button class="btn" onclick="hsCloseSurvey()" style="background:#f0f0f0">إلغاء</button></div>
    </div>`;
    document.body.appendChild(d);
}
window.hsOpenSurvey = function () { hsEnsureSurveyModal(); document.getElementById('hsSurveyModal').style.display = 'flex'; };
window.hsCloseSurvey = function () { const m = document.getElementById('hsSurveyModal'); if (m) m.style.display = 'none'; };
window.hsSaveSurvey = async function () {
    const title = document.getElementById('hsSvTitle').value.trim();
    if (!title) { toast('⚠️ العنوان مطلوب', 'er'); return; }
    const type = document.getElementById('hsSvType').value;
    let questions = [];
    if (type === 'rating') {
        questions = document.getElementById('hsSvQuestions').value.split('\n').map(l => l.trim()).filter(Boolean).map((text, i) => ({ id: 'q' + (i + 1), text, scale: 5 }));
        if (!questions.length) { toast('⚠️ أضف سؤالاً واحداً على الأقل', 'er'); return; }
    }
    const data = { title, description: document.getElementById('hsSvDesc').value.trim(), type, questions, anonymous: document.getElementById('hsSvAnon').checked, active: true, createdBy: hsMyName(), createdAt: new Date().toISOString() };
    try { await window.push(window.R.surveys, data); toast('✅ نُشر الاستبيان', 'ok'); hsCloseSurvey(); document.getElementById('hsSvTitle').value = ''; document.getElementById('hsSvQuestions').value = ''; } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};
window.hsToggleSurvey = async function (sid, open) { try { await window.update(window.ref(window.db, 'ledger/surveys/' + sid), { active: !!open }); toast(open ? 'فُتح' : 'أُغلق', 'ok'); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); } };
window.hsDeleteSurvey = function (sid) { cf2('حذف الاستبيان وكل ردوده؟', async () => { try { await window.remove(window.ref(window.db, 'ledger/surveys/' + sid)); const resps = Object.entries(hsSurveyResp()).filter(([, r]) => r.surveyId === sid); for (const [rk] of resps) { try { await window.remove(window.ref(window.db, 'ledger/surveyResponses/' + rk)); } catch (e) {} } toast('حُذف', 'ok'); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); } }); };

// ── الخدمة الذاتية: الاستبيانات المفتوحة التي لم يجب عليها الموظف ──
window.hsOpenSurveysFor = function (empKey) { return Object.entries(hsSurveys()).filter(([sid, s]) => s.active !== false && !hsHasResponded(sid, empKey)).map(([k, s]) => ({ k, ...s })); };
window.hsAnswerSurvey = function (sid) {
    const s = hsSurveys()[sid]; if (!s) return;
    let qHtml = '';
    if (s.type === 'enps') {
        qHtml = `<div style="font-size:13px;font-weight:700;color:#243b53;margin-bottom:8px">${hsEsc(HS_ENPS_Q)}</div>
        <div id="hsAnsEnps" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">${Array.from({ length: 11 }, (_, i) => `<button type="button" onclick="hsPickEnps(${i},this)" style="width:34px;height:34px;border:1.5px solid #d0d7e0;background:#fff;border-radius:8px;cursor:pointer;font-weight:800;font-family:inherit">${i}</button>`).join('')}</div>`;
    } else {
        qHtml = (s.questions || []).map(q => `<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:700;color:#243b53;margin-bottom:6px">${hsEsc(q.text)}</div><div style="display:flex;gap:6px" data-qid="${q.id}">${[1, 2, 3, 4, 5].map(n => `<button type="button" onclick="hsPickRate('${q.id}',${n},this)" style="flex:1;height:38px;border:1.5px solid #d0d7e0;background:#fff;border-radius:8px;cursor:pointer;font-weight:800;font-family:inherit">${n}</button>`).join('')}</div></div>`).join('');
    }
    window._hsAns = { surveyId: sid, answers: {} };
    hsModal(`📝 ${hsEsc(s.title || 'استبيان')}`, `${s.description ? `<div style="font-size:12px;color:#888;margin-bottom:10px">${hsEsc(s.description)}</div>` : ''}${qHtml}<div style="margin:6px 0 12px"><textarea id="hsAnsComment" rows="2" placeholder="تعليق (اختياري)" style="width:100%;${hsInp()};resize:vertical"></textarea></div><button class="btn b-g" onclick="hsSubmitSurvey()" style="width:100%;font-weight:800">📤 إرسال</button>${s.anonymous ? '<div style="font-size:10.5px;color:#95a5a6;text-align:center;margin-top:6px">🔒 هذا الاستبيان مجهول — لن تُعرض هويتك في النتائج</div>' : ''}`);
};
window.hsPickEnps = function (v, btn) { window._hsAns.answers.enps = v; Array.from(btn.parentElement.children).forEach(b => { b.style.background = '#fff'; b.style.color = '#000'; b.style.borderColor = '#d0d7e0'; }); btn.style.background = '#8e44ad'; btn.style.color = '#fff'; btn.style.borderColor = '#8e44ad'; };
window.hsPickRate = function (qid, v, btn) { window._hsAns.answers[qid] = v; Array.from(btn.parentElement.children).forEach(b => { b.style.background = '#fff'; b.style.color = '#000'; b.style.borderColor = '#d0d7e0'; }); btn.style.background = '#16a085'; btn.style.color = '#fff'; btn.style.borderColor = '#16a085'; };
window.hsSubmitSurvey = async function () {
    const a = window._hsAns; if (!a) return;
    const s = hsSurveys()[a.surveyId]; if (!s) return;
    if (s.type === 'enps' && a.answers.enps == null) { toast('⚠️ اختر تقييماً من 0 إلى 10', 'er'); return; }
    if (s.type === 'rating' && (s.questions || []).some(q => a.answers[q.id] == null)) { toast('⚠️ أجب على كل الأسئلة', 'er'); return; }
    const me = (typeof myEmpContext === 'function') ? myEmpContext() : null;
    const empKey = me ? me.key : (window.myP?.empKey || '');
    if (empKey && hsHasResponded(a.surveyId, empKey)) { toast('لقد أجبت على هذا الاستبيان مسبقاً', 'wn'); document.getElementById('hsGenModal').style.display = 'none'; return; }
    const rec = { surveyId: a.surveyId, empKey: empKey || null, empName: s.anonymous ? '' : (me?.data?.name || ''), answers: a.answers, comment: document.getElementById('hsAnsComment')?.value.trim() || '', submittedAt: new Date().toISOString() };
    try { await window.push(window.R.surveyResponses, rec); toast('✅ شكراً — تم إرسال ردّك', 'ok'); document.getElementById('hsGenModal').style.display = 'none'; if (typeof renderSelfService === 'function') renderSelfService(); } catch (er) { toast('خطأ: ' + (er.message || er), 'er'); }
};
