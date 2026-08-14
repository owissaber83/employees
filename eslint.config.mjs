// ══ إعداد ESLint — GBR ══════════════════════════════════════════════════
// الهدف: إمساك أصناف الأخطاء التي وقعت فعلاً في هذا المشروع، لا فرض أسلوب.
// لذلك القواعد مختارة يدوياً ولم نستورد "recommended" — الأخير يُنتج آلاف
// التنبيهات الأسلوبية في 85 ألف سطر قائمة فتضيع الإشارة في الضجيج.
//
// أصناف الأخطاء المستهدفة (كلها وقعت فعلاً):
//   • دالة مستدعاة من onclick لكنها محبوسة في نطاق محلي  → no-undef
//   • خطأ إملائي في اسم دالة/متغيّر                        → no-undef
//   • كود ميت بعد return                                   → no-unreachable
//   • متغيّر/استيراد غير مستخدم (بقايا تعديلات)            → no-unused-vars
//   • == بدل === في مقارنات حسّاسة                          → eqeqeq
//   • إسناد داخل شرط (خطأ مطبعي شائع)                       → no-cond-assign
//   • مفتاح مكرّر في كائن (يفوز الأخير بصمت)                → no-dupe-keys
//
// التشغيل:  npm run lint        (أخطاء فقط)
//           npm run lint:all    (مع التحذيرات)
import globals from 'globals';
import { readFileSync } from 'fs';

const appGlobals = JSON.parse(readFileSync(new URL('./eslint.globals.json', import.meta.url), 'utf8'));

const sharedRules = {
    // ── أخطاء حقيقية ──
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-dupe-args': 'error',
    'no-dupe-else-if': 'error',
    'no-duplicate-case': 'error',
    'no-cond-assign': ['error', 'always'],
    'no-func-assign': 'error',
    'no-obj-calls': 'error',
    'no-sparse-arrays': 'error',
    'no-unsafe-negation': 'error',
    'no-unsafe-optional-chaining': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    'no-self-assign': 'error',
    'no-self-compare': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],

    // ── روائح تسبق الأخطاء ──
    'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
    'eqeqeq': ['warn', 'smart'],
    'no-empty': ['warn', { allowEmptyCatch: true }],   // catch الفارغة نمط مقصود هنا
};

export default [
    {
        // ملفات لا نفحصها: مصغّرة أو خارجية أو مولّدة
        ignores: [
            'node_modules/**',
            'public/qrcode.min.js',
            'public/**/*.min.js',
            'dataconnect/**',
            'public/academy.html',
        ],
    },
    {
        // app.js و calc.js — وحدات ES
        files: ['public/app.js', 'public/calc.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: { ...globals.browser, ...appGlobals },
        },
        rules: sharedRules,
    },
    {
        // بقية ملفات public — سكربتات كلاسيكية تعتمد على عوالم app.js
        files: ['public/**/*.js'],
        ignores: ['public/app.js', 'public/calc.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'script',
            globals: { ...globals.browser, ...appGlobals },
        },
        rules: sharedRules,
    },
    {
        // أدوات Node (اختبارات وسكربتات)
        files: ['tests/**/*.mjs', 'scripts/**/*.mjs', 'functions/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: { ...globals.node },
        },
        rules: { ...sharedRules, 'no-undef': 'error' },
    },
];
