import { test } from "node:test";
import assert from "node:assert/strict";
import { ticketLabel, validatePublicCard } from "../src/domain/public-card.ts";

const complete = {
  revision: 1, title: "Blue Alley Trio", venue: "Blue Alley", artist: "Blue Alley Trio",
  date: "2026-11-20", sets: "20:00, 22:00", setCount: "2", ticketCents: "2500",
};

test("requires a title, venue and artist independently before download", () => {
  assert.equal(validatePublicCard(complete).canExport, true);
  for (const [field, flag] of [["title", "missingTitle"], ["venue", "missingVenue"], ["artist", "missingArtist"]] as const) {
    const result = validatePublicCard({ ...complete, [field]: "   " });
    assert.equal(result[flag], true, field);
    assert.equal(result.canExport, false, field);
  }
});

test("checks a provided total against the number of explicit set times", () => {
  const mismatch = validatePublicCard({ ...complete, setCount: "3" });
  assert.equal(mismatch.setCountMismatch, true);
  assert.equal(mismatch.canExport, false);
  assert.equal(validatePublicCard({ ...complete, sets: "20:00", setCount: "1" }).canExport, true);
  // A missing count is unknown; do not invent one from the times.
  assert.equal(validatePublicCard({ ...complete, setCount: null }).canExport, true);
  assert.equal(validatePublicCard({ ...complete, setCount: "  " }).canExport, true);
});

test("rejects invalid totals and malformed times without asserting a count mismatch", () => {
  for (const setCount of ["0", "2.5", "-1", "100", "two"]) {
    const result = validatePublicCard({ ...complete, setCount });
    assert.equal(result.invalidSetCount, true, setCount);
    assert.equal(result.canExport, false, setCount);
  }
  const invalidTime = validatePublicCard({ ...complete, sets: "20:00, unknown", setCount: "2" });
  assert.equal(invalidTime.invalidTime, true);
  assert.equal(invalidTime.setCountMismatch, false);
  assert.equal(invalidTime.canExport, false);
});

test("continues to reject unresolvable New York dates and times", () => {
  for (const [date, sets, status] of [
    ["2026-03-08", "02:30", "nonexistent"],
    ["2026-11-01", "01:30", "ambiguous"],
    ["2026-11-20", "23:00, 01:00", "overnight_date_needed"],
  ] as const) {
    const result = validatePublicCard({ ...complete, date, sets, setCount: null });
    assert.equal(result.scheduleStatus, status);
    assert.equal(result.canExport, false);
  }
  assert.equal(validatePublicCard({ ...complete, date: "2026-02-30" }).canExport, false);
  assert.equal(validatePublicCard({ ...complete, date: null }).canExport, false);
});

test("retains text, revision and ticket-cent safety checks", () => {
  assert.equal(validatePublicCard({ ...complete, title: "a".repeat(121) }).canExport, false);
  assert.equal(validatePublicCard({ ...complete, artist: "Band\nSecond line" }).canExport, false);
  assert.equal(validatePublicCard({ ...complete, revision: 0 }).canExport, false);
  assert.equal(validatePublicCard({ ...complete, ticketCents: "25.00" }).canExport, false);
  assert.equal(validatePublicCard({ ...complete, ticketCents: null }).canExport, true);
  assert.equal(ticketLabel("2500"), "$25.00");
  assert.equal(ticketLabel(""), "Not specified");
});
