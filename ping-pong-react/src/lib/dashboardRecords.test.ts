import { describe, expect, it } from 'vitest'
import type { Match, Tournament } from '../types'
import type { PlayerStat } from './stats'
import type { RatingEvent } from './rating'
import { capotList, dashboardRecords } from './dashboardRecords'

function makeStat(overrides: Partial<PlayerStat> = {}): PlayerStat {
  return {
    key: 'pa',
    name: 'Alice',
    team: null,
    avatar_url: null,
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
    matchBallsSaved: 0,
    matchBallsWasted: 0,
    form: [],
    playTimeMs: 0,
    timedMatches: 0,
    lastPlayedAt: null,
    ...overrides,
  }
}

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    tournament_id: 't1',
    round: 0,
    idx: 0,
    player_a: 'Alice',
    player_b: 'Bob',
    player_a_id: 'pa',
    player_b_id: 'pb',
    score_a: 11,
    score_b: 0,
    done: true,
    serve_start: 'a',
    started_at: null,
    ended_at: null,
    bracket: null,
    match_key: null,
    win_to: null,
    win_slot: null,
    lose_to: null,
    lose_slot: null,
    bye: false,
    mb_saved_a: 0,
    mb_saved_b: 0,
    ...overrides,
  }
}

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    created_at: '2026-07-01T09:00:00.000Z',
    name: 'Tournoi de juillet',
    target: 11,
    players: ['Alice', 'Bob'],
    status: 'done',
    kind: 'tournament',
    format: 'round_robin',
    champion: 'Alice',
    is_active: false,
    slack_channel: null,
    slack_thread_ts: null,
    result_notified: false,
    unranked: false,
    doubles: false,
    teams: null,
    chaos_enabled: false,
    chaos_interval: 5,
    chaos_intensity: 'mild',
    chaos_legendary: false,
    ...overrides,
  }
}

function ev(overrides: Partial<RatingEvent> = {}): RatingEvent {
  return {
    matchId: 'm1',
    key: 'pa',
    playerId: null,
    name: 'Alice',
    opponentKey: 'pb',
    opponentName: 'Bob',
    scoreFor: 11,
    scoreAgainst: 0,
    ratingBefore: 1500,
    ratingAfter: 1500,
    rdBefore: 60,
    rdAfter: 60,
    delta: 0,
    weight: 1,
    stakes: 'normal',
    won: false,
    at: null,
    ...overrides,
  }
}

describe('dashboardRecords', () => {
  it('picks the player with the longest current win streak (min 2)', () => {
    const stats = [
      makeStat({ name: 'Alice', currentStreak: 4, avatar_url: 'a.png' }),
      makeStat({ name: 'Bob', currentStreak: 2 }),
    ]
    expect(dashboardRecords(stats, [], []).topStreak).toEqual({
      name: 'Alice',
      avatar_url: 'a.png',
      streak: 4,
    })
  })

  it('has no top streak when nobody is on a 2+ run', () => {
    expect(dashboardRecords([makeStat({ currentStreak: 1 })], [], []).topStreak).toBeNull()
  })

  it('counts capots across finished matches', () => {
    const matches = [makeMatch({ id: 'm1', score_b: 0 }), makeMatch({ id: 'm2', score_b: 7 })]
    expect(dashboardRecords([], matches, []).capots).toBe(1)
  })

  it('picks the most active player by games played', () => {
    const stats = [makeStat({ name: 'Alice', played: 3 }), makeStat({ name: 'Bob', played: 9 })]
    expect(dashboardRecords(stats, [], []).mostActive).toEqual({ name: 'Bob', played: 9 })
  })

  it('finds the biggest upset: a lower-rated winner beating a higher-rated loser', () => {
    const events = [
      ev({ matchId: 'm1', key: 'pa', name: 'Alice', won: true, ratingBefore: 1400, delta: 21 }),
      ev({ matchId: 'm1', key: 'pb', name: 'Bob', won: false, ratingBefore: 1600, delta: -21 }),
    ]
    expect(dashboardRecords([], [], events).biggestUpset).toEqual({
      winner: 'Alice',
      loser: 'Bob',
      gain: 21,
    })
  })

  it('ignores non-upsets (favourite won)', () => {
    const events = [
      ev({ matchId: 'm1', key: 'pa', won: true, ratingBefore: 1600 }),
      ev({ matchId: 'm1', key: 'pb', won: false, ratingBefore: 1400 }),
    ]
    expect(dashboardRecords([], [], events).biggestUpset).toBeNull()
  })
})

describe('capotList', () => {
  const NOW = new Date('2026-07-15T12:00:00.000Z')

  it('lists finished shutouts, most recent first, winner-first score', () => {
    const matches = [
      makeMatch({ id: 'old', ended_at: '2026-07-10T10:00:00.000Z' }),
      makeMatch({
        id: 'recent',
        player_a: 'Bob',
        player_b: 'Alice',
        score_a: 0,
        score_b: 7,
        ended_at: '2026-07-14T10:00:00.000Z',
      }),
    ]
    expect(capotList(matches, [makeTournament()], NOW)).toEqual([
      {
        matchId: 'recent',
        tournamentId: 't1',
        winner: 'Alice',
        loser: 'Bob',
        score: '7 – 0',
        context: 'Tournoi de juillet',
        date: 'il y a 1 j',
      },
      {
        matchId: 'old',
        tournamentId: 't1',
        winner: 'Alice',
        loser: 'Bob',
        score: '11 – 0',
        context: 'Tournoi de juillet',
        date: 'il y a 5 j',
      },
    ])
  })

  it('leaves out unfinished matches, byes and non-shutouts', () => {
    const matches = [
      makeMatch({ id: 'live', done: false }),
      makeMatch({ id: 'bye', bye: true }),
      makeMatch({ id: 'normal', score_b: 9 }),
      makeMatch({ id: 'empty', score_a: 0, score_b: 0 }),
    ]
    expect(capotList(matches, [makeTournament()], NOW)).toEqual([])
  })

  it('labels a quick game and falls back to the start time and no context', () => {
    const matches = [
      makeMatch({ id: 'g', tournament_id: 'tg', started_at: '2026-07-15T11:00:00.000Z' }),
      makeMatch({ id: 'orphan', tournament_id: 'gone' }),
    ]
    const rows = capotList(matches, [makeTournament({ id: 'tg', kind: 'game' })], NOW)
    expect(rows.map((r) => [r.matchId, r.context, r.date])).toEqual([
      ['g', 'Partie rapide', 'il y a 1 h'],
      ['orphan', '', ''],
    ])
  })
})
