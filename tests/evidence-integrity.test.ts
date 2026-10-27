import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEvidenceIntegrity, type EvidenceRevision } from "../src/domain/evidence-integrity.ts";

const draftId = "gig-1";
const original = "Venue: Blue Alley on November 20, 2026.";
const second = "Venue: Please start later.";
const third = "Musician: I'll check the time.";
const firstItem = { field: "venue", value: "Blue Alley", quote: "Blue Alley", status: "stated",
  manual: false, edited: false, editedValue: "Blue Alley", selected: true };
const first: EvidenceRevision = { draft_id: draftId, revision: 1, source_text: original,
  draft: { review: { source: original, items: [firstItem], questions: [] } } };
const secondItem = { ...firstItem, carriedFrom: { revision: 1, source: original, fixture: false } };
const previous: EvidenceRevision = { draft_id: draftId, revision: 2, source_text: second,
  draft: { review: { source: second, items: [secondItem], questions: [] } } };
const thirdItem = { ...firstItem, carriedFrom: { revision: 2, source: original, fixture: false } };
const current = { source: third, items: [thirdItem], questions: [] };

test("checks a quote against the current source and allows attributed manual items", () => {
  const currentItem = { ...firstItem, quote: "Musician:", value: "Musician" };
  assert.equal(checkEvidenceIntegrity({ draftId, sourceText: third,
    review: { source: third, items: [currentItem], questions: [] }, revisions: [] }).ok, true);
  const manual = { field: "venue", value: "", quote: "", status: "unclear",
    manual: true, editedValue: "Blue Alley", selected: true };
  assert.equal(checkEvidenceIntegrity({ draftId, sourceText: third,
    review: { source: third, items: [manual], questions: [] }, revisions: [] }).ok, true);
  assert.equal(checkEvidenceIntegrity({ draftId, sourceText: third,
    review: { source: third, items: [firstItem], questions: [] }, revisions: [] }).ok, false);
});

test("verifies a genuine two-hop carry using immutable revision contents", () => {
  assert.deepEqual(checkEvidenceIntegrity({ draftId, sourceText: third, review: current,
    revisions: [first, previous], currentRevision: 3 }), { ok: true, issues: [] });
});

test("rejects nonexistent and wrong-draft revisions, fake quotes, and fake source", () => {
  const base = { draftId, sourceText: third, revisions: [first, previous], currentRevision: 3 };
  assert.equal(checkEvidenceIntegrity({ ...base, review: { ...current, items: [
    { ...thirdItem, carriedFrom: { ...thirdItem.carriedFrom, revision: 9 } },
  ] } }).ok, false);
  assert.equal(checkEvidenceIntegrity({ ...base, review: { ...current, items: [
    { ...thirdItem, quote: "fabricated quote" },
  ] } }).ok, false);
  assert.equal(checkEvidenceIntegrity({ ...base, review: { ...current, items: [
    { ...thirdItem, carriedFrom: { ...thirdItem.carriedFrom, source: "fabricated Blue Alley" } },
  ] } }).ok, false);
  assert.equal(checkEvidenceIntegrity({ ...base, revisions: [first, { ...previous, draft_id: "other" }], review: current }).ok, false);
});

test("does not trust a forged earlier carry even if its fake source contains the quote", () => {
  const forged = { ...secondItem, carriedFrom: { revision: 1, source: "Blue Alley was invented", fixture: false } };
  const forgedPrevious = { ...previous, draft: { review: { source: second, items: [forged], questions: [] } } };
  assert.equal(checkEvidenceIntegrity({ draftId, sourceText: third, review: current,
    revisions: [first, forgedPrevious], currentRevision: 3 }).ok, false);
});

test("baseline must exactly reproduce selected items from the same stored revision", () => {
  const baseline = { revision: 2, source: second, fixture: false, items: [secondItem] };
  const base = { draftId, sourceText: third, revisions: [first, previous], currentRevision: 3 };
  assert.equal(checkEvidenceIntegrity({ ...base, review: { ...current, baseline } }).ok, true);
  assert.equal(checkEvidenceIntegrity({ ...base, review: { ...current,
    baseline: { ...baseline, items: [{ ...secondItem, editedValue: "forged" }] } } }).ok, false);
});

test("legacy baseline money can acquire canonical cents without rewriting history, but conflicting cents fail", () => {
  const oldFee = { field: "feeCents", value: "90000", quote: "$900", status: "stated", manual: false,
    editedValue: "900.00", selected: true };
  const source = "Venue: $900 for the performance.";
  const oldRevision: EvidenceRevision = { draft_id: draftId, revision: 1, source_text: source,
    draft: { review: { source, items: [oldFee], questions: [] } } };
  const review = { source: second, items: [], questions: [],
    baseline: { revision: 1, source, fixture: false, items: [{ ...oldFee, amountCents: 90000 }] } };
  const input = { draftId, sourceText: second, review, revisions: [oldRevision], currentRevision: 2 };
  assert.equal(checkEvidenceIntegrity(input).ok, true);
  const badRevision = { ...oldRevision, draft: { review: { source, items: [{ ...oldFee, amountCents: 1 }], questions: [] } } };
  assert.equal(checkEvidenceIntegrity({ ...input, revisions: [badRevision] }).ok, false);
  assert.equal(checkEvidenceIntegrity({ ...input, review: { ...review, baseline: { ...review.baseline, items: [{ ...oldFee, amountCents: 1 }] } } }).ok, false);
  const directCarry = { source: second, items: [{ ...oldFee, amountCents: 90000,
    carriedFrom: { revision: 1, source, fixture: false } }], questions: [] };
  assert.equal(checkEvidenceIntegrity({ ...input, review: directCarry }).ok, true);
  assert.equal(checkEvidenceIntegrity({ ...input, review: directCarry, revisions: [badRevision] }).ok, false);
});

test("rejects changed source, cycles, duplicate history and unmatched manually carried data", () => {
  const base = { draftId, sourceText: third, revisions: [first, previous], currentRevision: 3 };
  assert.equal(checkEvidenceIntegrity({ ...base, sourceText: "different", review: current }).ok, false);
  assert.equal(checkEvidenceIntegrity({ ...base, review: { ...current, items: [
    { ...thirdItem, carriedFrom: { ...thirdItem.carriedFrom, revision: 3 } },
  ] } }).ok, false);
  assert.equal(checkEvidenceIntegrity({ ...base, revisions: [first, first], review: current }).ok, false);
  const manual = { field: "venue", value: "", quote: "", status: "unclear",
    manual: true, editedValue: "Blue Alley", selected: true, carriedFrom: { revision: 1, source: original } };
  assert.equal(checkEvidenceIntegrity({ ...base, review: { ...current, items: [manual] } }).ok, false);
});
