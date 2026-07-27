import { useRatings } from '../hooks/useRatings'
import { signed } from '../lib/format'
import Avatar from './Avatar'

interface Props {
  onOpenClassement: () => void
}

/**
 * Dashboard "Top joueurs" — the top 5 of the live Elo leaderboard. The whole
 * card opens Classement; each row shows the medal-tinted rank, avatar, name,
 * rating (rank 1 in the brand purple), and the signed trend from the
 * player's most recent match (hidden when it's exactly zero).
 */
export default function TopPlayers({ onOpenClassement }: Props) {
  const { rows } = useRatings()
  const top = rows.slice(0, 5)

  return (
    <div className="rv-card rv-top-card" onClick={onOpenClassement}>
      <div className="rv-top-header">
        <div className="rv-card-title">Top joueurs</div>
        <span className="rv-top-link">Classement →</span>
      </div>
      {top.length === 0 ? (
        <div className="empty">Encore aucun match classé.</div>
      ) : (
        <div className="rv-top-list">
          {top.map((row) => (
            <div key={row.key} className="rv-top-row">
              <span className={`rv-top-rank${row.rank <= 3 ? ` rv-top-rank-${row.rank}` : ''}`}>
                {row.rank}
              </span>
              <Avatar name={row.name} team={row.team} url={row.avatar_url} className="rv-top-av" />
              <span className="rv-top-name">{row.name}</span>
              <span className={`rv-top-rating${row.rank === 1 ? ' rv-top-rating-1' : ''}`}>
                {Math.round(row.rating)}
              </span>
              {row.trend !== 0 && (
                <span className={`rv-top-trend ${row.trend > 0 ? 'up' : 'down'}`}>
                  {row.trend > 0 ? '▲' : '▼'} {signed(row.trend)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
