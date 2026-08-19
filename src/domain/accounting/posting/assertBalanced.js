// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  assertBalanced — الفحص الحقيقي الذي لا تستطيع RTDB فرضه                [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ACCOUNTING_INTEGRITY_FIX_PLAN.md §2: قاعدة RTDB تقارن totalDebit/totalCredit    ║
// ║  في الترويسة فقط — لا تستطيع بنيوياً جمع مصفوفة `lines`. هذه الدالة تحسب        ║
// ║  المجموع من **السطور الفعلية** وتقارنه بالترويسة، لا العكس.                     ║
// ║                                                                              ║
// ║  🔒 نفس سياسة الدقّة القائمة — لا تُغيَّر (docs/accounting/golden-master.md §6): ║
// ║     round2 = Math.round(n*100)/100 · تسامح المقارنة = 0.01                     ║
// ║  round2 مستوردة من public/calc.js — مصدر واحد، لا نسخة موازية (نفس نمط         ║
// ║  tests/golden-master/canonical.mjs الذي فعل هذا في Phase 4).                   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { round2 } from '../../../../public/calc.js';
import { UnbalancedJournalError } from '../../../services/accounting/errors/ValidationError.js';

export const MONEY_TOLERANCE = 0.01;

/** مقارنة مبلغين ماليّة — لا `===` على عدد عشري أبداً. نفس تسامح النظام القائم. */
export function moneyEq(a, b, tol = MONEY_TOLERANCE) {
    return Math.abs((Number(a) || 0) - (Number(b) || 0)) < tol;
}

/** مجموع سطور القيد — أساس الفحص الحقيقي. */
export function lineTotals(lines) {
    const l = Array.isArray(lines) ? lines : [];
    return {
        debit: round2(l.reduce((s, x) => s + (Number(x && x.debit) || 0), 0)),
        credit: round2(l.reduce((s, x) => s + (Number(x && x.credit) || 0), 0))
    };
}

/**
 * يتحقّق أن مجموع سطور القيد الفعلي يساوي الترويسة، وأن الترويسة متوازنة.
 * يرمي `UnbalancedJournalError` عند أي اختلال — لا يُصلِح شيئاً بصمت (§10).
 * @param {{lines:Array, totalDebit:number, totalCredit:number}} journal
 * @throws {UnbalancedJournalError}
 */
export function assertBalanced(journal) {
    const lines = journal && journal.lines;
    const t = lineTotals(lines);
    const headerDebit = round2(journal && journal.totalDebit);
    const headerCredit = round2(journal && journal.totalCredit);

    if (!moneyEq(t.debit, t.credit)) {
        throw new UnbalancedJournalError(
            `القيد غير متوازن: مجموع المدين (${t.debit}) لا يساوي مجموع الدائن (${t.credit})`,
            { linesDebit: t.debit, linesCredit: t.credit }
        );
    }
    if (!moneyEq(headerDebit, headerCredit)) {
        throw new UnbalancedJournalError(
            `ترويسة القيد غير متوازنة: ${headerDebit} ≠ ${headerCredit}`,
            { headerDebit, headerCredit }
        );
    }
    // 🔴 الفحص الذي RTDB عاجزة عنه بنيوياً: الترويسة قد تتوازن مع نفسها بينما
    // تخالف السطور (ACCOUNTING_INTEGRITY_FIX_PLAN.md §1 — القيد المزوَّر المُثبَت
    // في tests/golden-master/journal.test.mjs §[5]). هذا هو ما يُغلق تلك الثغرة فعلياً.
    if (!moneyEq(t.debit, headerDebit) || !moneyEq(t.credit, headerCredit)) {
        throw new UnbalancedJournalError(
            `مجموع السطور (مدين ${t.debit} / دائن ${t.credit}) لا يطابق الترويسة (مدين ${headerDebit} / دائن ${headerCredit})`,
            { linesDebit: t.debit, linesCredit: t.credit, headerDebit, headerCredit }
        );
    }
    return { debit: t.debit, credit: t.credit };
}
