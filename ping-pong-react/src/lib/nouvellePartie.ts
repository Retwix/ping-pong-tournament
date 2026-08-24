import { nomPaire } from './doubles'
import { fold, matchesJoueur } from './fold'
import { doubleElimMatchCount, MIN_DE_PLAYERS } from './doubleElim'
import { matchCount, roundCount } from './roundRobin'
import type { PlayerStatus, TournamentFormat } from '../types'

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
  const matchup = `${nomPaire(a)} vs ${nomPaire(b)}`
  return {
    autoName: matchup,
    hint: valid
      ? `${matchup} · jeu en ${target}`
      : `Choisis 4 joueurs — 2 par équipe. Équipe A : ${a.length}/2 · Équipe B : ${b.length}/2.`,
    valid,
  }
}

/** Live recap in « équipes au hasard » mode: the duos don't exist until the draw. */
export function recapitulatifHasard(n: number, target: number): Recapitulatif {
  const valid = n === 2 * TAILLE_EQUIPE
  return {
    autoName: 'Partie en double',
    hint: valid
      ? `4 joueurs · équipes au hasard · jeu en ${target}`
      : `Choisis 4 joueurs — les équipes seront tirées au sort. Joueurs : ${n}/4.`,
    valid,
  }
}

/** Helper line under the team cards: where the next pick lands, or completeness. */
export function aideCamp(sel: SelectionDouble): string {
  if (sel.a.length + sel.b.length === 2 * TAILLE_EQUIPE) return 'Les deux équipes sont complètes.'
  return `Les joueurs choisis rejoignent l’équipe ${sel.camp} — clique l’autre carte pour changer de camp.`
}

/**
 * One-line stakes note under the « L'enjeu » control: what this choice does to
 * Elo. An ancien playing takes precedence over the doubles wording — it is the
 * more specific and more surprising reason the game won't count.
 */
export function noteEnjeu(unranked: boolean, doubles = false, ancien = false): string {
  if (ancien) return 'Un ancien joue : la partie ne compte pas pour le classement.'
  if (doubles) return 'Les doubles sont non classés en v1 — pas encore d’Elo de paire.'
  return unranked
    ? 'Aucun impact sur le classement Elo. La partie reste visible dans les parties.'
    : 'Le résultat déplace l’Elo des joueurs et compte dans « Le classement ».'
}

/** Whether any selected row belongs to an ancien — forces the partie « non classée ». */
export function contientAncien(rows: { status: PlayerStatus }[]): boolean {
  return rows.some((r) => r.status === 'alumni')
}

/**
 * The enjeu actually applied. Doubles have no pair Elo yet, and an ancien
 * playing must never move a rating in a ladder they no longer appear in —
 * both force « non classée » regardless of the player's manual choice. The
 * manual choice itself is never overwritten, so releasing the lock (the
 * ancien is deselected, or doubles is turned off) reveals whatever the player
 * had chosen before, rather than resetting to « classée ».
 */
export function enjeuEffectif(manualUnranked: boolean, doubles: boolean, ancien: boolean): boolean {
  return doubles || manualUnranked || ancien
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
