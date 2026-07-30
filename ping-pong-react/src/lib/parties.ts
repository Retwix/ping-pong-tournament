// Pure selectors for the « Tournois & parties » page (/parties).

import type { Match, Tournament } from '../types'
import { finalStandings } from './finalStandings'

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
        sortAt: endedAt ?? t.created_at,
      }
    })
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
    })
    .map(({ sortAt: _, ...row }) => row)
}
