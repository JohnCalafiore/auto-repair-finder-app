import type { Shop } from '../types'
import { SHOPS } from './shops'
import { generateShopsAround } from './generator'
import { distanceMiles } from '../lib/geo'

/**
 * Data adapter layer.
 *
 * The UI only ever talks to a ShopDataAdapter, so swapping the bundled seed
 * data for live sources is a drop-in change. A production deployment would
 * compose several adapters behind a small backend (keys must not ship to the
 * browser):
 *
 *  - Google Places API  → shop discovery, geocoding, Google ratings, hours
 *  - Yelp Fusion API    → Yelp ratings and review counts
 *  - BBB (via partner API or licensed data feed) → letter grade,
 *    accreditation, complaint counts and resolution outcomes
 *  - Carfax Service Shops / state licensing boards → additional signals
 *
 * Each source maps onto the TrustSignals fields in src/types.ts; the trust
 * engine (src/lib/trustScore.ts) is source-agnostic and needs no changes
 * when adapters are added.
 */
export type DataSource = 'overture' | 'google' | 'demo'

export interface ShopResult {
  shops: Shop[]
  source: DataSource
}

export interface ShopDataAdapter {
  /** Fetch shops near a point. Radius in miles. */
  fetchShops(center: { lat: number; lng: number }, radiusMiles: number): Promise<ShopResult>
}

export class LocalSeedAdapter implements ShopDataAdapter {
  async fetchShops(center: { lat: number; lng: number }, radiusMiles: number): Promise<ShopResult> {
    const curated = SHOPS.filter((s) => distanceMiles(center, { lat: s.lat, lng: s.lng }) <= radiusMiles)
    // Outside the curated seed area, synthesize deterministic demo shops so
    // "Use my location" and "Search this area" work anywhere on the map.
    const shops = curated.length >= 6 ? curated : [...curated, ...generateShopsAround(center, radiusMiles)]
    return { shops, source: 'demo' }
  }
}

/**
 * Talks to the /api/shops serverless proxy for live Google Places results.
 * Any failure — no API key configured, network error, empty response — falls
 * back to the local demo data so the map is never blank.
 */
export class RemotePlacesAdapter implements ShopDataAdapter {
  private fallback = new LocalSeedAdapter()

  async fetchShops(center: { lat: number; lng: number }, radiusMiles: number): Promise<ShopResult> {
    try {
      const res = await fetch(
        `/api/shops?lat=${center.lat}&lng=${center.lng}&radius=${radiusMiles}`,
      )
      if (res.ok) {
        const data = (await res.json()) as { source?: string; shops?: Shop[] }
        if (
          (data.source === 'overture' || data.source === 'google') &&
          data.shops &&
          data.shops.length > 0
        ) {
          return { shops: data.shops, source: data.source }
        }
      }
    } catch {
      // fall through to demo data
    }
    return this.fallback.fetchShops(center, radiusMiles)
  }
}

export const dataAdapter: ShopDataAdapter = new RemotePlacesAdapter()
