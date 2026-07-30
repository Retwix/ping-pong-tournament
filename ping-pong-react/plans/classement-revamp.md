# Plan: Classement Elo page revamp

**Branch**: `classement-revamp` (off `dashboard-revamp`, PR back into `dashboard-revamp`)
**Status**: Slices 1–8 implemented (2026-07-30) — PR open, awaiting Thibault's visual validation
**Mutation report**: `src/lib/classement.ts` 95.65% (132 killed / 6 survived — all documented
equivalent mutants: Date-null epoch coercion ×2, tie-identical ISO strings ×2, symmetric-fold
toUpperCase, loop-bound `>=0`→`>0` unreachable-seed)
**Design source**: `~/Downloads/design_handoff_app_complete/` (README §Page 3, `DESIGN-SYSTEM.md`, `RESPONSIVE.md`) — first of four page revamps (Classement → Parties → Stats → Joueurs).

> **Slicing note**: per product decision, one PR covers the whole page. The slices below are
> TDD-driven, commit-sized increments *within* that PR (same shape as the dashboard revamp:
> many known-good commits, one reviewable PR). Each slice leaves tests green and the app usable.

## Goal

Replace the current `/classement` page (`Ratings.tsx`) with the handoff design: app shell with
sticky nav, stat tiles, podium, full player table (form dots, streak badge, 7-day delta),
functional search with ⌘K, rail cards (écarts serrés, progressions, explication Elo) and the
"détail du calcul" modal — **keeping the Glicko-2 engine** and adapting all copy/numbers to it.

## Decisions already taken (with Thibault, 2026-07-30)

- **Glicko-2 stays.** Modal M1 keeps the design's layout; its copy explains the real system
  (départ 1500, poids marge/enjeu, fiabilité ±, provisoire sous 5 matchs). No rating changes.
- **Functional in v1**: search (+ ⌘K focus). **Not rendered at all**: « Exporter → ».
- One PR per page, into `dashboard-revamp`.

## Design → data mapping

| Design element | Data source |
|---|---|
| Stat tiles (joueurs classés / matchs notés / meneur) | `useRatings` rows + matchCount (exists) |
| « dernière mise à jour il y a X » | new `lastRatedAt(events)` + existing `relativeTime` |
| Table: V–D, forme (5 derniers), badge série, « 7 J » | new selectors over `events` (`trend` is last-match only — insufficient) |
| Ligne provisoire (« x / 5 matchs », Elo grisé `~1500`) | `row.provisional`, `row.games`, `RATING.provisionalGames` |
| Podium + notes (« à N points du titre », série) | derived from ranked rows + streak selector |
| Écarts les plus serrés / Plus fortes progressions | new selectors (adjacent rating gaps / top weekly deltas) |
| Modale « EXEMPLE » block | most recent rated match from `events` (real data, not seeds) |

Deviations from the design mocks (all copy-level, layout unchanged):
- Elo values start at 1500, not 1200; formula block describes Glicko-2 in plain words, no fake « K = 24 ».
- Badge « NON CLASSÉE » → « PROVISOIRE » (gender-neutral, matches existing app vocabulary).
- « Voir tout → » (écarts) and « Exporter → » links dropped — no dead buttons.
- Row click keeps the existing `PlayerModal` (history sparkline) — design specifies hover only.

## Acceptance Criteria

