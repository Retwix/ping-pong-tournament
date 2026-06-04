import { computeStandings } from '../lib/pingpong'
import type { Match } from '../types'

interface Props {
  players: string[]
  matches: Match[]
}

export default function Standings({ players, matches }: Props) {
  const ranked = computeStandings(players, matches)
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
          </tr>
        </thead>
        <tbody>
          {ranked.map((s, i) => (
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
