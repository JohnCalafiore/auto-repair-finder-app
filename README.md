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

Star ratings alone are gameable. The composite blends six independent signals:

| Signal | Weight | What it measures |
| --- | --- | --- |
| Customer reviews | 35% | Volume-adjusted average across Google, Yelp, and Carfax (a 5.0 from 4 reviews can't beat a 4.7 from 900) |
| BBB rating | 25% | Letter grade A+–F, plus accreditation bonus |
| Complaint history | 15% | BBB complaints relative to customer volume, and whether the shop resolves them |
| Years in business | 10% | Longevity as a proxy for repeat customers |
| Certifications | 10% | ASE, AAA Approved, I-CAR Gold, NAPA AutoCare |
| Cross-platform consistency | 5% | Whether ratings agree between platforms (big spreads suggest manipulation) |

The engine lives in `src/lib/trustScore.ts` and is source-agnostic — every component shows its inputs in the UI ("Why this trust score"), so users see the receipts, not just a number.

## Data

The app currently ships with a realistic curated seed dataset (23 shops around Philadelphia, PA) so it runs with zero configuration. Searching anywhere outside the seeded area — via "Use my location" or "Search this area" — synthesizes deterministic demo shops around that point (`src/data/generator.ts`), so the whole map is usable before live APIs are connected; the same area always produces the same shops. The UI talks only to the `ShopDataAdapter` interface in `src/data/adapters.ts`; wiring in live data is a drop-in change behind a small backend:

- **Google Places API** — shop discovery, geocoding, Google ratings, hours
- **Yelp Fusion API** — Yelp ratings and review counts
- **BBB partner/licensed data** — letter grade, accreditation, complaints and resolutions
- **Carfax Service Shops / state licensing boards** — additional trust signals

## Run it

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build to dist/
```

## Stack

React 19 · TypeScript · Vite · Leaflet / react-leaflet · OpenStreetMap tiles
