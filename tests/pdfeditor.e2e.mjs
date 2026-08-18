// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  📄 اختبار المسار الكامل لمحرر PDF على ملف حقيقي (متصفح فعلي)              ║
// ║  التشغيل:  npm run test:pdf:e2e                                            ║
// ║  ────────────────────────────────────────────────────────────────────────  ║
// ║  يتطلّب: Google Chrome مثبَّتاً + اتصال إنترنت (pdf.js · pdf-lib · خط عربي). ║
// ║  يتخطّى نفسه بهدوء إن لم يجد متصفحاً — كي لا يكسر بيئة بلا واجهة.            ║
// ║                                                                            ║
// ║  لماذا يستحق الوجود: اختبارات الوحدة لا تلمس pdf-lib ولا CDN. هذا الاختبار  ║
// ║  يثبت الادّعاء الجوهري للوحدة كلها: أن النص الأصلي **يُزال فعلياً من بنية    ║
// ║  الملف** وأن العربية والأرقام تُرسم في المخرَج وأن الملف يبقى سليماً.        ║
// ║  (اكتشف عند كتابته عطلين حقيقيين: روابط خطوط ميتة + رسم غير محميّ.)          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const PORT = 8791;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.pdf': 'application/pdf' };

// ملف اختبار حقيقي داخل المستودع؛ يمكن تجاوزه بـ  PDF_FIXTURE=path npm run test:pdf:e2e
const FIXTURE = process.env.PDF_FIXTURE || 'ifrs 18.pdf';
if (!fs.existsSync(path.join(ROOT, FIXTURE))) {
    console.log(`⏭️  تخطٍّ: ملف الاختبار غير موجود (${FIXTURE}) — حدّد PDF_FIXTURE=<مسار>`);
    process.exit(0);
}

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].filter(Boolean);
const chrome = CHROME_CANDIDATES.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!chrome) { console.log('⏭️  تخطٍّ: لم يُعثر على Chrome — حدّد CHROME_PATH=<مسار المتصفح>'); process.exit(0); }

let puppeteer;
try {
    const require = createRequire(import.meta.url);
    puppeteer = (await import('file://' + require.resolve('puppeteer-core/lib/puppeteer/puppeteer-core.js'))).default;
} catch (e) {
    console.log('⏭️  تخطٍّ: puppeteer-core غير مثبَّت (npm install)');
    process.exit(0);
}

// ── خادم محلي: public/ + صفحة الاختبار + ملف PDF ─────────────────────────
const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = url === '/harness.html' ? path.join(HERE, 'pdfeditor-e2e-harness.html')
        : url === '/layer.html' ? path.join(HERE, 'pdfeditor-layer-harness.html')
        : url === '/arabic.html' ? path.join(HERE, 'pdfeditor-arabic-harness.html')
        : url.startsWith('/fixtures/') ? path.join(ROOT, url.slice('/fixtures/'.length))
            : path.join(ROOT, 'public', url);
    fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
    });
});
await new Promise(r => server.listen(PORT, r));

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

await page.goto(`http://localhost:${PORT}/harness.html`, { waitUntil: 'networkidle0', timeout: 90000 });
// eslint-disable-next-line no-undef -- الدالة تُنفَّذ داخل المتصفح لا في Node
const result = await page.evaluate(u => window.__run(u), '/fixtures/' + encodeURIComponent(FIXTURE));

// ── انحدار: نص داخل Form XObject (الفواتير المولّدة من قوالب) ──
// eslint-disable-next-line no-undef -- تُنفَّذ داخل المتصفح
const X = await page.evaluate(async () => window.__runXObject());

// ── انحدار طبقة النص: يجب أن تبقى شفافة فوق اللوحة وإلا طُبع النص مرتين ──
const layerPage = await browser.newPage();
await layerPage.goto(`http://localhost:${PORT}/layer.html`, { waitUntil: 'networkidle0', timeout: 60000 });
// eslint-disable-next-line no-undef -- تُنفَّذ داخل المتصفح
const L = await layerPage.evaluate(async () => window.__run());

// ── انحدار التحرير العربي: فاتورة عربية مولّدة تمرّ بمسار المحرر كاملاً ──
const arPage = await browser.newPage();
const arErrors = [];
arPage.on('pageerror', e => arErrors.push(e.message));
await arPage.goto(`http://localhost:${PORT}/arabic.html`, { waitUntil: 'networkidle0', timeout: 90000 });
// eslint-disable-next-line no-undef -- تُنفَّذ داخل المتصفح
const A = await arPage.evaluate(async () => window.__runArabic({}));
// وشريط الأدوات معطوباً عمداً: التحرير يجب أن يصمد
// eslint-disable-next-line no-undef -- تُنفَّذ داخل المتصفح
const A2 = await arPage.evaluate(async () => window.__runArabic({ breakToolbar: true }));
// وبخط عربي متعذّر: التصدير يجب أن **يرفض** بوضوح لا أن يُسلّم ملفاً بلا التعديل
// eslint-disable-next-line no-undef -- تُنفَّذ داخل المتصفح
const A3 = await arPage.evaluate(async () => window.__runArabic({ breakArabicFont: true }));
// وحالة «كل حرف بعملية مستقلة» — يجب أن تُدمج في مقطع واحد قابل للتحرير
// eslint-disable-next-line no-undef -- تُنفَّذ داخل المتصفح
const G = await arPage.evaluate(async () => window.__runPerGlyph());
// وسلوك التفاعل: نقرة تحدّد، نقرة تفتح التحرير، والشريط لا يغطّي النص
// eslint-disable-next-line no-undef -- تُنفَّذ داخل المتصفح
const I = await arPage.evaluate(async () => window.__runInteraction());

