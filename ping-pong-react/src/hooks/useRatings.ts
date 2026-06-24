import { useCallback, useEffect, useMemo, useState } from 'react'
import { listAllDoneMatches, listPlayers, listTournaments, recomputeRatings } from '../lib/db'
import { rankRatings, replayRatings, type RatingRow, type RatingEvent } from '../lib/rating'
import { supabase } from '../lib/supabase'
import type { Match, Player, Tournament } from '../types'

/**
 * The Glicko-2 leaderboard. Loads finished matches + the player registry, then
 * derives ratings in-memory by replaying history (same engine that the stored
 * values are persisted from, so the view is always current). Stays live via
 * realtime. `recompute` lets the view force a re-persist of stored ratings.
 */
export function useRatings() {
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
      .channel('ratings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const { rows, events } = useMemo(() => {
    const targetByTournament = new Map(tournaments.map((t) => [t.id, t.target]))
    const result = replayRatings(matches, players, { targetByTournament })
    return { rows: rankRatings(result, players), events: result.events }
  }, [matches, players, tournaments])

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
    matchCount: matches.length,
    loading,
    error,
    reload: refresh,
    recompute,
  }
}

export type { RatingRow, RatingEvent }
