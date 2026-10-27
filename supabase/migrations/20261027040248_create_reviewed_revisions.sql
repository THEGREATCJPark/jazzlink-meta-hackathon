-- A user-reviewed copy of a saved draft. This is not a legal agreement.
create table public.gig_reviews (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.gig_drafts(id),
  owner_id uuid not null references auth.users(id),
  reviewed_by uuid not null references auth.users(id),
  draft_version integer not null check (draft_version >= 1),
  revision integer not null check (revision >= 1),
  request_id uuid not null,
  source_text text not null,
  draft jsonb not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (owner_id, request_id),
  unique (draft_id, revision),
  unique (draft_id, draft_version),
  check (owner_id = reviewed_by)
);
create index gig_reviews_owner_created_idx on public.gig_reviews(owner_id, created_at desc);
create index gig_reviews_reviewed_by_idx on public.gig_reviews(reviewed_by);
alter table public.gig_reviews enable row level security;
revoke all on public.gig_reviews from public, anon, authenticated;
grant select on public.gig_reviews to authenticated;
create policy "owners read reviews" on public.gig_reviews for select to authenticated
using (owner_id = (select auth.uid()) and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

-- The draft's version must advance on every update, even via direct Data API.
-- This makes the expected-version check below meaningful across all writers.
create function jazzlink_private.enforce_draft_version()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at or new.version <> old.version + 1 then
    raise exception using errcode = '23514', message = 'invalid draft version or ownership';
  end if;
  new.updated_at := now();
  return new;
end
$$;
revoke all on function jazzlink_private.enforce_draft_version() from public, anon, authenticated;
create trigger enforce_gig_draft_version before update on public.gig_drafts
for each row execute function jazzlink_private.enforce_draft_version();

-- This definer must insert an immutable snapshot that authenticated users
-- cannot insert or modify directly. It is deliberately in the unexposed
-- schema, checks the caller and row ownership, and uses no caller-supplied
-- snapshot content or actor identity.
create function jazzlink_private.create_gig_review(
  p_draft_id uuid, p_expected_version integer, p_request_id uuid, p_confirm_review boolean
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_draft public.gig_drafts%rowtype;
  existing public.gig_reviews%rowtype;
  next_revision integer;
  snapshot_id uuid;
  snapshot_hash text;
begin
  if caller is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or p_confirm_review is distinct from true or p_draft_id is null
     or p_expected_version is null or p_expected_version < 1 or p_request_id is null then
    raise exception using errcode = '22023', message = 'invalid review request';
  end if;

  select * into current_draft from public.gig_drafts
  where id = p_draft_id and owner_id = caller for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'draft unavailable';
  end if;

  -- Retry first: even if the draft was edited after the original review,
  -- the same request returns its original snapshot.
  select * into existing from public.gig_reviews
  where owner_id = caller and request_id = p_request_id;
  if found then
    if existing.draft_id <> p_draft_id or existing.draft_version <> p_expected_version then
      raise exception using errcode = '22023', message = 'request id already used';
    end if;
    return existing.id;
  end if;

  if current_draft.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale draft version';
  end if;
  if exists (select 1 from public.gig_reviews where draft_id = p_draft_id and draft_version = p_expected_version) then
    raise exception using errcode = '23505', message = 'draft version already reviewed';
  end if;

  select coalesce(max(revision), 0) + 1 into next_revision
  from public.gig_reviews where draft_id = p_draft_id;
  snapshot_hash := encode(extensions.digest(
    jsonb_build_object('sourceText', current_draft.source_text, 'draft', current_draft.draft)::text,
    'sha256'), 'hex');
  insert into public.gig_reviews(
    draft_id, owner_id, reviewed_by, draft_version, revision, request_id,
    source_text, draft, content_sha256
  ) values (
    p_draft_id, caller, caller, p_expected_version, next_revision, p_request_id,
    current_draft.source_text, current_draft.draft, snapshot_hash
  ) returning id into snapshot_id;
  return snapshot_id;
end
$$;
revoke all on function jazzlink_private.create_gig_review(uuid,integer,uuid,boolean) from public, anon, authenticated;
grant execute on function jazzlink_private.create_gig_review(uuid,integer,uuid,boolean) to authenticated;

-- PostgREST can expose only this invoker wrapper; authorization is repeated in
-- the private function. No verified identity or legal validity is implied.
create function public.create_gig_review(
  p_draft_id uuid, p_expected_version integer, p_request_id uuid, p_confirm_review boolean
) returns uuid language sql security invoker set search_path = ''
as $$ select jazzlink_private.create_gig_review(p_draft_id, p_expected_version, p_request_id, p_confirm_review); $$;
revoke all on function public.create_gig_review(uuid,integer,uuid,boolean) from public, anon, authenticated;
grant execute on function public.create_gig_review(uuid,integer,uuid,boolean) to authenticated;
