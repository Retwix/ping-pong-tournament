import { describe, expect, it } from 'vitest'
import type { SideRating } from '../hooks/useRatingDeltas'
import { winnerLoserRatings } from './ratingSides'

function side(overrides: Partial<SideRating> & Pick<SideRating, 'name' | 'won'>): SideRating {
	return {
		key: 'k',
		delta: 0,
		ratingBefore: 1500,
		ratingAfter: 1500,
		stakes: 'normal',
		rank: null,
		provisional: false,
		...overrides,
	}
}

describe('winnerLoserRatings', () => {
	it('has neither side until the rating replay has caught up', () => {
		expect(winnerLoserRatings({ a: null, b: null })).toEqual({ winner: null, loser: null })
	})

	it('reads the winner and loser when side a took the match', () => {
		const a = side({ name: 'Léo', won: true })
		const b = side({ name: 'Thibault', won: false })
		expect(winnerLoserRatings({ a, b })).toEqual({ winner: a, loser: b })
	})

	it('reads the winner and loser when side b took the match', () => {
		const a = side({ name: 'Léo', won: false })
		const b = side({ name: 'Thibault', won: true })
		expect(winnerLoserRatings({ a, b })).toEqual({ winner: b, loser: a })
	})

	it('keeps a side that is present without its counterpart', () => {
		const a = side({ name: 'Léo', won: true })
		expect(winnerLoserRatings({ a, b: null })).toEqual({ winner: a, loser: null })
	})

	it('keeps a lone losing side without a winner', () => {
		const b = side({ name: 'Thibault', won: false })
		expect(winnerLoserRatings({ a: null, b })).toEqual({ winner: null, loser: b })
	})

	it('does not mistake a lone winner in slot b for the loser', () => {
		const b = side({ name: 'Thibault', won: true })
		expect(winnerLoserRatings({ a: null, b })).toEqual({ winner: b, loser: null })
	})
})
