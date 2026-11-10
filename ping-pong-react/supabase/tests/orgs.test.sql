-- Companies and memberships are invisible to the client.
set role anon;
do $$
begin
  if exists (select 1 from public.orgs) or exists (select 1 from public.memberships) then
    raise exception 'FAIL: a signed-out visitor can read orgs or memberships';
  end if;
end $$;
reset role;
