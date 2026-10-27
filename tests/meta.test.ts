import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTerms, MetaError } from "../src/server/meta.ts";

test("provider adapter sends a bounded, stateless request and validates source evidence", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  process.env.MODEL_API_KEY = "test-only";
  process.env.META_TEXT_MODEL = "test-model";
  process.env.MODEL_API_BASE_URL = "https://api.meta.ai/v1";
  const source = "Venue: The fee is $900.";
  let quote = "$900";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 1800);
    assert.equal(body.text.format.type, "json_schema");
    const output = { candidates: [{ field: "feeCents", value: "90000", quote, status: "stated" }], questions: [] };
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }] });
  };
  try {
    const result = await extractTerms(source);
    assert.equal(result.candidates[0].value, "90000");
    quote = "not present";
    await assert.rejects(() => extractTerms(source), (error: unknown) => error instanceof MetaError && error.kind === "invalid_output");
    globalThis.fetch = async () => Response.json({ error: { code: "model_not_found" } }, { status: 404 });
    await assert.rejects(() => extractTerms(source), (error: unknown) => error instanceof MetaError && error.kind === "model_unavailable");
    globalThis.fetch = async () => Response.json({ error: { code: "another_error" } }, { status: 404 });
    await assert.rejects(() => extractTerms(source), (error: unknown) => error instanceof MetaError && error.kind === "provider");
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of ["MODEL_API_KEY", "META_TEXT_MODEL", "MODEL_API_BASE_URL"]) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("prior review informs new-source extraction without becoming candidate evidence", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  process.env.MODEL_API_KEY = "test-only";
  process.env.META_TEXT_MODEL = "test-model";
  process.env.MODEL_API_BASE_URL = "https://api.meta.ai/v1";
  const source = "Could we add one extra set at 9?";
  const prior = { revision: 1, selected: [
    { field: "setCount" as const, value: "2", evidence: { kind: "source" as const, quote: "two sets", edited: false, interpretation: "stated" } },
    { field: "feeCents" as const, value: "90000", evidence: { kind: "source" as const, quote: "$900", edited: false, interpretation: "proposed" } },
  ] };
  let invented = false;
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body));
    assert.deepEqual(JSON.parse(request.input), { new_source: source, prior_personal_review: prior });
    assert.match(request.instructions, /not a bilateral agreement/);
    assert.match(request.instructions, /ONLY for explicit terms in new_source/);
    const candidate = invented ? { field: "feeCents", value: "90000", quote: "$900", status: "stated" }
      : { field: "additionalSets", value: "1", quote: "one extra set", status: "proposed" };
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ candidates: [candidate], questions: ["Does the earlier fee apply to the extra set?"] }) }] }] });
  };
  try {
    const result = await extractTerms(source, prior);
    assert.equal(result.candidates[0].field, "additionalSets");
    assert.equal(result.questions.length, 1);
    invented = true;
    await assert.rejects(extractTerms(source, prior), (error: unknown) => error instanceof MetaError && error.kind === "invalid_output");
    await assert.rejects(extractTerms("x".repeat(8001), prior), (error: unknown) => error instanceof MetaError && error.kind === "invalid_output");
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of ["MODEL_API_KEY", "META_TEXT_MODEL", "MODEL_API_BASE_URL"]) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
  }
});
