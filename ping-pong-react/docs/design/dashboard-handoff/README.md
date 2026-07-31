# Handoff: Dashboard (Home / Accueil) revamp

## Overview
Revamp of the app's landing page (`src/components/Home.tsx`, referred to as the **dashboard**) from a plain launchpad into a **glanceable living home base** for the office ping-pong scene. At a glance it answers three questions: **is anyone playing right now?**, **who's on top?**, and **what just happened?** Navigation and actions (start a game, open a tournament) stay one tap away but no longer dominate the page.

Layout direction: **"Live hero + 2-column."** No backend or schema changes are required — every block maps to data that already exists.

## About the design files
The files in this bundle are **design references created in HTML** (a Design Component prototype). They show the intended look, layout, and behavior — they are **not production code to copy directly**. The task is to **recreate these designs in the existing app codebase** (React + its current styling approach) using its established components, hooks, and patterns. Reuse the existing `NewMenu`, tournament card, spectator/ref views, and rating hooks rather than rebuilding them.

- `Dashboard home.dc.html` — the prototype. Open in a browser to view. It is a pan/zoom canvas holding 8 labeled frames (see **Screens** below). Frame labels (1a, 1b, …) appear as purple badges in the top-left of each frame.
- `ios-frame.jsx` / `support.js` — runtime scaffolding for the prototype only. **Do not port these**; the mobile frames just use a device bezel for presentation.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, shadows, and interaction states are all specified below and in the HTML. Recreate pixel-faithfully using the codebase's existing design tokens/components; the hex values here are the source of truth where the codebase has no equivalent.

## Screens / Views

The prototype shows the **same dashboard** across a matrix of **state × theme × form factor**:

| Frame | Form factor | Hero state | Theme |
|-------|-------------|-----------|-------|
| 1a | Desktop | Live match active | Light |
| 1b | Desktop | Idle (no match) | Light |
| 1c | Desktop | Live match active | Dark |
| 1f | Desktop | Idle (no match) | Dark |
| 1d | Mobile | Live match active | Light |
| 1e | Mobile | Empty (brand-new install) | Light |
| 1g | Mobile | Live match active | Dark |
| 1h | Mobile | Empty (brand-new install) | Dark |

### Desktop layout (1a/1b/1c/1f)
Vertical stack inside a max-width page container (prototype canvas ≈ 1268px content width) on the house gradient background:
1. **Nav bar** (persistent) — full width, glass card.
2. **Live hero** — full width. Coral gradient when a match is live; slim glass invite band when idle.
3. **2-column body** — CSS grid `grid-template-columns: 2fr 1fr; gap: 20px; align-items: start`.
   - **Main column (2fr):** "Tes tournois & parties" (card row) → "Résultats récents" (list).
   - **Side rail (1fr):** "Top joueurs" card → "Séries & records" card.

### Mobile layout (1d/1e/1g/1h)
Single column, `padding: 52px 14px 96px` (top clears status bar, bottom clears the tab bar). Persistent **bottom tab bar** replaces the top nav. Content stacks in this order per the brief: **Live hero → Tes tournois & parties → Top joueurs → Résultats récents → (Séries & records below the fold)**.

---

### Component: Nav bar (desktop)
- Glass card: `background: rgba(255,255,255,.72)` (light) / `rgba(255,255,255,.05)` (dark); `backdrop-filter: blur(14px)`; `border: 1px solid #ECE8F6` (light) / `rgba(255,255,255,.09)` (dark); `border-radius: 18px`; `padding: 11px 16px 11px 18px`; light shadow `0 4px 18px rgba(32,10,66,.06)`.
- **Left — brand:** 34×34 rounded-11px purple gradient tile `linear-gradient(135deg,#5B39C4,#4A2AA4)` holding a white loop/paddle glyph, + wordmark "Tournoi ping-pong" (Outfit 800/17px; "ping-pong" in `#4A2AA4` / dark `#C9B8FF`).
- **Center — links:** Accueil (active) · Classement · Pronos · Stats · Joueurs. Active = `#4A2AA4` on `#F0ECFB` pill (dark: `#fff` on `rgba(255,255,255,.09)`); inactive = `#6B6480` / dark `#A99FC4`, no fill. Outfit 700/600 · 13.5px · padding `8px 15px` · radius 10px.
- **Right — theme toggle** (segmented sun/moon pill, 30px circular options) **+ "+ Nouveau" split CTA**: purple `#4A2AA4` (dark `#5B39C4`) button with a divider and a chevron affordance opening the existing `NewMenu` dropdown (Partie rapide / Nouveau tournoi). Shadow `0 12px 26px rgba(74,42,164,.3)`.

