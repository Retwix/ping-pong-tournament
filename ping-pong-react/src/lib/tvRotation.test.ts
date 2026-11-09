import { expect, test } from 'vitest'
import { pickScene } from './tvRotation'

const SEED = 1
const ORDER = ['race', 'form', 'results']

const sceneAt = (elapsedMs: number, seed = SEED) =>
  pickScene([['race'], ['form'], ['results']], elapsedMs, seed)

test.for([
  { at: 'the last moment of the first scene', elapsedMs: 19_999, step: 0 },
  { at: 'the 20th second', elapsedMs: 20_000, step: 1 },
  { at: 'the third scene', elapsedMs: 40_000, step: 2 },
  { at: 'the end of a full lap', elapsedMs: 60_000, step: 0 },
])('shows each scene for 20 seconds, in order from the first: $at', ({ elapsedMs, step }) => {
  const opener = ORDER.indexOf(sceneAt(0) ?? '')
  expect(sceneAt(elapsedMs)).toBe(ORDER[(opener + step) % ORDER.length])
})

test('a start opens on a scene drawn from its seed, so a reload need not open on the same one', () => {
  const openers = new Set(Array.from({ length: 30 }, (_, seed) => sceneAt(0, seed)))
  expect(openers).toEqual(new Set(ORDER))
})

test.for([1, 2, 3, 4])(
  'an opening scene with two headlines opens on either, among %i scenes',
  (count) => {
    const scenes = [['a', 'b'], ...Array.from({ length: count - 1 }, (_, i) => [`other ${i}`])]
    const openers = Array.from({ length: 60 }, (_, seed) => pickScene(scenes, 0, seed))
    expect(new Set(openers.filter((scene) => scene === 'a' || scene === 'b'))).toEqual(new Set(['a', 'b']))
  },
)

test.for(Array.from({ length: 30 }, (_, seed) => seed))(
  'a scene with nothing to say gives its turn to the others, from seed %i',
  (seed) => {
    const lap = [0, 20_000].map((elapsedMs) => pickScene([['race'], [], ['results']], elapsedMs, seed))
    expect(new Set(lap)).toEqual(new Set(['race', 'results']))
  },
)

test('nothing is on screen when no scene has anything to say', () => {
  expect(pickScene([[], []], 20_000, SEED)).toBeNull()
})
