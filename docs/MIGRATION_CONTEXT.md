# MIGRATION_CONTEXT — ملخّص آلي القراءة

> اقرأ هذا أولاً. للتفاصيل: `docs/HANDOFF.md`.

```
PROJECT:                  ERP Accounting System (نظام حساب الأستاذ — GBR) · عربي RTL
CURRENT_BACKEND:          Firebase Realtime Database (Spark plan)
REPO:                     github.com/owissaber83/employees

CURRENT_BRANCH:           feat/ai-invoice-system-v2
CURRENT_COMMIT:           this commit itself (parent: 69f3a03, Phase 5) — run `git log -1 --oneline`;
                          not hardcoded here for the same self-reference reason 9cd3e07 went stale
                          for Phase 4 (this file is part of the commit it describes)
BASELINE_TAG:             migration/baseline
REMOTE_SYNCED:            YES

CURRENT_PHASE:            6 (Application Services — atomic posting + idempotency) — COMPLETE for purchase-invoice path
LAST_COMPLETED_PHASE:     6 (postPurchaseInvoice: domain + repository + service, NOT wired to production)
NEXT_PHASE:               owner decision — see "Recommendation" in PHASE_6_STOP_REPORT (extend to sales invoice/vouchers, OR controlled UI integration, OR Phase 7 React)

PHASE_0_AUDIT:            COMPLETE
PHASE_1_BASELINE:         COMPLETE
PHASE_2_DOMAIN:           IN_PROGRESS  (chartOfAccounts + pure purchase-invoice journal builder)
PHASE_3_REPOSITORY:       IN_PROGRESS  (chartOfAccounts + JournalPostingRepository)
PHASE_4_GOLDEN_MASTER:    COMPLETE  (journal construction + posting integrity — 103 assertions)
PHASE_5_GOLDEN_MASTER_BAL: COMPLETE  (ledger, trial balance, party balances, multi-tenant, dates, precision, idempotency, failure-injection, mutation, perf — 98 assertions)
PHASE_6_SERVICES:         COMPLETE for purchase-invoice posting only (98 new assertions) — NOT wired to production UI
PHASE_7_REACT:            NOT_STARTED
PHASE_8_MODULES:          NOT_STARTED

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
                          PATTERN: UI → Service (no Firebase/DOM/React) → Domain (pure) →
                                   JournalPostingRepository contract → Firebase/InMemory impl
                          IDEMPOTENCY: no new schema/collection — reuses existing invoice
                                       `status` field via runTransaction (draft→posted claim)
                          ATOMICITY: single multi-path update() through existing scopeUpdates()
                                     mechanism — no manual scopeUpdates() call, window.update
                                     already applies it internally
                          SCOPE: purchase invoice posting ONLY — sales/vouchers/notes/PMC share
                                 the identical architecture but are NOT implemented (see
                                 docs/services/posting.md "recommendation for Phase 7")
                          WIRED_TO_PRODUCTION: NO — parallel code, legacy postPInv untouched

TEST_STATUS:
  migration-path:         424 passing (44 char + 9 date + 72 repo + 6 char-vendor + 26 char-pinv
                           + 74 gm + 29 posting + 98 gm-balances + 66 svc)
  existing-system:        846 passing / 5 failing  ← unchanged, Phase 6 touches no public/ file
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
  P0  [Phase 5] BUG-005: tbCalcBalances vs calcFSBalances diverge — untouched in Phase 6.
  P0  [Phase 5] BUG-006: ensureStdAccount not idempotent — untouched; purchase-invoice service
      simply doesn't call it (createJournalForPInv never did either), so unaffected not fixed.
  P1  [Phase 6] NEW, documented limitation: under true concurrency, the "losing" duplicate
      request may read the invoice before the "winning" request finishes writing
      journalEntryKey. Mitigated with bounded retry (5×15ms); beyond that window the loser
      gets alreadyPosted:true but journalId:null (no duplicate write occurs either way).
      See docs/services/idempotency.md.
  P1  project portal broken in production (rules never written) — fail-closed, not a hole
  P1  [Phase 5] no periodic consistency check exists → BUG-005/006/007 undetectable in prod
  P2  domain+repo not wired to production (2 copies of logic; drift-detected by tests)
  P2  iCloud conflict files inside repo (13 files, .agents/skills only)

KNOWN_BUGS:               BUGS_TO_FIX.md (BUG-001..007) — NONE FIXED ON THE LIVE PATH (intentional,
                          per §15 "no production connection yet")
PRODUCTION_ISSUES:        PRODUCTION_ISSUES.md (PROD-001 P1 · PROD-002 P0)

KEY_RULE:                 Legacy = behavioral source of truth, NOT accounting correctness.
                          Detect → Document → Assess → Approve → Test → Fix. Never fix to
                          make a test pass.

RESUME_FROM:              Owner decision pending between: (a) extend the new service pattern to
                          sales invoice (crosses BUG-006/ensureStdAccount — needs its own
                          decision) and/or vouchers/credit-debit-notes/PMC, (b) controlled
                          production integration of the purchase-invoice service (separate
                          approval gate per the brief's own §29 "Gate 3" concept — NOT
                          automatic after this phase), or (c) start Phase 7 (React foundation).
                          No recommendation forced — see PHASE_6_STOP_REPORT §19.
DO_NOT:                   push main · deploy · change schema/rules · start React ·
                          start Postgres/Oracle · fix legacy bugs during capture ·
                          fix BUG-005/006/007 on the live path without owner approval (§6) ·
                          wire the new service to production UI without a separate approval
```

## أوامر التحقّق السريع

```bash
npm run test:domain     # 157 — النطاق والمستودعات (+32 Phase 6)
npm run test:gm:all     # 201 — Golden Master (Phase 4: 103 + Phase 5: 98)
npm run test:svc:all    # 66  — خدمات التطبيق (Phase 6: الذرّية/Idempotency/التكامل/المستأجرين/الفشل)
npm run gm:perf         # خط أساس أداء الأرصدة (Phase 5) — تقرير أرقام
npm run svc:perf        # خط أساس أداء الترحيل (Phase 6) — تقرير أرقام
npm run lint            # نظيف
```
