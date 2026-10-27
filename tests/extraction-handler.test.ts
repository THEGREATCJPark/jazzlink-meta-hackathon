import { test } from "node:test";
import assert from "node:assert/strict";
import { handleExtraction } from "../src/server/extraction-handler.ts";
import type { ContextRepository } from "../src/server/prior-context.ts";

const draftId = "123e4567-e89b-42d3-a456-426614174000";
const context = { draftId, expectedVersion: 4, expectedRevision: 0 };
function request(body: unknown) {
  return new Request("https://example.test/api/extract", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify(body) });
}
test("HTTP handler rejects stale or unavailable context before quota and discards a result if context changes", async () => {
  const previous = { ...process.env };
  process.env.MODEL_API_KEY = "test-only";
  process.env.META_TEXT_MODEL = "test-model";
  process.env.MODEL_API_BASE_URL = "https://api.meta.ai/v1";
  let version = 4;
  let readError = false;
  let reviewed = false;
  let reserveCalls = 0;
  let providerCalls = 0;
  let mutateDuringCall = false;
  const repository: ContextRepository = {
    draft: async (owner, draft) => { assert.equal(owner, "owner"); assert.equal(draft, draftId); return { data: { version }, error: null }; },
    history: async (owner, draft) => {
      assert.equal(owner, "owner"); assert.equal(draft, draftId);
      return { data: reviewed ? [{ draft_id: draftId, revision: 1, source_text: "", draft: {} }] : [], error: readError ? new Error() : null };
    },
  };
  const dependencies = {
    authenticate: async () => ({ userId: "owner", repository, reserve: async () => { reserveCalls++; return { data: true, error: null }; } }),
    extract: async () => { providerCalls++; if (mutateDuringCall) reviewed = true; return { candidates: [], questions: ["Check the fee"] }; },
  };
  try {
    version = 5;
    assert.equal((await handleExtraction(request({ text: "New source", context }), dependencies)).status, 409);
    assert.equal(reserveCalls, 0); assert.equal(providerCalls, 0);
    version = 4; readError = true;
    assert.equal((await handleExtraction(request({ text: "New source", context }), dependencies)).status, 503);
    assert.equal(reserveCalls, 0); assert.equal(providerCalls, 0);
    readError = false; reviewed = true;
    assert.equal((await handleExtraction(request({ text: "New source", context }), dependencies)).status, 409);
    assert.equal(reserveCalls, 0); assert.equal(providerCalls, 0);
    reviewed = false; mutateDuringCall = true;
    const stale = await handleExtraction(request({ text: "New source", context }), dependencies);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).candidates, undefined);
    assert.equal(reserveCalls, 1); assert.equal(providerCalls, 1);
    reviewed = false; mutateDuringCall = false;
    const ok = await handleExtraction(request({ text: "New source", context }), dependencies);
    assert.equal(ok.status, 200); assert.deepEqual((await ok.json()).questions, ["Check the fee"]);
    assert.equal((await handleExtraction(request({ text: "New source", context: { ...context, baseline: {} } }), dependencies)).status, 400);
  } finally {
    for (const name of ["MODEL_API_KEY", "META_TEXT_MODEL", "MODEL_API_BASE_URL"]) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
  }
});
