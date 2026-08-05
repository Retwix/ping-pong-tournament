import { describe, expect, it } from 'vitest'
import { ratedMatches, replayRatings, RATING } from './rating'
import type { Match, Player, Tournament } from '../types'

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
  ended_at: '2026-07-30T10:00:00.000Z',
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

const getMockTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  created_at: '2026-07-01T09:00:00.000Z',
  name: 'Tournoi de juillet',
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

const getMockPlayer = (overrides?: Partial<Player>): Player => ({
  id: 'pa',
  created_at: '2026-06-01T09:00:00.000Z',
  name: 'Léo',
  team: 'tech',
  slack_user_id: null,
  avatar_url: null,
  ...overrides,
})

describe('ratedMatches', () => {
  it('keeps matches from ranked tournaments', () => {
    const matches = [getMockMatch()]
    expect(ratedMatches(matches, [getMockTournament()])).toEqual(matches)
  })

  it('drops matches from unranked tournaments', () => {
    const matches = [getMockMatch()]
    expect(ratedMatches(matches, [getMockTournament({ unranked: true })])).toEqual([])
  })

  it('splits a mixed history by each match’s own tournament', () => {
    const ranked = getMockMatch({ id: 'm1', tournament_id: 't1' })
    const unranked = getMockMatch({ id: 'm2', tournament_id: 't2' })
    const tournaments = [
      getMockTournament({ id: 't1' }),
      getMockTournament({ id: 't2', unranked: true }),
    ]
    expect(ratedMatches([ranked, unranked], tournaments)).toEqual([ranked])
  })

  it('treats a pre-migration row without the flag as ranked', () => {
    const matches = [getMockMatch()]
    expect(ratedMatches(matches, [{ id: 't1' }])).toEqual(matches)
  })

  it('keeps a match whose tournament is not in the list', () => {
    const matches = [getMockMatch({ tournament_id: 'gone' })]
    expect(ratedMatches(matches, [getMockTournament({ unranked: true })])).toEqual(matches)
  })
})

describe('unranked matches never touch the Elo ladder', () => {
  const players = [getMockPlayer(), getMockPlayer({ id: 'pb', name: 'Thibault' })]

  it('moves no rating and emits no rating event for an unranked game', () => {
    const tournaments = [getMockTournament({ unranked: true })]
    const { states, events } = replayRatings(ratedMatches([getMockMatch()], tournaments), players)
    expect(events).toEqual([])
    expect([...states.values()].every((s) => s.rating === RATING.R0 && s.games === 0)).toBe(true)
  })

  it('rates ranked matches while skipping unranked ones in the same history', () => {
    const tournaments = [
      getMockTournament({ id: 't1' }),
      getMockTournament({ id: 't2', unranked: true }),
    ]
    const matches = [
      getMockMatch({ id: 'm1', tournament_id: 't1' }),
      getMockMatch({ id: 'm2', tournament_id: 't2', ended_at: '2026-07-31T10:00:00.000Z' }),
    ]
    const { states, events } = replayRatings(ratedMatches(matches, tournaments), players)
    expect(events.map((e) => e.matchId)).toEqual(['m1', 'm1'])
    expect(states.get('pa')?.games).toBe(1)
    expect(states.get('pa')?.rating).toBeGreaterThan(RATING.R0)
  })
})
