import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchPlacesShops } from './_places'
import { getSupabase, rowToShop, type ShopRow } from './_supabase'

/**
 * GET /api/shops?lat=&lng=&radius=
 *
 * Source chain, cheapest first:
 *   1. Own database (Overture Maps data in Supabase/PostGIS) — free per query
 *   2. Google Places proxy — costs per call, used only if the DB is
 *      unconfigured or has no coverage for the area
 *   3. 503 → the client falls back to bundled demo data
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const radius = Number(req.query.radius) || 12

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'lat and lng are required' })
    return
  }

  const supabase = getSupabase()
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('shops_within', {
        in_lat: lat,
        in_lng: lng,
        radius_m: radius * 1609.34,
      })
      if (!error && Array.isArray(data) && data.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
        res.status(200).json({ source: 'overture', shops: (data as ShopRow[]).map(rowToShop) })
        return
      }
      if (error) console.error('Supabase shops_within failed:', error.message)
    } catch (err) {
      console.error('Supabase query threw:', err)
    }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    res.status(503).json({ source: 'unavailable', reason: 'no_data_sources' })
    return
  }

  try {
    const shops = await fetchPlacesShops(apiKey, lat, lng, radius)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json({ source: 'google', shops })
  } catch (err) {
    console.error('Places fetch failed:', err)
    res.status(503).json({ source: 'unavailable', reason: 'upstream_error' })
  }
}
