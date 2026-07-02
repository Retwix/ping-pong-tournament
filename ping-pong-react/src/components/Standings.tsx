import { computeStandings } from '../lib/pingpong'
import type { TournamentRating } from '../hooks/useRatingDeltas'
import type { Match } from '../types'

interface Props {
  players: string[]
  matches: Match[]
  /** When provided, adds an Élo column showing each player's net rating change. */
  ratings?: TournamentRating[]
}

export default function Standings({ players, matches, ratings }: Props) {
  const ranked = computeStandings(players, matches)
  const showElo = !!ratings && ratings.length > 0
  const eloByName = new Map((ratings ?? []).map((r) => [r.name, r]))

  return (
    <div className="panel">
      <table>
        <thead>
          <tr>
            <th className="left">Joueur</th>
            <th>J</th>
            <th>V</th>
            <th>Pts +/&minus;</th>
            <th>Diff</th>
            {showElo && <th>Élo</th>}
          </tr>
        </thead>
        <tbody>
          {ranked.map((s, i) => {
            const r = eloByName.get(s.name)
            const net = r ? Math.round(r.netDelta) : null
            return (
              <tr key={s.name} className={`r${i + 1}`}>
                <td className="left">
                  <span className="rank">{i + 1}</span>
                  {s.name}
                </td>
                <td>{s.played}</td>
                <td className="wins">{s.wins}</td>
                <td>
                  {s.pointsFor}/{s.pointsAgainst}
                </td>
                <td className={`diff ${s.diff > 0 ? 'pos' : s.diff < 0 ? 'neg' : ''}`}>
                  {s.diff > 0 ? '+' : ''}
                  {s.diff}
                </td>
                {showElo && (
                  <td
                    className={`elo ${net == null ? '' : net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}
                    title={r ? `${Math.round(r.startRating)} → ${Math.round(r.endRating)}` : undefined}
                  >
                    {net == null ? '—' : net > 0 ? `+${net}` : net < 0 ? `−${Math.abs(net)}` : '±0'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
