# Dashboard revamp — design brief

**Date:** 2026-07-24
**Screen:** Home (`src/components/Home.tsx`) — the app's landing page, referred to here as the "dashboard".
**Audience for this doc:** Claude design (visual/UX design pass) + implementation.

**Visual source of truth:** the high-fidelity handoff bundle `design_handoff_dashboard_home/`
(`README.md` + `Dashboard home.dc.html`, 8 frames across state × theme × form factor). That
bundle specifies final colors, typography, spacing, radii, shadows, and interaction states;
this doc captures the product intent and the resolved scope decisions. Where the two overlap,
the handoff wins on visuals and this doc wins on scope.

---

## 1. Why we're doing this

The Live view and the Ref view have both been revamped into rich, polished screens. The
dashboard has not — it's still a plain launchpad: a header, a toolbar of link buttons
(Live, Arbitre, Pronos, Classement, Stats, Joueurs, + Nouveau), and a flat list of
tournament/game cards. It works, but it says nothing about what's actually happening.

**Goal:** turn the dashboard into a *living home base* for the office ping-pong scene.
A glance should answer three questions instantly:

1. **Is anyone playing right now?**
2. **Who's on top?**
3. **What just happened?**

Navigation and actions (start a game, open a tournament) stay one tap away but no longer
dominate the page. This is a **glanceable hub**, not a launchpad.

---

## 2. Layout direction

**"Live hero + 2-column."** Chosen for calm scannability and predictable responsive behavior.

```
══ NAV BAR ═══════════════════════════════
┌──────────── 🔴 LIVE HERO ──────────────┐
│  Alice 📸   7 – 5   📸 Bob      → Live   │
└─────────────────────────────────────────┘
┌──── MAIN (≈2fr) ────┐   ┌── SIDE (≈1fr) ──┐
│ Your tournaments     │   │ Top players      │
│  [card] [card] [+New]│   │  1 Alice  1620 ↑ │
│                      │   │  2 Bob    1580 ↓ │
│ Recent results       │   │ ───────────────  │
│  Alice bat Bob 11-7  │   │ Streaks & records│
│  Bob bat Cara 11-9   │   │  🔥 5 · upset · … │
└──────────────────────┘   └──────────────────┘
```

---

## 3. Frame — persistent navigation bar

Navigation is a **persistent nav bar** (not folded into content).

