# MIGRATION_CONTEXT — ملخّص آلي القراءة

> اقرأ هذا أولاً. للتفاصيل: `docs/HANDOFF.md`.

```
PROJECT:                  ERP Accounting System (نظام حساب الأستاذ — GBR) · عربي RTL
CURRENT_BACKEND:          Firebase Realtime Database (Spark plan)
REPO:                     github.com/owissaber83/employees

CURRENT_BRANCH:           feat/ai-invoice-system-v2
CURRENT_COMMIT:           this commit itself (parent: Phase 6 commit 15f8054) — run `git log -1 --oneline`;
                          not hardcoded here for the same self-reference reason 9cd3e07 went stale
                          for Phase 4 (this file is part of the commit it describes)
BASELINE_TAG:             migration/baseline
REMOTE_SYNCED:            YES

CURRENT_PHASE:            7-B (Application Services — voucher posting: atomic allocation + idempotency) — COMPLETE for receipt/payment voucher path
LAST_COMPLETED_PHASE:     7-B (postVoucher: domain + repository + service, NOT wired to production)
NEXT_PHASE:               owner decision — see "Recommended Step C" in PHASE_7_STEP_B_STOP_REPORT (extend to sales invoice, OR credit/debit notes, OR controlled UI integration, OR Phase 8 React)

PHASE_0_AUDIT:            COMPLETE
PHASE_1_BASELINE:         COMPLETE
PHASE_2_DOMAIN:           IN_PROGRESS  (chartOfAccounts + pure purchase-invoice + voucher journal builders + allocation logic)
PHASE_3_REPOSITORY:       IN_PROGRESS  (chartOfAccounts + JournalPostingRepository + VoucherPostingRepository)
PHASE_4_GOLDEN_MASTER:    COMPLETE  (journal construction + posting integrity — 103 assertions)
PHASE_5_GOLDEN_MASTER_BAL: COMPLETE  (ledger, trial balance, party balances, multi-tenant, dates, precision, idempotency, failure-injection, mutation, perf — 98 assertions)
PHASE_6_SERVICES:         COMPLETE for purchase-invoice posting only (98 new assertions) — NOT wired to production UI
PHASE_7_A_DISCOVERY:      COMPLETE (report only, no code — prioritized remaining posting paths)
PHASE_7_B_VOUCHER:        COMPLETE for receipt/payment voucher posting + N-invoice allocation (153 new assertions) — NOT wired to production UI
PHASE_8_REACT:            NOT_STARTED
PHASE_9_MODULES:          NOT_STARTED

NOTE_NUMBERING:           MIGRATION_PLAN.md numbers "Application Services"=4 and
                          "Golden Master"=5 (swapped by owner 2026-08-19). This file
                          and docs/HANDOFF.md use the ACTUAL sequence as executed
                          (0..1..2..3..4=GM-journals..5=GM-balances..6=services..).
                          Names, not numbers, are the reliable reference.

REACT_MIGRATION:          NOT_STARTED
DATABASE_MIGRATION:       NOT_STARTED
POSTGRESQL:               NOT_IMPLEMENTED
ORACLE:                   NOT_IMPLEMENTED

PRODUCTION_CHANGED:       NO
PRODUCTION_DEPLOYED:      NO
SCHEMA_CHANGED:           NO
FIREBASE_RULES_CHANGED:   NO
FIELD_NAMES_CHANGED:      NO
DUAL_WRITE:               NO
ACCOUNTING_BEHAVIOR:      UNCHANGED
MAIN_BRANCH_PUSHED:       NO (4 local commits, intentionally unpushed)

DOMAIN_LAYER:             src/domain/accounting/chartOfAccounts/ (types·hierarchy·validation)
                          PURE: no DOM · no window · no Firebase · no React
                          WIRED_TO_PRODUCTION: NO (needs build step — Phase 6)

REPOSITORY_LAYER:         src/repositories/{contracts,firebase,memory}
                          PATTERN: dependency injection (NEVER imports Firebase)
                          REASON: tenant isolation lives in app.js ref() wrapper
                          WIRED_TO_PRODUCTION: NO

GOLDEN_MASTER:            tests/golden-master/ · 7 snapshots (5 Phase4 + 2 Phase5)
                          COVERED: purchase inv · sales inv · payment · receipt vouchers ·
                                   invariants · VAT (0/15/exempt) · currency · tenant · audit ·
                                   general ledger (coaAccountOps) · trial balance
                                   (tbCalcBalances/calcFSBalances, incl. their divergence) ·
                                   customer/supplier balances · balances-cache tenant isolation ·
                                   date boundaries · precision · idempotency (report-level impact) ·
                                   failure injection (report-level impact) · mutation-kill proof ·
                                   perf baseline (100/1k/10k entries, linear)
                          NOT_COVERED: credit/debit notes · PMC · manual journal ·
                                       full single-document cross-module flow · project costs

APPLICATION_SERVICES:     src/services/accounting/posting/postPurchaseInvoice.js  [Phase 6]
                          src/services/accounting/posting/postVoucher.js  [Phase 7-B]
                          PATTERN: UI → Service (no Firebase/DOM/React) → Domain (pure) →
                                   JournalPostingRepository/VoucherPostingRepository contract →
                                   Firebase/InMemory impl
                          IDEMPOTENCY: no new schema/collection — reuses existing invoice/voucher
                                       `status` field via runTransaction (draft→posted claim).
                                       Shared helpers extracted Phase 7-B into
                                       src/repositories/firebase/postingHelpers.js (no behavior
                                       change to Phase 6 — re-verified: test:svc:all still 66/66)
                          ATOMICITY: purchase invoice: single multi-path update(). voucher:
                                     compensating-transaction (Saga) model — N independent
                                     per-invoice runTransaction (each concurrency-safe, rejects
                                     over-allocation) + one final atomic multi-path update();
                                     partial failure ⇒ explicit reverse-compensation of what
                                     succeeded. NOT true N+1-way atomicity — documented honestly
                                     as eventual (not immediate) consistency. See
                                     docs/services/voucher-atomicity.md
                          SCOPE: purchase invoice posting + receipt/payment voucher posting
                                 (incl. N-invoice allocation). Sales invoice/credit-debit
                                 notes/PMC/manual journal share the identical architecture but
                                 are NOT implemented (see docs/services/voucher-posting.md and
                                 PHASE_7_STEP_B_STOP_REPORT "Recommended Step C")
                          WIRED_TO_PRODUCTION: NO — parallel code, legacy postPInv/postVoucher/
                                 allocateToInvoices untouched

TEST_STATUS:
  migration-path:         ~682 passing (157 test:domain incl. +48 Phase7-B char + 72 repo
                           + 208 test:gm:all incl. +7 test:gm:voucher + 66 test:svc:all
                           + 98 test:svc:voucher:all) — run `npm run test:migration` for the
                           authoritative combined count; zero failures across every suite
  existing-system:        846 passing / 5 failing  ← unchanged, Phase 7-B touches no public/ file
  test:rules:             310 pass / 5 FAIL  ← pre-existing, project-portal, FAIL-CLOSED
  lint:                   CLEAN

IMPORTANT_RISKS:
  P0  no server-side backup (dailyBackup undeployed — Spark plan)
  P0  LEGACY postPInv is STILL 4 non-atomic writes → orphan journal on partial failure
      (unchanged — the new atomic service is parallel, unconnected code)
  P0  LEGACY postPInv is STILL not idempotent (same reason)
  P0  journal balance guarded on header only in database.rules.json (unchanged, by design —
      Phase 6 enforces this in the new service layer instead, not in rules)
  P0  [Phase 5] BUG-007: on the LIVE path this is unchanged. [Phase 6] proved the root cause
      (non-atomic/non-idempotent posting) is architecturally solvable — concurrent Promise.all
      test produces exactly one journal — but this fix lives in unconnected parallel code.
  P0  [Phase 5] BUG-005: tbCalcBalances vs calcFSBalances diverge — untouched in Phase 6/7-B.
  P0  [Phase 5] BUG-006: ensureStdAccount not idempotent — untouched; purchase-invoice/voucher
      services simply don't call it (legacy build functions never did either), so unaffected
      not fixed.
  P0  [Phase 7-B] NEW BUG-008: LEGACY allocateToInvoices accepts unlimited over-allocation on
      an invoice — zero validation, zero warning, even under a real concurrent race between two
      vouchers on the same invoice. Proven live with the real legacy function
      (tests/characterization/allocateToInvoices.test.mjs). UNCHANGED on the live path — the new
      parallel voucher service rejects it (AllocationConflictError, race-safe via per-invoice
      runTransaction) but that fix lives in unconnected code. See BUGS_TO_FIX.md BUG-008.
  P1  [Phase 6] NEW, documented limitation: under true concurrency, the "losing" duplicate
      request may read the invoice before the "winning" request finishes writing
      journalEntryKey. Mitigated with bounded retry (5×15ms); beyond that window the loser
      gets alreadyPosted:true but journalId:null (no duplicate write occurs either way).
      See docs/services/idempotency.md. Same limitation applies to the Phase 7-B voucher
      service (shared helper, same mitigation).
  P1  [Phase 7-B] Voucher compensating-transaction (Saga) model is eventual-consistency, not
      immediate: during a multi-invoice compensation sequence there is a short window where
      some invoices have been reverted and others not yet. Documented honestly, not hidden —
      see docs/services/voucher-atomicity.md "ما هذا لا يحلّه".
  P1  project portal broken in production (rules never written) — fail-closed, not a hole
  P1  [Phase 5] no periodic consistency check exists → BUG-005/006/007/008 undetectable in prod
  P2  domain+repo not wired to production (2 copies of logic; drift-detected by tests)
  P2  iCloud conflict files inside repo (13+ files, .agents/skills + a few root .md — never staged)

KNOWN_BUGS:               BUGS_TO_FIX.md (BUG-001..008) — NONE FIXED ON THE LIVE PATH (intentional,
                          per §15 "no production connection yet")
PRODUCTION_ISSUES:        PRODUCTION_ISSUES.md (PROD-001 P1 · PROD-002 P0)

KEY_RULE:                 Legacy = behavioral source of truth, NOT accounting correctness.
                          Detect → Document → Assess → Approve → Test → Fix. Never fix to
                          make a test pass.

RESUME_FROM:              Owner decision pending between: (a) extend the new service pattern to
                          sales invoice (crosses BUG-006/ensureStdAccount — needs its own
                          decision) and/or credit-debit-notes/PMC/manual journal, (b) controlled
                          production integration of the purchase-invoice/voucher services
                          (separate approval gate per the brief's own "Gate 3" concept — NOT
                          automatic after this phase), or (c) start Phase 8 (React foundation).
                          No recommendation forced — see PHASE_7_STEP_B_STOP_REPORT "Recommended
                          Step C".
DO_NOT:                   push main · deploy · change schema/rules · start React ·
                          start Postgres/Oracle · fix legacy bugs during capture ·
                          fix BUG-005/006/007/008 on the live path without owner approval (§6) ·
                          wire the new services to production UI without a separate approval
```

