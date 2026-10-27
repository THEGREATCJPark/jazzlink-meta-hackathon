import { fieldLabel, itemStatus, type SavedRevision } from "./model";

export function RevisionHistory({ revisions }: { revisions: SavedRevision[] }) {
  if (!revisions.length) return null;
  return <div className="revision-history">
    <h3>Review history</h3>
    {revisions.map((revision) => <details key={revision.id}>
      <summary>Review {revision.revision} · saved draft v{revision.draft_version}</summary>
      <p>Snapshot of your review; suggestions and missing information are not counterparty approval.</p>
      <ul>{revision.draft.review?.items.map((item, index) => <li key={index}>{fieldLabel(item.field)}: {item.editedValue || "Unknown"} ({itemStatus(item)}{item.selected ? "; included in personal terms" : "; not selected"})</li>)}</ul>
      <details><summary>Source at time of review</summary><pre>{revision.source_text}</pre></details>
    </details>)}
  </div>;
}
