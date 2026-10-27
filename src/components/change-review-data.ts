export type ChangeReviewRow = { field: string; label: string; value: string; status: string };

export type ChangeReviewGroup = {
  field: string;
  label: string;
  previous: ChangeReviewRow[];
  current: ChangeReviewRow[];
  hasDifferentCurrentValues: boolean;
};

/** Groups rows without choosing a winner or collapsing duplicate interpretations. */
export function groupReviewRows(previous: readonly ChangeReviewRow[], current: readonly ChangeReviewRow[]): ChangeReviewGroup[] {
  const groups = new Map<string, ChangeReviewGroup>();
  for (const [rows, side] of [[previous, "previous"], [current, "current"]] as const) {
    for (const row of rows) {
      let group = groups.get(row.field);
      if (!group) {
        group = { field: row.field, label: row.label, previous: [], current: [], hasDifferentCurrentValues: false };
        groups.set(row.field, group);
      }
      group[side].push({ ...row });
    }
  }
  for (const group of groups.values()) {
    group.hasDifferentCurrentValues = new Set(group.current.map((row) => row.value).filter((value) => value.trim())).size > 1;
  }
  return [...groups.values()];
}

/** A value match does not imply that a status, source or the counterparty's consent matched. */
export function compareRowValue(row: ChangeReviewRow, previous: readonly ChangeReviewRow[]): string {
  if (!row.value.trim()) return "Value not provided";
  const knownPrevious = previous.filter((item) => item.value.trim());
  if (!knownPrevious.length) return "No previous value to compare";
  return knownPrevious.some((item) => item.value === row.value) ? "Value matches a previous row" : "Value differs from previous rows";
}
