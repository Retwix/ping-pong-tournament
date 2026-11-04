import { useEffect, useState } from 'react'
import { getActiveTournament } from '../lib/db'
import { supabase } from '../lib/supabase'
import { uniqueChannelName } from '../lib/realtimeChannel'

/**
 * Resolves the id of the tournament currently on the table (is_active = true) and
 * keeps it live: any change to the tournaments table — a new one started, the
 * active pointer moved, a deletion — re-resolves. This is what lets the stable
 * /live and /ref URLs follow whatever is being played without a per-tournament id.
 *
 * Returns `id: null` when nothing is active (cold start or the active tournament
 * was deleted), which the views render as a "no live game" placeholder.
 *
 * Realtime replays nothing it missed, so a screen nobody can refresh passes
 * `pollMs` to catch up. A failed poll keeps the current id and waits for the next.
 */
export function useCurrentTournament(pollMs?: number) {
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

    const poll = pollMs
      ? setInterval(() => {
          getActiveTournament()
            .then((t) => {
              if (!cancelled) setId(t?.id ?? null)
            })
            .catch(() => {})
        }, pollMs)
      : undefined

    const channel = supabase
      .channel(uniqueChannelName('current-tournament'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () =>
        resolve(),
      )
      .subscribe()

    return () => {
      cancelled = true
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [pollMs])

  return { id, loading }
}
