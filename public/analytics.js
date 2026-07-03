// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   📊  GBR ANALYTICS STUDIO  —  استوديو التحليل الاستراتيجي                ║
// ║   النسخة: 3.0 (Looker Studio Style)  |  يونيو 2026                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

window._asState = {
    fromDate: '',
    toDate: '',
    projectId: '',
    dept: '',
    dataSource: 'system',
    activeTab: 'report',
    activePage: 1,
    uploadedData: null,
    slicers: {},
    charts: {},
    chartLabels: {},        // { chartId: true|false } — إظهار/إخفاء القيم لكل رسم
    lastFilteredData: null, // آخر بيانات مفلترة لإعادة بناء رسم واحد بسرعة
    lastNumericCols: [],    // أعمدة القيم الأخيرة
    lastCatCols: [],        // أعمدة التصنيف الأخيرة
    reportName: '',         // اسم التقرير المحفوظ/المحمّل الحالي
    selectedVisualId: 'chart1',
    configs: {
        chart1: { type: 'bar', axis: '', value: '', title: 'التحليل الزمني' },
        chart2: { type: 'bar', axis: '', value: '', title: 'مقارنة الفئات' },
        chart3: { type: 'doughnut', axis: '', value: '', title: 'توزيع الحصص' },
        chart4: { type: 'bar', axis: '', value: '', title: 'تحليل الأداء' }
    }
};

// ── المدخل الرئيسي ──────────────────────────────────────────────────────────
window.renderAnalytics = function () {
    const pg = $('pg-analytics');
    if (!pg || !pg.classList.contains('act')) return;

    // ── فحص رابط المشاركة في URL (مرة واحدة فقط عند أول تحميل) ──
    if (!window._asUrlChecked) {
        window._asUrlChecked = true;
        const urlP    = new URLSearchParams(location.search);
        const shareKey = urlP.get('analyticsReport');
        const shareToken = urlP.get('token');
        if (shareKey && shareToken) {
            pg.style.cssText = 'background:#f1f3f4;display:flex;align-items:center;justify-content:center;flex-direction:column;height:100%';
            pg.innerHTML = `
            <div style="text-align:center;color:#5f6368">
                <div style="font-size:56px;margin-bottom:16px">📊</div>
                <div style="font-size:18px;font-weight:700;color:#202124;margin-bottom:8px">جاري تحميل التقرير المشترك...</div>
                <div style="font-size:13px">يُرجى الانتظار</div>
            </div>`;
            asCheckSharedReport().then(ok => {
                if (!ok) { window._asSharedMode = false; renderAnalytics(); }
            });
            return;
        }
    }

    if (!window._asState.toDate) {
        const now = new Date();
        window._asState.toDate   = now.toISOString().slice(0, 10);
        window._asState.fromDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    }

    const state = window._asState;
    pg.style.background   = '#f1f3f4';
    pg.style.display      = 'flex';
    pg.style.flexDirection= 'column';
    pg.style.padding      = '0';

    pg.innerHTML = `
    <style>
        /* ── تصميم لوكر ستوديو ── */
        #as-root { display:flex; flex-direction:column; height:100%; font-family:'Segoe UI',Tahoma,Arial,sans-serif; direction:rtl; }

        /* شريط علوي */
        .as-topbar { background:#fff; border-bottom:1px solid #dadce0; padding:10px 20px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; box-shadow:0 1px 3px rgba(60,64,67,.12); position:sticky; top:0; z-index:200; }
        .as-topbar-title { font-size:16px; font-weight:700; color:#3c4043; }
        .as-topbar-sub   { font-size:11px; color:#70757a; }

        /* شريط الصفحات (page strip) */
        .as-pagebar { background:#3c4043; display:flex; align-items:center; padding:0 16px; gap:4px; }
        .as-page-btn { padding:10px 18px; font-size:12px; font-weight:600; color:rgba(255,255,255,.7); cursor:pointer; border:none; background:transparent; border-bottom:3px solid transparent; transition:.2s; white-space:nowrap; }
        .as-page-btn.act { color:#fff; border-bottom-color:#f4b400; font-weight:800; }
        .as-page-btn:hover { color:#fff; background:rgba(255,255,255,.08); }

        /* منطقة العمل الرئيسية */
        .as-workspace { display:flex; flex:1; overflow:hidden; }

        /* شريط الفلاتر الجانبي */
        .as-sidefilters { width:200px; background:#fff; border-left:1px solid #dadce0; padding:14px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; flex-shrink:0; }
        .as-sidefilters-title { font-size:11px; font-weight:800; color:#1a73e8; border-bottom:2px solid #1a73e8; padding-bottom:6px; }

        /* لوحة الحقول (يمين - لوضع الملف) */
        .as-fieldspane { width:250px; background:#f8f9fa; border-right:1px solid #dadce0; display:flex; flex-direction:column; overflow-y:auto; flex-shrink:0; }
        .as-pane-title { background:#eee; padding:7px 12px; font-size:10px; font-weight:800; color:#5f6368; text-transform:uppercase; }
        .as-field-item { display:flex; align-items:center; gap:8px; font-size:11px; padding:6px 12px; cursor:default; }
        .as-field-item:hover { background:#eef2f4; }
        .as-type-btn { padding:8px; border:1px solid #dadce0; background:#fff; cursor:pointer; border-radius:4px; font-size:18px; }
        .as-type-btn.act { border-color:#1a73e8; background:#e8f0fe; }

        /* قماش التقرير */
        .as-canvas { flex:1; padding:24px; overflow-y:auto; background:#f1f3f4; }

        /* بطاقة */
        .as-card { background:#fff; border-radius:8px; padding:20px; box-shadow:0 1px 3px rgba(60,64,67,.12),0 1px 2px rgba(60,64,67,.24); border:1px solid #dadce0; margin-bottom:20px; }
        .as-card-title { font-size:13px; font-weight:700; color:#3c4043; margin-bottom:14px; border-bottom:1px solid #f1f3f4; padding-bottom:8px; }

        /* بطاقات KPI */
        .as-kpi-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:16px; margin-bottom:20px; }
        .as-kpi-card { background:#fff; padding:18px 16px; border-radius:8px; border-top:4px solid #1a73e8; text-align:center; box-shadow:0 1px 3px rgba(60,64,67,.12); }
        .as-kpi-val  { font-size:22px; font-weight:900; margin:6px 0 2px; }
        .as-kpi-lbl  { font-size:11px; color:#70757a; font-weight:700; }
        .as-kpi-sub  { font-size:10px; color:#9aa0a6; margin-top:2px; }

        /* رأس تقرير لوكر (مثل الصورة) */
        .as-report-header { background:#fff; border-radius:8px; margin-bottom:20px; overflow:hidden; box-shadow:0 1px 3px rgba(60,64,67,.12); border:1px solid #dadce0; }
        .as-rh-inner { display:flex; align-items:center; justify-content:space-between; padding:16px 24px; }
        .as-rh-logo { width:64px; height:64px; background:linear-gradient(135deg,#1a3a5c,#2d6a9f); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; flex-shrink:0; }
        .as-rh-titlebox { background:linear-gradient(135deg,#e37400,#f4b400); color:#fff; padding:14px 28px; border-radius:8px; text-align:center; flex:1; margin:0 20px; }
        .as-rh-titlebox h2 { font-size:18px; font-weight:900; margin:0 0 4px; }
        .as-rh-titlebox p  { font-size:12px; opacity:.9; margin:0; }

        /* فلاتر الشريط العلوي */
        .as-filter-group { display:flex; align-items:center; gap:8px; background:#f8f9fa; padding:4px 12px; border-radius:4px; border:1px solid #dadce0; font-size:12px; color:#3c4043; }
        .as-filter-group label { font-size:11px; color:#5f6368; white-space:nowrap; }
        .as-filter-group input { border:none; background:transparent; font-family:inherit; font-size:12px; color:#1a73e8; font-weight:700; outline:none; }
        .as-select { padding:6px 10px; border-radius:4px; border:1px solid #dadce0; background:#f8f9fa; font-family:inherit; font-size:12px; color:#3c4043; outline:none; cursor:pointer; }

        /* أزرار التبديل */
        .as-toggle-btn { border:none; background:transparent; padding:6px 12px; font-size:11px; font-weight:700; color:#5f6368; cursor:pointer; border-radius:4px; transition:.2s; }
        .as-toggle-btn.act { background:#fff; color:#1a73e8; box-shadow:0 1px 2px rgba(60,64,67,.3); }

        /* slicer items */
        .as-slicer-item { font-size:11px; padding:4px 8px; border-radius:4px; cursor:pointer; border:1px solid #eee; margin-bottom:4px; transition:.2s; display:block; word-break:break-word; }
        .as-slicer-item.act { background:#1a73e8; color:#fff; border-color:#1a73e8; }

        /* جدول البيانات */
        table.as-table { width:100%; border-collapse:collapse; font-size:11px; }
        table.as-table th { background:#f8f9fa; padding:8px; text-align:right; border-bottom:2px solid #dadce0; position:sticky; top:0; }
        table.as-table td { padding:7px 8px; border-bottom:1px solid #f1f3f4; }
        table.as-table tr:hover td { background:#f8f9fa; }

        @media print {
            * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
            .as-topbar,.as-pagebar,.as-sidefilters,.as-fieldspane,.as-modal-overlay { display:none !important; }
            .as-workspace { overflow:visible !important; }
            .as-canvas { padding:8px !important; overflow:visible !important; }
            canvas { display:none !important; }
            .as-print-img { display:block !important; width:100% !important; }
            .as-card { break-inside:avoid; box-shadow:none !important; border:1px solid #ddd !important; }
            .as-kpi-grid { grid-template-columns:repeat(3,1fr) !important; }
        }
    </style>

    <div id="as-root">
        <!-- ── شريط الأدوات العلوي ── -->
        <!-- ── شريط المشاركة (يظهر فقط عند فتح رابط مشترك) ── -->
        ${window._asSharedMode ? `
        <div style="background:${window._asSharePermission==='edit'?'#e8f5e9':'#e8f0fe'};border-bottom:2px solid ${window._asSharePermission==='edit'?'#188038':'#1a73e8'};padding:10px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:20px">${window._asSharePermission==='edit'?'✏️':'👁️'}</span>
                <div>
                    <div style="font-size:13px;font-weight:800;color:#202124">📋 ${window._asSharedName||'تقرير مشترك'}</div>
                    <div style="font-size:11px;color:#5f6368">
                        ${window._asSharePermission==='edit'
                            ? '✏️ لديك صلاحية <strong>المشاهدة والتعديل</strong> على هذا التقرير'
                            : '👁️ هذا التقرير في وضع <strong>المشاهدة فقط</strong>'}
                    </div>
                </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                ${window._asSharePermission==='edit' ? `<button onclick="asSaveReport()" style="background:#188038;color:#fff;padding:6px 14px;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">💾 حفظ نسخة</button>` : ''}
                <button onclick="asPrint()" style="background:#fff;color:#3c4043;border:1px solid #dadce0;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer">🖨️ طباعة</button>
            </div>
        </div>` : ''}

        <div class="as-topbar">
            <div style="display:flex;align-items:center;gap:12px">
                <div style="font-size:22px">📊</div>
                <div>
                    <div class="as-topbar-title">${window._asSharedMode ? (window._asSharedName||'تقرير مشترك') : 'استوديو تحليلات GBR الذكي'}</div>
                    <div class="as-topbar-sub">${window._asSharedMode ? (window._asSharePermission==='edit'?'✏️ مشاهدة وتعديل':'👁️ مشاهدة فقط') : 'بناءً على البيانات الموحدة للنظام'}</div>
                </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                ${window._asSharedMode ? '' : `
                <!-- مصدر البيانات (مخفي في وضع المشاركة) -->
                <div style="display:flex;gap:4px;background:#f1f3f4;padding:4px;border-radius:6px;border:1px solid #dadce0">
                    <button class="as-toggle-btn ${state.dataSource==='system'?'act':''}" onclick="asSwitchSource('system')">🖥️ بيانات النظام</button>
                    <button class="as-toggle-btn ${state.dataSource==='file'?'act':''}" onclick="asSwitchSource('file')">📁 ملف خارجي</button>
                </div>

                <!-- فلاتر النظام -->
                <div id="as-system-filters" style="display:${state.dataSource==='system'?'flex':'none'};gap:8px;align-items:center;flex-wrap:wrap">
                    <div class="as-filter-group">
                        <label>📅 من</label>
                        <input type="date" value="${state.fromDate}" onchange="asUpdateFilter('fromDate',this.value)">
                        <label>إلى</label>
                        <input type="date" value="${state.toDate}" onchange="asUpdateFilter('toDate',this.value)">
                    </div>
                    <select class="as-select" onchange="asUpdateFilter('projectId',this.value)">
                        ${typeof ccSelectOptions === 'function'
                            ? ccSelectOptions(state.projectId, '📁 كل مراكز التكلفة')
                            : `<option value="">📁 كل المشاريع</option>${Object.entries(window.projects||{}).map(([k,p])=>`<option value="${k}"${state.projectId===k?' selected':''}>${p.name}</option>`).join('')}`}
                    </select>
                </div>

                <!-- رفع ملف -->
                <div id="as-file-controls" style="display:${state.dataSource==='file'?'flex':'none'};gap:8px;align-items:center">
                    <input type="file" id="as-upload" accept=".csv,.xlsx,.xls" style="display:none" onchange="asHandleFileUpload(event)">
                    <button class="btn" onclick="document.getElementById('as-upload').click()" style="background:#188038;color:#fff;padding:7px 12px;font-size:11px;border-radius:4px;border:none;font-weight:700">📤 رفع ملف (Excel/CSV)</button>
                </div>`}

                <!-- تبديل التقرير / البيانات -->
                <div style="display:flex;gap:4px;background:#f1f3f4;padding:4px;border-radius:6px;border:1px solid #dadce0">
                    <button class="as-toggle-btn ${state.activeTab==='report'?'act':''}" onclick="asSwitchTab('report')">📊 التقرير</button>
                    <button class="as-toggle-btn ${state.activeTab==='data'?'act':''}" onclick="asSwitchTab('data')">📅 البيانات</button>
                </div>

                <button class="btn" onclick="renderAnalytics()" style="background:#1a73e8;color:#fff;padding:7px 14px;font-weight:700;border-radius:4px;border:none;font-size:12px">🔄 تحديث</button>
                ${window._asSharedMode ? '' : `
                <button class="btn" onclick="asSaveReport()" style="background:#188038;color:#fff;padding:7px 12px;font-weight:700;border-radius:4px;border:none;font-size:12px">💾 حفظ</button>
                <button class="btn" onclick="asOpenReportsPage()" style="background:#fff;color:#8e44ad;border:1px solid #8e44ad;padding:7px 12px;font-weight:700;border-radius:4px;font-size:12px">📋 إدارة التقارير</button>`}
                <button class="btn" onclick="asPrint()" style="background:#fff;color:#3c4043;border:1px solid #dadce0;padding:7px 10px;border-radius:4px;font-size:13px">🖨️</button>
            </div>
        </div>

        <!-- ── شريط الصفحات (Pages) ── -->
        <div class="as-pagebar" id="as-pagebar" style="display:${state.activeTab==='report'&&state.dataSource==='system'?'flex':'none'}">
            <button class="as-page-btn ${state.activePage===1?'act':''}" onclick="asSwitchPage(1)">📑 الصفحة ١ — الرواتب والإيرادات</button>
            <button class="as-page-btn ${state.activePage===2?'act':''}" onclick="asSwitchPage(2)">📈 الصفحة ٢ — الاتجاهات المالية</button>
            <button class="as-page-btn ${state.activePage===3?'act':''}" onclick="asSwitchPage(3)">👷 الصفحة ٣ — توزيع العمالة</button>
        </div>

        <!-- ── منطقة العمل ── -->
        <div class="as-workspace">
            <!-- Slicer Sidebar (يسار) -->
            <div class="as-sidefilters">
                <div class="as-sidefilters-title">🔍 الفلاتر</div>
                <div id="as-slicers-container">
                    <div style="font-size:11px;color:#9aa0a6;text-align:center;padding:20px 0">
                        ${state.dataSource==='system'?'الفلاتر متاحة مع بيانات الملف':'ارفع ملفاً لإظهار الفلاتر'}
                    </div>
                </div>
                <button class="btn" onclick="asResetSlicers()" style="width:100%;font-size:10px;padding:5px;background:#f1f3f4;color:#5f6368;border:1px solid #dadce0;border-radius:4px">🗑️ مسح التصفية</button>
            </div>

            <!-- القماش الرئيسي -->
            <div class="as-canvas" id="as-canvas">
                <!-- يُملأ بواسطة asProcessData -->
                <div style="text-align:center;padding:60px;color:#9aa0a6">
                    <div style="font-size:48px;margin-bottom:12px">📊</div>
                    <div style="font-size:14px">جاري تحميل البيانات...</div>
                </div>
            </div>

            <!-- لوحة الحقول (يمين - تظهر فقط مع الملف) -->
            <div class="as-fieldspane" id="as-fieldspane" style="display:${state.dataSource==='file'?'flex':'none'};flex-direction:column">
                <div class="as-pane-title">Data</div>
                <div id="as-fields-pane"></div>

                <div class="as-pane-title" style="margin-top:8px">Chart Type</div>
                <div id="as-viz-pane" style="display:flex;gap:6px;flex-wrap:wrap;padding:10px"></div>
            </div>
        </div>
    </div>
    `;

    asProcessData();
};

