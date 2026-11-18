import type { Match } from '../types'

/** King of the Ping: the rotation is the session's roster in order, `[King, Prochain, ...File]`. */
export type Rotation = ReadonlyArray<string>

/** The game the rotation calls to the table: the King on side a, Prochain challenging and serving. */
export function nextGame(rotation: Rotation): Pick<Match, 'player_a' | 'player_b' | 'serve_start'> {
  return { player_a: rotation[0], player_b: rotation[1], serve_start: 'b' }
}
