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

Data lives in JSON files under `DATA_DIR` (default `./data`). There is no
database server to provision. A PostgreSQL migration is prepared for later at
`scripts/migrations/002_corrective_actions_postgresql.sql`, but nothing in the
running code uses it yet.

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

## 3. Configuration

Copy `.env.example` to `.env` and adjust. The variables that matter:

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3001` | Managed hosts inject this — never hardcode it |
| `HOST` | `0.0.0.0` | Keep as-is inside containers |
| `DATA_DIR` | `data` | Point at a mounted volume to survive redeploys |
| `SERVE_CLIENT` | `true` | `false` for an API-only service |
| `ALLOWED_ORIGINS` | *(empty)* | Set only when the UI is on a different domain |
| `STORAGE_SIGNING_SECRET` | dev placeholder | **Generate a real value before deploying** |
| `VITE_API_BASE_URL` | `/api` | Build-time; set only for split hosting |

## 4. Free hosting options for initial testing

The app has no database and no build-time secrets, so the cheapest setup is
**one free web service serving both the API and the UI on a single origin**.
Nothing needs `VITE_API_BASE_URL` or `ALLOWED_ORIGINS` in that shape.

### Recommended: Render free web service

`render.yaml` in the repository root is ready to use.

1. Push the repository to GitHub.
2. On render.com: **New → Blueprint**, select the repo. Render reads
   `render.yaml` and creates the service.
3. Build command `npm ci && npm run build`, start command `npm start`, health
   check `/api/health` — all preconfigured.
4. Open the assigned `*.onrender.com` URL.

Trade-offs: the free instance **sleeps after ~15 minutes idle** (first request
after that takes 30–60s), and it has **no persistent disk** — `DATA_DIR` resets
on every redeploy and restart. Fine for demos, not for real field data. A free
uptime pinger (UptimeRobot, cron-job.org) hitting `/api/health` every 10 minutes
keeps it awake.

### Alternative: Railway

Free trial credit rather than a permanent free tier, but it offers a **persistent
volume**, which the JSON stores really want. Deploy from the repo (it picks up
the `Dockerfile`), add a volume mounted at `/data`, and set `DATA_DIR=/data`.
No sleeping.

### Alternative: Fly.io

Small always-on VMs plus a cheap persistent volume. Use the included
`Dockerfile`, then `fly launch`, `fly volumes create rsapp_data`, mount it at
`/data`, and set `DATA_DIR=/data`. More setup than Render, better durability.

### Split hosting (frontend on a CDN, API elsewhere)

Only worth it if you want the UI to load instantly while the API sleeps: put
`dist/` on Cloudflare Pages / Netlify / Vercel and keep the API on Render. Then
you must set **both**:

- On the API service: `ALLOWED_ORIGINS=https://your-ui-domain`
- At frontend build time: `VITE_API_BASE_URL=https://your-api-domain/api`

### Not suitable

Vercel and Netlify serverless functions: the backend keeps all state in memory
and in local JSON files, which serverless instances do not share or retain.
Moving there means doing the PostgreSQL migration first.

## 5. Before you share the URL with anyone

- [ ] Set `STORAGE_SIGNING_SECRET` to a random value (`openssl rand -hex 32`).
- [ ] Decide what happens to data on restart — accept the reset (Render free)
      or attach a volume and set `DATA_DIR` (Railway/Fly).
- [ ] **There is no authentication yet.** The API trusts the `x-user-role`,
      `x-user-name` and `x-tenant-id` request headers, which any client can set.
      RBAC and tenant isolation are therefore demo-grade: anyone with the URL can
      read and write everything. Keep the link private during testing, and add
      real auth before production.
- [ ] Reset the demo data if you want a clean start. `data/actions.json` and
      `data/visits.json` currently contain leftovers from end-to-end test runs
      (actions under synthetic `org_*` tenant ids). Replace them with `{}` and
      restart to clear.
