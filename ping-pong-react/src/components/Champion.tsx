import { computeStandings } from '../lib/pingpong'
import type { Match, Tournament } from '../types'
import Confetti from './Confetti'

interface Props {
  tournament: Tournament
  matches: Match[]
  onClose: () => void
  onNew: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function Champion({ tournament, matches, onClose, onNew }: Props) {
  const ranked = computeStandings(tournament.players, matches)
  const champ = ranked[0]
  if (!champ) return null

  return (
    <div className="champion">
      <Confetti />
      <div className="champ-inner">
        <div className="champ-kicker">Tournoi terminé</div>
        <div className="champ-trophy">🏆</div>
        <div className="champ-name">{champ.name}</div>
        <div className="champ-sub">
          <b>{champ.wins}</b> victoires · différence{' '}
          <b>
            {champ.diff >= 0 ? '+' : ''}
            {champ.diff}
          </b>
        </div>
        <div className="champ-podium">
          {ranked.slice(0, 3).map((s, i) => (
            <div key={s.name} className={`prow p${i + 1}`}>
              <span className="who">
                <span className="medal">{MEDALS[i]}</span>
                {s.name}
              </span>
              <span className="pwins">{s.wins} V</span>
            </div>
          ))}
        </div>
        <div className="champ-actions">
          <button className="ghost" onClick={onClose}>
            Revoir les résultats
          </button>
          <button className="solid" onClick={onNew}>
            Nouveau tournoi
          </button>
        </div>
      </div>
    </div>
  )
}
