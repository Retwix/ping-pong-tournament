import { describe, expect, it } from 'vitest'
import {
	chronoStart,
	decrementPatch,
	firstPointPatch,
	matchDuration,
	matchPointKind,
	startPatch,
} from './pingpong'

describe('decrementPatch', () => {
	it('removes one point from side a', () => {
		expect(decrementPatch({ score_a: 5, score_b: 3, done: false }, 'a')).toEqual({ score_a: 4 })
	})

	it('removes one point from side b', () => {
		expect(decrementPatch({ score_a: 5, score_b: 3, done: false }, 'b')).toEqual({ score_b: 2 })
	})

	it('decrements from 1 down to exactly 0', () => {
		expect(decrementPatch({ score_a: 1, score_b: 3, done: false }, 'a')).toEqual({ score_a: 0 })
	})

	it('does nothing when the side is already at zero', () => {
		expect(decrementPatch({ score_a: 0, score_b: 3, done: false }, 'a')).toBeNull()
	})

	it('does nothing once the match is validated', () => {
		expect(decrementPatch({ score_a: 11, score_b: 3, done: true }, 'a')).toBeNull()
	})

	it('still works when the score reaches a winning total but is not validated', () => {
		// The whole point of the button: fix an accidental extra tap on match ball.
		expect(decrementPatch({ score_a: 11, score_b: 3, done: false }, 'a')).toEqual({ score_a: 10 })
	})
})

describe('matchPointKind', () => {
	it('is a match point when one more point wins the game', () => {
		expect(matchPointKind(10, 7, 11)).toBe('match')
	})

	it('is a capot when the opponent is still at zero', () => {
		expect(matchPointKind(10, 0, 11)).toBe('capot')
	})

	it('is nothing when two or more points are still needed', () => {
		expect(matchPointKind(9, 7, 11)).toBeNull()
	})

	it('is nothing at deuce (win requires a 2-point lead)', () => {
		expect(matchPointKind(10, 10, 11)).toBeNull()
	})

	it('is a match point at advantage after deuce', () => {
		expect(matchPointKind(11, 10, 11)).toBe('match')
	})

	it('only flags the side that is about to win, not the one about to lose', () => {
		expect(matchPointKind(7, 10, 11)).toBeNull()
	})

	it('is nothing once the game is already won', () => {
		expect(matchPointKind(11, 3, 11)).toBeNull()
	})

	it('follows a custom points target', () => {
		expect(matchPointKind(20, 5, 21)).toBe('match')
		expect(matchPointKind(20, 0, 21)).toBe('capot')
		expect(matchPointKind(19, 5, 21)).toBeNull()
	})
})

describe('chronoStart', () => {
	it('is the first point, not the moment the match was put on the table', () => {
		expect(
			chronoStart({
				started_at: '2026-08-24T10:00:00.000Z',
				first_point_at: '2026-08-24T10:04:00.000Z',
				score_a: 1,
				score_b: 0,
			}),
		).toBe('2026-08-24T10:04:00.000Z')
	})

	it('falls back to started_at on rows written before first_point_at existed', () => {
		// Those rows stamped started_at on the first point, so it *is* the chrono.
		expect(
			chronoStart({
				started_at: '2026-08-24T10:00:00.000Z',
				first_point_at: null,
				score_a: 6,
				score_b: 4,
			}),
		).toBe('2026-08-24T10:00:00.000Z')
	})

	it('has not started for a match waiting on the table at 0–0', () => {
		expect(
			chronoStart({
				started_at: '2026-08-24T10:00:00.000Z',
				first_point_at: null,
				score_a: 0,
				score_b: 0,
			}),
		).toBeNull()
	})

	it('has not started for an untouched match', () => {
		expect(
			chronoStart({ started_at: null, first_point_at: null, score_a: 0, score_b: 0 }),
		).toBeNull()
	})
})

describe('matchDuration', () => {
	it('measures from the first point to the end, not from the start of the wait', () => {
		expect(
			matchDuration({
				started_at: '2026-08-24T10:00:00.000Z',
				first_point_at: '2026-08-24T10:05:00.000Z',
				ended_at: '2026-08-24T10:20:00.000Z',
				score_a: 11,
				score_b: 7,
			}),
		).toBe(15 * 60_000)
	})

	it('runs against the clock while the match is still being played', () => {
		expect(
			matchDuration(
				{
					started_at: '2026-08-24T10:00:00.000Z',
					first_point_at: '2026-08-24T10:05:00.000Z',
					ended_at: null,
					score_a: 3,
					score_b: 2,
				},
				Date.UTC(2026, 7, 24, 10, 7),
			),
		).toBe(2 * 60_000)
	})

	it('stays at zero while the match sits on the table with no point scored', () => {
		expect(
			matchDuration(
				{
					started_at: '2026-08-24T10:00:00.000Z',
					first_point_at: null,
					ended_at: null,
					score_a: 0,
					score_b: 0,
				},
				Date.UTC(2026, 7, 24, 10, 9),
			),
		).toBe(0)
	})
})

describe('startPatch', () => {
	it('puts a fresh match on the table', () => {
		expect(startPatch({ done: false, started_at: null }, '2026-08-24T10:00:00.000Z')).toEqual({
			started_at: '2026-08-24T10:00:00.000Z',
		})
	})

	it('leaves an already-started match alone, so the start time never moves', () => {
		expect(
			startPatch({ done: false, started_at: '2026-08-24T09:00:00.000Z' }, '2026-08-24T10:00:00.000Z'),
		).toBeNull()
	})

	it('never starts a finished match', () => {
		expect(startPatch({ done: true, started_at: null }, '2026-08-24T10:00:00.000Z')).toBeNull()
	})
})

describe('firstPointPatch', () => {
	it('starts the chrono and the match at once when nobody put it on the table', () => {
		expect(
			firstPointPatch(
				{ started_at: null, first_point_at: null, score_a: 0, score_b: 0 },
				'2026-08-24T10:00:00.000Z',
			),
		).toEqual({
			started_at: '2026-08-24T10:00:00.000Z',
			first_point_at: '2026-08-24T10:00:00.000Z',
		})
	})

	it('only starts the chrono when the referee already started the match', () => {
		expect(
			firstPointPatch(
				{
					started_at: '2026-08-24T09:50:00.000Z',
					first_point_at: null,
					score_a: 0,
					score_b: 0,
				},
				'2026-08-24T10:00:00.000Z',
			),
		).toEqual({ first_point_at: '2026-08-24T10:00:00.000Z' })
	})

	it('never moves the chrono once the match is under way', () => {
		expect(
			firstPointPatch(
				{
					started_at: '2026-08-24T09:50:00.000Z',
					first_point_at: '2026-08-24T10:00:00.000Z',
					score_a: 4,
					score_b: 2,
				},
				'2026-08-24T10:06:00.000Z',
			),
		).toEqual({})
	})
})
