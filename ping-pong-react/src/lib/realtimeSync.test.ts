import { describe, expect, it, vi } from 'vitest'
import {
	echoMatchesPending,
	mergeWithPending,
	reconcileEcho,
	upsertSorted,
	withRetry,
	type PendingValue,
} from './realtimeSync'
import type { Match } from '../types'

/** Minimal Match factory — only the fields the sync helpers touch matter here. */
function m(over: Partial<Match> & { id: string; idx: number }): Match {
	return {
		tournament_id: 't1',
		player_a: 'A',
		player_b: 'B',
		player_a_id: null,
		player_b_id: null,
		round: 1,
		score_a: 0,
		score_b: 0,
		done: false,
		serve_start: 'a',
		started_at: null,
		ended_at: null,
		mb_saved_a: 0,
		mb_saved_b: 0,
		bracket: null,
		match_key: null,
		win_to: null,
		win_slot: null,
		lose_to: null,
		lose_slot: null,
		bye: false,
		...over,
	} as Match
}

describe('upsertSorted', () => {
	it('replaces an existing row and keeps sort by idx', () => {
		const list = [m({ id: 'a', idx: 0 }), m({ id: 'b', idx: 1 })]
		const out = upsertSorted(list, m({ id: 'b', idx: 1, score_a: 5 }))
		expect(out.map((x) => x.id)).toEqual(['a', 'b'])
		expect(out.find((x) => x.id === 'b')!.score_a).toBe(5)
	})

	it('inserts a new row in idx order', () => {
		const list = [m({ id: 'a', idx: 0 }), m({ id: 'c', idx: 2 })]
		const out = upsertSorted(list, m({ id: 'b', idx: 1 }))
		expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c'])
	})
})

describe('echoMatchesPending / reconcileEcho', () => {
	const pending: PendingValue = { score_a: 3, score_b: 2, done: false }

	it('matches only when score + done all agree', () => {
		expect(echoMatchesPending(pending, m({ id: 'x', idx: 0, score_a: 3, score_b: 2 }))).toBe(true)
		expect(echoMatchesPending(pending, m({ id: 'x', idx: 0, score_a: 2, score_b: 2 }))).toBe(false)
	})

	it('applies a remote change when nothing is pending', () => {
		expect(reconcileEcho(undefined, m({ id: 'x', idx: 0, score_a: 9 }))).toBe('apply')
	})

	it('settles when our own write echoes back', () => {
		expect(reconcileEcho(pending, m({ id: 'x', idx: 0, score_a: 3, score_b: 2 }))).toBe('settle')
	})

	it('ignores a stale intermediate echo of our own write', () => {
		// We are at 3-2 pending; a stale 1-2 echo of an earlier tap must not flicker.
		expect(reconcileEcho(pending, m({ id: 'x', idx: 0, score_a: 1, score_b: 2 }))).toBe('ignore')
	})
})

describe('mergeWithPending', () => {
	it('returns rows unchanged when nothing is pending', () => {
		const rows = [m({ id: 'a', idx: 0, score_a: 1 })]
		expect(mergeWithPending(rows, new Map())).toEqual(rows)
	})

	it('preserves an unconfirmed optimistic tap over a stale DB refetch', () => {
		// DB still says 4-4, but the ref has locally tapped to 5-4 (pending).
		const rows = [m({ id: 'a', idx: 0, score_a: 4, score_b: 4 })]
		const pending = new Map<string, PendingValue>([['a', { score_a: 5, score_b: 4, done: false }]])
		const out = mergeWithPending(rows, pending)
		expect(out[0].score_a).toBe(5)
		expect(out[0].score_b).toBe(4)
	})
})

describe('withRetry', () => {
	it('returns the value on first success without sleeping', async () => {
		const sleep = vi.fn(async () => {})
		const out = await withRetry(async () => 42, 3, 1, sleep)
		expect(out).toBe(42)
		expect(sleep).not.toHaveBeenCalled()
	})

	it('retries a transient failure then succeeds', async () => {
		const sleep = vi.fn(async () => {})
		let calls = 0
		const out = await withRetry(
			async () => {
				calls++
				if (calls < 3) throw new Error('blip')
				return 'ok'
			},
			3,
			1,
			sleep
		)
		expect(out).toBe('ok')
		expect(calls).toBe(3)
		expect(sleep).toHaveBeenCalledTimes(2)
	})

	it('throws the last error after exhausting attempts', async () => {
		const sleep = vi.fn(async () => {})
		let calls = 0
		await expect(
			withRetry(
				async () => {
					calls++
					throw new Error(`fail ${calls}`)
				},
				3,
				1,
				sleep
			)
		).rejects.toThrow('fail 3')
		expect(calls).toBe(3)
	})
})
