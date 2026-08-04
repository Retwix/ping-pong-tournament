// Pure selectors for the « Tournois & parties » page (/parties).

import type { Match, Tournament } from '../types'
import { finalStandings } from './finalStandings'
import { fold } from './fold'
import type { RatingEvent } from './rating'
import { winnerLoser } from './stats'

export type PartiesFilter = 'all' | 'match' | 'tour'

/** Filter carried in the URL (?f=match|tour) so the Accueil links deep-link into the page. */
export function parseFilter(search: string): PartiesFilter {
  const f = new URLSearchParams(search).get('f')
  return f === 'match' || f === 'tour' ? f : 'all'
}

const label = (n: number, one: string, many: string) => `${n} ${n >= 2 ? many : one}`

/** Header subtitle: finished matches + finished tournaments, French pluralisation (0 → singular). */
export function historySubtitle(matches: Match[], tournaments: Tournament[]): string {
  const done = matches.filter((m) => m.done).length
  const tours = tournaments.filter((t) => t.kind === 'tournament' && t.status === 'done').length
  return `${label(done, 'match noté', 'matchs notés')} · ${label(tours, 'tournoi terminé', 'tournois terminés')}`
}

export interface TournamentRow {
  id: string
  name: string
  playersCount: number
  formatLabel: string
  active: boolean
  champion: string | null
  finalist: string | null
  /** When the last match ended — null while nothing finished (FIN column shows « — »). */
  endedAt: string | null
  /** « Non classée » : shows the neutral badge; missing pre-migration flag counts as ranked. */
  unranked: boolean
}

const latestEnd = (matches: Match[]): string | null =>
  matches.reduce<string | null>((latest, m) => {
    if (m.ended_at === null) return latest
    if (latest === null || new Date(m.ended_at).getTime() > new Date(latest).getTime())
      return m.ended_at
    return latest
  }, null)

/**
 * The « Tournois » table: real tournaments only (quick games live in the
 * Parties table), active ones first, then the most recently finished. The
 * finalist is the runner-up of the final standings.
 */
export function tournamentRows(tournaments: Tournament[], matches: Match[]): TournamentRow[] {
  return tournaments
    .filter((t) => t.kind === 'tournament')
    .map((t) => {
      const own = matches.filter((m) => m.tournament_id === t.id)
      const active = t.status === 'active'
      const endedAt = latestEnd(own)
      return {
        id: t.id,
        name: t.name,
        playersCount: t.players.length,
        formatLabel: t.format === 'double_elim' ? 'Double élimination' : 'Round robin',
        active,
        champion: active ? null : t.champion,
        finalist:
          active || own.length === 0
            ? null
            : (finalStandings({ players: t.players, matches: own, format: t.format })[1]?.name ??
              null),
        endedAt,
        unranked: t.unranked ?? false,
        sortAt: endedAt ?? t.created_at,
      }
    })
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
    })
    .map(({ sortAt: _, ...row }) => row)
}

export interface MatchRow {
  id: string
  tournamentId: string
  winner: string
  loser: string
  winnerScore: number
  loserScore: number
  /** The winner's rating gain — null when the match never got rated (e.g. missing replay data). */
  eloDelta: number | null
  competition: string
  endedAt: string | null
  /** « Non classée » : the match moved no Elo; missing pre-migration flag counts as ranked. */
  unranked: boolean
}

const timeKey = (m: Match): string => m.ended_at ?? m.started_at ?? ''

/**
 * The « Parties » table: every finished match (byes aren't real results),
 * newest first, with the winner's Elo move and its competition label.
 */
export function matchRows(
  matches: Match[],
  events: RatingEvent[],
  tournaments: Tournament[],
): MatchRow[] {
  const tournamentById = new Map(tournaments.map((t) => [t.id, t]))
  const winnerDeltaByMatch = new Map(events.filter((e) => e.won).map((e) => [e.matchId, e.delta]))

  return matches
    .filter((m) => m.done && !m.bye)
    .sort((a, b) => timeKey(b).localeCompare(timeKey(a)))
    .map((m) => {
      const { winner, loser, ws, ls } = winnerLoser(m)
      const tournament = tournamentById.get(m.tournament_id)
      return {
        id: m.id,
        tournamentId: m.tournament_id,
        winner,
        loser,
        winnerScore: ws,
        loserScore: ls,
        eloDelta: winnerDeltaByMatch.get(m.id) ?? null,
        competition:
          tournament === undefined
            ? '—'
            : tournament.kind === 'game'
              ? 'Partie rapide'
              : tournament.name,
        endedAt: m.ended_at,
        unranked: tournament?.unranked ?? false,
      }
    })
}

/** Case- and accent-insensitive search over players and competition. Empty query → all rows. */
export function filterMatchRows(rows: MatchRow[], query: string): MatchRow[] {
  const q = fold(query.trim())
  return rows.filter((r) => [r.winner, r.loser, r.competition].some((v) => fold(v).includes(q)))
}

/** Same search over tournament name, champion and finalist (absent on active tournaments). */
export function filterTournamentRows(rows: TournamentRow[], query: string): TournamentRow[] {
  const q = fold(query.trim())
  return rows.filter((r) =>
    [r.name, r.champion, r.finalist].some((v) => v !== null && fold(v).includes(q)),
  )
}

export type SortDir = 'recent' | 'oldest'

/** Row selectors produce newest-first; « Plus ancien » simply reads them the other way. */
export function applySort<T>(rows: T[], dir: SortDir): T[] {
  return dir === 'recent' ? rows : [...rows].reverse()
}

export function sortLabel(dir: SortDir): string {
  return dir === 'recent' ? 'Plus récent ▾' : 'Plus ancien ▴'
}

/** Which tables the filter chips leave on screen. */
export function visibleBlocks(filter: PartiesFilter): { tournois: boolean; parties: boolean } {
  return { tournois: filter !== 'match', parties: filter !== 'tour' }
}

/** The « En direct » card shows unless the user filtered down to tournaments only. */
export function showLiveBlock(filter: PartiesFilter, live: Match | null): boolean {
  return filter !== 'tour' && live !== null
}

export const MATCHES_PAGE_INITIAL = 10
export const MATCHES_PAGE_STEP = 20

/** « Charger N matchs de plus » — N capped at one page; null once everything is shown. */
export function loadMoreLabel(remaining: number): string | null {
  if (remaining <= 0) return null
  const n = Math.min(MATCHES_PAGE_STEP, remaining)
  return `Charger ${label(n, 'match de plus', 'matchs de plus')}`
}
