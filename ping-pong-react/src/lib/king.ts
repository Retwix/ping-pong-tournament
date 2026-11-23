import type { Match, Tournament } from '../types'
import { winnerLoser } from './stats'

/** King of the Ping: the rotation is the session's roster in order, `[King, Prochain, ...File]`. */
export type Rotation = ReadonlyArray<string>

/** The game the rotation calls to the table: the King on side a, Prochain challenging and serving. */
export function nextGame(rotation: Rotation): Pick<Match, 'player_a' | 'player_b' | 'serve_start'> {
  return { player_a: rotation[0], player_b: rotation[1], serve_start: 'b' }
}

const otherAtTable = (rotation: Rotation, player: string): string =>
  rotation[0] === player ? rotation[1] : rotation[0]

/** Once the game at the table is validated: the winner holds it, the loser joins the back of the File. */
export function afterGame(rotation: Rotation, winner: string): Rotation {
  return [winner, ...rotation.slice(2), otherAtTable(rotation, winner)]
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

/**
 * Whether a party is over as soon as every match in it is done. A double-elim
 * bracket crowns its grand-final winner instead, and a King of the Ping session
 * is between games each time its last match is done: it ends on « Terminer ».
 */
export function crownsWhenAllMatchesDone(t: Pick<Tournament, 'kind' | 'format'>): boolean {
  return t.format !== 'double_elim' && t.kind !== 'king'
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** How a session is crowned: its longest reign and the games validated, nobody before a first game. */
export function sessionCrown(
  matches: ReadonlyArray<Match>,
): { readonly champion: Reign; readonly games: number } | null {
  const champion = longestReign(matches)
  return champion && { champion, games: matches.filter((m) => m.done).length }
}

/** A finished session in one line: its champion, their reign, and how many games were played. */
export function kingRecap(matches: ReadonlyArray<Match>): string | null {
  const crown = sessionCrown(matches)
  if (crown === null) return null
  const { champion, games } = crown
  return `${champion.player} 👑 ${count(champion.wins, "victoire d'affilée", "victoires d'affilée")} · ${count(games, 'partie', 'parties')}`
}

/** What a session's home card says under its name: the recap once it is over, nothing while it runs. */
export function cardRecap(
  t: Pick<Tournament, 'id' | 'kind' | 'status'>,
  matches: ReadonlyArray<Match>,
): string | null {
  if (t.kind !== 'king' || t.status !== 'done') return null
  return kingRecap(matches.filter((m) => m.tournament_id === t.id))
}

/** Starting a new partie closes every open session: each is crowned from its own games, nobody when none was validated. */
export function closingCrowns(
  sessionIds: ReadonlyArray<string>,
  matches: ReadonlyArray<Match>,
): ReadonlyArray<{ readonly id: string; readonly champion: string | null }> {
  return sessionIds.map((id) => ({
    id,
    champion: longestReign(matches.filter((m) => m.tournament_id === id))?.player ?? null,
  }))
}

/** A session that ended before any game was validated leaves no card behind: it never happened. */
export function endedWithoutAGame(
  t: Pick<Tournament, 'id' | 'kind' | 'status'>,
  matches: ReadonlyArray<Match>,
): boolean {
  return (
    t.kind === 'king' &&
    t.status === 'done' &&
    !matches.some((m) => m.tournament_id === t.id && m.done)
  )
}

/** Someone arriving joins at the back of the File. */
export function joinFile(rotation: Rotation, player: string): Rotation {
  return [...rotation, player]
}

/** Someone waiting in the File steps out; the two at the table stay (leaving mid-game is an abandon). */
export function leaveFile(rotation: Rotation, player: string): Rotation {
  return rotation.filter((name, i) => i < 2 || name !== player)
}

/** Someone at the table leaves mid-game: the game is abandoned, whoever stays holds the table, the File steps up. */
export function leaveTable(rotation: Rotation, player: string): Rotation {
  return [otherAtTable(rotation, player), ...rotation.slice(2)]
}

/** One player's line on the result screen: their record over the session's validated games. */
export type SessionResult = { readonly name: string; readonly wins: number; readonly losses: number }

/** Everyone who played a validated game in the session, leavers included, with their record. */
export function sessionResults({
  matches,
}: {
  matches: ReadonlyArray<Match>
}): ReadonlyArray<SessionResult> {
  const record = new Map<string, SessionResult>()
  const tally = (name: string, won: boolean) => {
    const was = record.get(name) ?? { name, wins: 0, losses: 0 }
    record.set(name, won ? { ...was, wins: was.wins + 1 } : { ...was, losses: was.losses + 1 })
  }
  matches
    .filter((m) => m.done)
    .forEach((m) => {
      const { winner, loser } = winnerLoser(m)
      tally(winner, true)
      tally(loser, false)
    })
  return [...record.values()]
}
