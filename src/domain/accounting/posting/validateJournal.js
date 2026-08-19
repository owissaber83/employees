// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  validateJournal — سلامة بنية القيد قبل حتى فحص التوازن                 [Phase 6] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  فحوص بنيوية (§10). لا تُصلِح شيئاً — ترفض بلا مواربة. لا تفترض قاعدة عمل        ║
// ║  جديدة غير مُثبتة من السلوك الحالي (§18 من التعليمات الأصلية).                  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { ValidationError } from '../../../services/accounting/errors/ValidationError.js';

/**
 * @param {object} journal
 * @throws {ValidationError} أول عطل بنيوي يُعثر عليه
 */
export function validateJournal(journal) {
    if (!journal || typeof journal !== 'object') {
        throw new ValidationError('القيد غير موجود أو ليس كائناً صالحاً');
    }
    const lines = journal.lines;
    if (!Array.isArray(lines) || lines.length === 0) {
        throw new ValidationError('القيد يجب أن يحتوي سطراً واحداً على الأقل', { linesCount: (lines && lines.length) || 0 });
    }
    lines.forEach((line, i) => {
        if (!line || typeof line !== 'object') {
            throw new ValidationError(`السطر ${i + 1}: غير صالح`, { index: i });
        }
        if (!line.accountCode) {
            throw new ValidationError(`السطر ${i + 1}: لا يحمل رمز حساب`, { index: i, line });
        }
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
            throw new ValidationError(`السطر ${i + 1}: مبلغ غير رقمي`, { index: i, debit: line.debit, credit: line.credit });
        }
        if (debit < 0 || credit < 0) {
            throw new ValidationError(`السطر ${i + 1}: مبلغ سالب غير مسموح`, { index: i, debit, credit });
        }
        // 🔎 نفس الثابت المحاسبي المُثبَت في tests/golden-master/journal.test.mjs §[4]:
        // «لا سطر بمدين ودائن معاً» — صامد بصرف النظر عن التنفيذ.
        if (debit > 0 && credit > 0) {
            throw new ValidationError(`السطر ${i + 1}: يحمل مدين ودائن معاً — غير مسموح`, { index: i, debit, credit });
        }
        if (debit === 0 && credit === 0) {
            throw new ValidationError(`السطر ${i + 1}: صفري بالكامل — لا قيمة له في القيد`, { index: i });
        }
    });
    if (!Number.isFinite(Number(journal.totalDebit)) || !Number.isFinite(Number(journal.totalCredit))) {
        throw new ValidationError('إجمالي المدين أو الدائن في الترويسة غير رقمي',
            { totalDebit: journal.totalDebit, totalCredit: journal.totalCredit });
    }
    return true;
}
