// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  اختبار متصفح حقيقي لصفحة «استخراج وتدقيق الفواتير» — القائمة وشاشة المراجعة  ║
// ║  ينشأ لأن أخطاء التشغيل في بناء الواجهة لا تظهر في اختبارات نود: الصفحة        ║
// ║  تُبنى كلها من JS، فخطأ واحد يترك القسم فارغاً بلا أي رسالة.                   ║
// ║  التشغيل: npm run test:ai:page                                                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!chrome) { console.log('⏭️  تخطٍّ: لم يُعثر على Chrome — حدّد CHROME_PATH=<مسار المتصفح>'); process.exit(0); }

let puppeteer;
try {
    puppeteer = (await import('file://' + require.resolve('puppeteer-core/lib/puppeteer/puppeteer-core.js'))).default;
} catch (e) {
    console.log('⏭️  تخطٍّ: puppeteer-core غير مثبَّت (npm install)');
    process.exit(0);
}

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log('  ❌ ' + name + (detail ? '\n       ' + detail : '')); }
};

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const [label, width, height] of [['سطح المكتب', 1440, 900], ['لوحي', 820, 700], ['جوال', 390, 780]]) {
    console.log(`\n🖥️  ${label} (${width}×${height})`);
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto('file://' + path.join(ROOT, 'tests/aiinvoice-page-harness.html'), { waitUntil: 'networkidle0' });

    // ── قائمة الفواتير ──────────────────────────────────────────────────────
    const l = await page.evaluate(() => globalThis.__probeList());
    ok('القائمة تُبنى بلا استثناء', l.threw === null, l.threw);
    ok('بلا أخطاء تشغيل', l.errors.length === 0, l.errors.join(' | '));
    ok('تعرض كل السجلات (3)', l.rows === 3, 'صفوف=' + l.rows);
    ok('تعرض المؤشرات', l.kpis === 4, 'مؤشرات=' + l.kpis);
    ok('لا انسياب أفقي', l.pageScrollW <= l.vw, l.pageScrollW + ' > ' + l.vw);
    ok('لا تسرّب undefined/NaN إلى الواجهة', l.leaks.length === 0, l.leaks.join(', '));

    // ── شاشة المراجعة: فاتورة سليمة ─────────────────────────────────────────
    const g = await page.evaluate(() => globalThis.__probeReview('good'));
    ok('شاشة المراجعة تُبنى بلا استثناء', g.threw === null, g.threw);
    ok('بلا أخطاء تشغيل في المراجعة', g.errors.length === 0, g.errors.join(' | '));
    ok('كل الأقسام تظهر', g.sections >= 6, 'أقسام=' + g.sections);
    ok('شارات مصدر الحقول تظهر', g.provBadges > 0, 'شارات=' + g.provBadges);
    ok('بنود الفاتورة تظهر', g.lineRows === 2, 'بنود=' + g.lineRows);
    ok('شريط الإجراءات يظهر', g.hasActionbar === true);
    ok('لا تسرّب undefined/NaN في المراجعة', g.leaks.length === 0, g.leaks.join(', '));
    ok('لا انسياب أفقي في المراجعة', g.pageScrollW <= g.vw, g.pageScrollW + ' > ' + g.vw);

    // ── شاشة المراجعة: فاتورة مختلّة حسابياً ────────────────────────────────
    const b = await page.evaluate(() => globalThis.__probeReview('broken'));
    ok('الفاتورة المختلّة تُعرض بلا استثناء', b.threw === null, b.threw);
    ok('وتُظهر ملاحظات التحقق', b.issues > 0, 'ملاحظات=' + b.issues);
    ok('بلا أخطاء تشغيل', b.errors.length === 0, b.errors.join(' | '));

    // ── سجل الإصدار الأول بعد الترقية ───────────────────────────────────────
    const v1 = await page.evaluate(() => globalThis.__probeReview('legacy'));
    ok('سجل الإصدار الأول يُعرض بعد الترقية', v1.threw === null, v1.threw);
    ok('بلا أخطاء تشغيل عليه', v1.errors.length === 0, v1.errors.join(' | '));
    ok('وببنوده المرحَّلة', v1.lineRows === 1, 'بنود=' + v1.lineRows);

    // ── النوافذ المنبثقة ────────────────────────────────────────────────────
    const m = await page.evaluate(() => globalThis.__probeModals());
    Object.keys(m.opened).forEach(fn => ok('تُفتح النافذة: ' + fn, m.opened[fn] === true, String(m.opened[fn])));
    ok('بلا أخطاء تشغيل في النوافذ', m.errors.length === 0, m.errors.join(' | '));

    await page.close();
}

await browser.close();
console.log(`\n${'═'.repeat(52)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(52)}`);
process.exit(fail ? 1 : 0);