### Component: Live hero — ACTIVE (1a/1c/1d/1g)
The emotional anchor. Coral gradient `linear-gradient(105deg,#D74251 0%,#BE3341 55%,#93283A 100%)` (mobile: `120deg,#D74251,#A82B38`); `border-radius: 22px` desktop / 18px mobile; shadow `0 22px 50px rgba(215,66,81,.32)`; a subtle top-right white radial highlight overlay.
- **Left meta (desktop):** pulsing white **LIVE dot** (`@keyframes rvpulse`) + "EN DIRECT" (Outfit 800/12px, letter-spacing .16em), then "Manche 2 · jeu en 11" and "Arbitré par Candice".
- **Center matchup:** Player A (name Outfit 800/22px white + "1487 Elo · au service"), 60px avatar with 3px white ring, big score **7 – 5** (Outfit 900/56px desktop, 42px mobile), Player B avatar + name/Elo. Avatars: A = `linear-gradient(160deg,#6B4AD1,#4A2AA4)`, B = `linear-gradient(160deg,#F0899A,#D74251)`, both initials in white.
- **Actions:** **Regarder** — primary (white fill, coral `#BE3341` text, play glyph) → opens **Live** (spectator view). **Arbitrer** — secondary (`rgba(255,255,255,.14)` fill, `1.5px rgba(255,255,255,.55)` border, white text) → opens **Arbitre** (ref view).
- Data: `useCurrentTournament` + `spectator.ts` (same state that powers `SpectatorView`).

### Component: Live hero — IDLE (1b/1f)
Never hidden, never a gap. Slim glass band: `background: rgba(255,255,255,.66)` / dark `rgba(255,255,255,.04)`; `border-radius: 18px`; 44px rounded clock icon tile; heading "Aucun match en cours" + subline "Lance une partie — le score en direct apparaîtra ici pour tout le bureau."; right side "**+ Nouveau match**" (purple primary) and "Mode présentation" (ghost). The top of the page stays visually stable vs. the active state.

### Component: Tournament / game cards ("Tes tournois & parties")
Row of cards (desktop: `grid 1fr 1fr 1fr`, mobile: 1 card + compact "+"). Existing behavior unchanged — open on click, delete via trash icon.
- Card: white `#fff` / dark `#1E1138`; `border-radius: 16px`; `padding: 16px`; border `#E8E4F2` (live card border `#FBD4D9`); shadow `0 3px 12px rgba(32,10,66,.06)`.
- **Status badge** top-left: `EN COURS` = coral text `#D74251` on `#FEE7EE` pill with pulsing dot; `TERMINÉ` = green `#2BA572` outline pill. Winner name highlighted green (e.g. "**Candice** bat Sarah").
- **Trash icon** top-right (`.rvtrash`): `#A49EB3`, opacity .5, → opacity 1 on card hover, `#D74251` on its own hover. Keep this — it's used for fast test-cleanup.
- **"Nouveau" card:** dashed `1.5px #CDBDF0` border, `rgba(255,255,255,.5)` fill, centered + tile; triggers `NewMenu`.
- Hover (`.rvcard`): `translateY(-2px)` + shadow `0 14px 30px rgba(32,10,66,.15)`, 160ms `cubic-bezier(.2,.7,.2,1)`.
- Data: `useTournaments` (existing).

### Component: Recent results ("Résultats récents")
Card list (white/dark, radius 18px) of the last ~5 finished games across all tournaments, sorted by recency. Each row: 30px player avatar, "**Winner** bat Loser · **11–7**" (winner name + score emphasized in `#17082B` / white; connective text `#4A4458` / `#A99FC4`), relative timestamp right-aligned (`#A49EB3`), chevron. Row hover `.rvrow` → `#F2EFFB` (dark `.rvrowD` → `rgba(255,255,255,.05)`). Tapping a row opens the tournament/board that result belongs to.
- Data: **new derived selector** that flattens finished games across `useTournaments` data, sorted by recency. No schema change.

