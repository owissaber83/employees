// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🎬  العرض التقديمي — بُنيان — للمدير والعملاء                              ║
// ║  شرائح + حركات + عدّادات + مقارنة + ملاحظات مُقدِّم + قفز حيّ للتطبيق          ║
// ║  + تخصيص الغلاف + أسعار + ROI + تصدير PDF                                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

window._present = window._present || { idx: 0, client: '', clientLogo: '', notes: false };

function presCompany() { return (window.gbrCfg && (window.gbrCfg.companyAr || window.gbrCfg.companyEn)) || 'شركتك'; }
function presFmt(v) { return (typeof fmt === 'function') ? fmt(Math.round(v || 0)) : (Math.round(v || 0)).toLocaleString('en'); }
function presStats() {
    const projects = window.projects || {}, emp = window.emp || {}, inv = window.salesInvoices || {}, cust = window.customers || {};
    let contractTotal = 0;
    Object.keys(projects).forEach(k => { try { contractTotal += (window.getProjectContractValue ? window.getProjectContractValue(k) : 0) || 0; } catch (e) { } });
    return { projects: Object.keys(projects).length, employees: Object.values(emp).filter(e => e.active !== false).length, invoices: Object.keys(inv).length, customers: Object.keys(cust).length, contractTotal };
}
// زر «شاهد مباشرة» يقفز للتطبيق
function presDemoBtn(label, page) { return `<button onclick="presJumpTo('${page}')" style="background:rgba(231,76,60,.9);border:none;color:#fff;border-radius:30px;padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px">🔴 ${label}</button>`; }
function presModCard(icon, title, desc, page) {
    return `<div class="pe" onclick="presJumpTo('${page}')" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;text-align:right;cursor:pointer;transition:all .2s;position:relative" onmouseover="this.style.background='rgba(240,196,25,.14)';this.style.borderColor='rgba(240,196,25,.4)'" onmouseout="this.style.background='rgba(255,255,255,.06)';this.style.borderColor='rgba(255,255,255,.12)'">
        <div style="position:absolute;top:10px;left:12px;font-size:12px;opacity:.5">↗ افتح</div>
        <div style="font-size:28px">${icon}</div>
        <div style="font-size:15px;font-weight:800;margin:7px 0 3px">${title}</div>
        <div style="font-size:11.5px;opacity:.72;line-height:1.6">${desc}</div>
    </div>`;
}