await browser.close();
server.close();

const S = Object.fromEntries(result.steps);
console.log(`\n📄 المسار الكامل على «${FIXTURE}»:`);
for (const [k, v] of result.steps) console.log(`   ${k.padEnd(20)} : ${v}`);

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } };

console.log('\n🔎 التحقّق:');
if (!result.ok) { console.log('  ❌ سقط المسار: ' + result.error + '\n     ' + result.stack); fail++; }
else {
    t('حُلّل المستند واستُخرجت عناصر نصية', S.text_items_p1 > 0);
    t('كُشفت الخطوط والألوان', S.fonts > 0 && S.colors > 0);
    t('بُني نظام تصميم المستند', S.design_groups > 0);
    t('🔑 أُزيل النص الأصلي من بنية الملف (جراحة لا تغطية)', S.surgery_applied >= 1 && S.surgery_fallback === 0);
    t('🔑 النص القديم لم يعد قابلاً للاستخراج', S.old_text_gone === true);
    t('🔑 النص الجديد موجود وقابل للبحث', S.new_text_present === true && S.valid_searchable === true);
    t('🔑 العربية تُرسم في المخرَج', S.arabic_present === true);
    t('🔑 الأرقام المالية تُرسم بترتيبها الصحيح', S.number_present === true);
    t('عدد الصفحات لم يتغيّر', S.valid_pages === S.num_pages);
    t('التحقّق النهائي نجح بلا تسريب', S.valid_ok === true && !S.valid_leaked);
    t('لم يُستخدم البديل المتدهور', S.degraded === false);
    t('لا تحذيرات في البناء', !S.warnings);
    t('لا أخطاء JavaScript في الصفحة', pageErrors.length === 0);
}

console.log('\n📦 انحدار: نص داخل Form XObject:');
const XS = X && X.ok ? Object.fromEntries(X.steps) : null;
if (!XS) { console.log('  ❌ سقط: ' + ((X && X.error) || 'غير معروف')); fail++; }
else {
    for (const [k, v] of X.steps) console.log(`   ${k.padEnd(20)} : ${v}`);
    t('🔑 الجامع يدخل الـ XObject ويرصد كل العمليات', XS.counts_match === true && XS.ops_collected === XS.items_seen);
    t('يمشي عبر أكثر من تدفّق واحد', XS.streams_walked >= 2);
    t('🔑 النص المستهدف أُزيل فعلاً من داخل XObject', XS.target_removed === true && XS.surgery_applied >= 1);
    t('🔑 لم يُمحَ نص مجاور بالخطأ', XS.neighbour_intact === true && XS.outside_intact === true);
    t('النص الجديد حاضر', XS.new_text_present === true);
    t('لم يُحتَج للبديل الآمن', XS.surgery_fallback === 0);
}

