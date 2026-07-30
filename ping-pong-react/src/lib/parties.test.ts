import { describe, expect, it } from 'vitest'
import type { RatingEvent } from './rating'
import type { Match, Tournament } from '../types'
import {
  applySort,
  filterMatchRows,
  filterTournamentRows,
  historySubtitle,
  loadMoreLabel,
  matchRows,
  parseFilter,
  showLiveBlock,
  sortLabel,
  tournamentRows,
  visibleBlocks,
  type MatchRow,
  type TournamentRow,
} from './parties'

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
  champion: 'Léo',
  is_active: false,
  slack_channel: null,
  slack_thread_ts: null,
  result_notified: false,
  chaos_enabled: false,
  chaos_interval: 5,
  chaos_intensity: 'mild',
  chaos_legendary: false,
  ...overrides,
})

const getMockEvent = (overrides?: Partial<RatingEvent>): RatingEvent => ({
  matchId: 'm1',
  key: 'p:leo',
  playerId: 'p1',
  name: 'Léo',
  opponentKey: 'p:thibault',
  opponentName: 'Thibault',
  scoreFor: 11,
  scoreAgainst: 9,
  ratingBefore: 1500,
  ratingAfter: 1512,
  rdBefore: 200,
  rdAfter: 180,
  delta: 12,
  weight: 1,
  stakes: 'normal',
  won: true,
  at: '2026-07-30T10:00:00.000Z',
  ...overrides,
})

describe('historySubtitle', () => {
  it('counts finished matches and finished tournaments', () => {
    const matches = [
      getMockMatch({ id: 'm1' }),
      getMockMatch({ id: 'm2' }),
      getMockMatch({ id: 'm3', done: false }),
    ]
    const tournaments = [
      getMockTournament({ id: 't1' }),
      getMockTournament({ id: 't2' }),
      getMockTournament({ id: 't3', status: 'active' }),
      getMockTournament({ id: 't4', kind: 'game' }),
    ]
    expect(historySubtitle(matches, tournaments)).toBe('2 matchs notés · 2 tournois terminés')
  })

  it('uses the singular for exactly one of each', () => {
    expect(historySubtitle([getMockMatch()], [getMockTournament()])).toBe(
      '1 match noté · 1 tournoi terminé',
    )
  })

  it('keeps the singular at zero (French rule)', () => {
    expect(historySubtitle([], [])).toBe('0 match noté · 0 tournoi terminé')
  })
})

