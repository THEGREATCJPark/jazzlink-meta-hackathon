import PublicTermsCard from "@/components/PublicTermsCard";
import { feeContextFor, fields, itemStatus, koreanLabels, mayShareItem, validItem, type Field, type Review } from "./model";

/** Renders only the latest reviewed snapshot; the public card receives an explicit field allowlist. */
export function TermsSheet({ revision, review }: { revision: number; review: Review }) {
  const feeContext = feeContextFor(review);
  const publicValue = (field: Field) => {
    const item = review.items.find((entry) => entry.field === field && entry.selected && entry.publicShare && validItem(entry) && mayShareItem(entry));
    if (!item) return undefined;
    if (field === "ticketCents") return typeof item.amountCents === "number" && Number.isSafeInteger(item.amountCents) ? String(item.amountCents) : undefined;
    return item.editedValue.trim();
  };
  return <section className="terms-output" aria-labelledby="terms-title">
    <div className="terms-sheet">
      <p className="kicker">YOUR REVIEWED TERMS · REVISION {revision}</p>
      <h2 id="terms-title">Personal review / 개인 검토</h2>
      <p className="terms-lead">This is your own review, not a contract or proof of the other party’s approval. Unselected fields remain unresolved.</p>
      {feeContext?.previousFeeApplicability === "needs_reconfirmation" && <p className="callout callout-warning">The earlier fee’s application to the changed schedule is unconfirmed. Review it with the other party.</p>}
      <dl>{fields.map((field) => {
        const selected = review.items.find((item) => item.field === field.key && item.selected);
        return <div key={field.key} className={selected ? "" : "is-unresolved"}><dt>{field.label} / {koreanLabels[field.key]}</dt><dd>{selected?.editedValue || "Not selected / 미선택"}{selected && <small> · {itemStatus(selected)}</small>}</dd></div>;
      })}</dl>
    </div>
    <PublicTermsCard revision={revision} title={publicValue("title")} venue={publicValue("venue")} date={publicValue("date")} artist={publicValue("artist")} sets={publicValue("sets")} setCount={review.items.find((item) => item.field === "setCount" && item.selected && validItem(item))?.editedValue} ticketCents={publicValue("ticketCents")} />
  </section>;
}
