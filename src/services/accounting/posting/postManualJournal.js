// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خدمة التطبيق: تسجيل/ترحيل قيد يدوي                                [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  🔒 محايدة عن التخزين — لا Firebase، لا DOM، لا `window`. كل حقل يصل صراحةً.    ║
// ║                                                                              ║
// ║  ⚠️ **ما لم يُنقَل عمداً** (يبقى مسؤولية المهايئ عند الوصل، موثَّق في            ║
// ║  docs/services/manual-journal-posting.md): الصلاحيات · قفل الفترة (`pcIsLocked`) ║
// ║  · التنبيهات الذكية قبل الترحيل (`jrnPrePostChecks`) · تعديل قيد مرحّل وسجل      ║
// ║  تدقيقه · حارس التسوية البنكية · طيّ التوزيع التحليلي عند التحرير.               ║
// ║  هذه الخدمة تغطّي **إنشاء** قيد يدوي جديد فقط — لا تعديل قيد قائم.              ║
// ║                                                                              ║
// ║  الفروق المقصودة: C1 مرساة هوية تمنع الازدواج · C2 كتابة ذرّية واحدة.          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildJournalLines } from '../../../domain/accounting/manual-journal/buildJournalLines.js';
import { convertLinesToBase } from '../../../domain/accounting/manual-journal/convertLinesToBase.js';
import { buildManualJournal, jrnBookByCode } from '../../../domain/accounting/manual-journal/buildManualJournal.js';
import {
    selectUserLines, assertMinimumLines, assertDescription,
    assertBalancedForPosting, assertAccountsUsable, assertExchangeRate
} from '../../../domain/accounting/manual-journal/validateManualJournal.js';
import { assertBalanced } from '../../../domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../../domain/accounting/posting/validateJournal.js';
import { buildIdempotencyKey } from '../idempotency/idempotencyKey.js';
import { ValidationError } from '../errors/ValidationError.js';

const PLACEHOLDER = '__PENDING__';

/**
 * @param {object} deps
 * @param {object} deps.chartOfAccountsRepo
 * @param {import('../../../repositories/contracts/ManualJournalPostingRepository.js').ManualJournalPostingRepository} deps.manualJournalPostingRepo
 * @param {()=>Promise<{projects:object, costCenters:object}>} [deps.getDimensions]
 * @param {object} [deps.cfg] { currency }
 * @param {{uid:string}} [deps.currentUser] · @param {()=>string} [deps.now]
 * @param {()=>string} [deps.newGroupId] مولّد معرّف التوزيع — حتمي في الاختبار
 */
export function createPostManualJournalService(deps) {
    const {
        chartOfAccountsRepo, manualJournalPostingRepo,
        getDimensions = async () => ({ projects: {}, costCenters: {} }),
        cfg = {}, currentUser, now = () => new Date().toISOString(), newGroupId
    } = deps;

    if (!chartOfAccountsRepo) throw new Error('chartOfAccountsRepo مطلوب');
    if (!manualJournalPostingRepo) throw new Error('manualJournalPostingRepo مطلوب');

    /**
     * @param {object} input
     * @param {string} input.journalKey مفتاح مُولَّد محلّياً — **مرساة Idempotency**
     * @param {Array<object>} input.lines سطور المستخدم (بلا سطور ضريبة تلقائية)
     * @param {object} input.header {date,reference,description,notes,book,autoReverseDate,attachments}
     * @param {'draft'|'posted'} [input.status]
     * @param {string} [input.currency] · @param {number} [input.exchangeRate]
     */
    return async function postManualJournal({ journalKey, lines, header = {}, status = 'posted', currency, exchangeRate }) {
        if (!journalKey) throw new ValidationError('journalKey مطلوب — هو مرساة Idempotency ويجب أن يولّده المستدعي');
        if (status !== 'draft' && status !== 'posted') {
            throw new ValidationError(`حالة غير معروفة: ${status}`, { status });
        }

        assertDescription(header.description);

        const idempotencyKey = buildIdempotencyKey({ sourceType: 'manualJournal', sourceId: journalKey, operation: status.toUpperCase() });

        // ── سطور المستخدم ثم التوسيع (توزيع تحليلي + ضريبة) — نقيّ ───────────────
        const userLines = selectUserLines(lines);
        assertMinimumLines(userLines);

        const allAccounts = await chartOfAccountsRepo.list();
        const chartOfAccounts = Object.fromEntries(allAccounts.map(a => [a.__key, a]));
        const dims = await getDimensions();

        const finalLines = buildJournalLines({
            userLines,
            projects: (dims && dims.projects) || {},
            costCenters: (dims && dims.costCenters) || {},
            chartOfAccounts,
            newGroupId
        });

        // التوازن يُفحص بعملة الإدخال — نفس ترتيب القديم (قبل التحويل)
        assertBalancedForPosting(finalLines, status);

        const baseCurrency = cfg.currency || 'SAR';
        const cur = currency || baseCurrency;
        const rate = (cur === baseCurrency) ? 1 : (parseFloat(exchangeRate) || 0);
        assertExchangeRate(cur, baseCurrency, rate);

        assertAccountsUsable(finalLines, allAccounts);

        const storeLines = (cur !== baseCurrency) ? convertLinesToBase(finalLines, rate) : finalLines;

        const nowIso = now();
        const userId = (currentUser && currentUser.uid) || 'system';
        const buildInputs = {
            storeLines, header, currency: cur, exchangeRate: rate,
            baseCurrency, status, now: nowIso, userId
        };

        // ── تحقّق مسبق — القيد المُرحَّل وحده يجب أن يجتاز فحص التوازن الصارم ────
        const preview = buildManualJournal({ ...buildInputs, journalNumber: PLACEHOLDER });
        validateJournal(preview.journal);
        if (status === 'posted') assertBalanced(preview.journal);

        const prefix = jrnBookByCode(header.book || 'GEN').prefix;

        try {
            const result = await manualJournalPostingRepo.postManualJournalAtomic({
                journalKey,
                buildJournal: journalNumber => buildManualJournal({ ...buildInputs, journalNumber }),
                journalBookPrefix: prefix
            });
            return { success: true, ...result, idempotencyKey, status, lineCount: storeLines.length };
        } catch (e) {
            if (e && e.name === 'DuplicatePostingError') {
                const original = (e.details && e.details.original) || {};
                return {
                    success: true, alreadyPosted: true,
                    journalId: original.journalId || journalKey,
                    journalNumber: original.journalNumber || null,
                    idempotencyKey
                };
            }
            throw e;
        }
    };
}
