import { describe, expect, it } from 'vitest'
import { buildDoubleElim } from './doubleElim'

const players = (count: number): string[] => Array.from({ length: count }, (_, i) => `Joueur ${i + 1}`)

const playOrder = (count: number): string[] => buildDoubleElim(players(count)).map((row) => row.match_key)

describe('double-elimination play order', () => {
  it('plays each losers round as soon as the winners round feeding it is over', () => {
    expect(playOrder(8)).toEqual([
      'W1-0', 'W1-1', 'W1-2', 'W1-3',
      'L1-0', 'W2-0', 'L1-1', 'W2-1',
      'L2-1', 'L2-0', 'W3-0',
      'L3-0',
      'L4-0',
      'GF',
    ])
  })

  it('schedules a match between two bye-advanced players with the opening games', () => {
    expect(playOrder(5)).toEqual([
      'W1-1', 'W2-1',
      'L1-0', 'W2-0',
      'L2-0', 'W3-0', 'L2-1',
      'L3-0',
      'L4-0',
      'GF',
    ])
  })

  it('does not make a player play two games in a row while another game is ready', () => {
    expect(playOrder(6)).toEqual([
      'W1-1', 'W1-3',
      'L1-0', 'W2-0', 'L1-1', 'W2-1',
      'L2-1', 'L2-0', 'W3-0',
      'L3-0',
      'L4-0',
      'GF',
    ])
  })

  it('keeps the losers game first when every ready game follows its own feeder', () => {
    expect(playOrder(4)).toEqual(['W1-0', 'W1-1', 'L1-0', 'W2-0', 'L2-0', 'GF'])
  })

  it('numbers the matches in the order they are played', () => {
    expect(buildDoubleElim(players(8)).map((row) => row.idx)).toEqual([...Array(14).keys()])
  })
})
