import { useRatings } from '../hooks/useRatings'
import { ladderSections } from '../lib/inactivity'
import { signed } from '../lib/format'
import { currentSeason, defaultLadderScope, ladderLabel } from '../lib/seasons'
import Avatar from './Avatar'

interface Props {
  onOpenClassement: () => void
}

/**
 * Dashboard "Top joueurs" — the top 5 of the live Elo leaderboard. It reads the
 * same ladder Le Classement opens on: defaultLadderScope, so the season being
 * played right now, and the same ladderSections rules, so the two can never
 * disagree about who holds a rank — alumni and anyone idle 30 days are gone,
 * and the ranks are the ladder's own 1..n. A season is its own replay from
 * 1500, so the card is empty — under its own scope label — until that
 * season's first rated match.
 * The whole card opens Classement; each row shows the medal-tinted rank, avatar, name,
 * rating (rank 1 in the brand purple), and the signed trend from the
 * player's most recent match (hidden when it's exactly zero).
 */
export default function TopPlayers({ onOpenClassement }: Props) {
  const now = new Date()
  const season = currentSeason(now)
  const { rows, players } = useRatings(defaultLadderScope(now))
  const { ranked } = ladderSections({ rows, players, season, now, archived: false })
  const top = ranked.slice(0, 5)

  return (
    <div className="rv-card rv-top-card" onClick={onOpenClassement}>
      <div className="rv-top-header">
        <div className="rv-top-heading">
          <div className="rv-card-title">Top joueurs</div>
          <div className="rv-top-scope">{ladderLabel(season)}</div>
        </div>
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
