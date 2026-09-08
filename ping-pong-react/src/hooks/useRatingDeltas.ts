import { useCallback, useMemo } from 'react'
import { ladderReplay, scopedEvents } from '../lib/ladder'
import { defaultLadderScope } from '../lib/seasons'
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
  /** Where the player stands right now, on the ladder being played. */
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
 * A rating move is a whole ladder's arithmetic, so this leans on `useRatings`
 * (full replay + realtime) rather than re-deriving from one tournament — a
 * tournament-scoped replay would produce wrong numbers. Sides are
 * matched by stable identity (`playerId ?? name:<name>`), the same key the engine
 * uses, so renames and name collisions don't misattribute a delta.
 *
 * The event for a just-validated match only exists once the write has propagated
 * back through realtime, so `forMatch` returns nulls for a beat after validation;
 * callers should treat a null side as "not ready yet" and render nothing.
 */
export function useRatingDeltas() {
  const { matches: allMatches, players, tournaments, loading } = useRatings()

  // Two ladders, deliberately. Where a player *stands* is the ladder being
  // played — the one « Le classement » opens on — so a pill here and a row
  // there can never show the same player two ratings. How far a result *moved*
  // them is still read from the lifetime replay below.
  const now = useMemo(() => new Date(), [])
  const { rows } = useMemo(
    () => ladderReplay(defaultLadderScope(now), { matches: allMatches, players, tournaments }),
    [now, allMatches, players, tournaments],
  )

  // Season-ladder Elo for each side of a match (referee scorer name pills).
  const elosFor = useCallback(
    (match: Match | null | undefined): SideElos =>
      match ? sideElos(rows, match) : { a: null, b: null },
    [rows],
  )

  // Every move, read off the ladder that produced it — the match's own season,
  // or the lifetime ladder for anything played before September.
  const events = useMemo(
    () => scopedEvents({ matches: allMatches, players, tournaments }),
    [allMatches, players, tournaments],
  )

  const byMatch = useMemo(() => {
    const m = new Map<string, RatingEvent[]>()
    for (const e of events) {
      const found = m.get(e.matchId)
      if (found) found.push(e)
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
      // The net move accumulates the deltas rather than differencing those two:
      // a tournament running through midnight on 30 November is played half on
      // one ladder and half on the next, and only the sum survives that.
      const acc = new Map<string, TournamentRating>()
      for (const e of events) {
        if (!ids.has(e.matchId)) continue
        const cur = acc.get(e.key)
        if (cur) {
          cur.name = e.name
          cur.endRating = e.ratingAfter
          cur.netDelta += e.delta
          cur.games += 1
        } else {
          const s = standingByKey.get(e.key)
          acc.set(e.key, {
            key: e.key,
            name: e.name,
            startRating: e.ratingBefore,
            endRating: e.ratingAfter,
            netDelta: e.delta,
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
