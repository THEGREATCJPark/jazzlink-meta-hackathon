-- Restrict the recognized draft envelope and canonicalize money semantics at
-- the database boundary too; direct PostgREST clients cannot bypass this.
-- SECURITY INVOKER: no reads from other tables or authorization elevation.
-- This validator is deliberately versioned: change it only with a migration
-- that drops/re-adds the dependent checks.
create function jazzlink_private.valid_canonical_draft_v1(document jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  review jsonb;
  baseline jsonb;
  item_array jsonb;
  item jsonb;
  field_name text;
  display_usd text;
  expected_cents numeric;
  actual_cents numeric;
  is_selected boolean;
begin
  if jsonb_typeof(document) is distinct from 'object' then
    return false;
  end if;

  -- This version has exactly one optional root property. Empty/unknown drafts
  -- remain valid. Any future envelope fields need an intentional migration.
  if exists (select 1 from jsonb_object_keys(document) as keys(key) where key <> 'review') then
    return false;
  end if;
  if not (document ? 'review') or document->'review' = 'null'::jsonb then
    return true;
  end if;
  review := document->'review';
  if jsonb_typeof(review) is distinct from 'object'
     or jsonb_typeof(review->'items') is distinct from 'array' then
    return false;
  end if;

  baseline := review->'baseline';
  if baseline is not null and baseline <> 'null'::jsonb then
    if jsonb_typeof(baseline) is distinct from 'object'
       or jsonb_typeof(baseline->'items') is distinct from 'array' then
      return false;
    end if;
  end if;

  -- Baselines are duplicated into the saved draft; validate both arrays.
  for item_array in
    select review->'items'
    union all
    select baseline->'items' where baseline is not null and baseline <> 'null'::jsonb
  loop
    if jsonb_array_length(item_array) > 100 then
      return false;
    end if;
    for item in select value from jsonb_array_elements(item_array)
    loop
      if jsonb_typeof(item) is distinct from 'object'
         or jsonb_typeof(item->'field') is distinct from 'string'
         or jsonb_typeof(item->'editedValue') is distinct from 'string' then
        return false;
      end if;
      field_name := item->>'field';
      if field_name not in ('title', 'venue', 'date', 'artist', 'sets', 'setCount', 'additionalSets', 'feeCents', 'ticketCents', 'paymentTerms') then
        return false;
      end if;
      if item ? 'selected' and jsonb_typeof(item->'selected') is distinct from 'boolean' then
        return false;
      end if;
      is_selected := coalesce(item->'selected' = 'true'::jsonb, false);

      if field_name not in ('feeCents', 'ticketCents') then
        -- The numeric money property is not meaningful on another field.
        if item ? 'amountCents' then return false; end if;
        continue;
      end if;
      if not (item ? 'amountCents') then return false; end if;
      display_usd := item->>'editedValue';
      expected_cents := null;
      -- Match the server's normalized decimal grammar, excluding exponents,
      -- negative values, fractional cents and unsafe JavaScript integers.
      -- Bound length before conversion to avoid unbounded numeric parsing.
      if length(display_usd) <= 17
         and display_usd ~ '^(0|[1-9][0-9]*)([.][0-9]{1,2})?$' then
        expected_cents := (display_usd::numeric * 100);
        if expected_cents > 9007199254740991 then
          expected_cents := null;
        end if;
      end if;

      if is_selected and expected_cents is null then return false; end if;

      if expected_cents is null then
        if jsonb_typeof(item->'amountCents') is distinct from 'null' then return false; end if;
      else
        if jsonb_typeof(item->'amountCents') is distinct from 'number' then return false; end if;
        actual_cents := (item->>'amountCents')::numeric;
        if actual_cents <> trunc(actual_cents)
           or actual_cents < 0
           or actual_cents > 9007199254740991
           or actual_cents <> expected_cents then
          return false;
        end if;
      end if;
    end loop;
  end loop;
  return true;
end
$$;

-- The schema is not exposed through Data API, but authenticated needs USAGE
-- (already granted by the existing quota migration) and EXECUTE so direct
-- inserts/updates can evaluate this non-privileged CHECK function.
revoke all on function jazzlink_private.valid_canonical_draft_v1(jsonb) from public, anon, authenticated;
grant execute on function jazzlink_private.valid_canonical_draft_v1(jsonb) to authenticated, service_role;

-- Do not rewrite existing drafts or immutable review history. NOT VALID avoids
-- scanning historical rows but still enforces each subsequent insert/update.
alter table public.gig_drafts
  add constraint gig_drafts_canonical_money_v1
  check (jazzlink_private.valid_canonical_draft_v1(draft)) not valid;

alter table public.gig_reviews
  add constraint gig_reviews_canonical_money_v1
  check (jazzlink_private.valid_canonical_draft_v1(draft)) not valid;
