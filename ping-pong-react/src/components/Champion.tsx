import { computeStandings } from '../lib/pingpong'
import { bracketPodium } from '../lib/doubleElim'
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
  const isDouble = tournament.format === 'double_elim'

  // Double elimination: rank from the bracket result. Round-robin: from standings.
  const podium = isDouble
    ? bracketPodium(matches).map((r) => ({ name: r.name, sub: r.rank === 1 ? 'Vainqueur' : '' }))
    : computeStandings(tournament.players, matches)
        .slice(0, 3)
        .map((s) => ({ name: s.name, sub: `${s.wins} V` }))

  const champ = podium[0] ?? (tournament.champion ? { name: tournament.champion, sub: '' } : null)
  if (!champ) return null

  const standings = isDouble ? null : computeStandings(tournament.players, matches)[0]

  return (
    <div className="champion">
      <Confetti />
      <div className="champ-inner">
        <div className="champ-kicker">Tournoi terminé</div>
        <div className="champ-trophy">🏆</div>
        <div className="champ-name">{champ.name}</div>
        <div className="champ-sub">
          {isDouble ? (
            'Champion · double élimination'
          ) : standings ? (
            <>
              <b>{standings.wins}</b> victoires · différence{' '}
              <b>
                {standings.diff >= 0 ? '+' : ''}
                {standings.diff}
              </b>
            </>
          ) : null}
        </div>
        <div className="champ-podium">
          {podium.slice(0, 3).map((s, i) => (
            <div key={s.name} className={`prow p${i + 1}`}>
              <span className="who">
                <span className="medal">{MEDALS[i]}</span>
                {s.name}
              </span>
              <span className="pwins">{s.sub}</span>
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
