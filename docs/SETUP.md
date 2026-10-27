# Account and environment status

Updated for planning on 2026-10-27. Account facts below are **previous-session observations or user reports**, not a new live account audit. This planning session changed no account, credential, database or deployment.

## Previously observed

| Service | Recorded state | Still requires application verification |
| --- | --- | --- |
| GitHub | New repository THEGREATCJPark/jazzlink-meta-hackathon, Actions MODEL_API_KEY secret and offline CI | Fresh public-access and submission access checks |
| Vercel | metacj/jazzlink-meta-hackathon, Hobby, GitHub main linkage and prototype deployment | Runtime Meta request, authenticated app flow, current quota/limits |
| Supabase | New US East project inlotwlppvrscyjncbbb; private-draft and quota migrations applied | Auth and actual HTTP/browser user isolation |
| Meta | Standalone muse-spark-1.3 probe completed with nonempty text; 14 input / 18 output tokens | Structured extraction in app, cost controls and semantic evaluation |

Prototype: https://jazzlink-meta-hackathon.vercel.app

The user reported setting Supabase Auth Site URL to that origin. It has not been independently exercised through the application's authentication flow. Add exact callback redirects only when the selected Auth flow needs them; do not assume broad preview wildcards.

A Vercel connector previously returned 403 while the desktop CLI worked. Use the existing CLI context if needed; do not request repeated connector approval or create a duplicate project. Recheck CLI target/account before changing anything.

## Environment-variable locations

| Name | Placement and recorded status |
| --- | --- |
| MODEL_API_KEY | GitHub Actions Secret and Vercel Production Secret were reported configured; independent stores. Local availability is not assumed. |
| MODEL_API_BASE_URL | Vercel Production config previously set to https://api.meta.ai/v1 |
| META_TEXT_MODEL | Vercel Production config previously set to muse-spark-1.3 |
| NEXT_PUBLIC_SUPABASE_URL | Vercel Production config previously set to https://inlotwlppvrscyjncbbb.supabase.co |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Vercel Production config previously set; publishable does not replace RLS/grants |
| SUPABASE_SECRET_KEY | Not required for normal session-scoped operations; not provisioned by this plan |
| APP_URL | Verify need/location during implementation; do not assume configured |
| META_IMAGE_MODEL / META_SEGMENTATION_MODEL | Deferred along with image generation/SAM |

Never output values from an environment inspection. GitHub secrets cannot be read back and do not automatically populate local or Vercel runtime variables. Do not request a key in chat. Local ignored files and production environment configuration must be handled separately.

No Preview Meta secret or isolated Preview database is assumed. Untrusted pull requests must not gain production credentials. Confirm any local development configuration before making a paid request.

## Next checks during implementation

1. Verify current Vercel CLI target and environment-variable names, not values.
2. Read current Meta protocol and run one bounded synthetic application probe.
3. Continue managing changes as migrations and verify applied history only for the new US East project.
4. Configure the selected Auth flow and test two unrelated users against routes and direct Data API access.
5. Add screenshot private storage only after that feature's gate passes.
6. Verify judge access and inference quotas in a fresh browser.

No old Seoul Supabase project or previous JazzLink/Firebase configuration may be altered.

## Cost and user involvement

The user reported $150 Meta credits. A Spend Limit notification is not a guaranteed charge cutoff. Use synthetic data, input/output limits, per-user quotas and a shared call budget. No new paid service or spending beyond credits without a cost decision.

Account setup is sufficient to prepare the text-first implementation, but application readiness is not yet verified. Ask for user action only when an actual login, approval or missing configuration blocks progress, giving the exact page and field names. Never request secrets/passwords/OTP in chat.

No Baseten, Instagram, email-delivery, payment, e-signature, image-processing or durable-runner account is required for the narrowed core.
