import { useCallback, useEffect, useMemo, useState } from 'react'
import { listAllDoneMatches, listPlayers, listTournaments, recomputeRatings } from '../lib/db'
import { ladderReplay } from '../lib/ladder'
import type { RatingRow, RatingEvent } from '../lib/rating'
import { ALL_TIME, type LadderScope } from '../lib/seasons'
import { supabase } from '../lib/supabase'
import { uniqueChannelName } from '../lib/realtimeChannel'
import type { Match, Player, Tournament } from '../types'

/**
 * The Glicko-2 leaderboard. Loads finished matches + the player registry, then
 * derives ratings in-memory by replaying history (same engine that the stored
 * values are persisted from, so the view is always current). Stays live via
 * realtime. `recompute` lets the view force a re-persist of stored ratings.
 *
 * A `scope` picks which ladder is replayed — see ladderReplay.
 */
export function useRatings(scope: LadderScope = ALL_TIME) {
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [ms, ps, ts] = await Promise.all([
        listAllDoneMatches(),
        listPlayers(),
        listTournaments(),
      ])
      setMatches(ms)
      setPlayers(ps)
      setTournaments(ts)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel(uniqueChannelName('ratings-live'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  // Depend on the id, not the scope object: a fresh literal of the same value
  // would otherwise re-run the whole replay on every render.
  const seasonId = scope.kind === 'season' ? scope.id : null

  const { rows, events } = useMemo(
    () =>
      ladderReplay(seasonId === null ? ALL_TIME : { kind: 'season', id: seasonId }, {
        matches,
        players,
        tournaments,
      }),
    [matches, players, tournaments, seasonId],
  )

  const recompute = useCallback(async () => {
    try {
      await recomputeRatings()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return {
    rows,
    events,
    matches,
    players,
    tournaments,
    matchCount: matches.length,
    loading,
    error,
    reload: refresh,
    recompute,
  }
}

export type { RatingRow, RatingEvent }
