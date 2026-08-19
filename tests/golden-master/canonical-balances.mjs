// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تمثيل معياري لمخرجات دوال الأرصدة                                 [Phase 5]  ║
// ║  يعيد استخدام round2/moneyEq من canonical.mjs — لا يكرّرها.                    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2, moneyEq } from './canonical.mjs';
export { round2, moneyEq } from './canonical.mjs';

/** سطر ميزان مراجعة واحد (من tbCalcBalances.displayBalances). */
export function canonicalTbRow(b) {
    if (!b) return null;
    return {
        code: b.account.code,
        type: b.account.type,
        opening: round2(b.opening),
        debit: round2(b.debit),
        credit: round2(b.credit),
        netBalance: round2(b.netBalance),
        finalDebit: round2(b.finalDebit),
        finalCredit: round2(b.finalCredit),
        isAnomaly: !!b.isAnomaly
    };
}

/** ميزان مراجعة كامل — صفوف مُرتَّبة بالرمز + إجماليات. */
export function canonicalTrialBalance(tb) {
    if (!tb) return null;
    const rows = (tb.displayBalances || []).map(canonicalTbRow)
        .sort((a, b) => String(a.code).localeCompare(String(b.code)));
    return {
        rows,
        totals: {
            opening: round2(tb.totals.opening), debit: round2(tb.totals.debit), credit: round2(tb.totals.credit),
            finalDebit: round2(tb.totals.finalDebit), finalCredit: round2(tb.totals.finalCredit)
        },
        debitCreditBalance: !!tb.debitCreditBalance,
        finalBalance: !!tb.finalBalance
    };
}

/** سطر دفتر أستاذ واحد (من coaAccountOps.ops) — بلا الرصيد الجاري (يُحسَب في العرض لا في الدالة). */
export function canonicalLedgerOp(o) {
    if (!o) return null;
    return {
        date: o.date, number: o.number, description: o.description || '',
        debit: round2(o.debit), credit: round2(o.credit), status: o.status
    };
}

/** دفتر أستاذ حساب كامل: الرصيد قبل الفترة + الحركات + الختامي (محسوب هنا كما يحسبه coaRenderOpsPanel). */
export function canonicalLedger(code, accountOpeningBalance, glResult) {
    const { ops, preNet } = glResult;
    const opening = round2((Number(accountOpeningBalance) || 0) + preNet);
    let running = opening;
    const rows = ops.map(o => {
        running = round2(running + o.debit - o.credit);
        return { ...canonicalLedgerOp(o), runningBalance: running };
    });
    const totD = round2(ops.reduce((s, o) => s + o.debit, 0));
    const totC = round2(ops.reduce((s, o) => s + o.credit, 0));
    return { code, opening, rows, periodDebit: totD, periodCredit: totC, closing: running };
}

/** رصيد عميل/مورد (calcCustomerBalance / calcVendorBalance). */
export function canonicalPartyBalance(b) {
    if (!b) return null;
    const out = { opening: round2(b.opening), invoiced: round2(b.invoiced), paid: round2(b.paid), balance: round2(b.balance), overdue: round2(b.overdue) };
    if ('credited' in b) out.credited = round2(b.credited);
    return out;
}