const PRES_SLIDES = [
    // 1) الغلاف (قابل للتخصيص باسم العميل)
    () => {
        const cl = window._present.client;
        return `
        <div style="text-align:center">
            ${window._present.clientLogo ? `<img class="pe" src="${window._present.clientLogo}" style="height:64px;margin-bottom:18px;object-fit:contain" onerror="this.style.display='none'">` : ''}
            <div class="pe" style="font-size:13px;letter-spacing:4px;opacity:.65;margin-bottom:22px">CONTRACTING ERP PLATFORM</div>
            <div class="pe" style="width:108px;height:108px;border-radius:26px;background:linear-gradient(135deg,#f0c419,#e67e22);display:flex;align-items:center;justify-content:center;font-size:27px;font-weight:900;margin:0 auto 26px;box-shadow:0 16px 50px rgba(240,196,25,.35)">بُنيان</div>
            <h1 class="pe" style="font-size:clamp(36px,7vw,68px);font-weight:900;margin:0 0 16px;line-height:1.15;letter-spacing:-1px">بُنيان</h1>
            <div class="pe" style="font-size:clamp(17px,3vw,26px);opacity:.92;font-weight:300">منصّة إدارة المقاولات — نظام ERP عربي متكامل</div>
            ${cl ? `<div class="pe" style="margin-top:26px;background:rgba(240,196,25,.14);border:1px solid rgba(240,196,25,.35);border-radius:14px;padding:12px 24px;display:inline-block;font-size:17px;font-weight:700">عرض مُقدَّم خصيصاً لـ: <span style="color:#f0c419">${cl}</span></div>` : ''}
            <div class="pe" style="margin-top:26px;font-size:14px;opacity:.6">${presCompany()} · ${new Date().toLocaleDateString('ar-SA')}</div>
        </div>`;
    },

    // 2) التحدّي
    () => `
        <div style="max-width:940px;margin:0 auto">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:8px">التحدّي</div>
            <h2 class="pe" style="font-size:clamp(26px,4.5vw,44px);font-weight:900;margin:0 0 30px">كيف تدير شركة مقاولات بثقة؟</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
                ${[['📊', 'بيانات متفرّقة', 'محاسبة في برنامج، مشاريع في إكسل — لا صورة موحّدة'], ['💸', 'تكاليف غامضة', 'صعوبة معرفة ربحية كل مشروع بدقة وفي وقتها'], ['⏰', 'مواعيد ضائعة', 'تأخّر المستخلصات، انتهاء الضمانات، تجاوز الجداول'], ['🌐', 'أنظمة معقّدة', 'أودو وأوراكل: مكلفة، إنجليزية، ومعقّدة']].map(([i, t, d]) => `
                    <div class="pe" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:22px;text-align:right">
                        <div style="font-size:36px;margin-bottom:12px">${i}</div><div style="font-size:18px;font-weight:800;margin-bottom:8px">${t}</div><div style="font-size:13px;opacity:.78;line-height:1.8">${d}</div></div>`).join('')}
            </div>
        </div>`,

    // 3) الحل
    () => `
        <div style="text-align:center;max-width:880px;margin:0 auto">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:10px">الحل</div>
            <h2 class="pe" style="font-size:clamp(28px,5vw,48px);font-weight:900;margin:0 0 22px;line-height:1.25">نظام واحد عربي يجمع كل شيء</h2>
            <p class="pe" style="font-size:clamp(16px,2.5vw,22px);opacity:.9;line-height:2;font-weight:300">من <strong>ترسية العقد</strong> إلى <strong>الإقفال النهائي</strong> — المحاسبة والمشاريع والموارد البشرية والمشتريات والمخزون، مترابطة تلقائياً في منصّة سحابية واحدة مصمّمة للمقاول الخليجي.</p>
            <div class="pe" style="margin-top:34px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;font-size:14px;opacity:.85">
                <span style="background:rgba(46,204,113,.18);border:1px solid rgba(46,204,113,.3);border-radius:10px;padding:10px 16px">📜 العقد</span><span style="opacity:.5;align-self:center">←</span>
                <span style="background:rgba(52,152,219,.18);border:1px solid rgba(52,152,219,.3);border-radius:10px;padding:10px 16px">🏗️ التنفيذ</span><span style="opacity:.5;align-self:center">←</span>
                <span style="background:rgba(155,89,182,.18);border:1px solid rgba(155,89,182,.3);border-radius:10px;padding:10px 16px">🧾 الفوترة</span><span style="opacity:.5;align-self:center">←</span>
                <span style="background:rgba(240,196,25,.18);border:1px solid rgba(240,196,25,.3);border-radius:10px;padding:10px 16px">📈 الربحية</span>
            </div>
        </div>`,

    // 4) لماذا نتفوّق
    () => `
        <div style="max-width:1000px;margin:0 auto">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:8px">الميزة التنافسية</div>
            <h2 class="pe" style="font-size:clamp(26px,4.5vw,42px);font-weight:900;margin:0 0 28px">لماذا نتفوّق على أودو وأوراكل؟</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px">
                ${[['🌍', 'عربي / RTL أصيل', 'بعكس ترجمة أودو الضعيفة وتعقيد أوراكل'], ['🏗️', 'مصمّم للمقاولات', 'BOQ، مستخلصات، أوامر تغيير، محتجزات'], ['🎯', 'أدوات بمستوى Primavera', 'EVM، مسار حرج، جانت تفاعلي'], ['🔗', 'تكامل كامل', 'مشاريع + محاسبة + موارد بشرية في نظام واحد'], ['💰', 'سعر مناسب', 'بلا رخص باهظة ولا تعقيد المؤسسات'], ['🇸🇦', 'ملاءمة محلية', 'ZATCA، نهاية الخدمة، والممارسات الخليجية']].map(([i, t, d]) => `
                    <div class="pe" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;text-align:right"><div style="font-size:30px;margin-bottom:10px">${i}</div><div style="font-size:17px;font-weight:800;margin-bottom:6px">${t}</div><div style="font-size:12.5px;opacity:.78;line-height:1.8">${d}</div></div>`).join('')}
            </div>
        </div>`,

    // 5) جدول المقارنة
    () => {
        const rows = [['عربي / RTL أصيل', 'full', 'part', 'part'], ['مصمّم للمقاولات (BOQ/مستخلصات)', 'full', 'no', 'part'], ['المسار الحرج + EVM', 'full', 'part', 'full'], ['فاتورة ZATCA محلية', 'full', 'part', 'part'], ['سهولة وسرعة التعلّم', 'full', 'part', 'no'], ['التكلفة', 'منخفضة', 'متوسطة', 'مرتفعة']];
        const cell = (v) => v === 'full' ? '<span style="color:#2ecc71;font-size:20px;font-weight:900">✓</span>' : v === 'part' ? '<span style="color:#f39c12;font-size:18px">◑</span>' : v === 'no' ? '<span style="color:#e74c3c;font-size:18px">✕</span>' : `<span style="font-weight:700">${v}</span>`;
        return `
        <div style="max-width:920px;margin:0 auto">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:8px">المقارنة</div>
            <h2 class="pe" style="font-size:clamp(26px,4.5vw,42px);font-weight:900;margin:0 0 24px">بُنيان مقابل المنافسين</h2>
            <div class="pe" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;overflow:hidden">
                <table style="width:100%;border-collapse:collapse;font-size:clamp(12px,2vw,15px)">
                    <thead><tr style="background:rgba(255,255,255,.08)"><th style="padding:14px 16px;text-align:right">الميزة</th><th style="padding:14px 10px;background:rgba(240,196,25,.18);color:#f0c419;font-weight:900">بُنيان</th><th style="padding:14px 10px;opacity:.85">أودو</th><th style="padding:14px 10px;opacity:.85">أوراكل</th></tr></thead>
                    <tbody>${rows.map(r => `<tr style="border-top:1px solid rgba(255,255,255,.08)"><td style="padding:13px 16px;text-align:right;font-weight:600">${r[0]}</td><td style="padding:13px 10px;text-align:center;background:rgba(240,196,25,.07)">${cell(r[1])}</td><td style="padding:13px 10px;text-align:center">${cell(r[2])}</td><td style="padding:13px 10px;text-align:center">${cell(r[3])}</td></tr>`).join('')}</tbody>
                </table>
            </div>
            <div class="pe" style="margin-top:12px;font-size:12px;opacity:.6;text-align:center">✓ كامل · ◑ جزئي/يحتاج تخصيص · ✕ غير متوفّر</div>
        </div>`;
    },

    // 6) مما يتكوّن (بطاقات قابلة للنقر → تقفز للقسم)
    () => `
        <div style="max-width:1020px;margin:0 auto">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:8px">الوحدات — اضغط أي بطاقة لعرضها مباشرة</div>
            <h2 class="pe" style="font-size:clamp(26px,4.5vw,42px);font-weight:900;margin:0 0 22px">نظام متكامل من 9 أقسام</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">
                ${presModCard('💰', 'المحاسبة المالية', 'قيود، قوائم، ضرائب، ZATCA', 'accdashboard')}
                ${presModCard('🏗️', 'إدارة المشاريع', 'عقود، مستخلصات، جدولة، EVM', 'prjdashboard')}
                ${presModCard('👥', 'الموارد البشرية', 'موظفون، رواتب، حضور', 'hrdashboard')}
                ${presModCard('🛒', 'المشتريات', 'طلبات، عروض، أوامر شراء', 'purchaseorders')}
                ${presModCard('📦', 'المخزون والمستودعات', 'أصناف، حركات، تقييم', 'inventory')}
                ${presModCard('🤝', 'إدارة العملاء CRM', 'فرص بيع وخط أنابيب', 'crm')}
                ${presModCard('🏭', 'الأصول الثابتة', 'إهلاك، صيانة، جرد', 'assets')}
                ${presModCard('🛡️', 'الخزينة والضمانات', 'خطابات، شيكات، محتجزات', 'treasury')}
                ${presModCard('📊', 'التحليل المالي', 'لوحات، تقارير، تنبؤات', 'finstatements')}
            </div>
        </div>`,

    // 7) رحلة المشروع
    () => `
        <div style="max-width:1000px;margin:0 auto">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:8px">كيف يعمل</div>
            <h2 class="pe" style="font-size:clamp(26px,4.5vw,42px);font-weight:900;margin:0 0 26px">رحلة المشروع داخل بُنيان</h2>
            <div style="display:flex;flex-direction:column;gap:13px">
                ${[['1', '📜', 'تعريف العقد والبنود (BOQ)', 'قيمة العقد وبنوده — أساس كل ما يليه', '#3498db', 'boq'], ['2', '📅', 'جدولة المهام والموارد', 'مهام بتبعيات ومسار حرج وتوزيع الفريق', '#9b59b6', 'prjdashboard'], ['3', '🧾', 'إصدار المستخلصات الدورية', 'فوترة العميل حسب نسبة الإنجاز', '#16a085', 'progressbillings'], ['4', '💰', 'تسجيل التكاليف الفعلية', 'مواد، عمالة (تايم شيت)، ومصروفات', '#e67e22', 'projectcosts'], ['5', '📈', 'قياس الربحية والأداء (EVM)', 'CPI/SPI وصحة المحفظة — قرار مبكّر', '#27ae60', 'prjhealth']].map(([n, ic, t, d, c, pg]) => `
                    <div class="pe" onclick="presJumpTo('${pg}')" style="display:flex;align-items:center;gap:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:15px 20px;cursor:pointer;transition:all .2s" onmouseover="this.style.background='rgba(240,196,25,.1)'" onmouseout="this.style.background='rgba(255,255,255,.05)'">
                        <div style="width:40px;height:40px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;flex-shrink:0">${n}</div>
                        <div style="font-size:28px;flex-shrink:0">${ic}</div>
                        <div style="text-align:right;flex:1"><div style="font-size:17px;font-weight:800">${t}</div><div style="font-size:13px;opacity:.78;margin-top:3px">${d}</div></div>
                        <div style="font-size:12px;opacity:.5">↗ افتح</div>
                    </div>`).join('')}
            </div>
        </div>`,

    // 8) أرقام حيّة
    () => { const s = presStats(); const card = (icon, target, label, col, money) => `
            <div class="pe" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:26px 18px;text-align:center;flex:1;min-width:155px"><div style="font-size:32px;margin-bottom:8px">${icon}</div><div class="pcount" data-count="${target}" ${money ? 'data-money="1"' : ''} style="font-size:clamp(28px,4.5vw,42px);font-weight:900;color:${col}">0</div><div style="font-size:13px;opacity:.85;margin-top:4px">${label}</div></div>`;
        return `
        <div style="max-width:1000px;margin:0 auto;text-align:center">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:8px">بياناتك الآن — مباشرة من النظام</div>
            <h2 class="pe" style="font-size:clamp(26px,4.5vw,42px);font-weight:900;margin:0 0 30px">نظامك يعمل بأرقام حقيقية</h2>
            <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center">${card('🏗️', s.projects, 'مشروع', '#f0c419')}${card('👷', s.employees, 'موظف نشط', '#2ecc71')}${card('🧾', s.invoices, 'فاتورة', '#3498db')}${card('🤝', s.customers, 'عميل', '#9b59b6')}</div>
            <div class="pe" style="margin-top:18px;background:linear-gradient(135deg,rgba(46,204,113,.2),rgba(46,204,113,.05));border:1px solid rgba(46,204,113,.32);border-radius:18px;padding:24px"><div style="font-size:13px;opacity:.85">إجمالي قيمة العقود المُدارة في النظام</div><div style="font-size:clamp(32px,5.5vw,52px);font-weight:900;color:#2ecc71;margin-top:4px"><span class="pcount" data-count="${s.contractTotal}" data-money="1">0</span> <span style="font-size:20px;opacity:.8">ريال</span></div></div>
        </div>`; },

    // 9) العائد (ROI)
    () => `
        <div style="max-width:960px;margin:0 auto;text-align:center">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:8px">القيمة والعائد</div>
            <h2 class="pe" style="font-size:clamp(26px,4.5vw,42px);font-weight:900;margin:0 0 28px">ماذا يوفّر لك بُنيان؟</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px">
                ${[['⏱️', 'حتى 70%', 'أسرع في إعداد المستخلصات والتقارير', '#2ecc71'], ['🎯', 'دقّة أعلى', 'تقليل أخطاء التكاليف والفوترة اليدوية', '#3498db'], ['💰', 'ربحية واضحة', 'تعرف ربح كل مشروع لحظياً لا بعد شهور', '#f0c419'], ['🚫', 'صفر تأخير', 'تنبيهات للضمانات والمستخلصات قبل فواتها', '#e67e22']].map(([i, big, d, c]) => `
                    <div class="pe" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:22px"><div style="font-size:32px;margin-bottom:8px">${i}</div><div style="font-size:24px;font-weight:900;color:${c}">${big}</div><div style="font-size:12.5px;opacity:.8;line-height:1.7;margin-top:6px">${d}</div></div>`).join('')}
            </div>
            <p class="pe" style="margin-top:24px;font-size:clamp(15px,2.3vw,19px);opacity:.9;font-weight:300">قرار أسرع وأدقّ = مشاريع أكثر ربحية وأقل مخاطرة.</p>
        </div>`,

    // 10) ميزات مميزة + شاهد مباشرة
    () => `
        <div style="max-width:1000px;margin:0 auto">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:8px">ما يميّزنا تقنياً</div>
            <h2 class="pe" style="font-size:clamp(26px,4.5vw,42px);font-weight:900;margin:0 0 22px">ميزات بمستوى الأنظمة العالمية</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px">
                ${[['🧾', 'فاتورة إلكترونية ZATCA', 'رمز QR متوافق مع هيئة الزكاة والضريبة'], ['📐', 'القيمة المكتسبة (EVM)', 'CPI/SPI ومسار حرج وجانت تفاعلي'], ['⏱️', 'تسجيل الأوقات والموارد', 'تكلفة عمالة فعلية وتوزيع ذكي'], ['🏢', 'منصّة متعددة الشركات (SaaS)', 'كل شركة بيئة معزولة آمنة'], ['🤝', 'إدارة علاقات العملاء', 'خط أنابيب مبيعات وتقارير'], ['💾', 'نسخ احتياطي ومستندات', 'حماية بياناتك وأرشفة ملفاتك']].map(([i, t, d]) => `
                    <div class="pe" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;display:flex;gap:14px;align-items:flex-start;text-align:right"><div style="font-size:30px;flex-shrink:0">${i}</div><div><div style="font-size:16px;font-weight:800;margin-bottom:4px">${t}</div><div style="font-size:12.5px;opacity:.78;line-height:1.8">${d}</div></div></div>`).join('')}
            </div>
            <div class="pe" style="margin-top:22px;text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
                <span style="opacity:.7;font-size:13px;align-self:center">شاهدها مباشرة:</span>
                ${presDemoBtn('فاتورة ZATCA', 'salesinvoices')}${presDemoBtn('صحة المحفظة', 'prjhealth')}${presDemoBtn('إدارة العملاء', 'crm')}
            </div>
        </div>`,

    // 11) الأمان
    () => `
        <div style="max-width:900px;margin:0 auto;text-align:center">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:8px">الثقة</div>
            <h2 class="pe" style="font-size:clamp(26px,4.5vw,42px);font-weight:900;margin:0 0 28px">أمان وموثوقية على مستوى المؤسسات</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px">
                ${[['🔒', 'عزل بيانات كل شركة', 'مفروض على مستوى الخادم — لا تسرّب'], ['👤', 'صلاحيات بالأدوار', 'كل مستخدم يرى ما يخصّه فقط'], ['☁️', 'سحابي ومتاح دائماً', 'بنية Google Firebase الموثوقة'], ['💾', 'نسخ احتياطي', 'تصدير واستعادة كامل البيانات']].map(([i, t, d]) => `
                    <div class="pe" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:22px"><div style="font-size:34px;margin-bottom:10px">${i}</div><div style="font-size:15px;font-weight:800;margin-bottom:5px">${t}</div><div style="font-size:12px;opacity:.78;line-height:1.7">${d}</div></div>`).join('')}
            </div>
        </div>`,

    // 12) الأسعار / الباقات
    () => {
        const pkg = (name, price, sub, feats, hot) => `
            <div class="pe" style="background:${hot ? 'linear-gradient(135deg,rgba(240,196,25,.18),rgba(240,196,25,.04))' : 'rgba(255,255,255,.06)'};border:1.5px solid ${hot ? 'rgba(240,196,25,.5)' : 'rgba(255,255,255,.12)'};border-radius:18px;padding:24px 20px;text-align:center;flex:1;min-width:200px;position:relative">
                ${hot ? '<div style="position:absolute;top:-12px;right:50%;transform:translateX(50%);background:#f0c419;color:#1a2a33;font-size:11px;font-weight:800;padding:4px 14px;border-radius:20px">الأكثر طلباً</div>' : ''}
                <div style="font-size:17px;font-weight:800;margin-bottom:6px">${name}</div>
                <div style="font-size:32px;font-weight:900;color:${hot ? '#f0c419' : '#fff'}">${price}</div>
                <div style="font-size:12px;opacity:.7;margin-bottom:14px">${sub}</div>
                <div style="text-align:right;font-size:12.5px;line-height:2.1;opacity:.9">${feats.map(f => `✓ ${f}`).join('<br>')}</div>
            </div>`;
        return `
        <div style="max-width:1000px;margin:0 auto;text-align:center">
            <div class="pe" style="font-size:13px;letter-spacing:2px;opacity:.6;margin-bottom:8px">الباقات</div>
            <h2 class="pe" style="font-size:clamp(26px,4.5vw,42px);font-weight:900;margin:0 0 28px">باقات تناسب حجم شركتك</h2>
            <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center">
                ${pkg('أساسي', 'حسب الاتفاق', 'للشركات الصغيرة', ['المحاسبة والفواتير', 'إدارة المشاريع الأساسية', 'حتى 5 مستخدمين'], false)}
                ${pkg('احترافي', 'حسب الاتفاق', 'للشركات المتوسطة', ['كل ميزات الأساسي', 'EVM، تايم شيت، CRM', 'تقارير متقدمة', 'مستخدمون غير محدودين'], true)}
                ${pkg('مؤسسي', 'حسب الاتفاق', 'للمجموعات', ['كل ميزات الاحترافي', 'تعدد الشركات', 'دعم وتدريب مخصّص', 'تكاملات حسب الطلب'], false)}
            </div>
            <p class="pe" style="margin-top:18px;font-size:13px;opacity:.65">* الأسعار قابلة للتخصيص — عدّلها من ملف العرض حسب سياستك.</p>
        </div>`;
    },

    // 13) الخلاصة
    () => `
        <div style="text-align:center;max-width:860px;margin:0 auto">
            <div class="pe" style="font-size:58px;margin-bottom:18px">🚀</div>
            <h2 class="pe" style="font-size:clamp(30px,5.5vw,50px);font-weight:900;margin:0 0 18px;line-height:1.25">نظام واحد. تحكّم كامل. قرار أذكى.</h2>
            <p class="pe" style="font-size:clamp(16px,2.5vw,22px);opacity:.9;line-height:2;font-weight:300">كل ما تحتاجه شركة المقاولات لإدارة عقودها ومالها وفريقها — بالعربي، بأمان، وبسعر مناسب. أبسط من أوراكل، وأقرب لشغلك من أودو.</p>
            <div class="pe" style="margin-top:36px;font-size:26px;font-weight:900;color:#f0c419">بُنيان — منصّة إدارة المقاولات</div>
            <div class="pe" style="margin-top:8px;font-size:14px;opacity:.65">شكراً لكم — أسئلتكم محل ترحيب</div>
        </div>`
];

// ملاحظات المُقدِّم (نقاط الحديث لكل شريحة)
const PRES_NOTES = [
    'افتتح بثقة: «بُنيان نظام عربي متكامل صُمّم خصيصاً لشركات المقاولات». اذكر اسم العميل إن ظهر على الغلاف.',
    'لامس ألم العميل: اسأله «كيف تتابع تكاليف مشاريعك الآن؟» — أغلب الشركات تعاني من التشتت بين إكسل وبرامج منفصلة.',
    'الفكرة المحورية: نظام واحد يربط كل شيء. اربطها بسير العمل من العقد حتى الربحية.',
    'هنا تبرز التمايز. ركّز على «عربي» و«مصمّم للمقاولات» — هذا ما لا يقدّمه أودو وأوراكل بسهولة.',
    'جدول المقارنة سلاحك الإقناعي. أشِر لعمود بُنيان الذهبي — كامل في كل النقاط المهمة للمقاول.',
    '⭐ تفاعل! اضغط أي بطاقة لتفتح القسم الحقيقي أمام العميل، ثم ارجع للعرض بالزر الذهبي. يثبت أن النظام يعمل فعلاً.',
    'اشرح بساطة سير العمل بخطوات. كل خطوة قابلة للنقر لعرضها مباشرة.',
    '💡 شريحة قوية: هذه أرقام النظام الحقيقية لحظة العرض — تثبت أنه يعمل ببيانات فعلية لا شرائح فارغة.',
    'ركّز على العائد: السرعة والدقة = ربحية. هذا ما يهمّ المدير.',
    'الميزات التقنية المتقدمة. استخدم أزرار «شاهد مباشرة» لعرض فاتورة QR وصحة المحفظة حيّاً.',
    'طمئن بشأن الأمان والخصوصية — مهم جداً للمدير: «بيانات شركتك معزولة تماماً».',
    'اعرض الباقات. لا تذكر سعراً نهائياً إن لم تتفق — «حسب الاتفاق» تفتح باب التفاوض.',
    'اختم بثقة وادعُ لخطوة تالية: «هل نبدأ بتجربة على بيانات شركتكم؟».'
];

function presInjectStyle() {
    if (document.getElementById('presStyle')) return;
    const st = document.createElement('style'); st.id = 'presStyle';
    st.textContent = `@keyframes peFade{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        #presStage .pe{opacity:0;animation:peFade .55s cubic-bezier(.22,.61,.36,1) forwards}
        #presStage .pe:nth-child(2){animation-delay:.07s}#presStage .pe:nth-child(3){animation-delay:.14s}#presStage .pe:nth-child(4){animation-delay:.21s}#presStage .pe:nth-child(5){animation-delay:.28s}#presStage .pe:nth-child(6){animation-delay:.35s}
        #presStage [style*="grid"] .pe:nth-child(1){animation-delay:.05s}#presStage [style*="grid"] .pe:nth-child(2){animation-delay:.1s}#presStage [style*="grid"] .pe:nth-child(3){animation-delay:.15s}#presStage [style*="grid"] .pe:nth-child(4){animation-delay:.2s}#presStage [style*="grid"] .pe:nth-child(5){animation-delay:.25s}#presStage [style*="grid"] .pe:nth-child(6){animation-delay:.3s}#presStage [style*="grid"] .pe:nth-child(7){animation-delay:.35s}#presStage [style*="grid"] .pe:nth-child(8){animation-delay:.4s}#presStage [style*="grid"] .pe:nth-child(9){animation-delay:.45s}`;
    document.head.appendChild(st);
}