console.log('\n🖨️ انحدار طبقة النص (النص المزدوج):');
if (!L || !L.ok) { console.log('  ❌ سقط فحص الطبقة: ' + ((L && L.error) || 'غير معروف')); fail++; }
else {
    t('🔑 طبقة النص شفافة تماماً فوق اللوحة (لا طباعة مزدوجة)', L.idle_color === 'rgba(0, 0, 0, 0)');
    t('🔑 لا لون مضمَّن يهزم شفافية الطبقة', L.idle_inline_color === '');
    t('اللون الحقيقي محفوظ في --pde-c', L.custom_prop.toUpperCase() === '#1F4E78');
    t('نص العنصر محفوظ للبحث والتحديد', L.text_kept === true);
    t('النص المُعدَّل يظهر بلونه الحقيقي', L.edited_color === 'rgb(31, 78, 120)');
    t('النص المُعدَّل بخلفية معتِمة تحجب الأصل', L.edited_bg === 'rgb(255, 255, 255)');
    t('طبقة OCR شفافة أيضاً', L.ocr_color === 'rgba(0, 0, 0, 0)');
    t('الكائنات المضافة مرئية (لا شيء تحتها)', L.object_color === 'rgb(192, 57, 43)');
}
console.log('\n🔤 انحدار التحرير العربي:');
const AS = A && A.ok ? Object.fromEntries(A.steps) : null;
if (!AS) { console.log('  ❌ سقط المسار العربي: ' + ((A && A.error) || 'غير معروف') + '\n     ' + ((A && A.stack) || '')); fail++; }
else {
    for (const [k, v] of A.steps) console.log(`   ${k.padEnd(24)} : ${v}`);
    t('استُخرجت النصوص العربية سليمة', AS.arabic_items_extracted >= 4 && AS.arabic_text_intact === true);
    t('وُسمت RTL ولها عرض قابل للنقر', AS.arabic_marked_rtl === true && AS.arabic_has_width === true);
    t('ظهرت في طبقة التحرير بأبعاد صالحة', AS.arabic_divs_in_layer >= 4 && AS.arabic_divs_clickable === true);
    t('🔑 النقر المزدوج يفتح وضع التحرير', AS.entered_edit_mode === true);
    t('🔑 الكتابة العربية تُسجَّل عملية تحرير', AS.edit_recorded === 1 && AS.op_is_text_edit === true);
    t('العملية تحفظ النص والخط والموضع', AS.op_keeps_new_arabic === true && AS.op_keeps_font === true && AS.op_keeps_position === true);
    t('🔑 النص العربي الجديد يصل الملف الناتج', AS.output_has_new_arabic === true);
    t('🔑 النص العربي القديم غادر بنية الملف', AS.output_lost_old_arabic === true);
    t('باقي العربية والأرقام لم تُمَس', AS.output_kept_other_arabic === true && AS.output_kept_numbers === true);
    t('لا أخطاء JavaScript في المسار العربي', arErrors.length === 0);
}
const AS2 = A2 && A2.ok ? Object.fromEntries(A2.steps) : null;
t('🔑 عطل شريط الأدوات لا يمنع حفظ التعديل', !!AS2 && AS2.edit_recorded === 1 && AS2.output_has_new_arabic === true);
const AS3 = A3 && A3.ok ? Object.fromEntries(A3.steps) : null;
t('🔑 تعذّر الخط العربي ⇒ يُرفض التصدير لا يُبتلع التعديل', !!AS3 && AS3.refused_export === true && AS3.refuse_code === 'DROPPED_TEXT');
t('رسالة الرفض تسمّي النص الساقط وسببه', !!AS3 && AS3.refuse_lists_text === true && AS3.refuse_msg_actionable === true);
console.log('\n🔡 انحدار: نص مرسوم حرفاً حرفاً:');
const GS = G && G.ok ? Object.fromEntries(G.steps) : null;
if (!GS) { console.log('  ❌ سقط: ' + ((G && G.error) || 'غير معروف')); fail++; }
else {
    for (const [k, v] of G.steps) console.log(`   ${k.padEnd(22)} : ${v}`);
    t('🔑 الحروف المتفرّقة تُدمج في مقطع واحد', GS.merged_items < GS.raw_items && GS.arabic_op_count >= 5);
    t('🔑 المقطع يحمل الكلمة كاملة لا حرفاً', GS.arabic_run_len >= 8);
    t('الأرقام تبقى صندوقاً واحداً كما كانت', GS.number_still_one_box === true);
    t('🔑 تعديل المقطع يزيل كل حروفه لا واحداً', GS.surgery_applied >= 5 && GS.no_leftover_glyphs === true);
    t('النص الجديد حاضر والأرقام سليمة', GS.new_text_present === true && GS.number_intact === true);
}

console.log('\n🖱️ انحدار: سلوك التحرير بالفأرة:');
const IS = I && I.ok ? Object.fromEntries(I.steps) : null;
if (!IS) { console.log('  ❌ سقط: ' + ((I && I.error) || 'غير معروف')); fail++; }
else {
    for (const [k, v] of I.steps) console.log(`   ${k.padEnd(22)} : ${v}`);
    t('🔑 وضع التحرير الافتراضي: نقرة واحدة تفتح التحرير', IS.one_click_edits_in_text_mode === true);
    t('وضع التحديد: نقرة تحدّد ونقرة تفتح التحرير', IS.first_click_selects === true && IS.second_click_edits === true);
    t('النقر على الفراغ لا يرسم مستطيلاً وهمياً', IS.no_ghost_in_text_mode === true);
    t('🔑 الشريط العائم لا يغطّي النص (سبب «لا يستجيب»)', IS.floatbar_visible === true && IS.floatbar_not_covering === true);
    t('🔑 يمكن إعادة تحرير نص سبق تعديله', IS.reedit_opened === true && IS.reedit_recorded === true && IS.reedit_old_correct === true);
    t('🔑 لا علامة خضراء دائمة على النص المُعدَّل', IS.no_persistent_marker === true);
    t('🔑 النص المحذوف يختفي صندوقه', IS.deleted_box_hidden === true);
}

if (arErrors.length) arErrors.slice(0, 5).forEach(e => console.log('     ⚠️ ' + e));

if (pageErrors.length) pageErrors.slice(0, 5).forEach(e => console.log('     ⚠️ ' + e));

console.log(`\n═══ النتيجة: ${pass} ناجح · ${fail} فاشل ═══`);
process.exit(fail ? 1 : 0);
