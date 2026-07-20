import type { BbbGrade, Shop, TrustBreakdownEntry, TrustScore } from '../types'

/**
 * Composite Trust Score engine.
 *
 * The whole point of this app is that star ratings alone are gameable and
 * incomplete. The composite blends six independent signals, each normalized
 * to 0–100, then weighted:
 *
 *   35%  Customer reviews (volume-adjusted across Google / Yelp / Carfax)
 *   25%  BBB rating + accreditation
 *   15%  Complaint history (frequency + how the shop resolves them)
 *   10%  Longevity (years in business)
 *   10%  Certifications (ASE, AAA, I-CAR, NAPA)
 *    5%  Cross-platform consistency (do ratings agree between sources?)
 */

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
    weight: 0.35,
    detail: `${weightedAvg.toFixed(1)}★ volume-adjusted across ${totalCount.toLocaleString()} reviews`,
  }
}

function bbbScore(shop: Shop): TrustBreakdownEntry {
  const { bbbGrade, bbbAccredited } = shop.signals
  let score = BBB_GRADE_SCORES[bbbGrade]
  if (bbbAccredited) score = Math.min(100, score + 5)
  return {
    key: 'bbb',
    label: 'BBB rating',
    score: Math.round(score),
    weight: 0.25,
    detail:
      bbbGrade === 'NR'
        ? 'Not yet rated by the BBB'
        : `BBB grade ${bbbGrade}${bbbAccredited ? ', accredited business' : ''}`,
  }
}

function complaintScore(shop: Shop): TrustBreakdownEntry {
  const { complaints3y, complaintResolutionRate, reviews } = shop.signals
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
    weight: 0.15,
    detail:
      complaints3y === 0
        ? 'No BBB complaints in the last 3 years'
        : `${complaints3y} complaint${complaints3y === 1 ? '' : 's'} in 3 years, ${Math.round(
            complaintResolutionRate * 100,
          )}% resolved`,
  }
}

function longevityScore(shop: Shop, currentYear: number): TrustBreakdownEntry {
  const years = Math.max(0, currentYear - shop.signals.yearEstablished)
  const score = Math.min(100, (years / 25) * 100) // 25+ years = full marks
  return {
    key: 'longevity',
    label: 'Years in business',
    score: Math.round(score),
    weight: 0.1,
    detail: `Serving customers since ${shop.signals.yearEstablished} (${years} years)`,
  }
}

function certificationScore(shop: Shop): TrustBreakdownEntry {
  const certs = shop.signals.certifications
  const score = Math.min(100, certs.length * 34)
  return {
    key: 'certs',
    label: 'Certifications',
    score: Math.round(score),
    weight: 0.1,
    detail: certs.length ? certs.join(' · ') : 'No industry certifications on file',
  }
}

function consistencyScore(shop: Shop): TrustBreakdownEntry {
  const ratings = shop.signals.reviews.map((r) => r.rating)
  if (ratings.length < 2) {
    return {
      key: 'consistency',
      label: 'Cross-platform consistency',
      score: 50,
      weight: 0.05,
      detail: 'Only one review source available',
    }
  }
  const spread = Math.max(...ratings) - Math.min(...ratings)
  const score = Math.max(0, 100 - spread * 55) // 1.8-star spread → 0
  return {
    key: 'consistency',
    label: 'Cross-platform consistency',
    score: Math.round(score),
    weight: 0.05,
    detail:
      spread <= 0.3
        ? 'Ratings agree closely across platforms'
        : `${spread.toFixed(1)}★ spread between review platforms`,
  }
}

export function computeTrustScore(shop: Shop, now: Date = new Date()): TrustScore {
  const breakdown = [
    reviewScore(shop),
    bbbScore(shop),
    complaintScore(shop),
    longevityScore(shop, now.getFullYear()),
    certificationScore(shop),
    consistencyScore(shop),
  ]
  const composite = Math.round(breakdown.reduce((s, e) => s + e.score * e.weight, 0))
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
