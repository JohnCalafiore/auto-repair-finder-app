import type { Shop, WeekHours } from '../types'

export interface LatLng {
  lat: number
  lng: number
}

/** Great-circle distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function isOpenNow(hours: WeekHours | null, now: Date = new Date()): boolean {
  if (!hours) return false
  const day = hours[now.getDay()]
  if (!day.open || !day.close) return false
  const minutes = now.getHours() * 60 + now.getMinutes()
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  return minutes >= parse(day.open) && minutes < parse(day.close)
}

export function formatHoursToday(hours: WeekHours | null, now: Date = new Date()): string {
  if (!hours) return 'Hours unavailable'
  const day = hours[now.getDay()]
  if (!day.open || !day.close) return 'Closed today'
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hr = h % 12 === 0 ? 12 : h % 12
    return m === 0 ? `${hr} ${ampm}` : `${hr}:${String(m).padStart(2, '0')} ${ampm}`
  }
  return `${fmt(day.open)} – ${fmt(day.close)}`
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function shopLatLng(shop: Shop): LatLng {
  return { lat: shop.lat, lng: shop.lng }
}
