import type {
  BbbGrade,
  Certification,
  ServiceCategory,
  Shop,
  VehicleMake,
  WeekHours,
} from '../types'

/**
 * Deterministic demo-shop generator.
 *
 * Until live data sources (Google Places / Yelp / BBB) are wired in, the app
 * still needs to feel real when the user searches outside the curated
 * Philadelphia seed area. This module synthesizes plausible shops around any
 * point on the map. Generation is seeded from a quantized lat/lng cell, so
 * the same area always produces the same shops — pan away and back, or
 * reload, and the results are stable.
 */

const PREFIXES = [
  'Summit', 'Cedar', 'Riverside', 'Union', 'Keystone', 'Pinnacle', 'Redline',
  'Iron Horse', 'Crossroads', 'Beacon', 'Anchor', 'Milestone', 'Blue Ridge',
  'Falcon', 'Granite', 'Lakeside', 'Victory', 'Precision', 'Heritage', 'Apex',
]

const SUFFIXES: Record<ServiceCategory, string[]> = {
  general: ['Auto Care', 'Auto Clinic', 'Motor Works', 'Garage', 'Automotive'],
  body: ['Collision Center', 'Auto Body', 'Body & Paint'],
  speed: ['Performance', 'Speed Shop', 'Tuning Co.'],
  oil: ['Quick Lube', 'Express Lube', 'Oil & Filter'],
  tires: ['Tire & Wheel', 'Tire Co.', 'Tire Center'],
  transmission: ['Transmission Specialists', 'Transmission & Drivetrain'],
  brakes: ['Brake & Suspension', 'Brake Shop'],
  exhaust: ['Muffler & Exhaust', 'Exhaust Works'],
  electrical: ['Auto Electric', 'Diagnostics'],
  inspection: ['Inspection Station', 'Test & Tune'],
}

const STREETS = [
  'Main St', 'Market St', 'Broad Ave', 'Mill Rd', 'Oak Ave', 'Ridge Rd',
  'Park Ave', 'Depot St', 'Center St', 'Lincoln Hwy', 'River Rd', 'Church Rd',
]

const BLURBS = [
  'Neighborhood shop with a loyal following. Estimates in writing before any work starts.',
  'Fast turnaround on routine work; larger jobs are scheduled within the week.',
  'Straightforward pricing posted at the counter. No pressure on add-on services.',
  'Second-generation shop that texts photos of every finding before repairs.',
  'Popular with commuters — early drop-off and a key drop for after-hours pickup.',
  'Small crew, careful work. Expect a wait for an appointment at busy times.',
  'Handles fleets and daily drivers alike. Warranty on parts and labor.',
  'Reviews praise honest diagnostics; some mention limited waiting-room comfort.',
]

const GRADE_POOL: BbbGrade[] = ['A+', 'A+', 'A', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'NR', 'NR']
const CERT_POOL: Certification[] = ['ASE Certified', 'AAA Approved', 'BBB Accredited', 'I-CAR Gold', 'NAPA AutoCare']
const MAKE_POOL: VehicleMake[] = [
  'toyota', 'honda', 'nissan', 'subaru', 'mazda', 'bmw', 'mercedes', 'audi-vw',
  'volvo', 'ford', 'gm', 'mopar', 'hyundai-kia', 'tesla',
]
const CATEGORY_POOL: ServiceCategory[] = [
  'general', 'general', 'general', 'body', 'speed', 'oil', 'oil', 'tires',
  'transmission', 'brakes', 'exhaust', 'electrical', 'inspection',
]

/** Small, fast, deterministic PRNG. */
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateShopsAround(center: { lat: number; lng: number }, radiusMiles: number): Shop[] {
  // ~0.02° cells (≈1.4 mi): any "Search this area" move lands in a new cell
  const cellKey = `${Math.round(center.lat / 0.02)}:${Math.round(center.lng / 0.02)}`
  let seedNum = 0
  for (const ch of cellKey) seedNum = (seedNum * 31 + ch.charCodeAt(0)) | 0
  const rnd = mulberry32(seedNum)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
  const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))
  const round1 = (n: number) => Math.round(n * 10) / 10

  const count = int(12, 16)
  const spread = Math.min(radiusMiles, 8)
  const shops: Shop[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < count; i++) {
    const primary = pick(CATEGORY_POOL)
    let name = `${pick(PREFIXES)} ${pick(SUFFIXES[primary])}`
    while (usedNames.has(name)) name = `${pick(PREFIXES)} ${pick(SUFFIXES[primary])}`
    usedNames.add(name)

    const angle = rnd() * Math.PI * 2
    const dist = 0.4 + rnd() * (spread - 0.4)
    const lat = center.lat + (dist / 69) * Math.cos(angle)
    const lng = center.lng + (dist / (69 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(angle)

    const categories = new Set<ServiceCategory>([primary])
    while (rnd() < 0.45 && categories.size < 3) categories.add(pick(CATEGORY_POOL))

    const googleRating = 3.2 + rnd() * 1.7
    const googleCount = int(40, 700)
    const yelpRating = Math.max(2.2, googleRating - rnd() * 0.8)
    const grade = pick(GRADE_POOL)
    const goodGrade = grade === 'A+' || grade === 'A' || grade === 'A-'
    const certifications = new Set<Certification>()
    while (rnd() < (goodGrade ? 0.6 : 0.25) && certifications.size < 3) certifications.add(pick(CERT_POOL))

    let specialties: VehicleMake[] | undefined
    if (rnd() < 0.3) {
      const set = new Set<VehicleMake>([pick(MAKE_POOL)])
      while (rnd() < 0.5 && set.size < 3) set.add(pick(MAKE_POOL))
      specialties = [...set]
    }

    const open = pick(['07:00', '07:30', '08:00', '08:30', '09:00'])
    const close = pick(['17:00', '17:30', '18:00', '18:30', '19:00'])
    const day = { open, close }
    const hours: WeekHours = [
      rnd() < 0.2 ? { open: '09:00', close: '15:00' } : { open: null, close: null },
      day, day, day, day, day,
      rnd() < 0.6 ? { open: '08:00', close: '14:00' } : { open: null, close: null },
    ]

    shops.push({
      id: `gen-${cellKey}-${i}`,
      name,
      categories: [...categories],
      address: `${int(100, 9800)} ${pick(STREETS)}`,
      phone: `(555) 555-01${String(int(0, 99)).padStart(2, '0')}`,
      lat,
      lng,
      hours,
      priceLevel: pick([1, 1, 2, 2, 2, 3]) as 1 | 2 | 3,
      specialties,
      blurb: pick(BLURBS),
      signals: {
        reviews: [
          { source: 'Google', rating: round1(googleRating), count: googleCount },
          { source: 'Yelp', rating: round1(yelpRating), count: int(10, Math.max(20, Math.floor(googleCount / 3))) },
        ],
        bbbGrade: grade,
        bbbAccredited: goodGrade && rnd() < 0.5,
        complaints3y: goodGrade ? int(0, 3) : int(2, 15),
        complaintResolutionRate: Math.round((goodGrade ? 0.6 + rnd() * 0.4 : rnd() * 0.7) * 100) / 100,
        yearEstablished: int(1975, 2022),
        certifications: [...certifications],
      },
    })
  }
  return shops
}
