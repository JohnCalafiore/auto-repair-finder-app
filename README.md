# TrueWrench — Auto Repair Shop Finder

Find auto repair shops on a map and judge them by more than star ratings. Every shop gets a composite **Trust Score (0–100)** that blends customer reviews with Better Business Bureau data and other business signals.

## Features

- **Interactive map** (Leaflet + OpenStreetMap — no API key required) with score-colored pins, synced to the results list
- **Service-type filters**: General Repair, Body Shop, Speed & Performance, Oil Change & Lube, Tires & Wheels, Transmission, Brakes & Suspension, Exhaust & Muffler, Auto Electrical, Inspection & Emissions
- **Trust filters**: minimum trust score, distance radius, open now, BBB-accredited only, certifications (ASE, AAA, I-CAR Gold, NAPA AutoCare)
- **Vehicle make filter** using compact corporate families (Toyota/Lexus, Honda/Acura, Nissan/Infiniti, Dodge/RAM/Jeep, Audi/VW/Porsche, …) grouped by region: specialists in the chosen family rank first, all-make generalists stay included, and shops with other specialties are excluded
- **Search** across names, addresses, and specialties; sort by trust, distance, or review volume
- **"Use my location"** geolocation that recenters the map and refreshes results around you immediately, with clear feedback when location access is blocked
- **"Search this area"** button that appears when you pan or zoom away from the last searched area
- **Shop detail panel** with a dashboard-style trust gauge, full score breakdown, per-platform ratings, BBB grade, hours, and contact info

## The Trust Score

Star ratings alone are gameable. The composite blends nine independent signals (weights in `src/lib/trustScore.ts`, documented in-app via the "What's the trust score?" window):

| Signal | Weight | What it measures |
| --- | --- | --- |
| Customer reviews | 30% | Volume-adjusted average across Google, Yelp, and Carfax (a 5.0 from 4 reviews can't beat a 4.7 from 900) |
| BBB rating | 20% | Letter grade A+–F, plus accreditation bonus |
| Complaint history | 12% | BBB complaints relative to customer volume, and whether the shop resolves them |
| Years in business | 8% | Longevity as a proxy for repeat customers |
| Certifications | 8% | ASE, AAA Approved, I-CAR Gold, NAPA AutoCare, BBB accreditation |
| Rating trend | 6% | Recent ~12-month review average vs lifetime (catches decline under new ownership) |
| Warranty coverage | 6% | Length of the posted parts & labor warranty |
| State licensing | 6% | Registered/licensed repair facility with the state |
| Cross-platform consistency | 4% | Whether ratings agree between platforms (big spreads suggest manipulation) |

The engine lives in `src/lib/trustScore.ts` and is source-agnostic — every component shows its inputs in the UI ("Why this trust score"), so users see the receipts, not just a number. When a signal's data source isn't connected for a shop (for example, BBB data on a Google-only result), that signal is marked "Data source not connected" and the composite is reweighted across the signals that are available, rather than inventing a value.

## Data architecture

Discovery is self-hosted; paid APIs are enrichment only. `/api/shops` tries sources cheapest-first:

1. **Own database** — Overture Maps places data (~US auto-repair businesses) in **Supabase/PostGIS**, queried by radius (`shops_within`). Free per query; this is what searches hit.
2. **Google Places (New)** — server-side proxy fallback when the DB is unconfigured or has no coverage.
3. **Demo data** — bundled Philadelphia seed + deterministic generator (`src/data/generator.ts`), shown with a banner, so the map never breaks.

Ratings are fetched **on demand**: opening a shop's detail panel calls `/api/enrich`, which resolves the shop's Google rating once and caches it in the `enrichment` table for 30 days. Cost scales with detail-opens (pennies), not searches. Shops with no connected signals show as "Not yet rated" (gray) rather than being scored on invented data.

### Database

Supabase project with PostGIS: `shops` (Overture data, GIST-indexed geography), `enrichment` (cached ratings incl. negative results), `trust_signals` (BBB/licensing — reserved for future batch imports). RLS is enabled with no anon policies; only serverless functions with the service-role key can read.

### Ingest (Overture → Supabase)

`.github/workflows/ingest-overture.yml` runs monthly (and on manual dispatch): DuckDB reads the Overture places parquet from public S3, `scripts/ingest_overture.py` filters US auto-repair categories and maps them to the app's taxonomy, and the CSV is upserted via `psql` (Overture GERS ids are stable across releases, so enrichment survives refreshes). Requires the `SUPABASE_DB_URL` repo secret. `scripts/load_seed_from_url.sql` can seed a fresh DB from the committed Philadelphia extract (`public/seed/philly_shops.json`, 1,976 real shops) before the first full run.

### Environment variables (Vercel → Settings → Environment Variables)

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL (shops + enrichment queries) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key, server-side only |
| `GOOGLE_PLACES_API_KEY` | Ratings enrichment + discovery fallback (optional but recommended) |

GitHub repo secret `SUPABASE_DB_URL` (Postgres connection string) powers the ingest workflow. No secret is ever committed.

### Remaining adapters

- **Yelp Fusion** — second review source (enables cross-platform consistency)
- **BBB partner/licensed data** — grade, accreditation, complaints
- **State licensing boards** — licensing status into `trust_signals`

Until then those rows show "Data source not connected" for live shops, and the composite reweights across what's available.

### Local development

`npm run dev` (plain Vite) has no serverless functions, so it always shows demo data. To exercise `/api/shops` and `/api/enrich` locally, use `vercel dev` with the env vars in a local `.env`.

### Scale note

The map currently uses OpenStreetMap's public tile servers, which are not intended for heavy production traffic — before real scale, switch to self-hosted tiles (Protomaps/PMTiles) or a provider like MapTiler.

## Run it

```bash
npm install
npm run dev            # dev server at http://localhost:5173 (demo data only)
npm run build          # type-check + production build to dist/
npm run typecheck:api  # type-check the serverless functions in api/
```

## Stack

React 19 · TypeScript · Vite · Leaflet / react-leaflet · OpenStreetMap tiles · Vercel serverless functions · Google Places API (New)
