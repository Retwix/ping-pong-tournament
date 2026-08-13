import { describe, expect, it } from 'vitest'
import type { Match } from '../types'
import {
	finalStandings,
	podiumOrder,
	type FinalStandingRow,
	type PlayerRating,
} from './finalStandings'

/** A finished round-robin match; override only what the case is about. */
function match(over: Partial<Match>): Match {
	return {
		id: 'm1',
		tournament_id: 't1',
		round: 1,
		idx: 0,
		player_a: 'A',
		player_b: 'B',
		player_a_id: null,
		player_b_id: null,
		score_a: 11,
		score_b: 0,
		done: true,
		serve_start: 'a',
		started_at: null,
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
		...over,
	}
}

function rating(over: Partial<PlayerRating> & { name: string }): PlayerRating {
	return { endRating: 1500, netDelta: 0, provisional: false, ...over }
}

/** Two independent wins by the same margin: identical records, tied on wins and diff. */
function tiedPairMatches(): Match[] {
	return [
		match({ id: 'm1', player_a: 'Léo', player_b: 'Marc', score_a: 11, score_b: 9 }),
		match({ id: 'm2', player_a: 'Sophie', player_b: 'Tom', score_a: 11, score_b: 9 }),
	]
}

describe('finalStandings — round robin', () => {
	it('ranks by wins, most first', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo', 'Marc', 'Tom'],
			matches: [
				match({ id: 'm1', player_a: 'Léo', player_b: 'Marc', score_a: 11, score_b: 5 }),
				match({ id: 'm2', player_a: 'Léo', player_b: 'Tom', score_a: 11, score_b: 5 }),
				match({ id: 'm3', player_a: 'Marc', player_b: 'Tom', score_a: 11, score_b: 5 }),
			],
		})

		expect(rows.map((r) => r.name)).toEqual(['Léo', 'Marc', 'Tom'])
		expect(rows.map((r) => r.place)).toEqual([1, 2, 3])
	})

	it('ranks more wins above a better point difference', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Marc', 'Léo', 'Tom', 'Nina'],
			matches: [
				match({ id: 'm1', player_a: 'Léo', player_b: 'Tom', score_a: 11, score_b: 9 }),
				match({ id: 'm2', player_a: 'Léo', player_b: 'Nina', score_a: 11, score_b: 9 }),
				match({ id: 'm3', player_a: 'Marc', player_b: 'Tom', score_a: 11, score_b: 1 }),
			],
		})

		// Léo 2 wins (+4) outranks Marc's single win (+10): wins come first.
		expect(rows.map((r) => r.name)).toEqual(['Léo', 'Marc', 'Nina', 'Tom'])
	})

	it('orders by point difference whichever way round the roster lists them', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Sophie', 'Léo', 'Marc', 'Tom'],
			matches: [
				match({ id: 'm1', player_a: 'Léo', player_b: 'Marc', score_a: 11, score_b: 2 }),
				match({ id: 'm2', player_a: 'Sophie', player_b: 'Tom', score_a: 11, score_b: 9 }),
			],
		})

		expect(rows.map((r) => r.name)).toEqual(['Léo', 'Sophie', 'Tom', 'Marc'])
	})

	it('breaks a tie on wins by point difference', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo', 'Marc', 'Sophie', 'Tom'],
			matches: [
				match({ id: 'm1', player_a: 'Léo', player_b: 'Marc', score_a: 11, score_b: 2 }),
				match({ id: 'm2', player_a: 'Sophie', player_b: 'Tom', score_a: 11, score_b: 9 }),
			],
		})

		expect(rows.map((r) => r.name)).toEqual(['Léo', 'Sophie', 'Tom', 'Marc'])
	})

	it('breaks a tie on wins and difference by net Elo, never sharing a place', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo', 'Marc', 'Sophie', 'Tom'],
			matches: tiedPairMatches(),
			ratings: [
				rating({ name: 'Léo', netDelta: 10 }),
				rating({ name: 'Sophie', netDelta: 25 }),
				rating({ name: 'Marc', netDelta: -5 }),
				rating({ name: 'Tom', netDelta: -20 }),
			],
		})

		expect(rows.map((r) => r.name)).toEqual(['Sophie', 'Léo', 'Marc', 'Tom'])
		expect(rows.map((r) => r.place)).toEqual([1, 2, 3, 4])
	})

	it('ranks point difference ahead of net Elo', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo', 'Marc', 'Sophie', 'Tom'],
			matches: [
				match({ id: 'm1', player_a: 'Léo', player_b: 'Marc', score_a: 11, score_b: 2 }),
				match({ id: 'm2', player_a: 'Sophie', player_b: 'Tom', score_a: 11, score_b: 9 }),
			],
			ratings: [rating({ name: 'Léo', netDelta: -10 }), rating({ name: 'Sophie', netDelta: 20 })],
		})

		// Léo's +9 outranks Sophie's +2 even though she gained far more Elo.
		expect(rows.map((r) => r.name)).toEqual(['Léo', 'Sophie', 'Tom', 'Marc'])
	})

	it('marks players tied on wins and difference as ex aequo', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo', 'Marc', 'Sophie', 'Tom'],
			matches: tiedPairMatches(),
		})

		expect(rows.every((r) => r.exAequo)).toBe(true)
	})

	it('does not mark players ex aequo when their win counts differ', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo', 'Sophie', 'Marc', 'Tom'],
			matches: [
				match({ id: 'm1', player_a: 'Léo', player_b: 'Marc', score_a: 11, score_b: 6 }),
				match({ id: 'm2', player_a: 'Léo', player_b: 'Tom', score_a: 11, score_b: 6 }),
				match({ id: 'm3', player_a: 'Sophie', player_b: 'Marc', score_a: 11, score_b: 1 }),
			],
		})

		// Léo 2–0 (+10) and Sophie 1–0 (+10): same losses and difference, different wins.
		expect(rows.some((r) => r.exAequo)).toBe(false)
	})

	it('does not mark players ex aequo when they played a different number of matches', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo', 'Sophie', 'Marc', 'Tom'],
			matches: [
				match({ id: 'm1', player_a: 'Léo', player_b: 'Marc', score_a: 11, score_b: 6 }),
				match({ id: 'm2', player_a: 'Sophie', player_b: 'Tom', score_a: 11, score_b: 1 }),
				match({ id: 'm3', player_a: 'Marc', player_b: 'Sophie', score_a: 11, score_b: 6 }),
			],
		})

		// Léo 1–0 (+5) and Sophie 1–1 (+5): same wins and difference, different losses.
		expect(rows.some((r) => r.exAequo)).toBe(false)
	})

	it('does not mark anyone ex aequo when point difference separates them', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo', 'Marc', 'Sophie', 'Tom'],
			matches: [
				match({ id: 'm1', player_a: 'Léo', player_b: 'Marc', score_a: 11, score_b: 2 }),
				match({ id: 'm2', player_a: 'Sophie', player_b: 'Tom', score_a: 11, score_b: 9 }),
			],
		})

		expect(rows.some((r) => r.exAequo)).toBe(false)
	})

	it('reports wins, losses and point difference per player', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo', 'Marc'],
			matches: [
				match({ id: 'm1', player_a: 'Léo', player_b: 'Marc', score_a: 11, score_b: 4 }),
				match({ id: 'm2', player_a: 'Marc', player_b: 'Léo', score_a: 11, score_b: 9 }),
			],
		})

		expect(rows.find((r) => r.name === 'Léo')).toMatchObject({ wins: 1, losses: 1, diff: 5 })
		expect(rows.find((r) => r.name === 'Marc')).toMatchObject({ wins: 1, losses: 1, diff: -5 })
	})

	it('ignores walkovers so a bye does not count as a played match', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo', 'Marc'],
			matches: [
				match({ id: 'm1', player_a: 'Léo', player_b: 'Marc', score_a: 11, score_b: 4 }),
				match({ id: 'm2', player_a: 'Léo', player_b: 'BYE', bye: true, score_a: 11, score_b: 0 }),
			],
		})

		expect(rows.find((r) => r.name === 'Léo')).toMatchObject({ wins: 1, losses: 0 })
	})

	it('carries final Elo, net delta and the provisional flag from the ratings', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo'],
			matches: [],
			ratings: [rating({ name: 'Léo', endRating: 1487, netDelta: 42, provisional: true })],
		})

		expect(rows[0]).toMatchObject({ elo: 1487, eloDelta: 42, provisional: true })
	})

	it('leaves Elo empty for a player the ratings do not cover', () => {
		const rows = finalStandings({
			format: 'round_robin',
			players: ['Léo'],
			matches: [],
		})

		expect(rows[0]).toMatchObject({ elo: null, eloDelta: null, provisional: false })
	})
})

