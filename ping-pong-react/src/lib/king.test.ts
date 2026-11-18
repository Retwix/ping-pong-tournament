import { describe, expect, it } from 'vitest'
import { nextGame } from './king'

describe('nextGame', () => {
  it('puts the first two of the rotation at the table, the challenger serving', () => {
    expect(nextGame(['Inès', 'Sam', 'Léo'])).toEqual({
      player_a: 'Inès',
      player_b: 'Sam',
      serve_start: 'b',
    })
  })
})
