import { test } from "node:test";
import assert from "node:assert/strict";
import { compareCandidateSources, createImmutableReviewedTerms } from "../src/domain/changes.ts";
import { applyHumanEdit, emptyTermsDraft, type TermCandidate } from "../src/domain/terms.ts";

const oldMessage = { id: "old", text: "The fee is $900 for two sets at 20:00 and 22:00." };
const request = { id: "request", text: "Could we start at 21:00 and add a set?" };
const reply = { id: "reply", text: "We can pay $1,200 for the new schedule." };
const original = applyHumanEdit(applyHumanEdit(emptyTermsDraft(), "feeCents", "90000", "musician"), "sets", "20:00, 22:00", "musician");
const pending: TermCandidate = { field: "sets", value: "21:00", quote: "start at 21:00", status: "proposed", sourceId: "request" };

test("compares a pending change without changing the reviewed baseline or inventing a fee", () => {
  const before = structuredClone(original);
  const result = compareCandidateSources(original, [oldMessage, request], [pending], ["What is the new total fee?"]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(original, before);
  assert.deepEqual(result.comparison.fields, [{ field: "sets", reviewedValue: "20:00, 22:00", alternatives: [{ candidate: pending, differsFromReviewed: true, requiresHumanReview: true }], conflictingCandidates: false, hasPendingProposal: true, hasUnclearInterpretation: false }]);
  assert.equal(result.comparison.fields.some((field) => field.field === "feeCents"), false);
  assert.ok(result.comparison.unknownReviewedFields.includes("date"));
});

test("keeps conflicting candidates and source identity rather than choosing the latest", () => {
  const candidates: TermCandidate[] = [
    { field: "feeCents", value: "90000", quote: "$900", status: "stated", sourceId: "old" },
    { field: "feeCents", value: "120000", quote: "$1,200", status: "accepted", sourceId: "reply" },
  ];
  const result = compareCandidateSources(original, [oldMessage, reply], candidates);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.comparison.fields[0].conflictingCandidates, true);
  assert.deepEqual(result.comparison.fields[0].alternatives.map((item) => item.candidate.sourceId), ["old", "reply"]);
  assert.ok(result.comparison.fields[0].alternatives.every((item) => item.requiresHumanReview));
});

test("a rejected proposal remains visible without becoming an active competing value", () => {
  const rejected = { ...pending, status: "rejected" as const };
  const result = compareCandidateSources(original, [request], [rejected]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.comparison.fields[0].alternatives[0].candidate.status, "rejected");
  assert.equal(result.comparison.fields[0].conflictingCandidates, false);
  assert.equal(result.comparison.fields[0].hasPendingProposal, false);
});

test("rejects missing sources, duplicate IDs, mismatched quotes and date without an explicit year", () => {
  assert.equal(compareCandidateSources(original, [request, request], [pending]).ok, false);
  assert.equal(compareCandidateSources(original, [oldMessage], [pending]).ok, false);
  assert.equal(compareCandidateSources(original, [request], [{ ...pending, quote: "not in source" }]).ok, false);
  const noYear = { id: "date", text: "November 20" };
  assert.equal(compareCandidateSources(original, [noYear], [{ field: "date", value: "2026-11-20", quote: "November 20", status: "stated", sourceId: "date" }]).ok, false);
});

test("frozen review is detached from edits and rejects stale revisions", () => {
  const draft = structuredClone(original);
  const snapshot = createImmutableReviewedTerms(draft, 0, 0, "musician", ["Payment date unknown"]);
  draft.fields.feeCents!.value = "120000";
  assert.equal(snapshot.terms.fields.feeCents?.value, "90000");
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.terms.fields.feeCents));
  assert.ok(Object.isFrozen(snapshot.unresolved));
  assert.throws(() => createImmutableReviewedTerms(draft, 1, 0, "musician", []), /Stale revision/);
});