- [ ] `/classement` renders inside the dashboard shell: sticky glass nav (Classement tab active), mobile bottom tab bar, gradient background — old back-arrow header gone.
- [ ] Header shows title, « Classement général · dernière mise à jour il y a X » (live value), and 3 stat tiles.
- [ ] Podium shows the top 3 **non-provisional** players (leader gradient card with bilan + matchs tiles; 2e/3e with gap-to-leader / streak notes); hidden entirely when fewer than 3 ranked players.
- [ ] Table shows every player: rang, avatar, nom, forme (5 pastilles V/L, plus récent à droite), V–D, matchs, Elo (leader violet), delta 7 jours (▲ vert / ▼ rouge); streak badge « N VICTOIRES » at ≥3 consecutive wins; provisional rows show « x / 5 matchs », grey `~Elo`, badge PROVISOIRE; explanatory note below.
- [ ] Search filters the table by name and team (accent/case-insensitive); ⌘K focuses it; shortcut chip shown.
- [ ] Rail shows « Écarts les plus serrés » (3 smallest adjacent gaps among ranked) and « Plus fortes progressions » (top 3 positive 7-day deltas).
- [ ] « Comment marche l'Elo » rail card opens the « détail du calcul » modal: Glicko-adapted formula + 4 steps + real-data example; closes on Échap, scrim click, and ✕.
- [ ] Light + dark themes; responsive per `RESPONSIVE.md` (2fr/1fr → stacked, rail after main, delta hidden < 380px, hover states behind `@media (hover:hover)`); `prefers-reduced-motion` respected.
- [ ] Loading / error / empty (no rated match) states preserved.
- [ ] All logic selectors unit-tested (vitest) with mutation testing green; `npm run build` and full test suite pass.

## Slices

Every slice: RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Load `tdd`, `testing`,
`mutation-testing`, `refactoring` before implementation. Presentational markup/CSS follows the
codebase pattern (pure selectors TDD'd in `src/lib`; thin components; Thibault verifies visuals
in-browser himself — never auto-open a browser).

### Slice 1: Classement lives in the dashboard shell

**Value**: navigating to Classement no longer drops out of the new app shell; tabs work both ways.
**Path**: `/classement` route → `Ratings` renders `DashboardNav`/`DashboardTabBar` (new `active` prop + `onHome`) around existing content → nav clicks route to the other pages.
**Acceptance criteria**: nav visible with « Classement » highlighted on desktop and mobile bar; Accueil/Stats/Joueurs tabs navigate; « + Nouveau » menu works; old TopBack/eyebrow header removed; existing sections still render beneath.
**RED/GREEN**: `active`-tab rendering is presentational — no meaningful unit seam; covered by typecheck, existing suite staying green, and visual check. (Explicit horizontal exception: unlocks every following slice, independently verifiable by eye.)
**Done when**: shell present on the page, all tests pass, Thibault confirms visuals.

### Slice 2: Design header + stat tiles + « dernière mise à jour »

**Value**: the page states its freshness at a glance.
**Path**: `events` → `lastRatedAt(events)` → `relativeTime` in the subtitle; 3 stat tiles restyled per design (chiffre 30px, tuiles blanches r16).
**RED**: `lastRatedAt` — returns latest `at` across events (unordered input, ties, empty → null). Mutant traps: `>` vs `>=`, empty-array guard.
**GREEN**: minimal selector; header/tiles markup.
**Done when**: subtitle shows live relative time; tiles match design; tests + mutation green.

### Slice 3: Table « Tous les joueurs »

**Value**: the reference ranking with form, record and weekly momentum — the core of the page.
**Path**: `events` + `rows` → new `src/lib/classement.ts` selectors → table render → row click keeps `PlayerModal`.
**RED** (selector by selector):
- `recordOf(events, key)` → `{ wins, losses }` (mutants: won flag inversion, filter by key).
- `lastFive(events, key)` → chronological last ≤5 booleans, most recent last (mutants: slice bounds, order reversal).
- `winStreak(events, key)` → current consecutive wins from most recent (mutants: off-by-one, loss short-circuit).
- `weeklyDelta(events, key, now)` → sum of deltas in trailing 7 days (mutants: boundary `>=` on cutoff, sign).
**GREEN**: selectors + design table (columns `22px # | 34px | 1fr | 86px forme | 58px V–D | 74px matchs | 52px Elo | 42px 7 J`), streak badge ≥3, provisional variant, note line. Drop the « Fiabilité » column (uncertainty surfaced via PROVISOIRE + explainer).
**Done when**: table matches design in both themes; selectors mutation-tested.

### Slice 4: Podium

