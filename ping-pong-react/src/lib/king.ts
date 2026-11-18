import type { Match } from '../types'
import { winnerLoser } from './stats'

/** King of the Ping: the rotation is the session's roster in order, `[King, Prochain, ...File]`. */
export type Rotation = ReadonlyArray<string>

/** The game the rotation calls to the table: the King on side a, Prochain challenging and serving. */
export function nextGame(rotation: Rotation): Pick<Match, 'player_a' | 'player_b' | 'serve_start'> {
  return { player_a: rotation[0], player_b: rotation[1], serve_start: 'b' }
}

/** Once the game at the table is validated: the winner holds it, the loser joins the back of the File. */
export function afterGame(rotation: Rotation, winner: string): Rotation {
  const loser = rotation[0] === winner ? rotation[1] : rotation[0]
  return [winner, ...rotation.slice(2), loser]
}

/** A run of consecutive validated wins by one player: their « règne ». */
export type Reign = { readonly player: string; readonly wins: number }

function streaks(matches: ReadonlyArray<Match>): ReadonlyArray<Reign> {
  return matches
    .filter((m) => m.done)
    .sort((x, y) => x.idx - y.idx)
    .map((m) => winnerLoser(m).winner)
    .reduce<ReadonlyArray<Reign>>((after, winner) => {
      const previous = after[after.length - 1]
      const wins = previous?.player === winner ? previous.wins + 1 : 1
      return [...after, { player: winner, wins }]
    }, [])
}

/** The session's Record, and at the end its champion: the longest reign, a tie to whoever got there first. */
export function longestReign(matches: ReadonlyArray<Match>): Reign | null {
  return streaks(matches).reduce<Reign | null>(
    (best, run) => (best === null || run.wins > best.wins ? run : best),
    null,
  )
}

/** The King's règne: their wins in a row up to now, 0 until they win a game holding the table. */
export function reignOf(matches: ReadonlyArray<Match>, king: string): number {
  const all = streaks(matches)
  const last = all[all.length - 1]
  return last?.player === king ? last.wins : 0
}
