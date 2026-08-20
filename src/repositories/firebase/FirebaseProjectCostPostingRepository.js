// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ ترحيل تكلفة المشروع على Firebase RTDB                        [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  لا مسار جديد ولا حقل جديد — كلاهما منقول من accounting.js:                     ║
// ║    ledger/projectMonthlyCosts/{k}/journalEntryKey  ← موجود (:10283)             ║
// ║    ledger/journalEntries/{k} · ledger/counters/jrn/JV/{year}  ← موجودة          ║
// ║                                                                              ║
// ║  الفارق عن القديم (C): القديم `push` القيد ثم `update` الربط — كتابتان           ║
// ║  منفصلتان بلا مطالبة، فنداءان متزامنان يُنتجان قيدين على نفس التكلفة. هنا        ║
// ║  مطالبة خادمية ثم كتابة ذرّية واحدة.                                           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { ProjectCostPostingRepository } from '../contracts/ProjectCostPostingRepository.js';
import { RepositoryError, REPO_ERRORS, translateRtdbError } from '../contracts/errors.js';
import { AtomicityError } from '../../services/accounting/errors/AtomicityError.js';
import { DuplicatePostingError } from '../../services/accounting/errors/DuplicatePostingError.js';
import { reserveJournalNumber } from './postingHelpers.js';

const PMC_PATH = 'ledger/projectMonthlyCosts';
const JOURNALS_PATH = 'ledger/journalEntries';
const CLAIM = '__claiming__';

export class FirebaseProjectCostPostingRepository extends ProjectCostPostingRepository {
    constructor(port) {
        super();
        if (!port) throw new RepositoryError(REPO_ERRORS.UNAVAILABLE, 'منفذ RTDB مطلوب');
        this._p = port;
    }
    _ref(path) { return this._p.ref(this._p.db, path); }

    async postProjectCostAtomic({ pmcKey, buildJournal, journalBookPrefix = 'JV' }) {
        if (!pmcKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح التكلفة مطلوب');
        const linkPath = `${PMC_PATH}/${pmcKey}/journalEntryKey`;

        // ── 1. مطالبة على حقل الربط الموجود ──────────────────────────────────
        let claim;
        try {
            claim = await this._p.runTransaction(this._ref(linkPath),
                current => (current == null ? CLAIM : undefined));
        } catch (e) { throw translateRtdbError(e); }

        if (!claim || !claim.committed) {
            let existing = null;
            try {
                const snap = await this._p.get(this._ref(`${PMC_PATH}/${pmcKey}`));
                existing = snap && snap.exists() ? snap.val() : null;
            } catch (e) { /* أفضل جهد */ }
            const jk = existing && existing.journalEntryKey;
            throw new DuplicatePostingError(
                jk && jk !== CLAIM ? 'التكلفة مُرحَّلة بالفعل' : 'التكلفة مُطالَب بها — ترحيل متزامن جارٍ',
                { pmcKey, original: jk && jk !== CLAIM ? { journalId: jk, journalNumber: existing.journalEntryNumber || null } : null }
            );
        }

        try {
            const journalNumber = await reserveJournalNumber(this._p, journalBookPrefix);
            const { journal } = buildJournal(journalNumber);
            const journalId = this._p.push(this._ref(JOURNALS_PATH)).key;

            const updates = {
                [`${JOURNALS_PATH}/${journalId}`]: journal,
                [linkPath]: journalId
            };
            try {
                await this._p.update(this._ref('/'), updates);
            } catch (e) {
                await this._release(linkPath);
                throw new AtomicityError('فشلت الكتابة الذرّية لقيد تكلفة المشروع — لا قيد ولا ربط',
                    { pmcKey, journalId, journalNumber, cause: e && e.message });
            }
            return { journalId, journalNumber, alreadyPosted: false };
        } catch (e) {
            if (e instanceof AtomicityError) throw e;
            await this._release(linkPath);
            throw e;
        }
    }

    /** تحرير المطالبة — أفضل جهد؛ الخطأ الأصلي هو ما يُبلَّغ. */
    async _release(linkPath) {
        try {
            await this._p.runTransaction(this._ref(linkPath),
                current => (current === CLAIM ? null : undefined));
        } catch (e) { /* أفضل جهد فقط */ }
    }
}
