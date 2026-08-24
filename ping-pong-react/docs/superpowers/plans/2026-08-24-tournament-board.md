# Plan: Tournament board revamp — `/t/:id` onto the app shell

**Branch**: feat/tournament-board-revamp
**Status**: Active
**Handoff**: `docs/design/tournament-board-handoff/README.md` (+ `TournamentBoard.dc.html`)

## Goal

The tournament board — the last core surface still on the legacy standalone layout — renders on the
shared app shell, with the round-robin match list, the standings card and the double-elimination
bracket restyled to the frozen design system.

## Scope

This is a **reskin, not a product change**. Every behaviour in the current feature inventory is
preserved: tapping a match opens the scorer, the champion screen auto-opens on `status === 'done'`,
capot takes precedence, « Copier le lien » / « Mode live » / « Mode arbitre » keep their targets,
BYE walkovers stay hidden, and derived standings stay derived.

**Out of scope, deliberately:**

- **The overlays.** Scorer (`LiveScorer.tsx`), capot (`CapotScreen.tsx`) and champion
  (`Champion.tsx`) keep their current visual design — the handoff says their design "is owned
  elsewhere", and `Champion`/`FinalStandingsCard` were just reworked in PR #32 (`fe2f790`). This plan
  only changes *how they are invoked*, which is not at all.
- **The `kind === 'game'` path.** `Board.tsx` also serves single games (`/game` → `GameResult` /
  `LiveScorer`, with the rematch flow). The handoff covers the *tournament* board only. That branch
  of `Board.tsx` must come out of this work byte-identical in behaviour.
- **Mobile.** The handoff states it explicitly: the prototype is desktop-only and the 820px
  breakpoint "should be done as one pass across all pages". No `tb-` media queries in these slices
  beyond what is needed to stop the page breaking outright.
- **`/live` and `/ref`.** Buttons point at them; the views themselves are untouched.

## Global constraints

**This project has no component tests.** No Testing Library, no Vitest Browser Mode — every test in
`src/lib/*.test.ts` is a pure-function test, and Thibault verifies visuals themself. So **every rule
this page needs goes into a tested selector in `src/lib/tournamentBoard.ts`, and the components stay
thin and declarative.** If a slice finds itself wanting a branch inside JSX, that branch belongs in a
selector. This is the same constraint that shaped the alumni and seasons plans.

Today three components hold untested logic that this revamp should pull into selectors on the way
past: `MatchList.tsx` (round grouping, bye computation, longest/shortest), `Standings.tsx`
(Élo column visibility, signed formatting) and `BracketView.tsx` (round grouping, node state,
BYE filtering). Moving it is not a separate refactor slice — each slice takes the logic it needs.

**Testing conventions** (from the existing suite): Vitest, `describe`/`it`, factory helpers built
inline per test file, no `let`/`beforeEach`, real types from `src/types.ts` never redefined, French
in user-facing strings and English in code.

**Implementation pattern** (per `app-pages-revamp`, unchanged): shell via `DashboardNav` with no
`active` prop (the board is reached by link, like `/parties`); pure TDD'd selectors in
`src/lib/tournamentBoard.ts` (+ Stryker, equivalent survivors documented); page CSS appended to
`index.css` behind the **`tb-`** prefix; existing tokens only — no new colour, size or radius.

## Design-fidelity note

The handoff declares itself "high fidelity … pixel-for-pixel", and unusually that is mostly fair
here: every value it quotes comes from the already-frozen `DESIGN-SYSTEM.md` that Classement, Stats,
Joueurs and Parties were built from, so matching it costs nothing extra. **Colours, type, spacing and
copy are therefore taken as written.**

What is still trimmed, per the usual handoff-fidelity rule — pull any of it back in and it becomes
its own slice:

- **No new empty-state art.** "Not found" reuses the existing neutral container pattern rather than a
  bespoke 52px tile with a crossed-magnifier icon.
- **No page entrance animation.** The 220ms opacity/translate entrance is a nice-to-have that no
  other revamped page has; skipped for consistency, not difficulty.
- **The `overflow-x: auto` bracket** is implemented as a plain scroll container. The handoff's
  `justify-content: space-around` column trick (so later-round cards centre between their feeders)
  is kept — it is one CSS line and it is the thing that makes a bracket read as a bracket — but no
  connector lines are drawn.

