import { IconChevronRight } from '@tabler/icons-react'
import { useRatings } from '../hooks/useRatings'
import { relativeTime } from '../lib/format'
import { recentResults } from '../lib/recentResults'
import Avatar from './Avatar'

interface Props {
  onOpenTournament: (id: string) => void
  /** Opens /parties pre-filtered on matches (« Historique → » header link). */
  onHistory?: () => void
}

/**
 * Dashboard "Résultats récents" — the last few finished games across every
 * tournament, newest first. Each row opens the tournament/board that result
 * belongs to.
 */
export default function RecentResults({ onOpenTournament, onHistory }: Props) {
  const { matches, players, tournaments } = useRatings()
  const rows = recentResults(matches, players, tournaments, 5)

  return (
    <div className="rv-card">
      <div className="rv-top-header">
        <div className="rv-card-title">Résultats récents</div>
        {onHistory && (
          <button className="rv-top-link" onClick={onHistory}>
            Historique →
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="empty">Aucun match terminé pour l'instant.</div>
      ) : (
        <div className="rv-recent-list">
          {rows.map((row) => (
            <div
              key={row.matchId}
              className="rvrow"
              onClick={() => onOpenTournament(row.tournamentId)}
            >
              <Avatar name={row.winner} team={null} url={row.winnerAvatar} className="sm" />
              <div className="rvrow-text">
                <span className="rvrow-winner">{row.winner}</span>
                <span className="rvrow-connective">
                  {' '}
                  {row.doubles ? 'battent' : 'bat'} {row.loser} ·{' '}
                </span>
                <span className="rvrow-score">
                  {row.winnerScore}–{row.loserScore}
                </span>
              </div>
              <span className="rvrow-time">{relativeTime(row.endedAt, new Date())}</span>
              <IconChevronRight size={16} stroke={1.75} className="rvrow-chevron" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
