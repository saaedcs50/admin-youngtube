# admin-youngtube — PROJECT_CONTEXT

## 0. Purpose

This is the standalone administrative dashboard for YoungTube. It manages content curation, global blocks, channels/playlists, categories, announcements, Support Pay settings, Worker status, and telemetry/analytics.

This file is generated from direct inspection of the current GitHub `main` branch and current source tree only.

## 1. Current Source-of-Truth Baseline

- Repository: `saaedcs50/admin-youngtube`
- Branch: `main`
- Current HEAD: `ac02b2a227f1079d5890568b8561efaedd3376ea`
- Primary app root: repository root
- Frontend entry: `src/main.tsx`
- Main React shell: `src/App.tsx`
- Android project: `android/`

## 2. Stack

- React 19
- TypeScript 5.8.x
- Vite 8.3.x
- Tailwind CSS 4.3.x
- Capacitor 8.5.2
- lucide-react
- PWA install support

## 3. Build Scripts

- `npm run dev` → Vite on port 3000
- `npm run build` → `vite build`
- `npm run cap:sync` → build then `npx cap sync android`
- `npm run preview` → Vite preview
- `npm run clean` → remove dist
- `npm run lint` → `tsc --noEmit`
- `npm run test:parent-inbox` → `node --test tests/parent-inbox-ui-contract.test.mjs`

## 4. Application Shell

`src/App.tsx` owns:

- Admin key state
- active tab state
- refresh state
- Worker health state
- dark/light theme state
- toast notifications
- login/logout
- top-level routing between admin views

Authenticated layout consists of:

- `Sidebar`
- `Header`
- current tab content
- global Toast container

## 5. Tabs

The current `TabType`/navigation includes:

- telemetry
- blocks
- channels
- categories
- announcements
- support-pay
- parent-inbox
- status
- settings

Telemetry is therefore explicitly part of the admin application.

## 6. Navigation / Header

`src/components/Header.tsx`:

- sticky top header
- active tab title/subtitle
- Worker health indicator
- PWA install action when available
- manual refresh
- theme toggle
- logout

`src/components/Sidebar.tsx`:

- desktop sidebar
- mobile bottom navigation
- direct tab switching
- Worker URL display

## 7. Authentication

`src/services/api.ts`:

- default Worker URL is `https://youngtube-worker.saaedbelal.workers.dev`
- Admin key is stored in sessionStorage and, when “remember” is selected, localStorage
- requests attach:

```text
Authorization: Bearer <adminKey>
```

- 401 responses clear the stored Admin key and trigger the unauthorized handler

The Admin client should never send an Admin key using `X-Admin-Key` or a query parameter.

## 8. Worker Integration

The admin app is a frontend client of the Cloudflare Worker; Worker source is NOT stored in this repository.

Current default API origin:

```text
https://youngtube-worker.saaedbelal.workers.dev
```

It may be overridden using:

```text
VITE_WORKER_URL
```

or through the app's stored Worker URL setting.

## 9. Admin APIs Used by the Client

Observed in `src/services/api.ts` and component usage:

### Status

- `GET /api/admin/status`

### Telemetry

- `GET /api/admin/telemetry?days=N`

### Blocks

- `GET /api/global-blocks`
- `POST /api/admin/blocks`

### Channels

- `GET /api/channels-latest`
- `GET /api/channel-archive?id=...&max=2000`
- `POST /api/admin/channels`
- `POST /api/admin/channel-video-delete`
- `POST /api/admin/backfill-channel`
- `POST /api/admin/backfill-all-batch`
- `POST /api/admin/cleanup-dead-videos-batch`
- `POST /api/admin/scan-cleanup-batch`
- related maintenance endpoints

### Channel resolution

- `GET /api/resolve-channel?handle=...`
- when an Admin key is present, the client sends the Bearer header

### Announcements

- `GET /api/announcements?all=true`
- `POST /api/admin/announcements`

### Categories

- `GET /api/categories`
- category management through admin category routes

