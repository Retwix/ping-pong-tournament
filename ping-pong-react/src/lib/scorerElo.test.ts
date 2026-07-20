import { describe, expect, it } from 'vitest'
import type { RatingRow } from './rating'
import { sideElos } from './scorerElo'

function makeRow(overrides: Partial<RatingRow> & Pick<RatingRow, 'key' | 'name' | 'rating'>): RatingRow {
	return {
		playerId: null,
		rd: 80,
		vol: 0.06,
		games: 12,
		peak: overrides.rating,
		lastPlayedAt: null,
		rank: 1,
		provisional: false,
		team: null,
		trend: 0,
		...overrides,
	}
}

function makeSides(overrides: Partial<Parameters<typeof sideElos>[1]> = {}): Parameters<typeof sideElos>[1] {
	return {
		player_a: 'Léo',
		player_a_id: 'p-leo',
		player_b: 'Thibault',
		player_b_id: 'p-thib',
		...overrides,
	}
}

describe('sideElos', () => {
	it('finds each side on the ladder by player id', () => {
		const rows = [
			makeRow({ key: 'p-leo', name: 'Léo', rating: 1487.2 }),
			makeRow({ key: 'p-thib', name: 'Thibault', rating: 1441.8 }),
		]
		expect(sideElos(rows, makeSides())).toEqual({ a: 1487, b: 1442 })
	})

	it('falls back to the name identity for legacy matches without player ids', () => {
		const rows = [makeRow({ key: 'name:Léo', name: 'Léo', rating: 1500 })]
		expect(sideElos(rows, makeSides({ player_a_id: null }))).toEqual({ a: 1500, b: null })
	})

	it('returns null for a player not on the ladder yet', () => {
		expect(sideElos([], makeSides())).toEqual({ a: null, b: null })
	})
})
