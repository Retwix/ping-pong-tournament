import { describe, expect, it } from 'vitest'
import { rankRatings, type RatingState, type ReplayResult } from './rating'
import { computePlayerStats } from './stats'
import type { Match, Player } from '../types'

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name'>): Player {
	return {
		created_at: '2026-01-01T00:00:00Z',
		team: 'tech',
		slack_user_id: null,
		avatar_url: null,
		status: 'active',
		left_at: null,
		...overrides,
	}
}

function makeState(overrides: Partial<RatingState> & Pick<RatingState, 'key' | 'name'>): RatingState {
	return {
		playerId: null,
		rating: 1500,
		rd: 80,
		vol: 0.06,
		games: 5,
		peak: 1500,
		lastPlayedAt: null,
		...overrides,
	}
}

function makeResult(states: RatingState[]): ReplayResult {
	return { states: new Map(states.map((s) => [s.key, s])), events: [] }
}

describe('rankRatings registry identity', () => {
	it('matches by player id even when the recorded name differs from the registry', () => {
		const players = [
			makePlayer({
				id: 'p1',
				name: 'Léo Martin',
				team: 'com',
				avatar_url: 'https://cdn/avatars/p1.webp?v=1',
			}),
		]
		const result = makeResult([makeState({ key: 'p1', name: 'Léo', playerId: 'p1' })])
		const row = rankRatings(result, players)[0]
		expect(row.avatar_url).toBe('https://cdn/avatars/p1.webp?v=1')
		expect(row.team).toBe('com')
	})

	it('falls back to a name match for legacy rows without player ids', () => {
		const players = [
			makePlayer({
				id: 'p1',
				name: 'Léo',
				team: 'com',
				avatar_url: 'https://cdn/avatars/p1.webp?v=1',
			}),
		]
		const result = makeResult([makeState({ key: 'name:Léo', name: 'Léo' })])
		const row = rankRatings(result, players)[0]
		expect(row.avatar_url).toBe('https://cdn/avatars/p1.webp?v=1')
		expect(row.team).toBe('com')
	})

	it('leaves the photo null for players missing from the registry', () => {
		const result = makeResult([makeState({ key: 'name:Inconnu', name: 'Inconnu' })])
		expect(rankRatings(result, [])[0].avatar_url).toBeNull()
	})

	it('keeps players with no rated games off the board', () => {
		const result = makeResult([makeState({ key: 'p1', name: 'Léo', games: 0 })])
		expect(rankRatings(result, [])).toEqual([])
	})
})

function makeMatch(overrides: Partial<Match> = {}): Match {
	return {
		id: 'm1',
		tournament_id: 't1',
		round: 1,
		idx: 0,
		player_a: 'Léo',
		player_b: 'Ana',
		player_a_id: 'p1',
		player_b_id: 'p2',
		score_a: 11,
		score_b: 5,
		done: true,
		serve_start: 'a',
		started_at: null,
		first_point_at: null,
		ended_at: null,
		bracket: null,
		match_key: null,
		win_to: null,
		win_slot: null,
		lose_to: null,
		lose_slot: null,
		bye: false,
		mb_saved_a: 0,
		mb_saved_b: 0,
		...overrides,
	}
}

describe('computePlayerStats registry identity', () => {
	it('matches by player id even when the match recorded an old name', () => {
		const players = [
			makePlayer({
				id: 'p1',
				name: 'Léo Martin',
				team: 'com',
				avatar_url: 'https://cdn/avatars/p1.webp?v=1',
			}),
			makePlayer({ id: 'p2', name: 'Ana' }),
		]
		const stats = computePlayerStats([makeMatch({ player_a: 'Léo' })], players)
		const leo = stats.find((s) => s.key === 'p1')
		const ana = stats.find((s) => s.key === 'p2')
		expect(leo?.name).toBe('Léo Martin')
		expect(leo?.team).toBe('com')
		expect(leo?.avatar_url).toBe('https://cdn/avatars/p1.webp?v=1')
		expect(ana?.avatar_url).toBeNull()
	})

	it('falls back to a name match for legacy matches without player ids', () => {
		const players = [
			makePlayer({
				id: 'p1',
				name: 'Léo',
				team: 'com',
				avatar_url: 'https://cdn/avatars/p1.webp?v=1',
			}),
		]
		const stats = computePlayerStats(
			[makeMatch({ player_a_id: null, player_b_id: null })],
			players,
		)
		const leo = stats.find((s) => s.name === 'Léo')
		expect(leo?.team).toBe('com')
		expect(leo?.avatar_url).toBe('https://cdn/avatars/p1.webp?v=1')
	})

	it('accumulates a player\'s matches on a single stat row', () => {
		const stats = computePlayerStats(
			[makeMatch(), makeMatch({ id: 'm2', score_a: 7, score_b: 11 })],
			[],
		)
		const leo = stats.find((s) => s.name === 'Léo')
		expect(leo?.played).toBe(2)
		expect(leo?.wins).toBe(1)
	})
})
