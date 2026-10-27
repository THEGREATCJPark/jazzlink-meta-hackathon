import { test } from "node:test";
import assert from "node:assert/strict";
import { ContextError, loadPriorContext, parseContext, type ContextRepository } from "../src/server/prior-context.ts";

const draftId = "123e4567-e89b-42d3-a456-426614174000";
const request = { draftId, expectedVersion: 4, expectedRevision: 2 };
const source = "Two sets for $900.";
function history() {
  return [{ draft_id: draftId, revision: 2, source_text: source, draft: { review: { source, items: [
    { field: "setCount", value: "2", editedValue: "2", quote: "Two sets", status: "stated", manual: false, edited: false, selected: true },
    { field: "feeCents", value: "90000", editedValue: "900", quote: "$900", status: "proposed", manual: false, edited: true, selected: true },
    { field: "venue", value: "ignored", editedValue: "ignored", quote: "", status: "stated", manual: true, edited: false, selected: false },
  ] } } }];
}
function repo(overrides: Partial<ContextRepository> = {}): ContextRepository {
  return {
    draft: async (owner, id) => { assert.equal(owner, "owner"); assert.equal(id, draftId); return { data: { version: 4 }, error: null }; },
    history: async (owner, id) => { assert.equal(owner, "owner"); assert.equal(id, draftId); return { data: history(), error: null }; },
    ...overrides,
  };
}
const kind = (expected: string) => (error: unknown) => error instanceof ContextError && error.kind === expected;

test("context is owner-scoped, from the latest verified review, and preserves selected edited values", async () => {
  const prior = await loadPriorContext(repo(), "owner", request);
  assert.deepEqual(prior, { revision: 2, selected: [
    { field: "setCount", value: "2", evidence: { kind: "source", quote: "Two sets", edited: false, interpretation: "stated" } },
    { field: "feeCents", value: "90000", evidence: { kind: "source", quote: "$900", edited: true, interpretation: "proposed" } },
  ] });
});

test("missing ownership, stale versions, stale reviews and invalid evidence fail closed", async () => {
  await assert.rejects(loadPriorContext(repo({ draft: async () => ({ data: null, error: null }) }), "owner", request), kind("not_found"));
  await assert.rejects(loadPriorContext(repo(), "owner", { ...request, expectedVersion: 3 }), kind("stale"));
  await assert.rejects(loadPriorContext(repo(), "owner", { ...request, expectedRevision: 1 }), kind("stale"));
  const other = history(); other[0].draft_id = "another-draft";
  await assert.rejects(loadPriorContext(repo({ history: async () => ({ data: other, error: null }) }), "owner", request), kind("invalid"));
  const forged = history(); forged[0].draft.review.items[0].quote = "not in source";
  await assert.rejects(loadPriorContext(repo({ history: async () => ({ data: forged, error: null }) }), "owner", request), kind("invalid"));
  await assert.rejects(loadPriorContext(repo({ history: async () => ({ data: null, error: new Error() }) }), "owner", request), kind("unavailable"));
  await assert.rejects(loadPriorContext(repo({ history: async () => ({ data: null, error: null }) }), "owner", { ...request, expectedRevision: 0 }), kind("unavailable"));
});

test("context input cannot supply a baseline and must have bounded version identifiers", () => {
  assert.deepEqual(parseContext(request), request);
  assert.equal(parseContext({ ...request, baseline: {} }), null);
  assert.deepEqual(parseContext({ ...request, expectedRevision: 0 }), { ...request, expectedRevision: 0 });
  assert.equal(parseContext({ ...request, expectedRevision: -1 }), null);
  assert.equal(parseContext({ ...request, draftId: "other" }), null);
  assert.equal(parseContext(null), null);
});

test("revision zero requires an empty owned history", async () => {
  await assert.rejects(loadPriorContext(repo(), "owner", { ...request, expectedRevision: 0 }), kind("stale"));
  const empty = repo({ history: async () => ({ data: [], error: null }) });
  assert.equal(await loadPriorContext(empty, "owner", { ...request, expectedRevision: 0 }), undefined);
  await assert.rejects(loadPriorContext(empty, "owner", request), kind("stale"));
});

test("oversized evidence is rejected instead of silently dropping context", async () => {
  const rows = history();
  rows[0].source_text = "x".repeat(1001);
  rows[0].draft.review.source = rows[0].source_text;
  rows[0].draft.review.items = [{ field: "venue", value: "x", editedValue: "x", quote: rows[0].source_text, status: "stated", manual: false, edited: false, selected: true }];
  await assert.rejects(loadPriorContext(repo({ history: async () => ({ data: rows, error: null }) }), "owner", request), kind("invalid"));
});
