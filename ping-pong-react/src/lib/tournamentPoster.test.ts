import { describe, expect, it } from 'vitest'
import { buildChallengePosterSvg } from './tournamentPoster'

describe('buildChallengePosterSvg', () => {
  it('announces a single game by its points', () => {
    const { svg } = buildChallengePosterSvg({ playerA: 'Léo', playerB: 'Inès', target: 11 })
    expect(svg).toContain('Game to 11 points')
  })

  it('announces a best-of by its sets', () => {
    const { svg } = buildChallengePosterSvg({ playerA: 'Léo', playerB: 'Inès', target: 11, bestOf: 3 })
    expect(svg).toContain('Best of 3 · sets to 11')
  })
})
