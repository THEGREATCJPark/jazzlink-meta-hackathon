import { dollarsToCents, TERM_FIELDS } from "./terms.ts";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalItems(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const items: Record<string, unknown>[] = [];
  for (const item of value) {
    if (!object(item) || typeof item.field !== "string" || !TERM_FIELDS.some((field) => field === item.field) || typeof item.editedValue !== "string") return null;
    if (item.selected !== undefined && typeof item.selected !== "boolean") return null;
    if (item.field !== "feeCents" && item.field !== "ticketCents") {
      if (Object.hasOwn(item, "amountCents")) return null;
      items.push({ ...item });
      continue;
    }
    const editedValue = item.editedValue.trim();
    const cents = editedValue ? dollarsToCents(editedValue) : null;
    if (item.selected === true && cents === null) return null;
    items.push({ ...item, editedValue, amountCents: cents });
  }
  return items;
}

/** Recompute money server-side; display dollars never serve as the canonical amount. */
export function canonicalizeDraftMoney(input: Record<string, unknown>): Record<string, unknown> | null {
  if (Object.keys(input).some((key) => key !== "review")) return null;
  const review = input.review;
  if (review === null || review === undefined) return { ...input };
  if (!object(review)) return null;
  const items = canonicalItems(review.items);
  if (!items) return null;
  let baseline = review.baseline;
  if (baseline !== undefined && baseline !== null) {
    if (!object(baseline)) return null;
    const baselineItems = canonicalItems(baseline.items);
    if (!baselineItems) return null;
    baseline = { ...baseline, items: baselineItems };
  }
  return { ...input, review: { ...review, items, ...(baseline === undefined ? {} : { baseline }) } };
}
