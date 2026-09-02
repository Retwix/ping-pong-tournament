import { useCallback, useEffect, useMemo, useState } from 'react'
import { listAllDoneMatches, listPlayers, listTournaments, recomputeRatings } from '../lib/db'
import {
  rankRatings,
  ratedMatches,
  replayRatings,
  type RatingRow,
  type RatingEvent,
} from '../lib/rating'
import { ladderOf, seasonLadders } from '../lib/seasonReplay'
import { ALL_TIME, type LadderScope } from '../lib/seasons'
import { supabase } from '../lib/supabase'
import { uniqueChannelName } from '../lib/realtimeChannel'
import type { Match, Player, Tournament } from '../types'

/**
 * The Glicko-2 leaderboard. Loads finished matches + the player registry, then
 * derives ratings in-memory by replaying history (same engine that the stored
 * values are persisted from, so the view is always current). Stays live via
 * realtime. `recompute` lets the view force a re-persist of stored ratings.
 *
 * A `scope` narrows the ladder to one season. Everything downstream is unchanged:
 * the engine sees a shorter history, so every player's first game of the season
 * finds no previous state and starts from RATING.R0 — the seasonal reset is the
 * absence of data, not a rule.
 *
 * `rows` and `events` always describe the ladder in scope. `historyEvents` is the
 * other question — what every match ever played did to the ladder it was played
 * on — which is what a match result, a tournament recap or a career record should
 * read; see seasonReplay.ts.
 */
export function useRatings(scope: LadderScope = ALL_TIME) {
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [ms, ps, ts] = await Promise.all([
        listAllDoneMatches(),
        listPlayers(),
        listTournaments(),
      ])
      setMatches(ms)
      setPlayers(ps)
      setTournaments(ts)
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
      .channel(uniqueChannelName('ratings-live'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  // Depend on the id, not the scope object: a fresh literal of the same value
  // would otherwise re-run the whole replay on every render.
  const seasonId = scope.kind === 'season' ? scope.id : null

  // Every season's ladder, each replayed from 1500. A season scope reads its
  // window straight out of here, so scoping costs no extra replay.
  const ladders = useMemo(
    () => seasonLadders(matches, players, tournaments),
    [matches, players, tournaments],
  )

  const { rows, events } = useMemo(() => {
    const result =
      seasonId === null
        ? replayRatings(ratedMatches(matches, tournaments), players, {
            targetByTournament: new Map(tournaments.map((t) => [t.id, t.target])),
          })
        : ladderOf(ladders, seasonId)
    return { rows: rankRatings(result, players), events: result.events }
  }, [ladders, matches, players, tournaments, seasonId])

  const recompute = useCallback(async () => {
    try {
      await recomputeRatings()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return {
    rows,
    events,
    historyEvents: ladders.events,
    matches,
    players,
    tournaments,
    matchCount: matches.length,
    loading,
    error,
    reload: refresh,
    recompute,
  }
}

export type { RatingRow, RatingEvent }
