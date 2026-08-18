// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║   🤖 نظام استخراج وتدقيق وتصدير الفواتير — الإجراءات والتكامل (Actions)       ║
// ║   ────────────────────────────────────────────────────────────────────────    ║
// ║   [AC-EDIT]   التحرير · الربط · التجاوُز المسبَّب — كلّها تُسجَّل في أثر التدقيق  ║
// ║   [AC-FLOW]   حفظ مسوّدة · اعتماد · رفض · حذف · إعادة محاولة                  ║
// ║   [AC-CONV]   التحويل إلى فاتورة مشتريات (لا ترحيل بلا موافقة صريحة)          ║
// ║   [AC-ACC]    معاينة القيد المحاسبي قبل الالتزام به                           ║
// ║   [AC-XLS]    تصدير Excel بستّ أوراق                                          ║
// ║   [AC-PDF]    تقرير تحقّق PDF احترافي                                          ║
// ║   [AC-JSON]   حمولة التكامل مع الأنظمة الخارجية                               ║
// ║   [AC-ADMIN]  الإعدادات · الحصّة اليومية · لوحة المدير · سجل المعالجة          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
/* global AINV, AIU, XLSX */

(function () {
    'use strict';

    const esc = window.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const $ = id => document.getElementById(id);
    const toast = (m, t, d) => (window.toast ? window.toast(m, t, d) : console.log(m));
    const fmt = n => (window.fmt ? window.fmt(n) : (Number(n) || 0).toFixed(2));
    const IS_ADMIN = () => (window.myP && window.myP.role === 'admin');
    const cur = () => AIU.current;

    async function confirmAsk(msg) {
        if (typeof window.cf2 === 'function') return window.cf2(msg);
        return confirm(msg);
    }

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

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-EDIT] التحرير والربط والتجاوُز
    // ───────────────────────────────────────────────────────────────────────────
    // كل تعديل يفعل ثلاثة أشياء معاً: يغيّر القيمة، ويعلّم أثر الحقل بأن بشراً
    // غيّره (مع حفظ قيمة الذكاء الاصطناعي الأصلية)، ويعيد تشغيل محرّك التحقق —
    // لأن تعديل رقم واحد قد يُنشئ أو يُزيل مانع اعتماد.
    // ═══════════════════════════════════════════════════════════════════════════

    const PROV_OF = {
        invoice_number: 'invoice_number', invoice_date: 'invoice_date', due_date: 'due_date',
        currency: 'currency', 'supplier.name': 'supplier_name', 'supplier.vat_number': 'supplier_vat',
        'supplier.commercial_registration': 'supplier_cr',
        'totals.vat_total': 'totals_vat', 'totals.grand_total': 'totals_grand_total'
    };

    const NUMERIC = /^(totals\.|items\.\d+\.(quantity|unit_price|discount|vat_rate|taxable_amount|vat_amount|total_amount))/;

    function setPath(obj, path, value) {
        const parts = path.split('.');
        let o = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            const k = parts[i];
            if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
            o = o[k];
        }
        o[parts[parts.length - 1]] = value;
    }
    function getPath(o, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }

    window.aiEditField = function (el) {
        const r = cur(); if (!r) return;
        if (AINV.isLocked(r)) { toast('السجل مقفل — لا يقبل التعديل في حالته الحالية', 'er'); return; }
        if (!AINV.may('edit')) { toast('لا تملك صلاحية التعديل', 'er'); return; }

        const path = el.dataset.path;
        const raw = el.value;
        const before = getPath(r, path);
        const value = NUMERIC.test(path) ? (raw === '' ? null : AINV.num(raw)) : raw.trim();

        if (String(before == null ? '' : before) === String(value == null ? '' : value)) return;

        setPath(r, path, value);

        // أثر الحقل: من غيّره ومتى، مع الاحتفاظ بقيمة الذكاء الاصطناعي الأصلية
        const pk = PROV_OF[path];
        if (pk) {
            r.provenance = r.provenance || {};
            r.provenance[pk] = AINV.Audit.touch(r.provenance[pk], value);
        }

        // أثر التدقيق على مستوى الحدث
        r._pendingEdits = r._pendingEdits || [];
        r._pendingEdits.push(AINV.Audit.event({
            action: 'MODIFIED_FIELD', action_ar: 'تعديل حقل',
            field_name: path, old_value: before, new_value: value, source: 'user_input'
        }));

        revalidate(r);
        AIU.dirty = true;
        window.aiRenderReview();
    };

    /** يعيد تشغيل التحقق والثقة والتكرار بعد أي تعديل. */
    function revalidate(r) {
        // نحافظ على التجاوزات المسجَّلة عبر إعادة التحقق
        const overrides = {};
        AINV.toArray(r.validation_issues).forEach(i => {
            if (i.resolved) overrides[i.id] = { override_reason: i.override_reason, override_by: i.override_by, override_at: i.override_at };
        });

        const issues = AINV.Validate.run(r);
        issues.forEach(i => {
            if (overrides[i.id]) Object.assign(i, overrides[i.id], { resolved: true });
        });
        r.validation_issues = issues;

        const conf = AINV.confidence(r, issues);
        r.confidence_percent = conf.percent;
        r.confidence_overall = conf.overall;
        r.low_fields = conf.lowFields;
    }

    window.aiUseAltDate = function () {
        const r = cur(); if (!r || !r.date_alt) return;
        const before = r.invoice_date;
        r.invoice_date = r.date_alt;
        r.date_alt = before;
        r.provenance = r.provenance || {};
        r.provenance.invoice_date = AINV.Audit.touch(r.provenance.invoice_date, r.invoice_date);
        r._pendingEdits = (r._pendingEdits || []).concat(AINV.Audit.event({
            action: 'RESOLVED_AMBIGUOUS_DATE', action_ar: 'تأكيد التاريخ الغامض',
            field_name: 'invoice_date', old_value: before, new_value: r.invoice_date, source: 'user_input'
        }));
        revalidate(r); AIU.dirty = true; window.aiRenderReview();
    };

    window.aiLinkVendor = function (key) {
        const r = cur(); if (!r) return;
        const before = r.vendorKey || '';
        r.vendorKey = key || '';
        const v = (window.vendors || {})[key];
        r._pendingEdits = (r._pendingEdits || []).concat(AINV.Audit.event({
            action: key ? 'LINKED_SUPPLIER' : 'UNLINKED_SUPPLIER',
            action_ar: key ? 'ربط المورد بسجلات النظام' : 'إلغاء ربط المورد',
            field_name: 'vendorKey', old_value: before, new_value: key,
            notes: v ? (v.nameAr || v.nameEn || '') : '', source: 'user_input'
        }));
        AIU.dirty = true; window.aiRenderReview();
    };

    window.aiLinkItem = function (i, key) {
        const r = cur(); if (!r) return;
        r.itemMatches = AINV.toArray(r.itemMatches);
        const before = (r.itemMatches[i] && r.itemMatches[i].key) || '';
        const cat = AINV.Match.systemItems().find(x => x.key === key);
        r.itemMatches[i] = key ? { key, confidence: 1, match_type: 'USER_LINKED', name: cat && cat.name } : { key: '', confidence: 0, match_type: 'NO_MATCH' };
        r._pendingEdits = (r._pendingEdits || []).concat(AINV.Audit.event({
            action: 'LINKED_ITEM', action_ar: `ربط البند ${i + 1} بصنف`,
            field_name: `itemMatches[${i}]`, old_value: before, new_value: key, source: 'user_input'
        }));
        AIU.dirty = true; window.aiRenderReview();
    };

    window.aiAddLine = function () {
        const r = cur(); if (!r) return;
        r.items = AINV.toArray(r.items);
        r.items.push({ id: 'line-' + (r.items.length + 1), item_name: '', quantity: 1, unit: 'وحدة', unit_price: 0, discount: 0, vat_rate: 15 });
        revalidate(r); AIU.dirty = true; window.aiRenderReview();
    };

    window.aiDelLine = function (i) {
        const r = cur(); if (!r) return;
        r.items = AINV.toArray(r.items);
        const gone = r.items[i];
        r.items.splice(i, 1);
        r.itemMatches = AINV.toArray(r.itemMatches); r.itemMatches.splice(i, 1);
        r._pendingEdits = (r._pendingEdits || []).concat(AINV.Audit.event({
            action: 'DELETED_LINE', action_ar: `حذف البند ${i + 1}`,
            field_name: 'items', old_value: gone && gone.item_name, new_value: null, source: 'user_input'
        }));
        revalidate(r); AIU.dirty = true; window.aiRenderReview();
    };

    window.aiDismissDup = function () {
        const r = cur(); if (!r) return;
        r.duplicate_dismissed = true;
        r._pendingEdits = (r._pendingEdits || []).concat(AINV.Audit.event({
            action: 'DISMISSED_DUPLICATE', action_ar: 'تجاهل تحذير التكرار',
            notes: r.duplicate_warning && r.duplicate_warning.message_ar, source: 'user_input'
        }));
        AIU.dirty = true; window.aiRenderReview();
    };

    /**
     * تجاوُز مانع اعتماد — بسبب مكتوب واسم من تجاوزه.
     * التجاوُز الصامت هو ما يحوّل نظام تحقق إلى ديكور؛ لذلك السبب إلزامي ويُخزَّن.
     */
    window.aiOverride = function (idx) {
        const r = cur(); if (!r) return;
        const issue = AINV.toArray(r.validation_issues)[idx]; if (!issue) return;
        modal('aiOverrideModal', '⚖️ تجاوُز مانع اعتماد',
            `<div class="ai-note wn"><b>${esc(issue.message_ar || issue.message)}</b>
                <div class="ai-meta">الرمز: ${esc(issue.code)}</div></div>
             <p>هذا المانع وُضع لأن النظام رصد اختلافاً حقيقياً. التجاوُز يُسجَّل باسمك وتاريخه ويظهر لأي مدقّق لاحقاً.</p>
             <div class="ai-f"><label class="ai-f-l">سبب التجاوُز (إلزامي)</label>
                <textarea class="ai-inp" id="aiOvrReason" rows="3" placeholder="مثال: راجعتُ الأصل الورقي والفرق ناتج عن تقريب المورد، وأرفقتُ إشعاراً منه."></textarea></div>`,
            `<button class="btn" onclick="aiCloseModal('aiOverrideModal')">إلغاء</button>
             <button class="btn b-w" onclick="aiOverrideConfirm(${idx})">تسجيل التجاوُز</button>`);
    };

    window.aiOverrideConfirm = function (idx) {
        const r = cur(); if (!r) return;
        const reason = ($('aiOvrReason').value || '').trim();
        if (reason.length < 10) { toast('اكتب سبباً واضحاً (10 أحرف على الأقل)', 'er'); return; }
        const issue = AINV.toArray(r.validation_issues)[idx]; if (!issue) return;
        issue.resolved = true;
        issue.override_reason = reason;
        issue.override_by = (window.myP && window.myP.name) || (window.curU && window.curU.email) || '';
        issue.override_at = new Date().toISOString();
        r._pendingEdits = (r._pendingEdits || []).concat(AINV.Audit.event({
            action: 'OVERRODE_BLOCKING_ISSUE', action_ar: 'تجاوُز مانع اعتماد',
            field_name: issue.field, notes: issue.code + ' — ' + reason, source: 'user_input'
        }));
        AINV.Audit.log('تجاوُز مانع اعتماد', `${issue.code} في «${r.invoice_number || ''}» — ${reason}`, { recordId: r.id });
        AIU.dirty = true;
        window.aiCloseModal('aiOverrideModal');
        window.aiRenderReview();
    };

    /**
     * إنشاء مورد جديد في النظام من بيانات الفاتورة مباشرةً.
     * نحترم قواعد صفحة الموردين نفسها: رمز مولَّد، والرقم الضريبي 15 خانة.
     * في نمط «مجموعات الموردين» اختيار المجموعة قرار محاسبي يحدّد حساب الأستاذ —
     * فلا نخمّنه هنا، بل نحيل المستخدم إلى صفحة الموردين.
     */
    window.aiCreateVendor = async function () {
        const r = cur(); if (!r) return;
        const s = r.supplier || {};
        if (!s.name) { toast('اسم المورد فارغ — أكمِله أولاً', 'er'); return; }

        if (typeof window.arApMode === 'function' && window.arApMode() === 'groups') {
            toast('نمط «مجموعات الموردين» مفعّل — أنشئ المورد من صفحة الموردين لاختيار مجموعته (تحدّد حساب الأستاذ)', 'wn', 9000);
            return;
        }

        const vat = AINV.digitsOf(s.vat_number);
        if (vat && vat.length !== 15) {
            toast('الرقم الضريبي المستخرَج ليس 15 خانة — صحّحه قبل إنشاء المورد', 'er', 7000);
            return;
        }
        if (!await confirmAsk(`إنشاء مورد جديد باسم «${s.name}» في سجلات النظام؟`)) return;

        try {
            const now = new Date().toISOString();
            const code = (typeof window.generateVendorCode === 'function') ? window.generateVendorCode() : ('V-' + Date.now().toString().slice(-6));
            const data = {
                code, type: 'supplier', groupId: '', groupAccount: '',
                nameAr: s.name, nameEn: s.legal_name || '',
                contact: '', phone: s.phone || '', email: s.email || '',
                iban: s.iban || '', vatNumber: vat, crNumber: AINV.digitsOf(s.commercial_registration),
                address: s.address || '',
                openingBalance: 0, paymentTerms: 30, creditLimit: 0,
                notes: 'أُنشئ تلقائياً من قراءة فاتورة بالذكاء الاصطناعي',
                active: true,
                createdAt: now, createdBy: (window.curU && window.curU.uid) || 'system',
                updatedAt: now, updatedBy: (window.curU && window.curU.uid) || 'system'
            };
            const ref = await window.push(window.R.vend, data);
            r.vendorKey = ref.key;
            r._pendingEdits = (r._pendingEdits || []).concat(AINV.Audit.event({
                action: 'CREATED_SUPPLIER', action_ar: 'إنشاء مورد جديد من الفاتورة',
                new_value: s.name, notes: 'رمز المورد: ' + code, source: 'user_input'
            }));
            AINV.Audit.log('إنشاء مورد', `أُنشئ المورد «${s.name}» (${code}) من فاتورة مقروءة آلياً`, { recordId: r.id });
            toast('✅ أُنشئ المورد ورُبط بالفاتورة', 'ok');
            AIU.dirty = true; window.aiRenderReview();
        } catch (e) { toast('❌ تعذّر إنشاء المورد: ' + (e.message || e), 'er'); }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-FLOW] حفظ · اعتماد · رفض · حذف · إعادة محاولة
    // ═══════════════════════════════════════════════════════════════════════════

    /** يبني الحمولة القابلة للكتابة من السجل المفتوح. */
    function payload(r, extra) {
        const out = Object.assign({}, r, extra || {});
        delete out.id; delete out._pendingEdits;
        // أثر التدقيق: نضيف الأحداث المعلّقة إلى السجل التراكمي
        const pending = AINV.toArray(r._pendingEdits);
        if (pending.length) out.audit_trail = AINV.toArray(r.audit_trail).concat(pending);
        return out;
    }

    async function commit(r, extra, successMsg) {
        const data = payload(r, extra);
        await AINV.Store.update(r.id, data);
        r.audit_trail = AINV.toArray(data.audit_trail);
        r._pendingEdits = [];
        AIU.dirty = false;
        Object.assign(r, extra || {});
        if (successMsg) toast(successMsg, 'ok');
    }

    window.aiSaveDraft = async function () {
        const r = cur(); if (!r) return;
        if (!AINV.may('edit')) { toast('لا تملك صلاحية التعديل', 'er'); return; }
        try {
            revalidate(r);
            const status = (r.status === 'processing' || r.status === 'failed') ? r.status
                : (AINV.Validate.hasBlocking(r.validation_issues) ? 'needs_review' : 'validated');
            await commit(r, { status }, '💾 حُفظت المسوّدة');
            window.aiRenderReview();
        } catch (e) { toast('❌ تعذّر الحفظ: ' + (e.message || e), 'er'); }
    };

    /**
     * الاعتماد — البوابة الوحيدة نحو المحاسبة.
     * لا يمرّ مع مانع قائم، ولا بلا ربط مورد: الاعتماد يعني «هذه البيانات صالحة
     * لتُصبح التزاماً مالياً»، فمن يعتمدها يوقّع عليها باسمه.
     */
    window.aiApprove = async function () {
        const r = cur(); if (!r) return;
        if (!AINV.may('approve')) { toast('لا تملك صلاحية الاعتماد', 'er'); return; }

        revalidate(r);
        const sum = AINV.Validate.summary(r.validation_issues);
        if (sum.blocking) { toast(`⛔ لا يمكن الاعتماد — ${sum.blocking} مانع قائم. عالِجها أو سجّل تجاوُزاً مسبَّباً.`, 'er', 8000); window.aiRenderReview(); return; }
        if (!r.vendorKey) { toast('⚠️ اربط الفاتورة بمورد في النظام قبل الاعتماد — بدونه لا يُرحَّل الرصيد إلى كشف حسابه', 'er', 9000); return; }

        const cfg = AINV.Config.get();
        if (r.duplicate_warning && !r.duplicate_dismissed && cfg.blockOnDuplicate) {
            toast('⛔ تحذير تكرار قائم — عالِجه قبل الاعتماد', 'er', 7000); return;
        }

        const t = r.totals || {};
        const warn = (r.duplicate_warning && !r.duplicate_dismissed) ? '\n\n⚠️ ما زال تحذير التكرار قائماً.' : '';
        if (!await confirmAsk(`اعتماد الفاتورة ${r.invoice_number || ''} بمبلغ ${fmt(t.grand_total)} ${r.currency || 'SAR'}؟${warn}`)) return;

        try {
            const uid = (window.curU && window.curU.uid) || '';
            r._pendingEdits = (r._pendingEdits || []).concat(AINV.Audit.event({
                action: 'APPROVED', action_ar: 'اعتماد الفاتورة',
                notes: `المبلغ ${fmt(t.grand_total)} ${r.currency || 'SAR'} · الثقة ${r.confidence_percent}%`
            }));
            await commit(r, {
                status: 'approved',
                approvedBy: uid,                         // ← اسم الحقل تحرسه قواعد الأمان
                approved_at: new Date().toISOString(),
                approved_by_name: (window.myP && window.myP.name) || (window.curU && window.curU.email) || ''
            }, '✅ اعتُمدت الفاتورة');
            AINV.Audit.log('اعتماد فاتورة مقروءة آلياً', `${r.invoice_number || ''} — ${fmt(t.grand_total)} ${r.currency || 'SAR'}`, { recordId: r.id });
            await AINV.Store.log(r.id, { event: 'approved', amount: t.grand_total, confidence: r.confidence_percent });
            window.aiRenderReview();
        } catch (e) { toast('❌ تعذّر الاعتماد: ' + (e.message || e), 'er'); }
    };

    window.aiReject = function () {
        const r = cur(); if (!r) return;
        if (!AINV.may('reject')) { toast('لا تملك صلاحية الرفض', 'er'); return; }
        modal('aiRejectModal', '⛔ رفض الفاتورة',
            `<p>الرفض يُغلق السجل ويستبعده من كشف التكرار. اكتب سبباً يفهمه من يراجع لاحقاً.</p>
             <div class="ai-f"><label class="ai-f-l">سبب الرفض (إلزامي)</label>
                <textarea class="ai-inp" id="aiRejReason" rows="3" placeholder="مثال: المستند غير مقروء / ليس فاتورة / مكرّرة لفاتورة رقم…"></textarea></div>`,
            `<button class="btn" onclick="aiCloseModal('aiRejectModal')">إلغاء</button>
             <button class="btn b-r" onclick="aiRejectConfirm()">تأكيد الرفض</button>`);
    };

    window.aiRejectConfirm = async function () {
        const r = cur(); if (!r) return;
        const reason = ($('aiRejReason').value || '').trim();
        if (reason.length < 5) { toast('اكتب سبب الرفض', 'er'); return; }
        try {
            r._pendingEdits = (r._pendingEdits || []).concat(AINV.Audit.event({
                action: 'REJECTED', action_ar: 'رفض الفاتورة', notes: reason
            }));
            await commit(r, {
                status: 'rejected', rejection_reason: reason,
                rejected_at: new Date().toISOString(),
                rejected_by_name: (window.myP && window.myP.name) || ''
            }, '⛔ رُفضت الفاتورة');
            AINV.Audit.log('رفض فاتورة مقروءة آلياً', `${r.invoice_number || ''} — ${reason}`, { recordId: r.id });
            window.aiCloseModal('aiRejectModal');
            window.aiRenderReview();
        } catch (e) { toast('❌ تعذّر الرفض: ' + (e.message || e), 'er'); }
    };

    window.aiDelete = async function (id) {
        if (!AINV.may('delete')) { toast('لا تملك صلاحية الحذف', 'er'); return; }
        const rec = AINV.Store.normalize(id, (window.aiInvoices || {})[id]); if (!rec) return;
        if (AINV.isLocked(rec)) { toast('لا يمكن حذف سجل معتمد أو مُرحَّل — هذا أثر محاسبي', 'er', 7000); return; }
        if (!await confirmAsk(`حذف سجل الفاتورة «${rec.invoice_number || (rec.file_metadata && rec.file_metadata.original_filename) || ''}» نهائياً؟`)) return;
        try {
            await AINV.Store.remove(id);
            AINV.Audit.log('حذف سجل قراءة فاتورة', rec.invoice_number || '', { recordId: id });
            toast('🗑️ حُذف السجل', 'ok');
            if (AIU.current && AIU.current.id === id) AIU.current = null;
            window.aiRerender();
        } catch (e) { toast('❌ تعذّر الحذف: ' + (e.message || e), 'er'); }
    };

    window.aiRetry = function () {
        const r = cur(); if (!r) return;
        toast('ارفع الملف مرة أخرى من الصفحة الرئيسية لإعادة المحاولة', 'wn', 6000);
        AIU.current = null;
        window.renderAiInvoices();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-CONV] التحويل إلى فاتورة مشتريات
    // ───────────────────────────────────────────────────────────────────────────
    // نُنشئ الفاتورة **مسوّدة** فقط. الترحيل وإنشاء القيد يبقيان قراراً بشرياً
    // منفصلاً في صفحة المشتريات — لأن ترحيلاً آلياً لبيانات قرأها نموذج هو
    // بالضبط ما يجعل خطأ استخراج واحداً خطأً محاسبياً مُرحَّلاً.
    // ═══════════════════════════════════════════════════════════════════════════

    window.aiConvert = async function () {
        const r = cur(); if (!r) return;
        if (!AINV.may('approve')) { toast('لا تملك صلاحية التحويل', 'er'); return; }
        if (r.status !== 'approved') { toast('اعتمِد الفاتورة أولاً', 'er'); return; }
        if (r.linkedPInvKey) { toast('حُوّلت هذه الفاتورة من قبل', 'wn'); return; }
        if (!r.vendorKey) { toast('اربط المورد أولاً', 'er'); return; }

        const prev = AINV.Accounting.preview(r);
        if (!prev.is_balanced) { toast('⛔ القيد غير متوازن — راجِع الإجماليات', 'er', 7000); return; }

        const blockers = prev.warnings.filter(w => w.includes('لن يُنشأ القيد'));
        if (blockers.length && !await confirmAsk('⚠️ ' + blockers.join('\n') + '\n\nهل تريد المتابعة رغم ذلك؟')) return;

        if (!await confirmAsk(`إنشاء فاتورة مشتريات **مسوّدة** بمبلغ ${fmt(prev.total_credits)} ${r.currency || 'SAR'}؟\n\nلن تُرحَّل ولن يُنشأ قيد إلا بأمرك من صفحة فواتير المشتريات.`)) return;

        try {
            const data = AINV.toPurchaseInvoice(Object.assign({}, r, { confidencePercent: r.confidence_percent }));
            // رقم الفاتورة يولّده النظام ذرّياً كما في savePInv
            if (typeof window.generatePInvNumberAtomic === 'function') {
                data.number = await window.generatePInvNumberAtomic();
            } else {
                data.number = 'PINV-AI-' + Date.now().toString().slice(-6);
            }
            const ref = await window.push(window.R.pinv, data);

            r._pendingEdits = (r._pendingEdits || []).concat(AINV.Audit.event({
                action: 'CONVERTED_TO_PURCHASE_INVOICE', action_ar: 'تحويل إلى فاتورة مشتريات (مسوّدة)',
                new_value: data.number, notes: `مبلغ ${fmt(data.grandTotal)} ${data.currency}`
            }));
            await commit(r, {
                status: 'posted',
                linkedPInvKey: ref.key,              // ← اسم الحقل تحرسه قواعد الأمان
                linked_pinv_number: data.number,
                converted_at: new Date().toISOString()
            }, `📒 أُنشئت فاتورة مشتريات مسوّدة ${data.number}`);

            AINV.Audit.log('تحويل فاتورة مقروءة آلياً', `${r.invoice_number || ''} ← فاتورة مشتريات ${data.number} (مسوّدة)`, { recordId: r.id, pinvKey: ref.key });
            await AINV.Store.log(r.id, { event: 'converted', pinvNumber: data.number, amount: data.grandTotal });

            toast('ℹ️ الفاتورة مسوّدة — رحّلها من صفحة فواتير المشتريات بعد المراجعة', 'wn', 9000);
            window.aiRenderReview();
        } catch (e) { toast('❌ تعذّر التحويل: ' + (e.message || e), 'er'); }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-ACC] معاينة القيد المحاسبي
    // ═══════════════════════════════════════════════════════════════════════════

    window.aiAccountingPreview = function () {
        const r = cur(); if (!r) return;
        const p = AINV.Accounting.preview(r);
        const rows = p.journal_lines.map(l => `<tr class="${l.exists ? '' : 'bad'}">
            <td class="mono">${esc(l.account_code)}${l.exists ? '' : ' <span class="ai-pill er">غير موجود</span>'}</td>
            <td>${esc(l.account_name)}</td>
            <td class="ai-meta">${esc(l.description)}</td>
            <td class="n">${l.debit ? fmt(l.debit) : ''}</td>
            <td class="n">${l.credit ? fmt(l.credit) : ''}</td></tr>`).join('');

        modal('aiAccModal', '📒 معاينة القيد المحاسبي',
            `<p class="ai-note">هذه محاكاة دقيقة لما سيفعله النظام عند الترحيل — من شجرة حساباتك أنت، لا من رموز عامة.</p>
             <div class="ai-meta">التاريخ: ${esc(p.date)} · المرجع: ${esc(p.reference)} · العملة: ${esc(p.currency)}</div>
             <div class="tw"><table class="ai-tbl sm">
                <thead><tr><th>الحساب</th><th>الاسم</th><th>البيان</th><th class="n">مدين</th><th class="n">دائن</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr class="tot"><td colspan="3">الإجمالي</td><td class="n"><b>${fmt(p.total_debits)}</b></td><td class="n"><b>${fmt(p.total_credits)}</b></td></tr></tfoot>
             </table></div>
             <div class="ai-note ${p.is_balanced ? 'ok' : 'er'}">${p.is_balanced ? '✅ القيد متوازن' : '⛔ القيد غير متوازن — لا يصلح للترحيل'}</div>
             ${p.warnings.length ? `<div class="ai-note wn"><b>تنبيهات:</b><ul>${p.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}`,
            `<button class="btn" onclick="aiCloseModal('aiAccModal')">إغلاق</button>`, 780);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // أثر التدقيق
    // ═══════════════════════════════════════════════════════════════════════════

    window.aiAuditTrail = function () {
        const r = cur(); if (!r) return;
        const all = AINV.toArray(r.audit_trail).concat(AINV.toArray(r._pendingEdits));
        const rows = all.length ? all.slice().reverse().map(e => `<tr>
            <td class="mono">${esc((e.timestamp || '').replace('T', ' ').slice(0, 19))}</td>
            <td>${esc(e.user_name || '—')}<div class="ai-meta">${esc(e.user_role || '')}</div></td>
            <td>${esc(e.action_ar || e.action)}</td>
            <td class="mono">${esc(e.field_name || '')}</td>
            <td>${e.old_value == null ? '' : `<s class="ai-old">${esc(String(e.old_value))}</s>`}</td>
            <td>${e.new_value == null ? '' : `<b>${esc(String(e.new_value))}</b>`}</td>
            <td class="ai-meta">${esc(e.notes || '')}</td>
        </tr>`).join('') : '<tr><td colspan="7" class="ai-meta">لا أحداث بعد</td></tr>';

        modal('aiAuditModal', '🕵️ أثر التدقيق — من غيّر ماذا ومتى',
            `<p class="ai-note">كل تعديل بشري على قيمة استخرجها الذكاء الاصطناعي مسجَّل هنا بقيمته قبل وبعد. هذا ما يجعل السجل صالحاً للعرض على مدقّق خارجي.</p>
             <div class="tw"><table class="ai-tbl sm">
                <thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>الحقل</th><th>قبل</th><th>بعد</th><th>ملاحظات</th></tr></thead>
                <tbody>${rows}</tbody></table></div>
             ${AINV.toArray(r._pendingEdits).length ? '<div class="ai-note wn">⚠️ بعض الأحداث لم تُحفظ بعد — احفظ المسوّدة لتثبيتها.</div>' : ''}`,
            `<button class="btn" onclick="aiCloseModal('aiAuditModal')">إغلاق</button>`, 900);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-XLS] تصدير Excel بستّ أوراق
    // ───────────────────────────────────────────────────────────────────────────
    // الأوراق الست ليست تزيّناً: كل ورقة تجيب سؤال جهة مختلفة — المحاسب يريد
    // البنود، والمدقّق يريد المشاكل وأثر التعديل، والضريبي يريد تفصيل النسب.
    // ═══════════════════════════════════════════════════════════════════════════

    function sheetsFor(r) {
        const comp = AINV.recompute(r).computed;
        const t = r.totals || {};
        const s = r.supplier || {};
        const q = r.qr_code || {};

        // 1) ملخّص الفاتورة
        const summary = [
            ['نظام استخراج وتدقيق الفواتير بالذكاء الاصطناعي'], [],
            ['نوع المستند', AINV.DOC_TYPE_AR[r.document_type] || r.document_type],
            ['رقم الفاتورة', r.invoice_number || ''],
            ['تاريخ الفاتورة', r.invoice_date || ''],
            ['تاريخ الاستحقاق', r.due_date || ''],
            ['رقم أمر الشراء', r.purchase_order_number || ''],
            ['العملة', r.currency || 'SAR'], [],
            ['المورد', s.name || ''],
            ['الاسم النظامي', s.legal_name || ''],
            ['الرقم الضريبي', s.vat_number || ''],
            ['السجل التجاري', s.commercial_registration || ''],
            ['الآيبان', s.iban || ''], [],
            ['المجموع قبل الخصم', comp.subtotal],
            ['إجمالي الخصم', comp.discount],
            ['المبلغ الخاضع للضريبة', comp.taxable],
            ['إجمالي الضريبة', comp.vat],
            ['الإجمالي شامل الضريبة', comp.grandTotal], [],
            ['الحالة', (AINV.STATUS[r.status] || {}).ar || r.status],
            ['ثقة النظام %', r.confidence_percent == null ? '' : r.confidence_percent],
            ['النموذج المستخدم', (r.processing_job && r.processing_job.model_used) || ''],
            ['قُرئت بالـOCR المحلي', (r.processing_job && r.processing_job.via_ocr) ? 'نعم' : 'لا'],
            ['الملف الأصلي', (r.file_metadata && r.file_metadata.original_filename) || ''],
            ['اعتمدها', r.approved_by_name || ''],
            ['تاريخ الاعتماد', r.approved_at || '']
        ];

        // 2) البنود — بقيم النظام المحسوبة لا بقيم النموذج
        const items = [['#', 'رمز الصنف', 'الوصف', 'الصنف المربوط', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الخصم', 'الخاضع للضريبة', 'نسبة %', 'الضريبة', 'الإجمالي']];
        AINV.toArray(r.items).forEach((it, i) => {
            const c = AINV.computeLine(it);
            const m = AINV.toArray(r.itemMatches)[i] || {};
            items.push([i + 1, it.item_code || it.sku || '', it.item_name || '', m.name || '',
                c.qty, it.unit || '', c.price, c.discount, c.taxable, c.rate, c.vatAmount, c.lineTotal]);
        });
        items.push([]);
        items.push(['', '', 'الإجمالي', '', '', '', '', comp.discount, comp.taxable, '', comp.vat, comp.grandTotal]);

        // 3) تفصيل الضريبة — أساس الإقرار
        const taxes = [['نسبة الضريبة %', 'الوعاء الخاضع', 'مبلغ الضريبة', 'التصنيف']];
        comp.taxes.forEach(x => taxes.push([x.tax_rate, x.taxable_amount, x.tax_amount,
            x.tax_category === 'STANDARD' ? 'أساسية' : x.tax_category === 'ZERO_RATED' ? 'صفرية' : x.tax_category]));

        // 4) نتائج التحقق
        const issues = [['الخطورة', 'الرمز', 'الحقل', 'يمنع الاعتماد', 'الوصف', 'القيمة المقروءة', 'المتوقّع', 'حالة التجاوُز', 'سبب التجاوُز', 'من تجاوزه']];
        AINV.toArray(r.validation_issues).forEach(i => issues.push([
            i.severity === 'ERROR' ? 'خطأ' : i.severity === 'WARNING' ? 'تحذير' : 'ملاحظة',
            i.code, i.field, i.blocking ? 'نعم' : 'لا', i.message_ar || i.message,
            i.actual_value == null ? '' : i.actual_value, i.expected_value == null ? '' : i.expected_value,
            i.resolved ? 'متجاوَز' : '', i.override_reason || '', i.override_by || ''
        ]));

        // 5) مصدر الحقول وأثر التدقيق
        const audit = [['— مصدر كل حقل —'], ['الحقل', 'المصدر', 'الثقة %', 'عدّله بشر', 'قيمة الذكاء الاصطناعي الأصلية', 'القيمة الحالية']];
        const P = r.provenance || {};
        Object.keys(P).forEach(k => {
            const p = P[k] || {};
            audit.push([k, AINV.SOURCE_AR[p.source] || p.source, Math.round(AINV.clamp01(p.confidence) * 100),
                p.user_modified ? 'نعم' : 'لا', p.original_ai_value == null ? '' : p.original_ai_value, p.value == null ? '' : p.value]);
        });
        audit.push([]); audit.push(['— أثر التدقيق —']);
        audit.push(['الوقت', 'المستخدم', 'الدور', 'الإجراء', 'الحقل', 'قبل', 'بعد', 'ملاحظات']);
        AINV.toArray(r.audit_trail).forEach(e => audit.push([
            (e.timestamp || '').replace('T', ' ').slice(0, 19), e.user_name || '', e.user_role || '',
            e.action_ar || e.action, e.field_name || '', e.old_value == null ? '' : e.old_value,
            e.new_value == null ? '' : e.new_value, e.notes || ''
        ]));

        // 6) رمز الزكاة والضريبة + القيد المحاسبي
        const zatca = [['— رمز الزكاة والضريبة (ZATCA QR) —']];
        if (q.is_zatca_compliant) {
            zatca.push(['الحقل', 'في الرمز', 'على وجه الفاتورة', 'النتيجة']);
            const bad = f => AINV.toArray(q.mismatches).some(m => m.field === f);
            zatca.push(['اسم البائع', q.seller_name || '', s.name || '', bad('seller_name') ? 'مختلف' : 'مطابق']);
            zatca.push(['الرقم الضريبي', q.vat_registration_number || '', s.vat_number || '', bad('vat_number') ? 'مختلف' : 'مطابق']);
            zatca.push(['الإجمالي شامل الضريبة', q.invoice_total_with_vat == null ? '' : q.invoice_total_with_vat, t.grand_total == null ? '' : t.grand_total, bad('grand_total') ? 'مختلف' : 'مطابق']);
            zatca.push(['مبلغ الضريبة', q.vat_total == null ? '' : q.vat_total, t.vat_total == null ? '' : t.vat_total, bad('vat_total') ? 'مختلف' : 'مطابق']);
            zatca.push(['ختم الوقت', q.invoice_timestamp || '', '', '']);
            zatca.push(['توقيع المرحلة الثانية', q.has_phase2_signature ? 'موجود' : 'غير موجود', '', '']);
        } else {
            zatca.push(['لم يُرصد رمز بصيغة الهيئة في هذا المستند']);
        }
        zatca.push([]); zatca.push(['— معاينة القيد المحاسبي —']);
        zatca.push(['الحساب', 'الاسم', 'البيان', 'مدين', 'دائن']);
        const prev = AINV.Accounting.preview(r);
        prev.journal_lines.forEach(l => zatca.push([l.account_code, l.account_name, l.description, l.debit || '', l.credit || '']));
        zatca.push(['', '', 'الإجمالي', prev.total_debits, prev.total_credits]);
        zatca.push(['', '', 'متوازن', prev.is_balanced ? 'نعم' : 'لا', '']);

        return { summary, items, taxes, issues, audit, zatca };
    }

    window.aiExportExcel = function () {
        const r = cur(); if (!r) return;
        if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محمّلة', 'er'); return; }
        try {
            const S = sheetsFor(r);
            const wb = XLSX.utils.book_new();
            const add = (data, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name);
            add(S.summary, 'ملخص الفاتورة');
            add(S.items, 'البنود');
            add(S.taxes, 'تفصيل الضريبة');
            add(S.issues, 'نتائج التحقق');
            add(S.audit, 'المصدر وأثر التدقيق');
            add(S.zatca, 'ZATCA والقيد');
            XLSX.writeFile(wb, `فاتورة-${(r.invoice_number || r.id).replace(/[\\/:*?"<>|]/g, '-')}.xlsx`);
            AINV.Audit.log('تصدير Excel', `صُدِّرت «${r.invoice_number || ''}» بستّ أوراق`, { recordId: r.id });
            toast('📊 صُدِّر الملف', 'ok');
        } catch (e) { toast('❌ تعذّر التصدير: ' + (e.message || e), 'er'); }
    };

    /** تصدير قائمة الفواتير كلها — للمتابعة الإدارية. */
    window.aiExportListExcel = function () {
        if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محمّلة', 'er'); return; }
        const recs = AINV.Store.all();
        const rows = [['الحالة', 'المورد', 'مربوط بالنظام', 'رقم الفاتورة', 'النوع', 'التاريخ', 'الاستحقاق',
            'الخاضع للضريبة', 'الضريبة', 'الإجمالي', 'العملة', 'الثقة %', 'موانع', 'تحذيرات',
            'ZATCA', 'تكرار محتمل', 'النموذج', 'التكلفة $', 'الملف', 'فاتورة المشتريات']];
        recs.forEach(r => {
            const t = r.totals || {}, sum = AINV.Validate.summary(r.validation_issues);
            const q = r.qr_code;
            rows.push([
                (AINV.STATUS[r.status] || {}).ar || r.status,
                (r.supplier && r.supplier.name) || '', r.vendorKey ? 'نعم' : 'لا',
                r.invoice_number || '', AINV.DOC_TYPE_AR[r.document_type] || '',
                r.invoice_date || '', r.due_date || '',
                t.taxable_amount == null ? '' : t.taxable_amount,
                t.vat_total == null ? '' : t.vat_total,
                t.grand_total == null ? '' : t.grand_total,
                r.currency || 'SAR', r.confidence_percent == null ? '' : r.confidence_percent,
                sum.blocking, sum.warnings,
                q ? (q.is_zatca_compliant ? (AINV.toArray(q.mismatches).length ? 'مخالف' : 'مطابق') : 'غير قياسي') : 'لا يوجد',
                (r.duplicate_warning && !r.duplicate_dismissed) ? 'نعم' : 'لا',
                (r.processing_job && r.processing_job.model_used) || '',
                (r.processing_job && r.processing_job.estimated_cost_usd) || 0,
                (r.file_metadata && r.file_metadata.original_filename) || '',
                r.linked_pinv_number || ''
            ]);
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'الفواتير المقروءة');
        XLSX.writeFile(wb, `قائمة-الفواتير-المقروءة-${AINV.todayLocal()}.xlsx`);
        toast('📊 صُدِّرت القائمة', 'ok');
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-JSON] حمولة التكامل
    // ═══════════════════════════════════════════════════════════════════════════

    window.aiExportPayload = function () {
        const r = cur(); if (!r) return;
        const payloadObj = AINV.Accounting.integrationPayload(r);
        const text = JSON.stringify(payloadObj, null, 2);
        modal('aiPayloadModal', '🔌 حمولة التكامل (JSON)',
            `<p class="ai-note">حمولة موحّدة جاهزة لأي نظام خارجي (SAP · Oracle · Odoo · QuickBooks) — تحمل البيانات والقيد ونتيجة التحقق ومصدر كل حقل معاً.</p>
             <textarea class="ai-inp mono" id="aiPayloadText" rows="16" readonly style="width:100%;font-size:11px">${esc(text)}</textarea>`,
            `<button class="btn" onclick="aiCloseModal('aiPayloadModal')">إغلاق</button>
             <button class="btn" onclick="aiCopyPayload()">📋 نسخ</button>
             <button class="btn b-g" onclick="aiDownloadPayload()">⬇️ تنزيل</button>`, 820);
    };

    window.aiCopyPayload = function () {
        const ta = $('aiPayloadText'); if (!ta) return;
        ta.select();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(ta.value).then(() => toast('📋 نُسخت', 'ok'), () => toast('تعذّر النسخ', 'er'));
        } else { document.execCommand('copy'); toast('📋 نُسخت', 'ok'); }
    };

    window.aiDownloadPayload = function () {
        const r = cur(); if (!r) return;
        const blob = new Blob([JSON.stringify(AINV.Accounting.integrationPayload(r), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `invoice-payload-${(r.invoice_number || r.id).replace(/[\\/:*?"<>|]/g, '-')}.json`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        AINV.Audit.log('تصدير حمولة تكامل', r.invoice_number || '', { recordId: r.id });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-PDF] تقرير تحقّق احترافي
    // ───────────────────────────────────────────────────────────────────────────
    // ليس نسخة من الفاتورة — بل **شهادة ما فعله النظام بها**: ما قرأه النموذج،
    // وما حسبه النظام، وأين اختلفا، ومن عدّل وتجاوز. هذه هي الورقة التي تُعرض
    // على المدقّق.
    // ═══════════════════════════════════════════════════════════════════════════

    window.aiExportPdf = function () {
        const r = cur(); if (!r) return;
        const comp = AINV.recompute(r).computed;
        const s = r.supplier || {}, t = r.totals || {}, q = r.qr_code || {};
        const sum = AINV.Validate.summary(r.validation_issues);
        const prev = AINV.Accounting.preview(r);
        const st = AINV.STATUS[r.status] || {};

        const issuesHtml = AINV.toArray(r.validation_issues).map(i => `<tr class="${i.severity === 'ERROR' ? 'er' : i.severity === 'WARNING' ? 'wn' : ''}">
            <td>${i.severity === 'ERROR' ? 'خطأ' : i.severity === 'WARNING' ? 'تحذير' : 'ملاحظة'}</td>
            <td class="mono">${esc(i.code)}</td>
            <td>${esc(i.message_ar || i.message)}</td>
            <td>${i.resolved ? 'متجاوَز: ' + esc(i.override_reason || '') + ' — ' + esc(i.override_by || '') : (i.blocking ? 'يمنع الاعتماد' : '')}</td>
        </tr>`).join('') || '<tr><td colspan="4">لا ملاحظات — اجتازت الفاتورة كل الفحوص</td></tr>';

        const itemsHtml = AINV.toArray(r.items).map((it, i) => {
            const c = AINV.computeLine(it);
            return `<tr><td>${i + 1}</td><td>${esc(it.item_name || '')}</td><td class="n">${c.qty}</td>
                <td>${esc(it.unit || '')}</td><td class="n">${fmt(c.price)}</td><td class="n">${fmt(c.discount)}</td>
                <td class="n">${fmt(c.taxable)}</td><td class="n">${c.rate}%</td><td class="n">${fmt(c.vatAmount)}</td>
                <td class="n"><b>${fmt(c.lineTotal)}</b></td></tr>`;
        }).join('');

        const P = r.provenance || {};
        const provHtml = Object.keys(P).map(k => {
            const p = P[k] || {};
            return `<tr><td>${esc(k)}</td><td>${esc(AINV.SOURCE_AR[p.source] || p.source || '')}</td>
                <td class="n">${Math.round(AINV.clamp01(p.confidence) * 100)}%</td>
                <td>${p.user_modified ? 'عُدِّل بشرياً' : '—'}</td>
                <td>${p.user_modified && p.original_ai_value != null ? esc(String(p.original_ai_value)) : ''}</td></tr>`;
        }).join('');

        const qrHtml = q.is_zatca_compliant ? `
            <table><thead><tr><th>الحقل</th><th>في رمز QR</th><th>على وجه الفاتورة</th><th>النتيجة</th></tr></thead><tbody>
            ${[['اسم البائع', q.seller_name, s.name, 'seller_name'],
                ['الرقم الضريبي', q.vat_registration_number, s.vat_number, 'vat_number'],
                ['الإجمالي', q.invoice_total_with_vat, t.grand_total, 'grand_total'],
                ['الضريبة', q.vat_total, t.vat_total, 'vat_total']].map(([l, a, b, f]) => {
                    const bad = AINV.toArray(q.mismatches).some(m => m.field === f);
                    return `<tr class="${bad ? 'er' : ''}"><td>${esc(l)}</td><td class="mono">${esc(a == null ? '—' : String(a))}</td>
                        <td class="mono">${esc(b == null ? '—' : String(b))}</td><td>${bad ? '✗ مختلف' : '✓ مطابق'}</td></tr>`;
                }).join('')}
            </tbody></table>`
            : '<p class="muted">لم يُرصد رمز استجابة سريعة بصيغة الهيئة في هذا المستند — لم تُجرَ مقارنة مستقلة.</p>';

        const w = window.open('', '_blank');
        if (!w) { toast('اسمح بالنوافذ المنبثقة لتصدير PDF', 'er'); return; }
        w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
        <title>تقرير تحقّق — ${esc(r.invoice_number || '')}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
        <style>
            *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box}
            body{font-family:'Tajawal',Tahoma,Arial;color:#1a3a5c;direction:rtl;margin:0;padding:22px;background:#fff;font-size:12px}
            h1{font-size:19px;margin:0;color:#0F7B8A}
            h2{font-size:14px;margin:18px 0 7px;padding-bottom:5px;border-bottom:2px solid #0F7B8A;color:#0F7B8A}
            .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F7B8A;padding-bottom:12px}
            .hd .sub{font-size:11px;color:#667;margin-top:5px;line-height:1.8}
            .st{background:#0F7B8A;color:#fff;padding:6px 14px;border-radius:6px;font-weight:800;font-size:13px;display:inline-block}
            .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
            .box{background:#f6f9fb;border-radius:8px;padding:10px;border-inline-start:3px solid #0F7B8A}
            .box b{display:block;font-size:11px;color:#0F7B8A;margin-bottom:5px}
            .kv{font-size:11px;line-height:1.9}
            table{width:100%;border-collapse:collapse;font-size:10.5px;margin-top:7px}
            th{background:#0F7B8A;color:#fff;padding:6px;text-align:right;font-weight:700}
            td{padding:5px 6px;border:1px solid #dde5ec}
            td.n,th.n{text-align:left}
            tr.er td{background:#fdecea}tr.wn td{background:#fff6e5}
            .mono{font-family:'Courier New',monospace;direction:ltr;text-align:left}
            .muted{color:#889;font-size:11px}
            .tot td{background:#eef4f8;font-weight:800}
            .banner{padding:9px 12px;border-radius:7px;margin-top:10px;font-size:11.5px}
            .banner.ok{background:#e8f6ee;border-inline-start:4px solid #1B8A4B}
            .banner.er{background:#fdecea;border-inline-start:4px solid #C0392B}
            .foot{margin-top:22px;padding-top:9px;border-top:1px solid #dde5ec;font-size:10px;color:#889;line-height:1.8}
            @page{size:A4;margin:1cm}
            @media print{button{display:none}}
        </style></head><body>
        <div class="hd">
            <div><h1>🔍 تقرير تحقّق من فاتورة مستخرَجة آلياً</h1>
                <div class="sub">🏗️ شركة جي بي آر للمقاولات — نظام حساب الأستاذ<br>
                صدر في ${new Date().toLocaleString('ar-SA')} · أصدره ${esc((window.myP && window.myP.name) || '')}</div></div>
            <div style="text-align:left"><span class="st">${esc(st.ar || r.status)}</span>
                <div class="sub">ثقة النظام: <b>${r.confidence_percent == null ? '—' : r.confidence_percent + '%'}</b><br>
                ${sum.blocking ? '<b style="color:#C0392B">' + sum.blocking + ' مانع اعتماد</b>' : '<b style="color:#1B8A4B">لا مانع للاعتماد</b>'}</div></div>
        </div>

        <div class="grid">
            <div class="box"><b>📄 المستند</b><div class="kv">
                النوع: ${esc(AINV.DOC_TYPE_AR[r.document_type] || '')}<br>
                رقم الفاتورة: <b>${esc(r.invoice_number || '—')}</b><br>
                التاريخ: ${esc(r.invoice_date || '—')} · الاستحقاق: ${esc(r.due_date || '—')}<br>
                أمر الشراء: ${esc(r.purchase_order_number || '—')} · العملة: ${esc(r.currency || 'SAR')}</div></div>
            <div class="box"><b>🏭 المورد</b><div class="kv">
                <b>${esc(s.name || '—')}</b><br>
                الرقم الضريبي: <span class="mono">${esc(s.vat_number || '—')}</span>
                ${s.vat_number ? (AINV.Saudi.isValidTIN(s.vat_number) ? ' ✓' : ' ✗ لا يطابق مواصفة الهيئة') : ''}<br>
                السجل التجاري: <span class="mono">${esc(s.commercial_registration || '—')}</span><br>
                مربوط بسجلات النظام: ${r.vendorKey ? 'نعم' : '<b style="color:#C0392B">لا</b>'}</div></div>
        </div>

        <h2>📦 البنود — بالقيم التي حسبها النظام</h2>
        <table><thead><tr><th>#</th><th>الوصف</th><th class="n">الكمية</th><th>الوحدة</th><th class="n">السعر</th>
            <th class="n">الخصم</th><th class="n">الخاضع</th><th class="n">%</th><th class="n">الضريبة</th><th class="n">الإجمالي</th></tr></thead>
        <tbody>${itemsHtml || '<tr><td colspan="10" class="muted">لا بنود مستخرَجة</td></tr>'}
        <tr class="tot"><td colspan="6">الإجمالي</td><td class="n">${fmt(comp.taxable)}</td><td></td>
            <td class="n">${fmt(comp.vat)}</td><td class="n">${fmt(comp.grandTotal)}</td></tr></tbody></table>

        <div class="banner ${Math.abs((t.grand_total || 0) - comp.grandTotal) <= AINV.Config.get().mathTolerance ? 'ok' : 'er'}">
            ${Math.abs((t.grand_total || 0) - comp.grandTotal) <= AINV.Config.get().mathTolerance
                ? '✅ الإجمالي المطبوع على الفاتورة يطابق ما حسبه النظام من البنود.'
                : `⛔ الإجمالي المطبوع (${fmt(t.grand_total)}) لا يطابق ما حسبه النظام (${fmt(comp.grandTotal)}).`}
        </div>

        <h2>🇸🇦 رمز الزكاة والضريبة (ZATCA QR)</h2>
        ${qrHtml}

        <h2>🔍 نتائج التحقق (${sum.total})</h2>
        <table><thead><tr><th>الخطورة</th><th>الرمز</th><th>الوصف</th><th>الحالة</th></tr></thead><tbody>${issuesHtml}</tbody></table>

        <h2>🔎 مصدر كل حقل</h2>
        <table><thead><tr><th>الحقل</th><th>المصدر</th><th class="n">الثقة</th><th>التدخّل البشري</th><th>قيمة الذكاء الاصطناعي الأصلية</th></tr></thead>
        <tbody>${provHtml || '<tr><td colspan="5" class="muted">—</td></tr>'}</tbody></table>

        <h2>📒 معاينة القيد المحاسبي</h2>
        <table><thead><tr><th>الحساب</th><th>الاسم</th><th class="n">مدين</th><th class="n">دائن</th></tr></thead><tbody>
        ${prev.journal_lines.map(l => `<tr><td class="mono">${esc(l.account_code)}</td><td>${esc(l.account_name)}</td>
            <td class="n">${l.debit ? fmt(l.debit) : ''}</td><td class="n">${l.credit ? fmt(l.credit) : ''}</td></tr>`).join('')}
        <tr class="tot"><td colspan="2">الإجمالي</td><td class="n">${fmt(prev.total_debits)}</td><td class="n">${fmt(prev.total_credits)}</td></tr>
        </tbody></table>

        <div class="foot">
            المحرك: ${esc((r.processing_job && r.processing_job.model_used) || '—')}
            ${(r.processing_job && r.processing_job.via_ocr) ? ' (قراءة محلية OCR — الحقول تقديرية)' : ''}
            · زمن المعالجة: ${Math.round(((r.processing_job && r.processing_job.duration_ms) || 0) / 1000)} ثانية
            · الملف: ${esc((r.file_metadata && r.file_metadata.original_filename) || '')}<br>
            ⚖️ <b>الحساب والتحقق يجريان داخل النظام لا داخل النموذج.</b> كل مبلغ في هذا التقرير أُعيد احتسابه من الكمية والسعر،
            وقُورن بما قرأه النموذج، وأي اختلاف مُثبت أعلاه. هذا التقرير مستند تحقّق داخلي ولا يُغني عن الفاتورة الأصلية.
        </div>
        <button onclick="window.print()" style="margin-top:14px;padding:8px 18px;font-family:inherit;font-size:13px;cursor:pointer">🖨️ طباعة / حفظ PDF</button>
        </body></html>`);
        w.document.close();
        AINV.Audit.log('تصدير تقرير تحقّق PDF', r.invoice_number || '', { recordId: r.id });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // [AC-ADMIN] الإعدادات · الحصّة · لوحة المدير · سجل المعالجة
    // ═══════════════════════════════════════════════════════════════════════════

    window.aiSettings = function () {
        if (!IS_ADMIN()) { toast('الإعدادات للمدير فقط', 'er'); return; }
        const c = AINV.Config.get();
        const route = AINV.Config.activeRoute();
        const curModel = AINV.MODELS.find(m => m.id === c.geminiModel);
        const staleModel = (c.provider || 'gemini') === 'gemini'
            && (c.geminiModelAliased || (curModel && (curModel.status === 'legacy' || curModel.status === 'retired')));
        const latestId = (AINV.MODELS.find(m => m.provider === 'gemini' && m.status !== 'legacy' && m.status !== 'retired') || {}).id || AINV.DEFAULTS.geminiModel;
        const gem = AINV.MODELS.filter(m => m.provider === 'gemini');
        const ant = AINV.MODELS.filter(m => m.provider === 'anthropic');

        modal('aiSetModal', '⚙️ إعدادات قراءة الفواتير',
            `<div class="ai-set">
                <label class="ai-chk-l"><input type="checkbox" id="setEnabled" ${c.enabled ? 'checked' : ''}> تفعيل الوحدة</label>

                <div class="ai-route ${route.legacy || staleModel ? 'legacy' : 'new'}">
                    <div class="ai-route-h">${route.legacy ? '🕰️ المسار النشط الآن — قديم' : staleModel ? '⚠️ المسار النشط الآن — بنموذج قديم' : '🚀 المسار النشط الآن — الجديد'}</div>
                    <div class="ai-route-l">${esc(route.label)}</div>
                    <div class="ai-meta">${esc(route.note)}</div>
                    ${c.geminiModelAliased ? `<div class="ai-note wn">النموذج المحفوظ <code>${esc(c.geminiModelSaved)}</code> مسحوب من Google — يُستخدم <code>${esc(c.geminiModel)}</code> بدلاً عنه. احفظ لتثبيت التغيير.</div>` : ''}
                    ${staleModel && !c.geminiModelAliased ? `<div class="ai-note wn">النموذج المحفوظ <code>${esc(c.geminiModel)}</code> من جيل سابق ومغلق أمام الحسابات الجديدة — وهو سبب رسالة «هذا النموذج لم يعد متاحاً».</div>` : ''}
                    <div class="ai-route-acts">
                        ${route.legacy ? `<button class="btn b-g" onclick="aiUseNewRouteOnly()">🚀 أوقف القديم — استخدم Gemini المباشر فقط</button>` : ''}
                        ${staleModel && !route.legacy ? `<button class="btn b-g" onclick="aiUseLatestModel()">⚡ حوّلني إلى أحدث نموذج (${esc(latestId)})</button>` : ''}
                    </div>
                </div>

                <h4>🔌 المحرك</h4>
                <div class="ai-grid2">
                    <div class="ai-f"><label class="ai-f-l">المزوّد</label>
                        <select class="ai-inp" id="setProvider" onchange="aiSetProviderChanged()">
                            <option value="gemini" ${c.provider === 'gemini' ? 'selected' : ''}>Gemini — مجاني (موصى به)</option>
                            <option value="anthropic" ${c.provider === 'anthropic' ? 'selected' : ''}>Anthropic Claude — مدفوع، يتطلّب وسيطاً</option>
                        </select></div>
                    <div class="ai-f" id="setGemModelWrap"><label class="ai-f-l">نموذج Gemini
                            <button class="btn sm" type="button" onclick="aiRefreshModels(false)" title="اسأل Google عن النماذج المتاحة لمفتاحك">↻ جلب المتاح</button></label>
                        <select class="ai-inp" id="setGeminiModel">
                            ${gem.map(m => `<option value="${m.id}" ${c.geminiModel === m.id ? 'selected' : ''} ${m.status === 'retired' ? 'disabled' : ''}>${esc(m.name)}${m.status === 'legacy' ? ' — جيل سابق' : m.status === 'retired' ? ' — لم يعد متاحاً' : ''}</option>`).join('')}
                        </select>
                        <div class="ai-note">تسحب Google نماذجها دورياً. إن ظهر خطأ «هذا النموذج لم يعد متاحاً» فاضغط <b>↻ جلب المتاح</b> لتحديث القائمة من مفتاحك.</div></div>
                    <div class="ai-f" id="setAntModelWrap"><label class="ai-f-l">نموذج Claude</label>
                        <select class="ai-inp" id="setModel">
                            ${ant.map(m => `<option value="${m.id}" ${c.model === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
                        </select></div>
                </div>
                <div class="ai-f"><label class="ai-f-l">مفتاح Gemini <span class="ai-meta">(يبدأ بـAIza — من aistudio.google.com)</span></label>
                    <input class="ai-inp mono" id="setGeminiKey" type="password" value="${esc(c.geminiKey || '')}" placeholder="AIza...">
                    <div class="ai-note">⚠️ هذا المفتاح يُنادى من المتصفح مباشرةً. <b>قيّده بالنطاق</b> في Google Cloud Console
                        (HTTP referrer) وإلا كان قابلاً للاستخدام من أي موقع. المقايضة مقبولة لمفتاح مجاني، وغير مقبولة لمفتاح مدفوع.</div></div>
                <div class="ai-f"><label class="ai-f-l">رابط الوسيط (Cloudflare Worker) <span class="ai-meta">— المسار القديم · إلزامي لـClaude وحده</span></label>
                    <input class="ai-inp mono" id="setProxy" value="${esc(c.proxyUrl || '')}" placeholder="https://invoice-ai-proxy.xxx.workers.dev">
                    <div class="ai-note">مفتاح Anthropic مدفوع ولا يوضع في المتصفح إطلاقاً — الوسيط يحفظه ويتحقّق من هوية المستخدم قبل كل نداء.
                        <b>لا يُستخدم هذا الحقل مع Gemini.</b> وإن رفض الوسيط الاتصال رغم نشره، فالسبب غالباً أنّ
                        <code>ALLOWED_ORIGIN</code> في <code>wrangler.toml</code> لا يطابق نطاق تطبيقك الحالي.</div></div>
                <label class="ai-chk-l"><input type="checkbox" id="setFallback" ${c.autoFallbackModels ? 'checked' : ''}> السقوط تلقائياً إلى نموذج بديل عند نفاد الحصّة</label>
                <label class="ai-chk-l"><input type="checkbox" id="setOcr" ${c.ocrFallback ? 'checked' : ''}> القراءة المحلية المجانية (OCR) عند نفاد كل الحصص</label>

                <h4>🧮 التحقق والحدود</h4>
                <div class="ai-grid2">
                    <div class="ai-f"><label class="ai-f-l">حدّ الثقة للاعتماد التلقائي %</label>
                        <input class="ai-inp n" id="setConf" type="number" min="0" max="100" value="${Math.round(c.confidenceThreshold * 100)}"></div>
                    <div class="ai-f"><label class="ai-f-l">تسامح الفروق الحسابية (ريال)</label>
                        <input class="ai-inp n" id="setTol" type="number" step="0.01" min="0" value="${c.mathTolerance}"></div>
                    <div class="ai-f"><label class="ai-f-l">أقصى حجم ملف (م.ب)</label>
                        <input class="ai-inp n" id="setMaxMb" type="number" min="1" max="30" value="${c.maxFileMB}"></div>
                    <div class="ai-f"><label class="ai-f-l">عدد إعادات المحاولة</label>
                        <input class="ai-inp n" id="setRetry" type="number" min="0" max="5" value="${c.retryCount}"></div>
                    <div class="ai-f"><label class="ai-f-l">المهلة (ثانية)</label>
                        <input class="ai-inp n" id="setTimeout" type="number" min="30" max="300" value="${Math.round(c.timeoutMs / 1000)}"></div>
                    <div class="ai-f"><label class="ai-f-l">سقفك اليومي (0 = غير معروف)</label>
                        <input class="ai-inp n" id="setQuota" type="number" min="0" value="${Number(c.dailyQuotaOverride) || 0}">
                        <div class="ai-meta">لم تعد Google تنشره لكل نموذج — <a href="${esc(AINV.QUOTA_URL)}" target="_blank" rel="noopener">اقرأ حدّك من AI Studio ↗</a></div></div>
                </div>
                <label class="ai-chk-l"><input type="checkbox" id="setSaudi" ${c.enforceSaudiVAT ? 'checked' : ''}> تطبيق قواعد هيئة الزكاة والضريبة والجمارك</label>
                <label class="ai-chk-l"><input type="checkbox" id="setQr" ${c.requireQrForZatca ? 'checked' : ''}> تنبيه عند غياب رمز QR في الفواتير المبسّطة</label>
                <label class="ai-chk-l"><input type="checkbox" id="setBlockMath" ${c.blockOnArithmetic ? 'checked' : ''}> منع الاعتماد عند اختلال الإجماليات <span class="ai-meta">(يُنصح ببقائه مفعّلاً)</span></label>
                <label class="ai-chk-l"><input type="checkbox" id="setBlockDup" ${c.blockOnDuplicate ? 'checked' : ''}> منع الاعتماد عند رصد تكرار محتمل</label>
                <label class="ai-chk-l"><input type="checkbox" id="setMatchV" ${c.autoSuggestSupplier ? 'checked' : ''}> اقتراح ربط المورد تلقائياً</label>
                <label class="ai-chk-l"><input type="checkbox" id="setMatchI" ${c.autoSuggestItems ? 'checked' : ''}> اقتراح ربط الأصناف تلقائياً</label>
            </div>`,
            `<button class="btn" onclick="aiCloseModal('aiSetModal')">إلغاء</button>
             <button class="btn" onclick="aiTestEngine()">🔌 اختبار الاتصال</button>
             <button class="btn b-g" onclick="aiSaveSettings()">💾 حفظ</button>`, 720);
        window.aiSetProviderChanged();
    };

    /**
     * أوقف المسار القديم وفعّل الجديد وحده: Gemini مباشر، وإفراغ رابط الوسيط
     * حتى لا يعود أي نداء إليه. لا يُحفظ شيء قبل وجود مفتاح Gemini — التحويل
     * إلى مسار بلا مفتاح يستبدل عطلاً بعطل.
     */
    window.aiUseNewRouteOnly = async function () {
        const key = (($('setGeminiKey') && $('setGeminiKey').value) || '').trim();
        if (!key) {
            toast('ضع مفتاح Gemini أولاً (يبدأ بـAIza — من aistudio.google.com) ثم اضغط الزر مرة أخرى', 'er', 9000);
            const el = $('setGeminiKey'); if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
            return;
        }
        try {
            await AINV.Config.save({ provider: 'gemini', proxyUrl: '', geminiKey: key, enabled: true });
            AINV.Audit.log('تبديل مسار محرك قراءة الفواتير', 'أُوقف الوسيط (Anthropic) وفُعّل Gemini المباشر وحده');
            toast('🚀 أُوقف المسار القديم — Gemini المباشر هو الفعّال الآن', 'ok', 7000);
            window.aiCloseModal('aiSetModal');
            window.aiSettings();
        } catch (e) { toast('❌ تعذّر الحفظ: ' + (e.message || e), 'er'); }
    };

    /** يثبّت أحدث نموذج مستقرّ — علاج مباشر لإعداد محفوظ صار ميتاً. */
    window.aiUseLatestModel = async function () {
        const latest = (AINV.MODELS.find(m => m.provider === 'gemini' && m.status !== 'legacy' && m.status !== 'retired') || {}).id;
        if (!latest) { toast('لا يوجد نموذج مستقرّ في القائمة — اضغط «جلب المتاح» أولاً', 'er'); return; }
        const before = AINV.Config.get().geminiModel;
        try {
            await AINV.Config.save({ geminiModel: latest });
            AINV.Audit.log('تحديث نموذج قراءة الفواتير', `${before} ← ${latest}`);
            toast(`⚡ حُوِّل النموذج إلى ${latest}`, 'ok', 7000);
            window.aiCloseModal('aiSetModal');
            window.aiSettings();
        } catch (e) { toast('❌ تعذّر الحفظ: ' + (e.message || e), 'er'); }
    };

    window.aiSetProviderChanged = function () {
        const p = $('setProvider') && $('setProvider').value;
        const g = $('setGemModelWrap'), a = $('setAntModelWrap');
        if (g) g.style.display = p === 'gemini' ? '' : 'none';
        if (a) a.style.display = p === 'anthropic' ? '' : 'none';
    };

    window.aiSaveSettings = async function () {
        try {
            const conf = Math.max(0, Math.min(100, parseInt($('setConf').value) || 85));
            await AINV.Config.save({
                enabled: $('setEnabled').checked,
                provider: $('setProvider').value,
                geminiModel: $('setGeminiModel').value,
                model: $('setModel').value,
                geminiKey: $('setGeminiKey').value.trim(),
                proxyUrl: $('setProxy').value.trim(),
                autoFallbackModels: $('setFallback').checked,
                ocrFallback: $('setOcr').checked,
                confidenceThreshold: conf / 100,
                mathTolerance: Math.max(0, parseFloat($('setTol').value) || 0.05),
                maxFileMB: Math.max(1, parseInt($('setMaxMb').value) || 20),
                retryCount: Math.max(0, parseInt($('setRetry').value) || 0),
                timeoutMs: Math.max(30, parseInt($('setTimeout').value) || 120) * 1000,
                dailyQuotaOverride: Math.max(0, parseInt($('setQuota').value) || 0),
                enforceSaudiVAT: $('setSaudi').checked,
                requireQrForZatca: $('setQr').checked,
                blockOnArithmetic: $('setBlockMath').checked,
                blockOnDuplicate: $('setBlockDup').checked,
                autoSuggestSupplier: $('setMatchV').checked,
                autoSuggestItems: $('setMatchI').checked
            });
            AINV.Audit.log('تعديل إعدادات قراءة الفواتير', 'حُدِّثت إعدادات الوحدة');
            toast('✅ حُفظت الإعدادات', 'ok');
            window.aiCloseModal('aiSetModal');
            window.aiRerender();
        } catch (e) { toast('❌ تعذّر الحفظ: ' + (e.message || e), 'er'); }
    };

    /**
     * اختبار الاتصال بمستند صغير مُولَّد.
     * يجرّب سلسلة السقوط كاملةً لا نموذجاً واحداً — اختبارٌ يفشل على أوّل نموذج
     * ميت بينما الاستخراج الحقيقي كان سينجح بالتالي له، اختبارٌ يكذب.
     */
    window.aiTestEngine = async function () {
        const ready = AINV.Config.ready();
        if (!ready.ok) { toast('⚠️ ' + ready.reason, 'er', 8000); return; }
        const c = AINV.Config.get();
        // صورة PNG بيضاء 1×1 — أصغر حمولة صالحة
        const px = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

        if ((c.provider || 'gemini') !== 'gemini') {
            toast('⏳ جارٍ اختبار الوسيط…', 'wn');
            try { await AINV.callProxy(px, 'image/png', null); toast('✅ الوسيط والمصادقة سليمان', 'ok', 6000); }
            catch (e) { reportTest(e); }
            return;
        }

        const chain = c.autoFallbackModels ? AINV.fallbackChain(c.geminiModel) : [c.geminiModel];
        const tried = [];
        for (const model of chain) {
            toast(`⏳ اختبار ${model}…`, 'wn', 3000);
            try {
                await AINV.callGeminiDirect(px, 'image/png', null, model);
                await finishOk(model, tried);
                return;
            } catch (e) {
                // رفض النموذج لصورة فارغة = الاتصال والمصادقة سليمان
                if (e.code === 'REFUSAL' || e.code === 'PARSE' || e.upstreamType === 'bad_request') {
                    await finishOk(model, tried, true);
                    return;
                }
                tried.push(`${model}: ${e.upstreamType || e.code || 'خطأ'}`);
                // مفتاح خاطئ أو صلاحية ناقصة لا يُصلحها تبديل النموذج
                if (['authentication_error', 'permission_error'].includes(e.upstreamType)) { reportTest(e); return; }
                if (e.upstreamType !== 'model_unavailable' && e.upstreamType !== 'quota_exhausted') { reportTest(e, tried); return; }
            }
        }
        toast('❌ لم ينجح أي نموذج:\n' + tried.join('\n'), 'er', 14000);

        async function finishOk(model, failed, viaRefusal) {
            let extra = '';
            if (model !== c.geminiModel) {
                try { await AINV.Config.save({ geminiModel: model }); extra = ` — وثُبِّت بديلاً عن ${c.geminiModel}`; } catch (e) { /* ثانوي */ }
                AINV.Audit.log('تحويل نموذج بعد اختبار الاتصال', `${c.geminiModel} ← ${model}`);
            }
            toast(`✅ الاتصال سليم عبر ${model}${extra}` + (viaRefusal ? ' (رفض النموذج الصورة الفارغة — وهذا متوقّع)' : '')
                + (failed.length ? `\nتخطّى: ${failed.join(' · ')}` : ''), 'ok', 10000);
            window.aiCloseModal('aiSetModal');
            window.aiSettings();
        }
        function reportTest(e, failed) {
            toast('❌ ' + (e.message || e) + (failed && failed.length ? `\nجُرّب: ${failed.join(' · ')}` : ''), 'er', 14000);
        }
    };

    // ── لوحة الاستهلاك اليومي ────────────────────────────────────────────────
    window.aiQuotaPanel = function () {
        const q = AINV.Quota.report();
        const STAT = {
            retired: { cls: 'er', ar: 'لم يعد متاحاً' },
            legacy: { cls: 'wn', ar: 'جيل سابق' },
            exhausted: { cls: 'er', ar: 'نفدت' },
            near_limit: { cls: 'wn', ar: 'قاربت النفاد' },
            available: { cls: 'ok', ar: 'متاح' }
        };
        const rows = q.models.map(m => {
            const st = STAT[m.status] || STAT.available;
            return `<tr class="${m.id === q.activeModel ? 'act' : ''}">
                <td><b>${esc(m.name)}</b>${m.id === q.activeModel ? ' <span class="ai-pill ok">النشط</span>' : ''}
                    <div class="ai-meta">${esc(m.ar)}</div>
                    <div class="ai-meta mono">${esc(m.id)}</div></td>
                <td><span class="ai-pill ${m.isFreeTier ? 'ok' : ''}">${esc(m.tierBadge)}</span></td>
                <td class="n">${m.usedToday}</td>
                <td class="n">${m.effectiveLimit || '—'}</td>
                <td class="n">${m.remainingToday == null ? '—' : m.remainingToday}</td>
                <td><span class="ai-pill ${st.cls}">${st.ar}</span></td>
            </tr>`;
        }).join('');

        modal('aiQuotaModal', '📊 الاستهلاك اليومي للنماذج',
            `<div class="ai-quota-head">
                <div><b>${q.totalInvoicesToday}</b> فاتورة عولجت اليوم من هذا المتصفح${q.dailyLimitKnown ? ` — السقف <b>${q.totalDailyLimit}</b>` : ''}</div>
                <div class="ai-meta">تتجدّد حصص Google بعد <b>${q.hoursUntilReset}</b> ساعة و<b>${q.minutesUntilReset}</b> دقيقة</div>
                <div class="ai-meta">السقوط التلقائي بين النماذج: <b>${q.autoFallbackEnabled ? 'مفعّل' : 'معطّل'}</b></div>
             </div>
             ${q.dailyLimitKnown ? '' : `<div class="ai-note">
                ℹ️ لم تعد Google تنشر سقفاً يومياً ثابتاً لكل نموذج — صار مرتبطاً بحسابك ويُعرض في AI Studio.
                العدّاد أعلاه <b>استهلاك حقيقي مقيس</b> على هذا المتصفح، بلا سقف مفترض.
                <a href="${esc(q.quotaUrl)}" target="_blank" rel="noopener">افتح حدودك في AI Studio ↗</a>
                ثم ضع الرقم في الإعدادات ليظهر شريط تقدّم.</div>`}
             <div class="tw"><table class="ai-tbl sm">
                <thead><tr><th>النموذج</th><th>الطبقة</th><th class="n">استُهلك اليوم</th><th class="n">السقف</th><th class="n">المتبقي</th><th>الحالة</th></tr></thead>
                <tbody>${rows}</tbody></table></div>`,
            `<button class="btn" onclick="aiCloseModal('aiQuotaModal')">إغلاق</button>
             <button class="btn b-b" onclick="aiRefreshModels(true)">↻ جلب النماذج المتاحة لمفتاحك</button>`, 880);
    };

    /**
     * يسأل Google عن النماذج المتاحة لهذا المفتاح ويستبدل القائمة المحلية.
     * هذا هو علاج عطل «هذا النموذج لم يعد متاحاً» من جذره: القائمة تأتي من
     * المصدر لا من ذاكرة الكود، فلا تشيخ مع كل دورة إصدار من Google.
     */
    window.aiRefreshModels = async function (fromQuota) {
        const key = (($('setGeminiKey') && $('setGeminiKey').value) || AINV.Config.get().geminiKey || '').trim();
        if (!key) { toast('ضع مفتاح Gemini أولاً — القائمة تُجلب باسم مفتاحك', 'er', 8000); return; }
        toast('⏳ جارٍ سؤال Google عن النماذج المتاحة…', 'wn');
        try {
            const ids = await AINV.listGeminiModels(key);
            if (!ids.length) { toast('لم يُعِد Google أي نموذج نصّي متاح لهذا المفتاح', 'er', 8000); return; }
            AINV.mergeLiveModels(ids);

            // إن كان النموذج المحفوظ لم يعد متاحاً، انتقل إلى الأحدث المتاح
            const cur = AINV.Config.get().geminiModel;
            let switched = '';
            if (!ids.includes(cur)) { switched = ids[0]; await AINV.Config.save({ geminiModel: switched }); }

            toast(`✅ ${ids.length} نموذجاً متاحاً لمفتاحك` + (switched ? ` — حُوِّل إلى ${switched} لأن ${cur} لم يعد متاحاً` : ''), 'ok', 9000);
            AINV.Audit.log('تحديث قائمة نماذج Gemini', `${ids.length} نموذجاً` + (switched ? ` · تحوّل إلى ${switched}` : ''));

            if (fromQuota) { window.aiCloseModal('aiQuotaModal'); window.aiQuotaPanel(); }
            else { window.aiCloseModal('aiSetModal'); window.aiSettings(); }
        } catch (e) { toast('❌ ' + (e.message || e), 'er', 12000); }
    };

    // ── لوحة المدير: مقاييس الأداء والتكلفة ─────────────────────────────────
    window.aiAdminDashboard = function () {
        if (!IS_ADMIN()) { toast('لوحة المدير للمدير فقط', 'er'); return; }
        const recs = AINV.Store.all();
        const done = recs.filter(r => r.processing_job);
        const ok = recs.filter(r => r.status !== 'failed').length;
        const failed = recs.filter(r => r.status === 'failed').length;
        const avgConf = done.length ? Math.round(done.reduce((s, r) => s + (r.confidence_percent || 0), 0) / done.length) : 0;
        const avgMs = done.length ? Math.round(done.reduce((s, r) => s + ((r.processing_job && r.processing_job.duration_ms) || 0), 0) / done.length) : 0;
        const tokens = done.reduce((s, r) => {
            const t = (r.processing_job && r.processing_job.tokens_used) || {};
            return s + (t.input_tokens || 0) + (t.output_tokens || 0);
        }, 0);
        const cost = done.reduce((s, r) => s + ((r.processing_job && r.processing_job.estimated_cost_usd) || 0), 0);
        const viaOcr = done.filter(r => r.processing_job && r.processing_job.via_ocr).length;
        const overridden = recs.reduce((s, r) => s + AINV.Validate.summary(r.validation_issues).overridden, 0);
        const edited = recs.filter(r => Object.values(r.provenance || {}).some(p => p && p.user_modified)).length;

        // توزيع النماذج
        const byModel = {};
        done.forEach(r => { const m = (r.processing_job && r.processing_job.model_used) || '—'; byModel[m] = (byModel[m] || 0) + 1; });

        const tile = (ic, l, v, sub) => `<div class="ai-mtile"><div class="ai-mtile-l">${ic} ${esc(l)}</div>
            <div class="ai-mtile-v">${esc(String(v))}</div>${sub ? `<div class="ai-meta">${esc(sub)}</div>` : ''}</div>`;

        modal('aiAdminModal', '📈 لوحة المدير — أداء الوحدة وتكلفتها',
            `<div class="ai-mtiles">
                ${tile('📄', 'إجمالي المعالَجة', recs.length)}
                ${tile('✅', 'نجحت', ok, failed ? `فشلت ${failed}` : '')}
                ${tile('🎯', 'متوسط الثقة', avgConf + '%')}
                ${tile('⏱️', 'متوسط زمن المعالجة', (avgMs / 1000).toFixed(1) + 'ث')}
                ${tile('🔢', 'إجمالي الرموز', tokens.toLocaleString('en-US'))}
                ${tile('💵', 'التكلفة التقديرية', '$' + cost.toFixed(4), 'الطبقة المجانية = صفر فعلياً')}
                ${tile('👓', 'قُرئت بالـOCR', viaOcr)}
                ${tile('✍️', 'عُدِّلت بشرياً', edited, edited ? Math.round(edited / Math.max(1, recs.length) * 100) + '% من الفواتير' : '')}
                ${tile('⚖️', 'تجاوُزات مسجَّلة', overridden)}
            </div>
            <h4>توزيع النماذج المستخدمة</h4>
            <table class="ai-tbl sm"><thead><tr><th>النموذج</th><th class="n">عدد الفواتير</th><th class="n">النسبة</th></tr></thead>
            <tbody>${Object.keys(byModel).sort((a, b) => byModel[b] - byModel[a]).map(m =>
                `<tr><td class="mono">${esc(m)}</td><td class="n">${byModel[m]}</td>
                 <td class="n">${Math.round(byModel[m] / Math.max(1, done.length) * 100)}%</td></tr>`).join('') || '<tr><td colspan="3" class="ai-meta">لا بيانات</td></tr>'}</tbody></table>
            <div class="ai-note">💡 نسبة التعديل البشري المرتفعة تعني أن جودة المستندات المرفوعة أو النموذج المختار يحتاج مراجعة —
                وهي المؤشّر الأصدق على أثر الوحدة الحقيقي في توفير الوقت.</div>`,
            `<button class="btn" onclick="aiCloseModal('aiAdminModal')">إغلاق</button>
             <button class="btn" onclick="aiQuotaPanel()">📊 الحصّة اليومية</button>`, 860);
    };

    // ── سجل المعالجة ────────────────────────────────────────────────────────
    window.aiProcessingLog = async function () {
        if (!IS_ADMIN()) { toast('سجل المعالجة للمدير فقط', 'er'); return; }
        modal('aiLogModal', '📋 سجل المعالجة', '<div class="ai-meta">جارٍ التحميل…</div>', '<button class="btn" onclick="aiCloseModal(\'aiLogModal\')">إغلاق</button>', 880);
        try {
            const snap = await window.get(window.ref(window.db, 'ledger/aiInvoiceLog'));
            const all = snap && snap.exists() ? snap.val() : {};
            const rows = [];
            Object.keys(all).forEach(recId => {
                const entries = all[recId] || {};
                Object.keys(entries).forEach(k => rows.push(Object.assign({ recId }, entries[k])));
            });
            rows.sort((a, b) => (b.at || 0) - (a.at || 0));

            const body = rows.length ? `<div class="tw"><table class="ai-tbl sm">
                <thead><tr><th>الوقت</th><th>المستخدم</th><th>الحدث</th><th>النموذج</th><th class="n">المدة</th>
                    <th class="n">رموز داخل/خارج</th><th class="n">التكلفة $</th><th class="n">الثقة</th><th>ملاحظات</th></tr></thead>
                <tbody>${rows.slice(0, 300).map(e => `<tr>
                    <td class="mono">${new Date(e.at || 0).toLocaleString('ar-SA')}</td>
                    <td>${esc(e.by || '')}</td>
                    <td>${esc(e.event || '')}</td>
                    <td class="mono">${esc(e.model || '')}${e.viaOcr ? ' (OCR)' : ''}</td>
                    <td class="n">${e.durationMs ? Math.round(e.durationMs / 1000) + 'ث' : ''}</td>
                    <td class="n">${e.tokensIn == null ? '' : e.tokensIn + ' / ' + (e.tokensOut || 0)}</td>
                    <td class="n">${e.cost == null ? '' : Number(e.cost).toFixed(4)}</td>
                    <td class="n">${e.confidence == null ? '' : e.confidence + '%'}</td>
                    <td class="ai-meta">${esc(e.error || e.status || e.pinvNumber || '')}</td>
                </tr>`).join('')}</tbody></table></div>
                ${rows.length > 300 ? `<div class="ai-meta">عُرضت أحدث 300 من ${rows.length} سجلاً</div>` : ''}`
                : '<div class="empty"><div class="ei">📋</div><p>لا سجلات معالجة بعد</p></div>';

            const box = $('aiLogModal');
            if (box) box.querySelector('.ai-modal-b').innerHTML = body;
        } catch (e) {
            const box = $('aiLogModal');
            if (box) box.querySelector('.ai-modal-b').innerHTML = `<div class="ai-note er">تعذّر قراءة السجل: ${esc(e.message || String(e))}</div>`;
        }
    };

    console.log('✅ AI Invoice Actions loaded');
})();
