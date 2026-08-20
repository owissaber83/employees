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
 * يدعم أيضاً نمط `window.name = function (...) { … }` — [Phase 5] بعض دوال
 * الأرصدة (`ccLineMatchesProject`) مُعلَنة هكذا لا بـ`function name(`. المحاولة
 * الأولى (النمط الأصلي) لا تتغيّر؛ هذا احتياطي إضافي فقط — لا يمسّ أي مطابقة
 * كانت تنجح من قبل.
 * @returns {string} نصّ الدالة كما هو حرفياً في الملف
 */
export function extractFunction(name, file) {
    const src = readLegacy(file);
    // النمط الأصلي أولاً — لا يتغيّر ترتيب المحاولة ولا نتيجته لأي دالة كانت تُطابَق من قبل.
    const declPattern = new RegExp(`(^|\\n)\\s*(async\\s+)?function\\s+${name}\\s*\\(`);
    // احتياطي [Phase 5]: بعض دوال الأرصدة (`ccLineMatchesProject`) مُعلَنة
    // `window.name = function (...) {...}` لا `function name(...)`. الفارق أن
    // الجسم المُستخرَج هنا تعبير دالة مجهولة، فيُغلَّف بـ`const name = …;` كي
    // يبقى العقد كما هو: نصّ يُعرِّف رابطاً باسم `name` عند تشغيله.
    const assignPattern = new RegExp(`(^|\\n)\\s*window\\.${name}\\s*=\\s*(async\\s+)?function\\s*\\(`);

    let m = declPattern.exec(src);
    let wrap = false;
    if (!m) { m = assignPattern.exec(src); wrap = true; }
    if (!m) throw new Error(`لم تُعثر على الدالة القديمة: ${name}`);

    const start = wrap
        ? src.indexOf('function', m.index)   // نبدأ من `function` نفسها — لا من `window.name =`
        : m.index + (m[1] ? m[1].length : 0);
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
    const raw = src.slice(start, i).trim();
    // [Phase 7-D] `async` تُعاد صراحةً في نمط الإسناد. `start` يبدأ من كلمة `function`
    // نفسها (لا من `window.name =`)، فكانت `async` تسقط بصمت ⇒ دالة غير متزامنة تحوي
    // `await` ⇒ SyntaxError. لم يظهر قبل الآن لأن كل ما استُخرج بنمط الإسناد كان
    // غير متزامن (`ccLineMatchesProject` في Phase 5). **إضافة بحتة**: `m[2]` هي مجموعة
    // `(async\s+)?` نفسها في كلا النمطين، و`wrap` لا تصحّ إلا لنمط الإسناد.
    return wrap ? `const ${name} = ${m[2] ? 'async ' : ''}${raw};` : raw;
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

/**
 * يقتطع نصّاً من الملف القديم بين علامتين — لتوثيق ثابت مثل COA_TYPES.
 * [Phase 5] يدعم الآن الثوابت المصفوفية (`const X = [...]`) مثل DEFAULT_ACCOUNTS
 * لا الكائنية فقط. **إصلاح عطل كامن في المِشجب لا في الشفرة القديمة**: النسخة
 * السابقة كانت تبحث عن أول `{` بعد `=` بلا قيد — فتلتقط لثابتٍ مصفوفي أول عنصر
 * فيه فقط (كائن) بدل المصفوفة كلها، بصمت وبلا استثناء. لم يظهر هذا في Phase 4
 * لأن `ensureStdAccount` لم تختبر مساراً يحتاج DEFAULT_ACCOUNTS فعلياً هناك.
 */
export function extractConst(name, file) {
    const src = readLegacy(file);
    const re = new RegExp(`const\\s+${name}\\s*=\\s*`);
    const m = re.exec(src);
    if (!m) throw new Error(`لم يُعثر على الثابت: ${name}`);
    const afterEq = m.index + m[0].length;
    // أول حرف غير فراغ بعد `=` يحدّد الشكل: `[` مصفوفة أو `{` كائن
    let p = afterEq; while (p < src.length && /\s/.test(src[p])) p++;
    const openCh = src[p], closeCh = openCh === '[' ? ']' : '}';
    if (openCh !== '[' && openCh !== '{') throw new Error(`ثابت غير مدعوم (لا [ ولا {): ${name}`);
    let i = p, depth = 0, inStr = null, esc = false;
    for (; i < src.length; i++) {
        const c = src[i];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (inStr) { if (c === inStr) inStr = null; continue; }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c === openCh) depth++;
        else if (c === closeCh) { depth--; if (depth === 0) { i++; break; } }
    }
    // eslint-disable-next-line no-new-func
    return new Function(`return ${src.slice(p, i)};`)();
}
