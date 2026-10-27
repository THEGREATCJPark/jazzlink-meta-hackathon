import { test } from "node:test";
import assert from "node:assert/strict";
import { applyHumanEdit, applyReviewedCandidate, changedPublicFields, dollarsToCents, emptyTermsDraft, isValidTermValue, publicTerms, reviewTerms, validateExtraction } from "../src/domain/terms.ts";

const source = { id: "message-1", text: "Blue Alley: Two sets at 20:00 and 22:00 for $900. Could we add another set?" };
const output = { candidates: [
  { field: "venue", value: "Blue Alley", quote: "Blue Alley", status: "stated" },
  { field: "feeCents", value: "90000", quote: "$900", status: "stated" },
  { field: "sets", value: "20:00, 22:00", quote: "Two sets at 20:00 and 22:00", status: "stated" },
], questions: ["What is the payment date?"] };

test("allows a partial draft and preserves unknown fields rather than zero or invented dates", () => {
  const parsed = validateExtraction(output, source);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const draft = applyReviewedCandidate(emptyTermsDraft(), parsed.result.candidates[1], source, "musician-1");
  assert.equal(draft.fields.feeCents?.value, "90000");
  assert.equal(draft.fields.date, undefined);
  assert.equal(draft.fields.ticketCents, undefined);
  assert.equal(draft.fields.paymentTerms, undefined);
  assert.deepEqual(draft.fields.feeCents?.origin, { kind: "source", reviewedBy: "musician-1", evidence: { sourceId: "message-1", quote: "$900" }, interpretation: "stated" });
});

test("rejects fabricated evidence, unknown fields, invalid money and shape", () => {
  assert.equal(validateExtraction({ ...output, candidates: [{ ...output.candidates[0], quote: "fabricated" }] }, source).ok, false);
  assert.equal(validateExtraction({ ...output, candidates: [{ ...output.candidates[0], field: "secret" }] }, source).ok, false);
  assert.equal(validateExtraction({ ...output, candidates: [{ ...output.candidates[1], value: "900.00" }] }, source).ok, false);
  assert.equal(validateExtraction({ candidates: [{ field: "date", value: "2026-11-20", quote: "November 20", status: "stated" }], questions: [] }, { id: "date", text: "November 20" }).ok, false);
  assert.equal(validateExtraction({ candidates: [], questions: [null] }, source).ok, false);
});

test("human edits replace source attribution and do not mutate the old draft", () => {
  const result = validateExtraction(output, source);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const before = applyReviewedCandidate(emptyTermsDraft(), result.result.candidates[1], source, "musician-1");
  const after = applyHumanEdit(before, "feeCents", "120000", "musician-1");
  assert.equal(before.fields.feeCents?.value, "90000");
  assert.deepEqual(after.fields.feeCents, { value: "120000", origin: { kind: "human", reviewedBy: "musician-1" } });
  assert.equal(applyHumanEdit(after, "feeCents", "", "musician-1").fields.feeCents, undefined);
});

test("new requests have no automatic effect on an already reviewed snapshot", () => {
  const draft = applyHumanEdit(emptyTermsDraft(), "feeCents", "90000", "musician-1");
  const revision = reviewTerms(draft, 0, 0, "musician-1", ["Payment date unknown"]);
  const pending = validateExtraction({ candidates: [{ field: "sets", value: "21:00", quote: "Could we start at 21:00?", status: "proposed" }], questions: ["What is the total fee?"] }, { id: "message-2", text: "Could we start at 21:00?" });
  assert.equal(pending.ok, true);
  assert.equal(revision.terms.fields.sets, undefined);
  assert.equal(revision.terms.fields.feeCents?.value, "90000");
  assert.deepEqual(revision.unresolved, ["Payment date unknown"]);
  assert.throws(() => reviewTerms(draft, 1, 0, "musician-1", []), /Stale revision/);
});

test("public projection is explicit, allowlisted, and ignores fee-only changes", () => {
  let draft = applyHumanEdit(emptyTermsDraft(), "title", "Jazz night", "musician-1");
  draft = applyHumanEdit(draft, "feeCents", "90000", "musician-1");
  draft = applyHumanEdit(draft, "paymentTerms", "Paid after show", "musician-1");
  assert.deepEqual(publicTerms(draft, ["title", "feeCents", "paymentTerms"]), { title: "Jazz night" });
  assert.deepEqual(publicTerms(draft, []), {});
  const changed = applyHumanEdit(draft, "feeCents", "120000", "musician-1");
  assert.deepEqual(changedPublicFields(draft, changed, ["title"]), []);
  const changedTitle = applyHumanEdit(changed, "title", "New title", "musician-1");
  assert.deepEqual(changedPublicFields(draft, changedTitle, []), []);
  assert.deepEqual(changedPublicFields(draft, changedTitle, ["title"]), ["title"]);
});

test("validates calendar dates, times and exact USD cents", () => {
  assert.equal(isValidTermValue("date", "2026-02-30"), false);
  assert.equal(isValidTermValue("date", "11-20"), false);
  assert.equal(isValidTermValue("date", "2026-11-20"), true);
  assert.equal(isValidTermValue("sets", "20:00, 25:00"), false);
  assert.equal(isValidTermValue("sets", "20:00, 22:00"), true);
  assert.equal(isValidTermValue("setCount", "2"), true);
  assert.equal(isValidTermValue("additionalSets", "1"), true);
  assert.equal(isValidTermValue("additionalSets", "0"), false);
  assert.equal(dollarsToCents("900.00"), 90000);
  assert.equal(dollarsToCents("0"), 0);
  assert.equal(dollarsToCents("0.001"), null);
});
