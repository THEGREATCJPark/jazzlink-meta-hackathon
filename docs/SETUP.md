# Setup checklist
No credentials have been received, tested or deployed.

## 1. Meta
Create a project-scoped Model API key and confirm credit balance/access.
GitHub: Settings -> Secrets and variables -> Actions -> New repository secret:
MODEL_API_KEY
For runtime, add the same key under the deployment project's server environment variables.
GitHub secrets are not automatically available in Vercel or this assistant's shell.
Only a future manually triggered live-check workflow may use this key; ordinary pull requests must not receive it.
Do not paste key values into chat or commit them.

## 2. Supabase
Create a NEW project for this repository; choose an available US East region.
Keep the generated database password in your password manager. Do not send it.
From Project Settings/API configuration obtain:
- NEXT_PUBLIC_SUPABASE_URL: project URL (public configuration).
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable key, browser-safe only with correct RLS.
- SUPABASE_SECRET_KEY: privileged server-only key; never public.
Configure these in Vercel after the project is linked. Do not add a database password or broad account token to Actions now.
SQL migrations will initially be supplied for execution in the Supabase dashboard. Automate only when needed with scoped credentials.
Do not create production users or upload real contracts yet.

## 3. Vercel
Have a Vercel account ready. After application bootstrap, import this repository and use Next.js detection.
Add MODEL_API_KEY and the three Supabase variables above.
Provide only the project/deployment URL back in chat.
Git integration avoids requiring a VERCEL_TOKEN in GitHub Actions for the initial deployment.
Preview environments must use isolated demo data; no production credentials for untrusted PRs.

## 4. Non-secret model configuration
MODEL_API_BASE_URL, META_TEXT_MODEL, META_IMAGE_MODEL, META_SEGMENTATION_MODEL are set after official protocol/model verification.
APP_URL is set to the verified deployment origin.
Default locale en-US, currency USD, timezone America/New_York.
Do not invent model IDs from promotional names.

## 5. Deferred credentials
BASETEN_API_KEY: only if P1 is enabled.
Instagram credentials: only after owned-account integration is selected.
Durable runner credentials: only after latency/recovery gate.
No Firebase, OpenAI, Google Maps, email-delivery, payment or e-signature SaaS key is currently requested.
P0 signing uses authenticated demo parties; do not claim independent certified identity verification.

## 6. Reply with status, never values
- Meta key saved in GitHub: yes/no; credits visible: yes/no.
- Supabase project ready: yes/no; project URL.
- Vercel account ready: yes/no.
- Maximum extra spend beyond existing credits.
- Participant-only submission requirements, excluding personal/authentication data.

Synthetic fixtures can be prepared without user assets. No paid calls until budget/access are resolved.
