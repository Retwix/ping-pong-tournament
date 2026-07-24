import { useCallback, useMemo } from 'react'
import { sideKey } from '../lib/stats'
import { sideElos, type SideElos } from '../lib/scorerElo'
import type { Match } from '../types'
import { useRatings, type RatingEvent } from './useRatings'

/** One side's rating move for a finished match, plus its current ladder standing. */
export interface SideRating {
  key: string
  name: string
  delta: number
  ratingBefore: number
  ratingAfter: number
  won: boolean
  stakes: RatingEvent['stakes']
  /** Current leaderboard rank/provisional state (from the global replay). */
  rank: number | null
  provisional: boolean
}

export interface MatchRatings {
  a: SideRating | null
  b: SideRating | null
}

/** A player's net rating change across a whole tournament. */
export interface TournamentRating {
  key: string
  name: string
  startRating: number
  endRating: number
  netDelta: number
  games: number
  rank: number | null
  provisional: boolean
}

const EMPTY: MatchRatings = { a: null, b: null }

/**
 * Looks up the Glicko-2 rating change a finished match produced for each side.
 *
 * Ratings are a single global ladder replayed from *all* history, so this leans
 * on `useRatings` (full replay + realtime) rather than re-deriving from one
 * tournament — a tournament-scoped replay would produce wrong numbers. Sides are
 * matched by stable identity (`playerId ?? name:<name>`), the same key the engine
 * uses, so renames and name collisions don't misattribute a delta.
 *
 * The event for a just-validated match only exists once the write has propagated
 * back through realtime, so `forMatch` returns nulls for a beat after validation;
 * callers should treat a null side as "not ready yet" and render nothing.
 */
export function useRatingDeltas() {
  const { events, rows, loading } = useRatings()

  // Current ladder Elo for each side of a match (referee scorer name pills).
  const elosFor = useCallback(
    (match: Match | null | undefined): SideElos =>
      match ? sideElos(rows, match) : { a: null, b: null },
    [rows],
  )

  // Events grouped by match, and rank/provisional keyed by ladder identity.
  const byMatch = useMemo(() => {
    const m = new Map<string, RatingEvent[]>()
    for (const e of events) {
      const arr = m.get(e.matchId)
      if (arr) arr.push(e)
      else m.set(e.matchId, [e])
    }
    return m
  }, [events])

  const standingByKey = useMemo(() => {
    const m = new Map<string, { rank: number; provisional: boolean }>()
    for (const r of rows) m.set(r.key, { rank: r.rank, provisional: r.provisional })
    return m
  }, [rows])

  const forMatch = useCallback(
    (match: Match | null | undefined): MatchRatings => {
      if (!match) return EMPTY
      const evs = byMatch.get(match.id)
      if (!evs || !evs.length) return EMPTY

      const keyA = sideKey(match.player_a_id, match.player_a)
      const keyB = sideKey(match.player_b_id, match.player_b)

      const toSide = (e: RatingEvent): SideRating => {
        const s = standingByKey.get(e.key)
        return {
          key: e.key,
          name: e.name,
          delta: e.delta,
          ratingBefore: e.ratingBefore,
          ratingAfter: e.ratingAfter,
          won: e.won,
          stakes: e.stakes,
          rank: s?.rank ?? null,
          provisional: s?.provisional ?? false,
        }
      }

      // Prefer an exact identity match; fall back to the win/loss flag so a
      // legacy match without ids still lands the delta on the right side.
      const aWon = match.score_a > match.score_b
      const evA = evs.find((e) => e.key === keyA) ?? evs.find((e) => e.won === aWon) ?? null
      const evB = evs.find((e) => e.key === keyB) ?? evs.find((e) => e.won === !aWon) ?? null

      return { a: evA ? toSide(evA) : null, b: evB ? toSide(evB) : null }
    },
    [byMatch, standingByKey],
  )

  const forTournament = useCallback(
    (tournamentMatches: Match[]): TournamentRating[] => {
      const ids = new Set(tournamentMatches.map((m) => m.id))
      // `events` are in replay (chronological) order, so the first event we see
      // for a player is their entry rating and the last is their exit rating.
      const acc = new Map<string, TournamentRating>()
      for (const e of events) {
        if (!ids.has(e.matchId)) continue
        const cur = acc.get(e.key)
        if (cur) {
          cur.name = e.name
          cur.endRating = e.ratingAfter
          cur.netDelta = e.ratingAfter - cur.startRating
          cur.games += 1
        } else {
          const s = standingByKey.get(e.key)
          acc.set(e.key, {
            key: e.key,
            name: e.name,
            startRating: e.ratingBefore,
            endRating: e.ratingAfter,
            netDelta: e.ratingAfter - e.ratingBefore,
            games: 1,
            rank: s?.rank ?? null,
            provisional: s?.provisional ?? false,
          })
        }
      }
      // Biggest climbers first; ties broken by exit rating.
      return [...acc.values()].sort(
        (a, b) => b.netDelta - a.netDelta || b.endRating - a.endRating,
      )
    },
    [events, standingByKey],
  )

  return { forMatch, forTournament, elosFor, rows, loading }
}
