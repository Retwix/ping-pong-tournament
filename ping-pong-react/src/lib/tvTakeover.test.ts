import { expect, test } from 'vitest'
import { tvMode, type TvMoment } from './tvTakeover'

const CREATED_AT = '2026-11-04T10:00:00.000Z'
const minutesLater = (minutes: number, seconds = 0) =>
  Date.parse(CREATED_AT) + (minutes * 60 + seconds) * 1000

const moment = (overrides: Partial<TvMoment> = {}): TvMoment => ({
  game: { created_at: CREATED_AT, status: 'active' },
  matches: [],
  scoresChangedAt: null,
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

const at = (minutes: number) => new Date(minutesLater(minutes)).toISOString()

test.for([
  { what: 'a match starting', matches: [{ started_at: at(8), ended_at: null }], scoresChangedAt: null },
  { what: 'a match ending', matches: [{ started_at: null, ended_at: at(8) }], scoresChangedAt: null },
  { what: 'the later of two matches', matches: [{ started_at: at(8), ended_at: null }, { started_at: at(1), ended_at: at(2) }], scoresChangedAt: null },
  { what: 'a score changing', matches: [], scoresChangedAt: minutesLater(8) },
])('$what restarts the 10 idle minutes', ({ matches, scoresChangedAt }) => {
  expect(tvMode(moment({ matches, scoresChangedAt, now: minutesLater(17) }))).toBe('live')
  expect(tvMode(moment({ matches, scoresChangedAt, now: minutesLater(18) }))).toBe('screensaver')
})

test.for([
  { at: 'just before 2 minutes', now: minutesLater(5, 119), mode: 'live' },
  { at: 'on 2 minutes', now: minutesLater(7), mode: 'screensaver' },
])('the final result holds the screen for 2 minutes: $at', ({ now, mode }) => {
  const game = { created_at: CREATED_AT, status: 'done' as const }
  const matches = [{ started_at: at(1), ended_at: at(5) }]
  expect(tvMode(moment({ game, matches, now }))).toBe(mode)
})
