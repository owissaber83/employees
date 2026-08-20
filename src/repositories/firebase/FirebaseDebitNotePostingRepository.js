// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ ترحيل الإشعار المدين على Firebase RTDB                       [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  غلاف رفيع فوق `NotePostingEngine` بإعدادات الإشعار المدين — مجموعات وحقول      ║
// ║  واتجاه مخزون مختلفة تماماً عن الدائن (انظر DEBIT_NOTE_CONFIG).                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { DebitNotePostingRepository } from '../contracts/DebitNotePostingRepository.js';
import { NotePostingEngine, DEBIT_NOTE_CONFIG } from './notePostingBase.js';

export class FirebaseDebitNotePostingRepository extends DebitNotePostingRepository {
    constructor(port) {
        super();
        this._engine = new NotePostingEngine(port, DEBIT_NOTE_CONFIG);
    }
    async postDebitNoteAtomic(p) { return this._engine.post(p); }
}
