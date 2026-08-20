// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ الإشعار المدين في الذاكرة — إثبات محايدة العقد               [Phase 7-D] ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { DebitNotePostingRepository } from '../contracts/DebitNotePostingRepository.js';
import { InMemoryNotePostingEngine, MEM_DEBIT_CONFIG } from './notePostingMemoryBase.js';

export class InMemoryDebitNotePostingRepository extends DebitNotePostingRepository {
    /** @param {{notes:object, invoices:object, journals:object, movements:object, counters:object}} seed */
    constructor(seed = {}) {
        super();
        this._engine = new InMemoryNotePostingEngine(seed, MEM_DEBIT_CONFIG);
    }
    get store() { return this._engine.store; }
    set forceAtomicWriteFailure(v) { this._engine.forceAtomicWriteFailure = v; }
    get forceAtomicWriteFailure() { return this._engine.forceAtomicWriteFailure; }
    set forceNumberReservationFailure(v) { this._engine.forceNumberReservationFailure = v; }
    async postDebitNoteAtomic(p) { return this._engine.post(p); }
}
