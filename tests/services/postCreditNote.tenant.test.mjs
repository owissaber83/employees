// [Phase 7-D] مُشغِّل رفيع — الجسم المشترك في noteSuites.mjs، والمسار يُشغَّل بمجموعاته وحقوله الحقيقية.
import { runTenantSuite } from './noteSuites.mjs';
process.exit(await runTenantSuite('credit') ? 1 : 0);