describe('tournamentRows', () => {
  const roundRobin = (tournamentId: string, hourOffset = 0): Match[] => [
    getMockMatch({
      id: `${tournamentId}-m1`,
      tournament_id: tournamentId,
      player_a: 'Ana',
      player_b: 'Bo',
      score_a: 11,
      score_b: 5,
      ended_at: `2026-07-10T${10 + hourOffset}:00:00.000Z`,
    }),
    getMockMatch({
      id: `${tournamentId}-m3`,
      tournament_id: tournamentId,
      player_a: 'Bo',
      player_b: 'Cy',
      score_a: 11,
      score_b: 9,
      ended_at: `2026-07-10T${12 + hourOffset}:00:00.000Z`,
    }),
    getMockMatch({
      id: `${tournamentId}-m2`,
      tournament_id: tournamentId,
      player_a: 'Ana',
      player_b: 'Cy',
      score_a: 11,
      score_b: 7,
      ended_at: `2026-07-10T${11 + hourOffset}:00:00.000Z`,
    }),
  ]
  const doneTournament = (overrides?: Partial<Tournament>): Tournament =>
    getMockTournament({ players: ['Ana', 'Bo', 'Cy'], champion: 'Ana', ...overrides })

  it('keeps only real tournaments, not quick games', () => {
    const rows = tournamentRows(
      [doneTournament({ id: 't1' }), doneTournament({ id: 'g1', kind: 'game' })],
      [],
    )
    expect(rows.map((r) => r.id)).toEqual(['t1'])
  })

  it('derives champion, finalist and end date from the tournament matches', () => {
    const rows = tournamentRows([doneTournament({ id: 't1' })], roundRobin('t1'))
    expect(rows).toEqual([
      {
        id: 't1',
        name: 'Tournoi de juillet',
        playersCount: 3,
        formatLabel: 'Round robin',
        active: false,
        champion: 'Ana',
        finalist: 'Bo',
        endedAt: '2026-07-10T12:00:00.000Z',
      },
    ])
  })

  it('ignores matches of other tournaments', () => {
    const rows = tournamentRows(
      [doneTournament({ id: 't1' })],
      [...roundRobin('t1'), ...roundRobin('t2', 5)],
    )
    expect(rows[0].endedAt).toBe('2026-07-10T12:00:00.000Z')
    expect(rows[0].finalist).toBe('Bo')
  })

  it('shows an active tournament without champion, finalist or end date', () => {
    const rows = tournamentRows(
      [doneTournament({ id: 't1', status: 'active', champion: null })],
      [],
    )
    expect(rows[0]).toMatchObject({ active: true, champion: null, finalist: null, endedAt: null })
  })

  it('labels the double-elimination format', () => {
    const rows = tournamentRows([doneTournament({ id: 't1', format: 'double_elim' })], [])
    expect(rows[0].formatLabel).toBe('Double élimination')
  })

  it('orders active tournaments first, then the most recently finished', () => {
    const tournaments = [
      doneTournament({ id: 'old', created_at: '2026-06-01T09:00:00.000Z' }),
      doneTournament({ id: 'fresh', created_at: '2026-06-02T09:00:00.000Z' }),
      doneTournament({
        id: 'live',
        status: 'active',
        champion: null,
        created_at: '2026-05-01T09:00:00.000Z',
      }),
    ]
    const rows = tournamentRows(tournaments, [...roundRobin('fresh', 5), ...roundRobin('old')])
    expect(rows.map((r) => r.id)).toEqual(['live', 'fresh', 'old'])
  })

  it('has no finalist when the roster kept a single player', () => {
    const rows = tournamentRows(
      [doneTournament({ id: 't1', players: ['Ana'] })],
      [getMockMatch({ id: 'x', tournament_id: 't1', player_a: 'Ana', player_b: 'Zoé' })],
    )
    expect(rows[0].finalist).toBeNull()
  })

  it('falls back to the creation date when a finished tournament has no matches', () => {
    const tournaments = [
      doneTournament({ id: 'early', created_at: '2026-06-01T09:00:00.000Z' }),
      doneTournament({ id: 'late', created_at: '2026-07-01T09:00:00.000Z' }),
    ]
    const rows = tournamentRows(tournaments, [])
    expect(rows.map((r) => r.id)).toEqual(['late', 'early'])
    expect(rows[0].endedAt).toBeNull()
    expect(rows[0].finalist).toBeNull()
  })
})

describe('matchRows', () => {
  it('flattens a finished match: winner first, competition name, winner delta, end date', () => {
    const rows = matchRows(
      [
        getMockMatch({
          id: 'm1',
          tournament_id: 't1',
          player_a: 'Léo',
          player_b: 'Thibault',
          score_a: 7,
          score_b: 11,
        }),
      ],
      [
        getMockEvent({ matchId: 'm1', name: 'Thibault', won: true, delta: 12 }),
        getMockEvent({ matchId: 'm1', name: 'Léo', won: false, delta: -12 }),
      ],
      [getMockTournament({ id: 't1', name: 'Tournoi de juillet' })],
    )
    expect(rows).toEqual([
      {
        id: 'm1',
        tournamentId: 't1',
        winner: 'Thibault',
        loser: 'Léo',
        winnerScore: 11,
        loserScore: 7,
        eloDelta: 12,
        competition: 'Tournoi de juillet',
        endedAt: '2026-07-30T10:00:00.000Z',
      },
    ])
  })

  it('orders rows newest first whatever the input order', () => {
    const rows = matchRows(
      [
        getMockMatch({ id: 'old', ended_at: '2026-07-01T10:00:00.000Z' }),
        getMockMatch({ id: 'new', ended_at: '2026-07-20T10:00:00.000Z' }),
        getMockMatch({ id: 'mid', ended_at: '2026-07-10T10:00:00.000Z' }),
      ],
      [],
      [getMockTournament({ id: 't1' })],
    )
    expect(rows.map((r) => r.id)).toEqual(['new', 'mid', 'old'])
  })

  it('sorts a match with no timestamps last', () => {
    const rows = matchRows(
      [
        getMockMatch({ id: 'ghost', ended_at: null, started_at: null }),
        getMockMatch({ id: 'real', ended_at: '2026-07-20T10:00:00.000Z' }),
      ],
      [],
      [getMockTournament({ id: 't1' })],
    )
    expect(rows.map((r) => r.id)).toEqual(['real', 'ghost'])
  })

  it('excludes byes and unfinished matches', () => {
    const rows = matchRows(
      [
        getMockMatch({ id: 'real' }),
        getMockMatch({ id: 'bye', bye: true }),
        getMockMatch({ id: 'running', done: false }),
      ],
      [],
      [getMockTournament({ id: 't1' })],
    )
    expect(rows.map((r) => r.id)).toEqual(['real'])
  })

  it('labels quick games « Partie rapide »', () => {
    const rows = matchRows(
      [getMockMatch({ id: 'm1', tournament_id: 'g1' })],
      [],
      [getMockTournament({ id: 'g1', kind: 'game', name: 'Léo vs Thibault' })],
    )
    expect(rows[0].competition).toBe('Partie rapide')
  })

  it('shows a dash when the tournament no longer exists', () => {
    const rows = matchRows([getMockMatch({ id: 'm1', tournament_id: 'gone' })], [], [])
    expect(rows[0].competition).toBe('—')
  })

  it('has no Elo delta for an unrated match', () => {
    const rows = matchRows(
      [getMockMatch({ id: 'm1' })],
      [getMockEvent({ matchId: 'other', won: true, delta: 9 })],
      [getMockTournament({ id: 't1' })],
    )
    expect(rows[0].eloDelta).toBeNull()
  })
})

