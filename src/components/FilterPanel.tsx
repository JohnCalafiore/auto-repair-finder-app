import { CATEGORY_LABELS, type Certification, type ServiceCategory } from '../types'

export interface Filters {
  query: string
  categories: Set<ServiceCategory>
  minTrust: number
  maxDistance: number // miles; Infinity = any
  openNow: boolean
  bbbAccreditedOnly: boolean
  certifications: Set<Certification>
  sortBy: 'trust' | 'distance' | 'reviews'
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  categories: new Set(),
  minTrust: 0,
  maxDistance: Infinity,
  openNow: false,
  bbbAccreditedOnly: false,
  certifications: new Set(),
  sortBy: 'trust',
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as ServiceCategory[]
const ALL_CERTS: Certification[] = ['ASE Certified', 'AAA Approved', 'BBB Accredited', 'I-CAR Gold', 'NAPA AutoCare']
const DISTANCE_STOPS = [2, 5, 10, Infinity]

export function FilterPanel({
  filters,
  onChange,
  resultCount,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  resultCount: number
}) {
  const toggleCategory = (c: ServiceCategory) => {
    const next = new Set(filters.categories)
    next.has(c) ? next.delete(c) : next.add(c)
    onChange({ ...filters, categories: next })
  }

  const toggleCert = (c: Certification) => {
    const next = new Set(filters.certifications)
    next.has(c) ? next.delete(c) : next.add(c)
    onChange({ ...filters, certifications: next })
  }

  const isDefault =
    filters.categories.size === 0 &&
    filters.minTrust === 0 &&
    filters.maxDistance === Infinity &&
    !filters.openNow &&
    !filters.bbbAccreditedOnly &&
    filters.certifications.size === 0

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <span className="filter-title">Filters</span>
        <span className="filter-count">{resultCount} shop{resultCount === 1 ? '' : 's'}</span>
        {!isDefault && (
          <button
            className="filter-reset"
            onClick={() => onChange({ ...DEFAULT_FILTERS, query: filters.query, sortBy: filters.sortBy })}
          >
            Reset
          </button>
        )}
      </div>

      <fieldset className="filter-group">
        <legend>Service type</legend>
        <div className="chip-row">
          {ALL_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`chip ${filters.categories.has(c) ? 'chip-on' : ''}`}
              onClick={() => toggleCategory(c)}
              aria-pressed={filters.categories.has(c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>
          Minimum trust score <span className="mono-num">{filters.minTrust > 0 ? filters.minTrust : 'any'}</span>
        </legend>
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={filters.minTrust}
          onChange={(e) => onChange({ ...filters, minTrust: Number(e.target.value) })}
          aria-label="Minimum trust score"
        />
      </fieldset>

      <fieldset className="filter-group">
        <legend>Distance</legend>
        <div className="chip-row">
          {DISTANCE_STOPS.map((d) => (
            <button
              key={d}
              className={`chip ${filters.maxDistance === d ? 'chip-on' : ''}`}
              onClick={() => onChange({ ...filters, maxDistance: d })}
              aria-pressed={filters.maxDistance === d}
            >
              {d === Infinity ? 'Any' : `≤ ${d} mi`}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Trust signals</legend>
        <label className="check-row">
          <input
            type="checkbox"
            checked={filters.openNow}
            onChange={(e) => onChange({ ...filters, openNow: e.target.checked })}
          />
          Open now
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={filters.bbbAccreditedOnly}
            onChange={(e) => onChange({ ...filters, bbbAccreditedOnly: e.target.checked })}
          />
          BBB accredited only
        </label>
        <div className="chip-row" style={{ marginTop: 8 }}>
          {ALL_CERTS.map((c) => (
            <button
              key={c}
              className={`chip chip-small ${filters.certifications.has(c) ? 'chip-on' : ''}`}
              onClick={() => toggleCert(c)}
              aria-pressed={filters.certifications.has(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Sort by</legend>
        <div className="chip-row">
          {(
            [
              ['trust', 'Trust score'],
              ['distance', 'Distance'],
              ['reviews', 'Review count'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`chip ${filters.sortBy === key ? 'chip-on' : ''}`}
              onClick={() => onChange({ ...filters, sortBy: key })}
              aria-pressed={filters.sortBy === key}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
