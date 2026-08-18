// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🤖 اختبارات محرّك قراءة الفواتير (public/aiinvoice-engine.js)              ║
// ║  التشغيل:  npm run test:ai   (بلا متصفح ولا شبكة — Node فقط)                ║
// ║  ────────────────────────────────────────────────────────────────────────  ║
// ║  المُختبَر هنا هو ما يحمي المال: **الحساب والتحقق يجريان في الكود لا في      ║
// ║  النموذج** (المتطلّب §10 و§27). كل حالة تحاكي فاتورة حقيقية أو رداً معطوباً   ║
// ║  من النموذج، وتتأكّد أن النظام يمسك الخطأ بدل أن يمرّره إلى القيد المحاسبي.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

globalThis.window = globalThis;
globalThis.cfg = { currency: 'SAR' };
await import('../public/aiinvoice-engine.js');
const AINV = globalThis.AINV;

let pass = 0, fail = 0;
function eq(name, actual, expected) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log(`  ❌ ${name}\n       متوقّع: ${e}\n       فعلي  : ${a}`); }
}
const ok = (n, c) => eq(n, !!c, true);

/** فاتورة نموذجية سليمة: 2 بند، 15%، بلا خصم. */
function goodInvoice(over) {
    return Object.assign({
        isInvoice: true, docType: 'tax_invoice', quality: 'good', language: 'عربي',
        number: 'INV-2026-001', date: '2026-02-03', hijriDate: '', dueDate: '2026-03-05',
        poNumber: '', contractNumber: '', reference: '', currency: 'SAR',
        supplier: { name: 'شركة سواتر الإبداع للمقاولات', legalName: '', vatNumber: '311905689900003', crNumber: '1010912286', address: '', phone: '', email: '', iban: '' },
        customer: { name: 'شركة جي بي ار للمقاولات', vatNumber: '312733987800003', crNumber: '', address: '' },
        items: [
            { idx: 0, code: '', description: 'توريد حجر', qty: 100, unit: 'متر', unitPrice: 100, discount: null, taxable: 10000, vatRate: 15, vatAmount: 1500, total: 11500 },
            { idx: 1, code: '', description: 'تركيب', qty: 1, unit: 'مقطوعية', unitPrice: 5000, discount: null, taxable: 5000, vatRate: 15, vatAmount: 750, total: 5750 }
        ],
        totals: { subtotalBeforeDiscount: 15000, discount: null, taxable: 15000, vat: 2250, grandTotal: 17250, paid: null, due: null },
        vatBreakdown: [], modelConfidence: { overall: 95 }, modelWarnings: []
    }, over || {});
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔢 [1] إعادة احتساب البنود — النظام يحسب، لا النموذج');
// ═══════════════════════════════════════════════════════════════════════════
{
    const c = AINV.computeLine({ qty: 100, unitPrice: 100, discount: null, vatRate: 15, taxable: 10000, vatAmount: 1500, total: 11500 });
    eq('كمية × سعر = الإجمالي قبل الخصم', c.lineSubtotal, 10000);
    eq('الخاضع للضريبة', c.taxable, 10000);
    eq('الضريبة = الخاضع × النسبة', c.vatAmount, 1500);
    eq('إجمالي البند = خاضع + ضريبة', c.lineTotal, 11500);
    eq('لا ملاحظات على بند سليم', c.issues.length, 0);
}
{
    const c = AINV.computeLine({ qty: 10, unitPrice: 100, discount: 200, vatRate: 15, taxable: 800, vatAmount: 120, total: 920 });
    eq('الخصم يُخصم قبل الضريبة', c.taxable, 800);
    eq('الضريبة على ما بعد الخصم', c.vatAmount, 120);
    eq('بند بخصم سليم بلا ملاحظات', c.issues.length, 0);
}
{
    // 🛑 النموذج نقل ضريبة خاطئة — النظام يجب أن يمسكها
    const c = AINV.computeLine({ qty: 10, unitPrice: 100, discount: null, vatRate: 15, taxable: 1000, vatAmount: 100, total: 1100 });
    ok('يُمسك خطأ مبلغ الضريبة', c.issues.some(i => i.field === 'vatAmount'));
    eq('الصحيح محسوب لا منقول', c.vatAmount, 150);
}
{
    // نسبة غير مذكورة → تُستنتج من المبلغ المكتوب
    const c = AINV.computeLine({ qty: 1, unitPrice: 1000, discount: null, vatRate: null, taxable: 1000, vatAmount: 50, total: 1050 });
    eq('استنتاج النسبة من المبلغ', c.rate, 5);
    eq('لا يفترض 15% أبداً', c.vatAmount, 50);
}
{
    const c = AINV.computeLine({ qty: 3, unitPrice: 33.33, discount: null, vatRate: 15, taxable: 99.99, vatAmount: 15, total: 114.99 });
    eq('تسامح التقريب لا يُنتج خطأً زائفاً', c.issues.length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🧮 [2] التحقق من الإجماليات');
// ═══════════════════════════════════════════════════════════════════════════
{
    const v = AINV.validate(goodInvoice());
    eq('فاتورة سليمة بلا أخطاء', v.errors.length, 0);
    eq('المجموع المحسوب', v.computed.grandTotal, 17250);
    eq('الضريبة المحسوبة', v.computed.vat, 2250);
    ok('صالحة للاعتماد', v.ok);
}
{
    // 🛑 إجمالي مكتوب لا يطابق البنود — أخطر حالة على الإطلاق
    const v = AINV.validate(goodInvoice({ totals: { taxable: 15000, vat: 2250, grandTotal: 20000, discount: null, subtotalBeforeDiscount: null, paid: null, due: null } }));
    ok('🔑 يُمسك اختلاف الإجمالي عن مجموع البنود', v.errors.some(e => e.field === 'grandTotal'));
    ok('لا تُعتمد', !v.ok);
}
{
    // 🛑 إجماليات غير متوازنة داخلياً: خاضع + ضريبة ≠ إجمالي
    const v = AINV.validate(goodInvoice({
        items: [{ idx: 0, description: 'بند', qty: 1, unitPrice: 1000, discount: null, taxable: 1000, vatRate: 15, vatAmount: 150, total: 1150 }],
        totals: { taxable: 1000, vat: 150, grandTotal: 1200, discount: null, subtotalBeforeDiscount: null, paid: null, due: null }
    }));
    ok('🔑 يُمسك عدم التوازن الداخلي', v.errors.some(e => /غير متوازنة|لا يطابق/.test(e.msg)));
}
{
    const v = AINV.validate(goodInvoice({ items: [] }));
    ok('فاتورة بلا بنود = خطأ', v.errors.some(e => e.field === 'items'));
}
{
    // إجمالي غير مذكور في المستند → تحذير لا خطأ، ويُحتسب
    const v = AINV.validate(goodInvoice({ totals: { taxable: null, vat: null, grandTotal: null, discount: null, subtotalBeforeDiscount: null, paid: null, due: null } }));
    eq('غياب الإجماليات لا يُعد خطأً', v.errors.filter(e => ['taxable', 'vat', 'grandTotal'].includes(e.field)).length, 0);
    ok('يُحذَّر بأنها احتُسبت', v.warnings.some(w => w.field === 'grandTotal'));
    eq('والقيمة المحسوبة صحيحة', v.computed.grandTotal, 17250);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🇸🇦 [3] قواعد الفاتورة السعودية');
// ═══════════════════════════════════════════════════════════════════════════
eq('رقم ضريبي صحيح', AINV.Saudi.checkVat('311905689900003').ok, true);
eq('طول خاطئ يُرفض', AINV.Saudi.checkVat('31190568990').ok, false);
eq('لا يبدأ بـ3 يُرفض', AINV.Saudi.checkVat('411905689900003').ok, false);
eq('لا ينتهي بـ3 يُرفض', AINV.Saudi.checkVat('311905689900004').ok, false);
eq('فارغ = لا رأي', AINV.Saudi.checkVat('').ok, null);
eq('سجل تجاري 10 أرقام', AINV.Saudi.checkCr('1010912286').ok, true);
eq('سجل تجاري بطول خاطئ', AINV.Saudi.checkCr('101091').ok, false);
{
    const v = AINV.validate(goodInvoice({ supplier: Object.assign({}, goodInvoice().supplier, { vatNumber: '123' }) }));
    ok('رقم ضريبي معطوب = تحذير', v.warnings.some(w => w.field === 'supplier.vatNumber'));
}
{
    // 🛑 لا يُفترض 15% أبداً — نسبة 5% تُحترم وتُحذَّر فقط
    const inv = goodInvoice({
        items: [{ idx: 0, description: 'بند', qty: 1, unitPrice: 1000, discount: null, taxable: 1000, vatRate: 5, vatAmount: 50, total: 1050 }],
        totals: { taxable: 1000, vat: 50, grandTotal: 1050, discount: null, subtotalBeforeDiscount: null, paid: null, due: null }
    });
    const v = AINV.validate(inv);
    eq('🔑 النسبة غير القياسية تُحترم لا تُصحَّح', v.computed.vat, 50);
    eq('ولا تُعد خطأً', v.errors.length, 0);
    ok('لكن يُنبَّه عليها', v.warnings.some(w => w.field === 'vatRate'));
}
{
    // أكثر من نسبة ضريبة → تُعالَج كلٌّ على حدة (§6)
    const inv = goodInvoice({
        items: [
            { idx: 0, description: 'خاضع', qty: 1, unitPrice: 1000, discount: null, taxable: 1000, vatRate: 15, vatAmount: 150, total: 1150 },
            { idx: 1, description: 'معفى', qty: 1, unitPrice: 500, discount: null, taxable: 500, vatRate: 0, vatAmount: 0, total: 500 }
        ],
        totals: { taxable: 1500, vat: 150, grandTotal: 1650, discount: null, subtotalBeforeDiscount: null, paid: null, due: null }
    });
    const v = AINV.validate(inv);
    eq('🔑 نسبتان مختلفتان تُفصلان', v.computed.rates.length, 2);
    eq('إجمالي الضريبة صحيح', v.computed.vat, 150);
    eq('الإجمالي صحيح', v.computed.grandTotal, 1650);
    eq('بلا أخطاء', v.errors.length, 0);
}
{
    const v = AINV.validate(goodInvoice({ docType: 'quotation' }));
    ok('عرض السعر لا يصلح للترحيل', v.warnings.some(w => /عرض سعر|مبدئية/.test(w.msg)));
}
{
    const v = AINV.validate(goodInvoice({ customer: { name: 'عميل', vatNumber: '', crNumber: '', address: '' } }));
    ok('فاتورة ضريبية بلا رقم ضريبي للعميل تُنبَّه', v.warnings.some(w => w.field === 'docType'));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📅 [4] التواريخ والأرقام العربية');
// ═══════════════════════════════════════════════════════════════════════════
eq('YYYY-MM-DD كما هو', AINV.normDate('2026-02-03'), '2026-02-03');
eq('DD/MM/YYYY', AINV.normDate('03/02/2026'), '2026-02-03');
eq('D/M/YYYY يُقرأ يوماً/شهراً', AINV.normDate('3/2/2026'), '2026-02-03');
eq('يوم > 12 يحسم الترتيب', AINV.normDate('25/02/2026'), '2026-02-25');
eq('شهر > 12 يحسم الترتيب عكسياً', AINV.normDate('02/25/2026'), '2026-02-25');
ok('🔑 التاريخ الغامض يُوسَم', AINV.parseDate('3/2/2026').ambiguous);
eq('ويُعرض البديل', AINV.parseDate('3/2/2026').alt, '2026-03-02');
ok('غير الغامض لا يُوسَم', !AINV.parseDate('25/02/2026').ambiguous);
ok('اليوم = الشهر ليس غامضاً', !AINV.parseDate('05/05/2026').ambiguous);
eq('صيغة بنقاط', AINV.normDate('2026.02.03'), '2026-02-03');
eq('غير صالح = فارغ', AINV.normDate('غداً'), '');
eq('أرقام هندية → لاتينية', AINV.toLatinDigits('١٢٣٤٥'), '12345');
eq('أرقام فارسية → لاتينية', AINV.toLatinDigits('۱۲۳'), '123');
eq('num يزيل فواصل الآلاف', AINV.num('17,250.50'), 17250.5);
eq('num يزيل رمز العملة', AINV.num('١٧٬٢٥٠ ر.س'), 17250);
eq('num لفارغ = null', AINV.num(''), null);
{
    const v = AINV.validate(goodInvoice({ date: '2099-01-01' }));
    ok('تاريخ مستقبلي = تحذير', v.warnings.some(w => w.field === 'date'));
}
{
    const v = AINV.validate(goodInvoice({ date: '' }));
    ok('تاريخ مفقود = خطأ', v.errors.some(e => e.field === 'date'));
}
{
    const inv = AINV.map({
        document: { document_type: 'tax_invoice', invoice_number: 'A', invoice_date: '3/2/2026', currency: 'SAR' },
        supplier: { name: 'م' }, customer: { name: 'ع' },
        items: [{ description: 'ب', quantity: 1, unit_price: 100, vat_rate: 15 }],
        totals: { grand_total: 115 }, confidence: {}, warnings: []
    });
    ok('🔑 التاريخ الغامض يُحذَّر منه في التحقق', AINV.validate(inv).warnings.some(w => /غامض/.test(w.msg)));
}
{
    const v = AINV.validate(goodInvoice({ dueDate: '2026-01-01' }));
    ok('استحقاق قبل التاريخ = تحذير', v.warnings.some(w => w.field === 'dueDate'));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📉 [5] الثقة — لا نثق بالنموذج وحده');
// ═══════════════════════════════════════════════════════════════════════════
{
    const inv = goodInvoice();
    const c = AINV.confidence(inv, AINV.validate(inv));
    ok('ثقة عالية لفاتورة سليمة', c.overall >= 85);
    ok('الرقم الضريبي الصحيح يرفع ثقته', c.supplier_vat_number >= 90);
}
{
    // 🛑 النموذج «واثق» 100% لكن الرقم الضريبي معطوب — النظام يخفض الثقة
    const inv = goodInvoice({
        supplier: Object.assign({}, goodInvoice().supplier, { vatNumber: '999' }),
        modelConfidence: { overall: 100, supplier_vat_number: 100 }
    });
    const c = AINV.confidence(inv, AINV.validate(inv));
    ok('🔑 ثقة النموذج لا تتجاوز إشارات النظام', c.supplier_vat_number < 60);
    ok('والثقة الكلية تنخفض معها', c.overall < 100);
}
{
    // إجماليات معطوبة تهبط بثقة الإجماليات
    const inv = goodInvoice({ totals: { taxable: 15000, vat: 2250, grandTotal: 99999, discount: null, subtotalBeforeDiscount: null, paid: null, due: null } });
    const c = AINV.confidence(inv, AINV.validate(inv));
    ok('خطأ حسابي يهبط بثقة الإجماليات', c.totals < 50);
}
{
    const inv = goodInvoice({ quality: 'poor' });
    const c = AINV.confidence(inv, AINV.validate(inv));
    ok('جودة المستند سقف للثقة', c.overall <= 70);
}
{
    globalThis.cfg.aiInvoice = { confidenceThreshold: 85 };
    const low = AINV.lowFields({ overall: 90, invoice_number: 95, supplier_vat_number: 40, totals: 88 });
    eq('يرصد الحقول دون العتبة', low, ['supplier_vat_number']);
    delete globalThis.cfg.aiInvoice;
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🏭 [6] مطابقة المورّد — بلا إنشاء تلقائي');
// ═══════════════════════════════════════════════════════════════════════════
globalThis.vendors = {
    v1: { nameAr: 'شركة سواتر الإبداع للمقاولات', vatNumber: '311905689900003' },
    v2: { nameAr: 'مؤسسة النور التجارية', vatNumber: '300000000000003' },
    v3: { nameAr: 'شركة البناء الحديث', crNumber: '4030123456' }
};
{
    const m = AINV.matchVendor({ name: 'اسم مختلف تماماً', vatNumber: '311905689900003', crNumber: '' });
    eq('🔑 الرقم الضريبي مطابقة قاطعة', m.key, 'v1');
    ok('ويوسم كمطابقة أكيدة', m.exact);
}
{
    const m = AINV.matchVendor({ name: 'سواتر الابداع للمقاولات', vatNumber: '', crNumber: '' });
    eq('تشابه الاسم رغم اختلاف الهمزات', m.key, 'v1');
    ok('لكنه ترشيح لا مطابقة أكيدة', !m.exact);
}
{
    const m = AINV.matchVendor({ name: 'شركة لا وجود لها إطلاقاً', vatNumber: '', crNumber: '' });
    eq('🔑 لا مطابق ⇒ لا يُنشأ مورّد', m.key, '');
    ok('ويُبلَّغ أنه جديد', /جديد/.test(m.reason));
}
{
    const m = AINV.matchVendor({ name: '', vatNumber: '', crNumber: '4030123456' });
    eq('مطابقة بالسجل التجاري', m.key, 'v3');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n♻️ [7] كشف التكرار');
// ═══════════════════════════════════════════════════════════════════════════
globalThis.pinv = {
    p1: { vendorRef: 'INV-2026-001', vendorKey: 'v1', date: '2026-02-03', grandTotal: 17250 },
    p2: { vendorRef: 'OTHER-9', vendorKey: 'v2', date: '2026-01-01', grandTotal: 500 }
};
globalThis.aiInvoices = {};
{
    const d = AINV.findDuplicates(goodInvoice(), 'v1', null);
    ok('🔑 يكشف نفس المورّد ونفس رقم الفاتورة', d.length >= 1);
    eq('ويحدّد السجل السابق', d[0].key, 'p1');
}
{
    // مختلف في كل شيء ⇒ لا تكرار
    const d = AINV.findDuplicates(goodInvoice({ number: 'INV-2026-999', date: '2026-05-05', totals: Object.assign({}, goodInvoice().totals, { grandTotal: 999 }) }), 'v1', null);
    eq('فاتورة مختلفة تماماً = لا تكرار', d.length, 0);
}
{
    // مورّد آخر بنفس الرقم ⇒ ليس تكراراً لدى هذا المورّد
    const d = AINV.findDuplicates(goodInvoice({ date: '2026-05-05', totals: Object.assign({}, goodInvoice().totals, { grandTotal: 999 }) }), 'v2', null);
    eq('نفس الرقم لدى مورّد آخر ليس تكراراً', d.length, 0);
}
{
    const d = AINV.findDuplicates(goodInvoice({ number: 'X-1' }), 'v1', null);
    eq('نفس المورّد والتاريخ والإجمالي = تكرار محتمل', d.length, 1);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔄 [8] التحويل إلى فاتورة مشتريات');
// ═══════════════════════════════════════════════════════════════════════════
{
    globalThis.curU = { uid: 'u1', email: 'a@b.c' };
    const inv = goodInvoice();
    const rec = { id: 'ai1', extracted: inv, validation: AINV.validate(inv), vendorKey: 'v1', confidence: { overall: 95 }, fileUrl: 'https://x/y.pdf' };
    const p = AINV.toPurchaseInvoice(rec);
    eq('رقم فاتورة المورّد محفوظ', p.vendorRef, 'INV-2026-001');
    eq('المورّد مربوط', p.vendorKey, 'v1');
    eq('عدد البنود', p.lines.length, 2);
    eq('🔑 الإجمالي من الحساب لا من النموذج', p.grandTotal, 17250);
    eq('الضريبة من الحساب', p.vatTotal, 2250);
    eq('يبدأ مسوّدة لا مُرحَّلاً', p.status, 'draft');
    eq('🔑 أثر المصدر محفوظ', p.sourceId, 'ai1');
    eq('ورابط المستند الأصلي', p.sourceFileUrl, 'https://x/y.pdf');
    eq('صافي البند الأول', p.lines[0].net, 10000);
    eq('ضريبة البند الأول', p.lines[0].vatAmount, 1500);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n⚙️ [9] الإعدادات والجاهزية والتكلفة');
// ═══════════════════════════════════════════════════════════════════════════
{
    const GKEY = 'AIza' + 'x'.repeat(30);
    globalThis.cfg.aiInvoice = {};
    ok('بلا مفتاح ولا وسيط ⇒ غير جاهز', !AINV.Config.ready().ok);
    ok('والسبب يذكر مفتاح Gemini', /Gemini|مفتاح/.test(AINV.Config.ready().reason));
    globalThis.cfg.aiInvoice = { geminiKey: GKEY };
    ok('🟢 مفتاح Gemini ⇒ جاهز مباشرةً (بلا Worker)', AINV.Config.ready().ok);
    globalThis.cfg.aiInvoice = { provider: 'anthropic', proxyUrl: 'http://insecure.example' };
    ok('🔑 Anthropic برابط غير https مرفوض', !AINV.Config.ready().ok);
    globalThis.cfg.aiInvoice = { provider: 'anthropic', proxyUrl: 'https://p.workers.dev' };
    ok('Anthropic برابط https صالح ⇒ جاهز', AINV.Config.ready().ok);
    globalThis.cfg.aiInvoice = { enabled: false, geminiKey: GKEY };
    ok('معطّلة من الإعدادات ⇒ غير جاهز', !AINV.Config.ready().ok);
    delete globalThis.cfg.aiInvoice;
}
{
    const c = AINV.estimateCost('claude-opus-5', { input_tokens: 2000, output_tokens: 1000 });
    ok('تكلفة موجبة ومعقولة', c > 0 && c < 1);
    ok('النموذج الأرخص أرخص فعلاً',
        AINV.estimateCost('claude-haiku-4-5', { input_tokens: 2000, output_tokens: 1000 }) < c);
}
{
    const f = AINV.validateFile({ name: 'x.txt', type: 'text/plain', size: 100 });
    ok('نوع غير مدعوم يُرفض', !f.ok);
    const f2 = AINV.validateFile({ name: 'x.pdf', type: 'application/pdf', size: 0 });
    ok('ملف فارغ يُرفض', !f2.ok);
    const f3 = AINV.validateFile({ name: 'x.pdf', type: 'application/pdf', size: 99 * 1048576 });
    ok('ملف ضخم يُرفض', !f3.ok);
    const f4 = AINV.validateFile({ name: 'x.pdf', type: 'application/pdf', size: 1048576 });
    ok('PDF صالح يُقبل', f4.ok);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🗂️ [10] الحالات والتطبيع');
// ═══════════════════════════════════════════════════════════════════════════
{
    ['uploaded', 'processing', 'extracted', 'needs_review', 'validated', 'draft', 'approved', 'posted', 'rejected', 'failed']
        .forEach(s => ok('حالة معرَّفة: ' + s, !!AINV.STATUS[s]));
}
{
    const m = AINV.map({
        document: { document_type: 'tax_invoice', invoice_number: 'A-1', invoice_date: '03/02/2026', currency: 'sar' },
        supplier: { name: ' مورّد ', vat_number: '3 1190 5689 9000 03', commercial_registration: '1010-912286' },
        customer: { name: 'عميل' },
        items: [{ description: 'بند', quantity: '٢', unit_price: '1,000.50', vat_rate: 15 }],
        totals: { grand_total: '2,301.15' },
        confidence: { overall: 90 }, warnings: ['نص باهت']
    });
    eq('العملة تُرفع لأحرف كبيرة', m.currency, 'SAR');
    eq('🔑 الرقم الضريبي تُنزع فواصله', m.supplier.vatNumber, '311905689900003');
    eq('السجل التجاري كذلك', m.supplier.crNumber, '1010912286');
    eq('الاسم يُقلَّم', m.supplier.name, 'مورّد');
    eq('التاريخ يُطبَّع', m.date, '2026-02-03');
    eq('الكمية العربية تُحوَّل', m.items[0].qty, 2);
    eq('السعر بفواصل يُحلَّل', m.items[0].unitPrice, 1000.5);
    eq('تحذيرات النموذج محفوظة', m.modelWarnings, ['نص باهت']);
}
{
    const m = AINV.map({ document: {}, supplier: {}, customer: {}, items: [], totals: {}, confidence: {}, warnings: [], is_invoice: false });
    eq('is_invoice=false يُنقل', m.isInvoice, false);
    const v = AINV.validate(m);
    ok('ومستند غير فاتورة يُرفض', v.errors.some(e => /فاتورة صالح/.test(e.msg)));
}

console.log(`\n═══ النتيجة: ${pass} ناجح · ${fail} فاشل ═══`);
process.exit(fail ? 1 : 0);
