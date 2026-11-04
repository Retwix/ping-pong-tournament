# Plan: TV screensaver

**Branch**: screen-saver
**Status**: Implemented. Steps 1 to 7 done, `/tv` checked on real data; open questions for the human are under "Step 7 results".
**Testing**: the human decided on 2026-11-04 that the screensaver needs no more tests. Write no new tests and run no mutation testing for it; check each scene on screen. The committed `tvRotation` and `tvTakeover` tests stay.
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

- [x] `/tv` shows the scenes that have data, each for 20 seconds, in the fixed order
- [x] A scene with nothing to say is skipped; with nothing at all, the ambient table shows
- [x] Creating a game switches `/tv` to the live view; it returns 2 minutes after the final result, or after 10 minutes with no activity
- [x] `/live` behaves exactly as before
- [x] The page reloads itself when a new build is deployed
- [x] Each scene matches its design board on screen at 1920×1080, and respects reduced motion
- [x] Long names don't break a scene

## Steps

No new tests (see **Testing** above). Pure rules go in `src/lib`; keep components props-driven so they can be screenshot from a harness.

1. **Rotation rules:** given what each scene has to say, pick the current scene from elapsed time, skipping empty ones.
2. **Takeover rules:** given the active game, its matches and the last activity time, decide screensaver or live view.
3. **Scene content:** derive each scene's content from existing `src/lib` helpers (`classement.ts`, `dashboardRecords.ts`, `recentResults.ts`, `stats.ts`, `seasons.ts`), including the skip conditions in decision 10.
4. **`/tv` route:** a view that wires the data hooks, rotation and takeover, reusing `LiveView`.
5. **Scene components:** the ambient table first, then one scene at a time from its board. Styling is verified on screen, not by tests.
6. **Self-reload:** detect a new deployed build and reload. No service worker exists, so the running build needs something to compare against.
7. **Live check** at 1920×1080, then ship.

## Step 3 notes (read from the code and boards, nothing built)

New `src/lib/tvScenes.ts`, one exported function per scene plus `tvScenes(data, now)` giving the fixed order with nulls for `pickScene`. Scene functions take rows and events so tests can use factories with literal numbers.

- **Race (done):** current-season ladder (`ladderReplay`, `currentSeason`, `daysLeft`). `tvScenes` must feed it `ladderSections(...).ranked`, not `splitLadder`: that also drops players idle 30 days, as Le Classement does. Non-provisional rows, numbered by position like the podium, top 5, `weeklyDelta` as the trend. Story is rank 1 against rank 2, gap from rounded ratings. Fewer than 2 ranked skips the scene.
- **Form:** season events. Best `winStreak` of 2 or more, `beaten` is the last 5 opponents at most, oldest first. Risers from `topProgressions`. Upset is `biggestUpsetOf` (needs exporting) over the last 7 days.
- **Results:** use `individualMatches` where capots count. `recentResults` feeds the list. Headline is the latest capot in 7 days, else the latest game with no stamp. Set matches read as sets won (« 2–1 », « Bo3 », from `2 * wins - 1`).
- **Capot trap:** `isCapot` reads only the deciding set, and capots are single games only for now, so require `finishedSets(m).length === 0`. `capotList` does not check this.
- **Rivalry:** `computeRivalries(individualMatches(...), players, 5)`, so doubles stay out. Most games, then `rivalryBalance`. No rivalry skips the scene. Records: `longestStreak`, biggest delta from `scopedEvents`, most `played`.
- **Tug split:** settled translateX is `1920 * (share - 1)`, passed as a CSS variable.

## Step 5-6 notes

- CSS prefix is `tvs-`, never `tv-`: `tv.css` loads with the whole app and `index.css` owns `tv-` for the spectator view, so a shared name changes `/live`.
- The stair is right-aligned and `climbKeyframes` builds the ball's path for 2 to 5 steps.
- Results: `when` reads « il y a 1 j · Bo3 », longer than the board's 170px column; widen it or the feed. With no stamp, drop « Balla di capot » and promote the names line.
- Rivalry: the coral block covers the left side up to `1920 * share`. Long names need clipping or a smaller size.
- `ResultsScene.stamped` drives the stamp; `ResultLine.capot` only colours a feed score, since an old capot can be the latest game.
- Headline gap: « point sépare » when the gap is below 2. A 3-digit gap and long names must fit; the harness `?long` case covers them.
- Self-reload is `useReloadOnNewBuild`, checking every 5 minutes in screensaver mode. Checked on a build with a dead backend, the timer shortened in the browser: an unchanged build never reloaded; a changed entry script reloaded once and settled.
- The tug has no closing keyframe and runs 15s, so it eases into the inline transform; no CSS variable.

## Step 7 notes

- `/tv` has only run against a dead backend, so the scene data functions have still never executed on data.
- Writes must not reach production. Run the app with the main checkout's `.env` passed through the shell (never copied into the worktree) and abort every non-GET Supabase request with Playwright `page.route` before opening `/tv`; log what gets aborted.
- Takeover without creating a game: `useTournament` polls every 15s, so rewrite only the browser's GET response for the active game, setting `created_at` to now and keeping its real status. Nothing changes in the database. If the status is not `done`, the auto-crown can fire, which is why the write block comes first.

## Step 7 results (2026-11-04, production reads, every non-GET aborted in the browser)

- Rotation: scenes changed at 20.3, 40.3, 60.3 and 80.3 seconds, in order. No page errors. The only aborted write was the deliberate proof of the block.
- Numbers: rivalry, streak, games played, beaten opponents and latest results match a tally from the raw rows. Race points and weekly moves match `/classement`, which uses the same engine.
- Takeover, simulated by rewriting the browser's GET responses, no game created: switched on the next poll, showed the next-up card then the scoreboard, returned 120.4 seconds after a final and 10.006 minutes idle. A real new game arriving through realtime was not exercised.
- Self-reload: real 5-minute timer, entry script renamed in the local build, one reload, screensaver resumed.
- Reduced motion: Results and Rivalry render settled, no animation running.
- Review fixes, rechecked with every realtime socket closed: a hidden active game took over 14.7 seconds after it appeared, from the 30-second poll alone. A failed scene load (a 500, so the client doesn't retry) stayed on the ambient table and recovered about 301 seconds after page load, from the 5-minute refresh. After a takeover the rotation restarts at the race scene.
- Not exercised on real data: skipped scenes and the ambient table, because every scene has data today. Long names were only checked in the harness.

Open for the human:

- The rivalry settles at the literal share, so 57–5 leaves Candice's name and score on coral.
- `SpectatorView.tsx:48` has a local `signed` that doesn't round, so the final standings show `+49.198553432522885` and overflow the card. On `main` and on `/live` too; left alone because `/live` must not change here.

## Pre-PR Quality Gate

1. Refactoring assessment
2. `npm run build` and `npm test` on a build that includes current `origin/main`

---
*Delete this file when the plan is complete.*
