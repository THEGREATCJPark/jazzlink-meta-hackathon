# JazzLink AI development plan

Planning baseline: 2026-10-27, inspected repository HEAD 279c789.
Status: proposed delivery plan responding to the user's Pro review. Documentation only; planned features are not implemented. This replaces the earlier full-contract/signature/poster target for this planning iteration. Final submission remains user-reviewed.

## 1. Product decision

**Vision:** reduce performance administration so musicians spend more time on music and audiences.

**User:** a bandleader personally negotiating gig conditions in an existing messenger.

**Problem:** when a new request arrives, determining what was agreed, what was merely proposed, and what needs clarification requires rereading messages and updating inconsistent documents.

**Strategy:** import selected messages, inspect extracted conditions beside evidence, review changes, copy clarification questions, and produce a versioned terms sheet after human review. Keep communication in the existing messenger.

**Submission promise:** show supported conditions, unresolved requests and their impact without automatically turning a request into an agreement.

This is a candidate useful workflow, not a proven competitor-exclusive feature or business moat. The user's firsthand experience is in Korea. New York is the synthetic demo setting, not a validated local customer market.

## 2. Scope contract

| Must deliver | Gate-controlled additions | Deferred from this submission |
| --- | --- | --- |
| Text intake, fictional sample, real server-side Meta extraction | Two authenticated test participants acknowledging the same revision | Legal contract drafting, e-signatures and signed PDF |
| Source inspection, unknown/conflicting/proposed conditions, human edits | One chat screenshot input path after text reliability gate | Muse Image posters and SAM |
| Clarification questions for manual copying; reply import | Browser-printable terms sheet | General AI management, matching and venue discovery |
| Persisted drafts, immutable reviewed snapshots and change comparison | Additional card format | Audio, video matching, market crawling |
| English terms sheet, aligned Korean reference, deterministic public card | Counterparty review page with manually shared access | Automatic messages/invitations, SNS posts, payments, tax/legal determinations |
| Auth/ownership, RLS, stale-revision rejection, bounded paid calls | | Additional infrastructure for bonus awards |
| Isolated judge-accessible synthetic demo and honest evaluation | | |

Two-account acknowledgement is a delivery target with an October 30 cut gate. If cut, every screen and submission says **musician review only**, never bilateral agreement. The product remains useful without venue onboarding.

Korean reference uses the same stored values and field IDs. Preserve names, dates and numbers exactly; keep arbitrary original free text visible. Translated free text remains labeled unreviewed until checked. Neither language silently gains legal clauses.

The public card is a local preview/download, not an automatic post. Only explicitly shareable fields may appear. Missing required public date/time prevents a ready-to-share export; an internal draft preview can show unknowns.

## 3. First end-to-end acceptance story

1. Start a synthetic Blue Alley gig and paste messages. Speaker/order labels are supplied data, not authenticated identity evidence.
2. Extract two sets, $900 performance fee and stated times. Leave unstated year, duration and payment date unknown. Display each extracted field beside its source message and quote.
3. Let the musician correct a value with human-edit attribution and save a reviewed snapshot. Unresolved items remain explicit; saving does not mean fully agreed or ready to share.
4. Import: “Could we start at 9 PM and add another set?” Keep the current snapshot unchanged. Show a pending request; do not infer other set times, duration, fee or acceptance.
5. Produce grouped clarification questions for manual copying. No external send occurs.
6. Add a clearly labeled synthetic reply explicitly giving the full new schedule, total fee and remaining terms. Review its evidence and edits, then create a new snapshot.
7. If M3 passes, each test participant separately acknowledges the identical revision. This records an account action, not verified real-world identity, a legal signature or legal certification.
8. Render the terms sheet and public card from the selected reviewed revision. Fee-only changes must not expose compensation or falsely imply visible public information changed.
9. Reload to prove persistence; attempt an action from an older screen to prove stale-revision rejection. Preserve old snapshots and acknowledgement records.

## 4. State and evidence semantics

Keep three independent concepts, not a single confirmed boolean.

| Concept | Meaning | Authority |
| --- | --- | --- |
| Model interpretation | Candidate value, proposal/acceptance/rejection/withdrawal interpretation, missing/conflict flags | Untrusted suggestion requiring source review |
| Musician-reviewed revision | An authenticated musician reviewed this exact snapshot, including unresolved items | Musician only |
| Both participants acknowledged | Both assigned accounts explicitly acknowledged the same snapshot | Server-authorized revision-specific records |

