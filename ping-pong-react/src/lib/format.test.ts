import { describe, expect, it } from 'vitest'
import { signed, relativeTime } from './format'

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

describe('relativeTime', () => {
  const now = new Date('2026-07-27T12:00:00Z')

  it('shows "à l\'instant" under a minute', () => {
    expect(relativeTime('2026-07-27T11:59:30Z', now)).toBe('à l\'instant')
  })

  it('shows minutes under an hour', () => {
    expect(relativeTime('2026-07-27T11:40:00Z', now)).toBe('il y a 20 min')
  })

  it('shows hours under a day', () => {
    expect(relativeTime('2026-07-27T09:00:00Z', now)).toBe('il y a 3 h')
  })

  it('shows days under a week', () => {
    expect(relativeTime('2026-07-24T12:00:00Z', now)).toBe('il y a 3 j')
  })

  it('falls back to a short date beyond a week', () => {
    expect(relativeTime('2026-07-01T12:00:00Z', now)).toBe('1 juil.')
  })

  it('returns an empty string for a null timestamp', () => {
    expect(relativeTime(null, now)).toBe('')
  })
})
