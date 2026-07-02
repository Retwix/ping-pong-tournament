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

import { chaosColumns } from './chaos'

describe('chaosColumns', () => {
	it('maps settings onto the chaos_* db columns', () => {
		expect(
			chaosColumns({ enabled: true, interval: 3, intensity: 'full', legendary: true }),
		).toEqual({
			chaos_enabled: true,
			chaos_interval: 3,
			chaos_intensity: 'full',
			chaos_legendary: true,
		})
	})

	it('round-trips through chaosSettingsFromTournament', () => {
		const s: ChaosSettings = { enabled: true, interval: 1, intensity: 'mild', legendary: false }
		expect(chaosSettingsFromTournament(chaosColumns(s))).toEqual(s)
	})
})

import { hashSeed, seededRng, activeChaosAt } from './chaos'

describe('seededRng / hashSeed', () => {
	it('is deterministic for a given seed', () => {
		const a = seededRng(hashSeed('m1', 3))
		const b = seededRng(hashSeed('m1', 3))
		expect([a(), a(), a()]).toEqual([b(), b(), b()])
	})

	it('yields values in [0,1)', () => {
		const r = seededRng(hashSeed('x', 1))
		for (let i = 0; i < 100; i++) {
			const v = r()
			expect(v).toBeGreaterThanOrEqual(0)
			expect(v).toBeLessThan(1)
		}
	})

	it('different seeds diverge', () => {
		expect(seededRng(hashSeed('m1', 1))()).not.toBe(seededRng(hashSeed('m2', 1))())
	})
})

describe('activeChaosAt', () => {
	const on: ChaosSettings = { enabled: true, interval: 2, intensity: 'full', legendary: true }

	it('is null when chaos is disabled', () => {
		const off: ChaosSettings = { ...on, enabled: false }
		expect(activeChaosAt('m', 10, off)).toBeNull()
	})

	it('is null before the first roll point', () => {
		expect(activeChaosAt('m', 0, on)).toBeNull()
		expect(activeChaosAt('m', 1, on)).toBeNull()
	})

	it('produces a legal modifier from the first roll onward', () => {
		const active = activeChaosAt('m', 2, on)!
		expect(active).not.toBeNull()
		expect(CHAOS_POOL).toContainEqual(active.modifier)
		expect(active.modifier.scope).toContain(active.scope)
	})

	it('is stable within an interval block and re-rolls at the boundary', () => {
		const at2 = activeChaosAt('match-1', 2, on)!
		const at3 = activeChaosAt('match-1', 3, on)!
		const at4 = activeChaosAt('match-1', 4, on)!
		expect(at2).toEqual(at3) // same block → same modifier
		// block changes at 4; over the pool this virtually always differs
		expect(at4).not.toEqual(at2)
	})

	it('is deterministic and independent per match id', () => {
		expect(activeChaosAt('m', 6, on)).toEqual(activeChaosAt('m', 6, on))
	})
})

import { chaosWho, resolveChaosTarget } from './chaos'

describe('chaosWho / resolveChaosTarget', () => {
	const ctx = (over: Partial<Parameters<typeof chaosWho>[1]> = {}) => ({
		matchId: 'm',
		combined: 4,
		interval: 2,
		nameA: 'Alice',
		nameB: 'Bob',
		scoreA: 0,
		scoreB: 0,
		...over,
	})
	const both = { modifier: get('double_points'), scope: 'both' as const }
	const targeted = { modifier: get('frying_pan'), scope: 'targeted' as const }
	const one = { modifier: get('frying_pan'), scope: 'one' as const }

	it('labels a both-scope modifier for both players', () => {
		expect(chaosWho(both, ctx())).toBe('Les deux joueurs')
		expect(resolveChaosTarget(both, ctx())).toBe('both')
	})

	it('targets the current leader', () => {
		expect(chaosWho(targeted, ctx({ scoreA: 5, scoreB: 2 }))).toBe('Alice')
		expect(chaosWho(targeted, ctx({ scoreA: 2, scoreB: 5 }))).toBe('Bob')
	})

	it('picks a single player deterministically for one-scope', () => {
		const a = chaosWho(one, ctx())
		const b = chaosWho(one, ctx())
		expect(['Alice', 'Bob']).toContain(a)
		expect(a).toBe(b)
	})
})

import {
	applyScoreMutation,
	isScoreMutating,
	SCORE_MUTATORS,
	type Score,
} from './chaos'

describe('score mutations', () => {
	it('The Heist swaps the two scores', () => {
		expect(applyScoreMutation('the_heist', { a: 3, b: 7 })).toEqual({ a: 7, b: 3 })
	})

	it('Wipeout resets both scores to zero', () => {
		expect(applyScoreMutation('wipeout', { a: 5, b: 9 })).toEqual({ a: 0, b: 0 })
	})

	it('Mirror Match sets both scores to the lower one', () => {
		expect(applyScoreMutation('mirror_match', { a: 7, b: 3 })).toEqual({ a: 3, b: 3 })
		expect(applyScoreMutation('mirror_match', { a: 2, b: 8 })).toEqual({ a: 2, b: 2 })
	})

	it('returns null for a non-mutating modifier', () => {
		expect(applyScoreMutation('double_points', { a: 1, b: 1 })).toBeNull()
		expect(applyScoreMutation('frying_pan', { a: 1, b: 1 })).toBeNull()
	})

	it('isScoreMutating flags exactly the score-changing modifiers', () => {
		const mut = (id: string) => isScoreMutating(get(id))
		expect(mut('the_heist')).toBe(true)
		expect(mut('wipeout')).toBe(true)
		expect(mut('mirror_match')).toBe(true)
		expect(mut('double_points')).toBe(false)
		expect(mut('godmode')).toBe(false)
	})

	it('does not mutate its input', () => {
		const input: Score = { a: 4, b: 1 }
		applyScoreMutation('the_heist', input)
		expect(input).toEqual({ a: 4, b: 1 })
	})

	it('every SCORE_MUTATORS key is a real legendary modifier', () => {
		for (const id of Object.keys(SCORE_MUTATORS)) {
			const m = CHAOS_POOL.find((x) => x.id === id)
			expect(m?.tier).toBe('legendary')
		}
	})
})
