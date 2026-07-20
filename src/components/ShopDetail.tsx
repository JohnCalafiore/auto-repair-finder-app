import { CATEGORY_LABELS } from '../types'
import type { ScoredShop } from '../App'
import { DAY_NAMES, formatHoursToday } from '../lib/geo'
import { TrustGauge } from './TrustGauge'

export function ShopDetail({ scored, onClose }: { scored: ScoredShop; onClose: () => void }) {
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
          <p className="detail-sub">
            <span className={openNow ? 'open-now' : 'closed-now'}>{openNow ? 'Open now' : 'Closed'}</span>
            {' · '}
            {formatHoursToday(shop.hours)}
            {distance != null && <> · <span className="mono-num">{distance.toFixed(1)} mi</span> away</>}
            {' · '}
            {'$'.repeat(shop.priceLevel)}
          </p>
        </div>
        <TrustGauge score={trust} size={120} />
      </div>

      <p className="detail-blurb">{shop.blurb}</p>

      <section className="detail-section">
        <h3>Why this trust score</h3>
        <ul className="breakdown-list">
          {trust.breakdown.map((b) => (
            <li key={b.key} className="breakdown-row">
              <div className="breakdown-label-row">
                <span className="breakdown-label">
                  {b.label} <span className="breakdown-weight">×{Math.round(b.weight * 100)}%</span>
                </span>
                <span className="mono-num">{b.score}</span>
              </div>
              <div className="breakdown-bar">
                <div className="breakdown-bar-fill" style={{ width: `${b.score}%` }} />
              </div>
              <div className="breakdown-detail">{b.detail}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="detail-section">
        <h3>Review sources</h3>
        <ul className="source-list">
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
              {shop.signals.bbbGrade === 'NR' ? 'Not rated' : shop.signals.bbbGrade}
              {shop.signals.bbbAccredited ? ' · Accredited' : ''}
            </span>
          </li>
        </ul>
      </section>

      <section className="detail-section">
        <h3>Hours</h3>
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
    </aside>
  )
}
