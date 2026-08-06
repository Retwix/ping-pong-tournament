// Shared knowledge about doubles (2v2) games: the pair display-name format
// and how the rest of the app tells doubles matches apart from individual ones.

import type { Match } from '../types'
import type { SelectionDouble } from './nouvellePartie'

/** Pair display name: « Léo & Inès », or « … » while the camp is empty. */
export function nomPaire(noms: string[]): string {
  return noms.join(' & ') || '…'
}

/** The 2+2 split where ids[0] pairs with ids[partenaire]; the other two make team B. */
function decouper(ids: string[], partenaire: number): [string[], string[]] {
  return [[ids[0], ids[partenaire]], ids.filter((_, i) => i !== 0 && i !== partenaire)]
}

/**
 * Draw two random duos from 4 players (« équipes au hasard »). The split is
 * fully determined by who partners the first player, so one rng call picks
 * uniformly among the 3 possible splits. rng is injected for testability.
 */
export function tirerEquipes(ids: string[], rng: () => number): [string[], string[]] {
  return decouper(ids, 1 + Math.floor(rng() * 3))
}

/**
 * « Mélanger » : re-deal a full 2v2 selection into one of the two OTHER
 * splits — a tap always visibly changes the duos. The active camp stays put.
 */
export function melangerEquipes(sel: SelectionDouble, rng: () => number): SelectionDouble {
  const ids = [...sel.a, ...sel.b]
  const [a, b] = decouper(ids, rng() < 0.5 ? 2 : 3)
  return { a, b, camp: sel.camp }
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
