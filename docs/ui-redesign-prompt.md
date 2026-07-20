# Prompt — Complete UI/UX Rework of the Ping-Pong Tournament App

> Copy everything below into a design-focused Claude session (e.g. with the `frontend-design` skill loaded). It contains full product context, the current screen inventory, known problems, and the expected deliverables.

---

You are a senior product designer + design engineer. Your mission is a **complete UI/UX rework** of an existing, feature-rich ping-pong tournament web app. The product grew feature-after-feature with no unifying design pass; the goal is to rethink it as one coherent product, not to restyle screens one by one. You may reorganize navigation, merge or split screens, and redesign every component — but every existing capability must survive the redesign.

## 1. Product context

- Office ping-pong tournament app for the company "Recovr". UI is entirely **French** (keep it French).
- Tech: React 18 + TypeScript (strict) + Vite. No UI framework — hand-written CSS in one global `src/index.css` (788 lines) with CSS custom properties and a light/dark theme via `data-theme` on `<html>`. Icons: `@tabler/icons-react`. Fonts: Outfit (display) + DM Sans (body).
- Data: Supabase (Postgres + realtime). All screens sync live across devices; optimistic writes with reconciliation. This realtime, multi-screen nature is core to the product.
- **Three very different usage contexts that the design must treat as first-class modes:**
  1. **Organizer** on a laptop: creates tournaments, manages players, browses stats.
  2. **Referee** on a phone at the table: taps a big scoreboard to count points (`/ref` is a stable shareable link).
  3. **Spectators** on a projector/TV in the office: watch the live scoreboard from afar (`/live` is a stable shareable link that auto-follows the current match). Type must be readable from meters away.

## 2. Current screens (10 routes)

| Route | Screen | What it does today |
|---|---|---|
| `/` | Home | Flat list of ALL past games and tournaments ("Partie"/"Tournoi" cards with winner 🏆, status badge, delete). Above it, a cramped toolbar of 7 emoji buttons (📺 Live, 🧑‍⚖️ Arbitre, 🔮 Pronos, 🏓 Classement, Stats, Joueurs) + a "+ Nouveau" split-dropdown (Partie rapide / Nouveau tournoi). |
| `/new`, `/game` | Setup | One long single-column form (same component, two modes): name → format cards (round-robin / double élimination) → player picker (a `<select>` dropdown + inline "new player" sub-form) → points target chips (11/21/15/autre) → an embedded **Chaos Mode** config block (interval chips, intensity cards, legendary toggle) → time → generate → "download PNG poster" button. |
| `/players` | Joueurs | Player registry CRUD: team-colored avatars, inline edit (team + Slack ID), delete, add via modal. |
| `/stats` | Les stats | Huge analytics dashboard: KPI cards, activity bar chart, sortable player table, win-rate bars, team leaderboard, "Records" superlative cards (plus longue série, bourreau, roi de la table, sang-froid, cardiaque…), head-to-head matrix (single-letter column initials), rivalry cards, per-player detail modal. |
| `/classement` | Le classement | Glicko-2 rating ladder (mislabeled "Elo"): KPI strip, rating table (±reliability, trend, provisional badges), highlights, a 5-paragraph "comment ça marche" explainer, a calculations-journal sub-view, "Recalculer" button. |
| `/pronos` | Les parieurs | Betting leaderboard (no money, honor only): correct picks, accuracy %, streak 🔥. Div-based faux table. |
| `/t/:id` | Board | The tournament hub. Share-bar (copy link, 📺 mode live, 🧑‍⚖️ mode arbitre), then branches: single game → scorer/result; round-robin → match list by round + in-tournament **Predictions panel** (bet on champion + per-match winner, crowd bars, locking rules) + standings; double-elim → bracket with list ↔ tree toggle. Champion/Capot overlays on completion. |
| `/t/:id/live` | LiveView | Spectator view of one tournament; auto-advances between matches; referee interstitial "up next" screen with ELO stakes; final podium when done. |
| `/live`, `/ref` | CurrentView | Stable links that auto-follow whatever is live right now — spectator and referee variants. |
| (overlay) | LiveScorer | The core scoreboard: two giant tappable score panels, −1 correction, undo, service indicator + audio "ding", match clock, keyboard shortcuts (←/→/Z/Enter/Esc), left-right flip, match-point/capot detection, chaos-event banner with "Appliquer", post-match ELO chips. One component serves referee / spectator / organizer modes via flags. |

End-of-game celebration screens: Champion (podium + confetti), CapotScreen (humiliation screen with emoji rain for an 11–0), GameResult, Celebration/Confetti (canvas, no deps).

## 3. Features that must survive (do not drop any)

