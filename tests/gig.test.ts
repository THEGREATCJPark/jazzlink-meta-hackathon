import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGig } from "../src/domain/gig.ts";

const valid = { title: "Trio night", venue: "Blue Alley", date: "2026-11-20", sets: "20:00, 22:00", artist: "Example Trio", feeDollars: "900.00", ticketDollars: "", paymentTerms: "Paid after the show" };
test("validates USD minor units and leaves an unknown ticket price null", () => {
  const { spec, errors } = validateGig(valid);
  assert.deepEqual(errors, []);
  assert.equal(spec?.feeCents, 90000);
  assert.equal(spec?.ticketCents, null);
  assert.equal(spec?.timezone, "America/New_York");
});
test("rejects fabricated dates, bad set times and fractional cents", () => {
  const result = validateGig({ ...valid, date: "2026-02-30", sets: "25:00", feeDollars: "1.001" });
  assert.equal(result.spec, null);
  assert.equal(result.errors.length, 3);
});
test("requires parties and payment terms", () => {
  const result = validateGig({ ...valid, artist: " ", paymentTerms: "" });
  assert.equal(result.spec, null);
  assert.equal(result.errors.length, 2);
});
