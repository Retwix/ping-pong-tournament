import { IconTrash } from '@tabler/icons-react'
import type { MouseEvent } from 'react'
import { splitOnWinner } from '../lib/winnerHighlight'
import type { Tournament } from '../types'

interface Props {
  tournament: Tournament
  onOpen: (id: string) => void
  onDelete: (e: MouseEvent, id: string, name: string) => void
}

/** A single tournament/game card in the "Tes tournois & parties" row. Click to open, trash to delete. */
export default function TournamentCard({ tournament: t, onOpen, onDelete }: Props) {
  const winner = t.kind === 'game' && t.status === 'done' ? t.champion : null
  const split = winner ? splitOnWinner(t.name, winner) : null
  const isLive = t.status !== 'done'

  return (
    <div className={`rvcard rv-t-card${isLive ? ' live' : ''}`} onClick={() => onOpen(t.id)}>
      <div className="rv-t-top">
        <span className={`rv-t-status${isLive ? ' live' : ' done'}`}>
          {isLive ? (
            <>
              <span className="rv-t-dot" /> En cours
            </>
          ) : (
            'Terminé'
          )}
        </span>
        <button className="rvtrash" title="Supprimer" onClick={(e) => onDelete(e, t.id, t.name)}>
          <IconTrash size={18} stroke={1.75} />
        </button>
      </div>
      <div className="rv-t-name">
        {split ? (
          <>
            🏆 {split.before}
            <span className="rv-t-winner">{split.winner}</span>
            {split.after}
          </>
        ) : (
          t.name
        )}
      </div>
      <div className="rv-t-meta">
        {t.kind === 'game' ? 'Partie' : `Tournoi · ${t.players.length} joueurs`} · jeu en {t.target}{' '}
        · {new Date(t.created_at).toLocaleDateString('fr-FR')}
      </div>
      {winner && !split && <div className="rv-t-winner-line">🏆 {winner}</div>}
    </div>
  )
}
