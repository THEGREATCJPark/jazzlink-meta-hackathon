# JazzLink AI — NYC Hackathon Edition

A new application for NYC venue operators and musicians: turn agreed gig details into consistent contracts, signatures, posters, and reviewed event listings.

## Status
Planning/bootstrap only. No working app, deployment, API integration, or passing product tests is claimed yet.

## Scope and precedence
Latest user instructions take precedence over earlier planning documents:
- Build from scratch in this repository.
- Existing JazzLink is conceptual reference only; do not copy its code, database, credentials, deployment, or Firebase architecture.
- English-first, USD, America/New_York. Korean contract reference remains in scope.
- Choose infrastructure for this submission rather than compatibility with the old app.

## Initial architecture
Next.js + TypeScript; Supabase Postgres/Auth/Storage; Vercel.
Meta providers run on the server. Image/PDF jobs persist status and input revision. Durable execution selection is a first-integration gate, not an implemented capability.

## Documents
- [Product and delivery plan](docs/PLAN.md)
- [Architecture decision](docs/ARCHITECTURE.md)
- [Account and secret setup](docs/SETUP.md)
- [Agent instructions](AGENTS.md)

## Milestones
1. Accounts, verified provider calls, schema and deployment smoke check.
2. Gig extraction and clarification.
3. Versioned contracts, authenticated two-party signing, PDF.
4. Poster production with deterministic text.
5. End-to-end verification, demo recording and submission.

Only synthetic or explicitly authorized assets may enter this public repository. No API keys, signed contracts, addresses, private emails, or participant-only materials.
