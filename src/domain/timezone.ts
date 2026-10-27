/** Convert explicit local times using the runtime's IANA timezone data. */
export const GIG_TIME_ZONE = "America/New_York";

export type LocalTimeResult = {
  status: "valid" | "missing" | "invalid" | "nonexistent" | "ambiguous" | "unavailable";
  /** Matching UTC instants. An ambiguous local time has two; none is selected automatically. */
  instants: string[];
};

export type ScheduleResult = {
  status: LocalTimeResult["status"] | "overnight_date_needed";
  entries: { localTime: string; result: LocalTimeResult }[];
};

type WallParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function utcMilliseconds(parts: WallParts): number {
  // Date.UTC treats years 0–99 as 1900–1999, so set the full year explicitly.
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return date.valueOf();
}

function parseInput(date: string, time: string): WallParts | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const wall = { year, month, day, hour, minute, second: 0 };
  const check = new Date(utcMilliseconds(wall));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return wall;
}

function readWallParts(formatter: Intl.DateTimeFormat, instant: number): WallParts {
  const parts = formatter.formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const era = get("era");
  const rawYear = Number(get("year"));
  const wall = {
    year: era === "BC" ? 1 - rawYear : rawYear,
    month: Number(get("month")), day: Number(get("day")),
    hour: Number(get("hour")), minute: Number(get("minute")), second: Number(get("second")),
  };
  if ((era !== "AD" && era !== "BC") || Object.values(wall).some((value) => !Number.isInteger(value))) {
    throw new Error("Timezone data is unavailable or invalid.");
  }
  return wall;
}

/**
 * One explicit New York wall-clock minute may correspond to zero, one or two
 * instants at a clock change. We never select a side of a fold or invent a date.
 * Offset candidates come from the runtime's timezone data around this date.
 */
export function classifyNewYorkLocalTime(date?: string | null, time?: string | null): LocalTimeResult {
  if (!date?.trim() || !time?.trim()) return { status: "missing", instants: [] };
  const wall = parseInput(date.trim(), time.trim());
  if (!wall) return { status: "invalid", instants: [] };
  try {
    const formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone: GIG_TIME_ZONE, era: "short", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    const localAsUtc = utcMilliseconds(wall);
    const offsets = new Set<number>();
    // Hourly samples across both sides of nearby New York clock changes.
    for (let hour = -36; hour <= 36; hour += 1) {
      const instant = localAsUtc + hour * 3_600_000;
      offsets.add(utcMilliseconds(readWallParts(formatter, instant)) - instant);
    }
    const matches = new Set<number>();
    for (const offset of offsets) {
      const candidate = localAsUtc - offset;
      const actual = readWallParts(formatter, candidate);
      if (actual.year === wall.year && actual.month === wall.month && actual.day === wall.day &&
          actual.hour === wall.hour && actual.minute === wall.minute && actual.second === 0) {
        matches.add(candidate);
      }
    }
    const instants = [...matches].sort((a, b) => a - b).map((instant) => new Date(instant).toISOString());
    if (!instants.length) return { status: "nonexistent", instants };
    if (instants.length > 1) return { status: "ambiguous", instants };
    return { status: "valid", instants };
  } catch {
    return { status: "unavailable", instants: [] };
  }
}

/**
 * A descending time list may cross midnight. This format has no date per set,
 * so require clarification rather than silently assigning the next day.
 */
export function validateNewYorkSchedule(date?: string | null, sets?: string | null): ScheduleResult {
  if (!date?.trim() || !sets?.trim()) return { status: "missing", entries: [] };
  const times = sets.split(",").map((time) => time.trim());
  const entries = times.map((localTime) => ({ localTime, result: classifyNewYorkLocalTime(date, localTime) }));
  for (const status of ["invalid", "unavailable", "nonexistent", "ambiguous", "missing"] as const) {
    if (entries.some((entry) => entry.result.status === status)) return { status, entries };
  }
  if (times.some((time, index) => index > 0 && time < times[index - 1])) return { status: "overnight_date_needed", entries };
  return { status: "valid", entries };
}
