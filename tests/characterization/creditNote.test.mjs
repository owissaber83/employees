// [Phase 7-D] مُشغِّل رفيع — الجسم المشترك في noteCharSuites.mjs.
import { runNoteCharSuite } from './noteCharSuites.mjs';
process.exit(await runNoteCharSuite('credit') ? 1 : 0);
