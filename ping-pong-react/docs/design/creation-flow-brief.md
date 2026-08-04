# Design brief: Creation flow revamp ("Nouvelle partie" / "Nouveau tournoi")

Input brief for Claude design. Goal: produce a high-fidelity prototype (same deliverable
style as `design_handoff_app_complete/`) for the creation flow — the last surface still on
the old design: `/game` (partie rapide) and `/new` (nouveau tournoi), both rendered today
by `src/components/Setup.tsx`.

Two NEW product features ship with this revamp and must be designed in, not bolted on:
**mode non classé (unranked)** and **partie en double (2v2)** — see their sections below.

## Context

- Office ping-pong app, **UI is in French** (tutoiement: « Choisis 2 joueurs »). Design
  language: the complete app handoff (Recovr system, violet `#4A2AA4`, Outfit + DM Sans,
  tokens in `DESIGN-SYSTEM.md`) — light + dark themes, generous sizing, tooltips/hover
  states specified from v1, **no dead buttons** (everything shown must work in v1).
- Entry points: the header split button « + Nouveau ▾ » (menu: ⚡ Partie rapide ·
  🏆 Nouveau tournoi) and the mobile tab bar's raised center « + » (menu opens upward).
  **Recommendation: keep two menu entries** — unranked and 2v2 are choices *inside* the
  page, not new menu items (confirm or push back).
- These pages currently use the old standalone layout (back arrow + centered header).
  **Recommendation: adopt the shared app shell** (sticky glass header, 4 tabs — none
  active) like every other revamped page, so the flow never feels like a dead end.
- On submit the app creates the game/tournament and navigates to its board (`/t/:id`).
  Creation also fires a **Slack invitation** automatically (no UI beyond the optional
  « Heure » field that schedules it).
- Both modes are one component with shared blocks — design them as **two variants of one
  layout**, not two unrelated pages.

## The two variants

| | Partie rapide (`/game`) | Nouveau tournoi (`/new`) |
|---|---|---|
| Kicker today | « Partie rapide » | « Round-robin · nouveau tournoi » (or « Élimination directe · … ») |
| Name field | none — auto « A vs B » | « Nom du tournoi », placeholder « Tournoi du bureau », max 40, empty → « Tournoi » |
| Format choice | none | Round-robin / Élimination directe |
| Players | exactly 2 (selector disappears when full) | ≥ 2 (round-robin) · ≥ 3 (élimination directe) |
| CTA | « Lancer la partie » | « Générer le tournoi » |
| Poster | « Télécharger le défi (PNG) » — needs the 2 players | « Télécharger l'affiche (PNG) » — always available |

## Current feature inventory (nothing may be dropped)

1. **Format cards** (tournament only), single choice:
   - Round-robin — « Chacun affronte tout le monde. Le plus équitable. »
   - Élimination directe — « Tableau à double élimination. 2 défaites = éliminé. Plus rapide. »
2. **Player selection** (shared):
   - Pick from the registry — today a plain `<select>` listing « Nom · Équipe ». This is
     the weakest part of the page: **improve it** (the registry grows; consider search /
     avatars / team chips, consistent with the Joueurs page).
   - Selected list: row = index, name, team tag, remove ✕.
   - Inline « + Nouveau joueur »: name (max 20) + team select (Tech, Customer Support,
     Marketing, Sales, Business, Guests — house colors from the Joueurs page), saves to
     the registry then adds to the selection. Duplicate-name guard: « Ce joueur existe
     déjà — choisis-le dans la liste. »
   - States: loading « Chargement… » · empty registry « Aucun joueur disponible —
     ajoute-en un ».
3. **Points par jeu**: presets **11 / 21 / 15** + free numeric « autre » (1–99),
   default 11.
4. **Mode chaos** (optional, off by default — « le fun avant la compétition »). When on:
   - Fréquence des tirages: Chaque point · Tous les 2 (default) · Tous les 3
   - Intensité: Modéré « Que des bonus. Rien de méchant, juste rigolo. » · Chaos total
     « Bonus et malus. Tout peut arriver. » (default)
   - Toggle « Modificateurs légendaires (rares, spectaculaires) » (default on)
