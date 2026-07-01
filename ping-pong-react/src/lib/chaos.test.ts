import { describe, expect, it } from 'vitest'
import {
	CHAOS_POOL,
	eligiblePool,
	type ChaosConfig,
	type ChaosModifier,
} from './chaos'

const TIERS = ['malus', 'bonus', 'neutral', 'legendary'] as const
const SCOPES = ['both', 'one', 'targeted'] as const

describe('CHAOS_POOL integrity', () => {
	it('is non-empty', () => {
		expect(CHAOS_POOL.length).toBeGreaterThan(0)
	})

	it('has unique ids', () => {
		const ids = CHAOS_POOL.map((m) => m.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('every modifier has a valid tier and at least one valid scope', () => {
		for (const m of CHAOS_POOL) {
			expect(TIERS).toContain(m.tier)
			expect(m.scope.length).toBeGreaterThan(0)
			for (const s of m.scope) expect(SCOPES).toContain(s)
		}
	})

	it('every modifier has a non-empty French label and an emoji', () => {
		for (const m of CHAOS_POOL) {
			expect(m.label.trim().length).toBeGreaterThan(0)
			expect(m.emoji.length).toBeGreaterThan(0)
		}
	})

	it('contains at least one legendary modifier', () => {
		const legendaries = CHAOS_POOL.filter((m: ChaosModifier) => m.tier === 'legendary')
		expect(legendaries.length).toBeGreaterThan(0)
	})
})

describe('eligiblePool', () => {
	const tiers = (cfg: ChaosConfig) => new Set(eligiblePool(cfg).map((m) => m.tier))

	it('mild excludes malus and legendary, keeps bonus and neutral', () => {
		const t = tiers({ intensity: 'mild', legendary: false })
		expect(t.has('malus')).toBe(false)
		expect(t.has('legendary')).toBe(false)
		expect(t.has('bonus')).toBe(true)
		expect(t.has('neutral')).toBe(true)
	})

	it('full adds malus but still no legendary when legendary is off', () => {
		const t = tiers({ intensity: 'full', legendary: false })
		expect(t.has('malus')).toBe(true)
		expect(t.has('legendary')).toBe(false)
	})

	it('legendary flag adds the legendary tier', () => {
		expect(tiers({ intensity: 'full', legendary: true }).has('legendary')).toBe(true)
		expect(tiers({ intensity: 'mild', legendary: true }).has('legendary')).toBe(true)
	})

	it('mild + legendary still excludes malus', () => {
		expect(tiers({ intensity: 'mild', legendary: true }).has('malus')).toBe(false)
	})

	it('returns a subset of the full pool', () => {
		const ids = new Set(CHAOS_POOL.map((m) => m.id))
		for (const m of eligiblePool({ intensity: 'full', legendary: true })) {
			expect(ids.has(m.id)).toBe(true)
		}
	})
})

import { rollModifier, LEGENDARY_CHANCE } from './chaos'

/** rng that yields the given numbers in order, then repeats. */
function seq(...xs: number[]): () => number {
	let i = 0
	return () => xs[i++ % xs.length]
}

/** Deterministic LCG in [0,1) for statistical checks. */
function lcg(seed: number): () => number {
	let s = seed >>> 0
	return () => {
		s = (1664525 * s + 1013904223) >>> 0
		return s / 0x100000000
	}
}

describe('rollModifier', () => {
	const mild: ChaosConfig = { intensity: 'mild', legendary: false }
	const full: ChaosConfig = { intensity: 'full', legendary: true }

	it('always returns a member of the eligible pool', () => {
		const rng = lcg(42)
		const ids = new Set(eligiblePool(full).map((m) => m.id))
		for (let i = 0; i < 200; i++) expect(ids.has(rollModifier(full, rng).id)).toBe(true)
	})

	it('is deterministic for a given rng sequence', () => {
		const a = rollModifier(full, seq(0.5, 0.5))
		const b = rollModifier(full, seq(0.5, 0.5))
		expect(a.id).toBe(b.id)
	})

	it('never yields a legendary when legendaries are off', () => {
		for (let i = 0; i < 50; i++) {
			expect(rollModifier(mild, seq(i / 50)).tier).not.toBe('legendary')
		}
	})

	it('a low first draw selects the legendary bucket', () => {
		const m = rollModifier(full, seq(LEGENDARY_CHANCE / 2, 0))
		expect(m.tier).toBe('legendary')
	})

	it('a high first draw selects a regular modifier', () => {
		const m = rollModifier(full, seq(0.99, 0))
		expect(m.tier).not.toBe('legendary')
	})

	it('legendaries land roughly LEGENDARY_CHANCE of the time', () => {
		const rng = lcg(7)
		let legendary = 0
		const N = 20000
		for (let i = 0; i < N; i++) if (rollModifier(full, rng).tier === 'legendary') legendary++
		const rate = legendary / N
		expect(rate).toBeGreaterThan(LEGENDARY_CHANCE - 0.02)
		expect(rate).toBeLessThan(LEGENDARY_CHANCE + 0.02)
	})
})

import { rollScope, SCOPE_WEIGHTS } from './chaos'

const get = (id: string): ChaosModifier => {
	const m = CHAOS_POOL.find((x) => x.id === id)
	if (!m) throw new Error(`no modifier ${id}`)
	return m
}

describe('rollScope', () => {
	it('a both-only modifier is always "both"', () => {
		const m = get('double_points') // scope ['both']
		for (let i = 0; i < 20; i++) expect(rollScope(m, seq(i / 20))).toBe('both')
	})

	it('always returns one of the modifier\'s allowed scopes', () => {
		const rng = lcg(11)
		for (const m of CHAOS_POOL) {
			for (let i = 0; i < 20; i++) expect(m.scope).toContain(rollScope(m, rng))
		}
	})

	it('a single-player modifier splits between one and targeted', () => {
		const m = get('frying_pan') // scope ['one','targeted'], equal weight
		expect(rollScope(m, seq(0.1))).toBe('one')
		expect(rollScope(m, seq(0.9))).toBe('targeted')
	})

	it('a flexible modifier honours the 40/30/30 weighting order', () => {
		const m = get('wrong_hand') // scope ['both','one','targeted'], total weight = 1
		expect(rollScope(m, seq(0.1))).toBe('both')
		expect(rollScope(m, seq(0.5))).toBe('one')
		expect(rollScope(m, seq(0.85))).toBe('targeted')
	})

	it('flexible modifiers approximate the target distribution', () => {
		const m = get('wrong_hand')
		const rng = lcg(3)
		const counts: Record<string, number> = { both: 0, one: 0, targeted: 0 }
		const N = 30000
		for (let i = 0; i < N; i++) counts[rollScope(m, rng)]++
		expect(counts.both / N).toBeCloseTo(SCOPE_WEIGHTS.both, 1)
		expect(counts.one / N).toBeCloseTo(SCOPE_WEIGHTS.one, 1)
		expect(counts.targeted / N).toBeCloseTo(SCOPE_WEIGHTS.targeted, 1)
	})
})
