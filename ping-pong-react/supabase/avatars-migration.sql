-- ============================================================
-- Profile pictures — migration
-- Adds an avatar_url column to players and a public Storage bucket
-- ("avatars") to hold the uploaded images.
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- ============================================================

-- 1) Column on the player registry holding the public URL of the photo.
--    null = no photo yet (the UI falls back to the colored initial).
alter table public.players add column if not exists avatar_url text;

-- 2) Public Storage bucket for the images. `public = true` so the live
--    scoreboard can load the photos by URL without a signed request.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 3) Open policies on the bucket, matching the rest of this casual office
--    tool (anyone with the anon key can read/write). Tighten later if needed.
drop policy if exists "avatars public read"   on storage.objects;
drop policy if exists "avatars public insert" on storage.objects;
drop policy if exists "avatars public update" on storage.objects;
drop policy if exists "avatars public delete" on storage.objects;

create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars public insert" on storage.objects
  for insert with check (bucket_id = 'avatars');

create policy "avatars public update" on storage.objects
  for update using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

create policy "avatars public delete" on storage.objects
  for delete using (bucket_id = 'avatars');
