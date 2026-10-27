-- LOCAL disposable database only. Runs as privileged session and rolls back.
-- Temporary same-named tables exercise the real trigger function without
-- creating auth.users. This does not exercise real FK, RLS or concurrency.
begin;

create temp table gig_drafts (id integer primary key, owner_id uuid not null) on commit drop;
create temp table gig_reviews (id integer primary key, owner_id uuid not null) on commit drop;
create trigger test_draft_storage after insert or delete on pg_temp.gig_drafts
for each row execute function jazzlink_private.count_owner_storage();
create trigger test_review_storage after insert or delete on pg_temp.gig_reviews
for each row execute function jazzlink_private.count_owner_storage();
grant usage on schema pg_temp to authenticated;
grant select, insert, delete on pg_temp.gig_drafts, pg_temp.gig_reviews to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","is_anonymous":false}', true);
do $$
declare i integer; blocked boolean := false;
begin
  for i in 1..20 loop
    insert into pg_temp.gig_drafts values (i, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  end loop;
  -- Duplicate insert must not count as a new row.
  insert into pg_temp.gig_drafts values (1, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') on conflict do nothing;
  begin
    insert into pg_temp.gig_drafts values (21, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  exception when raise_exception then
    blocked := sqlerrm = 'storage limit reached';
  end;
  if not blocked then raise exception 'draft count limit did not reject row 21'; end if;
  delete from pg_temp.gig_drafts where id = 1;
  insert into pg_temp.gig_drafts values (21, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

  for i in 1..100 loop
    insert into pg_temp.gig_reviews values (i, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  end loop;
  blocked := false;
  begin
    insert into pg_temp.gig_reviews values (101, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  exception when raise_exception then
    blocked := sqlerrm = 'storage limit reached';
  end;
  if not blocked then raise exception 'review count limit did not reject row 101'; end if;
  delete from pg_temp.gig_reviews where id = 1;
  insert into pg_temp.gig_reviews values (101, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

  blocked := false;
  begin
    insert into pg_temp.gig_drafts values (22, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then raise exception 'other owner was accepted'; end if;
end $$;

reset role;
do $$
declare draft_count integer; review_count integer;
begin
  select drafts, reviews into draft_count, review_count
  from jazzlink_private.owner_storage_counts where owner_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  if draft_count <> 20 or review_count <> 100 then
    raise exception 'counter does not match successful inserts and deletes';
  end if;
  if has_table_privilege('authenticated', 'jazzlink_private.owner_storage_counts', 'select')
     or has_table_privilege('authenticated', 'jazzlink_private.owner_storage_counts', 'update')
     or has_function_privilege('authenticated', 'jazzlink_private.count_owner_storage()', 'execute') then
    raise exception 'counter access granted to authenticated client';
  end if;
end $$;

-- Constraint is active even with FK triggers disabled. A synthetic owner avoids
-- creating a user. The check is performed against the real public table.
set local session_replication_role = replica;
do $$
begin
  begin
    insert into public.gig_drafts(id, owner_id, draft)
    values ('88888888-8888-4888-8888-888888888888',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      jsonb_build_object('oversized', repeat('x', 131073)));
    raise exception 'oversized JSON was accepted';
  exception when check_violation then null;
  end;
end $$;
rollback;
