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
npm run test:calc                 # pure financial-calc tests (Node only)
npm run test:pdf                  # PDF-editor engine tests: bidi, content-stream surgery, autofit (Node only)
npm run test:ai                   # AI-invoice engine tests: arithmetic, ZATCA QR TLV, validation, duplicates (Node only)
npm run test:ai:page              # AI-invoice page + review screen render in real Chrome (skips if no Chrome)
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

### Professional PDF Editor (`pdfeditor-*.js`) — the one strictly layered module

Unlike the rest of the app, the PDF editor is split into four files that must load **in this order** (see `index.html`), plus `pdfeditor.css`. Page section: `<div class="pg" id="pg-pdfeditor">` (empty — the whole UI is built in JS).

| File | Namespace | Contains |
|---|---|---|
| `pdfeditor-engine.js` | `window.PDFE` | Everything non-DOM: lazy lib loader, Arabic bidi, parser, style intelligence, content-stream surgery, ops model, history, export, OCR, storage & audit adapters. **Never touches the DOM** — that is what makes it unit-testable (`npm run test:pdf`). |
| `pdfeditor-ui.js` | `window.PDE` | Shell, library screen, open flow, virtualized page rendering, overlay layer, thumbnails, zoom, autosave. |
| `pdfeditor-edit.js` | — | Selection/handles, text editing, objects, layers, style copy/paste, color picker, inspector panels. |
| `pdfeditor-io.js` | — | Search & replace, page management, merge/split, OCR run, signature/stamp/watermark/QR, export/validate, versions/compare, ERP linking, shortcuts. |

Each file starts with a bracketed TOC (`[PE-CS]`, `[UI-RENDER]`, `[ED-TEXT]`, `[IO-EXPORT]`) — same convention as app.js.

Two rules that are easy to break:
- **`PDFE.Engine` is a swappable interface** (`local` = pdf.js + pdf-lib, `apryse` = registered-but-unlicensed stub). UI code must call `PDFE.Engine.get()`, never pdf.js/pdf-lib directly, so a commercial engine can be dropped in later without touching the UI.
- **Text editing is content-stream surgery, not white-box overlay.** `PDFE.CS` decodes the page content stream and empties the Nth text-showing operator, so the original glyphs leave the file (§ real redaction). `PDFE.Export.buildSafe` re-parses the output and, if any text that should be gone is still extractable, rebuilds using the cover-and-redraw fallback. Do not "simplify" this into drawing a white rectangle.

### AI invoice extraction (`aiinvoice-*.js`) — three-layer module

"استخراج وتدقيق وتصدير الفواتير بالذكاء الاصطناعي": upload supplier invoices (PDF/image), an LLM extracts them, and **the system re-does every calculation in code** before anything reaches accounting. Page section: `<div class="pg" id="pg-aiinvoices">` (empty — built entirely in JS). Load order matters (see `index.html`), plus `aiinvoice.css`.

| File | Namespace | Contains |
|---|---|---|
| `aiinvoice-engine.js` | `window.AINV` | Everything non-DOM: settings, extraction schema/prompt, model calls, ZATCA QR TLV decode, normalization + provenance, arithmetic recomputation, validation engine, supplier/item matching, duplicate detection, accounting preview, RTDB store, quota, audit. **Never touches the DOM** — that is what makes it unit-testable (`npm run test:ai`). |
| `aiinvoice-ui.js` | `window.AIU` | Page, upload queue, review screen, provenance badges, document viewer. |
| `aiinvoice-actions.js` | — | Edit/link/override, approve/reject, conversion to purchase invoice, Excel/PDF/JSON exports, admin panels. |

Rules that are easy to break:
- **Status values must stay lowercase.** `database.rules.json` guards the literals `'approved'` and `'posted'` on `aiInvoices/$invId/status`. Switching to the spec's uppercase enum (`APPROVED`) silently disables that guard so any user with `ai_invoice_process` could approve. The rules also require every record to carry `status` and `uploadedAt`, and validate the child names `approvedBy` and `linkedPInvKey` — keep those exact names.
- **The model reads; the system computes.** `AINV.recompute`/`AINV.computeLine` re-derive every amount from qty × price − discount and compare against what the model returned. Never "trust" a model total.
- **`AINV.toPurchaseInvoice` must emit the fields `createJournalForPInv` actually reads** — `vendorId`, `netBeforeTax`, `debitAccountCode`, `projectId` — not similarly-named ones. A missing field here posts a journal with no vendor account or a zero debit, and it's only discovered after posting. `npm run test:ai` asserts these.
- Conversion creates a **draft** purchase invoice only. Posting stays a separate human action in the purchases page.

The React/Vite/Express original this was ported from lives at `ai-invoice-system.src/` (repo root, not served) as a specification reference — see its `PORTED.md`. It cannot run here: no build step, no server, Spark plan.

### Navigating the big files

`app.js` and `accounting.js` start with a table of contents using bracketed section codes — `[HR3]` Loans, `[PR5]` Material Requests, `[ACC-FS]` Financial Statements, etc. Search for the code (e.g. `[HR4]`) to jump to a section. Use these TOCs instead of scanning; update the TOC when adding a section.

### Data layer

- Firebase **Realtime Database** (not Firestore). All data lives under `ledger/*`; every ref is declared once in the `R` object near the top of `app.js` (`R.emp`, `R.tr`, `R.pay`, …). Add new collections there.
- Realtime `onValue` listeners populate shared in-memory state, and render functions re-read that state — there is no state library.
- Firebase **Storage is disabled** (requires Blaze plan) — document features store external URLs instead of uploads. The commented-out Storage import in app.js documents this. Binary uploads go to **Cloudinary** via `window.cloudinaryUpload` (unsigned preset configured in Settings → Integrations). The PDF editor wraps this in `PDFE.Storage`, which already has a `firebase` adapter registered for the day the project moves to Blaze — switch with `PDFE.Storage.use('firebase')`.
- `ledger/pdfVersions/*` and `ledger/pdfEdits/*` are **append-only in the security rules** (only `admin` may modify or delete an existing version, and only `_draft` is rewritable). This is what makes the version history audit-grade — don't relax it.
- `dataconnect/` is unused Firebase Data Connect scaffolding; the app does not use it.

### Cache busting

Script tags in `index.html` carry version query strings (`app.js?v=20260610-8`). When you edit a JS file, bump its `?v=` in `index.html`.

**Adding a module = wiring every asset.** There is no bundler to catch a missing file, and a missing `<link>` fails *silently and confusingly*: unstyled `.ai-modal`/`.pde-*` overlays lose `position:fixed` and get appended to the bottom of the page as ordinary content, so the button that opens them looks dead. When adding a module, link **the CSS too** (`<head>`, near the other module stylesheets), not just the scripts. `npm run test:ai:e2e` asserts all four `aiinvoice.*` assets are referenced with a `?v=`.

## Conventions and cautions

- Before adding a feature, card, or report, **search for an existing equivalent first** — the codebase is large and many features already exist under a section code; the user prefers being pointed to existing functionality over duplicates.
- Discuss proposed changes and get confirmation before implementing them.
- ID naming is terse and prefixed per module (e.g. attendance uses `at*`: `atSearchEmp`, `atSummaryBox`); follow the local prefix when adding elements.
- The root-level docs (`ATTENDANCE_API.md`, `IMPLEMENTATION_SUMMARY.md`, `PROJECT_COMPLETE.md`, etc.) are historical status reports from past sessions, not maintained documentation — don't treat them as current.
- `.code-split-metadata.json` and `*.part` references relate to a past file-splitting operation; ignore them.
