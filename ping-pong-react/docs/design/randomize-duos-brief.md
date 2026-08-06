# Design brief — « Équipes au hasard » (randomize the duos, 2v2)

**Date**: 2026-08-06 · **Approved by**: Thibault (in-session) · **Plan**: `plans/randomize-duos.md` (deleted once shipped)

Adds two ways to randomize the duos of a 2v2 quick game (`/game`, mode Double).
Decisions taken in the brainstorm (options offered → chosen):

1. **Interaction — Both**: a shuffle button on the manual teams grid **and** a
   « draw at creation » surprise mode.
2. **Reveal — scorer header**: in surprise mode the drawn pairs are first seen
   on the scorer after « Lancer la partie ». No dedicated reveal screen in v1.
3. **Surprise-mode picker — flat list**: the Équipe A/B cards give way to the
   standard selection list (4 slots), since the duos don't exist until the draw.

## 1 · Controls

- **« Mélanger »** button (shuffle icon) on the helper-line row under the teams
  grid, enabled once 4 players are picked. Each tap re-deals into a split
  **different from the current one** (4 players → 3 possible splits, so a tap
  always visibly changes the duos). Manual tweaking stays possible after.
- **« Équipes au hasard »** switch row above the players area (doubles only),
  note « Les duos seront tirés au sort au lancement. » ON → flat list;
  OFF → teams grid.

## 2 · Surprise mode

- Flat 4-slot list (same rows as Simple), counter « n / 4 ».
- Toggling ON pours camp players into the pool (A then B); toggling OFF deals
  them back (first two → Équipe A, rest → B). Nothing is lost either way.
- Recap: resting autoName « Partie en double »; hint invalid « Choisis 4
  joueurs — les équipes seront tirées au sort. Joueurs : n/4. »; valid
  « 4 joueurs · équipes au hasard · jeu en {pts} ». Enjeu stays locked
  « Non classée » (doubles v1 rule).
- Challenge-poster button disabled in this mode (« Les équipes sont tirées au
  sort au lancement. ») — the duos don't exist yet.

## 3 · Draw & creation

- Pure selectors in `src/lib/doubles.ts`, RNG injected for deterministic tests:
  - `tirerEquipes(ids, rng)` → random 2+2 split (uniform over the 3 splits).
  - `melangerEquipes(sel, rng)` → a split guaranteed ≠ current, camp preserved.
- Surprise creation draws first, then makes the **same** `createTournament`
  call as manual doubles (pair display names, id-pairs, `unranked: true`,
  tournament name = drawn matchup). Downstream (scorer reveal, Parties rows,
  stats exclusion, rematch) needs zero changes.

## 4 · Out of scope (v1)

Elo-balanced teams, reveal animation/screen, doubles tournaments.
