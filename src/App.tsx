import { useEffect, useMemo, useRef, useState } from 'react'
import type { Shop, TrustScore } from './types'
import { dataAdapter } from './data/adapters'
import { computeTrustScore } from './lib/trustScore'
import { distanceMiles, isOpenNow, type LatLng } from './lib/geo'
import { DEFAULT_FILTERS, FilterPanel, type Filters } from './components/FilterPanel'
import { ShopList } from './components/ShopList'
import { MapView } from './components/MapView'
import { ShopDetail } from './components/ShopDetail'
import { TrustScoreInfo } from './components/TrustScoreInfo'

export interface ScoredShop {
  shop: Shop
  trust: TrustScore
  distance: number | null
  openNow: boolean
}

const PHILLY: LatLng = { lat: 39.9526, lng: -75.1652 }
const SEARCH_RADIUS_MILES = 12

export default function App() {
  const [shops, setShops] = useState<Shop[]>([])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchCenter, setSearchCenter] = useState<LatLng>(PHILLY)
  const [userLocation, setUserLocation] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const [showTrustInfo, setShowTrustInfo] = useState(false)
  const [dataSource, setDataSource] = useState<'google' | 'demo'>('demo')
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    dataAdapter.fetchShops(searchCenter, SEARCH_RADIUS_MILES).then((result) => {
      if (!cancelled) {
        setShops(result.shops)
        setDataSource(result.source)
      }
    })
    return () => {
      cancelled = true
    }
  }, [searchCenter])

  // New search area → bring the refreshed results into view
  useEffect(() => {
    sidebarRef.current?.scrollTo({ top: 0 })
  }, [searchCenter])

  useEffect(() => {
    if (!locError) return
    const t = setTimeout(() => setLocError(null), 6000)
    return () => clearTimeout(t)
  }, [locError])

  // Distances are measured from the user when we know where they are,
  // otherwise from the area currently being searched.
  const origin = userLocation ?? searchCenter

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
    const make = filters.make
    let out = scored.filter((s) => {
      if (q && !`${s.shop.name} ${s.shop.address} ${s.shop.blurb}`.toLowerCase().includes(q)) return false
      if (filters.categories.size > 0 && !s.shop.categories.some((c) => filters.categories.has(c))) return false
      if (s.trust.composite < filters.minTrust) return false
      if (s.distance != null && s.distance > filters.maxDistance) return false
      if (filters.openNow && !s.openNow) return false
      if (filters.certifications.size > 0) {
        const certs = s.shop.signals.certifications
        // null = certification data not available for this shop (e.g. Google-only)
        if (!certs || ![...filters.certifications].every((c) => certs.includes(c))) return false
      }
      // Make filter: specialists in the make match, and so do all-make generalists
      if (make) {
        const sp = s.shop.specialties
        if (sp && sp.length > 0 && !sp.includes(make)) return false
      }
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
    if (make) {
      // Shops that explicitly specialize in the chosen make rank above generalists
      const isSpecialist = (s: ScoredShop) => !!s.shop.specialties?.includes(make)
      out = [...out.filter(isSpecialist), ...out.filter((s) => !isSpecialist(s))]
    }
    return out
  }, [scored, filters])

  const selected = visible.find((s) => s.shop.id === selectedId) ?? null

  const locateMe = () => {
    if (!navigator.geolocation) {
      setLocError('This browser does not support location access.')
      return
    }
    setLocating(true)
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setSearchCenter(loc) // refresh results around the user right away
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was blocked. Allow location for this site in your browser settings, then try again.'
            : 'Could not determine your location. Try again in a moment.',
        )
      },
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

      {locError && (
        <div className="loc-toast" role="alert">
          {locError}
        </div>
      )}

      {dataSource === 'demo' && (
        <div className="demo-banner">
          Showing demonstration data. Connect a Google Places API key for live shops near you.
        </div>
      )}

      <div className="app-body">
        <div className="sidebar" ref={sidebarRef}>
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            resultCount={visible.length}
            onShowTrustInfo={() => setShowTrustInfo(true)}
          />
          <ShopList shops={visible} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <main className="map-area">
          <MapView
            shops={visible}
            selectedId={selectedId}
            onSelect={setSelectedId}
            searchCenter={searchCenter}
            onSearchArea={setSearchCenter}
            userLocation={userLocation}
          />
          {selected && (
            <ShopDetail
              scored={selected}
              onClose={() => setSelectedId(null)}
              onShowTrustInfo={() => setShowTrustInfo(true)}
            />
          )}
        </main>
      </div>

      {showTrustInfo && <TrustScoreInfo onClose={() => setShowTrustInfo(false)} />}
    </div>
  )
}
