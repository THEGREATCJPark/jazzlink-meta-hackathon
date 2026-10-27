create index model_quota_users_user_id_idx on jazzlink_private.model_quota_users(user_id);

alter policy "owners select drafts" on public.gig_drafts
using (owner_id = (select auth.uid()) and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
alter policy "owners insert drafts" on public.gig_drafts
with check (owner_id = (select auth.uid()) and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
alter policy "owners update drafts" on public.gig_drafts
using (owner_id = (select auth.uid()) and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
with check (owner_id = (select auth.uid()) and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
