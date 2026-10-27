export type GigDraft = {
  title: string;
  venue: string;
  date: string;
  sets: string;
  artist: string;
  feeDollars: string;
  ticketDollars: string;
  paymentTerms: string;
};

export type GigSpec = {
  schemaVersion: 1;
  revision: number;
  timezone: "America/New_York";
  title: string;
  venue: string;
  date: string;
  sets: string[];
  artist: string;
  feeCents: number;
  ticketCents: number | null;
  paymentTerms: string;
};

function cents(value: string): number | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [dollars, fraction = ""] = value.trim().split(".");
  const result = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}

export function validateGig(draft: GigDraft): { errors: string[]; spec: GigSpec | null } {
  const errors: string[] = [];
  for (const [label, value] of [["Gig title", draft.title], ["Venue", draft.venue], ["Artist / band", draft.artist], ["Payment terms", draft.paymentTerms]] as const) {
    if (!value.trim()) errors.push(`${label} is required.`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(draft.date);
  const date = match ? new Date(`${draft.date}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== draft.date) errors.push("Enter a valid gig date.");
  const sets = draft.sets.split(",").map((s) => s.trim()).filter(Boolean);
  if (!sets.length || sets.some((s) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s))) errors.push("Enter set times as 24-hour HH:MM, separated by commas.");
  const fee = cents(draft.feeDollars);
  if (fee === null) errors.push("Enter the total performance fee in USD with up to two decimal places.");
  const ticket = draft.ticketDollars.trim() ? cents(draft.ticketDollars) : null;
  if (draft.ticketDollars.trim() && ticket === null) errors.push("Enter a valid ticket price or leave it unknown.");
  if (errors.length || fee === null) return { errors, spec: null };
  return { errors, spec: { schemaVersion: 1, revision: 1, timezone: "America/New_York", title: draft.title.trim(), venue: draft.venue.trim(), date: draft.date, sets, artist: draft.artist.trim(), feeCents: fee, ticketCents: ticket, paymentTerms: draft.paymentTerms.trim() } };
}