/**
 * A double-elimination run: the grand final decides 1st and 2nd, the last
 * losers-bracket round decides 3rd, and everyone below exits in a losers round.
 */
function bracketMatches(): Match[] {
	return [
		match({ id: 'w1', bracket: 'W', round: 1, player_a: 'Léo', player_b: 'Tom' }),
		match({ id: 'w2', bracket: 'W', round: 1, player_a: 'Marc', player_b: 'Nina' }),
		match({ id: 'w3', bracket: 'W', round: 2, player_a: 'Léo', player_b: 'Marc' }),
		match({ id: 'l1', bracket: 'L', round: 1, player_a: 'Nina', player_b: 'Tom' }),
		match({ id: 'l2', bracket: 'L', round: 2, player_a: 'Sophie', player_b: 'Nina' }),
		match({ id: 'l3', bracket: 'L', round: 3, player_a: 'Marc', player_b: 'Sophie' }),
		match({ id: 'gf', bracket: 'GF', round: 1, player_a: 'Léo', player_b: 'Marc' }),
	]
}

describe('finalStandings — double elimination', () => {
	it('takes the top three places from the bracket, not from the win count', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Sophie', 'Nina', 'Tom'],
			matches: bracketMatches(),
		})

		expect(rows.slice(0, 3).map((r) => r.name)).toEqual(['Léo', 'Marc', 'Sophie'])
	})

	it('orders the players below the podium by how late they were eliminated', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Sophie', 'Nina', 'Tom'],
			matches: bracketMatches(),
		})

		expect(rows.slice(3).map((r) => r.name)).toEqual(['Nina', 'Tom'])
	})

	it('orders by elimination round whichever way round the roster lists them', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Sophie', 'Tom', 'Nina'],
			matches: bracketMatches(),
		})

		// Nina went out in losers round 2, Tom in round 1, so Nina places higher
		// even though the roster lists Tom first.
		expect(rows.slice(3).map((r) => r.name)).toEqual(['Nina', 'Tom'])
	})

	it('breaks an equal elimination round by wins, then difference, then net Elo', () => {
		const sameRoundExit = [
			match({ id: 'gf', bracket: 'GF', round: 1, player_a: 'Léo', player_b: 'Marc' }),
			match({ id: 'l2', bracket: 'L', round: 2, player_a: 'Marc', player_b: 'Sophie' }),
			match({ id: 'l1a', bracket: 'L', round: 1, player_a: 'Sophie', player_b: 'Nina' }),
			match({ id: 'l1b', bracket: 'L', round: 1, player_a: 'Léo', player_b: 'Tom' }),
			match({
				id: 'w1',
				bracket: 'W',
				round: 1,
				player_a: 'Nina',
				player_b: 'Zoé',
				score_a: 11,
				score_b: 4,
			}),
		]

		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Sophie', 'Tom', 'Nina', 'Zoé'],
			matches: sameRoundExit,
		})

		// Nina and Tom both exit in losers round 1; Nina's win puts her ahead,
		// against the roster order.
		expect(rows.slice(3).map((r) => r.name)).toEqual(['Nina', 'Tom', 'Zoé'])
	})

	it('ignores an unfinished losers match when working out who lasted longest', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Sophie', 'Nina', 'Tom'],
			matches: [
				...bracketMatches(),
				match({
					id: 'pending',
					bracket: 'L',
					round: 9,
					player_a: 'Tom',
					player_b: 'Nina',
					score_a: 0,
					score_b: 0,
					done: false,
				}),
			],
		})

		expect(rows.slice(3).map((r) => r.name)).toEqual(['Nina', 'Tom'])
	})

	it('ignores a walkover when working out who lasted longest', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Sophie', 'Nina', 'Tom'],
			matches: [
				...bracketMatches(),
				match({
					id: 'walkover',
					bracket: 'L',
					round: 9,
					player_a: 'Nina',
					player_b: 'Tom',
					bye: true,
				}),
			],
		})

		expect(rows.slice(3).map((r) => r.name)).toEqual(['Nina', 'Tom'])
	})

	it('reads the eliminated player correctly when the second slot wins', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Zoé', 'Tom', 'Nina', 'Rex'],
			matches: [
				match({ id: 'gf', bracket: 'GF', round: 1, player_a: 'Léo', player_b: 'Marc' }),
				match({ id: 'l3', bracket: 'L', round: 3, player_a: 'Sophie', player_b: 'Zoé' }),
				// Tom sits in the first slot and loses, so the winner is the second player.
				match({
					id: 'l2',
					bracket: 'L',
					round: 2,
					player_a: 'Tom',
					player_b: 'Nina',
					score_a: 2,
					score_b: 11,
				}),
				match({ id: 'l1', bracket: 'L', round: 1, player_a: 'Rex', player_b: 'Nina' }),
			],
		})

		expect(rows.slice(3).map((r) => r.name)).toEqual(['Tom', 'Nina', 'Rex'])
	})

	it('keeps the roster authoritative when the bracket names someone who left', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Sophie'],
			matches: [match({ id: 'gf', bracket: 'GF', round: 1, player_a: 'Léo', player_b: 'Parti' })],
		})

		expect(rows.map((r) => r.name)).toEqual(['Léo', 'Sophie'])
	})

	it('lists each player once rather than repeating the podium', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Sophie', 'Nina', 'Tom'],
			matches: bracketMatches(),
		})

		expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length)
	})

	it('falls back to net Elo when two players go out in the same round with equal records', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Sophie', 'Tom', 'Nina'],
			matches: [
				match({ id: 'gf', bracket: 'GF', round: 1, player_a: 'Léo', player_b: 'Marc' }),
				match({ id: 'l2', bracket: 'L', round: 2, player_a: 'Marc', player_b: 'Sophie' }),
				match({ id: 'l1a', bracket: 'L', round: 1, player_a: 'Sophie', player_b: 'Tom' }),
				match({ id: 'l1b', bracket: 'L', round: 1, player_a: 'Sophie', player_b: 'Nina' }),
			],
			ratings: [rating({ name: 'Nina', netDelta: 5 }), rating({ name: 'Tom', netDelta: -5 })],
		})

		// Tom and Nina both went out in losers round 1 with identical records, so
		// only net Elo separates them — against the roster order.
		expect(rows.slice(3).map((r) => r.name)).toEqual(['Nina', 'Tom'])
	})

	it('puts the podium ahead of everyone else whatever order the roster is in', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Tom', 'Nina', 'Sophie', 'Marc', 'Léo'],
			matches: bracketMatches(),
		})

		expect(rows.map((r) => r.name)).toEqual(['Léo', 'Marc', 'Sophie', 'Nina', 'Tom'])
	})

	it('numbers every place distinctly from first to last', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Sophie', 'Nina', 'Tom'],
			matches: bracketMatches(),
		})

		expect(rows.map((r) => r.place)).toEqual([1, 2, 3, 4, 5])
	})

	it('still lists every player when the bracket has no finished grand final', () => {
		const rows = finalStandings({
			format: 'double_elim',
			players: ['Léo', 'Marc', 'Sophie'],
			matches: [match({ id: 'w1', bracket: 'W', round: 1, player_a: 'Léo', player_b: 'Marc' })],
		})

		expect([...rows.map((r) => r.name)].sort()).toEqual(['Léo', 'Marc', 'Sophie'])
		expect(rows.map((r) => r.place)).toEqual([1, 2, 3])
	})
})

