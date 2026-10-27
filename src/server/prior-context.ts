import { checkEvidenceIntegrity, type EvidenceRevision } from "../domain/evidence-integrity.ts";
import { dollarsToCents, isValidTermValue, TERM_FIELDS, type TermField } from "../domain/terms.ts";

export type ContextRequest = { draftId: string; expectedVersion: number; expectedRevision: number };
export type PriorContext = { revision: number; selected: { field: TermField; value: string; evidence: { kind: "manual" | "source"; quote?: string; edited: boolean; interpretation: string } }[] };
type Snapshot = EvidenceRevision & { draft: unknown };
type Lookup<T> = { data: T | null; error: unknown };
export type ContextRepository = {
  draft: (ownerId: string, draftId: string) => PromiseLike<Lookup<{ version: number }>>;
  history: (ownerId: string, draftId: string) => PromiseLike<Lookup<Snapshot[]>>;
};
export class ContextError extends Error {
  readonly kind: "unavailable" | "not_found" | "stale" | "invalid";
  constructor(kind: "unavailable" | "not_found" | "stale" | "invalid") { super(kind); this.kind = kind; }
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function parseContext(value: unknown): ContextRequest | null {
  if (!record(value) || Object.keys(value).some((key) => !["draftId", "expectedVersion", "expectedRevision"].includes(key)) ||
      typeof value.draftId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.draftId) ||
      !Number.isSafeInteger(value.expectedVersion) || (value.expectedVersion as number) < 1 || (value.expectedVersion as number) > 2147483647 ||
      !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0 || (value.expectedRevision as number) > 2147483647) return null;
  return value as ContextRequest;
}

/** Caller provides owner-filtered storage reads. Never accepts a client-supplied baseline. */
export async function loadPriorContext(repo: ContextRepository, ownerId: string, request: ContextRequest): Promise<PriorContext | undefined> {
  const [draft, history] = await Promise.all([repo.draft(ownerId, request.draftId), repo.history(ownerId, request.draftId)]);
  if (draft.error || history.error || history.data === null) throw new ContextError("unavailable");
  if (!draft.data) throw new ContextError("not_found");
  if (draft.data.version !== request.expectedVersion) throw new ContextError("stale");
  const revisions = history.data;
  const latest = revisions[0];
  if (!latest && request.expectedRevision === 0) return undefined;
  if (!latest || latest.revision !== request.expectedRevision) throw new ContextError("stale");
  if (!record(latest.draft) || !record(latest.draft.review) ||
      !checkEvidenceIntegrity({ draftId: request.draftId, sourceText: latest.source_text, review: latest.draft.review, revisions, currentRevision: latest.revision }).ok) throw new ContextError("invalid");
  const items = latest.draft.review.items;
  if (!Array.isArray(items)) throw new ContextError("invalid");
  const selected: PriorContext["selected"] = [];
  for (const item of items) {
    if (!record(item) || item.selected !== true) continue;
    if (typeof item.field !== "string" || !TERM_FIELDS.some((field) => field === item.field) || typeof item.editedValue !== "string" ||
        typeof item.manual !== "boolean" || typeof item.edited !== "boolean" || typeof item.status !== "string" ||
        !["stated", "proposed", "accepted", "rejected", "withdrawn", "unclear"].includes(item.status) || typeof item.quote !== "string" || item.quote.length > 1000) throw new ContextError("invalid");
    const field = item.field as TermField;
    const rawValue = item.editedValue.trim();
    const cents = field === "feeCents" || field === "ticketCents" ? dollarsToCents(rawValue) : null;
    const value = field === "feeCents" || field === "ticketCents" ? (cents === null ? "" : String(cents)) : rawValue;
    if (!isValidTermValue(field, value)) throw new ContextError("invalid");
    selected.push({ field, value, evidence: { kind: item.manual ? "manual" : "source", ...(item.manual ? {} : { quote: item.quote }), edited: item.edited, interpretation: item.status } });
  }
  const context = { revision: latest.revision, selected };
  if (JSON.stringify(context).length > 16000) throw new ContextError("invalid");
  return context;
}
