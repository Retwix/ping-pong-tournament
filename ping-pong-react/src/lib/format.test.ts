import { describe, expect, it } from 'vitest'
import { signed } from './format'

describe('signed', () => {
  it('prefixes a positive value with a plus', () => {
    expect(signed(12)).toBe('+12')
  })

  it('prefixes a negative value with a real minus sign', () => {
    expect(signed(-12)).toBe('−12')
  })

  it('shows an unsigned zero as ±0', () => {
    expect(signed(0)).toBe('±0')
  })

  it('rounds to the nearest integer before formatting', () => {
    expect(signed(11.6)).toBe('+12')
    expect(signed(-4.4)).toBe('−4')
  })

  it('treats a value that rounds to zero as ±0, with no stray minus', () => {
    expect(signed(-0.3)).toBe('±0')
  })
})
