# Dashboard UX Redesign — Proposal & Design Brief

> **Purpose of this document.** A deep-dive audit of the current Home dashboard plus a
> proposed new information architecture, written to be fed directly into Claude design
> as a brief. Scope: the **Home dashboard only** (`src/components/Home.tsx`).
> Target context: **desktop / big-screen** (laptop in the room, TV/projector).
> North star: **the ranking is the most important thing on the page.**

---

## 1. Current state (what exists today)

The dashboard is a single centered column (`.wrap`, `max-width: 760px`). It has:

1. A **header** — kicker ("Round-robin · live"), big title ("Tournoi ping-pong"), subtitle.
2. A **`.home-top` row** — a label ("Tes parties & tournois") on the left and, on the
   right, a single flat row of seven controls.
3. A **list of tournament/game cards** below, each linking into a Board, with a status
   badge ("En cours" / "Terminé") and a delete button.

### The seven controls, today, all at the same level

| Control | Route | What it actually does |
|---|---|---|
| 📺 Live | `/live` | Spectator display of whatever match is live *right now*. Stable shareable link — point a TV at it once. |
| 🧑‍⚖️ Arbitre | `/ref` | Referee scoring of the current live match. Stable link for a tablet at the table. |
| 🔮 Pronos | `/pronos` | Bettors' leaderboard — who predicts match outcomes best. Bragging rights, no money. |
| 🏓 Classement | `/classement` | **Elo ranking of players across all play.** Season-long competitive standing. |
| Stats | `/stats` | Deep statistics: head-to-head, rivalries, superlatives, activity charts. |
| Joueurs | `/players` | Roster management (add/edit/remove players, teams, Slack IDs). |
| + Nouveau | `/new`, `/game` | Split-button: start a quick game or a full tournament. |

---

## 2. The core problem

**Everything is a sibling.** Seven controls of three completely different *intents* sit in
one undifferentiated row of `.link-btn`s (plus one primary button). The user has to read
and weigh all seven every visit, and nothing signals what matters.

Three distinct intents are flattened together:

- **Act on the live match now** — Live, Arbitre. Time-sensitive, only relevant while a
  match is on the table.
- **See where everyone stands** — Classement, Pronos, Stats. The competitive payoff; the
  reason people keep coming back.
- **Set up & administrate** — Nouveau, Joueurs, and the tournament list itself.

Specific consequences:

1. **The ranking — your stated priority — is buried.** "🏓 Classement" is button #4 of 7,
   visually identical to "Joueurs" and "Stats". The single most important destination
   has zero prominence. It's a *click away* when it should be *the first thing you see*.
2. **No content on the landing page, only navigation.** The dashboard is a menu. It shows
   *links to* standings but never the standings themselves, so every visit costs a click
   before any payoff.
3. **Emoji-as-hierarchy.** Icons are doing the job that grouping, sizing, and layout
   should do. Emoji labels read as decoration, not structure.
4. **Time-sensitive actions are always-on.** Live/Arbitre are shown identically whether or
   not a match is in progress — so they're noise 90% of the time and easy to miss in the
   10% when they matter.
5. **Desktop space is wasted.** The 760px column is a mobile layout stretched onto a big
   screen. On a TV/laptop in the room there's room for a ranking centerpiece plus a side
   rail, but the current design leaves most of the viewport empty.

---

## 3. Design principles for the redesign

1. **Ranking-first.** The Elo classement is promoted from a button to the *hero content*
   of the dashboard. You should see the standings without clicking anything.
2. **Group by intent, not by feature.** Collapse seven flat siblings into three legible
   zones: *Standings*, *Live now*, *Manage*.
3. **Progressive disclosure.** Show a compact preview of the most important data (top
   players, podium) on the dashboard; deep views (full table, stats, pronos) stay one
   intentional click away.
4. **Contextual surfacing.** Live/Arbitre become prominent *only* when a match is on the
   table, and recede otherwise.
5. **Use the screen.** Adopt a wider desktop layout (centerpiece + side rail) instead of
   one narrow column.
6. **One clear primary action.** "+ Nouveau" is the single high-emphasis button; secondary
   destinations are visually quieter.

---

## 4. Proposed information architecture

Reorganize the seven controls into three named groups with explicit priority:

### Zone A — Standings (the hero)
The reason people open the app. **Ranking is the anchor.**

