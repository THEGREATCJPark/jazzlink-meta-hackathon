# Source-grounded gig review evaluation — v1

Status: **prepared, not run**. The cases are fictional, authored for this repository, and are not proof of accuracy, time savings, user demand or legal effect. No bulk live call has been made or enabled by this document.

## Fixed holdout

The frozen dataset is [evaluation-v1.json](../tests/fixtures/evaluation-v1.json): eight change/conflict cases C01–C08 and four normal controls N01–N04. Each case has source text, required observations, forbidden assertions and example source excerpts. Expected excerpts are labels for manual assessment, not additional text to send to a model.

Coverage includes missing year/payment, changes and partial acceptance, withdrawal, fee/ticket distinction, an old quoted offer, date conflict, instruction-like source text, explicitly zero ticket price and ordinary missing information. The dates, venue and messages are synthetic.

Do not use this set to tune prompts during implementation; use separate development examples. If these cases are used to change the model or prompt, they cease to be an independent holdout for that iteration. Preserve the v1 result, create a new separately held-out version and disclose the change. This tiny set cannot establish safety or production-grade accuracy.

## Procedure when an authorized evaluation is run

1. Fix the app revision, model ID, provider request settings, input limits, dataset version and a strict request/token budget beforehand. Log settings without credentials or raw private information.
2. Use the exact source text for one case per invocation. Do not include expected observations, forbidden assertions or evaluation guidance in the model's input. No automatic retry; count any separate manual retry as a separate paid request and keep the first outcome.
3. Preserve each case's first outcome, completion/failure/timeout, evidence shown, duration and reported usage. Invalid output, budget exhaustion and skipped cases remain visible; never silently remove them from the denominator. Stop on authentication, billing or unexpected repeated errors.
4. A human evaluates every required observation and forbidden assertion against the source and the app's displayed result. Quote occurrence is necessary, but a real quote alone does not establish that it supports a model conclusion. Pasted speaker labels do not verify the real speaker or in-app acknowledgement.
5. For each C case, mark the case successful only if **all** its mustDetect observations are surfaced and no mustNotAssert item is presented as established. A failure, invalid result or unrun case is not a success.
6. For each N control, note any critical warning that asserts a conflict where none is supported; count the number of control cases with such a warning. Separately document ordinary missing-field questions, which are not by themselves critical false warnings.
7. Check deterministic app state separately: feed deliberately wrong and proposed candidates into the review flow and demonstrate that the reviewed snapshot cannot be overwritten automatically. A model-only response cannot prove this property.
8. Record the numerator and denominator, all failures, errors and limitations. Never call a test pass a real customer validation or a legal conclusion.

## Manual provider-adapter run: one case

For a separate contextual connectivity diagnostic, a trusted operator can run `powershell -NoProfile -File .\scripts\meta-context-diagnostic.ps1` from the repository root and enter an existing Meta key at the masked local prompt. The script makes one catalog request; only if the exact entered model ID appears does it make one synthetic contextual adapter call, with no retry and at most 1,800 output tokens. It does not access the app route, database or application quota. Output requires human review and is not a holdout score. The key is kept in process memory rather than arguments or files. The operator must independently know whether the key is the production key: Vercel Production Secrets cannot be read back through the local CLI, and a separate GitHub key does not establish production access. This diagnostic has not been run.

The separately dispatched GitHub Actions workflow **Meta holdout — one selected case** performs at most one provider request per invocation. It is not run by push, pull requests or default CI, and preparing the workflow did not run any case.

1. Ensure the workflow is present on the repository's default branch. In GitHub, open **Actions → Meta holdout — one selected case → Run workflow**.
2. Choose the exact branch/ref whose code and fixture have been frozen. Choose a model ID and exactly one case ID. Confirm the existing GitHub Actions secret named `MODEL_API_KEY` is configured; GitHub and Vercel environment variables are separate stores. Never print or share the secret.
3. Run the workflow once. The script verifies the canonical JSON digest of the frozen dataset, selects only that case's fictional `source` from `evaluation-v1.json`, and sends it to the application Meta adapter. The expected observations, forbidden assertions and evidence labels are **not sent**. If the dataset changed, the run fails before any request; create a new held-out version for a changed dataset. For a valid configuration the adapter is invoked once with no automatic retry; a preflight or missing-key failure may result in zero actual network requests.
4. Open that run and download its `jazzlink-holdout-<run id>-<attempt>` artifact, if available. `result.json` records the case ID, requested model, Git revision, run identity, start/end, elapsed time, adapter invocation count, sanitized provider status/usage when returned, error kind and the validated synthetic response. `humanScoring: not_started` and `response_received` mean only that a response passed structural/source checks, **not** that the case or evaluation passed. The model's reported tokens may be unavailable on an error or timeout.
5. A human compares the returned candidates, statuses, quotes and questions with that case's saved labels and the app's display. Record the first attempt and every failure. Any later diagnostic run is a separate paid attempt and must not replace the first result. Only grade the 12-case gate after all outcomes and the independent state test are recorded.

The adapter caps output at 1,800 tokens and times out after 45 seconds; use a fixed overall request/token budget and stop for access, billing or repeated errors. This GitHub path uses the Actions secret and **does not consume or enforce the app's Supabase daily request counters**. Account for it separately. It exercises provider extraction and validation, not the app's login, RLS, persistence, UI, concurrency or end-to-end user journey.

The result file is written before the request and updated for response, failure or an observed interruption. Artifact upload is best effort even on failure; a runner killed before setup, forced termination or artifact service failure can leave no artifact, so preserve the GitHub run status and logs as evidence. Artifacts expire after seven days. Outputs that contain the configured key or credential-like text are withheld entirely and marked `output_withheld`; such a case has no scoreable response. Error messages and secret values are not written to the artifact. Keep results synthetic and do not treat artifact retention as permanent archival.

## Predeclared exploratory gates

These are development targets defined before a run, not measured performance or guarantees:

- Zero unsupported critical date, money or agreement assertions presented as established.
- At least 7 of 8 C cases successful under the all-observations rule above.
- At most 1 of 4 N cases with an unsupported critical conflict warning.
- Zero automatic overwrites of reviewed snapshots, including with intentionally incorrect model output.

All 12 outcomes and the separate state test must be available before saying the entire gate passed. If some are skipped, the result is incomplete regardless of the observed fraction. Explain where the system displays a candidate rather than concluding the candidate is an established fact.

## Result record template

Keep evaluation artifacts synthetic; redact credentials and other sensitive data. Save actual results separately with date, commit, dataset version, model/config, total calls, request IDs if safe, tokens/cost where available, per-case outcomes, unsupported assertions, missing observations, false warnings, response latency, errors and retries. Report both first-attempt and any later diagnostic results. Do not add a completed result until observed.

Example format: `C01 — not run — no result`. This is a status marker, not a prediction.

## User-time study is separate

The 30% target is an unmeasured hypothesis about active time for change review, clarification questions and a reviewed terms sheet, at equivalent quality. A synthetic model-evaluation gate does not measure it. Follow the separate comparison protocol in [PLAN.md](PLAN.md), including input/review/correction time and small-sample limits.
