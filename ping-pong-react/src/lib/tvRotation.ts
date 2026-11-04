const SCENE_MS = 20_000

/** The scene on screen `elapsedMs` into the rotation; a null scene has nothing to say. */
export function pickScene<Scene>(
  scenes: readonly (Scene | null)[],
  elapsedMs: number,
): Scene | null {
  const speaking = scenes.filter((scene) => scene !== null)
  return speaking[Math.floor(elapsedMs / SCENE_MS) % speaking.length] ?? null
}
