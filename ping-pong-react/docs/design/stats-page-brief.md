# Design brief: Stats page revamp ("Les stats")

Input brief for Claude design. Goal: produce a high-fidelity prototype (same deliverable
style as `dashboard-handoff/`) for a revamp of the Stats page (`src/components/Stats.tsx`).

## Context

- Office ping-pong app, **UI is in French**. Existing design language: the revamped
  dashboard (see `docs/design/dashboard-handoff/README.md`) — same tokens, light + dark
  themes, generous sizing, tooltips/hover states specified from v1.
- Charts use **nivo** in the codebase; design charts so they are reproducible with nivo.
- The Stats page is the **all-time, collective** page: every finished match (quick games +
  tournaments) cumulated. It answers: *who dominates, who plays, what are the legendary
  moments?*
- **Decision already taken:** the player table **stays on this page**. The Elo ranking
  page ("Le classement") remains a separate page — do not merge them. Elo/Glicko numbers
  belong there, not here (at most a cross-link).
- Audience: everyone in the office, mostly desktop; must also work on mobile.

## Page structure (top to bottom)

1. Header (existing pattern: eyebrow "Statistiques", title, subtitle, theme toggle, back)
2. **Global filters** (new)
3. KPI strip
4. Activity chart
5. Player leaderboard (table) + player detail modal on row click
6. Team standings ("pôles")
7. Records ("Records")
8. Head-to-head matrix ("Confrontations directes")
9. Rivalries ("Rivalités")

### 2. Global filters (NEW)

Two segmented controls that scope **every** section below them:

- **Période**: `Tout` (default) · `Ce mois-ci` · `Cette semaine`
- **Type**: `Tout` (default) · `Tournois` · `Parties rapides`

Design a compact, sticky-friendly presentation (they should not dominate the page).
Show a subtle "filtered" indicator when a non-default filter is active.

### 3. KPI strip

| KPI | Label (FR) | Notes |
|---|---|---|
| Matches played | Matchs joués | exists |
| Players | Joueurs | exists |
| Total points scored | Points marqués | exists |
| Total play time | Temps de jeu | NEW — sum of match durations, e.g. "14 h 32" |

### 4. Activity chart

- Matches per day, bar chart (exists). Hover tooltip per bar: date + count (exists).
- NEW: consider a small **weekday profile** companion (Mon–Fri distribution) — optional,
  design if it fits without clutter.
- State: hidden when fewer than 2 distinct days.

### 5. Player leaderboard (the table — kept on this page)

Sortable columns (click header to sort, active sort indicated):

| Column | Label | Notes |
|---|---|---|
| Rank + player | Joueur | avatar + name (exists) |
| Played | J | exists |
| Wins | V | exists |
| Losses | D | exists |
| Win rate | % | exists |
| Point diff | Diff | signed, colored (exists) |
| Current streak | Série | 🔥 prefix at ≥2 (exists) |
| **Form** | Forme | NEW — last 5 results as W/L dots (green/red), most recent last |
| **Titles** | 🏆 | NEW — tournaments won (from `tournaments.champion`); blank when 0 |
| Match balls saved | BM ✓ | exists — keep, with tooltip |
| Match balls wasted | BM ✗ | exists — keep, with tooltip |

That is 11 columns on desktop. Design the **mobile presentation** explicitly (priority
columns: Joueur, J, V, %, Série, 🏆 — the rest collapse into the modal).

The former "Taux de victoire" bar chart (top-8 win rates) is **removed** — it repeated
the `%` column. Its slot is freed for the new sections below.

### 5b. Player detail modal (on row click) — enriched

Existing content to keep:
- Header: avatar, name, team
- KPIs: Matchs, % victoires, V-D, Diff, Série, Meilleure série, Capots infligés,
  Sous la table, Balles de match sauvées / gâchées
- Bête noire (worst matchup) + Victime favorite (best matchup), with W-L
- Derniers matchs (last 8: W/L badge, opponent, score, date)

New content to add:
- **Palmarès**: tournaments won (count + names/dates of the tournaments), only if ≥1
- **Moyennes**: avg points scored / conceded per match (from pointsFor/pointsAgainst)
- **Temps de jeu**: total time played + average match duration
- **Dernier match**: "last seen" date
- **Bilan par adversaire**: full opponent list (name, W-L, mini win-rate bar), collapsed
  behind "Voir tous les adversaires" if long — data (`opponentRecords`) already computed

### 6. Team standings ("Classement des pôles")

Table (exists): Pôle (color dot), Joueurs, J, V, %.
- NEW: add point diff column for teams.
- Note in design: intra-team matches are excluded (keep the explanatory hint line).

### 7. Records

Card grid (existing `super-card` pattern: label / big value / sub line). Full inventory:

Existing cards to keep:
| Card | Value | Sub |
|---|---|---|
| Plus long match | duration | winner score loser |
| Plus court match | duration | winner score loser |
| Plus gros écart | +margin | match line |
| Match le plus serré | score | match line |
| Plus actif | player | n matchs |
| Plus longue série | player | n victoires d'affilée |
| Bourreau 🪑 | player | n capots infligés |
| Roi de la table 🙈 | player | n passages sous la table |
| Sang-froid 🧊 | player | n balles de match sauvées |
| Cardiaque 😰 | player | n balles de match gâchées |

Removed: **"Plus de points"** (redundant with "Match le plus serré" — long deuce games
win both).

New cards:
| Card | Value | Sub | Source |
|---|---|---|---|
| Serial winner 🏆 | player | n tournois gagnés | `tournaments.champion` |
| Marathonien ⏱️ | player | total play time | match durations |
| Homme des finales 🎯 | player | finals won / played | `rating_events.stakes` or bracket `GF`/finals |
| Remontada 🧗 | player | won a double-elim through the loser bracket | bracket metadata; hide if never happened |

All cards hide when their condition has never occurred (existing behavior — the grid
must look good with anywhere from 4 to 14 cards).

### 8. Head-to-head matrix

Keep the matrix (row beats column, W-L per cell, green/red advantage tint, hover
tooltip with full names — all exist). One fix: column headers currently show only the
first letter of each name. Use **2–3-letter abbreviations or mini avatars** instead.
Design the horizontal-scroll behavior for many players / mobile.

### 9. Rivalries

Keep as is: cards with both names (team colors), W–W score, split bar, "n matchs ·
X mène". Six most-played rivalries + a hint line naming the tightest duels.

## States to design

- **Empty** (no finished match yet): existing friendly empty state, keep.
- **Loading**: existing "Chargement…", fine to keep simple.
- **Error**: banner above content (exists).
- **Filtered-to-empty** (NEW): a period/type filter combination with no matches — show a
  clear "no matches for this filter" state with a one-tap reset.
- Both **light and dark** themes; desktop + mobile frames (same matrix approach as the
  dashboard handoff).

## Out of scope

- Elo/Glicko anything (separate page). At most a "Voir le classement Elo →" link.
- Predictions/betting stats (separate page).
- Chaos-mode stats and serve stats — the database does not store per-match chaos events
  or per-point serve data; do not design cards that can't be fed.
- Any backend/schema change. Every element above maps to existing data
  (`matches`, `players`, `tournaments`, `rating_events`).

## Open questions for design

1. Filters: segmented controls vs. pill dropdowns — pick what fits the header zone best.
2. Weekday-profile mini chart: include only if it earns its place.
3. Records grid ordering: match records first vs. player records first — propose one.
