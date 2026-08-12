// يولّد قائمة المتغيّرات العامة التي يتشاركها ملفات public/*.js.
// السبب: app.js وحدة ES تعلّق ~2000 دالة على window، والملفات الكلاسيكية
// (accounting.js, project-detail.js, hr-*.js …) تستدعيها بأسمائها المجرّدة.
// بدون هذه القائمة يصير no-undef ضجيجاً بلا فائدة؛ ومعها يمسك الاستدعاءات
// الخاطئة فعلاً (دالة غير معرّفة، خطأ إملائي، دالة محلية داخل IIFE).
//
// التشغيل بعد إضافة عوالم جديدة:  npm run lint:globals
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');

// مكتبات خارجية تُحمَّل من CDN عبر <script> في index.html
const CDN = ['XLSX', 'Chart', 'pdfjsLib', 'qrcode', 'QRCode', 'Tesseract', 'html2canvas', 'jspdf', 'jsPDF'];

const names = new Set(CDN);
for (const f of readdirSync(PUB).filter(f => f.endsWith('.js'))) {
    const src = readFileSync(join(PUB, f), 'utf8');
    // window.X = …            (الشكل الغالب للتصدير في هذا المشروع)
    for (const m of src.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
    // window['X'] = …
    for (const m of src.matchAll(/\bwindow\[['"]([A-Za-z_$][\w$]*)['"]\]\s*=/g)) names.add(m[1]);

    // ⚠️ التمييز المهم: السكربتات الكلاسيكية تتشارك النطاق العام، فتصريحاتها
    // على المستوى الأعلى عوالم حقيقية. أمّا app.js فوحدة ES — تصريحاتها
    // **ليست** عامة، فاستدعاؤها من ملف آخر خطأ فعلي نريد أن يظهر.
    if (f === 'app.js') continue;
    for (const m of src.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) names.add(m[1]);
}

// تصريحات app.js على المستوى الأعلى تُستخدم أيضاً من الملفات الكلاسيكية
// عبر window (مثل db, ref, R, $, toast, fmt) — نلتقطها من نمط window.X = X
const out = {};
[...names].sort().forEach(n => { out[n] = 'readonly'; });

writeFileSync(join(ROOT, 'eslint.globals.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`✅ eslint.globals.json — ${Object.keys(out).length} متغيّراً عاماً`);