// ── معالجة البيانات وتوجيهها ─────────────────────────────────────────────────
function asProcessData() {
    const state = window._asState;
    if (state.dataSource === 'snapshot') {
        // وضع اللقطة: تقرير مشترك أو محمّل من ملف بدون بيانات أصلية
        asRenderFromSnap(state.snapData || {}, state.configs);
    } else if (state.dataSource === 'system') {
        if (state.activeTab === 'data') asRenderSystemDataGrid();
        else asProcessSystemData(state.fromDate, state.toDate, state.projectId);
    } else if (state.dataSource === 'file' && state.uploadedData) {
        asProcessFileData(state.uploadedData);
    } else {
        const canvas = document.getElementById('as-canvas');
        if (canvas) canvas.innerHTML = `
            <div style="text-align:center;padding:60px 20px;color:#9aa0a6">
                <div style="font-size:48px;margin-bottom:12px">📁</div>
                <div style="font-size:14px;font-weight:600">ارفع ملف Excel أو CSV للبدء في التحليل الذكي</div>
                <div style="font-size:12px;margin-top:8px">يدعم النظام الاكتشاف التلقائي للأعمدة والرسوم البيانية</div>
            </div>`;
    }
}

// ── عرض التقرير من اللقطة المحفوظة (Snapshot Mode) ──────────────────────────
function asRenderFromSnap(snap, configs) {
    const canvas = document.getElementById('as-canvas');
    if (!canvas) return;
    const state  = window._asState;
    const showL1 = state.chartLabels['chart1'] !== false;
    const showL2 = state.chartLabels['chart2'] !== false;
    const showL3 = state.chartLabels['chart3'] !== false;

    // بناء KPI من بيانات chart1
    const s1 = snap.chart1;
    let kpiHtml = '';
    if (s1?.values?.length) {
        const total = s1.values.reduce((a,v)=>a+(v||0),0);
        const max   = Math.max(...s1.values);
        const maxLbl= s1.labels[s1.values.indexOf(max)] || '—';
        kpiHtml = [
            asRenderKPI('📊 إجمالي القيم',  fmt(total), '#1a73e8'),
            asRenderKPI('📈 أعلى قيمة',     fmt(max),   '#188038'),
            asRenderKPI('🔢 عدد البنود',     s1.labels.length, '#e37400'),
            asRenderKPI('⭐ الأعلى',         maxLbl.substring(0,18), '#8e44ad')
        ].join('');
    }

    canvas.innerHTML = `
    <div class="as-kpi-grid" id="as-scorecards">${kpiHtml}</div>

    <div style="display:grid;grid-template-columns:3fr 2fr;gap:20px;margin-bottom:20px">
        <div class="as-card">
            <div class="as-card-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>📊 ${configs.chart1?.title||'الرسم البياني الرئيسي'}</span>
                <button onclick="asToggleLabels('chart1')"
                    style="border:1px solid #dadce0;background:#fff;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700;color:${showL1?'#1a73e8':'#9aa0a6'}">
                    🏷️ ${showL1?'إخفاء القيم':'إظهار القيم'}
                </button>
            </div>
            <div style="height:320px"><canvas id="chart1"></canvas></div>
        </div>
        <div class="as-card">
            <div class="as-card-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>🍩 توزيع الحصص</span>
                <button onclick="asToggleLabels('chart3')"
                    style="border:1px solid #dadce0;background:#fff;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700;color:${showL3?'#1a73e8':'#9aa0a6'}">
                    🏷️ ${showL3?'إخفاء':'إظهار'}
                </button>
            </div>
            <div style="height:320px"><canvas id="chart3"></canvas></div>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:3fr 2fr;gap:20px">
        <div class="as-card">
            <div class="as-card-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>📈 ${configs.chart2?.title||'مقارنة الفئات'}</span>
                <button onclick="asToggleLabels('chart2')"
                    style="border:1px solid #dadce0;background:#fff;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700;color:${showL2?'#1a73e8':'#9aa0a6'}">
                    🏷️ ${showL2?'إخفاء القيم':'إظهار القيم'}
                </button>
            </div>
            <div style="height:280px"><canvas id="chart2"></canvas></div>
        </div>
        <div class="as-card" style="display:flex;align-items:center;justify-content:center">
            <div style="text-align:center;color:#9aa0a6;padding:20px">
                <div style="font-size:32px;margin-bottom:10px">🔗</div>
                <div style="font-size:12px;font-weight:700">تقرير مشترك</div>
                <div style="font-size:11px;margin-top:4px">البيانات الخام غير متاحة<br>في وضع المشاركة</div>
            </div>
        </div>
    </div>`;

    // بناء الرسوم من البيانات المركّبة
    ['chart1','chart2','chart3'].forEach(id => {
        const s   = snap[id];
        const cfg = configs[id];
        if (!s?.labels?.length || !cfg?.axis || !cfg?.value) return;
        const data = s.labels.map((lbl,i) => ({
            [cfg.axis]:  lbl,
            [cfg.value]: s.values[i] || 0
        }));
        state.lastFilteredData = data; // لدعم asToggleLabels
        asBuildDynamicChart(id, data, cfg);
    });
}

// ════════════════════════════════════════════════════════
//   معالجة بيانات النظام (3 صفحات لوكر ستوديو)
// ════════════════════════════════════════════════════════
function asProcessSystemData(from, to, pid) {
    const state = window._asState;

    // ── حساب الإيرادات والمصاريف من قيود اليومية ──
    const journals = Object.values(window.journalEntries || {})
        .filter(j => j.status === 'posted')
        .filter(j => (!from || j.date >= from) && (!to || j.date <= to));

    let totalRevenue = 0, totalExpense = 0;
    journals.forEach(j => {
        j.lines.forEach(l => {
            if (pid && l.costCenter !== pid && l.projectId !== pid) return;
            if (l.accountCode?.startsWith('4')) totalRevenue += (parseFloat(l.credit)||0) - (parseFloat(l.debit)||0);
            if (l.accountCode?.startsWith('5')) totalExpense += (parseFloat(l.debit)||0) - (parseFloat(l.credit)||0);
        });
    });

    // ── حساب الرواتب من مسيرات الرواتب المعتمدة ──
    const payrollsArr = Object.values(window.payrolls || {})
        .filter(p => p.status === 'approved')
        .filter(p => {
            if (!from && !to) return true;
            const m = p.month; // "2025-05"
            return (!from || m >= from.slice(0,7)) && (!to || m <= to.slice(0,7));
        });

    const filteredPayrolls = pid
        ? payrollsArr.filter(p => p.projectId === pid || (p.items||[]).some(i => i.projectId === pid))
        : payrollsArr;

    const totalSalaries = filteredPayrolls.reduce((s,p) => s + (parseFloat(p.totalGross)||0), 0);
    const totalNetSalaries = filteredPayrolls.reduce((s,p) => s + (parseFloat(p.totalNet)||0), 0);
    const profitAfterSalaries = totalRevenue - totalSalaries;
    const profitAfterAll = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0 ? (profitAfterAll/totalRevenue*100).toFixed(1) : 0;

    // ── بيانات الموظفين ──
    const activeEmps = Object.values(window.emp||{}).filter(e=>(e.status||'active')==='active');
    const filteredEmps = pid ? activeEmps.filter(e=>e.projectId===pid) : activeEmps;

    const canvas = document.getElementById('as-canvas');
    if (!canvas) return;

    if (state.activePage === 1) {
        asRenderPage1(canvas, totalRevenue, totalSalaries, totalNetSalaries, profitAfterSalaries, profitAfterAll, profitMargin, filteredPayrolls, from, to, pid);
    } else if (state.activePage === 2) {
        asRenderPage2(canvas, journals, pid);
    } else if (state.activePage === 3) {
        asRenderPage3(canvas, filteredEmps, journals, pid);
    }
}

// ════════════════════════════════════════════════════════
//   الصفحة ١ — الرواتب والإيرادات (مثل لوكر ستوديو)
// ════════════════════════════════════════════════════════
function asRenderPage1(canvas, totalRevenue, totalSalaries, totalNetSalaries, profitAfterSalaries, profitAfterAll, profitMargin, payrolls, from, to, pid) {
    const companyName = Object.values(window.projects||{})[0]?.company || 'شركة أصالة العرب';
    const fromLabel = from ? new Date(from).toLocaleDateString('ar-SA',{day:'numeric',month:'numeric',year:'numeric'}) : '---';
    const toLabel   = to   ? new Date(to).toLocaleDateString('ar-SA',{day:'numeric',month:'numeric',year:'numeric'}) : '---';
    const projName = pid && window.projects?.[pid] ? ` — ${window.projects[pid].name}` : '';

    canvas.innerHTML = `
    <!-- ══ رأس التقرير (Looker Style Header) ══ -->
    <div class="as-report-header">
        <div class="as-rh-inner">
            <div class="as-rh-logo">🏢</div>
            <div class="as-rh-titlebox">
                <h2>تقرير الدخل والرواتب${projName}</h2>
                <p>من تاريخ ${fromLabel} الى ${toLabel}م</p>
            </div>
            <div class="as-rh-logo">🏢</div>
        </div>
    </div>

    <!-- ══ بطاقات KPI ══ -->
    <div class="as-kpi-grid">
        ${asRenderKPI('💰 إجمالي الإيرادات', fmt(totalRevenue), '#188038')}
        ${asRenderKPI('💵 إجمالي الرواتب (الإجمالية)', fmt(totalSalaries), '#1a73e8')}
        ${asRenderKPI('💸 إجمالي الرواتب (الصافية)', fmt(totalNetSalaries), '#e37400')}
        ${asRenderKPI('📈 الربح بعد الرواتب', fmt(profitAfterSalaries), profitAfterSalaries>=0?'#188038':'#d93025')}
        ${asRenderKPI('💎 صافي الربح', fmt(profitAfterAll), profitAfterAll>=0?'#188038':'#d93025')}
        ${asRenderKPI('📊 هامش الربح', profitMargin+'%', parseFloat(profitMargin)>=15?'#188038':parseFloat(profitMargin)>0?'#e37400':'#d93025')}
    </div>

    <!-- ══ الصف الأول: المقارنة الرئيسية ══ -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px">
        <div class="as-card">
            <div class="as-card-title">📊 الربح بعد خصم الرواتب وقبل المصروفات</div>
            <div style="height:320px"><canvas id="chart-salary-compare"></canvas></div>
        </div>
        <div class="as-card">
            <div class="as-card-title">🥧 توزيع الإيرادات</div>
            <div style="height:320px"><canvas id="chart-revenue-split"></canvas></div>
        </div>
    </div>

    <!-- ══ الصف الثاني: تفاصيل الرواتب الشهرية ══ -->
    <div class="as-card">
        <div class="as-card-title">📅 تطور الرواتب الشهرية (مسيرات معتمدة)</div>
        <div style="height:260px"><canvas id="chart-payroll-monthly"></canvas></div>
    </div>

    <!-- ══ جدول المسيرات ══ -->
    <div class="as-card" style="margin-top:20px">
        <div class="as-card-title">📋 تفاصيل مسيرات الرواتب المعتمدة</div>
        <div style="overflow-x:auto;max-height:300px">
            <table class="as-table">
                <thead><tr>
                    <th>الشهر</th><th>المشروع</th><th>عدد الموظفين</th>
                    <th>إجمالي الرواتب</th><th>صافي الرواتب</th><th>الخصومات</th>
                </tr></thead>
                <tbody>
                    ${payrolls.length===0
                        ? `<tr><td colspan="6" style="text-align:center;color:#9aa0a6;padding:20px">لا توجد مسيرات معتمدة في هذه الفترة</td></tr>`
                        : payrolls.sort((a,b)=>a.month>b.month?-1:1).map(p=>{
                            const gross = parseFloat(p.totalGross)||0;
                            const net   = parseFloat(p.totalNet)||0;
                            const deduct= gross-net;
                            const proj  = window.projects?.[p.projectId]?.name || p.scopeLabel || '—';
                            const empCnt= p.items?.length || p.totalEmployees || '—';
                            return `<tr>
                                <td style="font-weight:700;color:#1a73e8">${formatMonthLabel?.(p.month)||p.month}</td>
                                <td>${proj}</td>
                                <td style="text-align:center">${empCnt}</td>
                                <td style="color:#1a73e8;font-weight:700">${fmt(gross)}</td>
                                <td style="color:#188038;font-weight:700">${fmt(net)}</td>
                                <td style="color:#d93025">${deduct>0?fmt(deduct):'—'}</td>
                            </tr>`;
                        }).join('')
                    }
                </tbody>
            </table>
        </div>
    </div>
    `;

    // بناء الرسوم البيانية
    requestAnimationFrame(() => {
        // مخطط المقارنة الرئيسي (مثل الصورة تماماً)
        _buildChart('chart-salary-compare', 'bar', {
            labels: ['إجمالي الربح بعد الرواتب', 'إجمالي الرواتب', 'إجمالي الإيرادات'],
            datasets: [{
                label: 'القيمة الإجمالية',
                data: [Math.max(0,profitAfterSalaries), totalSalaries, totalRevenue],
                backgroundColor: ['#f4b400','#f4b400','#f4b400'],
                borderColor: ['#e37400','#e37400','#e37400'],
                borderWidth: 1,
                borderRadius: 4
            }]
        }, {
            responsive:true, maintainAspectRatio:false,
            plugins:{
                legend:{display:false},
                datalabels:{display:false}
            },
            scales:{
                x:{ ticks:{ font:{size:11} } },
                y:{ beginAtZero:true, ticks:{ callback: v=>fmt(v) } }
            }
        });

        // مخطط توزيع الإيرادات
        _buildChart('chart-revenue-split', 'doughnut', {
            labels: ['الربح بعد الرواتب','إجمالي الرواتب'],
            datasets: [{
                data: [Math.max(0,profitAfterSalaries), totalSalaries],
                backgroundColor: ['#188038','#1a73e8'],
                borderWidth: 2
            }]
        }, { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } });

        // مخطط تطور الرواتب الشهري
        const monthGroups = {};
        payrolls.forEach(p => {
            const m = p.month;
            if (!monthGroups[m]) monthGroups[m] = { gross:0, net:0 };
            monthGroups[m].gross += parseFloat(p.totalGross)||0;
            monthGroups[m].net   += parseFloat(p.totalNet)||0;
        });
        const sortedM = Object.keys(monthGroups).sort();
        _buildChart('chart-payroll-monthly', 'bar', {
            labels: sortedM.map(m => formatMonthLabel?.(m) || m),
            datasets: [
                { label:'إجمالي الرواتب', data:sortedM.map(m=>monthGroups[m].gross), backgroundColor:'#1a73e8aa', borderColor:'#1a73e8', borderWidth:1, borderRadius:4 },
                { label:'صافي الرواتب',   data:sortedM.map(m=>monthGroups[m].net),   backgroundColor:'#188038aa', borderColor:'#188038', borderWidth:1, borderRadius:4 }
            ]
        }, {
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ position:'bottom' } },
            scales:{ y:{ beginAtZero:true, ticks:{ callback: v=>fmt(v) } } }
        });
    });
}

