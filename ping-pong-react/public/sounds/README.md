# Sounds

Audio cues served as-is by Vite (files in `public/` are copied to the build root
untouched, so no import and no rebuild of the code is needed to swap one).

| File            | Played when                                                  |
| --------------- | ------------------------------------------------------------ |
| `six-seven.mp3` | The live scorer reaches **6-7** (or 7-6) in an ongoing game.  |

Drop the file in with exactly that name and it starts playing — nothing to wire
up. Until it exists, the cue is a silent no-op (the browser's 404 is caught in
`src/lib/sound.ts`). Keep it short (~1-2 s) and quiet: it plays over a live
match, and playback volume is already scaled down to 70%.
