# MIGRATION_CONTEXT — ملخّص آلي القراءة

> اقرأ هذا أولاً. للتفاصيل: `docs/HANDOFF.md`.

```
PROJECT:                  ERP Accounting System (نظام حساب الأستاذ — GBR) · عربي RTL
CURRENT_BACKEND:          Firebase Realtime Database (Spark plan)
REPO:                     github.com/owissaber83/employees

CURRENT_BRANCH:           feat/ai-invoice-system-v2
CURRENT_COMMIT:           9cd3e07
BASELINE_TAG:             migration/baseline
REMOTE_SYNCED:            YES

CURRENT_PHASE:            5 (Golden Master — balances) — COMPLETE
LAST_COMPLETED_PHASE:     5 (Golden Master — ledger/trial-balance/party balances)
NEXT_PHASE:               6 (Application Services) OR 5-extended (credit/debit notes, PMC, manual journal) — OWNER DECISION PENDING

PHASE_0_AUDIT:            COMPLETE
PHASE_1_BASELINE:         COMPLETE
PHASE_2_DOMAIN:           IN_PROGRESS  (chartOfAccounts only)
PHASE_3_REPOSITORY:       IN_PROGRESS  (chartOfAccounts only)
PHASE_4_GOLDEN_MASTER:    COMPLETE  (journal construction + posting integrity — 103 assertions)
PHASE_5_GOLDEN_MASTER_BAL: COMPLETE  (ledger, trial balance, party balances, multi-tenant, dates, precision, idempotency, failure-injection, mutation, perf — 98 assertions)
PHASE_6_SERVICES:         NOT_STARTED
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

TEST_STATUS:
  migration-path:         326 passing (44 char + 9 date + 72 repo + 74 gm + 29 posting + 98 gm-balances)
  existing-system:        846 passing / 5 failing  ← unchanged, Phase 5 touches no public/ file
  test:rules:             310 pass / 5 FAIL  ← pre-existing, project-portal, FAIL-CLOSED
  lint:                   CLEAN

IMPORTANT_RISKS:
  P0  no server-side backup (dailyBackup undeployed — Spark plan)
  P0  posting is 4 non-atomic writes → orphan journal on partial failure
  P0  no idempotency → double-click creates 2 journals → possible double payment
  P0  journal balance guarded on header only (RTDB cannot sum arrays)
  P0  [Phase 5] BUG-007: duplicate journal inflates trial balance silently while party-balance
      screen (invoice-derived) stays correct — the two most-checked screens disagree, no alert
  P0  [Phase 5] BUG-005: tbCalcBalances vs calcFSBalances diverge on unflagged pre-period entries
  P0  [Phase 5] BUG-006: ensureStdAccount not idempotent under real concurrency
  P1  project portal broken in production (rules never written) — fail-closed, not a hole
  P1  [Phase 5] no periodic consistency check exists → BUG-005/006/007 undetectable in prod
  P2  domain+repo not wired to production (2 copies of logic; drift-detected by tests)
  P2  iCloud conflict files inside repo (13 files, .agents/skills only)

KNOWN_BUGS:               BUGS_TO_FIX.md (BUG-001..007) — NONE FIXED (intentional)
PRODUCTION_ISSUES:        PRODUCTION_ISSUES.md (PROD-001 P1 · PROD-002 P0)

KEY_RULE:                 Legacy = behavioral source of truth, NOT accounting correctness.
                          Detect → Document → Assess → Approve → Test → Fix. Never fix to
                          make a test pass.

RESUME_FROM:              Owner decision pending between: (a) extend Golden Master
                          (credit/debit notes, PMC, manual journal, full single-doc
                          flow) or (b) start Application Services (atomicity +
                          assertBalanced + idempotency fix — now has a much wider
                          safety net to verify against: ledger + trial balance +
                          party balances, not just the journal write). Recommendation:
                          (b) — BUG-005/006/007 all stem from the Phase 4 atomicity/
                          idempotency gap; fixing it closes all three at once.
DO_NOT:                   push main · deploy · change schema/rules · start React ·
                          start Postgres/Oracle · fix legacy bugs during capture ·
                          fix BUG-005/006/007 without owner approval (§6)
```

## أوامر التحقّق السريع

```bash
npm run test:domain     # 125 — النطاق والمستودعات
npm run test:gm:all     # 201 — Golden Master (Phase 4: 103 + Phase 5: 98)
npm run gm:perf         # خط أساس الأداء — تقرير أرقام
npm run lint            # نظيف
```
