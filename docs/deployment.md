# RSAPP — Running and Deploying the Backend

## 1. Architecture in one paragraph

The frontend is a Vite + React 19 SPA that works **offline-first**: the indicator
catalog is bundled into the build (`src/data/catalog.json`), and visit sessions,
the store directory and corrective actions are kept in `localStorage`. The
backend (`server/src/index.ts`, Express) is a **sync and sharing layer** on top
of that: it persists visits, stores, corrective actions and audit logs, enforces
RBAC and the "the owner cannot verify their own action" rule, serves the scoring
engine, and handles evidence photo uploads. If the backend is unreachable, the
app keeps working on local data — nothing is lost, it just isn't shared.

## 1b. Where data is stored

Two interchangeable backends, chosen at startup by a single variable:

| | `DATABASE_URL` **not** set | `DATABASE_URL` set |
| --- | --- | --- |
| Backend | JSON files in `DATA_DIR` | PostgreSQL |
| Setup | none | a free Neon/Supabase database |
| Survives redeploy | only with a mounted volume | always |
| Shared between users | yes, one process | yes |
| Good for | local development, demos | anything you want to keep |

`/api/health` reports which one is live, under `storage`. If `DATABASE_URL` is
set but the database cannot be reached, the server **refuses to start** rather
than quietly writing to a disk the next redeploy will wipe.

The PostgreSQL schema lives in `server/src/store/schema.ts` and is applied
automatically on every boot (it is idempotent). Each entity is stored as a JSONB
document with the filterable fields lifted into indexed columns, so nothing the
frontend sends is lost on a round trip.

## 2. Local development

```bash
npm install
npm run server      # API on http://localhost:3001
npm run dev         # UI on http://localhost:3000 (proxies /api to :3001)
```

Run them in two terminals. The Vite dev server proxies `/api` to port 3001, so
no environment variables are needed locally.

Single-process check of the production setup:

```bash
npm run build       # produces dist/
npm start           # serves API + UI together on http://localhost:3001
```

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type-checks the frontend and the server |
| `npm run build` | Type-checks and builds the SPA into `dist/` |
| `npm start` | Runs the backend; also serves `dist/` when it exists |
| `npm run server:dev` | Backend with auto-restart on file change |
| `npm run data:reset` | Empties the JSON stores (`-- --all` includes stores) |
| `npm run db:import` | Copies the JSON stores into PostgreSQL |

## 3. Configuration

Copy `.env.example` to `.env` and adjust. The variables that matter:

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3001` | Managed hosts inject this — never hardcode it |
| `HOST` | `0.0.0.0` | Keep as-is inside containers |
| `DATABASE_URL` | *(unset)* | Set it to store everything in PostgreSQL |
| `PGSSL` | *(unset)* | `disable` for a local database without TLS |
| `DATA_DIR` | `data` | Only used without `DATABASE_URL` |
| `SERVE_CLIENT` | `true` | `false` for an API-only service |
| `ALLOWED_ORIGINS` | *(empty)* | Set only when the UI is on a different domain |
| `STORAGE_SIGNING_SECRET` | dev placeholder | **Generate a real value before deploying** |
| `VITE_API_BASE_URL` | `/api` | Build-time; set only for split hosting |

## 4. Free hosting for initial testing

Data now lives in PostgreSQL, so the host only has to run code. Two free
combinations are worth considering:

| | Render + Neon | Vercel + Neon |
| --- | --- | --- |
| Data survives | yes | yes |
| Sleeps when idle | yes, 30–60s wake-up | no |
| Cold start | 30–60s | ~1s |
| File uploads | work | need object storage |
| Setup | one service | SPA on CDN, API as a function |

Both are set up below. Render is simpler and keeps every feature; Vercel is
faster and never sleeps. The steps below cover Render first, then Vercel.

### Step 1 — create a free PostgreSQL database (about 3 minutes)

Use **Neon** (neon.tech) or **Supabase** (supabase.com). Both have a genuinely
free tier and need no card.

1. Sign up and create a project.
2. Copy the connection string. It looks like
   `postgresql://user:password@ep-something.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
3. Keep it somewhere safe — it is a password. Never commit it.

There is nothing to create by hand in the database: the server builds its own
tables on first start.

### Step 2 — move the existing data in (optional)

Only if you want the current `data/*.json` content in the database:

```bash
DATABASE_URL="postgresql://..." npm run db:import
```

