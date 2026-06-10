export type MatchSide = 'a' | 'b'
export type TournamentStatus = 'active' | 'done'
export type TournamentKind = 'tournament' | 'game'

/** A registered player, used to build tournaments and (later) aggregate stats. */
export interface Player {
  id: string
  created_at: string
  name: string
  team: string
}

export interface Tournament {
  id: string
  created_at: string
  name: string
  target: number
  players: string[]
  status: TournamentStatus
  kind: TournamentKind
  champion: string | null
}

export interface Match {
  id: string
  tournament_id: string
  round: number
  idx: number
  player_a: string
  player_b: string
  player_a_id: string | null
  player_b_id: string | null
  score_a: number
  score_b: number
  done: boolean
  serve_start: MatchSide
  started_at: string | null
  ended_at: string | null
}

/** A row in the live standings table. */
export interface StandingRow {
  name: string
  played: number
  wins: number
  pointsFor: number
  pointsAgainst: number
  diff: number
}
