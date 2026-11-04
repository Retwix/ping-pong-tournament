import { expect, test } from 'vitest'
import { tvMode, watchScores, type TvMoment } from './tvTakeover'

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

const NOT_WATCHING = { scores: null, changedAt: null }

const row = (overrides = {}) => ({ id: 'm1', score_a: 3, score_b: 2, done: false, ...overrides })

test('the scores found on loading are not a change', () => {
  expect(watchScores(NOT_WATCHING, [row()], 1000).changedAt).toBeNull()
})

test('rows that have not loaded yet leave the watch waiting for the first scores', () => {
  const waiting = watchScores(NOT_WATCHING, [], 1000)
  expect(watchScores(waiting, [row()], 2000).changedAt).toBeNull()
})

test('a poll bringing back the same scores is not a change', () => {
  const watch = watchScores(NOT_WATCHING, [row()], 1000)
  expect(watchScores(watch, [row()], 2000).changedAt).toBeNull()
})

test.for([
  { what: 'a point for side a', change: { score_a: 4 } },
  { what: 'a point for side b', change: { score_b: 3 } },
  { what: 'a validated match', change: { done: true } },
  { what: 'another match', change: { id: 'm2' } },
])('$what is a change', ({ change }) => {
  const watch = watchScores(NOT_WATCHING, [row()], 1000)
  expect(watchScores(watch, [row(change)], 2000).changedAt).toBe(2000)
})

test('a change is remembered through the polls that follow', () => {
  const seen = watchScores(NOT_WATCHING, [row()], 1000)
  const changed = watchScores(seen, [row({ score_a: 4 })], 2000)
  expect(watchScores(changed, [row({ score_a: 4 })], 3000).changedAt).toBe(2000)
})