- Missing is absence, not zero/false or an invented default. A proposal does not change the reviewed snapshot.
- Acceptance interpreted from pasted text is not in-app counterparty acknowledgement.
- Human edits record actor and origin; they must not inherit fabricated quotes or imply counterparty consent.
- Preserve conflicting candidates rather than mechanically choosing the latest message. Message timestamps may themselves be unknown.
- Acknowledgements remain historical but never transfer to a new revision. Pending requests do not invalidate the previous review.
- Reviewed snapshots may retain unknowns; the UI lists them and prohibits an unqualified “fully agreed” label.
- Snapshot creation and acknowledgement require expected-revision checks in an atomic database operation. Unique request keys deduplicate submissions. No model call occurs inside that transaction.
- Public-field dependency comparison determines whether visible card content needs updating. Every export still records its source revision.

## 5. Milestones and completion evidence

Estimate: 40–55 focused hours, not a promise about user availability. Dates are KST. Reserve approximately 10–12 of those hours for verification, video, documentation and submission preparation.

| Milestone / target | Work | Acceptance evidence |
| --- | --- | --- |
| M0 — Oct 27–28, 2–3h | Partial draft/evidence schema; 12 held-out cases; screen flow; verify runtime config and one bounded synthetic request | Actual server response metadata; unknown-friendly schema; no keys in browser/logs |
| M1 — Oct 28, 6–8h | Auth, migrations/RLS, source storage, Meta adapter, evidence panel, edit/save/reload | Real input becomes saved draft; another user cannot read it; absent year/payment remain absent |
| M2 — Oct 29, 7–9h | Candidate changes, missing/conflicts, questions, reply import, immutable snapshots and diffs | New request leaves baseline unchanged; reviewed edits create revision; source links work |
| M3 — Oct 30, 4–6h | Target two-account acknowledgement, assigned roles, atomic version checks and audit | Separate sessions acknowledge same revision; outsider and stale-revision actions fail |
| M4 — Oct 31, 4–6h | English/Korean sheet, public projection, deterministic card; screenshot only after gate | Private fields absent from public output; exact values consistent; missing public dates block export |
| M5 — Nov 1–2, 7–9h | Held-out evaluation, failure/security tests, small human comparison, judge access | Results with denominators, critical errors, latency and limits |
| M6 — Nov 3–4, 10–12h | Three-minute video, README, contribution record, run/demo instructions, submission package | Fresh-browser links work; claims trace to evidence; final submission reviewed with user |

M0 → M1 → M2 is the critical path. M3 can be cut. M4 depends on reviewed snapshots, not bilateral acknowledgement, and must show actual review status. Test-case authoring and submission documentation start early; feature breadth waits.

### First implementation session

1. Read current provider docs and Supabase CLI help; verify configuration without printing values. Use one synthetic application probe before diagnosing failure.
2. Replace the current all-fields-required draft validator with partial candidates and evidence. Keep currency correctness and add meaningful transition tests.
3. Build input/evidence/review UI with clearly labeled offline fixtures.
4. Add real Meta calls and server validation; never deploy an anonymous unbounded paid endpoint as an intermediate step.
5. Connect authenticated source/draft persistence and prove save/reload and cross-user denial.
6. Report actual results before adding modalities.

## 6. Screens and implementation boundaries

Four primary views:
- Gig list / synthetic sample entry.
- Review workspace: source panel, conditions, missing/conflicts, editable values, clarification questions.
- Revision comparison: baseline, pending proposals, evidence, human-edited successor and review action.
- Terms sheet / public card: correct status, revision, Korean reference, download; participant acknowledgement only if enabled.

Keep Next.js/TypeScript, existing Supabase project and Vercel. Meta remains server-only. See [architecture](ARCHITECTURE.md). No new provider account is required for the core.

## 7. Validation before expanding

### Model/semantic evaluation

Freeze a holdout of 8 change/conflict cases and 4 ordinary controls, separate from development cases. Include missing year/payment/duration, partial acceptance, withdrawal, fee vs ticket price, old quotations, conflicting dates/times, speaker ambiguity and instruction-like source text. Cases may have multiple labels.

Proposed development gate, fixed before evaluating:
- 0 unsupported critical assertions presented as established facts (date, money, agreement status).
- Surface at least 7/8 predefined change problems.
- At most 1/4 controls with unnecessary critical warnings.
- 0 automatic overwrites of reviewed snapshots, even with deliberately wrong model output.

These are targets, not current scores or safety guarantees. Record model/config, fixture version, attempts, latency and tokens. Do not drop failed/timed-out cases. Preserve the first frozen results; changes require a new evaluation version. Default CI is offline; live batches require a fixed call/token budget and explicit manual execution.

