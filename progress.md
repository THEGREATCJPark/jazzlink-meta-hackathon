# Progress

## 2026-10-27 — planning after scope review
- Read AGENTS.md, README, all existing docs, package metadata, domain code, screen and tests.
- Ran planning session catchup; no previous planning files or catchup report were returned.
- Confirmed main at 279c789 with no initial user changes.
- Read planning-with-files and Supabase skills; consulted official API/RLS docs.
- Completed the narrower plan: scope, acceptance story, independent review/acknowledgement states, M0–M6, cut gates, holdout evaluation, revised time metric and submission schedule.
- Aligned README, AGENTS and architecture; setup now distinguishes past account observations from unverified application readiness.
- No application code, account configuration, database, deployment or paid API call changed in this task.
- Local Markdown targets checked across eight files; all targets exist. Documentation scope/status reviewed. Initial diff check identified excess final blank lines, corrected before final verification.
- Application tests were not run for documentation-only changes. No commit/push or deployment was performed.

## 2026-10-27 — implementation started
- Added partial source-backed terms, text review UI, Meta Responses adapter with structured-output validation, auth/draft endpoints and per-day quota reservation.
- Applied private-draft and quota migrations to the new Supabase project. Agent reports SQL transaction tests for owner/other/anonymous roles and limits, with no security advisor findings. Browser/HTTP session verification is pending.
- Added a manually dispatched, one-call synthetic structured-provider probe; not yet executed.
- Ran offline unit tests and local lint/build; browser shows the expected missing-model-configuration recovery and signed-out draft access rejection. Local model credentials are not assumed.
- Asked the user to create the first synthetic test account without sharing its password. No external email sent.
- M2 pure comparison helpers were added, but immutable snapshots are not yet persisted or connected to the screen.

## 2026-10-27 — first deployment and review history
- Commit 968778b pushed to main; Vercel production deployment reached Ready.
- One manually triggered synthetic structured Meta request returned HTTP 404. A later read-only model catalog listed muse-spark-1.3; this does not prove structured inference works. Error-code-only diagnostics added for a bounded follow-up.
- Added fictional prewritten results with an explicit no-AI label; browser verified source quotes, pending proposal, unknown year and unsaved status.
- Added personal immutable snapshot migration, API and UI with explicit review, idempotent request ID and revision history. Agent reports DB role/version checks; no browser-authenticated test yet. This is not bilateral agreement.
- Automated unit tests 18, lint and build passed locally. Full live model and authenticated browser flows remain unverified.

## 2026-10-27 — model fallback and evaluation preparation
- A second 1.3 structured request returned model_not_found (404). A single bounded 1.2 request completed: 228 input tokens, 688 output tokens, 4 candidates, 4 questions. Its source quote validation and expected synthetic fee check passed. This is not an accuracy evaluation.
- Updated production META_TEXT_MODEL to muse-spark-1.2; a fresh production deployment is required to load this change.
- Added human selection, separate public-field opt-in, reviewed version comparison and deterministic SVG public card. Card contents derive only from the latest loaded personal snapshot. Authenticated browser and SVG download still need real testing.
- Prepared a 12-case synthetic holdout and a rollback SQL regression script. Neither has yet been executed as a saved test suite; retain their stated limitations.
- In a local browser with mocked draft/review HTTP responses, selected a synthetic date and set times, recorded a personal review and downloaded SVG. The public card contained date/times and excluded the private fee. This did not exercise real Auth or database access.

## 2026-10-27 — additional guardrails
- Production deployment after changing the model config reached Ready; anonymous production extraction returns 401 before any provider request.
- A security review identified direct Data API storage exhaustion risk and a context-switch bug. Added database-enforced per-owner storage limits and UI context reset; real concurrent and authenticated HTTP verification remains outstanding.
- The database-backed quota limits spend but an authenticated account can consume the shared daily allowance directly through the RPC. Availability and account creation abuse need separate protection before a broad public demo.

## 2026-10-27 — authenticated integration and review fixes
- A user-provided synthetic test account signed in to production. One fictional conversation was analyzed through the app using Meta, saved privately, reopened after reload and recorded as a personal review.
- Two authenticated browser tabs opened the same draft; after one saved, the other received the expected stale-version rejection. This was a sequential stale-write check, not a simultaneous-writer test or a second-user isolation test.
- Independent review found that new-message analysis could lose previously selected terms and uncertain suggestions could be shown without their status. A separate baseline, explicit carry-forward, status-preserving output and public-value recheck are under implementation.
- Added server-side integer-cent canonicalization and New York DST gap/fold classification. Database money constraints are prepared but remain unapplied pending deployment of the compatible server.
- Real account credentials are never stored in this repository, test outputs or logs.
