# Design brief: Seasons (« Les saisons »)

Input brief for Claude design. Goal: produce a high-fidelity prototype (same deliverable style as
`dashboard-handoff/`) for the season banner, the ladder scope selector, and their states.

Engineering spec (data model, rules, edge cases):
[`docs/superpowers/specs/2026-08-12-seasons-design.md`](../superpowers/specs/2026-08-12-seasons-design.md).

## Context

- Office ping-pong app, **UI is in French**. Existing design language: the revamped dashboard
  (see `docs/design/dashboard-handoff/README.md`) — same tokens, light + dark themes, generous
  sizing, tooltips/hover states specified from v1.
- Two pages are touched: the **dashboard home** (`src/components/Home.tsx`) and
  **« Le classement »** (`src/components/Ratings.tsx`, the Glicko-2 Elo ladder).
- Audience: everyone in the office, mostly desktop; must also work on mobile.
- **No backend change.** Every element below maps to data the app already computes.

### What a season is

A **three-month competitive period**, anchored on la rentrée and named after real seasons:

| Season | Window | Label |
|---|---|---|
| Automne | 1 Sep → 30 Nov | « Saison Automne 2026 » |
| Hiver | 1 Dec → end of Feb | « Saison Hiver 2026-27 » |
| Printemps | 1 Mar → 31 May | « Saison Printemps 2027 » |
| Été | 1 Jun → 31 Aug | « Saison Été 2027 » |

The first season ever is **« Saison Automne 2026 », 1 Sep → 30 Nov 2026**. There are no seasons
before that; older history is « Avant les saisons » and lives only in the lifetime ladder.

### The rules that matter for design

- **Hard reset.** At each season start every player's Elo goes back to 1500. A season's ranking is
  computed from that season's matches only.
- **The crown needs 10 games.** A player with fewer than 10 games in the season is « provisoire »
  and **cannot win the title**, even at the top of the table. This label already exists in the app;
  it now carries a second meaning that must be discoverable *during* the season, not learned at the
  end.
- **A season can end with no champion**, if nobody reached 10 games. Do not crown a provisional
  player as a fallback.
- **The lifetime ladder survives** as « Tous les temps » — today's ladder, unchanged.

---

## 1 · Season banner — dashboard home

New element on the dashboard. It shares the top of the page with `LiveHero`, which turns coral when
a match is live — **a live match should still win the eye**. Design decides whether the banner is a
slim band beneath the hero or a card in the side rail; propose what balances best against the
existing "Live hero + 2-column" layout.

Content while a season runs: season name, time remaining, current leader (avatar + name + rating).
Content once it closes: the champion, with podium.

## 2 · Season header — « Le classement »

The same information, denser, sitting with the page header. It states the identity of whichever
scope is selected — current season, a past season, or « Tous les temps » — so the table below is
never ambiguous about what it is showing.

## 3 · Scope selector — « Le classement »

Switches the ladder between:

- the current season (default)
- any past season, newest first
- « Tous les temps » (lifetime)

**It grows.** Four seasons a year means nine entries by late 2028 and it never shrinks, so a
segmented control will not hold. A dropdown is the obvious answer, but the form is design's call —
just make it scale to ~20 entries without becoming a wall.

## 4 · Stats page — one added filter chip

`src/components/Stats.tsx` already has a Période control: `Tout · Ce mois-ci · Cette semaine`.
Add **« Cette saison »**. Decide the chip order. This is likely no more than a placement decision —
flag it if you think it needs more.

## 5 · Eligibility microcopy

« provisoire » already appears next to under-10-game players. It now also means "not eligible for
the title". Design the affordance — tooltip, helper line, a count toward 10 — that makes this
obvious before the season ends.

---

## States to design

Several of these are live for **weeks at a time**, so none is a throwaway edge case.

| # | State | When it is on screen | Notes |
|---|---|---|---|
| 1 | Pre-season | until 1 Sep 2026 | « La première saison commence le 1er septembre ». The only state anyone sees at launch |
| 2 | Running, no eligible leader | first ~2 weeks of **every** season | Nobody has 10 games yet. Show the leader as leader — never as champion |
| 3 | Running, leader known | most of the season | Season name, leader, rating, days left |
| 4 | Final days | last week | Does this earn an urgency treatment, or stay calm? Your call — argue for one |
| 5 | **Closed — champion crowned** | 30 Nov, 28 Feb, 31 May, 31 Aug | The celebration. The whole "winner moment" goal rests on this state |
| 6 | Closed — no champion | a quiet season where nobody hit 10 games | Must read as a fact, not a failure. Nobody crowned by default |
| 7 | Viewing a past season | archive browsing | Read-only, clearly not "now" |
| 8 | Viewing « Tous les temps » | archive browsing | No season chrome at all — today's ladder |
| 9 | Season with zero matches | rare, possible early | Existing empty-state pattern |

Each in **light + dark**, **desktop + mobile**, matching the frame matrix in
`dashboard-handoff/README.md`.

State 5 deserves the most attention: it is the payoff for the entire feature, and it arrives at
midnight with nobody watching — so it has to still land when someone opens the app the next
morning. It also has to survive being on screen for three months, until the next season closes.

---

## Out of scope (v1)

- **Palmarès / hall of fame.** No dedicated page listing past champions. Archives are reached
  through the scope selector only.
- **Season grouping in « Les parties ».** The match history keeps its current filters.
- **Badges, rewards, tiers, promotion/relegation.**
- **Any admin UI.** The cadence is fixed in code; nobody starts, ends, or renames a season.
- **Notifications.** No Slack post, no email when a season closes.

## Open questions for design

1. Banner placement on the dashboard: band under `LiveHero`, or side-rail card? Which survives a
   live match without competing with it?
2. Does the crowned-champion state (5) reuse the tournament champion visual language (confetti,
   `Champion.tsx`, `FinalStandingsCard`), or does a season win deserve its own, calmer treatment
   given it stays on screen for months?
3. Does « Cette saison » make « Ce mois-ci » redundant on the stats page?
