// [Phase 7-D] مُشغِّل رفيع — الجسم المشترك في noteSuites.mjs، والمسار يُشغَّل بمجموعاته وحقوله الحقيقية.
import { runIdempotencySuite } from './noteSuites.mjs';
process.exit(await runIdempotencySuite('credit') ? 1 : 0);