/** A classement row; only the fields the podium reads matter here. */
function standingRow(place: number, name: string): FinalStandingRow {
	return {
		place,
		name,
		wins: 0,
		losses: 0,
		diff: 0,
		elo: null,
		eloDelta: null,
		provisional: false,
		exAequo: false,
	}
}

function classement(...names: string[]): FinalStandingRow[] {
	return names.map((name, i) => standingRow(i + 1, name))
}

describe('podiumOrder', () => {
	it('puts the champion in the middle, silver left and bronze right', () => {
		const steps = podiumOrder(classement('Léo', 'Marc', 'Sophie'))

		expect(steps.map((r) => r.name)).toEqual(['Marc', 'Léo', 'Sophie'])
	})

	it('leaves everyone below third off the podium', () => {
		const steps = podiumOrder(classement('Léo', 'Marc', 'Sophie', 'Nina', 'Tom'))

		expect(steps.map((r) => r.place)).toEqual([2, 1, 3])
	})

	it('shows only the steps there are players for, rather than empty slots', () => {
		expect(podiumOrder(classement('Léo', 'Marc')).map((r) => r.name)).toEqual(['Marc', 'Léo'])
		expect(podiumOrder(classement('Léo')).map((r) => r.name)).toEqual(['Léo'])
		expect(podiumOrder([])).toEqual([])
	})
})
