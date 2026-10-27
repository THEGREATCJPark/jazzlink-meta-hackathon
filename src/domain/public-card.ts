import { isValidTermValue } from "./terms.ts";
import { validateNewYorkSchedule } from "./timezone.ts";

/** Only information intended for public output belongs in this input. */
export type PublicCardInput = {
  revision: number;
  title?: string | null;
  venue?: string | null;
  date?: string | null;
  artist?: string | null;
  sets?: string | null;
  setCount?: string | null;
  ticketCents?: string | null;
};

const centsPattern = /^\d{1,12}$/;

export function ticketLabel(value: string): string {
  if (!value) return "Not specified";
  if (!centsPattern.test(value)) return "Invalid ticket price";
  const digits = value.replace(/^0+(?=\d)/, "").padStart(3, "0");
  const dollars = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return "$" + dollars + "." + digits.slice(-2);
}

/** Validate before download; a missing set count remains unknown, never inferred. */
export function validatePublicCard(input: PublicCardInput) {
  const title = input.title?.trim() || "";
  const venue = input.venue?.trim() || "";
  const artist = input.artist?.trim() || "";
  const date = input.date?.trim() || "";
  const sets = input.sets?.trim() || "";
  const setCount = input.setCount?.trim() || "";
  const ticketCents = input.ticketCents?.trim() || "";

  const missingTitle = !title;
  const missingVenue = !venue;
  const missingArtist = !artist;
  const invalidDate = !isValidTermValue("date", date);
  const invalidTime = sets.length > 120 || !isValidTermValue("sets", sets);
  const invalidTicket = Boolean(ticketCents && !centsPattern.test(ticketCents));
  const invalidText = [title, venue, artist].some((value) =>
    Array.from(value).length > 120 || /[\u0000-\u001F\u007F]/.test(value));
  const invalidRevision = !Number.isSafeInteger(input.revision) || input.revision <= 0;
  const invalidSetCount = Boolean(setCount && !isValidTermValue("setCount", setCount));
  const setCountMismatch = Boolean(setCount && !invalidSetCount && !invalidTime && Number(setCount) !== sets.split(",").length);
  const schedule = validateNewYorkSchedule(date, sets);
  const canExport = !missingTitle && !missingVenue && !missingArtist && !invalidDate && !invalidTime &&
    !invalidTicket && !invalidText && !invalidRevision && !invalidSetCount && !setCountMismatch &&
    schedule.status === "valid";

  return {
    canExport, missingTitle, missingVenue, missingArtist, invalidDate, invalidTime, invalidTicket,
    invalidText, invalidRevision, invalidSetCount, setCountMismatch, scheduleStatus: schedule.status,
  };
}
