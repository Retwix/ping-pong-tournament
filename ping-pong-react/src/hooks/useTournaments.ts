import { useCallback, useEffect, useState } from 'react'
import { listTournaments } from '../lib/db'
import { supabase } from '../lib/supabase'
import type { Tournament } from '../types'

/** List of all tournaments, kept fresh via realtime on the tournaments table. */
export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setTournaments(await listTournaments())
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
      .channel('tournaments-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => {
        refresh()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  return { tournaments, loading, error, refresh }
}
