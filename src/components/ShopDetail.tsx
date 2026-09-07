import { useState, type FormEvent } from 'react'
import { CATEGORY_LABELS, MAKE_LABELS } from '../types'
import type { ScoredShop } from '../App'
import { DAY_NAMES, formatHoursToday } from '../lib/geo'
import { TrustGauge } from './TrustGauge'

/**
 * "Is this your shop?" lead capture. Posts to /api/claim and swaps to a
 * thank-you line on success. Deliberately minimal: no verification, no
 * account — the row in `shop_claims` is the whole feature.
 */
function ClaimListing({ shopId, shopName }: { shopId: string; shopName: string }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState(shopName)
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, businessName, contactName, email, phone, message }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.ok && data.ok) {
        setDone(true)
      } else {
        setError(data.error ?? 'Could not send your claim. Please try again.')
      }
    } catch {
      setError('Could not send your claim. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="detail-section">
      <h3>Is this your shop?</h3>
      {done ? (
        <p className="claim-done">Thanks, we'll be in touch.</p>
      ) : !open ? (
        <>
          <p className="claim-intro">
            Claim this listing to keep its details current and be first to hear about verified badges.
          </p>
          <button type="button" className="directions-btn claim-btn" onClick={() => setOpen(true)}>
            Claim your listing
          </button>
        </>
      ) : (
        <form className="claim-form" onSubmit={submit}>
          <label>
            Business name
            <input
              required
              maxLength={120}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </label>
          <label>
            Your name
            <input
              required
              maxLength={120}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Phone (optional)
            <input
              type="tel"
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </label>
          <label>
            Anything we should know? (optional)
            <textarea maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          {error && (
            <p className="claim-error" role="alert">
              {error}
            </p>
          )}
          <div className="claim-actions">
            <button type="submit" className="directions-btn claim-btn" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send claim'}
            </button>
            <button type="button" className="claim-cancel" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

export function ShopDetail({
  scored,
  enriching = false,
  canClaim = false,
  onClose,
  onShowTrustInfo,
}: {
  scored: ScoredShop
  enriching?: boolean
  /** Real listings only — demo and generated shops are not claimable */
  canClaim?: boolean
  onClose: () => void
  onShowTrustInfo: () => void
}) {
  const { shop, trust, distance, openNow } = scored
  return (
    <aside className="detail-panel" aria-label={`Details for ${shop.name}`}>
      <button className="detail-close" onClick={onClose} aria-label="Close details">
        ✕
      </button>

      <div className="detail-head">
        <div>
          <h2 className="detail-name">{shop.name}</h2>
          <p className="detail-cats">{shop.categories.map((c) => CATEGORY_LABELS[c]).join(' · ')}</p>
          {shop.specialties && shop.specialties.length > 0 && (
            <p className="detail-cats specialty-line">
              Specializes in {shop.specialties.map((m) => MAKE_LABELS[m]).join(' · ')}
            </p>
          )}
          <p className="detail-sub">
            <span className={openNow ? 'open-now' : 'closed-now'}>{openNow ? 'Open now' : 'Closed'}</span>
            {' · '}
            {formatHoursToday(shop.hours)}
            {distance != null && <> · <span className="mono-num">{distance.toFixed(1)} mi</span> away</>}
            {shop.priceLevel != null && <> {' · '}{'$'.repeat(shop.priceLevel)}</>}
          </p>
        </div>
        <TrustGauge score={trust} size={120} />
      </div>

      <p className="detail-blurb">{shop.blurb}</p>

      <section className="detail-section">
        <h3>
          Why this trust score
          <button className="info-btn" onClick={onShowTrustInfo} aria-label="How the trust score works" title="How the trust score works">
            ⓘ
          </button>
        </h3>
        <ul className="breakdown-list">
          {trust.breakdown.map((b) => (
            <li key={b.key} className={`breakdown-row ${b.available ? '' : 'breakdown-unavailable'}`}>
              <div className="breakdown-label-row">
                <span className="breakdown-label">
                  {b.label} <span className="breakdown-weight">×{Math.round(b.weight * 100)}%</span>
                </span>
                <span className="mono-num">{b.available ? b.score : '—'}</span>
              </div>
              <div className="breakdown-bar">
                {b.available && <div className="breakdown-bar-fill" style={{ width: `${b.score}%` }} />}
              </div>
              <div className="breakdown-detail">{b.detail}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="detail-section">
        <h3>Review sources</h3>
        <ul className="source-list">
          {enriching && (
            <li className="enriching-row">
              <span>Google</span>
              <span className="mono-num">Fetching rating…</span>
            </li>
          )}
          {!enriching && shop.signals.reviews.length === 0 && (
            <li className="enriching-row">
              <span>Google</span>
              <span className="mono-num">No rating found</span>
            </li>
          )}
          {shop.signals.reviews.map((r) => (
            <li key={r.source}>
              <span>{r.source}</span>
              <span className="mono-num">
                {r.rating.toFixed(1)}★ ({r.count.toLocaleString()})
              </span>
            </li>
          ))}
          <li>
            <span>Better Business Bureau</span>
            <span className="mono-num">
              {shop.signals.bbbGrade === null
                ? 'Not connected'
                : shop.signals.bbbGrade === 'NR'
                  ? 'Not rated'
                  : shop.signals.bbbGrade}
              {shop.signals.bbbAccredited ? ' · Accredited' : ''}
            </span>
          </li>
        </ul>
      </section>

      <section className="detail-section">
        <h3>Hours</h3>
        {shop.hours ? (
          <ul className="hours-list">
            {shop.hours.map((d, i) => (
              <li key={i} className={new Date().getDay() === i ? 'hours-today' : ''}>
                <span>{DAY_NAMES[i]}</span>
                <span className="mono-num">
                  {d.open && d.close ? `${d.open} – ${d.close}` : 'Closed'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-contact">Hours unavailable for this listing — call ahead.</p>
        )}
      </section>

      <section className="detail-section">
        <h3>Contact</h3>
        <p className="detail-contact">{shop.address}</p>
        <p className="detail-contact">
          <a href={`tel:${shop.phone.replace(/[^\d]/g, '')}`}>{shop.phone}</a>
          {shop.website && (
            <>
              {' · '}
              <a href={shop.website} target="_blank" rel="noreferrer">
                Website
              </a>
            </>
          )}
        </p>
        <a
          className="directions-btn"
          href={`https://www.openstreetmap.org/directions?to=${shop.lat}%2C${shop.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          Get directions
        </a>
      </section>

      {canClaim && <ClaimListing key={shop.id} shopId={shop.id} shopName={shop.name} />}
    </aside>
  )
}
