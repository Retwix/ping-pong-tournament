// Chaos Mode engine — the modifier pool and roll logic.
//
// See docs/chaos-mode.md. This module is pure and deterministic: all randomness
// is injected via an `Rng` so rolls can be unit-tested by seeding the source.
// UI strings ship in French (app convention); ids stay stable English snake_case.

/** Modifier flavour. Drives the emoji and the intensity deck it belongs to. */
export type ChaosTier = 'malus' | 'bonus' | 'neutral' | 'legendary'

/** Who a modifier hits — the "who" half of a roll. */
export type ChaosScope = 'both' | 'one' | 'targeted'

const TIER_EMOJI: Record<ChaosTier, string> = {
  malus: '😈',
  bonus: '😇',
  neutral: '🎲',
  legendary: '👑',
}

export interface ChaosModifier {
  /** Stable identifier, unique within the pool. */
  id: string
  /** French UI label. */
  label: string
  /** Tier emoji, derived from `tier`. */
  emoji: string
  tier: ChaosTier
  /** Scopes this modifier can legally take (the "who" roll picks among these). */
  scope: ChaosScope[]
}

/** Single-player modifier: hit a random player, or a targeted one. */
const ONE: ChaosScope[] = ['one', 'targeted']
/** Affects the whole table / both players. */
const BOTH: ChaosScope[] = ['both']
/** Flexible modifiers that can land on either. */
const ANY: ChaosScope[] = ['both', 'one', 'targeted']

function mod(id: string, label: string, tier: ChaosTier, scope: ChaosScope[]): ChaosModifier {
  return { id, label, tier, scope, emoji: TIER_EMOJI[tier] }
}

export const CHAOS_POOL: ChaosModifier[] = [
  // Grip & paddle
  mod('frying_pan', 'Poêle à frire', 'malus', ONE),
  mod('wrong_hand', 'Mauvaise main', 'malus', ANY),
  mod('pinch_grip', 'Prise à deux doigts', 'malus', ONE),
  mod('paddle_swap', 'Échange de raquettes', 'neutral', BOTH),
  mod('big_bat', 'Raquette géante', 'bonus', ONE),

  // Body & movement
  mod('one_legged', 'Sur une jambe', 'malus', ONE),
  mod('hand_on_head', 'Main sur la tête', 'malus', ONE),
  mod('sumo_stance', 'Position sumo', 'malus', BOTH),
  mod('spin_serve', 'Service tournant', 'malus', ONE),
  mod('switch_sides', 'Changement de côté', 'neutral', BOTH),
  mod('back_to_wall', 'Touche le mur', 'malus', ONE),

  // Vision & senses
  mod('blindfold_serve', 'Service à l’aveugle', 'malus', ONE),
  mod('one_eye', 'Un œil fermé', 'malus', ONE),
  mod('theme_song', 'Chanson thème', 'malus', ONE),
  mod('silent_assassin', 'Assassin silencieux', 'malus', BOTH),

  // Scoring & rules
  mod('double_points', 'Points doubles', 'bonus', BOTH),
  mod('steal', 'Vol de point', 'bonus', BOTH),
  mod('sudden_death', 'Mort subite', 'malus', BOTH),
  mod('mulligan', 'Mulligan', 'bonus', ONE),
  mod('backwards', 'Service inversé', 'neutral', BOTH),

  // Ball & serve
  mod('underhand_only', 'Service par en dessous', 'malus', ONE),
  mod('no_smashing', 'Pas de smash', 'malus', BOTH),
  mod('two_bounces', 'Deux rebonds', 'bonus', ONE),
  mod('wall_ball', 'Balle au mur', 'neutral', BOTH),
  mod('left_side_only', 'Côté gauche seulement', 'malus', ONE),

  // Pure spectacle
  mod('costume', 'Costume', 'neutral', ANY),
  mod('commentator', 'Commentateur', 'malus', ONE),
  mod('dance_break', 'Pause danse', 'malus', ONE),
  mod('crowd_power', 'Public déchaîné', 'bonus', BOTH),

  // Legendary
  mod('the_heist', 'Le Casse', 'legendary', BOTH),
  mod('wipeout', 'Remise à zéro', 'legendary', BOTH),
  mod('the_tithe', 'La Dîme', 'legendary', BOTH),
  mod('mirror_match', 'Match miroir', 'legendary', BOTH),
  mod('godmode', 'Mode Dieu', 'legendary', ONE),
  mod('the_veto', 'Le Veto', 'legendary', ONE),
  mod('double_agent', 'Agent double', 'legendary', ONE),
  mod('triple_threat', 'Triple menace', 'legendary', BOTH),
  mod('role_reversal', 'Inversion des rôles', 'legendary', BOTH),
  mod('the_gauntlet', 'Le Gant', 'legendary', BOTH),
  mod('kings_decree', 'Décret royal', 'legendary', BOTH),
  mod('sudden_death_duel', 'Duel à mort subite', 'legendary', BOTH),
]

