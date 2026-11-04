import { expect, test } from 'vitest'
import { tvMode, type TvMoment } from './tvTakeover'

const CREATED_AT = '2026-11-04T10:00:00.000Z'
const minutesLater = (minutes: number, seconds = 0) =>
  Date.parse(CREATED_AT) + (minutes * 60 + seconds) * 1000

const moment = (overrides: Partial<TvMoment> = {}): TvMoment => ({
  game: { created_at: CREATED_AT, status: 'active' },
  now: minutesLater(1),
  ...overrides,
})

test('the screensaver runs when no game is active', () => {
  expect(tvMode(moment({ game: null }))).toBe('screensaver')
})

test.for([
  { at: 'just before 10 idle minutes', now: minutesLater(9, 59), mode: 'live' },
  { at: 'on 10 idle minutes', now: minutesLater(10), mode: 'screensaver' },
])('a new game holds the screen until 10 idle minutes: $at', ({ now, mode }) => {
  expect(tvMode(moment({ now }))).toBe(mode)
})