function presBuildDeck() {
    let deck = document.getElementById('presentDeck'); if (deck) return deck;
    presInjectStyle();
    deck = document.createElement('div'); deck.id = 'presentDeck';
    deck.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:radial-gradient(1200px 600px at 70% 0%,#24506b,#0f2027 60%);color:#fff;direction:rtl;font-family:inherit;flex-direction:column';
    deck.innerHTML = `
        <div id="presBar" style="height:4px;background:#f0c419;width:0;transition:width .4s ease"></div>
        <div id="presStage" style="flex:1;display:flex;align-items:center;justify-content:center;padding:42px 38px;overflow:auto"></div>
        <div id="presNotesPanel" style="display:none;background:rgba(0,0,0,.45);border-top:2px solid #f0c419;padding:12px 24px;font-size:14px;line-height:1.7;max-height:130px;overflow:auto"><strong style="color:#f0c419">📝 ملاحظة:</strong> <span id="presNotesTxt"></span></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 22px;background:rgba(0,0,0,.3);flex-wrap:wrap;backdrop-filter:blur(8px)">
            <div style="display:flex;gap:8px;align-items:center">
                <button onclick="presNav(-1)" style="background:rgba(255,255,255,.13);border:none;color:#fff;border-radius:10px;padding:9px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">→ السابق</button>
                <button onclick="presNav(1)" style="background:#f0c419;border:none;color:#1a2a33;border-radius:10px;padding:9px 18px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">التالي ←</button>
            </div>
            <div id="presDots" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"></div>
            <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
                <span id="presCounter" style="font-size:12px;opacity:.8;margin-inline-end:4px"></span>
                <button onclick="presToggleNotes()" title="ملاحظات المُقدِّم" style="background:rgba(255,255,255,.13);border:none;color:#fff;border-radius:10px;padding:8px 11px;font-size:13px;cursor:pointer;font-family:inherit">📝</button>
                <button onclick="presSetClient()" title="تخصيص باسم العميل" style="background:rgba(255,255,255,.13);border:none;color:#fff;border-radius:10px;padding:8px 11px;font-size:13px;cursor:pointer;font-family:inherit">👤</button>
                <button onclick="presExportPDF()" title="تصدير PDF" style="background:rgba(255,255,255,.13);border:none;color:#fff;border-radius:10px;padding:8px 11px;font-size:13px;cursor:pointer;font-family:inherit">🖨️</button>
                <button onclick="presFullscreen()" title="ملء الشاشة" style="background:rgba(255,255,255,.13);border:none;color:#fff;border-radius:10px;padding:8px 11px;font-size:13px;cursor:pointer">⛶</button>
                <button onclick="closePresentation()" title="إغلاق (Esc)" style="background:rgba(231,76,60,.85);border:none;color:#fff;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">✕</button>
            </div>
        </div>`;
    document.body.appendChild(deck);
    document.addEventListener('keydown', presKey);
    return deck;
}
function presShow() { const d = presBuildDeck(); d.style.display = 'flex'; presRender(); }
window.openPresentation = function () { window._present.idx = 0; presShow(); };

function presKey(e) {
    if (document.getElementById('presentDeck')?.style.display !== 'flex') return;
    if (e.key === 'Escape') closePresentation();
    else if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); presNav(1); }
    else if (e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); presNav(-1); }
}
window.presNav = function (dir) { const n = PRES_SLIDES.length, next = Math.max(0, Math.min(n - 1, window._present.idx + dir)); if (next === window._present.idx) return; window._present.idx = next; presRender(); };
window.presGo = function (k) { window._present.idx = k; presRender(); };
function presAnimateCounters() {
    document.querySelectorAll('#presStage .pcount').forEach(el => {
        const target = parseFloat(el.getAttribute('data-count')) || 0, money = el.hasAttribute('data-money'), dur = 1200, start = performance.now();
        (function tick(now) { const p = Math.min(1, (now - start) / dur), val = target * (1 - Math.pow(1 - p, 3)); el.textContent = money ? presFmt(val) : Math.round(val).toLocaleString('en'); if (p < 1) requestAnimationFrame(tick); })(start);
    });
}
function presRender() {
    const stage = document.getElementById('presStage'); if (!stage) return;
    const i = window._present.idx, n = PRES_SLIDES.length;
    stage.innerHTML = PRES_SLIDES[i]();
    presAnimateCounters();
    const bar = document.getElementById('presBar'); if (bar) bar.style.width = ((i + 1) / n * 100) + '%';
    const counter = document.getElementById('presCounter'); if (counter) counter.textContent = `${i + 1} / ${n}`;
    const nt = document.getElementById('presNotesTxt'); if (nt) nt.textContent = PRES_NOTES[i] || '';
    const dots = document.getElementById('presDots'); if (dots) dots.innerHTML = Array.from({ length: n }, (_, k) => `<span onclick="presGo(${k})" style="width:${k === i ? '22px' : '8px'};height:8px;border-radius:5px;background:${k === i ? '#f0c419' : 'rgba(255,255,255,.3)'};cursor:pointer;transition:all .25s"></span>`).join('');
}
window.presToggleNotes = function () { window._present.notes = !window._present.notes; const p = document.getElementById('presNotesPanel'); if (p) p.style.display = window._present.notes ? 'block' : 'none'; };
window.presSetClient = function () {
    const name = prompt('اسم العميل/الجهة (يظهر على الغلاف):', window._present.client || '');
    if (name === null) return;
    window._present.client = name.trim();
    const logo = prompt('رابط شعار العميل (اختياري — اتركه فارغاً):', window._present.clientLogo || '');
    if (logo !== null) window._present.clientLogo = logo.trim();
    presRender();
    if (window._present.idx !== 0) toast && toast('💡 اسم العميل يظهر على شريحة الغلاف', 'ok', 4000);
};
// 🔴 القفز للتطبيق الفعلي ثم الرجوع للعرض
window.presJumpTo = function (page) {
    window._present.resumeIdx = window._present.idx;
    const d = document.getElementById('presentDeck'); if (d) d.style.display = 'none';
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    let btn = document.getElementById('presResumeBtn');
    if (!btn) { btn = document.createElement('button'); btn.id = 'presResumeBtn'; btn.onclick = presResume; btn.style.cssText = 'position:fixed;bottom:22px;left:22px;z-index:100000;background:#f0c419;color:#1a2a33;border:none;border-radius:30px;padding:13px 24px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 8px 28px rgba(0,0,0,.35)'; document.body.appendChild(btn); }
    btn.innerHTML = '🎬 رجوع للعرض التقديمي'; btn.style.display = 'block';
    try { if (typeof nav === 'function') nav(page); } catch (e) { }
};
window.presResume = function () { const btn = document.getElementById('presResumeBtn'); if (btn) btn.style.display = 'none'; window._present.idx = window._present.resumeIdx || 0; presShow(); };
window.closePresentation = function () { const d = document.getElementById('presentDeck'); if (d) d.style.display = 'none'; const b = document.getElementById('presResumeBtn'); if (b) b.style.display = 'none'; if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); };
window.presFullscreen = function () { const d = document.getElementById('presentDeck'); if (!d) return; if (!document.fullscreenElement) d.requestFullscreen().catch(() => { }); else document.exitFullscreen().catch(() => { }); };
// تصدير العرض كملف PDF (عبر نافذة طباعة)
window.presExportPDF = function () {
    let html = PRES_SLIDES.map(fn => `<div class="pslide">${fn()}</div>`).join('');
    // تعبئة العدّادات بقيمها الفعلية (لا JS في نافذة الطباعة)
    html = html.replace(/<span class="pcount" data-count="([\d.]+)"( data-money="1")?[^>]*>0<\/span>/g, (m, num, money) => `<span>${money ? presFmt(num) : Math.round(parseFloat(num)).toLocaleString('en')}</span>`);
    const w = window.open('', '_blank'); if (!w) { toast && toast('⚠️ اسمح بالنوافذ المنبثقة للتصدير', 'er'); return; }
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>بُنيان — العرض التقديمي</title>
    <style>*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;font-family:Tahoma,Arial}
    body{margin:0;direction:rtl;background:#0f2027;color:#fff}
    .pslide{width:100%;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:50px;background:radial-gradient(1200px 600px at 70% 0%,#24506b,#0f2027 60%);page-break-after:always;overflow:hidden}
    .pe{opacity:1!important;animation:none!important} button{display:none!important} table{width:100%;border-collapse:collapse}
    @page{size:A4 landscape;margin:0}</style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch (e) { } }, 700);
};

console.log('✅ Presentation module (بُنيان) loaded — full');
