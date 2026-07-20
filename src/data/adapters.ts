import type { Shop } from '../types'
import { SHOPS } from './shops'
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
export interface ShopDataAdapter {
  /** Fetch shops near a point. Radius in miles. */
  fetchShops(center: { lat: number; lng: number }, radiusMiles: number): Promise<Shop[]>
}

export class LocalSeedAdapter implements ShopDataAdapter {
  async fetchShops(center: { lat: number; lng: number }, radiusMiles: number): Promise<Shop[]> {
    return SHOPS.filter((s) => distanceMiles(center, { lat: s.lat, lng: s.lng }) <= radiusMiles)
  }
}

export const dataAdapter: ShopDataAdapter = new LocalSeedAdapter()
