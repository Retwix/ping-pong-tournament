export type MatchSide = 'a' | 'b'
export type TournamentStatus = 'active' | 'done'
export type TournamentKind = 'tournament' | 'game'
/** How matchups are produced: classic round-robin, or a double-elimination bracket. */
export type TournamentFormat = 'round_robin' | 'double_elim'
/** Which bracket a double-elim match belongs to. null for round-robin matches. */
export type Bracket = 'W' | 'L' | 'GF'

/** Placeholder names used in double-elim match slots before a player is known. */
export const TBD = '__TBD__'
export const BYE = '__BYE__'

/** A registered player, used to build tournaments and (later) aggregate stats. */
export interface Player {
  id: string
  created_at: string
  name: string
  team: string
  /** Slack user id (e.g. U0123ABCD) for private invitations. null = not on Slack. */
  slack_user_id: string | null
}

export interface Tournament {
  id: string
  created_at: string
  name: string
  target: number
  players: string[]
  status: TournamentStatus
  kind: TournamentKind
  /** Match format. Defaults to round-robin for tournaments created before this existed. */
  format: TournamentFormat
  champion: string | null
  /** Sticky pointer to the tournament shown by the stable /live and /ref views. */
  is_active: boolean
  /** Slack: conversation + message ts of the invitation (results reply in this thread). */
  slack_channel: string | null
  slack_thread_ts: string | null
  result_notified: boolean
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
  /**
   * Double-elimination bracket fields (all null/false for round-robin matches).
   * `match_key` is a stable id unique within the tournament (e.g. "W1-0", "L3-1",
   * "GF"). `win_to`/`lose_to` point at the match_key the winner/loser advance to,
   * and `win_slot`/`lose_slot` say which side ('a' | 'b') they fill there.
   */
  bracket: Bracket | null
  match_key: string | null
  win_to: string | null
  win_slot: MatchSide | null
  lose_to: string | null
  lose_slot: MatchSide | null
  /** Auto-completed walkover (a real player vs a BYE). Excluded from stats. */
  bye: boolean
  /**
   * Match balls (match points) saved by each side in this match — i.e. points
   * won while the opponent was one point from winning the match. A match ball
   * saved by one side is, by definition, a match ball wasted by the other, so
   * "wasted" is derived from the opponent's saved count rather than stored.
   */
  mb_saved_a: number
  mb_saved_b: number
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
