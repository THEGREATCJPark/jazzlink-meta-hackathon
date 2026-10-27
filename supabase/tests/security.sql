-- Transactional, synthetic security regression test for a LOCAL test database.
-- Requires a privileged session able to set session_replication_role.
-- FK triggers are disabled to use invented UUIDs without creating auth.users.
-- This is not a real JWT, HTTP, foreign-key, or simultaneous-session test.
-- Any failed assertion aborts the transaction; a successful run ends ROLLBACK.
begin;

do $$
begin
  if has_table_privilege('anon', 'public.gig_drafts', 'select')
     or has_table_privilege('anon', 'public.gig_reviews', 'select')
     or has_function_privilege('anon', 'public.create_gig_review(uuid,integer,uuid,boolean)', 'execute')
     or has_table_privilege('authenticated', 'public.gig_reviews', 'insert')
     or has_table_privilege('authenticated', 'public.gig_reviews', 'update')
     or has_table_privilege('authenticated', 'public.gig_reviews', 'delete') then
    raise exception 'unexpected database grant';
  end if;
end $$;

-- Insert a fictional draft with a nonexistent auth user while FK triggers are
-- disabled. Re-enable triggers before checking the draft version trigger.
set local session_replication_role = replica;
insert into public.gig_drafts(id, owner_id, source_text, draft)
values (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'synthetic original', '{"review":{}}'::jsonb
);
set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}', true);

do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.gig_drafts
  where id = '11111111-1111-4111-8111-111111111111';
  if visible_count <> 1 then raise exception 'owner cannot read own draft'; end if;
  begin
    update public.gig_drafts set source_text = 'without version increment'
    where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'draft version trigger did not reject update';
  exception when check_violation then null;
  end;
end $$;

-- The review FK also refers to the fictional auth ID. Disable FK triggers
-- again only for the review scenario; this also disables all other triggers
-- in this session, so the version trigger was tested separately above.
reset role;
set local session_replication_role = replica;
set local role authenticated;
do $$
declare
  first_id uuid;
  repeated_id uuid;
  actor uuid;
  old_text text;
begin
  first_id := public.create_gig_review(
    '11111111-1111-4111-8111-111111111111', 1,
    '22222222-2222-4222-8222-222222222222', true
  );
  repeated_id := public.create_gig_review(
    '11111111-1111-4111-8111-111111111111', 1,
    '22222222-2222-4222-8222-222222222222', true
  );
  if first_id <> repeated_id then raise exception 'request idempotency failed'; end if;

  select reviewed_by, source_text into actor, old_text
  from public.gig_reviews where id = first_id;
  if actor <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' or old_text <> 'synthetic original' then
    raise exception 'server actor or saved source was not preserved';
  end if;

  begin
    perform public.create_gig_review(
      '11111111-1111-4111-8111-111111111111', 1,
      '33333333-3333-4333-8333-333333333333', true
    );
    raise exception 'same draft version accepted under a second request';
  exception when unique_violation then null;
  end;
  begin
    update public.gig_reviews set source_text = 'tampered' where id = first_id;
    raise exception 'direct review update was permitted';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.gig_reviews where id = first_id;
    raise exception 'direct review delete was permitted';
  exception when insufficient_privilege then null;
  end;

  update public.gig_drafts set source_text = 'synthetic updated', version = 2
  where id = '11111111-1111-4111-8111-111111111111';
  select source_text into old_text from public.gig_reviews where id = first_id;
  if old_text <> 'synthetic original' then raise exception 'old review changed with draft'; end if;
  repeated_id := public.create_gig_review(
    '11111111-1111-4111-8111-111111111111', 1,
    '22222222-2222-4222-8222-222222222222', true
  );
  if first_id <> repeated_id then raise exception 'retry after draft edit failed'; end if;

  begin
    perform public.create_gig_review(
      '11111111-1111-4111-8111-111111111111', 1,
      '44444444-4444-4444-8444-444444444444', true
    );
    raise exception 'stale expected version was accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.create_gig_review(
      '11111111-1111-4111-8111-111111111111', 2,
      '55555555-5555-4555-8555-555555555555', false
    );
    raise exception 'review without explicit confirmation was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":false}', true);
do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.gig_drafts
  where id = '11111111-1111-4111-8111-111111111111';
  if visible_count <> 0 then raise exception 'other user read private draft'; end if;
  select count(*) into visible_count from public.gig_reviews;
  if visible_count <> 0 then raise exception 'other user read private review'; end if;
  update public.gig_drafts set source_text = 'not allowed', version = 3
  where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics visible_count = row_count;
  if visible_count <> 0 then raise exception 'other user updated private draft'; end if;
  begin
    perform public.create_gig_review(
      '11111111-1111-4111-8111-111111111111', 2,
      '66666666-6666-4666-8666-666666666666', true
    );
    raise exception 'other user reviewed private draft';
  exception when no_data_found then null;
  end;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":true}', true);
do $$
begin
  if public.reserve_model_call() then raise exception 'anonymous account reserved model quota'; end if;
  begin
    perform public.create_gig_review(
      '11111111-1111-4111-8111-111111111111', 2,
      '77777777-7777-4777-8777-777777777777', true
    );
    raise exception 'anonymous account reviewed draft';
  exception when invalid_parameter_value then null;
  end;
end $$;

rollback;
