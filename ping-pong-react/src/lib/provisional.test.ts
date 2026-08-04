import { describe, expect, it } from 'vitest'
import { isProvisional, RATING } from './rating'

// A rating is "provisoire" until the player has settled in — which for this
// group means having played enough games, independent of the confidence band
// (RD). RD floors around ~100 for regular 3x/week players, so it must never by
// itself keep an established player flagged as provisional.

const state = (over: Partial<{ games: number; rd: number }> = {}) => ({
  games: 20,
  rd: 50,
  ...over,
})

describe('isProvisional', () => {
  it('flags a player who has not yet reached the games threshold', () => {
    expect(isProvisional(state({ games: RATING.provisionalGames - 1 }))).toBe(true)
  })

  it('clears a player exactly at the games threshold', () => {
    expect(isProvisional(state({ games: RATING.provisionalGames }))).toBe(false)
  })

  it('clears a player above the games threshold', () => {
    expect(isProvisional(state({ games: RATING.provisionalGames + 1 }))).toBe(false)
  })

  it('settles players at 10 games', () => {
    expect(RATING.provisionalGames).toBe(10)
  })

  it('does not flag an established player just because their RD is wide', () => {
    expect(isProvisional(state({ games: 107, rd: 350 }))).toBe(false)
  })

  it('still flags a new player even when their RD is already tight', () => {
    expect(isProvisional(state({ games: 3, rd: 20 }))).toBe(true)
  })
})
