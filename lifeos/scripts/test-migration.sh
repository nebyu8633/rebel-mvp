#!/usr/bin/env bash
# Applies the Supabase migration to a throwaway local PostgreSQL (with a minimal stub of
# Supabase's auth schema) and checks Row Level Security isolation between two users.
# Requires PostgreSQL 15+ binaries (initdb, pg_ctl, psql). Does not touch any real database.
set -euo pipefail
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
DIR=$(mktemp -d)
PORT=${PORT:-55439}
RUNAS=""
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DIR"; RUNAS="sudo -u postgres"; fi
$RUNAS "$PGBIN/initdb" -D "$DIR/data" -U postgres >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR" -l "$DIR/log" start >/dev/null
trap '$RUNAS "$PGBIN/pg_ctl" -D "$DIR/data" stop >/dev/null; rm -rf "$DIR"' EXIT
PSQL="$RUNAS psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL <<'SQL'
create role authenticated nologin; create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon; grant usage on schema public to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
SQL
for f in "$(dirname "$0")"/../supabase/migrations/*.sql; do $PSQL -f "$f"; done
$PSQL <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into goals (id,title,kind,status,start_date,target_date,finance_account_id) values ('g','מטרה א','custom','active','2026-11-01','2027-11-01','acct');
insert into finance_accounts (id,name,kind,goal_id) values ('acct','חיסכון','savings','g');
insert into finance_entries (id,account_id,date,kind,amount) values ('e1','acct','2026-11-01','deposit',100.5);
insert into tasks (id,title,goal_id,recurrence) values ('t','משימה','g','{"freq":"weekly"}');
insert into task_occurrences (id,task_id,original_date,status) values ('t:2026-11-05','t','2026-11-05','completed');
insert into user_settings (id,availability) values ('settings','[null,null,null,null,null,null,null]');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
-- user 2 sees nothing of user 1 and can reuse the same ids
do $$ begin
  if (select count(*) from goals) <> 0 or (select count(*) from tasks) <> 0 then raise exception 'RLS leak'; end if;
end $$;
insert into user_settings (id,availability) values ('settings','[]');
update tasks set title='hacked' where id='t';
delete from goals where id='g';
-- cannot write rows for someone else
do $$ begin
  begin
    insert into goals (user_id,id,title,kind,status,start_date,target_date)
      values ('11111111-1111-1111-1111-111111111111','x','זר','custom','active','2026-11-01','2027-11-01');
    raise exception 'RLS insert check failed';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if (select title from tasks where id='t') <> 'משימה' then raise exception 'cross-user update'; end if;
  if (select count(*) from goals) <> 1 then raise exception 'cross-user delete'; end if;
end $$;
-- deleting a goal unlinks tasks instead of deleting them; deleting a task cascades its occurrences
delete from goals where id='g';
do $$ begin
  if (select goal_id from tasks where id='t') is not null then raise exception 'goal_id not nulled'; end if;
  if (select user_id from tasks where id='t') is null then raise exception 'user_id nulled'; end if;
end $$;
delete from tasks where id='t';
do $$ begin if (select count(*) from task_occurrences) <> 0 then raise exception 'occurrence not cascaded'; end if; end $$;
reset role;
set role anon;
do $$ begin
  begin perform 1 from goals; raise exception 'anon can read'; exception when insufficient_privilege then null; end;
end $$;
SQL
echo "migration + RLS checks: OK"
