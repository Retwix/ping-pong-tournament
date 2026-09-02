import { describe, expect, it } from 'vitest'
import { EMPTY_LADDER, ladderOf, PRE_SEASONS, seasonLadders } from './seasonReplay'
import { RATING } from './rating'
import type { Match, Player, Tournament } from '../types'

const at = (y: number, m: number, d: number, h = 12): string => new Date(y, m, d, h).toISOString()

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 0,
  idx: 0,
  player_a: 'Léo',
  player_b: 'Thibault',
  player_a_id: 'pa',
  player_b_id: 'pb',
  score_a: 11,
  score_b: 9,
  done: true,
  serve_start: 'a',
  started_at: null,
  ended_at: at(2026, 9, 10),
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

const getMockPlayer = (overrides?: Partial<Player>): Player => ({
  id: 'pa',
  created_at: at(2026, 0, 1),
  name: 'Léo',
  team: 'tech',
  slack_user_id: null,
  avatar_url: null,
  status: 'active',
  left_at: null,
  ...overrides,
})

const getMockTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  created_at: at(2026, 8, 1),
  name: 'Tournoi',
  target: 11,
  players: ['Léo', 'Thibault'],
  status: 'done',
  kind: 'tournament',
  format: 'round_robin',
  champion: null,
  is_active: false,
  slack_channel: null,
  slack_thread_ts: null,
  result_notified: false,
  unranked: false,
  doubles: false,
  teams: null,
  chaos_enabled: false,
  chaos_interval: 2,
  chaos_intensity: 'full',
  chaos_legendary: true,
  ...overrides,
})

const players = [
  getMockPlayer({ id: 'pa', name: 'Léo' }),
  getMockPlayer({ id: 'pb', name: 'Thibault' }),
]
const tournaments = [getMockTournament()]

describe('seasonLadders', () => {
  it('gives each season its own ladder, keyed by id', () => {
    const autumn = getMockMatch({ id: 'a', ended_at: at(2026, 9, 10) })
    const winter = getMockMatch({ id: 'w', ended_at: at(2026, 11, 10) })
    const { bySeason } = seasonLadders([autumn, winter], players, tournaments)
    expect([...bySeason.keys()].sort()).toEqual(['automne-2026', 'hiver-2026'])
    expect(bySeason.get('automne-2026')?.events.map((e) => e.matchId)).toEqual(['a', 'a'])
    expect(bySeason.get('hiver-2026')?.events.map((e) => e.matchId)).toEqual(['w', 'w'])
  })

  it('replays every season from 1500, so a second season ignores the first', () => {
    const autumn = Array.from({ length: 6 }, (_, i) =>
      getMockMatch({ id: `a${i}`, ended_at: at(2026, 9, 1 + i) }),
    )
    const winter = getMockMatch({ id: 'w', ended_at: at(2026, 11, 4) })
    const { bySeason } = seasonLadders([...autumn, winter], players, tournaments)

    const opener = bySeason.get('hiver-2026')!.events[0]
    expect(opener.ratingBefore).toBe(RATING.R0)
    expect(opener.rdBefore).toBe(RATING.RD0)
    // The autumn ladder did move — this is a reset, not an empty history.
    const autumnEvents = bySeason.get('automne-2026')!.events
    expect(autumnEvents[autumnEvents.length - 1].ratingAfter).not.toBe(RATING.R0)
  })

  it('keeps pre-season matches in their own bucket rather than dropping them', () => {
    const old = getMockMatch({ id: 'old', ended_at: at(2026, 5, 4) })
    const undated = getMockMatch({ id: 'undated', ended_at: null, started_at: null })
    const { bySeason, events } = seasonLadders([old, undated], players, tournaments)
    expect([...bySeason.keys()]).toEqual([PRE_SEASONS])
    expect(events.map((e) => e.matchId)).toEqual(['undated', 'undated', 'old', 'old'])
  })

  it('orders events oldest window first, « avant les saisons » ahead of every season', () => {
    const pre = getMockMatch({ id: 'pre', ended_at: at(2026, 5, 4) })
    const winter = getMockMatch({ id: 'w', ended_at: at(2026, 11, 4) })
    const autumn = getMockMatch({ id: 'a', ended_at: at(2026, 9, 4) })
    const { events } = seasonLadders([winter, autumn, pre], players, tournaments)
    expect(events.map((e) => e.matchId)).toEqual(['pre', 'pre', 'a', 'a', 'w', 'w'])
  })

  it('leaves « non classée » tournaments out of every ladder', () => {
    const rated = getMockMatch({ id: 'r', tournament_id: 't1', ended_at: at(2026, 9, 4) })
    const unranked = getMockMatch({ id: 'u', tournament_id: 't2', ended_at: at(2026, 9, 5) })
    const { events } = seasonLadders([rated, unranked], players, [
      ...tournaments,
      getMockTournament({ id: 't2', unranked: true }),
    ])
    expect(events.map((e) => e.matchId)).toEqual(['r', 'r'])
  })

  it('gives a match the move it made on the night, not the one a lifetime replay would', () => {
    // Six autumn wins for Léo, then one winter match. Lifetime, he enters that
    // last game rated and certain; in his own season he enters it at 1500/350.
    const autumn = Array.from({ length: 6 }, (_, i) =>
      getMockMatch({ id: `a${i}`, ended_at: at(2026, 9, 1 + i) }),
    )
    const winter = getMockMatch({ id: 'w', ended_at: at(2026, 11, 4) })
    const { events } = seasonLadders([...autumn, winter], players, tournaments)
    const move = events.find((e) => e.matchId === 'w' && e.key === 'pa')!
    expect(move.ratingBefore).toBe(RATING.R0)
  })
})

describe('ladderOf', () => {
  it('reads a season straight out of the partition', () => {
    const ladders = seasonLadders([getMockMatch({ id: 'a' })], players, tournaments)
    expect(ladderOf(ladders, 'automne-2026').events.map((e) => e.matchId)).toEqual(['a', 'a'])
  })

  it('answers with an empty ladder for a season nobody has played in', () => {
    const ladders = seasonLadders([], players, tournaments)
    expect(ladderOf(ladders, 'hiver-2026')).toBe(EMPTY_LADDER)
    expect(ladderOf(ladders, 'hiver-2026').states.size).toBe(0)
  })
})
