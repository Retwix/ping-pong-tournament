-- Every row of the five tables belongs to an org: rows that predate the
-- migration are Recovr's, a signed-out write lands in Recovr, and a signed-in
-- write lands in the token's org.

-- Rewind to a database whose rows predate orgs-migration.sql.
alter table public.players       drop column if exists org_id;
alter table public.tournaments   drop column if exists org_id;
alter table public.matches       drop column if exists org_id;
alter table public.rating_events drop column if exists org_id;
alter table public.predictions   drop column if exists org_id;

insert into public.players (id, name) values ('30000000-0000-0000-0000-000000000001', 'Inès');
insert into public.tournaments (id, players) values ('30000000-0000-0000-0000-000000000002', '{Inès,Léo}');
insert into public.matches (id, tournament_id, round, idx, player_a, player_b)
values ('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 1, 0, 'Inès', 'Léo');
insert into public.rating_events (match_id, player_id, rating_before, rating_after, rd_before, rd_after, delta, won)
values ('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 1500, 1510, 350, 340, 10, true);
insert into public.predictions (bettor_name, tournament_id, target)
values ('Léo', '30000000-0000-0000-0000-000000000002', 'Inès');

\ir ../orgs-migration.sql

do $$
declare
  t text;
  strays bigint;
begin
  foreach t in array array['players', 'tournaments', 'matches', 'rating_events', 'predictions'] loop
    if (select is_nullable from information_schema.columns
         where table_schema = 'public' and table_name = t and column_name = 'org_id') is distinct from 'NO' then
      raise exception 'FAIL: %.org_id is missing or nullable', t;
    end if;
    execute format('select count(*) from public.%I where org_id is distinct from public.recovr_org_id()', t)
      into strays;
    if strays <> 0 then
      raise exception 'FAIL: % existing % rows are not Recovr''s', strays, t;
    end if;
  end loop;
end $$;

insert into public.orgs (id, slack_team_id, name)
values ('20000000-0000-0000-0000-00000000000e', 'T_ELSEWHERE', 'Elsewhere');

do $$
declare
  org uuid;
begin
  perform set_config('role', 'anon', true);
  insert into public.tournaments (players) values ('{A,B}') returning org_id into org;
  if org is distinct from public.recovr_org_id() then
    raise exception 'FAIL: a signed-out tournament landed in %, not Recovr', org;
  end if;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub": "00000000-0000-0000-0000-00000000000a", "org_id": "20000000-0000-0000-0000-00000000000e"}', true);
  insert into public.tournaments (players) values ('{C,D}') returning org_id into org;
  if org is distinct from '20000000-0000-0000-0000-00000000000e' then
    raise exception 'FAIL: a signed-in tournament landed in %, not the token''s org', org;
  end if;
end $$;
