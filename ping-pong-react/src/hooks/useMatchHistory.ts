import { useCallback, useEffect, useMemo, useState } from 'react'
import { listAllDoneMatches, listTournaments } from '../lib/db'
import { supabase } from '../lib/supabase'
import type { Match, Tournament } from '../types'

/** When a match was played, for ordering newest-first. */
function recency(m: Match): number {
  const t = m.ended_at ?? m.started_at
  return t ? new Date(t).getTime() : 0
}

/**
 * Finished matches (newest first) plus the tournaments they belong to, kept live
 * via realtime. Backs both the dashboard "derniers matchs" rail and the full
 * history page, so the recency ordering and the id→name lookup live in one place.
 */
export function useMatchHistory() {
  const [matches, setMatches] = useState<Match[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [ms, ts] = await Promise.all([listAllDoneMatches(), listTournaments()])
      setMatches(ms)
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
      .channel('match-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const sorted = useMemo(
    () => [...matches].sort((a, b) => recency(b) - recency(a)),
    [matches]
  )
  const nameById = useMemo(
    () => new Map(tournaments.map((t) => [t.id, t.name])),
    [tournaments]
  )

  return {
    matches: sorted,
    tournaments,
    tournamentName: (id: string) => nameById.get(id) ?? '',
    loading,
    error,
  }
}
