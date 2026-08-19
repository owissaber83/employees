// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  اختبار توصيفي · شجرة الحسابات                                               ║
// ║  التشغيل:  npm run test:char                                                  ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الغرض ليس إثبات أن الجديد «صحيح»، بل إثبات أنه **مطابق للقديم حرفياً**.       ║
// ║  لذلك تُحمَّل الدالة القديمة من public/accounting.js وتُشغَّل فعلياً، وتُقارَن    ║
// ║  نتيجتها بنتيجة وحدة النطاق على نفس المدخلات بالضبط.                          ║
// ║                                                                              ║
// ║  وبما أن كل تشغيل يقرأ الملف الحيّ، فأي تعديل لاحق على الشفرة القديمة يكسر     ║
// ║  الاختبار فوراً — فهو كاشف انحراف بين النسختين، لا اختبار لحظي.                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { loadLegacyFunction, extractConst } from './legacy-loader.mjs';
import * as COA from '../../src/domain/accounting/chartOfAccounts/index.js';

let pass = 0, fail = 0;
const eq = (name, a, b) => {
    const x = JSON.stringify(a), y = JSON.stringify(b);
    if (x === y) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log(`  ❌ ${name}\n       قديم: ${y}\n       جديد: ${x}`); }
};
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧬 [1] ACCOUNT_TYPES — تطابق حرفي مع COA_TYPES القديم');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const legacy = extractConst('COA_TYPES');
    eq('المجموعات الخمس بنفس المفاتيح والترتيب', Object.keys(COA.ACCOUNT_TYPES), Object.keys(legacy));
    Object.keys(legacy).forEach(k => {
        eq(`«${k}» — كل الحقول متطابقة`, COA.ACCOUNT_TYPES[k], legacy[k]);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🌳 [2] buildHierarchy — مقارنة بالدالة القديمة المُشغَّلة فعلياً');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const legacy = loadLegacyFunction('buildCoaHierarchy');
    const cases = [
        ['قائمة فارغة', []],
        ['جذر واحد', [{ code: '1', nameAr: 'الأصول', parent: '' }]],
        ['شجرة بمستويين', [
            { code: '1', parent: '' }, { code: '11', parent: '1' },
            { code: '111', parent: '11' }, { code: '2', parent: '' }
        ]],
        ['أب غير موجود ⇒ يصير جذراً (لا يُفقَد)', [
            { code: '11', parent: '99' }, { code: '2', parent: '' }
        ]],
        ['ترتيب المدخلات محفوظ بلا فرز', [
            { code: '5', parent: '' }, { code: '1', parent: '' }, { code: '3', parent: '' }
        ]],
        ['الابن قبل أبيه في المدخلات', [
            { code: '11', parent: '1' }, { code: '1', parent: '' }
        ]],
        ['رمز مكرّر — سلوك قائم محفوظ كما هو', [
            { code: '1', nameAr: 'أ', parent: '' }, { code: '1', nameAr: 'ب', parent: '' }
        ]],
        ['parent فارغ نصّاً', [{ code: '1', parent: '' }, { code: '2', parent: null }]],
        ['حقول إضافية تُنقل كما هي', [
            { code: '1', parent: '', nature: 'header', openingBalance: 500, active: true }
        ]]
    ];
    cases.forEach(([name, input]) => {
        const a = COA.buildHierarchy(JSON.parse(JSON.stringify(input)));
        const b = legacy(JSON.parse(JSON.stringify(input)));
        eq(name, a, b);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📐 [3] childrenOf · rootsOf · totalsFor — مقابل coaBalanceRows القديمة');
// ═══════════════════════════════════════════════════════════════════════════════
{
    // نعيد بناء منطق القديم حرفياً كما هو داخل coaBalanceRows (دوال داخلية لا تُصدَّر)
    const accounts = [
        { code: '1', nameAr: 'الأصول', nature: 'header', parent: '' },
        { code: '11', nameAr: 'المتداولة', nature: 'header', parent: '1' },
        { code: '1110', nameAr: 'الصندوق', nature: 'debit', parent: '11', openingBalance: 1000 },
        { code: '1120', nameAr: 'البنك', nature: 'debit', parent: '11', openingBalance: 5000 },
        { code: '2', nameAr: 'الخصوم', nature: 'header', parent: '' },
        { code: '2110', nameAr: 'الموردون', nature: 'credit', parent: '2', openingBalance: 3000 },
        { code: '9999', nameAr: 'يتيم', nature: 'debit', parent: 'غير-موجود', openingBalance: 7 }
    ];
    const balances = {
        '1110': { naturalOpening: 1000, periodDebit: 500, periodCredit: 200, naturalClosing: 1300, count: 3 },
        '1120': { naturalOpening: 5000, periodDebit: 0, periodCredit: 1000, naturalClosing: 4000, count: 1 }
    };

    const byCode = {}; accounts.forEach(a => { byCode[a.code] = a; });
    const legacyChildrenOf = code => accounts.filter(a => (a.parent || '') === code).sort((x, y) => (x.code || '').localeCompare(y.code || ''));
    const legacyRoots = accounts.filter(a => !a.parent || !byCode[a.parent]).sort((x, y) => (x.code || '').localeCompare(y.code || ''));
    const legacyTotalsFor = a => {
        if (a.nature !== 'header') {
            const b = balances[a.code];
            if (b) return { opening: b.naturalOpening, debit: b.periodDebit, credit: b.periodCredit, closing: b.naturalClosing, count: b.count };
            const op = parseFloat(a.openingBalance) || 0;
            return { opening: op, debit: 0, credit: 0, closing: op, count: 0 };
        }
        const t = { opening: 0, debit: 0, credit: 0, closing: 0, count: 0 };
        legacyChildrenOf(a.code).forEach(k => {
            const kt = legacyTotalsFor(k);
            t.opening += kt.opening; t.debit += kt.debit; t.credit += kt.credit; t.closing += kt.closing; t.count += kt.count;
        });
        return t;
    };

    eq('childrenOf(11)', COA.childrenOf(accounts, '11').map(a => a.code), legacyChildrenOf('11').map(a => a.code));
    eq('childrenOf(جذر بلا أبناء)', COA.childrenOf(accounts, '1110'), legacyChildrenOf('1110'));
    eq('rootsOf — يشمل اليتيم ذا الأب المفقود', COA.rootsOf(accounts).map(a => a.code), legacyRoots.map(a => a.code));

    accounts.forEach(a => {
        eq(`totalsFor(${a.code})`, COA.totalsFor(accounts, a, balances), legacyTotalsFor(a));
    });

    // التجميعي يساوي مجموع أبنائه — الثابت المحاسبي
    const t1 = COA.totalsFor(accounts, accounts[0], balances);
    ok('الحساب التجميعي = مجموع أبنائه (1300 + 4000)', t1.closing === 5300, String(t1.closing));
    ok('وعدد حركاته مجموع حركاتهم (3 + 1)', t1.count === 4, String(t1.count));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🛡️ [4] قواعد التحقق — موثّقة من saveCoaAccount (مقروءة لا مُشغَّلة)');
// ═══════════════════════════════════════════════════════════════════════════════
// ⚠️ هذه الدالة القديمة تقرأ من DOM ولا يمكن تشغيلها في Node، فالتوصيف هنا
//    مبنيّ على قراءة الشفرة لا على تشغيلها. مُعلَّم صراحةً تمييزاً له عمّا سبق.
{
    const V = COA.validateAccount;
    ok('الرمز الفارغ خطأ', V({ code: '', type: 'asset', nameAr: 'س' }).errors[0].code === COA.ERRORS.CODE_REQUIRED);
    ok('النوع الفارغ خطأ', V({ code: '1110', type: '', nameAr: 'س' }).errors[0].code === COA.ERRORS.TYPE_REQUIRED);
    ok('الاسم العربي الفارغ خطأ', V({ code: '1110', type: 'asset', nameAr: '' }).errors[0].code === COA.ERRORS.NAME_AR_REQUIRED);
    ok('المسافات وحدها تُعامَل كفراغ (trim كالقديم)', V({ code: '  ', type: 'asset', nameAr: 'س' }).errors[0].code === COA.ERRORS.CODE_REQUIRED);

    const existing = [{ __key: 'k1', code: '1110' }, { __key: 'k2', code: '1120' }];
    ok('الرمز المكرّر خطأ', V({ code: '1110', type: 'asset', nameAr: 'س' }, { existing }).errors[0].code === COA.ERRORS.CODE_DUPLICATE);
    ok('تعديل الحساب نفسه ليس تكراراً', V({ code: '1110', type: 'asset', nameAr: 'س' }, { existing, editingKey: 'k1' }).ok === true);

    const w = V({ code: '9110', type: 'asset', nameAr: 'س' }, { existing: [] });
    ok('بادئة مخالفة ⇒ تحذير لا خطأ (القديم يسمح بالتجاوز)', w.ok === true && w.warnings[0].code === COA.WARNINGS.CODE_PREFIX_MISMATCH);
    ok('والتحذير يطلب تأكيداً صريحاً', w.warnings[0].requiresConfirmation === true);
    ok('بادئة مطابقة ⇒ بلا تحذير', V({ code: '1110', type: 'asset', nameAr: 'س' }, { existing: [] }).warnings.length === 0);
    ok('حساب سليم يمرّ', V({ code: '5110', type: 'expense', nameAr: 'مشتريات' }, { existing }).ok === true);

    // ترتيب التوقّف عند أول خطأ — مطابق للقديم
    eq('خطأ واحد فقط يُعاد (توقّف عند الأول)', V({ code: '', type: '', nameAr: '' }).errors.length, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🗑️ [5] قواعد الحذف — موثّقة من deleteCoaAccount');
// ═══════════════════════════════════════════════════════════════════════════════
{
    const acc = { code: '1110', nameAr: 'الصندوق' };
    const accounts = [acc, { code: '1111', parent: '1110' }];
    const entries = [{ lines: [{ accountCode: '1110', debit: 100 }] }];

    ok('وجود أبناء يمنع الحذف', COA.canDeleteAccount(acc, { accounts }).blockers[0].code === COA.DELETE_BLOCKERS.HAS_CHILDREN);
    ok('وجود قيود يمنع الحذف', COA.canDeleteAccount(acc, { journalEntries: entries }).blockers[0].code === COA.DELETE_BLOCKERS.HAS_JOURNAL_ENTRIES);
    ok('المانعان معاً يظهران معاً', COA.canDeleteAccount(acc, { accounts, journalEntries: entries }).blockers.length === 2);
    ok('بلا أبناء ولا قيود ⇒ يجوز الحذف', COA.canDeleteAccount(acc, { accounts: [acc], journalEntries: [] }).ok === true);
    ok('القيد المسوّدة يمنع أيضاً (القديم لا يفرّق بالحالة)',
        COA.canDeleteAccount(acc, { journalEntries: [{ status: 'draft', lines: [{ accountCode: '1110' }] }] }).ok === false);
    ok('قيد بلا سطور لا يمنع', COA.canDeleteAccount(acc, { journalEntries: [{ lines: [] }, {}] }).ok === true);
}

console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`);
process.exit(fail ? 1 : 0);
