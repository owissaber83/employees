// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خدمة التطبيق: إصدار وترحيل إشعار مدين (مرتجع مشتريات)             [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  UI/Legacy ──▶ [هذا الملف] ──▶ Domain ──▶ Repository (ذرّي + تعويضي) ──▶ RTDB    ║
// ║                                                                              ║
// ║  🔒 محايدة عن التخزين — لا Firebase، لا DOM، لا `window`. `returnQuantities`    ║
// ║  تُمرَّر صراحةً (§5).                                                           ║
// ║                                                                              ║
// ║  ⚠️ **ليست نسخة من خدمة الإشعار الدائن**: الحسابات مختلفة (`2110`/`1180`/       ║
// ║  `5110`)، اتجاه المخزون `out`، وتكلفة الحركة **سعر السطر لا المتوسط المتحرّك**    ║
// ║  (D4 — معلّق، السلوك القديم محفوظ). كل ذلك مُقارَن بالقديم على حدة.               ║
// ║                                                                              ║
// ║  الفروق المقصودة C1–C4 مطابقة لنظيرتها في postCreditNote (BUG-010…013).        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { computeDebitNote } from '../../../domain/accounting/debit-note/computeDebitNote.js';
import { validateDebitNoteSource, validateReturnQuantities, validateNoteAmounts } from '../../../domain/accounting/debit-note/validateDebitNote.js';
import { buildDebitNoteJournal } from '../../../domain/accounting/debit-note/buildDebitNoteJournal.js';
import { debitNoteExpenseCandidates, debitNotePayableCode, expenseAccountForType, INPUT_VAT_CODE } from '../../../domain/accounting/debit-note/resolveDebitNoteAccounts.js';
import { planDebitNoteMovements } from '../../../domain/inventory/planDebitNoteMovements.js';
import { assertBalanced } from '../../../domain/accounting/posting/assertBalanced.js';
import { validateJournal } from '../../../domain/accounting/posting/validateJournal.js';
import { buildIdempotencyKey } from '../idempotency/idempotencyKey.js';
import { ValidationError, MissingAccountError } from '../errors/ValidationError.js';

const PLACEHOLDER = '__PENDING__';
const FALLBACK_PAYABLE = '2110';

/**
 * @param {object} deps
 * @param {object} deps.chartOfAccountsRepo
 * @param {import('../../../repositories/contracts/DebitNotePostingRepository.js').DebitNotePostingRepository} deps.debitNotePostingRepo
 * @param {(key:string)=>Promise<object|null>} deps.getPurchaseInvoice
 * @param {(id:string)=>Promise<object|null>} [deps.getVendor]
 * @param {()=>Promise<{items:object}>} [deps.getInventorySnapshot]
 * @param {object} [deps.cfg] · @param {{uid:string}} [deps.currentUser] · @param {()=>string} [deps.now]
 */
