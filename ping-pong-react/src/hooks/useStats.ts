import { useCallback, useEffect, useState } from 'react'
import { listAllDoneMatches, listPlayers } from '../lib/db'
import { supabase } from '../lib/supabase'
import type { Match, Player } from '../types'

/** Loads all finished matches + the player registry, kept live via realtime. */
export function useStats() {
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [ms, ps] = await Promise.all([listAllDoneMatches(), listPlayers()])
      setMatches(ms)
      setPlayers(ps)
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
      .channel('stats-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  return { matches, players, loading, error }
}
