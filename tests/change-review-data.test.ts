import { test } from "node:test";
import assert from "node:assert/strict";
import { compareRowValue, groupReviewRows } from "../src/components/change-review-data.ts";

test("preserves each previous and current row, including conflicting proposals", () => {
  const previous = [{ field: "sets", label: "Set times", value: "20:00, 22:00", status: "stated" }];
  const current = [
    { field: "sets", label: "Set times", value: "21:00", status: "proposed" },
    { field: "sets", label: "Set times", value: "20:00, 22:00", status: "rejected" },
    { field: "fee", label: "Fee", value: "900", status: "unclear" },
  ];
  const groups = groupReviewRows(previous, current);
  assert.deepEqual(groups.map((group) => group.field), ["sets", "fee"]);
  assert.deepEqual(groups[0].previous, previous);
  assert.deepEqual(groups[0].current, current.slice(0, 2));
  assert.equal(groups[0].hasDifferentCurrentValues, true);
  assert.equal(groups[1].hasDifferentCurrentValues, false);
  assert.equal(compareRowValue(current[0], groups[0].previous), "Value differs from previous rows");
  assert.equal(compareRowValue(current[1], groups[0].previous), "Value matches a previous row");
});

test("does not equate missing values or empty previous rows with zero", () => {
  const empty = { field: "fee", label: "Fee", value: "", status: "unclear" };
  const zero = { ...empty, value: "0" };
  assert.equal(compareRowValue(empty, [zero]), "Value not provided");
  assert.equal(compareRowValue(zero, [empty]), "No previous value to compare");
  assert.deepEqual(groupReviewRows([], []), []);
});
