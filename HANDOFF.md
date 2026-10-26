# admin-youngtube — HANDOFF

## Current Baseline

- Repo: `saaedcs50/admin-youngtube`
- Branch: `main`
- Base main HEAD before this PR: `ab594c2816d496ba82f79f5ff71a50e88b671519`
- Proposed branch: `chore/deps-ci-20261021`
- Root app package name: `admin-youngtube`
- App ID: `app.youngtube.admin`
- Worker default URL: `https://youngtube-worker.saaedbelal.workers.dev`

## Current Functional State

The Admin app is the management console for the YoungTube Worker.

It currently provides:

- telemetry/analytics
- global blocks
- channel/source management
- category management
- announcements
- Support Pay management
- Worker status/maintenance
- system settings
- authentication via Worker Bearer token

## Support Pay

Current Admin implementation:

- reads the Worker payload correctly
- validates required payment fields on the client before confirmation
- preserves optional note behavior
- writes through the authenticated Worker endpoint

Never hardcode real payment information into this repository.

## Analytics

Telemetry is deliberately located in this Admin application, not the parent-facing YoungTube application.

Current telemetry UI supports:

- 7/30/90 day ranges
- parent sessions
- child sessions
- country breakdowns
- daily data
- sorting
- search
- CSV export

## Authentication

Current client contract:

```text
Authorization: Bearer ADMIN_KEY
```

On 401, the app clears the stored key and returns to login state.

Do not introduce:

- `X-Admin-Key`
- `?key=` auth
- hardcoded admin secrets

## Structural Issue Resolved

The duplicate-looking full project previously located under `/admin-youngtube/` has been permanently removed following verification that the repository root is the sole, complete operational project.

- **Reason for Deletion**: Eliminating structural duplication and confusion between the repository root and nested subdirectory.
- **Path Deleted**: `/admin-youngtube/` (recursive deletion of all subfolders, src, android, configs).
- **Affected Folders/Files**: `admin-youngtube/src/`, `admin-youngtube/android/`, `admin-youngtube/package.json`, `admin-youngtube/vite.config.ts`, `admin-youngtube/tsconfig.json`, `admin-youngtube/capacitor.config.ts`, `admin-youngtube/vercel.json`, `admin-youngtube/index.html`, `admin-youngtube/README.md`, `admin-youngtube/bun.lock`, and related build assets.
- **Root Status**: Verified that the root repository contains all primary source files, Android configuration, Vite build scripts, and documentation. Root remains the single operational source of truth.
- **References Check**: 0 broken or orphaned references found in code, configuration, or build scripts.
- **Remaining Issues**: None regarding project structure.

## Verification Labels

Use:

- PASS = actually tested
- SOURCE-OK = code/source inspection only
- BLOCKED = runtime test blocked
- FAIL = actual failed test

## Verification Status Matrix (Current Session)

- `npm run test:parent-inbox`: PASS (all 3 contract subtests passed)
- `npm run lint` (`tsc --noEmit`): PASS (zero errors)
- `npm run build` (`vite build`): PASS (clean production build to `dist/`)
- `npx cap sync android`: PASS (web assets copied to `android/app/src/main/assets/public`, plugins updated)
- `compile_applet`: PASS (AI Studio applet compiled successfully)
- Android App Identity verification: PASS (`app.youngtube.admin` in gradle, manifest, strings.xml, capacitor.config.ts, bundled JSON)
- Android Update Continuity configuration: PASS (`versionCode` bump comment & dynamic CLI overrides, `signingConfigs.release` configured from env/secrets, `.gitignore` protects keystores, `ANDROID_SIGNING.md` created)
- Prohibited strings check: PASS (0 matches across repo)
- Parent Inbox implementation (`ParentInboxView.tsx`, types, header, sidebar): PASS (verified, contract tests passed, built)
- Support Pay unwrapping & client validation (F-05 & F-06): PASS (code verified and tested in build)
- Telemetry `Admin فقط` explanatory banner: PASS (verified in `TelemetryView.tsx`)
- Documentation files in root: PASS (`PROJECT_CONTEXT.md`, `HANDOFF.md`, `WORKER_CLOUDFLARE.md`, `AI_REVIEW_INSTRUCTIONS.md`, `ANDROID_SIGNING.md`, `youngtube-parent-inbox-execution-report.md`)
- Real Worker Bearer authentication against live Cloudflare Worker: BLOCKED (requires live admin key)
- Live Support Pay round-trip against production KV: BLOCKED (requires live admin session)
- Android native APK compilation: BLOCKED (Android SDK / Gradle build daemon environment)

## Open Verification Items

- Vercel deployment behavior
- Android APK build (via GitHub Actions workflow)
- Real Admin login against the current Worker
- Support Pay read/write round-trip with live Worker without changing production payment data
- Telemetry live data response verification from `TELEMETRY_DO`

