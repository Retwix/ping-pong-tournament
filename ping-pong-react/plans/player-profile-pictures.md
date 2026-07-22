# Plan: Player Profile Pictures

**Branch**: feat/player-avatars
**Status**: Active
**Spec**: docs/superpowers/specs/2026-07-20-player-profile-pictures-design.md

## Goal

Players get an uploadable profile picture, edited from the Players page and
shown everywhere the app currently renders an initial-letter avatar.

## Acceptance Criteria

- [ ] From the Players page edit mode, picking an image file uploads a
      256×256 WebP to Supabase Storage and the player's photo appears in the
      players list.
- [ ] A player with a photo can have it removed; the row falls back to the
      colored initial.
- [ ] Photos appear in PlayerModal, Ratings, and Stats wherever the initial
      avatar appeared; players without photos keep the initial.
- [ ] The SpectatorView (TV) shows photos for players who have one.
- [ ] Invalid files (non-image, > 10 MB) are rejected with a visible error and
      nothing is uploaded.
- [ ] A broken stored URL silently falls back to the initial (no error banner).

## Manual Step (before Slice 1 can be verified live)

Run `supabase/avatar-migration.sql` in the Supabase SQL editor (adds
`players.avatar_url`, creates the public `avatars` bucket, adds anon storage
policies). Same process as the existing `*-migration.sql` files.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code
without a failing test. Load `tdd`, `testing`, `mutation-testing`, and
`refactoring` before code changes in each slice; `react-testing` for the
component slices.

### Slice 1: Upload a photo from the Players page and see it in the players list

**Value**: The organizer can give a player a real face in the registry — the
walking skeleton proving the full path (file pick → crop/resize → Storage →
`players.avatar_url` → rendered photo).
**Path**: Players page pencil-edit → avatar click (camera badge) → file input →
`src/lib/avatar.ts` validate + center-crop + 256px WebP → Storage upload
`avatars/players/<id>.webp` (`upsert: true`) → `updatePlayer(id, { avatar_url })`
with `?v=<timestamp>` cache-buster → `refresh()` → new `Avatar` component in
the players list renders the photo, initial fallback when null or on image
error. Skipped states (later slices): removal, other pages.
**Includes**: `supabase/avatar-migration.sql` (column + bucket + anon
policies), `avatar_url` on `Player` in src/types.ts, `updatePlayer` patch type,
`src/lib/avatar.ts`, `src/components/Avatar.tsx`, Players.tsx wiring.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`,
`refactoring`, `react-testing`.
**Acceptance criteria** (confirm with human before code):
- Picking a valid image in edit mode results in one Storage upload at the
  stable path and an `avatar_url` update on the row; the list shows the photo.
- A non-image or > 10 MB file shows the error banner and triggers no upload.
- Players with `avatar_url: null` render exactly the current colored initial.
- An `avatar_url` that fails to load falls back to the initial.
**RED**: Unit tests for the pure crop-rect function (landscape, portrait,
square, exact-256 inputs — boundary mutants: `<` vs `<=`, offset arithmetic)
and file validation (type, 10 MB boundary). Component tests for `Avatar`
(photo / null / onError fallback). Players page behavior test: pick file →
db-layer seam receives upload + patch (storage and db stubbed at src/lib).
**GREEN**: Minimum implementation of avatar.ts, Avatar.tsx, and the Players
edit-mode file input wiring.
**MUTATE**: Run `mutation-testing` on the touched files — produce a report.
**KILL MUTANTS**: Strengthen tests for survivors (crop offsets and size
boundaries are the likely ones); ask the human when value is ambiguous.
**REFACTOR**: Assess — likely candidate: Players.tsx edit row is growing;
extract if it adds clarity.
**Done when**: Criteria met, mutation report reviewed, human approves commit.

### Slice 2: Remove a photo and fall back to the initial

**Value**: The organizer can undo a bad upload or clear a departed player's
photo.
**Path**: Players page edit mode → "Retirer la photo" control (visible only
when a photo exists) → Storage `remove(['players/<id>.webp'])` →
`updatePlayer(id, { avatar_url: null })` → `refresh()` → initial avatar shown.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`,
`refactoring`, `react-testing`.
**Acceptance criteria** (confirm with human before code):
- The control only appears for players with a photo, in edit mode.
- Clicking it deletes the storage object, nulls `avatar_url`, and the row
  shows the initial again.
- A failed deletion surfaces the error banner and leaves the row unchanged.
**RED**: Players page behavior tests: control visibility (photo vs no photo),
successful removal calls storage remove + null patch, failure path shows the
banner (negation/visibility mutants).
**GREEN**: Minimum removal handler + control markup.
**MUTATE / KILL MUTANTS / REFACTOR**: As per skills; report to human.
**Done when**: Criteria met, mutation report reviewed, human approves commit.

### Slice 3: Photos everywhere in the main app (PlayerModal, Ratings, Stats)

**Value**: Anyone browsing stats, ratings, or a player's detail sees faces
instead of initials, consistently.
**Path**: Existing data loads already carry full `Player` rows / names →
replace the ad-hoc avatar markup in PlayerModal.tsx:52, Ratings.tsx:15,
Stats.tsx:36 with the shared `Avatar` component (sizes preserved via the
existing `sm`/`lg` variants).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`,
`refactoring`, `react-testing`.
**Acceptance criteria** (confirm with human before code):
- Each of the three surfaces shows the photo for a player with `avatar_url`
  and the identical-to-today initial otherwise.
- Existing size/color styling is preserved (sm avatars stay small, team color
  fallback unchanged).
**RED**: Component tests per surface: with-photo renders an img, without-photo
renders the initial with the team color (className/variant mutants).
**GREEN**: Swap markup for `Avatar` in the three components; plumb
`avatar_url` where only names are currently passed.
**MUTATE / KILL MUTANTS / REFACTOR**: As per skills; report to human.
**Done when**: Criteria met, mutation report reviewed, human approves commit.

### Slice 4: Photos on the SpectatorView (TV)

**Value**: The wall-mounted spectator screen shows the players' faces during
live matches.
**Path**: `src/lib/spectator.ts` payload gains `avatar_url` per player →
SpectatorView.tsx tv-step-avatar and tv-avatar blocks (lines ~115, ~159, ~169,
~266) render the photo via `Avatar` (or a TV-sized variant), monogram fallback
unchanged.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`,
`refactoring`, `react-testing`.
**Acceptance criteria** (confirm with human before code):
- A live match between players with photos shows both photos on the TV view.
- Players without photos keep the current two-letter monogram.
- Payloads written before this change (no `avatar_url` field) render the
  monogram without errors.
**RED**: Tests on the spectator payload builder (includes `avatar_url`,
tolerates its absence) and TV avatar rendering (photo vs monogram vs missing
field — optional-chaining/null mutants).
**GREEN**: Minimum payload + rendering changes.
**MUTATE / KILL MUTANTS / REFACTOR**: As per skills; report to human.
**Done when**: Criteria met, mutation report reviewed, human approves commit.

## Pre-PR Quality Gate

Before each PR:
1. Mutation testing — run `mutation-testing` skill
2. Refactoring assessment — run `refactoring` skill
3. Typecheck (`npm run build`) and tests (`npm test`) pass
4. PR flow per preference: branch → PR → watch CI in background → merge on
   green → delete branch

---
*Delete this file when the plan is complete. If `plans/` is empty, delete the directory.*
