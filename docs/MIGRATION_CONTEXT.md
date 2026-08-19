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

CURRENT_PHASE:            4 (Golden Master) — IN_PROGRESS
LAST_COMPLETED_PHASE:     1 (Safety + Baseline)
NEXT_PHASE:               4 (continuation) → then 5 (Application Services)

PHASE_0_AUDIT:            COMPLETE
PHASE_1_BASELINE:         COMPLETE
PHASE_2_DOMAIN:           IN_PROGRESS  (chartOfAccounts only)
PHASE_3_REPOSITORY:       IN_PROGRESS  (chartOfAccounts only)
PHASE_4_GOLDEN_MASTER:    IN_PROGRESS  (journal construction + posting integrity)
PHASE_5_SERVICES:         NOT_STARTED
PHASE_6_REACT:            NOT_STARTED
PHASE_7_MODULES:          NOT_STARTED

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

GOLDEN_MASTER:            tests/golden-master/ · 5 snapshots
                          COVERED: purchase inv · sales inv · payment · receipt vouchers
                                   invariants · VAT (0/15/exempt) · currency · tenant · audit
                          NOT_COVERED: general ledger · trial balance ·
                                       customer/supplier balances · credit/debit notes ·
                                       PMC · manual journal · cross-module flow

TEST_STATUS:
  migration-path:         228 passing (44 char + 9 date + 72 repo + 74 gm + 29 posting)
  existing-system:        846 passing / 5 failing
  test:rules:             310 pass / 5 FAIL  ← pre-existing, project-portal, FAIL-CLOSED
  lint:                   CLEAN

IMPORTANT_RISKS:
  P0  no server-side backup (dailyBackup undeployed — Spark plan)
  P0  posting is 4 non-atomic writes → orphan journal on partial failure
  P0  no idempotency → double-click creates 2 journals → possible double payment
  P0  journal balance guarded on header only (RTDB cannot sum arrays)
  P1  general ledger / trial balance have NO safety net yet
  P1  project portal broken in production (rules never written) — fail-closed, not a hole
  P2  domain+repo not wired to production (2 copies of logic; drift-detected by tests)
  P2  iCloud conflict files inside repo (13 files, .agents/skills only)

KNOWN_BUGS:               BUGS_TO_FIX.md (BUG-001..004) — NONE FIXED (intentional)
PRODUCTION_ISSUES:        PRODUCTION_ISSUES.md (PROD-001 P1 · PROD-002 P0)

KEY_RULE:                 Legacy = behavioral source of truth, NOT accounting correctness.
                          Detect → Document → Assess → Approve → Test → Fix. Never fix to
                          make a test pass.

RESUME_FROM:              Phase 4 continuation — capture calcFSBalances, then general
                          ledger → trial balance → party balances.
DO_NOT:                   push main · deploy · change schema/rules · start React ·
                          start Postgres/Oracle · fix legacy bugs during capture
```

## أوامر التحقّق السريع

```bash
npm run test:domain    # 125 — النطاق والمستودعات
npm run test:gm:all    # 103 — Golden Master
npm run lint           # نظيف
```
