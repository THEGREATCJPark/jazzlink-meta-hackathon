-- LOCAL disposable DB only: seed one historical malformed review BEFORE
-- applying the new evidence migration, to test no rewrite of old data.
insert into auth.users(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select set_config('request.jwt.claims',
 '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}', false);
insert into public.gig_drafts(id,owner_id,source_text,draft) values (
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'old source without the quote',
 '{"review":{"source":"old source without the quote","items":[{"field":"venue","value":"Blue Alley","quote":"Blue Alley","status":"stated","manual":false,"editedValue":"Blue Alley","selected":true}],"questions":[]}}'
);
insert into public.gig_reviews(id,draft_id,owner_id,reviewed_by,draft_version,revision,request_id,source_text,draft,content_sha256)
select '11111111-2222-4222-8222-222222222222', id,owner_id,owner_id,1,1,
 '11111111-3333-4333-8333-333333333333',source_text,draft,repeat('0',64)
from public.gig_drafts where id='11111111-1111-4111-8111-111111111111';

-- A valid old money item omitted amountCents because it predates that schema.
insert into public.gig_drafts(id,owner_id,source_text,draft) values (
 '44444444-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'Venue: total fee $900.',
 '{"review":{"source":"Venue: total fee $900.","items":[{"field":"feeCents","value":"90000","quote":"$900","status":"stated","manual":false,"editedValue":"900.00","selected":true}],"questions":[]}}'
);
insert into public.gig_reviews(id,draft_id,owner_id,reviewed_by,draft_version,revision,request_id,source_text,draft,content_sha256)
select '44444444-2222-4222-8222-222222222222',id,owner_id,owner_id,1,1,
 '44444444-3333-4333-8333-333333333333',source_text,draft,repeat('0',64)
from public.gig_drafts where id='44444444-1111-4111-8111-111111111111';

-- A bad legacy amount is historical data but must never be accepted as a
-- valid baseline or carry under the new validator.
insert into public.gig_drafts(id,owner_id,source_text,draft) values (
 '55555555-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'Venue: total fee $900.',
 '{"review":{"source":"Venue: total fee $900.","items":[{"field":"feeCents","value":"90000","quote":"$900","status":"stated","manual":false,"editedValue":"900.00","amountCents":1,"selected":true}],"questions":[]}}'
);
insert into public.gig_reviews(id,draft_id,owner_id,reviewed_by,draft_version,revision,request_id,source_text,draft,content_sha256)
select '55555555-2222-4222-8222-222222222222',id,owner_id,owner_id,1,1,
 '55555555-3333-4333-8333-333333333333',source_text,draft,repeat('0',64)
from public.gig_drafts where id='55555555-1111-4111-8111-111111111111';