5. **Heure** (optionnel · pour l'invitation) — time input; feeds the Slack invite and
   the posters.
6. **Live validation hint** (one line, updates as you configure):
   - game: « Choisis 2 joueurs. » → « {A} vs {B} · jeu en 11 »
   - round-robin: « Sélectionne au moins 2 joueurs. » → « N joueurs · M matchs · R tours »
     (+ « (avec exempts) » when N is odd)
   - élim. directe: « Sélectionne au moins 3 joueurs pour une élimination directe. » →
     « N joueurs · M matchs · 2 défaites = éliminé »
7. **Poster download** (PNG, per-variant label above) with busy state « Génération… ».
8. **Primary CTA** disabled until valid, busy state « Création… ».
9. **Error banner** above the form (creation/network failures).
10. Footer rule-of-the-game hint: game « Premier à atteindre le score, avec 2 points
    d'écart. » · round-robin « Départage : victoires, puis différence de points. » ·
    élim. directe « Tableau à double élimination : il faut perdre 2 fois pour être
    éliminé. »

## NEW — Mode non classé (unranked)

- A creation-time choice: **Classée (default) · Non classée**, available for quick games
  and tournaments alike.
- Consequence: results move no Elo and are excluded from « Le classement »; the match
  still exists in the Parties history and (TBD) Stats. Communicate it in one calm line —
  e.g. « Aucun impact sur le classement Elo » — legible but not scary.
- Design a **« Non classé » badge** treatment that downstream surfaces will reuse
  (parties list row, board header, live view). One reference frame is enough; we wire
  the rest.

## NEW — Partie en double (2v2)

- The quick game gets a **Simple (1v1) · Double (2v2)** switch.
- In 2v2, selection becomes two sides: **Équipe A (2 joueurs) vs Équipe B (2 joueurs)**,
  4 distinct players. Auto-name « {A} & {B} vs {C} & {D} », hint « {A} & {B} vs {C} &
  {D} · jeu en 11 ». Design the partially-filled states (1/4 → 3/4 players) and how a
  player is assigned to a side.
- **Rating, v1 decision (recommendation):** doubles are **non classés d'office** — no
  pair rating yet. The Classée/Non classée control locks to « Non classée » with a short
  explanation when Double is on. Flag it if you think the design should reserve room for
  a future pair Elo.
- **Tournaments stay 1v1 in v1** — a bracket of pairs is a later feature. Leave visual
  room but design nothing dead.
- Reference frames worth sketching (one each, for consistency): a parties-list row and a
  board/scorer header with two names per side; a doubles variant of the challenge poster.

## States to design

- Loading players · empty registry · full selection (game mode) · below-minimum counts
  per format · duplicate-player error · error banner · CTA busy · poster busy · chaos
  section collapsed/expanded · 2v2 partially filled · « Non classée » selected · Double
  selected (rating control locked).
- Both **light and dark** themes; desktop + mobile frames (the codebase implements a
  single 820px breakpoint — one mobile layout is enough).

## Out of scope

- Board / live scorer / bracket redesign (separate future handoff — the doubles frames
  above are reference-only).
- Pair Elo, doubles tournaments, doubles stats.
- Pronos/predictions (removed product-wide).
- Backend/schema design — we handle the `unranked` and doubles flags.

## Open questions for design

1. Placement of the Classée/Non classée control: next to the format cards, or near the
   CTA as a final « stakes » decision — propose one.
2. Simple/Double switch: segmented control at the top of the players block, or two
   layout-level tabs — propose one.
3. Player picker: searchable list vs. avatar grid — pick what scales to ~30 players and
   stays fast for the 2-tap quick-game case.
4. Chaos options: keep inline-expanding (current) or move behind a « Configurer » row —
   the block is tall when open.
