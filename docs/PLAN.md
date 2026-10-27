# Product and delivery plan
Baseline: 2026-10-27. Latest user direction overrides the earlier Firebase-extension plan.

## Source status
The prior saved development plan was retrieved. The original full research attachment is not available in the current project file list. Use the recovered product requirements; do not claim the complete original research was re-read.
Discard earlier directives to preserve React/Vite/Firebase, extend old contract services, reuse existing code, or target the old database.
API IDs, legal rules, pricing and participant-only submission details require primary-source/account verification before implementation.

## Users and promise
NYC venue operators and bandleaders agree gig details once and keep the contract, signatures and promotional assets consistent.
English is primary; Korean is a reference translation for contract comprehension.
Synthetic demo: Blue Alley, a fictional NYC venue, a fictional bandleader, USD 900 fee, two sets. Audience ticket price is a different field.

## Priority
P0: natural-language details -> missing/conflicting fact questions -> explicit confirmation -> immutable GigSpec revision.
P0: English contract and Korean reference; two authenticated parties sign the exact same revision; downloadable PDF and audit events.
P0: Meta-generated background plus deterministic text, PNG at 1080x1080 and 1080x1920.
P0 integration gate: SAM cutout attempt; original-photo layout remains usable if unavailable.
P0: real provider trace, bounded costs/retries, permission checks, failed-job recovery, judge-accessible demo.
P1: flyer extraction -> source/field review -> approved calendar publication; background editing.
P1: authorized owned Instagram media only after core flow works.
P2: musician matching, voice input, additional language references.
Deferred: city-wide crawling, automatic SNS sending, Tokyo-specific rules, tax automation and motion video.

## Data contracts
GigSpec: id, revision, schemaVersion, owner, parties, venue, local date, IANA timezone, set times/durations, USD amountMinor, payment agreement, negotiated terms, per-field provenance and confirmation.
PublicGigView: only public title, lineup, location, dates/sets and audience ticket price.
Artifacts: source revision, payload hash, render version, provider/model, private storage location.
Separate contract fee from ticket price; unknown amounts are null, not zero.
Version changes invalidate pending approval/signature actions and mark old posters stale.

## Completion gates
- Text extraction with schema validation and unresolved facts.
- Signature ownership, expired invitations, concurrent changes and duplicate actions.
- Signed version remains immutable; PDF retry preserves exact snapshot.
- Both poster sizes inspected; long names and multilingual glyphs verified.
- API timeout/429/invalid JSON and malicious caption handling.
- DST-sensitive local times, currency correctness, private-field exclusion.
- Core journey succeeds five consecutive times, including refresh and retry.
- Judge access tested in a fresh browser; demo users/data isolated.
These are targets, not results.

## Submission schedule
Working target from prior planning: official deadline 2026-11-05 11:00 KST; internal submission target 2026-11-04 22:00 KST.
Oct 27: setup, real API capability probes, schema and hosting.
Oct 28-30: extraction, contract, signing, PDF.
Oct 31-Nov 1: poster and integration; P1 only if P0 is stable.
Nov 2: user review, reliability, feature freeze.
Nov 3: recording and code freeze.
Nov 4: README, evaluation evidence, video and submission.
Participant portal controls actual required fields and video length; obtain those details before final packaging.

## Human input still needed
Meta access/credit status; Supabase project and deployment configuration; participant-only submission instructions; incremental spending ceiling.
Optional: authorized performance assets and review by musicians/venue operators. Synthetic assets are sufficient to begin.
