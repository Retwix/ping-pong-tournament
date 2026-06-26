import { useMatchHistory } from '../hooks/useMatchHistory'
import MatchRow from './MatchRow'

interface Props {
  /** Open a match's tournament board. */
  onOpen: (id: string) => void
  /** Go to the full history page. */
  onHistory: () => void
}

/** The dashboard rail's recent-results feed: the last 5 finished matches. */
export default function RecentMatches({ onOpen, onHistory }: Props) {
  const { matches, tournamentName, loading } = useMatchHistory()
  const recent = matches.slice(0, 5)

  return (
    <div>
      <div className="rail-label">Derniers matchs</div>
      {loading ? (
        <div className="empty">Chargement…</div>
      ) : recent.length === 0 ? (
        <div className="empty">Aucun match joué pour l'instant.</div>
      ) : (
        <>
          {recent.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              context={tournamentName(m.tournament_id)}
              onOpen={() => onOpen(m.tournament_id)}
            />
          ))}
          <button className="rail-history-link" onClick={onHistory}>
            Voir tout l'historique →
          </button>
        </>
      )}
    </div>
  )
}
