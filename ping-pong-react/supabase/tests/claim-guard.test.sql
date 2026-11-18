-- Today's claim guard: a player row may only be claimed by the signed-in
-- account itself.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into public.players (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Léo');

do $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  begin
    update public.players
       set auth_user_id = '00000000-0000-0000-0000-00000000000b'
     where id = '10000000-0000-0000-0000-000000000001';
  exception when raise_exception then
    if sqlerrm = 'you can only claim a player as yourself' then
      return;
    end if;
    raise;
  end;
  raise exception 'FAIL: claiming a player as somebody else was allowed';
end $$;
