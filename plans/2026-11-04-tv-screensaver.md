# Plan: TV screensaver

**Branch**: screen-saver
**Status**: Active. Decisions confirmed on 2026-11-04, design approved, no app code yet.
**Design**: [Écran TV Ping-Pong](https://claude.ai/artifact/VtXSk5gsHD4531R5pPsXid), second row. Read the boards with the Artifact tool: `project/Mix.dc.html`, `project/Forme.dc.html`, `project/Resultats.dc.html`, `project/Rivalites.dc.html`. The top row is superseded exploration. The mocks were never seen rendered, so check them on screen.

## Goal

`/tv` runs on the office TV: it rotates four scenes on real data between games, and the live scoreboard takes over during a game.

## Context

- `/live` already suits a TV: stable link, no sign-in, follows the active game in real time. Reads are public.
- A game only stops being active when a new one is created (`src/lib/db.ts:179`), so `/live` stays on the last result between games. The « Aucun match en cours » placeholder only appears if that game is deleted. Read from the code, not observed on a real screen.
- Local dev hits production Supabase; screenshot components rather than creating games.

## Decisions

1. **Main job: a mix.** Make people play, show the app's life, and look good on the wall.
2. **Device: not settled.** Possibly a laptop over HDMI or casting. Animate only `transform` and `opacity`.
3. **Own link: `/tv`.** `/live` stays unchanged.
4. **Takeover from game creation.** The TV switches when a game is created and shows the existing « next up » card with the Elo stakes, then the scoreboard. It returns to the screensaver 2 minutes after the final result, or after 10 minutes with no activity, which also covers abandoned games and tournament pauses.
5. **Four scenes, 20 seconds each, fixed order:** season race, form of the week, latest results, rivalries and records.
6. **Full personality.** Real names, photos and capots, same as the app.
7. **Silent, dark backgrounds, slow motion against burn-in.** The page reloads itself on a new build. No night mode in the app.
8. **Always moving.** Something moves throughout each scene, kept minimal.
9. **Each scene has its own background and animation.** The clock, logo and progress bar are the common thread.

   | Scene | Background | Animation |
   |---|---|---|
   | Course de la saison | Purple table | Ball rallies across the net and lands beside the players in the story |
   | En forme | Green, with a staircase | Ball climbs one step per win; each step is an opponent beaten |
   | Derniers résultats | Black scoreboard dots | Results scroll up; a « CAPOT » stamp slams down and shakes the score |
   | Rivalités et records | Coral against purple | Tug of war: the split moves, then settles at the head-to-head share; records run along a ticker |

10. **Missing data: skip the scene.** No streak of 2 or more skips En forme. With no capot in the last 7 days, Derniers résultats shows the latest game with no stamp. A rivalry needs at least 5 games between two players. If every scene drops out, the TV shows the table with the ball, logo and clock.
11. **One PR for everything.**

## Acceptance Criteria

- [ ] `/tv` shows the scenes that have data, each for 20 seconds, in the fixed order
- [ ] A scene with nothing to say is skipped; with nothing at all, the ambient table shows
- [ ] Creating a game switches `/tv` to the live view; it returns 2 minutes after the final result, or after 10 minutes with no activity
- [ ] `/live` behaves exactly as before
- [ ] The page reloads itself when a new build is deployed
- [ ] Each scene matches its design board on screen at 1920×1080, and respects reduced motion
- [ ] Long names don't break a scene

## Steps

Every step is RED, GREEN, MUTATE, KILL MUTANTS, REFACTOR, CLEANUP. Pure rules go in `src/lib` with node unit tests; components use browser tests only where needed (`vi.mock` is broken there, so keep components props-driven).

1. **Rotation rules:** given what each scene has to say, pick the current scene from elapsed time, skipping empty ones.
2. **Takeover rules:** given the active game, its matches and the last activity time, decide screensaver or live view.
3. **Scene content:** derive each scene's content from existing `src/lib` helpers (`classement.ts`, `dashboardRecords.ts`, `recentResults.ts`, `stats.ts`, `seasons.ts`), including the skip conditions in decision 10.
4. **`/tv` route:** a view that wires the data hooks, rotation and takeover, reusing `LiveView`.
5. **Scene components:** the ambient table first, then one scene at a time from its board. Styling is verified on screen, not by tests.
6. **Self-reload:** detect a new deployed build and reload. No service worker exists, so the running build needs something to compare against.
7. **Live check** at 1920×1080, then ship.

## Pre-PR Quality Gate

1. Mutation testing over the new `src/lib` files (one `--mutate` flag: Stryker keeps only the last)
2. Refactoring assessment
3. `npm run build` and `npm test` on a build that includes current `origin/main`

---
*Delete this file when the plan is complete.*
