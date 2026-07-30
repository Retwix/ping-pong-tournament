# Plan: Tournois & parties (`/parties`)

**Branch**: `parties-page` → PR into `dashboard-revamp`
**Status**: Active (awaiting approval)
**Design source**: `~/Downloads/design_handoff_app_complete/README.md` §Page 2 + `DESIGN-SYSTEM.md`

## Goal

A new `/parties` page listing the full history — live match, tournaments table, matches
table — with working filter chips, search, sort and « Charger plus », reached from the
Accueil section links.

## Settled decisions (from handoff + memory, to confirm at approval)

- **Not a 5th tab.** Header keeps the 4 tabs (Accueil · Classement · Stats · Joueurs);
  on `/parties` no tab is active and a breadcrumb « ‹ Accueil » sits above the title.
  `DashboardNav`/`DashboardTabBar` `active` prop becomes optional (none active).
- **Entry points**: section header links on Accueil — « Tout voir → » (Tes tournois &
  parties) opens `/parties` filter `all`; « Historique → » (Résultats récents) opens
  `/parties` filter `match`. Route encodes the filter (`/parties`, `/parties?f=match`,
  `/parties?f=tour`) so the links and back button work.
- **Tournois block** lists `kind === 'tournament'` only; quick games (`kind === 'game'`)
  surface as matches in the Parties block. Finished tournaments show vainqueur +
  finaliste (2e des standings via `finalStandings`) + date de fin; active ones show an
  « EN COURS » state instead.
- **Parties block** lists all done matches (`listAllDoneMatches`), ELO column = winner's
  delta from `replayRatings` events (grey « — » for unrated e.g. capot/BYE edge cases),
  COMPÉTITION = tournament name or « Partie rapide », DATE from `ended_at`.
- **Subtitle** adapts the design copy to real data: « {n} matchs notés · {m} tournois
  terminés » (no season concept).
- **Pagination**: Parties table shows 10 rows initially; « Charger {min(20, restant)}
  matchs de plus » appends 20; button hidden when everything is shown.
- **Sort** « Plus récent ▾ » toggles to « Plus ancien ▴ », applies to both tables.
- **Search** (280px, « Joueur, tournoi… ») is accent/case-insensitive (same fold as
  classement): matches filter on player names + compétition; tournaments on name +
  vainqueur + finaliste.
