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
