import { expect, test } from 'vitest'
import { pickScene } from './tvRotation'

test.for([
  { at: 'the start', elapsedMs: 0, scene: 'race' },
  { at: 'the last moment of the first scene', elapsedMs: 19_999, scene: 'race' },
  { at: 'the 20th second', elapsedMs: 20_000, scene: 'form' },
  { at: 'the last scene', elapsedMs: 40_000, scene: 'results' },
  { at: 'the end of a full lap', elapsedMs: 60_000, scene: 'race' },
])('shows each scene for 20 seconds, in order: $at', ({ elapsedMs, scene }) => {
  expect(pickScene(['race', 'form', 'results'], elapsedMs)).toBe(scene)
})