## Behaviour changes to confirm

Two places where the handoff does not match today's app. Both are deliberate in the handoff; flagging
them so they are a decision, not a surprise:

1. **Double-elim default view flips.** `BracketView.tsx:96` defaults to `list`; the handoff's
   `deView` defaults to `board` (« Tableau »). Adopting the handoff.
2. **The icon toggle becomes a labelled segmented control.** Today it is two Tabler icon buttons
   (`IconLayoutList` / `IconBinaryTree2`); the handoff specifies a **Tableau | Liste** text segmented
   control, matching the segmented controls already used on Classement and Nouvelle Partie.

Also worth knowing: the page-level `ThemeToggle` disappears from the board (handoff decision 1) — the
shell nav already carries one, so this removes a duplicate rather than a feature.

## Acceptance criteria

- [ ] `/t/:id` for a tournament renders inside the shared shell (glass nav, logo tile, wordmark), with no page-level theme toggle
- [ ] The header shows kicker (`format · N joueurs · jeu en T`), tournament name, « Non classé » badge when unranked, the format-appropriate subtitle, and back links at top and bottom
- [ ] Share actions sit in the header: URL chip + « Copier le lien », « Mode live », « Mode arbitre » — Tabler icons, no emoji
- [ ] Round-robin shows matches grouped by round with a live progress bar and `X/Y joués`, per-round bye note when the player count is odd, and the longest/shortest line once any match has a duration
- [ ] The standings card shows rank/J/V/PTS/DIFF with podium colours and signed DIFF; the ÉLO column is present and signed when the tournament is ranked, and **absent** when it is unranked, replaced by the « Tournoi non classé » note
- [ ] Double-elim shows the bracket with Tableau|Liste segmented control (defaulting to Tableau), grouped into principal / perdants / grande finale, with `En attente` nodes and « À déterminer » opponents rendered distinctly
- [ ] Loading, « Tournoi introuvable » and the sync-error banner each render in the new shell
- [ ] Opening a match, the capot screen, the champion screen and the single-game path all behave exactly as before

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing
test. Load `tdd`, `testing`, `mutation-testing` and `refactoring` before the first code change of
each slice.

---

### Slice 1: The tournament board renders on the app shell with its new header

**Value**: Anyone opening a tournament link lands on a page that looks like the rest of the app
instead of the one remaining legacy screen.

**Path**: `/t/:id` → `App.tsx` `case 'board'` (gains the nav handlers the other pages already get) →
`Board.tsx` → `DashboardNav` + new `tb-` header → existing `MatchList` / `Standings` / `BracketView`
rendered unchanged below it.

**Why this is the walking skeleton**: it proves the real route, the real data hook and the real shell
compose, while every section underneath keeps working. Ship it and the page is already better; the
next three slices restyle one section each.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (confirm before code):
- Nav renders with no tab active; « + Nouveau » and the theme toggle work
- Kicker reads `Round-robin · 5 joueurs · jeu en 11` / `Double élimination · 8 joueurs · jeu en 11`
- Unranked tournaments show the « Non classé » badge and the subtitle gains « Aucun impact sur le classement Elo. »
- Round-robin and double-elim get their respective subtitles
- « Tous les tournois » appears above the title and again at the bottom
- Share row: URL + « Copier le lien » (clipboard still works), « Mode live » → `/live`, « Mode arbitre » → `/ref`, all with Tabler icons and no emoji
- The page-level `ThemeToggle` is gone
- The single-game path is untouched

**RED**: `tournamentBoard.test.ts` — `enteteTournoi(tournament)` returning `{ kicker, sousTitre, nonClasse }`. Cases: round-robin vs double-elim wording; ranked vs unranked suffix; player count and target interpolated. Mutator watch: the `unranked ?? false` fallback (conditional-expression mutant returning the subtitle without the suffix), and string-literal mutants on both subtitles — assert on exact French copy, not `toContain`.
**GREEN**: the selector, then rewire `Board.tsx`'s header + `App.tsx` handlers.
**MUTATE**: Stryker over `src/lib/tournamentBoard.ts`.
**KILL MUTANTS**: expect survivors around the `players.length` pluralisation — decide with Thibault whether « 1 joueur » is reachable (it is not: minimum is 3).
**REFACTOR**: assess only.
**Done when**: criteria met, mutation report reviewed, commit approved.

