import { useCallback, useEffect, useState } from 'react'
import { listAllDoneMatches, listPlayers, listTournaments } from '../lib/db'
import { supabase } from '../lib/supabase'
import { uniqueChannelName } from '../lib/realtimeChannel'
import type { Match, Player, Tournament } from '../types'

/** Loads all finished matches + players + tournaments, kept live via realtime. */
export function useStats() {
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
      .channel(uniqueChannelName('stats-live'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  return { matches, players, tournaments, loading, error }
}
