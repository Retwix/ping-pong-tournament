import { useCurrentTournament } from './useCurrentTournament'
import { useTournament } from './useTournament'
import { isLive } from '../lib/pingpong'
import { isPlayable } from '../lib/doubleElim'
import type { Match, Tournament } from '../types'

export interface LiveMatchInfo {
  tournament: Tournament
  match: Match
  /** 'live' once a point is on the board; 'upcoming' for a match about to start. */
  status: 'live' | 'upcoming'
}

/**
 * Resolves the match to feature on the dashboard, using the same resolution as the
 * /live and /ref views: the active tournament (is_active) plus its current match.
 * Prefers a match that is already live (`isLive` — started or with a point), and
 * otherwise falls back to the next playable match (`isPlayable`) so a referee can
 * open a match *before* the first point — surfaced as 'upcoming'. The active pointer
 * is kept honest by `setActiveTournament`. Returns `live: null` when nothing is on.
 */
export function useLiveMatch(): { live: LiveMatchInfo | null; loading: boolean } {
  const { id, loading: idLoading } = useCurrentTournament()
  const { tournament, matches, loading: tLoading } = useTournament(id)

  const liveMatch = matches.find(isLive) ?? null
  const upcoming = liveMatch ? null : matches.find(isPlayable) ?? null
  const featured = liveMatch ?? upcoming

  const live =
    tournament && featured && tournament.status !== 'done'
      ? {
          tournament,
          match: featured,
          status: (liveMatch ? 'live' : 'upcoming') as 'live' | 'upcoming',
        }
      : null

  return { live, loading: idLoading || (id != null && tLoading) }
}
