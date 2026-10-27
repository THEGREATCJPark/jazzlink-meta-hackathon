# ADR-001: Source-backed gig terms review

Status: partially implemented, 2026-10-27. The implementation and its current limits are summarized below; later entity and acknowledgement sections describe the proposed architecture, not features already shipped.

## Implemented boundary and verification limits

Authenticated users save private `gig_drafts` and create immutable personal `gig_reviews` with a database-enforced expected draft version, request deduplication and content hash. They do not establish counterparty consent. The application review route and a database trigger check source quote occurrence and carried links against the same draft's immutable history before a new review is inserted; the UI independently checks these links before showing source attribution or exporting that review. A matching quote does not prove its meaning, its author, actual agreement or model use.

The database trigger also applies when an authenticated caller invokes the review RPC directly. It checks new insertions only and leaves historical records unchanged; the application hides the terms and public output of historical reviews with unverifiable links. Checks are bounded to limit database work and can time out on unusually large valid histories. This is not an authenticated identity or tamper-proof provenance guarantee. Canonical money consistency is enforced separately by database constraints on new/updated rows, while historical rows remain untouched.

There is no durable provider-run table, participant acknowledgement, audit-event table or task queue yet. Provider calls are synchronous, limited by database reservations, and are not automatically retried. The public `/demo` uses a synthetic prewritten story without model calls or storage. The production app previously completed one authenticated synthetic Meta extraction; a later GitHub Actions probe using the same model ID returned `model_not_found`, so current reliability is unverified.

## Stack and authority

Keep Next.js/TypeScript, Supabase Postgres/Auth and Vercel. Add private Storage only if screenshot intake passes its gate. Existing JazzLink/Firebase is reference only.

Browser → authenticated application route → domain validation/authorization → Supabase with the requester's session. Meta adapter stays server-only. No provider or privileged database key reaches the browser. Ordinary user CRUD does not require a privileged key; provisioning, if needed, uses a separate scoped administrative path.

RLS and explicit grants protect exposed tables; server checks validate membership, actor, expected revision and transition. Test routes and direct Data API access with anonymous and unrelated accounts. Never authorize from user-editable metadata.

## Proposed entities, not applied SQL

| Entity | Responsibility |
| --- | --- |
| gigs | Owner, current draft version, current reviewed revision |
| gig_members | Protected account-to-gig assignments and review permissions |
| source_items | Immutable versions of pasted messages, claimed speaker/order, private text or asset ref |
| drafts | Editable partial values, candidates, evidence and version counter |
| gig_revisions | Immutable reviewed snapshot, reviewer/time, schema version and canonical content digest |
| acknowledgements | Unique participant/revision acknowledgement of exact digest, only if M3 ships |
| provider_runs | Source/base revision, request key, provider/model, status, duration, usage, sanitized errors |
| audit_events | Server-attributed review/acknowledgement/revision actions |

Candidate provenance includes source ID, field path, quote/range for text, optional screenshot region, interpretation and conflict flags. Human edits have their own origin. Quote existence does not establish semantic correctness.

Snapshots contain gig/party/venue details, local date, timezone, set times/durations, fee cents, optional ticket cents, payment terms, unresolved issues and evidence. Draft values can be null. Reviewed snapshots may retain unknowns and must display them.

Server-confirmed review/acknowledgement is separate from model-editable data. Digests establish content identity, not real-world identity or legal validity.

## Transactions and concurrency

Snapshot creation checks expected draft/revision versions atomically, verifies the actor, writes snapshot/audit and advances the reviewed pointer. Conflicts return refresh-and-review, not last-write-wins. Direct client paths cannot mutate immutable snapshots or forge audits.

Acknowledgement binds an assigned actor to the exact current revision. The actor cannot act as another participant. Repeated requests are idempotent; later revisions preserve but never inherit acknowledgement.

Model calls run outside transactions. Persist source/run identity first. Attach results to that identity and never auto-apply them to a changed base. An uncertain paid request is not automatically replayed after process failure: show interrupted/unknown status and permit a bounded explicit retry that might incur another call. This is not exactly-once provider billing or durable execution.

## Model and output strategy

The configured production model is muse-spark-1.2. One synthetic structured-output probe and one production request passed, but a later GitHub Actions request returned `model_not_found`; the environments use separate credentials. Verify availability and accuracy independently. Schema checks constrain shape; evidence review and state rules constrain action. External material is untrusted data, never tool instructions.

Begin with bounded synchronous requests, input/output limits, user/global quotas and limited retries for classified transient failures. Log metadata, not private text or secrets. Provider failure leaves saved work editable. Judge traffic cannot trigger unlimited inference.

No image generator, SAM, legal document renderer or background platform is needed for the core. Screenshot input is optional and must pass real capability/access checks first.

English sheet and Korean reference use the same snapshot. PublicGigView explicitly allowlists title, public lineup/venue, date, times and ticket information. It never forwards entire snapshots. Export shows actual review status and requires a user action. There is no calendar/SNS publication.

## Initial code layout

- src/domain/: partial schemas, evidence, changes, state rules and public projection.
- src/server/: auth/access, repository operations, Meta adapter and quota checks.
- src/app/: input/review/diff/output UI and authenticated routes.
- supabase/migrations/: versioned changes created through verified CLI commands.
- tests/fixtures/: synthetic development cases and a separately versioned holdout.

Keep layout small. Pin installed packages and preserve lockfiles. Read current CLI help before creating migrations. Apply only to new project inlotwlppvrscyjncbbb; never alter the old Seoul project.

## Judge access

Use per-session synthetic isolation and a limited inference allowance. Select isolated guest demo sessions or provisioned test participants during M1 after testing fresh-browser access. Never embed shared privileged credentials in client code or the repo. Two-account review uses distinct authenticated sessions and assigned roles.

## References and verification gates

- https://dev.meta.ai/docs/protocols/responses
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/auth/server-side/nextjs
- https://supabase.com/changelog.md

Recheck exact protocol, Auth integration and API permissions during implementation. Do not hardcode historical hosting limits, prices or unverified capabilities.
