-- Hold short-lived write locks while existing rows are counted and protected.
lock table public.gig_drafts, public.gig_reviews in share row exclusive mode;

alter table public.gig_drafts
  add constraint gig_drafts_json_size_limit check (octet_length(draft::text) <= 131072);
alter table public.gig_reviews
  add constraint gig_reviews_json_size_limit check (octet_length(draft::text) <= 131072);

-- Not exposed through the Data API. Counters commit/roll back with each insert.
create table jazzlink_private.owner_storage_counts (
  owner_id uuid primary key,
  drafts integer not null default 0 check (drafts between 0 and 20),
  reviews integer not null default 0 check (reviews between 0 and 100)
);
alter table jazzlink_private.owner_storage_counts enable row level security;
revoke all on jazzlink_private.owner_storage_counts from public, anon, authenticated;

insert into jazzlink_private.owner_storage_counts(owner_id, drafts, reviews)
select owner_id, sum(drafts)::integer, sum(reviews)::integer from (
  select owner_id, count(*) as drafts, 0::bigint as reviews from public.gig_drafts group by owner_id
  union all
  select owner_id, 0::bigint as drafts, count(*) as reviews from public.gig_reviews group by owner_id
) existing group by owner_id;

-- Insert and delete counters are tied to row operations and use row-level
-- UPSERT locking; failures roll back the enclosing row change. Definer access
-- is limited to this trigger, an empty search_path, fixed tables and limits.
create function jazzlink_private.count_owner_storage()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  resulting_count integer;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or auth.uid() <> new.owner_id
       or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
      raise exception using errcode = '42501', message = 'owner authorization required';
    end if;
    if tg_table_name = 'gig_drafts' then
      insert into jazzlink_private.owner_storage_counts(owner_id, drafts, reviews)
      values (new.owner_id, 1, 0)
      on conflict (owner_id) do update set drafts = jazzlink_private.owner_storage_counts.drafts + 1
        where jazzlink_private.owner_storage_counts.drafts < 20
      returning drafts into resulting_count;
    elsif tg_table_name = 'gig_reviews' then
      insert into jazzlink_private.owner_storage_counts(owner_id, drafts, reviews)
      values (new.owner_id, 0, 1)
      on conflict (owner_id) do update set reviews = jazzlink_private.owner_storage_counts.reviews + 1
        where jazzlink_private.owner_storage_counts.reviews < 100
      returning reviews into resulting_count;
    else
      raise exception using errcode = '42501', message = 'unsupported storage trigger';
    end if;
    if resulting_count is null then
      raise exception using errcode = 'P0001', message = 'storage limit reached';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if tg_table_name = 'gig_drafts' then
      update jazzlink_private.owner_storage_counts set drafts = drafts - 1
      where owner_id = old.owner_id and drafts > 0;
    elsif tg_table_name = 'gig_reviews' then
      update jazzlink_private.owner_storage_counts set reviews = reviews - 1
      where owner_id = old.owner_id and reviews > 0;
    else
      raise exception using errcode = '42501', message = 'unsupported storage trigger';
    end if;
    if not found then
      raise exception using errcode = 'P0001', message = 'storage counter is inconsistent';
    end if;
    return old;
  end if;
  raise exception using errcode = '42501', message = 'unsupported storage operation';
end
$$;
revoke all on function jazzlink_private.count_owner_storage() from public, anon, authenticated;

create trigger count_draft_storage after insert or delete on public.gig_drafts
for each row execute function jazzlink_private.count_owner_storage();
create trigger count_review_storage after insert or delete on public.gig_reviews
for each row execute function jazzlink_private.count_owner_storage();