## أوامر التحقّق السريع

```bash
npm run test:domain          # 254 — النطاق والمستودعات (+32 P6 · +48 P7-B · +49 P7-C تقييم المخزون)
npm run test:gm:all          # 249 — Golden Master (P4: 103 + P5: 98 + P7-B: 7 + P7-C مبيعات: 41)
npm run test:svc:all         # 66  — خدمة المشتريات (P6: الذرّية/Idempotency/التكامل/المستأجرين/الفشل)
npm run test:svc:voucher:all # 98  — خدمة السند (P7-B: الذرّية/Idempotency/التخصيص/المستأجرين/الفشل)
npm run test:svc:sales       # 217 — خدمة المبيعات (P7-C: الذرّية/Idempotency/المخزون/المستأجرين/الفشل)
npm run test:phase7          # 153 — كل جديد Phase 7-B مجمَّعاً (توصيف + Golden Master + خدمة)
npm run test:phase7c         # 307 — كل جديد Phase 7-C مجمَّعاً (توصيف + Golden Master + خدمة)
npm run test:migration       # 884 — الكل مجمَّعاً: النطاق + Golden Master + الخدمات الثلاث
npm run gm:perf              # خط أساس أداء الأرصدة (Phase 5) — تقرير أرقام
npm run svc:perf             # خط أساس أداء ترحيل الفاتورة (Phase 6) — تقرير أرقام
npm run svc:voucher:perf     # خط أساس أداء ترحيل السند + N تخصيص (Phase 7-B) — تقرير أرقام
npm run svc:sales:perf       # خط أساس أداء ترحيل فاتورة المبيعات + N سطر (Phase 7-C) — تقرير أرقام
npm run lint                 # نظيف
```
