# Dua Sales — Dua Food Sales Dashboard

A personal, mobile-first sales app (PWA) for daily visits, follow-ups, upsells and leads.

- **Stack:** React + Vite + Tailwind, installable PWA · Supabase (database + login) · Vercel (hosting)
- **Cost:** $0/month on free tiers. Google Places (Prospect Finder, step 6) stays inside Google's free monthly allowance at ~200 searches/month, with a hard daily cap.

## Demo mode
With no Supabase keys set, the app runs in **demo mode**: no login, sample data, and everything saved only in that browser. Good for trying it out.

## Going live (one-time, ~15 minutes)

### 1. Supabase (database + login)
1. Sign up at https://supabase.com (free) → **New project** (any name, pick a strong DB password, region: closest to Texas).
2. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Users → Add user → Create new user**: your email + a password. Tick "Auto confirm".
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up" (so only you can log in).
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

### 2. Vercel (hosting)
1. Sign up at https://vercel.com with your GitHub account → **Add New → Project** → import `dua-sales-dashboard`.
2. Framework preset: **Vite** (auto-detected). Under **Environment Variables** add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon key
3. **Deploy**. You get a URL like `https://dua-sales-dashboard.vercel.app`.

### 3. Put it on your Android home screen
Open the URL in Chrome → sign in → menu **⋮ → Add to Home screen / Install app**.

### 4. Google key for the Prospect Finder (optional, ~10 minutes)
Without a key the Find screen shows sample businesses. With one, it searches real El Paso businesses.

**Cost:** each search is one "Text Search Enterprise + Atmosphere" request: $40 per 1,000, with the **first 1,000 each month free**.
About 200 searches a month comes to $0. The app also caches every search for 30 days (repeats are free) and stops at 60 searches a day.

1. Go to https://console.cloud.google.com, sign in, and **create a project** (e.g. "Dua Sales").
2. **Billing**: link a billing account (a card is required even for the free tier).
3. **APIs & Services → Library**: search **"Places API (New)"** and click **Enable**.
4. **APIs & Services → Credentials → Create credentials → API key**. Open the key, then under **API restrictions** choose **Restrict key → Places API (New)**. Save.
5. Safety nets:
   - **APIs & Services → Places API (New) → Quotas**: set **Text Search requests per day** to **60**.
   - **Billing → Budgets & alerts**: create a **$1** budget with email alerts.
6. **Vercel → your project → Settings → Environment Variables**: add `GOOGLE_PLACES_API_KEY` = your key (optional: `DAILY_SEARCH_LIMIT`, default 60). Then **Deployments → ⋯ → Redeploy**.
7. In the app, **Settings → Prospect Finder** should say "Google search connected".

The key lives only on the server (`api/places.ts`). The phone never sees it, and only your signed-in account can use it.
Social links are tap-to-open searches; nothing is scraped.

### 5. Notifications (optional, ~5 minutes)
A morning summary (around 7am El Paso time: today's visits by area, follow-ups due, clients who haven't ordered) and a midday reminder (around noon, only if follow-ups are still open). Sent by Vercel Cron (free on Hobby: two daily jobs, each fires sometime within its hour).

1. In **Vercel → Settings → Environment Variables**, add (Production):
   - `VITE_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: a push key pair (generate with `npx web-push generate-vapid-keys`)
   - `CRON_SECRET`: any long random string (Vercel sends it with each cron call)
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API Keys → **secret / service_role**. Server only; never put it in the app.
2. **Redeploy.**
3. On your phone: **Settings → Notifications → Turn on**, allow notifications, then **Send a test notification**.

Times are set in `vercel.json` (UTC): morning `0 13 * * *`, midday `0 18 * * *`.

## Development
```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN IP for phone testing)
npm run build
```
Copy `.env.example` to `.env.local` and fill in the Supabase keys to develop against the real database.

## Data & QuickBooks
`orders` is one row per order (`date`, `amount`, `qb_ref`) and `clients.qb_customer_name` stores the exact QuickBooks customer name, so a QuickBooks CSV export can later be imported and matched without changes to the data model.

## Build steps
1. ✅ Foundation — app shell, login, database schema, sample data, settings (work / warehouse days)
2. ✅ Clients — detail, quick-log, add/edit, CSV paste/import, CSV export
3. ✅ TODAY — priority ranking with "why", follow-ups, upsells, leads, Maps routes
4. ✅ Week plan — suggested plan, warehouse days, tap to move / add / remove
5. ✅ Leads pipeline + Goals
6. ✅ Prospect Finder (Google Places, cached)
7. ✅ Polish — notifications, Spanish pitches, install & shortcuts

**Game:** points for visits (10), calls (5), texts (3), sample drops (15), quotes (20), follow-ups done (5) and secured clients (100 / 200 / 350 by size: typical order × frequency). Points are computed from logged data (each action type once per client per day), so Undo removes them. Levels: Seedling → Sprout → Grower → Picker → Market Runner → Route Pro → … → Route Legend. See `src/lib/score.ts`.
