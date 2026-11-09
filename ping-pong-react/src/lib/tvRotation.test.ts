import { expect, test } from 'vitest'
import { pickScene } from './tvRotation'

const SEED = 1

test.for([
  { at: 'the start', elapsedMs: 0, scene: 'race' },
  { at: 'the last moment of the first scene', elapsedMs: 19_999, scene: 'race' },
  { at: 'the 20th second', elapsedMs: 20_000, scene: 'form' },
  { at: 'the last scene', elapsedMs: 40_000, scene: 'results' },
  { at: 'the end of a full lap', elapsedMs: 60_000, scene: 'race' },
])('shows each scene for 20 seconds, in order: $at', ({ elapsedMs, scene }) => {
  expect(pickScene([['race'], ['form'], ['results']], elapsedMs, SEED)).toBe(scene)
})

test('a scene with nothing to say gives its turn to the next one', () => {
  expect(pickScene([['race'], [], ['results']], 20_000, SEED)).toBe('results')
})

test('nothing is on screen when no scene has anything to say', () => {
  expect(pickScene([[], []], 20_000, SEED)).toBeNull()
})
