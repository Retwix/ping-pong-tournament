-- The access-token hook: a Slack sign-in from a known workspace gets that
-- company's org in its token and a membership.
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.orgs (id, slack_team_id, name) values
  ('20000000-0000-0000-0000-00000000000e', 'T_ELSEWHERE', 'Elsewhere');
insert into auth.identities (user_id, provider, provider_id, identity_data, last_sign_in_at)
select '00000000-0000-0000-0000-00000000000a', 'slack_oidc', 'U1',
       jsonb_build_object('custom_claims',
         jsonb_build_object('https://slack.com/team_id', o.slack_team_id)),
       now() - interval '1 day'
  from public.orgs o where o.name = 'Elsewhere';
insert into auth.identities (user_id, provider, provider_id, identity_data, last_sign_in_at)
select '00000000-0000-0000-0000-00000000000a', 'slack_oidc', 'U2',
       jsonb_build_object('custom_claims',
         jsonb_build_object('https://slack.com/team_id', o.slack_team_id)),
       now()
  from public.orgs o where o.name = 'Recovr';

do $$
declare
  event constant jsonb := jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-00000000000a',
    'claims', jsonb_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated'));
  result jsonb;
begin
  perform set_config('role', 'supabase_auth_admin', true);
  perform public.custom_access_token_hook(event);
  result := public.custom_access_token_hook(event);
  perform set_config('role', 'none', true);

  if result->'claims'->>'org_id' is distinct from (select id::text from public.orgs where name = 'Recovr') then
    raise exception 'FAIL: token org_id is %, expected Recovr''s', result->'claims'->>'org_id';
  end if;
  if result->'claims'->>'org_name' is distinct from 'Recovr' then
    raise exception 'FAIL: token org_name is %', result->'claims'->>'org_name';
  end if;
  if result->'claims'->>'role' is distinct from 'authenticated' then
    raise exception 'FAIL: the existing claims were not kept';
  end if;
  if (select count(*) from public.memberships
       where user_id = '00000000-0000-0000-0000-00000000000a') <> 1 then
    raise exception 'FAIL: expected exactly one membership after two sign-ins';
  end if;
end $$;

-- Nobody but the hook's role reads companies or mints claims.
set role anon;
do $$
begin
  if exists (select 1 from public.orgs) or exists (select 1 from public.memberships) then
    raise exception 'FAIL: a signed-out visitor can read orgs or memberships';
  end if;
end $$;
reset role;

set role authenticated;
do $$
begin
  begin
    perform public.custom_access_token_hook('{"user_id": "00000000-0000-0000-0000-00000000000a", "claims": {}}');
  exception when insufficient_privilege then
    if sqlerrm = 'permission denied for function custom_access_token_hook' then
      return;
    end if;
    raise;
  end;
  raise exception 'FAIL: a signed-in user can call the access-token hook';
end $$;
reset role;
