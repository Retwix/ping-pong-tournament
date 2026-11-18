import type { Match } from '../types'
import { reignOf, type Rotation } from '../lib/king'

interface Props {
  rotation: Rotation
  matches: ReadonlyArray<Match>
}

/** For spectators of a King of the Ping session: who holds the table and for how long. */
export default function KingStrip({ rotation, matches }: Props) {
  const [king] = rotation
  const reign = reignOf(matches, king)
  return (
    <div className="tv-king">
      <section className="tv-king-cell" aria-label="le King">
        <div className="tv-king-label">le King 👑</div>
        <div className="tv-king-name">{king}</div>
        <div className="tv-king-sub">
          Règne · {reign} {reign > 1 ? 'victoires' : 'victoire'} d’affilée
        </div>
      </section>
    </div>
  )
}
