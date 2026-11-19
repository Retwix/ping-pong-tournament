import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteMatch,
  endKingSession,
  getMatches,
  getTournament,
  recomputeRatings,
  updateMatch,
  updateTournament,
} from '../lib/db'
import { supabase } from '../lib/supabase'
import { watchTournament } from '../lib/tournamentChannel'
import { postSlackResult } from '../lib/slack'
import { computeStandings } from '../lib/pingpong'
import { finishedSets, postsToSlack } from '../lib/sets'
import { crownsWhenAllMatchesDone, type Rotation } from '../lib/king'
import { reconcileBracket } from '../lib/doubleElim'
import {
  mergeWithPending,
  reconcileEcho,
  upsertSorted,
  withRetry,
  type PendingValue,
} from '../lib/realtimeSync'
import type { Match, Tournament } from '../types'

// How often to refetch as a safety net against a silently dropped realtime event.
const POLL_MS = 15000

/**
 * Loads one tournament + its matches and keeps them live via Supabase realtime.
 *
 * Mutations are optimistic. To avoid the "increment / revert / increment" flicker
 * when scoring fast, we remember the latest value we wrote per match and ignore
 * realtime echoes that don't match it yet — those are stale intermediate echoes of
 * our own writes. Genuine remote changes flow through once our write has settled.
 *
 * Writes are retried and rolled back on failure, and the live data self-heals from
 * a refetch on reconnect / tab focus / a slow poll — so a dropped realtime event
 * or a flaky second device can't leave the scoreboard permanently stale.
 */
