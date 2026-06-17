import { useEffect, useState } from 'react'
import { getActiveTournament } from '../lib/db'
import { supabase } from '../lib/supabase'

/**
 * Resolves the id of the tournament currently on the table (is_active = true) and
 * keeps it live: any change to the tournaments table — a new one started, the
 * active pointer moved, a deletion — re-resolves. This is what lets the stable
 * /live and /ref URLs follow whatever is being played without a per-tournament id.
 *
 * Returns `id: null` when nothing is active (cold start or the active tournament
 * was deleted), which the views render as a "no live game" placeholder.
 */
export function useCurrentTournament() {
  const [id, setId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const resolve = async () => {
      try {
        const t = await getActiveTournament()
        if (!cancelled) setId(t?.id ?? null)
      } catch {
        if (!cancelled) setId(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    resolve()

    const channel = supabase
      .channel('current-tournament')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        () => resolve()
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { id, loading }
}
