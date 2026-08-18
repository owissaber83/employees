// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  📄 اختبارات محرّك محرر PDF (public/pdfeditor-engine.js)                    ║
// ║  التشغيل:  npm run test:pdf   (بلا متصفح ولا محاكي — Node فقط)              ║
// ║  ────────────────────────────────────────────────────────────────────────  ║
// ║  يُختبَر **نفس الكود المُستخدَم في الإنتاج** عبر تحميل ملف المحرك في Node مع   ║
// ║  غلاف DOM أدنى. المُختبَر هنا هو المنطق النقي الذي يقرّر صحّة المخرَج:          ║
// ║   · إعادة الترتيب ثنائي الاتجاه (عربي + إنجليزي + أرقام + عملات)             ║
// ║   · مجزّئ تدفّق المحتوى وإزالة عمليات إظهار النص (جوهر «التحرير الحقيقي»)     ║
// ║   · الملاءمة التلقائية · تحليل أسماء الخطوط · الألوان · وصف العمليات         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── غلاف DOM أدنى: المحرك يلمس window/document عند التحميل فقط بشكل سطحي ──
const noop = () => { };
globalThis.window = globalThis;
globalThis.document = {
    head: { appendChild: noop },
    createElement: () => ({
        getContext: () => ({
            measureText: t => ({ width: t.length * 7 }),
            set font(v) { this._f = v; }, get font() { return this._f; }
        }),
        toDataURL: () => 'data:image/png;base64,'
    })
};
globalThis.console.log = ((orig) => (...a) => {
    if (typeof a[0] === 'string' && a[0].startsWith('✅ PDF Editor Engine')) return;  // كتم بصمة التحميل
    orig(...a);
})(console.log);

await import('../public/pdfeditor-engine.js');
const PDFE = globalThis.PDFE;

let pass = 0, fail = 0;
function eq(name, actual, expected) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log(`  ❌ ${name}\n       متوقّع: ${e}\n       فعلي  : ${a}`); }
}
function ok(name, cond) { eq(name, !!cond, true); }

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔤 [1] العربية — إعادة الترتيب ثنائي الاتجاه (§8)');
// ═══════════════════════════════════════════════════════════════════════════
const runs = (t, d) => PDFE.Arabic.visualRuns(t, d).map(r => r.text);
const joined = (t, d) => runs(t, d).join('|');

eq('عربي خالص يبقى مقطعاً واحداً',
    joined('شركة المقاولات الحديثة', 'rtl'), 'شركة المقاولات الحديثة');

eq('إنجليزي خالص يبقى مقطعاً واحداً',
    joined('Invoice No. INV-2026-001', 'ltr'), 'Invoice No. INV-2026-001');

ok('عربي + رقم + عملة يُقسَّم لمقاطع بصرية متعدّدة',
    PDFE.Arabic.visualRuns('إجمالي المبلغ 125,500.00 SAR', 'rtl').length >= 2);

{
    // في نص أساسه RTL يجب أن يظهر الرقم واللاتيني **يساراً** (أي أول مقطع بصري)
    const r = PDFE.Arabic.visualRuns('إجمالي المبلغ 125,500.00 SAR', 'rtl');
    ok('الرقم/اللاتيني يسبق العربي بصرياً في نص RTL', !r[0].rtl);
    ok('آخر مقطع عربي (يمين الصفحة)', r[r.length - 1].rtl === true);
    eq('لا يضيع أي حرف عند إعادة الترتيب',
        r.map(x => x.text).join('').split('').sort().join(''),
        'إجمالي المبلغ 125,500.00 SAR'.split('').sort().join(''));
}

{
    // 🛑 انحدار: الرقم داخل العربي يجب ألا ينعكس داخلياً (١٢٥ لا تصبح ٥٢١)
    const r = PDFE.Arabic.visualRuns('المبلغ 12345 ريال', 'rtl');
    ok('أرقام النص العربي تحافظ على ترتيبها الداخلي', r.some(x => x.text.includes('12345')));
    ok('لا يظهر الرقم معكوساً', !r.some(x => x.text.includes('54321')));
}

eq('نص مختلط يُكتشف اتجاهه تلقائياً كـ rtl',
    PDFE.Arabic.detectDir('فاتورة Invoice رقم 5'), 'rtl');
eq('نص لاتيني غالب يُكتشف كـ ltr',
    PDFE.Arabic.detectDir('Invoice number 5 فاتورة'), 'ltr');