export function createPostDebitNoteService(deps) {
    const {
        chartOfAccountsRepo, debitNotePostingRepo, getPurchaseInvoice,
        getVendor = async () => null,
        getInventorySnapshot = async () => ({ items: {}, movements: {}, warehouses: {} }),
        cfg = {}, currentUser, now = () => new Date().toISOString()
    } = deps;

    if (!chartOfAccountsRepo) throw new Error('chartOfAccountsRepo مطلوب');
    if (!debitNotePostingRepo) throw new Error('debitNotePostingRepo مطلوب');
    if (!getPurchaseInvoice) throw new Error('getPurchaseInvoice مطلوب');

    /**
     * @param {{noteKey:string, invoiceKey:string, returnQuantities?:Array<number>, reason?:string}} input
     */
    return async function postDebitNote({ noteKey, invoiceKey, returnQuantities, reason }) {
        if (!noteKey) throw new ValidationError('noteKey مطلوب — هو مرساة Idempotency ويجب أن يولّده المستدعي');
        if (!invoiceKey) throw new ValidationError('invoiceKey مطلوب');

        const invoice = await getPurchaseInvoice(invoiceKey);
        validateDebitNoteSource(invoice, invoiceKey);
        validateReturnQuantities(returnQuantities, invoice);

        const idempotencyKey = buildIdempotencyKey({ sourceType: 'debitNote', sourceId: noteKey, operation: 'POST' });

        const amounts = computeDebitNote({ invoice, returnQuantities });
        validateNoteAmounts(amounts);

        // ── حلّ الحسابات — بحث فقط، بلا إنشاء ───────────────────────────────────
        const vendor = invoice.vendorId ? await getVendor(invoice.vendorId) : null;
        const allAccounts = await chartOfAccountsRepo.list();
        const chartOfAccounts = Object.fromEntries(allAccounts.map(a => [a.__key, a]));

        const payableCode = debitNotePayableCode({
            note: { vendorId: invoice.vendorId },
            vendors: vendor && invoice.vendorId ? { [invoice.vendorId]: vendor } : {},
            chartOfAccounts, cfg
        });
        const payableAccount =
            (await chartOfAccountsRepo.getByCode(payableCode))
            || (await chartOfAccountsRepo.getByCode(FALLBACK_PAYABLE));
        if (!payableAccount) {
            throw new MissingAccountError(`حساب الموردين (${payableCode}) غير موجود — لن يُصدَر إشعار بلا قيد`, { invoiceKey, accountCode: payableCode });
        }

        // نفس اشتقاق القديم عند بناء المستند (accounting.js:16247)
        const expenseAccountCode = invoice.debitAccountCode || expenseAccountForType(invoice.expenseType);
        let expenseAccount = null;
        const expCandidates = debitNoteExpenseCandidates({ note: { expenseAccountCode } });
        for (const code of expCandidates) {
            expenseAccount = await chartOfAccountsRepo.getByCode(code);
            if (expenseAccount) break;
        }
        if (!expenseAccount) {
            throw new MissingAccountError(`حساب المصروف (${expCandidates.join(' أو ')}) غير موجود — لن يُصدَر إشعار بلا قيد`, { invoiceKey, candidates: expCandidates });
        }

        const vatAccount = await chartOfAccountsRepo.getByCode(INPUT_VAT_CODE);
        if (amounts.vatTotal > 0 && !vatAccount) {
            throw new MissingAccountError(`حساب ${INPUT_VAT_CODE} (ضريبة المدخلات) غير موجود — لن تُضمّ الضريبة إلى المصروف`, { invoiceKey, accountCode: INPUT_VAT_CODE });
        }

        const nowIso = now();
        const today = nowIso.slice(0, 10);
        const userId = (currentUser && currentUser.uid) || 'system';

        // ── مستند الإشعار — نفس حقول القديم حرفياً (accounting.js:16247) ─────────
        const buildNote = noteNumber => ({
            number: noteNumber,
            date: today,
            invoiceKey,
            invoiceNumber: invoice.number,
            vendorId: invoice.vendorId,
            vendorRef: invoice.vendorRef || '',
            reason: (reason || '').trim() || 'مرتجع مشتريات',
            lines: amounts.lines,
            subTotal: amounts.subTotal,
            discount: amounts.discount,
            netBeforeTax: amounts.netBeforeTax,
            vatTotal: amounts.vatTotal,
            grandTotal: amounts.grandTotal,
            currency: invoice.currency || cfg.baseCurrencyCode || 'SAR',
            exchangeRate: invoice.exchangeRate || 1,
            expenseAccountCode,
            projectId: invoice.projectId || '',
            status: 'posted',
            createdAt: nowIso,
            createdBy: userId
        });

        const journalInputs = {
            noteKey, vendor, payableAccount, expenseAccount, vatAccount,
            baseCurrencyCode: cfg.baseCurrencyCode || 'SAR', now: nowIso, userId
        };

        const previewNote = buildNote(PLACEHOLDER);
        const preview = buildDebitNoteJournal({ ...journalInputs, note: previewNote, journalNumber: PLACEHOLDER });
        validateJournal(preview.journal);
        assertBalanced(preview.journal);

        const snapshot = await getInventorySnapshot();
        const items = (snapshot && snapshot.items) || {};
        const plan = planDebitNoteMovements({ noteKey, note: previewNote, items, now: nowIso, userId });

        try {
            const result = await debitNotePostingRepo.postDebitNoteAtomic({
                noteKey, invoiceKey, noteAmount: amounts.grandTotal,
                buildNote,
                buildJournal: (journalNumber, note) => buildDebitNoteJournal({ ...journalInputs, note, journalNumber }),
                movementCount: plan.movements.length,
                buildMovements: (numbers, note) =>
                    planDebitNoteMovements({ noteKey, note, items, now: nowIso, userId })
                        .movements.map((m, i) => ({ number: numbers[i], ...m })),
                journalBookPrefix: 'JV'
            });
            return {
                success: true, ...result, sourceId: invoiceKey, idempotencyKey,
                amounts, warnings: [...preview.warnings, ...plan.warnings]
            };
        } catch (e) {
            if (e && e.name === 'DuplicatePostingError') {
                const original = (e.details && e.details.original) || {};
                return {
                    success: true, alreadyPosted: true,
                    noteId: original.noteId || noteKey, noteNumber: original.noteNumber || null,
                    journalId: original.journalId || null, journalNumber: original.journalNumber || null,
                    sourceId: invoiceKey, idempotencyKey
                };
            }
            throw e;
        }
    };
}
