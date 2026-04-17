# Transit Tracker — Chicago CTA

Live bus and train positions for the Chicago Transit Authority. Users pick routes, see vehicles moving on a map in real time.

Built for **MPCS 51238 · Design, Build, Ship · Assignment 4**.

---

## System Architecture

```
 ┌───────────────────┐   HTTP (polling)   ┌───────────────────────┐
 │  CTA Bus Tracker  │◄───────────────────┤                       │
 │  CTA Train Tracker│                    │   Worker (Railway)    │
 └───────────────────┘                    │   apps/worker         │
                                          │   Node.js, node-cron  │
                                          └───────────┬───────────┘
                                                      │  upsert (service-role)
                                                      ▼
                                          ┌───────────────────────┐
                                          │   Supabase Postgres   │
                                          │   + Realtime broadcast│
                                          └───────────┬───────────┘
                                                      │  websocket (anon key)
                                                      ▼
 ┌───────────────────┐   HTTPS (browser)  ┌───────────────────────┐
 │      User         │◄───────────────────┤   Next.js (Vercel)    │
 │  (authenticated)  │────────────────────►   apps/web            │
 └───────────────────┘                    │   Tailwind + Leaflet  │
                                          └───────────────────────┘
```

**One-line summary:** Worker polls CTA APIs every 20s → upserts vehicle rows → Supabase Realtime pushes row changes over websocket → frontend re-renders map markers for the user's favorite routes.

---

## Data Source — CTA

The Chicago Transit Authority publishes two separate JSON APIs. Both are free but require a key (one per API). Keys are registered through <https://www.transitchicago.com/developers/>.

### Bus Tracker (`BUSTIME_API_KEY`)
- Endpoint: `https://www.ctabustracker.com/bustime/api/v2/getvehicles`
- Query: `?key=KEY&rt=ROUTE1,ROUTE2,...&format=json` (up to 10 routes per call)
- Response: `vehicle[]` with `vid`, `tmstmp`, `lat`, `lon`, `hdg`, `rt`, `des`, `spd`, `dly`
- Refresh cadence: roughly every 60s on CTA's side; we poll every 20s to stay fresh without hammering.

### Train Tracker (`TRAIN_API_KEY`)
- Endpoint: `https://lapi.transitchicago.com/api/1.0/ttpositions.aspx`
- Query: `?key=KEY&rt=Red,Blue,Brn,G,Org,P,Pink,Y&outputType=JSON` (all 8 lines in one call)
- Response: `ctatt.route[].train[]` with `rn`, `lat`, `lon`, `heading`, `destNm`, `isApp`, `isDly`
- Refresh cadence: every 20s, one request covers the entire L system.

### Routes we track
- **All 8 train lines**, static: Red, Blue, Brn, G, Org, P, Pink, Y.
- **20 most-ridden bus routes** (seeded list — can be edited in `apps/worker/src/routes.ts`): 9, 22, 49, 66, 79, 77, 3, 4, 8, 20, 6, 82, 12, 36, 63, 81, 147, 146, 53, 151.

Users favorite from this fixed universe. The worker polls them regardless of favorites — frontend filters by preference.

---

## Database Schema (Supabase / Postgres)

Project ID: `dookfukissvnwozeatmw` (reused existing project, region `us-west-2`).

Three tables live in the public schema.

### `routes` — static metadata, seeded once

| column       | type        | notes                                      |
|--------------|-------------|--------------------------------------------|
| `route_id`   | TEXT PK     | e.g. `Red`, `22`                           |
| `mode`       | TEXT        | `train` \| `bus`                           |
| `name`       | TEXT        | human-readable (e.g. "Red Line")           |
| `color`      | TEXT        | hex string for map markers                 |

Not Realtime — rarely changes. Readable by all (including anon).

### `vehicles` — live positions, worker upserts

| column           | type          | notes                                         |
|------------------|---------------|-----------------------------------------------|
| `vehicle_id`     | TEXT PK       | CTA `vid` (bus) or `rn` (train run number)    |
| `route_id`       | TEXT FK routes| route this vehicle is on                      |
| `mode`           | TEXT          | `train` \| `bus`                              |
| `lat`            | NUMERIC       |                                               |
| `lon`            | NUMERIC       |                                               |
| `heading`        | INT           | degrees 0–359                                 |
| `destination`    | TEXT          | e.g. "Howard", "Midway"                       |
| `speed`          | NUMERIC       | mph (bus only, NULL for train)                |
| `delayed`        | BOOLEAN       | CTA-reported delay flag                       |
| `source_updated_at` | TIMESTAMPTZ | CTA's own timestamp for the position fix     |
| `updated_at`     | TIMESTAMPTZ   | our upsert time, defaults `now()`             |

**Realtime enabled** — `ALTER PUBLICATION supabase_realtime ADD TABLE vehicles`. Stale rows (not updated in >10 min) are deleted on each worker tick so they disappear from the map.

### `user_favorites` — personalization

| column       | type        | notes                                        |
|--------------|-------------|----------------------------------------------|
| `user_id`    | UUID FK auth.users | Supabase auth user                     |
| `route_id`   | TEXT FK routes     |                                        |
| `created_at` | TIMESTAMPTZ        | default `now()`                        |

PK: `(user_id, route_id)`.

### Row-level security

- `routes`: read = public; write = service role only.
- `vehicles`: read = public (so the map is shareable and anon can view); write = service role only (worker).
- `user_favorites`: `SELECT`/`INSERT`/`DELETE` where `auth.uid() = user_id` — a user can only see and mutate their own favorites.

---

## Worker — `apps/worker`

A long-running Node.js process deployed to Railway. Single file: `src/index.ts`.

