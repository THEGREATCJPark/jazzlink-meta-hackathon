# Account and environment status

Updated 2026-10-27. States below distinguish actual observations from user reports and do not imply continued availability.

## Observed state

| Service | Recorded state | Still requires application verification |
| --- | --- | --- |
| GitHub | New repository THEGREATCJPark/jazzlink-meta-hackathon, Actions MODEL_API_KEY secret and offline CI | Fresh public-access and submission access checks |
| Vercel | metacj/jazzlink-meta-hackathon, Hobby, GitHub main linkage and production deployment. One synthetic authenticated runtime request succeeded. | Reliability of current model access, current quota/limits and fresh judge access |
| Supabase | New US East project inlotwlppvrscyjncbbb; private-draft, quota, reviewed-snapshot, canonical-money and review-evidence migrations applied. One test account saved, reloaded and reviewed a draft. | Actual HTTP/browser isolation between different accounts and simultaneous writers |
| Meta | A 1.3 simple probe and two 1.2 structured requests (one through the production app) previously succeeded. Structured 1.3, and later a 1.2 change-scenario GitHub Actions request, returned `model_not_found`. A subsequent authenticated GitHub Actions catalog request succeeded but returned an empty list; it previously returned model IDs. GitHub Actions and Vercel use independent secret stores. | Account/model availability in each environment, change-scenario semantics and independent evaluation |

Prototype: https://jazzlink-meta-hackathon.vercel.app

The user reported setting Supabase Auth Site URL to that origin. A test account completed the application's login flow; exact redirect behavior has not been independently tested. Add exact callback redirects only when the selected Auth flow needs them; do not assume broad preview wildcards.

A Vercel connector previously returned 403 while the desktop CLI worked. Use the existing CLI context if needed; do not request repeated connector approval or create a duplicate project. Recheck CLI target/account before changing anything.

## Environment-variable locations

| Name | Placement and recorded status |
| --- | --- |
| MODEL_API_KEY | GitHub Actions Secret and Vercel Production Secret were reported configured; independent stores. Local availability is not assumed. |
| MODEL_API_BASE_URL | Vercel Production config previously set to https://api.meta.ai/v1 |
| META_TEXT_MODEL | Vercel Production config set to muse-spark-1.2; one authenticated runtime request succeeded. A later 1.2 probe failed in GitHub Actions, a separate environment. Current access is unresolved. |
| NEXT_PUBLIC_SUPABASE_URL | Vercel Production config previously set to https://inlotwlppvrscyjncbbb.supabase.co |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Vercel Production config previously set; publishable does not replace RLS/grants |
| SUPABASE_SECRET_KEY | Not required for normal session-scoped operations; not provisioned by this plan |
| APP_URL | Verify need/location during implementation; do not assume configured |
| META_IMAGE_MODEL / META_SEGMENTATION_MODEL | Deferred along with image generation/SAM |

Never output values from an environment inspection. GitHub secrets cannot be read back and do not automatically populate local or Vercel runtime variables. Do not request a key in chat. Local ignored files and production environment configuration must be handled separately.

No Preview Meta secret or isolated Preview database is assumed. Untrusted pull requests must not gain production credentials. Confirm any local development configuration before making a paid request.

## Next checks during implementation

1. Investigate model availability with official documentation and account status before another bounded synthetic provider call; do not loop on `model_not_found`.
2. Continue managing changes as migrations and verify applied history only for the new US East project.
3. Test two unrelated users against routes and direct Data API access, plus simultaneous version conflicts.
4. Add screenshot private storage only after that feature's gate passes.
5. Verify judge access and inference quotas in a fresh browser.

No old Seoul Supabase project or previous JazzLink/Firebase configuration may be altered.

## Cost and user involvement

The user reported $150 Meta credits. A Spend Limit notification is not a guaranteed charge cutoff. Use synthetic data, input/output limits, per-user quotas and a shared call budget. No new paid service or spending beyond credits without a cost decision.

One synthetic end-to-end app path worked, but model availability, multi-user isolation and submission readiness remain unverified. Ask for user action only when an actual login, approval or missing configuration blocks progress, giving the exact page and field names. Never request secrets/passwords/OTP in chat.

No Baseten, Instagram, email-delivery, payment, e-signature, image-processing or durable-runner account is required for the narrowed core.
