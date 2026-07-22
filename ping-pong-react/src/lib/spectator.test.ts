import { describe, expect, it } from 'vitest'
import type { RatingRow } from './rating'
import {
  crowdSplit,
  initials,
  ladderAvatar,
  liveStakes,
  matchStakes,
  type StakeSide,
} from './spectator'

function makeBet(overrides: Partial<Parameters<typeof crowdSplit>[0][number]> = {}) {
  return {
    match_id: 'm1',
    bet_type: 'winner' as const,
    target: 'Léo',
    ...overrides,
  }
}

const matchSides = { id: 'm1', player_a: 'Léo', player_b: 'Thibault' }

describe('crowdSplit', () => {
  it('is null when nobody has bet on the match', () => {
    expect(crowdSplit([], matchSides)).toBeNull()
  })

  it('splits the winner bets between the two players', () => {
    const bets = [makeBet(), makeBet(), makeBet({ target: 'Thibault' })]
    expect(crowdSplit(bets, matchSides)).toEqual({ aPercent: 67, bPercent: 33 })
  })

  it('gives the full bar to one side when everyone agrees', () => {
    const bets = [makeBet(), makeBet()]
    expect(crowdSplit(bets, matchSides)).toEqual({ aPercent: 100, bPercent: 0 })
  })

  it('keeps the two percentages summing to 100', () => {
    const bets = [makeBet({ target: 'Thibault' }), makeBet({ target: 'Thibault' }), makeBet()]
    expect(crowdSplit(bets, matchSides)).toEqual({ aPercent: 33, bPercent: 67 })
  })

  it('splits an even crowd 50/50', () => {
    const bets = [makeBet(), makeBet({ target: 'Thibault' })]
    expect(crowdSplit(bets, matchSides)).toEqual({ aPercent: 50, bPercent: 50 })
  })

  it('ignores bets on other matches', () => {
    expect(crowdSplit([makeBet({ match_id: 'other' })], matchSides)).toBeNull()
  })

  it('ignores non-winner bets (scores, capots)', () => {
    const bets = [
      makeBet({ bet_type: 'score', target: '11-7' }),
      makeBet({ bet_type: 'capot', target: 'yes' }),
    ]
    expect(crowdSplit(bets, matchSides)).toBeNull()
  })

  it('ignores winner bets naming someone not in the match', () => {
    expect(crowdSplit([makeBet({ target: 'Candice' })], matchSides)).toBeNull()
  })
})

describe('initials', () => {
  it('takes the first two letters of a single name', () => {
    expect(initials('Thibault')).toBe('TH')
  })

  it('keeps accents and uppercases them', () => {
    expect(initials('Léo')).toBe('LÉ')
  })

  it('uses the first letter of each word for compound names', () => {
    expect(initials('Jean Marc')).toBe('JM')
  })

  it('uppercases lowercase names', () => {
    expect(initials('candice')).toBe('CA')
  })

  it('handles a one-letter name', () => {
    expect(initials('x')).toBe('X')
  })

  it('falls back to ? for an empty name', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
  })
})

function makeStakeSide(overrides: Partial<StakeSide> = {}): StakeSide {
  return { rating: 1500, rd: 80, vol: 0.06, ...overrides }
}

function makeStakeMatch(overrides: Partial<Parameters<typeof liveStakes>[0]['match']> = {}) {
  return {
    score_a: 0,
    score_b: 0,
    done: false,
    match_key: null,
    win_to: null,
    ...overrides,
  }
}

