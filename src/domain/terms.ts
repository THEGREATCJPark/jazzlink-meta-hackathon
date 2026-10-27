/** Pure domain helpers. Authentication, authorisation and atomic persistence belong on the server. */
export const TERM_FIELDS = ["title", "venue", "date", "artist", "sets", "feeCents", "ticketCents", "paymentTerms"] as const;
export type TermField = (typeof TERM_FIELDS)[number];
export type CandidateStatus = "stated" | "proposed" | "accepted" | "rejected" | "withdrawn" | "unclear";

export type Source = { id: string; text: string };
export type Evidence = { sourceId: string; quote: string };
/** A model interpretation is never an approval or a claim of authenticated identity. */
export type TermCandidate = { field: TermField; value: string; quote: string; status: CandidateStatus; sourceId: string };
export type Extraction = { candidates: TermCandidate[]; questions: string[] };
export type FieldOrigin =
  | { kind: "human"; reviewedBy: string }
  | { kind: "source"; reviewedBy: string; evidence: Evidence; interpretation: CandidateStatus };
export type TermEntry = { value: string; origin: FieldOrigin };
export type TermsDraft = { schemaVersion: 1; timezone: "America/New_York"; fields: Partial<Record<TermField, TermEntry>> };
export type ReviewedTerms = { revision: number; reviewedBy: string; terms: TermsDraft; unresolved: string[] };

const fields = new Set<string>(TERM_FIELDS);
const statuses = new Set<string>(["stated", "proposed", "accepted", "rejected", "withdrawn", "unclear"]);
const publicFields: readonly TermField[] = ["title", "venue", "date", "artist", "sets", "ticketCents"];

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalized values are strings at the API boundary. Money is integer USD cents. */
export function isValidTermValue(field: TermField, value: string): boolean {
  if (!value.trim() || value.length > 1000) return false;
  if (field === "feeCents" || field === "ticketCents") {
    return /^(?:0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value));
  }
  if (field === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  if (field === "sets") {
    return value.split(",").every((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time.trim()));
  }
  return true;
}

export function dollarsToCents(value: string): number | null {
  const clean = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(clean)) return null;
  const [dollars, fraction = ""] = clean.split(".");
  const result = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}

/** Validate output shape and exact source inclusion, not whether a quote semantically entails a value. */
export function validateExtraction(input: unknown, source: Source): { ok: true; result: Extraction } | { ok: false; errors: string[] } {
  if (!source.id || !source.text || !object(input) || !Array.isArray(input.candidates) || !Array.isArray(input.questions)) {
    return { ok: false, errors: ["Invalid extraction or source."] };
  }
  if (input.candidates.length > 100 || input.questions.length > 30) return { ok: false, errors: ["Extraction is too large."] };
  const errors: string[] = [];
  const candidates: TermCandidate[] = [];
  input.candidates.forEach((candidate, index) => {
    if (!object(candidate) || typeof candidate.field !== "string" || !fields.has(candidate.field) ||
        typeof candidate.value !== "string" || typeof candidate.quote !== "string" ||
        typeof candidate.status !== "string" || !statuses.has(candidate.status)) {
      errors.push(`Candidate ${index + 1} has invalid shape.`);
      return;
    }
    const field = candidate.field as TermField;
    if (!isValidTermValue(field, candidate.value)) errors.push(`Candidate ${index + 1} has invalid value.`);
    if (!candidate.quote.trim() || !source.text.includes(candidate.quote)) errors.push(`Candidate ${index + 1} has no exact source quote.`);
    if (field === "date" && !candidate.quote.includes(candidate.value.slice(0, 4))) errors.push(`Candidate ${index + 1} has no explicit year in its evidence.`);
    candidates.push({ field, value: candidate.value, quote: candidate.quote, status: candidate.status as CandidateStatus, sourceId: source.id });
  });
  if (input.questions.some((question) => typeof question !== "string" || !question.trim() || question.length > 1000)) errors.push("Questions must be non-empty strings.");
  if (errors.length) return { ok: false, errors };
  return { ok: true, result: { candidates, questions: input.questions as string[] } };
}

export function emptyTermsDraft(): TermsDraft {
  return { schemaVersion: 1, timezone: "America/New_York", fields: {} };
}

/** Empty input clears the field; unknown is not zero. Actor must come from a trusted server session. */
export function applyHumanEdit(draft: TermsDraft, field: TermField, value: string, actor: string): TermsDraft {
  if (!actor.trim()) throw new Error("A reviewer is required.");
  const normalized = value.trim();
  if (normalized && !isValidTermValue(field, normalized)) throw new Error("Invalid field value.");
  const nextFields = { ...draft.fields };
  if (!normalized) delete nextFields[field];
  else nextFields[field] = { value: normalized, origin: { kind: "human", reviewedBy: actor } };
  return { ...draft, fields: nextFields };
}

/** Requires an explicit review action; a proposed/accepted model status is not bilateral consent. */
export function applyReviewedCandidate(draft: TermsDraft, candidate: TermCandidate, source: Source, actor: string): TermsDraft {
  if (!actor.trim() || candidate.sourceId !== source.id || !candidate.quote.trim() || !source.text.includes(candidate.quote) ||
      !isValidTermValue(candidate.field, candidate.value)) throw new Error("Invalid candidate or source.");
  return { ...draft, fields: { ...draft.fields, [candidate.field]: { value: candidate.value,
    origin: { kind: "source", reviewedBy: actor, evidence: { sourceId: source.id, quote: candidate.quote }, interpretation: candidate.status } } } };
}

/** Returns a detached copy. Server must atomically check revision and append immutable persistence. */
export function reviewTerms(draft: TermsDraft, previousRevision: number, expectedRevision: number, actor: string, unresolved: string[]): ReviewedTerms {
  if (!Number.isSafeInteger(previousRevision) || previousRevision < 0 || expectedRevision !== previousRevision) throw new Error("Stale revision.");
  if (!actor.trim() || unresolved.some((item) => !item.trim())) throw new Error("Invalid review.");
  return { revision: previousRevision + 1, reviewedBy: actor, terms: structuredClone(draft), unresolved: [...unresolved] };
}

/** Only explicitly public fields are projected; private source quotes and fee never leave with this object. */
export function publicTerms(draft: TermsDraft, explicitlyShareable: readonly TermField[]): Partial<Record<TermField, string>> {
  const result: Partial<Record<TermField, string>> = {};
  for (const field of publicFields) {
    const entry = draft.fields[field];
    if (entry && explicitlyShareable.includes(field)) result[field] = entry.value;
  }
  return result;
}

export function changedPublicFields(before: TermsDraft, after: TermsDraft, explicitlyShareable: readonly TermField[]): TermField[] {
  return publicFields.filter((field) => explicitlyShareable.includes(field) && before.fields[field]?.value !== after.fields[field]?.value);
}
