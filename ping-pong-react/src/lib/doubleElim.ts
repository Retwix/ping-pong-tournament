import { BYE, TBD } from '../types'
import type { Bracket, Match, MatchSide } from '../types'
import { shuffle } from './roundRobin'

/**
 * Double-elimination bracket engine (single grand final, no bracket reset).
 *
 * The bracket is a fixed graph of match "nodes" wired by winner/loser pointers.
 * Players flow through it: the winner of a match advances along `win_to`, the
 * loser drops along `lose_to`. Byes (when the player count isn't a power of two)
 * are modelled as a BYE pseudo-player that auto-loses any real matchup.
 *
 * Two halves:
 *  - `buildDoubleElim(players)` produces the rows to insert at creation time.
 *  - `reconcileBracket(matches)` is a pure function that, given the current
 *    matches, computes the slot fills / walkovers / champion implied by the
 *    finished games. The UI runs it whenever matches change, so advancement is
 *    declarative and self-healing (reloads and multi-device updates converge).
 */

// ---------- structure ----------

interface MatchNode {
  key: string
  bracket: Bracket
  /** Round within the bracket (W: 1..R, L: 1..2R-2, GF: 1). */
  round: number
  /** Position within the round. */
  pos: number
  win_to: string | null
  win_slot: MatchSide | null
  lose_to: string | null
  lose_slot: MatchSide | null
}

/** Smallest power of two >= n (min 2). */
export function nextPow2(n: number): number {
  let p = 2
  while (p < n) p *= 2
  return p
}

/** Number of games actually played in a single-GF double elimination of n players. */
export function doubleElimMatchCount(n: number): number {
  return Math.max(0, 2 * n - 2)
}

/** Minimum players for a sensible double-elimination bracket. */
export const MIN_DE_PLAYERS = 3

const slot = (i: number): MatchSide => (i % 2 === 0 ? 'a' : 'b')

/**
 * Standard seeding slot order for a P-slot single-elimination bracket: returns
 * an array where entry k is the seed number (1-based) that belongs in slot k.
 * Built by the usual mirror-expansion so seed 1 meets the lowest seeds latest.
 */
function seedSlots(p: number): number[] {
  let seeds = [1, 2]
  while (seeds.length < p) {
    const n2 = seeds.length * 2
    const next: number[] = []
    for (const s of seeds) {
      next.push(s)
      next.push(n2 + 1 - s)
    }
    seeds = next
  }
  return seeds
}

/** Build the full wired graph of bracket nodes for a power-of-two size P. */
function buildStructure(p: number): MatchNode[] {
  const R = Math.log2(p)
  const nodes: MatchNode[] = []

  // ----- winners bracket -----
  for (let r = 1; r <= R; r++) {
    const count = p / 2 ** r
    for (let i = 0; i < count; i++) {
      const win_to = r < R ? `W${r + 1}-${Math.floor(i / 2)}` : 'GF'
      const win_slot: MatchSide = r < R ? slot(i) : 'a'
      // Losers drop into the losers bracket. Round 1 losers seed L1; later WB
      // round k losers feed LB round 2(k-1) (reversed to reduce early rematches).
      let lose_to: string
      let lose_slot: MatchSide
      if (r === 1) {
        lose_to = `L1-${Math.floor(i / 2)}`
        lose_slot = slot(i)
      } else {
        const lbr = 2 * (r - 1)
        lose_to = `L${lbr}-${count - 1 - i}`
        lose_slot = 'b'
      }
      nodes.push({ key: `W${r}-${i}`, bracket: 'W', round: r, pos: i, win_to, win_slot, lose_to, lose_slot })
    }
  }

  // ----- losers bracket -----
  const lbRounds = 2 * (R - 1)
  for (let lbr = 1; lbr <= lbRounds; lbr++) {
    let count: number
    if (lbr === 1) count = p / 4
    else if (lbr % 2 === 0) count = p / 2 ** (lbr / 2 + 1) // major: meets WB dropdowns
    else count = nodes.filter((n) => n.bracket === 'L' && n.round === lbr - 1).length / 2 // minor

    for (let i = 0; i < count; i++) {
      let win_to: string
      let win_slot: MatchSide
      if (lbr === lbRounds) {
        win_to = 'GF'
        win_slot = 'b'
      } else if (lbr % 2 === 1) {
        // minor round -> next (major) round, same count, fill the LB-survivor slot
        win_to = `L${lbr + 1}-${i}`
        win_slot = 'a'
      } else {
        // major round -> next (minor) round, halving
        win_to = `L${lbr + 1}-${Math.floor(i / 2)}`
        win_slot = slot(i)
      }
      nodes.push({
        key: `L${lbr}-${i}`,
        bracket: 'L',
        round: lbr,
        pos: i,
        win_to,
        win_slot,
        lose_to: null,
        lose_slot: null,
      })
    }
  }

  // ----- grand final -----
  nodes.push({
    key: 'GF',
    bracket: 'GF',
    round: 1,
    pos: 0,
    win_to: null,
    win_slot: null,
    lose_to: null,
    lose_slot: null,
  })

  return nodes
}

