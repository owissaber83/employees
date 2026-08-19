// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  التمثيل المعياري ودقّة المقارنة المالية                                       ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ⚠️ هذه الوحدة **توثّق قواعد التقريب القائمة ولا تغيّرها**.                     ║
// ║  المرجع المرصود في الشفرة القديمة:                                            ║
// ║     Math.round(n * 100) / 100        ← منزلتان، نصف لأعلى                     ║
// ║     Math.abs(a - b) < 0.01           ← تسامح التوازن في accounting.js:3271     ║
// ║     Math.abs(dr - cr) >= 0.01        ← حارس القيد اليدوي في accounting.js:3679 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/** دقّة العملة المرصودة في النظام: منزلتان. لا توجد عملة بثلاث منازل في الشفرة. */
export const CURRENCY_DECIMALS = 2;

/** تسامح مقارنة المبالغ — نفس ما يستخدمه النظام في فحص التوازن. */
export const MONEY_TOLERANCE = 0.01;

/** تسامح مقارنة نسب الضريبة (نسبة مئوية لا مبلغ). */
export const RATE_TOLERANCE = 0.0001;

/** التقريب القائم في النظام — منقول حرفياً، لا يُغيَّر. */
export const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

/** مقارنة مبلغين مالياً. لا `===` على أعداد عشرية. */
export const moneyEq = (a, b, tol = MONEY_TOLERANCE) =>
    Math.abs((Number(a) || 0) - (Number(b) || 0)) < tol;

/** فرق مبلغين مقرَّباً — للتقارير لا للمقارنة. */
export const moneyDiff = (a, b) => round2((Number(a) || 0) - (Number(b) || 0));

/**
 * تمثيل معياري لسطر قيد.
 * الحقول المالية تُقرَّب لمنزلتين كي لا يُعتبر `0.1+0.2` اختلافاً.
 * الحقول غير الموجودة تُترك `undefined` — **لا تُخترع** (شرط §4).
 */
export function canonicalLine(line) {
    if (!line) return null;
    const out = {
        accountCode: line.accountCode == null ? null : String(line.accountCode),
        debit: round2(line.debit),
        credit: round2(line.credit)
    };
    // تُضاف فقط إن كانت موجودة فعلاً في السطر
    if ('accountName' in line) out.accountName = line.accountName;
    if ('description' in line) out.description = line.description;
    if ('costCenter' in line) out.costCenter = line.costCenter || '';
    return out;
}

/**
 * ترتيب معياري للسطور: بالحساب ثم المدين ثم الدائن ثم الوصف.
 * الغرض ألّا يُعتبر اختلافُ الترتيب اختلافاً محاسبياً — بينما يبقى اختلاف
 * الحساب أو المبلغ اختلافاً حقيقياً.
 */
export function canonicalLines(lines) {
    return (lines || []).map(canonicalLine).filter(Boolean).sort((a, b) => {
        if (a.accountCode !== b.accountCode) return String(a.accountCode).localeCompare(String(b.accountCode));
        if (a.debit !== b.debit) return a.debit - b.debit;
        if (a.credit !== b.credit) return a.credit - b.credit;
        return String(a.description || '').localeCompare(String(b.description || ''));
    });
}

/** الحقول التي تتغيّر بين تشغيل وآخر ولا تُقارَن. */
export const VOLATILE = ['createdAt', 'postedAt', 'updatedAt', 'approvedAt', 'at'];

/**
 * تمثيل معياري لقيد كامل.
 * @param {object} entry
 * @param {{keepVolatile?:boolean}} opts
 */
export function canonicalJournal(entry, opts = {}) {
    if (!entry) return null;
    const out = {
        lines: canonicalLines(entry.lines),
        totalDebit: round2(entry.totalDebit),
        totalCredit: round2(entry.totalCredit)
    };
    ['number', 'date', 'reference', 'description', 'status',
        'sourceType', 'sourceKey', 'currency'].forEach(k => {
            if (k in entry) out[k] = entry[k];
        });
    if ('exchangeRate' in entry) out.exchangeRate = Number(entry.exchangeRate);
    if ('foreignTotal' in entry) out.foreignTotal = round2(entry.foreignTotal);
    // أثر التدقيق: نحتفظ بمن لا بمتى (§20)
    ['createdBy', 'postedBy', 'approvedBy'].forEach(k => { if (k in entry) out[k] = entry[k]; });
    if (opts.keepVolatile) VOLATILE.forEach(k => { if (k in entry) out[k] = entry[k]; });
    return out;
}

/** مجاميع السطور — أساس فحص الثوابت المحاسبية. */
export function lineTotals(lines) {
    const l = lines || [];
    return {
        debit: round2(l.reduce((s, x) => s + (Number(x.debit) || 0), 0)),
        credit: round2(l.reduce((s, x) => s + (Number(x.credit) || 0), 0)),
        count: l.length
    };
}

/** مقارنة قيدين معيارياً. @returns {{equal, diffs}} */
export function compareJournals(legacy, next) {
    const a = canonicalJournal(legacy), b = canonicalJournal(next);
    const diffs = [];
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    keys.forEach(k => {
        if (k === 'lines') return;
        const av = a ? a[k] : undefined, bv = b ? b[k] : undefined;
        const isMoney = ['totalDebit', 'totalCredit', 'foreignTotal'].includes(k);
        const same = isMoney ? moneyEq(av, bv) : JSON.stringify(av) === JSON.stringify(bv);
        if (!same) diffs.push({ field: k, legacy: av, next: bv });
    });
    const al = (a && a.lines) || [], bl = (b && b.lines) || [];
    if (al.length !== bl.length) diffs.push({ field: 'lines.length', legacy: al.length, next: bl.length });
    else al.forEach((la, i) => {
        const lb = bl[i];
        if (la.accountCode !== lb.accountCode) diffs.push({ field: `lines[${i}].accountCode`, legacy: la.accountCode, next: lb.accountCode });
        if (!moneyEq(la.debit, lb.debit)) diffs.push({ field: `lines[${i}].debit`, legacy: la.debit, next: lb.debit });
        if (!moneyEq(la.credit, lb.credit)) diffs.push({ field: `lines[${i}].credit`, legacy: la.credit, next: lb.credit });
    });
    return { equal: diffs.length === 0, diffs };
}
