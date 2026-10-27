import { test } from "node:test";
import assert from "node:assert/strict";
import { runDiagnostic } from "../scripts/meta-context-diagnostic.ts";
import { extractTerms, MetaError } from "../src/server/meta.ts";

const key = "synthetic-test-key";
const model = "configured-model";

test("diagnostic does not call inference for missing, unauthorized, malformed, or timed-out catalog", async () => {
  let catalogCalls = 0, modelCalls = 0;
  const extract = async () => { modelCalls++; return { candidates: [], questions: [] }; };
  for (const catalog of [
    async () => Response.json({ data: [] }),
    async () => Response.json({ error: "secret details" }, { status: 401 }),
    async () => Response.json({ data: {} }),
    async () => { throw new DOMException("private details", "TimeoutError"); },
  ]) {
    const result = await runDiagnostic(key, model, { catalog: async () => { catalogCalls++; return catalog(); }, extract });
    assert.equal(result.adapterCalls, 0);
    assert.equal(JSON.stringify(result).includes("private details"), false);
    assert.equal(JSON.stringify(result).includes("secret details"), false);
  }
  assert.equal(catalogCalls, 4);
  assert.equal(modelCalls, 0);
});

test("exact configured model gates one synthetic contextual call and credential-like output is withheld", async () => {
  let modelCalls = 0;
  const catalog = async () => Response.json({ data: [{ id: model }, { id: "another" }] });
  const result = await runDiagnostic(key, model, { catalog, extract: async (source, prior) => {
    modelCalls++;
    assert.match(source, /one extra set at 9 PM/);
    assert.deepEqual(prior.selected.map((item) => [item.field, item.value]), [["setCount", "2"], ["feeCents", "90000"]]);
    return { candidates: [], questions: [key] };
  } });
  assert.equal(modelCalls, 1);
  assert.equal(result.status, "output_withheld");
  assert.equal(result.result, null);
  assert.equal(JSON.stringify(result).includes(key), false);
  const failed = await runDiagnostic(key, model, { catalog, extract: async () => { modelCalls++; throw new MetaError("timeout"); } });
  assert.equal(failed.status, "adapter_failed");
  assert.equal(failed.errorKind, "timeout");
  assert.equal(modelCalls, 2);
});

test("contextual adapter reports timeout without retrying or leaking raw errors", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  process.env.MODEL_API_KEY = key;
  process.env.META_TEXT_MODEL = model;
  process.env.MODEL_API_BASE_URL = "https://api.meta.ai/v1";
  globalThis.fetch = async () => { calls++; throw new DOMException("secret diagnostic", "TimeoutError"); };
  try {
    await assert.rejects(extractTerms("one extra set", { revision: 1, selected: [] }), (error: unknown) =>
      error instanceof MetaError && error.kind === "timeout" && !error.message.includes("secret diagnostic"));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of ["MODEL_API_KEY", "META_TEXT_MODEL", "MODEL_API_BASE_URL"]) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
  }
});