- **Classement (Elo)** — *primary, rendered inline as content.* Top-3 podium + a preview
  of the ranked table (≈ top 5–8), with a "Classement complet →" affordance to the full
  `/classement` view.
- **Pronos** — secondary card/tab within this zone.
- **Stats** — secondary card/tab within this zone.

### Zone B — Live now (contextual)
Only prominent when a match is in progress.

- **Match-in-progress banner** — when something is live: shows the current matchup + score,
  with two clear CTAs, **Regarder (Live)** and **Arbitrer**.
- When nothing is live: collapses to a single quiet line ("Aucun match en cours") or a
  small "Présentation / Live" entry — not a full-width call to action.

### Zone C — Manage (utility rail)
Setup and history, visually quieter than A.

- **+ Nouveau** — the one primary button (keep the quick-game / tournament split).
- **Joueurs** — roster management.
- **Tes tournois & parties** — the existing list, demoted to a "resume / history" rail
  rather than the centerpiece. Keep status badges and delete.

### Mapping summary

| Today (flat) | Proposed zone | Treatment |
|---|---|---|
| 🏓 Classement | A — Standings | **Hero content**, inline podium + table preview |
| 🔮 Pronos | A — Standings | Secondary card/tab |
| Stats | A — Standings | Secondary card/tab |
| 📺 Live | B — Live now | Contextual CTA (prominent only when live) |
| 🧑‍⚖️ Arbitre | B — Live now | Contextual CTA (prominent only when live) |
| + Nouveau | C — Manage | Primary button |
| Joueurs | C — Manage | Secondary link |
| Tournament list | C — Manage | Secondary "resume/history" rail |

---

## 5. Proposed desktop layout

