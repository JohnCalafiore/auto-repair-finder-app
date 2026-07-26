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

## Data sources

Live shops come from the **Google Places API (New)** through a serverless proxy (`api/shops.ts`) so the API key never reaches the browser. The client talks only to the `ShopDataAdapter` interface (`src/data/adapters.ts`); `RemotePlacesAdapter` calls the proxy, and on any failure — no key configured, network error, empty result — falls back to the bundled demo data (a curated 23-shop Philadelphia set plus a deterministic generator in `src/data/generator.ts`) with a visible "demonstration data" banner.

### Enabling live Google Places data

1. In Google Cloud, create a project, enable **Places API (New)**, and enable billing.
2. Create an API key (restrict it to Places API (New)).
3. In Vercel → your project → **Settings → Environment Variables**, add `GOOGLE_PLACES_API_KEY` (Production + Preview). Redeploy.
4. Smoke-test: `GET /api/shops?lat=39.95&lng=-75.16&radius=5` should return `{"source":"google", ...}`.

The secret is read only from `process.env` at runtime and is never committed.

Places supplies name, location, hours, phone, website, Google rating + review count, and price. Service categories and make specialties are inferred heuristically from the business name. The remaining Trust Score signals are populated by adapters not yet built:

- **Yelp Fusion API** — Yelp ratings and review counts (adds cross-platform consistency)
- **BBB partner/licensed data** — letter grade, accreditation, complaints and resolutions
- **State licensing boards / Carfax** — licensing, warranty, and additional signals

Until those are added, their rows show "Data source not connected" for live shops.

### Local development

`npm run dev` (plain Vite) has no serverless functions, so it always shows demo data. To exercise the live `/api/shops` proxy locally, use `vercel dev` with `GOOGLE_PLACES_API_KEY` set in a local `.env`.

## Run it

```bash
npm install
npm run dev            # dev server at http://localhost:5173 (demo data only)
npm run build          # type-check + production build to dist/
npm run typecheck:api  # type-check the serverless functions in api/
```

## Stack

React 19 · TypeScript · Vite · Leaflet / react-leaflet · OpenStreetMap tiles · Vercel serverless functions · Google Places API (New)
