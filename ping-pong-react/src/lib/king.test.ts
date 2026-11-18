import { describe, expect, it, test } from 'vitest'
import { afterGame, nextGame } from './king'

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
