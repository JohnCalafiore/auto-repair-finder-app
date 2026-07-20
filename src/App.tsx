import { useEffect, useMemo, useState } from 'react'
import type { Shop, TrustScore } from './types'
import { dataAdapter } from './data/adapters'
import { computeTrustScore } from './lib/trustScore'
import { distanceMiles, isOpenNow, type LatLng } from './lib/geo'
import { DEFAULT_FILTERS, FilterPanel, type Filters } from './components/FilterPanel'
import { ShopList } from './components/ShopList'
import { MapView } from './components/MapView'
import { ShopDetail } from './components/ShopDetail'

export interface ScoredShop {
  shop: Shop
  trust: TrustScore
  distance: number | null
  openNow: boolean
}

const PHILLY: LatLng = { lat: 39.9526, lng: -75.1652 }

export default function App() {
  const [shops, setShops] = useState<Shop[]>([])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    dataAdapter.fetchShops(PHILLY, 25).then(setShops)
  }, [])

  const origin = userLocation ?? PHILLY

  const scored = useMemo<ScoredShop[]>(
    () =>
      shops.map((shop) => ({
        shop,
        trust: computeTrustScore(shop),
        distance: distanceMiles(origin, { lat: shop.lat, lng: shop.lng }),
        openNow: isOpenNow(shop.hours),
      })),
    [shops, origin],
  )

  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    const out = scored.filter((s) => {
      if (q && !`${s.shop.name} ${s.shop.address} ${s.shop.blurb}`.toLowerCase().includes(q)) return false
      if (filters.categories.size > 0 && !s.shop.categories.some((c) => filters.categories.has(c))) return false
      if (s.trust.composite < filters.minTrust) return false
      if (s.distance != null && s.distance > filters.maxDistance) return false
      if (filters.openNow && !s.openNow) return false
      if (filters.bbbAccreditedOnly && !s.shop.signals.bbbAccredited) return false
      if (
        filters.certifications.size > 0 &&
        ![...filters.certifications].every((c) => s.shop.signals.certifications.includes(c))
      )
        return false
      return true
    })
    out.sort((a, b) => {
      switch (filters.sortBy) {
        case 'distance':
          return (a.distance ?? 0) - (b.distance ?? 0)
        case 'reviews': {
          const count = (s: ScoredShop) => s.shop.signals.reviews.reduce((n, r) => n + r.count, 0)
          return count(b) - count(a)
        }
        default:
          return b.trust.composite - a.trust.composite
      }
    })
    return out
  }, [scored, filters])

  const selected = visible.find((s) => s.shop.id === selectedId) ?? null

  const locateMe = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 },
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>⚙</span>
          <span className="brand-name">TrueWrench</span>
          <span className="brand-tag">Repair shops, rated on more than stars</span>
        </div>
        <div className="header-controls">
          <input
            className="search-input"
            type="search"
            placeholder="Search shops, streets, specialties…"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            aria-label="Search shops"
          />
          <button className="locate-btn" onClick={locateMe} disabled={locating}>
            {locating ? 'Locating…' : userLocation ? 'Location set ✓' : 'Use my location'}
          </button>
        </div>
      </header>

      <div className="app-body">
        <div className="sidebar">
          <FilterPanel filters={filters} onChange={setFilters} resultCount={visible.length} />
          <ShopList shops={visible} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <main className="map-area">
          <MapView
            shops={visible}
            selectedId={selectedId}
            onSelect={setSelectedId}
            center={PHILLY}
            userLocation={userLocation}
          />
          {selected && <ShopDetail scored={selected} onClose={() => setSelectedId(null)} />}
        </main>
      </div>
    </div>
  )
}
