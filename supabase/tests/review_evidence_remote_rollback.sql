-- REVIEW BEFORE RUNNING. New hackathon project ONLY, after applying the
-- evidence migration. Requires privileged session to read auth.users and SET
-- ROLE, but performs user operations as authenticated with synthetic claims.
-- All newly created gig/review rows are within one ROLLBACK transaction.
-- Never disables triggers/constraints and never edits any existing user,
-- draft or review. No real identifiers are printed.
--
-- This simulates role/JWT claims inside PostgreSQL. It does NOT establish that
-- Auth issued a valid token, exercise PostgREST/HTTP, or test concurrent
-- transactions. It must not run in an unrestricted arbitrary project.
begin;
set local statement_timeout = '30s';

do $$
declare
  user_count integer;
  test_user uuid;
begin
  select count(*) into user_count from auth.users;
  if user_count <> 1 then raise exception 'expected exactly one isolated test account'; end if;
  select id into test_user from auth.users limit 1;
  if test_user is null then raise exception 'test account unavailable'; end if;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',test_user,'role','authenticated','is_anonymous',false)::text, true);
end $$;

set local role authenticated;
do $$
declare
  owner uuid := auth.uid();
  draft_id uuid := gen_random_uuid();
  request_one uuid := gen_random_uuid();
  first_review uuid;
  duplicate_review uuid;
  second_review uuid;
  source_one text := 'Synthetic venue: total fee $900.';
  source_two text := 'Synthetic musician: please confirm the payment date.';
  item_one jsonb := '{"field":"feeCents","value":"90000","quote":"$900","status":"stated","manual":false,"editedValue":"900.00","amountCents":90000,"selected":true}'::jsonb;
  item_two jsonb;
  document jsonb;
  denied boolean;
  row_count integer;
begin
  if owner is null then raise exception 'simulated authenticated identity missing'; end if;
  document := jsonb_build_object('review',jsonb_build_object('source',source_one,'items',jsonb_build_array(item_one),'questions','[]'::jsonb));
  insert into public.gig_drafts(id,owner_id,source_text,draft) values(draft_id,owner,source_one,document);
  first_review := public.create_gig_review(draft_id,1,request_one,true);
  duplicate_review := public.create_gig_review(draft_id,1,request_one,true);
  if first_review <> duplicate_review then raise exception 'idempotent review retry failed'; end if;

  item_two := item_one || jsonb_build_object('carriedFrom',
    jsonb_build_object('revision',1,'source',source_one,'fixture',false));
  document := jsonb_build_object('review',jsonb_build_object('source',source_two,'items',jsonb_build_array(item_two),'questions','[]'::jsonb,
    'baseline',jsonb_build_object('revision',1,'source',source_one,'fixture',false,'items',jsonb_build_array(item_one))));
  update public.gig_drafts set source_text=source_two,draft=document,version=2
  where id=draft_id and owner_id=owner and version=1;
  get diagnostics row_count = row_count;
  if row_count <> 1 then raise exception 'own draft version update failed'; end if;
  second_review := public.create_gig_review(draft_id,2,gen_random_uuid(),true);
  if second_review = first_review then raise exception 'new review did not receive a new ID'; end if;
  duplicate_review := public.create_gig_review(draft_id,1,request_one,true);
  if duplicate_review <> first_review then raise exception 'retry after edit changed original review'; end if;

  -- Old version fails; the earlier snapshot must remain unchanged.
  denied := false;
  begin
    perform public.create_gig_review(draft_id,1,gen_random_uuid(),true);
  exception when serialization_failure then denied := true;
  end;
  if not denied then raise exception 'stale draft version accepted'; end if;
  if not exists(select 1 from public.gig_reviews where id=first_review and source_text=source_one) then
    raise exception 'earlier reviewed source changed';
  end if;

  -- New mismatch is rejected at the database trigger, including direct RPC.
  document := jsonb_build_object('review',jsonb_build_object('source',source_two,'items',
    jsonb_build_array(item_one),'questions','[]'::jsonb));
  update public.gig_drafts set draft=document,version=3 where id=draft_id and owner_id=owner and version=2;
  denied := false;
  begin
    perform public.create_gig_review(draft_id,3,gen_random_uuid(),true);
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'invented quote accepted'; end if;

  denied := false;
  begin
    update public.gig_reviews set source_text='not permitted' where id=first_review;
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'direct immutable review update permitted'; end if;

  -- A different synthetic claim cannot see the new draft or create a review.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','is_anonymous',false)::text, true);
  if exists(select 1 from public.gig_drafts where id=draft_id)
     or exists(select 1 from public.gig_reviews where id=first_review) then
    raise exception 'another role can read synthetic data';
  end if;
  denied := false;
  begin
    perform public.create_gig_review(draft_id,3,gen_random_uuid(),true);
  exception when no_data_found then denied := true;
  end;
  if not denied then raise exception 'another role reviewed synthetic draft'; end if;
end $$;

reset role;
-- The one existing account's historical entries are inspected only in SQL;
-- nothing is printed or changed. Check any selected legacy money entry that
-- lacks cents using the same normalization applied for new baselines.
do $$
declare
  candidate jsonb;
  normalized jsonb;
begin
  select entry into candidate
  from public.gig_reviews r
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(r.draft#>'{review,items}')='array'
         then r.draft#>'{review,items}' else '[]'::jsonb end
  ) as items(entry)
  where r.owner_id=(select id from auth.users limit 1)
    and entry->>'field' in ('feeCents','ticketCents')
    and entry->'selected'='true'::jsonb
    and not (entry ? 'amountCents')
  limit 1;
  if candidate is not null then
    normalized := jazzlink_private.normalize_selected_history_money_v1(jsonb_build_array(candidate));
    if normalized is null or jsonb_typeof(normalized#>'{0,amountCents}') is distinct from 'number' then
      raise exception 'legacy money could not be validated';
    end if;
  end if;
end $$;

rollback;
