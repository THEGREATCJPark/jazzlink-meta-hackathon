-- Validate only newly inserted snapshots. Existing drafts and reviews remain
-- untouched; old invalid history fails closed only if referenced by new work.
-- Functions are SECURITY INVOKER: no additional permission elevation.
-- PostgreSQL's existing create_gig_review definer has already checked
-- auth.uid(), ownership, expected draft version, and explicit confirmation.

-- Older selected money entries may predate amountCents. Normalize a copy for
-- comparison, never rewrite history. Existing cents must equal display dollars;
-- invalid selected money fails closed. This matches the app's money grammar.
create function jazzlink_private.normalize_selected_history_money_v1(p_items jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = ''
as $$
declare
  item jsonb;
  normalized jsonb := '[]'::jsonb;
  display text;
  expected numeric;
  actual numeric;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 100 then
    return null;
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item->'field') is distinct from 'string'
       or jsonb_typeof(item->'editedValue') is distinct from 'string' then
      return null;
    end if;
    if item->>'field' not in ('title','venue','date','artist','sets','setCount','additionalSets','feeCents','ticketCents','paymentTerms') then
      return null;
    end if;
    if item->>'field' in ('feeCents','ticketCents') then
      display := regexp_replace(item->>'editedValue', '^[[:space:]]+|[[:space:]]+$', '', 'g');
      if length(display) > 17 or display !~ '^(0|[1-9][0-9]*)([.][0-9]{1,2})?$' then
        return null;
      end if;
      expected := display::numeric * 100;
      if expected > 9007199254740991 then return null; end if;
      if item ? 'amountCents' then
        if jsonb_typeof(item->'amountCents') is distinct from 'number' then return null; end if;
        actual := (item->>'amountCents')::numeric;
        if actual <> trunc(actual) or actual <> expected then return null; end if;
      end if;
      item := jsonb_set(item, '{editedValue}', to_jsonb(display), true);
      item := jsonb_set(item, '{amountCents}', to_jsonb(expected::bigint), true);
    elsif item ? 'amountCents' then
      return null;
    end if;
    normalized := normalized || jsonb_build_array(item);
  end loop;
  return normalized;
end
$$;
revoke all on function jazzlink_private.normalize_selected_history_money_v1(jsonb)
from public, anon, authenticated;

create function jazzlink_private.evidence_root_source_v1(
  p_draft_id uuid, p_owner_id uuid, p_item jsonb, p_source text,
  p_before_revision integer, p_depth integer, p_deadline timestamptz
) returns text
language plpgsql stable security invoker set search_path = ''
as $$
declare
  carry jsonb;
  historical public.gig_reviews%rowtype;
  historical_review jsonb;
  matching jsonb;
  matching_count integer;
  target_revision integer;
  root_source text;
begin
  if clock_timestamp() > p_deadline then
    raise exception using errcode = '57014', message = 'review evidence verification timed out';
  end if;
  if p_depth > 100 or jsonb_typeof(p_item) is distinct from 'object'
     or jsonb_typeof(p_item->'field') is distinct from 'string'
     or jsonb_typeof(p_item->'value') is distinct from 'string'
     or jsonb_typeof(p_item->'quote') is distinct from 'string'
     or jsonb_typeof(p_item->'status') is distinct from 'string'
     or jsonb_typeof(p_item->'manual') is distinct from 'boolean' then
    return null;
  end if;

  if p_item->'manual' = 'true'::jsonb and p_item->>'quote' <> '' then
    return null;
  end if;
  carry := p_item->'carriedFrom';
  if carry is null or carry = 'null'::jsonb then
    if p_item->'manual' = 'false'::jsonb and (
       (p_item->>'quote') !~ '[^[:space:]]'
       or position((p_item->>'quote') in p_source) = 0) then
      return null;
    end if;
    return p_source;
  end if;

  if jsonb_typeof(carry) is distinct from 'object'
     or jsonb_typeof(carry->'revision') is distinct from 'number'
     or (carry->>'revision') !~ '^[1-9][0-9]{0,8}$'
     or jsonb_typeof(carry->'source') is distinct from 'string' then
    return null;
  end if;
  target_revision := (carry->>'revision')::integer;
  if target_revision >= p_before_revision then return null; end if;
  select * into historical from public.gig_reviews
  where draft_id = p_draft_id and owner_id = p_owner_id and revision = target_revision;
  if not found then return null; end if;
  historical_review := historical.draft->'review';
  if jsonb_typeof(historical_review) is distinct from 'object'
     or jsonb_typeof(historical_review->'source') is distinct from 'string'
     or historical_review->>'source' <> historical.source_text
     or jsonb_typeof(historical_review->'items') is distinct from 'array' then
    return null;
  end if;
  if jsonb_array_length(historical_review->'items') > 100 then return null; end if;

  select count(*), (jsonb_agg(entry)->0) into matching_count, matching
  from jsonb_array_elements(historical_review->'items') as items(entry)
  where entry->'selected' = 'true'::jsonb
    and entry->'field' = p_item->'field'
    and entry->'value' = p_item->'value'
    and entry->'quote' = p_item->'quote'
    and entry->'status' = p_item->'status'
    and entry->'manual' = p_item->'manual';
  if clock_timestamp() > p_deadline then
    raise exception using errcode = '57014', message = 'review evidence verification timed out';
  end if;
  if matching_count <> 1 then return null; end if;
  if jazzlink_private.normalize_selected_history_money_v1(jsonb_build_array(matching)) is null then
    return null;
  end if;

  root_source := jazzlink_private.evidence_root_source_v1(
    p_draft_id, p_owner_id, matching, historical.source_text, target_revision, p_depth + 1, p_deadline);
  if root_source is null or root_source <> carry->>'source' then return null; end if;
  return root_source;
