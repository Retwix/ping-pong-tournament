/**
 * The most recent tournaments/games to surface on the dashboard. The source
 * list is already ordered newest-first (created_at desc), so the newest entries
 * are simply the leading `limit`. Returns a new array — never mutates the input.
 */
export function recentTournaments<T>(tournaments: readonly T[], limit = 10): T[] {
  return tournaments.slice(0, limit)
}
