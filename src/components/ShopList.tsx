import { CATEGORY_LABELS, MAKE_LABELS } from '../types'
import type { ScoredShop } from '../App'
import { formatHoursToday } from '../lib/geo'
import { TIER_LABELS } from '../lib/trustScore'

export function ShopList({
  shops,
  selectedId,
  onSelect,
}: {
  shops: ScoredShop[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (shops.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-title">No shops match these filters</p>
        <p>Widen the distance, lower the minimum trust score, or clear a service type to see more results.</p>
      </div>
    )
  }
  return (
    <ul className="shop-list">
      {shops.map((s) => (
        <li key={s.shop.id}>
          <button
            className={`shop-card ${selectedId === s.shop.id ? 'shop-card-selected' : ''}`}
            onClick={() => onSelect(s.shop.id)}
          >
            <div className={`score-badge tier-${s.trust.tier}`} title={TIER_LABELS[s.trust.tier]}>
              <span className="score-badge-num">{s.trust.composite}</span>
            </div>
            <div className="shop-card-body">
              <div className="shop-card-top">
                <span className="shop-card-name">{s.shop.name}</span>
                <span className="shop-card-distance mono-num">
                  {s.distance != null ? `${s.distance.toFixed(1)} mi` : ''}
                </span>
              </div>
              <div className="shop-card-meta">
                {s.shop.categories.map((c) => CATEGORY_LABELS[c]).join(' · ')}
              </div>
              {s.shop.specialties && s.shop.specialties.length > 0 && (
                <div className="shop-card-meta specialty-line">
                  Specializes in {s.shop.specialties.map((m) => MAKE_LABELS[m]).join(' · ')}
                </div>
              )}
              <div className="shop-card-meta shop-card-sub">
                <span className={s.openNow ? 'open-now' : 'closed-now'}>
                  {s.openNow ? 'Open' : 'Closed'}
                </span>
                {' · '}
                {formatHoursToday(s.shop.hours)}
                {' · '}
                {'$'.repeat(s.shop.priceLevel)}
                {s.shop.signals.bbbGrade !== 'NR' && <> {' · BBB '}{s.shop.signals.bbbGrade}</>}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
