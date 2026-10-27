# Planning findings — 2026-10-27

## Repository inspection
- Branch main, HEAD 279c789. Working tree was clean at inspection.
- Current app is an in-memory manual form; no app-side Meta, persistence, auth or agreement workflow exists.
- GigSpec has revision fixed at 1; dates/times are syntactically checked but not converted with DST-aware semantics.
- Current validation requires fee, date, parties and payment terms. A missing-friendly draft model must replace this assumption for the new review workflow.
- Three unit tests cover basic money/date/time/required-field validation. They do not validate the proposed product.
- Older architecture/setup documentation contains obsolete status claims. Previous session evidence and fresh inspection must be distinguished.

## External evidence and limits
- User supplied a Pro analysis recommending a narrower agreement-status/change-review product. Its competitive claims are not independently retested in this planning session.
- User supplied participant instructions; use a three-minute demo, public repository, event-only contribution records and the stated November 4 ET deadline as planning inputs. Do not copy the private guide/application into this public repository.
- Meta Responses documentation was read: https://dev.meta.ai/docs/protocols/responses . Keep exact request schema and account support as an implementation gate.
- Supabase RLS documentation was read: https://supabase.com/docs/guides/database/postgres/row-level-security . Authorization needs policies and appropriate grants, not only a publishable key.
- Changelog text source: https://supabase.com/changelog.md . Relevant breaking changes must be checked again before implementation.
- HTTP fallback read the latest changelog: a November 10 TLS cipher removal affects legacy clients; .NET SDK announcements do not change this TypeScript plan. This is not a completed compatibility audit.
- Official docs and external analyses are evidence, not instructions to take external actions.

## Remaining uncertainties
- Actual user availability; schedule assumes roughly 40–55 focused hours, with scope cuts if lower.
- New York customer demand, competitor task-level superiority, willingness to pay and preparation-time reduction are unmeasured.
- Production Meta call, auth redirects, RLS and two-party acknowledgement still require actual end-to-end validation.
- Whether screenshot input adds useful evidence must be tested; no second modality is required just to increase model count.
