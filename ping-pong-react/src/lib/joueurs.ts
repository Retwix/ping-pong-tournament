// Pure selectors for the Joueurs annuaire page (design handoff §Page 5).
// The registry is the base (a freshly added player has no match yet); ratings
// and records come from the same Glicko-2 replay as the Classement, so the
// numbers on the two pages can never disagree.

import type { Player, PlayerStatus } from '../types'
import { recordOf } from './classement'
import { fold, matchesJoueur } from './fold'
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
  status: PlayerStatus
  leftAt: string | null
}

/**
 * One annuaire row per registered player, best Elo first. Identity (name, team,
 * photo) always reflects the editable registry; the rating row is matched by
 * player id, falling back to rows recorded by name only (pre-registry matches).
 *
 * The two numbers answer two different questions and are read from two different
 * places on purpose: `rows` is the ladder in scope — the season being played, so
 * the Elo here is the one Le Classement shows — while `events` is the career, so
 * « 12 matchs · 58 % » still counts every match the player has ever played. That
 * is also why the record is keyed off the player rather than off their rating
 * row: someone who hasn't played since the season opened holds no row, and their
 * career must not read as zero.
 */
export function joueurRows(
  players: Player[],
  rows: RatingRow[],
  events: RatingEvent[],
): JoueurRow[] {
  const rowOf = (p: Player) =>
    rows.find((r) => r.playerId === p.id) ??
    rows.find((r) => r.playerId === null && r.name === p.name)
  const eventKeys = new Set(events.map((e) => e.key))
  const recordKeyOf = (p: Player) => (eventKeys.has(p.id) ? p.id : `name:${p.name}`)
  return players
    .map((p) => {
      const row = rowOf(p)
      const { wins, losses } = recordOf(events, recordKeyOf(p))
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
        status: p.status,
        leftAt: p.left_at,
      }
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'alumni' ? 1 : -1
      return b.elo - a.elo || a.name.localeCompare(b.name, 'fr')
    })
}

/** « {n} joueurs inscrits · modifie un profil en un clic », singular below two. */
export function joueursSubtitle(count: number): string {
  const s = count >= 2 ? 's' : ''
  return `${count} joueur${s} inscrit${s} · modifie un profil en un clic`
}

/**
 * Accent-insensitive search on name + team label, combined with the team chip.
 * The « Anciens » chip (`team === 'alumni'`) shows only alumni; every other
 * chip — including « Tous » — hides them, matching the ladder's default view.
 */
export function filterJoueurs(rows: JoueurRow[], query: string, team: string): JoueurRow[] {
  const q = fold(query.trim())
  const wantsAlumni = team === 'alumni'
  return rows.filter(
    (r) =>
      (wantsAlumni ? r.status === 'alumni' : r.status !== 'alumni') &&
      (wantsAlumni || team === 'all' || r.team === team) &&
      matchesJoueur(r, q),
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

/**
 * What happened to the photo since the modal opened. Nothing touches storage
 * until « Enregistrer », so cancelling always rolls the photo back too.
 */
export type PhotoDraft =
  { kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; blob: Blob; previewUrl: string }

/** The storage operation « Enregistrer » must perform for the photo. */
export function avatarAction(
  original: string | null,
  draft: PhotoDraft,
): 'none' | 'upload' | 'remove' {
  if (draft.kind === 'new') return 'upload'
  if (draft.kind === 'remove' && original !== null) return 'remove'
  return 'none'
}

/** The photo the modal avatar shows right now (null → initials). */
export function photoShown(original: string | null, draft: PhotoDraft): string | null {
  if (draft.kind === 'new') return draft.previewUrl
  if (draft.kind === 'remove') return null
  return original
}

export interface AvatarZoom {
  url: string
  alt: string
}

/**
 * The photo an annuaire row can open full size. Rows falling back to initials
 * have nothing to enlarge, so their avatar stays inert and the click opens the
 * edit modale like the rest of the row.
 */
export function avatarZoom(row: JoueurRow): AvatarZoom | null {
  if (row.avatarUrl === null) return null
  return { url: row.avatarUrl, alt: `Photo de ${row.name}` }
}

export interface TeamChip {
  key: string
  label: string
  count: number
}

/**
 * « Tous · {n} » then every standard pôle (registry order, empty ones included)
 * then any free-text team present among players, in first-appearance order,
 * then « Anciens » — only when at least one player has left.
 */
export function teamChips(rows: JoueurRow[]): TeamChip[] {
  const countOf = (key: string) => rows.filter((r) => r.team === key).length
  const standardKeys = new Set<string>(TEAMS.map((t) => t.key))
  const extras = rows
    .map((r) => r.team)
    .filter((t) => t !== '' && !standardKeys.has(t))
    .filter((t, i, all) => all.indexOf(t) === i)
  const alumniCount = rows.filter((r) => r.status === 'alumni').length
  return [
    { key: 'all', label: 'Tous', count: rows.length },
    ...TEAMS.map((t) => ({ key: t.key, label: t.label, count: countOf(t.key) })),
    ...extras.map((t) => ({ key: t, label: teamLabel(t), count: countOf(t) })),
    ...(alumniCount > 0 ? [{ key: 'alumni', label: 'Anciens', count: alumniCount }] : []),
  ]
}
