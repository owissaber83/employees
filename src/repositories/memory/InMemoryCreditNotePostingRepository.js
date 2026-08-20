// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ الإشعار الدائن في الذاكرة — إثبات محايدة العقد               [Phase 7-D] ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { CreditNotePostingRepository } from '../contracts/CreditNotePostingRepository.js';
import { InMemoryNotePostingEngine, MEM_CREDIT_CONFIG } from './notePostingMemoryBase.js';

export class InMemoryCreditNotePostingRepository extends CreditNotePostingRepository {
    /** @param {{notes:object, invoices:object, journals:object, movements:object, counters:object}} seed */
    constructor(seed = {}) {
        super();
        this._engine = new InMemoryNotePostingEngine(seed, MEM_CREDIT_CONFIG);
    }
    get store() { return this._engine.store; }
    set forceAtomicWriteFailure(v) { this._engine.forceAtomicWriteFailure = v; }
    get forceAtomicWriteFailure() { return this._engine.forceAtomicWriteFailure; }
    set forceNumberReservationFailure(v) { this._engine.forceNumberReservationFailure = v; }
    async postCreditNoteAtomic(p) { return this._engine.post(p); }
}
