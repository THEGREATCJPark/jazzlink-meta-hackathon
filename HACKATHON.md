# Hackathon contribution record

Last updated for repository state at commit d33815e (2026-10-27). This is a working record, not a statement that the project has been submitted or that every feature is verified.

## Event and submission checkpoints

The participant guidance supplied to us specifies a public repository, an accessible **three-minute** demo, and a deadline of **November 4, 2026 at 21:00 America/New_York** (November 5 at 11:00 KST). It requires the demo to identify work built during the event. Confirm the actual submission fields, current Official Rules and participant portal before submitting; this summary does not reproduce or replace those sources.

## Earlier material and starting point

An earlier JazzLink application existed before this event and was mentioned in the original application as background and experience. It is a separate repository and is not claimed as event work. The new NYC project is greenfield; its code, database, credentials and deployment were not imported from the old application. Music-domain experience predates the event and should be described as experience, not as new hackathon functionality.

The earliest commits in this repository began at e135a8d on October 27, 2026 at 10:05 KST, after the user-provided October 26 kickoff. Initial commits created planning/configuration documentation; 508285f then added a manual prototype. Commit history supports the timeline but does not by itself verify when underlying assets were authored. Identify any future pre-existing assets and third-party permissions individually.

## Work created in this repository during the event

| Area | Evidence | Status / verification boundary |
| --- | --- | --- |
| Product scope and architecture | [README](README.md), [plan](docs/PLAN.md), [architecture](docs/ARCHITECTURE.md), git history | Written for the current project; strategy and impact remain hypotheses |
| Source-backed terms review and fictional preview | [workspace](src/app/page.tsx), [domain](src/domain/terms.ts), [change comparison](src/domain/changes.ts) | Implemented; full browser journey and independent semantic evaluation remain unverified. The example is prewritten, not a model result. |
| Server-side model adapter and quotas | [adapter](src/server/meta.ts), [extraction route](src/app/api/extract/route.ts), [migrations](supabase/migrations/) | A single synthetic structured adapter probe completed with muse-spark-1.2. Production runtime, all semantic cases and overall reliability remain unverified. A simple muse-spark-1.3 probe previously succeeded, but a later structured call returned model_not_found. |
| Private drafts and personal reviewed snapshots | [draft routes](src/app/api/drafts/), [review routes](src/app/api/revisions/), [security checks](docs/DB_SECURITY_TESTS.md) | Implemented; scripted rollback checks covered some database permissions. Browser sign-in, HTTP isolation, concurrency and complete save/reload/review journeys still need testing. A personal review is not counterparty approval or a legal signature. |
| Comparison and public-card rendering | [review UI](src/components/ChangeReview.tsx), [card UI](src/components/PublicTermsCard.tsx) | Implemented; the actual browser/download flow and exclusions still require end-to-end verification. |
| Evaluation preparation | [synthetic holdout](tests/fixtures/evaluation-v1.json), [evaluation guide](docs/EVALUATION.md), [user-study plan](docs/USER_STUDY.md) | Fixtures and instructions only; no model gate or user-time study is complete. |

This table must be updated when the app or verification changes. Git commits, reviewable source and dated actual test results are the evidence; neither the application narrative nor this checklist substitutes for them.

## Deliberately excluded or not implemented

No claim of legal contract generation, legally effective e-signatures, a signed PDF, two-party acknowledgement, verified identities, Muse Image output, SAM cutout, automatic messages/social posting, musician matching or market-data crawling. Korean reference labels are only as implemented and verified; do not claim a complete translated agreement.

## Data, models and assets

- Development and demonstrations use fictional or explicitly authorized content. Blue Alley and sample messages are fictional. Never place actual contracts, private conversations, personal information or secrets in this public repository.
- Record actual models and providers used per run; do not imply Meta created an offline fixture or a deterministic card.
- A source quote's presence establishes where the text appeared, not its truth, real-world identity, legal effect or counterparty approval.
- Before adding external media, fonts, audio or other assets, record their source, license/permission and scope. The current project uses no claimed real artist photo or performance recording. Font/CDN dependencies and their terms should be checked as part of final packaging.

## Final evidence checklist — pending

- [ ] Reconfirm the repository is publicly accessible and the actual submitted commit is identified.
- [ ] Build and test the submission commit; record date, command, results and remaining limitations.
- [ ] Check production browser access in a fresh session, including a safe synthetic path and bounded AI use.
- [ ] Complete and report any model or user evaluations actually performed; do not fill in results in advance.
- [ ] Produce an accessible three-minute video with only event-built capabilities, labeling fictional/fixture/replayed content.
- [ ] Check model availability/attribution and asset rights for actual submission contents.
- [ ] Verify final portal fields, contributor listing, current rules, and live/demo/video links.
- [ ] Review final submission with the user before submitting or posting externally.
