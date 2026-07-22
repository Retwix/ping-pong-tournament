import type { Player } from '../types'

export interface PlayerLook {
	team: string | null
	url: string | null
}

export type LookUpPlayer = (name: string) => PlayerLook

const UNKNOWN: PlayerLook = { team: null, url: null }

/**
 * Resolves a match/tournament player name to their registry entry, so screens can
 * show a photo and team colour. Tournament names are typed by hand, so a loose
 * (trimmed, case-insensitive) match backs up the exact one; an unknown name simply
 * falls back to the initials avatar.
 */
export function playerLookup(players: Player[]): LookUpPlayer {
	const exact = new Map(players.map((p) => [p.name, p]))
	const loose = new Map(players.map((p) => [p.name.trim().toLowerCase(), p]))
	return (name) => {
		const found = exact.get(name) ?? loose.get(name.trim().toLowerCase())
		return found === undefined ? UNKNOWN : { team: found.team, url: found.avatar_url }
	}
}
