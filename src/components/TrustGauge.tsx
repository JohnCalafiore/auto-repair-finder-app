import type { TrustScore } from '../types'
import { TIER_LABELS } from '../lib/trustScore'

/**
 * The signature element: a dashboard-style gauge. The needle sweeps a 240°
 * arc from 0 to 100, with tick marks like an instrument cluster.
 */
export function TrustGauge({ score, size = 128 }: { score: TrustScore; size?: number }) {
  const START = 150 // degrees, gauge sweep start (pointing down-left)
  const SWEEP = 240
  const angle = START + (score.composite / 100) * SWEEP
  const r = 44
  const cx = 50
  const cy = 50

  const polar = (deg: number, radius: number) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const arcPath = (fromDeg: number, toDeg: number, radius: number) => {
    const s = polar(fromDeg, radius)
    const e = polar(toDeg, radius)
    const large = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const ticks = []
  for (let i = 0; i <= 10; i++) {
    const deg = START + (i / 10) * SWEEP
    const outer = polar(deg, r + 2)
    const inner = polar(deg, i % 5 === 0 ? r - 5 : r - 2)
    ticks.push(
      <line
        key={i}
        x1={inner.x}
        y1={inner.y}
        x2={outer.x}
        y2={outer.y}
        className="gauge-tick"
        strokeWidth={i % 5 === 0 ? 2 : 1}
      />,
    )
  }

  const needleTip = polar(angle, r - 9)
  const needleTail = polar(angle + 180, 8)

  return (
    <div className={`trust-gauge tier-${score.tier}`} style={{ width: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Trust score ${score.composite} out of 100, ${TIER_LABELS[score.tier]}`}>
        <path d={arcPath(START, START + SWEEP, r)} className="gauge-track" />
        <path d={arcPath(START, angle, r)} className="gauge-fill" />
        {ticks}
        <line x1={needleTail.x} y1={needleTail.y} x2={needleTip.x} y2={needleTip.y} className="gauge-needle" />
        <circle cx={cx} cy={cy} r={4} className="gauge-hub" />
        <text x={cx} y={78} className="gauge-value" textAnchor="middle">
          {score.composite}
        </text>
        <text x={cx} y={88} className="gauge-unit" textAnchor="middle">
          / 100
        </text>
      </svg>
      <div className="gauge-tier-label">{TIER_LABELS[score.tier]}</div>
    </div>
  )
}
