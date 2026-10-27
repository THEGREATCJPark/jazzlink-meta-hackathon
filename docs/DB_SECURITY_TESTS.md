# Database security regression test

The synthetic, transactional script is [security.sql](../supabase/tests/security.sql). It checks owner isolation, authenticated grants, immutable reviewed snapshots, actor attribution, explicit review, idempotency and rejection of a sequentially stale draft version. All fixture changes roll back, and no real user or secret is included.

Run it against a disposable **local** Supabase database after the repository migrations are applied. From the repository root, using a configured local Supabase CLI stack:

```sh
npx supabase db query --local --file supabase/tests/security.sql
```

This requires a privileged database session permitted to set `session_replication_role`. Do not run it against a shared or production database. The script intentionally switches to `replica` within its transaction for fictional UUID fixtures, which disables foreign-key triggers **and other ordinary triggers** in that session. It restores normal trigger mode before the separate draft-version-trigger check and explicitly rolls back at the end. The runner should stop on SQL errors; failure aborts the transaction.

The test simulates JWT claims at the PostgreSQL role level. It does **not** verify Auth-issued JWTs, the HTTP Data API, real foreign keys, concurrent transactions/locking, browser sessions or actual user workflows. Run separate authenticated integration and simultaneous-writer tests for those properties. Passing this script is not evidence of a signed agreement or verified real-world identity.

The same underlying rollback checks were run once against the new hackathon project during development; this saved regression file has not itself been re-executed. Default CI remains offline and does not run it.
