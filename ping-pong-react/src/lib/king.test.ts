import { describe, expect, it, test } from 'vitest'
import { afterGame, longestReign, nextGame } from './king'
import type { Match } from '../types'

describe('nextGame', () => {
  it('puts the first two of the rotation at the table, the challenger serving', () => {
    expect(nextGame(['Inès', 'Sam', 'Léo'])).toEqual({
      player_a: 'Inès',
      player_b: 'Sam',
      serve_start: 'b',
    })
  })
})

describe('afterGame', () => {
  test.for([
    { when: 'the King wins', rotation: ['Inès', 'Sam', 'Léo', 'Zoé'], winner: 'Inès', next: ['Inès', 'Léo', 'Zoé', 'Sam'] },
    { when: 'the challenger wins', rotation: ['Inès', 'Sam', 'Léo', 'Zoé'], winner: 'Sam', next: ['Sam', 'Léo', 'Zoé', 'Inès'] },
    { when: 'two players only', rotation: ['Inès', 'Sam'], winner: 'Sam', next: ['Sam', 'Inès'] },
  ])('$when: the winner stays, the loser goes to the back', ({ rotation, winner, next }) => {
    expect(afterGame(rotation, winner)).toEqual(next)
  })
})

const game = (over: Partial<Match>): Match => ({
  id: `m${over.idx ?? 0}`,
  tournament_id: 't1',
  round: 0,
  idx: 0,
  player_a: 'Inès',
  player_b: 'Sam',
  player_a_id: null,
  player_b_id: null,
  score_a: 7,
  score_b: 4,
  done: true,
  serve_start: 'b',
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
  ...over,
})

const aWins = (idx: number, a: string, b: string): Match => game({ idx, player_a: a, player_b: b })
const bWins = (idx: number, a: string, b: string): Match =>
  game({ idx, player_a: a, player_b: b, score_a: 5, score_b: 7 })

describe('longestReign', () => {
  test.for([
    {
      when: 'a tie goes to the reign that got there first',
      games: [aWins(0, 'Inès', 'Sam'), aWins(1, 'Inès', 'Léo'), bWins(2, 'Inès', 'Léo'), aWins(3, 'Léo', 'Sam')],
      reign: { player: 'Inès', wins: 2 },
    },
    {
      when: 'a later, longer reign takes the Record',
      games: [aWins(0, 'Inès', 'Sam'), bWins(1, 'Inès', 'Léo'), aWins(2, 'Léo', 'Sam'), aWins(3, 'Léo', 'Inès')],
      reign: { player: 'Léo', wins: 3 },
    },
    {
      when: 'games arrive out of order',
      games: [aWins(3, 'Léo', 'Sam'), aWins(0, 'Inès', 'Sam'), aWins(2, 'Léo', 'Inès'), bWins(1, 'Inès', 'Léo')],
      reign: { player: 'Léo', wins: 3 },
    },
    {
      when: 'the game in progress has not counted yet',
      games: [aWins(0, 'Inès', 'Sam'), { ...aWins(1, 'Inès', 'Léo'), done: false, score_a: 5, score_b: 3 }],
      reign: { player: 'Inès', wins: 1 },
    },
  ])('$when', ({ games, reign }) => {
    expect(longestReign(games)).toEqual(reign)
  })

  it('has no reign before the first game is validated', () => {
    expect(longestReign([{ ...aWins(0, 'Inès', 'Sam'), done: false }])).toBeNull()
  })
})
