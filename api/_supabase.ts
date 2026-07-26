// Server-side Supabase access + row mapping for the shops database.
// The service-role key stays in the serverless environment; RLS blocks
// everything else.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Shop, ServiceCategory, VehicleMake, WeekHours } from '../src/types'

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export interface ShopRow {
  id: string
  name: string
  categories: string[]
  address: string
  phone: string
  website: string | null
  lat: number
  lng: number
  hours: WeekHours | null
  price_level: number | null
  specialties: string[] | null
}

const CATEGORY_BLURBS: Partial<Record<ServiceCategory, string>> = {
  body: 'Body and collision shop',
  tires: 'Tire and wheel shop',
  oil: 'Oil change and lube shop',
  transmission: 'Transmission specialist',
  electrical: 'Auto electrical shop',
  inspection: 'Inspection station',
  speed: 'Performance shop',
  exhaust: 'Muffler and exhaust shop',
  brakes: 'Brake shop',
}

export function rowToShop(row: ShopRow): Shop {
  const categories = row.categories as ServiceCategory[]
  const kind = CATEGORY_BLURBS[categories[0]] ?? 'Auto repair shop'
  return {
    id: row.id,
    name: row.name,
    categories,
    address: row.address,
    phone: row.phone,
    website: row.website ?? undefined,
    lat: row.lat,
    lng: row.lng,
    hours: row.hours,
    priceLevel: (row.price_level as 1 | 2 | 3 | null) ?? null,
    specialties: (row.specialties as VehicleMake[] | null) ?? undefined,
    blurb: `${kind} — open-data listing from Overture Maps. Ratings load when the shop is opened.`,
    signals: {
      // Overture provides discovery data only; every trust signal starts
      // unconnected and fills in via enrichment / future adapters.
      reviews: [],
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
