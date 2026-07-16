// ═══════════════════════════════════════════════════════════════════════════
//  بناء الأكاديمية:  academy.src.html (مصدر JSX)  →  public/academy.html (منشور)
//  الخطوات: ترجمة JSX إلى React.createElement (classic) + توليد Tailwind ساكن
//           + إزالة كل الـ CDNs الثقيلة (Babel/Tailwind) من المتصفح.
//  التشغيل:  cd scripts && npm install && node build-academy.mjs
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import Babel from '@babel/standalone';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'academy.src.html');
const OUT = path.join(here, '..', 'public', 'academy.html');

// 1) قراءة المصدر واستخراج سكربت JSX
let html = fs.readFileSync(SRC, 'utf8');
const m = html.match(/<script type="text\/babel" data-type="module">([\s\S]*)<\/script>(\s*<\/body>)/);
if (!m) { console.error('❌ لم أجد سكربت JSX (type="text/babel") في academy.src.html'); process.exit(1); }

// 2) ترجمة JSX — بوضع classic (React.createElement) وليس التلقائي (jsx-runtime يكسر الصفحة!)
const compiled = Babel.transform(m[1], { presets: [['react', { runtime: 'classic' }]] }).code;
if (/jsx-runtime/.test(compiled) || /^import\s/m.test(compiled)) {
  console.error('❌ الترجمة أنتجت import من react/jsx-runtime — سيكسر الصفحة. تأكّد من runtime: classic'); process.exit(1);
}

// 3) استبدال سكربت JSX بالمترجَم + إزالة CDN بابل + وضع علامة لـ Tailwind بدل الـ CDN والإعداد
html = html.replace(/<script type="text\/babel" data-type="module">[\s\S]*<\/script>(\s*<\/body>)/,
  () => '<script>\n' + compiled + '\n  </script>' + m[2]);
html = html.replace(/\n\s*<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>/, '');
html = html.replace(/  <script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<script>\s*tailwind\.config[\s\S]*?<\/script>/, '  <!--TAILWIND_CSS-->');
if (!html.includes('<!--TAILWIND_CSS-->')) { console.error('❌ لم أعثر على موضع حقن Tailwind'); process.exit(1); }
fs.writeFileSync(OUT, html); // يُكتب أولاً ليمسحه Tailwind بحثاً عن الأصناف

// 4) توليد Tailwind CSS ساكن بنفس الثيم المخصّص (يمسح public/academy.html)
const cfg = path.join(here, '.tw.config.cjs');
const inCss = path.join(here, '.tw.in.css');
const outCss = path.join(here, '.tw.out.css');
fs.writeFileSync(cfg, `module.exports = { content: [${JSON.stringify(OUT)}], theme: { extend: { colors: {
  primary:'#2563EB', secondary:'#9333EA', accent:'#06B6D4', gold:'#F59E0B',
  darkBg:'#0B0F19', darkCard:'#111827', textWhite:'#F9FAFB', textGray:'#9CA3AF', youtube:'#FF0000'
}, fontFamily:{ sans:['Tajawal','sans-serif'] } } } };`);
fs.writeFileSync(inCss, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
execSync(`npx -y tailwindcss@3.4.17 -c "${cfg}" -i "${inCss}" -o "${outCss}" --minify`, { stdio: 'inherit' });
const css = fs.readFileSync(outCss, 'utf8');

// 5) حقن الـ CSS مكان العلامة
html = fs.readFileSync(OUT, 'utf8').replace('<!--TAILWIND_CSS-->', '<style id="tw">\n' + css + '\n  </style>');
fs.writeFileSync(OUT, html);

// 6) تحقّق نهائي
const ce = (compiled.match(/React\.createElement/g) || []).length;
[cfg, inCss, outCss].forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
if (ce < 100) { console.error('❌ عدد createElement منخفض (' + ce + ') — تحقّق من الترجمة'); process.exit(1); }
console.log(`✅ تم البناء بنجاح: ${ce} استدعاء React.createElement · Tailwind ${Math.round(css.length / 1024)}KB · بلا import/CDN`);
console.log('   الناتج: public/academy.html — راجعه ثم: git add academy.src.html public/academy.html && commit && push');