- Round-robin AND double-elimination (winners/losers/grand-final brackets, BYEs).
- Quick 1v1 game ("Partie rapide") as a lighter path than a full tournament.
- Live realtime scoring across devices; stable `/live` and `/ref` links; auto-follow of the current match.
- Referee scoring UX: big tap targets, −1 correction, undo, service tracking with sound, keyboard shortcuts, side flip, match clock.
- Glicko-2 ratings with provisional states, deltas surfaced after each match, recalculation, calculations journal. **Fix the naming: it is Glicko-2, currently mislabeled "Elo".**
- Predictions/betting: champion futures + per-match picks, locking rules, crowd split bars, bettor leaderboard with streaks. Trust-based identity (name picker, no auth) is a deliberate product choice — keep it.
- Chaos Mode: configurable at setup (interval, intensity, legendaries); during matches shows rolled modifiers, some legendary events mutate the score via an "Appliquer" action. This is a beloved fun feature — give it a proper visual identity instead of a bolted-on banner.
- Stats dashboard content (records, head-to-head, rivalries, teams, per-player drill-down).
- Players registry with 6 fixed teams (Tech, Customer Support, Marketing, Sales, Business, Guests) and their colors; optional Slack ID per player (Slack notifications exist server-side).
- Celebrations: confetti champion screen, capot humiliation screen. Keep the personality (emoji, French/Corsican flavor like "Balla di capot") — the app should stay fun, it's an office toy, not enterprise software.
- Light/dark theme, PNG poster export from Setup, sound, reduced-motion support.

## 4. Diagnosed problems (from a full audit — address each explicitly)

1. **No information architecture.** Home is a flat, undifferentiated list of every game ever played, mixing quick games and tournaments, with 7 heterogeneous emoji buttons as the only navigation. There is no app shell: theme toggle, back links (a top arrow AND a footer "← Accueil" on the same pages) are re-implemented per page.
2. **The three usage modes are not visually distinct.** Organizer pages, the phone referee scoreboard, and the TV spectator view all share the same look; the TV view is just a desktop page (small table, huge empty margins — see `/live` today).
3. **Inconsistent patterns for identical problems:** real `<table>` (Stats, Classement) vs div-grid faux table (Pronos); icon-button view toggle (bracket) vs text-link toggle (classement journal); modal-create vs inline-edit (Players); native `confirm()`/`alert()` next to custom modals; a dropdown `<select>` to add players to a tournament (clunky multi-add).
4. **Styling debt:** two overlapping generations of CSS tokens (`--panel/--ink/--muted` aliases layered on `--surface/--fg-1`…), one-off `[data-theme='dark']` patches, ~40 inline `style={{}}` sites in TSX (the Home "+ Nouveau" dropdown is styled entirely inline), 9 scattered keyframes.
5. **Responsiveness is one breakpoint (460px).** Nothing between phone and desktop; the bracket tree and head-to-head matrix horizontally scroll/cram; the Home toolbar just wraps.
6. **Density and hierarchy problems:** Setup is one endless column with the chaos config buried mid-form; Stats is a wall of sections; Classement is text-heavy; the head-to-head matrix uses unreadable single-letter initials; the champion screen wastes a full viewport for three rows.
7. Theme defaults to light, ignoring `prefers-color-scheme`.

## 5. What to deliver

Work in this order and write everything to files under `docs/design/`:

1. **`01-ia-and-flows.md` — Information architecture & navigation.** Propose the new sitemap, app shell (global nav), and the primary flows: create-tournament, score-a-match (referee), watch (TV), review stats, bet. Rethink Home entirely: what does a returning user need first? (Likely: what's live now, quick actions, recent activity — not 200 dead cards.) Decide how the three modes (organize/referee/spectate) are entered and visually signposted.
2. **`02-design-system.md` — Design system.** One token set (colors incl. the 6 team colors, type scale, spacing, radii, elevation, motion), light + dark from `prefers-color-scheme` with manual override, component inventory (buttons, cards, tables, chips/badges, modals, toasts to replace `alert`/`confirm`, empty states, podium/medal treatment, chaos-event identity). Typography must scale from phone to projector — define a TV-distance type scale. Keep the playful personality; define where emoji are allowed vs replaced by real iconography.
3. **`03-screens.md` — Per-screen redesign specs.** For every route above: layout (mobile / desktop / TV where relevant), states (empty, loading, live, finished), and what changed vs today and why. The scoreboard, bracket (solve the mobile bracket honestly), setup form (consider steps/wizard), and Home deserve the deepest treatment.
4. **`04-implementation-plan.md` — Migration plan.** PR-sized vertical slices that keep the app shippable at every step (this codebase follows strict TDD; visual changes must not touch `src/lib` logic). Start with tokens + app shell, then screen by screen. Flag which existing CSS classes/components die.

Constraints: stay dependency-light (no Tailwind/MUI unless you argue it's clearly worth it), keep React + the existing hooks/data layer untouched, keep all copy French, WCAG AA contrast in both themes, respect `prefers-reduced-motion`.

Before designing, run the app (`npm run dev`, needs Supabase env) or read `src/components/` and `src/index.css` to see current reality. Do not start coding until the four documents above are approved.
