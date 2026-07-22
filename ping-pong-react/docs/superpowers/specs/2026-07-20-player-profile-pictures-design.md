# Design: Player Profile Pictures

**Date**: 2026-07-20
**Status**: Approved (brainstorming session)

## Goal

Players can have a profile picture, uploaded from a device through the Players
page, displayed everywhere the app currently shows an initial-letter avatar.

## Decisions Made

- **Source**: upload from device (no Slack fetch, no URL paste).
- **Processing**: automatic center-crop to square + downscale client-side (no
  interactive cropper).
- **Display scope**: everywhere avatars appear — Players, PlayerModal, Ratings,
  Stats, SpectatorView (TV) — with fallback to the existing colored initial.

## Data Model

New nullable column on `public.players`:

```sql
alter table public.players add column if not exists avatar_url text;
```

Delivered as `supabase/avatar-migration.sql`, following the existing migration
pattern. `Player` (src/types.ts) gains `avatar_url: string | null`.
`updatePlayer` (src/lib/db.ts) accepts `avatar_url` in its patch.

## Storage

- Supabase Storage bucket `avatars`, public read.
- Upload path is stable per player: `players/<player-id>.webp`, uploaded with
  `upsert: true` — replacing a photo overwrites the old object, so no orphan
  cleanup is needed.
- The stored `avatar_url` is the bucket's public URL plus a `?v=<timestamp>`
  cache-buster so replacements show immediately despite the stable path.
- The app has no auth: the migration adds storage policies granting the anon
  role select/insert/update/delete on the `avatars` bucket, consistent with the
  rest of the app being open.

## Client-Side Processing (`src/lib/avatar.ts`)

- Validate: must be an `image/*` file, ≤ 10 MB before processing.
- Center-crop to square, downscale to 256×256 via canvas, export WebP
  (small files, fast avatars everywhere).
- The crop geometry is a pure function (source dimensions → crop rect) so it is
  unit-testable without a canvas.

## Edit UX (Players page)

- In the existing pencil-edit mode, the player's avatar becomes clickable with
  a small camera badge; clicking opens the file picker.
- Picking a file saves immediately: process → upload → `updatePlayer` →
  `refresh()`.
- While editing, a "Retirer la photo" control appears when a photo exists:
  deletes the storage object and nulls `avatar_url`.
- The "Nouveau joueur" modal is unchanged — photos are added after creation,
  because the storage path needs the player's id.

## Display (`Avatar` component)

A shared `Avatar` component renders:

- the photo when `avatar_url` is set;
- the current colored-initial look when `avatar_url` is null **or the image
  fails to load** (`onError` fallback).

It replaces the ad-hoc avatar markup in Players, PlayerModal, Ratings, Stats,
and the SpectatorView TV avatars. SpectatorView needs `avatar_url` plumbed
through the spectator payload alongside the player name.

## Error Handling

- Invalid file type / oversized file → surfaced via the page's existing
  `formError` banner, nothing uploaded.
- Upload or DB errors → same banner; player row unchanged.
- Broken stored URL → silent fallback to initial (no banner).

## Testing

- Crop/resize geometry: pure-function unit tests (Vitest).
- `Avatar` fallback behavior (photo / null / broken image): component tests.
- Upload flow: behavior tests through the Players page with the storage call
  stubbed at the db-layer seam.

## Out of Scope / Notes

- Fixing `db.ts` stripping `slack_user_id` in create/update (schema and
  migration for the column exist; the strip looks stale) — flagged separately,
  not part of this feature.
- Photo upload at player-creation time.
- Any moderation/resizing server-side.