describe('liveStakes', () => {
  it('projects a gain for the leader and a loss for the trailer', () => {
    const stakes = liveStakes({
      match: makeStakeMatch({ score_a: 9, score_b: 7 }),
      target: 11,
      servingA: true,
      a: makeStakeSide(),
      b: makeStakeSide(),
    })
    expect(stakes).not.toBeNull()
    expect(stakes!.a).toBeGreaterThan(0)
    expect(stakes!.b).toBeLessThan(0)
  })

  it('flips the projection when the other player leads', () => {
    const stakes = liveStakes({
      match: makeStakeMatch({ score_a: 3, score_b: 8 }),
      target: 11,
      servingA: true,
      a: makeStakeSide(),
      b: makeStakeSide(),
    })
    expect(stakes!.a).toBeLessThan(0)
    expect(stakes!.b).toBeGreaterThan(0)
  })

  it('puts more Elo in play when the underdog is winning', () => {
    const favourite = makeStakeSide({ rating: 1650 })
    const underdog = makeStakeSide({ rating: 1350 })
    const upset = liveStakes({
      match: makeStakeMatch({ score_a: 9, score_b: 5 }),
      target: 11,
      servingA: true,
      a: underdog,
      b: favourite,
    })
    const expected = liveStakes({
      match: makeStakeMatch({ score_a: 9, score_b: 5 }),
      target: 11,
      servingA: true,
      a: favourite,
      b: underdog,
    })
    expect(upset!.a).toBeGreaterThan(expected!.a)
  })

  it('puts more Elo in play for a rout than for a close game', () => {
    const rout = liveStakes({
      match: makeStakeMatch({ score_a: 10, score_b: 0 }),
      target: 11,
      servingA: true,
      a: makeStakeSide(),
      b: makeStakeSide(),
    })
    const close = liveStakes({
      match: makeStakeMatch({ score_a: 10, score_b: 8 }),
      target: 11,
      servingA: true,
      a: makeStakeSide(),
      b: makeStakeSide(),
    })
    expect(rout!.a).toBeGreaterThan(close!.a)
  })

  it('presumes the serving side wins when the score is level', () => {
    const stakes = liveStakes({
      match: makeStakeMatch(),
      target: 11,
      servingA: false,
      a: makeStakeSide(),
      b: makeStakeSide(),
    })
    expect(stakes!.b).toBeGreaterThan(0)
    expect(stakes!.a).toBeLessThan(0)
  })

  it('presumes the other side wins when they serve at a level score', () => {
    const stakes = liveStakes({
      match: makeStakeMatch({ score_a: 5, score_b: 5 }),
      target: 11,
      servingA: true,
      a: makeStakeSide(),
      b: makeStakeSide(),
    })
    expect(stakes!.a).toBeGreaterThan(0)
    expect(stakes!.b).toBeLessThan(0)
  })

  it('projects a deuce finish as a two-point win, like any other', () => {
    const at = (score_a: number, score_b: number) =>
      liveStakes({
        match: makeStakeMatch({ score_a, score_b }),
        target: 11,
        servingA: true,
        a: makeStakeSide(),
        b: makeStakeSide(),
      })
    // 10–10 closes out 12–10; same margin (and thus same weight) as 11–9 from 9–9.
    expect(at(10, 10)).toEqual(at(9, 9))
  })

  it('weighs a marathon deuce like any other two-point win at the same target', () => {
    const at = (score_a: number, score_b: number) =>
      liveStakes({
        match: makeStakeMatch({ score_a, score_b }),
        target: 11,
        servingA: true,
        a: makeStakeSide(),
        b: makeStakeSide(),
      })
    // 15–14 closes out 16–14 in a game to 11: still a 2-point margin, and the
    // real target must be used — a 16-point score must not be read as jeu en 21.
    expect(at(15, 14)).toEqual(at(10, 9))
  })

  it('treats unranked players as fresh 1500 ratings', () => {
    const stakes = liveStakes({
      match: makeStakeMatch({ score_a: 6, score_b: 2 }),
      target: 11,
      servingA: true,
      a: null,
      b: null,
    })
    expect(stakes!.a).toBeGreaterThan(0)
    expect(stakes!.b).toBeLessThan(0)
  })

  it('rounds the projected deltas to whole points', () => {
    const stakes = liveStakes({
      match: makeStakeMatch({ score_a: 9, score_b: 7 }),
      target: 11,
      servingA: true,
      a: makeStakeSide(),
      b: makeStakeSide(),
    })
    expect(Number.isInteger(stakes!.a)).toBe(true)
    expect(Number.isInteger(stakes!.b)).toBe(true)
  })

  it('is null once the match is validated (real deltas take over)', () => {
    const stakes = liveStakes({
      match: makeStakeMatch({ score_a: 11, score_b: 7, done: true }),
      target: 11,
      servingA: true,
      a: makeStakeSide(),
      b: makeStakeSide(),
    })
    expect(stakes).toBeNull()
  })
})

