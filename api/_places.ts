// Google Places API (New) → TrueWrench Shop mapping.
//
// This runs server-side only (inside the Vercel function) so the API key
// never reaches the browser. Types are imported type-only from the client
// source; the runtime shape is plain JSON.
import type { Shop, ServiceCategory, VehicleMake, WeekHours, DayHours } from '../src/types'

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby'

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.priceLevel',
  'places.types',
  'places.businessStatus',
].join(',')

interface PlacesPeriodPoint {
  day: number // 0 = Sunday … 6 = Saturday
  hour: number
  minute: number
}
interface PlacesPeriod {
  open?: PlacesPeriodPoint
  close?: PlacesPeriodPoint
}
interface Place {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  regularOpeningHours?: { periods?: PlacesPeriod[] }
  nationalPhoneNumber?: string
  websiteUri?: string
  priceLevel?: string
  types?: string[]
  businessStatus?: string
}

const PRICE_LEVEL: Record<string, 1 | 2 | 3> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 3,
}

// Category heuristics from the business name (Places' `types` only says
// "car_repair"). Ordered so the most specific label wins; falls back to general.
const CATEGORY_KEYWORDS: [ServiceCategory, RegExp][] = [
  ['body', /\b(body|collision|paint|dent)\b/i],
  ['transmission', /\btransmission|drivetrain|gearbox\b/i],
  ['tires', /\btire|wheel|alignment\b/i],
  ['exhaust', /\bmuffler|exhaust\b/i],
  ['oil', /\b(oil change|lube|quick lube)\b/i],
  ['brakes', /\bbrake|suspension\b/i],
  ['speed', /\bperformance|speed|tuning|dyno|motorsport|racing\b/i],
  ['electrical', /\belectric|diagnostic|auto electric\b/i],
  ['inspection', /\binspection|emission\b/i],
]

const SPECIALTY_KEYWORDS: [VehicleMake, RegExp][] = [
  ['bmw', /\bbmw|mini cooper\b/i],
  ['mercedes', /\bmercedes|benz\b/i],
  ['audi-vw', /\baudi|volkswagen|\bvw\b|porsche\b/i],
  ['volvo', /\bvolvo\b/i],
  ['toyota', /\btoyota|lexus|scion\b/i],
  ['honda', /\bhonda|acura\b/i],
  ['nissan', /\bnissan|infiniti|datsun\b/i],
  ['subaru', /\bsubaru\b/i],
  ['mazda', /\bmazda\b/i],
  ['ford', /\bford|lincoln|mustang\b/i],
  ['gm', /\bchevy|chevrolet|gmc|cadillac|buick\b/i],
  ['mopar', /\bdodge|\bram\b|jeep|chrysler|mopar\b/i],
  ['hyundai-kia', /\bhyundai|\bkia\b|genesis\b/i],
  ['tesla', /\btesla|\bev\b|electric vehicle\b/i],
]

function inferCategories(name: string): ServiceCategory[] {
  const hits = CATEGORY_KEYWORDS.filter(([, re]) => re.test(name)).map(([c]) => c)
  return hits.length ? hits.slice(0, 3) : ['general']
}

function inferSpecialties(name: string): VehicleMake[] | undefined {
  const hits = SPECIALTY_KEYWORDS.filter(([, re]) => re.test(name)).map(([m]) => m)
  return hits.length ? hits : undefined
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Places `periods` (can wrap past midnight / span multiple days) → simple
 *  per-day open/close. We keep the first period that opens on each weekday. */
function mapHours(periods: PlacesPeriod[] | undefined): WeekHours {
  const closed: DayHours = { open: null, close: null }
  const week: WeekHours = [closed, closed, closed, closed, closed, closed, closed].map((d) => ({
    ...d,
  })) as WeekHours
  if (!periods) return week
  for (const p of periods) {
    if (!p.open) continue
    const day = p.open.day
    if (day < 0 || day > 6 || week[day].open) continue
    week[day] = {
      open: `${pad(p.open.hour)}:${pad(p.open.minute)}`,
      close: p.close ? `${pad(p.close.hour)}:${pad(p.close.minute)}` : '23:59',
    }
  }
  return week
}

function mapPlace(place: Place): Shop | null {
  const name = place.displayName?.text
  const loc = place.location
  if (!name || !loc) return null
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') return null

  const rating = place.rating ?? 0
  const count = place.userRatingCount ?? 0

  return {
    id: place.id,
    name,
    categories: inferCategories(name),
    address: place.formattedAddress ?? '',
    phone: place.nationalPhoneNumber ?? '',
    website: place.websiteUri,
    lat: loc.latitude,
    lng: loc.longitude,
    hours: mapHours(place.regularOpeningHours?.periods),
    priceLevel: (place.priceLevel && PRICE_LEVEL[place.priceLevel]) || 2,
    specialties: inferSpecialties(name),
    blurb:
      count > 0
        ? `${rating.toFixed(1)}★ from ${count.toLocaleString()} Google reviews.`
        : 'Auto repair shop listed on Google Maps.',
    signals: {
      reviews: count > 0 ? [{ source: 'Google', rating, count }] : [],
      // Signals Google Places does not provide — left null so the Trust Score
      // marks them "not connected" and reweights, rather than inventing data.
      bbbGrade: null,
      bbbAccredited: null,
      complaints3y: null,
      complaintResolutionRate: null,
      yearEstablished: null,
      certifications: null,
      recentDelta: null,
      warrantyMonths: null,
      stateLicensed: null,
    },
  }
}

/** Fetch car-repair shops near a point from Google Places (New). Throws on
 *  a non-OK upstream response so the caller can fall back to demo data. */
export async function fetchPlacesShops(
  apiKey: string,
  lat: number,
  lng: number,
  radiusMiles: number,
): Promise<Shop[]> {
  const radiusMeters = Math.min(Math.max(radiusMiles, 1) * 1609.34, 50000)
  const res = await fetch(PLACES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ['car_repair'],
      maxResultCount: 20,
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters } },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Places API ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { places?: Place[] }
  return (data.places ?? []).map(mapPlace).filter((s): s is Shop => s !== null)
}

// Exported for unit testing the pure mapping without a network call.
export const _internal = { mapPlace, mapHours, inferCategories, inferSpecialties }