### Application/security evaluation

- Anonymous and unrelated authenticated sessions cannot read/mutate private gigs, sources or acknowledgement records through routes or direct Data API access.
- Test actual grants and RLS; membership cannot be self-assigned.
- Cannot act for another participant, transfer acknowledgement between revisions or edit immutable snapshots.
- Concurrent writes cannot silently overwrite each other. Repeated requests do not create duplicate revisions.
- Late model responses remain bound to their original source/base and are shown as stale when necessary.
- Timeout, 429, invalid schema/evidence and unavailable model preserve saved work with manual recovery.
- Integer USD cents, distinct fee/ticket values, DST-aware New York conversion; ambiguous/nonexistent local times require resolution. Never infer an absent year or overnight date.
- Public allowlist excludes private sources, compensation, payment details and personal contact data.
- Fresh-browser judge path has isolated synthetic data, quotas and a tested reset path.

### User-value validation

Agent prepares scenarios, interview script and timer/results sheet. User may voluntarily invite 2–3 musicians; no automatic outreach or need for real private messages. Permission-cleared reconstructed cases suffice.

Compare equivalent cases using normal messenger/template or general chatbot versus JazzLink; rotate case order. Include import, review, correction and retries in active time. Separately record counterparty effort, waiting and model time; track missed terms and false confirmations.

The **30% target now applies only to change review, clarification questions and a reviewed terms sheet**, not the former contract/signing/PDF/poster journey.
Reduction = (baseline active seconds - product active seconds) / baseline active seconds.
Quality must not regress. Report participant-level results and sample limits. Without human tests, report synthetic evaluation only, not proven time savings or demand.

## 8. Cut rules and risks

| Checkpoint | If failing | Action |
| --- | --- | --- |
| Oct 28 night | Real extraction → edit → persistence fails | Drop screenshot and print/export embellishments; fix core |
| Oct 30 night | Two-account authorization/version path unreliable | Personal review only; remove bilateral claims |
| Oct 31 | Screenshot evidence inaccurate or unhelpful | Text-only; do not add another unverified modality |
| Nov 1 night | Proposals repeatedly become established facts | Narrow fields/input; require human status selection; disclose weaker automation |
| Nov 2 night | Core path works | Feature freeze; defects, evaluation and recording only |
| Nov 3 | Video/access/reproduction incomplete | Stop enhancements and finish submission package |

Do not add a job platform for already-deferred features. Start with bounded request/response processing. If measured latency is unsuitable, shorten input or explicitly redesign execution; a database status row/background Promise is not a durable queue.

Keep within existing credits and quotas with request limits, per-user quotas and a shared inference budget. No paid plan, subscription or spend beyond granted credits without an explicit cost decision.

## 9. Submission

User-supplied planning deadline: Nov 4, 2026 21:00 America/New_York = Nov 5 11:00 KST. Internal completion target: Nov 4 22:00 KST. Official portal is authoritative.

Three-minute story: original terms → request → evidence-linked pending changes → questions → reviewed reply → new revision/card → stale-action rejection → actual results and limits.

Prepare:
- Public repo, development history, HACKATHON.md separating event work from earlier JazzLink.
- Live isolated synthetic demo with fresh-browser access and clear fallback instructions.
- Accessible three-minute video; label synthetic data and cached/replayed sections.
- README covering implemented/deferred scope, run steps, actual model use and evaluation.
- Asset/data permission record and non-legal-product limitations.
- Draft submission fields; verify exact portal requirements and idea-change rules when accessible. Do not claim the full Official Rules were read from an excerpt.

Final submission and external messaging/posting remain user-reviewed. Never claim unsupported novelty, legal effect, New York demand or time savings.

## 10. Actual status and next action

Implemented: text-review UI, Meta adapter, authenticated private drafts, immutable personal review snapshots, change comparison, carry-forward controls, public-card output and an explicitly prewritten offline demo. Relevant migrations are applied to the new Supabase project.
Verified: one synthetic production extraction, authenticated save/reload and personal review, and a sequential stale-write rejection in two tabs. A later synthetic change probe returned `model_not_found`, so repeatable model availability and change interpretation remain unverified.
Remaining: two-user HTTP isolation and actual concurrent writes, gated participant acknowledgement if feasible, authenticated output flow, model evaluation, user study and submission materials. None is a verified outcome yet.
Helpful later: focused hours available, voluntary access to 2–3 musicians, any portal clause restricting idea changes. Never request credential values in chat.

Next milestone: **reliable change review and negative authorization checks**, followed by measured evaluation and judge-ready submission evidence.
