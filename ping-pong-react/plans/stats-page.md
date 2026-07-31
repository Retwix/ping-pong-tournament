# Plan: Stats page revamp — design handoff implementation

**Branch**: stats-page (PR into dashboard-revamp)
**Status**: Active

## Goal

Rebuild `/stats` to match `~/Downloads/design_handoff_app_complete/StatsPage.dc.html` — dashboard shell, global period/type filters, enriched leaderboard + fiche joueur, new records, restyled activity/pôles/H2H/rivalités.

## Sources

- Prototype: `StatsPage.dc.html` (source of truth for layout/behavior)
- Spec: handoff `README.md` §Page 4 + `DESIGN-SYSTEM.md` tokens
- Product brief: `docs/design/stats-page-brief.md` (column inventory, records inventory, modal content)
- Audit: `docs/stats-page-audit.md`

## Settled decisions (from memory + brief)

- Shell via `DashboardNav`/`DashboardTabBar` with `active="stats"`; no breadcrumb (tab page).
- No Elo/Glicko numbers on this page — only the « Voir le classement Elo → » link (→ /classement).
- Pure TDD'd selectors in `src/lib/statsPage.ts` (new; `src/lib/stats.ts` keeps domain computations, extended where needed). Stryker on the new/changed lib code; equivalent survivors documented here.
- Page CSS appended to `index.css` with `st-` prefix; breakpoint 820px (house convention).
- Modals: `.scrim`/`.modal` + Échap pattern (see EloModal).
- Filters are URL-driven (`/stats?p=mois|semaine&t=tournois|rapides`) like `/parties?f=…`.
- Charts: hand-rolled CSS bars per prototype (nivo only for line charts elsewhere).
- « Plus de points » record removed; win-rate bars section removed (redundant with % column).
- Data: extend `useStats` to also load tournaments (titles, type filter, finals, remontada). No schema change.

## Filter semantics (decided)

- « Ce mois-ci » = same calendar month as now; « Cette semaine » = ISO week, Monday start. `now` injected for purity.
- « Tournois » = match's tournament has `kind === 'tournament'`; « Parties rapides » = `kind === 'game'`; match with unknown tournament only appears under « Tout ».
- Every section below the filter bar reads the scoped match list.

## Slices

Every slice: RED → GREEN → (MUTATE deferred to one Stryker pass over the finished lib) → REFACTOR → commit green.

### Slice 1 — Filter engine (lib)
`parseStatsFilters`/`statsSearch` (URL round-trip), `scopeMatches(matches, tournaments, filters, now)`, `periodLabel`/`typeLabel`/`filterPillLabel` (« Filtré · Ce mois-ci · Tournois »), `scopeLabel` (« 156 matchs · tout · tout »).
**Done when**: selectors covered by behavioral tests incl. month/week boundaries, unknown tournament, empty query.

### Slice 2 — Shell + filter bar UI
Stats.tsx rewritten on the rv shell (nav/tabbar active stats, title + subtitle « Toutes les parties terminées, parties rapides et tournois cumulés. », Elo link, sticky glass filter bar with PÉRIODE/TYPE segments, coral reset pill when filtered, scope label). Route `/stats` parses filters; chips push URL. Global empty kept; filtered-to-empty card (🏓 + « Réinitialiser les filtres »). `useStats` loads tournaments.
**Done when**: page renders on new shell, filters drive URL and scope, both empty states reachable.

### Slice 3 — KPI strip
4 KPIs: Matchs joués (sub « +N cette semaine » unfiltered / « sur la période filtrée »), Joueurs (ayant joué ≥1 match dans le scope), Points marqués (fr-FR format, unit pts), Temps de jeu (« 14 h 32 », sub « ≈ N min par match » over timed matches). Lib: `statsKpis(scoped, now)` + `fmtPlayTime`.