**Value**: the top 3 celebrated the way the design intends.
**Path**: ranked rows + slice-3 selectors → `podium(rows, events, now)` → three cards above the table; hidden when < 3 ranked.
**RED**: `podium` — picks first 3 non-provisional; leader note = bilan + matchs; runner notes = « à N points du titre » (rating gap, rounded) and streak (« N victoires d'affilée ») with record fallback. Mutants: provisional filter, gap arithmetic, `< 3` guard.
**GREEN**: selector + cards (leader gradient r16, glass tiles; 2e/3e white).
**Done when**: podium renders with real notes, disappears below 3 ranked players; tests green.

### Slice 5: Recherche + ⌘K

**Value**: find a player instantly, keyboard-first.
**Path**: input in the page header → `filterRatingRows(rows, query)` → filtered table (podium/rail unaffected); ⌘K/Ctrl+K focuses the input; chip « ⌘K » displayed.
**RED**: `filterRatingRows` — matches name and team, case- and accent-insensitive, trims, empty query → all. Mutants: normalization removal, OR→AND on fields.
**GREEN**: selector + controlled input + keydown listener (cleanup on unmount).
**Done when**: typing filters live; ⌘K focuses; empty result shows « Aucun joueur trouvé » row.

### Slice 6: Rail — écarts serrés + progressions

**Value**: the stories inside the ranking (who's about to overtake whom, who's hot).
**Path**: ranked rows → `tightestGaps(rows)` (3 smallest adjacent gaps) and `topProgressions(events, rows, now)` (top 3 positive weekly deltas, reusing `weeklyDelta`) → two rail cards.
**RED**: gaps — adjacency on rank order, ties, < 2 ranked → empty; progressions — positive-only, sort desc, ≤3. Mutants: sort direction, `> 0` boundary, slice count.
**GREEN**: selectors + cards (rows `#F7F5FD` r13; ranking-row component reuse).
**Done when**: both cards render real data, hide when empty; tests green.

### Slice 7: « Comment marche l'Elo » + modale du détail

**Value**: anyone can understand why their note moved, without leaving the page.
**Path**: rail explainer card (tuile icône, 2 chiffres, lien) → opens modal M1 → Glicko-2 copy in the design layout (formule encadrée, 4 étapes, EXEMPLE) → close via Échap / scrim / ✕ / « Compris ».
**RED**: `latestRatingExample(events)` — most recent match as `{winner, loser, before/after, deltas}`, null when none. Mutants: recency comparison, winner/loser swap.
**GREEN**: selector + modal component (scrim blur, entry animation, `stopPropagation` on panel, Échap listener) + adapted French copy: départ 1500, probabilité de victoire, transfert pondéré (marge × enjeu), fiabilité ± / provisoire.
**Done when**: modal opens/closes per spec in both themes; example shows the latest real match.

### Slice 8: Responsive, dark polish, dead-code sweep

**Value**: the page holds up on every phone in the office, and the codebase stays clean.
**Path**: `RESPONSIVE.md` rules for this page — grid stack (rail after main), compact stat tiles, delta column hidden < 380px, hover behind `(hover:hover)`, fluid title/chiffres clamps, reduced-motion; then remove now-unused Ratings CSS/markup (old header, rt-table styles, faits marquants if dropped — see open questions).
**RED/GREEN**: CSS/markup slice — no unit seam; suite stays green, `npm run build` passes; validated at 375/402/768/1024/1320 in both themes (by Thibault).
**Done when**: no visual regressions desktop, mobile usable, no orphan styles.

## Decisions from plan review (2026-07-30)

1. **Journal des calculs + « Recalculer »**: kept, tucked away — journal linked discreetly from
   the « Comment marche l'Elo » card/modal, Recalculer as a small admin link at page bottom.
2. **« Faits marquants » section**: dropped from Classement (records live on Stats + dashboard).
3. **Streak badge**: shows from **≥ 3** consecutive wins.

## Pre-PR Quality Gate

1. Mutation testing on all new selectors (`mutation-testing` skill, diff-vs-branch run)
2. Refactoring assessment (`refactoring` skill)
3. `tsc -b` + `npm run test` green; `npm run build` passes
4. Visual validation by Thibault: light + dark, 375→1320px, empty/loading/error states

---
*Delete this file when the plan is complete. If `plans/` is empty, delete the directory.*