describe('loadMoreLabel', () => {
  it('is hidden when everything is shown', () => {
    expect(loadMoreLabel(0)).toBeNull()
  })

  it('caps the announced batch at the page size', () => {
    expect(loadMoreLabel(62)).toBe('Charger 20 matchs de plus')
    expect(loadMoreLabel(20)).toBe('Charger 20 matchs de plus')
  })

  it('announces the exact remainder under one page', () => {
    expect(loadMoreLabel(5)).toBe('Charger 5 matchs de plus')
  })

  it('uses the singular for a single remaining match', () => {
    expect(loadMoreLabel(1)).toBe('Charger 1 match de plus')
  })
})

const getMatchRow = (overrides?: Partial<MatchRow>): MatchRow => ({
  id: 'm1',
  tournamentId: 't1',
  winner: 'Léo',
  loser: 'Thibault',
  winnerScore: 11,
  loserScore: 9,
  eloDelta: 12,
  competition: 'Tournoi de juillet',
  endedAt: '2026-07-30T10:00:00.000Z',
  ...overrides,
})

const getTourRow = (overrides?: Partial<TournamentRow>): TournamentRow => ({
  id: 't1',
  name: 'Tournoi de juillet',
  playersCount: 3,
  formatLabel: 'Round robin',
  active: false,
  champion: 'Léo',
  finalist: 'Bo',
  endedAt: '2026-07-10T12:00:00.000Z',
  ...overrides,
})

describe('filterMatchRows', () => {
  it('returns everything for an empty query', () => {
    const rows = [getMatchRow({ id: 'a' }), getMatchRow({ id: 'b' })]
    expect(filterMatchRows(rows, '')).toEqual(rows)
  })

  it('matches winner names ignoring case and accents', () => {
    const rows = [getMatchRow({ id: 'a', winner: 'Léo' }), getMatchRow({ id: 'b', winner: 'Bo' })]
    expect(filterMatchRows(rows, 'leo').map((r) => r.id)).toEqual(['a'])
  })

  it('matches loser names too', () => {
    const rows = [
      getMatchRow({ id: 'a', loser: 'Thibault' }),
      getMatchRow({ id: 'b', loser: 'Bo' }),
    ]
    expect(filterMatchRows(rows, 'THIBAULT').map((r) => r.id)).toEqual(['a'])
  })

  it('matches the competition name', () => {
    const rows = [
      getMatchRow({ id: 'a', competition: 'Tournoi de juillet' }),
      getMatchRow({ id: 'b', competition: 'Partie rapide' }),
    ]
    expect(filterMatchRows(rows, 'juillet').map((r) => r.id)).toEqual(['a'])
  })

  it('trims the query before matching', () => {
    expect(filterMatchRows([getMatchRow()], '  léo  ')).toHaveLength(1)
  })

  it('finds nothing for an unknown term', () => {
    expect(filterMatchRows([getMatchRow()], 'zzz')).toEqual([])
  })
})

