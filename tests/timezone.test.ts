import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyNewYorkLocalTime, validateNewYorkSchedule } from "../src/domain/timezone.ts";

test("converts known winter and summer New York times using their respective offsets", () => {
  assert.deepEqual(classifyNewYorkLocalTime("2026-11-20", "20:00"), { status: "valid", instants: ["2026-11-21T01:00:00.000Z"] });
  assert.deepEqual(classifyNewYorkLocalTime("2026-07-20", "20:00"), { status: "valid", instants: ["2026-07-21T00:00:00.000Z"] });
});

test("rejects the spring gap and accepts the minutes on either side", () => {
  assert.equal(classifyNewYorkLocalTime("2026-03-08", "02:30").status, "nonexistent");
  assert.deepEqual(classifyNewYorkLocalTime("2026-03-08", "01:59").instants, ["2026-03-08T06:59:00.000Z"]);
  assert.deepEqual(classifyNewYorkLocalTime("2026-03-08", "03:00").instants, ["2026-03-08T07:00:00.000Z"]);
});

test("returns both instants in the autumn fold instead of picking one", () => {
  assert.deepEqual(classifyNewYorkLocalTime("2026-11-01", "01:30"), {
    status: "ambiguous", instants: ["2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z"],
  });
  assert.deepEqual(classifyNewYorkLocalTime("2026-11-01", "02:00").instants, ["2026-11-01T07:00:00.000Z"]);
});

test("never invents an absent date or accepts invalid calendar values", () => {
  assert.equal(classifyNewYorkLocalTime(null, "20:00").status, "missing");
  assert.equal(classifyNewYorkLocalTime("2026-02-30", "20:00").status, "invalid");
  assert.equal(classifyNewYorkLocalTime("2026-11-20", "24:00").status, "invalid");
  assert.equal(classifyNewYorkLocalTime("11-20", "20:00").status, "invalid");
});

test("blocks exports for missing, gap, fold and possible next-day set dates", () => {
  assert.equal(validateNewYorkSchedule(undefined, "20:00").status, "missing");
  assert.equal(validateNewYorkSchedule("2026-03-08", "01:30,02:30").status, "nonexistent");
  assert.equal(validateNewYorkSchedule("2026-11-01", "01:30,02:30").status, "ambiguous");
  assert.equal(validateNewYorkSchedule("2026-11-20", "23:00,01:00").status, "overnight_date_needed");
  assert.equal(validateNewYorkSchedule("2026-11-20", "20:00,22:00").status, "valid");
});
