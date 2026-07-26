import type { BbbGrade, Shop, TrustBreakdownEntry, TrustScore } from '../types'

/**
 * Composite Trust Score engine.
 *
 * The whole point of this app is that star ratings alone are gameable and
 * incomplete. The composite blends nine independent signals, each normalized
 * to 0–100, then weighted per WEIGHTS below.
 *
 * A signal whose data source isn't connected (e.g. BBB for a shop that only
 * came from Google Places) is marked `available: false` and dropped from the
 * composite, which is then reweighted across the signals that remain. This
 * keeps the score honest for real businesses instead of inventing values.
 */

const UNAVAILABLE = 'Data source not connected'

function unavailable(key: string, label: string, weight: number): TrustBreakdownEntry {
  return { key, label, score: 0, weight, detail: UNAVAILABLE, available: false }
}

export const WEIGHTS = {
  reviews: 0.3,
  bbb: 0.2,
  complaints: 0.12,
  longevity: 0.08,
  certs: 0.08,
  trend: 0.06,
  warranty: 0.06,
  license: 0.06,
  consistency: 0.04,
} as const

const BBB_GRADE_SCORES: Record<BbbGrade, number> = {
  'A+': 100, A: 94, 'A-': 88,
  'B+': 78, B: 70, 'B-': 62,
  'C+': 52, C: 44, 'C-': 36,
  D: 20, F: 0,
  NR: 50, // not rated: neutral, neither reward nor punish
}

/** Bayesian-style shrinkage: a 5.0 from 4 reviews should not beat a 4.7 from 900. */
function volumeAdjustedRating(rating: number, count: number): number {
  const PRIOR_MEAN = 3.6 // typical shop average
  const PRIOR_WEIGHT = 25 // pseudo-review count
  return (rating * count + PRIOR_MEAN * PRIOR_WEIGHT) / (count + PRIOR_WEIGHT)
}

function reviewScore(shop: Shop): TrustBreakdownEntry {
  const { reviews } = shop.signals
  const totalCount = reviews.reduce((s, r) => s + r.count, 0)
  const weightedAvg =
    reviews.reduce((s, r) => s + volumeAdjustedRating(r.rating, r.count) * r.count, 0) /
    Math.max(totalCount, 1)
  // Map 1–5 stars onto 0–100 with 3.0 ≈ 50
  const score = Math.max(0, Math.min(100, ((weightedAvg - 1) / 4) * 100))
  return {
    key: 'reviews',
    label: 'Customer reviews',
    score: Math.round(score),
    weight: WEIGHTS.reviews,
    detail: `${weightedAvg.toFixed(1)}★ volume-adjusted across ${totalCount.toLocaleString()} reviews`,
    available: true,
  }
}

function bbbScore(shop: Shop): TrustBreakdownEntry {
  const { bbbGrade, bbbAccredited } = shop.signals
  if (bbbGrade === null) return unavailable('bbb', 'BBB rating', WEIGHTS.bbb)
  let score = BBB_GRADE_SCORES[bbbGrade]
  if (bbbAccredited) score = Math.min(100, score + 5)
  return {
    key: 'bbb',
    label: 'BBB rating',
    score: Math.round(score),
    weight: WEIGHTS.bbb,
    detail:
      bbbGrade === 'NR'
        ? 'Not yet rated by the BBB'
        : `BBB grade ${bbbGrade}${bbbAccredited ? ', accredited business' : ''}`,
    available: true,
  }
}

function complaintScore(shop: Shop): TrustBreakdownEntry {
  const { complaints3y, complaintResolutionRate, reviews } = shop.signals
  if (complaints3y === null || complaintResolutionRate === null)
    return unavailable('complaints', 'Complaint history', WEIGHTS.complaints)
  const totalReviews = Math.max(reviews.reduce((s, r) => s + r.count, 0), 1)
  // Complaints per 100 reviews approximates complaints relative to customer volume
  const per100 = (complaints3y / totalReviews) * 100
  const frequency = Math.max(0, 100 - per100 * 18) // ~5.5 complaints per 100 reviews → 0
  const resolution = complaintResolutionRate * 100
  const score = complaints3y === 0 ? 100 : frequency * 0.6 + resolution * 0.4
  return {
    key: 'complaints',
    label: 'Complaint history',
    score: Math.round(Math.max(0, Math.min(100, score))),
    weight: WEIGHTS.complaints,
    detail:
      complaints3y === 0
        ? 'No BBB complaints in the last 3 years'
        : `${complaints3y} complaint${complaints3y === 1 ? '' : 's'} in 3 years, ${Math.round(
            complaintResolutionRate * 100,
          )}% resolved`,
    available: true,
  }
}

