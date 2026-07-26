export type ServiceCategory =
  | 'general'
  | 'body'
  | 'speed'
  | 'oil'
  | 'tires'
  | 'transmission'
  | 'brakes'
  | 'exhaust'
  | 'electrical'
  | 'inspection'

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  general: 'General Repair',
  body: 'Body Shop',
  speed: 'Speed & Performance',
  oil: 'Oil Change & Lube',
  tires: 'Tires & Wheels',
  transmission: 'Transmission',
  brakes: 'Brakes & Suspension',
  exhaust: 'Exhaust & Muffler',
  electrical: 'Auto Electrical',
  inspection: 'Inspection & Emissions',
}

export type BbbGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F' | 'NR'

export type Certification = 'ASE Certified' | 'AAA Approved' | 'BBB Accredited' | 'I-CAR Gold' | 'NAPA AutoCare'

/** Make families grouped by corporate sibling brands to keep the filter compact. */
export type VehicleMake =
  | 'toyota'
  | 'honda'
  | 'nissan'
  | 'subaru'
  | 'mazda'
  | 'bmw'
  | 'mercedes'
  | 'audi-vw'
  | 'volvo'
  | 'ford'
  | 'gm'
  | 'mopar'
  | 'hyundai-kia'
  | 'tesla'

export const MAKE_LABELS: Record<VehicleMake, string> = {
  toyota: 'Toyota / Lexus',
  honda: 'Honda / Acura',
  nissan: 'Nissan / Infiniti',
  subaru: 'Subaru',
  mazda: 'Mazda',
  bmw: 'BMW / MINI',
  mercedes: 'Mercedes-Benz',
  'audi-vw': 'Audi / VW / Porsche',
  volvo: 'Volvo',
  ford: 'Ford / Lincoln',
  gm: 'Chevrolet / GMC / Cadillac',
  mopar: 'Dodge / RAM / Jeep',
  'hyundai-kia': 'Hyundai / Kia / Genesis',
  tesla: 'Tesla',
}

export const MAKE_GROUPS: { group: string; makes: VehicleMake[] }[] = [
  { group: 'Japanese', makes: ['toyota', 'honda', 'nissan', 'subaru', 'mazda'] },
  { group: 'German / European', makes: ['bmw', 'mercedes', 'audi-vw', 'volvo'] },
  { group: 'American', makes: ['ford', 'gm', 'mopar'] },
  { group: 'Korean', makes: ['hyundai-kia'] },
  { group: 'Electric', makes: ['tesla'] },
]

export interface ReviewSource {
  source: 'Google' | 'Yelp' | 'Carfax'
  rating: number // 0–5
  count: number
}

/**
 * Raw trust signals gathered per shop. In production these come from the
 * data adapters (Google Places, BBB, Yelp, state licensing boards).
 *
 * Fields that a live source may not provide are `T | null`. `null` means
 * "not available" (the data source isn't connected) and is excluded from the
 * Trust Score with the composite reweighted across the signals we do have —
 * distinct from a real value like 0 complaints or an empty certifications
 * list. Demo data (seed + generator) always supplies concrete values.
 */
export interface TrustSignals {
  reviews: ReviewSource[]
  bbbGrade: BbbGrade | null
  bbbAccredited: boolean | null
  /** BBB complaints filed in the last 3 years */
  complaints3y: number | null
  /** Share of complaints the business responded to and resolved (0–1) */
  complaintResolutionRate: number | null
  yearEstablished: number | null
  certifications: Certification[] | null
  /** Recent ~12-month review average minus lifetime average (≈ −0.8…+0.8) */
  recentDelta: number | null
  /** Parts & labor warranty length; 0 = no posted warranty */
  warrantyMonths: number | null
  /** Registered/licensed repair facility with the state */
  stateLicensed: boolean | null
}

export interface DayHours {
  /** 24h clock, e.g. "08:00". null = closed that day */
  open: string | null
  close: string | null
}

/** Index 0 = Sunday … 6 = Saturday, matching Date.getDay() */
export type WeekHours = [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours]

export interface Shop {
  id: string
  name: string
  categories: ServiceCategory[]
  address: string
  phone: string
  website?: string
  lat: number
  lng: number
  /** null = hours unknown for this listing (e.g. Overture data has none) */
  hours: WeekHours | null
  /** $ to $$$; null = unknown */
  priceLevel: 1 | 2 | 3 | null
  /** Makes this shop specializes in. Empty/undefined = services all makes. */
  specialties?: VehicleMake[]
  signals: TrustSignals
  blurb: string
}

export interface TrustBreakdownEntry {
  key: string
  label: string
  /** 0–100 for this component */
  score: number
  /** weight of this component in the composite, 0–1 */
  weight: number
  detail: string
  /** false when the signal's data source isn't connected; excluded from the composite */
  available: boolean
}

export interface TrustScore {
  /** 0–100 composite */
  composite: number
  /** 'unrated' = no signal has connected data yet (score is not meaningful) */
  tier: 'excellent' | 'good' | 'fair' | 'caution' | 'unrated'
  breakdown: TrustBreakdownEntry[]
}
