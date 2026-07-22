import { IconX } from '@tabler/icons-react'
import { useEffect } from 'react'
import type { RatingRow } from '../hooks/useRatings'
import type { PlayerHistory } from '../lib/playerHistory'
import { teamColor, teamLabel } from '../lib/teams'
import Avatar from './Avatar'
import { RatingLine } from './Charts'

const pct = (v: number): string => `${Math.round(v * 100)} %`

/** "Top N %" from rank/total — clearer in French than a raw percentile. */
const topPct = (rank: number, total: number): string =>
  `Top ${Math.max(1, Math.ceil((rank / total) * 100))} %`

/**
 * Chess.com-style player card: rating trajectory + headline stats.
 * Data comes from the live replay (playerHistory), so it updates in place
 * if a match finishes while the modal is open.
 */
export default function PlayerModal({
  row,
  history,
  onClose,
}: {
  row: RatingRow
  history: PlayerHistory | null
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const color = teamColor(row.team ?? '')

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal pd rt-pm">
        <button className="pm-close" onClick={onClose} aria-label="Fermer">
          <IconX size={18} stroke={2} />
        </button>

        <div className="pd-head">
          <Avatar name={row.name} team={row.team} url={row.avatar_url} />
          <div>
            <h2 style={{ marginBottom: 2 }}>{row.name}</h2>
            <div className="modal-hint" style={{ marginBottom: 0 }}>
              {row.team ? teamLabel(row.team) : '—'}
              {row.provisional && <span className="rt-prov">provisoire</span>}
            </div>
          </div>
          <div className="pm-now">
            <div className="pm-rating-row">
              <div className="pm-rating">{Math.round(row.rating)}</div>
              {Math.round(row.trend) !== 0 && (
                <span className={`rt-trend ${row.trend > 0 ? 'up' : 'down'}`}>
                  {row.trend > 0 ? '▲' : '▼'} {Math.abs(Math.round(row.trend))}
                </span>
              )}
            </div>
            <div className="pm-rd">± {Math.round(row.rd)}</div>
          </div>
        </div>

        {history ? (
          <>
            <RatingLine points={history.points} color={color} />
            <div className="pd-kpis pm-kpis">
              <div className="pd-kpi">
                <div className="n">{Math.round(history.peak)}</div>
                <div className="l">Meilleure note</div>
              </div>
              <div className="pd-kpi">
                <div className="n">
                  #{history.rank} / {history.total}
                </div>
                <div className="l">Rang</div>
              </div>
              <div className="pd-kpi">
                <div className="n">{topPct(history.rank, history.total)}</div>
                <div className="l">Percentile</div>
              </div>
              <div className="pd-kpi">
                <div className="n">{history.games}</div>
                <div className="l">Matchs</div>
              </div>
              <div className="pd-kpi">
                <div className="n">
                  {history.wins} · {pct(history.winRate)}
                </div>
                <div className="l">Victoires</div>
              </div>
              <div className="pd-kpi">
                <div className="n">
                  {history.losses} · {pct(1 - history.winRate)}
                </div>
                <div className="l">Défaites</div>
              </div>
            </div>
          </>
        ) : (
          <p className="empty">Aucun match noté pour l'instant.</p>
        )}
      </div>
    </div>
  )
}