eq('كشف اللغة المختلطة', PDFE.Arabic.detectLang('فاتورة Invoice'), 'عربي + إنجليزي');
eq('كشف اللغة العربية', PDFE.Arabic.detectLang('فاتورة ضريبية'), 'عربي');
ok('كشف وجود العربية', PDFE.Arabic.hasArabic('SAR ريال'));
ok('نص لاتيني خالص ليس RTL', !PDFE.Arabic.hasRTL('Total 100.00'));
eq('نص فارغ يعطي قائمة فارغة', PDFE.Arabic.visualRuns('', 'rtl'), []);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n✂️ [2] جراحة تدفّق المحتوى — النواة التي تجعل التحرير حقيقياً (§49)');
// ═══════════════════════════════════════════════════════════════════════════
const enc = s => new Uint8Array([...s].map(c => c.charCodeAt(0)));
const dec = b => String.fromCharCode(...b);

{
    const cs = enc('BT /F1 12 Tf 100 700 Td (Hello World) Tj ET');
    const ops = PDFE.CS.findTextOps(cs);
    eq('يرصد عملية Tj واحدة', ops.length, 1);
    eq('يحسب عدد الحروف بدقة', ops[0].glyphs, 'Hello World'.length);
    const r = PDFE.CS.blankTextOps(cs, new Set([0]));
    eq('أُزيلت عملية واحدة', r.removed, 1);
    ok('اختفى النص من التدفّق فعلياً', !dec(r.bytes).includes('Hello World'));
    ok('بقيت بقية العمليات سليمة', dec(r.bytes).includes('Td') && dec(r.bytes).includes('Tj') && dec(r.bytes).includes('ET'));
}

{
    const cs = enc('BT (One) Tj (Two) Tj (Three) Tj ET');
    eq('يرصد ثلاث عمليات', PDFE.CS.findTextOps(cs).length, 3);
    const r = PDFE.CS.blankTextOps(cs, new Set([1]));
    const out = dec(r.bytes);
    ok('حُذف الهدف فقط (Two)', !out.includes('Two'));
    ok('لم يُمَس ما قبله (One)', out.includes('One'));
    ok('لم يُمَس ما بعده (Three)', out.includes('Three'));
}

{
    // TJ بمصفوفة (الشكل الأشيع في الفواتير المولّدة آلياً)
    const cs = enc('BT [(Inv) -250 (oice) -120 (2026)] TJ ET');
    const ops = PDFE.CS.findTextOps(cs);
    eq('يرصد TJ كعملية واحدة', ops.length, 1);
    eq('يجمع حروف كل أجزاء المصفوفة', ops[0].glyphs, 'Invoice2026'.length);
    const out = dec(PDFE.CS.blankTextOps(cs, new Set([0])).bytes);
    ok('أُفرغت المصفوفة كاملة', out.includes('[] TJ') || out.includes('[]TJ'));
    ok('لا يبقى أي جزء من النص', !out.includes('oice') && !out.includes('2026'));
}

{
    // 🛑 انحدار: الأقواس داخل النص يجب ألا تربك المجزّئ
    const cs = enc('BT (Total \\(net\\) 100) Tj (After) Tj ET');
    eq('الأقواس المهروبة لا تكسر التجزئة', PDFE.CS.findTextOps(cs).length, 2);
    const out = dec(PDFE.CS.blankTextOps(cs, new Set([0])).bytes);
    ok('حُذف النص ذو الأقواس', !out.includes('net'));
    ok('بقي ما بعده', out.includes('After'));
}

{
    // 🛑 انحدار: صورة مضمّنة (BI…ID…EI) تحوي بايتات ثنائية تشبه المعاملات
    const cs = enc('BI /W 2 /H 2 ID \x00(Tj)\x01 EI BT (Real) Tj ET');
    const ops = PDFE.CS.findTextOps(cs);
    eq('البيانات الثنائية داخل الصورة المضمّنة لا تُحسب عمليات نص', ops.length, 1);
    const out = dec(PDFE.CS.blankTextOps(cs, new Set([0])).bytes);
    ok('حُذف النص الحقيقي فقط', !out.includes('Real') && out.includes('EI'));
}

{
    // النص الست عشري <...> — شائع في الخطوط المضمّنة العربية
    const cs = enc('BT <0627062C> Tj ET');
    eq('يرصد النص الست عشري كعملية', PDFE.CS.findTextOps(cs).length, 1);
    ok('أُزيل النص الست عشري', !dec(PDFE.CS.blankTextOps(cs, new Set([0])).bytes).includes('0627'));
}

{
    // التعليقات لا تُخلط بالمعاملات
    const cs = enc('% (fake) Tj comment\nBT (Real) Tj ET');
    eq('التعليق لا يُحسب عملية نص', PDFE.CS.findTextOps(cs).length, 1);
}

eq('فهرس غير موجود لا يغيّر شيئاً',
    PDFE.CS.blankTextOps(enc('BT (A) Tj ET'), new Set([9])).removed, 0);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📐 [3] الملاءمة التلقائية عند الاستبدال (§7)');
