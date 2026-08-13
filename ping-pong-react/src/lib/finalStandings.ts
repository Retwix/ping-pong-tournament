import type { Match, TournamentFormat } from '../types'
import { bracketPodium } from './doubleElim'
import { computeStandings } from './pingpong'

/**
 * The slice of a player's tournament rating the final table needs. Structurally
 * satisfied by TournamentRating, so callers pass theirs straight through and this
 * module stays independent of the ratings hook.
 */
export interface PlayerRating {
	name: string
	endRating: number
	netDelta: number
	provisional: boolean
}

export interface FinalStandingRow {
	place: number
	name: string
	wins: number
	losses: number
	diff: number
	elo: number | null
	eloDelta: number | null
	provisional: boolean
	/** Shares an identical record with the row above or below (tie broken by Elo). */
	exAequo: boolean
}

interface Options {
	players: string[]
	matches: Match[]
	format: TournamentFormat
	ratings?: PlayerRating[]
}

interface PlayerRecord {
	name: string
	wins: number
	losses: number
	diff: number
}

type Compare = (a: PlayerRecord, b: PlayerRecord) => number

/**
 * The losers-bracket round a player was knocked out in. Everyone but the champion
 * leaves through the losers bracket, so a later round means a longer run. Players
 * with no losers-bracket loss (an unfinished bracket) sort last.
 */
function eliminationRound(name: string, matches: Match[]): number {
	let latest = -1
	for (const m of matches) {
		if (!m.done || m.bye || m.bracket !== 'L') continue
		const loser = m.score_a > m.score_b ? m.player_b : m.player_a
		if (loser === name) latest = Math.max(latest, m.round)
	}
	return latest
}

function sameRecord(a: PlayerRecord, b: PlayerRecord): boolean {
	return a.wins === b.wins && a.losses === b.losses && a.diff === b.diff
}

/**
 * Bracket order: the podium exactly as the bracket decided it, then everyone else
 * by how late they were eliminated, falling back to the record tiebreaks when two
 * players went out in the same round.
 */
function byBracket(matches: Match[], byRecord: Compare): Compare {
	// Names the roster no longer contains simply never get looked up, since every
	// row being sorted comes from the roster.
	const podium = new Map(bracketPodium(matches).map((r, i) => [r.name, i]))
	return (a, b) => {
		const placeA = podium.get(a.name) ?? Number.MAX_SAFE_INTEGER
		const placeB = podium.get(b.name) ?? Number.MAX_SAFE_INTEGER
		if (placeA !== placeB) return placeA - placeB
		const roundA = eliminationRound(a.name, matches)
		const roundB = eliminationRound(b.name, matches)
		if (roundA !== roundB) return roundB - roundA
		return byRecord(a, b)
	}
}

/**
 * Final tournament classement, one distinct place per player — the celebration
 * screen never shares a rank number.
 *
 * Round-robin ranks on wins, then point difference, then net Elo. Double
 * elimination takes the podium from the bracket and orders everyone below it by
 * elimination round.
 */
export function finalStandings({ players, matches, format, ratings }: Options): FinalStandingRow[] {
	const ratingByName = new Map((ratings ?? []).map((r) => [r.name, r]))
	const netOf = (name: string): number => ratingByName.get(name)?.netDelta ?? 0

	// Roster order, deliberately: the comparators below do all the ranking, rather
	// than leaning on the order computeStandings happens to return.
	const statByName = new Map(computeStandings(players, matches).map((s) => [s.name, s]))
	const records: PlayerRecord[] = players.flatMap((name) => {
		const s = statByName.get(name)
		return s === undefined ? [] : [{ name, wins: s.wins, losses: s.played - s.wins, diff: s.diff }]
	})

	const byRecord: Compare = (a, b) => {
		if (a.wins !== b.wins) return b.wins - a.wins
		if (a.diff !== b.diff) return b.diff - a.diff
		return netOf(b.name) - netOf(a.name)
	}

	const ordered = [...records].sort(
		format === 'double_elim' ? byBracket(matches, byRecord) : byRecord,
	)

	// A tie is always broken into distinct places, so the rows involved end up
	// adjacent; the flag is what lets the table join them visually.
	return ordered.map((record, i) => {
		const rating = ratingByName.get(record.name)
		const prev = ordered[i - 1]
		const next = ordered[i + 1]
		return {
			place: i + 1,
			name: record.name,
			wins: record.wins,
			losses: record.losses,
			diff: record.diff,
			elo: rating?.endRating ?? null,
			eloDelta: rating?.netDelta ?? null,
			provisional: rating?.provisional ?? false,
			exAequo:
				(prev !== undefined && sameRecord(record, prev)) ||
				(next !== undefined && sameRecord(record, next)),
		}
	})
}

/** Podium steps, tallest in the middle: silver, gold, bronze. */
const PODIUM_ORDER = [1, 0, 2]

/**
 * The top three of a classement in podium order, so the champion stands in the
 * middle. Short rosters simply get fewer steps — never an empty placeholder.
 */
export function podiumOrder(rows: FinalStandingRow[]): FinalStandingRow[] {
	return PODIUM_ORDER.flatMap((i) => {
		const row = rows[i]
		return row === undefined ? [] : [row]
	})
}
