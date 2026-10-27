-- Private single-owner drafts. Immutable reviewed revisions and participant
-- acknowledgement are intentionally outside this first migration.
create table public.gig_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  source_text text not null default '' check (char_length(source_text) <= 20000),
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object'),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gig_drafts_owner_updated_idx on public.gig_drafts(owner_id, updated_at desc);

alter table public.gig_drafts enable row level security;
revoke all on public.gig_drafts from public, anon, authenticated;
grant select, insert, update on public.gig_drafts to authenticated;

create policy "owners select drafts" on public.gig_drafts for select to authenticated
using (owner_id = (select auth.uid()) and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);
create policy "owners insert drafts" on public.gig_drafts for insert to authenticated
with check (owner_id = (select auth.uid()) and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);
create policy "owners update drafts" on public.gig_drafts for update to authenticated
using (owner_id = (select auth.uid()) and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false)
with check (owner_id = (select auth.uid()) and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

-- The private schema is not exposed by the Data API. These counters are
-- mutated only by the checked function below, never through a client table.
create schema if not exists jazzlink_private;
revoke all on schema jazzlink_private from public, anon, authenticated;
grant usage on schema jazzlink_private to authenticated;

create table jazzlink_private.model_quota_global (
  quota_date date primary key,
  used integer not null check (used >= 0)
);
create table jazzlink_private.model_quota_users (
  quota_date date not null,
  user_id uuid not null references auth.users(id),
  used integer not null check (used >= 0),
  primary key (quota_date, user_id)
);
revoke all on all tables in schema jazzlink_private from public, anon, authenticated;

-- SECURITY DEFINER is necessary to protect the global budget from direct
-- mutation. Explicit caller checks, an empty search path, fixed limits and
-- a non-exposed schema are essential. Reservations are charged even on
-- failed or uncertain provider calls, so retrying cannot bypass limits.
create function jazzlink_private.reserve_model_call()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
  global_count integer;
  user_count integer;
begin
  if caller is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return false;
  end if;

  insert into jazzlink_private.model_quota_global(quota_date, used)
  values (today, 0) on conflict (quota_date) do nothing;
  select used into global_count from jazzlink_private.model_quota_global
  where quota_date = today for update;

  insert into jazzlink_private.model_quota_users(quota_date, user_id, used)
  values (today, caller, 0) on conflict (quota_date, user_id) do nothing;
  select used into user_count from jazzlink_private.model_quota_users
  where quota_date = today and user_id = caller for update;

  if global_count >= 30 or user_count >= 5 then return false; end if;
  update jazzlink_private.model_quota_global set used = used + 1 where quota_date = today;
  update jazzlink_private.model_quota_users set used = used + 1
    where quota_date = today and user_id = caller;
  return true;
end
$$;
revoke all on function jazzlink_private.reserve_model_call() from public, anon, authenticated;
grant execute on function jazzlink_private.reserve_model_call() to authenticated;

-- Thin SECURITY INVOKER wrapper enables PostgREST RPC without exposing the
-- private schema. Direct RPC calls can consume budget but cannot raise it.
create function public.reserve_model_call()
returns boolean language sql security invoker set search_path = ''
as $$ select jazzlink_private.reserve_model_call(); $$;
revoke all on function public.reserve_model_call() from public, anon, authenticated;
grant execute on function public.reserve_model_call() to authenticated;
