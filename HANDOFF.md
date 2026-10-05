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

## Important Structural Issue

The GitHub repository contains a duplicate-looking full project under:

```text
admin-youngtube/
```

while the repository root itself also contains the same Admin project structure.

This should be investigated before any cleanup. Do not delete the nested or root project automatically.

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

- **Current State**: The repository root is the operational application running on Vite (port 3000). Documentation files (`PROJECT_CONTEXT.md`, `HANDOFF.md`, `WORKER_CLOUDFLARE.md`, `AI_REVIEW_INSTRUCTIONS.md`) are synchronized in the project root.
- **Structural Note**: The `admin-youngtube/` subfolder remains intact in accordance with Section 15 of `PROJECT_CONTEXT.md` (no automatic deletion).
- **Next Agent**: Inspect the exact request from the user, follow the strict priority order and test status rules, execute changes with minimal surgical edits, and update `HANDOFF.md` and related context files before concluding.
