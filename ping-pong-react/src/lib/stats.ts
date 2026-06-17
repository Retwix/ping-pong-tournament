import type { Match, Player } from '../types'
import { matchDuration } from './pingpong'

export interface PlayerStat {
  key: string // stable identity: player id, or `name:<name>` fallback
  name: string // display name (current registry name, or recorded name)
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
  capotsDealt: number // shutout wins inflicted (opponent left on 0)
  capotsTaken: number // times sent under the table (scored 0)
}

/** A finished match where the loser scored 0 — a "capot" / sous la table. */
export function isCapot(m: Match): boolean {
  return Math.min(m.score_a, m.score_b) === 0 && Math.max(m.score_a, m.score_b) > 0
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

export interface OpponentRecord {
  name: string
  wins: number
  losses: number
}

/** Stable identity key for a match side — the player id, or a name fallback. */
export function sideKey(id: string | null, name: string): string {
  return id ?? `name:${name}`
}

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

export function computePlayerStats(matches: Match[], players: Player[]): PlayerStat[] {
  const nameById = new Map<string, string>()
  const teamById = new Map<string, string>()
  const teamByName = new Map<string, string>()
  for (const p of players) {
    nameById.set(p.id, p.name)
    teamById.set(p.id, p.team)
    teamByName.set(p.name, p.team)
  }

  const map = new Map<string, PlayerStat>()
  const results = new Map<string, boolean[]>()

  const ensure = (id: string | null, recordedName: string): PlayerStat => {
    const key = sideKey(id, recordedName)
    let s = map.get(key)
    if (!s) {
      const name = (id && nameById.get(id)) || recordedName
      const team = (id && teamById.get(id)) || teamByName.get(recordedName) || null
      s = {
        key,
        name,
        team,
        played: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
        winRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        capotsDealt: 0,
        capotsTaken: 0,
      }
      map.set(key, s)
    }
    return s
  }
  const pushResult = (key: string, win: boolean) => {
    const arr = results.get(key) ?? []
    arr.push(win)
    results.set(key, arr)
  }

  const sorted = [...matches].sort((a, b) => timeKey(a).localeCompare(timeKey(b)))
  for (const m of sorted) {
    const aWin = m.score_a > m.score_b
    const A = ensure(m.player_a_id, m.player_a)
    const B = ensure(m.player_b_id, m.player_b)
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
    if (isCapot(m)) {
      const winner = aWin ? A : B
      const loser = aWin ? B : A
      winner.capotsDealt++
      loser.capotsTaken++
    }
    pushResult(A.key, aWin)
    pushResult(B.key, !aWin)
  }

  for (const s of map.values()) {
    s.diff = s.pointsFor - s.pointsAgainst
    s.winRate = s.played ? s.wins / s.played : 0
    const r = results.get(s.key) ?? []
    s.longestStreak = longestRun(r)
    s.currentStreak = trailingRun(r)
  }
  return [...map.values()]
}

/**
 * Team ("pôle") standings. Matches between two players of the same team are
 * excluded entirely — they don't count toward played, wins, or win rate, since
 * a teammate-vs-teammate game can't change a team's standing against the others.
 */
export function computeTeamStats(matches: Match[], players: Player[]): TeamStat[] {
  const teamById = new Map<string, string>()
  const teamByName = new Map<string, string>()
  for (const p of players) {
    teamById.set(p.id, p.team)
    teamByName.set(p.name, p.team)
  }
  const teamFor = (id: string | null, name: string): string | null =>
    (id && teamById.get(id)) || teamByName.get(name) || null

  const map = new Map<string, TeamStat>()
  const rosters = new Map<string, Set<string>>()
  const ensure = (team: string): TeamStat => {
    let t = map.get(team)
    if (!t) {
      t = { team, players: 0, played: 0, wins: 0, winRate: 0 }
      map.set(team, t)
      rosters.set(team, new Set())
    }
    return t
  }

  for (const m of matches) {
    const aTeam = teamFor(m.player_a_id, m.player_a)
    const bTeam = teamFor(m.player_b_id, m.player_b)
    // A player still belongs to their team's roster even in an intra-team game.
    if (aTeam) {
      ensure(aTeam)
      rosters.get(aTeam)!.add(sideKey(m.player_a_id, m.player_a))
    }
    if (bTeam) {
      ensure(bTeam)
      rosters.get(bTeam)!.add(sideKey(m.player_b_id, m.player_b))
    }
    // Skip teammate-vs-teammate (and matches missing a team).
    if (!aTeam || !bTeam || aTeam === bTeam) continue
    const ta = ensure(aTeam)
    const tb = ensure(bTeam)
    ta.played++
    tb.played++
    if (m.score_a > m.score_b) ta.wins++
    else tb.wins++
  }

  for (const t of map.values()) {
    t.players = rosters.get(t.team)?.size ?? 0
    t.winRate = t.played ? t.wins / t.played : 0
  }
  return [...map.values()].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
}

/** winner key -> loser key -> number of wins. */
export type HeadToHead = Map<string, Map<string, number>>

export function computeHeadToHead(matches: Match[]): HeadToHead {
  const h: HeadToHead = new Map()
  for (const m of matches) {
    const aWin = m.score_a > m.score_b
    const winner = aWin ? sideKey(m.player_a_id, m.player_a) : sideKey(m.player_b_id, m.player_b)
    const loser = aWin ? sideKey(m.player_b_id, m.player_b) : sideKey(m.player_a_id, m.player_a)
    const inner = h.get(winner) ?? new Map<string, number>()
    inner.set(loser, (inner.get(loser) ?? 0) + 1)
    h.set(winner, inner)
  }
  return h
}

export function h2hWins(h: HeadToHead, winnerKey: string, loserKey: string): number {
  return h.get(winnerKey)?.get(loserKey) ?? 0
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

/** A player's win/loss record against each opponent they've faced (by identity). */
export function opponentRecords(key: string, matches: Match[]): OpponentRecord[] {
  const map = new Map<string, OpponentRecord>()
  for (const m of matches) {
    const aKey = sideKey(m.player_a_id, m.player_a)
    const bKey = sideKey(m.player_b_id, m.player_b)
    let meIsA: boolean
    if (aKey === key) meIsA = true
    else if (bKey === key) meIsA = false
    else continue
    const oppKey = meIsA ? bKey : aKey
    const oppName = meIsA ? m.player_b : m.player_a
    const win = meIsA ? m.score_a > m.score_b : m.score_b > m.score_a
    const r = map.get(oppKey) ?? { name: oppName, wins: 0, losses: 0 }
    r.name = oppName
    if (win) r.wins++
    else r.losses++
    map.set(oppKey, r)
  }
  return [...map.values()]
}

/** A player's most recent matches, newest first. */
export function recentMatchesFor(key: string, matches: Match[], limit = 8): Match[] {
  return matches
    .filter((m) => sideKey(m.player_a_id, m.player_a) === key || sideKey(m.player_b_id, m.player_b) === key)
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

/** A repeated matchup between two players, with the running head-to-head tally. */
export interface Rivalry {
  aKey: string
  aName: string
  aTeam: string | null
  bKey: string
  bName: string
  bTeam: string | null
  total: number
  aWins: number
  bWins: number
  lastPlayed: string | null
}

/**
 * All matchups that have been played at least `minGames` times, with the
 * win tally on each side. Pairs are keyed by identity, order-independent.
 */
export function computeRivalries(matches: Match[], players: Player[], minGames = 2): Rivalry[] {
  const teamById = new Map<string, string>()
  const teamByName = new Map<string, string>()
  for (const p of players) {
    teamById.set(p.id, p.team)
    teamByName.set(p.name, p.team)
  }
  const teamFor = (id: string | null, name: string): string | null =>
    (id && teamById.get(id)) || teamByName.get(name) || null

  const map = new Map<string, Rivalry>()
  for (const m of matches) {
    const aKey = sideKey(m.player_a_id, m.player_a)
    const bKey = sideKey(m.player_b_id, m.player_b)
    if (aKey === bKey) continue
    // Canonical, order-independent pair key.
    const aFirst = aKey < bKey
    const pairKey = aFirst ? `${aKey}|${bKey}` : `${bKey}|${aKey}`

    let r = map.get(pairKey)
    if (!r) {
      r = aFirst
        ? {
            aKey,
            aName: m.player_a,
            aTeam: teamFor(m.player_a_id, m.player_a),
            bKey,
            bName: m.player_b,
            bTeam: teamFor(m.player_b_id, m.player_b),
            total: 0,
            aWins: 0,
            bWins: 0,
            lastPlayed: null,
          }
        : {
            aKey: bKey,
            aName: m.player_b,
            aTeam: teamFor(m.player_b_id, m.player_b),
            bKey: aKey,
            bName: m.player_a,
            bTeam: teamFor(m.player_a_id, m.player_a),
            total: 0,
            aWins: 0,
            bWins: 0,
            lastPlayed: null,
          }
      map.set(pairKey, r)
    }

    r.total++
    const winnerKey = m.score_a > m.score_b ? aKey : bKey
    if (winnerKey === r.aKey) r.aWins++
    else r.bWins++
    const t = m.ended_at ?? m.started_at ?? null
    if (t && (!r.lastPlayed || t > r.lastPlayed)) r.lastPlayed = t
  }

  return [...map.values()].filter((r) => r.total >= minGames)
}

/** How "even" a rivalry is: 1 = perfectly split, 0 = one-sided sweep. */
export function rivalryBalance(r: Rivalry): number {
  return r.total ? Math.min(r.aWins, r.bWins) / (r.total / 2) : 0
}

/** A single day bucket for the activity chart. */
export interface DayCount {
  date: string // YYYY-MM-DD
  count: number
}

/** Number of matches played per calendar day, oldest first. Untimed matches are skipped. */
export function matchesByDay(matches: Match[]): DayCount[] {
  const map = new Map<string, number>()
  for (const m of matches) {
    const t = m.ended_at ?? m.started_at
    if (!t) continue
    const day = new Date(t).toISOString().slice(0, 10)
    map.set(day, (map.get(day) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
