import { describe, expect, it } from 'vitest'
import type { Match, Player } from '../types'
import { recentResults } from './recentResults'

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
    score_b: 7,
    done: true,
    serve_start: 'a',
    started_at: '2026-07-27T10:00:00Z',
    ended_at: '2026-07-27T10:10:00Z',
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

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'pa',
    created_at: '',
    name: 'Alice',
    team: 'Red',
    slack_user_id: null,
    avatar_url: null,
    ...overrides,
  }
}

describe('recentResults', () => {
  it('returns the winner, loser and scores of a finished match', () => {
    const [r] = recentResults([makeMatch()], [])
    expect(r).toMatchObject({
      matchId: 'm1',
      tournamentId: 't1',
      winner: 'Alice',
      loser: 'Bob',
      winnerScore: 11,
      loserScore: 7,
    })
  })

  it('reads the winner from whichever side actually won', () => {
    const [r] = recentResults([makeMatch({ score_a: 5, score_b: 11 })], [])
    expect(r).toMatchObject({
      winner: 'Bob',
      loser: 'Alice',
      winnerScore: 11,
      loserScore: 5,
    })
  })

  it('excludes unfinished and bye matches', () => {
    const rows = recentResults(
      [makeMatch({ id: 'm1', done: false }), makeMatch({ id: 'm2', bye: true })],
      [],
    )
    expect(rows).toEqual([])
  })

  it('orders newest first by ended_at', () => {
    const rows = recentResults(
      [
        makeMatch({ id: 'old', ended_at: '2026-07-27T09:00:00Z' }),
        makeMatch({ id: 'new', ended_at: '2026-07-27T11:00:00Z' }),
      ],
      [],
    )
    expect(rows.map((r) => r.matchId)).toEqual(['new', 'old'])
  })

  it('caps the list at the limit', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      makeMatch({ id: `m${i}`, ended_at: `2026-07-27T1${i}:00:00Z` }),
    )
    expect(recentResults(many, [], 5)).toHaveLength(5)
  })

  it('resolves the winner avatar by player id', () => {
    const players = [makePlayer({ id: 'pa', name: 'Alice', avatar_url: 'http://x/a.png' })]
    const [r] = recentResults([makeMatch()], players)
    expect(r.winnerAvatar).toBe('http://x/a.png')
  })

  it('falls back to matching the winner avatar by name', () => {
    const players = [makePlayer({ id: 'other', name: 'Alice', avatar_url: 'http://x/a.png' })]
    const [r] = recentResults([makeMatch({ player_a_id: null })], players)
    expect(r.winnerAvatar).toBe('http://x/a.png')
  })
})
