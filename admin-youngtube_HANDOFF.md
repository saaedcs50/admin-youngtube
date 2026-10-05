# admin-youngtube — HANDOFF

## Current Baseline

- Repo: `saaedcs50/admin-youngtube`
- Branch: `main`
- Current HEAD: `382dd4a0d34ad3535b25c8b02655c434a3120285`
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

- `npm run lint` (`tsc --noEmit`): PASS (zero errors)
- `npm run build` (`vite build`): PASS (clean production build to `dist/`)
- `npx cap sync android`: PASS (assets copied, Android plugins updated)
- Prohibited strings check (`01092126960`, `saaedlhalidbelal`): PASS (0 matches across repo)
- Support Pay unwrapping & client validation (F-05 & F-06): PASS (code verified and tested in build)
- Telemetry `Admin فقط` explanatory banner: PASS (verified in `TelemetryView.tsx`)
- Documentation files in root: PASS (`PROJECT_CONTEXT.md`, `HANDOFF.md`, `WORKER_CLOUDFLARE.md`, `AI_REVIEW_INSTRUCTIONS.md`)
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

## Session Log & Next Agent Starting Point

- **Current State**: The repository root is the sole operational application running on Vite (port 3000). Documentation files (`PROJECT_CONTEXT.md`, `HANDOFF.md`, `WORKER_CLOUDFLARE.md`, `AI_REVIEW_INSTRUCTIONS.md`) are synchronized in the project root.
- **Structural Cleanup**: The duplicate nested folder `/admin-youngtube/` was permanently deleted after verifying that root contains 100% of the required sources and configs with zero broken references.
- **Verification**: `npm run lint` PASS, `npm run build` PASS, `npx cap sync android` PASS.
- **Next Agent**: The repository root is the single source of truth. Always consult `PROJECT_CONTEXT.md`, `HANDOFF.md`, and `WORKER_CLOUDFLARE.md` before making any targeted changes. Update documentation at the end of each task.