- **Desktop / wide (top bar):**
  - Left: brand ("Tournoi ping-pong").
  - Center/left links: **Accueil · Classement · Pronos · Stats · Joueurs**.
  - Right: theme toggle + a prominent **`+ Nouveau`** split CTA
    (Partie rapide / Nouveau tournoi — reuse today's `NewMenu` dropdown from `Home.tsx`).
- **Mobile (bottom tab bar, app-like):**
  - Four icon tabs + a center **`+`**: **Accueil · Classement · Stats · Joueurs · (+)**.
  - **Pronos** folds into an overflow or sits within the Classement area.
  - Theme toggle moves into a small menu (or the Accueil header).
- **Live / Arbitre are contextual**, not permanent nav items — they surface from the
  live hero, because they only matter when a match is running.

---

## 4. Content blocks

### Block 1 — Live hero (full width, top)

The emotional anchor of the page.

- **Match live:** both players with **photos**, a large live **score**, the target
  ("jeu en 11"), and a pulsing **LIVE** indicator dot. Primary tap → **Live** (spectator
  view); a secondary affordance → **Arbitre** (ref view).
  - Hero left-meta = **LIVE dot + "EN DIRECT" + "Jeu en 11"** (optionally tournament/round
    name). The handoff's "Manche 2" and "Arbitré par …" lines are **dropped** — matches are
    single games to target (no manche concept) and no referee identity is stored. See §8.
  - Per-player **Elo** shown from `useRatings`; **"au service"** derived via `serverIsA`.
  - Data: reuse `spectator.ts` state (already powers `SpectatorView`) + `useCurrentTournament`.
- **No match live (idle):** collapse to a **slim invite band** — one calm line
  ("Aucun match en cours — lance une partie") with a `+ Nouveau` button. The page never
  shows a dead gap, and the top of the page stays visually stable.

### Block 2 — Main column

- **Your tournaments & games (top of the column).** The existing cards, behavior
  unchanged: open on click, status/winner badge, winner-name highlight, and — importantly
  — the **trash/delete icon**. This sits at the top of the main column for fast hands-on
  access during testing. The `+ Nouveau` CTA also lives here.
  - Data: `useTournaments` (existing).
- **Recent results (below the cards).** The last ~5 **finished** games/matches across all
  tournaments: "**Alice** bat Bob 11-7 · il y a 20 min" — winner emphasized, relative
  timestamp. **Tapping a result opens the tournament/board it belongs to.**
  - Data: a new small selector that flattens finished games across tournaments, sorted by
    recency. Derived from existing tournament data — no schema change.

### Block 3 — Side rail (stacks under main on phone)

- **Top players (Elo).** Top 5 — photo, name, rating, and recent **Δ** (green ↑ / red ↓).
  The whole card links to **Classement**.
  - Data: `useRatings` + `useRatingDeltas`.
- **Streaks & records.** 2–4 flavor chips for personality: longest current win streak 🔥,
  biggest upset, capot count, most active player. Must **degrade gracefully** when data is
  thin (fewer chips, or a friendly placeholder).
  - Data: `stats.ts` / `playerHistory.ts`.

---

## 5. Responsive behavior

- **Wide screens:** nav bar → live hero (full width) → two columns (main ≈2fr / side ≈1fr).
- **Phone:** top nav → **bottom tab bar**; content stacks single column in this order:
  1. Live hero
  2. Your tournaments
  3. Top players
  4. Recent results
  5. Streaks & records

  Live / Arbitre remain reachable from the hero.

Truly responsive — "both equally." Neither phone nor desktop is a compromise.

---

## 6. Visual tone

Match the polished Live/Ref revamp:

- Generous sizing, player photos, soft cards, clear hierarchy.
- Subtle hover states and tooltips.
- Fully **theme-aware** (light/dark).
- **Every block has a defined loading state and empty state** so a brand-new install (no
  tournaments, no rated games, no history) still looks intentional rather than broken.

---

## 7. Data sources (all feasible with today's code)

| Block | Source |
|---|---|
| Live hero | `useCurrentTournament` + `spectator.ts` |
| Top players | `useRatings` + `useRatingDeltas` |
| Recent results | new selector over tournaments' finished games |
| Streaks & records | `stats.ts` / `playerHistory.ts` |
| Your tournaments | `useTournaments` |

No backend/schema changes required.

---

## 8. Resolved decisions

- **Idle hero:** slim invite band (never hide, never leave a gap).
- **Recent result tap target:** opens the result's tournament/board.
- **Mobile nav:** app-like bottom tab bar with a center `+`.
- **Tournament cards:** kept, with the trash icon, at the top of the main column for quick
  test access.
- **All four glanceable surfaces** (live strip, top players, recent results, streaks) are in.
- **Hero left-meta:** "Manche 2" and "Arbitré par …" are **dropped** (no manche/referee data);
  keep LIVE dot + "EN DIRECT" + "Jeu en 11".
- **Full-page brand-new-install empty state** (handoff mobile frames 1e/1h) is **descoped**.
  Per-block empty/loading states (idle hero, "no rated games yet", etc.) are still in — they
  fire in normal use.

---

## 9. Out of scope

- No new data model or Supabase schema changes.
- No changes to the Live, Ref, Classement, Pronos, Stats, or Joueurs screens themselves —
  only how the dashboard links to and previews them.
- No new charts (the side rail is compact stats, not a charting surface).
