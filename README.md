# JazzLink AI — NYC Hackathon Edition

A new application for bandleaders: review gig conditions against their source messages, distinguish requests from reviewed terms, and identify what needs clarification when a gig changes. New York is the fictional demo setting; customer demand there is not yet validated.

## Product direction
- **Vision:** less administrative work, more time for music and audiences.
- **Strategy:** inspect source-backed terms and changes, prepare clarification questions, and review replies while keeping negotiation in the existing messenger.
- **Proposed target product:** conversation → evidence review → unresolved changes/questions → human-reviewed revision → English terms sheet, Korean reference and public information card. Two-account acknowledgement is a gated delivery target, not legal e-signing.
- **Deferred:** legal contract generation, e-signatures, signed PDFs, AI posters, SAM and general management features.
- **Validation target:** at least 30% less active work for change review, clarification and a reviewed terms sheet, at equivalent quality. This is a narrowed measurement scope and has **not been measured or achieved**. See [the plan](docs/PLAN.md).

## Status
The early preview contains a text-review workspace, Meta extraction adapter, authenticated private drafts, personal reviewed snapshots, comparison, a deterministic public card and a clearly labeled no-AI fictional example. A synthetic example was analyzed, saved, reopened and personally reviewed with a real test account; a sequential stale update in a second tab was rejected. Participant acknowledgement and second-user HTTP isolation are not implemented or verified. New review snapshots also receive database checks for source quote and earlier-review links; see [architecture](docs/ARCHITECTURE.md) for their limits.

## Scope and precedence
Latest user instructions take precedence over earlier planning documents:
- Build from scratch in this repository.
- Existing JazzLink is conceptual reference only; do not copy its code, database, credentials, deployment, or Firebase architecture.
- English-first, USD, America/New_York. Korean reference to the same reviewed terms remains in the proposed scope.
- Choose infrastructure for this submission rather than compatibility with the old app.

## Initial architecture
Next.js + TypeScript; Supabase Postgres/Auth/Storage; Vercel.
The Meta adapter runs on the server with bounded text requests; no background job service, image generation or PDF pipeline is required for the narrowed core.

## Documents
- [Product and delivery plan](docs/PLAN.md)
- [Architecture decision](docs/ARCHITECTURE.md)
- [Account and secret setup](docs/SETUP.md)
- [Synthetic model evaluation](docs/EVALUATION.md)
- [Database security regression checks](docs/DB_SECURITY_TESTS.md)
- [Hackathon contribution record](HACKATHON.md)
- [User study plan](docs/USER_STUDY.md)
- [Three-minute demo storyboard](docs/DEMO_STORYBOARD.md)
- [Agent instructions](AGENTS.md)

## Milestones
1. Source-backed text extraction, human correction and authenticated save/reload.
2. Pending proposals, clarification replies and immutable reviewed revisions.
3. Revision-specific acknowledgement if its delivery gate passes.
4. Consistent terms sheets and deterministic public information cards.
5. Failure/permission checks, evaluation, three-minute demo and submission preparation.

Only synthetic or explicitly authorized assets may enter this public repository. No API keys, signed contracts, addresses, private emails, or participant-only materials.

## Current prototype

The workspace can submit synthetic text for source-backed AI suggestions and save private drafts for authenticated accounts. A saved draft or personal review is not an agreement. One production inference succeeded with muse-spark-1.2, but a later bounded GitHub Actions change-scenario probe using the same model ID returned `model_not_found`, and a subsequent read-only catalog request returned an empty model list. The two environments store their credentials separately. Reliable access and that scenario's interpretation are not established. A structured muse-spark-1.3 request also returned `model_not_found`. Manual review remains available when extraction fails. Do not use this preview for actual agreements or private contracts.

The [interactive fictional demo](https://jazzlink-meta-hackathon.vercel.app/demo) requires no account and runs in browser memory. Its responses are prewritten; it does not make an AI request or persist data.

Requires Node.js 22. Install with `npm ci`, start with `npm run dev`, and verify with `npm run lint`, `npm test`, and `npm run build`. The default CI is offline and does not access secrets.

A separately triggered `Meta API connection check` workflow makes exactly one synthetic request using the existing GitHub Actions secret `MODEL_API_KEY`. The operator must enter a model ID available to the account; the workflow reports metadata and status, not the key or response text. GitHub Actions secrets are not available to local development or Vercel. A past simple muse-spark-1.3 probe succeeded; it does not establish current model access.

The separately triggered `Meta structured extraction check` runs one synthetic request through the application adapter. It is manual, uses the Actions secret and reports only non-sensitive metadata; its result must be checked independently. A change-request probe most recently failed with `model_not_found` before producing model output. It is not part of ordinary CI.