// ════════════════════════════════════════════════════════
//   الصفحة ٢ — الاتجاهات المالية
// ════════════════════════════════════════════════════════
function asRenderPage2(canvas, journals, pid) {
    canvas.innerHTML = `
    <!-- ══ الصف الأول: اتجاه مالي + ربحية المشاريع ══ -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px">
        <div class="as-card">
            <div class="as-card-title">📈 الاتجاهات المالية الشهرية</div>
            <div style="height:320px"><canvas id="chart-financial-trend"></canvas></div>
        </div>
        <div class="as-card">
            <div class="as-card-title">🏗️ ربحية المشاريع</div>
            <div style="height:320px"><canvas id="chart-project-profit"></canvas></div>
        </div>
    </div>
    <!-- ══ الصف الثاني: هيكل المصاريف ══ -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="as-card">
            <div class="as-card-title">🧱 هيكل المصاريف التشغيلية</div>
            <div style="height:280px"><canvas id="chart-purchase-structure"></canvas></div>
        </div>
        <div class="as-card">
            <div class="as-card-title">📊 مقارنة الإيرادات والمصاريف</div>
            <div style="height:280px"><canvas id="chart-rev-exp-bar"></canvas></div>
        </div>
    </div>`;

    requestAnimationFrame(() => {
        asBuildTrendChart(journals, pid);
        asBuildProjectProfitChart(pid);
        asBuildPurchaseStructure(journals, pid);

        // مخطط الشريط للمقارنة
        const months = {};
        journals.forEach(j => {
            const m = j.date?.substring(0,7);
            if (!m) return;
            if (!months[m]) months[m] = { rev:0, exp:0 };
            j.lines.forEach(l => {
                if (pid && l.costCenter !== pid && l.projectId !== pid) return;
                if (l.accountCode?.startsWith('4')) months[m].rev += (parseFloat(l.credit)||0)-(parseFloat(l.debit)||0);
                if (l.accountCode?.startsWith('5')) months[m].exp += (parseFloat(l.debit)||0)-(parseFloat(l.credit)||0);
            });
        });
        const sm = Object.keys(months).sort();
        _buildChart('chart-rev-exp-bar','bar',{
            labels: sm.map(m=>new Date(m+'-01').toLocaleDateString('ar-SA',{month:'short',year:'2-digit'})),
            datasets:[
                { label:'الإيرادات', data:sm.map(m=>months[m].rev), backgroundColor:'#18803888', borderColor:'#188038', borderWidth:1, borderRadius:4 },
                { label:'المصاريف', data:sm.map(m=>months[m].exp), backgroundColor:'#d9302588', borderColor:'#d93025', borderWidth:1, borderRadius:4 }
            ]
        },{
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ position:'bottom' } },
            scales:{ y:{ beginAtZero:true, ticks:{ callback: v=>fmt(v) } } }
        });
    });
}

