import { displayValue, fields, itemWasEdited, labels, mayShareItem, publicFields, validItem, type ReviewItem } from "./model";

type Props = {
  item: ReviewItem;
  index: number;
  freshModelReview: boolean;
  locked: boolean;
  evidenceOk: boolean;
  onValue: (value: string) => void;
  onSelect: (selected: boolean) => void;
  onPublicShare: (share: boolean) => void;
  onConfirmPublic: (confirmed: boolean) => void;
};

/** One candidate value. Editing clears selection so a changed value is never silently kept as reviewed. */
export function DetailCard({ item, index, freshModelReview, locked, evidenceOk, onValue, onSelect, onPublicShare, onConfirmPublic }: Props) {
  const field = fields.find((entry) => entry.key === item.field);
  const edited = itemWasEdited(item);
  const invalid = !validItem(item) && item.editedValue.trim() !== "";
  const inputId = "detail-" + index;
  return <details className={"detail-card" + (item.selected ? " is-selected" : "")} open={item.manual || undefined}>
    <summary className="detail-top">
      <span className="detail-heading"><strong>{field?.label}</strong><span className="detail-preview">{item.editedValue || "No value entered"}{item.selected ? " · Included in your review" : " · Not selected"}</span></span>
      <span className={"status-chip status-" + (item.manual ? "manual" : item.status)}>{item.manual ? "Your entry" : labels[item.status]}</span>
    </summary>
    <div className="detail-body">
      <p className="field-hint">{field?.hint}</p>
      <label className="detail-label" htmlFor={inputId}>{edited ? "Your edit (not saved or approved)" : freshModelReview && !item.carriedFrom ? "AI-suggested value" : "Suggested value"}</label>
      <input id={inputId} value={item.editedValue} disabled={locked} aria-invalid={invalid || undefined} aria-describedby={invalid ? inputId + "-error" : undefined} onChange={(event) => onValue(event.target.value)} placeholder="Unknown" />
      {invalid && <p className="edit-explanation is-error" id={inputId + "-error"}>Use a valid value: dates need YYYY-MM-DD, times use HH:MM, and amounts use USD dollars.</p>}
      <label className="check-row"><input type="checkbox" checked={item.selected ?? false} disabled={locked || !validItem(item)} onChange={(event) => onSelect(event.target.checked)} /> Include this value in my reviewed terms</label>
      {publicFields.has(item.field) && item.selected && <details className="item-disclosure"><summary>Public card options</summary>
        {(item.status !== "stated" || edited || item.manual) && <label className="check-row"><input type="checkbox" checked={item.publishConfirmed ?? false} disabled={locked} onChange={(event) => onConfirmPublic(event.target.checked)} /> I separately checked this is the current value I want to publish. This does not verify the other party’s consent.</label>}
        <label className="check-row"><input type="checkbox" checked={Boolean(item.publicShare && mayShareItem(item))} disabled={locked || !mayShareItem(item)} onChange={(event) => onPublicShare(event.target.checked)} /> Allow this field on the public card</label>
      </details>}
      {edited && !item.manual && <p className="edit-explanation">Original suggestion: {displayValue(item) || "Unknown"}. The source refers to that suggestion, not your edit.</p>}
      {item.carriedFrom && evidenceOk && <p className="edit-explanation">Carried by you from personal review {item.carriedFrom.revision}.{item.carriedFrom.fixture ? " Earlier source was a fictional example." : ""} It has not been automatically accepted by the other party.</p>}
      {item.manual ? <p className="edit-explanation">Entered by you; no source quote or counterparty approval is attached.</p> : evidenceOk ? <details className="source-quote"><summary>{item.carriedFrom ? "Source from earlier review" : "See source quote"}</summary><blockquote>“{item.quote}”</blockquote>{item.carriedFrom && <details><summary>Original source</summary><pre>{item.carriedFrom.source}</pre></details>}</details> : <p className="callout callout-warning">Source link is not verified.</p>}
    </div>
  </details>;
}
