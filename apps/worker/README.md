# Worker — CTA Poller

Polls [CTA Bus Tracker](https://www.transitchicago.com/developers/bustracker/) and [CTA Train Tracker](https://www.transitchicago.com/developers/traintracker/) every 20 seconds and upserts vehicle positions into Supabase.

## Run locally

```bash
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUSTIME_API_KEY, TRAIN_API_KEY
npm install
npm run dev
```

Watch the Supabase dashboard — the `vehicles` table should start filling up within 20 seconds.

## Deploy to Railway

1. Railway → New Project → Deploy from GitHub repo → point at this repo.
2. Set the **Root Directory** to `apps/worker`.
3. Add environment variables from `.env.example`.
4. Railway runs `npm install && npm run build && npm start`.