---

### Slice 2: The round-robin match list gets its new anatomy and live progress

**Value**: Whoever is running the tournament sees at a glance how far along it is and which match is
live, in the restyled list.

**Path**: `Board.tsx` (round-robin branch) → `MatchList` rebuilt on `tb-` classes → selectors →
tap still opens `LiveScorer`.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (confirm before code):
- Section title « Les matchs », progress bar + `X/Y joués`, both updating live as matches finish
- Rounds in order, each headed « Tour N »; « exempt : X » only when someone sits the round out
- Row: status dot + label (`Terminé` / `En cours` / `À jouer`) → player A → score → player B → duration → chevron
- Loser name greys; an unplayed match shows `—` for the score (today it shows an empty string)
- Once any match has a duration: « Plus long : X–Y (mm:ss) · Plus court : X–Y (mm:ss) »
- Row hover and tap-to-open unchanged

**RED**: `toursDuTournoi(tournament, matches)` → `[{ round, matches, exempts }]`; `avancement(matches)` → `{ joues, total, ratio }`; `extremesDuree(matches)` → `{ plusLong, plusCourt } | null`. Cases: odd player count produces exactly one bye name per round and even produces none; a round where every player plays; `avancement` on zero matches must not divide by zero; `extremesDuree` ignores matches missing `started_at`/`ended_at`, and returns the same match for both when only one is timed. Mutator watch: `>` vs `>=` in the longest/shortest reducers — two matches of identical duration is genuinely reachable here, so assert first-wins explicitly rather than documenting it as equivalent.
**GREEN**: selectors, then the component reduced to markup.
**MUTATE**: Stryker.
**KILL MUTANTS**: expect survivors on the `ratio` rounding — cover 0/N and N/N exactly.
**REFACTOR**: `MatchList.tsx` should end this slice with no `filter`/`reduce` left in it.
**Done when**: criteria met, mutation report reviewed, commit approved.

---

### Slice 3: The standings card becomes the sticky Classement panel, Élo-aware

**Value**: A player reads their rank, record and Elo swing beside the matches instead of below them —
and an unranked tournament stops implying an Elo effect it does not have.

**Path**: `Board.tsx` → two-column grid → `Standings` rebuilt as the `tb-` card → selector over
`computeStandings` + `ratingsForTournament`.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (confirm before code):
- Columns `#` · JOUEUR · J · V · PTS +/− · DIFF · ÉLO, right-aligned, header in caps
- Podium ranks 1/2/3 gold/silver/bronze, the rest muted
- DIFF and ÉLO signed and coloured (green positive, coral negative, `±0` neutral)
- ÉLO cell `title` reads « 1500 → 1532 »
- **Unranked: the ÉLO column is absent entirely** and the note « Tournoi non classé — les résultats ne changent aucun Elo. » sits below the card
- Tie-break hint « Départage : victoires, puis différence de points. » under a divider
- Card is sticky at `top: 88px` beside the match list
- Ordering unchanged: wins, then point difference

**RED**: `lignesClassement({ players, matches, ratings, unranked })` → `{ rows, afficherElo, note }`. Cases: `afficherElo` false when `unranked`, false when ratings are empty, true otherwise; a player with no rating entry renders `—` not `+0`; signed formatting across positive/negative/zero; rank ordering on a wins tie broken by diff. Mutator watch: the `unranked` guard is the whole point of the slice — assert the ÉLO key is *absent*, not merely falsy, so a `true→false` mutant cannot survive behind a truthy check.
**GREEN**: selector, then the card.
**MUTATE**: Stryker.
**KILL MUTANTS**: the `diff > 0 ? '+' : ''` sign mutants need an explicit `±0` case.
**REFACTOR**: assess whether `signed()` in `format.ts` already covers the formatting — prefer reuse over a second helper.
**Done when**: criteria met, mutation report reviewed, commit approved.

---

### Slice 4: The double-elimination bracket gets the segmented control and node states

**Value**: Someone following a double-elim tournament sees which matches are actually playable and
which are waiting on a feeder result, in a bracket that reads as a bracket.