### Component: Top players ("Top joueurs")
Whole card links to **Classement**. Top 5 rows: rank number (1/2/3 tinted gold `#E8B53A` / silver `#AEB6C0` / bronze `#CB8E5E`; 4–5 muted `#847E96`), 34px avatar (rank 1 = solid `#4A2AA4`, others = `#E4DDF8`/`#4A2AA4`), name (Outfit 700/14px), Elo rating (rank 1 in `#4A2AA4`), and recent **Δ** (green `▲` `#2BA572` / red `▼` `#E54C4C`; dark `#4ED9A0` / `#FF7A7A`).
- Data: `useRatings` + `useRatingDeltas`.

### Component: Streaks & records ("Séries & records")
2–4 flavor chips. Degrade gracefully when data is thin (fewer chips / friendly placeholder).
1. **Longest current win streak** — flame icon, gradient chip `linear-gradient(100deg,#FFF3E9,#FDE9EE)`: "Maxime · 5 victoires d'affilée".
2. **Biggest upset** — trending-up icon on `#F7F5FD`: "Maxime a battu Léo · +21 Elo".
3. **Capots count** + **Most active player** — two half-width stat tiles on `#F7F5FD`.
- Data: `stats.ts` / `playerHistory.ts`.

### Component: Bottom tab bar (mobile)
Glass bar `rgba(255,255,255,.92)` / dark `rgba(19,7,38,.92)`, `backdrop-filter: blur(12px)`, top border, `padding: 8px 10px 24px`. Four icon tabs + a **center raised "+"** (52px purple circle, `margin-top:-22px`, 4px page-colored ring, shadow): **Accueil · Classement · (+) · Stats · Joueurs**. Active tab in `#4A2AA4` / dark `#C9B8FF`, inactive `#A49EB3` / `#8B82A8`. Pronos folds into Classement; theme toggle moves to the Accueil header. **Live / Arbitre are contextual** — reachable only from the hero, never permanent tabs.

### Component: Empty state (mobile 1e/1h)
Brand-new install (no tournaments, no rated games). Centered welcome card: 66px gradient icon tile, "Lance ta première partie", explanatory subline, "+ Nouveau match" CTA. Below: dashed placeholder rows for "Classement Elo" ("Encore aucun match classé") and "Joueurs" ("Ajoute ton équipe de bureau" · Ajouter →). Every block has an intentional empty state — the app never looks broken.

