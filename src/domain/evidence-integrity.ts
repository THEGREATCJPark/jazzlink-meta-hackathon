import { canonicalizeDraftMoney } from "./canonical-draft.ts";

/**
 * Structural evidence checks only: exact quote occurrence and links to
 * selected entries in immutable history. This cannot establish whether a
 * quote supports a value, who wrote it, agreement, or whether AI was used.
 */
export type EvidenceRevision = {
  draft_id: string;
  revision: number;
  source_text: string;
  draft: unknown;
};

export type EvidenceIssue = {
  path: string;
  code: "invalid_shape" | "source_mismatch" | "quote_missing" | "history_missing" |
    "history_mismatch" | "history_ambiguous" | "history_cycle" | "verification_limit";
};

export type EvidenceCheck = { ok: true; issues: [] } | { ok: false; issues: EvidenceIssue[] };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** JSON object property order is not stable across PostgreSQL JSONB reads. */
function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameJson(value, right[index]));
  }
  if (!record(left) || !record(right)) return false;
  const keys = Object.keys(left).sort();
  const otherKeys = Object.keys(right).sort();
  return keys.length === otherKeys.length && keys.every((key, index) => key === otherKeys[index] && sameJson(left[key], right[key]));
}

function sameOriginItem(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return left.field === right.field && left.value === right.value &&
    left.quote === right.quote && left.status === right.status && left.manual === right.manual;
}

/** Legacy reviews may predate amountCents; never rewrite them or trust a conflicting stored amount. */
function canonicalHistoricalItems(items: unknown[]): unknown[] | null {
  const canonical = canonicalizeDraftMoney({ review: { items } });
  if (!canonical || !record(canonical.review) || !Array.isArray(canonical.review.items)) return null;
  const result = canonical.review.items;
  for (let index = 0; index < items.length; index += 1) {
    const original = items[index];
    const normalized = result[index];
    if (!record(original) || !record(normalized)) return null;
    if ((original.field === "feeCents" || original.field === "ticketCents") &&
        Object.hasOwn(original, "amountCents") && original.amountCents !== normalized.amountCents) return null;
  }
  return result;
}

/**
 * Revisions MUST be loaded by the server from immutable storage for this
 * authenticated user's draft, never supplied by the browser. When validating
 * a historical snapshot, currentRevision is that snapshot's revision; for
 * an editable draft it is omitted. History must contain every referenced
 * revision. Invalid/legacy rows are reported, not mutated.
 */