### Loop
```ts
every 20 seconds:
  fetchTrains()   // one HTTP call, all 8 L lines
  fetchBuses()    // 2 HTTP calls (20 routes in batches of 10)
  upsertVehicles(supabase, allVehicles)
  pruneStale()    // DELETE FROM vehicles WHERE updated_at < now() - interval '10 minutes'
```

Uses `@supabase/supabase-js` with the **service-role key** (bypasses RLS, required for writes).

### Environment variables (Railway)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BUSTIME_API_KEY`
- `TRAIN_API_KEY`
- `POLL_INTERVAL_MS` (optional, default `20000`)

### Resilience
- Each fetch is wrapped in try/catch — a transient CTA outage doesn't kill the process.
- Errors are logged with a timestamp and route context; the next tick just retries.
- Railway restarts the process on crash.

---

## Frontend — `apps/web`

Next.js 14 App Router, deployed to Vercel.

### Stack
- **Next.js 14** (app directory)
- **Tailwind CSS** for styling
- **Leaflet** (`react-leaflet`) for the map — OpenStreetMap tiles, client-only component
- **@supabase/ssr** + **@supabase/supabase-js** for auth and data
- **Supabase Auth** (email magic link) — no third-party auth service needed

### Routes
- `/` — landing page, describes the app, links to sign in
- `/login` — magic-link form (Supabase Auth)
- `/auth/callback` — handles the magic-link redirect, exchanges code for session
- `/dashboard` — authenticated; left panel lists routes with ★ toggles, right panel is the live map
- `/dashboard/settings` — (optional, stretch) edit display prefs like default zoom

### Data flow on the client

On mount of `/dashboard`:
1. Server component reads the user's favorites via RLS (`select * from user_favorites where user_id = auth.uid()`).
2. Client component receives initial favorites + an initial snapshot of `vehicles` for those routes.
3. Client subscribes to Supabase Realtime:
   ```ts
   supabase.channel('vehicles')
     .on('postgres_changes',
         { event: '*', schema: 'public', table: 'vehicles' },
         payload => updateVehiclesMap(payload))
     .subscribe()
   ```
4. On every `INSERT` / `UPDATE`, the map marker for that `vehicle_id` is moved (or created). On `DELETE`, the marker is removed.
5. Favorites are filtered client-side so that toggling a star is instant (no reload).

Map markers are colored by `routes.color` and rotated by `heading`.

### Environment variables (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Both also live in `apps/web/.env.local` for local dev.

---

## Monorepo Layout

```
transit-tracker/
├── CLAUDE.md                ← this file
├── AGENTS.md                ← short pointer to CLAUDE.md for Codex
├── README.md                ← deploy + local-dev instructions
├── package.json             ← npm workspaces root
├── .gitignore
├── .env.example             ← every env var used in the system
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql              ← routes + vehicles + favorites + RLS
│       ├── 0002_enable_realtime.sql   ← add vehicles to supabase_realtime
│       └── 0003_seed_routes.sql       ← static route metadata
└── apps/
    ├── web/                 ← Next.js 14 + Tailwind → Vercel
    │   ├── app/
    │   ├── components/
    │   ├── lib/supabase/
    │   ├── .env.local.example
    │   └── package.json
    └── worker/              ← Node.js poller → Railway
        ├── src/
        │   ├── index.ts     ← main loop
        │   ├── cta.ts       ← CTA API clients
        │   ├── supabase.ts  ← service-role client
        │   └── routes.ts    ← static list of tracked routes
        ├── .env.example
        └── package.json
```

npm workspaces so `npm install` at the root wires both apps.

---

## Deployment

### Supabase (already provisioned)
- Project: `cheny2003@uchicago.edu's Project` (ref `dookfukissvnwozeatmw`)
- Migrations applied via Supabase MCP during scaffolding
- MCP config lives at repo root in `.mcp.json`

### Worker → Railway
1. Push repo to GitHub.
2. New Railway project → "Deploy from GitHub repo" → pick this repo → **root dir: `apps/worker`**.
3. Add env vars (see list above).
4. Railway auto-detects Node, runs `npm install && npm start`.

### Frontend → Vercel
1. New Vercel project → import the same GitHub repo → **root dir: `apps/web`**.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Vercel auto-builds on every push to `main`.

---

## End-to-End Data Flow (one full cycle)

1. **T+0s** Worker tick fires.
2. **T+0.1s** `GET https://lapi.transitchicago.com/api/1.0/ttpositions.aspx?...` returns ~150 trains.
3. **T+0.4s** Two `GET` calls to Bus Tracker return ~300 buses across 20 routes.
4. **T+0.6s** Worker calls `supabase.from('vehicles').upsert([...])` with ~450 rows.
5. **T+0.7s** Postgres writes the rows; the Realtime WAL listener sees each change.
6. **T+0.8s** Realtime broadcasts `postgres_changes` over websocket to every subscribed browser.
7. **T+0.9s** Client receives payloads, filters to favorited routes, moves markers on the Leaflet map.
8. **T+20s** Next tick.

---

## Requirements Checklist (Assignment 4)

- [x] Monorepo — `apps/web/` and `apps/worker/`
- [x] Next.js + Tailwind CSS
- [x] Background worker on Railway
- [x] Data stored in Supabase (worker writes, frontend reads)
- [x] Supabase Realtime (live map without refresh)
- [x] Supabase Auth (magic link)
- [x] Personalization — `user_favorites` per user
- [x] Env vars in `.env.local` + platform dashboards (documented in README)
- [x] Supabase MCP configured (`.mcp.json` at repo root)
- [x] CLAUDE.md (this file)
- [ ] Multiple git commits (produced during build)
- [ ] Deployed to Vercel + Railway (user-driven final step)
- [ ] Live URLs work (verified after deploy)
