import { describe, expect, it } from 'vitest'
import { decrementPatch } from './pingpong'

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
