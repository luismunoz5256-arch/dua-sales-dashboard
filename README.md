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
2. Clients — detail, quick-log, add/edit, CSV paste/import, CSV export
3. TODAY — priority ranking with "why", follow-ups, upsells, leads, Maps routes
4. Week plan — suggested plan, warehouse days, drag to adjust
5. Leads pipeline + Goals
6. Prospect Finder (Google Places, cached)
7. Polish — weights in settings, notifications, install