// ════════════════════════════════════════════════════════
//   الصفحة ٣ — توزيع العمالة
// ════════════════════════════════════════════════════════
function asRenderPage3(canvas, emps, journals, pid) {
    canvas.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:20px">
        <div class="as-card">
            <div class="as-card-title">👷 توزيع العمالة حسب القسم</div>
            <div style="height:280px"><canvas id="chart-labor-dist"></canvas></div>
        </div>
        <div class="as-card">
            <div class="as-card-title">⭐ توزيع تقييمات الأداء</div>
            <div style="height:280px"><canvas id="chart-performance"></canvas></div>
        </div>
        <div class="as-card">
            <div class="as-card-title">📊 الموظفون حسب المشروع</div>
            <div style="height:280px"><canvas id="chart-emp-project"></canvas></div>
        </div>
    </div>
    <!-- ══ جدول الموظفين ══ -->
    <div class="as-card">
        <div class="as-card-title">👥 قائمة الموظفين النشطين (${emps.length} موظف)</div>
        <div style="overflow-x:auto;max-height:350px">
            <table class="as-table">
                <thead><tr><th>الاسم</th><th>الوظيفة</th><th>القسم</th><th>المشروع</th><th>الراتب الأساسي</th><th>الحالة</th></tr></thead>
                <tbody>
                    ${emps.slice(0,50).map(e=>`<tr>
                        <td style="font-weight:600">${e.name||'—'}</td>
                        <td>${e.jobTitle||e.position||'—'}</td>
                        <td>${e.dept||'—'}</td>
                        <td>${window.projects?.[e.projectId]?.name||'—'}</td>
                        <td style="color:#1a73e8;font-weight:700">${fmt(e.salary||0)}</td>
                        <td><span style="background:#d4edda;color:#155724;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">نشط</span></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    </div>`;

    requestAnimationFrame(() => {
        asBuildLaborDistChart(emps);
        asBuildPerformanceChart(emps);

        // مخطط توزيع الموظفين حسب المشروع
        const projGroups = {};
        emps.forEach(e => {
            const pname = window.projects?.[e.projectId]?.name || 'غير مُحدد';
            projGroups[pname] = (projGroups[pname]||0)+1;
        });
        _buildChart('chart-emp-project','doughnut',{
            labels: Object.keys(projGroups),
            datasets:[{ data:Object.values(projGroups), backgroundColor:['#1a73e8','#188038','#f4b400','#d93025','#8e44ad','#70757a','#e37400'] }]
        },{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } });
    });
}

// ── عرض جدول بيانات النظام الخام ─────────────────────────────────────────────
function asRenderSystemDataGrid() {
    const state = window._asState;
    const from = state.fromDate, to = state.toDate, pid = state.projectId;
    const canvas = document.getElementById('as-canvas');
    if (!canvas) return;

    const rows = Object.values(window.journalEntries||{})
        .filter(j=>j.status==='posted')
        .filter(j=>(!from||j.date>=from)&&(!to||j.date<=to))
        .flatMap(j => (j.lines||[])
            .filter(l=>!pid||l.costCenter===pid||l.projectId===pid)
            .map(l=>({ id:j.id, التاريخ:j.date, الوصف:j.description||'', رقم_الحساب:l.accountCode, مدين:l.debit||0, دائن:l.credit||0, مركز_التكلفة:(typeof ccDisplayName==='function'&&l.costCenter)?ccDisplayName(l.costCenter):(l.costCenter||'—') }))
        );

    canvas.innerHTML = `
    <div class="as-card">
        <div class="as-card-title">📄 بيانات القيود المحاسبية الخام (${rows.length} سطر)</div>
        <div style="overflow:auto;max-height:650px">
            <table class="as-table">
                <thead><tr>${Object.keys(rows[0]||{id:'',التاريخ:''}).map(c=>`<th>${c}</th>`).join('')}</tr></thead>
                <tbody>${rows.slice(0,200).map(r=>`<tr>${Object.values(r).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
        </div>
    </div>`;
}

// ════════════════════════════════════════════════════════
//   معالجة الملف المرفوع (Power BI Engine)
// ════════════════════════════════════════════════════════
function asProcessFileData(rawData) {
    const state = window._asState;
    if (!rawData || rawData.length === 0) return;

    // ── تحديد الأعمدة من البيانات الكاملة ──
    const allCols    = Object.keys(rawData[0]);
    const numericCols= allCols.filter(c => rawData.slice(0,10).some(r =>
        typeof r[c]==='number' || (!isNaN(parseFloat(r[c]))&&r[c]!==''&&r[c]!==undefined)
    ));
    const dateCols   = allCols.filter(c => {
        const v = String(rawData[0]?.[c]||'');
        return !isNaN(Date.parse(v)) && (v.includes('-')||v.includes('/'));
    });
    const catCols = allCols.filter(c => !numericCols.includes(c) && !dateCols.includes(c));

    // حفظ الأعمدة في الحالة
    state.lastNumericCols = numericCols;
    state.lastCatCols     = catCols;

    // ── منطق الحفر الهرمي: المحور = المستوى التالي بعد آخر فلتر نشط ──
    const drillAxis = asGetDrillAxis(catCols, state.slicers);
    const valueCol  = numericCols[0] || '';

    // تعيين إعدادات الرسوم بناءً على مستوى الحفر
    // ملاحظة: لا نُعيد تعيين .type حتى لا نتجاوز اختيار المستخدم
    if (valueCol) {
        const title = `${drillAxis} — إجمالي ${valueCol}`;
        ['chart1','chart2','chart3'].forEach(id => {
            state.configs[id].axis  = drillAxis;
            state.configs[id].value = valueCol;
            state.configs[id].title = title;
            // نُعيد النوع الافتراضي فقط عند تحميل ملف جديد (axis فارغ)
            if (!state.configs[id]._userType) {
                state.configs[id].type = id === 'chart3' ? 'doughnut' : 'bar';
            }
        });
    }

    // ── تطبيق الفلاتر ──
    let data = rawData.filter(row =>
        Object.entries(state.slicers).every(([col,val]) =>
            String(row[col]??'') === String(val??'')
        )
    );
    state.lastFilteredData = data;

    // ── تحديث السلايسرز والحقول دائماً ──
    // ── الحصول على القماش أولاً دائماً ──
    const canvas = document.getElementById('as-canvas');
    if (!canvas) return;

    // ── تحديث السلايسرز والحقول (تحدث في كلا التبويبين) ──
    asRenderFieldsPane(numericCols, catCols, dateCols);
    asRenderVizPane();
    asRenderSlicers(rawData, catCols);

    // ── تبويب البيانات: نعرض الجدول المتقدم في القماش ──
    if (state.activeTab === 'data') {
        // شرائط الفلاتر النشطة
        const activeFilters = Object.entries(state.slicers||{});
        const filterChips = activeFilters.map(([c,v])=>
            `<span style="background:#e8f0fe;color:#1a73e8;border:1px solid #c5d8f6;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px">
                🔍 ${c} = ${v}
                <span onclick="asToggleSlicer('${c.replace(/'/g,"\\'")}','${String(v).replace(/'/g,"\\'")}');asSwitchTab('data')"
                    style="cursor:pointer;color:#d93025;font-weight:900;margin-right:4px" title="إزالة الفلتر">✕</span>
            </span>`
        ).join(' ');

        canvas.innerHTML = `
        <style>
            .dg-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
            .dg-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:inherit}
            .dg-group-row td{background:#e8f0fe!important;font-weight:800;color:#1a73e8;font-size:12px}
            .dg-subtotal-row td{background:#f0f7f0!important;font-weight:700;color:#188038;font-size:11px;border-top:2px solid #a8d5a2}
            .dg-grand-total td{background:#1a73e8!important;color:#fff!important;font-weight:900;font-size:12px;border-top:3px solid #1557b0}
            .dg-num{text-align:left;direction:ltr;font-variant-numeric:tabular-nums}
        </style>
        <div class="as-card" style="padding:16px">
            <!-- شريط الأدوات -->
            <div class="dg-toolbar">
                <div style="flex:1;min-width:200px">
                    <div style="font-size:14px;font-weight:800;color:#202124;margin-bottom:4px">📄 البيانات التفصيلية</div>
                    <div style="font-size:11px;color:#70757a">
                        ${data.length} صف معروض
                        ${data.length < rawData.length ? `من ${rawData.length} إجمالي` : ''}
                    </div>
                </div>

                <!-- تجميع المجموعات -->
                <div style="display:flex;align-items:center;gap:6px">
                    <label style="font-size:11px;font-weight:700;color:#5f6368;white-space:nowrap">تجميع حسب:</label>
                    <select id="dg-group-col" onchange="asDgSetGroupBy(this.value)"
                        style="padding:5px 10px;border:1px solid #dadce0;border-radius:6px;font-size:12px;background:#fff;cursor:pointer;font-family:inherit">
                        <option value="">— لا يوجد تجميع —</option>
                        ${catCols.map(c=>`<option value="${c}" ${(state._dgGroupBy||'')=== c?'selected':''}>${c}</option>`).join('')}
                    </select>
                </div>

                <button class="dg-chip" onclick="asDgToggleSubtotals()"
                    style="background:${state._dgShowSubtotals?'#188038':'#f1f3f4'};color:${state._dgShowSubtotals?'#fff':'#3c4043'};border:1px solid ${state._dgShowSubtotals?'#188038':'#dadce0'}">
                    Σ ${state._dgShowSubtotals?'إخفاء إجماليات المجموعات':'عرض إجماليات المجموعات'}
                </button>

                <button class="dg-chip" onclick="asDgExportCSV()"
                    style="background:#fff;color:#3c4043;border:1px solid #dadce0">
                    📥 تصدير CSV
                </button>
            </div>

            <!-- شرائح الفلاتر النشطة -->
            ${activeFilters.length ? `
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;padding:10px;background:#f8faff;border-radius:6px;border:1px solid #e8eaed">
                <span style="font-size:11px;font-weight:800;color:#5f6368;margin-left:4px">🔍 الفلاتر النشطة:</span>
                ${filterChips}
                <span onclick="asResetSlicers();asSwitchTab('data')"
                    style="cursor:pointer;font-size:11px;color:#d93025;font-weight:700;padding:3px 10px;border:1px solid #f5a9a7;border-radius:20px;background:#fce8e6">
                    ✕ مسح الكل
                </span>
            </div>` : ''}

            <!-- الجدول -->
            <div id="as-data-grid" style="overflow:auto;max-height:600px"></div>
        </div>`;

        asRenderDataGrid(data, numericCols, catCols);
        return;
    }

    // ── تبويب التقرير: التحقق من البيانات ──
    if (data.length === 0) {
        canvas.innerHTML = `<div style="text-align:center;padding:60px;color:#c0392b;font-weight:700">
            <div style="font-size:40px;margin-bottom:12px">⚠️</div>
            لا توجد بيانات تطابق الفلاتر المختارة
            <br><button onclick="asResetSlicers()" style="margin-top:16px;padding:8px 20px;background:#1a73e8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:700">🗑️ مسح الفلاتر</button>
        </div>`;
        return;
    }

    // ── مسار الحفر (Breadcrumb) ──
    const breadcrumb = asGetBreadcrumb(catCols, state.slicers);
    const showLbl1 = state.chartLabels['chart1'] !== false;
    const showLbl2 = state.chartLabels['chart2'] !== false;
    const showLbl3 = state.chartLabels['chart3'] !== false;

    canvas.innerHTML = `
    ${breadcrumb}
    <div class="as-kpi-grid" id="as-scorecards"></div>

    <!-- ── صف الرسمين الرئيسيين ── -->
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:20px;margin-bottom:20px">
        <div class="as-card">
            <div class="as-card-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>📊 ${state.configs.chart1.title}</span>
                <div style="display:flex;gap:4px">
                    <button title="${showLbl1?'إخفاء القيم':'إظهار القيم'}"
                        onclick="asToggleLabels('chart1')"
                        style="border:1px solid #dadce0;background:#fff;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700;color:${showLbl1?'#1a73e8':'#9aa0a6'}">
                        ${showLbl1?'🏷️ إخفاء القيم':'🏷️ إظهار القيم'}
                    </button>
                </div>
            </div>
            <div style="height:320px"><canvas id="chart1"></canvas></div>
        </div>
        <div class="as-card">
            <div class="as-card-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>🍩 توزيع الحصص</span>
                <button title="${showLbl3?'إخفاء القيم':'إظهار القيم'}"
                    onclick="asToggleLabels('chart3')"
                    style="border:1px solid #dadce0;background:#fff;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700;color:${showLbl3?'#1a73e8':'#9aa0a6'}">
                    ${showLbl3?'🏷️ إخفاء':'🏷️ إظهار'}
                </button>
            </div>
            <div style="height:320px"><canvas id="chart3"></canvas></div>
        </div>
    </div>

    <!-- ── الصف الثاني ── -->
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:20px;margin-bottom:20px">
        <div class="as-card">
            <div class="as-card-title" style="display:flex;justify-content:space-between;align-items:center">
                <span>📈 ${state.configs.chart2.title}</span>
                <button title="${showLbl2?'إخفاء القيم':'إظهار القيم'}"
                    onclick="asToggleLabels('chart2')"
                    style="border:1px solid #dadce0;background:#fff;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700;color:${showLbl2?'#1a73e8':'#9aa0a6'}">
                    ${showLbl2?'🏷️ إخفاء القيم':'🏷️ إظهار القيم'}
                </button>
            </div>
            <div style="height:280px"><canvas id="chart2"></canvas></div>
        </div>
        <div class="as-card">
            <div class="as-card-title">📄 عرض البيانات (${data.length} صف)</div>
            <div id="as-data-grid" style="max-height:280px;overflow:auto"></div>
        </div>
    </div>`;

    asRenderScorecards(data, numericCols);
    asRenderDataGrid(data);
    ['chart1','chart2','chart3'].forEach(id => {
        const cfg = state.configs[id];
        if (cfg.axis && cfg.value) asBuildDynamicChart(id, data, cfg);
    });
}

// ── لوحة الحقول (للملف) ──────────────────────────────────────────────────────
function asRenderFieldsPane(numeric, cat, date) {
    const container = document.getElementById('as-fields-pane');
    if (!container) return;
    container.innerHTML = `
        <div class="as-pane-title" style="margin-top:0">Fields</div>
        <div style="padding:8px 0">
            ${[...date,...cat].map(c=>`<div class="as-field-item"><span style="color:#1a73e8">📐</span> ${c}</div>`).join('')}
            ${numeric.map(c=>`<div class="as-field-item"><span style="color:#188038">∑</span> ${c}</div>`).join('')}
        </div>
        <div class="as-pane-title">Visual Config</div>
        <div style="padding:12px;display:flex;flex-direction:column;gap:8px">
            <label style="font-size:10px;font-weight:800;color:#5f6368">Axis / Dimension</label>
            <select class="as-select" onchange="asUpdateVizConfig('axis',this.value)">
                <option value="">-- اختر --</option>
                ${[...date,...cat].map(c=>`<option value="${c}"${window._asState.configs[window._asState.selectedVisualId].axis===c?' selected':''}>${c}</option>`).join('')}
            </select>
            <label style="font-size:10px;font-weight:800;color:#5f6368">Value / Measure</label>
            <select class="as-select" onchange="asUpdateVizConfig('value',this.value)">
                <option value="">-- اختر --</option>
                ${numeric.map(c=>`<option value="${c}"${window._asState.configs[window._asState.selectedVisualId].value===c?' selected':''}>${c}</option>`).join('')}
            </select>
        </div>`;
}

function asRenderVizPane() {
    const container = document.getElementById('as-viz-pane');
    if (!container) return;
    const types = [
        {id:'line',icon:'📈'},{id:'bar',icon:'📊'},
        {id:'doughnut',icon:'🍩'},{id:'pie',icon:'🥧'}
    ];
    const cur = window._asState.configs[window._asState.selectedVisualId].type;
    container.innerHTML = types.map(t =>
        `<button class="as-type-btn ${cur===t.id?'act':''}" title="${t.id}" onclick="asUpdateVizConfig('type','${t.id}')">${t.icon}</button>`
    ).join('');
}

// ── رسم ديناميكي (للملف) — مع قيم على الأعمدة وتحكم per-chart ──────────────
function asBuildDynamicChart(canvasId, data, cfg) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    // تجميع البيانات وترتيبها تنازلياً
    const groups = {};
    data.forEach(r => {
        const key = String(r[cfg.axis] ?? 'N/A');
        groups[key] = (groups[key]||0) + (parseFloat(r[cfg.value])||0);
    });
    const sorted  = Object.entries(groups).sort((a,b) => b[1]-a[1]);
    const labels  = sorted.map(e=>e[0]);
    const values  = sorted.map(e=>e[1]);

    const isDoughnut = ['pie','doughnut'].includes(cfg.type);
    const isBar      = cfg.type === 'bar';
    const showLabels = window._asState.chartLabels[canvasId] !== false; // افتراضي: ظاهر

    // ألوان متعددة للأعمدة
    const BAR_COLORS = [
        '#1a73e8','#188038','#f4b400','#d93025','#8e44ad',
        '#e37400','#0097a7','#7b5ea7','#c2185b','#37474f'
    ];

    // Plugin مخصص لرسم القيم فوق الأعمدة
    const dataLabelsPlugin = {
        id: `lbl_${canvasId}`,
        afterDatasetsDraw(chart) {
            if (!showLabels || isDoughnut) return;
            const { ctx: c } = chart;
            chart.data.datasets.forEach((ds, di) => {
                const meta = chart.getDatasetMeta(di);
                if (meta.hidden) return;
                meta.data.forEach((el, j) => {
                    const val = ds.data[j];
                    if (val === null || val === undefined || val === 0) return;
                    c.save();
                    c.font      = 'bold 10px "Segoe UI", Arial, sans-serif';
                    c.fillStyle = '#202124';
                    c.textAlign = 'center';
                    c.textBaseline = 'bottom';
                    // اختصار الأرقام الكبيرة
                    const label = Math.abs(val) >= 1000000
                        ? (val/1000000).toFixed(1)+'M'
                        : Math.abs(val) >= 1000
                            ? (val/1000).toFixed(1)+'K'
                            : fmt(val);
                    c.fillText(label, el.x, el.y - 3);
                    c.restore();
                });
            });
        }
    };

    window._asState.charts[canvasId] = new Chart(ctx, {
        type: cfg.type,
        data: {
            labels,
            datasets:[{
                label: cfg.value,
                data: values,
                backgroundColor: isDoughnut
                    ? BAR_COLORS
                    : isBar
                        ? values.map((_,i) => BAR_COLORS[i % BAR_COLORS.length])
                        : '#1a73e822',
                borderColor: isDoughnut
                    ? BAR_COLORS.map(c=>c+'cc')
                    : '#1a73e8',
                borderWidth: isDoughnut ? 2 : 1,
                fill: cfg.type==='line',
                tension: 0.3,
                borderRadius: isBar ? 4 : 0
            }]
        },
        options:{
            responsive: true,
            maintainAspectRatio: false,
            plugins:{
                legend:{ display: isDoughnut, position:'bottom' },
                tooltip:{
                    callbacks:{
                        label: ctx => ` ${fmt(ctx.parsed.y ?? ctx.parsed)} `
                    }
                }
            },
            scales: isDoughnut ? {} : {
                y:{ beginAtZero:true, ticks:{ callback: v=>fmt(v) } },
                x:{ ticks:{ maxRotation:35, font:{ size:10 } } }
            },
            layout:{ padding:{ top: showLabels && isBar ? 22 : 8 } }
        },
        plugins: [dataLabelsPlugin]
    });
}

// ── بطاقات KPI (للملف) ────────────────────────────────────────────────────
function asRenderScorecards(data, numericCols) {
    const sc = document.getElementById('as-scorecards');
    if (!sc) return;
    const colors = ['#1a73e8','#188038','#d93025','#e37400','#70757a'];
    sc.innerHTML = numericCols.slice(0,5).map((col,i)=>{
        const sum = data.reduce((s,r)=>s+(parseFloat(r[col])||0),0);
        return asRenderKPI(`📊 إجمالي ${col}`, fmt(sum), colors[i%colors.length]);
    }).join('') || '<div style="grid-column:1/-1;text-align:center;color:#9aa0a6">لا توجد بيانات رقمية</div>';
}

function asRenderSlicers(allData, catCols) {
    const container = document.getElementById('as-slicers-container');
    if (!container) return;

    // نُخزن الأعمدة والقيم في خريطة مفهرسة لاستخدامها عند النقر
    window._asSlicerMap = window._asSlicerMap || {};

    let html = catCols.slice(0,4).map((col, ci) => {
        const vals = [...new Set(allData.map(r=>r[col]))].slice(0,15);
        const activeVal = String(window._asState.slicers[col] ?? '\x00'); // sentinel
        const colKey = `sc_${ci}`;
        window._asSlicerMap[colKey] = { col, vals };

        return `<div style="margin-bottom:12px">
            <div style="font-size:10px;color:#5f6368;font-weight:800;margin-bottom:4px">📍 ${col}</div>
            ${vals.map((v, vi) => {
                const strV  = String(v ?? '');
                const isAct = strV === String(window._asState.slicers[col] ?? '\x00');
                return `<span class="as-slicer-item${isAct?' act':''}"
                    data-ck="${colKey}" data-vi="${vi}"
                    onclick="asSlicerClick(this)">${strV}</span>`;
            }).join('')}
        </div>`;
    }).join('');
    container.innerHTML = html || '<div style="font-size:11px;color:#9aa0a6;text-align:center;padding:10px">لا توجد حقول تصنيفية</div>';
}

// مُعالج النقر على السلايسر — يستخدم الخريطة بدلاً من القيم المضمنة
window.asSlicerClick = function(el) {
    const ck  = el.dataset.ck;
    const vi  = parseInt(el.dataset.vi, 10);
    const map = window._asSlicerMap?.[ck];
    if (!map) return;
    const col = map.col;
    const val = String(map.vals[vi] ?? '');
    asToggleSlicer(col, val);
};

function asRenderDataGrid(data, numCols, catCols) {
    const grid = document.getElementById('as-data-grid');
    if (!grid) return;

    if (!data.length) {
        grid.innerHTML = `<div style="text-align:center;padding:40px;color:#9aa0a6">
            <div style="font-size:32px;margin-bottom:8px">📭</div>لا توجد بيانات تطابق الفلاتر
        </div>`;
        return;
    }

    const state  = window._asState;
    const cols   = Object.keys(data[0]);

    // تحديد الأعمدة الرقمية والتصنيفية إذا لم تُمرر
    const numeric = numCols || cols.filter(c=>data.slice(0,5).some(r=>typeof r[c]==='number'||(!isNaN(parseFloat(r[c]))&&r[c]!=='')));
    const cats    = catCols || cols.filter(c=>!numeric.includes(c));
    const isNum   = c => numeric.includes(c);

    const groupBy      = state._dgGroupBy || '';
    const showSubtotals= state._dgShowSubtotals || false;

    // دالة مساعدة: حساب إجمالي مجموعة
    const sumGroup = rows => {
        const t = {};
        numeric.forEach(c => { t[c] = rows.reduce((s,r)=>s+(parseFloat(r[c])||0),0); });
        return t;
    };

    // دالة مساعدة: خلية قيمة
    const cell = (c, v, cls='') => {
        const formatted = isNum(c) && v !== '' && v !== undefined && v !== null
            ? `<span style="color:${v<0?'#d93025':'inherit'}">${fmt(v)}</span>` : (v??'');
        return `<td class="${isNum(c)?'dg-num':''} ${cls}">${formatted}</td>`;
    };

    // ── بناء صفوف الجدول ──
    let rows = '';
    const grandTotals = sumGroup(data);

    if (groupBy && data.some(r=>r[groupBy]!==undefined)) {
        // وضع التجميع
        const groups = {};
        data.forEach(r => {
            const k = String(r[groupBy]??'—');
            if (!groups[k]) groups[k] = [];
            groups[k].push(r);
        });

        Object.entries(groups).sort(([a],[b])=>a.localeCompare(b,'ar')).forEach(([gKey, gRows]) => {
            // رأس المجموعة
            rows += `<tr class="dg-group-row">
                <td colspan="${cols.length}" style="padding:8px 12px">
                    📂 ${gKey}
                    <span style="font-weight:400;font-size:10px;margin-right:8px;opacity:.7">${gRows.length} صف</span>
                </td>
            </tr>`;

            // صفوف البيانات
            gRows.forEach(r => {
                rows += `<tr>${cols.map(c=>cell(c,r[c])).join('')}</tr>`;
            });

            // إجمالي المجموعة
            if (showSubtotals && numeric.length) {
                const gt = sumGroup(gRows);
                rows += `<tr class="dg-subtotal-row">
                    <td colspan="${cats.length}" style="padding:6px 12px">Σ إجمالي ${gKey}</td>
                    ${numeric.map(c=>`<td class="dg-num">${fmt(gt[c])}</td>`).join('')}
                </tr>`;
            }
        });
    } else {
        // وضع عادي — بدون تجميع (حتى 500 صف)
        rows = data.slice(0,500).map(r=>`<tr>${cols.map(c=>cell(c,r[c])).join('')}</tr>`).join('');
        if (data.length > 500) {
            rows += `<tr><td colspan="${cols.length}" style="text-align:center;color:#9aa0a6;padding:10px;font-style:italic">
                ... يُعرض أول 500 صف من ${data.length} — استخدم الفلاتر لتضييق النطاق
            </td></tr>`;
        }
    }

    // صف الإجمالي الكلي
    const totalRow = numeric.length ? `
        <tfoot>
            <tr class="dg-grand-total">
                <td colspan="${cats.length}" style="padding:10px 12px">
                    Σ الإجمالي الكلي (${data.length} صف)
                </td>
                ${numeric.map(c=>`<td class="dg-num" style="padding:10px 8px">${fmt(grandTotals[c])}</td>`).join('')}
            </tr>
        </tfoot>` : '';

    grid.innerHTML = `
        <table class="as-table" style="min-width:600px">
            <thead>
                <tr>${cols.map(c=>`
                    <th onclick="asDgSort('${c.replace(/'/g,"\\'")}',this)"
                        style="cursor:pointer;user-select:none;white-space:nowrap"
                        title="اضغط للترتيب">
                        ${c} <span style="font-size:9px;opacity:.5" class="dg-sort-icon">⇅</span>
                    </th>`).join('')}
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            ${totalRow}
        </table>`;
}

// ── دوال مساعدة للجدول ────────────────────────────────────────────────────

window.asDgSetGroupBy = function(col) {
    window._asState._dgGroupBy = col;
    asProcessData();
};

window.asDgToggleSubtotals = function() {
    window._asState._dgShowSubtotals = !window._asState._dgShowSubtotals;
    asProcessData();
};

window.asDgSort = function(col, thEl) {
    const state = window._asState;
    const data  = state.lastFilteredData;
    if (!data?.length) return;

    const asc = state._dgSortCol === col ? !state._dgSortAsc : true;
    state._dgSortCol = col;
    state._dgSortAsc = asc;

    // ترتيب البيانات
    const isN = !isNaN(parseFloat(data[0]?.[col]));
    data.sort((a,b) => {
        const av = a[col]??'', bv = b[col]??'';
        const cmp = isN ? (parseFloat(av)||0)-(parseFloat(bv)||0) : String(av).localeCompare(String(bv),'ar');
        return asc ? cmp : -cmp;
    });

    // تحديث الأيقونة
    document.querySelectorAll('.dg-sort-icon').forEach(el=>el.textContent='⇅');
    thEl?.querySelector('.dg-sort-icon') && (thEl.querySelector('.dg-sort-icon').textContent = asc?'↑':'↓');

    // إعادة رسم الجدول فقط
    const numCols = Object.keys(data[0]).filter(c=>data.slice(0,5).some(r=>typeof r[c]==='number'||(!isNaN(parseFloat(r[c]))&&r[c]!=='')));
    const catCols = Object.keys(data[0]).filter(c=>!numCols.includes(c));
    asRenderDataGrid(data, numCols, catCols);
};

window.asDgExportCSV = function() {
    const data = window._asState.lastFilteredData;
    if (!data?.length) { toast('⚠️ لا توجد بيانات للتصدير','er'); return; }
    const cols = Object.keys(data[0]);
    const csv  = [
        cols.join(','),
        ...data.map(r => cols.map(c => `"${String(r[c]??'').replace(/"/g,'""')}"`).join(','))
    ].join('\n');
    const a = document.createElement('a');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    a.href = URL.createObjectURL(blob);
    a.download = `${window._asState.reportName||'تقرير'}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast('✅ تم تصدير البيانات كـ CSV','ok');
};

// ════════════════════════════════════════════════════════
//   الرسوم البيانية للنظام (صفحة ٢ و ٣)
// ════════════════════════════════════════════════════════
function asBuildTrendChart(journals, pid) {
    const months = {};
    journals.forEach(j => {
        const m = j.date?.substring(0,7);
        if (!m) return;
        if (!months[m]) months[m] = { rev:0, exp:0 };
        j.lines.forEach(l => {
            if (pid && l.costCenter !== pid && l.projectId !== pid) return;
            if (l.accountCode?.startsWith('4')) months[m].rev += (parseFloat(l.credit)||0)-(parseFloat(l.debit)||0);
            if (l.accountCode?.startsWith('5')) months[m].exp += (parseFloat(l.debit)||0)-(parseFloat(l.credit)||0);
        });
    });
    const sm = Object.keys(months).sort();
    _buildChart('chart-financial-trend','line',{
        labels: sm.map(m=>new Date(m+'-01').toLocaleDateString('ar-SA',{month:'short',year:'2-digit'})),
        datasets:[
            { label:'الإيرادات', data:sm.map(m=>months[m].rev), borderColor:'#188038', backgroundColor:'#18803822', fill:true, tension:0.4 },
            { label:'المصاريف', data:sm.map(m=>months[m].exp), borderColor:'#d93025', backgroundColor:'#d9302522', fill:true, tension:0.4 }
        ]
    },{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom' } },
        scales:{ y:{ beginAtZero:true, ticks:{ callback: v=>fmt(v) } } }
    });
}

function asBuildProjectProfitChart(pidFilter) {
    const projs = pidFilter ? [pidFilter] : Object.keys(window.projects||{});
    const labels=[], margins=[];
    projs.forEach(id => {
        const p = window.projects?.[id]; if (!p) return;
        let rev=0, exp=0;
        Object.values(window.journalEntries||{}).forEach(j=>{
            if (j.status!=='posted') return;
            j.lines.forEach(l=>{
                if (l.costCenter!==id && l.projectId!==id) return;
                if (l.accountCode?.startsWith('4')) rev += parseFloat(l.credit)||0;
                if (l.accountCode?.startsWith('5')) exp += parseFloat(l.debit)||0;
            });
        });
        labels.push((p.name||id).substring(0,15));
        margins.push(rev>0?((rev-exp)/rev*100).toFixed(1):0);
    });
    _buildChart('chart-project-profit','bar',{
        labels,
        datasets:[{ label:'هامش الربح %', data:margins, backgroundColor:margins.map(m=>m>15?'#188038':m>0?'#f4b400':'#d93025'), borderRadius:4 }]
    },{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } });
}

function asBuildLaborDistChart(emps) {
    const depts = {};
    emps.forEach(e => { const d=e.dept||'أخرى'; depts[d]=(depts[d]||0)+1; });
    _buildChart('chart-labor-dist','doughnut',{
        labels: Object.keys(depts),
        datasets:[{ data:Object.values(depts), backgroundColor:['#1a73e8','#188038','#f4b400','#d93025','#8e44ad','#70757a'] }]
    },{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } });
}

function asBuildPurchaseStructure(journals, pid) {
    const catMap = {'5110':'مواد','5120':'خدمات','5130':'معدات','5140':'باطن'};
    const s = {'مواد':0,'خدمات':0,'معدات':0,'باطن':0,'أخرى':0};
    journals.forEach(j => j.lines.forEach(l => {
        if (pid && l.costCenter!==pid && l.projectId!==pid) return;
        if (l.accountCode?.startsWith('51')) {
            const cat = catMap[l.accountCode]||'أخرى';
            s[cat] += parseFloat(l.debit)||0;
        }
    }));
    _buildChart('chart-purchase-structure','polarArea',{
        labels: Object.keys(s),
        datasets:[{ data:Object.values(s), backgroundColor:['#1a73e8cc','#188038cc','#f4b400cc','#d93025cc','#70757acc'] }]
    },{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } });
}

function asBuildPerformanceChart(emps) {
    const ratings = { excellent:0, vgood:0, good:0, weak:0 };
    Object.values(window.performance||{}).forEach(p => {
        if (emps.some(e=>e.empKey===p.empKey) && ratings[p.rating]!==undefined) ratings[p.rating]++;
    });
    _buildChart('chart-performance','radar',{
        labels:['ممتاز','جيد جداً','جيد','ضعيف'],
        datasets:[{ label:'التقييمات', data:[ratings.excellent,ratings.vgood,ratings.good,ratings.weak], borderColor:'#1a73e8', backgroundColor:'#1a73e822' }]
    },{ responsive:true, maintainAspectRatio:false });
}

// ── مساعد بناء الرسوم ────────────────────────────────────────────────────────
function _buildChart(canvasId, type, data, options) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    window._asState.charts[canvasId] = new Chart(ctx, { type, data, options });
}

function destroyChart(id) {
    if (window._asState.charts[id]) {
        window._asState.charts[id].destroy();
        delete window._asState.charts[id];
    }
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function asRenderKPI(label, val, color) {
    return `<div class="as-kpi-card" style="border-top-color:${color}">
        <div class="as-kpi-lbl">${label}</div>
        <div class="as-kpi-val" style="color:${color}">${val}</div>
        <div class="as-kpi-sub">للفترة المحددة</div>
    </div>`;
}

// ════════════════════════════════════════════════════════
//   معالجة الملف المرفوع
// ════════════════════════════════════════════════════════
window.asHandleFileUpload = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') { toast('❌ مكتبة Excel غير محملة، يرجى تحديث الصفحة','er'); return; }
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array'});
            if (!wb.SheetNames?.length) throw new Error('No sheets');
            const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            if (!json?.length) { toast('❌ الملف فارغ أو لا يحتوي على بيانات صالحة','er'); return; }
            window._asState.uploadedData = json;
            window._asState.dataSource   = 'file';
            window._asState.slicers      = {};
            // إعادة تعيين أنواع الرسوم عند ملف جديد
            ['chart1','chart2','chart3','chart4'].forEach(id => {
                delete window._asState.configs[id]._userType;
            });
            toast('✅ تم تحميل '+json.length+' صف بنجاح','ok');
            renderAnalytics();
        } catch(err) {
            toast('❌ خطأ في معالجة ملف Excel المحمل','er');
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
};

// ════════════════════════════════════════════════════════
//   الدوال المفقودة (كانت تُسبب أخطاء)
// ════════════════════════════════════════════════════════

// إصلاح ١: asSwitchTab — تبديل بين التقرير وعرض البيانات
window.asSwitchTab = function(tab) {
    window._asState.activeTab = tab;
    renderAnalytics();
};

// إصلاح ٢: asToggleSlicer — تفعيل/إلغاء فلتر من السلايسر
window.asToggleSlicer = function(col, val) {
    const strVal = String(val ?? '');
    // إذا نفس الفلتر نشط — ألغه، وإلا فعّله
    if (String(window._asState.slicers[col] ?? '\x00') === strVal) {
        delete window._asState.slicers[col];
    } else {
        window._asState.slicers[col] = strVal;
    }
    asProcessData();
};

// إصلاح ٣: asResetSlicers — مسح جميع الفلاتر
window.asResetSlicers = function() {
    window._asState.slicers = {};
    asProcessData();
};

// إصلاح ٤: asChangeVisual — تغيير نوع الرسم البياني
window.asChangeVisual = function(id, type) {
    window._asState.configs[id].type = type;
    renderAnalytics();
};

// إصلاح ٥: asSwitchPage — التنقل بين صفحات لوكر ستوديو
window.asSwitchPage = function(page) {
    window._asState.activePage = page;
    // تحديث أزرار الصفحات بدون إعادة رسم كاملة
    document.querySelectorAll('.as-page-btn').forEach((btn,i) => {
        btn.classList.toggle('act', i+1===page);
    });
    const from = window._asState.fromDate;
    const to   = window._asState.toDate;
    const pid  = window._asState.projectId;
    const journals = Object.values(window.journalEntries||{})
        .filter(j=>j.status==='posted')
        .filter(j=>(!from||j.date>=from)&&(!to||j.date<=to));
    const activeEmps = Object.values(window.emp||{}).filter(e=>(e.status||'active')==='active');
    const filteredEmps = pid ? activeEmps.filter(e=>e.projectId===pid) : activeEmps;
    const canvas = document.getElementById('as-canvas');
    if (!canvas) return;

    if (page===1) asProcessSystemData(from,to,pid);
    else if (page===2) asRenderPage2(canvas, journals, pid);
    else if (page===3) asRenderPage3(canvas, filteredEmps, journals, pid);
};

// ── الدوال المساعدة الأخرى ───────────────────────────────────────────────────
window.asSwitchSource = function(src) {
    window._asState.dataSource = src;
    renderAnalytics();
};

window.asUpdateFilter = function(key, val) {
    window._asState[key] = val;
    renderAnalytics();
};

window.asUpdateVizConfig = function(key, val) {
    const state = window._asState;
    const id    = state.selectedVisualId;
    state.configs[id][key] = val;

    if (key === 'type') {
        // حفظ اختيار المستخدم حتى لا تُبطله إعادة العرض
        state.configs[id]._userType = val;

        // إعادة بناء الرسم المحدد فقط (سريع)
        const data = state.lastFilteredData;
        const cfg  = state.configs[id];
        if (data && cfg.axis && cfg.value) {
            asBuildDynamicChart(id, data, cfg);
        }
        // تحديث أيقونات CHART TYPE بدون إعادة رسم كاملة
        asRenderVizPane();

    } else {
        // تغيير المحور أو القيمة → نحتاج إعادة معالجة
        if (key === 'axis' || key === 'value') {
            state.configs[id].title = `${state.configs[id].value} — حسب — ${state.configs[id].axis}`;
        }
        asProcessData();
    }
};

window.asSelectVisual = function(id) {
    window._asState.selectedVisualId = id;
    renderAnalytics();
};

// ════════════════════════════════════════════════════════
//   دوال الحفر الهرمي (Drill-Down)
// ════════════════════════════════════════════════════════

/**
 * يُحدد المحور الصحيح بناءً على آخر فلتر نشط في التسلسل الهرمي.
 * مثال: إذا كان المستوى الثاني مفلتراً → يُعيد المستوى الثالث.
 */
function asGetDrillAxis(catCols, slicers) {
    if (!catCols || catCols.length === 0) return '';
    // إيجاد آخر عمود مُفعَّل في السلايسر (بنفس ترتيب catCols)
    let deepestIdx = -1;
    catCols.forEach((col, idx) => {
        if (slicers[col] !== undefined) deepestIdx = idx;
    });
    // المحور = العمود الذي يلي آخر مستوى مختار
    const nextIdx = deepestIdx + 1;
    return nextIdx < catCols.length
        ? catCols[nextIdx]
        : catCols[Math.max(0, deepestIdx)]; // في أعمق مستوى، ابق عليه
}

/**
 * يُنشئ شريط Breadcrumb يُظهر مسار الفلاتر المختارة.
 */
function asGetBreadcrumb(catCols, slicers) {
    const crumbs = catCols
        .filter(col => slicers[col] !== undefined)
        .map(col => ({ col, val: slicers[col] }));

    if (crumbs.length === 0) return '';

    const trail = crumbs.map((c, i) =>
        `<span style="color:${i===crumbs.length-1?'#1a73e8':'#5f6368'};font-weight:${i===crumbs.length-1?800:400}">
            ${c.col}: <strong>${c.val}</strong>
        </span>`
    ).join(`<span style="color:#9aa0a6;margin:0 6px">›</span>`);

    return `<div style="background:#e8f0fe;border:1px solid #c5d8f6;border-radius:6px;padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:11px;color:#5f6368;font-weight:800">📍 مسار الحفر:</span>
        <span style="font-size:12px">${trail}</span>
        <button onclick="asResetSlicers()" style="margin-right:auto;padding:3px 10px;border:1px solid #1a73e8;background:#fff;color:#1a73e8;border-radius:4px;cursor:pointer;font-size:11px;font-weight:700">
            ✕ مسح الكل
        </button>
    </div>`;
}

// ── إظهار/إخفاء القيم على رسم بعينه ─────────────────────────────────────────
window.asToggleLabels = function(chartId) {
    const state = window._asState;
    // الافتراضي true (ظاهر) → عند التبديل الأول يصير false
    state.chartLabels[chartId] = state.chartLabels[chartId] === false ? true : false;

    // إعادة بناء هذا الرسم فقط بسرعة بدون إعادة رسم كاملة
    const data = state.lastFilteredData;
    const cfg  = state.configs[chartId];
    if (data && cfg && cfg.axis && cfg.value) {
        asBuildDynamicChart(chartId, data, cfg);
    }

    // تحديث زر التبديل
    const showNow = state.chartLabels[chartId] !== false;
    const btn = document.querySelector(`button[onclick="asToggleLabels('${chartId}')"]`);
    if (btn) {
        btn.textContent = showNow ? '🏷️ إخفاء القيم' : '🏷️ إظهار القيم';
        btn.style.color  = showNow ? '#1a73e8' : '#9aa0a6';
    }
};

// ════════════════════════════════════════════════════════
//  🖨️  الطباعة — نافذة طباعة مخصصة (الأكثر موثوقية)
// ════════════════════════════════════════════════════════
window.asPrint = function() {
    // 1. التقاط الرسوم البيانية كصور PNG قبل أي تغيير
    const imgs = {}, titles = {};
    document.querySelectorAll('#as-canvas canvas').forEach(cv => {
        try {
            if (cv.width > 0 && cv.height > 0) {
                imgs[cv.id]   = cv.toDataURL('image/png', 1.0);
                const titleEl = cv.closest('.as-card')?.querySelector('.as-card-title span, .as-card-title');
                titles[cv.id] = (titleEl?.textContent||'').replace(/[🏷️📊📈🍩]/g,'').trim() || cv.id;
            }
        } catch(e) { console.warn('Canvas:', cv.id, e); }
    });

    // 2. التقاط بطاقات KPI
    const kpiData = [];
    document.querySelectorAll('#as-scorecards .as-kpi-card').forEach(c => {
        kpiData.push({
            lbl:   c.querySelector('.as-kpi-lbl')?.textContent || '',
            val:   c.querySelector('.as-kpi-val')?.textContent || '',
            color: c.querySelector('.as-kpi-val')?.style?.color || '#1a73e8'
        });
    });

    // 3. التقاط الجدول
    const tableHtml = document.getElementById('as-data-grid')?.innerHTML || '';

    // 4. معلومات الفترة والفلاتر واسم التقرير
    const st = window._asState || {};
    const repName = st.reportName || window._asSharedName || '';

    // الفترة الزمنية
    const dateLine = [
        st.fromDate ? `من: ${st.fromDate}` : '',
        st.toDate   ? `إلى: ${st.toDate}`  : ''
    ].filter(Boolean).join('  →  ');

    // المشروع: من الاسم المحفوظ أو من قائمة المشاريع
    const projName = st.savedProjectName
        || (st.projectId && window.projects?.[st.projectId]?.name)
        || '';

    // الفلاتر المُطبَّقة (السلايسرز)
    const slicers = Object.entries(st.slicers||{});

    // المحور الحالي (البيانات المعروضة)
    const currentAxis = st.configs?.chart1?.axis || '';
    const currentVal  = st.configs?.chart1?.value || '';

    // بناء قسم معلومات الرأس
    const filterLine  = [...(dateLine?[dateLine]:[]), ...(projName?[projName]:[]),
                         ...slicers.map(([c,v])=>`${c} = ${v}`)].join('  ·  ');

    // 5. بناء HTML الطباعة
    const kpiHtml = kpiData.map(k => `
        <div style="border:1px solid #ddd;border-radius:8px;padding:14px 10px;text-align:center;border-top:4px solid ${k.color}">
            <div style="font-size:10px;color:#70757a;font-weight:700;margin-bottom:6px">${k.lbl}</div>
            <div style="font-size:20px;font-weight:900;color:${k.color}">${k.val}</div>
        </div>`).join('');

    const chartsHtml = Object.entries(imgs).map(([id, src]) =>
        `<div style="page-break-inside:avoid;border:1px solid #e8eaed;border-radius:8px;padding:16px">
            <div style="font-size:12px;font-weight:700;color:#3c4043;margin-bottom:10px">${titles[id]||''}</div>
            <img src="${src}" style="width:100%;height:auto;display:block">
        </div>`
    ).join('');

    // 6. فتح نافذة الطباعة
    const pw = window.open('', '_blank', 'width=1050,height=820,scrollbars=yes');
    if (!pw) { toast('⚠️ افتح النافذة المنبثقة — اضغط "السماح" في المتصفح', 'er', 6000); return; }

    // بناء قسم الفلاتر HTML
    const filtersSection = slicers.length ? `
        <div style="background:#f8f9fa;border-radius:8px;padding:12px 16px;margin-top:12px;border:1px solid #e8eaed">
            <div style="font-size:10px;font-weight:800;color:#5f6368;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">🔍 الفلاتر المُطبَّقة</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${slicers.map(([c,v])=>`
                    <span style="background:#e8f0fe;color:#1a73e8;border:1px solid #c5d8f6;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700">
                        ${c} = ${v}
                    </span>`).join('')}
            </div>
        </div>` : '';

    // بناء قسم البيانات المعروضة
    const axisSection = currentAxis ? `
        <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap">
            ${currentAxis ? `<span style="font-size:11px;color:#3c4043"><strong style="color:#188038">📐 البيانات المعروضة:</strong> ${currentAxis}</span>` : ''}
            ${currentVal  ? `<span style="font-size:11px;color:#3c4043"><strong style="color:#1a73e8">∑ القيمة:</strong> ${currentVal}</span>` : ''}
            ${projName    ? `<span style="font-size:11px;color:#3c4043"><strong style="color:#8e44ad">📁 المشروع:</strong> ${projName}</span>` : ''}
        </div>` : '';

    pw.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${repName||'تقرير تحليلات GBR'} — ${new Date().toLocaleDateString('ar-SA')}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;background:#f1f3f4;color:#202124}
.wrap{max-width:1050px;margin:0 auto;background:#fff;padding:32px}
.hd{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;margin-bottom:20px;padding-bottom:20px;border-bottom:3px solid #1a73e8}
.hd h1{font-size:22px;font-weight:900;color:#1a73e8;margin-bottom:4px}
.hd .rep-name{font-size:14px;font-weight:800;color:#202124;background:#e8f0fe;display:inline-block;padding:4px 12px;border-radius:4px;margin-bottom:8px}
.hd .dates{font-size:12px;color:#5f6368;margin-top:6px}
.hd .dt-box{text-align:left;font-size:11px;color:#9aa0a6;min-width:90px}
.sec-t{font-size:13px;font-weight:800;color:#3c4043;margin:20px 0 12px;padding:6px 0;border-bottom:2px solid #f1f3f4}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px}
.charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#f8f9fa;padding:8px;text-align:right;border:1px solid #ddd;font-weight:700}
td{padding:7px 8px;border:1px solid #eee}
tr:nth-child(even)td{background:#fafafa}
.toolbar{display:flex;gap:10px;justify-content:center;padding:14px;background:#fff;border-bottom:1px solid #eee;position:sticky;top:0;z-index:99}
.tbtn{padding:9px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit}
@media print{
  .toolbar{display:none!important}
  body{background:#fff}
  .wrap{padding:16px;max-width:100%}
  .charts-grid{grid-template-columns:1fr 1fr}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}
</style>
</head>
<body>
<div class="toolbar">
    <button class="tbtn" style="background:#1a73e8;color:#fff" onclick="window.print()">🖨️ طباعة</button>
    <button class="tbtn" style="background:#f1f3f4;color:#3c4043;border:1px solid #dadce0" onclick="window.close()">✕ إغلاق</button>
</div>
<div class="wrap">
    <!-- رأس التقرير -->
    <div class="hd">
        <div>
            ${repName ? `<div class="rep-name">📋 ${repName}</div>` : ''}
            <h1>📊 تقرير تحليلات GBR الذكي</h1>
            ${dateLine ? `<div class="dates">📅 ${dateLine}</div>` : ''}
            ${axisSection}
            ${filtersSection}
        </div>
        <div class="dt-box">
            <div style="font-weight:700;font-size:12px">${new Date().toLocaleDateString('ar-SA',{year:'numeric',month:'long',day:'numeric'})}</div>
            <div style="margin-top:2px">${new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
    </div>

    ${kpiData.length  ? `<div class="sec-t">📌 مؤشرات الأداء الرئيسية</div><div class="kpi-grid">${kpiHtml}</div>` : ''}
    ${chartsHtml      ? `<div class="sec-t">📊 الرسوم البيانية</div><div class="charts-grid">${chartsHtml}</div>` : ''}
    ${tableHtml       ? `<div class="sec-t">📄 البيانات التفصيلية</div><div style="overflow-x:auto">${tableHtml}</div>` : ''}
    ${!kpiData.length && !chartsHtml && !tableHtml ? `<div style="text-align:center;padding:60px;color:#9aa0a6"><div style="font-size:40px;margin-bottom:12px">📭</div>لا توجد بيانات مرئية للطباعة<br><small>تأكد من تحميل البيانات أولاً</small></div>` : ''}
</div>
</body>
</html>`);
    pw.document.close();
    pw.focus();
};