### Support Pay

- Admin Support Pay reads and writes the Worker-backed configuration.

### Parent Inbox

- `GET /api/admin/parent-inbox?status=...&category=...&limit=...`
- `POST /api/admin/parent-inbox/mark-read`
- `POST /api/admin/parent-inbox/status`
- `POST /api/admin/parent-inbox/reply`
- `POST /api/admin/parent-inbox/note`
- `POST /api/admin/parent-inbox/archive`
- `POST /api/admin/parent-inbox/pin`

## 10. Telemetry / Analytics

`src/components/TelemetryView.tsx`:

- retrieves normalized telemetry from `/api/admin/telemetry`
- supports time ranges 7 / 30 / 90 days
- shows parent sessions and child sessions
- shows country-level aggregates
- shows daily logs
- supports sorting/searching
- supports CSV export
- has manual reload behavior

This is the analytics destination for the separate Admin app.

## 11. Support Pay UI

`src/components/SupportPayView.tsx`:

- loads existing settings from the Worker
- unwraps the current Worker response payload
- has client-side required-field validation
- requires non-empty fields before opening confirmation
- supports InstaPay phone/IPA/URL/name
- supports Vodafone Cash phone/name
- supports optional note
- asks for confirmation before writing
- writes through the Admin Worker endpoint

The UI should never hardcode real payment values.

## 12. Content Management

### Blocks

`BlocksView.tsx` manages global blocked channels and playlists. It supports URL-aware parsing/resolution and explicit removal with confirmation.

### Channels

`ChannelsView.tsx` supports:

- smart YouTube URL input
- metadata resolution
- adding channels
- categories
- refresh/load state
- removal
- backfill actions

### Categories

`CategoriesView.tsx` and `CategoryChannelsModal.tsx` manage category definitions and mappings.

### Announcements

`AnnouncementsView.tsx` manages Worker-backed announcement content. The `all=true` admin fetch is authenticated by the Bearer client logic.

### Parent Inbox

`ParentInboxView.tsx` manages communications from parents:
- lists inbox messages with category and status filters (`all`, `unread`, `in_progress`, `resolved`, `archived`)
- supports message detail view, marking as read, replying, adding internal notes
- supports status transitions (`new`, `in_progress`, `resolved`), pinning, and archiving
- exposes unread/new count to sidebar badge

## 13. Status View

`StatusView.tsx` checks Worker health through `/api/admin/status` and exposes operational/maintenance actions.

## 14. Security Constraints

Never:

- place real `ADMIN_KEY` in source
- place payment numbers or IPA values in source
- place Worker secrets in source
- send auth using URL query parameters
- bypass 401 handling
- add a public Admin endpoint without explicit Worker-side auth

The current Admin source search previously found no known legacy `X-Admin-Key` code path.

## 15. Project Structure Baseline

The repository previously contained a duplicate full project under `/admin-youngtube/`.
The duplicate nested project has been removed.
The repository root is now the single source of truth for the Admin application.

## 16. Android

The repo contains a Capacitor Android project.

App ID from the inspected Capacitor configuration:

```text
app.youngtube.admin
```

App name:

```text
YoungTube Admin
```

Web directory:

```text
dist
```

The Android native surface is minimal compared with the child app; the main Admin behavior is implemented in the web application.

## 17. Deployment Configuration

`vercel.json` exists and the README documents Vercel deployment with:

```text
VITE_WORKER_URL
```

The project also has a GitHub Actions APK workflow file, but a workflow file existing is not proof that the current HEAD has a successful recent workflow run.

## 18. Current Verification State

Source-level review confirms the main architecture and client/Worker contracts listed above.

Runtime build/deployment should be verified in an environment with dependencies/network access before marking release readiness.

## 19. Change Discipline

Before modifying the project, read:

1. `PROJECT_CONTEXT.md`
2. `HANDOFF.md`
3. `WORKER_CLOUDFLARE.md`

After every meaningful change, update the handoff/context records with exact files changed and test results.
