export type MatchSide = 'a' | 'b'
export type TournamentStatus = 'active' | 'done'

export interface Tournament {
  id: string
  created_at: string
  name: string
  target: number
  players: string[]
  status: TournamentStatus
  champion: string | null
}

export interface Match {
  id: string
  tournament_id: string
  round: number
  idx: number
  player_a: string
  player_b: string
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
