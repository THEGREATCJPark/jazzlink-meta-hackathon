# Three-minute demo storyboard — draft, not recorded

Last grounded in the README and code around commit 0d45163 on 2026-10-27. This is a production plan, not evidence that the video was made, the project submitted, or Meta access is currently reliable. Recheck all statements against the exact submission commit and actual recording before using them.

## Story and evidence boundary

Audience: a bandleader reviewing a fictional gig whose requested schedule changes. The central demonstration is that a request remains a request, the prior personal review stays visible, and a human chooses which stated details to carry forward.

Blue Alley, the musician, gig and all dialogue are fictional. The user's experience of scattered gig coordination is in Korea; do not describe the New York example as a real personally experienced event or an actual customer.

There are two distinct experiences:

- **Signed-in workspace, `/`**: can make an actual server-side Meta request for source-backed candidates when model access works. A synthetic production inference with muse-spark-1.2 previously succeeded and a test account saved/reopened/personally reviewed a draft. A later change-scenario request in GitHub Actions returned `model_not_found`; production and GitHub use separate credentials. Reliable model access and the model's interpretation of that later scenario are not established.
- **Interactive `/demo`**: prewritten fictional inputs and results, running in browser memory without a model request or persistence. It demonstrates interface choices and deterministic behavior, not model inference, real conversation, authenticated saving or server-backed revision history. Reloading clears it.

Do not transition between the two without a prominent on-screen label. A prepared fictional reply is not a live counterparty response. A personally reviewed snapshot is not bilateral consent, identity verification, a legal agreement or signature. The public card is a deterministic local download, not an AI-generated poster or automatically published content.

## Recommended timeline: 180 seconds total

| Time | Picture and action | Suggested narration and on-screen evidence |
| --- | --- | --- |
| 0:00–0:15 | Show the fictional Blue Alley original terms alongside the new request. | “A gig changes from two sets to a request for an extra set. What is still unknown?” Add **Fictional scenario**. |
| 0:15–0:35 | In the signed-in workspace, submit a short fictional conversation to the real Meta-backed endpoint **only if the connection works during filming**. Show the input and real returned items. | “These are model suggestions linked to the supplied text; a person still reviews them.” Label **Live Meta request** and show the actual model ID only if verified for this request. Do not display credentials or personal account information. |
| 0:35–0:55 | Inspect a returned quote, identify a missing field, and edit/select a value when supported by the actual response. | “The original message remains visible, and missing information stays open.” Display what really happened, including any incorrect interpretation. A matching quote does not prove the interpretation is correct. |
| 0:55–1:25 | Switch visibly to `/demo`: show the new 21:00 / extra-set request, previous values, pending new fee and suggested clarification questions. | **Prewritten interactive example · no AI request.** “A request alone does not replace the previous review. The schedule and new total fee need clarification.” No message is sent. |
| 1:25–1:50 | Open the fictional reply, choose the explicit three-set schedule and fee, then tick the personal-review confirmation. | “The musician can review the supplied response and choose what to carry forward. This is a personal demo review, not the venue’s approval.” Payment date remains unknown. |
| 1:50–2:10 | Show the comparison and public-card preview; explicitly check the public fields. | “The card uses selected public performance details; the fee and private messages stay out.” Label **Deterministic card · local download**, and demonstrate a download only if it works during recording. |
| 2:10–2:35 | Show real event-built source files and git history: workspace/adapter, revision routes or migrations, and the fictional demo. | “This separate repository and these features were built during the hackathon. The earlier JazzLink project is background.” Show actual commit/date and the source path; do not imply git timestamps alone independently prove asset authorship. |
| 2:35–3:00 | Show concise limitations and reproducible demo/repository links; if available, display actual past run metadata as historical evidence. | “Model access has been inconsistent; this demo contains a prewritten segment. Two-party approval and legal signing are not implemented. Accuracy and time savings are not yet measured.” Show live and historical evidence separately. |

This timeline is a draft. If a real model response is slow, capture the actual wait and state any edit or cut; do not make a recorded or prewritten response appear live. Record the actual session date, provider, model ID, outcome and source scenario if showing a live inference.

## If the model fails during filming

1. Do not repeat paid calls indefinitely or switch to an unverified model to make the video look successful. Preserve and show a concise genuine error/recovery path when safe. Remove any secret, email or other private account data from the image.
2. Continue with `/demo`, visibly labeled **Fictional, prewritten, no AI request; browser memory only**. Show the request, questions, choice and deterministic card. Do not describe those outputs as produced by Meta.
3. Only if an actual historical successful run's safe metadata, logs or legitimately recorded footage is available, show it separately as **Earlier successful synthetic Meta call**, including date, model, source scenario and result/status supported by the evidence. A metadata-only success is not visual proof that the change-request scenario or its interpretation passed. Never fabricate the output or imply a past run occurred live.
4. Explain that the later documented change-scenario probe failed with `model_not_found` and that the environments use separate credential stores. If no safe historical evidence can be shown, say only what can be substantiated and link the code/report; do not simulate an API success.
5. Check the participant portal's current requirements and actual Meta-use evidence before final submission. A mock-only segment or old success by itself should not be represented as proof of a working live Meta integration or a guaranteed pass under the rules.

## Prohibited claims and representation

- No unmeasured model-accuracy percentage, 30% time reduction, customer number, user demand, revenue, competitor superiority or legal-compliance claim.
- Do not say both parties agreed, acknowledged the same version, signed or authenticated their real-world identity. The current tested path records one account's review.
- Do not present `/demo` as saved across sessions, as an actual Meta response, or as evidence that the signed-in app's persistence and security work.
- Do not claim SAM, Muse Image, signed PDF, performance matching, autonomous outreach or automatic posting were implemented.
- Do not show actual private messages/contracts, credentials, personal contact details, participant-only pages or unlicensed assets. Synthetic information and authorized content only.
- Clearly identify cuts, previously recorded footage and any replay; never present them as a continuous live run. Do not show an error-free result when the recorded run failed.

## Before the video is finalized — all pending

- [ ] Verify current portal rules, exact submission fields, three-minute requirement and links, and confirm how the demo identifies event-built work.
- [ ] Check the actual public repository and submission commit; update [HACKATHON.md](../HACKATHON.md) and the README to match observed features and tests.
- [ ] Test the exact production paths and account access in a fresh browser; record what actually works and any Meta outage.
- [ ] Confirm whether saved personal reviews, browser reload, card download and stale-action protection shown in the final cut have been tested on that exact deployment. Do not substitute a mocked test for a live demonstration.
- [ ] Verify all factual narration, model names, UI labels, synthetic data and third-party asset permissions. Include limitations on-screen long enough to read.
- [ ] Capture separately labeled live, prior recorded and prewritten content; inspect the final cut for accidental secrets or identifying account information.
- [ ] Check runtime is at most three minutes, audio/captions are legible, video link is accessible and a fresh viewer can follow the product.
- [ ] Review the final video and submission with the user before submission or any external post. No video recording or posting has been performed for this storyboard.