export function checkEvidenceIntegrity(input: {
  draftId: string;
  sourceText: string;
  review: unknown;
  revisions: readonly EvidenceRevision[];
  currentRevision?: number;
}): EvidenceCheck {
  const issues: EvidenceIssue[] = [];
  const issue = (path: string, code: EvidenceIssue["code"]) => { issues.push({ path, code }); };
  if (!input.draftId || typeof input.sourceText !== "string" || input.revisions.length > 100 ||
      (input.currentRevision !== undefined && (!Number.isSafeInteger(input.currentRevision) || input.currentRevision < 1))) {
    return { ok: false, issues: [{ path: "review", code: "invalid_shape" }] };
  }
  const history = new Map<number, EvidenceRevision>();
  for (const revision of input.revisions) {
    if (revision.draft_id !== input.draftId || !Number.isSafeInteger(revision.revision) ||
        revision.revision < 1 || typeof revision.source_text !== "string" || history.has(revision.revision)) {
      return { ok: false, issues: [{ path: "revisions", code: "history_ambiguous" }] };
    }
    history.set(revision.revision, revision);
  }

  let operations = 0;
  const maxOperations = 10000;

  /** Returns the trusted original source reached by this chain, if any. */
  function verifyItem(item: unknown, source: string, beforeRevision: number, path: string): string | null {
    operations += 1;
    if (operations > maxOperations) { issue(path, "verification_limit"); return null; }
    if (!record(item) || typeof item.field !== "string" || typeof item.value !== "string" ||
        typeof item.status !== "string" || typeof item.manual !== "boolean" || typeof item.quote !== "string") {
      issue(path, "invalid_shape");
      return null;
    }
    if (item.manual && item.quote !== "") { issue(path, "invalid_shape"); return null; }
    const carry = item.carriedFrom;
    if (carry === undefined || carry === null) {
      if (!item.manual && (!item.quote.trim() || !source.includes(item.quote))) {
        issue(path, "quote_missing");
        return null;
      }
      return source;
    }
    if (!record(carry) || !Number.isSafeInteger(carry.revision) || (carry.revision as number) < 1 || typeof carry.source !== "string") {
      issue(path, "invalid_shape");
      return null;
    }
    const revisionNumber = carry.revision as number;
    if (revisionNumber >= beforeRevision) { issue(path, "history_cycle"); return null; }
    const revision = history.get(revisionNumber);
    if (!revision || !record(revision.draft) || !record(revision.draft.review) || !Array.isArray(revision.draft.review.items)) {
      issue(path, "history_missing");
      return null;
    }
    if (revision.draft.review.source !== revision.source_text) { issue(path, "source_mismatch"); return null; }
    const matches = revision.draft.review.items.filter((candidate: unknown) =>
      record(candidate) && candidate.selected === true && sameOriginItem(item, candidate));
    if (matches.length !== 1) {
      issue(path, matches.length ? "history_ambiguous" : "history_mismatch");
      return null;
    }
    if (!canonicalHistoricalItems(matches)) { issue(path, "history_mismatch"); return null; }
    const rootSource = verifyItem(matches[0], revision.source_text, revisionNumber, path);
    if (rootSource === null) return null;
    if (carry.source !== rootSource) { issue(path, "history_mismatch"); return null; }
    return rootSource;
  }

  function verifyReview(review: unknown, source: string, beforeRevision: number, path: string) {
    if (review === null || review === undefined) return;
    if (!record(review) || typeof review.source !== "string" || !Array.isArray(review.items) || review.items.length > 100) {
      issue(path, "invalid_shape"); return;
    }
    if (review.source !== source) issue(path + ".source", "source_mismatch");
    review.items.forEach((item: unknown, index: number) => verifyItem(item, source, beforeRevision, path + ".items[" + index + "]"));

    if (review.baseline !== undefined && review.baseline !== null) {
      const baseline = review.baseline;
      if (!record(baseline) || !Number.isSafeInteger(baseline.revision) || (baseline.revision as number) < 1 ||
          typeof baseline.source !== "string" || !Array.isArray(baseline.items) || typeof baseline.fixture !== "boolean") {
        issue(path + ".baseline", "invalid_shape"); return;
      }
      const revisionNumber = baseline.revision as number;
      if (revisionNumber >= beforeRevision) { issue(path + ".baseline", "history_cycle"); return; }
      const revision = history.get(revisionNumber);
      if (!revision || !record(revision.draft) || !record(revision.draft.review) || !Array.isArray(revision.draft.review.items)) {
        issue(path + ".baseline", "history_missing"); return;
      }
      const historicalReview = revision.draft.review;
      const selected = (historicalReview.items as unknown[]).filter((item: unknown) => record(item) && item.selected === true);
      const normalizedSelected = canonicalHistoricalItems(selected);
      if (baseline.source !== revision.source_text || historicalReview.source !== revision.source_text ||
          baseline.fixture !== (historicalReview.fixture === true) || !normalizedSelected ||
          (!sameJson(baseline.items, selected) && !sameJson(baseline.items, normalizedSelected))) {
        issue(path + ".baseline", "history_mismatch"); return;
      }
      selected.forEach((item: unknown, index: number) =>
        verifyItem(item, revision.source_text, revisionNumber, path + ".baseline.items[" + index + "]"));
    }
  }

  verifyReview(input.review, input.sourceText, input.currentRevision ?? Number.POSITIVE_INFINITY, "review");
  return issues.length ? { ok: false, issues } : { ok: true, issues: [] };
}