function longevityScore(shop: Shop, currentYear: number): TrustBreakdownEntry {
  const { yearEstablished } = shop.signals
  if (yearEstablished === null) return unavailable('longevity', 'Years in business', WEIGHTS.longevity)
  const years = Math.max(0, currentYear - yearEstablished)
  const score = Math.min(100, (years / 25) * 100) // 25+ years = full marks
  return {
    key: 'longevity',
    label: 'Years in business',
    score: Math.round(score),
    weight: WEIGHTS.longevity,
    detail: `Serving customers since ${yearEstablished} (${years} years)`,
    available: true,
  }
}

function certificationScore(shop: Shop): TrustBreakdownEntry {
  const certs = shop.signals.certifications
  if (certs === null) return unavailable('certs', 'Certifications', WEIGHTS.certs)
  const score = Math.min(100, certs.length * 34)
  return {
    key: 'certs',
    label: 'Certifications',
    score: Math.round(score),
    weight: WEIGHTS.certs,
    detail: certs.length ? certs.join(' · ') : 'No industry certifications on file',
    available: true,
  }
}

function consistencyScore(shop: Shop): TrustBreakdownEntry {
  const ratings = shop.signals.reviews.map((r) => r.rating)
  // Needs at least two review platforms to compare; otherwise not measurable.
  if (ratings.length < 2) return unavailable('consistency', 'Cross-platform consistency', WEIGHTS.consistency)
  const spread = Math.max(...ratings) - Math.min(...ratings)
  const score = Math.max(0, 100 - spread * 55) // 1.8-star spread → 0
  return {
    key: 'consistency',
    label: 'Cross-platform consistency',
    score: Math.round(score),
    weight: WEIGHTS.consistency,
    detail:
      spread <= 0.3
        ? 'Ratings agree closely across platforms'
        : `${spread.toFixed(1)}★ spread between review platforms`,
    available: true,
  }
}

function trendScore(shop: Shop): TrustBreakdownEntry {
  const delta = shop.signals.recentDelta
  if (delta === null) return unavailable('trend', 'Rating trend', WEIGHTS.trend)
  const score = Math.max(0, Math.min(100, 50 + delta * 80))
  return {
    key: 'trend',
    label: 'Rating trend',
    score: Math.round(score),
    weight: WEIGHTS.trend,
    detail:
      delta >= 0.05
        ? `Recent reviews up ${delta.toFixed(1)}★ vs lifetime average`
        : delta <= -0.05
          ? `Recent reviews down ${Math.abs(delta).toFixed(1)}★ vs lifetime average`
          : 'Recent reviews steady vs lifetime average',
    available: true,
  }
}

function warrantyScore(shop: Shop): TrustBreakdownEntry {
  const months = shop.signals.warrantyMonths
  if (months === null) return unavailable('warranty', 'Warranty coverage', WEIGHTS.warranty)
  return {
    key: 'warranty',
    label: 'Warranty coverage',
    score: Math.round(Math.min(100, (months / 36) * 100)),
    weight: WEIGHTS.warranty,
    detail: months > 0 ? `${months}-month parts & labor warranty` : 'No posted warranty',
    available: true,
  }
}

function licenseScore(shop: Shop): TrustBreakdownEntry {
  const licensed = shop.signals.stateLicensed
  if (licensed === null) return unavailable('license', 'State licensing', WEIGHTS.license)
  return {
    key: 'license',
    label: 'State licensing',
    score: licensed ? 100 : 25,
    weight: WEIGHTS.license,
    detail: licensed ? 'State-registered repair facility' : 'No state registration on file',
    available: true,
  }
}

export function computeTrustScore(shop: Shop, now: Date = new Date()): TrustScore {
  const breakdown = [
    reviewScore(shop),
    bbbScore(shop),
    complaintScore(shop),
    longevityScore(shop, now.getFullYear()),
    certificationScore(shop),
    trendScore(shop),
    warrantyScore(shop),
    licenseScore(shop),
    consistencyScore(shop),
  ]
  // Reweight across only the signals whose data is available, so a shop with
  // fewer connected sources is scored fairly on what we actually know.
  const available = breakdown.filter((e) => e.available)
  const totalWeight = available.reduce((s, e) => s + e.weight, 0)
  const composite =
    totalWeight > 0 ? Math.round(available.reduce((s, e) => s + e.score * e.weight, 0) / totalWeight) : 0
  const tier =
    composite >= 85 ? 'excellent' : composite >= 70 ? 'good' : composite >= 55 ? 'fair' : 'caution'
  return { composite, tier, breakdown }
}

export const TIER_LABELS: Record<TrustScore['tier'], string> = {
  excellent: 'Highly trusted',
  good: 'Trusted',
  fair: 'Mixed record',
  caution: 'Proceed with caution',
}
