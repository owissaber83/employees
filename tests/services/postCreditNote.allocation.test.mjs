// [Phase 7-D] مُشغِّل رفيع — الجسم المشترك في noteSuites.mjs، والمسار يُشغَّل بمجموعاته وحقوله الحقيقية.
import { runAllocationSuite } from './noteSuites.mjs';
process.exit(await runAllocationSuite('credit') ? 1 : 0);
