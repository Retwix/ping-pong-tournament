import { useCallback, useEffect, useState } from 'react'
import { listPlayers } from '../lib/db'
import { supabase } from '../lib/supabase'
import type { Player } from '../types'

/** The player registry, kept fresh via realtime on the players table. */
export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setPlayers(await listPlayers())
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
      .channel('players-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  return { players, loading, error, refresh }
}