- **Live block** shows when filter ≠ `tour` **and** a live match exists (reuse
  `pickLiveMatch` on the active tournament's matches, same data path as `LiveHero`);
  « ▶ Regarder » → `/live`, « Arbitrer » → `/ref`. No dead buttons anywhere; page
  « + Nouveau » reuses the existing `NewMenu`.
- **Pattern from Classement**: pure TDD'd selectors in `src/lib/parties.ts` (+ Stryker),
  CSS appended to `index.css` under a `pt-` prefix, breakpoint 820px, page shell via
  `DashboardNav`/`DashboardTabBar`.

## Acceptance Criteria

- [ ] `/parties` renders shell + breadcrumb + title + live-data subtitle; Accueil links navigate to it with the right filter
- [ ] Tournois table matches spec (vainqueur, finaliste, format, fin; en-cours state)
- [ ] Parties table matches spec (score, delta Elo, compétition, date) with working « Charger plus »
- [ ] Chips Tout / Parties · N / Tournois · N filter the blocks; search and sort work on both tables
- [ ] Live block appears only with a live match and filter ≠ tournois; Regarder/Arbitrer navigate
- [ ] Dark theme + 820px responsive pass; visuals validated by Thibault; PR merged into `dashboard-revamp`

## Slices

Every slice: RED → GREEN → MUTATE (Stryker on `src/lib/parties.ts`) → KILL MUTANTS →
REFACTOR, loading `tdd`, `testing`, `mutation-testing`, `refactoring` before code.
Per [[slice-commit-cadence]]: auto-commit each green slice; review happens at PR time.

### Slice 1 — Walking skeleton: route + shell + Accueil links

**Value**: a user can reach `/parties` from Accueil and sees the page header with real counts.
**Path**: Accueil section links → `navigate('/parties'…)` → `App.tsx` `parseRoute`/`renderRoute` (with `f` filter param) → `Parties.tsx` shell (nav, breadcrumb, title, subtitle, search box + « + Nouveau », empty content area) → data via `listAllDoneMatches` + `listTournaments`.
**RED**: `parseRoute`-level test for `/parties` (+ filter param) if testable; `lib/parties.ts` selector `historyCounts(matches, tournaments)` → `{ done, tournamentsDone }` driving the subtitle; Home link wiring covered at PR-review level (presentational).
**GREEN**: route + `Parties.tsx` shell + `pt-` header CSS + optional `active` on nav/tab bar + Accueil links.
**Done when**: navigating from Accueil shows the shell with real counts, tests green.

### Slice 2 — Tournois block

**Value**: the user browses all tournaments with winner/finalist/format/end-date at a glance.
**Path**: `listTournaments` (+ their matches for standings) → `tournamentRows` selector (kind filter, newest first, vainqueur + finaliste via `finalStandings`, format label, en-cours state) → table UI per spec.
**RED**: `tournamentRows`: excludes `kind:'game'`; orders newest first; done row carries vainqueur/finaliste/fin; active row flagged en-cours; format label (« Round robin · 6 joueurs » / « Double élimination · 8 joueurs »).
**GREEN**: selector + `PartiesTournois` table markup/CSS.
**Done when**: real tournaments render per spec, mutation report clean.

### Slice 3 — Parties block + pagination

**Value**: the user browses every finished match and loads more on demand.
**Path**: `listAllDoneMatches` + `replayRatings` events + `listTournaments` → `matchRows` selector (winner phrase, score, Elo delta by `matchId`, compétition, date) + `visibleSlice(rows, shown)` / `loadMoreLabel(remaining)` → table + button.
**RED**: `matchRows` (delta lookup, quick-game compétition label, unrated fallback, newest first); pagination: initial 10, +20 per click, label text, button hidden at end.
**GREEN**: selectors + `PartiesMatches` table + button wiring.
**Done when**: matches list with correct deltas paginates, mutation report clean.

### Slice 4 — Chips, search, sort

**Value**: the user narrows the history to what they're looking for.
**Path**: chips (Tout / Parties · N / Tournois · N ← route filter as initial state) toggle block visibility; search input → `filterMatchRows` / `filterTournamentRows` (shared fold); sort toggle → `sortRows(dir)` on both tables.
**RED**: chip-count selector; fold-based filtering on both row kinds (name, compétition, vainqueur/finaliste); sort asc/desc; pagination resets on filter/search change.
**GREEN**: chip bar + controlled search + sort button + selector wiring.
**Done when**: chips/search/sort behave per spec, counts match chips, mutation report clean.

### Slice 5 — Live block

**Value**: the user sees the table currently occupied and can jump to watch or referee.
**Path**: active tournament matches (same source as `LiveHero`) → `pickLiveMatch` → « En direct » card (pastille « 1 table occupée », avatars, score, Regarder → `/live`, Arbitrer → `/ref`), hidden when filter = `tour` or no live match.
**RED**: visibility rule selector (filter × live match presence); card data mapping (names, score, manche/serve meta).
**GREEN**: `PartiesLive` card reusing existing avatar/live helpers + CSS.
**Done when**: card shows/hides correctly and both actions navigate.

### Slice 6 — Dark theme, responsive, polish

**Value**: the page holds up on mobile and in dark mode.
**Path**: `pt-` dark-theme overrides; ≤820px: header stacks, search full width, tables drop secondary columns (FORMAT/FINALISTE, COMPÉTITION), tab bar spacing; hover/entrance interactions per design system.
**RED**: mostly presentational — any new conditional logic gets a selector test; otherwise visual verification by Thibault (no auto-browser).
**GREEN**: CSS + minor markup.
**Done when**: Thibault validates light/dark + mobile; acceptance criteria all checked.

## Mutation notes

Equivalent survivors in `latestEnd` (documented, not killable with realistic data):
- the two `null` guards: `new Date(null)` coerces to epoch 1970, so skipping either
  guard changes nothing for post-1970 ISO timestamps;
- `>` → `>=` on the date compare: only distinguishable when two matches end at the
  exact same instant, where both branches return an identical string.

## Pre-PR Quality Gate

1. Stryker run on `src/lib/parties.ts` — survivors addressed or documented as equivalent
2. Refactoring assessment (shared `fold`/format helpers extracted if duplicated)
3. `npm run typecheck` + lint + full test suite green
4. PR `parties-page` → `dashboard-revamp`, CI watched in background, merge on green, delete branch

---
*Delete this file when the plan is complete. If `plans/` is empty, delete the directory.*
