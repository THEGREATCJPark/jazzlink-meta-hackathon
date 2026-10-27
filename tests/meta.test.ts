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
