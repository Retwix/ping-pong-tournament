import type { Match } from '../types'

/**
 * Pure helpers backing the realtime sync in `useTournament`. Extracted so the
 * tricky reconciliation logic (echo suppression, retries, refetch merging) can be
 * unit-tested without a React/Supabase harness.
 */

/** The subset of a match we track per pending optimistic write. */
export interface PendingValue {
	score_a: number
	score_b: number
	done: boolean
}

/** Insert or replace `row` in `list`, keeping it sorted by `idx`. */
export function upsertSorted(list: Match[], row: Match): Match[] {
	const next = list.some((m) => m.id === row.id)
		? list.map((m) => (m.id === row.id ? row : m))
		: [...list, row]
	return next.sort((a, b) => a.idx - b.idx)
}

/**
 * Does an incoming realtime row match the value we optimistically wrote and are
 * still waiting to see echoed back? Only then should we stop suppressing echoes
 * for that match.
 */
export function echoMatchesPending(pending: PendingValue, row: Match): boolean {
	return (
		pending.score_a === row.score_a &&
		pending.score_b === row.score_b &&
		pending.done === row.done
	)
}

/**
 * Decide what to do with an incoming realtime row given our pending write, if any.
 *  - no pending            -> 'apply' (genuine remote change or our settled write)
 *  - pending, echo matches -> 'settle' (our write landed; clear pending + apply)
 *  - pending, doesn't match -> 'ignore' (stale intermediate echo of our own write)
 */
export function reconcileEcho(
	pending: PendingValue | undefined,
	row: Match
): 'apply' | 'settle' | 'ignore' {
	if (!pending) return 'apply'
	return echoMatchesPending(pending, row) ? 'settle' : 'ignore'
}

/**
 * Merge a fresh DB fetch with any still-pending optimistic writes, so a refetch
 * (reconnect / poll / tab focus) never visually rolls back a tap the referee has
 * made but that hasn't been confirmed yet.
 */
export function mergeWithPending(
	rows: Match[],
	pending: Map<string, PendingValue>
): Match[] {
	if (!pending.size) return rows
	return rows.map((row) => {
		const p = pending.get(row.id)
		return p
			? { ...row, score_a: p.score_a, score_b: p.score_b, done: p.done }
			: row
	})
}

/**
 * Run `fn`, retrying a few times with exponential backoff before giving up, so a
 * single transient network blip on a second device doesn't strand a score write.
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	attempts = 3,
	baseDelayMs = 250,
	sleep: (ms: number) => Promise<void> = (ms) =>
		new Promise((r) => setTimeout(r, ms))
): Promise<T> {
	let lastErr: unknown
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn()
		} catch (e) {
			lastErr = e
			if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i)
		}
	}
	throw lastErr
}