// ---------- roll configuration & eligibility ----------

/** Which tiers are in the deck. `mild` drops penalties; `full` adds them. */
export type ChaosIntensity = 'mild' | 'full'

export interface ChaosConfig {
  intensity: ChaosIntensity
  /** Whether legendary modifiers can appear. */
  legendary: boolean
  /** Override the per-roll legendary probability (defaults to LEGENDARY_CHANCE). */
  legendaryChance?: number
}

/**
 * The modifiers eligible under a config. `mild` keeps only bonus + neutral;
 * `full` adds malus. Legendaries appear only when `legendary` is on, at either
 * intensity.
 */
export function eligiblePool(config: ChaosConfig, pool: ChaosModifier[] = CHAOS_POOL): ChaosModifier[] {
  return pool.filter((m) => {
    if (m.tier === 'legendary') return config.legendary
    if (m.tier === 'malus') return config.intensity === 'full'
    return true
  })
}

// ---------- rolling: what ----------

/** Random source returning a float in [0, 1). Inject for deterministic tests. */
export type Rng = () => number

/** Per-roll probability that a legendary drops (when legendaries are enabled). */
export const LEGENDARY_CHANCE = 0.05

/** Uniformly pick one element using a single rng draw. */
function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.min(Math.floor(rng() * arr.length), arr.length - 1)]
}

/**
 * Roll the "what": a modifier drawn from the eligible pool. Legendaries are
 * kept rare — rather than sitting in the uniform draw, they win their own
 * `LEGENDARY_CHANCE` coin flip first, otherwise a regular modifier is picked.
 *
 * rng draws: when legendaries are eligible, one draw decides legendary-vs-regular
 * and a second picks within the chosen bucket; otherwise a single draw picks a
 * regular.
 */
export function rollModifier(config: ChaosConfig, rng: Rng): ChaosModifier {
  const eligible = eligiblePool(config)
  const legendaries = eligible.filter((m) => m.tier === 'legendary')
  const regulars = eligible.filter((m) => m.tier !== 'legendary')
  const chance = config.legendaryChance ?? LEGENDARY_CHANCE
  const useLegendary = legendaries.length > 0 && rng() < chance
  const bucket = useLegendary || regulars.length === 0 ? legendaries : regulars
  return pick(bucket, rng)
}

// ---------- rolling: who ----------

/**
 * Target distribution for the "who" roll. Hitting both often keeps it feeling
 * fair; targeting adds the drama. Renormalized per modifier to its allowed
 * scopes, so a both-only modifier is always "both".
 */
export const SCOPE_WEIGHTS: Record<ChaosScope, number> = {
  both: 0.4,
  one: 0.3,
  targeted: 0.3,
}

/** Roll the "who": a scope among the modifier's allowed set, weighted. */
export function rollScope(modifier: ChaosModifier, rng: Rng): ChaosScope {
  const allowed = modifier.scope
  const total = allowed.reduce((sum, s) => sum + SCOPE_WEIGHTS[s], 0)
  let r = rng() * total
  for (const s of allowed) {
    r -= SCOPE_WEIGHTS[s]
    if (r < 0) return s
  }
  return allowed[allowed.length - 1]
}

// ---------- cadence & full roll ----------

/** Default roll cadence: a twist every 2 combined points. */
export const DEFAULT_CHAOS_INTERVAL = 2

/**
 * Whether a roll fires now. Rolls land on every positive multiple of the
 * interval of the *combined* score, and never at 0-0. An interval < 1 disables
 * rolling entirely.
 */
export function shouldRoll(combinedScore: number, interval: number): boolean {
  return interval >= 1 && combinedScore > 0 && combinedScore % interval === 0
}

