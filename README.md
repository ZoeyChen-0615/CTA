# 🚌 Transit Tracker — Chicago CTA

Live bus and train positions for the Chicago Transit Authority. Sign in, star the routes you ride, and watch vehicles move on a map in real time.

Built for **MPCS 51238 · Design, Build, Ship · Assignment 4**.

See **[CLAUDE.md](./CLAUDE.md)** for the full architecture.

---

## Architecture at a glance

```
CTA Bus/Train APIs → Railway worker (apps/worker) → Supabase (+ Realtime) → Next.js on Vercel (apps/web)
```

- **Worker** — Node.js, polls CTA every 20s, upserts into `transit_vehicles`.
- **Database** — Supabase Postgres, 3 tables, RLS enforced, Realtime enabled on `transit_vehicles`.
- **Frontend** — Next.js 14 + Tailwind, Supabase Auth (magic link), Leaflet map, Realtime subscriptions.

---

## Repo layout

```
transit-tracker/
├── CLAUDE.md                 architecture blueprint
├── AGENTS.md                 pointer for Codex
├── .mcp.json                 Supabase MCP server config
├── .env.example              all env vars used in the system
├── supabase/migrations/      SQL applied to the DB (for reference)
├── apps/
│   ├── web/                  Next.js 14 → Vercel
│   └── worker/               Node.js poller → Railway
└── package.json              npm workspaces root
```

---

## Local development

### 1. Install

```bash
git clone <this repo>
cd transit-tracker
npm install
```

### 2. Get CTA API keys (free, ~1 day approval)

- **Bus Tracker**: <https://www.transitchicago.com/developers/bustracker/>
- **Train Tracker**: <https://www.transitchicago.com/developers/traintrackerapply/>

### 3. Configure env

```bash
cp .env.example apps/web/.env.local
cp .env.example apps/worker/.env
# fill in the values
```

You need:

| variable | where | how to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/.env.local` + Vercel | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/.env.local` + Vercel | same place (publishable / anon key) |
| `SUPABASE_URL` | `apps/worker/.env` + Railway | same URL as above |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/worker/.env` + Railway | Supabase dashboard → Project Settings → API (scroll to "service_role"). **Never ship this to the browser.** |
| `BUSTIME_API_KEY` | `apps/worker/.env` + Railway | CTA Bus Tracker signup |
| `TRAIN_API_KEY` | `apps/worker/.env` + Railway | CTA Train Tracker signup |

### 4. Run

In one terminal:

```bash
npm run dev:worker
# [tick 2026-04-17T22:14:05Z] 437 rows in 612ms
```

In another:

```bash
npm run dev:web
# ▲ Next.js 14.2.35
# Local: http://localhost:3000
```

Visit <http://localhost:3000>, sign in with your email, click the magic link, and you should see the dashboard. Star a few routes — vehicles should appear on the map and move every ~20 seconds.

---

## Supabase setup

The schema was applied via the Supabase MCP during development. The SQL lives in [`supabase/migrations/`](./supabase/migrations) as a record of what's in the database.

If you're recreating the DB from scratch, run the four migrations in order (`0001_init.sql`, `0002_rls.sql`, `0003_realtime.sql`, `0004_seed_routes.sql`) against a fresh Supabase project.

**Supabase Auth** needs one setting: in the Supabase dashboard → Authentication → URL Configuration, add your Vercel URL (plus `http://localhost:3000` for local) to the **Redirect URLs** allowlist. Magic links will otherwise refuse to redirect back.

---

## Deployment

### Worker → Railway

1. Push this repo to GitHub.
2. <https://railway.app> → **New Project** → **Deploy from GitHub repo** → pick this repo.
3. In the service settings set **Root Directory** to `apps/worker`.
4. **Variables** tab — add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BUSTIME_API_KEY`, `TRAIN_API_KEY`.
5. Railway detects Node, runs `npm install`, then `npm run build`, then `npm start`. Watch the Deployments log — you should see `[tick ...] N rows in Xms` every 20s.

### Frontend → Vercel

1. <https://vercel.com> → **Add New… → Project** → import the same GitHub repo.
2. **Root Directory** → `apps/web`.
3. **Environment Variables** — add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Vercel assigns a `*.vercel.app` URL.
5. Go back to Supabase → Authentication → URL Configuration → add the Vercel URL to the Redirect URLs allowlist.

### Verify end-to-end

- Open the Vercel URL in an incognito window.
- Sign up with a new email, click the magic link.
- Star the Red Line and route 22 Clark.
- You should see ~50–100 vehicles appear immediately, and a steady stream of position updates as the worker ticks.

---

## Requirements checklist

- [x] Monorepo — `apps/web/` and `apps/worker/`
- [x] Next.js + Tailwind CSS
- [x] Background worker on Railway
- [x] Data stored in Supabase (worker writes, frontend reads)
- [x] Supabase Realtime — frontend updates without page refresh
- [x] Auth via Supabase Auth (magic link)
- [x] Personalization via `transit_favorites` per user, RLS-enforced
- [x] Env vars in `.env.local` + platform dashboards (documented above)
- [x] Supabase MCP configured (`.mcp.json` at repo root)
- [x] `CLAUDE.md` with full architecture
- [x] Multiple git commits (built incrementally)
- [x] Deployed to Vercel + Railway
- [x] Live URLs — classmates can sign up and use it
