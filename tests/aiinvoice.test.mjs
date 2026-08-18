// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  🤖 اختبارات محرّك استخراج وتدقيق الفواتير (public/aiinvoice-engine.js)         ║
// ║  التشغيل:  npm run test:ai   (بلا متصفح ولا شبكة — Node فقط)                   ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  المُختبَر هنا هو ما يحمي المال: **الحساب والتحقق يجريان في الكود لا في          ║
// ║  النموذج**. كل حالة تحاكي فاتورة حقيقية أو رداً معطوباً من النموذج، وتتأكّد      ║
// ║  أن النظام يمسك الخطأ بدل أن يمرّره إلى القيد المحاسبي.                         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

globalThis.window = globalThis;
globalThis.cfg = { currency: 'SAR' };
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } };
globalThis.vendors = {};
globalThis.invItems = {};
globalThis.aiInvoices = {};
globalThis.purchaseInvoices = {};
globalThis.chartOfAccounts = {};

await import('file://' + new URL('../public/aiinvoice-engine.js', import.meta.url).pathname);
const AINV = globalThis.AINV;

let pass = 0, fail = 0;
function eq(name, actual, expected) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log(`  ❌ ${name}\n       متوقّع: ${e}\n       فعلي  : ${a}`); }
}
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
const has = (issues, code) => issues.some(i => i.code === code);

