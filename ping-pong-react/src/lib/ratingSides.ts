import type { MatchRatings, SideRating } from '../hooks/useRatingDeltas'

/**
 * The winning and losing side of a finished match, picked out of its two rating
 * moves. Either can be null until the rating replay has caught up with the result.
 *
 * Lives here rather than beside its types in the useRatingDeltas hook so it can be
 * tested without importing that hook's Supabase-backed dependency chain — the type
 * import above is erased at runtime.
 */
export function winnerLoserRatings(rd: MatchRatings): {
  winner: SideRating | null
  loser: SideRating | null
} {
  const winner = rd.a?.won ? rd.a : rd.b?.won ? rd.b : null
  const loser = rd.a && !rd.a.won ? rd.a : rd.b && !rd.b.won ? rd.b : null
  return { winner, loser }
}
