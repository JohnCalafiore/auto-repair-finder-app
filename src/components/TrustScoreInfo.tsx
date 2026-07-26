import { useEffect, useRef } from 'react'
import { WEIGHTS } from '../lib/trustScore'

const SIGNAL_DOCS: { key: keyof typeof WEIGHTS; label: string; description: string }[] = [
  {
    key: 'reviews',
    label: 'Customer reviews',
    description:
      'Star ratings across Google, Yelp, and Carfax, adjusted for volume — a 5.0 from four reviews cannot outrank a 4.7 from nine hundred.',
  },
  {
    key: 'bbb',
    label: 'BBB rating',
    description: 'The Better Business Bureau letter grade (A+ through F), with a bonus for accredited businesses.',
  },
  {
    key: 'complaints',
    label: 'Complaint history',
    description:
      'BBB complaints filed in the last 3 years relative to how many customers the shop serves, and whether the shop resolves them.',
  },
  {
    key: 'longevity',
    label: 'Years in business',
    description: 'Longevity is a proxy for repeat customers — shops that treat people badly rarely last decades.',
  },
  {
    key: 'certs',
    label: 'Certifications',
    description: 'Industry credentials: ASE Certified, AAA Approved, I-CAR Gold, NAPA AutoCare, BBB accreditation.',
  },
  {
    key: 'trend',
    label: 'Rating trend',
    description:
      'Recent ~12-month review average versus lifetime average — catches shops that declined under new ownership, credits ones that turned around.',
  },
  {
    key: 'warranty',
    label: 'Warranty coverage',
    description: 'Length of the posted parts & labor warranty. Shops that stand behind their work say so in writing.',
  },
  {
    key: 'license',
    label: 'State licensing',
    description: 'Whether the shop is a registered/licensed repair facility with the state.',
  },
  {
    key: 'consistency',
    label: 'Cross-platform consistency',
    description:
      'Whether ratings agree between review platforms. A big spread (great on one site, poor on another) is a manipulation tell.',
  },
]

const TIERS = [
  { range: '85–100', label: 'Highly trusted', tier: 'excellent' },
  { range: '70–84', label: 'Trusted', tier: 'good' },
  { range: '55–69', label: 'Mixed record', tier: 'fair' },
  { range: '0–54', label: 'Proceed with caution', tier: 'caution' },
]

export function TrustScoreInfo({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trust-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="detail-close" ref={closeRef} onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 id="trust-info-title" className="modal-title">
          How the Trust Score works
        </h2>
        <p className="modal-intro">
          Star ratings alone are easy to game and only tell part of the story. Every shop's Trust
          Score (0–100) blends nine independent signals, so review quality is weighed against how a
          business actually behaves: its Better Business Bureau record, how it handles complaints,
          how long it has survived, and whether it stands behind its work.
        </p>

        <table className="modal-table">
          <thead>
            <tr>
              <th>Signal</th>
              <th>Weight</th>
              <th>What it measures</th>
            </tr>
          </thead>
          <tbody>
            {SIGNAL_DOCS.map((s) => (
              <tr key={s.key}>
                <td className="modal-signal">{s.label}</td>
                <td className="mono-num">{Math.round(WEIGHTS[s.key] * 100)}%</td>
                <td>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="modal-subhead">Score tiers</h3>
        <ul className="tier-legend">
          {TIERS.map((t) => (
            <li key={t.tier}>
              <span className={`tier-dot tier-${t.tier}`} aria-hidden />
              <span className="mono-num">{t.range}</span>
              <span>{t.label}</span>
            </li>
          ))}
        </ul>

        <p className="modal-note">
          Every shop's detail panel shows the full breakdown under "Why this trust score," so you
          can see the inputs behind the number. Live shops come from Google Places, which supplies
          reviews, hours, and location; signals like the BBB grade, complaint history, and licensing
          show as "Data source not connected" until those adapters are added, and the composite is
          reweighted across whatever is available so it stays honest.
        </p>
      </div>
    </div>
  )
}