// ════════════════════════════════════════════════════════
//  💾  حفظ التقارير وإدارتها — Firebase CRUD
// ════════════════════════════════════════════════════════

// ── مساعدات المودال ──────────────────────────────────────
function asShowModal(id, html) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.className = 'as-modal-overlay';
        el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
        document.body.appendChild(el);
    }
    el.innerHTML = html;
    el.style.display = 'flex';
}
window.asCloseModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
};

// ── CSS مشترك للمودالات ──────────────────────────────────
const AS_MODAL_CSS = `
<style>
.as-m { background:#fff;border-radius:12px;width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.25);font-family:'Segoe UI',Arial,sans-serif;direction:rtl; }
.as-m-hd { display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #e8eaed;font-size:16px;font-weight:800;color:#202124; }
.as-m-bd { padding:20px;overflow-y:auto;flex:1; }
.as-m-ft { padding:14px 20px;border-top:1px solid #e8eaed;display:flex;gap:8px;justify-content:flex-end; }
.as-m input,.as-m textarea,.as-m select { width:100%;padding:9px 12px;border:1px solid #dadce0;border-radius:6px;font-family:inherit;font-size:13px;outline:none;color:#202124;box-sizing:border-box; }
.as-m input:focus,.as-m textarea:focus,.as-m select:focus { border-color:#1a73e8;box-shadow:0 0 0 2px #1a73e822; }
.as-m textarea { min-height:80px;resize:vertical; }
.as-m label { font-size:11px;font-weight:700;color:#5f6368;display:block;margin-bottom:5px; }
.as-m .as-m-group { margin-bottom:14px; }
.as-m-btn { padding:8px 18px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit; }
.as-m-btn.prim { background:#1a73e8;color:#fff; }
.as-m-btn.success { background:#188038;color:#fff; }
.as-m-btn.danger { background:#d93025;color:#fff; }
.as-m-btn.sec { background:#f1f3f4;color:#3c4043;border:1px solid #dadce0; }
.as-rep-item { border:1px solid #e8eaed;border-radius:8px;padding:14px 16px;margin-bottom:10px;transition:.15s; }
.as-rep-item:hover { border-color:#1a73e8;background:#f8faff; }
.as-rep-name { font-size:14px;font-weight:700;color:#202124;margin-bottom:4px; }
.as-rep-meta { font-size:11px;color:#70757a;margin-bottom:8px; }
.as-rep-actions { display:flex;gap:6px;flex-wrap:wrap; }
.as-rep-tag { font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700; }
.as-url-box { background:#f8f9fa;border:1px solid #dadce0;border-radius:6px;padding:8px 12px;font-size:11px;color:#1a73e8;word-break:break-all;margin-top:8px;display:none; }
</style>`;

