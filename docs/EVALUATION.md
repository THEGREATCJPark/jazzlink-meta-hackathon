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