/** فاتورة ضريبية سليمة: بندان، 15%، بلا خصم. */
function goodRaw(over) {
    return Object.assign({
        is_invoice: true, document_type: 'TAX_INVOICE', document_quality: 'good', language: 'mixed',
        invoice_number: 'INV-2026-001', invoice_date: '2026-02-03', due_date: '2026-03-05',
        currency: 'SAR',
        supplier: { name: 'شركة سواتر الإبداع للمقاولات', vat_number: '311905689900003', commercial_registration: '1010912286' },
        customer: { name: 'شركة جي بي ار للمقاولات', vat_number: '312733987800003' },
        items: [
            { item_name: 'توريد حجر', quantity: 100, unit: 'متر', unit_price: 100, discount: 0, taxable_amount: 10000, vat_rate: 15, vat_amount: 1500, total_amount: 11500 },
            { item_name: 'تركيب', quantity: 1, unit: 'مقطوعية', unit_price: 5000, discount: 0, taxable_amount: 5000, vat_rate: 15, vat_amount: 750, total_amount: 5750 }
        ],
        totals: { subtotal: 15000, discount_total: 0, taxable_amount: 15000, vat_total: 2250, grand_total: 17250 },
        overall_confidence: 0.95
    }, over || {});
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔢 [1] إعادة احتساب البنود — النظام يحسب، لا النموذج');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const c = AINV.computeLine({ quantity: 100, unit_price: 100, discount: 0, vat_rate: 15, taxable_amount: 10000, vat_amount: 1500, total_amount: 11500 });
    eq('كمية × سعر = الإجمالي قبل الخصم', c.lineSubtotal, 10000);
    eq('الخاضع للضريبة', c.taxable, 10000);
    eq('الضريبة = الخاضع × النسبة', c.vatAmount, 1500);
    eq('إجمالي البند = خاضع + ضريبة', c.lineTotal, 11500);
    eq('لا ملاحظات على بند سليم', c.issues.length, 0);
}
{
    const c = AINV.computeLine({ quantity: 10, unit_price: 100, discount: 200, vat_rate: 15, taxable_amount: 800, vat_amount: 120, total_amount: 920 });
    eq('الخصم يُخصم قبل الضريبة', c.taxable, 800);
    eq('الضريبة على ما بعد الخصم', c.vatAmount, 120);
    eq('بند بخصم سليم بلا ملاحظات', c.issues.length, 0);
}
{
    // 🛑 النموذج نقل ضريبة خاطئة — النظام يجب أن يمسكها
    const c = AINV.computeLine({ quantity: 10, unit_price: 100, discount: 0, vat_rate: 15, taxable_amount: 1000, vat_amount: 100, total_amount: 1100 });
    ok('يُمسك خطأ مبلغ الضريبة', c.issues.some(i => i.field === 'vat_amount'));
    eq('ويحسبها صحيحة رغم خطأ النموذج', c.vatAmount, 150);
}
{
    const c = AINV.computeLine({ quantity: 3, unit_price: 33.333, discount: 0, vat_rate: 15 });
    eq('التقريب إلى منزلتين', c.taxable, 100);
    eq('ضريبة مقرَّبة', c.vatAmount, 15);
}
{
    // نسبة صفرية (سلع معفاة/صفرية) لا تُحوَّل قسراً إلى 15%
    const c = AINV.computeLine({ quantity: 2, unit_price: 500, discount: 0, vat_rate: 0 });
    eq('النسبة الصفرية تبقى صفراً', c.vatAmount, 0);
    eq('الإجمالي بلا ضريبة', c.lineTotal, 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧮 [2] إعادة احتساب الفاتورة كاملة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const doc = AINV.map(goodRaw(), { provider: 'gemini' });
    const c = AINV.recompute(doc).computed;
    eq('مجموع البنود قبل الخصم', c.subtotal, 15000);
    eq('الخاضع للضريبة', c.taxable, 15000);
    eq('إجمالي الضريبة', c.vat, 2250);
    eq('الإجمالي شامل الضريبة', c.grandTotal, 17250);
    eq('تجميع الضريبة حسب النسبة', c.taxes.length, 1);
    eq('وعاء النسبة 15%', c.taxes[0].taxable_amount, 15000);
}
{
    // نِسب مختلطة: 15% و0% — أساس الإقرار الضريبي
    const raw = goodRaw();
    raw.items[1].vat_rate = 0; raw.items[1].vat_amount = 0; raw.items[1].total_amount = 5000;
    raw.totals = { subtotal: 15000, discount_total: 0, taxable_amount: 15000, vat_total: 1500, grand_total: 16500 };
    const doc = AINV.map(raw, {});
    const c = AINV.recompute(doc).computed;
    eq('نسبتان في التفصيل الضريبي', c.taxes.length, 2);
    eq('ضريبة النسبة المختلطة', c.vat, 1500);
    eq('الإجمالي المختلط', c.grandTotal, 16500);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🚨 [3] محرّك التحقق — ما يمنع الاعتماد وما لا يمنعه');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const doc = AINV.map(goodRaw(), {});
    const issues = AINV.Validate.run(doc);
    eq('فاتورة سليمة بلا ملاحظات', issues.length, 0);
    eq('ولا مانع اعتماد', AINV.Validate.hasBlocking(issues), false);
}
{
    // 🛑 إجمالي مضخّم — أخطر حالة: تدفع أكثر مما يجب
    const raw = goodRaw(); raw.totals.grand_total = 20000;
    const issues = AINV.Validate.run(AINV.map(raw, {}));
    ok('يُمسك اختلاف الإجمالي عن مجموع البنود', has(issues, 'GRAND_TOTAL_SUM_MISMATCH'));
    ok('ويمنع الاعتماد', AINV.Validate.hasBlocking(issues));
}
{
    // 🛑 ضريبة الترويسة ≠ مجموع ضريبة البنود — يذهب الفرق للإقرار الضريبي
    const raw = goodRaw(); raw.totals.vat_total = 3000; raw.totals.grand_total = 18000;
    const issues = AINV.Validate.run(AINV.map(raw, {}));
    ok('يُمسك اختلال الضريبة', has(issues, 'VAT_TOTAL_SUM_MISMATCH'));
    ok('ويمنع الاعتماد', AINV.Validate.hasBlocking(issues));
}
{
    const raw = goodRaw(); raw.invoice_number = '';
    const issues = AINV.Validate.run(AINV.map(raw, {}));
    ok('رقم الفاتورة المفقود مانع', issues.some(i => i.code === 'MISSING_INVOICE_NUMBER' && i.blocking));
}
{
    const raw = goodRaw(); raw.supplier.name = '';
    const issues = AINV.Validate.run(AINV.map(raw, {}));
    ok('اسم المورد المفقود مانع', issues.some(i => i.code === 'MISSING_SUPPLIER_NAME' && i.blocking));
}
{
    // فاتورة ضريبية بلا رقم ضريبي: لا يجوز خصم ضريبة المدخلات ⇒ مانع
    const raw = goodRaw(); raw.supplier.vat_number = '';
    const issues = AINV.Validate.run(AINV.map(raw, {}));
    ok('الرقم الضريبي المفقود مانع في فاتورة ضريبية', issues.some(i => i.code === 'MISSING_SUPPLIER_VAT_NUMBER' && i.blocking));
}
{
    // الإيصال ليس فاتورة ضريبية ⇒ الرقم الضريبي تحذير لا مانع
    const raw = goodRaw({ document_type: 'RECEIPT' }); raw.supplier.vat_number = '';
    const issues = AINV.Validate.run(AINV.map(raw, {}));
    ok('وفي الإيصال تحذير لا مانع', issues.some(i => i.code === 'MISSING_SUPPLIER_VAT_NUMBER' && !i.blocking));
}
{
    const raw = goodRaw(); raw.supplier.vat_number = '123456789';
    const issues = AINV.Validate.run(AINV.map(raw, {}));
    ok('صيغة الرقم الضريبي المخالفة تُرصد', has(issues, 'INVALID_SAUDI_VAT_FORMAT'));
    ok('لكنها لا تمنع الاعتماد وحدها', !issues.filter(i => i.code === 'INVALID_SAUDI_VAT_FORMAT')[0].blocking);
}
{
    const raw = goodRaw(); raw.due_date = '2026-01-01';
    const issues = AINV.Validate.run(AINV.map(raw, {}));
    ok('الاستحقاق قبل تاريخ الفاتورة يُرصد', has(issues, 'DUE_DATE_BEFORE_INVOICE_DATE'));
}
{
    const raw = goodRaw(); raw.items = [];
    raw.totals = { subtotal: null, discount_total: 0, taxable_amount: 15000, vat_total: 2250, grand_total: 17250 };
    const issues = AINV.Validate.run(AINV.map(raw, {}));
    ok('غياب البنود تحذير لا مانع', issues.some(i => i.code === 'NO_LINE_ITEMS' && !i.blocking));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🇸🇦 [4] رمز الزكاة والضريبة (ZATCA TLV)');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const b64 = AINV.QR.encodeTLV({
        seller_name: 'شركة سواتر الإبداع للمقاولات', vat_number: '311905689900003',
        timestamp: '2026-02-03T10:00:00Z', total_with_vat: 17250, vat_amount: 2250
    });
    const d = AINV.QR.decodeTLV(b64);
    eq('اسم البائع يُفكّ بالعربية سليماً', d.seller_name, 'شركة سواتر الإبداع للمقاولات');
    eq('الرقم الضريبي', d.vat_number, '311905689900003');
    eq('الإجمالي رقماً', d.total_with_vat, 17250);
    eq('الضريبة رقماً', d.vat_amount, 2250);

    // الرمز مطابق للفاتورة ⇒ لا اختلافات
    const raw = goodRaw({ qr_code_raw: b64 });
    const doc = AINV.map(raw, {});
    ok('الرمز يُصنَّف مطابقاً لمواصفة الهيئة', doc.qr_code.is_zatca_compliant === true);
    eq('لا اختلاف بين الرمز ووجه الفاتورة', doc.qr_code.mismatches.length, 0);
    eq('مصدر الإجمالي يصبح رمز QR', doc.provenance.totals_grand_total.source, 'qr_code');
    eq('التحقق يمرّ بلا ملاحظات', AINV.Validate.run(doc).length, 0);
}
{
    // 🛑 الرمز يقول مبلغاً والفاتورة تقول آخر — إشارة تعديل أو تزوير
    const b64 = AINV.QR.encodeTLV({
        seller_name: 'شركة سواتر الإبداع للمقاولات', vat_number: '311905689900003',
        timestamp: '2026-02-03T10:00:00Z', total_with_vat: 11500, vat_amount: 1500
    });
    const doc = AINV.map(goodRaw({ qr_code_raw: b64 }), {});
    const issues = AINV.Validate.run(doc);
    ok('اختلاف إجمالي الرمز يُرصد', has(issues, 'QR_DOCUMENT_MISMATCH_GRAND_TOTAL'));
    ok('ويمنع الاعتماد', AINV.Validate.hasBlocking(issues));
}
{
    // 🛑 رقم ضريبي مختلف بين الرمز والوجه
    const b64 = AINV.QR.encodeTLV({
        seller_name: 'شركة سواتر الإبداع للمقاولات', vat_number: '399999999999993',
        timestamp: '2026-02-03T10:00:00Z', total_with_vat: 17250, vat_amount: 2250
    });
    const doc = AINV.map(goodRaw({ qr_code_raw: b64 }), {});
    ok('اختلاف الرقم الضريبي في الرمز يُرصد', has(AINV.Validate.run(doc), 'QR_DOCUMENT_MISMATCH_VAT_NUMBER'));
}
{
    eq('نصّ غير Base64 لا يُفكّ', AINV.QR.decodeTLV('ليس رمزاً'), null);
    eq('سلسلة فارغة لا تُفكّ', AINV.QR.decodeTLV(''), null);
    const doc = AINV.map(goodRaw({ qr_code_raw: 'https://example.com/invoice/123' }), {});
    ok('رمز غير قياسي يُعلَّم غير مطابق للمواصفة', doc.qr_code.is_zatca_compliant === false);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔎 [5] أثر مصدر الحقل (Provenance)');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const doc = AINV.map(goodRaw(), { provider: 'gemini' });
    eq('مصدر رقم الفاتورة استخراج Gemini', doc.provenance.invoice_number.source, 'gemini_extraction');
    eq('لم يعدّله بشر بعد', doc.provenance.invoice_number.user_modified, false);
    eq('القيمة الأصلية محفوظة', doc.provenance.invoice_number.original_ai_value, 'INV-2026-001');

    const doc2 = AINV.map(goodRaw(), { provider: 'anthropic' });
    eq('مصدر Claude يُميَّز', doc2.provenance.invoice_number.source, 'claude_extraction');

    const doc3 = AINV.map(goodRaw(), { viaOcr: true });
    eq('مصدر OCR يُميَّز', doc3.provenance.invoice_number.source, 'ocr_extraction');
}
{
    // تعديل بشري: تُحفظ قيمة الذكاء الاصطناعي الأصلية ولا تُطمس
    const doc = AINV.map(goodRaw(), {});
    const before = doc.provenance.invoice_number;
    const after = AINV.Audit.touch(before, 'INV-2026-999');
    eq('القيمة الجديدة', after.value, 'INV-2026-999');
    eq('المصدر يصبح إدخال مستخدم', after.source, 'user_input');
    eq('معلَّم بأن بشراً عدّله', after.user_modified, true);
    eq('قيمة الذكاء الاصطناعي الأصلية محفوظة', after.original_ai_value, 'INV-2026-001');

    // تعديل ثانٍ لا يطمس الأصل
    const again = AINV.Audit.touch(after, 'INV-2026-777');
    eq('التعديل المتكرر يُبقي الأصل الأوّل', again.original_ai_value, 'INV-2026-001');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n👯 [6] كشف التكرار');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const doc = AINV.map(goodRaw(), {});
    const store = {
        old1: Object.assign({}, AINV.map(goodRaw(), {}), { status: 'posted' })
    };
    const dup = AINV.Dup.detect(doc, store, 'new1');
    ok('يرصد تكراراً تام التطابق', !!dup);
    ok('بنسبة تتجاوز العتبة', dup.similarity_score >= 0.7, String(dup && dup.similarity_score));
}
{
    // مورد مختلف ورقم مختلف ⇒ لا تكرار
    const doc = AINV.map(goodRaw(), {});
    const other = AINV.map(goodRaw({ invoice_number: 'INV-2026-777', supplier: { name: 'مورد آخر', vat_number: '300000000000003' } }), {});
    other.totals.grand_total = 999;
    eq('لا تكرار بين فاتورتين مختلفتين', AINV.Dup.detect(doc, { o: other }, 'x'), null);
}
{
    // بصمة الملف نفسها ⇒ يقين لا احتمال
    const doc = AINV.map(goodRaw({ invoice_number: 'ANY' }), {});
    doc.file_metadata = { sha256: 'abc123' };
    const store = { old: Object.assign({}, AINV.map(goodRaw({ invoice_number: 'DIFFERENT' }), {}), { file_metadata: { sha256: 'abc123' } }) };
    const dup = AINV.Dup.detect(doc, store, 'me');
    ok('بصمة الملف المتطابقة تكرار قاطع', dup && dup.is_exact_file === true);
    eq('بدرجة يقين كاملة', dup.similarity_score, 1);
}
{
    // الفاتورة المرفوضة لا تُعدّ تكراراً
    const doc = AINV.map(goodRaw(), {});
    const store = { old: Object.assign({}, AINV.map(goodRaw(), {}), { status: 'rejected' }) };
    eq('المرفوضة تُستثنى من كشف التكرار', AINV.Dup.detect(doc, store, 'me'), null);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🤝 [7] مطابقة الموردين');
// ═══════════════════════════════════════════════════════════════════════════════
{
    globalThis.vendors = {
        v1: { nameAr: 'مؤسسة سواتر الإبداع للمقاولات', vatNumber: '311905689900003', crNumber: '1010912286' },
        v2: { nameAr: 'شركة الرياض للتوريدات', vatNumber: '300000000000003' }
    };
    eq('مطابقة بالرقم الضريبي أولاً', AINV.Match.supplier({ vat_number: '311905689900003', name: 'اسم مختلف تماماً' }).match_type, 'EXACT_VAT');
    eq('ثم بالسجل التجاري', AINV.Match.supplier({ commercial_registration: '1010912286', name: 'غير معروف' }).match_type, 'EXACT_CR');
    ok('ثم بتشابه الاسم', ['EXACT_NAME', 'FUZZY_NAME'].includes(AINV.Match.supplier({ name: 'سواتر الإبداع' }).match_type));
    eq('ولا يخترع مطابقة لغريب', AINV.Match.supplier({ name: 'شركة لا وجود لها إطلاقاً' }).match_type, 'NO_MATCH');
    eq('والغريب يُعلَّم مورداً جديداً', AINV.Match.supplier({ name: 'شركة لا وجود لها إطلاقاً' }).is_new, true);
    globalThis.vendors = {};
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📅 [8] التواريخ — الغموض يُرفع للمستخدم لا يُبتلع');
// ═══════════════════════════════════════════════════════════════════════════════
{
    eq('صيغة ISO تُقرأ كما هي', AINV.parseDate('2026-02-03').date, '2026-02-03');
    eq('يوم > 12 يحسم الترتيب', AINV.parseDate('25/02/2026').date, '2026-02-25');
    eq('والعكس كذلك', AINV.parseDate('02/25/2026').date, '2026-02-25');
    const amb = AINV.parseDate('03/02/2026');
    eq('الافتراض يوم/شهر', amb.date, '2026-02-03');
    eq('لكنه معلَّم غامضاً', amb.ambiguous, true);
    eq('مع عرض البديل', amb.alt, '2026-03-02');
    eq('اليوم = الشهر ليس غامضاً', AINV.parseDate('05/05/2026').ambiguous, false);

    const raw = goodRaw({ invoice_date: '03/02/2026' });
    ok('التاريخ الغامض يظهر كملاحظة تحقّق', has(AINV.Validate.run(AINV.map(raw, {})), 'AMBIGUOUS_INVOICE_DATE'));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔤 [9] الأرقام العربية-الهندية');
// ═══════════════════════════════════════════════════════════════════════════════
{
    eq('تحويل الأرقام العربية', AINV.toLatinDigits('١٢٣٤٥'), '12345');
    eq('تحويل الأرقام الفارسية', AINV.toLatinDigits('۱۲۳۴۵'), '12345');
    eq('فواصل الآلاف تُزال', AINV.num('17,250.50'), 17250.5);
    eq('الفاصلة العربية تُزال', AINV.num('١٧٬٢٥٠'), 17250);
    eq('رمز العملة يُتجاهل', AINV.num('17250 ر.س'), 17250);
    eq('الفراغ يعطي null', AINV.num(''), null);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📒 [10] معاينة القيد المحاسبي والتحويل');
// ═══════════════════════════════════════════════════════════════════════════════
{
    globalThis.chartOfAccounts = {
        a1: { code: '5110', nameAr: 'مشتريات مواد' },
        a2: { code: '1180', nameAr: 'ضريبة القيمة المضافة — المدخلات' },
        a3: { code: '2110', nameAr: 'الموردون' }
    };
    const doc = AINV.map(goodRaw(), {});
    const rec = Object.assign({ id: 'r1', expenseType: 'materials', vendorKey: 'v1' }, doc);
    const p = AINV.Accounting.preview(rec);
    eq('ثلاثة أسطر: مصروف + ضريبة + مورد', p.journal_lines.length, 3);
    eq('المدين مصروف بالخاضع', p.journal_lines[0].debit, 15000);
    eq('حساب المصروف من شجرة الحسابات', p.journal_lines[0].account_code, '5110');
    eq('المدين الثاني ضريبة المدخلات', p.journal_lines[1].debit, 2250);
    eq('الدائن الموردون بالإجمالي', p.journal_lines[2].credit, 17250);
    eq('القيد متوازن', p.is_balanced, true);
    eq('لا تنبيهات حين تكتمل الحسابات والربط', p.warnings.length, 0);
}
{
    // بلا ربط مورد ⇒ تنبيه صريح قبل الترحيل
    const doc = AINV.map(goodRaw(), {});
    const p = AINV.Accounting.preview(Object.assign({ id: 'r2', expenseType: 'materials' }, doc));
    ok('غياب ربط المورد يُنبَّه عليه', p.warnings.some(w => w.includes('لم يُربط المورد')));
}
{
    // 🛑 الحقول التي يقرؤها createJournalForPInv فعلاً يجب أن توجد بأسمائها
    const doc = AINV.map(goodRaw(), {});
    const rec = Object.assign({ id: 'r3', expenseType: 'materials', vendorKey: 'v1', projectKey: 'p1' }, doc);
    const pinv = AINV.toPurchaseInvoice(rec);
    ok('vendorId موجود (يقرؤه القيد وكشف حساب المورد)', pinv.vendorId === 'v1');
    ok('netBeforeTax موجود (الطرف المدين في القيد)', pinv.netBeforeTax === 15000);
    ok('debitAccountCode موجود (حساب المدين)', !!pinv.debitAccountCode);
    ok('projectId موجود (مركز التكلفة)', pinv.projectId === 'p1');
    eq('vendorRef = رقم فاتورة المورد', pinv.vendorRef, 'INV-2026-001');
    eq('الإجمالي محسوب بالنظام', pinv.grandTotal, 17250);
    eq('الضريبة محسوبة بالنظام', pinv.vatTotal, 2250);
    eq('تُنشأ مسوّدة لا مُرحَّلة', pinv.status, 'draft');
    eq('أثر المصدر محفوظ', pinv.sourceType, 'ai_extraction');
    globalThis.chartOfAccounts = {};
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔐 [11] الحالات وقواعد الأمان');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // ⚠️ قواعد قاعدة البيانات تحرس 'approved' و'posted' بحروف صغيرة حرفياً
    ok("الحالة 'approved' موجودة بحروف صغيرة", !!AINV.STATUS.approved);
    ok("الحالة 'posted' موجودة بحروف صغيرة", !!AINV.STATUS.posted);
    ok('كل مفاتيح الحالات بحروف صغيرة', Object.keys(AINV.STATUS).every(k => k === k.toLowerCase()),
        Object.keys(AINV.STATUS).filter(k => k !== k.toLowerCase()).join(','));
    ok('المعتمدة مقفلة ضد التعديل', AINV.isLocked({ status: 'approved' }));
    ok('المُرحَّلة مقفلة', AINV.isLocked({ status: 'posted' }));
    ok('التي تحتاج مراجعة غير مقفلة', !AINV.isLocked({ status: 'needs_review' }));
}
{
    // السجل المكتوب يجب أن يحمل status و uploadedAt وإلا رفضته .validate
    const w = AINV.Store.wire({ invoice_number: 'X' });
    ok('السجل يحمل status', typeof w.status === 'string');
    ok('السجل يحمل uploadedAt رقماً', typeof w.uploadedAt === 'number');
    ok('undefined لا يصل إلى قاعدة البيانات', JSON.stringify(AINV.clean({ a: 1, b: undefined, c: null })) === '{"a":1}');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🎯 [12] الثقة — شهادة النظام لا شهادة النموذج');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const doc = AINV.map(goodRaw(), {});
    const clean = AINV.confidence(doc, AINV.Validate.run(doc));
    const raw = goodRaw(); raw.totals.grand_total = 20000;
    const bad = AINV.map(raw, {});
    const dirty = AINV.confidence(bad, AINV.Validate.run(bad));
    ok('ثقة الفاتورة السليمة عالية', clean.percent >= 90, String(clean.percent));
    ok('والمختلّة أقل بوضوح', dirty.percent < clean.percent, `${dirty.percent} vs ${clean.percent}`);

    // نموذج «واثق» من مستند رديء لا يُصدَّق على علّاته
    const poor = AINV.map(goodRaw({ document_quality: 'poor', overall_confidence: 1 }), {});
    ok('رداءة المستند تخفض الثقة رغم ادّعاء النموذج', AINV.confidence(poor, []).percent < 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n♻️ [13] ترقية سجلات الإصدار الأول');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const v1 = {
        status: 'approved', uploadedAt: 1750000000000, fileName: 'inv.pdf', model: 'gemini-2.5-flash',
        confidence: { overall: 92 },
        extracted: {
            docType: 'tax_invoice', number: 'OLD-1', date: '2026-01-05', currency: 'SAR',
            supplier: { name: 'مورد قديم', vatNumber: '311905689900003' },
            items: [{ description: 'صنف', qty: 2, unitPrice: 50, vatRate: 15, taxable: 100, vatAmount: 15, total: 115 }],
            totals: { taxable: 100, vat: 15, grandTotal: 115 }
        }
    };
    const up = AINV.Store.normalize('k1', v1);
    eq('رقم الفاتورة يُقرأ', up.invoice_number, 'OLD-1');
    eq('النوع يُترجم للمخطّط الجديد', up.document_type, 'TAX_INVOICE');
    eq('اسم المورد يُقرأ', up.supplier.name, 'مورد قديم');
    eq('البنود تُترجم', up.items.length, 1);
    eq('اسم البند من الوصف القديم', up.items[0].item_name, 'صنف');
    eq('الإجمالي يُقرأ', up.totals.grand_total, 115);
    eq('الثقة تُحوَّل إلى نسبة مئوية', up.confidence_percent, 92);
    eq('السجل معلَّم بأنه قديم', up.legacy_v1, true);
    ok('وإعادة الاحتساب تعمل عليه', AINV.recompute(up).computed.grandTotal === 115);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(56)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(56)}`);
process.exit(fail ? 1 : 0);
