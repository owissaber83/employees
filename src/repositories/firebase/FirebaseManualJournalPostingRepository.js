// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ القيد اليدوي على Firebase RTDB                               [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مسار واحد فقط: `ledger/journalEntries/{key}` + عدّاد الدفتر القائم.            ║
// ║  لا حقل جديد ولا مجموعة جديدة.                                                ║
// ║                                                                              ║
// ║  الفارق عن القديم (C): `saveJrnEntry` تحجز الرقم ثم `push` القيد — بلا مرساة     ║
// ║  هوية، فالنقر المزدوج يُنتج قيدين برقمين مختلفين. هنا المفتاح يولّده المستدعي     ║
// ║  ويُطالَب به خادمياً، فالتكرار بنفس المفتاح لا يُنتج قيداً ثانياً.                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { ManualJournalPostingRepository } from '../contracts/ManualJournalPostingRepository.js';
import { RepositoryError, REPO_ERRORS, translateRtdbError } from '../contracts/errors.js';
import { AtomicityError } from '../../services/accounting/errors/AtomicityError.js';
import { DuplicatePostingError } from '../../services/accounting/errors/DuplicatePostingError.js';
import { reserveJournalNumber } from './postingHelpers.js';

const JOURNALS_PATH = 'ledger/journalEntries';
const CLAIM = '__claiming__';

export class FirebaseManualJournalPostingRepository extends ManualJournalPostingRepository {
    constructor(port) {
        super();
        if (!port) throw new RepositoryError(REPO_ERRORS.UNAVAILABLE, 'منفذ RTDB مطلوب');
        this._p = port;
    }
    _ref(path) { return this._p.ref(this._p.db, path); }

    async postManualJournalAtomic({ journalKey, buildJournal, journalBookPrefix = 'JV' }) {
        if (!journalKey) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح القيد مطلوب');
        const entryPath = `${JOURNALS_PATH}/${journalKey}`;

        let claim;
        try {
            claim = await this._p.runTransaction(this._ref(`${entryPath}/status`),
                current => (current == null ? CLAIM : undefined));
        } catch (e) { throw translateRtdbError(e); }

        if (!claim || !claim.committed) {
            let existing = null;
            try {
                const snap = await this._p.get(this._ref(entryPath));
                existing = snap && snap.exists() ? snap.val() : null;
            } catch (e) { /* أفضل جهد */ }
            const settled = existing && existing.status && existing.status !== CLAIM;
            throw new DuplicatePostingError(
                settled ? 'القيد مُسجَّل بالفعل' : 'القيد مُطالَب به — تسجيل متزامن جارٍ',
                { journalKey, original: settled ? { journalId: journalKey, journalNumber: existing.number || null } : null }
            );
        }

        try {
            const journalNumber = await reserveJournalNumber(this._p, journalBookPrefix);
            const { journal } = buildJournal(journalNumber);
            try {
                await this._p.update(this._ref('/'), { [entryPath]: journal });
            } catch (e) {
                await this._release(entryPath);
                throw new AtomicityError('فشلت الكتابة الذرّية للقيد اليدوي — لا قيد كُتب',
                    { journalKey, journalNumber, cause: e && e.message });
            }
            return { journalId: journalKey, journalNumber, alreadyPosted: false };
        } catch (e) {
            if (e instanceof AtomicityError) throw e;
            await this._release(entryPath);
            throw e;
        }
    }

    async _release(entryPath) {
        try { await this._p.remove(this._ref(entryPath)); }
        catch (e) { /* أفضل جهد فقط */ }
    }
}
