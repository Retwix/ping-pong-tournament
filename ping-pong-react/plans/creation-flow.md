# Plan: Creation flow revamp (« Nouvelle partie » / « Nouveau tournoi »)

**Branches**: `creation-flow` (PR 1, active) → `unranked-mode` (PR 2) → `doubles-2v2` (PR 3), all into `main`
**Status**: PR 1 complete (slices 1-4: `a078161`, `edf1981`, `c71841a`, `66029b3`) — next: PR 2 (unranked)
**Quality gate (PR 1)**: 504 tests, tsc + build clean; Stryker 100 % on `nouvellePartie.ts`,
`joueurs.ts`, `fold.ts`; `teams.ts` no-coverage mutants are pre-existing color/label constants
+ the visual badge helper (Thibault-verified visuals, house practice).
**Design source of truth**: `~/Downloads/design_handoff_creation_flow/` (README.md, DESIGN-SYSTEM.md — tokens already in `index.css` from the app revamp; prototype `Nouvelle partie.dc.html` is reference only)

## Goal

Replace the last old-design screen — `Setup.tsx` at `/new` and `/game` — with the handoff design, then ship the two new product features designed into it: **mode non classé** and **partie en double (2v2)**.

## Settled decisions (handoff + house)

- One layout, two variants (`/game` ↔ `/new`), switched by a header segmented control; shared app shell (`DashboardNav`/`DashboardTabBar`, **no active tab**), breadcrumb « ‹ Accueil ».
- « + Nouveau ▾ » menu keeps its two entries; unranked and 2v2 are choices inside the page.
- Classée/Non classée: segmented « L'ENJEU » in the rail above the CTA, with « Aucun impact sur le classement Elo. »
- Simple/Double: segmented control in the players-block header (quick game only). Switching clears the selection and locks the enjeu on « Non classée » (doubles have no pair Elo in v1).
- Player picker: searchable list (name **and** pôle, accent-insensitive via `fold.ts`), avatar + pôle pill + Elo per row, « + Nouveau joueur » inline with 6 pôle chips and duplicate guard.
- Chaos: card always visible, switch on the title row, content collapsible via « Configurer / Masquer ».
- Double-elim match count: `doubleElimMatchCount(n)` from the codebase is authoritative (the prototype's `2N−2` is indicative — handoff open question #1 resolved our way).
- CSS appended to `index.css` with the `np-` prefix; single 820px breakpoint (house convention); mobile gets the sticky bottom glass CTA bar.
- Commit cadence: green slices auto-commit on this branch; review happens at PR time.

## Documented equivalent mutants

- `fold.ts` `.toLowerCase()` → `.toUpperCase()`: equivalent in-app — every caller folds both
  sides of the comparison (query and candidate), so the case direction is unobservable.

## Open questions (flagged, with plan defaults)

1. **Unranked games in « Les stats »** — plan default: **they count in stats** (real games), only Elo/classement excludes them. Handoff open question #2; Thibault can overrule before PR 2 merges.
2. **Doubles matches in individual stats** — plan default: **excluded in v1** (pair names don't map to registry players); they appear in Parties history with the doubles treatment.

## Acceptance criteria (feature-level)

- [ ] `/game` and `/new` render the handoff design (shell, header + variant segmenté, form column, sticky recap rail), light + dark, desktop + 820px mobile.
- [ ] Every existing behavior preserved: format cards, points 11/21/15 + « autre » 1–99, chaos options, heure, posters, live validation hints, error banner, busy states, Slack invite, duplicate-player guard, registry states.
- [ ] Player picker is searchable (name + pôle), shows avatar/pôle/Elo, and stays 2-tap fast for a quick game.
- [ ] A game or tournament can be created « Non classée »: no Elo movement anywhere, badge visible downstream, still in Parties history.
- [ ] A 2v2 quick game can be created (Équipe A/B, forced non classée), scored on the board, and read back in Parties.
- [ ] `Setup.tsx` deleted; no dead buttons anywhere.

---

## PR 1 — Page revamp (`creation-flow`, this branch)

### Slice 1: Pure creation-state selectors (`src/lib/nouvellePartie.ts`)

**Value**: Unlocks slice 2 (the page) with TDD'd logic; horizontal exception, verified by unit tests.
**Path**: lib only — `autoName`, `validationHint` (valid + text) for 1v1 / round-robin / double-elim, `filterJoueurs` (accent-insensitive name+pôle search over the registry).
**Canonical strings** (prototype `Nouvelle partie.dc.html:679-700`):
- 1v1: name « {A} vs {B} » · « {A} vs … » (1 picked) · « Partie rapide » (0); hint « Choisis 2 joueurs. » → « {A} vs {B} · jeu en {pts} »
- RR: name = trimmed name or « Tournoi »; « Sélectionne au moins 2 joueurs. » → « N joueurs · M matchs · R tours » + « (avec exempts) » si N impair (M/R from `roundRobin.ts`)
- DE: « Sélectionne au moins 3 joueurs pour une élimination directe. » → « N joueurs · M matchs · 2 défaites = éliminé » (M from `doubleElimMatchCount`)
**RED**: Tests for each variant's valid/invalid boundary (0/1/2 players in game; 1/2 RR; 2/3 DE), odd/even RR counts, accent + pôle search matching, empty query. Mutator watch: `>=` boundaries, string literals, `%2` parity.
**GREEN**: Minimal pure functions reusing `matchCount`/`roundCount`/`doubleElimMatchCount`/`fold`/`teamLabel`.
**MUTATE → KILL MUTANTS → REFACTOR**: Stryker on the new file; document equivalents if any.
**Done when**: tests green, mutation report clean, committed.

### Slice 2: New page replaces Setup at `/new` and `/game` (core create path)

**Value**: Thibault creates a 1v1 game or tournament through the new design end-to-end.
**Path**: `NouvellePartie.tsx` (new) wired in `App.tsx` → shell + breadcrumb + kicker/title + variant segmenté (navigates `/game` ↔ `/new`) → form column (nom + « n/40 » counter, format cards, players block with searchable picker rows/selected rows/✕, points chips + « autre », heure) → rail (RÉCAPITULATIF, auto-name, hint pill with check/info icon, CTA, poster button, règle du jeu) → `createTournament` → `/t/:id`; error banner with « Réessayer », busy states. Chaos card ships in slice 3; old Setup stays untouched until slice 4.
**RED/GREEN**: Selector-driven pieces already tested (slice 1); any new logic that emerges (e.g. points-input coercion) is extracted to the lib test-first. UI verified by Thibault (house rule: no browser auto-verification).
**Done when**: create works for both variants in the new design, tests/typecheck green, committed.

### Slice 3: Picker states + inline « Nouveau joueur » + chaos card

**Value**: The full picker behavior set from the handoff.
**Path**: skeleton loading (3 lines), empty registry, « Aucun joueur trouvé », quick-game-full confirmation line + « Tout retirer », inline new-player (nom ≤ 20 + 6 pôle chips + Ajouter/Annuler, Entrée = Ajouter, duplicate guard « Ce joueur existe déjà — choisis-le dans la liste. », created player joins registry + current selection) — and the chaos card (switch on title row, Configurer/Masquer, fréquence/intensité/légendaires, defaults 2 · total · on).
**RED/GREEN**: lib-extracted logic test-first (e.g. duplicate detection reusing fold); UI states via Thibault.
**Done when**: all picker + chaos states reachable, committed.

### Slice 4: Mobile 820px + cleanup

**Value**: Phone-usable page; codebase drops the old design.
**Path**: single column, r15 cards, sticky bottom glass bar (hint + CTA), targets ≥ 44px, no hover-only actions, entry animation + `prefers-reduced-motion`; delete `Setup.tsx` + dead CSS; `npm run build` clean.
**Done when**: PR 1 quality gate passes → open PR, watch CI, merge on green, delete branch.

---

## PR 2 — Mode non classé (`unranked-mode`)

### Slice 5: `unranked` flag through creation + « L'ENJEU » control

`unranked-migration.sql` (boolean default false on `tournaments` — run in Supabase before merge), `Tournament` type, `createTournament` param, rail segmented Classée/Non classée + calm line. TDD the flag plumbing where testable.

### Slice 6: Ratings exclude unranked matches

Matches of unranked tournaments are skipped by the Glicko replay: `recomputeRatings`, `useRatings` (classement), `useTournament` (per-match deltas — scorer shows no Elo delta on unranked games). TDD via `replayRatings` inputs. Mutator watch: filter conditions.

### Slice 7: « Non classé » badge downstream

Badge (TERMINÉ-gabarit, neutral, never coral) on: parties list row, board header, live/spectator surface; « Aucun impact sur le classement Elo. » once per surface. Stats keep counting unranked games (plan default — confirm before merge).

---

## PR 3 — Partie en double 2v2 (`doubles-2v2`)

### Slice 8: 2v2 selectors

Side model (`a[]`, `b[]`, active side, auto-switch A→B when A full, click-to-switch), pair auto-name « {A} & {B} vs {C} & {D} » (« … » placeholders), hint « Choisis 4 joueurs — 2 par équipe. Équipe A : n/2 · Équipe B : n/2. », validity = 2+2 distinct. TDD in `nouvellePartie.ts`.

### Slice 9: Schema + creation + Équipe A/B UI

`doubles-migration.sql` (`doubles` boolean + `teams` jsonb on `tournaments`), Simple/Double segmenté, ÉQUIPE A/vs/ÉQUIPE B cards (counters, dashed empty slots, active-side border, helper line), switching clears selection + locks enjeu on « Non classée » (badge « verrouillé », Classée at .45 opacity). Creation: single match, sides carry pair display names « A & B », tournament stores the two id-pairs + `unranked=true`.

### Slice 10: Doubles downstream

Board/scorer header shows the pairs (« EN DIRECT · DOUBLE »), parties row doubles treatment (stacked avatars, « battent », no Elo column), doubles matches excluded from individual stats aggregation (TDD), challenge poster doubles variant (two name lines, centered VS).

---

## Pre-PR quality gate (each PR)

1. Stryker on changed lib files — report, survivors addressed or documented equivalent
2. Refactoring assessment (`refactoring` skill)
3. `npm run typecheck` (tsc), lint, `npm run build`, full test suite
4. PR flow: push → PR → watch CI in background → merge on green → delete branch

---
*Delete this file when all three PRs are merged. If `plans/` is empty, delete the directory.*
