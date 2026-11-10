-- The access-token hook refuses a sign-in whose latest Slack identity belongs
-- to a workspace with no org, and writes no membership.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3');

insert into auth.identities (user_id, provider, provider_id, identity_data, last_sign_in_at)
select u.user_id::uuid, u.provider, u.provider_id,
       jsonb_build_object('custom_claims', jsonb_build_object('https://slack.com/team_id', u.team_id)),
       now() - u.age
  from (values
    -- moved on: the latest sign-in is from an unknown workspace
    ('00000000-0000-0000-0000-0000000000a1', 'slack_oidc', 'U1', (select slack_team_id from public.orgs where name = 'Recovr'), interval '1 day'),
    ('00000000-0000-0000-0000-0000000000a1', 'slack_oidc', 'U2', 'T_UNKNOWN', interval '0'),
    -- no Slack identity at all
    ('00000000-0000-0000-0000-0000000000a2', 'email', 'a2@example.com', null, interval '0'),
    -- another provider claiming to be Recovr's workspace
    ('00000000-0000-0000-0000-0000000000a3', 'keycloak', 'kc-3', (select slack_team_id from public.orgs where name = 'Recovr'), interval '0')
  ) as u(user_id, provider, provider_id, team_id, age);

do $$
declare
  who text;
  result jsonb;
begin
  foreach who in array array[
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a3'
  ] loop
    perform set_config('role', 'supabase_auth_admin', true);
    result := public.custom_access_token_hook(
      jsonb_build_object('user_id', who, 'claims', jsonb_build_object('sub', who)));
    perform set_config('role', 'none', true);

    if result is distinct from
       '{"error": {"http_code": 403, "message": "workspace_not_on_ping_pong"}}'::jsonb then
      raise exception 'FAIL: % was not refused: %', who, result;
    end if;
  end loop;

  if exists (select 1 from public.memberships) then
    raise exception 'FAIL: a refused sign-in wrote a membership';
  end if;
end $$;
