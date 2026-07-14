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
    const typeOpts = Object.entries(HS_LETTER_TYPES).map(([t, d]) => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${d.label}</option>`).join('');

    const kpi = (icon, label, val, col) => `<div style="background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:150px;border-top:3px solid ${col};box-shadow:0 1px 4px rgba(0,0,0,.05)"><div style="font-size:12px;color:#888">${icon} ${label}</div><div style="font-size:22px;font-weight:800;color:${col};margin-top:4px">${val}</div></div>`;

    const statusBadge = l => l.status === 'pending'
        ? '<span style="background:#fef9e7;color:#b9770e;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">⏳ طلب موظف</span>'
        : '<span style="background:#eafaf1;color:#1e8449;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">✅ صادر</span>';

    const listRow = l => {
        const t = HS_LETTER_TYPES[l.type] || HS_LETTER_TYPES.employment;
        const e = (window.emp || {})[l.empKey] || {};
        return `<tr style="border-bottom:1px solid #f2f5f8">
            <td style="padding:8px 10px;font-weight:700">${hsEsc(l.empName || e.name || '—')}</td>
            <td style="padding:8px 10px;color:${t.color};font-weight:700;font-size:12px">${t.label}</td>
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

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${t.label} — ${hsEsc(e.name || '')}</title>
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
window.hsLetterTypeOptions = function () { return Object.entries(HS_LETTER_TYPES).map(([t, d]) => `<option value="${t}">${d.label}</option>`).join(''); };
window.hsLetterLabel = function (t) { return (HS_LETTER_TYPES[t] || HS_LETTER_TYPES.employment).label; };

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
                    <span style="font-size:10px;color:${pr.color};background:${pr.color}18;border-radius:8px;padding:2px 8px;white-space:nowrap">${pr.label}</span>
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
    const prOpts = Object.entries(HS_ANN_PRIORITY).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
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
                    <div style="font-size:14px;font-weight:800;color:${band.color}">🇸🇦 نطاق السعودة التقريبي: ${band.label}</div>
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
