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

import {
	rollChaos,
	shouldRoll,
	DEFAULT_CHAOS_INTERVAL,
	type ActiveModifier,
} from './chaos'

describe('shouldRoll (cadence)', () => {
	it('does not roll at the start of the game', () => {
		expect(shouldRoll(0, 2)).toBe(false)
	})

	it('rolls on every multiple of the interval', () => {
		expect(shouldRoll(2, 2)).toBe(true)
		expect(shouldRoll(3, 2)).toBe(false)
		expect(shouldRoll(4, 2)).toBe(true)
		expect(shouldRoll(6, 3)).toBe(true)
		expect(shouldRoll(7, 3)).toBe(false)
	})

	it('interval of 1 (Mayhem) rolls every point', () => {
		expect(shouldRoll(0, 1)).toBe(false)
		expect(shouldRoll(1, 1)).toBe(true)
		expect(shouldRoll(5, 1)).toBe(true)
	})

	it('a non-positive interval never rolls', () => {
		expect(shouldRoll(4, 0)).toBe(false)
		expect(shouldRoll(4, -2)).toBe(false)
	})

	it('exposes a sane default interval', () => {
		expect(DEFAULT_CHAOS_INTERVAL).toBe(2)
	})
})

describe('rollChaos', () => {
	const full: ChaosConfig = { intensity: 'full', legendary: true }

	it('returns exactly one modifier with a legal scope (no stacking)', () => {
		const rng = lcg(99)
		for (let i = 0; i < 200; i++) {
			const active: ActiveModifier = rollChaos(full, rng)
			expect(CHAOS_POOL).toContainEqual(active.modifier)
			expect(active.modifier.scope).toContain(active.scope)
		}
	})

	it('is deterministic for a given rng sequence', () => {
		const a = rollChaos(full, seq(0.5, 0.5, 0.5))
		const b = rollChaos(full, seq(0.5, 0.5, 0.5))
		expect(a).toEqual(b)
	})
})

import {
	DEFAULT_CHAOS_SETTINGS,
	normalizeChaosSettings,
	toChaosConfig,
	type ChaosSettings,
} from './chaos'

describe('normalizeChaosSettings', () => {
	it('returns the defaults for nullish or empty input', () => {
		expect(normalizeChaosSettings()).toEqual(DEFAULT_CHAOS_SETTINGS)
		expect(normalizeChaosSettings(null)).toEqual(DEFAULT_CHAOS_SETTINGS)
		expect(normalizeChaosSettings({})).toEqual(DEFAULT_CHAOS_SETTINGS)
	})

	it('defaults are chaos-off with a sane interval', () => {
		expect(DEFAULT_CHAOS_SETTINGS.enabled).toBe(false)
		expect(DEFAULT_CHAOS_SETTINGS.interval).toBe(DEFAULT_CHAOS_INTERVAL)
	})

	it('clamps the interval to an integer >= 1', () => {
		expect(normalizeChaosSettings({ interval: 0 }).interval).toBe(DEFAULT_CHAOS_INTERVAL)
		expect(normalizeChaosSettings({ interval: -3 }).interval).toBe(DEFAULT_CHAOS_INTERVAL)
		expect(normalizeChaosSettings({ interval: Number.NaN }).interval).toBe(DEFAULT_CHAOS_INTERVAL)
		expect(normalizeChaosSettings({ interval: 1 }).interval).toBe(1)
		expect(normalizeChaosSettings({ interval: 2.9 }).interval).toBe(2)
	})

	it('validates intensity, falling back to the default', () => {
		expect(normalizeChaosSettings({ intensity: 'mild' }).intensity).toBe('mild')
		expect(normalizeChaosSettings({ intensity: 'full' }).intensity).toBe('full')
		// @ts-expect-error invalid intensity is coerced
		expect(normalizeChaosSettings({ intensity: 'wild' }).intensity).toBe(DEFAULT_CHAOS_SETTINGS.intensity)
	})

	it('respects explicit boolean flags', () => {
		expect(normalizeChaosSettings({ enabled: true }).enabled).toBe(true)
		expect(normalizeChaosSettings({ legendary: false }).legendary).toBe(false)
	})
})

describe('toChaosConfig', () => {
	it('projects settings onto the roll config', () => {
		const s: ChaosSettings = { enabled: true, interval: 3, intensity: 'mild', legendary: false }
		expect(toChaosConfig(s)).toEqual({ intensity: 'mild', legendary: false })
	})
})

import { chaosSettingsFromTournament } from './chaos'

describe('chaosSettingsFromTournament', () => {
	it('reads the chaos_* columns into settings', () => {
		const s = chaosSettingsFromTournament({
			chaos_enabled: true,
			chaos_interval: 1,
			chaos_intensity: 'mild',
			chaos_legendary: false,
		})
		expect(s).toEqual({ enabled: true, interval: 1, intensity: 'mild', legendary: false })
	})

	it('falls back to defaults for a pre-migration row (missing columns)', () => {
		expect(chaosSettingsFromTournament({})).toEqual(DEFAULT_CHAOS_SETTINGS)
	})

	it('treats null columns as unset', () => {
		const s = chaosSettingsFromTournament({
			chaos_enabled: null,
			chaos_interval: null,
			chaos_intensity: null,
			chaos_legendary: null,
		})
		expect(s).toEqual(DEFAULT_CHAOS_SETTINGS)
	})

	it('normalizes a bad interval from the row', () => {
		expect(chaosSettingsFromTournament({ chaos_enabled: true, chaos_interval: 0 }).interval).toBe(
			DEFAULT_CHAOS_INTERVAL,
		)
	})
})