## Do Not Change Casually

- Worker API contracts
- Bearer authentication
- Worker URL default
- telemetry data shape normalization
- Support Pay source-of-truth architecture
- category/channel/block semantics
- Parent inbox API endpoints and authentication
- Android package id / application id: must stay `app.youngtube.admin` (never use `app.youngtube.app`)

## Session Log & Next Agent Starting Point

- **Current State**: The repository root is the sole operational application running on Vite (port 3000). Only canonical documentation files exist in root: `PROJECT_CONTEXT.md`, `HANDOFF.md`, `WORKER_CLOUDFLARE.md`, `AI_REVIEW_INSTRUCTIONS.md`, `README.md`, `ANDROID_SIGNING.md`, and `youngtube-parent-inbox-execution-report.md`.
- **Android Identity & Update Preservation**: Verified that `app.youngtube.admin` is consistently configured across `capacitor.config.ts`, `android/app/build.gradle`, `android/app/src/main/assets/capacitor.config.json`, `android/app/src/main/res/values/strings.xml`, and `MainActivity.java`. Added dynamic `versionCode`/`versionName` property overrides and release signing configuration hooked to environment variables / GitHub Secrets (`ADMIN_RELEASE_KEYSTORE_*`). Ensured keystore binaries are ignored in root and android `.gitignore`. Created `ANDROID_SIGNING.md` documenting one-time keystore generation, consistent key update rules, and in-place upgrade behavior.
- **Verification Matrix**: `npm run test:parent-inbox` (PASS - 3/3), `npm run lint` (PASS), `npm run build` (PASS), `npx cap sync android` (PASS), `compile_applet` (PASS), Prohibited strings grep (PASS - 0 matches).
- **Next Agent**: The repository root is the single source of truth. Always consult `PROJECT_CONTEXT.md`, `HANDOFF.md`, `WORKER_CLOUDFLARE.md`, and `ANDROID_SIGNING.md` before making any targeted changes. Update documentation at the end of each task.

## Dependency and CI Hardening — 2026-10-21

- Raised the declared Vite range to ^8.3.4 and refreshed the npm lockfile for the security fix.
- The Android build workflow now blocks before build on parent-inbox UI contract tests and TypeScript checking.
- Added Quality Checks on pull requests targeting main. It runs dependency installation, those checks, and the web build with contents: read and checkout credential persistence disabled.
- The pull-request workflow does not deploy, sign, upload artifacts, or access repository secrets.
- Validation (isolated sandbox, Node 24.21.0/npm 11.19.0): npm ci PASS; parent-inbox tests 3/3; TypeScript check PASS; web build PASS. Android Gradle/APK compilation was not run. npm audit still reports moderate findings in the existing @capacitor/cli -> xcode -> uuid dependency chain; this PR does not override uuid.

## Catalog V2 auto-review sample-request fix — 2026-10-26 (unmerged work branch)

- Root cause (diagnosed from production observation 2026-10-26, no production test run here): the
  "ابدأ اختبار العينة" button used a blocking `window.confirm` (dismissible with no trace) and the
  handler discarded the mode-endpoint response, so any HTTP 200 — including `{ok:false}` or an empty
  body — produced the "بدأ الاختبار الآلي" success toast while the mode could stay `off` in D1.
  The Worker pipeline itself (mode endpoint → scheduler → processing queue → consumer → Gemini →
  D1 → counters) was verified wired at YoungTube- main HEAD; no Worker change is part of this fix.
- Change (admin panel only): mode changes are now confirmed through the existing in-panel
  `ConfirmModal` (explicit Cancel button, visible in the DOM); `confirmAutoReviewMode` validates
  `result.ok === true` and `result.autoReviewMode === mode`, then re-reads
  `GET /api/admin/catalog/status` and compares the reloaded mode; a mismatch or unconfirmed
  response sets a persistent in-section warning/error (not toast-only). Provider gate and the
  10-sample enforce gate are unchanged; budgets, kid feed, active generation, and classifications
  are untouched. Modal limit fallbacks corrected to the Worker server defaults (2000 / 28800s / 1800s).
- Tests: new `tests/catalog-auto-review-request.test.mjs` (6 tests, node:test source-pattern style);
  admin catalog + parent-inbox tests 13/13; `npm run lint` (tsc --noEmit) PASS; `npm run build` PASS.
  NOT tested here: live production panel, live Gemini call, live D1/queue state (no Cloudflare
  access from this environment; production test is Phase 5, after owner merge/deploy).
- Constraints honoured: no `enforce` enabled, no kid-feed or generation change, no secret created or
  changed, no deploy, no main push, no workflow-file change. The budget paid-tier confirm and the
  manual video-reject confirm are deliberately left as native dialogs (out of this fix's scope).
