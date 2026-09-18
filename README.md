# admin-youngtube

لوحة إدارة مستقلة لـ YoungTube (حظر / قنوات / إعلانات / إحصائيات بحثية).

لا تضع `ADMIN_KEY` في الكود. أدخله من شاشة الدخول.

## Worker

الافتراضي:

`https://youngtube-worker.saaedbelal.workers.dev`

يمكن تغييره من شاشة الدخول أو عبر:

```
VITE_WORKER_URL=https://youngtube-worker.saaedbelal.workers.dev
```

## تشغيل محلي

```bash
npm install
npm run dev
```

## Vercel

1. اربط هذا الريبو
2. Environment variable:
   - `VITE_WORKER_URL` = رابط الـ Worker بدون `/` في الآخر
3. Deploy

الدخول: نفس `ADMIN_KEY` الموجود في Cloudflare Secrets.

## عقود الـ API المستخدمة

- `GET /api/admin/status` — تحقق الدخول
- `GET /api/global-blocks` — `{ channelIds, playlistIds, updatedAt }`
- `POST /api/admin/blocks` — `{ action, type, id }`
- `GET /api/admin/telemetry?days=N` — totals + `*ByCountry` records
- `POST /api/admin/channels` — `{ action, item | sourceId }`
- `GET /api/announcements` + `POST /api/admin/announcements`
