// Shared knowledge about doubles (2v2) games: the pair display-name format
// and how the rest of the app tells doubles matches apart from individual ones.

import type { Match } from '../types'

/** Pair display name: « Léo & Inès », or « … » while the camp is empty. */
export function nomPaire(noms: string[]): string {
  return noms.join(' & ') || '…'
}

/** The players behind a pair display name (a 1v1 name comes back alone). */
export function membresPaire(nom: string): string[] {
  return nom.split(' & ')
}

/**
 * The matches that count for individual aggregations (stats, records): doubles
 * matches carry pair display names that map to no registry player, so they are
 * left out. Rows created before the doubles migration lack the flag — missing
 * counts as individual, as does an unknown tournament.
 */
export function individualMatches(
  matches: Match[],
  tournaments: Array<{ id: string; doubles?: boolean }>,
): Match[] {
  const doublesIds = new Set(tournaments.filter((t) => t.doubles).map((t) => t.id))
  return matches.filter((m) => !doublesIds.has(m.tournament_id))
}
