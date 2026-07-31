// Pure selectors for the Joueurs annuaire page (design handoff §Page 5).
// The registry is the base (a freshly added player has no match yet); ratings
// and records come from the same Glicko-2 replay as the Classement, so the
// numbers on the two pages can never disagree.

import type { Player } from '../types'
import { recordOf } from './classement'
import { fold } from './fold'
import { RATING, type RatingEvent, type RatingRow } from './rating'
import { TEAMS, teamLabel } from './teams'

export interface JoueurRow {
  id: string
  name: string
  team: string
  avatarUrl: string | null
  elo: number
  played: number
  wins: number
  losses: number
  meta: string
  matchsLabel: string
  winrate: string
  winrateStrong: boolean
}

/**
 * One annuaire row per registered player, best Elo first. Identity (name, team,
 * photo) always reflects the editable registry; the rating row is matched by
 * player id, falling back to rows recorded by name only (pre-registry matches).
 */
export function joueurRows(
  players: Player[],
  rows: RatingRow[],
  events: RatingEvent[],
): JoueurRow[] {
  const rowOf = (p: Player) =>
    rows.find((r) => r.playerId === p.id) ??
    rows.find((r) => r.playerId === null && r.name === p.name)
  return players
    .map((p) => {
      const row = rowOf(p)
      const { wins, losses } = row ? recordOf(events, row.key) : { wins: 0, losses: 0 }
      const played = wins + losses
      const rate = played === 0 ? 0 : Math.round((wins / played) * 100)
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        avatarUrl: p.avatar_url,
        elo: Math.round(row?.rating ?? RATING.R0),
        played,
        wins,
        losses,
        meta: `${wins} V · ${losses} D`,
        matchsLabel: `${played} match${played >= 2 ? 's' : ''}`,
        winrate: `${rate} %`,
        winrateStrong: rate >= 50,
      }
    })
    .sort((a, b) => b.elo - a.elo || a.name.localeCompare(b.name, 'fr'))
}

/** « {n} joueurs inscrits · modifie un profil en un clic », singular below two. */
export function joueursSubtitle(count: number): string {
  const s = count >= 2 ? 's' : ''
  return `${count} joueur${s} inscrit${s} · modifie un profil en un clic`
}

/** Accent-insensitive search on name + team label, combined with the team chip. */
export function filterJoueurs(rows: JoueurRow[], query: string, team: string): JoueurRow[] {
  const q = fold(query.trim())
  return rows.filter(
    (r) =>
      (team === 'all' || r.team === team) &&
      (fold(r.name).includes(q) || fold(teamLabel(r.team)).includes(q)),
  )
}

export interface JoueurForm {
  name: string
  team: string
}

/** M2 save fallbacks: never persist an empty name (« Sans nom ») or team (« — »). */
export function normalizeJoueurForm(form: JoueurForm): JoueurForm {
  return {
    name: form.name.trim() || 'Sans nom',
    team: form.team.trim() || '—',
  }
}

/** « Nouveau joueur » while the optimistic create is pending, live form name otherwise. */
export function dialogTitle(pending: boolean, formName: string): string {
  if (pending) return 'Nouveau joueur'
  return `Modifier ${formName.trim() || 'le joueur'}`
}

export interface TeamChip {
  key: string
  label: string
  count: number
}

/**
 * « Tous · {n} » then every standard pôle (registry order, empty ones included)
 * then any free-text team present among players, in first-appearance order.
 */
export function teamChips(rows: JoueurRow[]): TeamChip[] {
  const countOf = (key: string) => rows.filter((r) => r.team === key).length
  const standardKeys = new Set<string>(TEAMS.map((t) => t.key))
  const extras = rows
    .map((r) => r.team)
    .filter((t) => t !== '' && !standardKeys.has(t))
    .filter((t, i, all) => all.indexOf(t) === i)
  return [
    { key: 'all', label: 'Tous', count: rows.length },
    ...TEAMS.map((t) => ({ key: t.key, label: t.label, count: countOf(t.key) })),
    ...extras.map((t) => ({ key: t, label: teamLabel(t), count: countOf(t) })),
  ]
}
