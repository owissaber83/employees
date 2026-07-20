# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"نظام حساب الأستاذ — GBR": an Arabic (RTL) ERP web app for GBR Contracting covering accounting, HR/payroll, projects, and procurement. It is a single-page app written in vanilla JS with **no framework, no build step, no bundler, no tests, and no linter** — the files in **`public/`** are served as-is by Firebase Hosting (`firebase.json` → `"public": "public"`). Editing a file in `public/` takes effect immediately on `firebase serve` (hard-refresh) or after `firebase deploy`.

> Note: there used to be a `build.sh` that copied `public/` → a minified `dist/` and Hosting served `dist/`. That was removed (July 2026) because edits to `public/` silently didn't reach the served app. There is now **no `dist/`, no minification, no build** — do not reintroduce them.

All UI text, comments, and section headers are in Arabic. The HTML root is `<html lang="ar" dir="rtl">` — keep new UI RTL-aware and in Arabic.

## Academy (`public/academy.html`) — the ONE build exception

A standalone React learning platform ("CFO Master Academy") lives at `public/academy.html`. Unlike the rest of the app, **it is precompiled — do NOT hand-edit `public/academy.html`.**

- **Source of truth:** `academy.src.html` (repo root, not served). Edit that, then rebuild: `cd scripts && npm install && node build-academy.mjs` (compiles JSX → `React.createElement` classic + inlines static Tailwind, stripping the in-browser Babel/Tailwind CDNs). Commit both `academy.src.html` and `public/academy.html`.
- **Ongoing task + full state/handoff:** see [`ACADEMY_HANDOFF.md`](ACADEMY_HANDOFF.md) (currently: enriching each course's lessons with professional content, course by course).

## Commands

```bash
firebase serve                    # run locally (serves public/) — hard-refresh the browser to see edits
firebase deploy --only hosting    # deploy public/ to live (project: emplyeeapp-1dc64) — same as: npm run deploy
firebase deploy --only database   # deploy database.rules.json
npm run test:rules                # security-rules test suite (emulator) — run before editing database.rules.json
./verify-features.sh              # grep-based sanity check of attendance features
```

Pushing to `main` also auto-deploys via GitHub Actions (`.github/workflows/firebase-hosting-merge.yml`) — it just checks out and deploys `public/` (no build). Note the workflow deploys **hosting only** — database rules are never deployed by CI, so deploy them manually after editing.

### Cloud Functions are NOT deployable (Spark plan) — deliberately unconfigured

`functions/index.js` exists (`dailyBackup`, `syncTenantClaim`, `adminSetUserPassword`, `adminUpdateUserEmail`) but the project is on the **free Spark plan**, and deploying functions requires Artifact Registry → billing (Blaze). The `functions` key was therefore **removed from `firebase.json`** so that a plain `firebase deploy` succeeds instead of failing with:

> `Billing account for project '812714832536' is not open. Billing must be enabled for activation of service(s) 'artifactregistry.googleapis.com'`

**Do not re-add the `functions` key** unless the project is upgraded to Blaze — it only reintroduces that failure. To restore it after upgrading, put back:

```json
"functions": { "source": "functions" },
```

Consequences while on Spark (all handled, no silent breakage):
- **Admin password/email change** in the users page calls the undeployed callables and fails. Use `functions/admin-user.js` instead — a **local** Admin-SDK CLI that works on Spark (`find` / `set-password` / `set-email` / `list`; needs a service-account key at `~/.gbr/serviceAccountKey.json`, kept outside the repo). It syncs email across Auth + `ledger/users` + `userIndex`, so prefer it over editing email in the Firebase Console (which updates Auth only and desyncs the app).
- **`dailyBackup` never runs.** The in-app fallback (`downloadLocalBackup`) covers it, but only downloads a file when an **admin opens the app** on a given day — it is not a server-side scheduled backup.
- **Storage is disabled** (also Blaze), so document features store external URLs.

## Architecture

Everything lives in `public/` as a handful of very large files:

- **`index.html`** (~6,700 lines) — ALL page markup for the entire app. There are ~51 page sections, each a `<div class="pg" id="pg-<name>">`. Navigation (`nav()` in app.js) just toggles the `act` class; nothing is routed or lazy-loaded.
- **`app.js`** (~23,000 lines) — the core, loaded as an ES module. Initializes Firebase (Auth + Realtime Database), holds shared state, permissions, navigation, and the main modules (dashboard, suppliers, HR, payroll, projects, procurement).
- **`accounting.js`**, **`project-detail.js`**, **`help.js`**, **`analytics.js`** — secondary modules loaded as classic `defer` scripts *after* app.js. They are NOT modules: they rely entirely on globals that app.js attaches to `window` (≈400 of them: `db`, `ref`, `R`, `$`, `toast`, `fmt`, `cf2`, `ov`, `cov`, `can`, `curU`, shared data like `window.projects`, `window.emp`, …). Anything a secondary file needs from app.js must be explicitly exposed on `window`.
- **`styles.css`** — all styling.

### Navigating the big files

`app.js` and `accounting.js` start with a table of contents using bracketed section codes — `[HR3]` Loans, `[PR5]` Material Requests, `[ACC-FS]` Financial Statements, etc. Search for the code (e.g. `[HR4]`) to jump to a section. Use these TOCs instead of scanning; update the TOC when adding a section.

### Data layer

- Firebase **Realtime Database** (not Firestore). All data lives under `ledger/*`; every ref is declared once in the `R` object near the top of `app.js` (`R.emp`, `R.tr`, `R.pay`, …). Add new collections there.
- Realtime `onValue` listeners populate shared in-memory state, and render functions re-read that state — there is no state library.
- Firebase **Storage is disabled** (requires Blaze plan) — document features store external URLs instead of uploads. The commented-out Storage import in app.js documents this.
- `dataconnect/` is unused Firebase Data Connect scaffolding; the app does not use it.

### Cache busting

Script tags in `index.html` carry version query strings (`app.js?v=20260610-8`). When you edit a JS file, bump its `?v=` in `index.html`.

## Conventions and cautions

- Before adding a feature, card, or report, **search for an existing equivalent first** — the codebase is large and many features already exist under a section code; the user prefers being pointed to existing functionality over duplicates.
- Discuss proposed changes and get confirmation before implementing them.
- ID naming is terse and prefixed per module (e.g. attendance uses `at*`: `atSearchEmp`, `atSummaryBox`); follow the local prefix when adding elements.
- The root-level docs (`ATTENDANCE_API.md`, `IMPLEMENTATION_SUMMARY.md`, `PROJECT_COMPLETE.md`, etc.) are historical status reports from past sessions, not maintained documentation — don't treat them as current.
- `.code-split-metadata.json` and `*.part` references relate to a past file-splitting operation; ignore them.
