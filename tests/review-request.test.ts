import { test } from "node:test";
import assert from "node:assert/strict";
import { readReviewRequest } from "../src/server/supabase/review-request.ts";

const valid = { draftId: "11111111-1111-4111-8111-111111111111", expectedVersion: 1,
  requestId: "22222222-2222-4222-8222-222222222222", confirmReview: true };
function request(body: unknown) {
  return new Request("http://localhost/api/revisions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("requires explicit review of a specific saved version and request ID", async () => {
  assert.deepEqual(await readReviewRequest(request(valid)), valid);
  assert.equal(await readReviewRequest(request({ ...valid, confirmReview: false })), null);
  assert.equal(await readReviewRequest(request({ ...valid, expectedVersion: 0 })), null);
  assert.equal(await readReviewRequest(request({ ...valid, requestId: "invalid" })), null);
});

test("rejects caller-supplied actor or snapshot fields", async () => {
  assert.equal(await readReviewRequest(request({ ...valid, reviewedBy: "other-user" })), null);
  assert.equal(await readReviewRequest(request({ ...valid, draft: { fee: 0 } })), null);
});

test("rejects oversized input even when no content-length is declared", async () => {
  assert.equal(await readReviewRequest(request({ ...valid, extra: "x".repeat(4096) })), null);
});
