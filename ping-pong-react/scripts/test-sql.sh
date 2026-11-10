#!/usr/bin/env bash
# Builds a scratch database that looks like our Supabase project, applies
# schema.sql and every migration, then runs supabase/tests/*.test.sql.
# Connection comes from the usual PG* environment variables.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
sql="$root/supabase"
db="pingpong_sql_test_$$"
export PGOPTIONS="-c client_min_messages=error"

migrations=(
  matchball predictions slack double-elim ratings chaos avatar
  unranked doubles alumni auth sets bio orgs
)

for f in "$sql"/*-migration.sql; do
  name="$(basename "$f" -migration.sql)"
  if [[ " ${migrations[*]} " != *" $name "* ]]; then
    echo "$name-migration.sql is not in the migrations list of $0" >&2
    exit 1
  fi
done

psql_q() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_q -d postgres <<'SQL'
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'supabase_auth_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;
SQL

createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT

psql_q -d "$db" -f "$sql/tests/supabase-stubs.sql"
for _ in 1 2; do
  psql_q -d "$db" -f "$sql/schema.sql"
  for m in "${migrations[@]}"; do
    psql_q -d "$db" -f "$sql/$m-migration.sql"
  done
done

failed=0
for t in "$sql"/tests/*.test.sql; do
  if psql_q -d "$db" -c begin -f "$t" -c rollback >/dev/null; then
    echo "ok   $(basename "$t")"
  else
    echo "FAIL $(basename "$t")"
    failed=1
  fi
done
exit "$failed"
