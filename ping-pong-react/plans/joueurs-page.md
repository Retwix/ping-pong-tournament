# Plan: Page « Joueurs » (/players) — design handoff

**Branch**: players-page (off dashboard-revamp)
**Status**: Active

## Goal

Replace the v1 players registry page with the handoff design (README §Page 5 + `PlayersPage.dc.html`): annuaire with search, team chips, stats table, and the M2 profile modal (edit + optimistic create, real photo upload).

## Product decisions (settled — memory + handoff)

- Data: Glicko-2 rows/events from `useRatings` (same engine as Classement). « ELO » = rounded rating (départ 1500), « MATCHS »/« V · D » from rating events.
- Teams: the app's `TEAMS` list (6 pôles, not the handoff's 5) + any free-text teams present among players. M2 keeps the free input (« ou saisis une autre équipe »).
- Photo upload is real (processAvatarFile → Supabase storage), **not** DataURL. Photo changes apply on « Enregistrer » only, so Annuler rolls everything back.
- Optimistic create: « + Ajouter un joueur » inserts a row immediately (via `createPlayer`), modal opens as « Nouveau joueur »; Annuler/Échap/scrim deletes the pending row.
- `allowRemove` prop omitted (no consumer would pass false — no dead code). Corbeille deletes immediately, per handoff.
- Searches get ⌘K focus (house convention). Breakpoint 820px (house), table → card list on mobile (RESPONSIVE §4), no hover-only actions on touch (§5).
- CSS appended to `index.css` with the `pl-` prefix.

## Acceptance Criteria

- [ ] /players renders the dashboard shell (nav + tab bar, « Joueurs » active), title 32px, subtitle « {n} joueurs inscrits · modifie un profil en un clic ».
- [ ] Search (250px, ⌘K) filters on name **and** team, accent-insensitive; team chips « Tous · {n} » + one per team filter the table; both combine.
- [ ] Table shows avatar, nom + « {V} V · {D} D », badge d'équipe, Elo, « {n} matchs », « {r} % » (green ≥ 50 %), crayon + corbeille revealed on row hover (always visible on touch).
- [ ] Empty state « Aucun joueur trouvé » when filters match nothing.
- [ ] Crayon opens M2 « Modifier {nom} »: nom, chips d'équipe + saisie libre, photo (Téléverser/Remplacer/Retirer). Enregistrer persists; Annuler/Échap/scrim discards.
- [ ] « + Ajouter un joueur » optimistically creates (M2 « Nouveau joueur »); cancel removes the pending player. Empty name saves as « Sans nom », empty team as « — ».
- [ ] Photo picked in M2 uploads to Supabase storage on save; « Retirer » on save removes storage object + row pointer.
- [ ] Corbeille removes the player immediately.
- [ ] ≤ 820px: rows become cards, actions visible, no horizontal scroll.

## Slices

One PR for the page; each slice is a green auto-committed increment (RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR on the pure lib; UI verified by Thibault, never by auto-opening a browser).

### Slice 1: Pure selectors `src/lib/joueurs.ts`

**Value**: TDD'd view-model for the whole page.
**Path**: `RatingRow[]`/`RatingEvent[]` → `joueurRows` (name, team, elo, played, meta, winrate + strong flag, avatar) → `filterJoueurs(rows, query, team)` (fold on name + team label) → `teamChips(rows)` (« Tous · {n} » + per-team counts, TEAMS order then extras).
**RED**: factories for rows/events; behaviors: elo rounding, V/D meta, winrate green at exactly 50 %, 0-match player (0 %, muted), fold search (« léo » ↔ « leo », team label match), chip counts incl. free-text team, combined query+team filter, empty result.
**GREEN**: minimal selectors. **MUTATE/KILL**: Stryker on `joueurs.ts`; document equivalents in this file.

### Slice 2: Page shell + table (replace `Players.tsx`, wire `App.tsx`)

**Value**: The annuaire is browsable in the new design.
**Path**: route /players → `useRatings` → header (title, subtitle, search, « + Ajouter un joueur »), chips, table (42px avatar, badge, Elo, matchs, victoires, actions), empty state, loading/error like Ratings. `pl-` CSS. Nav callbacks in App.tsx (`active="players"`).
**Done when**: page renders all states from slice-1 selectors; typecheck + tests green.

### Slice 3: M2 modal — edit path

**Value**: Rename / change team from the annuaire in one click.
**Path**: crayon → modal (scrim blur, Échap, croix, scrim-click; panel stops propagation) → NOM input, ÉQUIPE chips + free input → Enregistrer → `updatePlayer` → realtime refresh. Pure `normalizeJoueurForm` (« Sans nom » / « — ») + `dialogTitle` TDD'd in `joueurs.ts`.
**RED**: normalize fallbacks (empty/whitespace name, empty team, trim), dialog title pending vs edit (« Modifier {form name} », fallback « le joueur »).

### Slice 4: M2 modal — optimistic create

**Value**: Add a player without leaving the page.
**Path**: « + Ajouter un joueur » → `createPlayer('Nouveau joueur', 'tech')` → modal opens pending with empty name form → Enregistrer = `updatePlayer` (normalized) ; Annuler/Échap/scrim = `deletePlayer(pending)`.

### Slice 5: M2 photo — real upload, deferred to save

**Value**: Profile photos that survive cancel semantics.
**Path**: avatar 76px + Téléverser/Remplacer/Retirer → pick: validate + `processAvatarFile` → blob held in form (object-URL preview) → save: `uploadPlayerAvatar` + `avatar_url` patch, or `removePlayerAvatar`. Pure `avatarAction(original, photo)` → 'none' | 'upload' | 'remove' TDD'd (remove with no original → 'none'; label Téléverser/Remplacer).
**RED**: avatarAction matrix, upload label logic.

### Slice 6: Delete + responsive + polish

**Value**: Complete page on all form factors.
**Path**: corbeille immediate delete; `@media (hover:hover)` for reveals (visible otherwise); ≤ 820px card layout per RESPONSIVE §4; `prefers-reduced-motion`; entry animations.

## Pre-PR Quality Gate

1. Stryker on `src/lib/joueurs.ts` — survivors documented below
2. Refactoring assessment
3. `npm run typecheck` (tsc) + lint + full vitest suite
4. PR into dashboard-revamp; CI watched in background; merge on green; delete branch

## Mutation notes

- Slice 1 (`joueurs.ts`): **100 % (72/72 killed)** after killing 2 survivors — `played >= 2` plural boundary (added « 2 matchs » test) and extras dedup `indexOf === i` (added distinct-free-text-teams test). No equivalents.
- Slice 1 rework (registry-based rows): 2 real survivors on the row-matching fallback (homonym row owned by another id; unowned row with a different name) — killed with dedicated tests. The `r.team !== ''` guard in `filterJoueurs` produced only *equivalent* mutants (`teamLabel('')` folds to `''`, which never contains a non-empty query) — guard deleted instead of tested.
- Final run (full module incl. subtitle/normalize/dialogTitle/avatarAction/photoShown): **100 % (148/148 killed)**, 0 survivors, 0 equivalents.

---
*Delete this file when the plan is complete.*
