// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  مُحمِّل الشفرة القديمة — أساس الاختبار التوصيفي (Characterization)             ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يستخرج نصّ دالة بعينها من public/accounting.js ويُشغّلها في Node معزولة.       ║
// ║                                                                              ║
// ║  لماذا هذا لا لنسخ الدالة يدوياً: النسخ اليدوي يوثّق **قراءتي** للسلوك، وهذا   ║
// ║  يوثّق **السلوك نفسه**. وكل تشغيل يقرأ الملف الحيّ، فإن عدّل أحدٌ الدالة       ║
// ║  القديمة انكسر الاختبار فوراً — فيصير كاشف انحراف لا مجرّد اختبار.             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** يقرأ ملفاً قديماً من public/. */
export function readLegacy(file = 'public/accounting.js') {
    return fs.readFileSync(path.isAbsolute(file) ? file : path.join(ROOT, file), 'utf8');
}

/**
 * يستخرج نصّ دالة `function name(...) { … }` بموازنة الأقواس.
 * @returns {string} نصّ الدالة كما هو حرفياً في الملف
 */
export function extractFunction(name, file) {
    const src = readLegacy(file);
    const re = new RegExp(`(^|\\n)\\s*(async\\s+)?function\\s+${name}\\s*\\(`);
    const m = re.exec(src);
    if (!m) throw new Error(`لم تُعثر على الدالة القديمة: ${name}`);

    const start = m.index + (m[1] ? m[1].length : 0);
    let i = src.indexOf('{', start), depth = 0, inStr = null, esc = false;
    for (; i < src.length; i++) {
        const c = src[i];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (inStr) { if (c === inStr) inStr = null; continue; }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return src.slice(start, i).trim();
}

/**
 * يُشغّل نصّ الدالة القديمة في Node ويعيدها قابلةً للاستدعاء.
 * @param {string} name اسم الدالة
 * @param {object} globals متغيّرات عامة تحتاجها الدالة (window.* وغيرها)
 */
export function loadLegacyFunction(name, globals = {}, file) {
    const body = extractFunction(name, file);
    const keys = Object.keys(globals);
    // eslint-disable-next-line no-new-func
    const factory = new Function(...keys, `${body}\nreturn ${name};`);
    return factory(...keys.map(k => globals[k]));
}

/** يقتطع نصّاً من الملف القديم بين علامتين — لتوثيق ثابت مثل COA_TYPES. */
export function extractConst(name, file) {
    const src = readLegacy(file);
    const re = new RegExp(`const\\s+${name}\\s*=\\s*`);
    const m = re.exec(src);
    if (!m) throw new Error(`لم يُعثر على الثابت: ${name}`);
    let i = src.indexOf('{', m.index), depth = 0;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    // eslint-disable-next-line no-new-func
    return new Function(`return ${src.slice(src.indexOf('{', m.index), i)};`)();
}