describe('ladderAvatar', () => {
  it('finds the photo by the stable match identity (player id)', () => {
    const rows = [
      makeLadderRow({
        key: 'p1',
        name: 'Léo Martin',
        rating: 1500,
        avatar_url: 'https://cdn/avatars/p1.webp?v=1',
      }),
    ]
    expect(ladderAvatar(rows, 'p1', 'Léo')).toBe('https://cdn/avatars/p1.webp?v=1')
  })

  it('finds the photo for legacy name-keyed rows', () => {
    const rows = [
      makeLadderRow({
        key: 'name:Léo',
        name: 'Léo',
        rating: 1500,
        avatar_url: 'https://cdn/avatars/leo.webp?v=1',
      }),
    ]
    expect(ladderAvatar(rows, null, 'Léo')).toBe('https://cdn/avatars/leo.webp?v=1')
  })

  it('falls back to the display name when only a name is known (podium)', () => {
    const rows = [
      makeLadderRow({
        key: 'p1',
        name: 'Léo',
        rating: 1500,
        avatar_url: 'https://cdn/avatars/p1.webp?v=1',
      }),
    ]
    expect(ladderAvatar(rows, null, 'Léo')).toBe('https://cdn/avatars/p1.webp?v=1')
  })

  it('returns null for unknown players or players without a photo', () => {
    const rows = [makeLadderRow({ key: 'p1', name: 'Léo', rating: 1500 })]
    expect(ladderAvatar(rows, 'p1', 'Léo')).toBeNull()
    expect(ladderAvatar(rows, null, 'Inconnu')).toBeNull()
  })

  it('picks the right player out of a multi-row ladder', () => {
    const rows = [
      makeLadderRow({
        key: 'p1',
        name: 'Ana',
        rating: 1600,
        avatar_url: 'https://cdn/avatars/ana.webp?v=1',
      }),
      makeLadderRow({
        key: 'p2',
        name: 'Léo',
        rating: 1500,
        avatar_url: 'https://cdn/avatars/leo.webp?v=1',
      }),
    ]
    expect(ladderAvatar(rows, 'p2', 'Léo')).toBe('https://cdn/avatars/leo.webp?v=1')
    expect(ladderAvatar(rows, null, 'Léo')).toBe('https://cdn/avatars/leo.webp?v=1')
  })
})

function makeLadderRow(
  overrides: Partial<RatingRow> & Pick<RatingRow, 'key' | 'name' | 'rating'>
): RatingRow {
  return {
    playerId: null,
    rd: 80,
    vol: 0.06,
    games: 12,
    peak: overrides.rating,
    lastPlayedAt: null,
    rank: 1,
    provisional: false,
    team: null,
    avatar_url: null,
    trend: 0,
    ...overrides,
  }
}

function makeLiveMatch(overrides: Partial<Parameters<typeof matchStakes>[1]> = {}) {
  return {
    player_a: 'Léo',
    player_a_id: 'p-leo',
    player_b: 'Thibault',
    player_b_id: 'p-thib',
    score_a: 9,
    score_b: 7,
    done: false,
    serve_start: 'a' as const,
    match_key: null,
    win_to: null,
    ...overrides,
  }
}

describe('matchStakes', () => {
  it('projects from each side’s ladder numbers, found by player id', () => {
    const rows = [
      makeLadderRow({ key: 'p-leo', name: 'Léo', rating: 1350 }),
      makeLadderRow({ key: 'p-thib', name: 'Thibault', rating: 1650 }),
    ]
    const even = matchStakes(
      [
        makeLadderRow({ key: 'p-leo', name: 'Léo', rating: 1500 }),
        makeLadderRow({ key: 'p-thib', name: 'Thibault', rating: 1500 }),
      ],
      makeLiveMatch(),
      11
    )
    const upset = matchStakes(rows, makeLiveMatch(), 11)
    expect(upset!.a).toBeGreaterThan(even!.a)
  })

  it('falls back to the name identity for legacy matches without ids', () => {
    // A settled ladder row (rd 80) moves far less than the fresh-newcomer
    // default (rd 350) — finding the row by name is what keeps it small.
    const rows = [makeLadderRow({ key: 'name:Léo', name: 'Léo', rating: 1350 })]
    const withRow = matchStakes(rows, makeLiveMatch({ player_a_id: null }), 11)
    const without = matchStakes([], makeLiveMatch({ player_a_id: null }), 11)
    expect(withRow!.a).toBeLessThan(without!.a)
  })

  it('derives the server from the score for the level-score tie-break', () => {
    // 4–4 with serve_start b: 8 points played → b serves, so b is presumed winner.
    const stakes = matchStakes(
      [],
      makeLiveMatch({ score_a: 4, score_b: 4, serve_start: 'b' }),
      11
    )
    expect(stakes!.b).toBeGreaterThan(0)
    expect(stakes!.a).toBeLessThan(0)
  })

  it('is null for a validated match', () => {
    expect(matchStakes([], makeLiveMatch({ score_a: 11, done: true }), 11)).toBeNull()
  })
})
