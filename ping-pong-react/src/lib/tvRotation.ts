const SCENE_MS = 20_000

/** The scene on screen `elapsedMs` into the rotation. */
export function pickScene<Scene>(scenes: readonly Scene[], elapsedMs: number): Scene {
  return scenes[Math.floor(elapsedMs / SCENE_MS) % scenes.length]
}