## Interactions & Behavior
- **Regarder** → Live/spectator view. **Arbitrer** → Arbitre/ref view. Both only surface from the live hero (contextual).
- **+ Nouveau** (desktop split CTA / mobile center +) → existing `NewMenu` (Partie rapide / Nouveau tournoi).
- **Tournament card** click → open tournament/board; **trash** → delete (existing confirm flow).
- **Recent result** row click → open the owning tournament/board.
- **Top players** card / **Classement →** links → Classement screen.
- **Theme toggle** flips light/dark. The coral live hero stays coral in both themes (it's the anchor); only surfaces, text, and chrome switch.
- **Hover:** cards lift (`-2px` + shadow); list rows tint; trash reveals. Transitions ~160ms `cubic-bezier(.2,.7,.2,1)` (Recovr calm-motion). Respect `prefers-reduced-motion`.
- **Live indicators** pulse via `@keyframes rvpulse` (white) / `rvpulseC` (coral).
- **Responsive:** wide = hero full width + 2fr/1fr columns; phone = top nav → bottom tab bar, content collapses to one column in the order above. Both treated as first-class, not compromises.

## State Management
- `theme`: 'light' | 'dark' (persist to localStorage; drives all non-hero surfaces).
- `liveMatch`: derived from `useCurrentTournament` + `spectator.ts` — determines active vs. idle hero.
- `tournaments`: `useTournaments`.
- `recentResults`: new memoized selector flattening finished games across tournaments, sorted by recency, sliced to ~5.
- `ratings` + `ratingDeltas`: `useRatings` / `useRatingDeltas` → top 5.
- `records`: `stats.ts` / `playerHistory.ts` → streak / upset / capots / most-active; guard each for thin data.
- Empty vs. populated: if no tournaments AND no rated games → render empty-state variant.

## Design Tokens
Colors (from the Recovr design system):
- Purple: `#4A2AA4` (primary), `#5B39C4` / `#6B4AD1` / `#7A5AE0` (bright), `#3A2183` (deep), `#17082B` / `#200A42` / `#130726` (ink/dark bg), `#1E1138` (dark card).
- Purple tints: `#F0ECFB`, `#F2EFFB`, `#F7F5FD`, `#FBFAFF`, `#E4DDF8`, `#E8E1FA`; borders `#E8E4F2` / `#ECE8F6` / `#F0ECF9`; dashed `#CDBDF0`. Dark accents: `#C9B8FF`, `#A99FC4`, `#8B82A8`, `#7C7395`.
- Coral: `#D74251` (accent), `#BE3341` / `#B8323F` / `#A82B38` / `#93283A` (deep), `#F0899A` / `#F0ECFB`; tints `#FEE7EE`, `#FDE7EE`, `#FBD4D9`; dark `#FF7A7A` / `#FF9BA6`.
- Sentiment: green `#2BA572` (dark `#4ED9A0`); red `#E54C4C` (dark `#FF7A7A`).
- Medals: gold `#E8B53A` / `#F0C84B`, silver `#AEB6C0` / `#C7CDD6`, bronze `#CB8E5E` / `#D9A878`.
- Muted text: `#4A4458`, `#6B6480`, `#847E96`, `#A49EB3`.
- House gradient bg: `radial-gradient(120% 90% at 0% 0%, #E8E1FA 0%, transparent 46%), radial-gradient(120% 90% at 100% 0%, #FDE7EE 0%, transparent 46%), #FBFAFF` (dark: `#2A1550` / `#3A1636` over `#130726`).

Typography: **Outfit** (headings, numbers, buttons — weights 400–900) and **DM Sans** (body/meta — 400–700), both Google Fonts. Sentence case only. Key sizes: page title 32/800, section title 18/800, card title 16/800, body/meta 12–14 DM Sans, live score 56/900 (desktop) · 42/900 (mobile), Elo rating 15/800.

Radii: chips/pills `999px`; list rows 11–12px; cards 14–18px; hero 18–22px; frames/large surfaces 20–24px. Spacing on a 4px scale; card padding 16–18px, section gaps 20–22px, grid gap 12–20px.

Shadows (purple-tinted, soft — never black/hard): card `0 3px 12px rgba(32,10,66,.06)`; card hover `0 14px 30px rgba(32,10,66,.15)`; CTA glow `0 12px 26px rgba(74,42,164,.3)`; live hero `0 22px 50px rgba(215,66,81,.32)`; frame `0 30px 80px rgba(32,10,66,.14)` (dark `rgba(10,3,26,.4)`).

Motion: entrances fade + `translateY(8–12px)`, ~220ms ease-out `cubic-bezier(.2,.7,.2,1)`; hover/press ~140–160ms; live pulses `rvpulse`/`rvpulseC`. Respect `prefers-reduced-motion`.

## Assets
- **Icons:** inline SVG in the Lucide style (1.5–2px stroke) — home, trophy, users, bar-chart, sun, moon, clock, play, trending-up, flame, chevrons, trash. Swap for the codebase's existing icon set (Lucide recommended).
- **Player photos:** the prototype uses initial-avatars as placeholders; the brief calls for **real player photos** in the live hero, top players, and recent results — wire these to the player records.
- **Brand mark:** the 34px gradient loop tile is a stand-in for the Recovr/app symbol — use the real logo asset from the codebase.
- No raster assets are shipped in this bundle.

## Files
- `design_handoff_dashboard_home/Dashboard home.dc.html` — the prototype (8 frames).
- `design_handoff_dashboard_home/ios-frame.jsx`, `support.js` — prototype runtime only (do not port).
- Target file to rebuild: `src/components/Home.tsx`.
- Reuse: `NewMenu`, existing tournament card + delete flow, `SpectatorView`/ref view, `useTournaments`, `useCurrentTournament`, `spectator.ts`, `useRatings`, `useRatingDeltas`, `stats.ts`, `playerHistory.ts`. New: one recent-results selector.
