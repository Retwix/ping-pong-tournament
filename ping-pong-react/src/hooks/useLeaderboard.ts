import { useCallback, useEffect, useState } from 'react'
import {
  computeLeaderboard,
  listAllPredictions,
  settleOpenPredictions,
  type BettorRow,
} from '../lib/predictions'
import { supabase } from '../lib/supabase'

/**
 * Global pronostics leaderboard: settles anything newly decided, then aggregates
 * every prediction into per-bettor rows (accuracy, streaks). Stays live via realtime.
 */
export function useLeaderboard() {
  const [rows, setRows] = useState<BettorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      await settleOpenPredictions()
      const preds = await listAllPredictions()
      setRows(computeLeaderboard(preds))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await load()
      if (!cancelled) setLoading(false)
    })()

    // Predictions changing or matches finishing can both move the standings.
    const channel = supabase
      .channel('leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => load())
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [load])

  return { rows, loading, error, reload: load }
}
