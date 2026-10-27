import { test } from "node:test";
import assert from "node:assert/strict";
import { assessFeeContext, type FeeContextCandidate } from "../src/domain/fee-context.ts";

const previous = { sets: "20:00, 22:00", setCount: "2" };
const candidate = (overrides: Partial<FeeContextCandidate>): FeeContextCandidate => ({
  field: "sets", value: "20:00, 22:00", status: "stated", selected: false, fromPreviousReview: false, ...overrides,
});

test("an extra set proposal makes the carried fee's applicability uncertain without changing totals", () => {
  const input = { previous, carriedFeeSelected: true, candidates: [candidate({ field: "additionalSets", value: "1", status: "proposed" })] };
  const before = structuredClone(input);
  const result = assessFeeContext(input);
  assert.equal(result.scheduleChangeRisk, true);
  assert.deepEqual(result.reasons, ["additional_sets_requested"]);
  assert.equal(result.previousFeeApplicability, "needs_reconfirmation");
  assert.deepEqual(input, before);
});

test("a different schedule proposal warns even before it is selected", () => {
  const result = assessFeeContext({ previous, carriedFeeSelected: true,
    candidates: [candidate({ value: "21:00", status: "proposed" })] });
  assert.equal(result.previousFeeApplicability, "needs_reconfirmation");
  assert.ok(result.reasons.includes("schedule_candidate_differs"));
  assert.ok(result.reasons.includes("schedule_change_proposed"));
});

test("a selected changed total is distinct from an additional set count", () => {
  const result = assessFeeContext({ previous, carriedFeeSelected: true,
    candidates: [candidate({ field: "setCount", value: "3", status: "stated", selected: true })] });
  assert.deepEqual(result.reasons, ["selected_schedule_differs"]);
  assert.equal(result.previousFeeApplicability, "needs_reconfirmation");
});

test("a new fee candidate is kept separate from an old carried fee and is not marked agreed", () => {
  const result = assessFeeContext({ previous, carriedFeeSelected: false, candidates: [
    candidate({ field: "additionalSets", value: "1", status: "proposed" }),
    candidate({ field: "feeCents", value: "120000", status: "accepted", selected: true }),
  ] });
  assert.equal(result.previousFeeApplicability, "not_carried");
  assert.equal(result.scheduleChangeRisk, true);
  assert.deepEqual(result.newFeeCandidates, [{ value: "120000", status: "accepted", selected: true }]);
});

test("a separately sourced new fee remains new even if numerically equal to the old fee", () => {
  const result = assessFeeContext({ previous, carriedFeeSelected: true, candidates: [
    candidate({ field: "feeCents", value: "90000", status: "stated", selected: true }),
    candidate({ field: "feeCents", value: "90000", status: "stated", fromPreviousReview: true }),
  ] });
  assert.equal(result.previousFeeApplicability, "earlier_review_only");
  assert.deepEqual(result.newFeeCandidates, [{ value: "90000", status: "stated", selected: true }]);
});

test("identical schedules normalize whitespace and carried old proposals are not new requests", () => {
  const result = assessFeeContext({ previous, carriedFeeSelected: true, candidates: [
    candidate({ value: "20:00,22:00", status: "proposed", selected: true, fromPreviousReview: true }),
    candidate({ field: "setCount", value: "2", status: "stated" }),
  ] });
  assert.equal(result.scheduleChangeRisk, false);
  assert.equal(result.previousFeeApplicability, "earlier_review_only");
});

test("unselected rejected or withdrawn candidates are not active changes", () => {
  const result = assessFeeContext({ previous, carriedFeeSelected: true, candidates: [
    candidate({ value: "21:00", status: "rejected" }),
    candidate({ field: "additionalSets", value: "1", status: "withdrawn" }),
  ] });
  assert.equal(result.scheduleChangeRisk, false);
  assert.equal(result.previousFeeApplicability, "earlier_review_only");
});

test("a deliberately selected different value still needs checking even if originally rejected", () => {
  const result = assessFeeContext({ previous, carriedFeeSelected: true,
    candidates: [candidate({ value: "21:00", status: "rejected", selected: true })] });
  assert.deepEqual(result.reasons, ["selected_schedule_differs"]);
  assert.equal(result.previousFeeApplicability, "needs_reconfirmation");
});

test("an explicitly selected additional set remains relevant when carried from an earlier review", () => {
  const result = assessFeeContext({ previous, carriedFeeSelected: true,
    candidates: [candidate({ field: "additionalSets", value: "1", status: "proposed", selected: true, fromPreviousReview: true })] });
  assert.deepEqual(result.reasons, ["selected_additional_sets"]);
  assert.equal(result.previousFeeApplicability, "needs_reconfirmation");
});

test("unknown old schedule or invalid selected schedule cannot establish fee applicability", () => {
  const unknown = assessFeeContext({ previous: { sets: null, setCount: "2" }, carriedFeeSelected: true,
    candidates: [candidate({ value: "21:00", status: "stated" })] });
  assert.ok(unknown.reasons.includes("previous_schedule_unknown"));
  const invalid = assessFeeContext({ previous, carriedFeeSelected: true,
    candidates: [candidate({ value: "25:00", selected: true })] });
  assert.ok(invalid.reasons.includes("invalid_schedule_value"));
  assert.equal(invalid.previousFeeApplicability, "needs_reconfirmation");
});
