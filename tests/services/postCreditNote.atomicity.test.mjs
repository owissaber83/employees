// [Phase 7-D] مُشغِّل رفيع — الجسم المشترك في noteSuites.mjs، والمسار يُشغَّل بمجموعاته وحقوله الحقيقية.
import { runAtomicitySuite } from './noteSuites.mjs';
process.exit(await runAtomicitySuite('credit') ? 1 : 0);
