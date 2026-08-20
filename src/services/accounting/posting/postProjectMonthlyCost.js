// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خدمة التطبيق: ترحيل تكلفة مشروع شهرية (PMC)                       [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 محايدة عن التخزين — لا Firebase، لا DOM، لا `window`، لا `toast`.           ║
// ║                                                                              ║
// ║  ═══ الفروق المقصودة عن القديم ═══                                            ║
// ║  C1 — **يرفض الترحيل عند غياب حساب** بدل `toast` + `return null` يتخطّاه         ║
// ║       المستدعي بصمت فتبقى التكلفة بلا قيد (BUG-015).                           ║
// ║  C2 — **مطالبة خادمية** على حقل الربط الموجود ⇒ لا قيدان لنفس التكلفة.          ║
// ║  C3 — **كتابة ذرّية واحدة** (قيد + ربط) بدل `push` ثم `update` منفصلتين.        ║
// ║  A  — القيد نفسه **مطابق حرفياً**: نفس السطرين ونفس الحقول ونفس الأوصاف.        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildPMCJournal } from '../../../domain/accounting/pmc/buildPMCJournal.js';
import { getPMCCategoryInfo, pmcCategoryHasAccounts } from '../../../domain/accounting/pmc/resolvePMCAccounts.js';
import { assertBalanced } from '../../../domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../../domain/accounting/posting/validateJournal.js';
import { buildIdempotencyKey } from '../idempotency/idempotencyKey.js';
import { ValidationError, MissingAccountError } from '../errors/ValidationError.js';

const PLACEHOLDER = '__PENDING__';

/**
 * @param {object} deps
 * @param {object} deps.chartOfAccountsRepo
 * @param {import('../../../repositories/contracts/ProjectCostPostingRepository.js').ProjectCostPostingRepository} deps.projectCostPostingRepo
 * @param {(key:string)=>Promise<object|null>} deps.getProjectCost
 * @param {()=>Promise<object>} [deps.getCustomCategories]
 * @param {()=>string} [deps.now]
 */
export function createPostProjectMonthlyCostService(deps) {
    const {
        chartOfAccountsRepo, projectCostPostingRepo, getProjectCost,
        getCustomCategories = async () => ({}), now = () => new Date().toISOString()
    } = deps;

    if (!chartOfAccountsRepo) throw new Error('chartOfAccountsRepo مطلوب');
    if (!projectCostPostingRepo) throw new Error('projectCostPostingRepo مطلوب');
    if (!getProjectCost) throw new Error('getProjectCost مطلوب');

    /** @param {{pmcKey:string}} input */
    return async function postProjectMonthlyCost({ pmcKey }) {
        if (!pmcKey) throw new ValidationError('pmcKey مطلوب');

        const pmc = await getProjectCost(pmcKey);
        if (!pmc) throw new ValidationError('سجل تكلفة المشروع غير موجود', { pmcKey });

        const amount = Number(pmc.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new ValidationError('مبلغ التكلفة غير صالح', { pmcKey, amount: pmc.amount });
        }

        const idempotencyKey = buildIdempotencyKey({ sourceType: 'projectMonthlyCost', sourceId: pmcKey, operation: 'POST' });

        // ── حلّ النوع والحسابات — بحث فقط، بلا إنشاء ────────────────────────────
        const customCategories = await getCustomCategories();
        const categoryInfo = getPMCCategoryInfo(pmc.category, customCategories);

        // C1 — الثغرة المرصودة: نوع بلا خريطة حسابات (custom_* أو غير معروف)
        if (!pmcCategoryHasAccounts(pmc.category, customCategories)) {
            throw new MissingAccountError(
                `نوع التكلفة (${pmc.category}) لا يحمل خريطة حسابات — لن تُسجَّل تكلفة بلا قيد محاسبي`,
                { pmcKey, category: pmc.category });
        }

        const debitAccount = await chartOfAccountsRepo.getByCode(categoryInfo.defaultDebitAccountCode);
        if (!debitAccount) {
            throw new MissingAccountError(`حساب المدين الافتراضي (${categoryInfo.defaultDebitAccountCode}) غير موجود`,
                { pmcKey, accountCode: categoryInfo.defaultDebitAccountCode });
        }
        const creditAccount = await chartOfAccountsRepo.getByCode(categoryInfo.defaultCreditAccountCode);
        if (!creditAccount) {
            throw new MissingAccountError(`حساب الدائن الافتراضي (${categoryInfo.defaultCreditAccountCode}) غير موجود`,
                { pmcKey, accountCode: categoryInfo.defaultCreditAccountCode });
        }

        const nowIso = now();
        const buildInputs = { pmc: { ...pmc, key: pmcKey }, categoryInfo, debitAccount, creditAccount, now: nowIso };

        // ── تحقّق مسبق برقم مؤقّت — قبل أي مطالبة أو حجز ────────────────────────
        const preview = buildPMCJournal({ ...buildInputs, journalNumber: PLACEHOLDER });
        validateJournal(preview.journal);
        assertBalanced(preview.journal);

        try {
            const result = await projectCostPostingRepo.postProjectCostAtomic({
                pmcKey,
                buildJournal: journalNumber => buildPMCJournal({ ...buildInputs, journalNumber }),
                journalBookPrefix: 'JV'
            });
            return { success: true, ...result, sourceId: pmcKey, idempotencyKey, warnings: preview.warnings };
        } catch (e) {
            if (e && e.name === 'DuplicatePostingError') {
                const original = (e.details && e.details.original) || {};
                return {
                    success: true, alreadyPosted: true,
                    journalId: original.journalId || null, journalNumber: original.journalNumber || null,
                    sourceId: pmcKey, idempotencyKey
                };
            }
            throw e;
        }
    };
}
