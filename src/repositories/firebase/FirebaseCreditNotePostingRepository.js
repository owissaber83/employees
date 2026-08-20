// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ ترحيل الإشعار الدائن على Firebase RTDB                       [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  غلاف رفيع فوق `NotePostingEngine` بإعدادات الإشعار الدائن. الآلية موثَّقة        ║
// ║  بالكامل في notePostingBase.js، والعقد في contracts/CreditNotePostingRepository.js. ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { CreditNotePostingRepository } from '../contracts/CreditNotePostingRepository.js';
import { NotePostingEngine, CREDIT_NOTE_CONFIG } from './notePostingBase.js';

export class FirebaseCreditNotePostingRepository extends CreditNotePostingRepository {
    constructor(port) {
        super();
        this._engine = new NotePostingEngine(port, CREDIT_NOTE_CONFIG);
    }
    async postCreditNoteAtomic(p) { return this._engine.post(p); }
}