### Slice 4 — Activité
Bar chart matchs/jour on scoped matches (rounded purple bars, hover tooltip date + count, axis first/mid/last, range label « N jours d'activité »); « Par jour de semaine » horizontal bars (Lun–Ven always, Sam/Dim only when > 0, max highlighted). Hidden under 2 distinct days. Lib: `activityDays`, `weekdayProfile`, `chartRangeLabel`.

### Slice 5 — Classement des joueurs
`computePlayerStats` extended: `form` (≤5 last results, most recent last), `playTimeMs`, `lastPlayedAt`. New `titlesByPlayer(tournaments, matches)` (count + list {name, date} from done tournaments' champions). `sortPlayerRows` (default wins desc; click toggles dir; name asc first). UI: 12 columns (#, Joueur+team dot, J, V, D, %, Diff, Série 🔥, Forme dots, 🏆, BM ✓, BM ✗), sortable headers with ▲▼ + tooltips, row click → fiche. Mobile ≤820px: keep Joueur, J, V, %, Série, 🏆.

### Slice 6 — Fiche joueur (modal)
Header avatar/name/team + « dernier match {relatif} ». 12 KPI grid (Matchs, % victoires, V — D, Diff, Série, Meilleure série, Pts pour/contre en moyenne, Temps de jeu, Durée moyenne, Capots · sous la table, BM sauvées, BM gâchées). Palmarès chips (si ≥1 titre). Bête noire / Victime favorite. Derniers matchs (8, 2 col). Bilan par adversaire (win-rate bar per opponent, top 4 + « Voir tous les adversaires »). Échap/scrim close. Lib: `playerCard(key, …)` selector building the whole view model.

### Slice 7 — Classement des pôles
`computeTeamStats` gains `diff` (points inter-pôles only). Table + Diff column (signed, colored) + « À savoir » dashed card (intra-team exclusion hint).

### Slice 8 — Records
Two groups. Joueurs: Serial winner 🏆 (plus de titres), Plus longue série 🔥, Plus actif 📈, Marathonien ⏱️ (temps cumulé), Homme des finales 🎯 (finales jouées · gagnées via `stakesOf`), Remontada 🧗 (champion double élim passé par le loser bracket), Bourreau 🪑, Roi de la table 🙈, Sang-froid 🧊, Cardiaque 😰. Matchs: Plus long ⌛, Plus court ⚡, Plus gros écart 📏, Plus serré 😬. Chaque carte cachée si jamais advenu. « Plus de points » supprimé. Lib: `finalsByPlayer`, `remontadas`, records assembly.

### Slice 9 — Confrontations directes + Rivalités
H2H: `abbrev(name)` 3-letter headers (tooltip nom complet), avatar + nom en tête de ligne, cellules teintées green/red/neutral avec tooltip « A x — y B », scroll horizontal (min-width). Rivalités: cartes prototype (noms aux couleurs d'équipe, score, barre partagée, « n matchs · X mène »), hint « Les duels les plus serrés : A — B (x–y)… » avec scores.

### Slice 10 — Cleanup
Remove WinRateBars + ActivityChart (unused after revamp), old stats CSS block (keep `pd-*` used by PlayerModal.tsx), old shell imports. Typecheck/lint/build/test green.

## Pre-PR Quality Gate

1. Stryker on `src/lib/statsPage.ts` + changed parts of `src/lib/stats.ts` — kill or document survivors below.
2. Refactoring assessment.
3. `npm run typecheck` (tsc) + lint + `npm test` + build.
4. PR → dashboard-revamp, CI green, merge, delete branch (house flow).

## Mutation report / documented equivalent survivors

Stryker (vitest runner), 2026-07-31:

- `src/lib/statsPage.ts` — **91.66%** (791 killed / 69 survived / 3 no-cov), up from 78.79%
  after two hardening passes (options literals, record cards, sort keys, tones, month labels,
  weekday Dim, boundary plurals, b-side matches, losing-player card).
- `src/lib/stats.ts:89-262` (the functions this PR changed) — **82.61%** (133 killed /
  25 survived), up from 66.46% (added: both-sides play time/timedMatches/lastPlayedAt,
  shuffled-input form, match-ball split, zero/live durations, ranked team standings).

Documented equivalent / accepted survivors:

1. **Score-tie mutants** (`score_a > score_b` → `>=`, `win: my > their` → `>=`) — a ping-pong
   match cannot end level; the flipped branch is unreachable with real data.
2. **Week-boundary instant** (`d >= start` → `>`, `d < end` → `<=` in `inPeriod`) — differs
   only for a timestamp at exactly local Monday 00:00:00.000; match timestamps are recorded
   mid-play, and a TZ-fixed test would be flaky across CI/dev timezones.
3. **`fmtInt` regex quantifier** (`(\d{3})+` → `(\d{3})`) — only diverges at ≥ 7 digits;
   total points cannot plausibly reach 1 000 000.
4. **Duration guard shadowing** (`started_at && ended_at` → `||`, `ms > 0` → `true` in
   `statsKpis`) — `matchDuration` itself guards `started_at` and returns ≥ 0, making the
   outer mutants observationally equivalent for the summed total (killed where observable
   via `timedMatches` in `computePlayerStats`).
5. **Tie-break arms shielded by upstream ordering** (victim `wins` tie-break, balances
   games tie-break variants, finalist `won` tie-break, remontada count sort) — the primary
   key or the preceding sort already fixes the order for every reachable input shape.
6. **Unreachable fallbacks** (`?? []` on a key just inserted, `?? p` label fallback for
   values constrained by the union type, junk-array mutant of the ignored `tournaments`
   argument in the weekly recount).
7. **`lastPlayedAt` ordering equivalents** — matches are processed oldest-first, so the
   "always overwrite" mutant lands on the same final value.
8. Remaining survivors in `stats.ts` sit in pre-existing name/team fallback plumbing
   (`computePlayerStats` ensure maps, `teamFor` chains) untouched by this PR.

---
*Delete this file when the plan is complete.*
