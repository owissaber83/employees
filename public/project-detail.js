// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   📁  GBR PROJECT DETAIL MODULE  — وحدة ملف المشروع المتكامل              ║
// ║   النسخة: 1.0  |  يونيو 2026                                               ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// يعمل هذا الملف مع app.js ويستخدم المتغيرات العامة:
//   window.projects, window.emp, window.payrolls, window.projectBOQ,
//   window.progressBillings, window.matPurchases, window.matRequests,
//   window.projectExpenses (جديد), window.projectNotes (جديد)
//   window.projectMilestones (مراحل المشروع — تبويب الجدول الزمني)
//   db, ref, push, update, remove, R, $, toast, fmt, cf2, ov, cov

// ── State ──────────────────────────────────────────────────────────────────
window._pd = { projectId: null, tab: 'overview', billingPage: 1, billView: 'table', docsSubTab: 'docs' };

// ── أوامر التغيير — مصدران: بنود BOQ في أقسام VO + سجلات projectChangeOrders المعتمدة ──
function pdNetApprovedCOs(projectId, asOfDate) {
    // المصدر 1: بنود BOQ ذات section تبدأ بـ VO (أوامر التغيير المضافة من صفحة BOQ)
    const boqItems = window.projectBOQ?.[projectId]
        ? Object.values(window.projectBOQ[projectId]) : [];
    const fromBOQ = boqItems
        .filter(it => it.section && it.section.startsWith('VO'))
        .reduce((s, it) => s + (parseFloat(it.unitPrice) || 0) * (parseFloat(it.quantity) || 0), 0);

    // المصدر 2: سجلات projectChangeOrders المعتمدة (من تاب العقد والبنود)
    const cos = window.projectChangeOrders?.[projectId] || {};
    const fromCORecs = Object.values(cos)
        .filter(co => co.status === 'approved'
                   && (!asOfDate || (co.date || '') <= asOfDate))
        .reduce((s, co) => {
            const amt = parseFloat(co.amount) || 0;
            return s + (co.type === 'deduction' ? -amt : amt);
        }, 0);

    return fromBOQ + fromCORecs;
}
// قيمة العقد المعدّلة (أصل العقد + صافي أوامر التغيير)
function pdAdjustedContract(projectId, asOfDate) {
    const p = (window.projects || {})[projectId];
    const base = parseFloat(p?.contractValue || p?.budget || 0);
    return base + pdNetApprovedCOs(projectId, asOfDate);
}

// ── زر "العودة لدليل العرض" العائم ────────────────────────────────────────
window.pdShowBackToGuide = function () {
    const b = document.getElementById('pdBackToGuideBtn');
    if (b) b.style.display = 'flex';
};
window.pdReturnToGuide = function () {
    if (window.nav) nav('prjdashboard', null);
    if (typeof switchPrjDashTab === 'function') switchPrjDashTab('docs');
    const b = document.getElementById('pdBackToGuideBtn');
    if (b) b.style.display = 'none';
};

// ── الانتقال السريع لتبويب معيّن في مشروع (لاستخدام سكريبت العرض في الدليل التوثيقي) ──
window.pdGoToDemoTab = function (tab) {
    const keys = Object.keys(window.projects || {});
    if (!keys.length) { toast('لا توجد مشاريع لعرضها بعد', 'er'); return; }
    const pid = (window._pd.projectId && window.projects[window._pd.projectId]) ? window._pd.projectId : keys[0];
    window._pd.projectId = pid;
    window._pd.tab = tab;
    window._pd.billingPage = 1;
    if (window.nav) nav('projectdetail', null);
    renderProjectDetail();
};

// ── Entry Point ────────────────────────────────────────────────────────────
window.openProjectDetail = function (projectId) {
    window._pd.projectId = projectId;
    window._pd.tab = 'overview';
    window._pd.billingPage = 1;
    // Update nav title
    const ttMap = window.__navTitles || {};
    if (window.nav) nav('projectdetail', null);
    renderProjectDetail();
};

// مستخلص يُعتبر "محصَّل" فقط إذا تحوّل إلى فاتورة مبيعات واعتُمدت تلك الفاتورة وتم ترحيلها (status: posted/paid)
// أما إن كانت الفاتورة لا تزال "مسودة" أو لم تُصدر أصلاً فالمستخلص يبقى "مستحق"
function pdIsBillingCollected(b) {
    if (!b || !b.salesInvoiceKey) return false;
    const inv = (window.salesInvoices || {})[b.salesInvoiceKey];
    return !!inv && (inv.status === 'posted' || inv.status === 'paid');
}

// ── Main Render ─────────────────────────────────────────────────────────────
window.renderProjectDetail = function () {
    const pg = document.getElementById('pg-projectdetail');
    if (!pg || !pg.classList.contains('act')) return;
    const projectId = window._pd.projectId;
    if (!projectId) { pg.innerHTML = '<div class="empty"><div class="ei">📁</div><p>لم يتم اختيار مشروع</p></div>'; return; }
    const p = (window.projects || {})[projectId];
    if (!p) { pg.innerHTML = '<div class="empty"><div class="ei">📁</div><p>المشروع غير موجود</p></div>'; return; }

    // ── KPI حسابات ──
    const boqItems = window.projectBOQ?.[projectId] ? Object.values(window.projectBOQ[projectId]) : [];
    const boqTotal = boqItems.reduce((s, it) => s + (parseFloat(it.unitPrice) || 0) * (parseFloat(it.quantity) || 0), 0);
    const contractValueBase = parseFloat(p.contractValue || p.budget || 0);
    const coNetAll = pdNetApprovedCOs(projectId);
    const contractValue = contractValueBase + coNetAll;   // المعدّلة (شاملة أوامر التغيير)

    const billings = Object.values(window.progressBillings || {}).filter(b => b.projectId === projectId && b.status !== 'cancelled');
    const billedTotal = billings.reduce((s, b) => s + (parseFloat(b.currentAmount) || 0), 0);
    // ✅ المستخلصات التي تحوّلت إلى فاتورة معتمدة ومرحَّلة فعليًا (محصَّلة/قيد التحصيل) — بدون ضريبة (نفس أساس قيمة العقد)
    const collectedCertTotal = billings.filter(b => pdIsBillingCollected(b))
        .reduce((s, b) => s + (parseFloat(b.currentAmount) || 0), 0);
    // 📑 المستخلصات التي لم تتحوّل بعد إلى فاتورة معتمدة ومرحَّلة (مستحقة) — تشمل المسوّدات والفواتير غير المرحَّلة، بدون ضريبة
    const dueCertTotal = billings.filter(b => !pdIsBillingCollected(b))
        .reduce((s, b) => s + (parseFloat(b.currentAmount) || 0), 0);
    // إجمالي المستخلصات = المحصَّل + المستحق (كلاهما الآن بنفس أساس currentAmount بدون ضريبة، فيطابق billedTotal)
    const totalCertValue = billedTotal;

    const matCost = Object.values(window.matPurchases || {}).filter(pu => pu.projectId === projectId || (pu.project && pu.project.id === projectId))
        .reduce((s, pu) => s + (parseFloat(pu.purchasedQty) || 0) * (parseFloat(pu.purchasedUnitPrice) || 0), 0);
    const directExp = Object.values((window.projectExpenses || {})[projectId] || {})
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const totalExp = matCost + directExp;

    // PMC — تكاليف المشاريع الشهرية لهذا المشروع
    const pmcRecords = Object.values(window.projectMonthlyCosts || {}).filter(c => c.projectId === projectId);
    const pmcTotal = pmcRecords.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

    // التكاليف غير المباشرة المخصصة لهذا المشروع (تراكمي السنة الحالية)
    const currentYear = new Date().getFullYear().toString();
    const indirectCostAnnual = typeof window.icProjectAnnualShare === 'function'
        ? window.icProjectAnnualShare(projectId, currentYear) : 0;

    const balance = contractValue - billedTotal;

    const statusMap = { planning: '📋 في التخطيط', active: '⚙️ قيد التنفيذ', completed: '✅ مكتمل', 'on-hold': '⏸️ موقوف' };
    const statusColors = { planning: '#fff3cd:#664d03', active: '#d4edda:#155724', completed: '#cfe2ff:#084298', 'on-hold': '#f8d7da:#721c24' };
    const [sbg, scl] = (statusColors[p.status] || '#f8f9fa:#333').split(':');

    // ── أيام المشروع ──
    let progress = 0, daysLeft = 0, daysTotal = 0;
    if (p.startDate && p.endDate) {
        const start = new Date(p.startDate), end = new Date(p.endDate), now = new Date();
        daysTotal = Math.max(1, Math.round((end - start) / 86400000));
        const elapsed = Math.max(0, Math.round((now - start) / 86400000));
        progress = Math.min(100, Math.round((elapsed / daysTotal) * 100));
        daysLeft = Math.max(0, Math.round((end - now) / 86400000));
    }

    pg.innerHTML = `
    <!-- ── رأس الصفحة ── -->
    <div style="background:linear-gradient(135deg,#1a3a5c,#2d6a9f);color:white;border-radius:14px;padding:20px 24px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div style="flex:1;min-width:200px">
            <div style="font-size:22px;font-weight:800;margin-bottom:6px">📁 ${p.name || '-'}</div>
            <div style="font-size:13px;opacity:.85;margin-bottom:8px">${p.description || ''}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <span style="background:${sbg};color:${scl};padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700">${statusMap[p.status] || p.status}</span>
                ${p.contractNo ? `<span style="background:rgba(255,255,255,.15);padding:4px 10px;border-radius:8px;font-size:12px">📄 ${p.contractNo}</span>` : ''}
                ${p.manager ? `<span style="background:rgba(255,255,255,.15);padding:4px 10px;border-radius:8px;font-size:12px">👤 ${p.manager}</span>` : ''}
            </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" onclick="bcNav('projects')" style="background:rgba(255,255,255,.15);color:white;border:1.5px solid rgba(255,255,255,.3);padding:8px 14px;font-size:12px">← قائمة المشاريع</button>
            <button class="btn" onclick="pdClientPortal('${projectId}')" style="background:rgba(255,255,255,.15);color:white;border:1.5px solid rgba(255,255,255,.3);padding:8px 14px;font-size:12px" title="تقرير حالة نظيف للعميل — للطباعة أو المشاركة PDF">🌐 بوابة العميل</button>
            <button class="btn b-o" onclick="openPrjM('${projectId}')" style="padding:8px 14px;font-size:12px">✏️ تعديل المشروع</button>
        </div>
    </div>

    <!-- ── KPIs — قيمة العقد وأوامر التغيير ── -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:8px;background:#dbe8f5;padding:12px;border-radius:10px 10px 0 0;border-bottom:2px dashed #aac4de">
        ${kpiCard('💰', 'قيمة العقد الأصلية', fmt(contractValueBase), 'ريال', '#2d6a9f')}
        ${kpiCard('🔄', 'أوامر التغيير المعتمدة', (coNetAll >= 0 ? '+' : '') + fmt(coNetAll), coNetAll > 0 ? 'إضافات' : coNetAll < 0 ? 'خصومات' : 'لا توجد', coNetAll > 0 ? '#0e6655' : coNetAll < 0 ? '#c0392b' : '#888')}
        ${kpiCard('📊', 'إجمالي قيمة العقد', fmt(contractValue), 'الأصلية + أوامر التغيير', '#1a3a5c')}
    </div>

    <!-- ── KPIs — المستخلصات والرصيد ── -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px;background:#8ebeee;padding:12px;border-radius:0 0 10px 10px">
        ${kpiCard('📑', 'إجمالي المستخلصات (المحصَّل + المستحق)', fmt(totalCertValue), 'ريال', '#16a085')}
        ${kpiCard('✅', 'محصَّل (مستخلصات تحوّلت لفاتورة)', fmt(collectedCertTotal), 'ريال', '#27ae60', `pdShowBillingListPage('${projectId}','collected')`)}
        ${kpiCard('⏳', 'مستحق (مستخلصات لم تتحوّل لفاتورة)', fmt(dueCertTotal), 'ريال', dueCertTotal > 0 ? '#e67e22' : '#888', `pdShowBillingListPage('${projectId}','due')`)}
        ${kpiCard('⚖️', 'الرصيد المتبقي', fmt(balance), 'من إجمالي العقد', balance >= 0 ? '#27ae60' : '#e74c3c')}
    </div>
 <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px;background:#8ebeee;padding:12px;border-radius:10px">
   ${kpiCard('💸', 'إجمالي المصروفات', fmt(totalExp), 'ريال', '#4622e6')}
${pmcTotal > 0 ? kpiCard('📦', 'تكاليف التنفيذ (PMC)', fmt(pmcTotal), `${pmcRecords.length} سجل`, '#c0392b') : ''}
${indirectCostAnnual > 0 ? kpiCard('📊', 'التكاليف غير المباشرة', fmt(indirectCostAnnual), `سنة ${currentYear}`, '#5b2c6f') : ''}
        ${(() => {
            const netProfitLoss = totalCertValue - totalExp - pmcTotal - indirectCostAnnual;
            return kpiCard(netProfitLoss >= 0 ? '📈' : '📉', netProfitLoss >= 0 ? 'صافي الربح المتوقع' : 'صافي الخسارة المتوقعة', fmt(Math.abs(netProfitLoss)), 'المستخلصات − مصروفات − PMC − غير مباشرة', netProfitLoss >= 0 ? '#27ae60' : '#e74c3c');
        })()}
          ${kpiCard('📋', 'بنود BOQ', boqItems.length.toString(), 'بند', '#2980b9')}
        ${(() => {
            const projInvCount = Object.values(window.salesInvoices || {}).filter(inv => inv.projectId === projectId && inv.status !== 'cancelled').length;
            return projInvCount > 0 ? kpiCard('🧾', 'فواتير المبيعات', projInvCount.toString(), 'فاتورة', '#16a085') : '';
        })()}
        ${daysTotal > 0 ? kpiCard('📅', 'نسبة الإنجاز الزمني', progress + '%', `${daysLeft} يوم متبقي`, '#8e44ad') : ''}
   </div>
    <!-- ── شريط التقدم الزمني ── -->
    ${daysTotal > 0 ? `
    <div style="background:white;border-radius:12px;padding:14px 18px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:13px;font-weight:700;color:#1a3a5c">⏳ التقدم الزمني للمشروع</span>
            <span style="font-size:12px;color:#666">${p.startDate || ''} ← ${p.endDate || ''}</span>
        </div>
        <div style="background:#e8f0f7;border-radius:20px;height:10px;overflow:hidden">
            <div style="width:${progress}%;background:${progress > 90 ? '#e74c3c' : progress > 70 ? '#e67e22' : '#27ae60'};height:100%;border-radius:20px;transition:width .4s"></div>
        </div>
        <div style="text-align:center;font-size:12px;color:#666;margin-top:6px">${progress}% من المدة الزمنية — متبقي ${daysLeft} يوم</div>
    </div>` : ''}

    <!-- ── تبويبات ── -->
    <div style="background:white;border-radius:12px;padding:6px;margin-bottom:14px;display:flex;gap:4px;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,.04)">
        ${pdTabBtn('overview',  '📊 نظرة عامة')}
        ${pdTabBtn('contract',  '📄 العقد والبنود')}
        ${pdTabBtn('timeline',  '⏱️ الجدول الزمني')}
        ${pdTabBtn('tasks',     `✅ المهام${(() => { const n = Object.values((window.projectTasks || {})[projectId] || {}).filter(t => t.status !== 'done').length; return n ? ` (${n})` : ''; })()}`)}
        ${pdTabBtn('billings',  '📑 المستخلصات')}
        ${pdTabBtn('evm',       '📐 الأداء (EVM)')}
        ${pdTabBtn('cashflow',  '💧 التدفق النقدي')}
        ${pdTabBtn('invoices',  '🧾 فواتير المبيعات')}
        ${pdTabBtn('expenses',  '💸 المصروفات')}
        ${pdTabBtn('suppliers', '🚚 الموردون والتوريدات')}
        ${pdTabBtn('subcontracts', `🤝 عقود الباطن${(() => { const n = Object.values((window.subcontracts || {})[projectId] || {}).length; return n ? ` (${n})` : ''; })()}`)}
        ${pdTabBtn('pmc',       `📦 تكاليف التنفيذ${pmcRecords.length ? ` (${pmcRecords.length})` : ''}`)}
        ${pdTabBtn('timesheets','⏱️ الأوقات')}
        ${pdTabBtn('payroll',   '💵 الرواتب')}
        ${pdTabBtn('rfis',      `📨 طلبات المعلومات${(() => { const n = Object.values((window.rfis || {})[projectId] || {}).filter(r => r.status !== 'closed').length; return n ? ` (${n})` : ''; })()}`)}
        ${pdTabBtn('punch',     `🔧 قوائم النواقص${(() => { const n = Object.values((window.punchItems || {})[projectId] || {}).filter(r => r.status !== 'closed').length; return n ? ` (${n})` : ''; })()}`)}
        ${pdTabBtn('qhse',      `🦺 الجودة والسلامة${(() => { const n = Object.values((window.qhse || {})[projectId] || {}).filter(r => r.status !== 'closed').length; return n ? ` (${n})` : ''; })()}`)}
        ${pdTabBtn('submittals',`📋 المستندات الفنية${(() => { const n = Object.values((window.submittals || {})[projectId] || {}).filter(r => !['approved', 'approved_noted'].includes(r.status)).length; return n ? ` (${n})` : ''; })()}`)}
        ${pdTabBtn('meetings',  `📝 الاجتماعات والمحاضر${(() => { const n = Object.values((window.meetings || {})[projectId] || {}).filter(r => r.status !== 'closed').length; return n ? ` (${n})` : ''; })()}`)}
        ${pdTabBtn('tenders',   `📢 المناقصات${(() => { const n = Object.values((window.tenders || {})[projectId] || {}).filter(r => ['open', 'evaluating'].includes(r.status)).length; return n ? ` (${n})` : ''; })()}`)}
        ${pdTabBtn('notes',     '📝 ملاحظات')}
        ${pdTabBtn('docs',      '📁 المستندات والتقارير')}
        ${pdTabBtn('activity',  '📜 سجل النشاط')}
    </div>

    <!-- ── محتوى التبويبات ── -->
    <div id="pd-tab-overview"  class="pd-tab-pane"></div>
    <div id="pd-tab-contract"  class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-timeline"  class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-tasks"     class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-billings"  class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-evm"       class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-cashflow"  class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-invoices"  class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-expenses"  class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-suppliers" class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-subcontracts" class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-pmc"       class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-timesheets" class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-payroll"   class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-rfis"      class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-punch"     class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-qhse"      class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-submittals" class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-meetings"  class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-tenders"   class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-notes"     class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-docs"      class="pd-tab-pane" style="display:none"></div>
    <div id="pd-tab-activity"  class="pd-tab-pane" style="display:none"></div>
    `;

    pdSwitchTab(window._pd.tab);
};

// ── مساعد KPI بطاقة ──────────────────────────────────────────────
function kpiCard(ic, lb, vl, sb, color, onClick) {
    const clk = !!onClick;
    return `<div ${clk ? `onclick="${onClick}" onmouseover="this.style.boxShadow='0 4px 14px rgba(0,0,0,.12)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,.05)'"` : ''} style="background:white;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.05);border-top:3px solid ${color}${clk ? ';cursor:pointer;transition:box-shadow .15s' : ''}">
        <div style="font-size:22px;margin-bottom:6px">${ic}</div>
        <div style="font-size:11px;color:#888;font-weight:600">${lb}</div>
        <div style="font-size:16px;font-weight:800;color:${color};margin:4px 0">${vl}</div>
        <div style="font-size:11px;color:#aaa">${sb}${clk ? ' <span style="color:#2d6a9f;font-weight:700">↗ عرض القائمة</span>' : ''}</div>
    </div>`;
}

// ── زر تبويب ────────────────────────────────────────────────────
function pdTabBtn(id, label) {
    const active = window._pd.tab === id;
    return `<button onclick="pdSwitchTab('${id}')" style="padding:9px 14px;border-radius:8px;border:none;background:${active ? '#2d6a9f' : '#f8fafc'};color:${active ? 'white' : '#1a3a5c'};font-weight:${active ? '800' : '600'};cursor:pointer;font-size:12px;font-family:inherit;transition:all .15s" id="pd-btn-${id}">${label}</button>`;
}

// ── تبديل تبويب ──────────────────────────────────────────────────
window.pdSwitchTab = function (tab) {
    window._pd.tab = tab;
    document.querySelectorAll('.pd-tab-pane').forEach(p => p.style.display = 'none');
    document.querySelectorAll('[id^="pd-btn-"]').forEach(b => {
        const isActive = b.id === `pd-btn-${tab}`;
        b.style.background = isActive ? '#2d6a9f' : '#f8fafc';
        b.style.color = isActive ? 'white' : '#1a3a5c';
        b.style.fontWeight = isActive ? '800' : '600';
    });
    const pane = document.getElementById(`pd-tab-${tab}`);
    if (pane) { pane.style.display = ''; pdRenderTab(tab); }
};

// ── رندر تبويب حسب النوع ────────────────────────────────────────
function pdRenderTab(tab) {
    const pid = window._pd.projectId;
    if (!pid) return;
    if (tab === 'overview')  pdRenderOverview(pid);
    if (tab === 'contract')  pdRenderContract(pid);
    if (tab === 'timeline')  pdRenderTimeline(pid);
    if (tab === 'tasks')     pdRenderTasks(pid);
    if (tab === 'billings')  pdRenderBillings(pid);
    if (tab === 'evm')       pdRenderEVM(pid);
    if (tab === 'cashflow')  pdRenderCashflow(pid);
    if (tab === 'invoices')  pdRenderProjectInvoices(pid);
    if (tab === 'expenses')  pdRenderExpenses(pid);
    if (tab === 'suppliers') pdRenderSuppliers(pid);
    if (tab === 'subcontracts') pdRenderSubcontracts(pid);
    if (tab === 'pmc')       pdRenderPMC(pid);
    if (tab === 'timesheets' && typeof pdRenderTimesheets === 'function') pdRenderTimesheets(pid);
    if (tab === 'payroll')   pdRenderPayroll(pid);
    if (tab === 'rfis')      pdRenderRFIs(pid);
    if (tab === 'punch')     pdRenderPunch(pid);
    if (tab === 'qhse')      pdRenderQHSE(pid);
    if (tab === 'submittals') pdRenderSubmittals(pid);
    if (tab === 'meetings')  pdRenderMeetings(pid);
    if (tab === 'tenders')   pdRenderTenders(pid);
    if (tab === 'notes')     pdRenderNotes(pid);
    if (tab === 'docs')      pdRenderDocsAndReports(pid);
    if (tab === 'activity')  pdRenderActivityLog(pid);
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB 1 — نظرة عامة                                                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function pdRenderOverview(pid) {
    const p = (window.projects || {})[pid]; if (!p) return;
    const pane = document.getElementById('pd-tab-overview'); if (!pane) return;

    const assignments = Object.values(window.projEmpAssignments || {}).filter(a => a.projectId === pid);
    const projEmps = Object.entries(window.emp || {}).filter(([, e]) => e.projectId === pid || e.affiliationType === 'project' && e.projectId === pid);

    // ── الموقف المالي الصافي للمشروع ──
    const allInv = Object.entries(window.salesInvoices || {}).filter(([, inv]) => inv.projectId === pid && inv.status !== 'cancelled');
    const collectedBeforeTax = allInv.reduce((s, [, inv]) => {
        const grand = parseFloat(inv.grandTotal) || 0;
        const paid = parseFloat(inv.paidAmount) || 0;
        if (grand <= 0) return s;
        const beforeVAT = parseFloat(inv.netBeforeTax) || (grand - (parseFloat(inv.vatTotal) || 0));
        return s + beforeVAT * (paid / grand);
    }, 0);

    const billings = Object.values(window.progressBillings || {}).filter(b => b.projectId === pid && b.status !== 'cancelled');
    const billingInvoiceKeys = new Set(billings.filter(b => pdIsBillingCollected(b)).map(b => b.salesInvoiceKey));
    const dueUninvoiced = billings.filter(b => !pdIsBillingCollected(b))
        .reduce((s, b) => s + (parseFloat(b.currentAmount) || 0), 0);
    const dueUnpaidInvoiced = allInv.filter(([k]) => billingInvoiceKeys.has(k)).reduce((s, [, inv]) => {
        const grand = parseFloat(inv.grandTotal) || 0;
        const paid = parseFloat(inv.paidAmount) || 0;
        const pending = grand - paid;
        if (grand <= 0 || pending <= 0) return s;
        const beforeVAT = parseFloat(inv.netBeforeTax) || (grand - (parseFloat(inv.vatTotal) || 0));
        return s + beforeVAT * (pending / grand);
    }, 0);
    const outstandingDue = dueUninvoiced + dueUnpaidInvoiced;
    const grossTotal = collectedBeforeTax + outstandingDue;

    const matCost = Object.values(window.matPurchases || {}).filter(pu => pu.projectId === pid || (pu.project && pu.project.id === pid))
        .reduce((s, pu) => s + (parseFloat(pu.purchasedQty) || 0) * (parseFloat(pu.purchasedUnitPrice) || 0), 0);
    const directExp = Object.values((window.projectExpenses || {})[pid] || {}).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const totalExp = matCost + directExp;
    const pmcTotal = Object.values(window.projectMonthlyCosts || {}).filter(c => c.projectId === pid).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    const otherDeductions = parseFloat(p.otherDeductions) || 0;
    const netResult = grossTotal - pmcTotal - totalExp - otherDeductions;

    // ── الربح الفعلي الحالي (إيرادات المستخلصات المعتمدة مقابل التكاليف الفعلية) ──
    const approvedRevenue = billings.filter(b => ['approved', 'paid'].includes(b.status))
        .reduce((s, b) => s + (parseFloat(b.netAmount) || parseFloat(b.currentAmount) || 0), 0);
    const totalCosts = pmcTotal + totalExp;
    const actualProfitLoss = approvedRevenue - totalCosts;

    pane.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn b-g" onclick="pdOpenExecSummary('${pid}')">📄 ملخص تنفيذي (طباعة/PDF)</button>
    </div>

    <div class="card" style="margin-bottom:16px">
        <div class="c-tl">📈 الربح الفعلي الحالي (حسب المستخلصات المعتمدة)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:12px">
            ${finRow('✅ الإيرادات الفعلية (بدون ضريبة) من المستخلصات المعتمدة', approvedRevenue, '#27ae60')}
            ${finRow('➖ إجمالي تكاليف التنفيذ (PMC) + المصروفات', totalCosts, '#c0392b')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:linear-gradient(135deg,${actualProfitLoss >= 0 ? '#1e7e4f,#27ae60' : '#922b21,#e74c3c'});color:white;border-radius:10px;margin-top:12px;font-weight:800;font-size:15px">
            <span>${actualProfitLoss >= 0 ? '= الربح الفعلي الحالي' : '= الخسارة الفعلية الحالية'}</span><span>${fmt(Math.abs(actualProfitLoss))} ريال</span>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#888">مقارنة الإيراد المعتمد فعليًا (بصرف النظر عن التحصيل) بإجمالي ما صُرف حتى الآن — لمتابعة وتيرة الصرف والإيراد أولًا بأول</div>
        <div style="height:170px;margin-top:14px"><canvas id="pd-actual-profit-chart"></canvas></div>
    </div>

    <div class="card" style="margin-bottom:16px">
        <div class="c-tl">📊 الموقف المالي الصافي للمشروع</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:12px">
            ${finRow('✅ المحصَّل من العميل (بدون ضريبة)', collectedBeforeTax, '#27ae60')}
            ${finRow('📑 المستحق غير المحصَّل (مستخلصات صادرة)', outstandingDue, '#e67e22')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#eaf2f8;border-radius:8px;margin-top:10px;font-weight:800;color:#1a3a5c;font-size:13px">
            <span>= الإجمالي (المحصَّل + المستحق)</span><span>${fmt(grossTotal)} ريال</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px">
            ${finRow('➖ تكاليف التنفيذ (PMC)', pmcTotal, '#c0392b')}
            ${finRow('➖ المصروفات (مباشرة + مشتريات)', totalExp, '#c0392b')}
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#f8fafc;border-radius:8px;padding:8px 10px">
            <span style="font-size:12px;color:#555;font-weight:700">➖ خصومات أخرى (تُدخل يدويًا)</span>
            <input type="number" min="0" step="0.01" value="${otherDeductions}" onchange="pdUpdateOtherDeductions('${pid}', this.value)" style="width:140px;padding:6px 8px;border:1.5px solid #d0d7e0;border-radius:6px;font-family:inherit;font-size:12px;text-align:center">
            <span style="font-size:11px;color:#888">ريال</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:linear-gradient(135deg,#1a3a5c,#2d6a9f);color:white;border-radius:10px;margin-top:12px;font-weight:800;font-size:15px">
            <span>= الصافي النهائي للمشروع</span><span style="color:${netResult >= 0 ? '#7ee8b9' : '#ffb3a7'}">${fmt(netResult)} ريال</span>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">

        <!-- بيانات المشروع الأساسية -->
        <div class="card">
            <div class="c-tl">📋 بيانات المشروع</div>
            <div class="info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
                ${infoRow('رقم العقد', p.contractNo || '-')}
                ${infoRow('نوع المشروع', p.type || '-')}
                ${infoRow('تاريخ العقد', p.contractDate || '-')}
                ${infoRow('تاريخ البدء', p.startDate || '-')}
                ${infoRow('تاريخ الانتهاء', p.endDate || '-')}
                ${infoRow('التسليم النهائي', p.finalHandover || '-')}
                ${infoRow('المدينة', p.city || '-')}
                ${infoRow('الموقع', p.address || '-')}
            </div>
        </div>

        <!-- بيانات العميل/المالك -->
        <div class="card">
            <div class="c-tl">🏢 بيانات العميل</div>
            <div class="info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
                ${infoRow('اسم العميل', p.ownerName || p.clientName || '-')}
                ${infoRow('نوع العميل', p.ownerType === 'company' ? 'شركة' : p.ownerType === 'government' ? 'جهة حكومية' : 'فرد')}
                ${infoRow('رقم التواصل', p.ownerPhone || '-')}
                ${infoRow('البريد', p.ownerEmail || '-')}
                ${infoRow('الرقم الضريبي', p.clientVATNumber || '-')}
            </div>
        </div>

        <!-- بيانات مالية -->
        <div class="card">
            <div class="c-tl">💰 البيانات المالية</div>
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
                ${finRow('قيمة العقد الأصلية', p.contractValue || p.budget || 0, '#2d6a9f')}
                ${(() => { const net = pdNetApprovedCOs(pid); return net !== 0 ? finRow('قيمة العقد المعدّلة (+ أوامر التغيير)', (parseFloat(p.contractValue || p.budget || 0)) + net, net > 0 ? '#0e6655' : '#c0392b') : ''; })()}
                ${finRow('الدفعة المقدمة', p.advancePayment || 0, '#16a085')}
                ${finRow('ميزانية المواد', p.matBudgetEstimate || p.matBudget || 0, '#e67e22')}
                ${finRow('تكلفة العمالة المقدرة', p.laborCost || 0, '#8e44ad')}
                ${finRow('تكلفة المعدات', p.equipCost || 0, '#2980b9')}
                ${finRow('تكلفة المقاولين الفرعيين', p.subcontractors || 0, '#c0392b')}
                ${finRow('التكاليف غير المباشرة', p.indirectCost || 0, '#7f8c8d')}
                <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#1a3a5c;color:white;border-radius:8px;font-weight:800;margin-top:4px">
                    <span>هامش الربح المستهدف</span><span>${p.targetMargin ?? 20}%</span>
                </div>
            </div>
        </div>

        <!-- فريق المشروع -->
        <div class="card">
            <div class="c-tl">👥 فريق المشروع</div>
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
                ${teamRow('مدير المشروع', p.team?.projectManagerId, window.emp)}
                ${teamRow('مهندس الموقع', p.team?.siteEngineerId, window.emp)}
                ${teamRow('المشرف', p.team?.supervisorId, window.emp)}
                ${teamRow('المدير المالي', p.team?.financeManagerId, window.emp)}
            </div>
            ${assignments.length ? `
            <div style="margin-top:12px;font-size:12px;font-weight:700;color:#1a3a5c;margin-bottom:8px">الموظفون المعيّنون (${assignments.length})</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px">
                ${assignments.map(a => {
                    const e = (window.emp || {})[a.empId];
                    return e ? `<div style="background:#f8fafc;border:1px solid #e0e8f0;border-radius:8px;padding:8px 10px">
                        <div style="font-weight:600;font-size:12px;color:#1a3a5c">${e.name}</div>
                        <div style="font-size:11px;color:#666">${a.role || e.job || '-'}</div>
                    </div>` : '';
                }).join('')}
            </div>` : '<div style="color:#aaa;font-size:12px;margin-top:10px;text-align:center">لم يتم تعيين موظفين</div>'}
        </div>

        <!-- إعدادات الاستقطاعات -->
        <div class="card">
            <div class="c-tl">⚙️ إعدادات الاستقطاعات</div>
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
                ${finRow('نسبة الضمان', `${p.retentionPct ?? 10}%`, '#e67e22', false)}
                ${finRow('ضريبة القيمة المضافة', `${p.vatPct ?? 15}%`, '#c0392b', false)}
                ${finRow('نسبة الدفعة المقدمة', `${p.advancePct ?? 0}%`, '#16a085', false)}
                ${finRow('نسبة استرداد المقدم', `${p.advRecoveryPct ?? 0}%`, '#8e44ad', false)}
                ${finRow('فترة الضمان', `${p.warrantyMonths ?? 12} شهر`, '#2980b9', false)}
            </div>
        </div>

        <!-- نظرة سريعة على المهام -->
        <div class="card">
            <div class="tlb">
                <div class="c-tl" style="margin:0;border:none;padding:0">✅ المهام</div>
                <button class="btn b-b" style="padding:4px 10px;font-size:11px" onclick="pdSwitchTab('tasks')">عرض اللوحة ↗</button>
            </div>
            ${(() => {
                const tasks = Object.entries((window.projectTasks || {})[pid] || {});
                if (!tasks.length) return `<div style="color:#aaa;font-size:12px;margin-top:10px;text-align:center">لا توجد مهام مسجّلة</div>`;
                const today = new Date().toISOString().slice(0, 10);
                const open = tasks.filter(([, t]) => t.status !== 'done');
                const overdue = open.filter(([, t]) => t.dueDate && t.dueDate < today);
                const done = tasks.length - open.length;
                return `
                <div style="display:flex;gap:8px;margin-top:10px;margin-bottom:10px;flex-wrap:wrap">
                    <span style="background:#eef3f8;color:#1a3a5c;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700">إجمالي: ${tasks.length}</span>
                    <span style="background:#eafaf1;color:#1e8449;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700">مكتملة: ${done}</span>
                    <span style="background:#fef9e7;color:#7d6608;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700">مفتوحة: ${open.length}</span>
                    ${overdue.length ? `<span style="background:#fdecea;color:#c0392b;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700">⚠️ متأخرة: ${overdue.length}</span>` : ''}
                </div>
                ${overdue.length ? `<div style="display:flex;flex-direction:column;gap:6px">
                    ${overdue.slice(0, 4).map(([, t]) => `<div style="background:#fdecea;border-right:3px solid #c0392b;border-radius:6px;padding:6px 10px;font-size:12px;color:#922b21;display:flex;justify-content:space-between"><span>${t.title}</span><span>${t.dueDate}</span></div>`).join('')}
                </div>` : ''}`;
            })()}
        </div>

    </div>`;

    pdBuildActualProfitChart(approvedRevenue, totalCosts);
}

function pdBuildActualProfitChart(approvedRevenue, totalCosts) {
    const canvas = document.getElementById('pd-actual-profit-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    window._pdCharts = window._pdCharts || {};
    if (window._pdCharts.actualProfit) { window._pdCharts.actualProfit.destroy(); }
    window._pdCharts.actualProfit = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['الإيرادات الفعلية (المستخلصات المعتمدة)', 'إجمالي التكاليف (PMC + المصروفات)'],
            datasets: [{
                data: [approvedRevenue, totalCosts],
                backgroundColor: ['#27ae60', '#c0392b'],
                borderRadius: 6,
                barThickness: 36
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { callback: v => fmt(v) } } }
        }
    });
}

window.pdUpdateOtherDeductions = async function (pid, value) {
    const v = parseFloat(value) || 0;
    try {
        await update(ref(db, `ledger/projects/${pid}`), { otherDeductions: v });
        toast('تم تحديث الخصومات الأخرى ✓', 'ok');
        setTimeout(() => pdRenderTab('overview'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

function infoRow(label, value) {
    return `<div style="background:#f8fafc;border-radius:8px;padding:8px 10px">
        <div style="font-size:10px;color:#888;font-weight:700;margin-bottom:3px">${label}</div>
        <div style="font-size:13px;font-weight:600;color:#1a3a5c">${value}</div>
    </div>`;
}

function finRow(label, value, color, isNumber = true) {
    const display = isNumber ? (parseFloat(value) > 0 ? fmt(value) + ' ريال' : '-') : value;
    return `<div style="display:flex;justify-content:space-between;padding:7px 10px;background:#f8fafc;border-radius:8px">
        <span style="font-size:12px;color:#555">${label}</span>
        <span style="font-weight:700;color:${color};font-size:12px">${display}</span>
    </div>`;
}

function teamRow(role, empId, empData) {
    const e = empId ? (empData || {})[empId] : null;
    return `<div style="display:flex;justify-content:space-between;padding:7px 10px;background:#f8fafc;border-radius:8px">
        <span style="font-size:12px;color:#555">${role}</span>
        <span style="font-weight:600;font-size:12px;color:#1a3a5c">${e ? e.name : '-'}</span>
    </div>`;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB 2 — العقد والبنود (BOQ)                                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function pdRenderContract(pid) {
    const p = (window.projects || {})[pid]; if (!p) return;
    const pane = document.getElementById('pd-tab-contract'); if (!pane) return;

    const boqEntries = window.projectBOQ?.[pid] ? Object.entries(window.projectBOQ[pid]) : [];
    const boqTotal = boqEntries.reduce((s, [, it]) => s + (parseFloat(it.unitPrice) || 0) * (parseFloat(it.quantity) || 0), 0);
    const contractValueBase = parseFloat(p.contractValue || p.budget || 0);

    // ── أوامر التغيير (Change Orders / Variations) — تعدّل قيمة العقد بعد التوقيع ──
    const coEntries = window.projectChangeOrders?.[pid] ? Object.entries(window.projectChangeOrders[pid]) : [];
    const approvedCOs = coEntries.filter(([, co]) => co.status === 'approved');
    const coNetApproved = approvedCOs.reduce((s, [, co]) => s + (co.type === 'deduction' ? -1 : 1) * (parseFloat(co.amount) || 0), 0);
    const contractValue = contractValueBase;            // الأصلية (للمقارنات والملاحظات)
    const adjustedContractValue = contractValueBase + coNetApproved; // المعدّلة (للحسابات)

    // مجموع نسب البنود من قيمة العقد (تلقائية أو يدوية) — مفيد للتحقق من أنها تجمع لـ 100%
    const totalContractPct = boqEntries.reduce((s, [, it]) => {
        const total = (parseFloat(it.unitPrice) || 0) * (parseFloat(it.quantity) || 0);
        const isManual = it.manualPct !== undefined && it.manualPct !== null && it.manualPct !== '';
        const p2 = isManual ? (parseFloat(it.manualPct) || 0) : (contractValue > 0 ? (total / contractValue) * 100 : 0);
        return s + p2;
    }, 0);

    const paymentEntries = window.projectPaymentSchedule?.[pid] ? Object.entries(window.projectPaymentSchedule[pid]) : [];
    const pctTotal = paymentEntries.reduce((s, [, pay]) => s + (parseFloat(pay.percentage) || 0), 0);
    const coStatusM = {
        draft:     { label: 'مسودة',            bg: '#f4ecf7', color: '#5b2c6f' },
        submitted: { label: 'مُقدَّم للاعتماد',  bg: '#fff3cd', color: '#664d03' },
        approved:  { label: 'معتمد',            bg: '#d4edda', color: '#155724' },
        rejected:  { label: 'مرفوض',            bg: '#fdecea', color: '#7b1c1c' },
    };

    const billedByBOQ = {};
    Object.values(window.progressBillings || {}).filter(b => b.projectId === pid && b.status !== 'cancelled')
        .forEach(b => (b.items || []).forEach(bi => {
            const bk = bi.boqItemKey;
            if (!bk) return;
            billedByBOQ[bk] = (billedByBOQ[bk] || 0) + (parseFloat(bi.currentAmount) || 0);
        }));

    pane.innerHTML = `
    <div class="card" style="margin-bottom:16px">
        <div class="c-tl">📄 ملخص العقد</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:12px">
            ${infoRow('رقم العقد', p.contractNo || '-')}
            ${infoRow('تاريخ العقد', p.contractDate || '-')}
            ${infoRow('اسم العميل', p.ownerName || p.clientName || '-')}
            ${infoRow('قيمة العقد', contractValue > 0 ? fmt(contractValue) + ' ريال' : '-')}
            ${coNetApproved !== 0 ? infoRow('القيمة المعدّلة للعقد', `${fmt(adjustedContractValue)} ريال <span style="color:${coNetApproved > 0 ? '#27ae60' : '#e74c3c'};font-weight:700;font-size:11px">(${coNetApproved > 0 ? '+' : '-'}${fmt(Math.abs(coNetApproved))})</span>`) : ''}
            ${infoRow('الدفعة المقدمة', parseFloat(p.advancePayment) > 0 ? fmt(p.advancePayment) + ' ريال' : '-')}
            ${infoRow('نسبة الضمان', `${p.retentionPct ?? 10}%`)}
        </div>
    </div>

    <!-- ── أوامر التغيير (Change Orders / Variations) ── -->
    <div class="card" style="margin-bottom:16px">
        <div class="tlb">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <div class="c-tl" style="margin:0;border:none;padding:0">🧾 أوامر التغيير (Change Orders)</div>
                <span style="background:#eaf2fb;color:#1a3a5c;padding:4px 12px;border-radius:10px;font-size:12px;font-weight:700">${coEntries.length} أمر</span>
                ${approvedCOs.length > 0 ? `<span style="background:${coNetApproved >= 0 ? '#d4edda' : '#fdecea'};color:${coNetApproved >= 0 ? '#155724' : '#7b1c1c'};padding:4px 12px;border-radius:10px;font-size:12px;font-weight:700">
                    صافي المعتمد: ${coNetApproved >= 0 ? '+' : '-'}${fmt(Math.abs(coNetApproved))} ريال
                </span>
                <span style="background:#cfe2ff;color:#084298;padding:4px 12px;border-radius:10px;font-size:12px;font-weight:700">القيمة المعدّلة: ${fmt(adjustedContractValue)} ريال</span>` : ''}
            </div>
            <button class="btn b-g" onclick="pdOpenCOForm('${pid}')">➕ أمر تغيير جديد</button>
        </div>

        ${coEntries.length === 0 ? '<div class="empty"><div class="ei">🧾</div><p>لا توجد أوامر تغيير — استخدم هذا القسم لتوثيق أي إضافات أو خصومات تطرأ على قيمة العقد بعد توقيعه</p></div>' : `
        <div class="tw" style="overflow-x:auto">
        <table class="st">
            <thead><tr>
                <th>#</th><th>الرقم</th><th>الوصف</th><th>النوع</th><th>القيمة</th><th>التاريخ</th><th>الحالة</th><th>إجراءات</th>
            </tr></thead>
            <tbody>
            ${coEntries
                .sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''))
                .map(([ck, co], i) => {
                const sm = coStatusM[co.status] || coStatusM.draft;
                const signedAmount = (co.type === 'deduction' ? -1 : 1) * (parseFloat(co.amount) || 0);
                return `<tr>
                    <td style="color:#888;font-weight:700">${i + 1}</td>
                    <td style="font-weight:700;color:#2d6a9f">${co.number || '-'}</td>
                    <td style="font-weight:600">${co.title || '-'}${co.reason ? `<div style="font-size:11px;color:#888;margin-top:2px">${co.reason}</div>` : ''}</td>
                    <td style="text-align:center">
                        <span style="background:${co.type === 'deduction' ? '#fdecea' : '#e8f8f5'};color:${co.type === 'deduction' ? '#7b1c1c' : '#0e6655'};padding:3px 9px;border-radius:8px;font-size:11px;font-weight:700">${co.type === 'deduction' ? '➖ خصم' : '➕ إضافة'}</span>
                    </td>
                    <td style="font-weight:700;color:${signedAmount < 0 ? '#e74c3c' : '#27ae60'}">${signedAmount < 0 ? '-' : '+'}${fmt(Math.abs(signedAmount))}</td>
                    <td style="font-size:12px;color:#555">${co.date || '-'}</td>
                    <td><span style="background:${sm.bg};color:${sm.color};padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700">${sm.label}</span></td>
                    <td><div style="display:flex;gap:4px;flex-wrap:wrap">
                        ${co.status === 'draft' ? `
                        <button class="btn b-b" style="padding:3px 7px;font-size:11px" onclick="pdOpenCOForm('${pid}','${ck}')" title="تعديل">✏️</button>
                        <button class="btn" style="padding:3px 7px;font-size:11px;background:#5dade2;color:white" onclick="pdAdvanceCO('${pid}','${ck}','submitted')" title="تقديم للاعتماد">📤</button>
                        <button class="btn b-r" style="padding:3px 7px;font-size:11px" onclick="pdDeleteCO('${pid}','${ck}')" title="حذف">🗑️</button>` : ''}
                        ${co.status === 'submitted' ? `
                        <button class="btn" style="padding:3px 7px;font-size:11px;background:#27ae60;color:white" onclick="pdAdvanceCO('${pid}','${ck}','approved')" title="اعتماد">✅</button>
                        <button class="btn" style="padding:3px 7px;font-size:11px;background:#e74c3c;color:white" onclick="pdAdvanceCO('${pid}','${ck}','rejected')" title="رفض">❌</button>
                        <button class="btn" style="padding:3px 7px;font-size:11px;background:#f8fafc;color:#666;border:1.5px solid #d0d7e0" onclick="pdAdvanceCO('${pid}','${ck}','draft')" title="إرجاع لمسودة">↩️</button>` : ''}
                        ${co.status === 'rejected' ? `
                        <button class="btn b-b" style="padding:3px 7px;font-size:11px" onclick="pdOpenCOForm('${pid}','${ck}')" title="تعديل">✏️</button>
                        <button class="btn" style="padding:3px 7px;font-size:11px;background:#5dade2;color:white" onclick="pdAdvanceCO('${pid}','${ck}','submitted')" title="إعادة تقديم">📤</button>
                        <button class="btn b-r" style="padding:3px 7px;font-size:11px" onclick="pdDeleteCO('${pid}','${ck}')" title="حذف">🗑️</button>` : ''}
                        ${co.status === 'approved' ? `
                        <button class="btn b-r" style="padding:3px 7px;font-size:11px" onclick="pdDeleteCO('${pid}','${ck}')" title="حذف (سيؤثر على القيمة المعدّلة للعقد)">🗑️</button>` : ''}
                    </div></td>
                </tr>`;
            }).join('')}
            </tbody>
            ${approvedCOs.length > 0 ? `<tfoot><tr style="background:#f0f5fa;font-weight:800">
                <td colspan="4" style="padding:10px;text-align:right;color:#1a3a5c">صافي أوامر التغيير المعتمدة</td>
                <td style="color:${coNetApproved < 0 ? '#e74c3c' : '#27ae60'}">${coNetApproved < 0 ? '-' : '+'}${fmt(Math.abs(coNetApproved))}</td>
                <td colspan="3" style="color:#084298">القيمة المعدّلة للعقد: ${fmt(adjustedContractValue)} ريال</td>
            </tr></tfoot>` : ''}
        </table>
        </div>`}
    </div>

    <div class="card">
        <div class="tlb">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <div class="c-tl" style="margin:0;border:none;padding:0">📋 بنود العقد (BOQ)</div>
                <span style="background:#e8f4fd;color:#1a3a5c;padding:4px 12px;border-radius:10px;font-size:12px;font-weight:700">${boqEntries.length} بند — إجمالي: ${fmt(boqTotal)} ريال</span>
                ${boqTotal > 0 && adjustedContractValue > 0 ? `<span style="background:${Math.abs(boqTotal - adjustedContractValue) / adjustedContractValue < 0.01 ? '#d4edda' : '#fff3cd'};color:${Math.abs(boqTotal - adjustedContractValue) / adjustedContractValue < 0.01 ? '#155724' : '#664d03'};padding:4px 12px;border-radius:10px;font-size:12px;font-weight:700">
                    ${Math.abs(boqTotal - adjustedContractValue) / adjustedContractValue < 0.01 ? '✅ مطابق للعقد المعدّل' : '⚠️ فرق: ' + fmt(adjustedContractValue - boqTotal) + ' ريال'}
                </span>` : ''}
            </div>
            <button class="btn b-g" onclick="pdOpenBOQForm('${pid}')">➕ إضافة بند</button>
        </div>

        ${boqEntries.length === 0 ? '<div class="empty"><div class="ei">📋</div><p>لا توجد بنود — أضف بنود العقد</p></div>' : `
        <div class="tw" style="overflow-x:auto">
        <table class="st">
            <thead><tr>
                <th>#</th><th>رقم البند</th><th>الوصف</th><th>النسبة من العقد %</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th><th>المستخلص</th><th>الرصيد</th><th>إجراءات</th>
            </tr></thead>
            <tbody>
            ${boqEntries.map(([bk, it], i) => {
                const total = (parseFloat(it.unitPrice) || 0) * (parseFloat(it.quantity) || 0);
                const billed = billedByBOQ[bk] || 0;
                const remaining = total - billed;
                const pct = total > 0 ? Math.round((billed / total) * 100) : 0;
                const isManualPct = it.manualPct !== undefined && it.manualPct !== null && it.manualPct !== '';
                const contractPct = isManualPct ? parseFloat(it.manualPct) || 0 : (adjustedContractValue > 0 ? (total / adjustedContractValue) * 100 : 0);
                return `<tr>
                    <td style="color:#888;font-weight:700">${i + 1}</td>
                    <td style="font-weight:700;color:#2d6a9f">${it.number || '-'}</td>
                    <td style="font-weight:600">${it.description || '-'}</td>
                    <td style="text-align:center">
                        <div style="font-weight:800;color:#8e44ad">${contractPct.toFixed(2)}%</div>
                        <div style="font-size:9px;color:${isManualPct ? '#e67e22' : '#888'}">${isManualPct ? '✏️ يدوي' : '🤖 تلقائي'}</div>
                    </td>
                    <td>${it.unit || '-'}</td>
                    <td style="text-align:center">${parseFloat(it.quantity || 0).toLocaleString()}</td>
                    <td style="font-weight:600">${fmt(it.unitPrice || 0)}</td>
                    <td style="font-weight:700;color:#2d6a9f">${fmt(total)}</td>
                    <td>
                        <div style="font-weight:600;color:#16a085">${fmt(billed)}</div>
                        <div style="background:#e8f0f7;border-radius:4px;height:4px;margin-top:3px">
                            <div style="width:${pct}%;background:#16a085;height:100%;border-radius:4px"></div>
                        </div>
                        <div style="font-size:10px;color:#888;text-align:center">${pct}%</div>
                    </td>
                    <td style="font-weight:700;color:${remaining > 0 ? '#e67e22' : '#27ae60'}">${fmt(remaining)}</td>
                    <td><div style="display:flex;gap:4px">
                        <button class="btn b-b" style="padding:3px 7px;font-size:11px" onclick="pdOpenBOQForm('${pid}','${bk}')">✏️</button>
                        <button class="btn b-r" style="padding:3px 7px;font-size:11px" onclick="pdDeleteBOQ('${pid}','${bk}')">🗑️</button>
                    </div></td>
                </tr>`;
            }).join('')}
            </tbody>
            <tfoot><tr style="background:#f0f5fa;font-weight:800">
                <td colspan="3" style="padding:10px;text-align:right;color:#1a3a5c">الإجمالي</td>
                <td style="text-align:center;color:${Math.abs(totalContractPct - 100) < 0.01 ? '#27ae60' : '#e67e22'}">${totalContractPct.toFixed(2)}%</td>
                <td colspan="3"></td>
                <td style="color:#2d6a9f">${fmt(boqTotal)}</td>
                <td style="color:#16a085">${fmt(Object.values(billedByBOQ).reduce((s, v) => s + v, 0))}</td>
                <td style="color:#e67e22">${fmt(boqTotal - Object.values(billedByBOQ).reduce((s, v) => s + v, 0))}</td>
                <td></td>
            </tr></tfoot>
        </table>
        </div>`}
    </div>

    <!-- ── جدول الدفعات التعاقدية (نسب من قيمة العقد) ── -->
    <div class="card" style="margin-top:16px">
        <div class="tlb">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <div class="c-tl" style="margin:0;border:none;padding:0">💳 جدول الدفعات التعاقدية</div>
                <span style="background:#fef9e7;color:#7d4e00;padding:4px 12px;border-radius:10px;font-size:12px;font-weight:700">${paymentEntries.length} دفعة — ${pctTotal.toFixed(2)}% — ${fmt(adjustedContractValue * (pctTotal / 100))} ريال</span>
                ${paymentEntries.length > 0 ? `<span style="background:${Math.abs(pctTotal - 100) < 0.01 ? '#d4edda' : '#fff3cd'};color:${Math.abs(pctTotal - 100) < 0.01 ? '#155724' : '#664d03'};padding:4px 12px;border-radius:10px;font-size:12px;font-weight:700">
                    ${Math.abs(pctTotal - 100) < 0.01 ? '✅ مجموع النسب 100%' : '⚠️ مجموع النسب ' + pctTotal.toFixed(2) + '% (الفرق ' + (100 - pctTotal).toFixed(2) + '%)'}
                </span>` : ''}
            </div>
            <button class="btn b-g" onclick="pdOpenPaymentForm('${pid}')">➕ إضافة دفعة</button>
        </div>

        ${paymentEntries.length === 0 ? '<div class="empty"><div class="ei">💳</div><p>لا توجد دفعات معرّفة — أضف جدول الدفعات التعاقدية حسب نسب الإنجاز من قيمة العقد</p></div>' : `
        <div class="tw" style="overflow-x:auto">
        <table class="st">
            <thead><tr>
                <th>م</th><th>وصف الدفعة</th><th>النسبة %</th><th>المبلغ المحتسب</th><th>إجراءات</th>
            </tr></thead>
            <tbody>
            ${paymentEntries.map(([pk, pay], i) => {
                const pct = parseFloat(pay.percentage) || 0;
                const amount = adjustedContractValue * (pct / 100);
                return `<tr>
                    <td style="color:#888;font-weight:700">${i + 1}</td>
                    <td style="font-weight:600">${pay.description || '-'}</td>
                    <td style="text-align:center;font-weight:700;color:#7d4e00">${pct}%</td>
                    <td style="font-weight:700;color:#2d6a9f">${fmt(amount)}</td>
                    <td><div style="display:flex;gap:4px">
                        <button class="btn b-b" style="padding:3px 7px;font-size:11px" onclick="pdOpenPaymentForm('${pid}','${pk}')">✏️</button>
                        <button class="btn b-r" style="padding:3px 7px;font-size:11px" onclick="pdDeletePayment('${pid}','${pk}')">🗑️</button>
                    </div></td>
                </tr>`;
            }).join('')}
            </tbody>
            <tfoot><tr style="background:#f0f5fa;font-weight:800">
                <td colspan="2" style="padding:10px;text-align:right;color:#1a3a5c">الإجمالي</td>
                <td style="text-align:center;color:#7d4e00">${pctTotal.toFixed(2)}%</td>
                <td style="color:#2d6a9f">${fmt(adjustedContractValue * (pctTotal / 100))}</td>
                <td></td>
            </tr></tfoot>
        </table>
        </div>`}
    </div>

    <!-- نموذج إضافة/تعديل دفعة -->
    <div id="pd-pay-form" style="display:none;background:white;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #f0c419">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-pay-form-title">➕ إضافة دفعة جديدة</div>
        <input type="hidden" id="pd-pay-key">
        <input type="hidden" id="pd-pay-contract-value" value="${adjustedContractValue}">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px">
            <div style="grid-column:span 2"><label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px">وصف الدفعة</label>
                <input id="pd-pay-desc" placeholder="دفعة مقدمة عند توقيع العقد..." style="${inputStyle()}"></div>
            <div><label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px">النسبة %</label>
                <input id="pd-pay-pct" type="number" min="0" max="100" step="0.01" placeholder="0" oninput="pdCalcPaymentAmount()" style="${inputStyle()}"></div>
            <div><label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px">المبلغ المحتسب (ريال)</label>
                <input id="pd-pay-amount" readonly style="${inputStyle('background:#f0f5fa;font-weight:700')}"></div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSavePayment('${pid}')">💾 حفظ الدفعة</button>
            <button class="btn" onclick="document.getElementById('pd-pay-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>

    <!-- نموذج إضافة/تعديل بند BOQ -->
    <div id="pd-boq-form" style="display:none;background:white;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #2d6a9f">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-boq-form-title">➕ إضافة بند جديد</div>
        <input type="hidden" id="pd-boq-key">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px">
            <div><label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px">رقم البند</label>
                <input id="pd-boq-no" placeholder="مثال: 1.1" style="${inputStyle()}"></div>
            <div style="grid-column:span 2"><label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px">وصف البند</label>
                <input id="pd-boq-desc" placeholder="أعمال الخرسانة المسلحة..." style="${inputStyle()}"></div>
            <div><label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px">النسبة من قيمة العقد % <span style="font-weight:400;color:#999">(اختياري)</span></label>
                <input id="pd-boq-pct" type="number" min="0" max="100" step="0.01" placeholder="🤖 تلقائي = الإجمالي ÷ قيمة العقد" style="${inputStyle()}"></div>
            <div><label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px">الوحدة</label>
                <input id="pd-boq-unit" placeholder="م³" style="${inputStyle()}"></div>
            <div><label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px">الكمية</label>
                <input id="pd-boq-qty" type="number" min="0" step="0.01" placeholder="0" oninput="pdCalcBOQTotal()" style="${inputStyle()}"></div>
            <div><label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px">سعر الوحدة (ريال)</label>
                <input id="pd-boq-price" type="number" min="0" step="0.01" placeholder="0.00" oninput="pdCalcBOQTotal()" style="${inputStyle()}"></div>
            <div><label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px">الإجمالي</label>
                <input id="pd-boq-total" readonly style="${inputStyle('background:#f0f5fa;font-weight:700')}"></div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveBOQ('${pid}')">💾 حفظ البند</button>
            <button class="btn" onclick="document.getElementById('pd-boq-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>

    <!-- نموذج إضافة/تعديل أمر تغيير -->
    <div id="pd-co-form" style="display:none;background:white;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #8e44ad">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-co-form-title">➕ أمر تغيير جديد</div>
        <input type="hidden" id="pd-co-key">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px">
            <div><label style="${lblStyle()}">رقم الأمر</label>
                <input id="pd-co-number" placeholder="مثال: CO-01" style="${inputStyle()}"></div>
            <div style="grid-column:span 2"><label style="${lblStyle()}">وصف التغيير</label>
                <input id="pd-co-title" placeholder="أعمال إضافية في..." style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">نوع التغيير</label>
                <select id="pd-co-type" style="${inputStyle()}">
                    <option value="addition">➕ إضافة لقيمة العقد</option>
                    <option value="deduction">➖ خصم من قيمة العقد</option>
                </select></div>
            <div><label style="${lblStyle()}">القيمة (ريال)</label>
                <input id="pd-co-amount" type="number" min="0" step="0.01" placeholder="0.00" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التاريخ</label>
                <input id="pd-co-date" type="date" style="${inputStyle()}"></div>
            <div style="grid-column:span 3"><label style="${lblStyle()}">المبرر / السبب <span style="font-weight:400;color:#999">(اختياري)</span></label>
                <input id="pd-co-reason" placeholder="سبب طلب التغيير..." style="${inputStyle()}"></div>
            <div style="grid-column:span 3"><label style="${lblStyle()}">ملاحظات <span style="font-weight:400;color:#999">(اختياري)</span></label>
                <input id="pd-co-notes" placeholder="..." style="${inputStyle()}"></div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveCO('${pid}')">💾 حفظ أمر التغيير</button>
            <button class="btn" onclick="document.getElementById('pd-co-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}

window.pdCalcBOQTotal = function () {
    const qty = parseFloat(document.getElementById('pd-boq-qty')?.value) || 0;
    const price = parseFloat(document.getElementById('pd-boq-price')?.value) || 0;
    const el = document.getElementById('pd-boq-total');
    if (el) el.value = fmt(qty * price);
};

window.pdOpenBOQForm = function (pid, itemKey = null) {
    const form = document.getElementById('pd-boq-form'); if (!form) return;
    form.style.display = '';
    document.getElementById('pd-boq-key').value = itemKey || '';
    document.getElementById('pd-boq-form-title').textContent = itemKey ? '✏️ تعديل بند' : '➕ إضافة بند جديد';
    if (itemKey) {
        const it = window.projectBOQ?.[pid]?.[itemKey];
        if (it) {
            document.getElementById('pd-boq-no').value = it.number || '';
            document.getElementById('pd-boq-desc').value = it.description || '';
            document.getElementById('pd-boq-pct').value = (it.manualPct !== undefined && it.manualPct !== null) ? it.manualPct : '';
            document.getElementById('pd-boq-unit').value = it.unit || '';
            document.getElementById('pd-boq-qty').value = it.quantity || '';
            document.getElementById('pd-boq-price').value = it.unitPrice || '';
            pdCalcBOQTotal();
        }
    } else {
        ['pd-boq-no','pd-boq-desc','pd-boq-pct','pd-boq-unit','pd-boq-qty','pd-boq-price','pd-boq-total'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
    }
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSaveBOQ = async function (pid) {
    const no = document.getElementById('pd-boq-no')?.value.trim();
    const desc = document.getElementById('pd-boq-desc')?.value.trim();
    const pctRaw = document.getElementById('pd-boq-pct')?.value.trim();
    const unit = document.getElementById('pd-boq-unit')?.value.trim();
    const qty = parseFloat(document.getElementById('pd-boq-qty')?.value) || 0;
    const price = parseFloat(document.getElementById('pd-boq-price')?.value) || 0;
    if (!desc) { toast('أدخل وصف البند', 'er'); return; }
    // النسبة من قيمة العقد: إن أُدخلت يدوياً تُحفظ كقيمة ثابتة، وإلا يُحذف الحقل ليُحسب تلقائياً (الإجمالي ÷ قيمة العقد)
    const data = { number: no, description: desc, unit, quantity: qty, unitPrice: price, manualPct: pctRaw === '' ? null : (parseFloat(pctRaw) || 0), updatedAt: new Date().toISOString() };
    const itemKey = document.getElementById('pd-boq-key')?.value;
    try {
        if (itemKey) {
            await update(ref(db, `ledger/projectBOQ/${pid}/${itemKey}`), data);
            pdLogActivity(pid, '✏️', `تعديل بند العقد: ${desc}`);
            toast('تم التحديث ✓', 'ok');
        } else {
            data.createdAt = new Date().toISOString();
            data.projectId = pid;
            await push(ref(db, `ledger/projectBOQ/${pid}`), data);
            pdLogActivity(pid, '➕', `إضافة بند جديد للعقد: ${desc}`);
            toast('تم إضافة البند ✓', 'ok');
        }
        document.getElementById('pd-boq-form').style.display = 'none';
        setTimeout(() => pdRenderTab('contract'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.pdDeleteBOQ = function (pid, itemKey) {
    const item = window.projectBOQ?.[pid]?.[itemKey];
    cf2('هل تريد حذف هذا البند؟', async () => {
        try {
            await remove(ref(db, `ledger/projectBOQ/${pid}/${itemKey}`));
            pdLogActivity(pid, '🗑️', `حذف بند العقد: ${item?.description || ''}`);
            toast('تم الحذف', 'ok');
            setTimeout(() => pdRenderTab('contract'), 400);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ── جدول الدفعات التعاقدية (نسب من قيمة العقد) ──────────────────
window.pdCalcPaymentAmount = function () {
    const pct = parseFloat(document.getElementById('pd-pay-pct')?.value) || 0;
    const contractValue = parseFloat(document.getElementById('pd-pay-contract-value')?.value) || 0;
    const el = document.getElementById('pd-pay-amount');
    if (el) el.value = fmt(contractValue * (pct / 100));
};

window.pdOpenPaymentForm = function (pid, payKey = null) {
    const form = document.getElementById('pd-pay-form'); if (!form) return;
    form.style.display = '';
    document.getElementById('pd-pay-key').value = payKey || '';
    document.getElementById('pd-pay-form-title').textContent = payKey ? '✏️ تعديل دفعة' : '➕ إضافة دفعة جديدة';
    if (payKey) {
        const pay = window.projectPaymentSchedule?.[pid]?.[payKey];
        if (pay) {
            document.getElementById('pd-pay-desc').value = pay.description || '';
            document.getElementById('pd-pay-pct').value = pay.percentage || '';
            pdCalcPaymentAmount();
        }
    } else {
        ['pd-pay-desc', 'pd-pay-pct', 'pd-pay-amount'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
    }
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSavePayment = async function (pid) {
    const desc = document.getElementById('pd-pay-desc')?.value.trim();
    const pct = parseFloat(document.getElementById('pd-pay-pct')?.value) || 0;
    if (!desc) { toast('أدخل وصف الدفعة', 'er'); return; }
    if (pct <= 0) { toast('أدخل نسبة صحيحة أكبر من صفر', 'er'); return; }
    const data = { description: desc, percentage: pct, updatedAt: new Date().toISOString() };
    const payKey = document.getElementById('pd-pay-key')?.value;
    try {
        if (payKey) {
            await update(ref(db, `ledger/projectPaymentSchedule/${pid}/${payKey}`), data);
            pdLogActivity(pid, '✏️', `تعديل دفعة تعاقدية: ${desc} (${pct}%)`);
            toast('تم التحديث ✓', 'ok');
        } else {
            data.createdAt = new Date().toISOString();
            data.projectId = pid;
            await push(ref(db, `ledger/projectPaymentSchedule/${pid}`), data);
            pdLogActivity(pid, '➕', `إضافة دفعة تعاقدية: ${desc} (${pct}%)`);
            toast('تم إضافة الدفعة ✓', 'ok');
        }
        document.getElementById('pd-pay-form').style.display = 'none';
        setTimeout(() => pdRenderTab('contract'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.pdDeletePayment = function (pid, payKey) {
    const pay = window.projectPaymentSchedule?.[pid]?.[payKey];
    cf2('هل تريد حذف هذه الدفعة؟', async () => {
        try {
            await remove(ref(db, `ledger/projectPaymentSchedule/${pid}/${payKey}`));
            pdLogActivity(pid, '🗑️', `حذف دفعة تعاقدية: ${pay?.description || ''}`);
            toast('تم الحذف', 'ok');
            setTimeout(() => pdRenderTab('contract'), 400);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ── أوامر التغيير (Change Orders / Variations) ──────────────────
window.pdOpenCOForm = function (pid, coKey = null) {
    const form = document.getElementById('pd-co-form'); if (!form) return;
    form.style.display = '';
    document.getElementById('pd-co-key').value = coKey || '';
    document.getElementById('pd-co-form-title').textContent = coKey ? '✏️ تعديل أمر تغيير' : '➕ أمر تغيير جديد';
    if (coKey) {
        const co = window.projectChangeOrders?.[pid]?.[coKey];
        if (co) {
            document.getElementById('pd-co-number').value = co.number || '';
            document.getElementById('pd-co-title').value = co.title || '';
            document.getElementById('pd-co-type').value = co.type || 'addition';
            document.getElementById('pd-co-amount').value = co.amount || '';
            document.getElementById('pd-co-date').value = co.date || '';
            document.getElementById('pd-co-reason').value = co.reason || '';
            document.getElementById('pd-co-notes').value = co.notes || '';
        }
    } else {
        ['pd-co-number', 'pd-co-title', 'pd-co-amount', 'pd-co-reason', 'pd-co-notes'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        document.getElementById('pd-co-type').value = 'addition';
        document.getElementById('pd-co-date').value = new Date().toISOString().slice(0, 10);
    }
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSaveCO = async function (pid) {
    const number = document.getElementById('pd-co-number')?.value.trim();
    const title = document.getElementById('pd-co-title')?.value.trim();
    const type = document.getElementById('pd-co-type')?.value || 'addition';
    const amount = parseFloat(document.getElementById('pd-co-amount')?.value) || 0;
    const date = document.getElementById('pd-co-date')?.value || '';
    const reason = document.getElementById('pd-co-reason')?.value.trim();
    const notes = document.getElementById('pd-co-notes')?.value.trim();
    if (!title) { toast('أدخل وصف التغيير', 'er'); return; }
    if (amount <= 0) { toast('أدخل قيمة صحيحة أكبر من صفر', 'er'); return; }
    const data = { number, title, type, amount, date, reason, notes, updatedAt: new Date().toISOString() };
    const coKey = document.getElementById('pd-co-key')?.value;
    try {
        if (coKey) {
            await update(ref(db, `ledger/projectChangeOrders/${pid}/${coKey}`), data);
            pdLogActivity(pid, '✏️', `تعديل أمر تغيير: ${title}`);
            toast('تم التحديث ✓', 'ok');
        } else {
            data.status = 'draft';
            data.createdAt = new Date().toISOString();
            data.createdBy = window.curU?.uid || '';
            data.projectId = pid;
            await push(ref(db, `ledger/projectChangeOrders/${pid}`), data);
            pdLogActivity(pid, '🧾', `أمر تغيير جديد: ${title} (${type === 'deduction' ? 'خصم' : 'إضافة'} ${fmt(amount)})`);
            toast('تم إضافة أمر التغيير ✓', 'ok');
        }
        document.getElementById('pd-co-form').style.display = 'none';
        setTimeout(() => pdRenderTab('contract'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.pdDeleteCO = function (pid, coKey) {
    const co = window.projectChangeOrders?.[pid]?.[coKey];
    cf2('هل تريد حذف أمر التغيير هذا؟', async () => {
        try {
            await remove(ref(db, `ledger/projectChangeOrders/${pid}/${coKey}`));
            pdLogActivity(pid, '🗑️', `حذف أمر تغيير: ${co?.title || ''}`);
            toast('تم الحذف', 'ok');
            setTimeout(() => pdRenderTab('contract'), 400);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

window.pdAdvanceCO = function (pid, coKey, newStatus) {
    const co = window.projectChangeOrders?.[pid]?.[coKey]; if (!co) return;
    const doUpdate = async () => {
        try {
            const data = { status: newStatus, updatedAt: new Date().toISOString() };
            if (newStatus === 'approved' || newStatus === 'rejected') {
                data.decisionAt = new Date().toISOString();
                data.decisionBy = window.curU?.uid || '';
            }
            await update(ref(db, `ledger/projectChangeOrders/${pid}/${coKey}`), data);
            const statusLabel = { approved: '✅ اعتماد', rejected: '❌ رفض', draft: '↩️ إعادة لمسودة' }[newStatus] || newStatus;
            pdLogActivity(pid, '🧾', `${statusLabel} أمر التغيير: ${co.title || ''} (${fmt(co.amount)})`);
            toast('تم تحديث حالة أمر التغيير ✓', 'ok');
            setTimeout(() => pdRenderTab('contract'), 400);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    };
    if (newStatus === 'approved') {
        cf2(`اعتماد أمر التغيير "${co.title || ''}" بقيمة ${fmt(co.amount)} ريال (${co.type === 'deduction' ? 'خصم من قيمة العقد' : 'إضافة لقيمة العقد'}) — سيتم تعديل القيمة المعدّلة للعقد بناءً عليه. هل أنت متأكد؟`, doUpdate);
    } else if (newStatus === 'rejected') {
        cf2(`رفض أمر التغيير "${co.title || ''}"؟`, doUpdate);
    } else {
        doUpdate();
    }
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB 3 — المستخلصات  (يستخدم نفس renderBillingCard من app.js)           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function pdRenderBillings(pid) {
    const pane = document.getElementById('pd-tab-billings'); if (!pane) return;
    const p = (window.projects || {})[pid]; if (!p) return;
    const contractValue = pdAdjustedContract(pid);  // شاملة أوامر التغيير المعتمدة

    // ترتيب: المستخلصات التي تنتظر إجراء اعتماد (مُقدَّم/مسوّدة) تظهر أولاً لتسهيل اعتمادها بسرعة، ثم الأحدث تاريخاً
    const billingStatusPriority = { submitted: 0, draft: 1, approved: 2, paid: 3, cancelled: 4 };
    const bills = Object.entries(window.progressBillings || {})
        .filter(([, b]) => b.projectId === pid)
        .sort((a, b) => {
            const pa = billingStatusPriority[a[1].status] ?? 5;
            const pb = billingStatusPriority[b[1].status] ?? 5;
            if (pa !== pb) return pa - pb;
            return (b[1].billingDate || b[1].date || '').localeCompare(a[1].billingDate || a[1].date || '');
        });

    const activeBills = bills.filter(([, b]) => b.status !== 'cancelled');
    const billedTotal = activeBills.reduce((s, [, b]) => s + (parseFloat(b.currentAmount) || 0), 0);
    const paidTotal   = activeBills.filter(([, b]) => b.status === 'paid').reduce((s, [, b]) => s + (parseFloat(b.currentAmount) || 0), 0);
    const pct = contractValue > 0 ? Math.min(100, (billedTotal / contractValue) * 100) : 0;

    const hasBoq = window.projectBOQ?.[pid] && Object.keys(window.projectBOQ[pid]).length > 0;

    pane.innerHTML = `
    <!-- KPI bar -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:10px;margin-bottom:14px;background:#74ade0;border-radius:10px;padding:12px 16px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
        ${kpiCard('📑', 'عدد المستخلصات', activeBills.length.toString(), 'مستخلص', '#16a085')}
        ${kpiCard('💰', 'إجمالي المستخلص', fmt(billedTotal), 'ريال', '#2d6a9f')}
        ${kpiCard('💸', 'المدفوع', fmt(paidTotal), 'ريال', '#27ae60')}
        ${contractValue > 0 ? kpiCard('📊', 'نسبة الإنجاز', pct.toFixed(1) + '%', `من ${fmt(contractValue)}`, '#8e44ad') : ''}
    </div>

    <!-- شريط تراكمي -->
    ${contractValue > 0 && billedTotal > 0 ? `
    <div style="background:white;border-radius:10px;padding:12px 16px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:8px">
            <span style="color:#1a3a5c">التراكمي المستخلص: ${fmt(billedTotal)} ريال</span>
            <span style="color:#16a085">${pct.toFixed(1)}% من قيمة العقد</span>
        </div>
        <div style="background:#e0e8f0;border-radius:20px;height:10px;overflow:hidden">
            <div style="width:${pct}%;background:linear-gradient(90deg,#16a085,#27ae60);height:100%;border-radius:20px;transition:width .4s"></div>
        </div>
    </div>` : ''}

    <!-- شريط الإجراءات + البحث -->
    <div style="background:white;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
        <div style="font-size:13px;font-weight:700;color:#1a3a5c;white-space:nowrap">📑 مستخلصات المشروع (${activeBills.length})</div>
        ${bills.length > 1 ? `
        <div style="position:relative;flex:1;min-width:180px;max-width:320px">
            <input id="pdBillSearch" type="text" placeholder="🔍 ابحث برقم المستخلص / الحالة / التاريخ..." oninput="pdFilterBillingCards()" style="width:100%;padding:8px 12px;border:1.5px solid #d0d7e0;border-radius:8px;font-size:12px;font-family:inherit">
        </div>
        <select id="pdBillStatusFilter" onchange="pdFilterBillingCards()" style="padding:8px 12px;border:1.5px solid #d0d7e0;border-radius:8px;font-size:12px;font-family:inherit;background:white;color:#1a3a5c">
            <option value="">📋 كل الحالات</option>
            <option value="draft">📝 مسودة</option>
            <option value="submitted">📤 مُقدَّم للعميل اعتماد</option>
            <option value="approved">✅ معتمد</option>
            <option value="approved_uninvoiced">📄 معتمد ولم يصدر له فاتورة</option>
            <option value="paid">💰 مدفوع</option>
            <option value="cancelled">❌ ملغى</option>
        </select>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${hasBoq
                ? `<button class="btn b-g" onclick="pdOpenNewBilling('${pid}')" style="font-weight:800">➕ مستخلص جديد</button>`
                : `<button class="btn b-o" onclick="pdSwitchTab('contract')" title="أضف بنود BOQ أولاً">⚠️ أضف بنود BOQ أولاً</button>`}
            <button class="btn" onclick="bcNav('progressbillings')" style="background:#f8fafc;color:#2d6a9f;border:1.5px solid #d0d7e0;font-size:12px">📑 صفحة المستخلصات الكاملة ↗</button>
        </div>
    </div>

    <!-- بطاقات المستخلصات — مقسّمة على صفحات لتجنّب إطالة الصفحة عند كثرة المستخلصات -->
    ${bills.length === 0
        ? `<div class="card"><div class="empty"><div class="ei">📑</div>
            <p>${hasBoq ? 'لا توجد مستخلصات — أضف أول مستخلص' : 'لا توجد بنود BOQ — أضف بنوداً من تبويب العقد والبنود أولاً'}</p>
            ${hasBoq ? `<button class="btn b-g" onclick="pdOpenNewBilling('${pid}')">➕ مستخلص جديد</button>` : `<button class="btn b-b" onclick="pdSwitchTab('contract')">📋 إضافة بنود BOQ</button>`}
           </div></div>`
        : `<div id="pdBillCardsListWrap"></div>`}
    `;

    if (bills.length > 0) pdRenderBillingCardsPage(pid);
}

const PD_BILL_PAGE_SIZE = 5;

// إعادة تطبيق البحث/الفلتر وترقيم الصفحات على قائمة المستخلصات داخل تبويب المشروع
window.pdFilterBillingCards = function () {
    window._pd.billingPage = 1;
    pdRenderBillingCardsPage(window._pd.projectId);
};

window.pdGoToBillingPage = function (pid, page) {
    window._pd.billingPage = page;
    pdRenderBillingCardsPage(pid);
};

function pdRenderBillingCardsPage(pid) {
    const wrap = document.getElementById('pdBillCardsListWrap');
    if (!wrap) return;

    const billingStatusPriority = { submitted: 0, draft: 1, approved: 2, paid: 3, cancelled: 4 };
    const sLabelMap = { draft: 'مسودة', submitted: 'مُقدَّم للعميل اعتماد', approved: 'معتمد', paid: 'مدفوع', cancelled: 'ملغى' };
    const bills = Object.entries(window.progressBillings || {})
        .filter(([, b]) => b.projectId === pid)
        .sort((a, b) => {
            const pa = billingStatusPriority[a[1].status] ?? 5;
            const pb = billingStatusPriority[b[1].status] ?? 5;
            if (pa !== pb) return pa - pb;
            return (b[1].billingDate || b[1].date || '').localeCompare(a[1].billingDate || a[1].date || '');
        });

    const q = (document.getElementById('pdBillSearch')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('pdBillStatusFilter')?.value || '';

    const filtered = bills.filter(([, b]) => {
        const sLabel = sLabelMap[b.status] || b.status || '';
        const searchKey = [b.billingNo, b.contractRef, b.billingDate, b.fromDate, b.toDate, sLabel].filter(Boolean).join(' ').toLowerCase();
        const matchesSearch = !q || searchKey.includes(q);
        let matchesStatus = true;
        if (statusFilter === 'approved_uninvoiced') matchesStatus = b.status === 'approved' && !pdIsBillingCollected(b);
        else if (statusFilter) matchesStatus = b.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (!filtered.length) {
        wrap.innerHTML = `<div class="card"><div class="empty"><div class="ei">🔍</div><p>لا توجد مستخلصات مطابقة للبحث/الفلتر</p></div></div>`;
        return;
    }

    // ── زر التبديل: جدول ملخص / بطاقات تفصيلية ──
    const view = window._pd.billView || 'table';
    const vBtn = (v, label) => `<button onclick="pdSetBillView('${v}')" style="padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font-family:inherit;font-size:12px;font-weight:${view === v ? '800' : '600'};background:${view === v ? '#2d6a9f' : '#f8fafc'};color:${view === v ? 'white' : '#1a3a5c'}">${label}</button>`;
    const viewToggle = `<div style="display:flex;justify-content:flex-start;gap:6px;margin-bottom:12px;background:white;border-radius:10px;padding:8px 12px;box-shadow:0 2px 8px rgba(0,0,0,.04);align-items:center;flex-wrap:wrap">
        <span style="font-size:12px;color:#888;font-weight:700">طريقة العرض:</span>
        ${vBtn('table', '📋 جدول ملخص')}
        ${vBtn('cards', '🗂️ بطاقات تفصيلية')}
        ${view === 'table' ? `
        <div style="margin-right:auto;display:flex;gap:6px">
            <button onclick="pdPrintProjectBillings('${pid}')" style="padding:6px 14px;background:#f8fafc;color:#555;border:1.5px solid #d0d7e0;border-radius:8px;cursor:pointer;font-size:12px;font-family:inherit">🖨️ طباعة</button>
            <button onclick="pdExportProjectBillingsExcel('${pid}')" style="padding:6px 14px;background:#1e7e34;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit">📤 Excel</button>
        </div>` : ''}
    </div>`;

    if (view === 'table') {
        wrap.innerHTML = viewToggle + pdBillingSummaryTable(filtered);
        return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PD_BILL_PAGE_SIZE));
    if (!window._pd.billingPage || window._pd.billingPage > totalPages) window._pd.billingPage = 1;
    const page = window._pd.billingPage;
    const start = (page - 1) * PD_BILL_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PD_BILL_PAGE_SIZE);

    wrap.innerHTML = `
        ${viewToggle}
        <div id="pdBillCardsList" style="display:flex;flex-direction:column;gap:12px">
            ${pageItems.map(([bk, b]) => `<div class="pd-bill-card">${typeof renderBillingCard === 'function' ? renderBillingCard(bk, b) : ''}</div>`).join('')}
        </div>
        ${totalPages > 1 ? `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:14px;background:white;border-radius:10px;padding:10px 16px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
            <div style="font-size:12px;color:#666">عرض ${start + 1}–${Math.min(start + PD_BILL_PAGE_SIZE, filtered.length)} من ${filtered.length} مستخلص</div>
            <div style="display:flex;gap:6px;align-items:center">
                <button onclick="pdGoToBillingPage('${pid}',${page - 1})" ${page === 1 ? 'disabled' : ''} class="btn" style="padding:5px 12px;font-size:11px;${page === 1 ? 'opacity:.4;cursor:not-allowed' : ''}">◀ السابقة</button>
                <span style="font-size:12px;font-weight:700;color:#1a3a5c;padding:5px 10px">صفحة ${page} من ${totalPages}</span>
                <button onclick="pdGoToBillingPage('${pid}',${page + 1})" ${page === totalPages ? 'disabled' : ''} class="btn" style="padding:5px 12px;font-size:11px;${page === totalPages ? 'opacity:.4;cursor:not-allowed' : ''}">التالية ▶</button>
            </div>
        </div>` : ''}
    `;
}

window.pdSetBillView = function (v) {
    window._pd.billView = v;
    window._pd.billingPage = 1;
    pdRenderBillingCardsPage(window._pd.projectId);
};

// ── جدول ملخص المستخلصات (بنفس أسلوب جدول فواتير المبيعات) ──────────────
function pdBillingSummaryTable(filtered) {
    const statusM = {
        draft:     { label: '📝 مسودة',            bg: '#f4ecf7', color: '#5b2c6f' },
        submitted: { label: '📤 مُقدَّم للعميل',    bg: '#fef9e7', color: '#7d4e00' },
        approved:  { label: '✅ معتمد',            bg: '#e8f8f5', color: '#0e6655' },
        paid:      { label: '💸 مدفوع',            bg: '#e8f4fd', color: '#0d4f7c' },
        cancelled: { label: '❌ ملغى',             bg: '#fdecea', color: '#7b1c1c' },
    };

    // ترتيب زمني — الأحدث أولاً (مثل جدول الفواتير)
    const rows = [...filtered].sort((a, b) => (b[1].billingDate || b[1].date || '').localeCompare(a[1].billingDate || a[1].date || ''));

    const active = rows.filter(([, b]) => b.status !== 'cancelled');
    const sumCur = active.reduce((s, [, b]) => s + (parseFloat(b.currentAmount) || 0), 0);
    const sumRet = active.reduce((s, [, b]) => s + (parseFloat(b.retentionAmount) || 0), 0);
    const sumNet = active.reduce((s, [, b]) => s + (parseFloat(b.netAmount) || 0), 0);

    return `
    <div class="card">
        <div class="tw" style="overflow-x:auto">
        <table class="st">
            <thead><tr>
                <th>#</th><th>رقم المستخلص</th><th>التاريخ</th><th>الفترة</th><th>قيمة الأعمال الحالية</th><th>التراكمي</th><th>الاحتفاظ</th><th>صافي المستحق</th><th>الحالة</th><th>الفاتورة</th><th>إجراءات</th>
            </tr></thead>
            <tbody>
            ${rows.map(([bk, b], i) => {
                const st = statusM[b.status] || statusM.draft;
                const inv = b.salesInvoiceKey ? (window.salesInvoices || {})[b.salesInvoiceKey] : null;
                const collected = pdIsBillingCollected(b);
                const invCell = inv
                    ? `<span onclick="viewSInv && viewSInv('${b.salesInvoiceKey}')" style="color:#2d6a9f;cursor:pointer;font-weight:700;text-decoration:underline;font-size:11px">🧾 ${inv.number || 'فاتورة'}</span>
                       <span style="background:${collected ? '#eafaf1' : '#f4ecf7'};color:${collected ? '#1e8449' : '#5b2c6f'};font-size:9px;padding:1px 6px;border-radius:4px;margin-right:3px">${collected ? 'محصَّل' : 'مسودة'}</span>`
                    : `<span style="background:#fef5e7;color:#b9770e;font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700">⏳ لم تُفوتر</span>`;
                return `<tr style="${b.status === 'cancelled' ? 'opacity:.55' : ''}">
                    <td style="color:#888">${i + 1}</td>
                    <td><span onclick="openBillingDetail && openBillingDetail('${bk}')" style="color:#2d6a9f;cursor:pointer;font-weight:700;text-decoration:underline">📑 ${b.billingNo || '?'}</span></td>
                    <td style="white-space:nowrap">${b.billingDate || b.date || '—'}</td>
                    <td style="white-space:nowrap;font-size:11px;color:#666">${b.fromDate && b.toDate ? `${b.fromDate} ← ${b.toDate}` : '—'}</td>
                    <td style="font-weight:700;color:#1a3a5c;text-align:left">${fmt(b.currentAmount || 0)}</td>
                    <td style="font-weight:600;color:#2d6a9f;text-align:left">${fmt(b.cumulativeAmount || 0)}</td>
                    <td style="font-weight:600;color:#e67e22;text-align:left">${fmt(b.retentionAmount || 0)}</td>
                    <td style="font-weight:700;color:#27ae60;text-align:left">${fmt(b.netAmount || 0)}</td>
                    <td><span style="background:${st.bg};color:${st.color};padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap">${st.label}</span></td>
                    <td style="white-space:nowrap">${invCell}</td>
                    <td><div style="display:flex;gap:4px">
                        <button onclick="openBillingDetail && openBillingDetail('${bk}')" class="btn b-b" style="padding:3px 8px;font-size:11px" title="عرض التفاصيل">👁️</button>
                        <button onclick="printBilling && printBilling('${bk}')" class="btn" style="padding:3px 8px;font-size:11px;background:#f8fafc;color:#555;border:1px solid #d0d7e0" title="طباعة">🖨️</button>
                    </div></td>
                </tr>`;
            }).join('')}
            </tbody>
            <tfoot><tr style="background:#f0f5fa;font-weight:800">
                <td colspan="4" style="text-align:right;color:#1a3a5c">الإجمالي (بدون الملغى) — ${active.length} مستخلص</td>
                <td style="text-align:left;color:#1a3a5c">${fmt(sumCur)}</td>
                <td></td>
                <td style="text-align:left;color:#e67e22">${fmt(sumRet)}</td>
                <td style="text-align:left;color:#27ae60">${fmt(sumNet)}</td>
                <td colspan="3"></td>
            </tr></tfoot>
        </table>
        </div>
    </div>`;
}

// مستخلصات المشروع مرتبة زمنياً (الأحدث أولاً) — أساس الطباعة والتصدير
function pdGetBillingsForExport(pid) {
    return Object.entries(window.progressBillings || {})
        .filter(([, b]) => b.projectId === pid)
        .sort((a, b) => (b[1].billingDate || b[1].date || '').localeCompare(a[1].billingDate || a[1].date || ''));
}

const PD_BILL_STATUS_LABELS = { draft: 'مسودة', submitted: 'مُقدَّم للعميل', approved: 'معتمد', paid: 'مدفوع', cancelled: 'ملغى' };

// ── طباعة جدول ملخص المستخلصات ──────────────────────────────────────────
window.pdPrintProjectBillings = function (pid) {
    const p = (window.projects || {})[pid]; if (!p) return;
    const customer = p.customerId ? (window.customers || {})[p.customerId] : null;
    const cA = (typeof cfg !== 'undefined' && cfg.companyAr) || 'اسم الشركة';

    const bills = pdGetBillingsForExport(pid);
    const active = bills.filter(([, b]) => b.status !== 'cancelled');
    const sumCur = active.reduce((s, [, b]) => s + (parseFloat(b.currentAmount) || 0), 0);
    const sumRet = active.reduce((s, [, b]) => s + (parseFloat(b.retentionAmount) || 0), 0);
    const sumNet = active.reduce((s, [, b]) => s + (parseFloat(b.netAmount) || 0), 0);
    const f = v => (parseFloat(v) || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const tRows = bills.map(([, b], i) => {
        const inv = b.salesInvoiceKey ? (window.salesInvoices || {})[b.salesInvoiceKey] : null;
        const collected = pdIsBillingCollected(b);
        return `<tr class="${i % 2 ? 'even' : ''}" ${b.status === 'cancelled' ? 'style="opacity:.55"' : ''}>
            <td>${i + 1}</td>
            <td>مستخلص ${b.billingNo || '?'}</td>
            <td>${b.billingDate || b.date || '—'}</td>
            <td>${b.fromDate && b.toDate ? `${b.fromDate} ← ${b.toDate}` : '—'}</td>
            <td>${f(b.currentAmount)}</td>
            <td>${f(b.cumulativeAmount)}</td>
            <td style="color:#e67e22">${f(b.retentionAmount)}</td>
            <td style="color:#27ae60">${f(b.netAmount)}</td>
            <td><span class="st-${b.status || 'draft'}">${PD_BILL_STATUS_LABELS[b.status] || b.status || ''}</span></td>
            <td>${inv ? `${inv.number || 'فاتورة'} (${collected ? 'محصَّل' : 'مسودة'})` : 'لم تُفوتر'}</td>
        </tr>`;
    }).join('');

    const printHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>مستخلصات المشروع — ${p.name || ''}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Cairo',Arial,sans-serif; direction:rtl; color:#333; font-size:10pt; background:white }
  .hdr { background:linear-gradient(135deg,#1a3a5c,#2d6a9f); color:white; padding:16px 22px; display:flex; justify-content:space-between; align-items:center }
  .hdr-title { font-size:16px; font-weight:800 }
  .hdr-sub { font-size:9.5px; opacity:.85; margin-top:3px }
  .kpis { display:flex; gap:10px; padding:12px 18px; background:#f5f7fa; border-bottom:1px solid #e0e0e0; flex-wrap:wrap }
  .kpi { background:white; border-radius:7px; padding:8px 14px; border:1px solid #e0e8f0; text-align:center; min-width:120px }
  .kpi-l { font-size:8.5pt; color:#888 }
  .kpi-v { font-size:12pt; font-weight:800; margin-top:2px }
  .content { padding:14px 18px }
  table { width:100%; border-collapse:collapse; font-size:9pt }
  th { padding:7px 6px; background:#f0f5fa; font-weight:700; text-align:center; border-bottom:2px solid #c9d8e8 }
  td { padding:5px 6px; text-align:center; border-bottom:1px solid #f0f0f0 }
  tr.even td { background:#fafbfc }
  tfoot td { font-weight:800; background:#f0f5fa }
  .st-draft     { background:#f4ecf7; color:#5b2c6f; padding:2px 8px; border-radius:6px; font-size:9px; font-weight:700 }
  .st-submitted { background:#fef9e7; color:#7d4e00; padding:2px 8px; border-radius:6px; font-size:9px; font-weight:700 }
  .st-approved  { background:#e8f8f5; color:#0e6655; padding:2px 8px; border-radius:6px; font-size:9px; font-weight:700 }
  .st-paid      { background:#e8f4fd; color:#0d4f7c; padding:2px 8px; border-radius:6px; font-size:9px; font-weight:700 }
  .st-cancelled { background:#fdecea; color:#7b1c1c; padding:2px 8px; border-radius:6px; font-size:9px; font-weight:700 }
  .footer { margin-top:18px; padding-top:10px; border-top:2px solid #1a3a5c; display:flex; justify-content:space-between; font-size:8pt; color:#999 }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact }
    .hdr { -webkit-print-color-adjust:exact }
  }
</style>
</head>
<body>
<div class="hdr">
  <div>
    <div class="hdr-title">📑 مستخلصات المشروع — ${p.name || ''}</div>
    <div class="hdr-sub">${cA} ${customer ? '| العميل: ' + customer.nameAr : ''} | عدد المستخلصات: ${bills.length}</div>
  </div>
  <div style="font-size:22px">📑</div>
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-l">💰 قيمة الأعمال (بدون الملغى)</div><div class="kpi-v" style="color:#2d6a9f">${f(sumCur)}</div></div>
  <div class="kpi"><div class="kpi-l">🔒 الاحتفاظ</div><div class="kpi-v" style="color:#e67e22">${f(sumRet)}</div></div>
  <div class="kpi"><div class="kpi-l">✅ صافي المستحق</div><div class="kpi-v" style="color:#27ae60">${f(sumNet)}</div></div>
  <div class="kpi"><div class="kpi-l">📋 عدد المستخلصات</div><div class="kpi-v">${active.length}</div></div>
</div>
<div class="content">
  <table>
    <thead><tr><th>#</th><th>رقم المستخلص</th><th>التاريخ</th><th>الفترة</th><th>قيمة الأعمال الحالية</th><th>التراكمي</th><th>الاحتفاظ</th><th>صافي المستحق</th><th>الحالة</th><th>الفاتورة</th></tr></thead>
    <tbody>${tRows || '<tr><td colspan="10" style="padding:20px;text-align:center;color:#aaa">لا توجد مستخلصات</td></tr>'}</tbody>
    <tfoot><tr>
      <td colspan="4" style="text-align:right;padding:8px 10px">الإجمالي (بدون الملغى)</td>
      <td>${f(sumCur)}</td>
      <td></td>
      <td style="color:#e67e22">${f(sumRet)}</td>
      <td style="color:#27ae60">${f(sumNet)}</td>
      <td colspan="2"></td>
    </tr></tfoot>
  </table>
  <div class="footer">
    <span>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA')}</span>
    <span>${cA}</span>
    <span>هذا المستند للاستخدام الداخلي فقط</span>
  </div>
</div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1000,height=720');
    w.document.write(printHTML);
    w.document.close();
    // طباعة مرة واحدة فقط: onload هو الأساس، والمؤقّت احتياط إن لم يعمل — مع حارس يمنع التكرار
    let _printed = false;
    const _doPrint = () => { if (_printed || w.closed) return; _printed = true; w.focus(); w.print(); };
    w.onload = () => setTimeout(_doPrint, 400);
    setTimeout(_doPrint, 1200);
};

// ── تصدير جدول ملخص المستخلصات إلى Excel ─────────────────────────────────
window.pdExportProjectBillingsExcel = function (pid) {
    const p = (window.projects || {})[pid]; if (!p) { toast('المشروع غير موجود', 'er'); return; }
    const customer = p.customerId ? (window.customers || {})[p.customerId] : null;

    const bills = pdGetBillingsForExport(pid);
    if (!bills.length) { toast('لا توجد مستخلصات للتصدير', 'er'); return; }

    const rows = bills.map(([, b], i) => {
        const inv = b.salesInvoiceKey ? (window.salesInvoices || {})[b.salesInvoiceKey] : null;
        const collected = pdIsBillingCollected(b);
        return {
            '#': i + 1,
            'رقم المستخلص': b.billingNo || '',
            'التاريخ': b.billingDate || b.date || '',
            'الفترة من': b.fromDate || '',
            'الفترة إلى': b.toDate || '',
            'قيمة الأعمال الحالية': parseFloat(b.currentAmount) || 0,
            'التراكمي': parseFloat(b.cumulativeAmount) || 0,
            'الاحتفاظ': parseFloat(b.retentionAmount) || 0,
            'الضريبة': parseFloat(b.vatAmount) || 0,
            'صافي المستحق': parseFloat(b.netAmount) || 0,
            'الحالة': PD_BILL_STATUS_LABELS[b.status] || b.status || '',
            'الفاتورة': inv ? (inv.number || 'فاتورة') : 'لم تُفوتر',
            'موقف التحصيل': inv ? (collected ? 'محصَّل' : 'فاتورة مسودة') : 'مستحق',
            'العميل': customer ? customer.nameAr : (b.clientName || ''),
        };
    });

    // صف الإجمالي (بدون الملغى)
    const active = bills.filter(([, b]) => b.status !== 'cancelled');
    rows.push({
        '#': '', 'رقم المستخلص': 'الإجمالي (بدون الملغى)', 'التاريخ': '', 'الفترة من': '', 'الفترة إلى': '',
        'قيمة الأعمال الحالية': active.reduce((s, [, b]) => s + (parseFloat(b.currentAmount) || 0), 0),
        'التراكمي': '',
        'الاحتفاظ': active.reduce((s, [, b]) => s + (parseFloat(b.retentionAmount) || 0), 0),
        'الضريبة': active.reduce((s, [, b]) => s + (parseFloat(b.vatAmount) || 0), 0),
        'صافي المستحق': active.reduce((s, [, b]) => s + (parseFloat(b.netAmount) || 0), 0),
        'الحالة': '', 'الفاتورة': '', 'موقف التحصيل': '', 'العميل': ''
    });

    try {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [4, 14, 12, 12, 12, 18, 18, 14, 14, 18, 14, 18, 14, 22].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'مستخلصات المشروع');
        XLSX.writeFile(wb, `مستخلصات_${p.name || pid}_${new Date().toISOString().substring(0, 10)}.xlsx`);
        toast('✅ تم التصدير بنجاح', 'ok');
    } catch (e) { toast('❌ ' + e.message, 'er'); }
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   صفحة منبثقة: قائمة المستخلصات المحصَّلة / المستحقة (من كروت الـ KPI)    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
window.pdShowBillingListPage = function (pid, filterType) {
    const pg = document.getElementById('pg-projectdetail');
    if (!pg) return;
    const p = (window.projects || {})[pid]; if (!p) return;

    const isCollected = filterType === 'collected';
    const title = isCollected ? 'المستخلصات المحصَّلة (تحوّلت لفاتورة معتمدة ومرحَّلة)' : 'المستخلصات المستحقة (لم تتحوّل لفاتورة بعد)';
    const color = isCollected ? '#27ae60' : '#e67e22';
    const icon = isCollected ? '✅' : '⏳';
    const statusLabels = { draft: 'مسودة', submitted: 'مُقدَّم للعميل اعتماد', approved: 'معتمد', paid: 'مدفوع' };

    const list = Object.entries(window.progressBillings || {})
        .filter(([, b]) => b.projectId === pid && b.status !== 'cancelled' && pdIsBillingCollected(b) === isCollected)
        .sort((a, b) => (b[1].billingDate || b[1].date || '').localeCompare(a[1].billingDate || a[1].date || ''));

    const total = list.reduce((s, [, b]) => s + (parseFloat(b.currentAmount) || 0), 0);
    const statusesPresent = [...new Set(list.map(([, b]) => b.status))];

    pg.innerHTML = `
    <!-- مسار الرجوع -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <button class="btn" onclick="renderProjectDetail()" style="background:#f8fafc;color:#2d6a9f;border:1.5px solid #d0d7e0;font-size:12px;font-weight:700">→ رجوع لملف المشروع</button>
        <div style="font-size:12px;color:#888">📁 ${p.name || ''} <span style="color:#ccc">/</span> 📑 المستخلصات <span style="color:#ccc">/</span> <span style="color:${color};font-weight:800">${icon} ${isCollected ? 'محصَّل' : 'مستحق'}</span></div>
    </div>

    <!-- ترويسة -->
    <div style="background:linear-gradient(135deg,${color},${color}cc);color:white;border-radius:14px;padding:18px 22px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
            <div style="font-size:18px;font-weight:800">${icon} ${title}</div>
            <div style="font-size:12px;opacity:.9;margin-top:4px">${list.length} مستخلص — بإجمالي ${fmt(total)} ريال (بدون ضريبة)</div>
        </div>
    </div>

    <!-- شريط البحث والفلاتر -->
    <div style="background:white;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,.04)">
        <div style="position:relative;flex:1;min-width:180px;max-width:320px">
            <input id="pdBillListSearch" type="text" placeholder="🔍 ابحث برقم المستخلص / التاريخ..." oninput="pdFilterBillingListCards()" style="width:100%;padding:8px 12px;border:1.5px solid #d0d7e0;border-radius:8px;font-size:12px;font-family:inherit">
        </div>
        ${statusesPresent.length > 1 ? `
        <select id="pdBillListStatus" onchange="pdFilterBillingListCards()" style="padding:8px 12px;border:1.5px solid #d0d7e0;border-radius:8px;font-size:12px;font-family:inherit">
            <option value="">كل الحالات</option>
            ${statusesPresent.map(s => `<option value="${s}">${statusLabels[s] || s}</option>`).join('')}
        </select>` : ''}
        <select id="pdBillListSort" onchange="pdFilterBillingListCards()" style="padding:8px 12px;border:1.5px solid #d0d7e0;border-radius:8px;font-size:12px;font-family:inherit">
            <option value="date-desc">📅 الأحدث أولاً</option>
            <option value="date-asc">📅 الأقدم أولاً</option>
            <option value="amount-desc">💰 الأعلى قيمة</option>
            <option value="amount-asc">💰 الأقل قيمة</option>
        </select>
    </div>

    ${list.length === 0
        ? `<div class="card"><div class="empty"><div class="ei">${icon}</div><p>لا توجد مستخلصات ${isCollected ? 'محصَّلة' : 'مستحقة'} حالياً لهذا المشروع</p></div></div>`
        : `<div id="pdBillListCards" style="display:flex;flex-direction:column;gap:12px">
            ${list.map(([bk, b]) => {
                const sLabel = statusLabels[b.status] || b.status || '';
                const searchKey = [b.billingNo, b.contractRef, b.billingDate, b.fromDate, b.toDate, sLabel].filter(Boolean).join(' ').toLowerCase();
                return `<div class="pd-bill-list-card" data-search="${searchKey.replace(/"/g, '')}" data-status="${b.status || ''}" data-amount="${parseFloat(b.currentAmount) || 0}" data-date="${b.billingDate || b.date || ''}">${typeof renderBillingCard === 'function' ? renderBillingCard(bk, b) : ''}</div>`;
            }).join('')}
           </div>`}
    `;
};

// تصفية وترتيب بطاقات صفحة المحصَّل/المستحق حسب البحث والحالة والترتيب المختار
window.pdFilterBillingListCards = function () {
    const q = (document.getElementById('pdBillListSearch')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('pdBillListStatus')?.value || '';
    const sortMode = document.getElementById('pdBillListSort')?.value || 'date-desc';
    const container = document.getElementById('pdBillListCards');
    if (!container) return;
    const cards = [...container.querySelectorAll('.pd-bill-list-card')];
    cards.forEach(el => {
        const matchesSearch = !q || (el.dataset.search || '').includes(q);
        const matchesStatus = !statusFilter || el.dataset.status === statusFilter;
        el.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
    });
    cards.sort((a, b) => {
        if (sortMode === 'date-asc') return (a.dataset.date || '').localeCompare(b.dataset.date || '');
        if (sortMode === 'amount-asc') return (parseFloat(a.dataset.amount) || 0) - (parseFloat(b.dataset.amount) || 0);
        if (sortMode === 'amount-desc') return (parseFloat(b.dataset.amount) || 0) - (parseFloat(a.dataset.amount) || 0);
        return (b.dataset.date || '').localeCompare(a.dataset.date || '');
    });
    cards.forEach(el => container.appendChild(el));
};

// فتح نموذج مستخلص جديد مع تحديد المشروع مسبقاً
window.pdOpenNewBilling = function (pid) {
    if (typeof openNewBillingModal !== 'function') {
        toast('جاري تحميل وحدة المستخلصات...', 'er'); return;
    }
    openNewBillingModal();
    // بعد فتح المودال نختار المشروع تلقائياً
    setTimeout(() => {
        const sel = document.getElementById('newBillProject');
        if (sel) {
            sel.value = pid;
            sel.dispatchEvent(new Event('change'));
        }
    }, 180);
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB 4 — المصروفات                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB 3.5 — فواتير المبيعات المرتبطة بالمشروع                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// حالة الفاتورة حسب موقف السداد الفعلي:
// مسودة/ملغاة كما هي، أما المرحَّلة فتُعرض: مسددة / مسددة جزئياً / غير مسددة
function pdInvStatusInfo(inv) {
    if (inv.status === 'draft')     return { label: 'مسودة', bg: '#f4ecf7', color: '#5b2c6f' };
    if (inv.status === 'cancelled') return { label: 'ملغاة', bg: '#fdecea', color: '#7b1c1c' };
    const grand = parseFloat(inv.grandTotal) || 0;
    const paid  = parseFloat(inv.paidAmount) || 0;
    if (grand > 0 && paid >= grand - 0.01) return { label: 'مسددة',        bg: '#eafaf1', color: '#1e8449' };
    if (paid > 0)                          return { label: 'مسددة جزئياً', bg: '#fef5e7', color: '#b9770e' };
    return { label: 'غير مسددة', bg: '#fdedec', color: '#c0392b' };
}

// تعديل سريع لحقل "الموضوع" (البيان) لفاتورة المبيعات من ملف المشروع
window.pdEditInvSubject = function (key, cell) {
    const inv = (window.salesInvoices || {})[key]; if (!inv) return;
    if (cell.querySelector('input')) return;
    const current = inv.subject || '';
    cell.innerHTML = `<input type="text" value="${current.replace(/"/g, '&quot;')}" style="width:100%;padding:3px 6px;font-size:12px;border:1.5px solid #2d6a9f;border-radius:4px" />`;
    const input = cell.querySelector('input');
    input.focus();
    input.select();
    const save = async () => {
        const val = input.value.trim();
        if (val === current) { cell.textContent = current || '—'; return; }
        try {
            await update(ref(db, 'ledger/salesInvoices/' + key), { subject: val });
            toast('✅ تم تحديث البيان', 'ok');
        } catch (e) {
            toast('❌ خطأ: ' + (e.message || e), 'er');
            cell.textContent = current || '—';
        }
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { cell.textContent = current || '—'; }
    });
};

function pdRenderProjectInvoices(pid) {
    const pane = document.getElementById('pd-tab-invoices'); if (!pane) return;
    const p = (window.projects || {})[pid]; if (!p) return;
    const customer = p.customerId ? (window.customers || {})[p.customerId] : null;

    const allInv = Object.entries(window.salesInvoices || {})
        .filter(([, inv]) => inv.projectId === pid && inv.status !== 'cancelled')
        .sort((a, b) => (a[1].date || '').localeCompare(b[1].date || ''));

    const contractValue = pdAdjustedContract(pid);  // شاملة أوامر التغيير المعتمدة
    const totalAmount  = allInv.reduce((s, [, inv]) => s + (parseFloat(inv.grandTotal) || 0), 0);
    const totalPaid    = allInv.reduce((s, [, inv]) => s + (parseFloat(inv.paidAmount) || 0), 0);
    const totalPending = totalAmount - totalPaid;

    // 💵 المحصَّل قبل الضريبة — نسبة المبلغ المحصَّل من كل فاتورة محسوبة على القيمة قبل الضريبة
    const collectedBeforeTax = allInv.reduce((s, [, inv]) => {
        const grand = parseFloat(inv.grandTotal) || 0;
        const paid = parseFloat(inv.paidAmount) || 0;
        if (grand <= 0) return s;
        const beforeVAT = parseFloat(inv.netBeforeTax) || (grand - (parseFloat(inv.vatTotal) || 0));
        return s + beforeVAT * (paid / grand);
    }, 0);

    // 📑 مستخلصات لم تتحوّل بعد إلى فاتورة معتمدة ومرحَّلة (تشمل غير المفوترة والمسودات وغير المرحَّلة)
    const dueBillings = Object.values(window.progressBillings || {})
        .filter(b => b.projectId === pid && b.status !== 'cancelled' && !pdIsBillingCollected(b));
    const dueBillingsTotal = dueBillings.reduce((s, b) => s + (parseFloat(b.currentAmount) || 0), 0);

    // ⚖️ باقي قيمة العقد بعد خصم الفواتير الصادرة للعميل
    // قيمة العقد المسجّلة بالمشروع "قبل الضريبة" (نفس أساس BOQ)، بينما إجمالي الفواتير "شامل الضريبة" (grandTotal)؛
    // نقارن على أساس واحد بتحويل قيمة العقد إلى ما يقابلها شاملاً للضريبة.
    const vatPctInv = parseFloat(p.vatPct) || 15;
    const contractValueInclVAT = contractValue * (1 + vatPctInv / 100);
    const remainingContract = contractValueInclVAT - totalAmount;

    pane.innerHTML = `
    <!-- ملخص العميل المرتبط -->
    ${customer ? `
    <div style="background:linear-gradient(135deg,#0e6251,#16a085);color:white;border-radius:12px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
            <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:.8px">العميل المرتبط بالمشروع</div>
            <div style="font-size:16px;font-weight:800;margin-top:3px">🤝 ${customer.nameAr || ''}</div>
            <div style="font-size:11px;opacity:.85;margin-top:2px">${customer.code || ''} ${customer.phone ? '· ' + customer.phone : ''} ${customer.vatNumber ? '· ضريبي: ' + customer.vatNumber : ''}</div>
        </div>
        <button onclick="bcNav('customers')" style="background:rgba(255,255,255,.2);color:white;border:1.5px solid rgba(255,255,255,.4);border-radius:8px;padding:7px 14px;cursor:pointer;font-size:12px;font-weight:700">🤝 ملف العميل ↗</button>
    </div>` : `
    <div style="background:#fff3cd;border:1.5px solid #f39c12;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
        <div style="color:#7d4e00;font-size:13px;font-weight:700">⚠️ المشروع غير مرتبط بعميل</div>
        <button onclick="openPrjM('${pid}')" style="background:#f39c12;color:white;border:none;border-radius:7px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:700">ربط عميل</button>
    </div>`}

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:14px">
        ${kpiCard('🧾', 'إجمالي الفواتير الصادرة للعميل', fmt(totalAmount), `${allInv.length} فاتورة`, '#2d6a9f')}
        ${kpiCard('✅', 'المحصَّل قبل الضريبة', fmt(collectedBeforeTax), 'ريال', '#27ae60')}
        ${kpiCard('📑', 'مستخلصات مستحقة لم تُفوتر', fmt(dueBillingsTotal), `${dueBillings.length} مستخلص`, dueBillingsTotal > 0 ? '#e67e22' : '#888')}
        ${kpiCard('⚖️', 'باقي قيمة العقد', fmt(remainingContract), 'ريال', remainingContract >= 0 ? '#8e44ad' : '#c0392b')}
        ${kpiCard('💰', 'إجمالي المحصَّل (شامل الضريبة)', fmt(totalPaid), 'ريال', '#16a085')}
        ${kpiCard('⏳', 'المتبقي على الفواتير', fmt(totalPending), 'ريال', totalPending > 0 ? '#c0392b' : '#27ae60')}
    </div>

    <!-- قائمة الفواتير -->
    <div class="card">
        <div class="tlb">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <div class="c-tl" style="margin:0;border:none;padding:0">🧾 فواتير المبيعات لهذا المشروع</div>
                <span style="background:#e8f4fd;color:#1a5276;padding:4px 12px;border-radius:10px;font-size:12px;font-weight:700">${allInv.length} فاتورة</span>
            </div>
            <div style="display:flex;gap:8px">
                <button onclick="bcNav('salesinvoices')" style="padding:7px 14px;background:#f8fafc;color:#555;border:1.5px solid #d0d7e0;border-radius:8px;cursor:pointer;font-size:12px">↗ صفحة الفواتير</button>
                <button onclick="pdOpenInvoicePrintSettings('${pid}')" style="padding:7px 14px;background:#f8fafc;color:#555;border:1.5px solid #d0d7e0;border-radius:8px;cursor:pointer;font-size:12px">🖨️ طباعة</button>
                <button onclick="pdExportProjectInvoicesExcel('${pid}')" style="padding:7px 14px;background:#1e7e34;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700">📤 Excel</button>
                <button onclick="pdOpenNewInvoiceForProject('${pid}')" style="padding:7px 14px;background:#16a085;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700">➕ فاتورة جديدة</button>
            </div>
        </div>

        ${allInv.length === 0 ? `
        <div class="empty">
            <div class="ei">🧾</div>
            <p>لا توجد فواتير مبيعات لهذا المشروع</p>
            <button onclick="pdOpenNewInvoiceForProject('${pid}')" class="btn b-g" style="margin-top:12px">➕ إنشاء أول فاتورة</button>
        </div>` : `
        <div class="tw" style="overflow-x:auto">
        <table class="st">
            <thead><tr>
                <th>#</th><th>رقم الفاتورة</th><th>التاريخ</th><th>الاستحقاق</th><th>الموضوع</th><th>قيمة الفاتورة</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>إجراءات</th>
            </tr></thead>
            <tbody>
            ${allInv.map(([k, inv], i) => {
                const st = pdInvStatusInfo(inv);
                const pending = (parseFloat(inv.grandTotal)||0) - (parseFloat(inv.paidAmount)||0);
                const isBilling = !!inv.billingKey;
                return `<tr>
                    <td style="color:#888">${i+1}</td>
                    <td>
                        <span onclick="viewSInv && viewSInv('${k}')" style="color:#2d6a9f;cursor:pointer;font-weight:700;text-decoration:underline">🧾 ${inv.number}</span>
                        ${isBilling ? `<span style="background:#8e44ad;color:white;font-size:9px;padding:1px 5px;border-radius:4px;margin-right:4px">مستخلص</span>` : ''}
                    </td>
                    <td style="white-space:nowrap">${inv.date || '—'}</td>
                    <td style="white-space:nowrap;color:${inv.dueDate && inv.dueDate < new Date().toISOString().substring(0,10) && pending > 0 ? '#c0392b' : '#555'}">${inv.dueDate || '—'}</td>
                    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" title="انقر مرتين للتعديل" ondblclick="pdEditInvSubject('${k}', this)">${inv.subject || '—'}</td>
                    <td style="font-weight:700;color:#1a3a5c;text-align:left">${fmt(inv.grandTotal || 0)}</td>
                    <td style="font-weight:600;color:#27ae60;text-align:left">${fmt(inv.paidAmount || 0)}</td>
                    <td style="font-weight:700;color:${pending > 0 ? '#c0392b' : '#27ae60'};text-align:left">${fmt(pending)}</td>
                    <td><span style="background:${st.bg};color:${st.color};padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700">${st.label}</span></td>
                    <td><div style="display:flex;gap:4px">
                        <button onclick="viewSInv && viewSInv('${k}')" class="btn b-b" style="padding:3px 8px;font-size:11px">👁️</button>
                        ${inv.status === 'draft' ? `<button onclick="editSInv && editSInv('${k}')" class="btn" style="padding:3px 8px;font-size:11px;background:#f39c12;color:white">✏️</button>` : ''}
                        ${inv.status === 'draft' ? `<button onclick="postSInv && postSInv('${k}')" class="btn b-g" style="padding:3px 8px;font-size:11px">✅ ترحيل</button>` : ''}
                        ${inv.status === 'posted' && pending > 0.01 ? `<button onclick="openReceiptForInvoice && openReceiptForInvoice('${k}')" class="btn" style="padding:3px 8px;font-size:11px;background:#27ae60;color:white" title="تسجيل سداد على هذه الفاتورة">💰 سداد</button>` : ''}
                    </div></td>
                </tr>`;
            }).join('')}
            </tbody>
            <tfoot><tr style="background:#f0f5fa;font-weight:800">
                <td colspan="5" style="padding:10px;color:#1a3a5c;text-align:right">الإجمالي</td>
                <td style="text-align:left;color:#1a3a5c">${fmt(totalAmount)}</td>
                <td style="text-align:left;color:#27ae60">${fmt(totalPaid)}</td>
                <td style="text-align:left;color:${totalPending > 0 ? '#c0392b' : '#27ae60'}">${fmt(totalPending)}</td>
                <td colspan="2"></td>
            </tr></tfoot>
        </table>
        </div>`}
    </div>`;
}

// ── إعدادات طباعة فواتير المشروع: اختيار الأعمدة ─────────────────────────
const PD_INV_PRINT_COLS = [
    { id: 'number',  label: 'رقم الفاتورة', width: 12 },
    { id: 'date',    label: 'التاريخ', width: 9 },
    { id: 'due',     label: 'الاستحقاق', width: 9 },
    { id: 'subject', label: 'الموضوع', width: 28 },
    { id: 'total',   label: 'قيمة الفاتورة', width: 11 },
    { id: 'paid',    label: 'المدفوع', width: 11 },
    { id: 'pending', label: 'المتبقي', width: 11 },
    { id: 'status',  label: 'الحالة', width: 9 },
];

window.pdOpenInvoicePrintSettings = function (pid) {
    document.getElementById('pdInvPrintModal')?.remove();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('pdInvPrintCols') || 'null'); } catch (e) { /* تجاهل تفضيلات تالفة */ }
    let savedWidths = null;
    try { savedWidths = JSON.parse(localStorage.getItem('pdInvPrintWidths') || 'null'); } catch (e) { /* تجاهل تفضيلات تالفة */ }
    const savedTitle = localStorage.getItem('pdInvPrintTitle') || '';
    const p = (window.projects || {})[pid] || {};
    const m = document.createElement('div');
    m.id = 'pdInvPrintModal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center';
    m.innerHTML = `
    <div style="background:white;border-radius:14px;padding:22px;max-width:480px;width:92%;box-shadow:0 10px 40px rgba(0,0,0,.25)" onclick="event.stopPropagation()">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:6px">🖨️ إعدادات طباعة الفواتير</div>
        <div style="margin-bottom:14px">
            <label style="font-size:12px;color:#666;font-weight:700">عنوان التقرير</label>
            <input type="text" id="pdInvPrintTitleInput" value="${savedTitle.replace(/"/g, '&quot;')}" placeholder="🧾 فواتير المبيعات — ${(p.name || '').replace(/"/g, '&quot;')}" style="width:100%;padding:7px 10px;border:1.5px solid #e0e8f0;border-radius:8px;font-size:13px;margin-top:4px;box-sizing:border-box">
        </div>
        <div style="font-size:12px;color:#888;margin-bottom:14px">اختر الأعمدة وحدد عرض كل عمود (%) في التقرير المطبوع (يُحفظ اختيارك للمرات القادمة):</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:18px">
            ${PD_INV_PRINT_COLS.map(c => `
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#1a3a5c;background:#f8fafc;border:1.5px solid #e0e8f0;border-radius:8px;padding:7px 10px;cursor:pointer">
                <input type="checkbox" class="pd-inv-print-col" value="${c.id}" ${(!saved || saved.includes(c.id)) ? 'checked' : ''} style="accent-color:#2d6a9f;width:15px;height:15px">
                <span style="flex:1">${c.label}</span>
                <span style="font-size:11px;color:#888">العرض %</span>
                <input type="number" class="pd-inv-print-width" data-col="${c.id}" min="3" max="60" value="${(savedWidths && savedWidths[c.id]) || c.width}" style="width:55px;padding:3px 6px;border:1.5px solid #e0e8f0;border-radius:6px;font-size:12px;text-align:center">
            </label>`).join('')}
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdConfirmInvoicePrint('${pid}')" style="font-weight:800">🖨️ طباعة</button>
            <button class="btn" onclick="document.getElementById('pdInvPrintModal').remove()" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
    m.onclick = () => m.remove();
    document.body.appendChild(m);
};

window.pdConfirmInvoicePrint = function (pid) {
    const cols = [...document.querySelectorAll('.pd-inv-print-col:checked')].map(c => c.value);
    if (!cols.length) { toast('اختر عموداً واحداً على الأقل', 'er'); return; }
    const widths = {};
    document.querySelectorAll('.pd-inv-print-width').forEach(inp => {
        widths[inp.dataset.col] = parseFloat(inp.value) || PD_INV_PRINT_COLS.find(c => c.id === inp.dataset.col)?.width || 10;
    });
    const title = (document.getElementById('pdInvPrintTitleInput')?.value || '').trim();
    localStorage.setItem('pdInvPrintCols', JSON.stringify(cols));
    localStorage.setItem('pdInvPrintWidths', JSON.stringify(widths));
    localStorage.setItem('pdInvPrintTitle', title);
    document.getElementById('pdInvPrintModal')?.remove();
    pdPrintProjectInvoices(pid, cols, widths, title);
};

window.pdPrintProjectInvoices = function (pid, cols, widths, title) {
    const p = (window.projects || {})[pid]; if (!p) return;
    const customer = p.customerId ? (window.customers || {})[p.customerId] : null;
    const cA = (typeof cfg !== 'undefined' && cfg.companyAr) || 'اسم الشركة';
    if (!Array.isArray(cols) || !cols.length) cols = PD_INV_PRINT_COLS.map(c => c.id);
    if (!widths) { try { widths = JSON.parse(localStorage.getItem('pdInvPrintWidths') || 'null'); } catch (e) { widths = null; } }
    if (title === undefined) title = localStorage.getItem('pdInvPrintTitle') || '';
    const reportTitle = (title && title.trim()) ? title.trim() : `🧾 فواتير المبيعات — ${p.name || ''}`;
    const has = id => cols.includes(id);
    const colWidth = id => (widths && widths[id]) || PD_INV_PRINT_COLS.find(c => c.id === id)?.width || 10;
    const numColWidth = Math.max(3, 100 - cols.reduce((s, id) => s + colWidth(id), 0));
    const colgroup = `<colgroup><col style="width:${numColWidth}%">${PD_INV_PRINT_COLS.filter(c => has(c.id)).map(c => `<col style="width:${colWidth(c.id)}%">`).join('')}</colgroup>`;

    const allInv = Object.entries(window.salesInvoices || {})
        .filter(([, inv]) => inv.projectId === pid && inv.status !== 'cancelled')
        .sort((a, b) => (a[1].date || '').localeCompare(b[1].date || ''));

    const totalAmount  = allInv.reduce((s, [, inv]) => s + (parseFloat(inv.grandTotal) || 0), 0);
    const totalPaid    = allInv.reduce((s, [, inv]) => s + (parseFloat(inv.paidAmount) || 0), 0);
    const totalPending = totalAmount - totalPaid;

    const headCells = '<th>#</th>' + PD_INV_PRINT_COLS.filter(c => has(c.id)).map(c => `<th${c.id === 'subject' ? ' class="subj-col"' : ''}>${c.label}</th>`).join('');

    const tRows = allInv.map(([k, inv], i) => {
        const pending = (parseFloat(inv.grandTotal)||0) - (parseFloat(inv.paidAmount)||0);
        const st = pdInvStatusInfo(inv);
        const f = v => (parseFloat(v)||0).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
        const cells = {
            number:  `<td>${inv.number||'—'} ${inv.billingKey?'<span class="badge">مستخلص</span>':''}</td>`,
            date:    `<td>${inv.date||'—'}</td>`,
            due:     `<td>${inv.dueDate||'—'}</td>`,
            subject: `<td class="subj-col" style="text-align:right;white-space:normal;word-break:break-word">${inv.subject||'—'}</td>`,
            total:   `<td>${f(inv.grandTotal)}</td>`,
            paid:    `<td style="color:#27ae60">${f(inv.paidAmount)}</td>`,
            pending: `<td style="color:${pending>0?'#c0392b':'#27ae60'}">${f(pending)}</td>`,
            status:  `<td><span style="background:${st.bg};color:${st.color};padding:2px 8px;border-radius:6px;font-size:9px;font-weight:700">${st.label}</span></td>`,
        };
        return `<tr class="${i%2?'even':''}">
            <td>${i+1}</td>
            ${PD_INV_PRINT_COLS.filter(c => has(c.id)).map(c => cells[c.id]).join('')}
        </tr>`;
    }).join('');

    const f2 = v => (parseFloat(v)||0).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});

    // صف الإجمالي: خلية التسمية تمتد على # والأعمدة الوصفية المختارة، ثم خلايا المجاميع للأعمدة الرقمية المختارة
    const labelSpan = 1 + ['number', 'date', 'due', 'subject'].filter(has).length;
    const tfootCells = `<td colspan="${labelSpan}" style="text-align:right;padding:8px 10px">الإجمالي</td>`
        + (has('total')   ? `<td>${f2(totalAmount)}</td>` : '')
        + (has('paid')    ? `<td style="color:#27ae60">${f2(totalPaid)}</td>` : '')
        + (has('pending') ? `<td style="color:${totalPending>0?'#c0392b':'#27ae60'}">${f2(totalPending)}</td>` : '')
        + (has('status')  ? '<td></td>' : '');
    const colCount = 1 + cols.length;
    const printHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${reportTitle}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Cairo',Arial,sans-serif; direction:rtl; color:#333; font-size:10pt; background:white }
  .hdr { background:linear-gradient(135deg,#0e6251,#16a085); color:white; padding:16px 22px; display:flex; justify-content:space-between; align-items:center }
  .hdr-title { font-size:16px; font-weight:800 }
  .hdr-sub { font-size:9.5px; opacity:.85; margin-top:3px }
  .kpis { display:flex; gap:10px; padding:12px 18px; background:#f5f7fa; border-bottom:1px solid #e0e0e0; flex-wrap:wrap }
  .kpi { background:white; border-radius:7px; padding:8px 14px; border:1px solid #e0e8f0; text-align:center; min-width:120px }
  .kpi-l { font-size:8.5pt; color:#888 }
  .kpi-v { font-size:12pt; font-weight:800; margin-top:2px }
  .content { padding:14px 18px }
  table { width:100%; border-collapse:collapse; font-size:9pt; border:1px solid #c9d8e8 }
  th { padding:7px 6px; background:#f0f5fa; font-weight:700; text-align:center; border:1px solid #c9d8e8; border-bottom:2px solid #8aa9c9 }
  td { padding:5px 6px; text-align:center; border:1px solid #e0e8f0 }
  tr.even td { background:#fafbfc }
  tfoot td { font-weight:800; background:#f0f5fa; border:1px solid #c9d8e8 }
  th.subj-col, td.subj-col { border-right:2px solid #8aa9c9; border-left:2px solid #8aa9c9 }
  .badge { background:#8e44ad; color:white; font-size:8px; padding:1px 5px; border-radius:4px; vertical-align:middle }
  .st-draft  { background:#f4ecf7; color:#5b2c6f; padding:2px 8px; border-radius:6px; font-size:9px; font-weight:700 }
  .st-posted { background:#e8f8f5; color:#0e6655; padding:2px 8px; border-radius:6px; font-size:9px; font-weight:700 }
  .st-paid   { background:#e8f4fd; color:#0d4f7c; padding:2px 8px; border-radius:6px; font-size:9px; font-weight:700 }
  .footer { margin-top:18px; padding-top:10px; border-top:2px solid #0e6251; display:flex; justify-content:space-between; font-size:8pt; color:#999 }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact }
    .hdr { -webkit-print-color-adjust:exact }
  }
</style>
</head>
<body>
<div class="hdr">
  <div>
    <div class="hdr-title">${reportTitle}</div>
    <div class="hdr-sub">${cA} ${customer ? '| العميل: ' + customer.nameAr : ''} | إجمالي الفواتير: ${allInv.length}</div>
  </div>
  <div style="font-size:22px">🧾</div>
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-l">🧾 إجمالي الفواتير</div><div class="kpi-v" style="color:#2d6a9f">${f2(totalAmount)}</div></div>
  <div class="kpi"><div class="kpi-l">✅ المحصَّل</div><div class="kpi-v" style="color:#27ae60">${f2(totalPaid)}</div></div>
  <div class="kpi"><div class="kpi-l">⏳ المتبقي</div><div class="kpi-v" style="color:${totalPending>0?'#c0392b':'#27ae60'}">${f2(totalPending)}</div></div>
  <div class="kpi"><div class="kpi-l">📋 عدد الفواتير</div><div class="kpi-v">${allInv.length}</div></div>
</div>
<div class="content">
  <table>
    ${colgroup}
    <thead><tr>${headCells}</tr></thead>
    <tbody>${tRows || `<tr><td colspan="${colCount}" style="padding:20px;text-align:center;color:#aaa">لا توجد فواتير</td></tr>`}</tbody>
    <tfoot><tr>${tfootCells}</tr></tfoot>
  </table>
  <div class="footer">
    <span>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA')}</span>
    <span>${cA}</span>
    <span>هذا المستند للاستخدام الداخلي فقط</span>
  </div>
</div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1000,height=720');
    w.document.write(printHTML);
    w.document.close();
    // طباعة مرة واحدة فقط: onload هو الأساس، والمؤقّت احتياط إن لم يعمل — مع حارس يمنع التكرار
    let _printed = false;
    const _doPrint = () => { if (_printed || w.closed) return; _printed = true; w.focus(); w.print(); };
    w.onload = () => setTimeout(_doPrint, 400);
    setTimeout(_doPrint, 1200);
};

window.pdExportProjectInvoicesExcel = function (pid) {
    const p = (window.projects || {})[pid]; if (!p) { toast('المشروع غير موجود', 'er'); return; }
    const customer = p.customerId ? (window.customers || {})[p.customerId] : null;

    const allInv = Object.entries(window.salesInvoices || {})
        .filter(([, inv]) => inv.projectId === pid && inv.status !== 'cancelled')
        .sort((a, b) => (a[1].date || '').localeCompare(b[1].date || ''));

    if (!allInv.length) { toast('لا توجد فواتير للتصدير', 'er'); return; }

    const rows = allInv.map(([, inv], i) => {
        const pending = (parseFloat(inv.grandTotal)||0) - (parseFloat(inv.paidAmount)||0);
        return {
            '#': i + 1,
            'رقم الفاتورة': inv.number || '',
            'النوع': inv.billingKey ? 'مستخلص' : 'فاتورة مبيعات',
            'التاريخ': inv.date || '',
            'تاريخ الاستحقاق': inv.dueDate || '',
            'الموضوع': inv.subject || '',
            'قيمة الفاتورة': parseFloat(inv.grandTotal) || 0,
            'المدفوع': parseFloat(inv.paidAmount) || 0,
            'المتبقي': pending,
            'الحالة': pdInvStatusInfo(inv).label,
            'العميل': customer ? customer.nameAr : (inv.customerName || ''),
        };
    });

    // صف الإجمالي
    const totalAmount  = allInv.reduce((s,[,i]) => s + (parseFloat(i.grandTotal)||0), 0);
    const totalPaid    = allInv.reduce((s,[,i]) => s + (parseFloat(i.paidAmount)||0), 0);
    rows.push({ '#': '', 'رقم الفاتورة': 'الإجمالي', 'النوع': '', 'التاريخ': '', 'تاريخ الاستحقاق': '', 'الموضوع': '',
        'قيمة الفاتورة': totalAmount, 'المدفوع': totalPaid, 'المتبقي': totalAmount - totalPaid, 'الحالة': '', 'العميل': '' });

    try {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [4, 18, 14, 12, 14, 30, 16, 16, 16, 12, 22].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'فواتير المبيعات');
        XLSX.writeFile(wb, `فواتير_${p.name||pid}_${new Date().toISOString().substring(0,10)}.xlsx`);
        toast('✅ تم التصدير بنجاح', 'ok');
    } catch (e) { toast('❌ ' + e.message, 'er'); }
};

function pdRenderExpenses(pid) {
    const pane = document.getElementById('pd-tab-expenses'); if (!pane) return;

    const directExp = Object.entries((window.projectExpenses || {})[pid] || {})
        .sort((a, b) => new Date(b[1].date || 0) - new Date(a[1].date || 0));
    const totalDirect = directExp.reduce((s, [, e]) => s + (parseFloat(e.amount) || 0), 0);

    const matCosts = Object.values(window.matPurchases || {}).filter(pu => pu.projectId === pid || (pu.project && pu.project.id === pid));
    const totalMat = matCosts.reduce((s, pu) => s + (parseFloat(pu.purchasedQty) || 0) * (parseFloat(pu.purchasedUnitPrice) || 0), 0);

    const catMap = { materials: '🧱 مواد', labor: '👷 عمالة', equipment: '🚜 معدات', services: '🔧 خدمات', transport: '🚛 نقل', other: '📦 أخرى' };
    const catTotals = {};
    directExp.forEach(([, e]) => { catTotals[e.category] = (catTotals[e.category] || 0) + (parseFloat(e.amount) || 0); });

    // التكاليف غير المباشرة المخصصة للمشروع
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentYear  = currentMonth.slice(0, 4);
    const indCostEntries = Object.entries(window.indirectCosts || {}).filter(([, c]) => (c.allocations || {})[pid]);
    const totalIndMonth  = typeof window.icProjectMonthlyShare === 'function' ? window.icProjectMonthlyShare(pid, currentMonth) : 0;
    const totalIndAnnual = typeof window.icProjectAnnualShare  === 'function' ? window.icProjectAnnualShare(pid, currentYear)   : 0;
    const totalAll = totalMat + totalDirect + totalIndMonth;

    pane.innerHTML = `
    <!-- ملخص المصروفات -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px">
        ${kpiCard('🧱', 'تكلفة مشتريات المواد', fmt(totalMat), 'ريال', '#e67e22')}
        ${kpiCard('💸', 'مصروفات مباشرة', fmt(totalDirect), 'ريال', '#e74c3c')}
        ${kpiCard('📊', 'تكاليف غير مباشرة (الشهر)', fmt(totalIndMonth), currentMonth, '#5b2c6f')}
        ${kpiCard('📊', 'إجمالي (مباشر + غير مباشر)', fmt(totalAll), 'ريال', '#c0392b')}
        ${Object.entries(catTotals).map(([c, v]) => kpiCard(catMap[c]?.split(' ')[0] || '📦', catMap[c]?.substring(2) || c, fmt(v), 'ريال', '#8e44ad')).join('')}
    </div>

    <!-- التكاليف غير المباشرة المخصصة للمشروع -->
    ${indCostEntries.length > 0 ? `
    <div class="card" style="margin-bottom:16px;border-right:4px solid #5b2c6f">
        <div class="tlb">
            <div>
                <div class="c-tl" style="margin:0;border:none;padding:0">📊 التكاليف غير المباشرة المخصصة لهذا المشروع</div>
                <div style="font-size:11px;color:#888;margin-top:4px">توزيع من الصفحة المركزية للتكاليف غير المباشرة — <span onclick="nav('indirectcosts')" style="color:#5b2c6f;cursor:pointer;font-weight:700;text-decoration:underline">إدارة التكاليف</span></div>
            </div>
            <div style="text-align:left">
                <div style="font-size:11px;color:#888">الشهر الحالي · ${currentMonth}</div>
                <div style="font-size:18px;font-weight:900;color:#5b2c6f">${fmt(totalIndMonth)} ريال</div>
                <div style="font-size:11px;color:#888">إجمالي سنة ${currentYear}: <strong style="color:#8e44ad">${fmt(totalIndAnnual)} ريال</strong></div>
            </div>
        </div>
        <div class="tw" style="overflow-x:auto"><table class="st">
            <thead><tr><th>بند التكلفة</th><th>النوع</th><th>نسبة هذا المشروع</th><th>الحصة الشهرية (${currentMonth})</th><th>الحصة السنوية (${currentYear})</th></tr></thead>
            <tbody>
            ${indCostEntries.map(([, c]) => {
                const pct = parseFloat((c.allocations || {})[pid]) || 0;
                const indCatM = { depreciation:'📉 إهلاك', rent:'🏢 إيجارات', salaries:'👔 رواتب إدارية', utilities:'⚡ كهرباء ومياه', insurance:'🛡️ تأمين', other:'📦 أخرى' };
                const monthlyBase = (parseFloat(c.annualAmount) || 0) / 12;
                const overridedMonthly = typeof window.icProjectMonthlyShare === 'function'
                    ? (() => { const ovr = (c.monthlyOverrides || {})[currentMonth]; return ovr !== undefined ? parseFloat(ovr)||0 : monthlyBase; })()
                    : monthlyBase;
                const projMonthShare  = overridedMonthly * (pct / 100);
                const projAnnualShare = totalIndAnnual > 0
                    ? typeof window.icProjectAnnualShare === 'function' ? (() => {
                        let s = 0; for (let m=1;m<=12;m++) { const mk=`${currentYear}-${String(m).padStart(2,'0')}`; const ov=(c.monthlyOverrides||{})[mk]; const base=ov!==undefined?parseFloat(ov)||0:(parseFloat(c.annualAmount)||0)/12; s+=base*(pct/100); } return s; })() : (parseFloat(c.annualAmount)||0)*(pct/100)/100
                    : (parseFloat(c.annualAmount)||0)*(pct/100)/100;
                return `<tr>
                    <td style="font-weight:700;color:#1a3a5c">${c.name||'-'}</td>
                    <td><span style="font-size:11px;background:#f4ecf7;color:#5b2c6f;padding:2px 8px;border-radius:8px">${indCatM[c.category]||c.category||'-'}</span></td>
                    <td style="text-align:center;font-weight:700;color:#8e44ad">${pct}%</td>
                    <td style="font-weight:700;color:#5b2c6f">${fmt(projMonthShare)} ريال</td>
                    <td style="font-weight:600;color:#8e44ad">${fmt(projAnnualShare)} ريال</td>
                </tr>`;
            }).join('')}
            </tbody>
            <tfoot><tr style="background:#f4ecf7;font-weight:800">
                <td colspan="3" style="padding:10px;text-align:right;color:#5b2c6f">إجمالي التكاليف غير المباشرة</td>
                <td style="color:#5b2c6f">${fmt(totalIndMonth)} ريال</td>
                <td style="color:#8e44ad">${fmt(totalIndAnnual)} ريال</td>
            </tr></tfoot>
        </table></div>
    </div>` : ''}

    <!-- المصروفات المباشرة -->
    <div class="card" style="margin-bottom:16px">
        <div class="tlb">
            <div class="c-tl" style="margin:0;border:none;padding:0">💸 المصروفات المباشرة للمشروع</div>
            <button class="btn b-g" onclick="pdOpenExpForm('${pid}')">➕ إضافة مصروف</button>
        </div>
        ${directExp.length === 0 ? '<div class="empty"><div class="ei">💸</div><p>لا توجد مصروفات — أضف مصروفاً جديداً</p></div>' : `
        <div class="tw" style="overflow-x:auto"><table class="st">
            <thead><tr><th>#</th><th>التاريخ</th><th>الوصف</th><th>التصنيف</th><th>المورد</th><th>رقم المستند</th><th>المبلغ</th><th>إجراءات</th></tr></thead>
            <tbody>
            ${directExp.map(([ek, e], i) => `<tr>
                <td style="color:#888">${i + 1}</td>
                <td>${e.date || '-'}</td>
                <td style="font-weight:600">${e.description || '-'}</td>
                <td><span style="background:#f0f5fa;padding:2px 8px;border-radius:8px;font-size:11px">${catMap[e.category] || e.category || '-'}</span></td>
                <td>${e.vendor || '-'}</td>
                <td style="color:#888;font-size:11px">${e.receiptNo || '-'}</td>
                <td style="font-weight:800;color:#e74c3c">${fmt(e.amount)}</td>
                <td><div style="display:flex;gap:4px">
                    <button class="btn b-b" style="padding:3px 7px;font-size:11px" onclick="pdOpenExpForm('${pid}','${ek}')">✏️</button>
                    <button class="btn b-r" style="padding:3px 7px;font-size:11px" onclick="pdDeleteExp('${pid}','${ek}')">🗑️</button>
                </div></td>
            </tr>`).join('')}
            </tbody>
            <tfoot><tr style="background:#fdf0f0;font-weight:800">
                <td colspan="6" style="padding:10px;text-align:right;color:#c0392b">الإجمالي</td>
                <td style="color:#e74c3c">${fmt(totalDirect)}</td><td></td>
            </tr></tfoot>
        </table></div>`}
    </div>

    <!-- مشتريات المواد -->
    ${matCosts.length > 0 ? `
    <div class="card">
        <div class="c-tl">🧱 مشتريات المواد (${matCosts.length} سجل — إجمالي: ${fmt(totalMat)} ريال)</div>
        <div class="tw" style="overflow-x:auto"><table class="st">
            <thead><tr><th>#</th><th>التاريخ</th><th>المادة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
            <tbody>
            ${matCosts.map((pu, i) => {
                const total = (parseFloat(pu.purchasedQty) || 0) * (parseFloat(pu.purchasedUnitPrice) || 0);
                return `<tr>
                    <td style="color:#888">${i + 1}</td>
                    <td>${pu.purchaseDate || pu.createdAt?.substring(0, 10) || '-'}</td>
                    <td style="font-weight:600">${pu.materialName || pu.material?.name || '-'}</td>
                    <td>${parseFloat(pu.purchasedQty || 0).toLocaleString()} ${pu.unit || ''}</td>
                    <td>${fmt(pu.purchasedUnitPrice || 0)}</td>
                    <td style="font-weight:700;color:#e67e22">${fmt(total)}</td>
                </tr>`;
            }).join('')}
            </tbody>
        </table></div>
    </div>` : ''}

    <!-- نموذج إضافة مصروف -->
    <div id="pd-exp-form" style="display:none;background:white;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #e74c3c">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-exp-form-title">➕ إضافة مصروف</div>
        <input type="hidden" id="pd-exp-key">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:14px">
            <div><label style="${lblStyle()}">التاريخ</label><input id="pe-date" type="date" style="${inputStyle()}"></div>
            <div style="grid-column:span 2"><label style="${lblStyle()}">الوصف</label><input id="pe-desc" placeholder="وصف المصروف" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التصنيف</label>
                <select id="pe-cat" style="${inputStyle()}">
                    <option value="materials">🧱 مواد</option><option value="labor">👷 عمالة</option>
                    <option value="equipment">🚜 معدات</option><option value="services">🔧 خدمات</option>
                    <option value="transport">🚛 نقل</option><option value="other">📦 أخرى</option>
                </select></div>
            <div><label style="${lblStyle()}">المورد/الجهة</label><input id="pe-vendor" placeholder="اسم المورد" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">رقم المستند</label><input id="pe-receipt" placeholder="رقم الفاتورة/الإيصال" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">المبلغ (ريال)</label><input id="pe-amount" type="number" min="0" step="0.01" placeholder="0.00" style="${inputStyle()}"></div>
        </div>
        <div style="margin-bottom:12px"><label style="${lblStyle()}">ملاحظات</label>
            <textarea id="pe-notes" rows="2" style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveExp('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-exp-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — الموردون والتوريدات                                              ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function pdRenderSuppliers(pid) {
    const pane = document.getElementById('pd-tab-suppliers'); if (!pane) return;

    const invs = Object.entries(window.supplierInvoices || {})
        .filter(([, inv]) => inv.projectId === pid)
        .sort((a, b) => new Date(b[1].invoiceDate || 0) - new Date(a[1].invoiceDate || 0));

    // سطور قيود اليومية المرتبطة بهذا المشروع + مورد + تصنيف مادة (إدخال يدوي بدون فاتورة مورد)
    const jrnRows = [];
    Object.entries(window.journalEntries || {}).forEach(([jk, je]) => {
        if (je.status === 'cancelled') return;
        (je.lines || []).forEach((l, li) => {
            if (l.projectId !== pid || !l.supplierId || !l.matCategory) return;
            jrnRows.push({
                key: `${jk}-${li}`,
                supplierId: l.supplierId,
                supplierName: (window.sup || {})[l.supplierId]?.name || '-',
                category: l.matCategory,
                invoiceNumber: je.number || '-',
                invoiceDate: l.date || je.date || '-',
                materialName: l.description || '-',
                qty: '', unit: '',
                grandTotal: parseFloat(l.debit) || parseFloat(l.credit) || 0
            });
        });
    });

    const total = invs.reduce((s, [, inv]) => s + (parseFloat(inv.grandTotal) || 0), 0) + jrnRows.reduce((s, r) => s + r.grandTotal, 0);
    const supplierIds = new Set(invs.map(([, inv]) => inv.supplierId));
    jrnRows.forEach(r => supplierIds.add(r.supplierId));
    const supplierCount = supplierIds.size;

    // تجميع حسب التصنيف
    const catGroups = {};
    invs.forEach(([k, inv]) => {
        const mat = (window.materials || {})[inv.materialId] || {};
        const cat = mat.category || 'other';
        if (!catGroups[cat]) catGroups[cat] = { count: 0, total: 0, invs: [] };
        catGroups[cat].count++;
        catGroups[cat].total += parseFloat(inv.grandTotal) || 0;
        catGroups[cat].invs.push({
            supplierName: inv.supplierName || '-', invoiceNumber: inv.invoiceNumber || '-',
            invoiceDate: inv.invoiceDate || '-', materialName: inv.materialName || '-',
            qty: inv.qty || 0, unit: inv.unit || '', grandTotal: inv.grandTotal || 0
        });
    });
    jrnRows.forEach(r => {
        const cat = r.category;
        if (!catGroups[cat]) catGroups[cat] = { count: 0, total: 0, invs: [] };
        catGroups[cat].count++;
        catGroups[cat].total += r.grandTotal;
        catGroups[cat].invs.push(r);
    });

    // تجميع حسب المورد
    const supGroups = {};
    invs.forEach(([k, inv]) => {
        const sid = inv.supplierId || '-';
        if (!supGroups[sid]) supGroups[sid] = { name: inv.supplierName || 'مورد غير معروف', count: 0, total: 0, cats: new Set() };
        supGroups[sid].count++;
        supGroups[sid].total += parseFloat(inv.grandTotal) || 0;
        const mat = (window.materials || {})[inv.materialId] || {};
        supGroups[sid].cats.add(mat.category || 'other');
    });
    jrnRows.forEach(r => {
        const sid = r.supplierId;
        if (!supGroups[sid]) supGroups[sid] = { name: r.supplierName, count: 0, total: 0, cats: new Set() };
        supGroups[sid].count++;
        supGroups[sid].total += r.grandTotal;
        supGroups[sid].cats.add(r.category);
    });

    const MAT_CAT = window.MAT_CATEGORIES || {};
    const catLabel = c => MAT_CAT[c] || '📦 أخرى';

    pane.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px">
        ${kpiCard('🚚', 'موردون مرتبطون', supplierCount, 'مورد', '#2d6a9f')}
        ${kpiCard('🧾', 'عدد الفواتير', invs.length, 'فاتورة', '#16a085')}
        ${kpiCard('💰', 'إجمالي التوريدات', fmt(total), 'ريال', '#c0392b')}
    </div>

    <!-- التوريدات حسب التصنيف -->
    <div class="card" style="margin-bottom:16px">
        <div class="c-tl">📦 التوريدات حسب التصنيف</div>
        ${Object.keys(catGroups).length === 0 ? '<div class="empty"><div class="ei">🚚</div><p>لا توجد فواتير موردين مرتبطة بهذا المشروع</p></div>' : `
        <div class="tw" style="overflow-x:auto"><table class="st">
            <thead><tr><th>التصنيف</th><th>عدد الفواتير</th><th>الإجمالي</th><th></th></tr></thead>
            <tbody>
            ${Object.entries(catGroups).map(([cat, g]) => `
                <tr style="cursor:pointer" onclick="pdToggleSupCat('${pid}','${cat}')">
                    <td style="font-weight:700;color:#1a3a5c">${catLabel(cat)}</td>
                    <td>${g.count}</td>
                    <td style="font-weight:800;color:#16a085">${fmt(g.total)}</td>
                    <td style="text-align:left;color:#2d6a9f;font-size:11px">عرض الموردين والفواتير ▾</td>
                </tr>
                <tr id="pd-supcat-${cat}" style="display:none;background:#f8fafc">
                    <td colspan="4" style="padding:0">
                        <div class="tw" style="overflow-x:auto"><table class="st" style="margin:8px">
                            <thead><tr><th>المورد</th><th>رقم الفاتورة</th><th>التاريخ</th><th>المادة</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
                            <tbody>
                            ${g.invs.map(inv => `<tr>
                                <td style="font-weight:600">${inv.supplierName || '-'}</td>
                                <td>${inv.invoiceNumber || '-'}</td>
                                <td>${inv.invoiceDate || '-'}</td>
                                <td>${inv.materialName || '-'}</td>
                                <td>${inv.qty ? parseFloat(inv.qty).toLocaleString() : ''} ${inv.unit || ''}</td>
                                <td style="font-weight:700;color:#16a085">${fmt(inv.grandTotal || 0)}</td>
                            </tr>`).join('')}
                            </tbody>
                        </table></div>
                    </td>
                </tr>
            `).join('')}
            </tbody>
        </table></div>`}
    </div>

    <!-- التوريدات حسب المورد -->
    ${Object.keys(supGroups).length > 0 ? `
    <div class="card">
        <div class="c-tl">🏢 الموردون المرتبطون بهذا المشروع</div>
        <div class="tw" style="overflow-x:auto"><table class="st">
            <thead><tr><th>المورد</th><th>عدد الفواتير</th><th>التصنيفات</th><th>الإجمالي</th></tr></thead>
            <tbody>
            ${Object.values(supGroups).sort((a, b) => b.total - a.total).map(s => `<tr>
                <td style="font-weight:700;color:#1a3a5c">${s.name}</td>
                <td>${s.count}</td>
                <td>${[...s.cats].map(c => `<span style="font-size:11px;background:#f0f5fa;padding:2px 8px;border-radius:8px;margin-left:4px">${catLabel(c)}</span>`).join('')}</td>
                <td style="font-weight:800;color:#16a085">${fmt(s.total)}</td>
            </tr>`).join('')}
            </tbody>
            <tfoot><tr style="background:#eaf2f8;font-weight:800">
                <td colspan="3" style="text-align:right;padding:10px;color:#1a3a5c">الإجمالي الكلي</td>
                <td style="color:#16a085">${fmt(total)}</td>
            </tr></tfoot>
        </table></div>
    </div>` : ''}`;
}

window.pdToggleSupCat = function (pid, cat) {
    const row = document.getElementById(`pd-supcat-${cat}`);
    if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
};

window.pdOpenExpForm = function (pid, expKey = null) {
    const form = document.getElementById('pd-exp-form'); if (!form) return;
    form.style.display = '';
    document.getElementById('pd-exp-key').value = expKey || '';
    document.getElementById('pd-exp-form-title').textContent = expKey ? '✏️ تعديل مصروف' : '➕ إضافة مصروف';
    if (expKey) {
        const e = (window.projectExpenses || {})[pid]?.[expKey];
        if (e) {
            document.getElementById('pe-date').value = e.date || '';
            document.getElementById('pe-desc').value = e.description || '';
            document.getElementById('pe-cat').value = e.category || 'other';
            document.getElementById('pe-vendor').value = e.vendor || '';
            document.getElementById('pe-receipt').value = e.receiptNo || '';
            document.getElementById('pe-amount').value = e.amount || '';
            document.getElementById('pe-notes').value = e.notes || '';
        }
    } else {
        document.getElementById('pe-date').value = new Date().toISOString().split('T')[0];
        ['pe-desc','pe-vendor','pe-receipt','pe-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        document.getElementById('pe-amount').value = '';
        document.getElementById('pe-cat').value = 'materials';
    }
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSaveExp = async function (pid) {
    const desc = document.getElementById('pe-desc')?.value.trim();
    const amount = parseFloat(document.getElementById('pe-amount')?.value) || 0;
    const date = document.getElementById('pe-date')?.value;
    if (!desc) { toast('أدخل وصف المصروف', 'er'); return; }
    if (!amount || amount <= 0) { toast('أدخل مبلغاً صحيحاً', 'er'); return; }
    const data = {
        date: date || new Date().toISOString().split('T')[0],
        description: desc,
        category: document.getElementById('pe-cat')?.value || 'other',
        vendor: document.getElementById('pe-vendor')?.value.trim() || '',
        receiptNo: document.getElementById('pe-receipt')?.value.trim() || '',
        amount,
        notes: document.getElementById('pe-notes')?.value.trim() || '',
        updatedAt: new Date().toISOString()
    };
    const expKey = document.getElementById('pd-exp-key')?.value;
    try {
        if (expKey) {
            await update(ref(db, `ledger/projectExpenses/${pid}/${expKey}`), data);
            pdLogActivity(pid, '✏️', `تعديل مصروف: ${desc} (${fmt(amount)})`);
            toast('تم التحديث ✓', 'ok');
        } else {
            data.createdAt = new Date().toISOString();
            data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/projectExpenses/${pid}`), data);
            pdLogActivity(pid, '💸', `مصروف جديد: ${desc} (${fmt(amount)})`);
            toast('تم الإضافة ✓', 'ok');
        }
        document.getElementById('pd-exp-form').style.display = 'none';
        setTimeout(() => pdRenderTab('expenses'), 500);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.pdDeleteExp = function (pid, expKey) {
    const exp = (window.projectExpenses || {})[pid]?.[expKey];
    cf2('هل تريد حذف هذا المصروف؟', async () => {
        try {
            await remove(ref(db, `ledger/projectExpenses/${pid}/${expKey}`));
            pdLogActivity(pid, '🗑️', `حذف مصروف: ${exp?.description || ''}`);
            toast('تم الحذف', 'ok');
            setTimeout(() => pdRenderTab('expenses'), 400);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB 5 — الرواتب                                                         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function pdRenderPayroll(pid) {
    const pane = document.getElementById('pd-tab-payroll'); if (!pane) return;
    const p = (window.projects || {})[pid]; if (!p) return;

    const projEmps = Object.entries(window.emp || {}).filter(([, e]) => e.projectId === pid || (e.affiliationType === 'project' && e.projectId === pid));
    const assignedEmps = Object.values(window.projEmpAssignments || {}).filter(a => a.projectId === pid).map(a => a.empId).filter(Boolean);
    const allProjEmpIds = new Set([...projEmps.map(([k]) => k), ...assignedEmps]);

    const projPayrolls = Object.entries(window.payrolls || {})
        .filter(([, pr]) => pr.projectId === pid || allProjEmpIds.has(pr.employeeId))
        .sort((a, b) => (b[1].month || '').localeCompare(a[1].month || ''));

    const totalPaid = projPayrolls.filter(([, pr]) => pr.status === 'paid').reduce((s, [, pr]) => s + (parseFloat(pr.netSalary) || 0), 0);
    const totalPending = projPayrolls.filter(([, pr]) => pr.status !== 'paid').reduce((s, [, pr]) => s + (parseFloat(pr.netSalary) || 0), 0);

    const empSalaryMap = {};
    projPayrolls.forEach(([, pr]) => {
        if (!empSalaryMap[pr.employeeId]) empSalaryMap[pr.employeeId] = 0;
        empSalaryMap[pr.employeeId] += parseFloat(pr.netSalary) || 0;
    });

    pane.innerHTML = `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px">
        ${kpiCard('👷', 'عدد الموظفين', allProjEmpIds.size.toString(), 'موظف في المشروع', '#2d6a9f')}
        ${kpiCard('💵', 'إجمالي الرواتب المدفوعة', fmt(totalPaid), 'ريال', '#27ae60')}
        ${kpiCard('⏳', 'إجمالي الرواتب المعلّقة', fmt(totalPending), 'ريال', '#e67e22')}
        ${kpiCard('📊', 'إجمالي تكلفة العمالة', fmt(totalPaid + totalPending), 'ريال', '#8e44ad')}
    </div>

    <!-- موظفو المشروع -->
    ${allProjEmpIds.size > 0 ? `
    <div class="card" style="margin-bottom:16px">
        <div class="c-tl">👷 موظفو المشروع</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:12px">
        ${[...allProjEmpIds].map(empId => {
            const e = (window.emp || {})[empId]; if (!e) return '';
            const total = empSalaryMap[empId] || 0;
            if (typeof empFinance === 'function') {
                const f = empFinance(e);
                return `<div style="background:#f8fafc;border:1px solid #e0e8f0;border-radius:10px;padding:12px">
                    <div style="font-weight:700;color:#1a3a5c;font-size:13px;margin-bottom:4px">${e.name}</div>
                    <div style="font-size:11px;color:#666;margin-bottom:6px">${e.job || '-'}</div>
                    <div style="display:flex;justify-content:space-between;font-size:12px">
                        <span style="color:#555">الراتب الشهري</span><span style="font-weight:700;color:#27ae60">${fmt(f.netSalary)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:3px">
                        <span style="color:#555">إجمالي من المسيرات</span><span style="font-weight:700;color:#2d6a9f">${fmt(total)}</span>
                    </div>
                </div>`;
            }
            return `<div style="background:#f8fafc;border:1px solid #e0e8f0;border-radius:10px;padding:12px">
                <div style="font-weight:700;color:#1a3a5c">${e.name}</div>
                <div style="font-size:11px;color:#666">${e.job || '-'}</div>
                <div style="font-size:12px;margin-top:4px">إجمالي: <strong>${fmt(total)} ريال</strong></div>
            </div>`;
        }).join('')}
        </div>
    </div>` : `<div class="card"><div class="empty"><div class="ei">👷</div><p>لا يوجد موظفون مرتبطون بهذا المشروع</p><button class="btn b-b" onclick="openPrjM('${pid}')">ربط موظفين بالمشروع</button></div></div>`}

    <!-- سجل المسيرات -->
    ${projPayrolls.length > 0 ? `
    <div class="card">
        <div class="c-tl">📋 سجل مسيرات الرواتب المرتبطة بالمشروع (${projPayrolls.length} مسير)</div>
        <div class="tw" style="overflow-x:auto;margin-top:12px"><table class="st">
            <thead><tr><th>#</th><th>الموظف</th><th>الشهر</th><th>الراتب الإجمالي</th><th>الخصومات</th><th>الراتب الصافي</th><th>تكلفة الشركة</th><th>الحالة</th></tr></thead>
            <tbody>
            ${projPayrolls.map(([pk, pr], i) => {
                const e = (window.emp || {})[pr.employeeId];
                const statusM = { paid: ['مدفوع', '#d4edda', '#155724'], draft: ['مسودة', '#fff3cd', '#664d03'], approved: ['موافق', '#cfe2ff', '#084298'] };
                const [sl, sbg, scl] = statusM[pr.status] || ['غير محدد', '#f8f9fa', '#333'];
                return `<tr>
                    <td style="color:#888">${i + 1}</td>
                    <td style="font-weight:600">${e?.name || pr.employeeName || '-'}</td>
                    <td style="font-weight:700;color:#2d6a9f">${pr.month || '-'}</td>
                    <td>${fmt(pr.grossSalary || 0)}</td>
                    <td style="color:#e74c3c">${parseFloat(pr.totalDeductions || 0) > 0 ? '(' + fmt(pr.totalDeductions) + ')' : '-'}</td>
                    <td style="font-weight:800;color:#27ae60">${fmt(pr.netSalary || 0)}</td>
                    <td style="color:#e67e22">${fmt(pr.totalCost || pr.grossSalary || 0)}</td>
                    <td><span style="background:${sbg};color:${scl};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">${sl}</span></td>
                </tr>`;
            }).join('')}
            </tbody>
        </table></div>
    </div>` : ''}`;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB 6 — ملاحظات                                                         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function pdRenderNotes(pid) {
    const pane = document.getElementById('pd-tab-notes'); if (!pane) return;
    const notes = Object.entries((window.projectNotes || {})[pid] || {})
        .sort((a, b) => new Date(b[1].createdAt || 0) - new Date(a[1].createdAt || 0));

    const typeMap = { general: ['📝 عام', '#e8f4fd', '#1a5276'], risk: ['⚠️ مخاطرة', '#fef9e7', '#7d6608'], issue: ['🚨 مشكلة', '#fdedec', '#922b21'], decision: ['✅ قرار', '#eafaf1', '#1e8449'] };

    pane.innerHTML = `
    <div class="card">
        <div class="tlb">
            <div class="c-tl" style="margin:0;border:none;padding:0">📝 ملاحظات ومستجدات المشروع</div>
            <button class="btn b-g" onclick="pdOpenNoteForm('${pid}')">➕ إضافة ملاحظة</button>
        </div>

        ${notes.length === 0 ? '<div class="empty"><div class="ei">📝</div><p>لا توجد ملاحظات — أضف أول ملاحظة</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
        ${notes.map(([nk, n]) => {
            const [tl, tbg, tcl] = typeMap[n.type] || typeMap.general;
            const date = n.createdAt ? new Date(n.createdAt).toLocaleDateString('ar-SA') : '-';
            return `<div style="background:${tbg};border:1px solid ${tcl}44;border-radius:10px;padding:14px;border-right:4px solid ${tcl}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="background:${tcl}22;color:${tcl};padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700">${tl}</span>
                        <span style="font-size:14px;font-weight:800;color:#1a3a5c">${n.title || 'ملاحظة'}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px">
                        <span style="font-size:11px;color:#888">${date}</span>
                        <button class="btn b-b" style="padding:3px 7px;font-size:11px" onclick="pdOpenNoteForm('${pid}','${nk}')">✏️</button>
                        <button class="btn b-r" style="padding:3px 7px;font-size:11px" onclick="pdDeleteNote('${pid}','${nk}')">🗑️</button>
                    </div>
                </div>
                <div style="font-size:13px;color:#333;line-height:1.7">${(n.body || '').replace(/\n/g, '<br>')}</div>
            </div>`;
        }).join('')}
        </div>`}
    </div>

    <!-- نموذج الملاحظة -->
    <div id="pd-note-form" style="display:none;background:white;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #27ae60">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-note-form-title">📝 إضافة ملاحظة</div>
        <input type="hidden" id="pd-note-key">
        <div style="display:grid;grid-template-columns:1fr 200px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">عنوان الملاحظة</label><input id="pn-title" placeholder="موضوع الملاحظة" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">النوع</label>
                <select id="pn-type" style="${inputStyle()}">
                    <option value="general">📝 عام</option><option value="decision">✅ قرار</option>
                    <option value="issue">🚨 مشكلة</option><option value="risk">⚠️ مخاطرة</option>
                </select></div>
        </div>
        <div style="margin-bottom:12px"><label style="${lblStyle()}">نص الملاحظة</label>
            <textarea id="pn-body" rows="4" placeholder="اكتب تفاصيل الملاحظة هنا..." style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveNote('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-note-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}

window.pdOpenNoteForm = function (pid, noteKey = null) {
    const form = document.getElementById('pd-note-form'); if (!form) return;
    form.style.display = '';
    document.getElementById('pd-note-key').value = noteKey || '';
    document.getElementById('pd-note-form-title').textContent = noteKey ? '✏️ تعديل ملاحظة' : '📝 إضافة ملاحظة';
    if (noteKey) {
        const n = (window.projectNotes || {})[pid]?.[noteKey];
        if (n) {
            document.getElementById('pn-title').value = n.title || '';
            document.getElementById('pn-type').value = n.type || 'general';
            document.getElementById('pn-body').value = n.body || '';
        }
    } else {
        document.getElementById('pn-title').value = '';
        document.getElementById('pn-type').value = 'general';
        document.getElementById('pn-body').value = '';
    }
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSaveNote = async function (pid) {
    const title = document.getElementById('pn-title')?.value.trim();
    const body = document.getElementById('pn-body')?.value.trim();
    if (!title) { toast('أدخل عنوان الملاحظة', 'er'); return; }
    if (!body) { toast('أدخل نص الملاحظة', 'er'); return; }
    const data = {
        title, body,
        type: document.getElementById('pn-type')?.value || 'general',
        updatedAt: new Date().toISOString()
    };
    const noteKey = document.getElementById('pd-note-key')?.value;
    try {
        if (noteKey) {
            await update(ref(db, `ledger/projectNotes/${pid}/${noteKey}`), data);
            toast('تم التحديث ✓', 'ok');
        } else {
            data.createdAt = new Date().toISOString();
            data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/projectNotes/${pid}`), data);
            toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-note-form').style.display = 'none';
        setTimeout(() => pdRenderTab('notes'), 500);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.pdDeleteNote = function (pid, noteKey) {
    cf2('هل تريد حذف هذه الملاحظة؟', async () => {
        try {
            await remove(ref(db, `ledger/projectNotes/${pid}/${noteKey}`));
            toast('تم الحذف', 'ok');
            setTimeout(() => pdRenderTab('notes'), 400);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — 📨 طلبات المعلومات (RFIs) + 🔧 قوائم النواقص (Punch Lists)          ║
// ║   تعاون ميداني بأسلوب Procore — بيانات فقط (روابط، بلا رفع ملفات).          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const PD_PRIORITY = { low: ['منخفضة', '#7f8c8d'], normal: ['عادية', '#2980b9'], high: ['عالية', '#e67e22'], urgent: ['عاجلة', '#c0392b'] };
const PD_RFI_STATUS = { open: ['🟠 مفتوح', '#e67e22', '#fef5e7'], answered: ['🔵 تمّت الإجابة', '#2980b9', '#eaf2fb'], closed: ['🟢 مغلق', '#27ae60', '#eafaf1'] };
const PD_PUNCH_STATUS = { open: ['🔴 مفتوح', '#c0392b', '#fdecea'], in_progress: ['🟠 قيد المعالجة', '#e67e22', '#fef5e7'], ready: ['🔵 جاهز للفحص', '#2980b9', '#eaf2fb'], closed: ['🟢 مغلق', '#27ae60', '#eafaf1'] };

// ترقيم تلقائي متسلسل (RFI-001 / PL-001) من أعلى رقم موجود
function pdNextNum(prefix, obj) {
    let mx = 0;
    Object.values(obj || {}).forEach(x => { const m = /(\d+)\s*$/.exec(x.number || ''); if (m) mx = Math.max(mx, +m[1]); });
    return `${prefix}-${String(mx + 1).padStart(3, '0')}`;
}
function pdFiStat(label, val, color) {
    return `<div style="flex:1;min-width:104px;background:white;border-radius:10px;padding:12px 14px;box-shadow:0 2px 6px rgba(0,0,0,.05);border-bottom:3px solid ${color}"><div style="font-size:22px;font-weight:900;color:${color}">${val}</div><div style="font-size:11px;color:#888;font-weight:600;margin-top:2px">${label}</div></div>`;
}
function pdFiltChip(cur, val, label, fn) {
    const a = cur === val;
    return `<button onclick="${fn}('${val}')" style="padding:6px 12px;border:1px solid ${a ? '#2d6a9f' : '#d0d7e0'};background:${a ? '#2d6a9f' : '#fff'};color:${a ? '#fff' : '#555'};border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">${label}</button>`;
}

// ── 📨 طلبات المعلومات ─────────────────────────────────────────────
window._pdRfiFilter = window._pdRfiFilter || 'all';
window.pdSetRfiFilter = function (f) { window._pdRfiFilter = f; pdRenderRFIs(window._pd.projectId); };

function pdRenderRFIs(pid) {
    const pane = document.getElementById('pd-tab-rfis'); if (!pane) return;
    const all = Object.entries((window.rfis || {})[pid] || {}).sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));
    const today = new Date().toISOString().slice(0, 10);
    const isOv = r => r.status === 'open' && r.dueDate && r.dueDate < today;
    let cOpen = 0, cOv = 0, cAns = 0;
    all.forEach(([, r]) => { if (r.status === 'open') cOpen++; if (isOv(r)) cOv++; if (r.status === 'answered') cAns++; });
    const flt = window._pdRfiFilter;
    const shown = all.filter(([, r]) => flt === 'all' ? true : flt === 'overdue' ? isOv(r) : r.status === flt);
    pane.innerHTML = `
    <div class="card">
        <div class="tlb"><div class="c-tl" style="margin:0;border:none;padding:0">📨 طلبات المعلومات (RFIs)</div>
            <button class="btn b-g" onclick="pdOpenRfiForm('${pid}')">➕ طلب معلومات جديد</button></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
            ${pdFiStat('الإجمالي', all.length, '#2d6a9f')}${pdFiStat('مفتوحة', cOpen, '#e67e22')}${pdFiStat('متأخرة', cOv, '#c0392b')}${pdFiStat('تمّت الإجابة', cAns, '#27ae60')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${pdFiltChip(flt, 'all', 'الكل', 'pdSetRfiFilter')}${pdFiltChip(flt, 'open', 'مفتوحة', 'pdSetRfiFilter')}${pdFiltChip(flt, 'overdue', '⏰ متأخرة', 'pdSetRfiFilter')}${pdFiltChip(flt, 'answered', 'تمّت الإجابة', 'pdSetRfiFilter')}${pdFiltChip(flt, 'closed', 'مغلقة', 'pdSetRfiFilter')}
        </div>
        ${shown.length === 0 ? '<div class="empty"><div class="ei">📨</div><p>لا توجد طلبات معلومات في هذا التصنيف</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
        ${shown.map(([k, r]) => {
        const [sl, sc, sbg] = PD_RFI_STATUS[r.status] || PD_RFI_STATUS.open;
        const [pl, pc] = PD_PRIORITY[r.priority] || PD_PRIORITY.normal;
        const ov = isOv(r);
        return `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:10px;padding:14px;border-right:4px solid ${ov ? '#c0392b' : sc}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-family:monospace;font-weight:800;color:#1a3a5c;background:#eef3f8;padding:2px 8px;border-radius:6px">${r.number || ''}</span>
                        <span style="font-size:14px;font-weight:800;color:#1a3a5c">${r.subject || '—'}</span>
                        <span style="background:${sbg};color:${sc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${sl}</span>
                        <span style="background:${pc}22;color:${pc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${pl}</span>
                        ${ov ? '<span style="background:#fdecea;color:#c0392b;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:800">⏰ متأخر</span>' : ''}
                    </div>
                    <div style="display:flex;gap:6px">
                        ${r.status !== 'closed' ? `<button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="pdOpenRfiForm('${pid}','${k}')">✏️ رد/تعديل</button>` : `<button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="pdOpenRfiForm('${pid}','${k}')">👁️</button>`}
                        ${r.status !== 'closed' ? `<button class="btn" style="padding:3px 8px;font-size:11px;background:#eafaf1;color:#1e8449;border:1px solid #a9dfbf" onclick="pdCloseRfi('${pid}','${k}')">✅ إغلاق</button>` : ''}
                        <button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="pdDeleteRfi('${pid}','${k}')">🗑️</button>
                    </div>
                </div>
                ${r.question ? `<div style="font-size:12.5px;color:#444;margin-top:8px;line-height:1.7">${r.question.replace(/\n/g, '<br>')}</div>` : ''}
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#888;margin-top:8px">
                    ${r.discipline ? `<span>🏷️ ${r.discipline}</span>` : ''}${r.submittedTo ? `<span>👤 موجّه إلى: ${r.submittedTo}</span>` : ''}${r.dueDate ? `<span style="color:${ov ? '#c0392b' : '#888'}">📅 الاستحقاق: ${r.dueDate}</span>` : ''}
                </div>
                ${r.answer ? `<div style="background:#f2f8fd;border-radius:8px;padding:10px;margin-top:10px;border-right:3px solid #2980b9"><div style="font-size:11px;font-weight:800;color:#2980b9;margin-bottom:3px">💬 الرد${r.answeredBy ? ` — ${r.answeredBy}` : ''}${r.answeredDate ? ` (${r.answeredDate})` : ''}</div><div style="font-size:12.5px;color:#333;line-height:1.7">${r.answer.replace(/\n/g, '<br>')}</div></div>` : ''}
            </div>`;
    }).join('')}
        </div>`}
    </div>
    ${pdRfiFormHtml(pid)}`;
}

function pdRfiFormHtml(pid) {
    const disc = ['معماري', 'إنشائي', 'كهرباء', 'ميكانيكا', 'صحي', 'تكييف', 'مدني', 'أخرى'];
    return `<div id="pd-rfi-form" style="display:none;background:#fff;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #2d6a9f">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-rfi-form-title">📨 طلب معلومات جديد</div>
        <input type="hidden" id="pd-rfi-key">
        <div style="display:grid;grid-template-columns:1fr 150px 140px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">الموضوع *</label><input id="rfi-subject" placeholder="موضوع الاستفسار" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التخصص</label><select id="rfi-discipline" style="${inputStyle()}">${disc.map(d => `<option>${d}</option>`).join('')}</select></div>
            <div><label style="${lblStyle()}">الأولوية</label><select id="rfi-priority" style="${inputStyle()}"><option value="normal">عادية</option><option value="high">عالية</option><option value="urgent">عاجلة</option><option value="low">منخفضة</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 200px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">مُوجّه إلى</label><input id="rfi-to" placeholder="الاستشاري / المالك / ..." style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">تاريخ الاستحقاق</label><input type="date" id="rfi-due" style="${inputStyle()}"></div>
        </div>
        <div style="margin-bottom:12px"><label style="${lblStyle()}">تفاصيل الاستفسار</label><textarea id="rfi-question" rows="3" placeholder="اشرح الاستفسار بالتفصيل..." style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="border-top:1px dashed #d0d7e0;padding-top:12px;margin-bottom:12px">
            <div style="font-size:12px;font-weight:800;color:#2980b9;margin-bottom:8px">💬 الرد والحالة</div>
            <div style="display:grid;grid-template-columns:150px 1fr 150px;gap:10px;margin-bottom:10px">
                <div><label style="${lblStyle()}">الحالة</label><select id="rfi-status" style="${inputStyle()}"><option value="open">🟠 مفتوح</option><option value="answered">🔵 تمّت الإجابة</option><option value="closed">🟢 مغلق</option></select></div>
                <div><label style="${lblStyle()}">المُجيب</label><input id="rfi-answeredby" placeholder="اسم من ردّ" style="${inputStyle()}"></div>
                <div><label style="${lblStyle()}">تاريخ الرد</label><input type="date" id="rfi-answereddate" style="${inputStyle()}"></div>
            </div>
            <div><label style="${lblStyle()}">نص الرد</label><textarea id="rfi-answer" rows="2" placeholder="الرد على الاستفسار..." style="${inputStyle('resize:vertical')}"></textarea></div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveRfi('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-rfi-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}

window.pdOpenRfiForm = function (pid, key = null) {
    const form = document.getElementById('pd-rfi-form'); if (!form) return;
    form.style.display = ''; document.getElementById('pd-rfi-key').value = key || '';
    document.getElementById('pd-rfi-form-title').textContent = key ? '✏️ تعديل / رد على الطلب' : '📨 طلب معلومات جديد';
    const r = key ? ((window.rfis || {})[pid] || {})[key] : null;
    document.getElementById('rfi-subject').value = r?.subject || '';
    document.getElementById('rfi-discipline').value = r?.discipline || 'معماري';
    document.getElementById('rfi-priority').value = r?.priority || 'normal';
    document.getElementById('rfi-to').value = r?.submittedTo || '';
    document.getElementById('rfi-due').value = r?.dueDate || '';
    document.getElementById('rfi-question').value = r?.question || '';
    document.getElementById('rfi-status').value = r?.status || 'open';
    document.getElementById('rfi-answeredby').value = r?.answeredBy || '';
    document.getElementById('rfi-answereddate').value = r?.answeredDate || '';
    document.getElementById('rfi-answer').value = r?.answer || '';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSaveRfi = async function (pid) {
    const subject = document.getElementById('rfi-subject')?.value.trim();
    if (!subject) { toast('أدخل موضوع الطلب', 'er'); return; }
    const key = document.getElementById('pd-rfi-key')?.value;
    const status = document.getElementById('rfi-status')?.value || 'open';
    const answer = document.getElementById('rfi-answer')?.value.trim();
    let answeredDate = document.getElementById('rfi-answereddate')?.value || '';
    if ((status === 'answered' || status === 'closed') && answer && !answeredDate) answeredDate = new Date().toISOString().slice(0, 10);
    const data = {
        subject, discipline: document.getElementById('rfi-discipline')?.value || '',
        priority: document.getElementById('rfi-priority')?.value || 'normal',
        submittedTo: document.getElementById('rfi-to')?.value.trim() || '',
        dueDate: document.getElementById('rfi-due')?.value || '',
        question: document.getElementById('rfi-question')?.value.trim() || '',
        status, answer: answer || '',
        answeredBy: document.getElementById('rfi-answeredby')?.value.trim() || '',
        answeredDate, updatedAt: new Date().toISOString()
    };
    try {
        if (key) { await update(ref(db, `ledger/rfis/${pid}/${key}`), data); toast('تم التحديث ✓', 'ok'); }
        else {
            data.number = pdNextNum('RFI', (window.rfis || {})[pid]);
            data.createdAt = new Date().toISOString(); data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/rfis/${pid}`), data); toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-rfi-form').style.display = 'none';
        setTimeout(() => pdRenderTab('rfis'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};
window.pdCloseRfi = function (pid, key) {
    cf2('إغلاق طلب المعلومات هذا؟', async () => {
        try { await update(ref(db, `ledger/rfis/${pid}/${key}`), { status: 'closed', updatedAt: new Date().toISOString() }); toast('تم الإغلاق', 'ok'); setTimeout(() => pdRenderTab('rfis'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};
window.pdDeleteRfi = function (pid, key) {
    cf2('حذف طلب المعلومات نهائياً؟', async () => {
        try { await remove(ref(db, `ledger/rfis/${pid}/${key}`)); toast('تم الحذف', 'ok'); setTimeout(() => pdRenderTab('rfis'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — 📝 الاجتماعات والمحاضر (Meetings & Minutes)                         ║
// ║   محاضر بترقيم MIN-001 + بنود قرارات (مسؤول/مهلة/إنجاز) + تنبيه تأخّر.        ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const PD_MTG_STATUS = { open: ['🟠 متابعة مفتوحة', '#e67e22', '#fef5e7'], closed: ['🟢 مغلق', '#27ae60', '#eafaf1'] };
const PD_MTG_TYPES = { kickoff: 'اجتماع افتتاحي', progress: 'اجتماع تقدّم', coordination: 'اجتماع تنسيق', site: 'اجتماع موقع', client: 'اجتماع مع العميل', other: 'أخرى' };

window._pdMtgFilter = window._pdMtgFilter || 'all';
window.pdSetMtgFilter = function (f) { window._pdMtgFilter = f; pdRenderMeetings(window._pd.projectId); };

// اجتماع "متأخّر" = فيه بند قرار غير منجز تجاوز مهلته
function pdMtgIsOv(r) {
    const today = new Date().toISOString().slice(0, 10);
    return r.status !== 'closed' && Array.isArray(r.actions) && r.actions.some(a => a && !a.done && a.dueDate && a.dueDate < today);
}

function pdRenderMeetings(pid) {
    const pane = document.getElementById('pd-tab-meetings'); if (!pane) return;
    const all = Object.entries((window.meetings || {})[pid] || {}).sort((a, b) => (b[1].meetingDate || b[1].createdAt || '').localeCompare(a[1].meetingDate || a[1].createdAt || ''));
    const today = new Date().toISOString().slice(0, 10);
    let cOpen = 0, cOv = 0, cAct = 0;
    all.forEach(([, r]) => {
        if (r.status !== 'closed') cOpen++;
        if (pdMtgIsOv(r)) cOv++;
        if (Array.isArray(r.actions)) cAct += r.actions.filter(a => a && !a.done).length;
    });
    const flt = window._pdMtgFilter;
    const shown = all.filter(([, r]) => flt === 'all' ? true : flt === 'overdue' ? pdMtgIsOv(r) : flt === 'open' ? r.status !== 'closed' : r.status === flt);
    pane.innerHTML = `
    <div class="card">
        <div class="tlb"><div class="c-tl" style="margin:0;border:none;padding:0">📝 الاجتماعات والمحاضر</div>
            <button class="btn b-g" onclick="pdOpenMtgForm('${pid}')">➕ محضر اجتماع جديد</button></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
            ${pdFiStat('الإجمالي', all.length, '#2d6a9f')}${pdFiStat('متابعة مفتوحة', cOpen, '#e67e22')}${pdFiStat('بنود متأخرة', cOv, '#c0392b')}${pdFiStat('قرارات معلّقة', cAct, '#8e44ad')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${pdFiltChip(flt, 'all', 'الكل', 'pdSetMtgFilter')}${pdFiltChip(flt, 'open', 'متابعة مفتوحة', 'pdSetMtgFilter')}${pdFiltChip(flt, 'overdue', '⏰ متأخرة', 'pdSetMtgFilter')}${pdFiltChip(flt, 'closed', 'مغلقة', 'pdSetMtgFilter')}
        </div>
        ${shown.length === 0 ? '<div class="empty"><div class="ei">📝</div><p>لا توجد محاضر اجتماعات في هذا التصنيف</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
        ${shown.map(([k, r]) => {
        const [sl, sc, sbg] = PD_MTG_STATUS[r.status] || PD_MTG_STATUS.open;
        const ov = pdMtgIsOv(r);
        const acts = Array.isArray(r.actions) ? r.actions : [];
        return `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:10px;padding:14px;border-right:4px solid ${ov ? '#c0392b' : sc}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-family:monospace;font-weight:800;color:#1a3a5c;background:#eef3f8;padding:2px 8px;border-radius:6px">${r.number || ''}</span>
                        <span style="font-size:14px;font-weight:800;color:#1a3a5c">${r.title || '—'}</span>
                        <span style="background:${sbg};color:${sc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${sl}</span>
                        ${r.meetingType ? `<span style="background:#eef3f8;color:#2d6a9f;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${PD_MTG_TYPES[r.meetingType] || r.meetingType}</span>` : ''}
                        ${ov ? '<span style="background:#fdecea;color:#c0392b;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:800">⏰ بند متأخر</span>' : ''}
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="pdOpenMtgForm('${pid}','${k}')">${r.status !== 'closed' ? '✏️ تعديل' : '👁️'}</button>
                        ${r.status !== 'closed' ? `<button class="btn" style="padding:3px 8px;font-size:11px;background:#eafaf1;color:#1e8449;border:1px solid #a9dfbf" onclick="pdCloseMtg('${pid}','${k}')">✅ إغلاق</button>` : ''}
                        <button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="pdDeleteMtg('${pid}','${k}')">🗑️</button>
                    </div>
                </div>
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#888;margin-top:8px">
                    ${r.meetingDate ? `<span>📅 ${r.meetingDate}</span>` : ''}${r.location ? `<span>📍 ${r.location}</span>` : ''}${r.attendees ? `<span>👥 ${r.attendees}</span>` : ''}${r.nextMeetingDate ? `<span>🔜 القادم: ${r.nextMeetingDate}</span>` : ''}
                </div>
                ${r.discussion ? `<div style="font-size:12.5px;color:#444;margin-top:8px;line-height:1.7">${r.discussion.replace(/\n/g, '<br>')}</div>` : ''}
                ${acts.length ? `<div style="margin-top:10px;border-top:1px dashed #e0e6ec;padding-top:8px">
                    <div style="font-size:11px;font-weight:800;color:#8e44ad;margin-bottom:6px">✅ بنود القرارات والمتابعة (${acts.filter(a => a && a.done).length}/${acts.length})</div>
                    ${acts.map(a => { const aov = a && !a.done && a.dueDate && a.dueDate < today; return `<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;padding:3px 0"><span>${a.done ? '✅' : (aov ? '🔴' : '⬜')}</span><span style="flex:1;color:${a.done ? '#999' : '#333'};${a.done ? 'text-decoration:line-through' : ''}">${a.text || '—'}</span>${a.owner ? `<span style="color:#2980b9;font-weight:700">👤 ${a.owner}</span>` : ''}${a.dueDate ? `<span style="color:${aov ? '#c0392b' : '#888'}">📅 ${a.dueDate}</span>` : ''}</div>`; }).join('')}
                </div>` : ''}
            </div>`;
    }).join('')}
        </div>`}
    </div>
    ${pdMtgFormHtml(pid)}`;
}

// ── بنود القرارات: قائمة ديناميكية داخل النموذج ──────────────────────
window._pdMtgActions = window._pdMtgActions || [];
function pdMtgActionRowsHtml() {
    const acts = window._pdMtgActions || [];
    if (!acts.length) return '<div style="font-size:11px;color:#aaa;padding:6px 0">لا توجد بنود بعد — اضغط «➕ بند قرار».</div>';
    return acts.map((a, i) => `<div class="mtg-action-row" style="display:grid;grid-template-columns:1fr 140px 140px 30px 34px;gap:6px;margin-bottom:6px;align-items:center">
        <input class="mtg-a-text" value="${(a.text || '').replace(/"/g, '&quot;')}" placeholder="نص القرار / الإجراء" style="${inputStyle()}">
        <input class="mtg-a-owner" value="${(a.owner || '').replace(/"/g, '&quot;')}" placeholder="المسؤول" style="${inputStyle()}">
        <input type="date" class="mtg-a-due" value="${a.dueDate || ''}" style="${inputStyle()}">
        <label style="display:flex;align-items:center;justify-content:center;cursor:pointer" title="منجز"><input type="checkbox" class="mtg-a-done" ${a.done ? 'checked' : ''}></label>
        <button class="btn b-r" style="padding:4px 6px;font-size:11px" onclick="pdMtgDelAction(${i})">🗑️</button>
    </div>`).join('');
}
function pdMtgReadActions() {
    const arr = [];
    document.querySelectorAll('#pd-mtg-actions .mtg-action-row').forEach(row => {
        arr.push({
            text: (row.querySelector('.mtg-a-text')?.value || '').trim(),
            owner: (row.querySelector('.mtg-a-owner')?.value || '').trim(),
            dueDate: row.querySelector('.mtg-a-due')?.value || '',
            done: !!row.querySelector('.mtg-a-done')?.checked
        });
    });
    return arr;
}
window.pdMtgAddAction = function () {
    window._pdMtgActions = pdMtgReadActions();
    window._pdMtgActions.push({ text: '', owner: '', dueDate: '', done: false });
    const box = document.getElementById('pd-mtg-actions'); if (box) box.innerHTML = pdMtgActionRowsHtml();
};
window.pdMtgDelAction = function (i) {
    window._pdMtgActions = pdMtgReadActions();
    window._pdMtgActions.splice(i, 1);
    const box = document.getElementById('pd-mtg-actions'); if (box) box.innerHTML = pdMtgActionRowsHtml();
};

function pdMtgFormHtml(pid) {
    return `<div id="pd-mtg-form" style="display:none;background:#fff;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #2d6a9f">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-mtg-form-title">📝 محضر اجتماع جديد</div>
        <input type="hidden" id="pd-mtg-key">
        <div style="display:grid;grid-template-columns:1fr 160px 150px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">عنوان الاجتماع *</label><input id="mtg-title" placeholder="مثال: اجتماع تنسيق أسبوعي" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">نوع الاجتماع</label><select id="mtg-type" style="${inputStyle()}">${Object.entries(PD_MTG_TYPES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
            <div><label style="${lblStyle()}">تاريخ الاجتماع</label><input type="date" id="mtg-date" style="${inputStyle()}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 180px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">المكان</label><input id="mtg-location" placeholder="الموقع / قاعة الاجتماعات / عن بُعد" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الاجتماع القادم</label><input type="date" id="mtg-next" style="${inputStyle()}"></div>
        </div>
        <div style="margin-bottom:10px"><label style="${lblStyle()}">الحضور</label><input id="mtg-attendees" placeholder="أسماء الحاضرين، مفصولة بفواصل" style="${inputStyle()}"></div>
        <div style="margin-bottom:12px"><label style="${lblStyle()}">جدول الأعمال / المناقشات</label><textarea id="mtg-discussion" rows="3" placeholder="أبرز نقاط النقاش..." style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="border-top:1px dashed #d0d7e0;padding-top:12px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="font-size:12px;font-weight:800;color:#8e44ad">✅ بنود القرارات والمتابعة</div>
                <button class="btn b-b" style="padding:4px 10px;font-size:11px" onclick="pdMtgAddAction()">➕ بند قرار</button>
            </div>
            <div id="pd-mtg-actions"></div>
        </div>
        <div style="width:200px;margin-bottom:12px"><label style="${lblStyle()}">حالة المتابعة</label><select id="mtg-status" style="${inputStyle()}"><option value="open">🟠 متابعة مفتوحة</option><option value="closed">🟢 مغلق</option></select></div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveMtg('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-mtg-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}

window.pdOpenMtgForm = function (pid, key = null) {
    const form = document.getElementById('pd-mtg-form'); if (!form) return;
    form.style.display = ''; document.getElementById('pd-mtg-key').value = key || '';
    document.getElementById('pd-mtg-form-title').textContent = key ? '✏️ تعديل محضر الاجتماع' : '📝 محضر اجتماع جديد';
    const r = key ? ((window.meetings || {})[pid] || {})[key] : null;
    document.getElementById('mtg-title').value = r?.title || '';
    document.getElementById('mtg-type').value = r?.meetingType || 'progress';
    document.getElementById('mtg-date').value = r?.meetingDate || new Date().toISOString().slice(0, 10);
    document.getElementById('mtg-location').value = r?.location || '';
    document.getElementById('mtg-next').value = r?.nextMeetingDate || '';
    document.getElementById('mtg-attendees').value = r?.attendees || '';
    document.getElementById('mtg-discussion').value = r?.discussion || '';
    document.getElementById('mtg-status').value = r?.status || 'open';
    window._pdMtgActions = Array.isArray(r?.actions) ? r.actions.map(a => ({ ...a })) : [];
    const box = document.getElementById('pd-mtg-actions'); if (box) box.innerHTML = pdMtgActionRowsHtml();
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSaveMtg = async function (pid) {
    const title = document.getElementById('mtg-title')?.value.trim();
    if (!title) { toast('أدخل عنوان الاجتماع', 'er'); return; }
    const key = document.getElementById('pd-mtg-key')?.value;
    const actions = pdMtgReadActions().filter(a => a.text || a.owner || a.dueDate);
    const data = {
        title, meetingType: document.getElementById('mtg-type')?.value || 'progress',
        meetingDate: document.getElementById('mtg-date')?.value || '',
        location: document.getElementById('mtg-location')?.value.trim() || '',
        nextMeetingDate: document.getElementById('mtg-next')?.value || '',
        attendees: document.getElementById('mtg-attendees')?.value.trim() || '',
        discussion: document.getElementById('mtg-discussion')?.value.trim() || '',
        status: document.getElementById('mtg-status')?.value || 'open',
        actions, updatedAt: new Date().toISOString()
    };
    try {
        if (key) { await update(ref(db, `ledger/meetings/${pid}/${key}`), data); toast('تم التحديث ✓', 'ok'); }
        else {
            data.number = pdNextNum('MIN', (window.meetings || {})[pid]);
            data.createdAt = new Date().toISOString(); data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/meetings/${pid}`), data); toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-mtg-form').style.display = 'none';
        setTimeout(() => pdRenderTab('meetings'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};
window.pdCloseMtg = function (pid, key) {
    cf2('إغلاق متابعة هذا الاجتماع؟', async () => {
        try { await update(ref(db, `ledger/meetings/${pid}/${key}`), { status: 'closed', updatedAt: new Date().toISOString() }); toast('تم الإغلاق', 'ok'); setTimeout(() => pdRenderTab('meetings'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};
window.pdDeleteMtg = function (pid, key) {
    cf2('حذف محضر الاجتماع نهائياً؟', async () => {
        try { await remove(ref(db, `ledger/meetings/${pid}/${key}`)); toast('تم الحذف', 'ok'); setTimeout(() => pdRenderTab('meetings'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — 📢 المناقصات والعطاءات (Bidding / Tenders)                          ║
// ║   طرح مناقصة + عروض مقاولين للمقارنة + الترسية — بيانات فقط.                  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const PD_BID_STATUS = { draft: ['⚪ مسودة', '#7f8c8d', '#f4f6f7'], open: ['🟠 مطروحة', '#e67e22', '#fef5e7'], evaluating: ['🔵 تحت التقييم', '#2980b9', '#eaf2fb'], awarded: ['🟢 مُرساة', '#27ae60', '#eafaf1'], cancelled: ['🔴 ملغاة', '#c0392b', '#fdecea'] };
const PD_BID_CATS = { subcontract: 'مقاولة باطن', supply: 'توريد مواد', services: 'خدمات', equipment: 'معدّات', other: 'أخرى' };
const pdMny = v => (+v || 0).toLocaleString('en-US');

window._pdBidFilter = window._pdBidFilter || 'all';
window.pdSetBidFilter = function (f) { window._pdBidFilter = f; pdRenderTenders(window._pd.projectId); };

// مناقصة "متأخّرة" = مطروحة وتجاوزت آخر موعد للعروض
function pdBidIsOv(r) {
    const today = new Date().toISOString().slice(0, 10);
    return r.status === 'open' && r.dueDate && r.dueDate < today;
}
function pdBidAward(r) {  // العرض المُرسى عليه
    const bids = Array.isArray(r.bids) ? r.bids : [];
    return bids.find(b => b && b.selected) || null;
}

function pdRenderTenders(pid) {
    const pane = document.getElementById('pd-tab-tenders'); if (!pane) return;
    const all = Object.entries((window.tenders || {})[pid] || {}).sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));
    let cOpen = 0, cOv = 0, cAward = 0;
    all.forEach(([, r]) => { if (['open', 'evaluating'].includes(r.status)) cOpen++; if (pdBidIsOv(r)) cOv++; if (r.status === 'awarded') cAward++; });
    const flt = window._pdBidFilter;
    const shown = all.filter(([, r]) => flt === 'all' ? true : flt === 'overdue' ? pdBidIsOv(r) : flt === 'active' ? ['open', 'evaluating'].includes(r.status) : r.status === flt);
    pane.innerHTML = `
    <div class="card">
        <div class="tlb"><div class="c-tl" style="margin:0;border:none;padding:0">📢 المناقصات والعطاءات</div>
            <button class="btn b-g" onclick="pdOpenBidForm('${pid}')">➕ مناقصة جديدة</button></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
            ${pdFiStat('الإجمالي', all.length, '#2d6a9f')}${pdFiStat('نشطة', cOpen, '#e67e22')}${pdFiStat('متأخرة', cOv, '#c0392b')}${pdFiStat('مُرساة', cAward, '#27ae60')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${pdFiltChip(flt, 'all', 'الكل', 'pdSetBidFilter')}${pdFiltChip(flt, 'active', 'نشطة', 'pdSetBidFilter')}${pdFiltChip(flt, 'open', 'مطروحة', 'pdSetBidFilter')}${pdFiltChip(flt, 'evaluating', 'تحت التقييم', 'pdSetBidFilter')}${pdFiltChip(flt, 'overdue', '⏰ متأخرة', 'pdSetBidFilter')}${pdFiltChip(flt, 'awarded', 'مُرساة', 'pdSetBidFilter')}
        </div>
        ${shown.length === 0 ? '<div class="empty"><div class="ei">📢</div><p>لا توجد مناقصات في هذا التصنيف</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
        ${shown.map(([k, r]) => {
        const [sl, sc, sbg] = PD_BID_STATUS[r.status] || PD_BID_STATUS.draft;
        const ov = pdBidIsOv(r);
        const bids = Array.isArray(r.bids) ? r.bids : [];
        const amounts = bids.map(b => +b.amount || 0).filter(a => a > 0);
        const low = amounts.length ? Math.min(...amounts) : 0;
        const award = pdBidAward(r);
        return `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:10px;padding:14px;border-right:4px solid ${ov ? '#c0392b' : sc}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-family:monospace;font-weight:800;color:#1a3a5c;background:#eef3f8;padding:2px 8px;border-radius:6px">${r.number || ''}</span>
                        <span style="font-size:14px;font-weight:800;color:#1a3a5c">${r.title || '—'}</span>
                        <span style="background:${sbg};color:${sc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${sl}</span>
                        ${r.category ? `<span style="background:#eef3f8;color:#2d6a9f;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${PD_BID_CATS[r.category] || r.category}</span>` : ''}
                        ${ov ? '<span style="background:#fdecea;color:#c0392b;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:800">⏰ انتهى موعد العروض</span>' : ''}
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="pdOpenBidForm('${pid}','${k}')">✏️ تعديل</button>
                        <button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="pdDeleteBid('${pid}','${k}')">🗑️</button>
                    </div>
                </div>
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#888;margin-top:8px">
                    ${r.budget ? `<span>💰 الميزانية التقديرية: ${pdMny(r.budget)}</span>` : ''}${r.issueDate ? `<span>📤 الطرح: ${r.issueDate}</span>` : ''}${r.dueDate ? `<span style="color:${ov ? '#c0392b' : '#888'}">📅 آخر موعد: ${r.dueDate}</span>` : ''}<span>📨 عروض: ${bids.length}</span>${low ? `<span>⬇️ أقل عرض: ${pdMny(low)}</span>` : ''}
                </div>
                ${r.scope ? `<div style="font-size:12.5px;color:#444;margin-top:8px;line-height:1.7">${r.scope.replace(/\n/g, '<br>')}</div>` : ''}
                ${bids.length ? `<div style="margin-top:10px;border-top:1px dashed #e0e6ec;padding-top:8px">
                    <div style="font-size:11px;font-weight:800;color:#2d6a9f;margin-bottom:6px">📨 العروض المستلمة (${bids.length})</div>
                    ${bids.slice().sort((a, b) => (+a.amount || 0) - (+b.amount || 0)).map(b => { const win = b.selected; const isLow = (+b.amount || 0) === low && low > 0; return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 0;${win ? 'background:#eafaf1;border-radius:6px;padding:4px 6px' : ''}"><span>${win ? '🏆' : (isLow ? '⬇️' : '•')}</span><span style="flex:1;font-weight:${win ? '800' : '600'};color:#333">${b.bidder || '—'}</span><span style="font-weight:800;color:#1a3a5c">${pdMny(b.amount)}</span>${b.date ? `<span style="color:#888">📅 ${b.date}</span>` : ''}</div>`; }).join('')}
                    ${award ? `<div style="font-size:11.5px;color:#1e8449;font-weight:800;margin-top:6px">🏆 تمّت الترسية على: ${award.bidder || '—'} بمبلغ ${pdMny(award.amount)}</div>` : ''}
                </div>` : ''}
            </div>`;
    }).join('')}
        </div>`}
    </div>
    ${pdBidFormHtml(pid)}`;
}

// ── عروض المقاولين: قائمة ديناميكية داخل النموذج ─────────────────────
window._pdBids = window._pdBids || [];
function pdBidRowsHtml() {
    const bids = window._pdBids || [];
    if (!bids.length) return '<div style="font-size:11px;color:#aaa;padding:6px 0">لا توجد عروض بعد — اضغط «➕ عرض مقاول».</div>';
    return bids.map((b, i) => `<div class="bid-row" style="display:grid;grid-template-columns:1fr 130px 130px 30px 34px;gap:6px;margin-bottom:6px;align-items:center">
        <input class="bid-name" value="${(b.bidder || '').replace(/"/g, '&quot;')}" placeholder="اسم المقاول" style="${inputStyle()}">
        <input type="number" class="bid-amt" value="${b.amount != null && b.amount !== '' ? b.amount : ''}" placeholder="قيمة العرض" style="${inputStyle()}">
        <input type="date" class="bid-date" value="${b.date || ''}" style="${inputStyle()}">
        <label style="display:flex;align-items:center;justify-content:center;cursor:pointer" title="المُرسى عليه"><input type="checkbox" class="bid-sel" ${b.selected ? 'checked' : ''}></label>
        <button class="btn b-r" style="padding:4px 6px;font-size:11px" onclick="pdBidDelRow(${i})">🗑️</button>
    </div>`).join('');
}
function pdBidReadRows() {
    const arr = [];
    document.querySelectorAll('#pd-bid-bids .bid-row').forEach(row => {
        arr.push({
            bidder: (row.querySelector('.bid-name')?.value || '').trim(),
            amount: +(row.querySelector('.bid-amt')?.value || 0) || 0,
            date: row.querySelector('.bid-date')?.value || '',
            selected: !!row.querySelector('.bid-sel')?.checked
        });
    });
    return arr;
}
window.pdBidAddRow = function () {
    window._pdBids = pdBidReadRows();
    window._pdBids.push({ bidder: '', amount: '', date: '', selected: false });
    const box = document.getElementById('pd-bid-bids'); if (box) box.innerHTML = pdBidRowsHtml();
};
window.pdBidDelRow = function (i) {
    window._pdBids = pdBidReadRows();
    window._pdBids.splice(i, 1);
    const box = document.getElementById('pd-bid-bids'); if (box) box.innerHTML = pdBidRowsHtml();
};

function pdBidFormHtml(pid) {
    return `<div id="pd-bid-form" style="display:none;background:#fff;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #2d6a9f">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-bid-form-title">📢 مناقصة جديدة</div>
        <input type="hidden" id="pd-bid-key">
        <div style="display:grid;grid-template-columns:1fr 160px 150px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">اسم المناقصة *</label><input id="bid-title" placeholder="مثال: توريد وتركيب أعمال التكييف" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التصنيف</label><select id="bid-cat" style="${inputStyle()}">${Object.entries(PD_BID_CATS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
            <div><label style="${lblStyle()}">الميزانية التقديرية</label><input type="number" id="bid-budget" placeholder="0" style="${inputStyle()}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 170px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">تاريخ الطرح</label><input type="date" id="bid-issue" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">آخر موعد للعروض</label><input type="date" id="bid-due" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الحالة</label><select id="bid-status" style="${inputStyle()}"><option value="draft">⚪ مسودة</option><option value="open">🟠 مطروحة</option><option value="evaluating">🔵 تحت التقييم</option><option value="awarded">🟢 مُرساة</option><option value="cancelled">🔴 ملغاة</option></select></div>
        </div>
        <div style="margin-bottom:12px"><label style="${lblStyle()}">نطاق العمل</label><textarea id="bid-scope" rows="2" placeholder="وصف نطاق الأعمال المطلوبة..." style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="border-top:1px dashed #d0d7e0;padding-top:12px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="font-size:12px;font-weight:800;color:#2d6a9f">📨 عروض المقاولين (حدّد ☑️ المُرسى عليه)</div>
                <button class="btn b-b" style="padding:4px 10px;font-size:11px" onclick="pdBidAddRow()">➕ عرض مقاول</button>
            </div>
            <div id="pd-bid-bids"></div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveBid('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-bid-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}

window.pdOpenBidForm = function (pid, key = null) {
    const form = document.getElementById('pd-bid-form'); if (!form) return;
    form.style.display = ''; document.getElementById('pd-bid-key').value = key || '';
    document.getElementById('pd-bid-form-title').textContent = key ? '✏️ تعديل المناقصة' : '📢 مناقصة جديدة';
    const r = key ? ((window.tenders || {})[pid] || {})[key] : null;
    document.getElementById('bid-title').value = r?.title || '';
    document.getElementById('bid-cat').value = r?.category || 'subcontract';
    document.getElementById('bid-budget').value = r?.budget != null ? r.budget : '';
    document.getElementById('bid-issue').value = r?.issueDate || new Date().toISOString().slice(0, 10);
    document.getElementById('bid-due').value = r?.dueDate || '';
    document.getElementById('bid-status').value = r?.status || 'open';
    document.getElementById('bid-scope').value = r?.scope || '';
    window._pdBids = Array.isArray(r?.bids) ? r.bids.map(b => ({ ...b })) : [];
    const box = document.getElementById('pd-bid-bids'); if (box) box.innerHTML = pdBidRowsHtml();
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSaveBid = async function (pid) {
    const title = document.getElementById('bid-title')?.value.trim();
    if (!title) { toast('أدخل اسم المناقصة', 'er'); return; }
    const key = document.getElementById('pd-bid-key')?.value;
    let bids = pdBidReadRows().filter(b => b.bidder || b.amount);
    // ترسية واحدة فقط: أبقِ أول عرض مُحدَّد فقط
    let seen = false;
    bids = bids.map(b => { if (b.selected && !seen) { seen = true; return b; } return { ...b, selected: false }; });
    const data = {
        title, category: document.getElementById('bid-cat')?.value || 'subcontract',
        budget: +(document.getElementById('bid-budget')?.value || 0) || 0,
        issueDate: document.getElementById('bid-issue')?.value || '',
        dueDate: document.getElementById('bid-due')?.value || '',
        status: document.getElementById('bid-status')?.value || 'open',
        scope: document.getElementById('bid-scope')?.value.trim() || '',
        bids, updatedAt: new Date().toISOString()
    };
    try {
        if (key) { await update(ref(db, `ledger/tenders/${pid}/${key}`), data); toast('تم التحديث ✓', 'ok'); }
        else {
            data.number = pdNextNum('BID', (window.tenders || {})[pid]);
            data.createdAt = new Date().toISOString(); data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/tenders/${pid}`), data); toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-bid-form').style.display = 'none';
        setTimeout(() => pdRenderTab('tenders'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};
window.pdDeleteBid = function (pid, key) {
    cf2('حذف هذه المناقصة نهائياً؟', async () => {
        try { await remove(ref(db, `ledger/tenders/${pid}/${key}`)); toast('تم الحذف', 'ok'); setTimeout(() => pdRenderTab('tenders'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ── 🔧 قوائم النواقص (Punch / Snag Lists) ──────────────────────────
window._pdPunchFilter = window._pdPunchFilter || 'all';
window.pdSetPunchFilter = function (f) { window._pdPunchFilter = f; pdRenderPunch(window._pd.projectId); };

function pdRenderPunch(pid) {
    const pane = document.getElementById('pd-tab-punch'); if (!pane) return;
    const all = Object.entries((window.punchItems || {})[pid] || {}).sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));
    const today = new Date().toISOString().slice(0, 10);
    const isOv = r => r.status !== 'closed' && r.dueDate && r.dueDate < today;
    let cOpen = 0, cOv = 0, cClosed = 0;
    all.forEach(([, r]) => { if (r.status !== 'closed') cOpen++; if (isOv(r)) cOv++; if (r.status === 'closed') cClosed++; });
    const flt = window._pdPunchFilter;
    const shown = all.filter(([, r]) => flt === 'all' ? true : flt === 'overdue' ? isOv(r) : r.status === flt);
    pane.innerHTML = `
    <div class="card">
        <div class="tlb"><div class="c-tl" style="margin:0;border:none;padding:0">🔧 قوائم النواقص (Punch List)</div>
            <button class="btn b-g" onclick="pdOpenPunchForm('${pid}')">➕ بند نواقص جديد</button></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
            ${pdFiStat('الإجمالي', all.length, '#2d6a9f')}${pdFiStat('غير مغلقة', cOpen, '#e67e22')}${pdFiStat('متأخرة', cOv, '#c0392b')}${pdFiStat('مغلقة', cClosed, '#27ae60')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${pdFiltChip(flt, 'all', 'الكل', 'pdSetPunchFilter')}${pdFiltChip(flt, 'open', 'مفتوحة', 'pdSetPunchFilter')}${pdFiltChip(flt, 'in_progress', 'قيد المعالجة', 'pdSetPunchFilter')}${pdFiltChip(flt, 'ready', 'جاهز للفحص', 'pdSetPunchFilter')}${pdFiltChip(flt, 'overdue', '⏰ متأخرة', 'pdSetPunchFilter')}${pdFiltChip(flt, 'closed', 'مغلقة', 'pdSetPunchFilter')}
        </div>
        ${shown.length === 0 ? '<div class="empty"><div class="ei">🔧</div><p>لا توجد بنود نواقص في هذا التصنيف</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
        ${shown.map(([k, r]) => {
        const [sl, sc, sbg] = PD_PUNCH_STATUS[r.status] || PD_PUNCH_STATUS.open;
        const [pl, pc] = PD_PRIORITY[r.priority] || PD_PRIORITY.normal;
        const ov = isOv(r);
        return `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:10px;padding:14px;border-right:4px solid ${ov ? '#c0392b' : sc}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-family:monospace;font-weight:800;color:#1a3a5c;background:#eef3f8;padding:2px 8px;border-radius:6px">${r.number || ''}</span>
                        <span style="font-size:14px;font-weight:800;color:#1a3a5c">${r.title || '—'}</span>
                        <span style="background:${sbg};color:${sc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${sl}</span>
                        <span style="background:${pc}22;color:${pc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${pl}</span>
                        ${ov ? '<span style="background:#fdecea;color:#c0392b;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:800">⏰ متأخر</span>' : ''}
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="pdOpenPunchForm('${pid}','${k}')">✏️</button>
                        ${r.status !== 'closed' ? `<button class="btn" style="padding:3px 8px;font-size:11px;background:#eafaf1;color:#1e8449;border:1px solid #a9dfbf" onclick="pdClosePunch('${pid}','${k}')">✅ إغلاق</button>` : ''}
                        <button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="pdDeletePunch('${pid}','${k}')">🗑️</button>
                    </div>
                </div>
                ${r.description ? `<div style="font-size:12.5px;color:#444;margin-top:8px;line-height:1.7">${r.description.replace(/\n/g, '<br>')}</div>` : ''}
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#888;margin-top:8px">
                    ${r.location ? `<span>📍 ${r.location}</span>` : ''}${r.trade ? `<span>🏷️ ${r.trade}</span>` : ''}${r.assignee ? `<span>👷 ${r.assignee}</span>` : ''}${r.dueDate ? `<span style="color:${ov ? '#c0392b' : '#888'}">📅 ${r.dueDate}</span>` : ''}${r.photoUrl ? `<a href="${r.photoUrl}" target="_blank" style="color:#2980b9;font-weight:700">🖼️ صورة</a>` : ''}
                </div>
            </div>`;
    }).join('')}
        </div>`}
    </div>
    ${pdPunchFormHtml(pid)}`;
}

function pdPunchFormHtml(pid) {
    const trades = ['أعمال مدنية', 'دهانات', 'كهرباء', 'سباكة', 'نجارة', 'بلاط/سيراميك', 'جبس', 'ألمنيوم', 'عزل', 'تكييف', 'أخرى'];
    return `<div id="pd-punch-form" style="display:none;background:#fff;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #e67e22">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-punch-form-title">🔧 بند نواقص جديد</div>
        <input type="hidden" id="pd-punch-key">
        <div style="display:grid;grid-template-columns:1fr 150px 140px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">العنوان *</label><input id="pn2-title" placeholder="وصف مختصر للنقص" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التخصص</label><select id="pn2-trade" style="${inputStyle()}">${trades.map(d => `<option>${d}</option>`).join('')}</select></div>
            <div><label style="${lblStyle()}">الأولوية</label><select id="pn2-priority" style="${inputStyle()}"><option value="normal">عادية</option><option value="high">عالية</option><option value="urgent">عاجلة</option><option value="low">منخفضة</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 150px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">الموقع</label><input id="pn2-location" placeholder="الدور / الغرفة / المحور" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">المسؤول عن المعالجة</label><input id="pn2-assignee" placeholder="مقاول الباطن / الفني" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">تاريخ الاستحقاق</label><input type="date" id="pn2-due" style="${inputStyle()}"></div>
        </div>
        <div style="display:grid;grid-template-columns:150px 1fr;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">الحالة</label><select id="pn2-status" style="${inputStyle()}"><option value="open">🔴 مفتوح</option><option value="in_progress">🟠 قيد المعالجة</option><option value="ready">🔵 جاهز للفحص</option><option value="closed">🟢 مغلق</option></select></div>
            <div><label style="${lblStyle()}">رابط صورة (اختياري)</label><input id="pn2-photo" placeholder="https://... رابط صورة النقص" style="${inputStyle()}"></div>
        </div>
        <div style="margin-bottom:12px"><label style="${lblStyle()}">التفاصيل</label><textarea id="pn2-desc" rows="3" placeholder="وصف النقص والإجراء المطلوب..." style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSavePunch('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-punch-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}

window.pdOpenPunchForm = function (pid, key = null) {
    const form = document.getElementById('pd-punch-form'); if (!form) return;
    form.style.display = ''; document.getElementById('pd-punch-key').value = key || '';
    document.getElementById('pd-punch-form-title').textContent = key ? '✏️ تعديل بند النواقص' : '🔧 بند نواقص جديد';
    const r = key ? ((window.punchItems || {})[pid] || {})[key] : null;
    document.getElementById('pn2-title').value = r?.title || '';
    document.getElementById('pn2-trade').value = r?.trade || 'أعمال مدنية';
    document.getElementById('pn2-priority').value = r?.priority || 'normal';
    document.getElementById('pn2-location').value = r?.location || '';
    document.getElementById('pn2-assignee').value = r?.assignee || '';
    document.getElementById('pn2-due').value = r?.dueDate || '';
    document.getElementById('pn2-status').value = r?.status || 'open';
    document.getElementById('pn2-photo').value = r?.photoUrl || '';
    document.getElementById('pn2-desc').value = r?.description || '';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSavePunch = async function (pid) {
    const title = document.getElementById('pn2-title')?.value.trim();
    if (!title) { toast('أدخل عنوان النقص', 'er'); return; }
    const key = document.getElementById('pd-punch-key')?.value;
    const status = document.getElementById('pn2-status')?.value || 'open';
    const data = {
        title, trade: document.getElementById('pn2-trade')?.value || '',
        priority: document.getElementById('pn2-priority')?.value || 'normal',
        location: document.getElementById('pn2-location')?.value.trim() || '',
        assignee: document.getElementById('pn2-assignee')?.value.trim() || '',
        dueDate: document.getElementById('pn2-due')?.value || '',
        status, photoUrl: document.getElementById('pn2-photo')?.value.trim() || '',
        description: document.getElementById('pn2-desc')?.value.trim() || '',
        closedDate: status === 'closed' ? (new Date().toISOString().slice(0, 10)) : '',
        updatedAt: new Date().toISOString()
    };
    try {
        if (key) { await update(ref(db, `ledger/punchItems/${pid}/${key}`), data); toast('تم التحديث ✓', 'ok'); }
        else {
            data.number = pdNextNum('PL', (window.punchItems || {})[pid]);
            data.createdAt = new Date().toISOString(); data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/punchItems/${pid}`), data); toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-punch-form').style.display = 'none';
        setTimeout(() => pdRenderTab('punch'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};
window.pdClosePunch = function (pid, key) {
    cf2('إغلاق بند النواقص هذا؟', async () => {
        try { await update(ref(db, `ledger/punchItems/${pid}/${key}`), { status: 'closed', closedDate: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() }); toast('تم الإغلاق', 'ok'); setTimeout(() => pdRenderTab('punch'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};
window.pdDeletePunch = function (pid, key) {
    cf2('حذف بند النواقص نهائياً؟', async () => {
        try { await remove(ref(db, `ledger/punchItems/${pid}/${key}`)); toast('تم الحذف', 'ok'); setTimeout(() => pdRenderTab('punch'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — 🦺 الجودة والسلامة (QHSE): تفتيش/ITP + ملاحظات ومخالفات + حوادث      ║
// ║   تُخزَّن كلها في ledger/qhse مع حقل kind للتمييز. بيانات فقط (روابط صور).    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const PD_INS_RESULT = { pending: ['⚪ قيد الفحص', '#7f8c8d', '#f1f3f5'], pass: ['🟢 ناجح', '#27ae60', '#eafaf1'], conditional: ['🟠 مشروط', '#e67e22', '#fef5e7'], fail: ['🔴 راسب', '#c0392b', '#fdecea'] };
const PD_OBS_STATUS = { open: ['🔴 مفتوح', '#c0392b', '#fdecea'], in_progress: ['🟠 قيد المعالجة', '#e67e22', '#fef5e7'], closed: ['🟢 مغلق', '#27ae60', '#eafaf1'] };
const PD_INC_STATUS = { open: ['🔴 مفتوح', '#c0392b', '#fdecea'], investigating: ['🟠 تحت التحقيق', '#e67e22', '#fef5e7'], closed: ['🟢 مغلق', '#27ae60', '#eafaf1'] };
const PD_INC_TYPE = { near_miss: 'وشيك الحدوث', first_aid: 'إسعاف أولي', injury: 'إصابة', property: 'أضرار ممتلكات', environmental: 'بيئي' };

window._pdQhseSub = window._pdQhseSub || 'inspection';
window._pdQhseFilter = window._pdQhseFilter || 'all';
window.pdSetQhseSub = function (s) { window._pdQhseSub = s; window._pdQhseFilter = 'all'; pdRenderQHSE(window._pd.projectId); };
window.pdSetQhseFilter = function (f) { window._pdQhseFilter = f; pdRenderQHSE(window._pd.projectId); };

function pdRenderQHSE(pid) {
    const pane = document.getElementById('pd-tab-qhse'); if (!pane) return;
    const sub = window._pdQhseSub;
    const all = Object.entries((window.qhse || {})[pid] || {});
    const openN = k => all.filter(([, r]) => r.kind === k && r.status !== 'closed').length;
    const subBtn = (id, label, n) => `<button onclick="pdSetQhseSub('${id}')" style="padding:8px 14px;border-radius:8px;border:none;background:${sub === id ? '#c0392b' : '#f8fafc'};color:${sub === id ? '#fff' : '#1a3a5c'};font-weight:${sub === id ? '800' : '600'};cursor:pointer;font-size:12px;font-family:inherit">${label}${n ? ` (${n})` : ''}</button>`;
    pane.innerHTML = `
    <div class="card">
        <div class="c-tl" style="margin:0 0 12px;border:none;padding:0">🦺 الجودة والسلامة (QHSE)</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
            ${subBtn('inspection', '🔍 التفتيش وقوائم الفحص', openN('inspection'))}
            ${subBtn('observation', '⚠️ الملاحظات والمخالفات', openN('observation'))}
            ${subBtn('incident', '🚨 الحوادث والإصابات', openN('incident'))}
        </div>
        <div id="pd-qhse-sub"></div>
    </div>
    <div id="pd-qhse-formwrap"></div>`;
    if (sub === 'observation') pdRenderObservations(pid);
    else if (sub === 'incident') pdRenderIncidents(pid);
    else pdRenderInspections(pid);
}

// ── 🔍 التفتيش وقوائم الفحص (Inspections / ITP) ──
window._pdInsChk = window._pdInsChk || [];
function pdInsChkHtml() {
    const rows = window._pdInsChk;
    if (!rows.length) return '<div style="color:#aaa;font-size:12px;padding:6px">لا توجد بنود فحص — أضف بنداً.</div>';
    return rows.map((c, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <input type="checkbox" ${c.ok ? 'checked' : ''} onchange="window._pdInsChk[${i}].ok=this.checked" style="width:18px;height:18px;flex:0 0 auto">
        <input value="${(c.text || '').replace(/"/g, '&quot;')}" placeholder="بند الفحص" oninput="window._pdInsChk[${i}].text=this.value" style="flex:1;${inputStyle()}">
        <button class="btn b-r" style="padding:4px 9px" onclick="window._pdInsChk.splice(${i},1);document.getElementById('pd-ins-chk').innerHTML=pdInsChkHtml()">🗑️</button>
    </div>`).join('');
}
window.pdInsAddChk = function () { window._pdInsChk.push({ text: '', ok: false }); document.getElementById('pd-ins-chk').innerHTML = pdInsChkHtml(); };

function pdRenderInspections(pid) {
    const host = document.getElementById('pd-qhse-sub'), fh = document.getElementById('pd-qhse-formwrap'); if (!host) return;
    const items = Object.entries((window.qhse || {})[pid] || {}).filter(([, r]) => r.kind === 'inspection').sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));
    let cPass = 0, cFail = 0, cCond = 0;
    items.forEach(([, r]) => { if (r.result === 'pass') cPass++; else if (r.result === 'fail') cFail++; else if (r.result === 'conditional') cCond++; });
    const flt = window._pdQhseFilter;
    const shown = items.filter(([, r]) => flt === 'all' ? true : r.result === flt);
    host.innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn b-g" onclick="pdOpenInsForm('${pid}')">➕ فحص جديد</button></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            ${pdFiStat('إجمالي الفحوصات', items.length, '#2d6a9f')}${pdFiStat('ناجحة', cPass, '#27ae60')}${pdFiStat('مشروطة', cCond, '#e67e22')}${pdFiStat('راسبة', cFail, '#c0392b')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${pdFiltChip(flt, 'all', 'الكل', 'pdSetQhseFilter')}${pdFiltChip(flt, 'pass', 'ناجحة', 'pdSetQhseFilter')}${pdFiltChip(flt, 'conditional', 'مشروطة', 'pdSetQhseFilter')}${pdFiltChip(flt, 'fail', 'راسبة', 'pdSetQhseFilter')}${pdFiltChip(flt, 'pending', 'قيد الفحص', 'pdSetQhseFilter')}
        </div>
        ${shown.length === 0 ? '<div class="empty"><div class="ei">🔍</div><p>لا توجد فحوصات في هذا التصنيف</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
        ${shown.map(([k, r]) => {
        const [rl, rc, rbg] = PD_INS_RESULT[r.result] || PD_INS_RESULT.pending;
        const chk = Array.isArray(r.checklist) ? r.checklist : [];
        const okN = chk.filter(c => c.ok).length;
        return `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:10px;padding:14px;border-right:4px solid ${rc}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-family:monospace;font-weight:800;color:#1a3a5c;background:#eef3f8;padding:2px 8px;border-radius:6px">${r.number || ''}</span>
                        <span style="font-size:14px;font-weight:800;color:#1a3a5c">${r.title || '—'}</span>
                        <span style="background:${rbg};color:${rc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${rl}</span>
                        ${chk.length ? `<span style="background:#eef3f8;color:#555;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">☑️ ${okN}/${chk.length}</span>` : ''}
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="pdOpenInsForm('${pid}','${k}')">✏️</button>
                        <button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="pdDeleteQhse('${pid}','${k}')">🗑️</button>
                    </div>
                </div>
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#888;margin-top:8px">
                    ${r.discipline ? `<span>🏷️ ${r.discipline}</span>` : ''}${r.location ? `<span>📍 ${r.location}</span>` : ''}${r.inspector ? `<span>👤 ${r.inspector}</span>` : ''}${r.date ? `<span>📅 ${r.date}</span>` : ''}
                </div>
                ${chk.length ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:3px">${chk.map(c => `<div style="font-size:12px;color:${c.ok ? '#1e8449' : '#c0392b'}">${c.ok ? '✅' : '⬜'} ${c.text || ''}</div>`).join('')}</div>` : ''}
                ${r.notes ? `<div style="font-size:12px;color:#555;margin-top:8px;line-height:1.6">${r.notes.replace(/\n/g, '<br>')}</div>` : ''}
            </div>`;
    }).join('')}
        </div>`}`;
    if (fh) fh.innerHTML = pdInsFormHtml(pid);
}

function pdInsFormHtml(pid) {
    const disc = ['أعمال مدنية', 'خرسانة', 'حديد تسليح', 'دهانات', 'كهرباء', 'سباكة', 'عزل', 'تشطيبات', 'سلامة', 'أخرى'];
    return `<div id="pd-ins-form" style="display:none;background:#fff;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #27ae60">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-ins-form-title">🔍 فحص جديد</div>
        <input type="hidden" id="pd-ins-key">
        <div style="display:grid;grid-template-columns:1fr 160px 150px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">عنوان الفحص *</label><input id="ins-title" placeholder="مثال: فحص صب سقف الدور الأول" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التخصص</label><select id="ins-disc" style="${inputStyle()}">${disc.map(d => `<option>${d}</option>`).join('')}</select></div>
            <div><label style="${lblStyle()}">النتيجة</label><select id="ins-result" style="${inputStyle()}"><option value="pending">⚪ قيد الفحص</option><option value="pass">🟢 ناجح</option><option value="conditional">🟠 مشروط</option><option value="fail">🔴 راسب</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 150px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">الموقع</label><input id="ins-loc" placeholder="الدور / المحور" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">المفتّش</label><input id="ins-inspector" placeholder="اسم المفتّش" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التاريخ</label><input type="date" id="ins-date" style="${inputStyle()}"></div>
        </div>
        <div style="border-top:1px dashed #d0d7e0;padding-top:12px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><label style="${lblStyle()};margin:0">☑️ بنود الفحص (ITP)</label><button class="btn b-b" style="padding:4px 10px;font-size:11px" onclick="pdInsAddChk()">➕ بند</button></div>
            <div id="pd-ins-chk"></div>
        </div>
        <div style="margin-bottom:12px"><label style="${lblStyle()}">ملاحظات</label><textarea id="ins-notes" rows="2" placeholder="ملاحظات الفحص..." style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveIns('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-ins-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}
window.pdOpenInsForm = function (pid, key = null) {
    const form = document.getElementById('pd-ins-form'); if (!form) return;
    form.style.display = ''; document.getElementById('pd-ins-key').value = key || '';
    document.getElementById('pd-ins-form-title').textContent = key ? '✏️ تعديل الفحص' : '🔍 فحص جديد';
    const r = key ? ((window.qhse || {})[pid] || {})[key] : null;
    document.getElementById('ins-title').value = r?.title || '';
    document.getElementById('ins-disc').value = r?.discipline || 'أعمال مدنية';
    document.getElementById('ins-result').value = r?.result || 'pending';
    document.getElementById('ins-loc').value = r?.location || '';
    document.getElementById('ins-inspector').value = r?.inspector || '';
    document.getElementById('ins-date').value = r?.date || new Date().toISOString().slice(0, 10);
    document.getElementById('ins-notes').value = r?.notes || '';
    window._pdInsChk = (r && Array.isArray(r.checklist)) ? r.checklist.map(c => ({ text: c.text || '', ok: !!c.ok })) : [];
    document.getElementById('pd-ins-chk').innerHTML = pdInsChkHtml();
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
window.pdSaveIns = async function (pid) {
    const title = document.getElementById('ins-title')?.value.trim();
    if (!title) { toast('أدخل عنوان الفحص', 'er'); return; }
    const key = document.getElementById('pd-ins-key')?.value;
    const result = document.getElementById('ins-result')?.value || 'pending';
    const checklist = (window._pdInsChk || []).filter(c => c.text && c.text.trim()).map(c => ({ text: c.text.trim(), ok: !!c.ok }));
    const data = {
        kind: 'inspection', title, discipline: document.getElementById('ins-disc')?.value || '', result,
        location: document.getElementById('ins-loc')?.value.trim() || '', inspector: document.getElementById('ins-inspector')?.value.trim() || '',
        date: document.getElementById('ins-date')?.value || '', notes: document.getElementById('ins-notes')?.value.trim() || '',
        checklist, status: (result === 'pass' ? 'closed' : 'open'), updatedAt: new Date().toISOString()
    };
    try {
        if (key) { await update(ref(db, `ledger/qhse/${pid}/${key}`), data); toast('تم التحديث ✓', 'ok'); }
        else {
            data.number = pdNextNum('INS', Object.fromEntries(Object.entries((window.qhse || {})[pid] || {}).filter(([, r]) => r.kind === 'inspection')));
            data.createdAt = new Date().toISOString(); data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/qhse/${pid}`), data); toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-ins-form').style.display = 'none';
        setTimeout(() => pdRenderTab('qhse'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

// ── ⚠️ الملاحظات والمخالفات (Observations) ──
function pdRenderObservations(pid) {
    const host = document.getElementById('pd-qhse-sub'), fh = document.getElementById('pd-qhse-formwrap'); if (!host) return;
    const items = Object.entries((window.qhse || {})[pid] || {}).filter(([, r]) => r.kind === 'observation').sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));
    const today = new Date().toISOString().slice(0, 10);
    const isOv = r => r.status !== 'closed' && r.dueDate && r.dueDate < today;
    let cOpen = 0, cSafety = 0, cOv = 0;
    items.forEach(([, r]) => { if (r.status !== 'closed') cOpen++; if (r.category === 'safety') cSafety++; if (isOv(r)) cOv++; });
    const flt = window._pdQhseFilter;
    const shown = items.filter(([, r]) => flt === 'all' ? true : flt === 'overdue' ? isOv(r) : (flt === 'safety' || flt === 'quality') ? r.category === flt : r.status === flt);
    host.innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn b-g" onclick="pdOpenObsForm('${pid}')">➕ ملاحظة/مخالفة</button></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            ${pdFiStat('الإجمالي', items.length, '#2d6a9f')}${pdFiStat('غير مغلقة', cOpen, '#e67e22')}${pdFiStat('سلامة', cSafety, '#c0392b')}${pdFiStat('متأخرة', cOv, '#c0392b')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${pdFiltChip(flt, 'all', 'الكل', 'pdSetQhseFilter')}${pdFiltChip(flt, 'open', 'مفتوحة', 'pdSetQhseFilter')}${pdFiltChip(flt, 'safety', '🦺 سلامة', 'pdSetQhseFilter')}${pdFiltChip(flt, 'quality', '🎯 جودة', 'pdSetQhseFilter')}${pdFiltChip(flt, 'overdue', '⏰ متأخرة', 'pdSetQhseFilter')}${pdFiltChip(flt, 'closed', 'مغلقة', 'pdSetQhseFilter')}
        </div>
        ${shown.length === 0 ? '<div class="empty"><div class="ei">⚠️</div><p>لا توجد ملاحظات في هذا التصنيف</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
        ${shown.map(([k, r]) => {
        const [sl, sc, sbg] = PD_OBS_STATUS[r.status] || PD_OBS_STATUS.open;
        const [pl, pc] = PD_PRIORITY[r.priority] || PD_PRIORITY.normal;
        const cat = r.category === 'safety' ? ['🦺 سلامة', '#c0392b'] : ['🎯 جودة', '#8e44ad'];
        const ov = isOv(r);
        return `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:10px;padding:14px;border-right:4px solid ${ov ? '#c0392b' : sc}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-family:monospace;font-weight:800;color:#1a3a5c;background:#eef3f8;padding:2px 8px;border-radius:6px">${r.number || ''}</span>
                        <span style="font-size:14px;font-weight:800;color:#1a3a5c">${r.title || '—'}</span>
                        <span style="background:${cat[1]}18;color:${cat[1]};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${cat[0]}</span>
                        <span style="background:${sbg};color:${sc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${sl}</span>
                        <span style="background:${pc}22;color:${pc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${pl}</span>
                        ${ov ? '<span style="background:#fdecea;color:#c0392b;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:800">⏰ متأخر</span>' : ''}
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="pdOpenObsForm('${pid}','${k}')">✏️</button>
                        ${r.status !== 'closed' ? `<button class="btn" style="padding:3px 8px;font-size:11px;background:#eafaf1;color:#1e8449;border:1px solid #a9dfbf" onclick="pdCloseQhse('${pid}','${k}')">✅ إغلاق</button>` : ''}
                        <button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="pdDeleteQhse('${pid}','${k}')">🗑️</button>
                    </div>
                </div>
                ${r.description ? `<div style="font-size:12.5px;color:#444;margin-top:8px;line-height:1.7">${r.description.replace(/\n/g, '<br>')}</div>` : ''}
                ${r.correctiveAction ? `<div style="background:#f6f9f2;border-radius:8px;padding:8px 10px;margin-top:8px;border-right:3px solid #27ae60;font-size:12px;color:#333"><b style="color:#1e8449">الإجراء التصحيحي:</b> ${r.correctiveAction.replace(/\n/g, '<br>')}</div>` : ''}
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#888;margin-top:8px">
                    ${r.location ? `<span>📍 ${r.location}</span>` : ''}${r.observedBy ? `<span>👁️ ${r.observedBy}</span>` : ''}${r.assignee ? `<span>👷 ${r.assignee}</span>` : ''}${r.dueDate ? `<span style="color:${ov ? '#c0392b' : '#888'}">📅 ${r.dueDate}</span>` : ''}${r.photoUrl ? `<a href="${r.photoUrl}" target="_blank" style="color:#2980b9;font-weight:700">🖼️ صورة</a>` : ''}
                </div>
            </div>`;
    }).join('')}
        </div>`}`;
    if (fh) fh.innerHTML = pdObsFormHtml(pid);
}
function pdObsFormHtml(pid) {
    return `<div id="pd-obs-form" style="display:none;background:#fff;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #8e44ad">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-obs-form-title">⚠️ ملاحظة / مخالفة جديدة</div>
        <input type="hidden" id="pd-obs-key">
        <div style="display:grid;grid-template-columns:1fr 150px 140px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">العنوان *</label><input id="obs-title" placeholder="وصف مختصر للملاحظة" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التصنيف</label><select id="obs-cat" style="${inputStyle()}"><option value="safety">🦺 سلامة</option><option value="quality">🎯 جودة</option></select></div>
            <div><label style="${lblStyle()}">الخطورة</label><select id="obs-priority" style="${inputStyle()}"><option value="normal">عادية</option><option value="high">عالية</option><option value="urgent">حرجة</option><option value="low">منخفضة</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 150px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">الموقع</label><input id="obs-loc" placeholder="الدور / المنطقة" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">لاحظها</label><input id="obs-by" placeholder="اسم الملاحِظ" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التاريخ</label><input type="date" id="obs-date" style="${inputStyle()}"></div>
        </div>
        <div style="margin-bottom:10px"><label style="${lblStyle()}">التفاصيل</label><textarea id="obs-desc" rows="2" placeholder="وصف الملاحظة/المخالفة..." style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="margin-bottom:10px"><label style="${lblStyle()}">الإجراء التصحيحي المطلوب</label><textarea id="obs-action" rows="2" placeholder="ما يجب فعله لمعالجتها..." style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="display:grid;grid-template-columns:1fr 150px 150px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">المسؤول عن المعالجة</label><input id="obs-assignee" placeholder="مقاول الباطن / الفني" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">تاريخ الاستحقاق</label><input type="date" id="obs-due" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الحالة</label><select id="obs-status" style="${inputStyle()}"><option value="open">🔴 مفتوح</option><option value="in_progress">🟠 قيد المعالجة</option><option value="closed">🟢 مغلق</option></select></div>
        </div>
        <div style="margin-bottom:12px"><label style="${lblStyle()}">رابط صورة (اختياري)</label><input id="obs-photo" placeholder="https://..." style="${inputStyle()}"></div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveObs('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-obs-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}
window.pdOpenObsForm = function (pid, key = null) {
    const form = document.getElementById('pd-obs-form'); if (!form) return;
    form.style.display = ''; document.getElementById('pd-obs-key').value = key || '';
    document.getElementById('pd-obs-form-title').textContent = key ? '✏️ تعديل الملاحظة' : '⚠️ ملاحظة / مخالفة جديدة';
    const r = key ? ((window.qhse || {})[pid] || {})[key] : null;
    document.getElementById('obs-title').value = r?.title || '';
    document.getElementById('obs-cat').value = r?.category || 'safety';
    document.getElementById('obs-priority').value = r?.priority || 'normal';
    document.getElementById('obs-loc').value = r?.location || '';
    document.getElementById('obs-by').value = r?.observedBy || '';
    document.getElementById('obs-date').value = r?.date || new Date().toISOString().slice(0, 10);
    document.getElementById('obs-desc').value = r?.description || '';
    document.getElementById('obs-action').value = r?.correctiveAction || '';
    document.getElementById('obs-assignee').value = r?.assignee || '';
    document.getElementById('obs-due').value = r?.dueDate || '';
    document.getElementById('obs-status').value = r?.status || 'open';
    document.getElementById('obs-photo').value = r?.photoUrl || '';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
window.pdSaveObs = async function (pid) {
    const title = document.getElementById('obs-title')?.value.trim();
    if (!title) { toast('أدخل عنوان الملاحظة', 'er'); return; }
    const key = document.getElementById('pd-obs-key')?.value;
    const data = {
        kind: 'observation', title, category: document.getElementById('obs-cat')?.value || 'safety',
        priority: document.getElementById('obs-priority')?.value || 'normal',
        location: document.getElementById('obs-loc')?.value.trim() || '', observedBy: document.getElementById('obs-by')?.value.trim() || '',
        date: document.getElementById('obs-date')?.value || '', description: document.getElementById('obs-desc')?.value.trim() || '',
        correctiveAction: document.getElementById('obs-action')?.value.trim() || '', assignee: document.getElementById('obs-assignee')?.value.trim() || '',
        dueDate: document.getElementById('obs-due')?.value || '', status: document.getElementById('obs-status')?.value || 'open',
        photoUrl: document.getElementById('obs-photo')?.value.trim() || '', updatedAt: new Date().toISOString()
    };
    try {
        if (key) { await update(ref(db, `ledger/qhse/${pid}/${key}`), data); toast('تم التحديث ✓', 'ok'); }
        else {
            data.number = pdNextNum('OBS', Object.fromEntries(Object.entries((window.qhse || {})[pid] || {}).filter(([, r]) => r.kind === 'observation')));
            data.createdAt = new Date().toISOString(); data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/qhse/${pid}`), data); toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-obs-form').style.display = 'none';
        setTimeout(() => pdRenderTab('qhse'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

// ── 🚨 الحوادث والإصابات (HSE Incidents) ──
function pdRenderIncidents(pid) {
    const host = document.getElementById('pd-qhse-sub'), fh = document.getElementById('pd-qhse-formwrap'); if (!host) return;
    const items = Object.entries((window.qhse || {})[pid] || {}).filter(([, r]) => r.kind === 'incident').sort((a, b) => (b[1].date || '').localeCompare(a[1].date || ''));
    let cOpen = 0, cInjury = 0, cInvest = 0;
    items.forEach(([, r]) => { if (r.status !== 'closed') cOpen++; if (r.itype === 'injury') cInjury++; if (r.status === 'investigating') cInvest++; });
    const flt = window._pdQhseFilter;
    const shown = items.filter(([, r]) => flt === 'all' ? true : r.status === flt);
    host.innerHTML = `
        <div style="background:#fdecea;border:1px solid #f5b7b1;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:11px;color:#922b21">🚨 سجّل كل حادث أو إصابة أو حالة وشيكة (Near Miss) فور وقوعها — سجل السلامة مطلب تعاقدي في المشاريع الكبرى.</div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn b-r" onclick="pdOpenIncForm('${pid}')">➕ تسجيل حادث</button></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            ${pdFiStat('الإجمالي', items.length, '#2d6a9f')}${pdFiStat('غير مغلقة', cOpen, '#e67e22')}${pdFiStat('تحت التحقيق', cInvest, '#e67e22')}${pdFiStat('إصابات', cInjury, '#c0392b')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${pdFiltChip(flt, 'all', 'الكل', 'pdSetQhseFilter')}${pdFiltChip(flt, 'open', 'مفتوحة', 'pdSetQhseFilter')}${pdFiltChip(flt, 'investigating', 'تحت التحقيق', 'pdSetQhseFilter')}${pdFiltChip(flt, 'closed', 'مغلقة', 'pdSetQhseFilter')}
        </div>
        ${shown.length === 0 ? '<div class="empty"><div class="ei">🚨</div><p>لا حوادث مسجّلة — نتمنّى بقاءها صفراً ✅</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
        ${shown.map(([k, r]) => {
        const [sl, sc, sbg] = PD_INC_STATUS[r.status] || PD_INC_STATUS.open;
        const [pl, pc] = PD_PRIORITY[r.priority] || PD_PRIORITY.normal;
        const tp = PD_INC_TYPE[r.itype] || r.itype || '';
        return `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:10px;padding:14px;border-right:4px solid ${sc}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-family:monospace;font-weight:800;color:#1a3a5c;background:#eef3f8;padding:2px 8px;border-radius:6px">${r.number || ''}</span>
                        <span style="font-size:14px;font-weight:800;color:#1a3a5c">${r.title || '—'}</span>
                        ${tp ? `<span style="background:#fdecea;color:#c0392b;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${tp}</span>` : ''}
                        <span style="background:${sbg};color:${sc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${sl}</span>
                        <span style="background:${pc}22;color:${pc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${pl}</span>
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="pdOpenIncForm('${pid}','${k}')">✏️</button>
                        ${r.status !== 'closed' ? `<button class="btn" style="padding:3px 8px;font-size:11px;background:#eafaf1;color:#1e8449;border:1px solid #a9dfbf" onclick="pdCloseQhse('${pid}','${k}')">✅ إغلاق</button>` : ''}
                        <button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="pdDeleteQhse('${pid}','${k}')">🗑️</button>
                    </div>
                </div>
                ${r.description ? `<div style="font-size:12.5px;color:#444;margin-top:8px;line-height:1.7">${r.description.replace(/\n/g, '<br>')}</div>` : ''}
                ${r.rootCause ? `<div style="font-size:12px;color:#555;margin-top:6px"><b>السبب الجذري:</b> ${r.rootCause}</div>` : ''}
                ${r.correctiveAction ? `<div style="background:#f6f9f2;border-radius:8px;padding:8px 10px;margin-top:8px;border-right:3px solid #27ae60;font-size:12px;color:#333"><b style="color:#1e8449">الإجراء التصحيحي:</b> ${r.correctiveAction.replace(/\n/g, '<br>')}</div>` : ''}
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#888;margin-top:8px">
                    ${r.location ? `<span>📍 ${r.location}</span>` : ''}${r.date ? `<span>📅 ${r.date}${r.time ? ` ${r.time}` : ''}</span>` : ''}${r.injuredPerson ? `<span>🤕 ${r.injuredPerson}</span>` : ''}${r.reportedBy ? `<span>📝 ${r.reportedBy}</span>` : ''}${r.photoUrl ? `<a href="${r.photoUrl}" target="_blank" style="color:#2980b9;font-weight:700">🖼️ صورة</a>` : ''}
                </div>
            </div>`;
    }).join('')}
        </div>`}`;
    if (fh) fh.innerHTML = pdIncFormHtml(pid);
}
function pdIncFormHtml(pid) {
    return `<div id="pd-inc-form" style="display:none;background:#fff;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #c0392b">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-inc-form-title">🚨 تسجيل حادث</div>
        <input type="hidden" id="pd-inc-key">
        <div style="display:grid;grid-template-columns:1fr 160px 140px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">عنوان الحادث *</label><input id="inc-title" placeholder="وصف مختصر" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">النوع</label><select id="inc-type" style="${inputStyle()}"><option value="near_miss">وشيك الحدوث</option><option value="first_aid">إسعاف أولي</option><option value="injury">إصابة</option><option value="property">أضرار ممتلكات</option><option value="environmental">بيئي</option></select></div>
            <div><label style="${lblStyle()}">الخطورة</label><select id="inc-priority" style="${inputStyle()}"><option value="normal">متوسطة</option><option value="high">عالية</option><option value="urgent">حرجة</option><option value="low">بسيطة</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 130px 110px 1fr;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">الموقع</label><input id="inc-loc" placeholder="مكان الحادث" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التاريخ</label><input type="date" id="inc-date" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الوقت</label><input type="time" id="inc-time" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">المصاب (إن وُجد)</label><input id="inc-injured" placeholder="اسم المصاب" style="${inputStyle()}"></div>
        </div>
        <div style="margin-bottom:10px"><label style="${lblStyle()}">وصف الحادث</label><textarea id="inc-desc" rows="2" placeholder="ماذا حدث بالتفصيل..." style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="margin-bottom:10px"><label style="${lblStyle()}">السبب الجذري</label><input id="inc-root" placeholder="تحليل سبب الحادث" style="${inputStyle()}"></div>
        <div style="margin-bottom:10px"><label style="${lblStyle()}">الإجراء التصحيحي/الوقائي</label><textarea id="inc-action" rows="2" placeholder="لمنع التكرار..." style="${inputStyle('resize:vertical')}"></textarea></div>
        <div style="display:grid;grid-template-columns:1fr 160px 1fr;gap:10px;margin-bottom:12px">
            <div><label style="${lblStyle()}">مُبلِّغ الحادث</label><input id="inc-by" placeholder="اسم المُبلِّغ" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الحالة</label><select id="inc-status" style="${inputStyle()}"><option value="open">🔴 مفتوح</option><option value="investigating">🟠 تحت التحقيق</option><option value="closed">🟢 مغلق</option></select></div>
            <div><label style="${lblStyle()}">رابط صورة (اختياري)</label><input id="inc-photo" placeholder="https://..." style="${inputStyle()}"></div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveInc('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-inc-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}
window.pdOpenIncForm = function (pid, key = null) {
    const form = document.getElementById('pd-inc-form'); if (!form) return;
    form.style.display = ''; document.getElementById('pd-inc-key').value = key || '';
    document.getElementById('pd-inc-form-title').textContent = key ? '✏️ تعديل الحادث' : '🚨 تسجيل حادث';
    const r = key ? ((window.qhse || {})[pid] || {})[key] : null;
    document.getElementById('inc-title').value = r?.title || '';
    document.getElementById('inc-type').value = r?.itype || 'near_miss';
    document.getElementById('inc-priority').value = r?.priority || 'normal';
    document.getElementById('inc-loc').value = r?.location || '';
    document.getElementById('inc-date').value = r?.date || new Date().toISOString().slice(0, 10);
    document.getElementById('inc-time').value = r?.time || '';
    document.getElementById('inc-injured').value = r?.injuredPerson || '';
    document.getElementById('inc-desc').value = r?.description || '';
    document.getElementById('inc-root').value = r?.rootCause || '';
    document.getElementById('inc-action').value = r?.correctiveAction || '';
    document.getElementById('inc-by').value = r?.reportedBy || '';
    document.getElementById('inc-status').value = r?.status || 'open';
    document.getElementById('inc-photo').value = r?.photoUrl || '';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
window.pdSaveInc = async function (pid) {
    const title = document.getElementById('inc-title')?.value.trim();
    if (!title) { toast('أدخل عنوان الحادث', 'er'); return; }
    const key = document.getElementById('pd-inc-key')?.value;
    const data = {
        kind: 'incident', title, itype: document.getElementById('inc-type')?.value || 'near_miss',
        priority: document.getElementById('inc-priority')?.value || 'normal',
        location: document.getElementById('inc-loc')?.value.trim() || '', date: document.getElementById('inc-date')?.value || '',
        time: document.getElementById('inc-time')?.value || '', injuredPerson: document.getElementById('inc-injured')?.value.trim() || '',
        description: document.getElementById('inc-desc')?.value.trim() || '', rootCause: document.getElementById('inc-root')?.value.trim() || '',
        correctiveAction: document.getElementById('inc-action')?.value.trim() || '', reportedBy: document.getElementById('inc-by')?.value.trim() || '',
        status: document.getElementById('inc-status')?.value || 'open', photoUrl: document.getElementById('inc-photo')?.value.trim() || '',
        updatedAt: new Date().toISOString()
    };
    try {
        if (key) { await update(ref(db, `ledger/qhse/${pid}/${key}`), data); toast('تم التحديث ✓', 'ok'); }
        else {
            data.number = pdNextNum('INC', Object.fromEntries(Object.entries((window.qhse || {})[pid] || {}).filter(([, r]) => r.kind === 'incident')));
            data.createdAt = new Date().toISOString(); data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/qhse/${pid}`), data); toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-inc-form').style.display = 'none';
        setTimeout(() => pdRenderTab('qhse'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

// إغلاق/حذف موحّد لسجلات QHSE
window.pdCloseQhse = function (pid, key) {
    cf2('إغلاق هذا السجل؟', async () => {
        try { await update(ref(db, `ledger/qhse/${pid}/${key}`), { status: 'closed', updatedAt: new Date().toISOString() }); toast('تم الإغلاق', 'ok'); setTimeout(() => pdRenderTab('qhse'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};
window.pdDeleteQhse = function (pid, key) {
    cf2('حذف هذا السجل نهائياً؟', async () => {
        try { await remove(ref(db, `ledger/qhse/${pid}/${key}`)); toast('تم الحذف', 'ok'); setTimeout(() => pdRenderTab('qhse'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — 📋 المستندات الفنية (Submittals): شوب دروينج · اعتماد مواد · عينات   ║
// ║   دورة تقديم/مراجعة/اعتماد بترقيم ومراجعات ومهل — بيانات فقط (روابط ملفات).  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const PD_SUB_STATUS = {
    draft: ['📝 مسودة', '#7f8c8d', '#f1f3f5'],
    submitted: ['📤 مُقدَّم', '#2980b9', '#eaf2fb'],
    under_review: ['🔍 قيد المراجعة', '#e67e22', '#fef5e7'],
    approved: ['✅ معتمد', '#27ae60', '#eafaf1'],
    approved_noted: ['🟢 معتمد مع ملاحظات', '#16a085', '#e8f8f5'],
    rejected: ['❌ مرفوض', '#c0392b', '#fdecea'],
    resubmit: ['🔄 إعادة تقديم', '#8e44ad', '#f4ecf7'],
};
const PD_SUB_TYPE = { shop_drawing: 'شوب دروينج', material: 'اعتماد مواد', sample: 'عينة', method: 'طريقة عمل', other: 'أخرى' };
const pdSubSettled = r => r.status === 'approved' || r.status === 'approved_noted';

window._pdSubFilter = window._pdSubFilter || 'all';
window.pdSetSubFilter = function (f) { window._pdSubFilter = f; pdRenderSubmittals(window._pd.projectId); };

function pdRenderSubmittals(pid) {
    const pane = document.getElementById('pd-tab-submittals'); if (!pane) return;
    const all = Object.entries((window.submittals || {})[pid] || {}).sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));
    const today = new Date().toISOString().slice(0, 10);
    const isOv = r => !pdSubSettled(r) && r.status !== 'draft' && r.status !== 'rejected' && r.dueDate && r.dueDate < today;
    let cReview = 0, cAppr = 0, cOv = 0;
    all.forEach(([, r]) => { if (r.status === 'submitted' || r.status === 'under_review' || r.status === 'resubmit') cReview++; if (pdSubSettled(r)) cAppr++; if (isOv(r)) cOv++; });
    const flt = window._pdSubFilter;
    const shown = all.filter(([, r]) => flt === 'all' ? true : flt === 'overdue' ? isOv(r) : flt === 'approved' ? pdSubSettled(r) : flt === 'review' ? (r.status === 'submitted' || r.status === 'under_review' || r.status === 'resubmit') : r.status === flt);
    pane.innerHTML = `
    <div class="card">
        <div class="tlb"><div class="c-tl" style="margin:0;border:none;padding:0">📋 المستندات الفنية (Submittals)</div>
            <button class="btn b-g" onclick="pdOpenSubForm('${pid}')">➕ مستند فني جديد</button></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
            ${pdFiStat('الإجمالي', all.length, '#2d6a9f')}${pdFiStat('قيد المراجعة', cReview, '#e67e22')}${pdFiStat('متأخرة', cOv, '#c0392b')}${pdFiStat('معتمدة', cAppr, '#27ae60')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${pdFiltChip(flt, 'all', 'الكل', 'pdSetSubFilter')}${pdFiltChip(flt, 'review', 'قيد المراجعة', 'pdSetSubFilter')}${pdFiltChip(flt, 'overdue', '⏰ متأخرة', 'pdSetSubFilter')}${pdFiltChip(flt, 'approved', 'معتمدة', 'pdSetSubFilter')}${pdFiltChip(flt, 'rejected', 'مرفوضة', 'pdSetSubFilter')}${pdFiltChip(flt, 'draft', 'مسودّات', 'pdSetSubFilter')}
        </div>
        ${shown.length === 0 ? '<div class="empty"><div class="ei">📋</div><p>لا توجد مستندات فنية في هذا التصنيف</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
        ${shown.map(([k, r]) => {
        const [sl, sc, sbg] = PD_SUB_STATUS[r.status] || PD_SUB_STATUS.draft;
        const [pl, pc] = PD_PRIORITY[r.priority] || PD_PRIORITY.normal;
        const ov = isOv(r);
        return `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:10px;padding:14px;border-right:4px solid ${ov ? '#c0392b' : sc}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-family:monospace;font-weight:800;color:#1a3a5c;background:#eef3f8;padding:2px 8px;border-radius:6px">${r.number || ''}${r.revision ? ` · ${r.revision}` : ''}</span>
                        <span style="font-size:14px;font-weight:800;color:#1a3a5c">${r.title || '—'}</span>
                        ${r.subType ? `<span style="background:#eef3f8;color:#555;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${PD_SUB_TYPE[r.subType] || r.subType}</span>` : ''}
                        <span style="background:${sbg};color:${sc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${sl}</span>
                        <span style="background:${pc}22;color:${pc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${pl}</span>
                        ${ov ? '<span style="background:#fdecea;color:#c0392b;padding:2px 9px;border-radius:7px;font-size:11px;font-weight:800">⏰ متأخر</span>' : ''}
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn b-b" style="padding:3px 8px;font-size:11px" onclick="pdOpenSubForm('${pid}','${k}')">✏️ مراجعة/تعديل</button>
                        ${!pdSubSettled(r) ? `<button class="btn" style="padding:3px 8px;font-size:11px;background:#eafaf1;color:#1e8449;border:1px solid #a9dfbf" onclick="pdApproveSub('${pid}','${k}')">✅ اعتماد</button>` : ''}
                        <button class="btn b-r" style="padding:3px 8px;font-size:11px" onclick="pdDeleteSub('${pid}','${k}')">🗑️</button>
                    </div>
                </div>
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#888;margin-top:8px">
                    ${r.specSection ? `<span>📑 بند: ${r.specSection}</span>` : ''}${r.discipline ? `<span>🏷️ ${r.discipline}</span>` : ''}${r.submittedTo ? `<span>👤 للمراجعة: ${r.submittedTo}</span>` : ''}${r.submittedDate ? `<span>📤 قُدّم: ${r.submittedDate}</span>` : ''}${r.dueDate ? `<span style="color:${ov ? '#c0392b' : '#888'}">📅 المهلة: ${r.dueDate}</span>` : ''}${r.fileUrl ? `<a href="${r.fileUrl}" target="_blank" style="color:#2980b9;font-weight:700">📎 الملف/المخطط</a>` : ''}
                </div>
                ${r.reviewNotes ? `<div style="background:#f8f9fb;border-radius:8px;padding:10px;margin-top:10px;border-right:3px solid ${sc}"><div style="font-size:11px;font-weight:800;color:${sc};margin-bottom:3px">🗒️ ملاحظات المراجعة${r.reviewer ? ` — ${r.reviewer}` : ''}${r.returnedDate ? ` (${r.returnedDate})` : ''}</div><div style="font-size:12.5px;color:#333;line-height:1.7">${r.reviewNotes.replace(/\n/g, '<br>')}</div></div>` : ''}
            </div>`;
    }).join('')}
        </div>`}
    </div>
    ${pdSubFormHtml(pid)}`;
}

function pdSubFormHtml(pid) {
    const disc = ['معماري', 'إنشائي', 'كهرباء', 'ميكانيكا', 'صحي', 'تكييف', 'مدني', 'أخرى'];
    return `<div id="pd-sub-form" style="display:none;background:#fff;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #8e44ad">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-sub-form-title">📋 مستند فني جديد</div>
        <input type="hidden" id="pd-sub-key">
        <div style="display:grid;grid-template-columns:1fr 150px 140px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">العنوان *</label><input id="sub-title" placeholder="مثال: مخطط تسليح الأساسات" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">النوع</label><select id="sub-type" style="${inputStyle()}"><option value="shop_drawing">شوب دروينج</option><option value="material">اعتماد مواد</option><option value="sample">عينة</option><option value="method">طريقة عمل</option><option value="other">أخرى</option></select></div>
            <div><label style="${lblStyle()}">الأولوية</label><select id="sub-priority" style="${inputStyle()}"><option value="normal">عادية</option><option value="high">عالية</option><option value="urgent">عاجلة</option><option value="low">منخفضة</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 120px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">التخصص</label><select id="sub-disc" style="${inputStyle()}">${disc.map(d => `<option>${d}</option>`).join('')}</select></div>
            <div><label style="${lblStyle()}">بند المواصفات (Spec)</label><input id="sub-spec" placeholder="مثال: 03 30 00" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">المراجعة</label><input id="sub-rev" placeholder="Rev 0" style="${inputStyle()}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 150px 150px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">مُقدَّم إلى (المُراجِع)</label><input id="sub-to" placeholder="الاستشاري / المكتب الهندسي" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">تاريخ التقديم</label><input type="date" id="sub-subdate" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">مهلة الرد</label><input type="date" id="sub-due" style="${inputStyle()}"></div>
        </div>
        <div style="margin-bottom:12px"><label style="${lblStyle()}">رابط الملف/المخطط (اختياري)</label><input id="sub-file" placeholder="https://... رابط ملف PDF أو المخطط" style="${inputStyle()}"></div>
        <div style="border-top:1px dashed #d0d7e0;padding-top:12px;margin-bottom:12px">
            <div style="font-size:12px;font-weight:800;color:#8e44ad;margin-bottom:8px">🗒️ المراجعة والحالة</div>
            <div style="display:grid;grid-template-columns:180px 1fr 150px;gap:10px;margin-bottom:10px">
                <div><label style="${lblStyle()}">الحالة</label><select id="sub-status" style="${inputStyle()}"><option value="draft">📝 مسودة</option><option value="submitted">📤 مُقدَّم</option><option value="under_review">🔍 قيد المراجعة</option><option value="approved">✅ معتمد</option><option value="approved_noted">🟢 معتمد مع ملاحظات</option><option value="rejected">❌ مرفوض</option><option value="resubmit">🔄 إعادة تقديم</option></select></div>
                <div><label style="${lblStyle()}">المُراجِع (من ردّ)</label><input id="sub-reviewer" placeholder="اسم المُراجِع" style="${inputStyle()}"></div>
                <div><label style="${lblStyle()}">تاريخ الإعادة</label><input type="date" id="sub-retdate" style="${inputStyle()}"></div>
            </div>
            <div><label style="${lblStyle()}">ملاحظات المراجعة</label><textarea id="sub-notes" rows="2" placeholder="ملاحظات المُراجِع على المستند..." style="${inputStyle('resize:vertical')}"></textarea></div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveSub('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-sub-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}

window.pdOpenSubForm = function (pid, key = null) {
    const form = document.getElementById('pd-sub-form'); if (!form) return;
    form.style.display = ''; document.getElementById('pd-sub-key').value = key || '';
    document.getElementById('pd-sub-form-title').textContent = key ? '✏️ مراجعة / تعديل المستند' : '📋 مستند فني جديد';
    const r = key ? ((window.submittals || {})[pid] || {})[key] : null;
    document.getElementById('sub-title').value = r?.title || '';
    document.getElementById('sub-type').value = r?.subType || 'shop_drawing';
    document.getElementById('sub-priority').value = r?.priority || 'normal';
    document.getElementById('sub-disc').value = r?.discipline || 'معماري';
    document.getElementById('sub-spec').value = r?.specSection || '';
    document.getElementById('sub-rev').value = r?.revision || 'Rev 0';
    document.getElementById('sub-to').value = r?.submittedTo || '';
    document.getElementById('sub-subdate').value = r?.submittedDate || '';
    document.getElementById('sub-due').value = r?.dueDate || '';
    document.getElementById('sub-file').value = r?.fileUrl || '';
    document.getElementById('sub-status').value = r?.status || 'draft';
    document.getElementById('sub-reviewer').value = r?.reviewer || '';
    document.getElementById('sub-retdate').value = r?.returnedDate || '';
    document.getElementById('sub-notes').value = r?.reviewNotes || '';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSaveSub = async function (pid) {
    const title = document.getElementById('sub-title')?.value.trim();
    if (!title) { toast('أدخل عنوان المستند', 'er'); return; }
    const key = document.getElementById('pd-sub-key')?.value;
    const status = document.getElementById('sub-status')?.value || 'draft';
    const reviewNotes = document.getElementById('sub-notes')?.value.trim() || '';
    let returnedDate = document.getElementById('sub-retdate')?.value || '';
    const terminal = ['approved', 'approved_noted', 'rejected', 'resubmit'];
    if (terminal.includes(status) && !returnedDate) returnedDate = new Date().toISOString().slice(0, 10);
    const data = {
        title, subType: document.getElementById('sub-type')?.value || 'shop_drawing',
        priority: document.getElementById('sub-priority')?.value || 'normal',
        discipline: document.getElementById('sub-disc')?.value || '',
        specSection: document.getElementById('sub-spec')?.value.trim() || '',
        revision: document.getElementById('sub-rev')?.value.trim() || 'Rev 0',
        submittedTo: document.getElementById('sub-to')?.value.trim() || '',
        submittedDate: document.getElementById('sub-subdate')?.value || '',
        dueDate: document.getElementById('sub-due')?.value || '',
        fileUrl: document.getElementById('sub-file')?.value.trim() || '',
        status, reviewer: document.getElementById('sub-reviewer')?.value.trim() || '',
        returnedDate, reviewNotes, updatedAt: new Date().toISOString()
    };
    try {
        if (key) { await update(ref(db, `ledger/submittals/${pid}/${key}`), data); toast('تم التحديث ✓', 'ok'); }
        else {
            data.number = pdNextNum('SUB', (window.submittals || {})[pid]);
            data.createdAt = new Date().toISOString(); data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/submittals/${pid}`), data); toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-sub-form').style.display = 'none';
        setTimeout(() => pdRenderTab('submittals'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};
window.pdApproveSub = function (pid, key) {
    cf2('اعتماد هذا المستند الفني؟', async () => {
        try { await update(ref(db, `ledger/submittals/${pid}/${key}`), { status: 'approved', returnedDate: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() }); toast('تم الاعتماد ✓', 'ok'); setTimeout(() => pdRenderTab('submittals'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};
window.pdDeleteSub = function (pid, key) {
    cf2('حذف المستند الفني نهائياً؟', async () => {
        try { await remove(ref(db, `ledger/submittals/${pid}/${key}`)); toast('تم الحذف', 'ok'); setTimeout(() => pdRenderTab('submittals'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — 🤝 عقود الباطن (Subcontracts / Commitments)                        ║
// ║   قيمة عقد + أوامر تغيير + مستخلصات باطن (شهادات دفع) بالضمان واسترداد الدفعة ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const PD_SUBC_STATUS = { active: ['🟢 ساري', '#27ae60', '#eafaf1'], completed: ['🔵 منجز', '#2980b9', '#eaf2fb'], terminated: ['🔴 مفسوخ', '#c0392b', '#fdecea'] };
const PD_CERT_STATUS = { submitted: ['📤 مُقدَّم', '#e67e22'], approved: ['✅ معتمد', '#2980b9'], paid: ['💰 مدفوع', '#27ae60'] };
window._pdSubcCO = window._pdSubcCO || [];
window._pdCertPct = 10;

function pdSubcMini(l, v, color) { return `<div style="background:#f8fafc;border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:#888">${l}</div><div style="font-size:14px;font-weight:800;color:${color || '#1a3a5c'};font-variant-numeric:tabular-nums">${v}</div></div>`; }
function pdSubcCoRows() {
    const rows = window._pdSubcCO || [];
    if (!rows.length) return '<div style="color:#aaa;font-size:12px;padding:4px 0">— لا أوامر تغيير —</div>';
    return rows.map((c, i) => `<div style="display:flex;gap:6px;margin-bottom:5px">
        <input value="${(c.desc || '').replace(/"/g, '&quot;')}" placeholder="وصف أمر التغيير" oninput="window._pdSubcCO[${i}].desc=this.value" style="flex:1;padding:8px;border:1.5px solid #d0d7e0;border-radius:7px;font-family:inherit;font-size:12.5px">
        <input type="number" value="${c.amount ?? ''}" placeholder="القيمة (±)" oninput="window._pdSubcCO[${i}].amount=this.value" style="flex:0 0 120px;padding:8px;border:1.5px solid #d0d7e0;border-radius:7px;font-family:inherit;font-size:12.5px">
        <input type="date" value="${c.date || ''}" oninput="window._pdSubcCO[${i}].date=this.value" style="flex:0 0 140px;padding:8px;border:1.5px solid #d0d7e0;border-radius:7px;font-family:inherit;font-size:12.5px">
        <button class="btn b-r" style="padding:4px 9px" onclick="window._pdSubcCO.splice(${i},1);document.getElementById('pd-subc-co').innerHTML=pdSubcCoRows()">🗑️</button>
    </div>`).join('');
}
window.pdSubcCoAdd = function () { window._pdSubcCO.push({}); document.getElementById('pd-subc-co').innerHTML = pdSubcCoRows(); };

function pdRenderSubcontracts(pid) {
    const pane = document.getElementById('pd-tab-subcontracts'); if (!pane) return;
    window._pdSubcCO = [];
    const contracts = Object.entries((window.subcontracts || {})[pid] || {}).sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));
    const subs = window.subcontractors || {};
    const nameOf = c => c.subName || subs[c.subId]?.name || subs[c.subId]?.nameAr || 'مقاول';
    let tAdj = 0, tCert = 0, tRet = 0, tNet = 0;
    contracts.forEach(([, c]) => {
        const coNet = (c.changeOrders || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        const certs = c.certificates || [];
        tAdj += (parseFloat(c.contractValue) || 0) + coNet;
        tCert += certs.reduce((s, x) => s + (parseFloat(x.periodValue) || 0), 0);
        tRet += certs.reduce((s, x) => s + (parseFloat(x.retentionAmt) || 0), 0);
        tNet += certs.reduce((s, x) => s + (parseFloat(x.netPayable) || 0), 0);
    });
    pane.innerHTML = `
    <div class="card">
        <div class="tlb"><div class="c-tl" style="margin:0;border:none;padding:0">🤝 عقود الباطن (Subcontracts)</div>
            <button class="btn b-g" onclick="pdOpenSubcForm('${pid}')">➕ عقد باطن جديد</button></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
            ${pdFiStat('عدد العقود', contracts.length, '#2d6a9f')}${pdFiStat('القيمة المعدّلة', fmt(tAdj), '#1a3a5c')}${pdFiStat('المعتمد (مستخلصات)', fmt(tCert), '#e67e22')}${pdFiStat('محتجز ضمان', fmt(tRet), '#8e44ad')}${pdFiStat('صافي مستحق', fmt(tNet), '#27ae60')}
        </div>
        ${contracts.length === 0 ? '<div class="empty"><div class="ei">🤝</div><p>لا عقود باطن — أضف أول عقد</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px">
        ${contracts.map(([k, c]) => {
        const [sl, sc, sbg] = PD_SUBC_STATUS[c.status] || PD_SUBC_STATUS.active;
        const coNet = (c.changeOrders || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        const adj = (parseFloat(c.contractValue) || 0) + coNet;
        const certs = Array.isArray(c.certificates) ? c.certificates : [];
        const certd = certs.reduce((s, x) => s + (parseFloat(x.periodValue) || 0), 0);
        const ret = certs.reduce((s, x) => s + (parseFloat(x.retentionAmt) || 0), 0);
        const net = certs.reduce((s, x) => s + (parseFloat(x.netPayable) || 0), 0);
        const pct = adj ? Math.min(100, Math.round(certd / adj * 100)) : 0;
        return `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:12px;padding:16px;border-right:4px solid ${sc}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:15px;font-weight:900;color:#1a3a5c">🤝 ${nameOf(c)}</span><span style="background:${sbg};color:${sc};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700">${sl}</span></div>
                        ${c.scope ? `<div style="font-size:12px;color:#666;margin-top:3px">${c.scope}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn b-b" style="padding:4px 9px;font-size:11px" onclick="pdOpenSubcForm('${pid}','${k}')">✏️ العقد</button>
                        <button class="btn" style="padding:4px 9px;font-size:11px;background:#eaf2fb;color:#2980b9;border:1px solid #aed6f1" onclick="pdOpenCertForm('${pid}','${k}')">➕ مستخلص</button>
                        <button class="btn b-r" style="padding:4px 9px;font-size:11px" onclick="pdDeleteSubc('${pid}','${k}')">🗑️</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px;margin-top:12px">
                    ${pdSubcMini('قيمة العقد', fmt(parseFloat(c.contractValue) || 0))}
                    ${coNet ? pdSubcMini('أوامر التغيير', (coNet >= 0 ? '+' : '') + fmt(coNet), coNet >= 0 ? '#0e6655' : '#c0392b') : ''}
                    ${pdSubcMini('القيمة المعدّلة', fmt(adj), '#1a3a5c')}
                    ${pdSubcMini('المعتمد', fmt(certd), '#e67e22')}
                    ${pdSubcMini('محتجز ضمان', fmt(ret), '#8e44ad')}
                    ${pdSubcMini('صافي مستحق', fmt(net), '#27ae60')}
                    ${pdSubcMini('المتبقي', fmt(adj - certd), '#555')}
                </div>
                <div style="margin-top:10px"><div style="background:#e8f0f7;border-radius:20px;height:8px;overflow:hidden"><div style="width:${pct}%;background:${pct > 90 ? '#e74c3c' : '#27ae60'};height:100%"></div></div><div style="font-size:11px;color:#888;margin-top:3px">الإنجاز المالي: ${pct}% (${fmt(certd)} من ${fmt(adj)}) · نسبة الضمان ${c.retentionPct ?? 10}%${c.advanceAmount ? ` · دفعة مقدمة ${fmt(parseFloat(c.advanceAmount) || 0)}` : ''}</div></div>
                ${certs.length ? `<div style="margin-top:12px;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:640px">
                    <thead><tr style="background:#f4f7fb;color:#555"><th style="padding:6px;text-align:right">المستخلص</th><th style="padding:6px">التاريخ</th><th style="padding:6px;text-align:left">قيمة الأعمال</th><th style="padding:6px;text-align:left">الضمان</th><th style="padding:6px;text-align:left">استرداد الدفعة</th><th style="padding:6px;text-align:left">الصافي</th><th style="padding:6px">الحالة</th><th style="padding:6px"></th></tr></thead>
                    <tbody>${certs.map((ct, ci) => { const [cl, cc] = PD_CERT_STATUS[ct.status] || PD_CERT_STATUS.submitted; return `<tr style="border-top:1px solid #eee">
                        <td style="padding:6px;font-weight:700;color:#1a3a5c">${ct.no || ('IPC-' + (ci + 1))}</td>
                        <td style="padding:6px;text-align:center;color:#666">${ct.date || ''}</td>
                        <td style="padding:6px;text-align:left">${fmt(parseFloat(ct.periodValue) || 0)}</td>
                        <td style="padding:6px;text-align:left;color:#8e44ad">(${fmt(parseFloat(ct.retentionAmt) || 0)})</td>
                        <td style="padding:6px;text-align:left;color:#c0392b">${ct.advanceRecovery ? '(' + fmt(parseFloat(ct.advanceRecovery) || 0) + ')' : '-'}</td>
                        <td style="padding:6px;text-align:left;font-weight:800;color:#27ae60">${fmt(parseFloat(ct.netPayable) || 0)}</td>
                        <td style="padding:6px;text-align:center"><span style="color:${cc};font-weight:700;font-size:11px">${cl}</span></td>
                        <td style="padding:6px;text-align:center;white-space:nowrap"><button class="btn b-b" style="padding:2px 6px;font-size:10px" onclick="pdOpenCertForm('${pid}','${k}',${ci})">✏️</button> <button class="btn b-r" style="padding:2px 6px;font-size:10px" onclick="pdDeleteCert('${pid}','${k}',${ci})">🗑️</button></td>
                    </tr>`; }).join('')}</tbody></table></div>` : ''}
            </div>`;
    }).join('')}
        </div>`}
    </div>
    ${pdSubcFormHtml(pid)}
    ${pdCertFormHtml(pid)}`;
    const co = document.getElementById('pd-subc-co'); if (co) co.innerHTML = pdSubcCoRows();
}

function pdSubcFormHtml(pid) {
    const subs = window.subcontractors || {};
    const opts = Object.entries(subs).map(([k, s]) => `<option value="${k}">${s.name || s.nameAr || k}</option>`).join('');
    return `<div id="pd-subc-form" style="display:none;background:#fff;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #16a085">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-subc-form-title">🤝 عقد باطن جديد</div>
        <input type="hidden" id="pd-subc-key">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">مقاول الباطن (من السجل)</label><select id="subc-party" style="${inputStyle()}"><option value="">— اختر أو أدخل يدوياً —</option>${opts}</select></div>
            <div><label style="${lblStyle()}">أو اسم يدوي</label><input id="subc-name" placeholder="اسم المقاول إن لم يكن مسجّلاً" style="${inputStyle()}"></div>
        </div>
        <div style="margin-bottom:10px"><label style="${lblStyle()}">نطاق العمل *</label><input id="subc-scope" placeholder="مثال: أعمال الكهرباء الكاملة" style="${inputStyle()}"></div>
        <div style="display:grid;grid-template-columns:1fr 120px 140px 150px;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">قيمة العقد *</label><input type="number" id="subc-value" placeholder="0.00" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الضمان %</label><input type="number" id="subc-ret" value="10" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الدفعة المقدمة</label><input type="number" id="subc-adv" placeholder="0" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الحالة</label><select id="subc-status" style="${inputStyle()}"><option value="active">🟢 ساري</option><option value="completed">🔵 منجز</option><option value="terminated">🔴 مفسوخ</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">تاريخ البدء</label><input type="date" id="subc-start" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">تاريخ الانتهاء</label><input type="date" id="subc-end" style="${inputStyle()}"></div>
        </div>
        <div style="border-top:1px dashed #d0d7e0;padding-top:12px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><label style="${lblStyle()};margin:0">🔄 أوامر التغيير على العقد</label><button class="btn b-b" style="padding:4px 10px;font-size:11px" onclick="pdSubcCoAdd()">➕ أمر تغيير</button></div>
            <div id="pd-subc-co"></div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveSubc('${pid}')">💾 حفظ العقد</button>
            <button class="btn" onclick="document.getElementById('pd-subc-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}
window.pdOpenSubcForm = function (pid, key = null) {
    const form = document.getElementById('pd-subc-form'); if (!form) return;
    form.style.display = ''; document.getElementById('pd-subc-key').value = key || '';
    document.getElementById('pd-subc-form-title').textContent = key ? '✏️ تعديل عقد الباطن' : '🤝 عقد باطن جديد';
    const c = key ? ((window.subcontracts || {})[pid] || {})[key] : null;
    document.getElementById('subc-party').value = c?.subId || '';
    document.getElementById('subc-name').value = c?.subName || '';
    document.getElementById('subc-scope').value = c?.scope || '';
    document.getElementById('subc-value').value = c?.contractValue || '';
    document.getElementById('subc-ret').value = c?.retentionPct ?? 10;
    document.getElementById('subc-adv').value = c?.advanceAmount || '';
    document.getElementById('subc-status').value = c?.status || 'active';
    document.getElementById('subc-start').value = c?.startDate || '';
    document.getElementById('subc-end').value = c?.endDate || '';
    window._pdSubcCO = (c && Array.isArray(c.changeOrders)) ? c.changeOrders.map(x => ({ ...x })) : [];
    document.getElementById('pd-subc-co').innerHTML = pdSubcCoRows();
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
window.pdSaveSubc = async function (pid) {
    const scope = document.getElementById('subc-scope')?.value.trim();
    const contractValue = parseFloat(document.getElementById('subc-value')?.value) || 0;
    const subId = document.getElementById('subc-party')?.value || '';
    const manual = document.getElementById('subc-name')?.value.trim() || '';
    const subName = manual || (window.subcontractors || {})[subId]?.name || (window.subcontractors || {})[subId]?.nameAr || '';
    if (!scope) { toast('أدخل نطاق العمل', 'er'); return; }
    if (!subId && !subName) { toast('اختر مقاول الباطن أو أدخل اسماً', 'er'); return; }
    if (!contractValue) { toast('أدخل قيمة العقد', 'er'); return; }
    const changeOrders = (window._pdSubcCO || []).filter(x => x.desc || x.amount).map(x => ({ desc: (x.desc || '').trim(), amount: parseFloat(x.amount) || 0, date: x.date || '' }));
    const data = {
        subId, subName, scope, contractValue,
        retentionPct: parseFloat(document.getElementById('subc-ret')?.value) || 0,
        advanceAmount: parseFloat(document.getElementById('subc-adv')?.value) || 0,
        status: document.getElementById('subc-status')?.value || 'active',
        startDate: document.getElementById('subc-start')?.value || '',
        endDate: document.getElementById('subc-end')?.value || '',
        changeOrders, updatedAt: new Date().toISOString()
    };
    const key = document.getElementById('pd-subc-key')?.value;
    try {
        if (key) { await update(ref(db, `ledger/subcontracts/${pid}/${key}`), data); toast('تم التحديث ✓', 'ok'); }
        else { data.certificates = []; data.createdAt = new Date().toISOString(); data.createdBy = window.curU?.uid || ''; await push(ref(db, `ledger/subcontracts/${pid}`), data); toast('تم حفظ العقد ✓', 'ok'); }
        document.getElementById('pd-subc-form').style.display = 'none';
        setTimeout(() => pdRenderTab('subcontracts'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};
window.pdDeleteSubc = function (pid, key) {
    cf2('حذف عقد الباطن وكل مستخلصاته نهائياً؟', async () => {
        try { await remove(ref(db, `ledger/subcontracts/${pid}/${key}`)); toast('تم الحذف', 'ok'); setTimeout(() => pdRenderTab('subcontracts'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ── مستخلصات الباطن (شهادات الدفع) ──
function pdCertFormHtml(pid) {
    return `<div id="pd-cert-form" style="display:none;background:#fff;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #2980b9">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-cert-form-title">➕ مستخلص باطن</div>
        <input type="hidden" id="pd-cert-contract"><input type="hidden" id="pd-cert-idx">
        <div style="display:grid;grid-template-columns:130px 150px 1fr;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">رقم المستخلص</label><input id="cert-no" placeholder="IPC-1" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">التاريخ</label><input type="date" id="cert-date" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">قيمة أعمال الفترة *</label><input type="number" id="cert-value" oninput="pdCertCalc()" placeholder="0.00" style="${inputStyle()}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">الضمان المحتجز <button type="button" onclick="pdCertAutoRet()" style="border:0;background:#eef3f8;color:#2980b9;border-radius:5px;padding:1px 7px;cursor:pointer;font-size:10px;font-weight:700">⟳ احسب</button></label><input type="number" id="cert-ret" oninput="pdCertCalc()" placeholder="0.00" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">استرداد الدفعة المقدمة</label><input type="number" id="cert-adv" oninput="pdCertCalc()" placeholder="0.00" style="${inputStyle()}"></div>
        </div>
        <div style="background:#eafaf1;border-radius:8px;padding:12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;font-weight:700;color:#1e8449">💰 الصافي المستحق للدفع</span>
            <span id="pd-cert-net" style="font-size:20px;font-weight:900;color:#27ae60;font-variant-numeric:tabular-nums">0.00</span>
        </div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:10px;margin-bottom:12px">
            <div><label style="${lblStyle()}">الحالة</label><select id="cert-status" style="${inputStyle()}"><option value="submitted">📤 مُقدَّم</option><option value="approved">✅ معتمد</option><option value="paid">💰 مدفوع</option></select></div>
            <div><label style="${lblStyle()}">ملاحظات</label><input id="cert-notes" placeholder="ملاحظات على المستخلص" style="${inputStyle()}"></div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveCert('${pid}')">💾 حفظ المستخلص</button>
            <button class="btn" onclick="document.getElementById('pd-cert-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}
window.pdCertCalc = function () {
    const v = parseFloat(document.getElementById('cert-value')?.value) || 0;
    const r = parseFloat(document.getElementById('cert-ret')?.value) || 0;
    const a = parseFloat(document.getElementById('cert-adv')?.value) || 0;
    const net = Math.round((v - r - a) * 100) / 100;
    const el = document.getElementById('pd-cert-net'); if (el) el.textContent = fmt(net);
};
window.pdCertAutoRet = function () {
    const v = parseFloat(document.getElementById('cert-value')?.value) || 0;
    document.getElementById('cert-ret').value = Math.round(v * (window._pdCertPct || 0) / 100 * 100) / 100;
    pdCertCalc();
};
window.pdOpenCertForm = function (pid, ck, idx = null) {
    const form = document.getElementById('pd-cert-form'); if (!form) return;
    const contract = ((window.subcontracts || {})[pid] || {})[ck]; if (!contract) { toast('العقد غير موجود', 'er'); return; }
    window._pdCertPct = contract.retentionPct ?? 10;
    const certs = Array.isArray(contract.certificates) ? contract.certificates : [];
    const ct = (idx !== null && idx !== '') ? certs[idx] : null;
    form.style.display = '';
    document.getElementById('pd-cert-contract').value = ck;
    document.getElementById('pd-cert-idx').value = (idx !== null && idx !== '') ? idx : '';
    document.getElementById('pd-cert-form-title').textContent = ct ? '✏️ تعديل مستخلص' : `➕ مستخلص باطن — ${contract.subName || 'مقاول'}`;
    document.getElementById('cert-no').value = ct?.no || ('IPC-' + (certs.length + 1));
    document.getElementById('cert-date').value = ct?.date || new Date().toISOString().slice(0, 10);
    document.getElementById('cert-value').value = ct?.periodValue || '';
    document.getElementById('cert-ret').value = ct?.retentionAmt || '';
    document.getElementById('cert-adv').value = ct?.advanceRecovery || '';
    document.getElementById('cert-status').value = ct?.status || 'submitted';
    document.getElementById('cert-notes').value = ct?.notes || '';
    pdCertCalc();
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
window.pdSaveCert = async function (pid) {
    const ck = document.getElementById('pd-cert-contract')?.value;
    const idxRaw = document.getElementById('pd-cert-idx')?.value;
    const contract = ((window.subcontracts || {})[pid] || {})[ck]; if (!contract) { toast('العقد غير موجود', 'er'); return; }
    const periodValue = parseFloat(document.getElementById('cert-value')?.value) || 0;
    if (!periodValue) { toast('أدخل قيمة أعمال الفترة', 'er'); return; }
    const retentionAmt = parseFloat(document.getElementById('cert-ret')?.value) || 0;
    const advanceRecovery = parseFloat(document.getElementById('cert-adv')?.value) || 0;
    const cert = {
        no: document.getElementById('cert-no')?.value.trim() || '', date: document.getElementById('cert-date')?.value || '',
        periodValue, retentionAmt, advanceRecovery, netPayable: Math.round((periodValue - retentionAmt - advanceRecovery) * 100) / 100,
        status: document.getElementById('cert-status')?.value || 'submitted', notes: document.getElementById('cert-notes')?.value.trim() || ''
    };
    const certs = Array.isArray(contract.certificates) ? contract.certificates.map(x => ({ ...x })) : [];
    if (idxRaw !== '' && idxRaw !== null && idxRaw !== undefined) certs[+idxRaw] = cert; else certs.push(cert);
    try {
        await update(ref(db, `ledger/subcontracts/${pid}/${ck}`), { certificates: certs, updatedAt: new Date().toISOString() });
        toast('تم حفظ المستخلص ✓', 'ok');
        document.getElementById('pd-cert-form').style.display = 'none';
        setTimeout(() => pdRenderTab('subcontracts'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};
window.pdDeleteCert = function (pid, ck, idx) {
    cf2('حذف هذا المستخلص؟', async () => {
        const contract = ((window.subcontracts || {})[pid] || {})[ck]; if (!contract) return;
        const certs = (Array.isArray(contract.certificates) ? contract.certificates : []).filter((_, i) => i !== idx);
        try { await update(ref(db, `ledger/subcontracts/${pid}/${ck}`), { certificates: certs, updatedAt: new Date().toISOString() }); toast('تم الحذف', 'ok'); setTimeout(() => pdRenderTab('subcontracts'), 300); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — 💧 التدفق النقدي للمشروع (Cash Flow S-Curve)                        ║
// ║   منحنى تراكمي: المخطط · الإيراد الفعلي (مستخلصات العميل) · التكلفة الفعلية.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function pdMonthBuckets(startYM, endYM) {
    const b = []; let y = +startYM.slice(0, 4), m = +startYM.slice(5, 7);
    const ey = +endYM.slice(0, 4), em = +endYM.slice(5, 7); let g = 0;
    while ((y < ey || (y === ey && m <= em)) && g++ < 120) { b.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
    return b;
}
function pdKfmt(v) { const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'م'; if (a >= 1000) return Math.round(v / 1000) + 'ألف'; return Math.round(v).toString(); }
const PD_MON_AR = ['', 'ينا', 'فبر', 'مار', 'أبر', 'مايو', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس'];
function pdMonLabel(ym) { return `${PD_MON_AR[+ym.slice(5, 7)]} ${ym.slice(2, 4)}`; }

// رسم SVG خطي متعدد السلاسل (بلا مكتبات)
function pdLineChart(xLabels, series) {
    const n = xLabels.length; if (!n) return '';
    const W = Math.max(600, n * 56), H = 300, pad = { l: 64, r: 14, t: 14, b: 52 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const maxY = Math.max(1, ...series.flatMap(s => s.points)); const top = maxY * 1.12;
    const X = i => pad.l + (n <= 1 ? iw / 2 : iw * i / (n - 1));
    const Y = v => pad.t + ih - (v / top) * ih;
    let grid = '';
    for (let g = 0; g <= 4; g++) { const gy = pad.t + ih * g / 4; const val = top * (4 - g) / 4; grid += `<line x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}" stroke="#e6ebf0" stroke-width="1"/><text x="${pad.l - 8}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#999">${pdKfmt(val)}</text>`; }
    const step = Math.ceil(n / 12);
    let xlab = '';
    xLabels.forEach((lb, i) => { if (i % step === 0 || i === n - 1) xlab += `<text x="${X(i)}" y="${H - pad.b + 18}" text-anchor="middle" font-size="10" fill="#888">${lb}</text>`; });
    const paths = series.map(s => {
        const d = s.points.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
        const dots = s.points.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.5" fill="${s.color}"/>`).join('');
        return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dash ? 'stroke-dasharray="6 4"' : ''}/>${dots}`;
    }).join('');
    const legend = series.map(s => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#555"><span style="width:16px;height:3px;background:${s.color};border-radius:2px;${s.dash ? 'background:repeating-linear-gradient(90deg,' + s.color + ' 0 5px,transparent 5px 8px)' : ''}"></span>${s.label}</span>`).join('');
    return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;min-width:${Math.min(W, 600)}px">${grid}${xlab}${paths}</svg></div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center;margin-top:8px">${legend}</div>`;
}

function pdRenderCashflow(pid) {
    const pane = document.getElementById('pd-tab-cashflow'); if (!pane) return;
    const p = (window.projects || {})[pid]; if (!p) { pane.innerHTML = '<div class="card"><div class="empty"><div class="ei">💧</div><p>المشروع غير موجود</p></div></div>'; return; }
    const today = new Date().toISOString().slice(0, 10);
    const plannedTotal = (typeof pdAdjustedContract === 'function' ? pdAdjustedContract(pid) : (parseFloat(p.contractValue) || 0));

    // مصادر مؤرّخة: إيراد (مستخلصات العميل) · تكلفة (فواتير موردين + مستخلصات باطن)
    const inflow = [];   // {date, amount}
    Object.values(window.progressBillings || {}).forEach(b => { if (b.projectId === pid && b.status !== 'cancelled') inflow.push({ date: (b.billingDate || b.date || '').slice(0, 10), amount: parseFloat(b.currentAmount) || 0 }); });
    const outflow = [];
    Object.values(window.supplierInvoices || {}).forEach(inv => { if (inv.projectId === pid) outflow.push({ date: (inv.invoiceDate || inv.date || '').slice(0, 10), amount: parseFloat(inv.totalAmount) || parseFloat(inv.grandTotal) || 0 }); });
    Object.values((window.subcontracts || {})[pid] || {}).forEach(c => { (c.certificates || []).forEach(ct => outflow.push({ date: (ct.date || '').slice(0, 10), amount: parseFloat(ct.periodValue) || 0 })); });

    const allDates = [...inflow, ...outflow].map(x => x.date).filter(Boolean);
    let startYM = (p.startDate || '').slice(0, 7) || (allDates.length ? allDates.slice().sort()[0].slice(0, 7) : today.slice(0, 7));
    let endYM = today.slice(0, 7);
    [p.endDate, ...allDates].filter(Boolean).forEach(d => { const ym = d.slice(0, 7); if (ym > endYM) endYM = ym; });
    if (startYM > endYM) endYM = startYM;
    const buckets = pdMonthBuckets(startYM, endYM);
    const idxOf = ym => { let bi = 0; for (let i = 0; i < buckets.length; i++) if (buckets[i] <= ym) bi = i; return bi; };

    const inMonthly = new Array(buckets.length).fill(0), outMonthly = new Array(buckets.length).fill(0);
    inflow.forEach(x => { if (x.date) inMonthly[idxOf(x.date.slice(0, 7))] += x.amount; });
    outflow.forEach(x => { if (x.date) outMonthly[idxOf(x.date.slice(0, 7))] += x.amount; });
    const inCum = [], outCum = [], netCum = [], planCum = [];
    let ai = 0, ao = 0;
    // توزيع المخطط خطياً على أشهر مدة المشروع
    const pStart = (p.startDate || '').slice(0, 7) || buckets[0];
    const pEnd = (p.endDate || '').slice(0, 7) || buckets[buckets.length - 1];
    let sIdx = buckets.indexOf(pStart); if (sIdx < 0) sIdx = 0;
    let eIdx = buckets.indexOf(pEnd); if (eIdx < 0) eIdx = buckets.length - 1;
    const span = Math.max(1, eIdx - sIdx + 1);
    buckets.forEach((_, i) => {
        ai += inMonthly[i]; ao += outMonthly[i];
        inCum.push(Math.round(ai)); outCum.push(Math.round(ao)); netCum.push(Math.round(ai - ao));
        planCum.push(Math.round(plannedTotal * Math.min(1, Math.max(0, (i - sIdx + 1) / span))));
    });

    const totalIn = ai, totalOut = ao, net = ai - ao;
    const billedPct = plannedTotal ? Math.round(totalIn / plannedTotal * 100) : 0;
    const planToDate = planCum[buckets.length - 1] || 0;
    const scheduleVar = totalIn - planToDate; // فعلي − مخطط حتى تاريخه

    const kpi = (l, v, c, sub) => `<div style="flex:1;min-width:130px;background:white;border-radius:10px;padding:13px 15px;box-shadow:0 2px 6px rgba(0,0,0,.05);border-bottom:3px solid ${c}"><div style="font-size:11px;color:#888;font-weight:600">${l}</div><div style="font-size:19px;font-weight:900;color:${c};font-variant-numeric:tabular-nums;margin-top:2px">${v}</div>${sub ? `<div style="font-size:10px;color:#aaa;margin-top:2px">${sub}</div>` : ''}</div>`;
    const hasData = totalIn > 0 || totalOut > 0;

    pane.innerHTML = `
    <div class="card">
        <div class="c-tl" style="margin:0 0 6px;border:none;padding:0">💧 التدفق النقدي للمشروع — منحنى S</div>
        <div style="font-size:11px;color:#888;margin-bottom:14px">تراكمي شهري: المخطط (توزيع قيمة العقد) · الإيراد الفعلي (مستخلصات العميل) · التكلفة الفعلية (فواتير موردين + مستخلصات الباطن).</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
            ${kpi('إجمالي الإيراد (مستخلصات)', fmt(totalIn), '#27ae60', `${billedPct}% من قيمة العقد`)}
            ${kpi('إجمالي التكلفة الفعلية', fmt(totalOut), '#e67e22', 'فواتير + باطن')}
            ${kpi(net >= 0 ? 'صافي التدفق (فائض)' : 'صافي التدفق (عجز)', fmt(Math.abs(net)), net >= 0 ? '#2d6a9f' : '#c0392b', 'إيراد − تكلفة')}
            ${kpi('الانحراف عن المخطط', (scheduleVar >= 0 ? '+' : '') + fmt(scheduleVar), scheduleVar >= 0 ? '#1e8449' : '#c0392b', `المخطط حتى تاريخه ${fmt(planToDate)}`)}
        </div>
        ${!hasData ? '<div class="empty"><div class="ei">💧</div><p>لا توجد مستخلصات أو تكاليف مؤرّخة بعد لرسم المنحنى</p></div>' : `
        ${pdLineChart(buckets.map(pdMonLabel), [
        { label: 'المخطط (Planned)', color: '#95a5a6', points: planCum, dash: true },
        { label: 'الإيراد الفعلي (مستخلصات)', color: '#27ae60', points: inCum },
        { label: 'التكلفة الفعلية', color: '#e67e22', points: outCum },
    ])}
        <div style="overflow-x:auto;margin-top:16px">
            <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:560px">
                <thead><tr style="background:#1a3a5c;color:#fff"><th style="padding:8px;text-align:right">الشهر</th><th style="padding:8px;text-align:left">المخطط التراكمي</th><th style="padding:8px;text-align:left">الإيراد التراكمي</th><th style="padding:8px;text-align:left">التكلفة التراكمية</th><th style="padding:8px;text-align:left">صافي التدفق التراكمي</th></tr></thead>
                <tbody>${buckets.map((ym, i) => `<tr style="border-top:1px solid #eee">
                    <td style="padding:7px;font-weight:700;color:#1a3a5c">${pdMonLabel(ym)}</td>
                    <td style="padding:7px;text-align:left;color:#7f8c8d">${fmt(planCum[i])}</td>
                    <td style="padding:7px;text-align:left;color:#1e8449">${fmt(inCum[i])}</td>
                    <td style="padding:7px;text-align:left;color:#af601a">${fmt(outCum[i])}</td>
                    <td style="padding:7px;text-align:left;font-weight:700;color:${netCum[i] >= 0 ? '#2d6a9f' : '#c0392b'}">${fmt(netCum[i])}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>
        <div style="margin-top:12px;font-size:11px;color:#7d4e00;background:#fef9e7;border:1px dashed #f0c419;border-radius:8px;padding:9px 12px;line-height:1.7">💡 «الإيراد» = مستخلصات العميل غير الملغاة بتاريخها · «التكلفة» = فواتير الموردين ومستخلصات مقاولي الباطن بتاريخها · «المخطط» = توزيع قيمة العقد (شاملة أوامر التغيير) خطياً على مدة المشروع. لعرض أدق للتدفق، سجّل تواريخ المستخلصات والفواتير بدقة.</div>`}
    </div>`;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — المهام (Tasks Kanban)                                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const PD_TASK_COLS = [
    ['todo',  '📋 قيد الانتظار', '#7f8c8d'],
    ['doing', '🚧 قيد التنفيذ', '#e67e22'],
    ['review','🔍 مراجعة',     '#2980b9'],
    ['done',  '✅ مكتملة',       '#27ae60'],
];
const PD_TASK_PRIORITY = {
    low:    ['منخفضة', '#7f8c8d'],
    normal: ['عادية',  '#2980b9'],
    high:   ['عالية',  '#e67e22'],
    urgent: ['عاجلة',  '#c0392b'],
};

function pdRenderTasks(pid) {
    const pane = document.getElementById('pd-tab-tasks'); if (!pane) return;
    const tasks = Object.entries((window.projectTasks || {})[pid] || {});
    const today = new Date().toISOString().slice(0, 10);
    const taskView = window._pd?.taskView || 'kanban';

    const canBulkDelete = (typeof can === 'function') ? can('delete_project_tasks') : false;
    const isAdmin = window.myP?.role === 'admin';
    const canDeleteTasks = isAdmin || canBulkDelete;

    const cpm = window.pdComputeCPM(pid);
    // ⏱️ الساعات الفعلية لكل مهمة من التايم شيت
    const actualByTask = {};
    Object.values(window.timesheets || {}).forEach(ts => { if (ts.projectId === pid && ts.taskKey) actualByTask[ts.taskKey] = (actualByTask[ts.taskKey] || 0) + (parseFloat(ts.hours) || 0); });
    const taskCard = ([tk, t]) => {
        const [plLabel, plColor] = PD_TASK_PRIORITY[t.priority] || PD_TASK_PRIORITY.normal;
        const assignee = (window.emp || {})[t.assigneeId];
        const overdue = t.dueDate && t.dueDate < today && t.status !== 'done';
        const isCrit = cpm.tasks[tk] && cpm.tasks[tk].critical && t.status !== 'done';
        const depCount = (t.deps || []).filter(d => ((window.projectTasks || {})[pid] || {})[d]).length;
        const est = parseFloat(t.estHours) || 0, act = actualByTask[tk] || 0;
        const effChip = (est > 0 || act > 0) ? `<span title="ساعات فعلية / مقدّرة" style="background:${est > 0 && act > est ? '#fdebd0' : '#eef3fb'};color:${est > 0 && act > est ? '#b9530e' : '#2980b9'};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">⏱️ ${act.toFixed(act % 1 ? 1 : 0)}${est > 0 ? '/' + est : ''} س${est > 0 && act > est ? ' ⚠️' : ''}</span>` : '';
        const chk = Array.isArray(t.checklist) ? t.checklist : [];
        const chkDone = chk.filter(x => x.done).length;
        const chkChip = chk.length ? `<span title="بنود قائمة التحقق المكتملة" style="background:${chkDone === chk.length ? '#eafaf1' : '#f4f6f8'};color:${chkDone === chk.length ? '#27ae60' : '#666'};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">☑️ ${chkDone}/${chk.length}</span>` : '';
        return `<div draggable="true" ondragstart="pdTaskDragStart(event,'${tk}')"
            style="background:white;border-radius:10px;padding:10px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-right:4px solid ${plColor};cursor:grab">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
                <div style="display:flex;gap:6px;align-items:flex-start;flex:1;min-width:0">
                    ${canDeleteTasks ? `<input type="checkbox" class="pd-task-chk" data-tk="${tk}" onchange="pdUpdateTaskBulkBar('${pid}')" style="margin-top:3px">` : ''}
                    <div style="font-size:12.5px;font-weight:700;color:#1a3a5c;line-height:1.5">${isCrit ? '<span title="مهمة على المسار الحرج">🔴 </span>' : ''}${t.title || ''}${depCount ? ` <span style="color:#aaa;font-size:10px" title="يعتمد على ${depCount} مهمة سابقة">🔗${depCount}</span>` : ''}</div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button onclick="pdOpenTaskForm('${pid}','${tk}')" style="border:none;background:none;cursor:pointer;font-size:12px" title="تعديل">✏️</button>
                    <button onclick="pdDeleteTask('${pid}','${tk}')" style="border:none;background:none;cursor:pointer;font-size:12px" title="حذف">🗑️</button>
                </div>
            </div>
            ${t.desc ? `<div style="font-size:11px;color:#777;margin-top:4px;line-height:1.5">${t.desc}</div>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:4px">
                <span style="background:${plColor}1a;color:${plColor};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">${plLabel}</span>
                ${chkChip}
                ${effChip}
                ${assignee ? `<span style="background:#eef3f8;color:#1a3a5c;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600">👤 ${assignee.name}</span>` : ''}
                ${t.dueDate ? `<span style="background:${overdue ? '#fdecea' : '#f4f6f8'};color:${overdue ? '#c0392b' : '#888'};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600">📅 ${t.dueDate}${overdue ? ' ⚠️' : ''}</span>` : ''}
            </div>
        </div>`;
    };

    const totalEst = tasks.reduce((s, [, t]) => s + (parseFloat(t.estHours) || 0), 0);
    const totalAct = Object.values(actualByTask).reduce((s, h) => s + h, 0);
    const effPct = totalEst > 0 ? Math.round(totalAct / totalEst * 100) : 0;
    pane.innerHTML = `
    <div class="card" style="margin-bottom:14px">
        <div class="tlb">
            <div class="c-tl" style="margin:0;border:none;padding:0">✅ مهام المشروع</div>
            <div style="display:flex;gap:8px">
                <div style="background:#f4f6f8;border-radius:8px;padding:3px;display:flex;gap:2px">
                    <button class="btn ${taskView === 'kanban' ? 'b-b' : ''}" style="padding:5px 12px;font-size:12px;${taskView !== 'kanban' ? 'background:transparent;color:#666' : ''}" onclick="pdSetTaskView('${pid}','kanban')">📋 كانبان</button>
                    <button class="btn ${taskView === 'gantt' ? 'b-b' : ''}" style="padding:5px 12px;font-size:12px;${taskView !== 'gantt' ? 'background:transparent;color:#666' : ''}" onclick="pdSetTaskView('${pid}','gantt')">📅 جانت</button>
                </div>
                <button class="btn" onclick="pdApplyTemplatePicker('${pid}')" style="background:#f0f5fa;border:1.5px solid #d0d7e0" title="إضافة مهام من قالب جاهز">📋 من قالب</button>
                ${tasks.length ? `<button class="btn" onclick="pdSaveTasksAsTemplate('${pid}')" style="background:#f0f5fa;border:1.5px solid #d0d7e0" title="حفظ مهام هذا المشروع كقالب لإعادة استخدامه">💾 حفظ كقالب</button>` : ''}
                <button class="btn b-g" onclick="pdOpenTaskForm('${pid}')">➕ مهمة جديدة</button>
            </div>
        </div>
        ${(totalEst > 0 || totalAct > 0) ? `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:10px;padding:8px 12px;background:#f8fafc;border-radius:8px;font-size:12px">
            <span style="font-weight:700;color:#1a3a5c">⏱️ الجهد:</span>
            <span>المقدّر: <strong>${totalEst}</strong> س</span>
            <span>الفعلي: <strong style="color:${totalEst > 0 && totalAct > totalEst ? '#c0392b' : '#16a085'}">${totalAct.toFixed(totalAct % 1 ? 1 : 0)}</strong> س</span>
            ${totalEst > 0 ? `<span style="flex:1;min-width:120px;display:flex;align-items:center;gap:8px"><span style="flex:1;background:#eef1f5;border-radius:5px;height:8px;overflow:hidden;max-width:200px"><span style="display:block;width:${Math.min(100, effPct)}%;height:100%;background:${effPct > 100 ? '#c0392b' : '#16a085'}"></span></span><strong style="color:${effPct > 100 ? '#c0392b' : '#16a085'}">${effPct}%</strong>${effPct > 100 ? ' تجاوز ⚠️' : ''}</span>` : ''}
        </div>` : ''}
        ${canDeleteTasks && taskView === 'kanban' && tasks.length ? `
        <div id="pd-task-bulkbar" style="display:flex;gap:8px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid #eef2f7;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1a3a5c;cursor:pointer"><input type="checkbox" id="pd-task-selectall" onchange="pdToggleAllTasks('${pid}',this.checked)"> تحديد الكل</label>
            <button class="btn" id="pd-task-delsel" disabled style="padding:5px 12px;font-size:12px;background:#fdecea;color:#c0392b" onclick="pdDeleteSelectedTasks('${pid}')">🗑️ حذف المحدد (<span id="pd-task-selcount">0</span>)</button>
            <button class="btn" style="padding:5px 12px;font-size:12px;background:#fdecea;color:#c0392b" onclick="pdDeleteAllTasks('${pid}')">🗑️ حذف كل المهام (${tasks.length})</button>
        </div>` : ''}
    </div>
    ${taskView === 'gantt' ? pdRenderTasksGantt(pid, tasks, today) : `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;overflow-x:auto">
        ${PD_TASK_COLS.map(([st, label, color]) => {
            const colTasks = tasks.filter(([, t]) => (t.status || 'todo') === st);
            return `<div ondragover="event.preventDefault()" ondrop="pdTaskDrop(event,'${pid}','${st}')"
                style="background:#f4f6f8;border-radius:10px;padding:10px;min-height:200px;min-width:180px">
                <div style="font-size:12px;font-weight:800;color:${color};margin-bottom:10px;display:flex;justify-content:space-between">
                    <span>${label}</span><span style="background:${color}22;border-radius:8px;padding:1px 8px">${colTasks.length}</span>
                </div>
                ${colTasks.length ? colTasks.map(taskCard).join('') : `<div style="text-align:center;color:#bbb;font-size:11px;padding:14px 0">لا توجد مهام</div>`}
            </div>`;
        }).join('')}
    </div>`}

    <!-- نموذج المهمة -->
    <div id="pd-task-form" style="display:none;background:white;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #27ae60">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-task-form-title">➕ مهمة جديدة</div>
        <input type="hidden" id="pt-key">
        <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:10px">
            <div><label style="${lblStyle()}">عنوان المهمة</label><input id="pt-title" placeholder="عنوان المهمة" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الوصف</label><textarea id="pt-desc" rows="3" style="${inputStyle('resize:vertical')}"></textarea></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:12px">
            <div><label style="${lblStyle()}">الحالة</label>
                <select id="pt-status" style="${inputStyle()}">${PD_TASK_COLS.map(([st, lb]) => `<option value="${st}">${lb}</option>`).join('')}</select></div>
            <div><label style="${lblStyle()}">الأولوية</label>
                <select id="pt-priority" style="${inputStyle()}">${Object.entries(PD_TASK_PRIORITY).map(([k, [lb]]) => `<option value="${k}">${lb}</option>`).join('')}</select></div>
            <div><label style="${lblStyle()}">المسؤول</label>
                <select id="pt-assignee" style="${inputStyle()}"><option value="">— غير محدد —</option>${Object.entries(window.emp || {}).map(([k, e]) => `<option value="${k}">${e.name}</option>`).join('')}</select></div>
            <div><label style="${lblStyle()}">تاريخ البداية</label><input type="date" id="pt-start" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">تاريخ التسليم</label><input type="date" id="pt-due" style="${inputStyle()}"></div>
        </div>
        <div style="display:grid;grid-template-columns:200px 1fr;gap:10px;margin-bottom:12px;align-items:end">
            <div><label style="${lblStyle()}">⏱️ الساعات المقدّرة (الجهد المخطط)</label><input type="number" step="0.5" min="0" id="pt-est" placeholder="0" style="${inputStyle()}"></div>
            <div style="font-size:11px;color:#888;padding-bottom:10px">تُقارن تلقائياً بالساعات الفعلية المسجّلة في التايم شيت على هذه المهمة.</div>
        </div>
        <div style="margin-bottom:12px">
            <label style="${lblStyle()}">🔗 يعتمد على (مهام سابقة يجب إنجازها أولاً) — أساس المسار الحرج</label>
            <select id="pt-deps" multiple size="4" style="${inputStyle('min-height:92px')}">
                ${tasks.map(([tk, t]) => `<option value="${tk}">${t.title || tk}</option>`).join('')}
            </select>
            <div style="font-size:11px;color:#888;margin-top:3px">اضغط Ctrl (أو ⌘) لاختيار أكثر من مهمة. اتركه فارغاً إن لم تكن المهمة تعتمد على غيرها.</div>
        </div>
        <div style="margin-bottom:12px">
            <label style="${lblStyle()}">☑️ قائمة التحقق (خطوات تنفيذ المهمة)</label>
            <div id="pd-checklist-items" style="margin-bottom:6px"></div>
            <div style="display:flex;gap:6px">
                <input id="pd-checklist-new" placeholder="أضف بنداً..." onkeydown="if(event.key==='Enter'){event.preventDefault();pdChecklistAdd();}" style="${inputStyle('flex:1')}">
                <button class="btn" onclick="pdChecklistAdd()" style="background:#f0f5fa;border:1.5px solid #d0d7e0">➕ إضافة</button>
            </div>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveTask('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-task-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}

window.pdSetTaskView = function (pid, view) {
    window._pd = window._pd || {};
    window._pd.taskView = view;
    pdRenderTasks(pid);
};

// ثوابت هندسة الجانت التفاعلي (بكسل/يوم وارتفاع الصف)
const PD_GANTT_PXDAY = 26, PD_GANTT_ROWH = 34;

// ── 🔗 محرّك المسار الحرج (CPM) — يحسب المرونة (Float) والمهام الحرجة ──────────
// يعتمد على tasks[k].deps (السابقات) ومدة كل مهمة (من تاريخي البداية/التسليم، افتراضي يوم واحد).
// محميٌّ ضد الدورات (cycles) بحارس زيارة. يعيد { tasks:{k:{ES,EF,LS,LF,float,critical,duration}}, projectDuration }.
window.pdComputeCPM = function (pid) {
    const T = (window.projectTasks || {})[pid] || {};
    const keys = Object.keys(T);
    const dur = k => { const t = T[k]; if (t && t.startDate && t.dueDate) { const d = Math.round((new Date(t.dueDate) - new Date(t.startDate)) / 86400000) + 1; return Math.max(1, d); } return 1; };
    const preds = k => ((T[k] && T[k].deps) || []).filter(d => T[d]); // السابقات الصالحة فقط
    const succ = {}; keys.forEach(k => succ[k] = []);
    keys.forEach(k => preds(k).forEach(p => succ[p].push(k)));
    // مرور أمامي: ES/EF (أطول مسار من السابقات)
    const ES = {}, EF = {}, vis = {};
    function fwd(k) {
        if (EF[k] != null) return EF[k];
        if (vis[k]) { ES[k] = 0; EF[k] = dur(k); return EF[k]; } // كسر الدورة
        vis[k] = true;
        let es = 0; preds(k).forEach(p => { es = Math.max(es, fwd(p)); });
        ES[k] = es; EF[k] = es + dur(k); vis[k] = false; return EF[k];
    }
    keys.forEach(fwd);
    const projectDuration = keys.length ? Math.max(...keys.map(k => EF[k])) : 0;
    // مرور خلفي: LF/LS (أقل بداية متأخرة للتالين)
    const LF = {}, LS = {}, vis2 = {};
    function bwd(k) {
        if (LS[k] != null) return LS[k];
        if (vis2[k]) { LF[k] = projectDuration; LS[k] = projectDuration - dur(k); return LS[k]; }
        vis2[k] = true;
        let lf = succ[k].length ? Infinity : projectDuration;
        succ[k].forEach(s => { lf = Math.min(lf, bwd(s)); });
        if (lf === Infinity) lf = projectDuration;
        LF[k] = lf; LS[k] = lf - dur(k); vis2[k] = false; return LS[k];
    }
    keys.forEach(bwd);
    const res = {};
    keys.forEach(k => { const fl = LS[k] - ES[k]; res[k] = { ES: ES[k], EF: EF[k], LS: LS[k], LF: LF[k], float: fl, critical: fl <= 0.0001, duration: dur(k) }; });
    return { tasks: res, projectDuration };
};

// ── عرض جانت لمهام المشروع ─────────────────
function pdRenderTasksGantt(pid, tasks, today) {
    const dated = tasks.filter(([, t]) => t.dueDate);
    if (!dated.length) {
        return `<div class="card"><div class="empty"><div class="ei">📅</div><p>لا توجد مهام بتواريخ تسليم لعرضها في الجدول الزمني</p></div></div>`;
    }

    // نطاق التواريخ الكامل: من أقدم بداية/تسليم إلى أبعد تسليم
    let allDates = [];
    dated.forEach(([, t]) => {
        if (t.startDate) allDates.push(t.startDate);
        allDates.push(t.dueDate);
    });
    allDates.push(today);
    let minD = new Date(allDates.reduce((a, b) => a < b ? a : b));
    let maxD = new Date(allDates.reduce((a, b) => a > b ? a : b));
    minD.setDate(minD.getDate() - 1);
    maxD.setDate(maxD.getDate() + 1);
    const totalDays = Math.max(1, Math.round((maxD - minD) / 86400000));

    const sorted = dated.slice().sort((a, b) => (a[1].startDate || a[1].dueDate).localeCompare(b[1].startDate || b[1].dueDate));
    const cpm = window.pdComputeCPM(pid);
    const critCount = Object.values(cpm.tasks).filter(c => c.critical).length;
    const DAY = 86400000, PX = PD_GANTT_PXDAY, RH = PD_GANTT_ROWH;
    const timelineW = Math.max(totalDays * PX, 300);
    const Tp = (window.projectTasks || {})[pid] || {};
    const idx = {}; sorted.forEach(([k], i) => idx[k] = i);
    const off = d => (new Date(d) - minD) / DAY;
    const durOf = t => Math.max(1, Math.round((new Date(t.dueDate) - new Date(t.startDate || t.dueDate)) / DAY) + 1);
    // أسهم الاعتماد بين الأشرطة (SVG)
    let arrows = '';
    sorted.forEach(([tk, t]) => {
        (t.deps || []).forEach(d => {
            if (idx[d] == null) return; // السابقة غير معروضة (بلا تاريخ)
            const pred = Tp[d]; if (!pred) return;
            const pfx = timelineW - (off(pred.startDate || pred.dueDate) + durOf(pred)) * PX, py = idx[d] * RH + RH / 2;
            const ssx = timelineW - off(t.startDate || t.dueDate) * PX, sy = idx[tk] * RH + RH / 2;
            arrows += `<path d="M ${pfx.toFixed(1)} ${py} L ${(pfx - 9).toFixed(1)} ${py} L ${(pfx - 9).toFixed(1)} ${sy} L ${ssx.toFixed(1)} ${sy}" fill="none" stroke="#9aa7b4" stroke-width="1.5" marker-end="url(#pdAr)"/>`;
        });
    });
    const todayX = timelineW - off(today) * PX;
    return `<div class="card" style="overflow-x:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div style="font-size:12px;color:#888">📅 من ${minD.toISOString().slice(0,10)} إلى ${maxD.toISOString().slice(0,10)}</div>
            <div style="display:flex;gap:14px;align-items:center;font-size:11px;flex-wrap:wrap">
                <span style="font-weight:700;color:#1a3a5c">⏳ مدة المشروع المحسوبة: ${cpm.projectDuration} يوم</span>
                <span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;background:#c0392b;border-radius:3px;display:inline-block"></span> مسار حرج (${critCount})</span>
                <span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;background:#2d6a9f;border-radius:3px;display:inline-block"></span> به مرونة</span>
            </div>
        </div>
        <div style="background:#fbeee9;border-right:3px solid #c0392b;border-radius:6px;padding:6px 11px;font-size:11px;color:#922b21;margin-bottom:6px">🔴 <strong>المسار الحرج</strong>: المهام التي أي تأخير فيها يؤخّر المشروع كله.</div>
        <div style="background:#eaf4fb;border-right:3px solid #2d6a9f;border-radius:6px;padding:6px 11px;font-size:11px;color:#2d6a9f;margin-bottom:10px">🖱️ <strong>اسحب أي شريط</strong> أفقياً لإعادة الجدولة — والمهام التابعة تتحرك تلقائياً. اضغط دون سحب للتعديل.</div>
        <div style="position:relative;width:${timelineW + 180}px">
            <svg style="position:absolute;left:0;top:0;width:${timelineW}px;height:${sorted.length * RH}px;z-index:0;pointer-events:none" viewBox="0 0 ${timelineW} ${sorted.length * RH}" preserveAspectRatio="none">
                <defs><marker id="pdAr" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#9aa7b4"/></marker></defs>
                <line x1="${todayX.toFixed(1)}" y1="0" x2="${todayX.toFixed(1)}" y2="${sorted.length * RH}" stroke="#c0392b" stroke-width="1.5" stroke-dasharray="3,3"/>
                ${arrows}
            </svg>
            ${sorted.map(([tk, t]) => {
                const [, plColor] = PD_TASK_PRIORITY[t.priority] || PD_TASK_PRIORITY.normal;
                const rightPx = off(t.startDate || t.dueDate) * PX, durDays = durOf(t), widthPx = Math.max(20, durDays * PX);
                const overdue = t.dueDate < today && t.status !== 'done';
                const ci = cpm.tasks[tk] || { critical: false, float: 0 };
                const isCrit = ci.critical && t.status !== 'done';
                const barColor = t.status === 'done' ? '#27ae60' : overdue ? '#c0392b' : isCrit ? '#c0392b' : plColor;
                const depCount = (t.deps || []).filter(d => Tp[d]).length;
                const sIso = t.startDate || t.dueDate;
                return `<div style="position:relative;height:${RH}px">
                    <div onclick="pdOpenTaskForm('${pid}','${tk}')" title="اضغط للتعديل" style="position:absolute;right:0;width:170px;height:${RH}px;display:flex;align-items:center;font-size:12px;font-weight:700;color:#1a3a5c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;z-index:2;cursor:pointer">${isCrit ? '🔴 ' : ''}${t.title || ''}${depCount ? ` <span style="color:#888;font-weight:400">🔗${depCount}</span>` : ''}</div>
                    <div style="position:absolute;left:0;width:${timelineW}px;height:${RH}px">
                        <div onmousedown="pdGanttDown(event,'${pid}','${tk}','${sIso}','${t.dueDate}',${rightPx.toFixed(1)})"
                            style="position:absolute;right:${rightPx.toFixed(1)}px;width:${widthPx}px;top:${(RH - 22) / 2}px;height:22px;background:${barColor};border-radius:6px;display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:700;cursor:grab;z-index:1;${isCrit ? 'box-shadow:0 0 0 2px #922b21' : ''}"
                            title="${t.title}${isCrit ? ' — حرجة' : ' — مرونة ' + Math.max(0, Math.round(ci.float)) + 'ي'} — اسحب لإعادة الجدولة">${durDays}ي</div>
                    </div>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

// ── 🖱️ سحب الأشرطة لإعادة الجدولة + تحريك المهام التابعة تلقائياً ──────────────
function pdGanttMove(e) {
    const g = window._gdrag; if (!g) return;
    const days = Math.round((g.startX - e.clientX) / PD_GANTT_PXDAY); // RTL: السحب يساراً = تأخير
    if (days !== 0) g.moved = true;
    g.days = days;
    g.bar.style.right = (g.origRightPx + days * PD_GANTT_PXDAY) + 'px';
    g.bar.style.opacity = '.75';
    const ns = new Date(new Date(g.origStart).getTime() + days * 86400000).toISOString().slice(0, 10);
    g.bar.title = 'بداية جديدة: ' + ns;
}
function pdGanttUp() {
    const g = window._gdrag;
    document.removeEventListener('mousemove', pdGanttMove);
    document.removeEventListener('mouseup', pdGanttUp);
    window._gdrag = null;
    if (!g) return;
    if (g.bar) g.bar.style.opacity = '';
    if (!g.moved) { pdOpenTaskForm(g.pid, g.tk); return; }
    const days = g.days || 0;
    const ns = new Date(new Date(g.origStart).getTime() + days * 86400000).toISOString().slice(0, 10);
    const nd = new Date(new Date(g.origDue).getTime() + days * 86400000).toISOString().slice(0, 10);
    pdApplyDrag(g.pid, g.tk, ns, nd);
}
window.pdGanttDown = function (e, pid, tk, origStart, origDue, origRightPx) {
    e.preventDefault();
    window._gdrag = { pid, tk, startX: e.clientX, moved: false, days: 0, origStart, origDue, origRightPx: parseFloat(origRightPx) || 0, bar: e.currentTarget };
    document.addEventListener('mousemove', pdGanttMove);
    document.addEventListener('mouseup', pdGanttUp);
};
// يبني تحديثات التواريخ: المهمة المنقولة (anchor) + دفع المهام التابعة للأمام لاحترام التبعية (FS)
function pdScheduleUpdates(pid, overrides) {
    const T = (window.projectTasks || {})[pid] || {}; const DAY = 86400000;
    const start = {}, due = {};
    Object.keys(T).forEach(k => {
        const o = overrides[k];
        const sd = o ? o.startDate : T[k].startDate, dd = o ? o.dueDate : T[k].dueDate;
        start[k] = sd ? new Date(sd).getTime() : null; due[k] = dd ? new Date(dd).getTime() : null;
    });
    for (let iter = 0; iter < Object.keys(T).length + 2; iter++) {
        let changed = false;
        Object.keys(T).forEach(k => {
            if (overrides[k] && overrides[k].anchor) return; // لا تُحرّك المهمة التي حرّكها المستخدم
            const deps = (T[k].deps || []).filter(d => T[d] && due[d] != null);
            if (!deps.length || start[k] == null) return;
            const need = Math.max(...deps.map(d => due[d] + DAY));
            if (start[k] < need) { const sh = need - start[k]; start[k] += sh; if (due[k] != null) due[k] += sh; changed = true; }
        });
        if (!changed) break;
    }
    const updates = {};
    Object.keys(T).forEach(k => {
        const ns = start[k] != null ? new Date(start[k]).toISOString().slice(0, 10) : (T[k].startDate || '');
        const nd = due[k] != null ? new Date(due[k]).toISOString().slice(0, 10) : (T[k].dueDate || '');
        if (ns !== (T[k].startDate || '')) updates[`ledger/projectTasks/${pid}/${k}/startDate`] = ns;
        if (nd !== (T[k].dueDate || '')) updates[`ledger/projectTasks/${pid}/${k}/dueDate`] = nd;
    });
    return updates;
}
window.pdApplyDrag = async function (pid, key, newStart, newDue) {
    const overrides = {}; overrides[key] = { startDate: newStart, dueDate: newDue, anchor: true };
    const updates = pdScheduleUpdates(pid, overrides);
    updates[`ledger/projectTasks/${pid}/${key}/startDate`] = newStart;
    updates[`ledger/projectTasks/${pid}/${key}/dueDate`] = newDue;
    updates[`ledger/projectTasks/${pid}/${key}/updatedAt`] = new Date().toISOString();
    const shifted = Object.keys(updates).filter(k => k.endsWith('/startDate')).length;
    try {
        await update(ref(db, '/'), updates); // الغلاف يعزل مفاتيح ledger/* للمستأجر
        toast(`✓ أُعيدت الجدولة${shifted > 1 ? ' — وتحرّكت ' + (shifted - 1) + ' مهمة تابعة' : ''}`, 'ok');
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// ── 📋 قوالب المشاريع: حفظ مهام مشروع كقالب وإعادة استخدامه ───────────────────
const pdAddDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10);
window.pdSaveTasksAsTemplate = async function (pid) {
    const tasksObj = (window.projectTasks || {})[pid] || {};
    const entries = Object.entries(tasksObj);
    if (!entries.length) { toast('لا توجد مهام لحفظها كقالب', 'er'); return; }
    const proj = (window.projects || {})[pid] || {};
    const name = prompt('اسم القالب:', proj.name ? 'قالب ' + proj.name : 'قالب مشروع');
    if (!name) return;
    // المرجع الزمني = أبكر تاريخ بداية (أو بداية المشروع)
    const starts = entries.map(([, t]) => t.startDate).filter(Boolean).sort();
    const anchor = starts[0] || proj.startDate || new Date().toISOString().slice(0, 10);
    const keyToIdx = {}; entries.forEach(([k], i) => keyToIdx[k] = i);
    const tasks = entries.map(([, t]) => {
        const st = t.startDate || anchor;
        const offsetStart = Math.max(0, Math.round((new Date(st) - new Date(anchor)) / 86400000));
        const durationDays = (t.startDate && t.dueDate) ? Math.max(1, Math.round((new Date(t.dueDate) - new Date(t.startDate)) / 86400000) + 1) : 1;
        return { title: t.title || '', desc: t.desc || '', priority: t.priority || 'normal', estHours: parseFloat(t.estHours) || 0, offsetStart, durationDays, deps: (t.deps || []).map(d => keyToIdx[d]).filter(x => x != null) };
    });
    try {
        await push(window.R.projTemplates, { name: name.trim(), createdAt: new Date().toISOString(), createdBy: (window.curU && window.curU.uid) || '', taskCount: tasks.length, tasks });
        toast(`💾 حُفظ القالب «${name.trim()}» (${tasks.length} مهمة)`, 'ok');
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
function pdEnsureTplPicker() {
    if (document.getElementById('pdTplPicker')) return;
    const d = document.createElement('div');
    d.id = 'pdTplPicker';
    d.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
    d.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:88vh;overflow:auto;padding:22px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0;color:#2d6a9f;font-size:18px">📋 تطبيق قالب مشروع</h3><button onclick="pdCloseTplPicker()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">×</button></div><div id="pdTplList"></div></div>';
    d.addEventListener('click', e => { if (e.target === d) pdCloseTplPicker(); });
    document.body.appendChild(d);
}
window.pdCloseTplPicker = function () { const m = document.getElementById('pdTplPicker'); if (m) m.style.display = 'none'; };
window.pdApplyTemplatePicker = function (pid) {
    const tpls = Object.entries(window.projectTemplates || {});
    if (!tpls.length) { toast('لا توجد قوالب محفوظة بعد — احفظ مشروعاً كقالب أولاً', 'wn', 5000); return; }
    pdEnsureTplPicker();
    document.getElementById('pdTplList').innerHTML = tpls.sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || '')).map(([k, t]) => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px;border:1.5px solid #eef0f3;border-radius:10px;margin-bottom:8px">
            <div><div style="font-weight:800;color:#1a3a5c">${t.name || 'قالب'}</div><div style="font-size:12px;color:#888">${(t.taskCount || (t.tasks || []).length)} مهمة</div></div>
            <div style="display:flex;gap:6px">
                <button class="btn b-g" onclick="pdApplyTemplate('${pid}','${k}')" style="font-size:12px;padding:5px 12px">➕ تطبيق</button>
                <button class="btn b-r" onclick="pdDeleteTemplate('${k}')" style="font-size:12px;padding:5px 10px">🗑️</button>
            </div>
        </div>`).join('');
    document.getElementById('pdTplPicker').style.display = 'flex';
};
window.pdApplyTemplate = async function (pid, tplKey) {
    const tpl = (window.projectTemplates || {})[tplKey]; if (!tpl || !tpl.tasks) return;
    if (!(await cf2(`تطبيق قالب «${tpl.name}» (${tpl.tasks.length} مهمة)؟ ستُضاف المهام بتواريخ محسوبة من تاريخ بدء المشروع.`))) return;
    const proj = (window.projects || {})[pid] || {};
    const anchor = proj.startDate || new Date().toISOString().slice(0, 10);
    const base = `ledger/projectTasks/${pid}`;
    const newKeys = tpl.tasks.map(() => push(ref(db, base)).key); // مفاتيح جديدة محلياً
    const now = new Date().toISOString();
    const updates = {};
    tpl.tasks.forEach((tt, i) => {
        const start = pdAddDays(anchor, tt.offsetStart || 0);
        const due = pdAddDays(start, Math.max(0, (tt.durationDays || 1) - 1));
        updates[`${base}/${newKeys[i]}`] = {
            title: tt.title || 'مهمة', desc: tt.desc || '', status: 'todo', priority: tt.priority || 'normal',
            assigneeId: '', startDate: start, dueDate: due, estHours: tt.estHours || 0,
            deps: (tt.deps || []).map(idx => newKeys[idx]).filter(Boolean), createdAt: now, createdBy: (window.curU && window.curU.uid) || ''
        };
    });
    try {
        await update(ref(db, '/'), updates);
        toast(`✅ أُضيفت ${tpl.tasks.length} مهمة من القالب`, 'ok');
        pdCloseTplPicker();
    } catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};
window.pdDeleteTemplate = async function (tplKey) {
    if (!(await cf2('حذف هذا القالب نهائياً؟'))) return;
    try { await remove(ref(db, 'ledger/projectTemplates/' + tplKey)); toast('🗑️ حُذف القالب', 'ok'); if (window._pd && window._pd.projectId) pdApplyTemplatePicker(window._pd.projectId); }
    catch (e) { toast('❌ ' + (e.message || e), 'er'); }
};

// ☑️ قائمة التحقق داخل نموذج المهمة (حالة محلية تُحفظ مع المهمة)
window._pdChecklist = [];
window.pdChecklistRender = function () {
    const c = document.getElementById('pd-checklist-items'); if (!c) return;
    const items = window._pdChecklist || [];
    const done = items.filter(x => x.done).length;
    c.innerHTML = (items.length ? `<div style="font-size:11px;color:#16a085;font-weight:700;margin-bottom:4px">${done}/${items.length} مكتمل</div>` : '') + (items.length ? items.map((it, i) => `<div style="display:flex;align-items:center;gap:8px;padding:3px 0">
        <input type="checkbox" ${it.done ? 'checked' : ''} onchange="pdChecklistToggle(${i})" style="width:16px;height:16px;cursor:pointer">
        <span style="flex:1;font-size:13px;${it.done ? 'text-decoration:line-through;color:#999' : 'color:#1a3a5c'}">${(it.text || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</span>
        <button onclick="pdChecklistRemove(${i})" style="border:none;background:none;cursor:pointer;color:#c0392b;font-size:14px" title="حذف">✕</button>
    </div>`).join('') : '<div style="font-size:11px;color:#aaa">لا بنود — أضف خطوات تنفيذ المهمة لتتبّع إنجازها</div>');
};
window.pdChecklistAdd = function () {
    const inp = document.getElementById('pd-checklist-new'); if (!inp) return;
    const v = (inp.value || '').trim(); if (!v) return;
    (window._pdChecklist = window._pdChecklist || []).push({ text: v, done: false });
    inp.value = ''; pdChecklistRender(); inp.focus();
};
window.pdChecklistToggle = function (i) { if (window._pdChecklist && window._pdChecklist[i]) window._pdChecklist[i].done = !window._pdChecklist[i].done; pdChecklistRender(); };
window.pdChecklistRemove = function (i) { if (window._pdChecklist) { window._pdChecklist.splice(i, 1); pdChecklistRender(); } };

window.pdOpenTaskForm = function (pid, taskKey = null) {
    const form = document.getElementById('pd-task-form'); if (!form) return;
    form.style.display = '';
    document.getElementById('pt-key').value = taskKey || '';
    document.getElementById('pd-task-form-title').textContent = taskKey ? '✏️ تعديل مهمة' : '➕ مهمة جديدة';
    const t = taskKey ? (window.projectTasks || {})[pid]?.[taskKey] : null;
    document.getElementById('pt-title').value = t?.title || '';
    document.getElementById('pt-desc').value = t?.desc || '';
    document.getElementById('pt-status').value = t?.status || 'todo';
    document.getElementById('pt-priority').value = t?.priority || 'normal';
    document.getElementById('pt-assignee').value = t?.assigneeId || '';
    document.getElementById('pt-start').value = t?.startDate || '';
    document.getElementById('pt-due').value = t?.dueDate || '';
    if (document.getElementById('pt-est')) document.getElementById('pt-est').value = t?.estHours || '';
    // ☑️ قائمة التحقق
    window._pdChecklist = Array.isArray(t?.checklist) ? t.checklist.map(x => ({ text: x.text || '', done: !!x.done })) : [];
    if (typeof pdChecklistRender === 'function') pdChecklistRender();
    // 🔗 التبعيات: اختر السابقات الحالية وامنع المهمة من الاعتماد على نفسها
    const depsSel = document.getElementById('pt-deps');
    if (depsSel) { const cur = t?.deps || []; Array.from(depsSel.options).forEach(o => { o.selected = cur.includes(o.value); o.disabled = (o.value === taskKey); }); }
    if (typeof enhanceLongSelects === 'function') enhanceLongSelects(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSaveTask = async function (pid) {
    const title = document.getElementById('pt-title')?.value.trim();
    if (!title) { toast('أدخل عنوان المهمة', 'er'); return; }
    const data = {
        title,
        desc: document.getElementById('pt-desc')?.value.trim() || '',
        status: document.getElementById('pt-status')?.value || 'todo',
        priority: document.getElementById('pt-priority')?.value || 'normal',
        assigneeId: document.getElementById('pt-assignee')?.value || '',
        startDate: document.getElementById('pt-start')?.value || '',
        dueDate: document.getElementById('pt-due')?.value || '',
        estHours: parseFloat(document.getElementById('pt-est')?.value) || 0,
        checklist: (window._pdChecklist || []).filter(it => it.text && it.text.trim()).map(it => ({ text: it.text.trim(), done: !!it.done })),
        updatedAt: new Date().toISOString()
    };
    const taskKey = document.getElementById('pt-key')?.value;
    // 🔗 التبعيات (السابقات) — مع استبعاد المهمة نفسها
    const depsSel = document.getElementById('pt-deps');
    data.deps = depsSel ? Array.from(depsSel.selectedOptions).map(o => o.value).filter(v => v && v !== taskKey) : [];
    try {
        if (taskKey) {
            await update(ref(db, `ledger/projectTasks/${pid}/${taskKey}`), data);
            toast('تم التحديث ✓', 'ok');
        } else {
            data.createdAt = new Date().toISOString();
            data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/projectTasks/${pid}`), data);
            toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-task-form').style.display = 'none';
        setTimeout(() => pdRenderTab('tasks'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.pdDeleteTask = function (pid, taskKey) {
    cf2('هل تريد حذف هذه المهمة؟', async () => {
        try {
            await remove(ref(db, `ledger/projectTasks/${pid}/${taskKey}`));
            toast('تم الحذف', 'ok');
            setTimeout(() => pdRenderTab('tasks'), 300);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

window.pdToggleAllTasks = function (pid, checked) {
    document.querySelectorAll('.pd-task-chk').forEach(c => c.checked = checked);
    pdUpdateTaskBulkBar(pid);
};

window.pdUpdateTaskBulkBar = function (pid) {
    const checked = document.querySelectorAll('.pd-task-chk:checked');
    const btn = document.getElementById('pd-task-delsel');
    const cnt = document.getElementById('pd-task-selcount');
    if (cnt) cnt.textContent = checked.length;
    if (btn) btn.disabled = checked.length === 0;
};

window.pdDeleteSelectedTasks = function (pid) {
    const keys = [...document.querySelectorAll('.pd-task-chk:checked')].map(c => c.dataset.tk);
    if (!keys.length) return;
    cf2(`هل تريد حذف ${keys.length} مهمة محددة؟`, async () => {
        try {
            await Promise.all(keys.map(k => remove(ref(db, `ledger/projectTasks/${pid}/${k}`))));
            toast('تم حذف المهام المحددة', 'ok');
            setTimeout(() => pdRenderTab('tasks'), 300);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

window.pdDeleteAllTasks = function (pid) {
    const tasks = Object.keys((window.projectTasks || {})[pid] || {});
    if (!tasks.length) return;
    cf2(`⚠️ هل تريد حذف جميع مهام المشروع (${tasks.length})؟ لا يمكن التراجع عن هذا الإجراء.`, async () => {
        try {
            await remove(ref(db, `ledger/projectTasks/${pid}`));
            toast('تم حذف جميع المهام', 'ok');
            setTimeout(() => pdRenderTab('tasks'), 300);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

window.pdTaskDragStart = function (ev, taskKey) {
    ev.dataTransfer.setData('text/plain', taskKey);
};

window.pdTaskDrop = function (ev, pid, newStatus) {
    ev.preventDefault();
    const taskKey = ev.dataTransfer.getData('text/plain');
    if (!taskKey) return;
    const t = (window.projectTasks || {})[pid]?.[taskKey];
    if (!t || (t.status || 'todo') === newStatus) return;
    update(ref(db, `ledger/projectTasks/${pid}/${taskKey}`), { status: newStatus, updatedAt: new Date().toISOString() })
        .then(() => pdRenderTab('tasks'))
        .catch(e => toast('خطأ: ' + e.message, 'er'));
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — سجل النشاط (Activity Log)                                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function pdRenderActivityLog(pid) {
    const pane = document.getElementById('pd-tab-activity'); if (!pane) return;

    const entries = Object.entries((window.projectActivityLog || {})[pid] || {})
        .sort((a, b) => new Date(b[1].date || 0) - new Date(a[1].date || 0));

    const isAdmin = window.myP?.role === 'admin';

    pane.innerHTML = `
    <div class="card">
        <div class="tlb">
            <div class="c-tl" style="margin:0;border:none;padding:0">📜 سجل نشاط المشروع</div>
            ${isAdmin && entries.length ? `<button class="btn" style="padding:5px 12px;font-size:12px;background:#fdecea;color:#c0392b" onclick="pdDeleteAllActivityLog('${pid}')">🗑️ حذف السجل كامل (${entries.length})</button>` : ''}
        </div>
        ${entries.length === 0 ? '<div class="empty"><div class="ei">📜</div><p>لا توجد أحداث مسجلة بعد</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:0">
        ${entries.map(([key, e], i) => {
            const date = e.date ? new Date(e.date).toLocaleString('ar-SA') : '-';
            return `<div style="display:flex;gap:12px;padding:12px 0;align-items:flex-start;${i < entries.length - 1 ? 'border-bottom:1px solid #eef2f7' : ''}">
                <div style="font-size:20px;flex:0 0 auto">${e.icon || '📌'}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:13px;color:#1a3a5c;font-weight:700">${e.text || '-'}</div>
                    <div style="font-size:11px;color:#888;margin-top:2px">${date}${e.user ? ` · 👤 ${e.user}` : ''}</div>
                </div>
                ${isAdmin ? `<button onclick="pdDeleteActivityLogEntry('${pid}','${key}')" style="border:none;background:none;cursor:pointer;font-size:13px;flex:0 0 auto" title="حذف السجل">🗑️</button>` : ''}
            </div>`;
        }).join('')}
        </div>`}
    </div>`;
}

window.pdDeleteActivityLogEntry = function (pid, key) {
    cf2('هل تريد حذف هذا السجل من سجل النشاط؟', async () => {
        try {
            await remove(ref(db, `ledger/projectActivityLog/${pid}/${key}`));
            toast('تم الحذف', 'ok');
            setTimeout(() => pdRenderActivityLog(pid), 300);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

window.pdDeleteAllActivityLog = function (pid) {
    const entries = Object.keys((window.projectActivityLog || {})[pid] || {});
    if (!entries.length) return;
    cf2(`⚠️ هل تريد حذف سجل النشاط بالكامل (${entries.length} حدث)؟ لا يمكن التراجع عن هذا الإجراء.`, async () => {
        try {
            await remove(ref(db, `ledger/projectActivityLog/${pid}`));
            toast('تم حذف سجل النشاط', 'ok');
            setTimeout(() => pdRenderActivityLog(pid), 300);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ── الملخص التنفيذي القابل للطباعة/PDF ──────────────────────────────────────
window.pdOpenExecSummary = function (pid) {
    const p = (window.projects || {})[pid]; if (!p) return;

    const contractValue = window.getProjectContractValue(pid);
    const progress = window.calcProjectProgress(pid);
    const budget = window.calcProjectBudget(pid);
    const actual = window.calcProjectActualCosts(pid);
    const billing = window.calcProjectBillings(pid);
    const profit = contractValue - actual.total;
    const profitMargin = contractValue > 0 ? (profit / contractValue * 100) : 0;

    const entries = Object.entries((window.projectActivityLog || {})[pid] || {})
        .sort((a, b) => new Date(b[1].date || 0) - new Date(a[1].date || 0))
        .slice(0, 5);

    const cell = (label, value, color) => `
        <div style="background:#f8fafc;border-radius:10px;padding:14px;border-right:4px solid ${color}">
            <div style="font-size:11px;color:#666;font-weight:700">${label}</div>
            <div style="font-size:20px;font-weight:900;color:${color};margin-top:4px">${value}</div>
        </div>`;

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>ملخص تنفيذي — ${p.name || ''}</title>
    <style>
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: 'Tahoma', Arial, sans-serif; padding: 24px; color: #1a3a5c; direction: rtl; }
        @page { margin: 1.5cm; size: A4; }
        @media print { body { padding: 10px; } .card { page-break-inside: avoid; } }
    </style></head><body>

    <div style="background:linear-gradient(135deg,#1a3a5c,#2d6a9f);color:white;border-radius:14px;padding:22px;margin-bottom:18px">
        <div style="font-size:11px;opacity:.85;letter-spacing:1px">EXECUTIVE SUMMARY</div>
        <div style="font-size:24px;font-weight:900;margin-top:4px">${p.name || '-'}</div>
        <div style="font-size:13px;opacity:.95;margin-top:6px">${p.ownerName || p.clientName || ''}${p.contractNo ? ' · عقد رقم ' + p.contractNo : ''}${p.city ? ' · ' + p.city : ''}</div>
        <div style="font-size:11px;opacity:.85;margin-top:8px">📅 تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">
        ${cell('💼 قيمة العقد (شاملة أوامر التغيير)', fmt(contractValue) + ' ريال', '#2d6a9f')}
        ${cell('📈 نسبة الإنجاز', progress.toFixed(1) + '%', '#27ae60')}
        ${cell('💰 الربح المتوقع', fmt(profit) + ' ريال (' + profitMargin.toFixed(1) + '%)', profit >= 0 ? '#8e44ad' : '#c0392b')}
        ${cell('📊 الميزانية المتوقعة', fmt(budget.totalBudget) + ' ريال', '#2d6a9f')}
        ${cell('💸 التكلفة الفعلية', fmt(actual.total) + ' ريال', '#e67e22')}
        ${cell('⏳ الذمم المدينة (مستحق من العميل)', fmt(billing.totalReceivable) + ' ريال', '#c0392b')}
    </div>

    <!-- Progress bar -->
    <div class="card" style="background:white;border:1.5px solid #e0e8f0;border-radius:12px;padding:16px;margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:13px;font-weight:700">📈 نسبة الإنجاز المالي</span>
            <span style="font-size:14px;font-weight:900;color:#27ae60">${progress.toFixed(1)}%</span>
        </div>
        <div style="background:#f0f5fa;border-radius:8px;height:16px;overflow:hidden">
            <div style="background:linear-gradient(90deg,#27ae60,#1e8449);height:100%;width:${Math.min(progress, 100)}%;border-radius:8px"></div>
        </div>
    </div>

    <!-- Activity log -->
    <div class="card" style="background:white;border:1.5px solid #e0e8f0;border-radius:12px;padding:16px">
        <div style="font-size:14px;font-weight:800;margin-bottom:10px">📜 آخر التحديثات</div>
        ${entries.length === 0 ? '<div style="color:#888;font-size:12px;text-align:center;padding:10px">لا توجد أحداث مسجلة بعد</div>' : `
        <div style="display:flex;flex-direction:column;gap:0">
        ${entries.map(([, e], i) => {
            const date = e.date ? new Date(e.date).toLocaleString('ar-SA') : '-';
            return `<div style="display:flex;gap:10px;padding:10px 0;${i < entries.length - 1 ? 'border-bottom:1px solid #eef2f7' : ''}">
                <div style="font-size:18px;flex:0 0 auto">${e.icon || '📌'}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:700">${e.text || '-'}</div>
                    <div style="font-size:11px;color:#888;margin-top:2px">${date}${e.user ? ` · 👤 ${e.user}` : ''}</div>
                </div>
            </div>`;
        }).join('')}
        </div>`}
    </div>

    <div style="margin-top:18px;text-align:left">
        <button onclick="window.print()" style="background:#1a3a5c;color:white;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:13px">🖨️ طباعة / حفظ PDF</button>
    </div>

    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — المستندات والتقارير (Document Center & Site Reports)            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const PD_DOC_CATEGORIES = {
    contract:       ['📄 عقود', '#e8f4fd', '#1a5276'],
    drawing:        ['📐 مخططات', '#eafaf1', '#1e8449'],
    spec:           ['📘 مواصفات', '#eaf2fb', '#2471a3'],
    permit:         ['🪪 تصاريح', '#fef9e7', '#7d6608'],
    correspondence: ['✉️ مراسلات', '#f5eef8', '#6c3483'],
    report:         ['📋 تقارير', '#fdf2e9', '#a04000'],
    financial:      ['💰 مالية وفواتير', '#fef5e7', '#9c640c'],
    warranty:       ['🛡️ ضمانات', '#eafaf1', '#0e6655'],
    insurance:      ['🏥 تأمينات', '#eaf6f9', '#117a65'],
    certificate:    ['🏅 شهادات واعتمادات', '#fdedec', '#922b21'],
    photo:          ['🖼️ صور', '#f4ecf7', '#7d3c98'],
    other:          ['📦 أخرى', '#f4f4f4', '#555']
};

function pdRenderDocsAndReports(pid) {
    const pane = document.getElementById('pd-tab-docs'); if (!pane) return;
    const sub = window._pd.docsSubTab || 'docs';

    pane.innerHTML = `
    <div style="background:white;border-radius:12px;padding:6px;margin-bottom:14px;display:flex;gap:4px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
        <button onclick="pdSwitchDocsSubTab('${pid}','docs')" style="padding:9px 16px;border-radius:8px;border:none;background:${sub === 'docs' ? '#2d6a9f' : '#f8fafc'};color:${sub === 'docs' ? 'white' : '#1a3a5c'};font-weight:${sub === 'docs' ? '800' : '600'};cursor:pointer;font-size:12px;font-family:inherit">📁 مركز المستندات</button>
        <button onclick="pdSwitchDocsSubTab('${pid}','reports')" style="padding:9px 16px;border-radius:8px;border:none;background:${sub === 'reports' ? '#2d6a9f' : '#f8fafc'};color:${sub === 'reports' ? 'white' : '#1a3a5c'};font-weight:${sub === 'reports' ? '800' : '600'};cursor:pointer;font-size:12px;font-family:inherit">📋 تقارير الموقع</button>
    </div>
    <div id="pd-docs-sub"></div>
    `;
    if (sub === 'reports') pdRenderSiteReports(pid);
    else pdRenderDocCenter(pid);
}

window.pdSwitchDocsSubTab = function (pid, sub) {
    window._pd.docsSubTab = sub;
    pdRenderDocsAndReports(pid);
};

// ── مركز المستندات ──────────────────────────────────────────────
function pdRenderDocCenter(pid) {
    const sub = document.getElementById('pd-docs-sub'); if (!sub) return;
    const filter = window._pd.docCategoryFilter || '';
    const q = (window._pd.docSearch || '').trim().toLowerCase();
    const allDocs = Object.entries((window.projectDocuments || {})[pid] || {})
        .sort((a, b) => new Date(b[1].uploadedAt || 0) - new Date(a[1].uploadedAt || 0));
    const docs = allDocs.filter(([, d]) => (!filter || (d.category || 'other') === filter) && (!q || (d.name || d.fileName || '').toLowerCase().includes(q)));
    const catCount = c => allDocs.filter(([, d]) => (d.category || 'other') === c).length;

    sub.innerHTML = `
    <div class="card">
        <div class="c-tl" style="margin:0 0 12px;border:none;padding:0">🔗 إضافة رابط مستند جديد</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;align-items:end">
            <div style="grid-column:1/-1">
                <label style="${lblStyle()}">رابط المستند (Google Drive أو أي رابط آخر)</label>
                <input type="url" id="pd-doc-url" placeholder="https://drive.google.com/..." style="${inputStyle()}">
            </div>
            ${(window.isCloudinaryConfigured && window.isCloudinaryConfigured()) ? `<div style="grid-column:1/-1;display:flex;gap:8px;align-items:center">
                <button class="btn" onclick="document.getElementById('pd-doc-file').click()" style="background:#16a085;color:#fff" title="رفع ملف من جهازك مباشرة">📤 رفع ملف من جهازك</button>
                <input type="file" id="pd-doc-file" style="display:none" onchange="pdUploadDocFile('${pid}', this)">
                <span style="font-size:11px;color:#888">أو الصق رابطاً في الحقل أعلاه</span>
            </div>` : ''}
            <div>
                <label style="${lblStyle()}">اسم المستند</label>
                <input type="text" id="pd-doc-name" placeholder="مثال: عقد المقاولة الموقّع" style="${inputStyle()}">
            </div>
            <div>
                <label style="${lblStyle()}">التصنيف</label>
                <select id="pd-doc-category" style="${inputStyle()}">
                    ${Object.entries(PD_DOC_CATEGORIES).map(([cat, [label]]) => `<option value="${cat}"${cat === 'other' ? ' selected' : ''}>${label}</option>`).join('')}
                </select>
            </div>
            <div>
                <button class="btn b-g" id="pd-doc-upload-btn" onclick="pdUploadDocument('${pid}')" style="width:100%">➕ إضافة المستند</button>
            </div>
        </div>
        <div style="font-size:11px;color:#888;margin-top:8px">💡 ارفع الملف إلى Google Drive أولاً، ثم اجعل الرابط "متاحاً لأي شخص لديه الرابط" والصق الرابط هنا.</div>
    </div>

    <div class="card" style="margin-top:14px">
        <div class="tlb">
            <div class="c-tl" style="margin:0;border:none;padding:0">📁 مستندات المشروع</div>
            <input id="pd-doc-search" value="${(window._pd.docSearch || '').replace(/"/g, '&quot;')}" oninput="pdSearchDocs('${pid}',this.value)" placeholder="🔍 بحث بالاسم..." style="${inputStyle('max-width:220px')}">
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px">
            <button onclick="pdFilterDocs('${pid}','')" style="padding:5px 12px;border-radius:8px;border:1.5px solid ${filter === '' ? '#2d6a9f' : '#d0d7e0'};background:${filter === '' ? '#2d6a9f' : 'white'};color:${filter === '' ? 'white' : '#1a3a5c'};font-size:11px;font-weight:700;cursor:pointer">الكل (${allDocs.length})</button>
            ${Object.entries(PD_DOC_CATEGORIES).map(([cat, [label]]) => { const n = catCount(cat); if (!n && filter !== cat) return ''; return `<button onclick="pdFilterDocs('${pid}','${cat}')" style="padding:5px 12px;border-radius:8px;border:1.5px solid ${filter === cat ? '#2d6a9f' : '#d0d7e0'};background:${filter === cat ? '#2d6a9f' : 'white'};color:${filter === cat ? 'white' : '#1a3a5c'};font-size:11px;font-weight:700;cursor:pointer">${label}${n ? ` (${n})` : ''}</button>`; }).join('')}
        </div>
        ${docs.length === 0 ? `<div class="empty"><div class="ei">📁</div><p>${allDocs.length ? 'لا نتائج مطابقة للبحث/التصنيف' : 'لا توجد مستندات بعد'}</p></div>` : `
        <div style="display:flex;flex-direction:column;gap:0;margin-top:8px">
        ${docs.map(([dk, d], i) => {
            const [catLabel, catBg, catCl] = PD_DOC_CATEGORIES[d.category] || PD_DOC_CATEGORIES.other;
            const date = d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString('ar-SA') : '-';
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < docs.length - 1 ? 'border-bottom:1px solid #eef2f7' : ''}">
                <div style="font-size:22px">🔗</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:700;color:#1a3a5c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.name || d.fileName || '-'}</div>
                    <div style="font-size:11px;color:#888;margin-top:2px">${date}${d.uploadedBy ? ` · 👤 ${d.uploadedBy}` : ''}</div>
                </div>
                <span style="background:${catBg};color:${catCl};padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700;flex:0 0 auto">${catLabel}</span>
                <a href="${d.url}" target="_blank" rel="noopener" class="btn b-b" style="padding:5px 10px;font-size:11px;flex:0 0 auto">🔗 فتح</a>
                <button class="btn b-r" style="padding:5px 8px;font-size:11px;flex:0 0 auto" onclick="pdDeleteDocument('${pid}','${dk}')">🗑️</button>
            </div>`;
        }).join('')}
        </div>`}
    </div>`;
}

window.pdFilterDocs = function (pid, cat) {
    window._pd.docCategoryFilter = cat;
    pdRenderDocCenter(pid);
};
window.pdSearchDocs = function (pid, v) {
    window._pd.docSearch = v;
    pdRenderDocCenter(pid);
    const el = document.getElementById('pd-doc-search');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
};

// 📤 رفع ملف فعلي عبر Cloudinary ويملأ حقل الرابط والاسم تلقائياً
window.pdUploadDocFile = async function (pid, input) {
    const file = input.files && input.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast('⚠️ الحد الأقصى 10 ميجابايت', 'er'); input.value = ''; return; }
    toast('⏳ جاري رفع الملف...', 'wn', 8000);
    try {
        const r = await window.cloudinaryUpload(file);
        const urlEl = document.getElementById('pd-doc-url'); if (urlEl) urlEl.value = r.url;
        const nameEl = document.getElementById('pd-doc-name'); if (nameEl && !nameEl.value) nameEl.value = r.name || file.name;
        toast('✅ تم رفع الملف — اضغط «إضافة المستند» للحفظ', 'ok', 5000);
    } catch (e) { toast('❌ ' + (e.message || e), 'er', 7000); }
    input.value = '';
};
window.pdUploadDocument = async function (pid) {
    const url = document.getElementById('pd-doc-url')?.value.trim();
    if (!url) { toast('أدخل رابط المستند أولاً', 'er'); return; }
    if (!/^https?:\/\//i.test(url)) { toast('⚠️ الرابط غير صالح، يجب أن يبدأ بـ http:// أو https://', 'er'); return; }
    const customName = document.getElementById('pd-doc-name')?.value.trim();
    if (!customName) { toast('أدخل اسم المستند', 'er'); return; }
    const category = document.getElementById('pd-doc-category')?.value || 'other';

    const btn = document.getElementById('pd-doc-upload-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جارٍ الإضافة...'; }
    try {
        await push(ref(db, `ledger/projectDocuments/${pid}`), {
            name: customName,
            category,
            url,
            uploadedAt: new Date().toISOString(),
            uploadedBy: window.myP?.name || window.curU?.email || ''
        });
        pdLogActivity(pid, '🔗', `إضافة رابط مستند: ${customName}`);
        toast('تمت إضافة المستند ✓', 'ok');
        setTimeout(() => pdRenderTab('docs'), 400);
    } catch (e) {
        toast('خطأ: ' + e.message, 'er');
        if (btn) { btn.disabled = false; btn.textContent = '➕ إضافة المستند'; }
    }
};

window.pdDeleteDocument = function (pid, docKey) {
    const d = (window.projectDocuments || {})[pid]?.[docKey]; if (!d) return;
    cf2(`هل تريد حذف المستند "${d.name || d.fileName}"؟`, async () => {
        try {
            await remove(ref(db, `ledger/projectDocuments/${pid}/${docKey}`));
            pdLogActivity(pid, '🗑️', `حذف مستند: ${d.name || d.fileName}`);
            toast('تم الحذف', 'ok');
            setTimeout(() => pdRenderTab('docs'), 400);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ── تقارير الموقع اليومية/الأسبوعية ──────────────────────────────
// 🏗️ تقرير الموقع الاحترافي — جداول ديناميكية (عمالة/معدّات/مواد)
window._pdSr = window._pdSr || { labor: [], equip: [], mat: [] };
const PD_SR_DEFS = {
    labor: { fields: [{ k: 'trade', ph: 'التخصص (نجار/حداد/كهربائي...)', grow: true }, { k: 'count', ph: 'العدد', type: 'number', w: '90px' }], add: '➕ تخصص' },
    equip: { fields: [{ k: 'name', ph: 'المعدّة (حفّار/رافعة...)', grow: true }, { k: 'count', ph: 'عدد', type: 'number', w: '80px' }, { k: 'hours', ph: 'ساعات', type: 'number', w: '80px' }], add: '➕ معدّة' },
    mat: { fields: [{ k: 'material', ph: 'المادة المستلمة', grow: true }, { k: 'qty', ph: 'الكمية', type: 'number', w: '90px' }, { k: 'unit', ph: 'الوحدة', w: '90px' }], add: '➕ مادة' },
};
function pdSrRows(sk) {
    const rows = window._pdSr[sk] || [], def = PD_SR_DEFS[sk];
    if (!rows.length) return '<div style="color:#aaa;font-size:12px;padding:4px 0">— لا شيء —</div>';
    return rows.map((r, i) => `<div style="display:flex;gap:6px;margin-bottom:5px">
        ${def.fields.map(f => `<input ${f.type ? `type="${f.type}"` : ''} value="${(r[f.k] ?? '').toString().replace(/"/g, '&quot;')}" placeholder="${f.ph}" oninput="window._pdSr['${sk}'][${i}]['${f.k}']=this.value" style="${f.grow ? 'flex:1' : 'flex:0 0 ' + f.w};padding:8px;border:1.5px solid #d0d7e0;border-radius:7px;font-family:inherit;font-size:12.5px">`).join('')}
        <button class="btn b-r" style="padding:4px 9px" onclick="window._pdSr['${sk}'].splice(${i},1);document.getElementById('pd-sr-${sk}').innerHTML=pdSrRows('${sk}')">🗑️</button>
    </div>`).join('');
}
window.pdSrAdd = function (sk) { window._pdSr[sk].push({}); document.getElementById('pd-sr-' + sk).innerHTML = pdSrRows(sk); };
function pdSrTotalLabor() { return (window._pdSr.labor || []).reduce((s, r) => s + (parseInt(r.count) || 0), 0); }

function pdRenderSiteReports(pid) {
    const sub = document.getElementById('pd-docs-sub'); if (!sub) return;
    window._pdSr = { labor: [], equip: [], mat: [] }; // نموذج جديد فارغ (يُعاد ملؤه عند التعديل عبر pdOpenReportForm)
    const reports = Object.entries((window.projectSiteReports || {})[pid] || {})
        .sort((a, b) => new Date(b[1].date || 0) - new Date(a[1].date || 0));

    const typeMap = { daily: ['📅 يومي', '#e8f4fd', '#1a5276'], weekly: ['🗓️ أسبوعي', '#fef9e7', '#7d6608'] };

    sub.innerHTML = `
    <div class="card">
        <div class="c-tl" style="margin:0 0 12px;border:none;padding:0" id="pd-rep-form-title">🏗️ إضافة تقرير موقع</div>
        <input type="hidden" id="pd-rep-key">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
            <div>
                <label style="${lblStyle()}">التاريخ</label>
                <input type="date" id="pd-rep-date" value="${new Date().toISOString().slice(0, 10)}" style="${inputStyle()}">
            </div>
            <div>
                <label style="${lblStyle()}">نوع التقرير</label>
                <select id="pd-rep-type" style="${inputStyle()}">
                    <option value="daily">📅 يومي</option>
                    <option value="weekly">🗓️ أسبوعي</option>
                </select>
            </div>
            <div>
                <label style="${lblStyle()}">حالة الطقس</label>
                <select id="pd-rep-weathercond" style="${inputStyle()}">
                    <option value="">—</option><option value="مشمس">☀️ مشمس</option><option value="غائم جزئياً">⛅ غائم جزئياً</option><option value="غائم">☁️ غائم</option><option value="ممطر">🌧️ ممطر</option><option value="عاصف">💨 عاصف</option><option value="حار">🔥 حار شديد</option><option value="غبار">🌫️ غبار</option>
                </select>
            </div>
            <div>
                <label style="${lblStyle()}">الحرارة °م</label>
                <input type="number" id="pd-rep-temp" placeholder="مثال: 42" style="${inputStyle()}">
            </div>
            <div>
                <label style="${lblStyle()}">ساعات العمل</label>
                <input type="number" id="pd-rep-hours" min="0" step="0.5" placeholder="مثال: 8" style="${inputStyle()}">
            </div>
        </div>
        <input type="hidden" id="pd-rep-weather">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:14px">
            <div style="background:#f8fafc;border-radius:10px;padding:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><label style="${lblStyle()};margin:0">👷 العمالة حسب التخصص</label><button class="btn b-b" style="padding:4px 10px;font-size:11px" onclick="pdSrAdd('labor')">➕ تخصص</button></div>
                <div id="pd-sr-labor"></div>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><label style="${lblStyle()};margin:0">🚜 المعدّات وساعات التشغيل</label><button class="btn b-b" style="padding:4px 10px;font-size:11px" onclick="pdSrAdd('equip')">➕ معدّة</button></div>
                <div id="pd-sr-equip"></div>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><label style="${lblStyle()};margin:0">📦 المواد المستلمة</label><button class="btn b-b" style="padding:4px 10px;font-size:11px" onclick="pdSrAdd('mat')">➕ مادة</button></div>
                <div id="pd-sr-mat"></div>
            </div>
        </div>
        <div style="margin-top:12px">
            <label style="${lblStyle()}">الأعمال المنجزة</label>
            <textarea id="pd-rep-work" rows="3" placeholder="وصف الأعمال المنفذة خلال الفترة..." style="${inputStyle('resize:vertical')}"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
            <div><label style="${lblStyle()}">التأخيرات والمعوقات (وأثر الطقس)</label><textarea id="pd-rep-issues" rows="2" placeholder="أي تأخير أو معوق وأثره على الجدول..." style="${inputStyle('resize:vertical')}"></textarea></div>
            <div><label style="${lblStyle()}">ملاحظات السلامة</label><textarea id="pd-rep-safety" rows="2" placeholder="ملاحظات HSE، تصاريح عمل، حوادث..." style="${inputStyle('resize:vertical')}"></textarea></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
            <div><label style="${lblStyle()}">زوّار الموقع</label><input id="pd-rep-visitors" placeholder="الاستشاري، المالك، جهات..." style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">روابط الصور (رابط بكل سطر)</label><textarea id="pd-rep-photos" rows="2" placeholder="https://...
https://..." style="${inputStyle('resize:vertical')}"></textarea></div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveSiteReport('${pid}')">💾 حفظ التقرير</button>
            <button class="btn b-b" onclick="pdResetReportForm()">↩️ مسح</button>
        </div>
    </div>

    <div class="card" style="margin-top:14px">
        <div class="c-tl" style="margin:0 0 12px;border:none;padding:0">📋 تقارير الموقع السابقة</div>
        ${reports.length === 0 ? '<div class="empty"><div class="ei">📋</div><p>لا توجد تقارير بعد</p></div>' : `
        <div style="display:flex;flex-direction:column;gap:10px">
        ${reports.map(([rk, r]) => {
            const [tl, tbg, tcl] = typeMap[r.type] || typeMap.daily;
            const labor = Array.isArray(r.labor) ? r.labor.filter(x => x.trade || x.count) : [];
            const equip = Array.isArray(r.equipment) ? r.equipment.filter(x => x.name) : [];
            const mat = Array.isArray(r.materials) ? r.materials.filter(x => x.material) : [];
            const totMan = labor.reduce((s, x) => s + (parseInt(x.count) || 0), 0) || r.manpower || 0;
            const photos = Array.isArray(r.photos) ? r.photos.filter(Boolean) : [];
            const chip = (t) => `<span style="background:#eef3f8;color:#445;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600">${t}</span>`;
            return `<div style="background:${tbg};border:1px solid ${tcl}44;border-radius:10px;padding:14px;border-right:4px solid ${tcl}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;flex-wrap:wrap;gap:6px">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="background:${tcl}22;color:${tcl};padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700">${tl}</span>
                        <span style="font-size:13px;font-weight:800;color:#1a3a5c">${r.date || '-'}</span>
                        ${(r.weatherCond || r.weather) ? `<span style="font-size:11px;color:#666">🌤️ ${r.weatherCond || r.weather}${r.temperature ? ` · ${r.temperature}°م` : ''}</span>` : ''}
                        ${totMan ? `<span style="font-size:11px;color:#666">👷 ${totMan} عامل</span>` : ''}
                        ${r.workHours ? `<span style="font-size:11px;color:#666">⏱️ ${r.workHours} س</span>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:6px">
                        <button class="btn b-b" style="padding:3px 7px;font-size:11px" onclick="pdOpenReportForm('${pid}','${rk}')">✏️</button>
                        <button class="btn b-r" style="padding:3px 7px;font-size:11px" onclick="pdDeleteSiteReport('${pid}','${rk}')">🗑️</button>
                    </div>
                </div>
                <div style="font-size:13px;color:#333;line-height:1.7"><strong>الأعمال المنجزة:</strong> ${(r.workDone || '-').replace(/\n/g, '<br>')}</div>
                ${labor.length ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">👷 ${labor.map(x => chip(`${x.trade || 'عمالة'}: ${x.count || 0}`)).join('')}</div>` : ''}
                ${equip.length ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">🚜 ${equip.map(x => chip(`${x.name}${x.count ? ' ×' + x.count : ''}${x.hours ? ' · ' + x.hours + 'س' : ''}`)).join('')}</div>` : ''}
                ${mat.length ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">📦 ${mat.map(x => chip(`${x.material}: ${x.qty || ''} ${x.unit || ''}`)).join('')}</div>` : ''}
                ${r.issues ? `<div style="font-size:12px;color:#922b21;margin-top:6px"><strong>التأخيرات/المعوقات:</strong> ${r.issues.replace(/\n/g, '<br>')}</div>` : ''}
                ${r.safetyNotes ? `<div style="font-size:12px;color:#7d4e00;margin-top:6px"><strong>🦺 السلامة:</strong> ${r.safetyNotes.replace(/\n/g, '<br>')}</div>` : ''}
                ${r.visitors ? `<div style="font-size:11px;color:#555;margin-top:6px">🚶 الزوّار: ${r.visitors}</div>` : ''}
                ${photos.length ? `<div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap">${photos.map((u, i) => `<a href="${u}" target="_blank" style="color:#2980b9;font-weight:700;font-size:11px">🖼️ صورة ${i + 1}</a>`).join('')}</div>` : ''}
                ${r.reportedBy ? `<div style="font-size:11px;color:#888;margin-top:6px">👤 ${r.reportedBy}</div>` : ''}
            </div>`;
        }).join('')}
        </div>`}
    </div>`;
    // تعبئة الجداول الديناميكية (لا تُنفَّذ من innerHTML)
    const _l = document.getElementById('pd-sr-labor'); if (_l) _l.innerHTML = pdSrRows('labor');
    const _e = document.getElementById('pd-sr-equip'); if (_e) _e.innerHTML = pdSrRows('equip');
    const _m = document.getElementById('pd-sr-mat'); if (_m) _m.innerHTML = pdSrRows('mat');
}

window.pdResetReportForm = function () {
    ['pd-rep-key', 'pd-rep-weather', 'pd-rep-weathercond', 'pd-rep-temp', 'pd-rep-hours', 'pd-rep-work', 'pd-rep-issues', 'pd-rep-safety', 'pd-rep-visitors', 'pd-rep-photos'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const dateEl = document.getElementById('pd-rep-date'); if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
    const typeEl = document.getElementById('pd-rep-type'); if (typeEl) typeEl.value = 'daily';
    window._pdSr = { labor: [], equip: [], mat: [] };
    ['labor', 'equip', 'mat'].forEach(sk => { const el = document.getElementById('pd-sr-' + sk); if (el) el.innerHTML = pdSrRows(sk); });
    const titleEl = document.getElementById('pd-rep-form-title'); if (titleEl) titleEl.textContent = '🏗️ إضافة تقرير موقع';
};

window.pdOpenReportForm = function (pid, repKey) {
    window._pd.docsSubTab = 'reports';
    pdRenderDocsAndReports(pid);
    setTimeout(() => {
        const r = (window.projectSiteReports || {})[pid]?.[repKey]; if (!r) return;
        document.getElementById('pd-rep-key').value = repKey;
        document.getElementById('pd-rep-date').value = r.date || '';
        document.getElementById('pd-rep-type').value = r.type || 'daily';
        const wc = document.getElementById('pd-rep-weathercond'); if (wc) wc.value = r.weatherCond || r.weather || '';
        const tp = document.getElementById('pd-rep-temp'); if (tp) tp.value = r.temperature || '';
        const hr = document.getElementById('pd-rep-hours'); if (hr) hr.value = r.workHours || '';
        document.getElementById('pd-rep-work').value = r.workDone || '';
        document.getElementById('pd-rep-issues').value = r.issues || '';
        const sf = document.getElementById('pd-rep-safety'); if (sf) sf.value = r.safetyNotes || '';
        const vs = document.getElementById('pd-rep-visitors'); if (vs) vs.value = r.visitors || '';
        const ph = document.getElementById('pd-rep-photos'); if (ph) ph.value = (Array.isArray(r.photos) ? r.photos.join('\n') : '');
        window._pdSr = {
            labor: Array.isArray(r.labor) ? r.labor.map(x => ({ ...x })) : [],
            equip: Array.isArray(r.equipment) ? r.equipment.map(x => ({ ...x })) : [],
            mat: Array.isArray(r.materials) ? r.materials.map(x => ({ ...x })) : [],
        };
        ['labor', 'equip', 'mat'].forEach(sk => { const el = document.getElementById('pd-sr-' + sk); if (el) el.innerHTML = pdSrRows(sk); });
        document.getElementById('pd-rep-form-title').textContent = '✏️ تعديل تقرير الموقع';
    }, 50);
};

window.pdSaveSiteReport = async function (pid) {
    const date = document.getElementById('pd-rep-date')?.value;
    const type = document.getElementById('pd-rep-type')?.value || 'daily';
    const weatherCond = document.getElementById('pd-rep-weathercond')?.value || '';
    const temperature = document.getElementById('pd-rep-temp')?.value || '';
    const workHours = document.getElementById('pd-rep-hours')?.value || '';
    const workDone = document.getElementById('pd-rep-work')?.value.trim();
    const issues = document.getElementById('pd-rep-issues')?.value.trim();
    const safetyNotes = document.getElementById('pd-rep-safety')?.value.trim() || '';
    const visitors = document.getElementById('pd-rep-visitors')?.value.trim() || '';
    const photos = (document.getElementById('pd-rep-photos')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
    const labor = (window._pdSr.labor || []).filter(x => x.trade || x.count).map(x => ({ trade: (x.trade || '').trim(), count: parseInt(x.count) || 0 }));
    const equipment = (window._pdSr.equip || []).filter(x => x.name).map(x => ({ name: (x.name || '').trim(), count: parseInt(x.count) || 0, hours: parseFloat(x.hours) || 0 }));
    const materials = (window._pdSr.mat || []).filter(x => x.material).map(x => ({ material: (x.material || '').trim(), qty: x.qty || '', unit: (x.unit || '').trim() }));
    const manpower = labor.reduce((s, x) => s + (x.count || 0), 0);
    if (!date) { toast('اختر التاريخ', 'er'); return; }
    if (!workDone) { toast('أدخل وصف الأعمال المنجزة', 'er'); return; }
    const data = { date, type, weatherCond, weather: weatherCond, temperature, workHours, workDone, issues, safetyNotes, visitors, photos, labor, equipment, materials, manpower, updatedAt: new Date().toISOString() };
    const repKey = document.getElementById('pd-rep-key')?.value;
    const typeLabel = type === 'daily' ? 'يومي' : 'أسبوعي';
    try {
        if (repKey) {
            await update(ref(db, `ledger/projectSiteReports/${pid}/${repKey}`), data);
            pdLogActivity(pid, '✏️', `تعديل تقرير ${typeLabel} بتاريخ ${date}`);
            toast('تم التحديث ✓', 'ok');
        } else {
            data.createdAt = new Date().toISOString();
            data.reportedBy = window.myP?.name || window.curU?.email || '';
            await push(ref(db, `ledger/projectSiteReports/${pid}`), data);
            pdLogActivity(pid, '📋', `تقرير ${typeLabel} جديد بتاريخ ${date}`);
            toast('تم إضافة التقرير ✓', 'ok');
        }
        pdResetReportForm();
        setTimeout(() => pdRenderTab('docs'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.pdDeleteSiteReport = function (pid, repKey) {
    const r = (window.projectSiteReports || {})[pid]?.[repKey];
    cf2('هل تريد حذف هذا التقرير؟', async () => {
        try {
            await remove(ref(db, `ledger/projectSiteReports/${pid}/${repKey}`));
            pdLogActivity(pid, '🗑️', `حذف تقرير ${r?.type === 'daily' ? 'يومي' : 'أسبوعي'} بتاريخ ${r?.date || ''}`);
            toast('تم الحذف', 'ok');
            setTimeout(() => pdRenderTab('docs'), 400);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ── مساعدات الستايل ────────────────────────────────────────────────
function inputStyle(extra = '') {
    return `width:100%;box-sizing:border-box;padding:9px 10px;border:1.5px solid #d0d7e0;border-radius:8px;font-family:inherit;font-size:13px;background:#fff;${extra}`;
}
function lblStyle() {
    return `font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px`;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — تكاليف التنفيذ الشهرية (PMC)                                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function pdRenderPMC(pid) {
    const pane = document.getElementById('pd-tab-pmc'); if (!pane) return;
    const records = Object.entries(window.projectMonthlyCosts || {})
        .filter(([, c]) => c.projectId === pid)
        .sort(([, a], [, b]) => (b.date || b.month || '').localeCompare(a.date || a.month || ''));

    const f = n => (parseFloat(n) || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const getCatInfo = cat => (typeof getPMCCategoryInfo === 'function')
        ? getPMCCategoryInfo(cat)
        : { ar: cat || '—', color: '#888', bg: '#f0f5fa' };

    if (!records.length) {
        pane.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:#aaa">
            <div style="font-size:40px;margin-bottom:12px">📦</div>
            <div style="font-size:16px;font-weight:700;margin-bottom:8px">لا توجد تكاليف تنفيذ مسجّلة لهذا المشروع</div>
            <div style="font-size:13px">يمكنك إضافة التكاليف من قسم <strong>تكاليف المشاريع الشهرية</strong></div>
            <button onclick="window._pmcPresetProjectId='${pid}';bcNav('projectcosts')" class="btn" style="margin-top:16px;background:#1a3a5c;color:white;padding:10px 20px;font-size:13px">
                📦 الذهاب لإدخال التكاليف
            </button>
        </div>`;
        return;
    }

    // ── حسابات ──
    const grandTotal = records.reduce((s, [, c]) => s + (parseFloat(c.amount) || 0), 0);

    // تجميع حسب الشهر
    const byMonth = {};
    records.forEach(([, c]) => {
        const m = c.month || (c.date ? c.date.slice(0, 7) : 'غير محدد');
        if (!byMonth[m]) byMonth[m] = { total: 0, count: 0 };
        byMonth[m].total += parseFloat(c.amount) || 0;
        byMonth[m].count++;
    });
    const months = Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a));

    // تجميع حسب التصنيف L1
    const byL1 = {};
    records.forEach(([, c]) => {
        const k = c.level1 || '(بدون تصنيف)';
        if (!byL1[k]) byL1[k] = { total: 0, count: 0, cats: {} };
        byL1[k].total += parseFloat(c.amount) || 0;
        byL1[k].count++;
        byL1[k].cats[c.category] = (byL1[k].cats[c.category] || 0) + (parseFloat(c.amount) || 0);
    });
    const l1Entries = Object.entries(byL1).sort(([, a], [, b]) => b.total - a.total);

    // أكبر قيمة شهرية للنسبة
    const maxMonthVal = Math.max(...months.map(([, v]) => v.total), 1);

    pane.innerHTML = `
    <!-- ── شريط الملخص ── -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px">
        <div style="background:linear-gradient(135deg,#c0392b,#e74c3c);color:white;border-radius:12px;padding:14px 16px;text-align:center">
            <div style="font-size:11px;opacity:.8;margin-bottom:4px">إجمالي التكاليف</div>
            <div style="font-size:18px;font-weight:900">${f(grandTotal)}</div>
            <div style="font-size:10px;opacity:.7">ريال</div>
        </div>
        <div style="background:white;border:1px solid #e0e8f0;border-radius:12px;padding:14px 16px;text-align:center;border-top:3px solid #e67e22">
            <div style="font-size:11px;color:#888;margin-bottom:4px">عدد السجلات</div>
            <div style="font-size:22px;font-weight:800;color:#e67e22">${records.length}</div>
            <div style="font-size:10px;color:#aaa">بند</div>
        </div>
        <div style="background:white;border:1px solid #e0e8f0;border-radius:12px;padding:14px 16px;text-align:center;border-top:3px solid #2d6a9f">
            <div style="font-size:11px;color:#888;margin-bottom:4px">الأشهر المسجّلة</div>
            <div style="font-size:22px;font-weight:800;color:#2d6a9f">${months.length}</div>
            <div style="font-size:10px;color:#aaa">شهر</div>
        </div>
        <div style="background:white;border:1px solid #e0e8f0;border-radius:12px;padding:14px 16px;text-align:center;border-top:3px solid #27ae60">
            <div style="font-size:11px;color:#888;margin-bottom:4px">التصنيفات</div>
            <div style="font-size:22px;font-weight:800;color:#27ae60">${l1Entries.length}</div>
            <div style="font-size:10px;color:#aaa">مستوى أول</div>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">

        <!-- ── توزيع التصنيفات ── -->
        <div class="card">
            <div class="c-tl" style="margin-bottom:14px">📊 توزيع التكاليف بالتصنيف</div>
            ${l1Entries.map(([l1, data]) => {
                const pct = grandTotal > 0 ? (data.total / grandTotal * 100) : 0;
                const topCat = Object.entries(data.cats).sort(([,a],[,b])=>b-a)[0];
                const catInfo = topCat ? getCatInfo(topCat[0]) : { ar:'—', bg:'#eee', color:'#888' };
                return `<div style="margin-bottom:12px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <span style="font-size:12px;font-weight:700;color:#1a3a5c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${l1}</span>
                        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                            <span style="background:${catInfo.bg};color:${catInfo.color};padding:1px 6px;border-radius:5px;font-size:10px">${catInfo.ar}</span>
                            <span style="font-size:12px;font-weight:800;color:#c0392b">${f(data.total)}</span>
                            <span style="font-size:10px;color:#888">${pct.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div style="background:#f0f2f5;border-radius:4px;height:6px;overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#c0392b,#e74c3c);border-radius:4px;transition:width .4s"></div>
                    </div>
                </div>`;
            }).join('')}
        </div>

        <!-- ── الجدول الزمني الشهري ── -->
        <div class="card">
            <div class="c-tl" style="margin-bottom:14px">📅 التوزيع الشهري</div>
            <div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto">
            ${months.map(([m, data]) => {
                const pct = maxMonthVal > 0 ? (data.total / maxMonthVal * 100) : 0;
                const [yr, mo] = m.split('-');
                const moName = mo ? new Date(parseInt(yr), parseInt(mo)-1, 1).toLocaleDateString('ar-SA', { month:'long', year:'numeric' }) : m;
                return `<div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                        <span style="font-size:11px;font-weight:700;color:#444">${moName}</span>
                        <div style="display:flex;gap:6px;align-items:center">
                            <span style="font-size:10px;color:#888">${data.count} بند</span>
                            <span style="font-size:12px;font-weight:800;color:#1a3a5c">${f(data.total)} ر</span>
                        </div>
                    </div>
                    <div style="background:#f0f2f5;border-radius:3px;height:5px;overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:#2d6a9f;border-radius:3px"></div>
                    </div>
                </div>`;
            }).join('')}
            </div>
        </div>
    </div>

    <!-- ── جدول السجلات التفصيلية ── -->
    <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div class="c-tl">📋 سجلات التكاليف التفصيلية</div>
            <button onclick="window._pmcPresetProjectId='${pid}';bcNav('projectcosts')" class="btn" style="background:#1a3a5c;color:white;padding:6px 14px;font-size:11px">
                ＋ إضافة تكلفة جديدة
            </button>
        </div>
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
                <tr style="background:#f5f7fa;color:#555;font-size:11px">
                    <th style="padding:8px 12px;text-align:right;font-weight:700;border-bottom:2px solid #e0e8f0">التاريخ</th>
                    <th style="padding:8px 12px;text-align:right;font-weight:700;border-bottom:2px solid #e0e8f0">التصنيف</th>
                    <th style="padding:8px 12px;text-align:right;font-weight:700;border-bottom:2px solid #e0e8f0">النوع</th>
                    <th style="padding:8px 12px;text-align:right;font-weight:700;border-bottom:2px solid #e0e8f0">الوصف</th>
                    <th style="padding:8px 12px;text-align:center;font-weight:700;border-bottom:2px solid #e0e8f0">المبلغ (ر)</th>
                </tr>
            </thead>
            <tbody>
            ${records.map(([key, c], i) => {
                const catInfo = getCatInfo(c.category);
                const dateLabel = c.date || c.month || '—';
                return `<tr style="background:${i%2?'#f8fafc':'white'};border-bottom:1px solid #f0f2f5" onmouseover="this.style.background='#eef6ff'" onmouseout="this.style.background='${i%2?'#f8fafc':'white'}'">
                    <td style="padding:8px 12px;white-space:nowrap;color:#555">${dateLabel}</td>
                    <td style="padding:8px 12px;white-space:nowrap;font-weight:600;color:#1a3a5c">${c.level1 || '—'}</td>
                    <td style="padding:8px 12px">
                        <span style="background:${catInfo.bg};color:${catInfo.color};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">${catInfo.ar}</span>
                    </td>
                    <td style="padding:8px 12px;color:#444;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.description || c.reference || '—'}</td>
                    <td style="padding:8px 12px;text-align:center;font-weight:800;color:#c0392b;white-space:nowrap">${f(c.amount)}</td>
                </tr>`;
            }).join('')}
            </tbody>
            <tfoot>
                <tr style="background:#1a3a5c;color:white;font-weight:900">
                    <td colspan="4" style="padding:10px 12px;font-size:13px">📊 الإجمالي الكلي</td>
                    <td style="padding:10px 12px;text-align:center;font-size:14px">${f(grandTotal)}</td>
                </tr>
            </tfoot>
        </table>
        </div>
    </div>`;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — الجدول الزمني والمراحل (Timeline & Milestones)                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// الحالات الممكنة للمرحلة
const PD_MS_STATUS = {
    planned:    ['🔵 مخطط',        '#e8f0f7', '#2d6a9f'],
    inprogress: ['🟠 قيد التنفيذ',  '#fef5e7', '#b9770e'],
    done:       ['🟢 مكتملة',      '#eafaf1', '#1e8449'],
    onhold:     ['⏸️ متوقفة',      '#f4f4f4', '#666']
};

// مرحلة متأخرة = غير مكتملة وتجاوزت تاريخ الانتهاء المخطط
function pdMsIsDelayed(ms, todayStr) {
    return ms.status !== 'done' && ms.plannedEnd && ms.plannedEnd < todayStr;
}

function pdRenderTimeline(pid) {
    const pane = document.getElementById('pd-tab-timeline'); if (!pane) return;
    const p = (window.projects || {})[pid] || {};
    const todayStr = new Date().toISOString().slice(0, 10);

    const list = Object.entries((window.projectMilestones || {})[pid] || {})
        .sort((a, b) => (a[1].plannedStart || '').localeCompare(b[1].plannedStart || ''));

    // ── إحصاءات ──
    const doneCount = list.filter(([, m]) => m.status === 'done').length;
    const delayedCount = list.filter(([, m]) => pdMsIsDelayed(m, todayStr)).length;
    const inProgCount = list.filter(([, m]) => m.status === 'inprogress').length;
    // الإنجاز المرجح: Σ(الوزن × نسبة الإنجاز) ÷ Σ الأوزان — إن لم تُحدد أوزان تُحتسب بالتساوي
    const totalWeight = list.reduce((s, [, m]) => s + (parseFloat(m.weight) || 0), 0);
    const weightedProgress = list.length === 0 ? 0 : totalWeight > 0
        ? list.reduce((s, [, m]) => s + (parseFloat(m.weight) || 0) * (parseFloat(m.progress) || 0), 0) / totalWeight
        : list.reduce((s, [, m]) => s + (parseFloat(m.progress) || 0), 0) / list.length;

    // ── مدى المخطط الزمني: من أقدم تاريخ إلى أحدث تاريخ (مع مدة المشروع) ──
    const allDates = [];
    if (p.startDate) allDates.push(p.startDate);
    if (p.endDate) allDates.push(p.endDate);
    list.forEach(([, m]) => [m.plannedStart, m.plannedEnd, m.actualStart, m.actualEnd].forEach(d => { if (d) allDates.push(d); }));
    allDates.sort();
    const rangeStart = allDates[0] || todayStr, rangeEnd = allDates[allDates.length - 1] || todayStr;
    const rangeMs = Math.max(1, new Date(rangeEnd) - new Date(rangeStart));
    // موضع تاريخ معيّن كنسبة من المدى (من اليمين في واجهة RTL)
    const pos = d => Math.min(100, Math.max(0, (new Date(d) - new Date(rangeStart)) / rangeMs * 100));
    const todayPos = pos(todayStr);
    const showToday = todayStr >= rangeStart && todayStr <= rangeEnd;

    // ── شريط زمني لمرحلة واحدة (مخطط + فعلي) ──
    const msBar = (m, delayed) => {
        const ps = m.plannedStart, pe = m.plannedEnd;
        if (!ps || !pe) return '<div style="font-size:11px;color:#aaa">لا توجد تواريخ مخططة</div>';
        const right = pos(ps), width = Math.max(1.5, pos(pe) - pos(ps));
        const as = m.actualStart, ae = m.actualEnd || (m.status === 'inprogress' ? todayStr : null);
        const aRight = as ? pos(as) : null, aWidth = (as && ae) ? Math.max(1.5, pos(ae) - pos(as)) : null;
        const [, , scl] = PD_MS_STATUS[m.status] || PD_MS_STATUS.planned;
        return `<div style="position:relative;height:${as ? 26 : 16}px;background:#f2f6fa;border-radius:8px;overflow:hidden">
            <div title="مخطط: ${ps} ← ${pe}" style="position:absolute;top:2px;right:${right}%;width:${width}%;height:12px;border-radius:6px;background:${delayed ? '#e74c3c' : scl};opacity:.85"></div>
            ${as ? `<div title="فعلي: ${as} ← ${m.actualEnd || 'مستمر'}" style="position:absolute;top:16px;right:${aRight}%;width:${aWidth || 1.5}%;height:7px;border-radius:4px;background:#8e44ad"></div>` : ''}
            ${showToday ? `<div title="اليوم" style="position:absolute;top:0;bottom:0;right:${todayPos}%;width:2px;background:#c0392b88"></div>` : ''}
        </div>`;
    };

    pane.innerHTML = `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:14px">
        ${kpiCard('🗂️', 'عدد المراحل', String(list.length), 'مرحلة', '#2d6a9f')}
        ${kpiCard('🟢', 'مكتملة', String(doneCount), 'مرحلة', '#1e8449')}
        ${kpiCard('🟠', 'قيد التنفيذ', String(inProgCount), 'مرحلة', '#b9770e')}
        ${kpiCard('🚨', 'متأخرة', String(delayedCount), 'تجاوزت الموعد المخطط', delayedCount > 0 ? '#e74c3c' : '#888')}
        ${kpiCard('📈', 'الإنجاز المرجح', weightedProgress.toFixed(1) + '%', totalWeight > 0 ? 'حسب أوزان المراحل' : 'متوسط بسيط (بدون أوزان)', '#8e44ad')}
    </div>

    <div class="card">
        <div class="tlb">
            <div class="c-tl" style="margin:0;border:none;padding:0">⏱️ مراحل المشروع</div>
            <button class="btn b-g" onclick="pdOpenMilestoneForm('${pid}')">➕ إضافة مرحلة</button>
        </div>
        ${list.length === 0 ? '<div class="empty"><div class="ei">⏱️</div><p>لا توجد مراحل بعد — أضف أول مرحلة للمشروع</p></div>' : `
        <div style="display:flex;align-items:center;gap:14px;font-size:11px;color:#666;margin:10px 0 4px;flex-wrap:wrap">
            <span>المدى: <strong>${rangeStart}</strong> ← <strong>${rangeEnd}</strong></span>
            <span><span style="display:inline-block;width:18px;height:8px;border-radius:4px;background:#2d6a9f;vertical-align:middle"></span> مخطط</span>
            <span><span style="display:inline-block;width:18px;height:8px;border-radius:4px;background:#8e44ad;vertical-align:middle"></span> فعلي</span>
            <span><span style="display:inline-block;width:2px;height:12px;background:#c0392b;vertical-align:middle"></span> اليوم</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
        ${list.map(([mk, m]) => {
            const delayed = pdMsIsDelayed(m, todayStr);
            const [sl, sbg, scl] = PD_MS_STATUS[m.status] || PD_MS_STATUS.planned;
            const prog = Math.min(100, Math.max(0, parseFloat(m.progress) || 0));
            return `<div style="background:white;border:1px solid ${delayed ? '#e74c3c66' : '#e3eaf2'};border-radius:10px;padding:12px 14px;border-right:4px solid ${delayed ? '#e74c3c' : scl}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                    <div style="flex:1;min-width:200px">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                            <span style="font-size:14px;font-weight:800;color:#1a3a5c">${m.name || 'مرحلة'}</span>
                            <span style="background:${sbg};color:${scl};padding:2px 9px;border-radius:8px;font-size:11px;font-weight:700">${sl}</span>
                            ${delayed ? '<span style="background:#fdedec;color:#922b21;padding:2px 9px;border-radius:8px;font-size:11px;font-weight:700">🚨 متأخرة</span>' : ''}
                            ${parseFloat(m.weight) ? `<span style="background:#f4ecf7;color:#6c3483;padding:2px 9px;border-radius:8px;font-size:11px;font-weight:700">⚖️ ${m.weight}%</span>` : ''}
                        </div>
                        <div style="font-size:11.5px;color:#777;margin-top:5px">
                            مخطط: ${m.plannedStart || '-'} ← ${m.plannedEnd || '-'}
                            ${m.actualStart ? ` &nbsp;|&nbsp; فعلي: ${m.actualStart} ← ${m.actualEnd || 'مستمر'}` : ''}
                        </div>
                        ${m.notes ? `<div style="font-size:12px;color:#555;margin-top:5px">📝 ${m.notes}</div>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        <div style="text-align:center;margin-left:6px">
                            <div style="font-size:16px;font-weight:900;color:${prog >= 100 ? '#1e8449' : '#2d6a9f'}">${prog}%</div>
                            <div style="font-size:10px;color:#999">إنجاز</div>
                        </div>
                        ${m.status === 'planned' ? `<button class="btn b-o" style="padding:4px 9px;font-size:11px" onclick="pdQuickMsStatus('${pid}','${mk}','start')">▶️ بدء</button>` : ''}
                        ${m.status === 'inprogress' ? `<button class="btn b-g" style="padding:4px 9px;font-size:11px" onclick="pdQuickMsStatus('${pid}','${mk}','finish')">✔️ إنهاء</button>` : ''}
                        <button class="btn b-b" style="padding:4px 9px;font-size:11px" onclick="pdOpenMilestoneForm('${pid}','${mk}')">✏️</button>
                        <button class="btn b-r" style="padding:4px 9px;font-size:11px" onclick="pdDeleteMilestone('${pid}','${mk}')">🗑️</button>
                    </div>
                </div>
                ${msBar(m, delayed)}
            </div>`;
        }).join('')}
        </div>`}
    </div>

    <!-- نموذج المرحلة -->
    <div id="pd-ms-form" style="display:none;background:white;border-radius:12px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,.1);border:2px solid #2d6a9f">
        <div style="font-size:15px;font-weight:800;color:#1a3a5c;margin-bottom:14px" id="pd-ms-form-title">⏱️ إضافة مرحلة</div>
        <input type="hidden" id="pd-ms-key">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:10px">
            <div style="grid-column:1/-1"><label style="${lblStyle()}">اسم المرحلة *</label><input id="pm-name" placeholder="مثال: أعمال الحفر والأساسات" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">البدء المخطط *</label><input id="pm-pstart" type="date" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الانتهاء المخطط *</label><input id="pm-pend" type="date" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">البدء الفعلي</label><input id="pm-astart" type="date" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الانتهاء الفعلي</label><input id="pm-aend" type="date" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الوزن النسبي %</label><input id="pm-weight" type="number" min="0" max="100" step="0.1" placeholder="من أهمية المشروع" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">نسبة الإنجاز %</label><input id="pm-progress" type="number" min="0" max="100" step="1" placeholder="0" style="${inputStyle()}"></div>
            <div><label style="${lblStyle()}">الحالة</label>
                <select id="pm-status" style="${inputStyle()}">
                    <option value="planned">🔵 مخطط</option>
                    <option value="inprogress">🟠 قيد التنفيذ</option>
                    <option value="done">🟢 مكتملة</option>
                    <option value="onhold">⏸️ متوقفة</option>
                </select></div>
        </div>
        <div style="margin-bottom:12px"><label style="${lblStyle()}">ملاحظات</label>
            <input id="pm-notes" placeholder="ملاحظات اختيارية..." style="${inputStyle()}"></div>
        <div style="display:flex;gap:8px">
            <button class="btn b-g" onclick="pdSaveMilestone('${pid}')">💾 حفظ</button>
            <button class="btn" onclick="document.getElementById('pd-ms-form').style.display='none'" style="background:#f8fafc;color:#666;border:1.5px solid #d0d7e0">إلغاء</button>
        </div>
    </div>`;
}

window.pdOpenMilestoneForm = function (pid, msKey = null) {
    const form = document.getElementById('pd-ms-form'); if (!form) return;
    form.style.display = '';
    document.getElementById('pd-ms-key').value = msKey || '';
    document.getElementById('pd-ms-form-title').textContent = msKey ? '✏️ تعديل مرحلة' : '⏱️ إضافة مرحلة';
    const m = msKey ? (window.projectMilestones || {})[pid]?.[msKey] || {} : {};
    document.getElementById('pm-name').value = m.name || '';
    document.getElementById('pm-pstart').value = m.plannedStart || '';
    document.getElementById('pm-pend').value = m.plannedEnd || '';
    document.getElementById('pm-astart').value = m.actualStart || '';
    document.getElementById('pm-aend').value = m.actualEnd || '';
    document.getElementById('pm-weight').value = m.weight ?? '';
    document.getElementById('pm-progress').value = m.progress ?? '';
    document.getElementById('pm-status').value = m.status || 'planned';
    document.getElementById('pm-notes').value = m.notes || '';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.pdSaveMilestone = async function (pid) {
    const name = document.getElementById('pm-name')?.value.trim();
    const plannedStart = document.getElementById('pm-pstart')?.value;
    const plannedEnd = document.getElementById('pm-pend')?.value;
    if (!name) { toast('أدخل اسم المرحلة', 'er'); return; }
    if (!plannedStart || !plannedEnd) { toast('أدخل تاريخي البدء والانتهاء المخططين', 'er'); return; }
    if (plannedEnd < plannedStart) { toast('تاريخ الانتهاء قبل تاريخ البدء!', 'er'); return; }
    const actualStart = document.getElementById('pm-astart')?.value || '';
    const actualEnd = document.getElementById('pm-aend')?.value || '';
    if (actualStart && actualEnd && actualEnd < actualStart) { toast('تاريخ الانتهاء الفعلي قبل البدء الفعلي!', 'er'); return; }
    const status = document.getElementById('pm-status')?.value || 'planned';
    const data = {
        name, plannedStart, plannedEnd, actualStart, actualEnd, status,
        weight: parseFloat(document.getElementById('pm-weight')?.value) || 0,
        progress: status === 'done' ? 100 : Math.min(100, Math.max(0, parseFloat(document.getElementById('pm-progress')?.value) || 0)),
        notes: document.getElementById('pm-notes')?.value.trim() || '',
        updatedAt: new Date().toISOString()
    };
    const msKey = document.getElementById('pd-ms-key')?.value;
    try {
        if (msKey) {
            await update(ref(db, `ledger/projectMilestones/${pid}/${msKey}`), data);
            if (window.pdLogActivity) pdLogActivity(pid, '✏️', `تعديل مرحلة: ${name}`);
            toast('تم التحديث ✓', 'ok');
        } else {
            data.createdAt = new Date().toISOString();
            data.createdBy = window.curU?.uid || '';
            await push(ref(db, `ledger/projectMilestones/${pid}`), data);
            if (window.pdLogActivity) pdLogActivity(pid, '⏱️', `إضافة مرحلة جديدة: ${name}`);
            toast('تم الحفظ ✓', 'ok');
        }
        document.getElementById('pd-ms-form').style.display = 'none';
        setTimeout(() => pdRenderTab('timeline'), 500);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

// تحديث سريع للحالة: بدء المرحلة أو إنهاؤها بضغطة واحدة
window.pdQuickMsStatus = async function (pid, msKey, action) {
    const m = (window.projectMilestones || {})[pid]?.[msKey]; if (!m) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const data = action === 'start'
        ? { status: 'inprogress', actualStart: m.actualStart || todayStr, updatedAt: new Date().toISOString() }
        : { status: 'done', actualEnd: m.actualEnd || todayStr, actualStart: m.actualStart || m.plannedStart || todayStr, progress: 100, updatedAt: new Date().toISOString() };
    try {
        await update(ref(db, `ledger/projectMilestones/${pid}/${msKey}`), data);
        if (window.pdLogActivity) pdLogActivity(pid, action === 'start' ? '▶️' : '✅', `${action === 'start' ? 'بدء' : 'إنهاء'} مرحلة: ${m.name || ''}`);
        toast(action === 'start' ? 'بدأت المرحلة ▶️' : 'اكتملت المرحلة ✅', 'ok');
        setTimeout(() => pdRenderTab('timeline'), 400);
    } catch (e) { toast('خطأ: ' + e.message, 'er'); }
};

window.pdDeleteMilestone = function (pid, msKey) {
    const m = (window.projectMilestones || {})[pid]?.[msKey];
    cf2('هل تريد حذف هذه المرحلة؟', async () => {
        try {
            await remove(ref(db, `ledger/projectMilestones/${pid}/${msKey}`));
            if (window.pdLogActivity) pdLogActivity(pid, '🗑️', `حذف مرحلة: ${m?.name || ''}`);
            toast('تم الحذف', 'ok');
            setTimeout(() => pdRenderTab('timeline'), 400);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   TAB — إدارة القيمة المكتسبة (EVM) + خط الأساس                          ║
// ║   يعيد استخدام: getProjectContractValue, calcProjectProgress,            ║
// ║   calcProjectBudget (BAC), calcProjectActualCosts (AC)                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function pdRenderEVM(pid) {
    const p = (window.projects || {})[pid]; if (!p) return;
    const pane = document.getElementById('pd-tab-evm'); if (!pane) return;

    const bac = (window.calcProjectBudget(pid) || {}).totalBudget || 0;     // الميزانية الكلية عند الإنجاز
    const pct = (window.calcProjectProgress(pid) || 0) / 100;               // نسبة الإنجاز الفعلي
    const ac  = (window.calcProjectActualCosts(pid) || {}).total || 0;      // التكلفة الفعلية

    // خط الأساس النشط (يدعم خطوطاً متعددة — يُختار النشط منها)
    const base = pdActiveBaseline(pid);
    const plannedStart = (base && base.plannedStart) || p.startDate || '';
    const plannedEnd   = (base && base.plannedEnd)   || p.endDate   || '';

    // النسبة المخططة حسب الجدول الزمني (للقيمة المخططة PV)
    let plannedPct = 0;
    if (plannedStart && plannedEnd) {
        const s = new Date(plannedStart).getTime(), e = new Date(plannedEnd).getTime(), n = Date.now();
        if (e > s) plannedPct = Math.max(0, Math.min(1, (n - s) / (e - s)));
    }

    // مؤشرات EVM
    const EV = bac * pct;          // القيمة المكتسبة
    const PV = bac * plannedPct;   // القيمة المخططة
    const CV = EV - ac;            // انحراف التكلفة
    const SV = EV - PV;            // انحراف الجدول
    const CPI = ac > 0 ? EV / ac : null;   // مؤشر أداء التكلفة
    const SPI = PV > 0 ? EV / PV : null;   // مؤشر أداء الجدول
    const EAC = (CPI && CPI > 0) ? bac / CPI : null; // التكلفة المتوقعة عند الإنجاز
    const ETC = (EAC != null) ? EAC - ac : null;     // التكلفة المتبقية المتوقعة
    const VAC = (EAC != null) ? bac - EAC : null;    // انحراف عند الإنجاز

    const f = v => fmt(Math.round(v || 0));
    const idx = v => v == null ? '—' : v.toFixed(2);
    const sign = v => (v > 0 ? '+' : '') + f(v);
    const good = '#27ae60', bad = '#c0392b', neu = '#2d6a9f';

    const kpi = (label, value, color, hint) => `
        <div style="background:#f8fafc;border-radius:12px;padding:14px;border-right:4px solid ${color}">
            <div style="font-size:11px;color:#666;font-weight:700">${label}</div>
            <div style="font-size:21px;font-weight:900;color:${color};margin-top:4px">${value}</div>
            ${hint ? `<div style="font-size:10px;color:#888;margin-top:3px">${hint}</div>` : ''}
        </div>`;

    // شريط تفسيري ذكي
    const costColor = CV >= 0 ? good : bad, schedColor = SV >= 0 ? good : bad;
    const costMsg = CV >= 0 ? 'ضمن الميزانية ✅' : 'تجاوز للتكلفة ⚠️';
    const schedMsg = SV >= 0 ? 'متقدّم/في الموعد ✅' : 'متأخر عن الجدول ⚠️';

    // رسم مقارنة بسيط (CSS) لـ PV / EV / AC
    const maxV = Math.max(PV, EV, ac, 1);
    const bar = (label, val, color) => `
        <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:3px">
                <span style="font-weight:700">${label}</span><span style="font-weight:800;color:${color}">${f(val)}</span>
            </div>
            <div style="background:#eef3f8;border-radius:6px;height:14px;overflow:hidden">
                <div style="height:100%;width:${(val / maxV * 100).toFixed(1)}%;background:${color};border-radius:6px"></div>
            </div>
        </div>`;

    pane.innerHTML = `
    <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div class="c-tl" style="margin:0">📐 تحليل الأداء بطريقة القيمة المكتسبة (EVM)</div>
            <div style="display:flex;gap:8px">
                <button class="btn" onclick="pdSaveBaseline('${pid}')" style="background:#1a3a5c;color:#fff;font-size:12px">📌 حفظ خط أساس جديد</button>
            </div>
        </div>
        <p style="font-size:12px;color:#666;line-height:1.8;margin:8px 0 0">
            يقيس EVM أداء المشروع بمقارنة <strong>القيمة المخططة (PV)</strong> و<strong>المكتسبة (EV)</strong> و<strong>التكلفة الفعلية (AC)</strong> — ليجيب فورًا: هل المشروع متأخر؟ متجاوز للميزانية؟
            ${base ? `<br>📌 خط الأساس النشط: <strong>${base.name || 'خط الأساس'}</strong> (${base.date || '—'}) — الميزانية المرجعية ${f(base.bac)} ريال.` : '<br>⚠️ لم يُحفظ خط أساس بعد — تُحسب القيمة المخططة من تواريخ المشروع الحالية.'}
        </p>
    </div>
    ${pdBaselinesPanel(pid, bac, p)}

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:14px">
        ${kpi('💰 الميزانية الكلية (BAC)', f(bac) + ' ريال', neu, 'Budget At Completion')}
        ${kpi('📈 نسبة الإنجاز الفعلي', (pct * 100).toFixed(1) + '%', good, 'النسبة المخططة: ' + (plannedPct * 100).toFixed(1) + '%')}
        ${kpi('📊 القيمة المكتسبة (EV)', f(EV) + ' ريال', '#8e44ad', 'BAC × الإنجاز')}
        ${kpi('🗓️ القيمة المخططة (PV)', f(PV) + ' ريال', '#2980b9', 'BAC × النسبة المخططة')}
        ${kpi('💸 التكلفة الفعلية (AC)', f(ac) + ' ريال', '#e67e22', 'من تكاليف التنفيذ والمصروفات')}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:14px">
        ${kpi('📉 انحراف التكلفة (CV)', sign(CV) + ' ريال', costColor, costMsg)}
        ${kpi('⏳ انحراف الجدول (SV)', sign(SV) + ' ريال', schedColor, schedMsg)}
        ${kpi('🎯 مؤشر التكلفة (CPI)', idx(CPI), CPI == null ? neu : (CPI >= 1 ? good : bad), CPI == null ? '' : (CPI >= 1 ? 'كفاءة تكلفة جيدة' : 'تكلفة أعلى من القيمة'))}
        ${kpi('🕐 مؤشر الجدول (SPI)', idx(SPI), SPI == null ? neu : (SPI >= 1 ? good : bad), SPI == null ? '' : (SPI >= 1 ? 'في الموعد أو أسرع' : 'أبطأ من المخطط'))}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="card" style="margin:0">
            <div class="c-tl" style="font-size:14px">🔮 التوقّع عند الإنجاز</div>
            <div style="display:grid;gap:10px;margin-top:10px">
                ${kpi('التكلفة المتوقعة عند الإنجاز (EAC)', EAC == null ? '—' : f(EAC) + ' ريال', EAC != null && EAC <= bac ? good : bad, 'BAC ÷ CPI')}
                ${kpi('التكلفة المتبقية المتوقعة (ETC)', ETC == null ? '—' : f(ETC) + ' ريال', neu, 'EAC − AC')}
                ${kpi('الانحراف عند الإنجاز (VAC)', VAC == null ? '—' : sign(VAC) + ' ريال', VAC == null ? neu : (VAC >= 0 ? good : bad), 'BAC − EAC')}
            </div>
        </div>
        <div class="card" style="margin:0">
            <div class="c-tl" style="font-size:14px">📊 مقارنة PV / EV / AC</div>
            <div style="margin-top:14px">
                ${bar('🗓️ القيمة المخططة (PV)', PV, '#2980b9')}
                ${bar('📊 القيمة المكتسبة (EV)', EV, '#8e44ad')}
                ${bar('💸 التكلفة الفعلية (AC)', ac, '#e67e22')}
            </div>
        </div>
    </div>

    <div class="card" style="margin:0;background:${CV >= 0 && SV >= 0 ? '#eafaf1' : '#fdf0ec'};border-right:4px solid ${CV >= 0 && SV >= 0 ? good : bad}">
        <div style="font-size:13px;line-height:1.9;color:#333">
            <strong>الخلاصة:</strong>
            المشروع <strong style="color:${costColor}">${costMsg}</strong> من حيث التكلفة،
            و<strong style="color:${schedColor}">${schedMsg}</strong> من حيث الجدول الزمني.
            ${EAC != null ? `المتوقع أن تبلغ التكلفة النهائية نحو <strong>${f(EAC)} ريال</strong> مقابل ميزانية <strong>${f(bac)} ريال</strong> (${VAC >= 0 ? 'وفر متوقّع' : 'تجاوز متوقّع'} ${f(Math.abs(VAC))} ريال).` : ''}
        </div>
    </div>`;
}

// ── خطوط الأساس المتعددة (Multiple Baselines) ────────────────────────────
// يدعم الشكل القديم (كائن واحد فيه bac) والشكل الجديد (خريطة خطوط أساس مُسمّاة).
window.pdActiveBaseline = function (pid) {
    const raw = (window.projectBaselines || {})[pid]; if (!raw) return null;
    if (raw.bac !== undefined) return { ...raw, key: '_legacy', name: raw.name || 'خط الأساس' };
    const entries = Object.entries(raw).filter(([, v]) => v && typeof v === 'object');
    if (!entries.length) return null;
    const act = entries.find(([, v]) => v.active) || entries.slice().sort((a, b) => (b[1].date || '').localeCompare(a[1].date || ''))[0];
    return { ...act[1], key: act[0] };
};
window.pdBaselineEntries = function (pid) {
    const raw = (window.projectBaselines || {})[pid]; if (!raw) return [];
    if (raw.bac !== undefined) return [['_legacy', { ...raw, name: raw.name || 'خط الأساس', active: true }]];
    return Object.entries(raw).filter(([, v]) => v && typeof v === 'object').sort((a, b) => (a[1].date || '').localeCompare(b[1].date || ''));
};

// لوحة خطوط الأساس والمقارنة (تُعرض داخل تبويب EVM)
function pdBaselinesPanel(pid, curBac, p) {
    const entries = pdBaselineEntries(pid);
    const active = pdActiveBaseline(pid);
    const curEnd = p.endDate || '';
    const dayDiff = (a, b) => (!a || !b) ? null : Math.round((new Date(b) - new Date(a)) / 86400000);
    if (!entries.length) return '';
    return `<div class="card" style="margin-bottom:14px">
        <div class="c-tl" style="font-size:14px;margin:0 0 4px">📌 خطوط الأساس والمقارنة (${entries.length})</div>
        <div style="font-size:11px;color:#888;margin-bottom:10px">اختر خط الأساس النشط لاحتساب EVM، وقارن الميزانية والجدول الحاليين بكل خط أساس محفوظ.</div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:660px">
            <thead><tr style="background:#1a3a5c;color:#fff"><th style="padding:8px">النشط</th><th style="padding:8px;text-align:right">الاسم</th><th style="padding:8px">التاريخ</th><th style="padding:8px;text-align:left">الميزانية (BAC)</th><th style="padding:8px;text-align:left">Δ الميزانية</th><th style="padding:8px">نهاية مخططة</th><th style="padding:8px;text-align:left">انزياح النهاية</th><th style="padding:8px"></th></tr></thead>
            <tbody>${entries.map(([k, b]) => {
        const isAct = active && active.key === k;
        const dBac = Math.round(curBac - (parseFloat(b.bac) || 0));
        const drift = dayDiff(b.plannedEnd, curEnd);
        return `<tr style="border-top:1px solid #eee;background:${isAct ? '#eef6ff' : '#fff'}">
                <td style="padding:7px;text-align:center">${k === '_legacy' ? '✅' : `<input type="radio" name="pdBl_${pid}" ${isAct ? 'checked' : ''} onchange="pdSetActiveBaseline('${pid}','${k}')" style="width:16px;height:16px;cursor:pointer">`}</td>
                <td style="padding:7px;font-weight:700;color:#1a3a5c">${b.name || 'خط الأساس'}${isAct ? ' <span style="font-size:10px;color:#2980b9">(نشط)</span>' : ''}</td>
                <td style="padding:7px;text-align:center;color:#666">${b.date || '—'}</td>
                <td style="padding:7px;text-align:left">${fmt(parseFloat(b.bac) || 0)}</td>
                <td style="padding:7px;text-align:left;font-weight:700;color:${dBac > 0 ? '#c0392b' : dBac < 0 ? '#1e8449' : '#888'}">${dBac > 0 ? '+' : ''}${fmt(dBac)}</td>
                <td style="padding:7px;text-align:center;color:#666">${b.plannedEnd || '—'}</td>
                <td style="padding:7px;text-align:left;font-weight:700;color:${drift > 0 ? '#c0392b' : drift < 0 ? '#1e8449' : '#888'}">${drift == null ? '—' : (drift > 0 ? '+' + drift + ' يوم' : drift < 0 ? drift + ' يوم' : 'بلا انزياح')}</td>
                <td style="padding:7px;text-align:center">${k === '_legacy' ? '' : `<button class="btn b-r" style="padding:2px 7px;font-size:10px" onclick="pdDeleteBaseline('${pid}','${k}')">🗑️</button>`}</td>
            </tr>`;
    }).join('')}</tbody>
        </table></div>
        <div style="font-size:11px;color:#999;margin-top:8px">💡 «Δ الميزانية» = الميزانية الحالية − ميزانية خط الأساس (موجب = تجاوز). «انزياح النهاية» = فرق تاريخ النهاية الحالي عن المخطط (موجب = تأخّر).</div>
    </div>`;
}

window.pdSaveBaseline = function (pid) {
    const p = (window.projects || {})[pid]; if (!p) return;
    const bac = (window.calcProjectBudget(pid) || {}).totalBudget || 0;
    const progress = window.calcProjectProgress(pid) || 0;
    const name = (prompt('اسم خط الأساس (مثال: الأساس التعاقدي · إعادة الجدولة 1):', 'خط الأساس ' + (pdBaselineEntries(pid).length + 1)) || '').trim();
    if (!name) return;
    (async () => {
        try {
            const raw = (window.projectBaselines || {})[pid];
            const snap = {};
            Object.entries((window.projectTasks || {})[pid] || {}).forEach(([tk, t]) => { snap[tk] = { start: t.startDate || '', due: t.dueDate || '' }; });
            const newKey = push(ref(db, 'ledger/projectBaselines/' + pid)).key;
            const data = { name, date: new Date().toISOString().slice(0, 10), bac, progress, plannedStart: p.startDate || '', plannedEnd: p.endDate || '', tasksSnapshot: snap, active: true, by: (typeof curU !== 'undefined' && curU) ? (curU.email || curU.uid || '') : '' };
            const map = {};
            if (raw && raw.bac !== undefined) map['bl_legacy'] = { ...raw, name: raw.name || 'خط الأساس (سابق)', active: false };
            else if (raw) Object.entries(raw).forEach(([k, v]) => { if (v && typeof v === 'object') map[k] = { ...v, active: false }; });
            map[newKey] = data;
            await set(ref(db, 'ledger/projectBaselines/' + pid), map);
            if (typeof logAudit === 'function') logAudit('baseline_save', 'projects', 'حفظ خط أساس «' + name + '» للمشروع: ' + (p.name || pid), { bac });
            toast('تم حفظ خط الأساس ✓', 'ok');
            setTimeout(() => pdRenderEVM(pid), 300);
        } catch (e) { toast('خطأ: ' + e.message, 'er'); }
    })();
};
window.pdSetActiveBaseline = async function (pid, key) {
    const raw = (window.projectBaselines || {})[pid]; if (!raw || raw.bac !== undefined) return;
    const updates = {};
    Object.keys(raw).forEach(k => { updates[k + '/active'] = (k === key); });
    try { await update(ref(db, 'ledger/projectBaselines/' + pid), updates); toast('تم تعيين خط الأساس النشط', 'ok'); setTimeout(() => pdRenderEVM(pid), 200); }
    catch (e) { toast('خطأ: ' + e.message, 'er'); }
};
window.pdDeleteBaseline = function (pid, key) {
    cf2('حذف خط الأساس هذا؟', async () => {
        try { await remove(ref(db, 'ledger/projectBaselines/' + pid + '/' + key)); toast('تم الحذف', 'ok'); setTimeout(() => pdRenderEVM(pid), 200); }
        catch (e) { toast('خطأ: ' + e.message, 'er'); }
    });
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   🌐 بوابة العميل — تقرير حالة نظيف للمشروع (للطباعة/المشاركة PDF)          ║
// ║   عرض اطّلاع للأطراف الخارجية دون كشف التكاليف الداخلية أو الأرباح.          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
window.pdClientPortal = function (pid) {
    const p = (window.projects || {})[pid]; if (!p) { toast('المشروع غير موجود', 'er'); return; }
    const f = v => fmt(Math.round(v || 0));
    const contractValue = (typeof pdAdjustedContract === 'function') ? pdAdjustedContract(pid) : (parseFloat(p.contractValue) || 0);
    const progress = Math.round((typeof window.calcProjectProgress === 'function') ? window.calcProjectProgress(pid) : 0);
    const bills = Object.values(window.progressBillings || {}).filter(b => b.projectId === pid && b.status !== 'cancelled');
    const billed = bills.reduce((s, b) => s + (parseFloat(b.currentAmount) || 0), 0);
    const paid = bills.filter(b => b.status === 'paid').reduce((s, b) => s + (parseFloat(b.currentAmount) || 0), 0);
    const retention = bills.reduce((s, b) => s + (parseFloat(b.retentionAmount) || 0), 0);
    const remaining = Math.max(0, contractValue - billed);
    let timePct = 0, daysLeft = null;
    if (p.startDate && p.endDate) {
        const s = new Date(p.startDate), e = new Date(p.endDate), n = new Date();
        const tot = Math.max(1, e - s); timePct = Math.max(0, Math.min(100, Math.round((n - s) / tot * 100)));
        daysLeft = Math.round((e - n) / 86400000);
    }
    const rfiOpen = Object.values((window.rfis || {})[pid] || {}).filter(r => r.status !== 'closed').length;
    const subOpen = Object.values((window.submittals || {})[pid] || {}).filter(r => !['approved', 'approved_noted'].includes(r.status)).length;
    const punchOpen = Object.values((window.punchItems || {})[pid] || {}).filter(r => r.status !== 'closed').length;
    const qhse = Object.values((window.qhse || {})[pid] || {});
    const incidents = qhse.filter(r => r.kind === 'incident').length;
    const inspections = qhse.filter(r => r.kind === 'inspection').length;
    const statusMap = { planning: 'في التخطيط', active: 'قيد التنفيذ', completed: 'مكتمل', 'on-hold': 'موقوف' };
    const company = (typeof custCoName === 'function' ? custCoName() : (window.cfg?.companyAr || 'بُنيان للمقاولات'));
    const client = p.client || p.owner || p.customer || '';

    const card = (label, value, color, sub) => `<div style="background:#fff;border:1px solid #e6ebf0;border-radius:12px;padding:16px;border-top:4px solid ${color}"><div style="font-size:12px;color:#888">${label}</div><div style="font-size:22px;font-weight:900;color:${color};margin-top:4px">${value}</div>${sub ? `<div style="font-size:11px;color:#aaa;margin-top:3px">${sub}</div>` : ''}</div>`;
    const barRow = (label, pct, color) => `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="font-weight:700;color:#1a3a5c">${label}</span><span style="font-weight:800;color:${color}">${pct}%</span></div><div style="background:#eef1f5;border-radius:20px;height:12px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};border-radius:20px"></div></div></div>`;

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>حالة المشروع — ${p.name || ''}</title>
    <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box}
    body{font-family:"Segoe UI",Tahoma,sans-serif;margin:0;background:#f4f6f8;color:#1a3a5c;direction:rtl}
    .wrap{max-width:900px;margin:0 auto;padding:20px}
    .head{background:linear-gradient(135deg,#1a3a5c,#2d6a9f);color:#fff;border-radius:16px;padding:26px 28px;margin-bottom:16px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
    .sec{background:#fff;border-radius:14px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.05)}
    .sec h3{margin:0 0 14px;font-size:16px;color:#1a3a5c}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td{padding:9px 4px;border-bottom:1px solid #eef1f5}
    .no-print{margin:0 0 14px}
    @media print{.no-print{display:none}body{background:#fff}.wrap{padding:0}}
    @page{size:A4;margin:1.2cm}</style></head><body>
    <div class="wrap">
      <div class="no-print" style="display:flex;gap:8px">
        <button onclick="window.print()" style="background:#1a3a5c;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🖨️ طباعة / حفظ PDF</button>
        <button onclick="window.close()" style="background:#ecf0f1;color:#555;border:0;border-radius:8px;padding:10px 18px;font-size:13px;cursor:pointer;font-family:inherit">إغلاق</button>
      </div>
      <div class="head">
        <div style="font-size:12px;opacity:.85;letter-spacing:.05em">${company} · تقرير حالة المشروع</div>
        <div style="font-size:26px;font-weight:900;margin:6px 0">${p.name || '—'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;opacity:.92">
          ${client ? `<span style="background:rgba(255,255,255,.15);padding:4px 12px;border-radius:8px">👤 العميل: ${client}</span>` : ''}
          <span style="background:rgba(255,255,255,.15);padding:4px 12px;border-radius:8px">📌 ${statusMap[p.status] || p.status || ''}</span>
          ${p.contractNo ? `<span style="background:rgba(255,255,255,.15);padding:4px 12px;border-radius:8px">📄 ${p.contractNo}</span>` : ''}
          <span style="background:rgba(255,255,255,.15);padding:4px 12px;border-radius:8px">📅 ${new Date().toLocaleDateString('ar-SA')}</span>
        </div>
      </div>

      <div class="grid">
        ${card('قيمة العقد', f(contractValue) + ' ﷼', '#2d6a9f', 'شاملة أوامر التغيير')}
        ${card('نسبة الإنجاز', progress + '%', '#27ae60', 'الإنجاز الفعلي للأعمال')}
        ${card('إجمالي المُستخلَص', f(billed) + ' ﷼', '#e67e22', `${contractValue ? Math.round(billed / contractValue * 100) : 0}% من العقد`)}
        ${card('المتبقي على العقد', f(remaining) + ' ﷼', '#8e44ad', 'لم يُستخلَص بعد')}
      </div>

      <div class="sec">
        <h3>📊 التقدّم</h3>
        ${barRow('الإنجاز الفعلي للأعمال', progress, '#27ae60')}
        ${p.startDate && p.endDate ? barRow('التقدّم الزمني', timePct, timePct > progress + 5 ? '#e67e22' : '#2980b9') : ''}
        ${p.startDate && p.endDate ? `<div style="font-size:12px;color:#666;margin-top:6px">المدة: ${p.startDate} ← ${p.endDate}${daysLeft != null ? ` · ${daysLeft >= 0 ? 'المتبقّي ' + daysLeft + ' يوم' : 'تجاوز الموعد بـ ' + Math.abs(daysLeft) + ' يوم'}` : ''}</div>` : ''}
      </div>

      <div class="sec">
        <h3>💰 الموقف المالي</h3>
        <table>
          <tr><td>قيمة العقد (شاملة أوامر التغيير)</td><td style="text-align:left;font-weight:700">${f(contractValue)} ﷼</td></tr>
          <tr><td>إجمالي المستخلصات المُقدَّمة</td><td style="text-align:left;font-weight:700">${f(billed)} ﷼</td></tr>
          <tr><td>المُحصَّل (المدفوع)</td><td style="text-align:left;font-weight:700;color:#27ae60">${f(paid)} ﷼</td></tr>
          <tr><td>المحتجز (ضمان الأعمال)</td><td style="text-align:left;font-weight:700;color:#8e44ad">${f(retention)} ﷼</td></tr>
          <tr><td>المتبقّي على قيمة العقد</td><td style="text-align:left;font-weight:700">${f(remaining)} ﷼</td></tr>
        </table>
      </div>

      <div class="sec">
        <h3>🏗️ الحالة الميدانية والفنية</h3>
        <div class="grid" style="margin:0">
          ${card('طلبات معلومات مفتوحة', rfiOpen, rfiOpen ? '#e67e22' : '#27ae60', 'RFIs')}
          ${card('مستندات فنية قيد المراجعة', subOpen, subOpen ? '#2980b9' : '#27ae60', 'Submittals')}
          ${card('نواقص مفتوحة', punchOpen, punchOpen ? '#c0392b' : '#27ae60', 'Punch List')}
          ${card('عمليات تفتيش الجودة', inspections, '#16a085', `حوادث مسجّلة: ${incidents}`)}
        </div>
      </div>

      <div style="text-align:center;font-size:11px;color:#999;padding:14px;line-height:1.8">
        تقرير حالة استرشادي صادر آلياً من ${company} بتاريخ ${new Date().toLocaleString('ar-EG')}.<br>الأرقام المالية تمثّل قيمة العقد والمستخلصات فقط، ولا تتضمن التكاليف أو الأرباح الداخلية للمقاول.
      </div>
    </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { toast('⚠️ يرجى السماح بالنوافذ المنبثقة لعرض بوابة العميل', 'er'); return; }
    w.document.write(html); w.document.close();
};