Two-column layout on desktop/big-screen; gracefully stacks to one column on narrow
viewports. Suggested content width ≈ 1100–1200px (up from today's 760px).

```
┌────────────────────────────────────────────────────────────────────┐
│  Tournoi ping-pong            [+ Nouveau ▾]      [☀/🌙 theme]        │  ← slim header
├────────────────────────────────────────────────────────────────────┤
│  ▸ LIVE NOW  (only when a match is on the table)                     │
│  🔴 Alice 9 — 7 Bob · Round 2     [ Regarder ]  [ Arbitrer ]        │  ← contextual banner
├──────────────────────────────────────────┬─────────────────────────┤
│  CLASSEMENT  (hero)                       │  TES TOURNOIS            │
│                                           │  ┌─────────────────────┐ │
│        🥈        🥇        🥉             │  │ Tournoi du vendredi │ │
│       Bob       Alice     Carol           │  │ 6 joueurs · en cours│ │
│      1240      1310      1180             │  └─────────────────────┘ │
│                                           │  ┌─────────────────────┐ │
│  4. Dan    1150   ▲12                     │  │ Partie rapide       │ │
│  5. Erin   1120   ▼5                      │  │ terminé             │ │
│  6. Frank  1095   –                       │  └─────────────────────┘ │
│  …                                        │                         │
│  [ Classement complet → ]                 │  ── Gérer ──            │
│                                           │  Joueurs                │
│  ── tabs/cards ──                         │                         │
│  [ Pronos ]   [ Stats ]                   │                         │
└──────────────────────────────────────────┴─────────────────────────┘
```

Key moves:
- **Left/main column = the ranking.** Podium for top 3, then a ranked preview with Elo and
  trend arrows (the `Trend` component already exists in `Ratings.tsx`), then a single link
  to the full classement. Pronos and Stats live just beneath as secondary cards or tabs.
- **Right rail = manage.** Tournament/game list (resume + history) and Joueurs. Quieter
  than the hero.
- **Live banner spans the top** of the content area and is only emphasized when a match is
  in progress; otherwise it's a thin, low-contrast row.
- **+ Nouveau** moves into the header as the single primary action.

### Idle vs. live states
- **Live:** banner is full-color (use `--coral` / `--serve`), shows matchup + score, two CTAs.
- **Idle:** banner collapses to one muted line; the ranking hero remains the focus.
- **Empty (no players/tournaments yet):** hero shows an inviting empty state pointing at
  "+ Nouveau" and "Joueurs" — reuse the existing `.empty` style.

---

## 6. Component spec for the design step

Components to design (new or restyled). All should consume existing CSS variables (§7).

1. **`DashboardHeader`** — app title, primary "+ Nouveau" split-button (reuse `NewMenu`
   logic from `Home.tsx`), theme toggle. Slim, full-width.
2. **`LiveBanner`** — contextual. Props: current match (players, scores, round) or null.
   Two CTAs → `/live`, `/ref`. Two visual states (active / idle). Data source already
   exists via the pattern in `useCurrentTournament` / `CurrentView`.
3. **`RankingHero`** — the centerpiece. Podium (top 3) + ranked rows (Elo + trend arrows)
   + "Classement complet →". Data from `useRatings` (already used by `Ratings.tsx`).
   Reuse `Avatar` and `Trend`.
4. **`StandingsSecondary`** — Pronos + Stats as two cards or a small tab strip beneath the
   hero. Each is a short teaser + link to `/pronos` and `/stats`.
5. **`ManageRail`** — right column: tournament/game list (the existing `.t-card` markup,
   restyled) + a "Joueurs" entry. Keep status badges and delete-with-confirm.

Routes are unchanged — this is a presentation/IA reshuffle of the Home screen. Every
destination already exists (`/classement`, `/pronos`, `/stats`, `/players`, `/live`,
`/ref`, `/new`, `/game`, `/t/:id`).

---

## 7. Visual system (reuse — do not reinvent)

The app already has a mature design system in `src/index.css` (light + dark). The redesign
should reuse it so the new dashboard drops in seamlessly.

- **Brand:** `--coral` (#d74251) accent/eyebrow, `--purple`/`--primary` (#4a2aa4) primary.
- **Surfaces:** `--bg`, `--surface`, `--border` / `--border-strong`.
- **Text:** `--fg-1` … `--fg-4` (primary → faint).
- **Elevation:** `--shadow-card`, `--shadow-card-hover`, `--shadow-pop`.
- **Live/serve accent:** `--serve`, `--serve-soft`, `--serve-ring` — ideal for the LiveBanner.
- **Type:** display `Outfit` (`--font-display`), body `DM Sans` (`--font-body`).
- **Motion:** `--ease` `cubic-bezier(0.2,0.7,0.2,1)`, `--dur` 220ms.
- **Existing classes to lean on:** `.wrap`, `.kicker`/`.eyebrow`, `.section-title`,
  `.t-card`, `.t-badge`, `.link-btn`, `.btn-primary`, `.empty`, `.avatar`, `.rt-trend`.
- **Medals:** podium gold/silver/bronze conventions already appear in `Leaderboard` (🥇🥈🥉)
  and `--gold` / `--orange`.
- **Dark mode is first-class** — every token has a dark variant; design both.

---

## 8. Handoff prompt for Claude design

> Redesign the **Home dashboard** of a ping-pong tournament web app (React, single
> centered column today) for **desktop / big-screen**. The **player ranking (Elo
> classement) must be the visual hero** — render the standings as inline content (top-3
> podium + a preview of the ranked table with Elo and up/down trend arrows + a link to the
> full ranking), not as a button.
>
> Reorganize today's seven flat controls into three zones:
> **(A) Standings** — Classement as the hero, with Pronos and Stats as secondary cards/tabs
> beneath it; **(B) Live now** — a contextual banner with "Regarder" and "Arbitrer" CTAs
> that is prominent only when a match is in progress and recedes otherwise; **(C) Manage** —
> a quieter right rail holding the "+ Nouveau" primary action, the tournament/game list
> (resume + history, with status badges), and "Joueurs".
>
> Use a two-column desktop layout (≈1100px) that stacks to one column on mobile. Reuse the
> existing design tokens: coral (#d74251) accent, purple (#4a2aa4) primary, Outfit display
> + DM Sans body fonts, soft card shadows, and full light/dark theming. Provide both an
> idle state (no live match, ranking is the focus) and a live state (colored banner with
> matchup + score). The UI copy is in French.

---

## 9. Out of scope / open questions

- **Per-tournament Board** (`Board.tsx`) has a similar flat-features problem (share bar,
  live/ref, predictions, standings stacked). Not covered here per the agreed scope — worth
  a follow-up.
- **Global navigation** across all views (persistent sidebar/topbar) is not addressed;
  each view still uses its own `TopBack`. Could unify later.
- **Ranking semantics:** the dashboard hero should show the **Elo classement** (`/classement`,
  season-long, the priority). Confirm this is the intended "ranking" rather than a single
  tournament's standings.
- **Live data on the dashboard:** rendering the ranking inline means the dashboard now
  subscribes to `useRatings` (and optionally the live-match pointer). Confirm that's
  acceptable for load.