const BRACKET_ORDER: Record<Bracket, number> = { W: 0, L: 1, GF: 2 }

/** A match row ready to be persisted (db layer adds ids, defaults, tournament_id). */
export interface GenMatchRow {
  round: number
  idx: number
  player_a: string
  player_b: string
  bracket: Bracket
  match_key: string
  win_to: string | null
  win_slot: MatchSide | null
  lose_to: string | null
  lose_slot: MatchSide | null
}

/**
 * Build the matches to insert for a double-elimination tournament. Players are
 * seeded (shuffled) into the winners bracket; byes are resolved up-front where
 * possible, so walkovers that are fully determined at creation are never stored.
 * Matches still awaiting a real opponent (incl. those with a pending BYE) are
 * inserted and resolved at runtime by `reconcileBracket`.
 */
export function buildDoubleElim(players: string[]): GenMatchRow[] {
  const order = shuffle(players)
  const n = order.length
  const p = nextPow2(n)
  const nodes = buildStructure(p)

  // slot[key] = { a, b } where each value is a real name, BYE, or TBD.
  const slots = new Map<string, { a: string; b: string }>()
  for (const node of nodes) slots.set(node.key, { a: TBD, b: TBD })

  // Seed winners-bracket round 1 from the standard seed order.
  const order2 = seedSlots(p) // seedOrder[slotIndex] = seed number (1-based)
  const seedToPlayer = (seed: number): string => (seed <= n ? order[seed - 1] : BYE)
  const w1 = nodes.filter((node) => node.bracket === 'W' && node.round === 1).sort((a, b) => a.pos - b.pos)
  w1.forEach((node, i) => {
    slots.get(node.key)!.a = seedToPlayer(order2[i * 2])
    slots.get(node.key)!.b = seedToPlayer(order2[i * 2 + 1])
  })

  const setSlot = (key: string | null, side: MatchSide | null, value: string) => {
    if (!key || !side) return
    const s = slots.get(key)
    if (s && s[side] === TBD) s[side] = value
  }

  // Resolve byes to a fixed point: any match with no TBD and at least one BYE is
  // a walkover whose result is already known, so push its winner/loser onward.
  const consumed = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const node of nodes) {
      if (consumed.has(node.key)) continue
      const s = slots.get(node.key)!
      if (s.a === TBD || s.b === TBD) continue
      const aBye = s.a === BYE
      const bBye = s.b === BYE
      if (!aBye && !bBye) continue // real vs real -> a genuine match, leave it
      // walkover (or bye vs bye): determine the survivor and route both sides
      const winner = aBye ? s.b : s.a // if both BYE this is BYE, which is fine
      const loser = aBye ? s.a : s.b === BYE ? s.b : s.a === BYE ? s.a : s.b
      setSlot(node.win_to, node.win_slot, winner)
      setSlot(node.lose_to, node.lose_slot, loser === winner ? BYE : loser)
      consumed.add(node.key)
      changed = true
    }
  }

  // Emit every non-consumed node as a real/pending match, ordered for display.
  const live = nodes
    .filter((node) => !consumed.has(node.key))
    .sort((a, b) =>
      BRACKET_ORDER[a.bracket] !== BRACKET_ORDER[b.bracket]
        ? BRACKET_ORDER[a.bracket] - BRACKET_ORDER[b.bracket]
        : a.round !== b.round
          ? a.round - b.round
          : a.pos - b.pos
    )

  return live.map((node, idx) => {
    const s = slots.get(node.key)!
    return {
      round: node.round,
      idx,
      player_a: s.a,
      player_b: s.b,
      bracket: node.bracket,
      match_key: node.key,
      win_to: node.win_to,
      win_slot: node.win_slot,
      lose_to: node.lose_to,
      lose_slot: node.lose_slot,
    }
  })
}

// ---------- runtime advancement ----------

export interface BracketWrite {
  id: string
  patch: Partial<Match>
}

export interface ReconcileResult {
  writes: BracketWrite[]
  champion: string | null
}

interface Work {
  player_a: string
  player_b: string
  player_a_id: string | null
  player_b_id: string | null
  done: boolean
  bye: boolean
  score_a: number
  score_b: number
  ended_at: string | null
}

const isReal = (name: string) => name !== TBD && name !== BYE

/** A match the user can actually open and score right now. */
export function isPlayable(m: Match): boolean {
  return !m.done && isReal(m.player_a) && isReal(m.player_b)
}

/**
 * Pure advancement: given the current matches, return the writes needed to push
 * finished results forward, auto-complete walkovers, and crown the champion.
 * Only fills slots that are still TBD, so it is idempotent and convergent.
 */
