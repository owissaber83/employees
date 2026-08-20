// [Phase 7-D] مُشغِّل رفيع — الجسم المشترك في noteSuites.mjs، والمسار يُشغَّل بمجموعاته وحقوله الحقيقية.
import { runTenantSuite } from './noteSuites.mjs';
process.exit(await runTenantSuite('debit') ? 1 : 0);