end
$$;
revoke all on function jazzlink_private.evidence_root_source_v1(uuid,uuid,jsonb,text,integer,integer,timestamptz)
from public, anon, authenticated;

create function jazzlink_private.validate_review_evidence_v1()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  review jsonb;
  item jsonb;
  baseline jsonb;
  historical public.gig_reviews%rowtype;
  historical_review jsonb;
  selected_items jsonb;
  baseline_revision integer;
  deadline timestamptz;
begin
  if auth.uid() is null or auth.uid() <> new.owner_id or new.reviewed_by <> new.owner_id
     or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception using errcode = '42501', message = 'review owner required';
  end if;
  -- At most one evidence validation per owner transaction. Fail immediately
  -- rather than queue unbounded parallel work. Different owners do not share
  -- a lock except for the exceptionally unlikely advisory-hash collision.
  if not pg_try_advisory_xact_lock(hashtextextended('jazzlink-evidence:' || new.owner_id::text, 0)) then
    raise exception using errcode = '55P03', message = 'another review is being validated';
  end if;
  -- An operational guard, not a declaration that an otherwise valid review is
  -- invalid. The client should distinguish timeout from a bad citation.
  deadline := clock_timestamp() + interval '3 seconds';
  review := new.draft->'review';
  if jsonb_typeof(review) is distinct from 'object'
     or jsonb_typeof(review->'source') is distinct from 'string'
     or review->>'source' <> new.source_text
     or jsonb_typeof(review->'items') is distinct from 'array' then
    raise exception using errcode = '23514', message = 'review evidence invalid';
  end if;
  if jsonb_array_length(review->'items') > 100 then
    raise exception using errcode = '23514', message = 'review evidence invalid';
  end if;

  for item in select value from jsonb_array_elements(review->'items') loop
    if jazzlink_private.evidence_root_source_v1(new.draft_id,new.owner_id,item,new.source_text,new.revision,0,deadline) is null then
      raise exception using errcode = '23514', message = 'review evidence invalid';
    end if;
  end loop;

  baseline := review->'baseline';
  if baseline is not null and baseline <> 'null'::jsonb then
    if jsonb_typeof(baseline) is distinct from 'object'
       or jsonb_typeof(baseline->'revision') is distinct from 'number'
       or (baseline->>'revision') !~ '^[1-9][0-9]{0,8}$'
       or jsonb_typeof(baseline->'source') is distinct from 'string'
       or jsonb_typeof(baseline->'items') is distinct from 'array'
       or jsonb_typeof(baseline->'fixture') is distinct from 'boolean' then
      raise exception using errcode = '23514', message = 'review evidence invalid';
    end if;
    baseline_revision := (baseline->>'revision')::integer;
    if baseline_revision >= new.revision then
      raise exception using errcode = '23514', message = 'review evidence invalid';
    end if;
    select * into historical from public.gig_reviews
    where draft_id = new.draft_id and owner_id = new.owner_id and revision = baseline_revision;
    if not found then raise exception using errcode = '23514', message = 'review evidence invalid'; end if;
    historical_review := historical.draft->'review';
    if jsonb_typeof(historical_review) is distinct from 'object'
       or jsonb_typeof(historical_review->'source') is distinct from 'string'
       or historical_review->>'source' <> historical.source_text
       or baseline->>'source' <> historical.source_text
       or jsonb_typeof(historical_review->'items') is distinct from 'array'
       or baseline->'fixture' is distinct from to_jsonb(coalesce(historical_review->'fixture' = 'true'::jsonb, false)) then
      raise exception using errcode = '23514', message = 'review evidence invalid';
    end if;
    if jsonb_array_length(historical_review->'items') > 100 then
      raise exception using errcode = '23514', message = 'review evidence invalid';
    end if;
    select coalesce(jsonb_agg(entry order by ordinal), '[]'::jsonb) into selected_items
    from jsonb_array_elements(historical_review->'items') with ordinality as entries(entry, ordinal)
    where entry->'selected' = 'true'::jsonb;
    selected_items := jazzlink_private.normalize_selected_history_money_v1(selected_items);
    if selected_items is null then
      raise exception using errcode = '23514', message = 'review evidence invalid';
    end if;
    if baseline->'items' <> selected_items then
      raise exception using errcode = '23514', message = 'review evidence invalid';
    end if;
    for item in select value from jsonb_array_elements(selected_items) loop
      if jazzlink_private.evidence_root_source_v1(new.draft_id,new.owner_id,item,historical.source_text,baseline_revision,0,deadline) is null then
        raise exception using errcode = '23514', message = 'review evidence invalid';
      end if;
    end loop;
  end if;
  return new;
end
$$;
revoke all on function jazzlink_private.validate_review_evidence_v1() from public, anon, authenticated;

create trigger validate_review_evidence before insert on public.gig_reviews
for each row execute function jazzlink_private.validate_review_evidence_v1();
