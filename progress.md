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
- Deployed the compatible server, then applied the canonical-money database migration. Existing legacy rows were preserved; a real saved draft was rewritten by the new server and verified to contain a JSON integer cents value. Database tests covered valid/invalid insertions with rollback and documented FK/trigger limits.
- Added a no-account, browser-memory-only interactive fictional demo; it uses prewritten responses and performs no model requests. Browser tests checked review, explicit public-card confirmation, private fee exclusion and reset behavior.
- Replaced the native reanalysis confirmation with an in-page confirmation after the browser automation encountered a blocked native dialog.

## 2026-10-27 — provider availability and recovery
- One bounded, synthetic change-scenario GitHub Actions request using muse-spark-1.2 returned HTTP 404 `model_not_found` before producing output; earlier 1.2 successes are historical observations, not evidence of current reliable access. GitHub Actions and the production app use separate secret stores. The change interpretation remains untested. No automatic retry was made.
- A later read-only authenticated GitHub Actions catalog request returned HTTP 200 with zero model IDs; an earlier catalog response had included models. No paid inference was made for this catalog check. The cause is unknown and production credentials were not tested by this check.
- The official error documentation lists an incorrect model ID or a model unavailable to the team as possible explanations; the exact cause here is unknown. The unauthenticated status endpoint reported operational, but returned no per-model statuses, so it cannot establish 1.2 availability.
- The adapter distinguishes `model_not_found` from other failures and the workspace keeps the current text/review and offers manual review. Manual-review replacement uses an in-page confirmation; no live provider request is needed for this recovery path.
- Updated setup, plan, README and hackathon records so previously verified paths are distinguished from outstanding reliability, multi-user and evaluation work.
- Added conservative schedule/fee-change warnings: an old fee brought into a review with a schedule-change risk starts unselected. A newly entered amount is not treated as the other party's agreement.
- Added source-link checking against authenticated same-draft review history in the application review route and display. Applied a follow-up database trigger to check newly inserted snapshots even through the direct RPC; existing history is not rewritten. Local PGlite and a rolled-back role-simulation test on the new Supabase project passed, including a legacy amount and a rejected fabricated quote. These checks do not prove real HTTP cross-user isolation, semantic support or identity.
- Public-card export now requires a title, venue, artist, valid date and times. If a reviewed set count is known, the displayed time count must match it; unknown counts are not guessed. Existing DST and public/private checks remain.
- Unit tests (54), lint and production build passed locally after these changes. A local mocked-browser run verified valid reviewed history, fee reconfirmation, source-link rejection, incomplete-card blocking and a fictional SVG download without private fee information. HTTP responses were mocked; this was not a new live database or provider test, and none of these tests is a semantic model evaluation.

## 2026-10-27 — evaluation and submission preparation
- Added a manually dispatched, single-case synthetic holdout runner. It sends only the selected source and never evaluation labels, records unscored output or failure, and makes at most one adapter call per run. It does not run in ordinary CI and does not use the application's quota counters.
- Added a three-minute storyboard that distinguishes historical Meta evidence, a live request if available, and the prewritten interactive demo. No video has been recorded and no submission or external post has been made.

## 2026-10-27 — contextual change review and integration
- Added owner-scoped server loading of a saved draft's latest personal review for contextual extraction. The request supplies identifiers and expected versions, never a client-provided baseline; even an empty review history is checked. The server checks again after inference and discards a result on detected changes. A discarded result can still consume a model call and quota reservation; this is not idempotent inference or a lock across the provider request.
- Prior selected values and evidence labels are untrusted context. New candidates must cite new text. Quote occurrence does not establish semantic support or counterparty approval. No live contextual inference or holdout evaluation was run.
- Reordered the workspace around questions and changed values, retained explicit personal-review and public-card choices, and added copyable questions to the prewritten demo. No message is sent automatically.
- Offline tests passed (67), including mocked handler checks for stale and unavailable context before reservation and stale context after the provider response. Lint and production build passed. Local built-app HTTP returned 200 for the fictional demo and 401 for anonymous draft access; the local model was unconfigured. The previously deployed production demo returned 200 and anonymous draft and extraction requests returned 401. These checks are not authenticated end-to-end or real cross-user HTTP tests.
- Interactive desktop and mobile browser verification could not be repeated in this execution because no browser was available to the computer-use session. The 12-case holdout remains prepared, not run; time savings remain unmeasured. No paid model call, new service, external message or submission was made for this change.

## 2026-10-27 — isolated interaction checks and manual diagnostics
- Added mocked jsdom interaction checks and made them part of the offline test command. Clarification questions now warn when edits or selections may make the original questions stale; the demo asks for the total fee for the complete arrangement. These checks are not browser layout or authenticated end-to-end evidence.
- Prepared a masked-prompt diagnostic for one catalog read and, only when the exact model is listed, one bounded synthetic contextual adapter call. It has not been run. A Vercel Production Secret is not retrievable through the existing local CLI, so production-key provenance would be operator attestation, not independently verified by the script.
- Prepared a separate masked-prompt, real-Auth cross-user HTTP harness. It has not been run: the available Supabase CLI session lacks admin-key access. Its cleanup deletes only its own synthetic users and public fixtures; the private storage counter may retain zero-count rows. Real cross-user HTTP isolation remains unverified.

## 2026-10-27 — later GitHub provider observations
- A read-only [GitHub catalog run](https://github.com/THEGREATCJPark/jazzlink-meta-hackathon/actions/runs/40460071887) listed nine models including 1.3 and 1.2. A subsequent [basic synthetic 1.3 adapter run](https://github.com/THEGREATCJPark/jazzlink-meta-hackathon/actions/runs/40460130677) completed in 4.37 seconds with 507 input and 670 output tokens, three source-validated candidates and one question; the fee was proposed. These runs use the GitHub Actions credential. They do not establish Vercel credential access, contextual-change quality, holdout results or reliability; earlier failures remain unexplained.

## 2026-10-27 — UI/UX refactor (presentation only)
- Implemented: shared design tokens and primitives in `globals.css` (buttons, callouts, form controls, focus-visible rings, skip link, reduced motion, 12px minimum text, AA-oriented text colors); shared `SiteHeader`/`SiteFooter`/`Stepper` used by the workspace, demo and sign-in pages; the workspace stepper now reflects progress with `aria-current`; source-panel actions grouped (primary analyze, "Other ways to start", private draft with saved/unsaved indicator, record review); review panel loading state, consolidated notices and status chips with text labels; reviewed terms sheet beside the public card on wide screens; styled sign-in page.
- Refactored `src/app/page.tsx` by moving types/helpers to `src/components/workspace/model.ts` and extracting `DetailCard`, `RevisionHistory` and `TermsSheet`. State, handlers, API calls, evidence checks, public-field allowlist and all agreement/consent wording are unchanged.
- Tested: lint, 70 offline domain tests, 7 jsdom UI tests (one new stepper test) and production build passed. Desktop (1440px) and mobile (390px) screenshots of the workspace, fictional demo and sign-in were checked locally with Playwright against `next start`, signed-out only. Not tested: authenticated flows in a browser.
