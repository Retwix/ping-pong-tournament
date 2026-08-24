import { describe, expect, it } from 'vitest'
import type { Match, Player } from '../types'
import { rankRatings, replayRatings, type RatingRow } from './rating'
import { seasonById } from './seasons'
import { ranksInSeason, splitLadder } from './alumni'

const getMockPlayer = (overrides?: Partial<Player>): Player => ({
  id: 'p1',
  created_at: '2026-01-01T00:00:00.000Z',
  name: 'Léo',
  team: 'tech',
  slack_user_id: null,
  avatar_url: null,
  status: 'active',
  left_at: null,
  ...overrides,
})

const getMockRatingRow = (overrides?: Partial<RatingRow>): RatingRow => ({
  key: 'p1',
  playerId: 'p1',
  name: 'Léo',
  rating: 1500,
  rd: 80,
  vol: 0.06,
  games: 10,
  peak: 1500,
  lastPlayedAt: '2026-07-01T00:00:00.000Z',
  rank: 1,
  provisional: false,
  team: 'tech',
  avatar_url: null,
  trend: 0,
  ...overrides,
})

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 0,
  idx: 0,
  player_a: 'Léo',
  player_b: 'Paul',
  player_a_id: 'pa',
  player_b_id: 'pb',
  score_a: 11,
  score_b: 5,
  done: true,
  serve_start: 'a',
  started_at: null,
  first_point_at: null,
  ended_at: '2026-07-01T10:00:00.000Z',
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
})

