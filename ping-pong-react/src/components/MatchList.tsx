import { IconChevronRight, IconClock } from '@tabler/icons-react'
import { formatDuration } from '../lib/pingpong'
import {
  avancement,
  dureeTerminee,
  etatMatch,
  extremesDuree,
  toursDuTournoi,
  type DureeMatch,
  type EtatMatch,
} from '../lib/tournamentBoard'
import type { Match, Tournament } from '../types'

interface Props {
  tournament: Tournament
  matches: Match[]
  onOpen: (id: string) => void
}

/** Status label → modifier suffix, so the dot and label pick up their colour. */
const MODIFIER: Record<EtatMatch, string> = {
  Terminé: 'termine',
  'En cours': 'encours',
  'À jouer': 'ajouer',
}

function MatchRow({ match, onOpen }: { match: Match; onOpen: (id: string) => void }) {
  const etat = etatMatch(match)
  const gagneA = match.done && match.score_a > match.score_b
  const gagneB = match.done && match.score_b > match.score_a
  const ms = dureeTerminee(match)

  return (
    <div className={`tb-row tb-row--${MODIFIER[etat]}`} onClick={() => onOpen(match.id)}>
      <span className="tb-row-dot" />
      <span className="tb-row-etat">{etat}</span>
      <span className={`tb-row-nom tb-row-nom--a${gagneB ? ' tb-row-nom--perdant' : ''}`}>
        {match.player_a}
      </span>
      <span className="tb-row-score">
        {etat === 'À jouer' ? '—' : `${match.score_a} – ${match.score_b}`}
      </span>
      <span className={`tb-row-nom${gagneA ? ' tb-row-nom--perdant' : ''}`}>{match.player_b}</span>
      <span className="tb-row-duree">{ms === null ? '' : formatDuration(ms)}</span>
      <IconChevronRight size={15} stroke={2} className="tb-row-chev" />
    </div>
  )
}

const etiquette = (d: DureeMatch): string =>
  `${d.match.player_a}–${d.match.player_b} (${formatDuration(d.ms)})`

export default function MatchList({ tournament, matches, onOpen }: Props) {
  const tours = toursDuTournoi(tournament, matches)
  const { joues, total, ratio } = avancement(matches)
  const extremes = extremesDuree(matches)

  return (
    <section className="tb-matchs">
      <div className="tb-sec-head">
        <h2 className="tb-sec-title">Les matchs</h2>
        <div className="tb-progress">
          <span className="tb-progress-track">
            <span className="tb-progress-fill" style={{ width: `${ratio * 100}%` }} />
          </span>
          <span className="tb-progress-count">
            {joues}/{total} joués
          </span>
        </div>
      </div>

      {tours.map(({ round, matches: items, exempts }) => (
        <div key={round} className="tb-tour">
          <div className="tb-tour-head">
            Tour {round}
            {exempts.length > 0 && (
              <span className="tb-tour-bye">exempt : {exempts.join(', ')}</span>
            )}
          </div>
          <div className="tb-tour-card">
            {items.map((match) => (
              <MatchRow key={match.id} match={match} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}

      {extremes && (
        <div className="tb-extremes">
          <IconClock size={15} stroke={2} />
          <span>
            Plus long : <b>{etiquette(extremes.plusLong)}</b> · Plus court :{' '}
            <b>{etiquette(extremes.plusCourt)}</b>
          </span>
        </div>
      )}
    </section>
  )
}
