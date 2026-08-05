import { fold, matchesJoueur } from './fold'
import { doubleElimMatchCount, MIN_DE_PLAYERS } from './doubleElim'
import { matchCount, roundCount } from './roundRobin'
import type { TournamentFormat } from '../types'

/** Everything the recap rail needs to know about the form, independent of the UI. */
export interface CreationState {
  variant: 'game' | 'tournament'
  /** Tournament format; ignored for quick games (always a single match). */
  format: TournamentFormat
  /** Names of the picked players, in pick order. */
  selected: string[]
  /** Raw tournament-name input; quick games auto-name from the matchup. */
  name: string
  /** Points per game. */
  target: number
}

export interface Recapitulatif {
  autoName: string
  hint: string
  valid: boolean
}

/** Live recap for the rail: auto-name, one-line validation hint, and submittability. */
export function recapitulatif(state: CreationState): Recapitulatif {
  const { variant, format, selected, target } = state
  const n = selected.length

  if (variant === 'game') {
    const valid = n === 2
    const matchup = `${selected[0]} vs ${selected[1]}`
    return {
      autoName: valid ? matchup : n === 1 ? `${selected[0]} vs …` : 'Partie rapide',
      hint: valid ? `${matchup} · jeu en ${target}` : 'Choisis 2 joueurs.',
      valid,
    }
  }

  const autoName = state.name.trim() || 'Tournoi'

  if (format === 'double_elim') {
    const valid = n >= MIN_DE_PLAYERS
    return {
      autoName,
      hint: valid
        ? `${n} joueurs · ${doubleElimMatchCount(n)} matchs · 2 défaites = éliminé`
        : `Sélectionne au moins ${MIN_DE_PLAYERS} joueurs pour une élimination directe.`,
      valid,
    }
  }

  const valid = n >= 2
  const exempts = n % 2 !== 0 ? ' (avec exempts)' : ''
  return {
    autoName,
    hint: valid
      ? `${n} joueurs · ${matchCount(n)} matchs · ${roundCount(n)} tours${exempts}`
      : 'Sélectionne au moins 2 joueurs.',
    valid,
  }
}

export type Camp = 'A' | 'B'

/** 2v2 selection: the two pairs plus the camp the next pick lands in. */
export interface SelectionDouble {
  a: string[]
  b: string[]
  camp: Camp
}

const TAILLE_EQUIPE = 2
const AUTRE_CAMP: Record<Camp, Camp> = { A: 'B', B: 'A' }

/**
 * Pick a player: joins the active camp until it is full, then the other one.
 * Full game or already-picked player → selection unchanged.
 */
export function choisirJoueurDouble(sel: SelectionDouble, name: string): SelectionDouble {
  if (sel.a.includes(name) || sel.b.includes(name)) return sel
  const equipe = (camp: Camp) => (camp === 'A' ? sel.a : sel.b)
  const aDeLaPlace = (camp: Camp) => equipe(camp).length < TAILLE_EQUIPE
  const cible = aDeLaPlace(sel.camp)
    ? sel.camp
    : aDeLaPlace(AUTRE_CAMP[sel.camp])
      ? AUTRE_CAMP[sel.camp]
      : null
  if (cible === null) return sel
  const a = cible === 'A' ? [...sel.a, name] : sel.a
  const b = cible === 'B' ? [...sel.b, name] : sel.b
  const complet = (cible === 'A' ? a : b).length === TAILLE_EQUIPE
  const resteUnePlace = (cible === 'A' ? b : a).length < TAILLE_EQUIPE
  return { a, b, camp: complet && resteUnePlace ? AUTRE_CAMP[cible] : cible }
}

/** Remove a player from whichever camp holds them; the active camp stays put. */
export function retirerJoueurDouble(sel: SelectionDouble, name: string): SelectionDouble {
  return {
    a: sel.a.filter((n) => n !== name),
    b: sel.b.filter((n) => n !== name),
    camp: sel.camp,
  }
}

/** Live recap for a 2v2 game: pair auto-name, per-camp counters, submittability. */
export function recapitulatifDouble(sel: SelectionDouble, target: number): Recapitulatif {
  const { a, b } = sel
  const distincts = new Set([...a, ...b]).size === a.length + b.length
  const valid = a.length === TAILLE_EQUIPE && b.length === TAILLE_EQUIPE && distincts
  const paireA = a.join(' & ') || '…'
  const paireB = b.join(' & ') || '…'
  const matchup = `${paireA} vs ${paireB}`
  return {
    autoName: matchup,
    hint: valid
      ? `${matchup} · jeu en ${target}`
      : `Choisis 4 joueurs — 2 par équipe. Équipe A : ${a.length}/2 · Équipe B : ${b.length}/2.`,
    valid,
  }
}

/** One-line stakes note under the « L'enjeu » control: what this choice does to Elo. */
export function noteEnjeu(unranked: boolean): string {
  return unranked
    ? 'Aucun impact sur le classement Elo. La partie reste visible dans les parties.'
    : 'Le résultat déplace l’Elo des joueurs et compte dans « Le classement ».'
}

/** Accent- and case-insensitive duplicate check against the registry (« Leo » = « Léo »). */
export function estDoublon(players: { name: string }[], name: string): boolean {
  const n = fold(name.trim())
  return players.some((p) => fold(p.name) === n)
}

/** Effective points target: a valid « autre » entry (1–99) wins over the preset chip. */
export function pointsCible(preset: number, autre: string): number {
  const v = parseInt(autre, 10)
  return Number.isInteger(v) && v >= 1 && v <= 99 ? v : preset
}

/** Accent- and case-insensitive registry search on player name and pôle label. */
export function filterJoueurs<P extends { name: string; team: string }>(
  players: P[],
  query: string,
): P[] {
  const q = fold(query.trim())
  if (!q) return players
  return players.filter((p) => matchesJoueur(p, q))
}
