// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  اختبار متصفح حقيقي لنافذة إعدادات «قراءة الفواتير بالذكاء الاصطناعي»          ║
// ║  ينشأ لأن نسيان ربط aiinvoice.css في index.html جعل النافذة تُلحق أسفل         ║
// ║  الصفحة كمحتوى عادي بدل أن تطفو — فبدا الزر وكأنه لا يستجيب.                  ║
// ║  التشغيل: npm run test:ai:e2e                                                 ║
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

// ── تحقّق ثابت: الملفات الأربعة مربوطة فعلاً في index.html ────────────────────
console.log('\n🔗 ربط أصول الوحدة في index.html');
const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
for (const asset of ['aiinvoice.css', 'aiinvoice-engine.js', 'aiinvoice-ui.js', 'aiinvoice-actions.js']) {
    ok(asset + ' مربوط', html.includes(asset + '?v='), 'غير موجود أو بلا ?v= في index.html');
}

// ── تحقّق حيّ في متصفح ──────────────────────────────────────────────────────
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const [label, width, height] of [['سطح المكتب', 1280, 900], ['لوحي', 820, 700], ['جوال', 390, 780]]) {
    console.log(`\n🖥️  ${label} (${width}×${height})`);
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto('file://' + path.join(ROOT, 'tests/aiinvoice-settings-harness.html'), { waitUntil: 'networkidle0' });
    const r = await page.evaluate(() => globalThis.__probe());

    ok('تُفتح بلا استثناء', r.threw === null, r.threw);
    ok('بلا أخطاء تشغيل', (r.errors || []).length === 0, (r.errors || []).join(' | '));
    ok('تطفو فوق الصفحة (display:flex)', r.display === 'flex', 'display=' + r.display);
    ok('داخل حدود النافذة أفقياً', r.box.l >= 0 && r.box.r <= r.vw, JSON.stringify(r.box));
    ok('لا انسياب أفقي للصفحة', r.pageScrollW <= r.vw, r.pageScrollW + ' > ' + r.vw);
    ok('لا عنصر يتجاوز الصندوق', (r.overflowing || []).length === 0, (r.overflowing || []).join(' | '));
    ok('لا حقول مشوّهة', (r.tinyFields || []).length === 0, (r.tinyFields || []).join(' | '));
    ok('أوامر دليل التركيب تُنسخ حرفياً (إن وُجدت)', r.copyAllOk === true,
        JSON.stringify(r.copy || []));
    // النموذج المحفوظ من جيل سابق يجب أن يُنبَّه عليه صراحةً مع علاج بنقرة
    ok('النموذج القديم المحفوظ يُنبَّه عليه', r.staleWarned === true, 'لا تحذير من نموذج قديم');
    ok('ويُعرض زر التحويل إلى الأحدث', r.hasLatestBtn === true, 'لا زر تحويل');

    await page.close();
}

await browser.close();
console.log(`\n${'═'.repeat(52)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(52)}`);
process.exit(fail ? 1 : 0);
