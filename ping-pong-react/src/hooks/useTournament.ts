import { useCallback, useEffect, useState } from 'react'
import { getMatches, getTournament, updateMatch, updateTournament } from '../lib/db'
import { supabase } from '../lib/supabase'
import { computeStandings } from '../lib/pingpong'
import type { Match, Tournament } from '../types'

interface MatchChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Match | Record<string, never>
  old: Partial<Match>
}

function upsertSorted(list: Match[], row: Match): Match[] {
  const next = list.some((m) => m.id === row.id)
    ? list.map((m) => (m.id === row.id ? row : m))
    : [...list, row]
  return next.sort((a, b) => a.idx - b.idx)
}

/**
 * Loads one tournament + its matches and keeps them live via Supabase realtime.
 * Mutations are optimistic (local state updates immediately, then persists).
 */
export function useTournament(id: string | null) {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setTournament(null)
      setMatches([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const [t, ms] = await Promise.all([getTournament(id), getMatches(id)])
        if (cancelled) return
        setTournament(t)
        setMatches(ms)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    const channel = supabase
      .channel(`tournament-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${id}` },
        (payload) => {
          const p = payload as unknown as MatchChangePayload
          if (p.eventType === 'DELETE') {
            setMatches((prev) => prev.filter((m) => m.id !== p.old.id))
          } else {
            setMatches((prev) => upsertSorted(prev, p.new as Match))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          setTournament(payload.new as Tournament)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [id])

  /** Optimistic match update. */
  const patchMatch = useCallback(async (matchId: string, patch: Partial<Match>) => {
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...patch } : m)))
    try {
      await updateMatch(matchId, patch)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // Auto-crown the champion once every match is finished. Runs reactively, so it
  // fires no matter which device scored the last point (realtime updates `matches`).
  useEffect(() => {
    if (!tournament || tournament.status === 'done') return
    if (!matches.length || !matches.every((m) => m.done)) return
    const champ = computeStandings(tournament.players, matches)[0]?.name ?? null
    setTournament((prev) => (prev ? { ...prev, status: 'done', champion: champ } : prev))
    updateTournament(tournament.id, { status: 'done', champion: champ }).catch((e) =>
      setError(e instanceof Error ? e.message : String(e))
    )
  }, [matches, tournament])

  return { tournament, matches, loading, error, patchMatch }
}