// ── فتح مودال الحفظ ───────────────────────────────────────
window.asSaveReport = function(editKey, editName, editNotes, editProject) {
    window._asEditingReportKey = editKey || null;

    // قائمة المشاريع المتاحة
    const projs = Object.entries(window.projects || {});
    const curProjId   = window._asState.projectId || '';
    const curProjName = curProjId && window.projects?.[curProjId]
        ? window.projects[curProjId].name : '';
    // القيمة الافتراضية: المشروع المحفوظ أو المشروع الحالي
    const defaultProj = editProject || curProjName || '';

    asShowModal('as-save-modal', `
    ${AS_MODAL_CSS}
    <style>
        .as-req-star { color:#d93025; margin-right:2px; }
        .as-field-err { border-color:#d93025 !important; box-shadow:0 0 0 2px #d9302522 !important; }
    </style>
    <div class="as-m" onclick="event.stopPropagation()">
        <div class="as-m-hd">
            <span>${editKey ? '✏️ تعديل التقرير' : '💾 حفظ التقرير'}</span>
            <button onclick="asCloseModal('as-save-modal')" style="background:none;border:none;font-size:20px;cursor:pointer;color:#5f6368">✕</button>
        </div>
        <div class="as-m-bd">

            <!-- اسم المشروع — إجباري -->
            <div class="as-m-group">
                <label><span class="as-req-star">*</span> اسم المشروع</label>
                <select id="asRProject" onchange="asRpProjChange(this)"
                    style="border:1.5px solid #dadce0;border-radius:6px;padding:9px 12px;width:100%;font-family:inherit;font-size:13px;background:#fff;outline:none;cursor:pointer">
                    <option value="">-- اختر المشروع --</option>
                    ${projs.map(([k,p])=>`
                        <option value="${p.name}" ${p.name===defaultProj?'selected':''}>${p.name}</option>
                    `).join('')}
                    <option value="__custom__">✏️ أدخل اسماً مخصصاً...</option>
                </select>
                <input id="asRProjectCustom"
                    placeholder="اكتب اسم المشروع هنا..."
                    value="${!projs.some(([,p])=>p.name===defaultProj) && defaultProj ? defaultProj : ''}"
                    style="display:${!projs.some(([,p])=>p.name===defaultProj) && defaultProj ? 'block' : 'none'};
                           margin-top:8px;width:100%;padding:9px 12px;border:1.5px solid #1a73e8;
                           border-radius:6px;font-family:inherit;font-size:13px;outline:none">
            </div>

            <!-- اسم التقرير — إجباري -->
            <div class="as-m-group">
                <label><span class="as-req-star">*</span> اسم التقرير</label>
                <input id="asRN" placeholder="مثال: تقرير الرواتب — مايو 2025" value="${editName||''}">
            </div>

            <!-- ملاحظات -->
            <div class="as-m-group">
                <label>ملاحظات (اختياري)</label>
                <textarea id="asRNotes" placeholder="أضف أي ملاحظات أو تعليقات...">${editNotes||''}</textarea>
            </div>

            ${!editKey ? `<div style="background:#e8f5e9;border-radius:6px;padding:10px 14px;font-size:11px;color:#1b5e20">
                <strong>✅ ما سيتم حفظه:</strong> اسم المشروع، الفترة الزمنية، الفلاتر، إعدادات الرسوم، مسار الحفر الهرمي
            </div>` : ''}
        </div>
        <div class="as-m-ft">
            <button class="as-m-btn sec" onclick="asCloseModal('as-save-modal')">إلغاء</button>
            <button class="as-m-btn success" onclick="asDoSaveReport()">${editKey ? '💾 تحديث' : '💾 حفظ'}</button>
        </div>
    </div>`);
};

