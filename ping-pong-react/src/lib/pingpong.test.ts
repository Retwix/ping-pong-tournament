import { describe, expect, it } from 'vitest'
import { decrementPatch, matchPointKind } from './pingpong'

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
