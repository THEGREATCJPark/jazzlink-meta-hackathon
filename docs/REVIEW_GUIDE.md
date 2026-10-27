# Review guide — JazzLink AI

Last updated: 2026-10-27. Code and test baseline: [`07c2d64`](https://github.com/THEGREATCJPark/jazzlink-meta-hackathon/commit/07c2d64dc1ec7d444807829c7970f7f5b78e99df). This is an early preview for feedback, not a submission or a production-ready agreement service. The [plan](PLAN.md) records the intended scope; this guide summarizes what exists and what has actually been checked.

## What to review

JazzLink helps a bandleader inspect gig details and proposed changes against pasted source text, then prepare questions for the existing conversation. It does not send messages. A personal review records the musician's action only; a source quote, model interpretation, or selected value is not counterparty approval or a legal signature.

- [Workspace](../src/app/page.tsx) and [change comparison](../src/components/ChangeReview.tsx): source-backed candidates, edits, questions, earlier personal review and explicit selections. Saved-draft analysis uses server-loaded context and rejects detected stale versions; the model does not automatically replace a reviewed snapshot.
- [Server extraction](../src/server/extraction-handler.ts), [context authorization](../src/server/prior-context.ts) and [Meta adapter](../src/server/meta.ts): authenticated, quota-bounded calls and source-quote validation. Quote occurrence is a structural check, not semantic proof.
- [Private draft and review routes](../src/app/api/) and [database migrations](../supabase/migrations/): owner checks, row-level security, version checks and immutable personal snapshots. Review the [security test limits](DB_SECURITY_TESTS.md) before drawing conclusions about isolation.
- [Public card projection](../src/domain/public-card.ts) and [card UI](../src/components/PublicTermsCard.tsx): explicit public fields and local preview/download; private fee and source messages are excluded. Preview is not publication.
- [Fictional interactive demo](https://jazzlink-meta-hackathon.vercel.app/demo): no account, no AI call, no persistence. Its results and reply are prewritten; reload clears choices.

The English/Korean terms-sheet target and two-participant acknowledgement are not complete. Legal contracts, e-signatures, signed PDFs, AI posters and SAM are deferred. A saved personal review may still contain unresolved conditions.

## Evidence and limits

| Observation | What it establishes | What it does not establish |
| --- | --- | --- |
| [Offline CI at the code baseline](https://github.com/THEGREATCJPark/jazzlink-meta-hackathon/actions/runs/40459502692) passed; local run passed 70 Node tests and 6 mocked UI tests, lint and build. | Deterministic code and mocked interactions passed on that revision. | Browser layout, real multi-user isolation, model accuracy or user value. |
| An authenticated synthetic production example was analyzed, saved, reopened and personally reviewed; a sequential stale update in a second tab was rejected. | One earlier single-account path and stale-write check worked. | Simultaneous writers, two-user HTTP isolation, or the latest contextual model path. |
| [GitHub catalog run](https://github.com/THEGREATCJPark/jazzlink-meta-hackathon/actions/runs/40460071887) returned nine models including `muse-spark-1.3` and `muse-spark-1.2`. [One basic structured adapter run](https://github.com/THEGREATCJPark/jazzlink-meta-hackathon/actions/runs/40460130677) using 1.3 completed in 4.37 seconds with 507 input and 670 output tokens, three candidates and one question. The $900 fee was a **proposed** candidate; exact-source validation passed. | One synthetic direct-adapter request using the GitHub Actions credential returned a structurally valid result. | Contextual change interpretation, application-route or Vercel access, accuracy, reliability, or a holdout score. |
| Earlier GitHub structured 1.3 and change-scenario 1.2 requests returned `model_not_found`, and a later catalog returned an empty array before the successful catalog above. One earlier 1.2 production inference succeeded. | Availability has varied in observed runs; the cause remains unknown. | That GitHub and Vercel credentials are identical or that either environment is currently reliable. |

The [12-case holdout](EVALUATION.md) is prepared, **not run**. No human time study has established the 30% target or market demand. Current browser desktop/mobile layout, real two-user HTTP isolation, simultaneous writes, and live contextual inference remain unverified. Manual test harnesses are documented, but have not been run. No legal certification or agreement is claimed.

## Feedback that would be useful

1. **Product:** Is source-backed change review and question preparation a compelling, focused problem for bandleaders? What is missing from the proposed workflow?
2. **Semantics:** Do the data model and UI keep proposals, uncertainty, human edits, personal review and counterparty acknowledgement distinct? Where could a user mistake a quote for proof of meaning?
3. **Architecture and security:** Are owner authorization, RLS, stale-version handling, quota limits and public-field allowlisting sufficient for the intended preview? What tests should precede broader use?
4. **Evaluation:** Do the holdout and user-study protocols measure the claimed value and failure modes? What should change before results are collected?
5. **Scope:** Which missing feature or risk is most important to address before a hackathon submission?

The repository is enough for a useful review of scope, implementation, architecture, and planned evaluation. A reviewer needs to use the application and observe real participants to assess usability and value; live provider and independent multi-user tests are needed to assess those behaviors. The no-AI demo can illustrate the flow, but cannot establish AI quality.
