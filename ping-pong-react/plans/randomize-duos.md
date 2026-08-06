# Plan: « Équipes au hasard » — randomize the duos (2v2)

**Branch**: `randomize-duos` · **Status**: Active · **Design**: `docs/design/randomize-duos-brief.md` (approved)
**Workflow**: house rules — load `tdd`/`testing`/`mutation-testing`/`refactoring` before code,
auto-commit green slices (Thibault's standing cadence), single PR → CI → merge on green → delete
branch. No migration needed (no schema change).

## Goal

A 2v2 game's duos can be randomized: re-deal the picked 4 with a « Mélanger » button, or let the
app draw the teams at creation (« Équipes au hasard » mode, revealed on the scorer).

## Acceptance criteria

- [ ] With 4 players picked in Double, « Mélanger » re-deals them into a split different from the
      current one; repeated taps keep changing the duos; manual tweaks still work after.
- [ ] « Équipes au hasard » ON replaces the team cards with the flat 4-slot list; toggling either
      way never loses picked players.
- [ ] In surprise mode the recap reads « Choisis 4 joueurs — les équipes seront tirées au sort.
      Joueurs : n/4. » → « 4 joueurs · équipes au hasard · jeu en {pts} », the poster button is
      disabled, and « Lancer la partie » creates a doubles game whose drawn pairs appear on the
      scorer header (same downstream behavior as manual doubles, unranked).

## Slice 1: draw selectors (lib, TDD)

**Value**: deterministic, mutation-tested randomization logic unlocking the UI slice.
**Path**: `src/lib/doubles.ts` — `tirerEquipes(ids, rng)` (uniform 2+2 split via partner index
`1 + floor(rng()*3)`), `melangerEquipes(sel, rng)` (partner ∈ {2,3} of the reassembled ids →
always ≠ current split, camp preserved); `src/lib/nouvellePartie.ts` —
`recapitulatifHasard(n, target)` (strings from the brief).
**RED**: rng-driven tests pinning each of the 3 splits, 2+2 partition with no duplicates,
mélanger ≠ current for both rng branches, camp + immutability, recap exact strings and the
n=4 validity boundary. Mutator watch: `1 +`, `* 3`, `floor`, filter indices, `< 0.5`, `=== 4`.
**GREEN → MUTATE → KILL → REFACTOR**: Stryker on both files, survivors killed or documented.
**Done when**: tests green, mutation report clean, committed.

## Slice 2: UI + wiring

**Value**: Thibault randomizes duos end-to-end in the real creation flow.
**Path**: `NouvellePartie.tsx` — « Mélanger » button on the camp-hint row (enabled at 4);
« Équipes au hasard » switch row (doubles only, np-legend pattern) with pour-over conversions
selDouble ↔ flat `selected` pool; flat list capacity 4 (counter « n / 4 », empty message
« choisis-en 4 »); recap via `recapitulatifHasard`; poster disabled in hasard; create() draws via
`tirerEquipes` then the exact manual-doubles `createTournament` call; leaving Double/`/game`
resets hasard. `index.css` — `np-camp-row`, `np-melanger`, hasard row styles (np- prefix,
light + dark).
**Done when**: tsc, full vitest, build green; UI states verified by Thibault post-merge; committed.

## Pre-PR quality gate

Stryker on changed lib files, refactoring assessment, `npx tsc --noEmit`, full `npx vitest run`,
`npm run build`, push → PR → watch CI → merge on green → delete branch. Delete this plan file in
the branch's final commit (single-PR lifecycle).

---
*Delete this file when the plan is complete. If `plans/` is empty, delete the directory.*
