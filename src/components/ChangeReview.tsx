import { compareRowValue, groupReviewRows, type ChangeReviewRow } from "./change-review-data";
import styles from "./ChangeReview.module.css";

export type ChangeReviewProps = {
  previous: readonly ChangeReviewRow[];
  current: readonly ChangeReviewRow[];
};

const statusLabels: Record<string, string> = {
  stated: "Mentioned",
  proposed: "Proposal",
  accepted: "Possible acceptance",
  rejected: "Possible rejection",
  withdrawn: "Possibly withdrawn",
  unclear: "Needs review",
};

function statusLabel(status: string): string {
  return statusLabels[status] ?? (status.trim() || "Not specified");
}

function Rows({ rows, previous }: { rows: readonly ChangeReviewRow[]; previous?: readonly ChangeReviewRow[] }) {
  if (!rows.length) return <p className={styles.empty}>No rows for this field.</p>;
  return <ul className={styles.rows}>{rows.map((row, index) => (
    <li className={styles.row} key={index}>
      <span className={styles.value}>{row.value.trim() ? row.value : "Value not provided"}</span>
      <span className={styles.status}>Status: {statusLabel(row.status)}</span>
      {previous && <span className={styles.comparison}>{compareRowValue(row, previous)}</span>}
    </li>
  ))}</ul>;
}

/** Private in-app review only; display does not alter or approve either set of rows. */
export function ChangeReview({ previous, current }: ChangeReviewProps) {
  const groups = groupReviewRows(previous, current);
  const attention = groups.filter((group) => group.current.length > 0 && (
    group.hasDifferentCurrentValues || !group.previous.length ||
    group.current.some((row) => !group.previous.some((old) => old.value === row.value))
  ));
  const other = groups.filter((group) => !attention.includes(group));
  const renderGroup = (group: typeof groups[number]) => <article className={styles.group} key={group.field}>
    <h4>{group.label}</h4>
    {group.hasDifferentCurrentValues && <p className={styles.warning}>Multiple values are shown. Check their context before choosing.</p>}
    <div className={styles.columns}>
      <div><h5>Earlier personal review</h5><Rows rows={group.previous} /></div>
      <div><h5>Current suggestions</h5><Rows rows={group.current} previous={group.previous} /></div>
    </div>
  </article>;
  return <section className={styles.panel} aria-labelledby="change-review-title">
    <h3 id="change-review-title">Inspect the changes</h3>
    <p className={styles.intro}>Compare current suggestions with your earlier review. A difference is a request or suggestion until you decide what to include. Matching values alone do not establish agreement or counterparty approval.</p>
    {!groups.length ? <p className={styles.empty}>No details to compare yet.</p> : <>
      {attention.length ? <div className={styles.groups}>{attention.map(renderGroup)}</div> : <p className={styles.empty}>No different values are shown in the current suggestions.</p>}
      {other.length > 0 && <details className={styles.more}><summary>Other earlier or matching details ({other.length})</summary><div className={styles.groups}>{other.map(renderGroup)}</div></details>}
    </>}
  </section>;
}