export function reconcileBracket(matches: Match[]): ReconcileResult {
  // Mutable working copy keyed by match id.
  const work = new Map<string, Work>()
  for (const m of matches) {
    work.set(m.id, {
      player_a: m.player_a,
      player_b: m.player_b,
      player_a_id: m.player_a_id,
      player_b_id: m.player_b_id,
      done: m.done,
      bye: m.bye,
      score_a: m.score_a,
      score_b: m.score_b,
      ended_at: m.ended_at,
    })
  }
  const keyToId = new Map<string, string>()
  for (const m of matches) if (m.match_key) keyToId.set(m.match_key, m.id)

  const fill = (key: string | null, side: MatchSide | null, name: string, id: string | null): boolean => {
    if (!key || !side) return false
    const tid = keyToId.get(key)
    if (!tid) return false
    const w = work.get(tid)!
    const cur = side === 'a' ? w.player_a : w.player_b
    if (cur !== TBD) return false // already resolved
    if (side === 'a') {
      w.player_a = name
      w.player_a_id = id
    } else {
      w.player_b = name
      w.player_b_id = id
    }
    return true
  }

  let champion: string | null = null
  let changed = true
  while (changed) {
    changed = false

    // 1) Auto-complete ready walkovers (both sides known, exactly one is BYE).
    for (const m of matches) {
      const w = work.get(m.id)!
      if (w.done) continue
      const a = w.player_a
      const b = w.player_b
      if (a === TBD || b === TBD) continue
      const aBye = a === BYE
      const bBye = b === BYE
      if (!aBye && !bBye) continue
      w.done = true
      w.bye = true
      // Winner is the non-BYE side (or BYE if somehow both); give it the point.
      if (!aBye) {
        w.score_a = 1
        w.score_b = 0
      } else {
        w.score_a = 0
        w.score_b = 1
      }
      w.ended_at = w.ended_at ?? new Date().toISOString()
      changed = true
    }

    // 2) Propagate finished matches (real or walkover) to their targets.
    for (const m of matches) {
      const w = work.get(m.id)!
      if (!w.done) continue
      const aWon = w.score_a > w.score_b
      const winName = aWon ? w.player_a : w.player_b
      const winId = aWon ? w.player_a_id : w.player_b_id
      const loseName = aWon ? w.player_b : w.player_a
      const loseId = aWon ? w.player_b_id : w.player_a_id
      if (m.win_to) {
        if (fill(m.win_to, m.win_slot, winName, winId)) changed = true
      } else if (!w.bye && isReal(winName)) {
        // No win_to -> grand final. Its winner is the champion.
        champion = winName
      }
      if (m.lose_to) {
        if (fill(m.lose_to, m.lose_slot, loseName, loseId)) changed = true
      }
    }
  }

  // Diff working copy against the originals to produce minimal patches.
  const writes: BracketWrite[] = []
  for (const m of matches) {
    const w = work.get(m.id)!
    const patch: Partial<Match> = {}
    if (w.player_a !== m.player_a) patch.player_a = w.player_a
    if (w.player_b !== m.player_b) patch.player_b = w.player_b
    if (w.player_a_id !== m.player_a_id) patch.player_a_id = w.player_a_id
    if (w.player_b_id !== m.player_b_id) patch.player_b_id = w.player_b_id
    if (w.done !== m.done) patch.done = w.done
    if (w.bye !== m.bye) patch.bye = w.bye
    if (w.score_a !== m.score_a) patch.score_a = w.score_a
    if (w.score_b !== m.score_b) patch.score_b = w.score_b
    if (w.ended_at !== m.ended_at) patch.ended_at = w.ended_at
    if (Object.keys(patch).length) writes.push({ id: m.id, patch })
  }

  return { writes, champion }
}

// ---------- display helpers ----------

export interface PodiumRow {
  rank: number
  name: string
}

/** Champion / runner-up / third from a finished (or in-progress) double-elim. */
export function bracketPodium(matches: Match[]): PodiumRow[] {
  const gf = matches.find((m) => m.bracket === 'GF')
  const rows: PodiumRow[] = []
  if (gf && gf.done && !gf.bye) {
    const aWon = gf.score_a > gf.score_b
    rows.push({ rank: 1, name: aWon ? gf.player_a : gf.player_b })
    rows.push({ rank: 2, name: aWon ? gf.player_b : gf.player_a })
  }
  // Third place: the loser of the last losers-bracket round (it feeds GF slot b).
  const lbFinal = matches
    .filter((m) => m.bracket === 'L' && m.done && !m.bye)
    .sort((a, b) => b.round - a.round)[0]
  if (lbFinal) {
    const loser = lbFinal.score_a > lbFinal.score_b ? lbFinal.player_b : lbFinal.player_a
    if (isReal(loser)) rows.push({ rank: 3, name: loser })
  }
  return rows
}

/** Human label for a bracket round, used by the list view. */
export function roundLabel(bracket: Bracket, round: number, maxW: number, maxL: number): string {
  if (bracket === 'GF') return 'Grande finale'
  if (bracket === 'W') {
    if (round === maxW) return 'Finale gagnants'
    if (round === maxW - 1) return 'Demi-finale gagnants'
    return `Gagnants · tour ${round}`
  }
  if (round === maxL) return 'Finale perdants'
  return `Perdants · tour ${round}`
}
