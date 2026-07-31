// Pure selectors for the Joueurs annuaire page (design handoff §Page 5).
// Rows derive from the same Glicko-2 replay as the Classement, so the numbers
// on the two pages can never disagree.

import { recordOf } from './classement'
import { fold } from './fold'
import type { RatingEvent, RatingRow } from './rating'
import { TEAMS, teamLabel } from './teams'

export interface JoueurRow {
  key: string
  playerId: string | null
  name: string
  team: string | null
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

/** One annuaire table row per ranked player, in the incoming (ranked) order. */
export function joueurRows(rows: RatingRow[], events: RatingEvent[]): JoueurRow[] {
  return rows.map((r) => {
    const { wins, losses } = recordOf(events, r.key)
    const played = wins + losses
    const rate = played === 0 ? 0 : Math.round((wins / played) * 100)
    return {
      key: r.key,
      playerId: r.playerId,
      name: r.name,
      team: r.team,
      avatarUrl: r.avatar_url,
      elo: Math.round(r.rating),
      played,
      wins,
      losses,
      meta: `${wins} V · ${losses} D`,
      matchsLabel: `${played} match${played >= 2 ? 's' : ''}`,
      winrate: `${rate} %`,
      winrateStrong: rate >= 50,
    }
  })
}

/** Accent-insensitive search on name + team label, combined with the team chip. */
export function filterJoueurs(rows: JoueurRow[], query: string, team: string): JoueurRow[] {
  const q = fold(query.trim())
  return rows.filter(
    (r) =>
      (team === 'all' || r.team === team) &&
      (fold(r.name).includes(q) || (r.team !== null && fold(teamLabel(r.team)).includes(q))),
  )
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
    .filter((t): t is string => t !== null && !standardKeys.has(t))
    .filter((t, i, all) => all.indexOf(t) === i)
  return [
    { key: 'all', label: 'Tous', count: rows.length },
    ...TEAMS.map((t) => ({ key: t.key, label: t.label, count: countOf(t.key) })),
    ...extras.map((t) => ({ key: t, label: teamLabel(t), count: countOf(t) })),
  ]
}
