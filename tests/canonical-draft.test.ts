import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalizeDraftMoney } from "../src/domain/canonical-draft.ts";

test("canonicalizes USD amounts to integer cents instead of trusting submitted cents", () => {
  const input = { review: { items: [
    { field: "feeCents", editedValue: "900.50", amountCents: 1, selected: true },
    { field: "ticketCents", editedValue: "", selected: false },
    { field: "title", editedValue: "Trio" },
  ] } };
  const output = canonicalizeDraftMoney(input);
  const items = (output?.review as { items: { amountCents?: number | null }[] }).items;
  assert.equal(items[0].amountCents, 90050);
  assert.equal(items[1].amountCents, null);
  assert.equal(items[2].amountCents, undefined);
  assert.equal(input.review.items[0].amountCents, 1);
});

test("rejects selected invalid amounts but preserves an unselected incomplete draft", () => {
  assert.equal(canonicalizeDraftMoney({ review: { items: [{ field: "feeCents", editedValue: "0.001", selected: true }] } }), null);
  const output = canonicalizeDraftMoney({ review: { items: [{ field: "feeCents", editedValue: "0.001", selected: false }] } });
  assert.equal(((output?.review as { items: { amountCents: null }[] }).items)[0].amountCents, null);
  assert.equal(canonicalizeDraftMoney({ review: { items: [{ field: "feeCents", editedValue: "1", selected: "true" }] } }), null);
  assert.equal(canonicalizeDraftMoney({ arbitrary: true }), null);
  assert.equal(canonicalizeDraftMoney({ review: { items: [{ field: "unknown", editedValue: "x" }] } }), null);
  assert.equal(canonicalizeDraftMoney({ review: { items: [{ field: "title", editedValue: "x", amountCents: 100 }] } }), null);
});

test("also canonicalizes the carried-forward reviewed baseline", () => {
  const output = canonicalizeDraftMoney({ review: { items: [], baseline: { revision: 1, items: [{ field: "feeCents", editedValue: " 900.00 ", selected: true }] } } });
  const baseline = (output?.review as { baseline: { items: { editedValue: string; amountCents: number }[] } }).baseline;
  assert.deepEqual(baseline.items[0], { field: "feeCents", editedValue: "900.00", amountCents: 90000, selected: true });
});
