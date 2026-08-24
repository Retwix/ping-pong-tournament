import { signed } from '../lib/format'
import { lignesClassement } from '../lib/tournamentBoard'
import type { TournamentRating } from '../hooks/useRatingDeltas'
import type { Match } from '../types'

interface Props {
  players: string[]
  matches: Match[]
  ratings: TournamentRating[]
  unranked: boolean
}

/** Podium colouring for the first three ranks; everyone else reads muted. */
const PODIUM: Record<number, string> = { 1: 'or', 2: 'argent', 3: 'bronze' }

/** Green on a gain, coral on a loss, neutral at nil. */
const sens = (value: number): string => (value > 0 ? ' pos' : value < 0 ? ' neg' : '')

/**
 * « Classement » card beside the match list. Everything shown is derived from
 * played matches by `lignesClassement` — nothing here is stored.
 *
 * Kept separate from `Standings`, which still serves the finished-tournament
 * screen in the TV view on the legacy layout.
 */
export default function BoardStandings({ players, matches, ratings, unranked }: Props) {
  const { rows, afficherElo, note } = lignesClassement({ players, matches, ratings, unranked })

  return (
    <>
      <div className="tb-cl-card">
        <div className="tb-cl-row tb-cl-head">
          <span className="tb-cl-rang">#</span>
          <span className="tb-cl-nom">Joueur</span>
          <span className="tb-cl-num">J</span>
          <span className="tb-cl-num">V</span>
          <span className="tb-cl-pts">Pts +/&minus;</span>
          <span className="tb-cl-diff">Diff</span>
          {afficherElo && <span className="tb-cl-elo">Élo</span>}
        </div>

        {rows.map((row) => (
          <div key={row.name} className="tb-cl-row">
            <span className={`tb-cl-rang tb-cl-rang--${PODIUM[row.rang] ?? 'autre'}`}>
              {row.rang}
            </span>
            <span className="tb-cl-nom">{row.name}</span>
            <span className="tb-cl-num">{row.played}</span>
            <span className="tb-cl-num tb-cl-v">{row.wins}</span>
            <span className="tb-cl-pts">
              {row.pointsFor}/{row.pointsAgainst}
            </span>
            <span className={`tb-cl-diff${sens(row.diff)}`}>{signed(row.diff)}</span>
            {afficherElo && (
              <span
                className={`tb-cl-elo${row.elo ? sens(row.elo.net) : ''}`}
                title={row.elo ? `${row.elo.depart} → ${row.elo.arrivee}` : undefined}
              >
                {row.elo ? signed(row.elo.net) : '—'}
              </span>
            )}
          </div>
        ))}

        <div className="tb-cl-hint">Départage : victoires, puis différence de points.</div>
      </div>

      {note && <p className="tb-cl-note">{note}</p>}
    </>
  )
}
