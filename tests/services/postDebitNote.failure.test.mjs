// [Phase 7-D] مُشغِّل رفيع — الجسم المشترك في noteSuites.mjs، والمسار يُشغَّل بمجموعاته وحقوله الحقيقية.
import { runFailureSuite } from './noteSuites.mjs';
process.exit(await runFailureSuite('debit') ? 1 : 0);
