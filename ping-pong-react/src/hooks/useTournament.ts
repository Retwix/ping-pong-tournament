import { useCallback, useEffect, useRef, useState } from 'react'
import { getMatches, getTournament, updateMatch, updateTournament } from '../lib/db'
import { supabase } from '../lib/supabase'
import { postSlackResult } from '../lib/slack'
import { computeStandings } from '../lib/pingpong'
import type { Match, Tournament } from '../types'

interface MatchChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Match | Record<string, never>
  old: Partial<Match>
}

interface PendingValue {
  score_a: number
  score_b: number
  done: boolean
}

function upsertSorted(list: Match[], row: Match): Match[] {
  const next = list.some((m) => m.id === row.id)
    ? list.map((m) => (m.id === row.id ? row : m))
    : [...list, row]
  return next.sort((a, b) => a.idx - b.idx)
}

/**
 * Loads one tournament + its matches and keeps them live via Supabase realtime.
 *
 * Mutations are optimistic. To avoid the "increment / revert / increment" flicker
 * when scoring fast, we remember the latest value we wrote per match and ignore
 * realtime echoes that don't match it yet — those are stale intermediate echoes of
 * our own writes. Genuine remote changes flow through once our write has settled.
 */
export function useTournament(id: string | null) {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Latest state read of `matches` (for computing optimistic merges synchronously).
  const matchesRef = useRef<Match[]>([])
  matchesRef.current = matches

  // matchId -> the latest value we optimistically wrote, awaiting its own echo.
  const pendingRef = useRef<Map<string, PendingValue>>(new Map())
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const clearPending = useCallback((mid: string) => {
    pendingRef.current.delete(mid)
    const t = pendingTimers.current.get(mid)
    if (t) {
      clearTimeout(t)
      pendingTimers.current.delete(mid)
    }
  }, [])

  const markPending = useCallback(
    (mid: string, value: PendingValue) => {
      pendingRef.current.set(mid, value)
      const existing = pendingTimers.current.get(mid)
      if (existing) clearTimeout(existing)
      // Self-heal: if the matching echo never arrives, stop ignoring after a bit.
      pendingTimers.current.set(
        mid,
        setTimeout(() => clearPending(mid), 4000)
      )
    },
    [clearPending]
  )

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
            const delId = p.old.id
            if (delId) clearPending(delId)
            setMatches((prev) => prev.filter((m) => m.id !== delId))
            return
          }

          const row = p.new as Match
          const pending = pendingRef.current.get(row.id)
          if (pending) {
            const matchesPending =
              pending.score_a === row.score_a &&
              pending.score_b === row.score_b &&
              pending.done === row.done
            if (matchesPending) {
              // Our latest write echoed back — settle and apply.
              clearPending(row.id)
            } else {
              // Stale intermediate echo of our own write — ignore to avoid flicker.
              return
            }
          }
          setMatches((prev) => upsertSorted(prev, row))
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
      pendingTimers.current.forEach((t) => clearTimeout(t))
      pendingTimers.current.clear()
      pendingRef.current.clear()
    }
  }, [id, clearPending])

  /** Optimistic match update with echo reconciliation. */
  const patchMatch = useCallback(
    async (matchId: string, patch: Partial<Match>) => {
      const cur = matchesRef.current.find((m) => m.id === matchId)
      if (cur) {
        const merged = { ...cur, ...patch }
        markPending(matchId, {
          score_a: merged.score_a,
          score_b: merged.score_b,
          done: merged.done,
        })
      }
      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...patch } : m)))
      try {
        await updateMatch(matchId, patch)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [markPending]
  )

  // Auto-crown the champion once every match is finished. Runs reactively, so it
  // fires no matter which device scored the last point (realtime updates `matches`).
  useEffect(() => {
    if (!tournament || tournament.status === 'done') return
    if (!matches.length || !matches.every((m) => m.done)) return
    const champ = computeStandings(tournament.players, matches)[0]?.name ?? null
    setTournament((prev) => (prev ? { ...prev, status: 'done', champion: champ } : prev))
    updateTournament(tournament.id, { status: 'done', champion: champ })
      .then(() => {
        // Post final standings into the Slack invitation thread (no-op unless
        // configured; the Edge Function dedupes so multiple devices are fine).
        void postSlackResult(tournament.id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [matches, tournament])

  return { tournament, matches, loading, error, patchMatch }
}
