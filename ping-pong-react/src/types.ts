import type { ChaosIntensity } from './lib/chaos'

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

/** « Les anciens » : a player who has left the company keeps their history but no live rank. */
export type PlayerStatus = 'active' | 'alumni'

/** A registered player, used to build tournaments and (later) aggregate stats. */
export interface Player {
  id: string
  created_at: string
  name: string
  team: string
  /** Slack user id (e.g. U0123ABCD) for private invitations. null = not on Slack. */
  slack_user_id: string | null
  /** Public URL of the uploaded profile photo (with cache-buster). null = initial-letter avatar. */
  avatar_url: string | null
  /** 'alumni' once they've left the company. Rows predating the migration read as 'active'. */
  status: PlayerStatus
  /** Departure date (YYYY-MM-DD), drives « parti·e en juin 2026 ». null on active players. */
  left_at: string | null
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
  /**
   * « Non classée » : the result moves no Elo and is excluded from « Le
   * classement », but stays in the Parties history. Absent on rows created
   * before the unranked migration — readers treat missing as false.
   */
  unranked: boolean
  /**
   * « Double » : a 2v2 quick game. The single match carries the pair display
   * names (« Léo & Inès ») as its players; `teams` stores the two id-pairs
   * ([[idA1, idA2], [idB1, idB2]]) so stats stay rename-proof. Absent on rows
   * created before the doubles migration — readers treat missing as
   * false/null. Doubles are always unranked in v1 (no pair Elo).
   */
  doubles: boolean
  teams: string[][] | null
  /**
   * Chaos Mode config (see docs/chaos-mode.md). Absent on tournaments created
   * before the feature existed; read via chaosSettingsFromTournament, which
   * normalizes missing columns to the defaults.
   */
  chaos_enabled: boolean
  chaos_interval: number
  chaos_intensity: ChaosIntensity
  chaos_legendary: boolean
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
  /**
   * When the first point was scored — the match chrono, kept apart from
   * `started_at` so a match the referee has put on the table reads as live at
   * 0–0 without its clock running. Null on rows written before this column
   * existed, where `started_at` was itself stamped on the first point.
   */
  first_point_at: string | null
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