// تبديل عرض الحقل المخصص عند اختيار "أدخل اسماً مخصصاً"
window.asRpProjChange = function(sel) {
    const custom = document.getElementById('asRProjectCustom');
    if (!custom) return;
    if (sel.value === '__custom__') {
        custom.style.display = 'block';
        custom.focus();
    } else {
        custom.style.display = 'none';
        custom.value = '';
    }
};

// ── تنفيذ الحفظ في Firebase ───────────────────────────────
window.asDoSaveReport = async function() {
    // ── قراءة الحقول ──
    const projSel    = document.getElementById('asRProject');
    const projCustom = document.getElementById('asRProjectCustom');
    const projectName = projSel?.value === '__custom__'
        ? (projCustom?.value?.trim() || '')
        : (projSel?.value?.trim() || '');

    const name  = document.getElementById('asRN')?.value?.trim();
    const notes = document.getElementById('asRNotes')?.value?.trim() || '';

    // ── التحقق الإجباري ──
    let valid = true;
    if (!projectName) {
        projSel?.classList.add('as-field-err');
        toast('⚠️ اسم المشروع مطلوب', 'er');
        valid = false;
    } else {
        projSel?.classList.remove('as-field-err');
    }
    if (!name) {
        document.getElementById('asRN')?.classList.add('as-field-err');
        toast('⚠️ اسم التقرير مطلوب', 'er');
        valid = false;
    } else {
        document.getElementById('asRN')?.classList.remove('as-field-err');
    }
    if (!valid) return;

    const state = window._asState;

    // لقطة بيانات الرسوم
    const snap = {};
    ['chart1','chart2','chart3'].forEach(id => {
        const ch = state.charts[id];
        if (ch?.data) snap[id] = { labels: ch.data.labels || [], values: ch.data.datasets?.[0]?.data || [] };
    });

    const payload = {
        name, notes, projectName,
        createdAt: new Date().toISOString(),
        createdBy: window.curU?.uid || 'unknown',
        createdByName: window.myP?.name || window.curU?.email || 'مستخدم',
        fromDate: state.fromDate, toDate: state.toDate,
        projectId: state.projectId, dataSource: state.dataSource,
        activePage: state.activePage,
        slicers:     JSON.stringify(state.slicers||{}),
        chartLabels: JSON.stringify(state.chartLabels||{}),
        configs:     JSON.stringify({
            chart1: { axis:state.configs.chart1.axis, value:state.configs.chart1.value, type:state.configs.chart1.type, title:state.configs.chart1.title },
            chart2: { axis:state.configs.chart2.axis, value:state.configs.chart2.value, type:state.configs.chart2.type, title:state.configs.chart2.title },
            chart3: { axis:state.configs.chart3.axis, value:state.configs.chart3.value, type:state.configs.chart3.type, title:state.configs.chart3.title }
        }),
        snap: JSON.stringify(snap),
        isShared: false, shareToken: '', sharePermission: 'view'
    };

    try {
        const editKey = window._asEditingReportKey;
        if (editKey) {
            await window.update(window.ref(window.db, `ledger/savedAnalytics/${editKey}`), {
                name, notes, projectName, updatedAt: new Date().toISOString()
            });
            toast('✅ تم تحديث التقرير', 'ok');
        } else {
            const nr = await window.push(window.ref(window.db, 'ledger/savedAnalytics'), payload);
            await window.update(nr, { id: nr.key });
            toast('✅ تم حفظ التقرير', 'ok');
        }
        window._asState.reportName       = name;
        window._asState.savedProjectName = projectName;
        asCloseModal('as-save-modal');
        window._asEditingReportKey = null;
    } catch(e) {
        console.error(e);
        toast('❌ خطأ في الحفظ — تحقق من الاتصال', 'er');
    }
};

// ── صفحة إدارة التقارير الكاملة ────────────────────────────
window.asOpenReportsPage = function() {
    const pg = $('pg-analytics');
    if (!pg) return;
    pg.innerHTML = `
    <style>
        .rp-page { display:flex;flex-direction:column;height:100%;background:#f1f3f4;font-family:'Segoe UI',Arial,sans-serif;direction:rtl; }
        .rp-topbar { background:#fff;border-bottom:1px solid #dadce0;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,.08); }
        .rp-body { flex:1;overflow-y:auto;padding:24px; }
        .rp-card { background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(60,64,67,.12);border:1px solid #dadce0;padding:20px;margin-bottom:14px;transition:.15s; }
        .rp-card:hover { box-shadow:0 2px 8px rgba(60,64,67,.2);border-color:#1a73e8; }
        .rp-name { font-size:15px;font-weight:800;color:#202124;margin-bottom:6px; }
        .rp-meta { font-size:11px;color:#70757a;line-height:1.6; }
        .rp-notes { font-size:12px;color:#5f6368;font-style:italic;margin-top:6px;padding:6px 10px;background:#f8f9fa;border-radius:4px;border-right:3px solid #1a73e8; }
        .rp-actions { display:flex;gap:6px;margin-top:12px;flex-wrap:wrap; }
        .rp-btn { padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;transition:.15s; }
        .rp-btn:hover { opacity:.85; }
        .rp-tag { font-size:10px;padding:3px 10px;border-radius:10px;font-weight:700;display:inline-flex;align-items:center;gap:4px; }
        .rp-share-panel { background:#f8f9fa;border:1px solid #e8eaed;border-radius:8px;padding:16px;margin-top:12px;display:none; }
        .rp-search { width:100%;padding:10px 16px;border:1.5px solid #dadce0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#f8f9fa;color:#202124; }
        .rp-search:focus { border-color:#1a73e8;background:#fff; }
        .rp-empty { text-align:center;padding:60px 20px;color:#9aa0a6; }
        .rp-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:16px; }
        .rp-stats { display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px; }
        .rp-stat-card { background:#fff;border-radius:8px;padding:14px 16px;text-align:center;border:1px solid #dadce0;box-shadow:0 1px 2px rgba(0,0,0,.06); }
        .rp-stat-val { font-size:28px;font-weight:900;margin-bottom:4px; }
        .rp-stat-lbl { font-size:11px;color:#70757a;font-weight:700; }
    </style>
    <div class="rp-page">
        <!-- الشريط العلوي -->
        <div class="rp-topbar">
            <div style="display:flex;align-items:center;gap:12px">
                <button onclick="renderAnalytics()" style="background:none;border:1px solid #dadce0;border-radius:6px;padding:7px 12px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;color:#3c4043">
                    ← <span style="font-size:12px;font-weight:600">العودة للتحليل</span>
                </button>
                <div>
                    <div style="font-size:16px;font-weight:800;color:#202124">📋 إدارة التقارير المحفوظة</div>
                    <div style="font-size:11px;color:#70757a">عرض وإدارة ومشاركة تقارير التحليل</div>
                </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                <select id="rp-filter-src" class="as-select" onchange="asRpApplyFilters()" style="font-size:12px">
                    <option value="">كل المصادر</option>
                    <option value="system">🖥️ بيانات النظام</option>
                    <option value="file">📁 ملف خارجي</option>
                </select>
                <select id="rp-filter-share" class="as-select" onchange="asRpApplyFilters()" style="font-size:12px">
                    <option value="">كل الحالات</option>
                    <option value="shared">🔗 مشترك</option>
                    <option value="private">🔒 خاص</option>
                </select>
                <button onclick="asSaveReport()" style="background:#188038;color:#fff;padding:7px 14px;border-radius:6px;border:none;font-size:12px;font-weight:700;cursor:pointer">
                    💾 حفظ تقرير جديد
                </button>
            </div>
        </div>

        <div class="rp-body">
            <!-- شريط البحث -->
            <div style="margin-bottom:20px;position:relative">
                <input class="rp-search" id="rp-search" placeholder="🔍  ابحث بالاسم أو الملاحظات أو المنشئ..." oninput="asRpApplyFilters()">
            </div>

            <!-- إحصائيات سريعة -->
            <div class="rp-stats" id="rp-stats">
                <div class="rp-stat-card"><div class="rp-stat-val" style="color:#1a73e8">...</div><div class="rp-stat-lbl">إجمالي التقارير</div></div>
                <div class="rp-stat-card"><div class="rp-stat-val" style="color:#188038">...</div><div class="rp-stat-lbl">المشتركة</div></div>
                <div class="rp-stat-card"><div class="rp-stat-val" style="color:#e37400">...</div><div class="rp-stat-lbl">هذا الشهر</div></div>
            </div>

            <!-- قائمة التقارير -->
            <div class="rp-grid" id="rp-grid">
                <div class="rp-empty"><div style="font-size:40px;margin-bottom:12px">⏳</div>جاري تحميل التقارير...</div>
            </div>
        </div>
    </div>`;

    asRpLoadAll();
};

// ── تحميل كل التقارير من Firebase ───────────────────────
window._asAllReports = {};

window.asRpLoadAll = async function() {
    try {
        const sn  = await window.get(window.ref(window.db, 'ledger/savedAnalytics'));
        window._asAllReports = sn.exists() ? sn.val() : {};
        asRpApplyFilters();
    } catch(e) {
        const g = document.getElementById('rp-grid');
        if (g) g.innerHTML = `<div class="rp-empty"><div style="font-size:36px">❌</div>خطأ في التحميل: ${e.message}</div>`;
    }
};