// ═══════════════════════════════════════════════════════════════════════════
{
    const item = { str: 'شركة ABC للمقاولات', w: 120, fontSize: 12, charSpacing: 0 };
    const same = PDFE.Style.autoFit(item, 'شركة XYZ للمقاولات', { boxWidth: 120 });
    eq('نص بنفس الطول → لا تغيير في الحجم', same.fontSize, 12);
    eq('نص بنفس الطول → مقياس 1', same.scale, 1);

    const longer = PDFE.Style.autoFit(item, 'شركة XYZ العالمية للمقاولات والتشييد المحدودة', { boxWidth: 120 });
    ok('نص أطول بكثير → يُصغَّر الخط', longer.fontSize < 12);
    ok('لا يُصغَّر تحت 72% (حدّ المقروئية)', longer.fontSize >= 12 * 0.72 - 1e-9);

    const bitLonger = PDFE.Style.autoFit(item, 'شركة XYZW للمقاولات', { boxWidth: 120 });
    eq('زيادة طفيفة → يُضيَّق التباعد لا الخط', bitLonger.fontSize, 12);
    ok('التباعد أصبح سالباً (تضييق)', bitLonger.charSpacing < 0);

    const shorter = PDFE.Style.autoFit(item, 'ABC', { boxWidth: 120 });
    eq('نص أقصر → لا تغيير', shorter.fontSize, 12);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔠 [4] تحليل أسماء الخطوط (§18 §19)');
// ═══════════════════════════════════════════════════════════════════════════
{
    const p = PDFE.Parser.parseFontName;
    eq('نزع بادئة المجموعة الجزئية ABCDEF+', p('ABCDEF+Arial-BoldMT').name, 'Arial-BoldMT');
    eq('كشف العريض', p('ABCDEF+Arial-BoldMT').bold, true);
    eq('كشف المائل', p('Helvetica-Oblique').italic, true);
    eq('العادي ليس عريضاً', p('TimesNewRomanPSMT').bold, false);
    eq('استخراج العائلة', p('Arial-Bold').family, 'Arial');
    eq('كشف الوزن الرقمي 700', p('NotoSans-700').bold, true);
    eq('اسم فارغ لا يُسقط الدالة', p('').family, 'Unknown');
}
{
    const s = PDFE.Style.suggestSubstitutes('Helvetica Neue');
    ok('يقترح بدائل للخط غير المثبّت', s.length >= 3);
    ok('البدائل اللاتينية معقولة', s.some(x => x.name === 'Arial' || x.name === 'Helvetica'));
    const ar = PDFE.Style.suggestSubstitutes('GE SS Two Light Arabic');
    ok('يقترح بدائل عربية لخط عربي', ar.some(x => ['Cairo', 'Tajawal', 'Amiri'].includes(x.name)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🎨 [5] الألوان (§3 §16 §17)');
// ═══════════════════════════════════════════════════════════════════════════
eq('toHex أساسي', PDFE.toHex(31, 78, 120), '#1F4E78');
eq('toHex يقصّ خارج المدى', PDFE.toHex(300, -5, 128), '#FF0080');
eq('hexToRgb', PDFE.hexToRgb('#1F4E78'), { r: 31, g: 78, b: 120 });
eq('hexToRgb يقبل الاختصار', PDFE.hexToRgb('#FFF'), { r: 255, g: 255, b: 255 });
eq('hexToRgb بلا # ', PDFE.hexToRgb('1F4E78'), { r: 31, g: 78, b: 120 });
eq('hexToRgb لقيمة غير صالحة → أسود', PDFE.hexToRgb('لون'), { r: 0, g: 0, b: 0 });
eq('rgbToHsl للأبيض', PDFE.rgbToHsl(255, 255, 255), { h: 0, s: 0, l: 100 });
eq('تسمية الأسود', PDFE.colorName('#000000'), 'أسود');
eq('تسمية الأبيض', PDFE.colorName('#FFFFFF'), 'أبيض');
eq('تسمية الرمادي', PDFE.colorName('#808080'), 'رمادي');
ok('تسمية الأزرق الداكن', PDFE.colorName('#1F4E78').includes('أزرق'));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 [6] نوع المستند والعمليات (§36 §38)');
// ═══════════════════════════════════════════════════════════════════════════
{
    const g = PDFE.Parser.guessDocType;
    eq('كشف الفاتورة', g('فاتورة ضريبية رقم 5'), 'فاتورة');
    eq('كشف المستخلص', g('مستخلص رقم 3 للمشروع'), 'مستخلص / شهادة دفع');
    eq('كشف العقد', g('عقد مقاولة بين الطرفين'), 'عقد / اتفاقية');
    eq('كشف أمر الشراء', g('Purchase Order 2026'), 'أمر شراء');
    eq('نص غير معروف → مستند عام', g('نص عشوائي'), 'مستند عام');
    eq('المستخلص أولى من الفاتورة عند اجتماعهما', g('مستخلص وفاتورة'), 'مستخلص / شهادة دفع');
}
{
    const d = PDFE.Ops.describe;
    ok('وصف تعديل النص يذكر القيمتين',
        d({ type: 'text.edit', page: 2, oldText: '125,000', newText: '135,000' }).includes('125,000'));
    ok('وصف التنقيح يُميَّز بعلامة قفل',
        d({ type: 'redact', page: 1, oldText: '1234567890' }).includes('🔒'));
    ok('وصف حذف الصفحة', d({ type: 'page.delete', page: 3 }).includes('3'));
    ok('نوع غير معروف لا يُسقط الدالة', typeof d({ type: 'unknown.thing' }) === 'string');
    const o = PDFE.Ops.make('text.edit', { page: 1 });
    ok('العملية تحمل معرّفاً ووقتاً', o.id && o.at && o.type === 'text.edit');
    const o1 = PDFE.Ops.make('x', {}), o2 = PDFE.Ops.make('x', {});
    ok('المعرّفات فريدة', o1.id !== o2.id);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n↶ [7] محرك التاريخ (§26)');
// ═══════════════════════════════════════════════════════════════════════════
{
    const H = new PDFE.History(5);
    ok('يبدأ فارغاً', !H.canUndo() && !H.canRedo());
    ['a', 'b', 'c'].forEach(t => H.push(PDFE.Ops.make(t, {})));
    eq('ثلاث عمليات فعّالة', H.active().length, 3);
    ok('يمكن التراجع', H.canUndo());
    eq('التراجع يعيد آخر عملية', H.undo().type, 'c');
    eq('بقيت عمليتان فعّالتان', H.active().length, 2);
    ok('يمكن الإعادة', H.canRedo());
    eq('الإعادة تستعيد', H.redo().type, 'c');
    H.undo();
    H.push(PDFE.Ops.make('d', {}));
    ok('عملية جديدة بعد التراجع تمسح مسار الإعادة', !H.canRedo());
    eq('الترتيب الصحيح بعد الفرع', H.active().map(o => o.type), ['a', 'b', 'd']);
    // الحدّ الأقصى
    const H2 = new PDFE.History(3);
    ['1', '2', '3', '4', '5'].forEach(t => H2.push(PDFE.Ops.make(t, {})));
    eq('احترام الحدّ الأقصى للخطوات', H2.active().length, 3);
    eq('يُسقط الأقدم', H2.active().map(o => o.type), ['3', '4', '5']);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔌 [8] طبقة التجريد والتخزين (§48)');
// ═══════════════════════════════════════════════════════════════════════════
ok('المحرك المحلي مسجَّل ومفعَّل', PDFE.Engine.current === 'local' && !!PDFE.Engine.get());
eq('قدرة تحرير النص = جراحة التدفّق', PDFE.Engine.capabilities().nativeTextEdit, 'surgery');
ok('التنقيح الحقيقي مدعوم', PDFE.Engine.capabilities().trueRedaction === true);
ok('منفذ Apryse مسجَّل لكنه غير مرخَّص', PDFE.Engine.impls.apryse && PDFE.Engine.impls.apryse.licensed === false);
{
    let threw = false;
    try { PDFE.Engine.use('nonexistent'); } catch (e) { threw = true; }
    ok('محرك غير مسجَّل يرفع خطأً واضحاً', threw);
    eq('المحرك الحالي لم يتغيّر بعد الفشل', PDFE.Engine.current, 'local');
}
ok('منفذا التخزين مسجَّلان', !!PDFE.Storage.adapters.cloudinary && !!PDFE.Storage.adapters.firebase);
eq('المنفذ الافتراضي Cloudinary', PDFE.Storage.current, 'cloudinary');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n⚠️ [9] رسائل الأخطاء بالعربية (§51)');
// ═══════════════════════════════════════════════════════════════════════════
{
    const T = PDFE.translateLoadError;
    const pw = T({ name: 'PasswordException', message: 'No password given' });
    eq('كلمة المرور تُصنَّف', pw.code, 'PASSWORD');
    ok('الرسالة عربية', /محمي|كلمة/.test(pw.message));
    eq('كلمة مرور خاطئة تُميَّز', T({ name: 'PasswordException', message: 'Incorrect Password' }).message, 'كلمة المرور غير صحيحة');
    eq('الملف التالف يُصنَّف', T({ name: 'InvalidPDFException', message: 'Invalid PDF structure' }).code, 'CORRUPT');
    eq('الخطأ المجهول يُصنَّف', T({ name: 'X', message: 'boom' }).code, 'UNKNOWN');
    ok('لا رسالة تقنية عارية', !T({ name: 'X', message: 'boom' }).message.startsWith('boom'));
}

console.log(`\n═══ النتيجة: ${pass} ناجح · ${fail} فاشل ═══`);
process.exit(fail ? 1 : 0);