describe('splitLadder', () => {
  it('leaves active players’ ratings byte-identical to the pre-split replay', () => {
    const players = [
      getMockPlayer({ id: 'pa', name: 'Léo' }),
      getMockPlayer({ id: 'pb', name: 'Paul', status: 'alumni', left_at: '2026-06-01' }),
      getMockPlayer({ id: 'pc', name: 'Thibault' }),
    ]
    const matches = [
      getMockMatch({
        id: 'm1',
        player_a: 'Léo',
        player_b: 'Paul',
        player_a_id: 'pa',
        player_b_id: 'pb',
        score_a: 11,
        score_b: 5,
        ended_at: '2026-07-01T10:00:00.000Z',
      }),
      getMockMatch({
        id: 'm2',
        player_a: 'Thibault',
        player_b: 'Paul',
        player_a_id: 'pc',
        player_b_id: 'pb',
        score_a: 11,
        score_b: 8,
        ended_at: '2026-07-02T10:00:00.000Z',
      }),
      getMockMatch({
        id: 'm3',
        player_a: 'Léo',
        player_b: 'Thibault',
        player_a_id: 'pa',
        player_b_id: 'pc',
        score_a: 11,
        score_b: 9,
        ended_at: '2026-07-03T10:00:00.000Z',
      }),
    ]
    const rows = rankRatings(replayRatings(matches, players), players)
    const { ranked } = splitLadder(rows, players)

    expect(ranked.find((r) => r.name === 'Léo')!.rating).toBe(
      rows.find((r) => r.name === 'Léo')!.rating,
    )
    expect(ranked.find((r) => r.name === 'Thibault')!.rating).toBe(
      rows.find((r) => r.name === 'Thibault')!.rating,
    )
  })

  it('renumbers ranked players contiguously from 1 when an alumnus held a rank', () => {
    const players = [
      getMockPlayer({ id: 'pa', name: 'Léo' }),
      getMockPlayer({ id: 'pb', name: 'Paul', status: 'alumni', left_at: '2026-06-01' }),
      getMockPlayer({ id: 'pc', name: 'Thibault' }),
    ]
    const rows = [
      getMockRatingRow({ key: 'pa', playerId: 'pa', name: 'Léo', rating: 1600, rank: 1 }),
      getMockRatingRow({ key: 'pb', playerId: 'pb', name: 'Paul', rating: 1550, rank: 2 }),
      getMockRatingRow({ key: 'pc', playerId: 'pc', name: 'Thibault', rating: 1500, rank: 3 }),
    ]
    const { ranked } = splitLadder(rows, players)
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([
      ['Léo', 1],
      ['Thibault', 2],
    ])
  })

  it('keeps rating order among anciens', () => {
    const players = [
      getMockPlayer({ id: 'pa', name: 'Paul', status: 'alumni', left_at: '2026-06-01' }),
      getMockPlayer({ id: 'pb', name: 'Sofia', status: 'alumni', left_at: '2026-03-01' }),
    ]
    const rows = [
      getMockRatingRow({ key: 'pa', playerId: 'pa', name: 'Paul', rating: 1594, rank: 1 }),
      getMockRatingRow({ key: 'pb', playerId: 'pb', name: 'Sofia', rating: 1521, rank: 2 }),
    ]
    const { anciens } = splitLadder(rows, players)
    expect(anciens.map((r) => r.name)).toEqual(['Paul', 'Sofia'])
  })

  it('resolves leftAt via playerId even when the recorded row name differs from the registry', () => {
    const players = [
      getMockPlayer({ id: 'pa', name: 'Paul R.', status: 'alumni', left_at: '2026-06-01' }),
    ]
    const rows = [getMockRatingRow({ key: 'pa', playerId: 'pa', name: 'Paul' })]
    const { anciens } = splitLadder(rows, players)
    expect(anciens[0]).toMatchObject({ leftAt: '2026-06-01' })
  })

  it('resolves leftAt by name for a row matched by name only (no playerId)', () => {
    const players = [
      getMockPlayer({ id: 'pa', name: 'Paul', status: 'alumni', left_at: '2026-06-01' }),
    ]
    const rows = [getMockRatingRow({ key: 'name:Paul', playerId: null, name: 'Paul' })]
    const { anciens } = splitLadder(rows, players)
    expect(anciens[0]).toMatchObject({ leftAt: '2026-06-01' })
  })

  it('excludes an alumnus with no matches in scope from both halves', () => {
    const players = [
      getMockPlayer({ id: 'pa', name: 'Léo' }),
      getMockPlayer({ id: 'pb', name: 'Paul', status: 'alumni', left_at: '2026-06-01' }),
    ]
    const rows = [getMockRatingRow({ key: 'pa', playerId: 'pa', name: 'Léo' })]
    const { ranked, anciens } = splitLadder(rows, players)
    expect(ranked.map((r) => r.name)).not.toContain('Paul')
    expect(anciens.map((r) => r.name)).not.toContain('Paul')
  })

  it('resolves alumni status for a row matched by name only (no playerId)', () => {
    const players = [
      getMockPlayer({ id: 'pa', name: 'Paul', status: 'alumni', left_at: '2026-06-01' }),
    ]
    const rows = [getMockRatingRow({ key: 'name:Paul', playerId: null, name: 'Paul' })]
    const { ranked, anciens } = splitLadder(rows, players)
    expect(ranked).toHaveLength(0)
    expect(anciens.map((r) => r.name)).toEqual(['Paul'])
  })

  describe('with a season', () => {
    const season = seasonById('automne-2026')! // 1 Sep 2026 → 1 Dec 2026 (exclusive)

    it('keeps an alumnus who left after this season closed in ranked, contiguously numbered', () => {
      const players = [
        getMockPlayer({ id: 'pa', name: 'Léo' }),
        getMockPlayer({ id: 'pb', name: 'Paul', status: 'alumni', left_at: '2027-02-01' }),
      ]
      const rows = [
        getMockRatingRow({ key: 'pb', playerId: 'pb', name: 'Paul', rating: 1600, rank: 1 }),
        getMockRatingRow({ key: 'pa', playerId: 'pa', name: 'Léo', rating: 1500, rank: 2 }),
      ]
      const { ranked, anciens } = splitLadder(rows, players, season)
      expect(ranked.map((r) => [r.name, r.rank])).toEqual([
        ['Paul', 1],
        ['Léo', 2],
      ])
      expect(anciens).toHaveLength(0)
    })

    it('drops an alumnus who left mid-season into anciens for that season, with their departure date', () => {
      const players = [
        getMockPlayer({ id: 'pa', name: 'Léo' }),
        getMockPlayer({ id: 'pb', name: 'Paul', status: 'alumni', left_at: '2026-10-15' }),
      ]
      const rows = [
        getMockRatingRow({ key: 'pa', playerId: 'pa', name: 'Léo', rating: 1500, rank: 1 }),
        getMockRatingRow({ key: 'pb', playerId: 'pb', name: 'Paul', rating: 1600, rank: 2 }),
      ]
      const { ranked, anciens } = splitLadder(rows, players, season)
      expect(ranked.map((r) => r.name)).toEqual(['Léo'])
      expect(anciens[0]).toMatchObject({ name: 'Paul', leftAt: '2026-10-15' })
    })
  })
})

describe('ranksInSeason', () => {
  const season = seasonById('automne-2026')! // 1 Sep 2026 → 1 Dec 2026 (exclusive)

  it('always ranks an active player, in a season or all-time', () => {
    expect(ranksInSeason('active', null, season)).toBe(true)
    expect(ranksInSeason('active', null, null)).toBe(true)
  })

  it('never ranks an alumnus all-time (no season)', () => {
    expect(ranksInSeason('alumni', '2027-01-01', null)).toBe(false)
  })

  it('excludes an alumnus who left before the season even started', () => {
    expect(ranksInSeason('alumni', '2026-06-01', season)).toBe(false)
  })

  it('excludes an alumnus who left during the season window', () => {
    expect(ranksInSeason('alumni', '2026-10-15', season)).toBe(false)
  })

  it('ranks an alumnus whose departure lands exactly on the season’s closing boundary', () => {
    expect(ranksInSeason('alumni', '2026-12-01', season)).toBe(true)
  })

  it('ranks an alumnus who left after the season closed', () => {
    expect(ranksInSeason('alumni', '2027-02-01', season)).toBe(true)
  })

  it('never ranks an alumnus with no departure date, in any season', () => {
    expect(ranksInSeason('alumni', null, season)).toBe(false)
  })
})
