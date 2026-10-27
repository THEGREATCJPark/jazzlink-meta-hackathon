import { test } from "node:test";
import assert from "node:assert/strict";
import { mayPublish, valueWasEdited } from "../src/domain/publication.ts";

test("uncertain and modified values need an explicit current-value confirmation before public opt-in", () => {
  for (const status of ["proposed", "accepted", "rejected", "withdrawn", "unclear"]) {
    assert.equal(mayPublish({ status, edited: false, manual: false }), false, status);
    assert.equal(mayPublish({ status, edited: false, manual: false, publishConfirmed: true }), true, status);
  }
  assert.equal(mayPublish({ status: "stated", edited: true, manual: false }), false);
  assert.equal(mayPublish({ status: "stated", edited: false, manual: true }), false);
  assert.equal(mayPublish({ status: "stated", edited: false, manual: false }), true);
});

test("a changed displayed value is an edit even if a stored flag says otherwise", () => {
  const edited = valueWasEdited("Blue Alley", "Another Venue", false);
  assert.equal(edited, true);
  assert.equal(mayPublish({ status: "stated", edited, manual: false }), false);
  assert.equal(valueWasEdited("Blue Alley", " Blue Alley ", false), false);
});
