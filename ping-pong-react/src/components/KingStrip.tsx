import type { Match } from '../types'
import { longestReign, reignOf, type Rotation } from '../lib/king'

interface Props {
  rotation: Rotation
  matches: ReadonlyArray<Match>
}

const wins = (n: number): string => `${n} ${n > 1 ? 'victoires' : 'victoire'} d’affilée`

/** For spectators of a King of the Ping session: who holds the table and for how long, and the session's best reign. */
export default function KingStrip({ rotation, matches }: Props) {
  const [king] = rotation
  const record = longestReign(matches)
  return (
    <div className="tv-king">
      <section className="tv-king-cell" aria-label="le King">
        <div className="tv-king-label">le King 👑</div>
        <div className="tv-king-name">{king}</div>
        <div className="tv-king-sub">Règne · {wins(reignOf(matches, king))}</div>
      </section>
      {record && (
        <section className="tv-king-cell" aria-label="Record">
          <div className="tv-king-label">Record</div>
          <div className="tv-king-name">{record.player}</div>
          <div className="tv-king-sub">{wins(record.wins)}</div>
        </section>
      )}
      <section className="tv-king-cell tv-king-file">
        <div className="tv-king-label">File</div>
        <ol aria-label="File">
          {rotation.slice(2).map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}
