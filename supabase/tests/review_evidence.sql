-- LOCAL disposable DB only, after review_evidence_legacy_seed.sql and the new
-- migration. This uses invented auth users and never calls external services.
set role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}', false);
do $$
declare
 d uuid := '22222222-1111-4111-8111-111111111111';
 other_draft uuid := '33333333-1111-4111-8111-111111111111';
 empty_draft uuid := '66666666-1111-4111-8111-111111111111';
 own uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 r1 uuid; r2 uuid; r3 uuid; retried uuid;
 original text := 'Venue: Blue Alley on November 20, 2026.';
 second text := 'Venue: Please start later.';
 third text := 'Musician: I will check.';
 root jsonb := '{"field":"venue","value":"Blue Alley","quote":"Blue Alley","status":"stated","manual":false,"editedValue":"Blue Alley","selected":true}';
 item2 jsonb; item3 jsonb; review_doc jsonb; blocked boolean; snapshot jsonb;
begin
 -- Existing malformed rows are not rewritten and remain readable.
 select draft into snapshot from public.gig_reviews
 where id='11111111-2222-4222-8222-222222222222';
 if snapshot#>>'{review,items,0,quote}' <> 'Blue Alley' then
   raise exception 'legacy row was changed';
 end if;

 -- The invalid legacy row remains unchanged, but is not accepted as the
 -- baseline of a new review. Repair requires a new user-reviewed draft.
 review_doc := jsonb_build_object('review',jsonb_build_object('source','old source without the quote','items','[]'::jsonb,'questions','[]'::jsonb,
   'baseline',jsonb_build_object('revision',1,'source','old source without the quote','fixture',false,'items',snapshot#>'{review,items}')));
 update public.gig_drafts set draft=review_doc,version=2 where id='11111111-1111-4111-8111-111111111111';
 blocked := false;
 begin
   perform public.create_gig_review('11111111-1111-4111-8111-111111111111',2,'11111111-4444-4444-8444-444444444444',true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'invalid legacy quote reused as baseline'; end if;

 -- Pre-canonical legacy items may lack cents. Compare against a normalized
 -- copy while leaving the immutable old snapshot byte-for-byte unchanged.
 select draft into snapshot from public.gig_reviews where id='44444444-2222-4222-8222-222222222222';
 if snapshot#>'{review,items,0,amountCents}' is not null then raise exception 'legacy money was rewritten'; end if;
 review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items','[]'::jsonb,'questions','[]'::jsonb,
   'baseline',jsonb_build_object('revision',1,'source','Venue: total fee $900.','fixture',false,
     'items',jsonb_build_array((snapshot#>'{review,items,0}') || '{"amountCents":90000}'::jsonb))));
 update public.gig_drafts set source_text=third,draft=review_doc,version=2 where id='44444444-1111-4111-8111-111111111111';
 perform public.create_gig_review('44444444-1111-4111-8111-111111111111',2,'44444444-4444-4444-8444-444444444444',true);
 if (select draft#>'{review,items,0,amountCents}' from public.gig_reviews where id='44444444-2222-4222-8222-222222222222') is not null then
   raise exception 'legacy snapshot was modified';
 end if;

 -- If old cents already exist but disagree with displayed dollars, neither
 -- normalization nor a direct carry may launder the mismatch into a review.
 select draft into snapshot from public.gig_reviews where id='55555555-2222-4222-8222-222222222222';
 review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items','[]'::jsonb,'questions','[]'::jsonb,
   'baseline',jsonb_build_object('revision',1,'source','Venue: total fee $900.','fixture',false,
     'items',jsonb_build_array((snapshot#>'{review,items,0}') || '{"amountCents":90000}'::jsonb))));
 update public.gig_drafts set source_text=third,draft=review_doc,version=2 where id='55555555-1111-4111-8111-111111111111';
 blocked := false;
 begin
   perform public.create_gig_review('55555555-1111-4111-8111-111111111111',2,'55555555-4444-4444-8444-444444444444',true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'inconsistent legacy cents accepted in baseline'; end if;
 review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items',
   jsonb_build_array((snapshot#>'{review,items,0}') || '{"amountCents":90000,"carriedFrom":{"revision":1,"source":"Venue: total fee $900."}}'::jsonb),'questions','[]'::jsonb));
 update public.gig_drafts set draft=review_doc,version=3 where id='55555555-1111-4111-8111-111111111111';
 blocked := false;
 begin
   perform public.create_gig_review('55555555-1111-4111-8111-111111111111',3,'55555555-5555-4555-8555-555555555555',true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'inconsistent legacy cents accepted in carry'; end if;

 -- Null/unreviewed drafts can be stored but cannot become a reviewed snapshot.
 insert into public.gig_drafts(id,owner_id,source_text,draft) values (d,own,original,'{"review":null}');
 blocked := false;
 begin
   perform public.create_gig_review(d,1,'22222222-2222-4222-8222-222222222201',true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'unreviewed null snapshot accepted'; end if;
 insert into public.gig_drafts(id,owner_id,source_text,draft) values (empty_draft,own,original,'{}');
 blocked := false;
 begin
   perform public.create_gig_review(empty_draft,1,'66666666-2222-4222-8222-222222222222',true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'missing review snapshot accepted'; end if;

 -- A valid source-linked first snapshot and idempotent request retry.
 review_doc := jsonb_build_object('review',jsonb_build_object('source',original,'items',jsonb_build_array(root),'questions','[]'::jsonb));
 update public.gig_drafts set draft=review_doc,version=2 where id=d;
 r1 := public.create_gig_review(d,2,'22222222-2222-4222-8222-222222222202',true);
 retried := public.create_gig_review(d,2,'22222222-2222-4222-8222-222222222202',true);
 if r1 <> retried then raise exception 'idempotent retry changed ID'; end if;

 -- Rev 2 carries from the selected immutable rev 1 and embeds its baseline.
 item2 := root || jsonb_build_object('carriedFrom',jsonb_build_object('revision',1,'source',original,'fixture',false));
 review_doc := jsonb_build_object('review',jsonb_build_object('source',second,'items',jsonb_build_array(item2),'questions','[]'::jsonb,
   'baseline',jsonb_build_object('revision',1,'source',original,'fixture',false,'items',jsonb_build_array(root))));
 update public.gig_drafts set source_text=second,draft=review_doc,version=3 where id=d;
 r2 := public.create_gig_review(d,3,'22222222-2222-4222-8222-222222222203',true);
 retried := public.create_gig_review(d,2,'22222222-2222-4222-8222-222222222202',true);
 if r1 <> retried then raise exception 'retry after edit did not preserve original snapshot'; end if;

 -- Rev 3 points to rev 2, whose root source remains rev 1.
 item3 := root || jsonb_build_object('carriedFrom',jsonb_build_object('revision',2,'source',original,'fixture',false));
 review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items',jsonb_build_array(item3),'questions','[]'::jsonb,
   'baseline',jsonb_build_object('revision',2,'source',second,'fixture',false,'items',jsonb_build_array(item2))));
 update public.gig_drafts set source_text=third,draft=review_doc,version=4 where id=d;
 r3 := public.create_gig_review(d,4,'22222222-2222-4222-8222-222222222204',true);
 if r1=r2 or r2=r3 then raise exception 'new revisions not unique'; end if;

 -- A manual item with no quote is accepted as user-entered, not evidence.
 review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items',
   jsonb_build_array(jsonb_build_object('field','venue','value','','quote','','status','unclear','manual',true,'editedValue','My venue','selected',true)),
   'questions','[]'::jsonb));
 update public.gig_drafts set draft=review_doc,version=5 where id=d;
 perform public.create_gig_review(d,5,'22222222-2222-4222-8222-222222222205',true);

 -- Quotes absent from the actual saved current source are rejected.
 review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items',jsonb_build_array(root),'questions','[]'::jsonb));
 update public.gig_drafts set draft=review_doc,version=6 where id=d;
 blocked := false;
 begin
   perform public.create_gig_review(d,6,'22222222-2222-4222-8222-222222222206',true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'fabricated quote accepted'; end if;

 -- A review must refer to its actual saved source, not a substituted source
 -- containing the fabricated quote. Manual values cannot masquerade as quotes.
 review_doc := jsonb_build_object('review',jsonb_build_object('source',original,'items',jsonb_build_array(root),'questions','[]'::jsonb));
 update public.gig_drafts set draft=review_doc,version=version+1 where id=d;
 blocked := false;
 begin
   perform public.create_gig_review(d,(select version from public.gig_drafts where id=d),gen_random_uuid(),true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'substituted source accepted'; end if;
 review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items',
   jsonb_build_array(root || jsonb_build_object('manual',true)),'questions','[]'::jsonb));
 update public.gig_drafts set draft=review_doc,version=version+1 where id=d;
 blocked := false;
 begin
   perform public.create_gig_review(d,(select version from public.gig_drafts where id=d),gen_random_uuid(),true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'manual item carried a quote'; end if;

 -- Directly supplied carried source must match the immutable root source.
 review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items',
   jsonb_build_array(root || jsonb_build_object('carriedFrom',jsonb_build_object('revision',2,'source','forged Blue Alley'))),'questions','[]'::jsonb));
 update public.gig_drafts set draft=review_doc,version=version+1 where id=d;
 blocked := false;
 begin
   perform public.create_gig_review(d,(select version from public.gig_drafts where id=d),'22222222-2222-4222-8222-222222222207',true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'forged carry source accepted'; end if;

 -- Future/cyclic and invented revision numbers are rejected.
 for snapshot in
   select jsonb_build_object('revision',99,'source',original)
   union all select jsonb_build_object('revision',5,'source',original)
   union all select jsonb_build_object('revision',1,'source',original)
 loop
   review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items',
     jsonb_build_array(root || jsonb_build_object('carriedFrom',snapshot)),'questions','[]'::jsonb));
   if snapshot->>'revision' = '1' then
     review_doc := jsonb_set(review_doc,'{review,items,0,carriedFrom,revision}','99'::jsonb);
   end if;
   update public.gig_drafts set draft=review_doc,version=version+1 where id=d;
   blocked := false;
   begin
     perform public.create_gig_review(d,(select version from public.gig_drafts where id=d),gen_random_uuid(),true);
   exception when check_violation then blocked := true;
   end;
   if not blocked then raise exception 'missing/future history accepted'; end if;
 end loop;

 -- This second draft has its own rev 1, but Blue Alley exists only in the
 -- first draft's rev 1. An equal revision number must not cross draft IDs.
 review_doc := jsonb_build_object('review',jsonb_build_object('source','Venue: Other Hall','items',
   jsonb_build_array(jsonb_build_object('field','venue','value','Other Hall','quote','Other Hall','status','stated','manual',false,'editedValue','Other Hall','selected',true)),
   'questions','[]'::jsonb));
 insert into public.gig_drafts(id,owner_id,source_text,draft) values (other_draft,own,'Venue: Other Hall',review_doc);
 perform public.create_gig_review(other_draft,1,'33333333-2222-4222-8222-222222222222',true);
 review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items',
   jsonb_build_array(root || jsonb_build_object('carriedFrom',jsonb_build_object('revision',1,'source',original))),'questions','[]'::jsonb));
 update public.gig_drafts set source_text=third,draft=review_doc,version=2 where id=other_draft;
 blocked := false;
 begin
   perform public.create_gig_review(other_draft,2,'33333333-3333-4333-8333-333333333333',true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'cross-draft history accepted'; end if;

 -- A forged baseline cannot replace actual selected immutable items.
 review_doc := jsonb_build_object('review',jsonb_build_object('source',third,'items','[]'::jsonb,'questions','[]'::jsonb,
   'baseline',jsonb_build_object('revision',2,'source',second,'fixture',false,'items',jsonb_build_array(root))));
 update public.gig_drafts set draft=review_doc,version=version+1 where id=d;
 blocked := false;
 begin
   perform public.create_gig_review(d,(select version from public.gig_drafts where id=d),gen_random_uuid(),true);
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'forged baseline accepted'; end if;
end $$;
select set_config('request.jwt.claims',
 '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":false}', false);
do $$
declare blocked boolean := false; visible_count integer;
begin
 select count(*) into visible_count from public.gig_reviews
 where draft_id='22222222-1111-4111-8111-111111111111';
 if visible_count <> 0 then raise exception 'other user read review history'; end if;
 begin
   perform public.create_gig_review('22222222-1111-4111-8111-111111111111',1,gen_random_uuid(),true);
 exception when no_data_found then blocked := true;
 end;
 if not blocked then raise exception 'other user created review'; end if;
 blocked := false;
 begin
   insert into public.gig_reviews(draft_id,owner_id,reviewed_by,draft_version,revision,request_id,source_text,draft,content_sha256)
   values ('22222222-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,100,gen_random_uuid(),'fake','{}',repeat('0',64));
 exception when insufficient_privilege then blocked := true;
 end;
 if not blocked then raise exception 'direct review insert allowed'; end if;
end $$;
reset role;

do $$
begin
 if (select prosecdef from pg_proc where oid = 'jazzlink_private.evidence_root_source_v1(uuid,uuid,jsonb,text,integer,integer,timestamp with time zone)'::regprocedure)
    or (select prosecdef from pg_proc where oid = 'jazzlink_private.normalize_selected_history_money_v1(jsonb)'::regprocedure)
    or (select prosecdef from pg_proc where oid = 'jazzlink_private.validate_review_evidence_v1()'::regprocedure)
    or has_function_privilege('authenticated','jazzlink_private.evidence_root_source_v1(uuid,uuid,jsonb,text,integer,integer,timestamp with time zone)','execute')
    or has_function_privilege('authenticated','jazzlink_private.normalize_selected_history_money_v1(jsonb)','execute')
    or has_function_privilege('anon','jazzlink_private.validate_review_evidence_v1()','execute') then
   raise exception 'new evidence function has unexpected privilege';
 end if;
 begin
   perform jazzlink_private.evidence_root_source_v1(
     gen_random_uuid(),gen_random_uuid(),'{}'::jsonb,'source',1,0,clock_timestamp()-interval '1 second');
   raise exception 'expired verification deadline accepted';
 exception when query_canceled then null;
 end;
end $$;
