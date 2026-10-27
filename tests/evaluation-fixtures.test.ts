import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type EvaluationCase = { id: string; category: string; source: string; mustDetect: string[]; mustNotAssert: string[]; expectedEvidence: string[] };
const dataset = JSON.parse(readFileSync(new URL("./fixtures/evaluation-v1.json", import.meta.url), "utf8")) as { version: string; cases: EvaluationCase[] };

test("held-out fixture has exactly eight change cases and four controls with unique identities", () => {
  assert.equal(dataset.version, "evaluation-v1");
  assert.equal(dataset.cases.length, 12);
  assert.equal(new Set(dataset.cases.map((item) => item.id)).size, 12);
  assert.equal(dataset.cases.filter((item) => item.category === "change_conflict").length, 8);
  assert.equal(dataset.cases.filter((item) => item.category === "normal_control").length, 4);
});

test("every frozen fixture has expected observations, restrictions and literal source evidence", () => {
  for (const item of dataset.cases) {
    assert.ok(item.source.trim(), item.id);
    assert.ok(item.mustDetect.length && item.mustDetect.every((value) => value.trim()), item.id);
    assert.ok(item.mustNotAssert.length && item.mustNotAssert.every((value) => value.trim()), item.id);
    assert.ok(item.expectedEvidence.length, item.id);
    for (const quote of item.expectedEvidence) assert.ok(quote.trim() && item.source.includes(quote), `${item.id}: ${quote}`);
  }
});
