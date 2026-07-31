import { describe, expect, it } from 'vitest'
import type { Match } from '../types'
import type { PlayerStat } from './stats'
import type { RatingEvent } from './rating'
import { dashboardRecords } from './dashboardRecords'

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
