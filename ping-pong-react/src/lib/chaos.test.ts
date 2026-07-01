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
