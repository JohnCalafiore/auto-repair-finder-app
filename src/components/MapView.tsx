import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ScoredShop } from '../App'
import { distanceMiles, type LatLng } from '../lib/geo'

function scoreIcon(score: number, tier: string, selected: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin tier-${tier} ${selected ? 'map-pin-selected' : ''}"><span>${score}</span></div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
  })
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 14), { duration: 0.6 })
  }, [target, map])
  return null
}

/** Flies to the user's position the moment geolocation resolves. */
function FlyToUser({ location }: { location: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (location) map.flyTo([location.lat, location.lng], 13, { duration: 0.8 })
  }, [location, map])
  return null
}

/** Reports the map center after each pan/zoom so the parent can offer "Search this area". */
function MoveWatcher({ onMoveEnd }: { onMoveEnd: (center: LatLng) => void }) {
  useMapEvents({
    moveend(e) {
      const c = (e.target as L.Map).getCenter()
      onMoveEnd({ lat: c.lat, lng: c.lng })
    },
  })
  return null
}

export function MapView({
  shops,
  selectedId,
  onSelect,
  searchCenter,
  onSearchArea,
  userLocation,
}: {
  shops: ScoredShop[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Center of the last executed shop search */
  searchCenter: LatLng
  onSearchArea: (center: LatLng) => void
  userLocation: LatLng | null
}) {
  const selected = shops.find((s) => s.shop.id === selectedId)
  // Set when the viewport has drifted far enough from the last search to warrant a refresh
  const [pendingArea, setPendingArea] = useState<LatLng | null>(null)

  useEffect(() => {
    setPendingArea(null)
  }, [searchCenter])

  const handleMoveEnd = (center: LatLng) => {
    setPendingArea(distanceMiles(center, searchCenter) > 2 ? center : null)
  }

  return (
    <>
      <MapContainer
        center={[searchCenter.lat, searchCenter.lng]}
        zoom={12}
        className="map-container"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userLocation && (
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={300}
            pathOptions={{ color: '#1461d2', fillColor: '#1461d2', fillOpacity: 0.25, weight: 2 }}
          />
        )}
        {shops.map((s) => (
          <Marker
            key={s.shop.id}
            position={[s.shop.lat, s.shop.lng]}
            icon={scoreIcon(s.trust.composite, s.trust.tier, s.shop.id === selectedId)}
            eventHandlers={{ click: () => onSelect(s.shop.id) }}
            zIndexOffset={s.shop.id === selectedId ? 1000 : 0}
          />
        ))}
        <FlyTo target={selected ? { lat: selected.shop.lat, lng: selected.shop.lng } : null} />
        <FlyToUser location={userLocation} />
        <MoveWatcher onMoveEnd={handleMoveEnd} />
      </MapContainer>
      {pendingArea && (
        <button className="search-area-btn" onClick={() => onSearchArea(pendingArea)}>
          ⟳ Search this area
        </button>
      )}
    </>
  )
}
