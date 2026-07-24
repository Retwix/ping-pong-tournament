import { describe, expect, it } from 'vitest'
import type { Player } from '../types'
import { playerLookup } from './playerLookup'

function player(over: Partial<Player> & Pick<Player, 'name'>): Player {
	return {
		id: 'p1',
		created_at: '2026-01-01T00:00:00Z',
		team: 'tech',
		slack_user_id: null,
		avatar_url: null,
		...over,
	}
}

describe('playerLookup', () => {
	it('finds a player by their exact name', () => {
		const look = playerLookup([player({ name: 'Léo', team: 'sales', avatar_url: 'photo.webp' })])

		expect(look('Léo')).toEqual({ team: 'sales', url: 'photo.webp' })
	})

	it('still finds a player when the case differs', () => {
		const look = playerLookup([player({ name: 'Léo', team: 'sales' })])

		expect(look('LÉO')).toMatchObject({ team: 'sales' })
	})

	it('still finds a player when the name is padded with spaces', () => {
		const look = playerLookup([player({ name: 'Léo', team: 'sales' })])

		expect(look('  Léo  ')).toMatchObject({ team: 'sales' })
	})

	it('prefers the exact match over one that only matches loosely', () => {
		const look = playerLookup([
			player({ id: 'p1', name: 'Leo', team: 'sales' }),
			player({ id: 'p2', name: 'leo', team: 'tech' }),
		])

		// 'leo' is the later loose match for this key, so only the exact lookup
		// can still pick the properly-cased entry.
		expect(look('Leo')).toMatchObject({ team: 'sales' })
	})

	it('finds a player whose registered name carries stray spaces', () => {
		const look = playerLookup([player({ name: '  Léo  ', team: 'sales' })])

		expect(look('Léo')).toMatchObject({ team: 'sales' })
	})

	it('falls back to no team and no photo for someone off the registry', () => {
		const look = playerLookup([player({ name: 'Léo' })])

		expect(look('Inconnu')).toEqual({ team: null, url: null })
	})

	it('reports a registered player who has not uploaded a photo', () => {
		const look = playerLookup([player({ name: 'Léo', team: 'tech', avatar_url: null })])

		expect(look('Léo')).toEqual({ team: 'tech', url: null })
	})
})
