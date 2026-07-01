import { describe, expect, it } from 'vitest'
import { CHAOS_POOL, type ChaosModifier } from './chaos'

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