It is idempotent, so running it twice is harmless.

### Step 3 — deploy the app to Render

`render.yaml` is in the repository root and preconfigures everything.

1. Push the repository to GitHub.
2. On render.com: **New → Blueprint**, select the repo, apply.
3. In the service's **Environment** tab, add one variable:
   `DATABASE_URL` = the connection string from step 1.
4. Deploy, then open the assigned `*.onrender.com` URL.
5. Check `/api/health` — it should report `"storage":"postgres"`.

Remaining free-tier caveat: the instance **sleeps after ~15 minutes idle**, so
the first request afterwards takes 30–60 seconds. The data is safe either way. A
free pinger (UptimeRobot, cron-job.org) on `/api/health` every 10 minutes avoids
the delay.

### Alternative: a persistent disk instead of a database

If you would rather keep the JSON files, use a host that offers a volume and
skip `DATABASE_URL` entirely:

- **Railway** — deploy from the repo (it picks up the `Dockerfile`), add a
  volume mounted at `/data`, set `DATA_DIR=/data`. No sleeping.
- **Fly.io** — `fly.toml` is included. `fly launch --no-deploy`,
  `fly volumes create rsapp_data --size 1`, then `fly deploy`.

Both ask for a card at sign-up. A volume also ties the app to a single machine,
whereas a database does not.

### Split hosting (frontend on a CDN, API elsewhere)

Only worth it if you want the UI to load instantly while the API sleeps: put
`dist/` on Cloudflare Pages / Netlify / Vercel and keep the API on Render. Then
set **both**:

- On the API service: `ALLOWED_ORIGINS=https://your-ui-domain`
- At frontend build time: `VITE_API_BASE_URL=https://your-api-domain/api`

### Alternative: Vercel + Neon (no sleeping)

Vercel's free tier does not sleep: the SPA is served from its CDN and the API
runs as a serverless function that cold-starts in about a second. With Neon
holding the data, this is the only free combination without the 30–60 second
wake-up delay. `vercel.json` and `api/index.ts` are included.

1. Create the Neon database as in step 1 above.
2. In Neon, copy the **pooled** connection string (the host contains `-pooler`).
   Serverless creates many short-lived connections, and the pooled endpoint is
   what keeps them within the free connection limit.
3. On vercel.com: **Add New → Project**, import the repository. Leave the build
   settings alone — `vercel.json` sets them.
4. Add two environment variables:
   - `DATABASE_URL` = the **pooled** Neon string
   - `SERVE_CLIENT` = `false` (Vercel serves the SPA; the function must not)
5. Deploy, then check `/api/health` for `"storage":"postgres"`.

What does **not** work on Vercel: the evidence-file endpoints
(`/api/storage/upload` and `/api/storage/files/*`). A serverless filesystem is
read-only and not shared between invocations. The app does not currently call
them (see the note below), so nothing visible breaks — but real photo upload
will need object storage (S3, Cloudflare R2, Supabase Storage) before it can
work there. On Render or a volume-backed host these endpoints work as they are.

### A note on photo evidence

The camera and gallery buttons in the friction sheet do **not** capture a real
photo. `handleAddPhoto` in `src/components/FrictionSheet.tsx` generates a
coloured SVG placeholder; there is no file input anywhere in the app. The
backend upload endpoint, MIME validation and signed URLs are implemented and
work, but nothing in the UI uses them. Real photo capture is still to be built,
and the choice of host affects how: on Render or a volume-backed host it can use
the existing local provider; on Vercel it needs object storage from day one.

## 5. Before you share the URL with anyone

- [ ] Set `STORAGE_SIGNING_SECRET` to a random value (`openssl rand -hex 32`).
- [ ] Set `DATABASE_URL` (or attach a volume and set `DATA_DIR`). Without one of
      the two, everything is lost on the next restart. Confirm via `/api/health`.
- [ ] **There is no authentication yet.** The API trusts the `x-user-role`,
      `x-user-name` and `x-tenant-id` request headers, which any client can set.
      RBAC and tenant isolation are therefore demo-grade: anyone with the URL can
      read and write everything. Keep the link private during testing, and add
      real auth before production.
- [ ] Reset the demo data if you want a clean start: `npm run data:reset`
      (add `-- --all` to clear the store directory too), then re-run
      `npm run db:import` if you are on PostgreSQL.
