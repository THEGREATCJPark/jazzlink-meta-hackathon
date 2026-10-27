-- LOCAL disposable database only; apply migrations before running.
-- Synthetic data only. This script does not mutate production and rolls back.
begin;

do $test$
declare
  test_row record;
  observed boolean;
begin
  for test_row in
    select * from (values
      ('empty envelope', '{}'::jsonb, true),
      ('null review', '{"review":null}'::jsonb, true),
      ('empty items', '{"review":{"items":[]}}'::jsonb, true),
      ('set counts are valid non-money fields', '{"review":{"items":[{"field":"setCount","editedValue":"2","selected":true},{"field":"additionalSets","editedValue":"1","selected":false}]}}'::jsonb, true),
      ('selected USD fee', '{"review":{"items":[{"field":"feeCents","editedValue":"900.50","selected":true,"amountCents":90050}]}}'::jsonb, true),
      ('free ticket is zero', '{"review":{"items":[{"field":"ticketCents","editedValue":"0","selected":true,"amountCents":0}]}}'::jsonb, true),
      ('unselected invalid remains unknown', '{"review":{"items":[{"field":"feeCents","editedValue":"0.001","selected":false,"amountCents":null}]}}'::jsonb, true),
      ('maximum safe amount', '{"review":{"items":[{"field":"feeCents","editedValue":"90071992547409.91","selected":true,"amountCents":9007199254740991}]}}'::jsonb, true),
      ('baseline canonicalized', '{"review":{"items":[],"baseline":{"items":[{"field":"feeCents","editedValue":"1.00","selected":true,"amountCents":100}]}}}'::jsonb, true),
      ('selected fractional cents', '{"review":{"items":[{"field":"feeCents","editedValue":"0.001","selected":true,"amountCents":null}]}}'::jsonb, false),
      ('unsafe integer', '{"review":{"items":[{"field":"feeCents","editedValue":"90071992547409.92","selected":true,"amountCents":9007199254740992}]}}'::jsonb, false),
      ('negative money', '{"review":{"items":[{"field":"feeCents","editedValue":"-1","selected":true,"amountCents":-100}]}}'::jsonb, false),
      ('mismatched cents', '{"review":{"items":[{"field":"feeCents","editedValue":"900.50","selected":true,"amountCents":900}]}}'::jsonb, false),
      ('fractional amountCents', '{"review":{"items":[{"field":"feeCents","editedValue":"1","selected":true,"amountCents":100.5}]}}'::jsonb, false),
      ('string amountCents', '{"review":{"items":[{"field":"feeCents","editedValue":"1","selected":true,"amountCents":"100"}]}}'::jsonb, false),
      ('missing amountCents', '{"review":{"items":[{"field":"feeCents","editedValue":"1","selected":true}]}}'::jsonb, false),
      ('valid amount cannot be null', '{"review":{"items":[{"field":"feeCents","editedValue":"1","selected":false,"amountCents":null}]}}'::jsonb, false),
      ('string selected', '{"review":{"items":[{"field":"feeCents","editedValue":"1","selected":"true","amountCents":100}]}}'::jsonb, false),
      ('invalid item', '{"review":{"items":[null]}}'::jsonb, false),
      ('unknown field', '{"review":{"items":[{"field":"compensation","editedValue":"1"}]}}'::jsonb, false),
      ('hidden money property', '{"review":{"items":[{"field":"title","editedValue":"Show","amountCents":100}]}}'::jsonb, false),
      ('unrecognized root', '{"review":null,"other":1}'::jsonb, false),
      ('wrong review type', '{"review":"broken"}'::jsonb, false),
      ('wrong items type', '{"review":{"items":{}}}'::jsonb, false),
      ('wrong baseline type', '{"review":{"items":[],"baseline":{"items":{}}}}'::jsonb, false),
      ('baseline bypass', '{"review":{"items":[],"baseline":{"items":[{"field":"feeCents","editedValue":"1","selected":true,"amountCents":1}]}}}'::jsonb, false)
    ) as cases(name, doc, expected)
  loop
    observed := jazzlink_private.valid_canonical_draft_v1(test_row.doc);
    if observed is distinct from test_row.expected then
      raise exception 'canonical money case failed: %', test_row.name;
    end if;
  end loop;
end
$test$;

-- NOT VALID must retain legacy rows but enforce later inserts and updates.
create temp table canonical_money_constraint_test (id integer primary key, draft jsonb not null);
insert into canonical_money_constraint_test values
  (1, '{"review":{"items":[{"field":"feeCents","editedValue":"900","selected":true}]}}');
alter table canonical_money_constraint_test
  add constraint canonical_money_check
  check (jazzlink_private.valid_canonical_draft_v1(draft)) not valid;

do $test$
declare
  rejected boolean := false;
begin
  if not exists (select 1 from canonical_money_constraint_test where id = 1) then
    raise exception 'legacy row disappeared';
  end if;
  begin
    update canonical_money_constraint_test set draft = draft where id = 1;
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'legacy update should require normalization'; end if;

  rejected := false;
  begin
    insert into canonical_money_constraint_test values
      (2, '{"review":{"items":[{"field":"feeCents","editedValue":"900","selected":true,"amountCents":1}]}}');
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'new incorrect cents must be rejected'; end if;

  update canonical_money_constraint_test
  set draft = '{"review":{"items":[{"field":"feeCents","editedValue":"900","selected":true,"amountCents":90000}]}}'
  where id = 1;
end
$test$;

-- Exercise the same CHECK as an authenticated database role, modeling direct
-- Data API table access rather than trusting the application route.
grant select, insert, update on canonical_money_constraint_test to authenticated;
set local role authenticated;
do $test$
declare
  rejected boolean := false;
begin
  insert into canonical_money_constraint_test values
    (3, '{"review":{"items":[{"field":"feeCents","editedValue":"900","selected":true,"amountCents":90000}]}}');
  begin
    insert into canonical_money_constraint_test values
      (4, '{"review":{"items":[{"field":"feeCents","editedValue":"900","selected":true,"amountCents":1}]}}');
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'authenticated direct insert bypassed money validation'; end if;
end
$test$;
reset role;

do $test$
begin
  if not has_function_privilege('authenticated', 'jazzlink_private.valid_canonical_draft_v1(jsonb)', 'execute')
     or has_function_privilege('anon', 'jazzlink_private.valid_canonical_draft_v1(jsonb)', 'execute') then
    raise exception 'unexpected validator grants';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gig_drafts_canonical_money_v1' and not convalidated)
     or not exists (select 1 from pg_constraint where conname = 'gig_reviews_canonical_money_v1' and not convalidated) then
    raise exception 'expected NOT VALID checks are missing';
  end if;
end
$test$;

rollback;
