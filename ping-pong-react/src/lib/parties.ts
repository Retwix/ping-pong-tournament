// Pure selectors for the « Tournois & parties » page (/parties).

import type { Match, Tournament } from '../types'

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
