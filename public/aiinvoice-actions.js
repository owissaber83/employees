// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║   🤖 قراءة الفواتير — الإجراءات والتكامل المحاسبي (Actions Layer)              ║
// ║   ────────────────────────────────────────────────────────────────────────    ║
// ║   [AC-SAVE]   حفظ مسوّدة · اعتماد · رفض                                       ║
// ║   [AC-CONV]   التحويل إلى فاتورة مشتريات ثم القيد (لا ترحيل بلا موافقة)        ║
// ║   [AC-XLS]    تصدير Excel بخمس أوراق (§21)                                    ║
// ║   [AC-PDF]    تصدير PDF احترافي (§22)                                         ║
// ║   [AC-SET]    إعدادات المدير + اختبار الوسيط (§32)                             ║
// ║   [AC-LOG]    سجل المعالجة ولوحة التكلفة (§31 §33)                            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
/* global AINV, AIU, XLSX */

(function () {
    'use strict';

    const esc = window.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const $ = id => document.getElementById(id);
    const toast = (m, t, d) => (window.toast ? window.toast(m, t, d) : console.log(m));
    const fmt = n => (window.fmt ? window.fmt(n) : (Number(n) || 0).toFixed(2));
    const IS_ADMIN = () => (window.myP && window.myP.role === 'admin');

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-SAVE] الحفظ والاعتماد والرفض
    // ═══════════════════════════════════════════════════════════════════════════
    function snapshot(c) {
        return {
            extracted: JSON.parse(JSON.stringify(c.extracted)),
            validation: {
                errors: c.validation.errors, warnings: c.validation.warnings,
                computed: c.validation.computed, ok: c.validation.ok
            },
            confidence: c.confidence,
            lowFields: c.lowFields || [],
            vendorKey: c.vendorKey || '',
            itemMatches: c.itemMatches || [],
            duplicates: c.duplicates || [],
            edits: c.edits || [],
            updatedAt: Date.now(),
            updatedBy: (window.curU && window.curU.email) || ''
        };
    }

    window.aiSaveDraft = async function () {
        const c = AIU.current; if (!c) return;
        try {
            await AINV.Store.update(c.id, Object.assign(snapshot(c), { status: 'draft' }));
            c.status = 'draft'; AIU.dirty = false;
            await AINV.Audit.log('حفظ مسوّدة فاتورة', `حُفظت مسوّدة «${c.extracted.number || c.fileName}» — ${(c.edits || []).length} تعديل يدوي`, { aiInvoiceId: c.id });
            toast('💾 حُفظت المسوّدة', 'ok');
            window.renderAiInvoices();
        } catch (e) { toast('تعذّر الحفظ: ' + e.message, 'er', 7000); }
    };

    window.aiReject = async function () {
        const c = AIU.current; if (!c) return;
        const why = prompt('سبب الرفض (يُسجَّل في أثر التدقيق):');
        if (why == null) return;
        try {
            await AINV.Store.update(c.id, Object.assign(snapshot(c), { status: 'rejected', rejectReason: why, rejectedAt: Date.now() }));
            await AINV.Audit.log('رفض فاتورة مستخرَجة', `رُفضت «${c.extracted.number || c.fileName}» — السبب: ${why}`, { aiInvoiceId: c.id });
            toast('✖️ رُفضت الفاتورة', 'ok');
            AIU.current = null; AIU.dirty = false;
            window.renderAiInvoices();
        } catch (e) { toast('تعذّر الرفض: ' + e.message, 'er', 7000); }
    };

    /**
     * الاعتماد — البوابة الوحيدة نحو المحاسبة.
     * لا يمرّ إلا بعد: تحقّق حسابي سليم · مورّد مربوط · إقرار المستخدم بالتكرار إن وُجد.
     */
    window.aiApprove = async function () {
        const c = AIU.current; if (!c) return;
        if (!(typeof window.can === 'function' ? window.can('ai_invoice_approve') : true)) { toast('🚫 لا تملك صلاحية الاعتماد', 'er'); return; }

        const cfg = AINV.Config.get();
        const v = c.validation;

        if (cfg.blockOnArithmetic && !v.ok) {
            toast(`⛔ لا يمكن الاعتماد: ${v.errors.length} خطأ في التحقق الحسابي. صحّح البنود أو الإجماليات أولاً.`, 'er', 10000);
            return;
        }
        if (!c.vendorKey) {
            toast('⛔ اربط الفاتورة بمورّد في النظام قبل الاعتماد', 'er', 8000);
            return;
        }
        if ((c.duplicates || []).length) {
            if (!confirm(`⚠️ قد تكون هذه الفاتورة مكرّرة:\n\n${c.duplicates.map(d => '• ' + d.where + ': ' + d.why).join('\n')}\n\nهل تؤكّد أنها فاتورة جديدة فعلاً؟`)) return;
        }
        const low = c.lowFields || [];
        if (low.length && !confirm(`⚠️ ${low.length} حقل استُخرج بثقة منخفضة. هل راجعتها جميعاً؟`)) return;

        const comp = v.computed;
        if (!confirm(`اعتماد الفاتورة؟\n\nالمورّد: ${(window.vendors[c.vendorKey] || {}).nameAr || ''}\nالرقم: ${c.extracted.number}\nالتاريخ: ${c.extracted.date}\nقبل الضريبة: ${fmt(comp.taxable)}\nالضريبة: ${fmt(comp.vat)}\nالإجمالي: ${fmt(comp.grandTotal)} ${c.extracted.currency}\n\nلن يُرحَّل أي قيد محاسبي إلا بموافقة منفصلة بعد ذلك.`)) return;

        try {
            await AINV.Store.update(c.id, Object.assign(snapshot(c), {
                status: 'approved', approvedAt: Date.now(),
                approvedBy: (window.curU && window.curU.email) || '',
                approvedByName: (window.myP && window.myP.name) || ''
            }));
            c.status = 'approved'; AIU.dirty = false;
            await AINV.Audit.log('اعتماد فاتورة مستخرَجة',
                `اعتُمدت «${c.extracted.number}» للمورّد ${(window.vendors[c.vendorKey] || {}).nameAr || ''} بمبلغ ${fmt(comp.grandTotal)} ${c.extracted.currency} — ${(c.edits || []).length} تعديل يدوي`,
                { aiInvoiceId: c.id, amount: comp.grandTotal, vendorKey: c.vendorKey });
            toast('✅ اعتُمدت — يمكنك الآن تحويلها إلى فاتورة مشتريات', 'ok', 7000);
            window.renderAiInvoices();
            setTimeout(() => window.aiOpen(c.id), 60);
        } catch (e) { toast('تعذّر الاعتماد: ' + e.message, 'er', 7000); }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-CONV] التحويل إلى فاتورة مشتريات
    // ───────────────────────────────────────────────────────────────────────────
    // نكتب في ledger/purchaseInvoices بنفس شكل savePInv تماماً، ثم نترك الترحيل
    // لدالة postPInv القائمة — فلا نكرّر منطق القيد المحاسبي ولا نخاطر بمخالفته.
    // ═══════════════════════════════════════════════════════════════════════════
    window.aiConvert = async function () {
        const c = AIU.current; if (!c) return;
        if (c.status !== 'approved') { toast('⛔ اعتمد الفاتورة أولاً', 'er'); return; }
        if (c.linkedPInvKey) { toast('ℹ️ حُوِّلت هذه الفاتورة مسبقاً', 'ok'); return; }

        const p = AINV.toPurchaseInvoice(c);
        if (!confirm(`إنشاء فاتورة مشتريات مسوّدة؟\n\nالمورّد: ${(window.vendors[c.vendorKey] || {}).nameAr || ''}\nالإجمالي: ${fmt(p.grandTotal)}\n\nستُنشأ كمسوّدة — الترحيل المحاسبي يتم بخطوة منفصلة بموافقتك.`)) return;

        try {
            const r = await window.push(window.R.pinv, p);
            await AINV.Store.update(c.id, { linkedPInvKey: r.key, convertedAt: Date.now(), convertedBy: (window.curU && window.curU.email) || '' });
            c.linkedPInvKey = r.key;
            await AINV.Audit.log('تحويل إلى فاتورة مشتريات',
                `أُنشئت فاتورة مشتريات مسوّدة من الاستخراج «${c.extracted.number}» بمبلغ ${fmt(p.grandTotal)}`,
                { aiInvoiceId: c.id, purchaseInvoiceKey: r.key, amount: p.grandTotal });
            toast('✅ أُنشئت فاتورة مشتريات مسوّدة — راجعها ثم رحّلها من صفحة فواتير المشتريات', 'ok', 9000);
            window.renderAiInvoices();
            setTimeout(() => window.aiOpen(c.id), 60);
        } catch (e) { toast('تعذّر التحويل: ' + e.message, 'er', 9000); }
    };

    /** ينقل المستخدم إلى فاتورة المشتريات الناتجة للترحيل هناك (لا نرحّل نحن). */
    window.aiGoToPInv = function () {
        const c = AIU.current;
        if (!c || !c.linkedPInvKey) return;
        AIU.current = null;
        if (typeof window.nav === 'function') window.nav('purchaseinvoices');
        setTimeout(() => {
            if (typeof window.openPInvModal === 'function') window.openPInvModal(c.linkedPInvKey);
            else toast('افتح الفاتورة من القائمة لمراجعتها وترحيلها', 'ok', 7000);
        }, 300);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-XLS] تصدير Excel — خمس أوراق (§21)
    // ═══════════════════════════════════════════════════════════════════════════
    function safeName(s) { return String(s || 'invoice').replace(/[\\/:*?"<>|[\]]+/g, '_').slice(0, 28); }

    window.aiExportExcel = function () {
        const c = AIU.current; if (!c) return;
        if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محمّلة', 'er'); return; }
        const inv = c.extracted, comp = c.validation.computed;
        const vendor = (window.vendors || {})[c.vendorKey] || {};
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
            ['بيانات الفاتورة', ''],
            ['رقم الفاتورة', inv.number], ['التاريخ', inv.date], ['تاريخ الاستحقاق', inv.dueDate],
            ['نوع المستند', inv.docType], ['العملة', inv.currency],
            ['رقم أمر الشراء', inv.poNumber], ['رقم العقد', inv.contractNumber],
            [], ['الحالة', (AINV.STATUS[c.status] || {}).ar || c.status],
            ['الثقة الكلية', (c.confidence.overall || 0) + '%'],
            ['رُفعت بواسطة', c.uploadedByName || c.uploadedBy],
            ['تاريخ الرفع', c.uploadedAt ? new Date(c.uploadedAt).toLocaleString('ar-EG') : ''],
            ['اعتُمدت بواسطة', c.approvedByName || c.approvedBy || '—'],
            ['رقم المستند في النظام', c.id]
        ]), 'الفاتورة');

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
            ['بيانات المورّد (من الفاتورة)', ''],
            ['الاسم', inv.supplier.name], ['الرقم الضريبي', inv.supplier.vatNumber],
            ['السجل التجاري', inv.supplier.crNumber], ['العنوان', inv.supplier.address],
            ['الهاتف', inv.supplier.phone], ['البريد', inv.supplier.email], ['الآيبان', inv.supplier.iban],
            [], ['المورّد المربوط في النظام', vendor.nameAr || vendor.nameEn || '— غير مربوط —'],
            ['كود المورّد', vendor.code || ''],
            [], ['العميل (من الفاتورة)', inv.customer.name], ['الرقم الضريبي للعميل', inv.customer.vatNumber]
        ]), 'المورّد');

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
            ['#', 'الكود', 'الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الخصم', 'قبل الضريبة', 'النسبة %', 'الضريبة', 'بعد الضريبة', 'الصنف المربوط']
        ].concat(inv.items.map((l, i) => {
            const cc = comp.lines[i] || {}, m = (c.itemMatches || [])[i] || {};
            const it = (window.invItems || window.items || {})[m.key] || {};
            return [i + 1, l.code, l.description, cc.qty, l.unit, cc.price, cc.discount, cc.taxable, cc.rate, cc.vatAmount, cc.lineTotal, it.nameAr || ''];
        })).concat([[], ['', '', 'الإجمالي', '', '', '', comp.discount, comp.taxable, '', comp.vat, comp.grandTotal, '']])), 'الأصناف');

        const je = buildJournalPreview(c);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
            [['القيد المحاسبي المقترح', '', '', ''], [], ['الحساب', 'اسم الحساب', 'مدين', 'دائن']]
                .concat(je.lines.map(l => [l.code, l.name, l.debit || '', l.credit || '']))
                .concat([[], ['', 'الإجمالي', je.totalDebit, je.totalCredit],
                [], ['ملاحظة', 'هذا القيد لا يُرحَّل إلا بموافقة صريحة من صفحة فواتير المشتريات']])
        ), 'القيد المحاسبي');

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
            [['نتائج الفحص والتحذيرات'], [], ['النوع', 'الحقل', 'الرسالة']]
                .concat((c.validation.errors || []).map(e => ['خطأ', e.field + (e.line ? ` (بند ${e.line})` : ''), e.msg]))
                .concat((c.validation.warnings || []).map(w => ['تحذير', w.field, w.msg]))
                .concat([[], ['درجات الثقة'], []])
                .concat(Object.entries(c.confidence || {}).map(([k, v]) => ['ثقة', k, v + '%']))
                .concat([[], ['تعديلات المستخدم على قيم الذكاء الاصطناعي'], ['الحقل', 'قيمة الذكاء الاصطناعي', 'قيمة المستخدم', 'بواسطة', 'الوقت']])
                .concat((c.edits || []).map(e => [e.field, e.aiValue, e.userValue, e.by, e.at ? new Date(e.at).toLocaleString('ar-EG') : '']))
        ), 'الفحص');

        XLSX.writeFile(wb, `فاتورة-${safeName(inv.number || c.fileName)}.xlsx`);
        AINV.Audit.log('تصدير Excel', `صُدِّرت «${inv.number || c.fileName}» إلى Excel`, { aiInvoiceId: c.id });
    };

    window.aiExportAllExcel = function () {
        if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محمّلة', 'er'); return; }
        const recs = Object.entries(window.aiInvoices || {});
        if (!recs.length) { toast('لا فواتير للتصدير', 'er'); return; }
        const rows = [['الحالة', 'المورّد', 'الرقم الضريبي', 'رقم الفاتورة', 'التاريخ', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'الثقة %', 'أخطاء', 'تحذيرات', 'مربوط بمورّد', 'رُفعت بواسطة', 'التكلفة $']];
        recs.forEach(([, r]) => {
            const e = r.extracted || {}, comp = (r.validation && r.validation.computed) || {};
            rows.push([
                (AINV.STATUS[r.status] || {}).ar || r.status,
                (e.supplier && e.supplier.name) || r.fileName || '',
                (e.supplier && e.supplier.vatNumber) || '',
                e.number || '', e.date || '',
                comp.taxable, comp.vat, comp.grandTotal,
                (r.confidence && r.confidence.overall) || '',
                ((r.validation && r.validation.errors) || []).length,
                ((r.validation && r.validation.warnings) || []).length,
                r.vendorKey ? 'نعم' : 'لا',
                r.uploadedByName || r.uploadedBy || '', r.estCost || ''
            ]);
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'الفواتير');
        XLSX.writeFile(wb, `الفواتير-بالذكاء-الاصطناعي-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    /**
     * القيد المقترح — للعرض والتصدير فقط. القيد الفعلي يبنيه createJournalForPInv
     * القائم عند الترحيل، فلا يوجد مصدران للحقيقة المحاسبية.
     */
    function buildJournalPreview(c) {
        const comp = c.validation.computed;
        const coa = window.coa || {};
        const find = (...names) => {
            const hit = Object.entries(coa).find(([, a]) =>
                names.some(n => String(a.nameAr || a.name || '').includes(n)));
            return hit ? { code: hit[1].code || hit[0], name: hit[1].nameAr || hit[1].name } : null;
        };
        const vendor = (window.vendors || {})[c.vendorKey] || {};
        const expense = (vendor.defaultAccountCode && { code: vendor.defaultAccountCode, name: 'حساب المورّد الافتراضي' })
            || find('مشتريات', 'مصروف') || { code: '—', name: 'حساب المشتريات/المصروف (يُحدَّد عند الترحيل)' };
        const vatIn = find('ضريبة القيمة المضافة - المدخلات', 'ضريبة المدخلات', 'المدخلات') || { code: '—', name: 'ضريبة القيمة المضافة — المدخلات' };
        const ap = find('الموردون', 'الدائنون', 'ذمم دائنة') || { code: '—', name: 'حسابات الموردين' };

        const lines = [
            { code: expense.code, name: expense.name, debit: comp.taxable, credit: 0 }
        ];
        if (comp.vat) lines.push({ code: vatIn.code, name: vatIn.name, debit: comp.vat, credit: 0 });
        lines.push({ code: ap.code, name: (vendor.nameAr ? ap.name + ' — ' + vendor.nameAr : ap.name), debit: 0, credit: comp.grandTotal });

        return {
            lines,
            totalDebit: AINV.r2(lines.reduce((s, l) => s + (l.debit || 0), 0)),
            totalCredit: AINV.r2(lines.reduce((s, l) => s + (l.credit || 0), 0))
        };
    }
    window.aiJournalPreview = buildJournalPreview;

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-PDF] تصدير PDF (§22)
    // ═══════════════════════════════════════════════════════════════════════════
    window.aiExportPdf = function () {
        const c = AIU.current; if (!c) return;
        const inv = c.extracted, comp = c.validation.computed;
        const vendor = (window.vendors || {})[c.vendorKey] || {};
        const je = buildJournalPreview(c);
        const st = AINV.STATUS[c.status] || {};
        const co = (window.cfg && window.cfg.companyName) || 'الشركة';

        const w = window.open('', '_blank');
        if (!w) { toast('⚠️ المتصفح منع النافذة — اسمح بالنوافذ المنبثقة', 'er', 7000); return; }
        w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
        <title>فاتورة ${esc(inv.number || '')}</title><style>
        body{font-family:'Tajawal',Tahoma,Arial,sans-serif;padding:26px;color:#1a3a5c;direction:rtl}
        h1{font-size:19px;margin:0 0 4px;color:#12336B}
        .sub{font-size:12px;color:#777;margin-bottom:16px}
        .st{display:inline-block;padding:3px 12px;border-radius:12px;color:#fff;font-size:11px;font-weight:800;background:${st.color || '#777'}}
        .box{border:1px solid #dde4ec;border-radius:9px;padding:12px 14px;margin-bottom:12px}
        .box h3{margin:0 0 8px;font-size:13px;color:#12336B;border-bottom:1px solid #eef2f7;padding-bottom:5px}
        .kv{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 18px;font-size:12px}
        .kv div{display:flex;justify-content:space-between;border-bottom:1px dashed #f0f3f7;padding:3px 0}
        .kv span{color:#7a8899}.kv b{color:#1a3a5c}
        table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:6px}
        th,td{border:1px solid #e6ebf0;padding:6px 8px;text-align:right}
        th{background:#f2f6fa;color:#12336B;font-weight:700}
        td.n,th.n{text-align:left;font-variant-numeric:tabular-nums}
        tfoot td{background:#f8fafc;font-weight:800}
        .warn{background:#fff8e6;border:1px solid #f0d493;color:#8a6100;padding:9px 12px;border-radius:8px;font-size:11.5px;margin-bottom:10px}
        .err{background:#fdecea;border-color:#f0a9a0;color:#8a2b22}
        .foot{margin-top:16px;font-size:10.5px;color:#8894a2;border-top:1px solid #eef2f7;padding-top:8px;line-height:1.9}
        @page{size:A4;margin:1.2cm}
        </style></head><body>
        <h1>${esc(co)} — فاتورة مشتريات مستخرَجة آلياً</h1>
        <div class="sub">رقم المستند في النظام: ${esc(c.id)} · <span class="st">${esc(st.ar || c.status)}</span> · الثقة ${c.confidence.overall}%</div>

        ${(c.validation.errors || []).length ? `<div class="warn err"><b>⛔ ${c.validation.errors.length} خطأ تحقّق:</b> ${esc(c.validation.errors.slice(0, 4).map(e => e.msg).join(' · '))}</div>` : ''}
        ${(c.duplicates || []).length ? `<div class="warn"><b>♻️ تكرار محتمل:</b> ${esc(c.duplicates.map(d => d.why).join(' · '))}</div>` : ''}

        <div class="box"><h3>بيانات الفاتورة</h3><div class="kv">
            <div><span>رقم الفاتورة</span><b>${esc(inv.number || '—')}</b></div>
            <div><span>التاريخ</span><b>${esc(inv.date || '—')}</b></div>
            <div><span>تاريخ الاستحقاق</span><b>${esc(inv.dueDate || '—')}</b></div>
            <div><span>العملة</span><b>${esc(inv.currency)}</b></div>
            <div><span>أمر الشراء</span><b>${esc(inv.poNumber || '—')}</b></div>
            <div><span>نوع المستند</span><b>${esc(inv.docType)}</b></div>
        </div></div>

        <div class="box"><h3>المورّد</h3><div class="kv">
            <div><span>الاسم</span><b>${esc(inv.supplier.name || '—')}</b></div>
            <div><span>الرقم الضريبي</span><b>${esc(inv.supplier.vatNumber || '—')}</b></div>
            <div><span>السجل التجاري</span><b>${esc(inv.supplier.crNumber || '—')}</b></div>
            <div><span>المربوط في النظام</span><b>${esc(vendor.nameAr || vendor.nameEn || 'غير مربوط')}</b></div>
        </div></div>

        <div class="box"><h3>الأصناف</h3>
        <table><thead><tr><th>#</th><th>الوصف</th><th class="n">الكمية</th><th>الوحدة</th><th class="n">السعر</th><th class="n">الخصم</th><th class="n">قبل الضريبة</th><th class="n">%</th><th class="n">الضريبة</th><th class="n">بعد الضريبة</th></tr></thead>
        <tbody>${inv.items.map((l, i) => { const cc = comp.lines[i] || {}; return `<tr><td>${i + 1}</td><td>${esc(l.description || '')}</td>
            <td class="n">${fmt(cc.qty)}</td><td>${esc(l.unit || '')}</td><td class="n">${fmt(cc.price)}</td>
            <td class="n">${cc.discount ? fmt(cc.discount) : '—'}</td><td class="n">${fmt(cc.taxable)}</td>
            <td class="n">${cc.rate}%</td><td class="n">${fmt(cc.vatAmount)}</td><td class="n">${fmt(cc.lineTotal)}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td colspan="6">الإجمالي</td><td class="n">${fmt(comp.taxable)}</td><td></td><td class="n">${fmt(comp.vat)}</td><td class="n">${fmt(comp.grandTotal)}</td></tr></tfoot>
        </table></div>

        <div class="box"><h3>القيد المحاسبي المقترح</h3>
        <table><thead><tr><th>الحساب</th><th>الاسم</th><th class="n">مدين</th><th class="n">دائن</th></tr></thead>
        <tbody>${je.lines.map(l => `<tr><td>${esc(l.code)}</td><td>${esc(l.name)}</td><td class="n">${l.debit ? fmt(l.debit) : ''}</td><td class="n">${l.credit ? fmt(l.credit) : ''}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="2">الإجمالي</td><td class="n">${fmt(je.totalDebit)}</td><td class="n">${fmt(je.totalCredit)}</td></tr></tfoot>
        </table></div>

        <div class="foot">
            استُخرجت بياناتها آلياً بواسطة الذكاء الاصطناعي، وأُعيد احتساب جميع المبالغ والضرائب داخل النظام والتحقق منها.
            ${(c.edits || []).length ? `عُدِّل ${(c.edits || []).length} حقل يدوياً بعد الاستخراج.` : 'لم تُعدَّل أي قيمة يدوياً.'}
            رُفعت بواسطة ${esc(c.uploadedByName || c.uploadedBy || '')} في ${c.uploadedAt ? new Date(c.uploadedAt).toLocaleString('ar-EG') : ''}.
            ${c.approvedBy ? `اعتُمدت بواسطة ${esc(c.approvedByName || c.approvedBy)}.` : 'لم تُعتمد بعد.'}
            هذا المستند تقرير داخلي وليس فاتورة ضريبية صادرة.
        </div>
        <script>setTimeout(function(){window.print()},500)<\/script>
        </body></html>`);
        w.document.close();
        AINV.Audit.log('تصدير PDF', `صُدِّرت «${inv.number || c.fileName}» إلى PDF`, { aiInvoiceId: c.id });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-SET] إعدادات المدير (§32)
    // ═══════════════════════════════════════════════════════════════════════════
    function modal(id, title, body, footer, wide) {
        let ov = $(id);
        if (!ov) { ov = document.createElement('div'); ov.id = id; ov.className = 'ai-modal'; document.body.appendChild(ov); }
        ov.innerHTML = `<div class="ai-modal-box" style="max-width:${wide || 620}px">
            <div class="ai-modal-h">${title}<button onclick="aiCloseModal('${id}')">✕</button></div>
            <div class="ai-modal-b">${body}</div>
            <div class="ai-modal-f">${footer || ''}</div></div>`;
        ov.classList.add('show');
    }
    window.aiCloseModal = id => { const e = $(id); if (e) e.classList.remove('show'); };

    /** نسخ أمر إلى الحافظة — يقرأ النص من العنصر الشقيق لا من وسيط داخل onclick
     *  (تمريره كنصّ في السمة فخّ: محلّل HTML يفكّ &#39; إلى ' قبل أن يقرأه JS) */
    window.aiCopy = function (btn) {
        const code = btn.parentNode.querySelector('code');
        const text = code ? code.textContent : '';
        const done = () => { const o = btn.textContent; btn.textContent = '✅'; setTimeout(() => { btn.textContent = o; }, 1200); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, () => toast('تعذّر النسخ — انسخه يدوياً', 'er'));
        } else {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { toast('تعذّر النسخ — انسخه يدوياً', 'er'); }
            ta.remove();
        }
    };

    /** سطر أمر قابل للنسخ داخل دليل التركيب */
    function cmd(text) {
        return `<div class="ai-cmd"><code dir="ltr">${esc(text)}</code>` +
            `<button type="button" class="ai-cmd-c" title="نسخ" onclick="aiCopy(this)">⧉</button></div>`;
    }

    window.aiSettings = function () {
        if (!IS_ADMIN()) { toast('🚫 للمدير فقط', 'er'); return; }
        const c = AINV.Config.get();
        const rd = AINV.Config.ready();       // ‏{ ok, reason } — لا قيمة منطقية
        const ready = !!(rd && rd.ok);
        modal('aiSetOv', '⚙️ إعدادات قراءة الفواتير بالذكاء الاصطناعي', `
            <label class="ai-toggle"><input type="checkbox" id="asEnabled" ${c.enabled ? 'checked' : ''}> تفعيل الوحدة</label>

            <div class="ai-sec">🔑 مفتاح Gemini (مجاني — بلا Worker)
                <span class="ai-pill ${ready ? 'ok' : 'warn'}">${ready ? '✅ جاهز' : '⚠️ غير جاهز'}</span></div>
            ${ready ? '' : `<div class="ai-step-d" style="margin:-2px 0 8px">⛔ ${esc(rd.reason || '')}</div>`}

            <label class="ai-f"><span class="ai-f-l">مفتاح Gemini</span>
                <input id="asGeminiKey" type="password" dir="ltr" placeholder="AIza…" value="${esc(c.geminiKey || '')}"></label>
            <button class="btn b-b" onclick="aiTestGemini()">🔌 اختبار المفتاح</button>
            <div id="asTest" class="ai-meta"></div>

            <div class="ai-note">🔐 <b>هذا المفتاح مخزَّن في إعدادات التطبيق ويقرؤه المتصفّح</b> (لا Worker).
                لمفتاح مجاني هذا مقبول، لكن <b>قيّده بنطاق تطبيقك في Google</b> ليعمل من موقعك فقط —
                فحتى لو ظهر لا يُستعمل من مكان آخر.</div>

            <details class="ai-steps" ${ready ? '' : 'open'}>
                <summary>📘 خطوتان لمرّة واحدة — الحصول على المفتاح وتقييده</summary>

                <div class="ai-step"><b>1️⃣ احصل على مفتاح مجاني</b>
                    <div class="ai-step-d">افتح
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">aistudio.google.com/app/apikey</a>
                        ← <b>Create API key</b> (بلا بطاقة دفع). القيمة تبدأ بـ<code dir="ltr">AIza</code> —
                        انسخها بزر النسخ 📋 والصقها في الحقل بالأعلى.</div></div>

                <div class="ai-step"><b>2️⃣ قيّد المفتاح بنطاقك (مهم للأمان)</b>
                    <div class="ai-step-d">افتح
                        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">console.cloud.google.com/apis/credentials</a>
                        ← اختر المفتاح ←
                        <b>Application restrictions</b> = <b>Websites</b> وأضف نطاقات تطبيقك:</div>
                    ${cmd('emplyeeapp-1dc64.web.app/*')}
                    ${cmd('emplyeeapp-1dc64.firebaseapp.com/*')}
                    <div class="ai-step-d">ثم <b>API restrictions</b> = <b>Generative Language API</b> فقط ← Save.
                        <br><span class="ai-meta">لو تستخدم نطاقاً مخصّصاً أضِفه أيضاً. بلا هذا التقييد يعمل المفتاح من أي مكان لو ظهر.</span></div></div>
            </details>

            <details class="ai-steps">
                <summary>🔧 خيار متقدّم: وسيط Cloudflare (لازم لـAnthropic فقط)</summary>
                <div class="ai-step-d ai-meta" style="margin-bottom:6px">لست بحاجة إليه مع Gemini. اتركه فارغاً.
                    يلزم فقط إن اخترت مزوّد Anthropic (مدفوع) الذي لا يُوضع مفتاحه في المتصفّح.</div>
                ${cmd('cd workers/invoice-ai-proxy && npx wrangler login && npx wrangler deploy')}
                ${cmd('printf \'%s\' "$(pbpaste)" | npx wrangler secret put ANTHROPIC_API_KEY')}
                <label class="ai-f" style="margin-top:6px"><span class="ai-f-l">رابط الوسيط (اختياري)</span>
                    <input id="asProxy" dir="ltr" placeholder="https://gbr-invoice-ai-proxy.xxx.workers.dev" value="${esc(c.proxyUrl)}"></label>
                <button class="btn b-b" onclick="aiTestProxy()">🔌 اختبار الوسيط</button>
            </details>

            <div class="ai-sec">🧠 المحرك (المزوّد)</div>
            <div class="ai-grid2">
                <label class="ai-f"><span class="ai-f-l">المزوّد</span><select id="asProvider">
                    <option value="gemini" ${(c.provider || 'gemini') === 'gemini' ? 'selected' : ''}>Google Gemini — مجاني (موصى به)</option>
                    <option value="anthropic" ${c.provider === 'anthropic' ? 'selected' : ''}>Anthropic Claude — مدفوع بالـAPI</option>
                </select></label>
                <label class="ai-f"><span class="ai-f-l">نموذج Gemini</span><select id="asGeminiModel">
                    <option value="gemini-2.5-flash" ${(c.geminiModel || 'gemini-2.5-flash') === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash — الأدق (موصى به)</option>
                    <option value="gemini-2.5-flash-lite" ${c.geminiModel === 'gemini-2.5-flash-lite' ? 'selected' : ''}>Gemini 2.5 Flash-Lite — الأسرع</option>
                    <option value="gemini-2.0-flash" ${c.geminiModel === 'gemini-2.0-flash' ? 'selected' : ''}>Gemini 2.0 Flash</option>
                </select></label>
                <label class="ai-f"><span class="ai-f-l">نموذج Claude</span><select id="asModel">
                    <option value="claude-opus-5" ${c.model === 'claude-opus-5' ? 'selected' : ''}>Opus 5 — الأدق</option>
                    <option value="claude-sonnet-5" ${c.model === 'claude-sonnet-5' ? 'selected' : ''}>Sonnet 5 — متوازن</option>
                    <option value="claude-haiku-4-5" ${c.model === 'claude-haiku-4-5' ? 'selected' : ''}>Haiku 4.5 — الأرخص</option>
                </select></label>
                <label class="ai-f"><span class="ai-f-l">عمق المعالجة (Claude)</span><select id="asEffort">
                    ${['low', 'medium', 'high', 'xhigh'].map(e => `<option value="${e}" ${c.effort === e ? 'selected' : ''}>${e}</option>`).join('')}
                </select></label>
                <label class="ai-f"><span class="ai-f-l">عتبة الثقة %</span><input type="number" id="asConf" min="50" max="100" value="${c.confidenceThreshold}"></label>
                <label class="ai-f"><span class="ai-f-l">أقصى حجم ملف (م.ب)</span><input type="number" id="asMaxMB" min="1" max="12" value="${c.maxFileMB}"></label>
                <label class="ai-f"><span class="ai-f-l">عدد المحاولات</span><input type="number" id="asRetry" min="0" max="5" value="${c.retryCount}"></label>
                <label class="ai-f"><span class="ai-f-l">المهلة (ثانية)</span><input type="number" id="asTimeout" min="30" max="300" value="${Math.round(c.timeoutMs / 1000)}"></label>
            </div>
            <label class="ai-toggle"><input type="checkbox" id="asOcrFallback" ${c.ocrFallback !== false ? 'checked' : ''}>
                عند نفاد حصّة Gemini المجانية → قراءة محلية مجانية (OCR)
                <span class="ai-meta">(تقديرية — تُعرَض للمراجعة دائماً)</span></label>

            <div class="ai-sec">🛡️ قواعد الاعتماد</div>
            <label class="ai-toggle"><input type="checkbox" id="asBlockArith" ${c.blockOnArithmetic ? 'checked' : ''}>
                منع الاعتماد عند وجود خطأ حسابي <span class="ai-meta">(يُنصح ببقائه مفعّلاً)</span></label>
            <label class="ai-toggle"><input type="checkbox" id="asMatchVendor" ${c.autoMatchVendor ? 'checked' : ''}>
                ترشيح المورّد تلقائياً <span class="ai-meta">(لا يُنشئ مورّداً أبداً)</span></label>`,
            `<button class="btn" onclick="aiCloseModal('aiSetOv')">إلغاء</button>
             <button class="btn b-g" onclick="aiSaveSettings()">💾 حفظ</button>`);
    };

    // اختبار مفتاح Gemini المباشر: نداء خفيف لقائمة النماذج يتحقّق من صحّة المفتاح
    // وتقييد النطاق دون إنفاق حصّة استخراج.
    window.aiTestGemini = async function () {
        const el = $('asTest'); const key = ($('asGeminiKey').value || '').trim();
        if (!key) { el.textContent = '⚠️ الصق المفتاح أولاً'; return; }
        if (!/^AIza[A-Za-z0-9_-]{20,}$/.test(key)) {
            el.innerHTML = '<span style="color:#C0392B">❌ الشكل غير صالح — مفتاح Gemini يبدأ بـ<code dir="ltr">AIza</code>. قد تكون نسخت قيمة أخرى.</span>'; return;
        }
        el.textContent = '⏳ جارٍ الاختبار…';
        try {
            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                headers: { 'x-goog-api-key': key }
            });
            const j = await res.json().catch(() => ({}));
            if (res.ok) { el.innerHTML = '<span style="color:#1B8A4B">✅ المفتاح يعمل — Gemini جاهز</span>'; return; }
            const st = (j.error && j.error.status) || '';
            const msg = (j.error && j.error.message) || '';
            if (/api key not valid|API_KEY_INVALID/i.test(msg) || res.status === 400)
                el.innerHTML = '<span style="color:#C0392B">❌ المفتاح غير صالح — أعد نسخه كاملاً من aistudio.google.com</span>';
            else if (res.status === 403 || st === 'PERMISSION_DENIED')
                el.innerHTML = '<span style="color:#C0392B">❌ مرفوض (403) — غالباً تقييد النطاق لا يشمل هذا الموقع. أضِف نطاق تطبيقك في Google Cloud ← Credentials.</span>';
            else
                el.innerHTML = `<span style="color:#C0392B">❌ ${esc(st || res.status)} — ${esc(String(msg).slice(0, 140))}</span>`;
        } catch (e) {
            el.innerHTML = '<span style="color:#C0392B">❌ تعذّر الوصول إلى Gemini — تحقّق من الاتصال بالإنترنت</span>';
        }
    };

    window.aiTestProxy = async function () {
        const el = $('asTest'); const url = ($('asProxy').value || '').trim();
        if (!url) { el.textContent = '⚠️ أدخل الرابط أولاً'; return; }
        el.textContent = '⏳ جارٍ الاختبار…';
        try {
            const res = await fetch(url.replace(/\/+$/, '') + '/', { method: 'GET' });
            const j = await res.json();
            if (!j || !j.ok) { el.innerHTML = '<span style="color:#C0392B">❌ رد غير متوقّع من الرابط</span>'; return; }

            // الوسيط يُبلغ عن حالة كل مفتاح كقيم منطقية (لا يكشف منه شيئاً).
            // نعرض حالة Gemini (المجاني) وAnthropic معاً.
            const P = j.providers || {};
            const line = (name, label, setCmd, prov) => {
                // توافق مع وسيط أقدم يبلّغ عن Anthropic فقط في الجذر
                const info = prov || (name === 'anthropic' ? { keyConfigured: j.keyConfigured, keyFormatValid: j.keyFormatValid } : null);
                if (!info || info.keyConfigured == null) return '';
                if (info.keyConfigured === false) return `<div style="color:#8a6d00;margin-top:4px">◽ ${label}: غير مضبوط — <code dir="ltr">${setCmd}</code></div>`;
                if (info.keyFormatValid === false) return `<div style="color:#C0392B;margin-top:4px">❌ ${label}: مفتاح مقصوص أو ملوّث — أعد لصقه كاملاً: <code dir="ltr">${setCmd}</code></div>`;
                return `<div style="color:#1B8A4B;margin-top:4px">✅ ${label}: مضبوط وشكله سليم</div>`;
            };
            const keys = line('gemini', 'Gemini (مجاني)', 'npx wrangler secret put GEMINI_API_KEY', P.gemini)
                + line('anthropic', 'Anthropic', 'npx wrangler secret put ANTHROPIC_API_KEY', P.anthropic);
            const models = (P.gemini && P.gemini.models) ? [].concat(P.gemini.models, (P.anthropic && P.anthropic.models) || []) : (j.models || []);

            el.innerHTML = `<span style="color:#1B8A4B">✅ الوسيط يعمل — النماذج: ${esc(models.join('، '))}</span>${keys || '<div class="ai-meta" style="margin-top:4px">نسخة وسيط أقدم لا تُبلغ عن حالة المفاتيح</div>'}`;
        } catch (e) {
            el.innerHTML = `<span style="color:#C0392B">❌ تعذّر الوصول — تحقّق من الرابط ومن إضافته إلى connect-src في firebase.json</span>`;
        }
    };

    window.aiSaveSettings = async function () {
        try {
            await AINV.Config.save({
                enabled: $('asEnabled').checked,
                proxyUrl: ($('asProxy').value || '').trim(),
                geminiKey: ($('asGeminiKey').value || '').trim(),
                provider: $('asProvider').value,
                geminiModel: $('asGeminiModel').value,
                ocrFallback: $('asOcrFallback').checked,
                model: $('asModel').value,
                effort: $('asEffort').value,
                confidenceThreshold: Math.max(50, Math.min(100, +$('asConf').value || 85)),
                maxFileMB: Math.max(1, Math.min(12, +$('asMaxMB').value || 10)),
                retryCount: Math.max(0, Math.min(5, +$('asRetry').value || 2)),
                timeoutMs: Math.max(30, Math.min(300, +$('asTimeout').value || 120)) * 1000,
                blockOnArithmetic: $('asBlockArith').checked,
                autoMatchVendor: $('asMatchVendor').checked
            });
            await AINV.Audit.log('تعديل إعدادات قراءة الفواتير', 'حُدِّثت إعدادات وحدة قراءة الفواتير بالذكاء الاصطناعي');
            window.aiCloseModal('aiSetOv');
            toast('✅ حُفظت الإعدادات', 'ok');
            window.renderAiInvoices();
        } catch (e) { toast('تعذّر الحفظ: ' + e.message, 'er', 7000); }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-LOG] سجل المعالجة ولوحة التكلفة (§31 §33)
    // ═══════════════════════════════════════════════════════════════════════════
    window.aiProcessingLog = async function () {
        if (!IS_ADMIN()) { toast('🚫 للمدير فقط', 'er'); return; }
        modal('aiLogOv', '📋 سجل المعالجة ولوحة الاستخدام', '<div class="ai-meta">⏳ جارٍ التحميل…</div>', '', 900);
        let logs = {};
        try {
            const sn = await window.get(window.ref(window.db, 'ledger/aiInvoiceLog'));
            logs = sn.exists() ? sn.val() : {};
        } catch (e) { /* قد لا يملك صلاحية القراءة */ }

        const recs = Object.entries(window.aiInvoices || {});
        const rows = [];
        recs.forEach(([id, r]) => {
            const entries = Object.values(logs[id] || {});
            entries.forEach(e => rows.push(Object.assign({ id, fileName: r.fileName, status: r.status }, e)));
            if (!entries.length) rows.push({ id, fileName: r.fileName, status: r.status, at: r.uploadedAt, event: r.status, by: r.uploadedBy, ms: r.processingMs, estCost: r.estCost, model: r.model });
        });
        rows.sort((a, b) => (b.at || 0) - (a.at || 0));

        const done = recs.filter(([, r]) => ['extracted', 'validated', 'needs_review', 'draft', 'approved', 'posted'].includes(r.status));
        const failed = recs.filter(([, r]) => r.status === 'failed');
        const totalCost = recs.reduce((s, [, r]) => s + (r.estCost || 0), 0);
        const totalTok = recs.reduce((s, [, r]) => s + ((r.usage && (r.usage.input_tokens || 0) + (r.usage.output_tokens || 0)) || 0), 0);
        const avgMs = done.length ? done.reduce((s, [, r]) => s + (r.processingMs || 0), 0) / done.length : 0;

        const body = `
            <div class="ai-stats">
                <div class="ai-stat"><span>الفواتير المعالَجة</span><b>${recs.length}</b></div>
                <div class="ai-stat"><span>ناجحة</span><b style="color:#1B8A4B">${done.length}</b></div>
                <div class="ai-stat"><span>فاشلة</span><b style="color:#C0392B">${failed.length}</b></div>
                <div class="ai-stat"><span>متوسط زمن المعالجة</span><b>${(avgMs / 1000).toFixed(1)} ث</b></div>
                <div class="ai-stat"><span>إجمالي التوكنات</span><b>${totalTok.toLocaleString('en')}</b></div>
                <div class="ai-stat"><span>التكلفة التقديرية</span><b>$${totalCost.toFixed(3)}</b></div>
            </div>
            <div class="ai-note">التكلفة تقديرية بأسعار القائمة المعلنة للنماذج، للقياس والرقابة لا للفوترة.
                هذا السجل لا يحتوي أي بيانات مالية من الفواتير — أرقام معالجة فقط.</div>
            <div class="tw" style="max-height:420px;overflow:auto"><table class="ai-tbl">
                <thead><tr><th>الوقت</th><th>الملف</th><th>الحدث</th><th>النموذج</th><th class="n">الزمن</th><th class="n">توكنات</th><th class="n">التكلفة</th><th>المستخدم</th><th>الخطأ</th></tr></thead>
                <tbody>${rows.slice(0, 300).map(r => `<tr>
                    <td>${r.at ? new Date(r.at).toLocaleString('ar-EG') : '—'}</td>
                    <td>${esc(r.fileName || '')}</td>
                    <td>${esc((AINV.STATUS[r.event] || {}).ar || r.event || '')}</td>
                    <td>${esc(r.model || '—')}</td>
                    <td class="n">${r.ms ? (r.ms / 1000).toFixed(1) + ' ث' : '—'}</td>
                    <td class="n">${((r.inputTokens || 0) + (r.outputTokens || 0)) || '—'}</td>
                    <td class="n">${r.estCost ? '$' + r.estCost : '—'}</td>
                    <td>${esc(r.by || '')}</td>
                    <td class="ai-err-cell">${esc(r.error || '')}</td>
                </tr>`).join('')}</tbody>
            </table></div>`;
        modal('aiLogOv', '📋 سجل المعالجة ولوحة الاستخدام', body,
            `<button class="btn" onclick="aiCloseModal('aiLogOv')">إغلاق</button>
             <button class="btn b-b" onclick="aiExportAllExcel()">📊 تصدير</button>`, 900);
    };

    console.log('✅ AI Invoice Actions [AC] loaded');
})();
