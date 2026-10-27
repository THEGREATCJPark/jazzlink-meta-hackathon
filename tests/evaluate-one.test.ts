import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { containsCredentialLikeText, evaluateOne, isFrozenDataset, selectCase, type EvaluationRecord } from "../scripts/evaluate-one.ts";
import { MetaError } from "../src/server/meta.ts";
import type { Extraction } from "../src/domain/terms.ts";

const source = "Venue: Blue Alley can host the trio.";
const dataset = { version: "evaluation-v1", cases: [{ id: "C01-example", source,
  mustDetect: ["EXPECTED LABEL MUST NOT BE SENT"], mustNotAssert: ["FORBIDDEN LABEL MUST NOT BE SENT"],
  expectedEvidence: ["Blue Alley"] }] };
const response: Extraction = { candidates: [{ field: "venue", value: "Blue Alley", quote: "Blue Alley", status: "stated", sourceId: "current-input" }], questions: [] };

test("selects only the requested frozen source, without evaluation labels", () => {
  assert.deepEqual(selectCase(dataset, "C01-example"), { id: "C01-example", source });
  assert.throws(() => selectCase(dataset, "N99-missing"));
  assert.throws(() => selectCase({ ...dataset, cases: [...dataset.cases, dataset.cases[0]] }, "C01-example"));
  assert.throws(() => selectCase({ ...dataset, version: "other" }, "C01-example"));
});

test("pins the reviewed synthetic dataset independently of formatting", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/evaluation-v1.json", import.meta.url), "utf8"));
  assert.equal(isFrozenDataset(fixture), true);
  fixture.cases[0].source = "Changed source";
  assert.equal(isFrozenDataset(fixture), false);
});

test("runs one adapter call with source only and preserves unscored results and telemetry", async () => {
  let calls = 0;
  const records: EvaluationRecord[] = [];
  const result = await evaluateOne({ dataset, caseId: "C01-example", model: "muse-spark-1.2", secret: "fake-secret-for-testing",
    revision: "synthetic-revision", telemetry: () => ({ status: "completed", code: null, elapsedMs: 123, inputTokens: 20, outputTokens: 30 }),
    extract: async (input) => { calls++; assert.equal(input, source); return response; }, record: (record) => records.push(record) });
  assert.equal(calls, 1);
  assert.deepEqual(records.map((record) => [record.status, record.adapterCalls]), [["started", 0], ["started", 1], ["response_received", 1]]);
  assert.equal(result.humanScoring, "not_started");
  assert.equal(result.providerTelemetry?.outputTokens, 30);
  assert.deepEqual(result.result, response);
  assert.ok(!JSON.stringify(records).includes("EXPECTED LABEL MUST NOT BE SENT"));
  assert.ok(!JSON.stringify(records).includes("fake-secret-for-testing"));
});

test("captures a failed adapter result once without leaking the error message", async () => {
  let calls = 0;
  const records: EvaluationRecord[] = [];
  const result = await evaluateOne({ dataset, caseId: "C01-example", model: "muse-spark-1.3",
    extract: async () => { calls++; throw new MetaError("model_unavailable"); }, record: (record) => records.push(record) });
  assert.equal(calls, 1);
  assert.equal(result.status, "failed");
  assert.equal(result.errorKind, "model_unavailable");
  assert.equal(result.result, null);
  assert.equal(records.at(-1)?.adapterCalls, 1);
});

test("withholds any result containing the configured secret or credential-shaped text", async () => {
  const secret = "fake-credential-value-for-testing";
  const records: EvaluationRecord[] = [];
  const result = await evaluateOne({ dataset, caseId: "C01-example", model: "muse-spark-1.2", secret,
    extract: async () => ({ ...response, questions: [secret] }), record: (record) => records.push(record) });
  assert.equal(result.status, "output_withheld");
  assert.equal(result.result, null);
  assert.ok(!JSON.stringify(records).includes(secret));
  assert.equal(containsCredentialLikeText({ message: "Bearer abcdefghijklmnop" }, undefined), true);
});

test("invalid selection or model never invokes the adapter", async () => {
  let calls = 0;
  const extract = async () => { calls++; return response; };
  const record = () => {};
  await assert.rejects(() => evaluateOne({ dataset, caseId: "C01-example", model: "unknown", extract, record }));
  await assert.rejects(() => evaluateOne({ dataset, caseId: "N99-missing", model: "muse-spark-1.2", extract, record }));
  assert.equal(calls, 0);
});