export function useTournament(id: string | null) {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Latest state read of `matches` (for computing optimistic merges synchronously).
  const matchesRef = useRef<Match[]>([])
  matchesRef.current = matches
  const tournamentRef = useRef<Tournament | null>(null)
  tournamentRef.current = tournament

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
        setTimeout(() => clearPending(mid), 4000),
      )
    },
    [clearPending],
  )

  // Refetch tournament + matches from the DB and merge, preserving any pending
  // optimistic writes. Used on (re)subscribe, tab focus, and the slow poll to
  // recover from any realtime event we missed while the socket was down.
  const reload = useCallback(async () => {
    if (!id) return
    try {
      const [t, ms] = await Promise.all([getTournament(id), getMatches(id)])
      setTournament(t)
      setMatches(mergeWithPending(ms, pendingRef.current))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [id])

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

    const channel = watchTournament(id, {
      onMatch: (row) => {
        const decision = reconcileEcho(pendingRef.current.get(row.id), row)
        // Stale intermediate echo of our own write — ignore to avoid flicker.
        if (decision === 'ignore') return
        // Our latest write echoed back — settle so genuine remote updates flow.
        if (decision === 'settle') clearPending(row.id)
        setMatches((prev) => upsertSorted(prev, row))
      },
      onMatchGone: (delId) => {
        clearPending(delId)
        setMatches((prev) => prev.filter((m) => m.id !== delId))
      },
      onTournament: setTournament,
      onTournamentGone: () => void reload(),
      onSubscribed: () => void reload(),
    })

    // Safety net: realtime can silently drop an event under load, and mobile tabs
    // stop receiving while backgrounded. Refetch when the tab regains focus and on
    // a slow poll so a stale live view always self-heals.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void reload()
    }, POLL_MS)

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(poll)
      pendingTimers.current.forEach((t) => clearTimeout(t))
      pendingTimers.current.clear()
      pendingRef.current.clear()
    }
  }, [id, clearPending, reload])

  /** Optimistic match update with retry, echo reconciliation, and rollback. */
  const patchMatch = useCallback(
    async (matchId: string, patch: Partial<Match>) => {
      const cur = matchesRef.current.find((m) => m.id === matchId)
      if (!cur) return
      // Snapshot only the keys we're about to change, so a rollback restores
      // exactly those without clobbering an unrelated concurrent update.
      const rollback: Partial<Match> = {}
      for (const k of Object.keys(patch) as (keyof Match)[]) {
        rollback[k] = cur[k] as never
      }
      const merged = { ...cur, ...patch }
      markPending(matchId, {
        score_a: merged.score_a,
        score_b: merged.score_b,
        done: merged.done,
        sets: finishedSets(merged),
      })
      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...patch } : m)))
      try {
        await withRetry(() => updateMatch(matchId, patch))
        setError(null)
        // A finished match changes ratings: refresh the stored Glicko-2 state.
        // Fire-and-forget — the Classement view recomputes in-memory regardless.
        if (patch.done) {
          recomputeRatings().catch((e) => console.error('recomputeRatings failed', e))
        }
      } catch (e) {
        // The write failed for good. Roll the optimistic change back so this
        // device matches the DB (and the live view), and stop suppressing echoes
        // for this match so genuine remote updates flow again.
        clearPending(matchId)
        setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...rollback } : m)))
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [markPending, clearPending],
  )

  const writeTournament = useCallback(
    async (patch: Partial<Tournament>, rollback: (before: Tournament) => Partial<Tournament>) => {
      const cur = tournamentRef.current
      if (!cur) return
      setTournament((prev) => (prev ? { ...prev, ...patch } : prev))
      try {
        await withRetry(() => updateTournament(cur.id, patch))
        setError(null)
      } catch (e) {
        setTournament((prev) => (prev ? { ...prev, ...rollback(cur) } : prev))
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [],
  )

  /** King of the Ping: write the new rotation optimistically, with retry and rollback. */
  const setRotation = useCallback(
    (rotation: Rotation) => writeTournament({ players: [...rotation] }, (before) => ({ players: before.players })),
    [writeTournament],
  )

  /** King of the Ping: « Terminer » closes the session optimistically, crowning `champion`; with no champion it never happened, so it goes. */
  const endSession = useCallback(
    (champion: string | null) => {
      const cur = tournamentRef.current
      if (champion === null && cur) {
        return endKingSession(cur.id, null).catch((e) => console.error('endKingSession failed', e))
      }
      return writeTournament({ status: 'done', champion }, (before) => ({
        status: before.status,
        champion: before.champion,
      }))
    },
    [writeTournament],
  )

  /** King of the Ping: someone leaving the table abandons the game; its match goes and the rotation moves on. */
  const abandonGame = useCallback(
    async (gameId: string, rotation: Rotation) => {
      const game = matchesRef.current.find((m) => m.id === gameId)
      const before = tournamentRef.current
      if (!game || !before) return
      setMatches((prev) => prev.filter((m) => m.id !== gameId))
      setTournament((prev) => (prev ? { ...prev, players: [...rotation] } : prev))
      try {
        await withRetry(() => deleteMatch(gameId))
      } catch (e) {
        setMatches((prev) => upsertSorted(prev, game))
        setTournament((prev) => (prev ? { ...prev, players: before.players } : prev))
        setError(e instanceof Error ? e.message : String(e))
        return
      }
      await writeTournament({ players: [...rotation] }, () => ({ players: before.players }))
    },
    [writeTournament],
  )

  // Double-elimination advancement. Whenever matches change, reconcile the
  // bracket: fill slots that just resolved, auto-complete walkovers, and crown
  // the grand-final winner. `reconcileBracket` only writes still-pending slots,
  // so this is idempotent and converges (and self-heals after reloads).
  const reconcilingRef = useRef(false)
  useEffect(() => {
    if (!tournament || tournament.format !== 'double_elim') return
    if (reconcilingRef.current || !matches.length) return

    const { writes, champion } = reconcileBracket(matches)

    if (writes.length) {
      reconcilingRef.current = true
      // Optimistically apply so the UI advances immediately.
      setMatches((prev) =>
        prev.map((m) => {
          const w = writes.find((x) => x.id === m.id)
          return w ? { ...m, ...w.patch } : m
        }),
      )
      ;(async () => {
        try {
          await Promise.all(writes.map((w) => withRetry(() => updateMatch(w.id, w.patch))))
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        } finally {
          reconcilingRef.current = false
        }
      })()
      return
    }

    if (champion && tournament.status !== 'done') {
      setTournament((prev) => (prev ? { ...prev, status: 'done', champion } : prev))
      updateTournament(tournament.id, { status: 'done', champion })
        .then(() => {
          if (postsToSlack(tournament)) void postSlackResult(tournament.id)
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    }
  }, [matches, tournament])

  // Auto-crown the champion once every match is finished (round-robin parties
  // only: see crownsWhenAllMatchesDone).
  useEffect(() => {
    if (!tournament || tournament.status === 'done') return
    if (!crownsWhenAllMatchesDone(tournament)) return
    if (!matches.length || !matches.every((m) => m.done)) return
    const champ = computeStandings(tournament.players, matches)[0]?.name ?? null
    setTournament((prev) => (prev ? { ...prev, status: 'done', champion: champ } : prev))
    updateTournament(tournament.id, { status: 'done', champion: champ })
      .then(() => {
        // Post final standings into the Slack invitation thread (no-op unless
        // configured; the Edge Function dedupes so multiple devices are fine).
        if (postsToSlack(tournament)) void postSlackResult(tournament.id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [matches, tournament])

  return { tournament, matches, loading, error, patchMatch, setRotation, endSession, abandonGame, reload }
}
