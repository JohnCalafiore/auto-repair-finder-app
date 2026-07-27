import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from './_supabase.js'

/**
 * GET /api/enrich?id=&name=&lat=&lng=
 *
 * On-demand ratings enrichment for a single shop — called when a user opens
 * a shop's detail panel, not per search. Google Places `searchText` resolves
 * the shop by name near its coordinates; the result (including "no match")
 * is cached in the `enrichment` table for 30 days, so repeat opens cost
 * nothing. This is what keeps Places billing at pennies instead of dollars.
 */

const CACHE_DAYS = 30

interface EnrichResult {
  rating: number | null
  count: number | null
}

async function lookupGoogleRating(
  apiKey: string,
  name: string,
  lat: number,
  lng: number,
): Promise<EnrichResult> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.rating,places.userRatingCount',
    },
    body: JSON.stringify({
      textQuery: name,
      maxResultCount: 1,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 500 } },
    }),
  })
  if (!res.ok) throw new Error(`Places searchText ${res.status}`)
  const data = (await res.json()) as { places?: { rating?: number; userRatingCount?: number }[] }
  const place = data.places?.[0]
  return { rating: place?.rating ?? null, count: place?.userRatingCount ?? null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? '')
  const name = String(req.query.name ?? '')
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)

  if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'id, name, lat, lng are required' })
    return
  }

  const supabase = getSupabase()

  if (supabase) {
    const { data } = await supabase
      .from('enrichment')
      .select('rating, rating_count, fetched_at')
      .eq('shop_id', id)
      .maybeSingle()
    if (data && Date.now() - new Date(data.fetched_at).getTime() < CACHE_DAYS * 86400_000) {
      res.setHeader('Cache-Control', 's-maxage=86400')
      res.status(200).json({ rating: data.rating, count: data.rating_count, cached: true })
      return
    }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    res.status(200).json({ rating: null, count: null })
    return
  }

  try {
    const result = await lookupGoogleRating(apiKey, name, lat, lng)
    if (supabase) {
      // Cache hits AND misses so unmatched shops don't re-bill every open.
      await supabase.from('enrichment').upsert({
        shop_id: id,
        rating: result.rating,
        rating_count: result.count,
        fetched_at: new Date().toISOString(),
      })
    }
    res.setHeader('Cache-Control', 's-maxage=86400')
    res.status(200).json(result)
  } catch (err) {
    console.error('Enrichment failed:', err)
    res.status(200).json({ rating: null, count: null })
  }
}
