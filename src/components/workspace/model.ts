import { dollarsToCents, isValidTermValue } from "@/domain/terms";
import { mayPublish, valueWasEdited } from "@/domain/publication";
import { assessFeeContext } from "@/domain/fee-context";

export type Field = "title" | "venue" | "date" | "artist" | "sets" | "setCount" | "additionalSets" | "feeCents" | "ticketCents" | "paymentTerms";
export type Interpretation = "stated" | "proposed" | "accepted" | "rejected" | "withdrawn" | "unclear";
export type Candidate = { field: Field; value: string; quote: string; status: Interpretation };
export type ReviewItem = Candidate & { editedValue: string; edited: boolean; manual: boolean; selected?: boolean; publicShare?: boolean; publishConfirmed?: boolean; amountCents?: number | null; carriedFrom?: { revision: number; source: string; fixture: boolean } };
export type Baseline = { revision: number; source: string; fixture: boolean; items: ReviewItem[] };
export type Review = { source: string; items: ReviewItem[]; questions: string[]; fixture?: boolean; manualOnly?: boolean; baseline?: Baseline };
export type SavedDraft = { id: string; source_text: string; draft: { review?: Review | null }; version: number; updated_at: string };
export type SavedRevision = { id: string; draft_id: string; revision: number; draft_version: number; source_text: string; draft: { review?: Review | null }; created_at: string };

export const fields: { key: Field; label: string; hint: string }[] = [
  { key: "title", label: "Gig title", hint: "Public information" },
  { key: "venue", label: "Venue", hint: "Public information" },
  { key: "date", label: "Performance date", hint: "America/New_York" },
  { key: "artist", label: "Artist or band", hint: "Public information" },
  { key: "sets", label: "Set times", hint: "America/New_York" },
  { key: "setCount", label: "Total set count", hint: "Total sets for this gig" },
  { key: "additionalSets", label: "Additional sets requested", hint: "Request only; not automatically added to total" },
  { key: "feeCents", label: "Performance fee", hint: "Private · USD" },
  { key: "ticketCents", label: "Audience ticket price", hint: "Public · USD" },
  { key: "paymentTerms", label: "Payment terms", hint: "Private" },
];
const fieldKeys = new Set(fields.map((field) => field.key));
export const koreanLabels: Record<Field, string> = { title: "공연명", venue: "장소", date: "공연 날짜", artist: "출연자", sets: "세트 시간", setCount: "총 세트 수", additionalSets: "추가 요청 세트 수", feeCents: "출연료", ticketCents: "입장권", paymentTerms: "지급 조건" };
export const publicFields = new Set<Field>(["title", "venue", "date", "artist", "sets", "ticketCents"]);
const statuses = new Set<Interpretation>(["stated", "proposed", "accepted", "rejected", "withdrawn", "unclear"]);

export const fieldLabel = (key: Field) => fields.find((field) => field.key === key)?.label ?? key;

export const sample = `Venue: Hi! Could your jazz trio play Blue Alley on November 20?
Musician: Yes, we're available. We can play two sets at 8 PM and 10 PM.
Venue: Great, the total performance fee would be $900.
Musician: Thanks, I'll confirm the remaining details.

Later, venue: Could we start at 9 PM and add another set?`;

export const labels: Record<Interpretation, string> = {
  stated: "Mentioned",
  proposed: "Proposal",
  accepted: "Possible acceptance",
  rejected: "Possible rejection",
  withdrawn: "Possibly withdrawn",
  unclear: "Needs review",
};

export function displayValue(candidate: Candidate) {
  if (candidate.field !== "feeCents" && candidate.field !== "ticketCents") return candidate.value;
  if (!/^\d+$/.test(candidate.value)) return candidate.value;
  const amount = Number(candidate.value);
  return Number.isSafeInteger(amount) ? (amount / 100).toFixed(2) : candidate.value;
}

export function validItem(item: ReviewItem) {
  const value = item.editedValue.trim();
  if (item.field === "feeCents" || item.field === "ticketCents") return dollarsToCents(value) !== null;
  return isValidTermValue(item.field, value);
}

export function itemWasEdited(item: ReviewItem) {
  return valueWasEdited(displayValue(item), item.editedValue, item.edited);
}

export function mayShareItem(item: ReviewItem) {
  return mayPublish({ ...item, edited: itemWasEdited(item) });
}

export function itemStatus(item: ReviewItem) {
  const origin = item.manual ? "Your entry" : itemWasEdited(item) ? `Your edit; original suggestion: ${labels[item.status]}` : labels[item.status];
  return item.carriedFrom ? `${origin} · carried from personal review ${item.carriedFrom.revision}` : origin;
}

export function parseResult(data: unknown, source: string): Review {
  if (!data || typeof data !== "object" || !("candidates" in data) || !Array.isArray(data.candidates) || !("questions" in data) || !Array.isArray(data.questions)) {
    throw new Error("We couldn't read the response. Your text is still here; please try again.");
  }
  const items: ReviewItem[] = [];
  for (const entry of data.candidates as unknown[]) {
    if (!entry || typeof entry !== "object") throw new Error("The response was incomplete. Your text is still here.");
    const item = entry as Record<string, unknown>;
    if (typeof item.field !== "string" || !fieldKeys.has(item.field as Field) ||
      typeof item.value !== "string" || typeof item.quote !== "string" ||
      typeof item.status !== "string" || !statuses.has(item.status as Interpretation)) {
      throw new Error("The response was incomplete. Your text is still here.");
    }
    const candidate = item as Candidate;
    if (!candidate.quote || !source.includes(candidate.quote)) {
      throw new Error("A source quote could not be matched. Your text is still here; try again or review it manually.");
    }
    items.push({ ...candidate, editedValue: displayValue(candidate), edited: false, manual: false });
  }
  if (!data.questions.every((question: unknown) => typeof question === "string")) {
    throw new Error("The response was incomplete. Your text is still here.");
  }
  return { source, items, questions: data.questions as string[] };
}

export function feeContextFor(review: Review | null | undefined) {
  const baseline = review?.baseline;
  if (!review || !baseline) return null;
  const previous = (field: Field) => baseline.items.find((item) => item.field === field)?.editedValue.trim() ?? null;
  const oldFee = previous("feeCents");
  const isEarlierValue = (item: ReviewItem) => Boolean(item.carriedFrom) &&
    (item.field !== "feeCents" || (oldFee !== null && item.editedValue.trim() === oldFee));
  return assessFeeContext({
    previous: { sets: previous("sets"), setCount: previous("setCount") },
    candidates: review.items.map((item) => ({ field: item.field, value: item.editedValue, status: item.status,
      selected: item.selected === true, fromPreviousReview: isEarlierValue(item) })),
    carriedFeeSelected: review.items.some((item) => item.field === "feeCents" && item.selected && isEarlierValue(item)),
  });
}
