import type { Match } from '../types'

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