**Path**: `Board.tsx` (double-elim branch) → `BracketView` rebuilt → selectors over
`reconcileBracket` / `isPlayable` / `roundLabel`.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (confirm before code):
- Header « Le tableau » + progress bar and count **computed from bracket nodes**, BYE walkovers excluded
- Segmented **Tableau | Liste**, defaulting to **Tableau**
- Vue tableau: three groups — TABLEAU PRINCIPAL / TABLEAU DES PERDANTS / GRANDE FINALE — each a row of round columns with titles on one baseline and cards spaced so later rounds centre between feeders; horizontal scroll inside the card, never on the page body
- Node states `Terminé` / `En cours` / `Prêt` / `En attente` / `À jouer`, each distinguishable; unresolved opponents read « À déterminer »
- Only playable nodes open the scorer — `En attente` nodes stay inert, as today
- Grande finale node visually distinct
- Vue liste: same nodes as flat rows grouped by round title, reusing slice 2's row anatomy, with the right-hand note showing duration / « manche 2 » / « attend un résultat »
- Footer hint « Tableau à double élimination : il faut perdre 2 fois pour être éliminé. »

**RED**: `groupesTableau(matches)` → `[{ groupe, colonnes: [{ titre, noeuds }] }]`; `etatNoeud(match)` → the five-state union; `nomAdversaire(name)` → « À déterminer » for `TBD`. Cases: BYE matches excluded from both the groups and the count; a node with a `TBD` side is `En attente` and not `À jouer`; `En cours` beats `À jouer` when a score is non-zero; empty loser bracket (3 players) produces no perdants group rather than an empty one; `GRANDE FINALE` present only when a GF node exists. Mutator watch: `isPlayable` interacts with the state union — a mutant that collapses `Prêt` into `À jouer` must fail a test, so assert the state string, not just "is clickable".
**GREEN**: selectors, then the two views.
**MUTATE**: Stryker.
**KILL MUTANTS**: survivors expected around `maxW`/`maxL` in `roundLabel` — cover a bracket where the loser bracket is deeper than the winner bracket.
**REFACTOR**: `MatchCell` and slice 2's row should converge on one component if they genuinely match; do not force it if the bracket node's two-line form differs.
**Done when**: criteria met, mutation report reviewed, commit approved.

---

### Slice 5: Loading, not-found and sync-error states land in the new shell

**Value**: A stale link or a dropped realtime connection tells the truth inside the new page instead
of falling back to the legacy `wrap` layout.

**Path**: `Board.tsx` early returns → shell + `tb-` state blocks; `useTournament`'s `error` →
banner above the header with a retry.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (confirm before code):
- Loading renders the existing racket `Loader` centred in a card **inside the shell** (nav visible), not the bare `wrap`
- Not found: « Tournoi introuvable. » + sub-line + « Tous les tournois » CTA, in the neutral container (trimmed: no bespoke icon tile)
- Sync error: banner above the header, « Synchronisation interrompue — les scores affichés peuvent être en retard. » + « Réessayer » that re-runs the load
- The banner coexists with a rendered board — an error never blanks the page
- Dark mode correct for all three

**RED**: `etatChargement({ loading, tournament, error })` → `'loading' | 'notfound' | 'ok'` plus an independent `banniere` flag. Cases: `loading` wins over everything; `error` with a tournament present is `ok` + banner; `error` with no tournament after loading is `notfound`; the flags are independent, so assert the pair, not one field. Mutator watch: the precedence chain is pure boolean logic and Stryker will attack every branch — one test per row of the truth table.
**GREEN**: selector, then the three blocks.
**MUTATE**: Stryker.
**KILL MUTANTS**: any survivor here means a missing truth-table row; add it rather than documenting it.
**REFACTOR**: assess.
**Done when**: criteria met, mutation report reviewed, commit approved.

---

## Sequencing note

Slices 2–4 are independent of each other and each depends only on slice 1. Slice 5 can land any time
after slice 1. If a slice needs to be dropped for time, the page is coherent after any prefix —
that is the point of doing the shell first.

## Pre-PR quality gate

Before each PR:
1. Mutation testing — run the `mutation-testing` skill, document equivalent survivors
2. Refactoring assessment — run the `refactoring` skill
3. `npm run build` (tsc -b + vite build) and `npm test` green
4. Visual check by Thibault — never by an automated browser pass

---
*Delete this file when the plan is complete.*
