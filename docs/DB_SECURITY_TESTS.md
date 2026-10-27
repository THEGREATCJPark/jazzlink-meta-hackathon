# Database security regression test

The synthetic, transactional script is [security.sql](../supabase/tests/security.sql). It checks owner isolation, authenticated grants, immutable reviewed snapshots, actor attribution, explicit review, idempotency and rejection of a sequentially stale draft version. All fixture changes roll back, and no real user or secret is included.

Run it against a disposable **local** Supabase database after the repository migrations are applied. From the repository root, using a configured local Supabase CLI stack:

```sh
npx supabase db query --local --file supabase/tests/security.sql
npx supabase db query --local --file supabase/tests/storage_limits.sql
```

This requires a privileged database session permitted to set `session_replication_role`. Do not run it against a shared or production database. The script intentionally switches to `replica` within its transaction for fictional UUID fixtures, which disables foreign-key triggers **and other ordinary triggers** in that session. It restores normal trigger mode before the separate draft-version-trigger check and explicitly rolls back at the end. The runner should stop on SQL errors; failure aborts the transaction.

The test simulates JWT claims at the PostgreSQL role level. It does **not** verify Auth-issued JWTs, the HTTP Data API, real foreign keys, concurrent transactions/locking, browser sessions or actual user workflows. Run separate authenticated integration and simultaneous-writer tests for those properties. Passing this script is not evidence of a signed agreement or verified real-world identity.

The storage-limit script attaches the production trigger function to temporary same-named tables to test its counters without creating Auth users. It also tests the actual JSON size check with a rolled-back synthetic row. It tests sequential limits and rollback behavior, not simultaneous writers or the original tables' full RLS/FK integration. PostgreSQL's atomic UPSERT row lock is used by the implementation, but a separate concurrent test remains required.

## Quota and capacity limits

The application reserves before issuing a Meta request, with an authenticated user and fixed daily caps. Code inspection did not find a way to reach the application's Meta call without a successful reservation. Authenticated callers can invoke the public reservation RPC directly and exhaust the shared daily allowance without invoking Meta: this is an availability limitation, not evidence of additional model calls. The quota resets on the UTC date and is not a dollar or total-credit spending cap; other clients using the same key, including manual Actions workflows, are outside its accounting.

Database constraints and atomic owner counters bound each draft JSON to 128 KiB and each owner to 20 drafts and 100 reviewed snapshots. They do not limit overall account creation, PostgREST request ingress, other storage consumers, or total usage across many accounts. Ordinary authenticated clients cannot delete snapshots; an explicit retention/administration strategy and user-facing limit handling are still needed. The counter trigger assumes normal database trigger execution: privileged maintenance that disables triggers must reconcile counts.

The same underlying rollback checks were run once against the new hackathon project during development; this saved regression file has not itself been re-executed. Default CI remains offline and does not run it.

## Review evidence validation

The new snapshot trigger checks quote occurrence and same-draft history links, including a canonicalized copy of selected historical money. It does not rewrite old rows or prove meaning, speaker identity, approval or AI use. It takes a per-owner advisory lock and has a three-second validation deadline; very large valid histories can time out. This does not protect against unlimited registrations or requests across many owners.

The isolated [PGlite runner](../supabase/tests/review_evidence.pglite.mjs) uses synthetic Auth roles and runs the migrations, regression checks and a bounded stress case. Install `@electric-sql/pglite@0.5.12` in a separate temporary directory, set `JAZZLINK_PGLITE_DIR` to its absolute path, then run `node supabase/tests/review_evidence.pglite.mjs`. The stress fixture uses trigger bypass in the disposable DB only; ordinary regression cases use normal triggers.

The separately reviewed [remote rollback script](../supabase/tests/review_evidence_remote_rollback.sql) ran on 2026-10-27 against the new hackathon project with exactly one test account. It inserted only synthetic rows inside a rolled-back transaction and checked direct RPC evidence rejection, personal-history immutability, old-version rejection and a simulated different-user claim. The user/draft/review counts were unchanged afterward. It simulates PostgreSQL claims and role access; it is not an Auth-issued JWT, PostgREST/HTTP, multi-session race or real-person test.
