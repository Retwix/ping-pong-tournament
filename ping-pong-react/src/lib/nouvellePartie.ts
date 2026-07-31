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
