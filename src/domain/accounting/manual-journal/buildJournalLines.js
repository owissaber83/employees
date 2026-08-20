// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  توسيع سطور القيد اليدوي — نقيّة، من jrnBuildFinalLines            [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لـaccounting.js:6031 — توسيع التوزيع التحليلي + توليد سطور        ║
// ║  الضريبة التلقائية.                                                            ║
// ║                                                                              ║
// ║  🔴 **مصدرا اللانقاء في القديم، وقد أُزيلا بالحقن لا بالتغيير:**                 ║
// ║   1. `Math.random()` لتوليد `_agid` ⇒ يُحقَن `newGroupId` (افتراضه عدّاد حتمي).   ║
// ║   2. `window.projects`/`window.costCenters`/`window.chartOfAccounts` ⇒ وسائط.   ║
// ║  ما عدا ذلك الحساب مطابق بايتاً ببايت.                                         ║
// ║                                                                              ║
// ║  🔎 تفاصيل تكسر التطابق لو أُهملت:                                             ║
// ║   • حصص التوزيع: `Math.round(base * pct) / 100` — **لا** `pct/100 * base`.      ║
// ║   • فرق التقريب يُضاف إلى **أكبر حصّة** لا إلى الأولى.                           ║
// ║   • الهدف يُعتبر مشروعاً إن وُجد في `projects` **ولم** يوجد في `costCenters`.     ║
// ║   • `_agHead` و`taxable` على الحصّة الأولى فقط.                                 ║
// ║   • سطر الضريبة يُولَّد من **السطر الأصلي** حتى لو وُزِّع تحليلياً.                 ║
// ║   • الضريبة: مدين ⇒ حساب المدخلات · دائن ⇒ حساب المخرجات.                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/** منقولان حرفياً من accounting.js:27363–27364. */
export const VAT_OUT_ACC = '2140';
export const VAT_IN_ACC = '1180';

/**
 * @param {object} p
 * @param {Array<object>} p.userLines سطور المستخدم (بلا سطور ضريبة تلقائية)
 * @param {object} [p.projects] · @param {object} [p.costCenters] · @param {object} [p.chartOfAccounts]
 * @param {() => string} [p.newGroupId] مولّد معرّف مجموعة التوزيع — حتمي افتراضاً
 * @returns {Array<object>}
 */
export function buildJournalLines({ userLines, projects = {}, costCenters = {}, chartOfAccounts = {}, newGroupId } = {}) {
    let seq = 0;
    const genId = newGroupId || (() => `ag${String(++seq).padStart(6, '0')}`);
    const out = [];

    (userLines || []).forEach(l => {
        const deb = parseFloat(l.debit) || 0, cred = parseFloat(l.credit) || 0;
        const base = deb > 0 ? deb : cred, isDebit = deb > 0;
        const dist = Array.isArray(l.analytic) ? l.analytic.filter(d => d.target && parseFloat(d.pct) > 0) : null;

        if (dist && dist.length && base > 0 && l.accountCode) {
            const agid = genId();
            const shares = dist.map(d => ({ target: d.target, pct: parseFloat(d.pct) || 0 }));
            const amts = shares.map(s => Math.round(base * s.pct) / 100);
            const resid = Math.round((base - amts.reduce((a, b) => a + b, 0)) * 100) / 100;
            if (Math.abs(resid) > 0.001) {
                let mi = 0; amts.forEach((a, k) => { if (a > amts[mi]) mi = k; });
                amts[mi] = Math.round((amts[mi] + resid) * 100) / 100;
            }
            shares.forEach((s, k) => {
                const isProj = projects[s.target] && !costCenters[s.target];
                const sub = {
                    accountCode: l.accountCode, accountName: l.accountName,
                    description: l.description || '', date: l.date || '',
                    costCenter: isProj ? '' : s.target, projectId: isProj ? s.target : '',
                    supplierId: l.supplierId || '', matCategory: l.matCategory || '',
                    debit: isDebit ? amts[k] : 0, credit: isDebit ? 0 : amts[k], _agid: agid
                };
                if (k === 0) {
                    sub._agHead = true; sub._agShares = shares;
                    if (l.taxable) { sub.taxable = true; sub.vatRate = parseFloat(l.vatRate) || 0; }
                }
                out.push(sub);
            });
        } else {
            out.push(l);
        }

        if (l.taxable && (parseFloat(l.vatRate) || 0) > 0 && base > 0 && l.accountCode) {
            const rate = parseFloat(l.vatRate) || 0, vat = Math.round(base * rate) / 100;
            const acc = isDebit ? VAT_IN_ACC : VAT_OUT_ACC;
            const accObj = Object.values(chartOfAccounts).find(a => a.code === acc);
            out.push({
                accountCode: acc,
                accountName: accObj ? accObj.nameAr : (isDebit ? 'ضريبة القيمة المضافة — المدخلات' : 'ضريبة القيمة المضافة — المخرجات'),
                description: `ضريبة ${isDebit ? 'مدخلات' : 'مخرجات'} ${rate}%` + (l.description ? ` — ${l.description}` : ''),
                date: l.date || '', costCenter: '', projectId: '', supplierId: '', matCategory: '',
                debit: isDebit ? vat : 0, credit: isDebit ? 0 : vat, _taxAuto: true, vatRate: rate
            });
        }
    });

    return out;
}
