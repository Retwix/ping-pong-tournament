import { useEffect } from 'react'
import { IconX } from '@tabler/icons-react'
import type { CapotEntry } from '../lib/dashboardRecords'

interface Props {
  capots: CapotEntry[]
  onClose: () => void
}

/**
 * « Les capots » — the list behind the dashboard capots tile: every shutout
 * win with its result, where it was played and when.
 */
export default function CapotsModal({ capots, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="scrim rv-capots-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal rv-capots-modal" role="dialog" aria-label="Les capots">
        <div className="rv-capots-head">
          <div>
            <h2 className="rv-capots-title">Les capots</h2>
            <div className="rv-capots-sub">
              {capots.length} {capots.length > 1 ? 'adversaires laissés' : 'adversaire laissé'} à 0
            </div>
          </div>
          <button className="rv-capots-close" onClick={onClose} aria-label="Fermer">
            <IconX size={17} stroke={2} />
          </button>
        </div>

        <div className="rv-capots-list">
          {capots.map((c) => (
            <div className="rv-capot-row" key={c.matchId}>
              <span className="rv-capot-players">
                <span className="rv-capot-winner">{c.winner}</span>
                <span className="rv-capot-vs">bat</span>
                <span className="rv-capot-loser">{c.loser}</span>
              </span>
              <span className="rv-capot-score">{c.score}</span>
              <span className="rv-capot-meta">
                {c.context}
                {c.context !== '' && c.date !== '' && ' · '}
                {c.date}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
