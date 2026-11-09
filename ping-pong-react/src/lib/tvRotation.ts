export const SCENE_MS = 20_000

const scramble = (h: number, multiplier: number, shift: number) =>
  Math.imul(h ^ (h >>> shift), multiplier)

const hash = (n: number) => {
  const mixed = scramble(scramble(n | 0, 0x85ebca6b, 16), 0xc2b2ae35, 13)
  return (mixed ^ (mixed >>> 16)) >>> 0
}

const shuffled = (count: number, round: number, seed: number) =>
  Array.from({ length: count }, (_, i) => ({ i, key: hash(hash(hash(seed) ^ round) ^ i) }))
    .sort((a, b) => a.key - b.key)
    .map(({ i }) => i)

/** Each variant once per round of draws, in a seeded order that never repeats across a round's edge. */
export function drawVariant(count: number, draw: number, seed: number): number {
  if (count < 2) return 0
  if (count === 2) return (draw + hash(seed)) % 2
  const round = Math.floor(draw / count)
  const order = shuffled(count, round, seed)
  const previous = round > 0 ? shuffled(count, round - 1, seed)[count - 1] : -1
  const [first, second, ...rest] = order
  const settled = first === previous ? [second, first, ...rest] : order
  return settled[draw % count]
}

/** The scene on screen `elapsedMs` into the rotation, opening on a scene drawn from `seed`, one variant drawn per loop, stepping past those to `avoid` when another is left; an empty scene has nothing to say. */
export function pickScene<Scene>(
  scenes: readonly (readonly Scene[])[],
  elapsedMs: number,
  seed: number,
  avoid: (scene: Scene) => boolean = () => false,
): Scene | null {
  const speaking = scenes.filter((variants) => variants.length > 0)
  if (speaking.length === 0) return null
  const turn = Math.floor(elapsedMs / SCENE_MS) + hash(hash(seed))
  const variants = speaking[turn % speaking.length]
  const drawn = drawVariant(variants.length, Math.floor(turn / speaking.length), seed)
  const fresh = variants
    .map((_, i) => variants[(drawn + i) % variants.length])
    .find((scene) => !avoid(scene))
  return fresh ?? variants[drawn]
}