/** The single modifier in effect until the next roll. No stacking by design. */
export interface ActiveModifier {
  modifier: ChaosModifier
  scope: ChaosScope
}

/**
 * Perform a full roll: pick the "what" then the "who". Each call is independent
 * and yields at most one active modifier, so applying its result replaces any
 * previous one (the no-stacking rule).
 */
export function rollChaos(config: ChaosConfig, rng: Rng): ActiveModifier {
  const modifier = rollModifier(config, rng)
  const scope = rollScope(modifier, rng)
  return { modifier, scope }
}

// ---------- persisted settings ----------

/**
 * Chaos configuration as stored per tournament. `enabled` and `interval` govern
 * whether/when rolls fire; `intensity` and `legendary` shape the deck.
 */
export interface ChaosSettings {
  enabled: boolean
  interval: number
  intensity: ChaosIntensity
  legendary: boolean
}

/** Off by default: a normal match never sees chaos unless it opts in. */
export const DEFAULT_CHAOS_SETTINGS: ChaosSettings = {
  enabled: false,
  interval: DEFAULT_CHAOS_INTERVAL,
  intensity: 'full',
  legendary: true,
}

/**
 * Coerce a loosely-typed record (e.g. a DB row from before the chaos columns
 * existed, where fields may be missing) into valid settings. Interval is floored
 * to an integer >= 1; intensity falls back to the default when unrecognised.
 */
export function normalizeChaosSettings(raw?: Partial<ChaosSettings> | null): ChaosSettings {
  const d = DEFAULT_CHAOS_SETTINGS
  if (!raw) return { ...d }
  const interval =
    typeof raw.interval === 'number' && Number.isFinite(raw.interval) && raw.interval >= 1
      ? Math.floor(raw.interval)
      : d.interval
  const intensity = raw.intensity === 'mild' || raw.intensity === 'full' ? raw.intensity : d.intensity
  return {
    enabled: raw.enabled ?? d.enabled,
    interval,
    intensity,
    legendary: raw.legendary ?? d.legendary,
  }
}

/** The subset of settings the roll functions consume. */
export function toChaosConfig(settings: ChaosSettings): ChaosConfig {
  return { intensity: settings.intensity, legendary: settings.legendary }
}

/** The chaos_* subset of a persisted tournament row. */
export interface ChaosRow {
  chaos_enabled?: boolean | null
  chaos_interval?: number | null
  chaos_intensity?: ChaosIntensity | null
  chaos_legendary?: boolean | null
}

/** Read a tournament row's chaos columns into normalized settings. */
export function chaosSettingsFromTournament(t: ChaosRow): ChaosSettings {
  return normalizeChaosSettings({
    enabled: t.chaos_enabled ?? undefined,
    interval: t.chaos_interval ?? undefined,
    intensity: t.chaos_intensity ?? undefined,
    legendary: t.chaos_legendary ?? undefined,
  })
}

/** Project settings onto the tournament chaos_* columns for persistence. */
export function chaosColumns(settings: ChaosSettings): Required<ChaosRow> {
  return {
    chaos_enabled: settings.enabled,
    chaos_interval: settings.interval,
    chaos_intensity: settings.intensity,
    chaos_legendary: settings.legendary,
  }
}

// ---------- deterministic, storage-free active modifier ----------

/** FNV-1a hash of the parts joined — a stable 32-bit seed. */
export function hashSeed(...parts: Array<string | number>): number {
  let h = 2166136261 >>> 0
  const str = parts.join('|')
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 PRNG — a small, fast, deterministic Rng from a 32-bit seed. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The modifier in effect at a given combined score — derived, not stored. Each
 * interval-block (points [k·X, (k+1)·X)) rolls once, seeded from the match id and
 * the block index, so the result is identical in the scorer, the spectator view,
 * and after a refresh, and undo falls out for free (it's a function of the score).
 * Returns null before the first roll (combined < X) or when chaos is off.
 */
export function activeChaosAt(
  matchId: string,
  combined: number,
  settings: ChaosSettings,
): ActiveModifier | null {
  if (!settings.enabled || settings.interval < 1) return null
  const block = Math.floor(combined / settings.interval)
  if (block < 1) return null
  const rng = seededRng(hashSeed(matchId, block))
  return rollChaos(toChaosConfig(settings), rng)
}
