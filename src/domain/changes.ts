import { TERM_FIELDS, reviewTerms, validateExtraction, type ReviewedTerms, type Source, type TermCandidate, type TermField, type TermsDraft } from "./terms.ts";

type DeepReadonly<T> = T extends (...args: never[]) => unknown ? T : T extends object ? { readonly [P in keyof T]: DeepReadonly<T[P]> } : T;

/** An alternative is a model interpretation that requires a person to inspect its evidence. */
export type CandidateAlternative = {
  candidate: TermCandidate;
  differsFromReviewed: boolean;
  requiresHumanReview: true;
};

export type FieldComparison = {
  field: TermField;
  reviewedValue: string | null;
  alternatives: CandidateAlternative[];
  conflictingCandidates: boolean;
  hasPendingProposal: boolean;
  hasUnclearInterpretation: boolean;
};

export type ChangeComparison = {
  fields: FieldComparison[];
  unknownReviewedFields: TermField[];
  /** These are suggestions, not evidence of consent or of what will happen next. */
  questions: string[];
};

/** Validate every source independently; duplicated IDs are ambiguous and rejected. */
export function compareCandidateSources(
  reviewed: TermsDraft,
  sources: readonly Source[],
  candidates: readonly TermCandidate[],
  questions: readonly string[] = [],
): { ok: true; comparison: ChangeComparison } | { ok: false; errors: string[] } {
  const sourceMap = new Map<string, Source>();
  for (const source of sources) {
    if (!source.id.trim() || !source.text || sourceMap.has(source.id)) {
      return { ok: false, errors: ["Sources must have distinct, nonempty IDs and text."] };
    }
    sourceMap.set(source.id, source);
  }
  const verified: TermCandidate[] = [];
  const errors: string[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const source = sourceMap.get(candidate.sourceId);
    if (!source) {
      errors.push(`Candidate ${index + 1} has no matching source.`);
      continue;
    }
    // Reuse the exact quote, date-year, field, value and status checks for every source.
    const result = validateExtraction({ candidates: [candidate], questions: [] }, source);
    if (!result.ok) errors.push(`Candidate ${index + 1}: ${result.errors.join(" ")}`);
    else verified.push(result.result.candidates[0]);
  }
  if (questions.some((question) => typeof question !== "string" || !question.trim() || question.length > 1000)) {
    errors.push("Questions must be non-empty strings.");
  }
  if (candidates.length > 100 || questions.length > 30) errors.push("Comparison is too large.");
  if (errors.length) return { ok: false, errors };

  const compared: FieldComparison[] = [];
  for (const field of TERM_FIELDS) {
    const fieldCandidates = verified.filter((candidate) => candidate.field === field);
    if (!fieldCandidates.length) continue;
    const reviewedValue = reviewed.fields[field]?.value ?? null;
    // A rejected proposal is still evidence, but is not treated as an actionable competing value.
    const activeValues = new Set(fieldCandidates.filter((candidate) => candidate.status !== "rejected").map((candidate) => candidate.value));
    compared.push({
      field,
      reviewedValue,
      alternatives: fieldCandidates.map((candidate) => ({
        candidate: { ...candidate },
        differsFromReviewed: candidate.value !== reviewedValue,
        requiresHumanReview: true,
      })),
      conflictingCandidates: activeValues.size > 1,
      hasPendingProposal: fieldCandidates.some((candidate) => candidate.status === "proposed"),
      hasUnclearInterpretation: fieldCandidates.some((candidate) => candidate.status === "unclear"),
    });
  }
  return { ok: true, comparison: {
    fields: compared,
    unknownReviewedFields: TERM_FIELDS.filter((field) => !reviewed.fields[field]),
    questions: [...questions],
  } };
}

function deepFreeze<T extends object>(value: T): DeepReadonly<T> {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") deepFreeze(nested as object);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

/**
 * Produces a detached, frozen in-memory snapshot. This does not authenticate an actor,
 * enforce database immutability, or replace an atomic expected-revision check.
 */
export function createImmutableReviewedTerms(
  draft: TermsDraft,
  previousRevision: number,
  expectedRevision: number,
  actor: string,
  unresolved: string[],
): DeepReadonly<ReviewedTerms> {
  return deepFreeze(reviewTerms(draft, previousRevision, expectedRevision, actor, unresolved));
}