window.asRpApplyFilters = function() {
    const q      = (document.getElementById('rp-search')?.value || '').toLowerCase();
    const src    = document.getElementById('rp-filter-src')?.value  || '';
    const share  = document.getElementById('rp-filter-share')?.value || '';
    const uid    = window.curU?.uid || '';
    const isAdmin= window.myP?.role === 'admin';
    const canShr = isAdmin || window.myP?.role === 'finance_manager' || (window.myP?.permissions||[]).includes('share_analytics');

    const all = Object.entries(window._asAllReports);

    // فلترة الصلاحية
    let list = all.filter(([, r]) => r.createdBy === uid || isAdmin || r.createdBy === 'unknown');

    // فلاتر البحث والحالة
    list = list.filter(([, r]) => {
        const matchQ     = !q || (r.name||'').toLowerCase().includes(q) || (r.notes||'').toLowerCase().includes(q) || (r.createdByName||'').toLowerCase().includes(q) || (r.projectName||'').toLowerCase().includes(q);
        const matchSrc   = !src   || r.dataSource === src;
        const matchShare = !share || (share==='shared'? r.isShared : !r.isShared);
        return matchQ && matchSrc && matchShare;
    }).sort(([, a], [, b]) => new Date(b.createdAt||0) - new Date(a.createdAt||0));

    // إحصائيات
    const statsEl = document.getElementById('rp-stats');
    if (statsEl) {
        const thisMonth = new Date().toISOString().slice(0,7);
        const shared  = all.filter(([,r])=>r.isShared).length;
        const monthly = all.filter(([,r])=>(r.createdAt||'').startsWith(thisMonth)).length;
        statsEl.innerHTML = `
            <div class="rp-stat-card"><div class="rp-stat-val" style="color:#1a73e8">${all.length}</div><div class="rp-stat-lbl">إجمالي التقارير</div></div>
            <div class="rp-stat-card"><div class="rp-stat-val" style="color:#188038">${shared}</div><div class="rp-stat-lbl">🔗 المشتركة</div></div>
            <div class="rp-stat-card"><div class="rp-stat-val" style="color:#e37400">${monthly}</div><div class="rp-stat-lbl">هذا الشهر</div></div>
            <div class="rp-stat-card"><div class="rp-stat-val" style="color:#8e44ad">${list.length}</div><div class="rp-stat-lbl">نتائج البحث</div></div>`;
    }

    // عرض القائمة
    const grid = document.getElementById('rp-grid');
    if (!grid) return;

    if (list.length === 0) {
        grid.innerHTML = `<div class="rp-empty" style="grid-column:1/-1">
            <div style="font-size:44px;margin-bottom:12px">📭</div>
            <div style="font-size:14px;font-weight:700">${q ? `لا توجد نتائج لـ "${q}"` : 'لا توجد تقارير محفوظة بعد'}</div>
            ${!q ? `<button onclick="asSaveReport()" style="margin-top:16px;padding:10px 20px;background:#188038;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700">💾 احفظ تقريرك الأول</button>` : ''}
        </div>`;
        return;
    }

    grid.innerHTML = list.map(([key, r]) => {
        const dt     = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'}) : '—';
        const tm     = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}) : '';
        const isShrd = r.isShared && r.shareToken;
        const srcIcon= r.dataSource==='file' ? '📁' : '🖥️';
        const perm   = r.sharePermission === 'edit' ? '✏️ تعديل' : '👁️ عرض';
        const safeN  = (r.name       ||'').replace(/`/g,'').replace(/'/g,"\\'");
        const safeNt = (r.notes      ||'').replace(/`/g,'').replace(/'/g,"\\'");
        const safePr = (r.projectName||'').replace(/`/g,'').replace(/'/g,"\\'");

        return `<div class="rp-card" id="rpc-${key}">
            ${r.projectName ? `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f1f3f4">
                <span style="font-size:11px;background:#fef7e0;color:#7d4e00;padding:3px 10px;border-radius:20px;font-weight:800;border:1px solid #f4b400">
                    🏗️ ${r.projectName}
                </span>
            </div>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
                <div style="flex:1">
                    <div class="rp-name">📋 ${r.name||'بدون اسم'}</div>
                    <div class="rp-meta">
                        👤 ${r.createdByName||'—'} &nbsp;·&nbsp; 📅 ${dt} ${tm}
                        &nbsp;·&nbsp; ${srcIcon} ${r.dataSource==='file'?'ملف':'نظام'}
                        ${r.fromDate ? `&nbsp;·&nbsp; 📆 ${r.fromDate} → ${r.toDate||''}` : ''}
                    </div>
                    ${r.notes ? `<div class="rp-notes">${r.notes}</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
                    ${isShrd ? `<span class="rp-tag" style="background:#e8f5e9;color:#1b5e20">🔗 مشترك · ${perm}</span>` : `<span class="rp-tag" style="background:#f1f3f4;color:#5f6368">🔒 خاص</span>`}
                </div>
            </div>

            <div class="rp-actions">
                <button class="rp-btn" onclick="asLoadReport('${key}')" style="background:#1a73e8;color:#fff">📂 تحميل وعرض</button>
                <button class="rp-btn" onclick="asSaveReport('${key}','${safeN}','${safeNt}','${safePr}')" style="background:#f1f3f4;color:#3c4043;border:1px solid #dadce0">✏️ تعديل</button>
                ${canShr ? `<button class="rp-btn" onclick="asRpToggleShare('${key}')" style="background:#f3e5f5;color:#7b1fa2;border:1px solid #ce93d8">🔗 مشاركة</button>` : ''}
                <button class="rp-btn" onclick="asDeleteReport('${key}','${safeN}')" style="background:#fce8e6;color:#c5221f;border:1px solid #f5a9a7">🗑️</button>
            </div>

            <!-- لوحة المشاركة -->
            <div class="rp-share-panel" id="rsp-${key}">
                <div style="font-size:12px;font-weight:800;color:#7b1fa2;margin-bottom:12px">🔗 إعدادات المشاركة</div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
                    <label style="font-size:11px;font-weight:700;color:#5f6368;white-space:nowrap">الصلاحية الممنوحة:</label>
                    <select id="sp-${key}" style="flex:1;min-width:140px;padding:6px 10px;border:1px solid #dadce0;border-radius:6px;font-family:inherit;font-size:12px">
                        <option value="view" ${r.sharePermission!=='edit'?'selected':''}>👁️ مشاهدة فقط</option>
                        <option value="edit" ${r.sharePermission==='edit'?'selected':''}>✏️ مشاهدة وتعديل</option>
                    </select>
                    <button class="rp-btn" onclick="asCreateShareLink('${key}')" style="background:#7b1fa2;color:#fff">✨ إنشاء رابط</button>
                    ${isShrd ? `<button class="rp-btn" onclick="asRevokeShare('${key}')" style="background:#fce8e6;color:#c5221f;border:1px solid #f5a9a7">إلغاء المشاركة</button>` : ''}
                </div>
                ${isShrd ? `
                <div>
                    <label style="font-size:11px;font-weight:700;color:#5f6368">الرابط الحالي:</label>
                    <div style="display:flex;gap:6px;margin-top:6px">
                        <input id="share-url-${key}" readonly value="${location.origin}${location.pathname}?analyticsReport=${key}&token=${r.shareToken||''}"
                            style="flex:1;padding:7px 10px;border:1px solid #dadce0;border-radius:6px;font-size:11px;color:#1a73e8;background:#f8f9fa;direction:ltr">
                        <button class="rp-btn" onclick="asCopyUrl('share-url-${key}')" style="background:#f1f3f4;border:1px solid #dadce0;color:#3c4043">📋 نسخ</button>
                    </div>
                </div>` : `<div id="share-url-${key}" style="display:none"></div>`}
            </div>
        </div>`;
    }).join('');
};

window.asRpToggleShare = function(key) {
    const el = document.getElementById(`rsp-${key}`);
    if (el) el.style.display = el.style.display === 'none' || !el.style.display ? 'block' : 'none';
};

// ── تحميل تقرير محفوظ ────────────────────────────────────
window.asLoadReport = async function(key) {
    try {
        const sn = await window.get(window.ref(window.db, `ledger/savedAnalytics/${key}`));
        if (!sn.exists()) { toast('⚠️ التقرير غير موجود', 'er'); return; }
        const r = sn.val();
        const state = window._asState;

        state.fromDate    = r.fromDate || '';
        state.toDate      = r.toDate   || '';
        state.projectId   = r.projectId || '';
        state.activePage  = r.activePage || 1;
        state.slicers     = JSON.parse(r.slicers     || '{}');
        state.chartLabels = JSON.parse(r.chartLabels || '{}');
        const cfgs = JSON.parse(r.configs || '{}');
        ['chart1','chart2','chart3'].forEach(id => {
            if (cfgs[id]) Object.assign(state.configs[id], cfgs[id]);
        });

        // إذا كان التقرير من ملف ولا يوجد uploadedData حالي → استخدم اللقطة
        if (r.dataSource === 'file') {
            const snap = JSON.parse(r.snap || '{}');
            if (Object.keys(snap).length && !state.uploadedData) {
                state.dataSource = 'snapshot';
                state.snapData   = snap;
            } else {
                state.dataSource = 'file'; // إذا كان الملف محمّلاً مسبقاً نستخدمه
            }
        } else {
            state.dataSource = r.dataSource || 'system';
        }

        state.reportName       = r.name;
        state.savedProjectName = r.projectName || '';
        asCloseModal('as-rep-modal');
        toast(`✅ تم تحميل: ${r.name}`, 'ok');
        renderAnalytics();
    } catch(e) {
        console.error(e);
        toast('❌ خطأ في تحميل التقرير', 'er');
    }
};

// ── حذف تقرير ────────────────────────────────────────────
window.asDeleteReport = function(key, name) {
    if (!confirm(`هل تريد حذف التقرير:\n"${name}"؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
    window.remove(window.ref(window.db, `ledger/savedAnalytics/${key}`))
        .then(() => {
            toast('✅ تم حذف التقرير', 'ok');
            // إزالة من الكاش وتحديث العرض
            delete window._asAllReports[key];
            const card = document.getElementById(`rpc-${key}`) || document.getElementById(`rep-${key}`);
            if (card) { card.style.opacity='0'; card.style.transition='.3s'; setTimeout(()=>card.remove(), 300); }
            if (typeof asRpApplyFilters === 'function') asRpApplyFilters();
        })
        .catch(() => toast('❌ خطأ في الحذف', 'er'));
};

// ════════════════════════════════════════════════════════
//  🔗  مشاركة التقارير
// ════════════════════════════════════════════════════════

window.asToggleSharePanel = function(key) {
    const panel = document.getElementById(`share-panel-${key}`);
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

window.asCreateShareLink = async function(key) {
    const perm  = document.getElementById(`sp-${key}`)?.value || document.getElementById(`share-perm-${key}`)?.value || 'view';
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const url   = `${location.origin}${location.pathname}?analyticsReport=${key}&token=${token}`;

    const btn = document.querySelector(`#rsp-${key} button[onclick="asCreateShareLink('${key}')"]`);
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

    try {
        await window.update(window.ref(window.db, `ledger/savedAnalytics/${key}`), {
            isShared: true, shareToken: token, sharePermission: perm
        });

        // تحديث الكاش
        if (window._asAllReports[key]) {
            window._asAllReports[key].isShared    = true;
            window._asAllReports[key].shareToken   = token;
            window._asAllReports[key].sharePermission = perm;
        }

        // عرض حقل الرابط مباشرة في اللوحة دون إعادة تحميل
        const panel = document.getElementById(`rsp-${key}`);
        if (panel) {
            // حذف أي حقل رابط قديم وأضف الجديد
            let urlBox = document.getElementById(`share-url-${key}`);
            if (!urlBox || urlBox.tagName !== 'INPUT') {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'margin-top:12px';
                wrapper.innerHTML = `
                    <label style="font-size:11px;font-weight:700;color:#5f6368">الرابط — انسخه وأرسله:</label>
                    <div style="display:flex;gap:6px;margin-top:6px">
                        <input id="share-url-${key}" readonly value="${url}"
                            style="flex:1;padding:8px 12px;border:2px solid #7b1fa2;border-radius:6px;font-size:11px;color:#7b1fa2;background:#f3e5f5;direction:ltr;font-weight:700">
                        <button class="rp-btn" onclick="asCopyUrl('share-url-${key}')"
                            style="background:#7b1fa2;color:#fff;white-space:nowrap">📋 نسخ الرابط</button>
                    </div>`;
                if (urlBox) urlBox.replaceWith(wrapper);
                else panel.appendChild(wrapper);
            } else {
                urlBox.value = url;
            }
        }

        toast('✅ تم إنشاء الرابط — انسخه من الحقل البنفسجي', 'ok', 6000);
    } catch(e) {
        console.error(e);
        toast('❌ خطأ في إنشاء الرابط', 'er');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '✨ إنشاء رابط'; }
    }
};

window.asRevokeShare = async function(key) {
    if (!confirm('هل تريد إلغاء مشاركة هذا التقرير؟\nسيتوقف الرابط عن العمل.')) return;
    try {
        await window.update(window.ref(window.db, `ledger/savedAnalytics/${key}`), { isShared: false, shareToken: '' });
        toast('✅ تم إلغاء المشاركة', 'ok');
        asShowSavedReports();
    } catch(e) { toast('❌ خطأ', 'er'); }
};

window.asCopyUrl = function(inputId) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    navigator.clipboard?.writeText(inp.value)
        .then(() => toast('✅ تم نسخ الرابط', 'ok'))
        .catch(() => { inp.select(); document.execCommand('copy'); toast('✅ تم نسخ الرابط', 'ok'); });
};

// ── فتح تقرير مشترك عبر URL ──────────────────────────────
window.asCheckSharedReport = async function() {
    const p   = new URLSearchParams(location.search);
    const key = p.get('analyticsReport');
    const tok = p.get('token');
    if (!key || !tok) return false;

    try {
        const sn = await window.get(window.ref(window.db, `ledger/savedAnalytics/${key}`));
        if (!sn.exists()) { toast('⚠️ التقرير غير موجود أو انتهت صلاحيته', 'er'); return false; }
        const r = sn.val();
        if (!r.isShared || r.shareToken !== tok) { toast('⚠️ رابط المشاركة غير صالح', 'er'); return false; }

        // تطبيق الحالة
        const state = window._asState;
        state.fromDate   = r.fromDate || '';
        state.toDate     = r.toDate   || '';
        state.projectId  = r.projectId || '';
        state.dataSource = r.dataSource || 'system';
        state.activePage = r.activePage || 1;
        state.slicers    = JSON.parse(r.slicers     || '{}');
        state.chartLabels= JSON.parse(r.chartLabels || '{}');
        const cfgs = JSON.parse(r.configs || '{}');
        ['chart1','chart2','chart3'].forEach(id => { if (cfgs[id]) Object.assign(state.configs[id], cfgs[id]); });

        // تعيين وضع المشاركة
        window._asSharedMode      = true;
        window._asSharePermission = r.sharePermission || 'view';
        window._asSharedName      = r.name;
        state.reportName          = r.name;

        // إذا كان التقرير من ملف → استخدم اللقطة المحفوظة
        if (r.dataSource === 'file') {
            const snap = JSON.parse(r.snap || '{}');
            if (Object.keys(snap).length) {
                state.dataSource = 'snapshot';
                state.snapData   = snap;
            }
        }

        // عرض التقرير مباشرة
        renderAnalytics();
        toast(`📋 ${r.name} — ${r.sharePermission==='edit'?'✏️ قراءة وتعديل':'👁️ قراءة فقط'}`, 'ok', 5000);
        return true;
    } catch(e) { console.error(e); return false; }
};

console.log('✅ GBR Analytics Studio 4.0 — Print ✓ | Save/Load ✓ | Share Links ✓');
