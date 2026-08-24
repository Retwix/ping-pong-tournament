# Handoff: Tournament board / results page (`/t/:id`)

## Overview
Revamp of the tournament board — the last core surface still on the legacy standalone layout
(`src/components/Board.tsx`). It now sits on the **shared app shell** (glass nav + violet logo tile +
"Tournoi ping-pong" wordmark), like Accueil / Classement / Stats / Joueurs / Parties / Nouvelle partie.

Two tournament shapes render through the same page:
- **Round-robin** — match list grouped by round + standings table.
- **Double elimination** — bracket instead of match list/standings, with two sub-views
  (**vue tableau** and **vue liste**).

No new product behaviour: this is a reskin. Everything in the old feature inventory is preserved.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes showing the intended
look and behaviour. They are not production code to copy. Recreate them in the app's existing
environment (React + TypeScript, Tabler icons, the app's shell components) using its established
patterns. Copy the *values* (colors, type, spacing, copy) exactly; ignore the prototype's own
templating.

## Fidelity
**High fidelity.** Colors, typography, spacing, radii and copy are final and must be matched
pixel-for-pixel. All values come from the frozen design system
(`docs/design/seasons-handoff/DESIGN-SYSTEM.md`) — violet `#4A2AA4`, Outfit + DM Sans.
Rule applies unchanged: *« Toute page suivante copie ces valeurs à l'identique. Aucune nouvelle
couleur, taille ou rayon. »*

## Decisions taken (the brief's open questions)
1. **Theme toggle** — the page-level absolute-positioned toggle is **removed**. The shell nav's
   segmented light/dark control is the only one.
2. **Share bar** — folded into the **page-header actions area** (right side of the header row):
   URL chip + « Copier le lien », then « Mode live », then « Mode arbitre ». No emoji: Tabler-style
   icons (`IconDeviceTv` for live, `IconWhistle` for arbitre, `IconCopy` for the copy button).
3. **Bracket width** — stays inside the shell's 1320px content column. The bracket card is
   `overflow-x: auto` with `min-width: 760px` per bracket group, so it scrolls horizontally rather
   than breaking out of the column.

## Screens / views

### Shell (unchanged, reused)
Sticky glass nav at top: `max-width 1320px`, `padding 0 24px`, nav card
`rgba(255,255,255,.78)` + `backdrop-filter: blur(14px)`, `1px solid #ECE8F6`, `radius 18px`,
`padding 11px 16px 11px 18px`, `shadow 0 4px 18px rgba(32,10,66,.06)`.
Dark: `rgba(28,14,54,.72)`, border `rgba(255,255,255,.09)`, `shadow 0 8px 26px rgba(6,2,16,.4)`.
Page background light: `radial-gradient(70% 50% at 0% 0%, #E8E1FA, transparent 60%),
radial-gradient(70% 50% at 100% 0%, #FDE7EE, transparent 60%), #FBFAFF`;
dark: same geometry with `#2A1550` / `#3A1636` over `#130726`.

### 1. Page header (both formats)
- Back link above the title: chevron-left 14px + « Tous les tournois », `700 12.5px Outfit`,
  `#847E96` (dark `#A99FC4`), hover `#4A2AA4` / `#C9B8FF`. Repeated at the **bottom** of the
  results/bracket section.
- **Kicker**: `800 11.5px Outfit`, `letter-spacing .12em`, uppercase, `#4A2AA4` (dark `#C9B8FF`).
  Content: `Round-robin · 5 joueurs · jeu en 11` / `Double élimination · 8 joueurs · jeu en 11`.
- **Title**: tournament name, `800 32px/1 Outfit`, `letter-spacing -.02em`, `#17082B` / `#fff`.
- **« Non classé » badge** (inline, only when unranked): `800 10px Outfit`, `letter-spacing .09em`,
  text `#847E96`, fill `#F7F5FD`, border `1px #E8E4F2`, `radius 999px`, `padding 6px 11px`.
- **Subtitle**: `600 14px/1.5 DM Sans`, `#847E96` / `#A99FC4`, `max-width 600px`, `text-wrap: pretty`.
  - round-robin: « Tape un match pour ouvrir le marqueur. Tout se synchronise en direct. »
  - double-élim: « Le gagnant avance, le perdant tombe dans le tableau des perdants. Tape un match
    prêt pour le marquer. »
  - unranked appends: « Aucun impact sur le classement Elo. »
- **Share bar** (right, `gap 9px`): white card (`radius 13px`, border `1px #E8E4F2`,
  `shadow 0 3px 12px rgba(32,10,66,.05)`) holding the live URL (`600 12.5px DM Sans`, `#847E96`)
  and a « Copier le lien » button (`700 12.5px Outfit`, `#4A2AA4` on `#F0ECFB`, `radius 10px`,
  `padding 9px 12px`, hover `#E4DDF8`). Then two ghost buttons « Mode live » → `/live` and
  « Mode arbitre » → `/ref` (`700 13.5px Outfit`, `#4A2AA4`, white fill, border `#E8E4F2`,
  `radius 13px`, `padding 12px 15px`, hover border `#D0C3F3`).

### 2. Round-robin view
Two-column grid: `minmax(0,1.4fr) minmax(0,1fr)`, `gap 20px`, `align-items: start`;
the standings column is `position: sticky; top: 88px`.

**Left — « Les matchs »** (`800 18px Outfit`) followed by a progress bar
(`height 5px`, track `#EDE8F8`, fill `#4A2AA4`, `max-width 180px`, `radius 999px`) and the live
count `6/10 joués` (`700 12.5px DM Sans`, `#847E96`).

Per round: header « Tour N » (`800 13px Outfit`) + bye note « exempt : Candice »
(`600 12px DM Sans`, `#A49EB3`) — shown only when the player count is odd.
Round card: white, border `1px #E8E4F2`, `radius 16px`, `shadow 0 3px 12px rgba(32,10,66,.05)`,
`padding 5px 7px`.

Match row (`padding 13px 11px`, `radius 12px`, `gap 13px`, `cursor: pointer`,
hover `#F2EFFB` / `rgba(255,255,255,.05)`, 160ms `cubic-bezier(.2,.7,.2,1)`):
status dot 8px → status label (76px, `700 11.5px DM Sans`) → player A (right-aligned,
`700 14.5px Outfit`) → score (74px centered, `800 15px Outfit`) → player B → duration
(64px right, `600 12px DM Sans`, `#A49EB3`) → chevron 15px `#CBC3DD`.
Status colors: Terminé `#2BA572` (dark `#5FD9A6`), En cours `#D74251` (dark `#F2818F`),
À jouer `#A49EB3` (dark `#8B82A8`); idle dot `#DCD6EA` / `rgba(255,255,255,.2)`.
Loser name greys to `#847E96`; unplayed score renders `—`.

Below the list, once at least one duration exists: clock icon + « Plus long : X–Y (mm:ss) ·
Plus court : X–Y (mm:ss) » (`600 12.5px DM Sans`, `#847E96`).

**Right — « Classement »** card (white, `radius 18px`, `padding 6px 10px 14px`).
Header row `700 10.5px Outfit`, `letter-spacing .08em`, `#A49EB3`; columns:
`#` 20px · JOUEUR (flex, ellipsis) · J 22px · V 22px · PTS +/− 50px · DIFF 38px · ÉLO 42px —
all right-aligned, `flex: none`, row `gap 8px`, `padding 11px 8px`.
Podium rank colors: 1 `#E8B53A`, 2 `#AEB6C0`, 3 `#CB8E5E` (`800`), others `#847E96` (`700`).
DIFF/ÉLO signed: positive `#2BA572`, negative `#D74251`. ÉLO cell `title` = « 1500 → 1532 ».
**The ÉLO column is hidden entirely when the tournament is unranked**, replaced below the card by a
note: « Tournoi non classé — les résultats ne changent aucun Elo. »
Tie-break hint under a `1px #F0EDF8` divider: « Départage : victoires, puis différence de points. »
(`600 12px/1.5 DM Sans`, `#A49EB3`).

### 3. Double-elimination view
Header « Le tableau » + same progress bar/count (**computed from the bracket nodes**, e.g. `7/12
joués`), plus a segmented control on the right (`radius 11px`, `padding 3px`, white card):
**Tableau** | **Liste** — active pill `#4A2AA4` (dark `#5B39C4`) with white `700 12.5px Outfit`,
inactive `600 12.5px Outfit` `#6B6480` / `#A99FC4`.

**Vue tableau** — card `radius 20px`, `padding 20px 22px`, `overflow-x: auto`. Three stacked groups
separated by `1px #F0EDF8` dividers:
`TABLEAU PRINCIPAL` (label `800 11px Outfit`, `.1em`, `#4A2AA4`), `TABLEAU DES PERDANTS` (`#847E96`),
`GRANDE FINALE` (`#4A2AA4`).
Each group is a flex row of columns (`gap 16px`, `min-width 760px`); a column is
`flex 1; min-width 200px` with its round title pinned as the first row
(`700 11px Outfit`, `.06em`, `#A49EB3`) and the match cards in a `flex: 1;
justify-content: space-around` wrapper — so **all column titles sit on one baseline** and later-round
cards centre between their feeders.
Node card: `#FBFAFF` fill (dark `rgba(255,255,255,.045)`), border `1px #E8E4F2`, `radius 14px`,
`padding 11px 13px`, hover lift `-2px` + `0 14px 30px rgba(32,10,66,.15)`. Two name/score lines
separated by a `1px #EFEBF9` rule, then a state label (`700 10.5px Outfit`, `.07em`).
The grande finale node uses the gradient fill `linear-gradient(120deg,#F4F0FD,#FDF2F5)` with border
`#E0D6F6` and `800` weights.

**Node states** — `Terminé` (green, winner in `#17082B`, loser `#847E96`), `En cours` (coral),
`Prêt` (violet), **`En attente`** (grey — the match exists but is not yet playable because a feeder
result is missing), `À jouer` (grey). Unresolved opponents render as **« À déterminer »** in
`#A49EB3` / `#8B82A8`.

**Vue liste** — the same nodes as flat rows, grouped by round title (`800 13px Outfit`), reusing the
round-robin row anatomy: dot → state label (82px) → A / score / B → note (120px right:
duration, « manche 2 », or « attend un résultat ») → chevron.

Footer hint: « Tableau à double élimination : il faut perdre 2 fois pour être éliminé. »

### 4. Overlays (invoked from this page; their own visual design is owned elsewhere)
- **Live scorer** — opens on any match row / bracket node tap. Scrim `rgba(19,7,38,.8)` +
  `blur(10px)`; card `min(760px,100%)`, `linear-gradient(160deg,#2A1550,#160829)`, `radius 26px`,
  border `1px rgba(255,255,255,.12)`. Two score columns (`900 76px Outfit`) with `+1` / `−`
  controls (`#5B39C4`, `radius 14px`), footer « Terminer le match » + « Fermer ». Esc closes.
- **Capot** — full-screen coral gradient (`#D74251 → #BE3341 → #7E2233`), « CAPOT ! »
  `900 96px Outfit`, score line `800 26px`, sub-line naming the round and tournament, « Continuer ».
  Shown *before* the champion screen when both would fire together.
- **Champion** — full-screen violet gradient (`#2C1258 → #4A2AA4 → #5B39C4`) + gold radial glow,
  trophy tile, `CHAMPION · <TOURNAMENT NAME>` in `#E8B53A`, winner `900 52px Outfit`, a stat line,
  2e/3e chips, CTAs « Voir les résultats » (dismiss) + « Nouveau tournoi ».
  **All copy is derived from the results** (winner, podium, score line, tournament name), and the
  Elo delta is omitted when the tournament is unranked.

### 5. Loading / not-found / error
- **Loading**: card, `padding 120px 0`, 34px spinner (`3px #EDE8F8`, top `#4A2AA4`, 900ms linear) +
  « Chargement… ».
- **Not found**: 52px `#F7F5FD` tile with a crossed-magnifier icon, « Tournoi introuvable. »
  (`800 20px Outfit`), sub-line, primary CTA « Tous les tournois ».
- **Error banner** (above the header, sync/load failures): `#FEE7EE` fill, border `1px #FBD4D9`,
  `radius 14px`, text `#93283A`, « Synchronisation interrompue — les scores affichés peuvent être en
  retard. » + « Réessayer ». Dark: `rgba(215,66,81,.16)` / `rgba(215,66,81,.32)` / `#F2A5AE`.

## Interactions & behaviour
- Tapping a match row (round-robin) or a bracket node opens the live scorer overlay; `Escape` closes it.
- « Copier le lien » copies the tournament URL to the clipboard (toast/confirmation is the app's
  existing pattern).
- « Mode live » → `/live`, « Mode arbitre » → `/ref` (both out of scope here).
- Champion overlay appears automatically once `tournament.status === 'done'` and is dismissible;
  capot takes precedence when both fire.
- Progress count and bar update live from played matches (round-robin) or resolved bracket nodes.
- Row hover: background `#F2EFFB` (dark `rgba(255,255,255,.05)`), 160ms `cubic-bezier(.2,.7,.2,1)`.
  Card hover: `translateY(-2px)` + `0 14px 30px rgba(32,10,66,.15)`.
- Page entrance: `opacity 0 → 1` + `translateY(10px → 0)`, 220ms `cubic-bezier(.2,.7,.2,1)`;
  disabled under `prefers-reduced-motion`.
- **Not covered in this handoff**: the app's 820px mobile breakpoint. The prototype is desktop-only
  (as is the rest of this prototype family); mobile should be done as one pass across all pages.

## State
| State | Values | Notes |
|---|---|---|
| `format` | `round-robin` \| `double-elim` | from the tournament record |
| `progress` | no match played / partially played / fully played | drives statuses, counter, champion |
| `deView` | `board` \| `list` | double-elim only; local UI state, defaults to `board` |
| `overlay` | `null` \| `scorer` \| `capot` \| `champion` | champion auto-opens on `status === 'done'`, dismissible |
| `unranked` | boolean | badge, subtitle suffix, hides the ÉLO column and the Elo stat |
| `oddPlayers` | boolean | drives the « exempt : X » note per round |
| `load` | `ok` \| `loading` \| `notfound` | plus an independent `error` flag for the sync banner |

Standings (rank, J, V, Pts +/−, Diff, Élo) are **derived** from played matches — sorted by wins,
then point difference — never stored separately. The champion overlay reads the same derived table.

## Design tokens (all from the frozen system)
Violet `#4A2AA4` · deep `#2C1258` / `#17082B` · dark-mode violet `#5B39C4` / `#8663E9` /
`#C9B8FF` · lavender surfaces `#F0ECFB` `#F7F5FD` `#FBFAFF` `#EDE8F8` `#E4DDF8` ·
borders `#E8E4F2` `#ECE8F6` `#F0EDF8` `#D0C3F3` · dark surfaces `#130726` `#1E1138` with
`rgba(255,255,255,.09)` borders · muted text `#847E96` `#A49EB3` `#6B6480` (dark `#A99FC4`
`#8B82A8`) · coral `#D74251` `#FEE7EE` `#FBD4D9` (dark `#F2818F`) · green `#2BA572` `#E6F6EF`
(dark `#5FD9A6`) · podium `#E8B53A` `#AEB6C0` `#CB8E5E`.
Radii `999px` / `18px` / `16px` / `14px` / `13px` / `12px` / `11px` / `10px` / `8px`.
Shadows `0 3px 12px rgba(32,10,66,.05)` · `0 4px 18px rgba(32,10,66,.06)` ·
`0 10px 24px rgba(74,42,164,.28)` · `0 14px 30px rgba(32,10,66,.15)`; dark
`0 3px 12px rgba(6,2,16,.35)` · `0 8px 26px rgba(6,2,16,.4)`.
Type: **Outfit** 600–900 for headings/labels/scores, **DM Sans** 600–700 for body/table values.
Sizes used: 32 / 18 / 15 / 14.5 / 14 / 13.5 / 13 / 12.5 / 12 / 11.5 / 11 / 10.5 / 10.
Motion: 160ms hover, 220ms entrance, both `cubic-bezier(.2,.7,.2,1)`.

## Assets & icons
No images. All icons are inline 24×24 stroke SVGs standing in for **Tabler**
(`@tabler/icons-react`, already used across the app): chevron-left/right, copy, device-tv, whistle,
clock, trophy, search-off, alert-circle, sun, moon. **No emoji anywhere** — the old
`📺 Mode live` / `🧑‍⚖️ Mode arbitre` buttons are replaced by icon + label.

## Files
- `TournamentBoard.dc.html` — this page standalone (light + dark, both formats, all states, overlays).
  Open it directly in a browser; the tweak values at the bottom of the file switch format, progress,
  odd/even players, unranked, capot, error and loading states.
- `support.js` — runtime needed to open the prototype locally. Not part of the design.
- Source of truth in the project: `Tournoi ping-pong app.dc.html` (the full app prototype), page
  `#/tournoi`. The design system reference is `DESIGN-SYSTEM.md` at the project root.