describe('filterTournamentRows', () => {
  it('matches name, champion and finalist ignoring case and accents', () => {
    const rows = [
      getTourRow({ id: 'byName', name: 'Tournoi d’été', champion: 'X', finalist: 'Y' }),
      getTourRow({ id: 'byChampion', name: 'A', champion: 'Léo', finalist: 'Y' }),
      getTourRow({ id: 'byFinalist', name: 'B', champion: 'X', finalist: 'Léa' }),
      getTourRow({ id: 'none', name: 'C', champion: 'X', finalist: 'Y' }),
    ]
    expect(filterTournamentRows(rows, 'ete').map((r) => r.id)).toEqual(['byName'])
    expect(filterTournamentRows(rows, 'leo').map((r) => r.id)).toEqual(['byChampion'])
    expect(filterTournamentRows(rows, 'lea').map((r) => r.id)).toEqual(['byFinalist'])
  })

  it('trims the query before matching', () => {
    expect(filterTournamentRows([getTourRow()], '  léo  ')).toHaveLength(1)
  })

  it('handles active tournaments without champion or finalist', () => {
    const rows = [getTourRow({ id: 'a', active: true, champion: null, finalist: null })]
    expect(filterTournamentRows(rows, 'léo')).toEqual([])
    expect(filterTournamentRows(rows, '')).toEqual(rows)
  })
})

describe('applySort', () => {
  it('keeps the newest-first order on « Plus récent »', () => {
    const rows = [getMatchRow({ id: 'new' }), getMatchRow({ id: 'old' })]
    expect(applySort(rows, 'recent').map((r) => r.id)).toEqual(['new', 'old'])
  })

  it('reverses on « Plus ancien » without mutating the source', () => {
    const rows = [getMatchRow({ id: 'new' }), getMatchRow({ id: 'old' })]
    expect(applySort(rows, 'oldest').map((r) => r.id)).toEqual(['old', 'new'])
    expect(rows.map((r) => r.id)).toEqual(['new', 'old'])
  })
})

describe('sortLabel', () => {
  it('labels both directions', () => {
    expect(sortLabel('recent')).toBe('Plus récent ▾')
    expect(sortLabel('oldest')).toBe('Plus ancien ▴')
  })
})

describe('visibleBlocks', () => {
  it('shows both tables on « Tout »', () => {
    expect(visibleBlocks('all')).toEqual({ tournois: true, parties: true })
  })

  it('keeps only the matches table on « Parties »', () => {
    expect(visibleBlocks('match')).toEqual({ tournois: false, parties: true })
  })

  it('keeps only the tournaments table on « Tournois »', () => {
    expect(visibleBlocks('tour')).toEqual({ tournois: true, parties: false })
  })
})

describe('showLiveBlock', () => {
  const live = getMockMatch({ done: false, score_a: 4, score_b: 2 })

  it('shows the live card on « Tout » when a match is on the table', () => {
    expect(showLiveBlock('all', live)).toBe(true)
  })

  it('shows it on the « Parties » filter too', () => {
    expect(showLiveBlock('match', live)).toBe(true)
  })

  it('hides it on the « Tournois » filter', () => {
    expect(showLiveBlock('tour', live)).toBe(false)
  })

  it('hides it when nothing is live', () => {
    expect(showLiveBlock('all', null)).toBe(false)
  })
})

describe('parseFilter', () => {
  it('defaults to all without a query string', () => {
    expect(parseFilter('')).toBe('all')
  })

  it('reads the match filter from ?f=match', () => {
    expect(parseFilter('?f=match')).toBe('match')
  })

  it('reads the tournament filter from ?f=tour', () => {
    expect(parseFilter('?f=tour')).toBe('tour')
  })

  it('falls back to all for unknown values', () => {
    expect(parseFilter('?f=everything')).toBe('all')
  })

  it('finds the filter among other params', () => {
    expect(parseFilter('?utm=x&f=tour')).toBe('tour')
  })
})
