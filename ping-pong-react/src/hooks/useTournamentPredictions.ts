import { useCallback, useEffect, useState } from 'react'
import {
  getTournamentPredictions,
  placePrediction,
  settleOpenPredictions,
  type PlaceInput,
  type Prediction,
} from '../lib/predictions'
import { supabase } from '../lib/supabase'

/**
 * Live list of every prediction for one tournament (match bets + champion futures),
 * kept in sync via Supabase realtime. Exposes `place` to add/update a pick. Reloads
 * whenever predictions change so crowd splits and results update on every device.
 */
export function useTournamentPredictions(tournamentId: string | null) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!tournamentId) return
    try {
      const rows = await getTournamentPredictions(tournamentId)
      setPredictions(rows)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId) {
      setPredictions([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      // Settle anything already decided, then load the fresh picture.
      try {
        await settleOpenPredictions()
      } catch {
        /* non-fatal — leaderboard reconciles again later */
      }
      if (cancelled) return
      await reload()
      if (!cancelled) setLoading(false)
    })()

    const channel = supabase
      .channel(`predictions-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'predictions',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => reload()
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [tournamentId, reload])

  const place = useCallback(
    async (input: PlaceInput) => {
      await placePrediction(input)
      await reload()
    },
    [reload]
  )

  return { predictions, loading, error, place, reload }
}
