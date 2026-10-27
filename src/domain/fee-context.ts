import type { CandidateStatus, TermField } from "./terms.ts";

/** Values are reviewed or suggested text; they are never evidence of agreement. */
export type FeeContextCandidate = {
  field: TermField;
  value: string;
  status: CandidateStatus;
  selected: boolean;
  /** True only for a value explicitly carried from a previous personal review. */
  fromPreviousReview: boolean;
};

export type FeeContextInput = {
  previous: { sets: string | null; setCount: string | null };
  candidates: readonly FeeContextCandidate[];
  carriedFeeSelected: boolean;
};

export type FeeContextReason =
  | "additional_sets_requested"
  | "selected_additional_sets"
  | "schedule_change_proposed"
  | "schedule_candidate_differs"
  | "selected_schedule_differs"
  | "previous_schedule_unknown"
  | "invalid_schedule_value";

export type FeeContextAssessment = {
  /** A human must resolve these conditions; the function never changes a fee. */
  scheduleChangeRisk: boolean;
  reasons: FeeContextReason[];
  previousFeeApplicability: "not_carried" | "earlier_review_only" | "needs_reconfirmation";
  /** New fee candidates remain unverified even when selected; cents are not a consent signal. */
  newFeeCandidates: { value: string; status: CandidateStatus; selected: boolean }[];
};

function normalizeSchedule(field: "sets" | "setCount", value: string | null): string | null {
  if (!value?.trim()) return null;
  if (field === "setCount") return /^[1-9]\d?$/.test(value.trim()) ? String(Number(value.trim())) : null;
  const times = value.split(",").map((time) => time.trim());
  return times.every((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) ? times.join(",") : null;
}

/**
 * Only assesses whether a prior fee needs checking after schedule changes.
 * It does not select a winner, add set counts, mutate inputs, or infer consent.
 */
export function assessFeeContext(input: FeeContextInput): FeeContextAssessment {
  const reasons = new Set<FeeContextReason>();
  const newFeeCandidates: FeeContextAssessment["newFeeCandidates"] = [];

  for (const candidate of input.candidates) {
    if (candidate.field === "feeCents" && !candidate.fromPreviousReview && candidate.value.trim()) {
      newFeeCandidates.push({ value: candidate.value, status: candidate.status, selected: candidate.selected });
    }

    const inactive = candidate.status === "rejected" || candidate.status === "withdrawn";
    if (inactive && !candidate.selected) continue;

    if (candidate.field === "additionalSets") {
      if (candidate.value.trim()) {
        if (candidate.selected) reasons.add("selected_additional_sets");
        else if (!candidate.fromPreviousReview) reasons.add("additional_sets_requested");
      }
      continue;
    }
    if (candidate.field !== "sets" && candidate.field !== "setCount") continue;
    if (!candidate.value.trim() && !candidate.selected) continue;

    const current = normalizeSchedule(candidate.field, candidate.value);
    if (current === null) {
      reasons.add("invalid_schedule_value");
      continue;
    }
    const previous = normalizeSchedule(candidate.field, input.previous[candidate.field]);
    if (previous === null) reasons.add("previous_schedule_unknown");
    else if (current !== previous) reasons.add(candidate.selected ? "selected_schedule_differs" : "schedule_candidate_differs");

    if (!candidate.fromPreviousReview && candidate.status === "proposed") reasons.add("schedule_change_proposed");
  }

  const scheduleChangeRisk = reasons.size > 0;
  return {
    scheduleChangeRisk,
    reasons: [...reasons],
    previousFeeApplicability: !input.carriedFeeSelected ? "not_carried" : scheduleChangeRisk ? "needs_reconfirmation" : "earlier_review_only",
    newFeeCandidates,
  };
}
