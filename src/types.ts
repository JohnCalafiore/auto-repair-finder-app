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

export type VehicleMake =
  | 'Toyota'
  | 'Lexus'
  | 'Honda'
  | 'Nissan'
  | 'Subaru'
  | 'Mazda'
  | 'BMW'
  | 'Mercedes-Benz'
  | 'Audi'
  | 'Volkswagen'
  | 'Porsche'
  | 'Volvo'
  | 'Ford'
  | 'Chevrolet'
  | 'Dodge'
  | 'Jeep'
  | 'Hyundai'
  | 'Kia'
  | 'Tesla'

export const MAKE_GROUPS: { group: string; makes: VehicleMake[] }[] = [
  { group: 'Japanese', makes: ['Toyota', 'Lexus', 'Honda', 'Nissan', 'Subaru', 'Mazda'] },
  { group: 'German / European', makes: ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Volvo'] },
  { group: 'American', makes: ['Ford', 'Chevrolet', 'Dodge', 'Jeep'] },
  { group: 'Korean', makes: ['Hyundai', 'Kia'] },
  { group: 'Electric', makes: ['Tesla'] },
]

export interface ReviewSource {
  source: 'Google' | 'Yelp' | 'Carfax'
  rating: number // 0–5
  count: number
}

/** Raw trust signals gathered per shop. In production these come from
 *  the data adapters (Google Places, BBB, Yelp, state licensing boards). */
export interface TrustSignals {
  reviews: ReviewSource[]
  bbbGrade: BbbGrade
  bbbAccredited: boolean
  /** BBB complaints filed in the last 3 years */
  complaints3y: number
  /** Share of complaints the business responded to and resolved (0–1) */
  complaintResolutionRate: number
  yearEstablished: number
  certifications: Certification[]
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
  hours: WeekHours
  priceLevel: 1 | 2 | 3 // $ to $$$
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
}

export interface TrustScore {
  /** 0–100 composite */
  composite: number
  tier: 'excellent' | 'good' | 'fair' | 'caution'
  breakdown: TrustBreakdownEntry[]
}
