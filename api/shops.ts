import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchPlacesShops } from './_places'

/**
 * GET /api/shops?lat=&lng=&radius=
 *
 * Proxies Google Places (New) so the API key stays server-side. Returns
 * { source: 'google', shops } on success. When the key is missing or the
 * upstream call fails, responds 503 { source: 'unavailable' } and the client
 * falls back to demo data.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const radius = Number(req.query.radius) || 12

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'lat and lng are required' })
    return
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    res.status(503).json({ source: 'unavailable', reason: 'no_api_key' })
    return
  }

  try {
    const shops = await fetchPlacesShops(apiKey, lat, lng, radius)
    // Cache at the edge for 5 minutes to keep Places billing down.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json({ source: 'google', shops })
  } catch (err) {
    console.error('Places fetch failed:', err)
    res.status(503).json({ source: 'unavailable', reason: 'upstream_error' })
  }
}
