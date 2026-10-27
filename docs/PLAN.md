# Product and delivery plan
Baseline: 2026-10-27. Latest user direction overrides the earlier Firebase-extension plan.

## Source status
The prior saved development plan was retrieved. The original full research attachment is not available in the current project file list. Use the recovered product requirements; do not claim the complete original research was re-read.
Discard earlier directives to preserve React/Vite/Firebase, extend old contract services, reuse existing code, or target the old database.
API IDs, legal rules, pricing and participant-only submission details require primary-source/account verification before implementation.

## Vision, strategy and product — user decisions, 2026-10-27

### Vision: enduring purpose
Reduce the administrative burden of preparing and running performances so musicians can spend more time on music and their audiences.
AI, contracts and posters are means to this purpose, not the vision itself.

### Strategy: initial approach and hypotheses
- Primary user: NYC bandleaders and freelance musicians who personally coordinate their gigs. Venues are counterparties, not an equally prioritized initial acquisition audience.
- First problem: repeated clarification caused by missing or ambiguous performance conditions, especially fees, payment dates and set times.
- Entry point: the musician supplies an existing conversation or notes. The assistant extracts supported facts, identifies gaps/conflicts, and drafts useful clarification questions for human review and copying.
- Keep negotiation in the existing messenger. Do not require the venue to join a shared negotiation workspace or automatically contact it.
- The musician brings the venue's reply back into JazzLink. Show changed facts, their sources and remaining questions before human confirmation.
- Pasted replies and the musician's confirmation do not prove the counterparty's consent. Later signing still requires each party to explicitly approve the same contract version through an authenticated flow.
- Hypothesis to test: this clarification-and-reply loop reduces active preparation time without inventing terms, adding unnecessary questions, or moving hidden work to the venue.

### Product: hackathon scope to implement
Keep the complete core journey mandatory: conversation/notes -> review and copy clarification questions -> import reply -> review changes and unresolved conditions -> confirmed GigSpec -> English contract and Korean reference -> two-party signing -> signed PDF -> poster.
The contract and poster reuse the confirmed conditions; they support the core coordination problem rather than becoming unrelated generators.
An in-app negotiation chat, automatic messenger sending and musician matching are not required for this journey.
This is the agreed target product, not a statement that these features are implemented.

### Success criterion: target, not a result
The user selected **at least 30% less active preparation time than a manual workflow of equivalent quality**, from condition clarification through contract, signing, PDF and poster completion.
No baseline or savings result has been measured yet. Do not advertise a 30% saving as an achieved fact.

Proposed measurement protocol for implementation and later validation:
- Compare equivalent synthetic gig cases, required outputs and review/signing steps. Include reading, correcting AI mistakes and retries in active work time.
- Record the musician's active work time as the primary measure. Separately record venue work, external reply waiting and machine processing time; do not hide burden shifted to the counterparty.
- Calculate reduction as `(manual active time - JazzLink active time) / manual active time * 100` for a completed comparison.
- Preserve factual accuracy, privacy, explicit approvals and matching signed revisions in both workflows. Incomplete or lower-quality outputs do not count as successful time savings.
- Record participant count, familiarity, case differences and test order. Use comparable case variants to limit learning effects. Report individual results and limitations rather than extrapolating synthetic trials to all musicians.
- This measures the full workflow; separately time clarification to test whether the chosen strategy contributes to the result.

## Domain and demo conventions
English is primary; Korean is a reference translation for contract comprehension.
Synthetic demo: Blue Alley, a fictional NYC venue, a fictional bandleader, USD 900 fee, two sets. Audience ticket price is a different field.

## Priority
P0: conversation/notes -> source-backed missing/conflicting fact questions -> human review and copy -> pasted counterparty reply -> reviewed changes -> explicit confirmation -> immutable GigSpec revision.
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
