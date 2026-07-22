-- Player profile pictures: avatar_url column + public storage bucket.
-- Run in the Supabase SQL editor (same process as the other *-migration.sql files).

alter table public.players add column if not exists avatar_url text;

-- Public bucket for processed 256px WebP avatars, one object per player at
-- players/<player-id>.webp (uploads overwrite, the stored URL carries ?v=<ts>).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- The app is open (anon key, no auth) — mirror that for avatar storage.
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars insert" on storage.objects;
create policy "avatars insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

drop policy if exists "avatars update" on storage.objects;
create policy "avatars update"
  on storage.objects for update
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

drop policy if exists "avatars delete" on storage.objects;
create policy "avatars delete"
  on storage.objects for delete
  using (bucket_id = 'avatars');
