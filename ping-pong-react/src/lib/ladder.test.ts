import { describe, expect, it } from 'vitest'
import { eventsByMatch, ladderReplay } from './ladder'
import { RATING } from './rating'
import { ALL_TIME } from './seasons'
import type { Match, Player, Tournament } from '../types'

const at = (y: number, m: number, d: number, h = 12): string =>
  new Date(y, m, d, h).toISOString()

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

const players = [getMockPlayer({ id: 'pa', name: 'Léo' }), getMockPlayer({ id: 'pb', name: 'Thibault' })]
const tournaments = [getMockTournament()]
const june = getMockMatch({ id: 'june', ended_at: at(2026, 5, 10) })
const september = getMockMatch({ id: 'sept', ended_at: at(2026, 8, 10) })

describe('ladderReplay', () => {
  it('replays every rated match on the all-time ladder', () => {
    const { events, rows } = ladderReplay(ALL_TIME, { matches: [june, september], players, tournaments })
    expect(events.map((e) => e.matchId)).toEqual(['june', 'june', 'sept', 'sept'])
    expect(rows.map((r) => r.name)).toEqual(['Léo', 'Thibault'])
  })

  it('replays only the matches inside a season, from a fresh 1500', () => {
    const scope = { kind: 'season' as const, id: 'automne-2026' }
    const { events } = ladderReplay(scope, { matches: [june, september], players, tournaments })
    expect(events.map((e) => e.matchId)).toEqual(['sept', 'sept'])
    expect(events[0].ratingBefore).toBe(RATING.R0)
  })

  it('leaves an unranked tournament out of every ladder', () => {
    const unrankedT = getMockTournament({ id: 'nc', unranked: true })
    const nc = getMockMatch({ id: 'nc1', tournament_id: 'nc', ended_at: at(2026, 8, 12) })
    const data = { matches: [september, nc], players, tournaments: [...tournaments, unrankedT] }
    expect(ladderReplay(ALL_TIME, data).events.map((e) => e.matchId)).toEqual(['sept', 'sept'])
    const scope = { kind: 'season' as const, id: 'automne-2026' }
    expect(ladderReplay(scope, data).events.map((e) => e.matchId)).toEqual(['sept', 'sept'])
  })

  it('weighs a match by its tournament target', () => {
    const to21 = getMockTournament({ id: 't21', target: 21 })
    const short = getMockMatch({ id: 's', tournament_id: 't21', score_a: 11, score_b: 9 })
    const withTarget = ladderReplay(ALL_TIME, { matches: [short], players, tournaments: [to21] })
    const inferred = ladderReplay(ALL_TIME, { matches: [short], players, tournaments: [] })
    expect(withTarget.events[0].delta).not.toBe(inferred.events[0].delta)
  })
})

describe('eventsByMatch', () => {
  const history = { matches: [june, september], players, tournaments }

  it('reads a season match off its own season, not off the lifetime ladder', () => {
    const seasonEvents = ladderReplay({ kind: 'season', id: 'automne-2026' }, history).events
    const lifetime = ladderReplay(ALL_TIME, history).events.filter((e) => e.matchId === 'sept')

    const found = eventsByMatch(history).get('sept')
    expect(found?.map((e) => e.delta)).toEqual(seasonEvents.map((e) => e.delta))
    expect(found?.map((e) => e.delta)).not.toEqual(lifetime.map((e) => e.delta))
  })

  it('keeps the lifetime delta for a match played before the first season', () => {
    const lifetime = ladderReplay(ALL_TIME, history).events.filter((e) => e.matchId === 'june')
    expect(eventsByMatch(history).get('june')).toEqual(lifetime)
  })

  it('dates a match by its start when it never recorded an end', () => {
    const noEnd = getMockMatch({ id: 'noend', ended_at: null, started_at: at(2026, 8, 20) })
    const history = { matches: [noEnd], players, tournaments }
    const season = ladderReplay({ kind: 'season', id: 'automne-2026' }, history).events
    expect(season).toHaveLength(2)
    expect(eventsByMatch(history).get('noend')).toEqual(season)
  })

  it('keeps an undated match on the lifetime ladder, the only one that counts it', () => {
    const undated = getMockMatch({ id: 'undated', ended_at: null, started_at: null })
    const history = { matches: [undated], players, tournaments }
    expect(eventsByMatch(history).get('undated')).toEqual(ladderReplay(ALL_TIME, history).events)
  })

  it('leaves out a match no ladder counts', () => {
    const unrankedT = getMockTournament({ id: 'nc', unranked: true })
    const nc = getMockMatch({ id: 'nc1', tournament_id: 'nc', ended_at: at(2026, 8, 12) })
    const found = eventsByMatch({
      matches: [september, nc],
      players,
      tournaments: [...tournaments, unrankedT],
    })
    expect(found.has('nc1')).toBe(false)
    expect(found.get('sept')).toHaveLength(2)
  })
})
