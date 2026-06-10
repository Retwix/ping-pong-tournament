import type { Match } from '../types'
import { matchDuration } from './pingpong'

export interface PlayerStat {
  name: string
  team: string | null
  played: number
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  diff: number
  winRate: number // 0..1
  currentStreak: number // consecutive wins ending at the most recent match
  longestStreak: number
}

export interface TeamStat {
  team: string
  players: number
  played: number
  wins: number
  winRate: number
}

export interface MatchHighlight {
  match: Match
  value: number
}

export interface Superlatives {
  longestMatch?: MatchHighlight
  shortestMatch?: MatchHighlight
  biggestBlowout?: MatchHighlight
  closestGame?: MatchHighlight
  mostPoints?: MatchHighlight
}

/** Chronological key for a match (ISO strings sort lexicographically). */
function timeKey(m: Match): string {
  return m.ended_at ?? m.started_at ?? ''
}

function longestRun(results: boolean[]): number {
  let best = 0
  let run = 0
  for (const win of results) {
    run = win ? run + 1 : 0
    if (run > best) best = run
  }
  return best
}

function trailingRun(results: boolean[]): number {
  let run = 0
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i]) run++
    else break
  }
  return run
}

export function computePlayerStats(matches: Match[], teamByName: Map<string, string>): PlayerStat[] {
  const map = new Map<string, PlayerStat>()
  const results = new Map<string, boolean[]>()

  const ensure = (name: string): PlayerStat => {
    let s = map.get(name)
    if (!s) {
      s = {
        name,
        team: teamByName.get(name) ?? null,
        played: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
        winRate: 0,
        currentStreak: 0,
        longestStreak: 0,
      }
      map.set(name, s)
    }
    return s
  }
  const pushResult = (name: string, win: boolean) => {
    const arr = results.get(name) ?? []
    arr.push(win)
    results.set(name, arr)
  }

  const sorted = [...matches].sort((a, b) => timeKey(a).localeCompare(timeKey(b)))
  for (const m of sorted) {
    const aWin = m.score_a > m.score_b
    const A = ensure(m.player_a)
    const B = ensure(m.player_b)
    A.played++
    B.played++
    A.pointsFor += m.score_a
    A.pointsAgainst += m.score_b
    B.pointsFor += m.score_b
    B.pointsAgainst += m.score_a
    if (aWin) {
      A.wins++
      B.losses++
    } else {
      B.wins++
      A.losses++
    }
    pushResult(m.player_a, aWin)
    pushResult(m.player_b, !aWin)
  }

  for (const s of map.values()) {
    s.diff = s.pointsFor - s.pointsAgainst
    s.winRate = s.played ? s.wins / s.played : 0
    const r = results.get(s.name) ?? []
    s.longestStreak = longestRun(r)
    s.currentStreak = trailingRun(r)
  }
  return [...map.values()]
}

export function computeTeamStats(playerStats: PlayerStat[]): TeamStat[] {
  const map = new Map<string, TeamStat>()
  for (const s of playerStats) {
    if (!s.team) continue
    const t = map.get(s.team) ?? { team: s.team, players: 0, played: 0, wins: 0, winRate: 0 }
    t.players++
    t.played += s.played
    t.wins += s.wins
    map.set(s.team, t)
  }
  for (const t of map.values()) t.winRate = t.played ? t.wins / t.played : 0
  return [...map.values()].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
}

/** winner name -> loser name -> number of wins. */
export type HeadToHead = Map<string, Map<string, number>>

export function computeHeadToHead(matches: Match[]): HeadToHead {
  const h: HeadToHead = new Map()
  for (const m of matches) {
    const aWin = m.score_a > m.score_b
    const winner = aWin ? m.player_a : m.player_b
    const loser = aWin ? m.player_b : m.player_a
    const inner = h.get(winner) ?? new Map<string, number>()
    inner.set(loser, (inner.get(loser) ?? 0) + 1)
    h.set(winner, inner)
  }
  return h
}

export function h2hWins(h: HeadToHead, winner: string, loser: string): number {
  return h.get(winner)?.get(loser) ?? 0
}

export function computeSuperlatives(matches: Match[]): Superlatives {
  const out: Superlatives = {}
  for (const m of matches) {
    const margin = Math.abs(m.score_a - m.score_b)
    const total = m.score_a + m.score_b

    if (m.started_at && m.ended_at) {
      const ms = matchDuration(m)
      if (ms > 0) {
        if (!out.longestMatch || ms > out.longestMatch.value) out.longestMatch = { match: m, value: ms }
        if (!out.shortestMatch || ms < out.shortestMatch.value) out.shortestMatch = { match: m, value: ms }
      }
    }
    if (!out.biggestBlowout || margin > out.biggestBlowout.value) out.biggestBlowout = { match: m, value: margin }
    if (
      !out.closestGame ||
      margin < out.closestGame.value ||
      (margin === out.closestGame.value && total > out.closestGame.match.score_a + out.closestGame.match.score_b)
    ) {
      out.closestGame = { match: m, value: margin }
    }
    if (!out.mostPoints || total > out.mostPoints.value) out.mostPoints = { match: m, value: total }
  }
  return out
}

export interface OpponentRecord {
  name: string
  wins: number
  losses: number
}

/** A player's win/loss record against each opponent they've faced. */
export function opponentRecords(name: string, matches: Match[]): OpponentRecord[] {
  const map = new Map<string, OpponentRecord>()
  for (const m of matches) {
    let opp: string | null = null
    let win = false
    if (m.player_a === name) {
      opp = m.player_b
      win = m.score_a > m.score_b
    } else if (m.player_b === name) {
      opp = m.player_a
      win = m.score_b > m.score_a
    }
    if (!opp) continue
    const r = map.get(opp) ?? { name: opp, wins: 0, losses: 0 }
    if (win) r.wins++
    else r.losses++
    map.set(opp, r)
  }
  return [...map.values()]
}

/** A player's most recent matches, newest first. */
export function recentMatchesFor(name: string, matches: Match[], limit = 8): Match[] {
  return matches
    .filter((m) => m.player_a === name || m.player_b === name)
    .sort((a, b) => timeKey(b).localeCompare(timeKey(a)))
    .slice(0, limit)
}

/** Convenience: winner / loser names for a finished match. */
export function winnerLoser(m: Match): { winner: string; loser: string; ws: number; ls: number } {
  const aWin = m.score_a > m.score_b
  return aWin
    ? { winner: m.player_a, loser: m.player_b, ws: m.score_a, ls: m.score_b }
    : { winner: m.player_b, loser: m.player_a, ws: m.score_b, ls: m.score_a }
}
