import type { VercelRequest, VercelResponse } from '@vercel/node'
// Explicit .js extensions: these run as native Node ES modules on Vercel,
// where extensionless relative imports fail at runtime.
import { getSupabase } from './_supabase.js'
import { SHOPS as DEMO_SHOPS } from '../src/data/shops.js'

/**
 * POST /api/claim
 *
 * Lead capture for shop owners: "Is this your shop?" A claim is a row in
 * `shop_claims`, nothing more — no verification, no account, no email.
 * The table has RLS enabled with no policies, so only this function (with
 * the service-role key) can write to it.
 *
 * The request body is never logged: it contains a person's contact details.
 */

const LIMITS = {
  businessName: 120,
  contactName: 120,
  email: 254,
  phone: 40,
  message: 1000,
} as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Ids of fabricated shops: the hand-written demo set and the generator's `gen-…` ids. */
const DEMO_IDS = new Set(DEMO_SHOPS.map((s) => s.id))

interface ClaimBody {
  shopId?: unknown
  businessName?: unknown
  contactName?: unknown
  email?: unknown
  phone?: unknown
  message?: unknown
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let body: ClaimBody
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {}
  } catch {
    res.status(400).json({ error: 'Body must be JSON' })
    return
  }

  const shopId = str(body.shopId)
  const businessName = str(body.businessName)
  const contactName = str(body.contactName)
  const email = str(body.email)
  const phone = str(body.phone)
  const message = str(body.message)

  if (!shopId || !businessName || !contactName || !email) {
    res.status(400).json({ error: 'shopId, businessName, contactName and email are required' })
    return
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Enter a valid email address' })
    return
  }
  if (
    businessName.length > LIMITS.businessName ||
    contactName.length > LIMITS.contactName ||
    email.length > LIMITS.email ||
    phone.length > LIMITS.phone ||
    message.length > LIMITS.message
  ) {
    res.status(400).json({ error: 'One or more fields are too long' })
    return
  }
  if (shopId.startsWith('gen-') || DEMO_IDS.has(shopId)) {
    res.status(400).json({ error: 'Demonstration listings cannot be claimed' })
    return
  }

  const supabase = getSupabase()
  if (!supabase) {
    res.status(503).json({ error: 'Claims are not available right now: database is not configured' })
    return
  }

  const { error } = await supabase.from('shop_claims').insert({
    shop_id: shopId,
    business_name: businessName,
    contact_name: contactName,
    email,
    phone: phone || null,
    message: message || null,
  })
  if (error) {
    // Log the failure class only — never the submitted fields.
    console.error('shop_claims insert failed:', error.code ?? 'unknown')
    res.status(500).json({ error: 'Could not save your claim. Please try again.' })
    return
  }

  res.status(200).json({ ok: true })
}
