import { useCurrentTournament } from './useCurrentTournament'
import { useTournament } from './useTournament'
import { isLive } from '../lib/pingpong'
import type { Match, Tournament } from '../types'

export interface LiveMatchInfo {
  tournament: Tournament
  match: Match
}

/**
 * Resolves the match currently being played on the table, if any, using the exact
 * same resolution as the /live and /ref views: the active tournament (is_active)
 * plus the first match within it that is live (`isLive` — started, or with a point
 * on the board). The active pointer is kept honest by `setActiveTournament`, which
 * claims it the moment a match goes live, so the banner and live mode never diverge.
 * Returns `live: null` when nothing is on.
 */
export function useLiveMatch(): { live: LiveMatchInfo | null; loading: boolean } {
  const { id, loading: idLoading } = useCurrentTournament()
  const { tournament, matches, loading: tLoading } = useTournament(id)

  const match = matches.find(isLive) ?? null
  const live =
    tournament && match && tournament.status !== 'done'
      ? { tournament, match }
      : null

  return { live, loading: idLoading || (id != null && tLoading) }
}
