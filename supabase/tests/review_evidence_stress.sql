-- LOCAL PGlite stress test: 100 items, 99 carry hops plus 100-item baseline.
-- Synthetic historical rows use session_replication_role=replica only in a
-- disposable database. Success or controlled 57014 timeout are both acceptable;
-- record timing and don't treat timeout as invalid evidence.
begin;
create temp table stress_result(outcome text, elapsed_ms numeric) on commit drop;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}', true);
set local session_replication_role = replica;
do $$
declare
 d uuid := '99999999-1111-4111-8111-111111111111';
 own uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 source_text text; items jsonb; prev_items jsonb; i integer; doc jsonb;
begin
 select string_agg((chr(65+(n-1)/26)||chr(65+(n-1)%26)),'; ' order by n) into source_text from generate_series(1,100) as n;
 insert into public.gig_drafts(id,owner_id,source_text,draft)
 values(d,own,source_text,'{}'::jsonb);
 for i in 1..99 loop
  select jsonb_agg(
    jsonb_build_object('field','venue','value',(chr(65+(n-1)/26)||chr(65+(n-1)%26)),'quote',(chr(65+(n-1)/26)||chr(65+(n-1)%26)),'status','stated','manual',false,'editedValue',(chr(65+(n-1)/26)||chr(65+(n-1)%26)),'selected',true)
    || case when i=1 then '{}'::jsonb else jsonb_build_object('carriedFrom',jsonb_build_object('revision',i-1,'source',source_text,'fixture',false)) end
    order by n) into items from generate_series(1,100) as n;
  doc := jsonb_build_object('review',jsonb_build_object('source',source_text,'items',items,'questions','[]'::jsonb));
  insert into public.gig_reviews(draft_id,owner_id,reviewed_by,draft_version,revision,request_id,source_text,draft,content_sha256)
  values(d,own,own,i,i,gen_random_uuid(),source_text,doc,repeat('0',64));
 end loop;
end $$;
set local session_replication_role = origin;
do $$
declare
 d uuid := '99999999-1111-4111-8111-111111111111';
 own uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 source_text text; items jsonb; prev_items jsonb; doc jsonb;
 started timestamptz := clock_timestamp(); outcome text := 'completed';
begin
 select g.source_text into source_text from public.gig_drafts g where g.id=d;
 select r.draft#>'{review,items}' into prev_items from public.gig_reviews r where r.draft_id=d and r.revision=99;
 select jsonb_agg(
   jsonb_build_object('field','venue','value',(chr(65+(n-1)/26)||chr(65+(n-1)%26)),'quote',(chr(65+(n-1)/26)||chr(65+(n-1)%26)),'status','stated','manual',false,'editedValue',(chr(65+(n-1)/26)||chr(65+(n-1)%26)),'selected',true,
     'carriedFrom',jsonb_build_object('revision',99,'source',source_text,'fixture',false)) order by n)
 into items from generate_series(1,100) as n;
 doc := jsonb_build_object('review',jsonb_build_object('source',source_text,'items',items,'questions','[]'::jsonb,
   'baseline',jsonb_build_object('revision',99,'source',source_text,'fixture',false,'items',prev_items)));
 begin
  insert into public.gig_reviews(draft_id,owner_id,reviewed_by,draft_version,revision,request_id,source_text,draft,content_sha256)
  values(d,own,own,100,100,gen_random_uuid(),source_text,doc,repeat('0',64));
 exception when query_canceled then outcome := 'controlled_timeout';
 end;
 insert into pg_temp.stress_result values (outcome, extract(epoch from clock_timestamp()-started)*1000);
end $$;
select * from pg_temp.stress_result;
rollback;
