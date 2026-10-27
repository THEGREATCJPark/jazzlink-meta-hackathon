"use client";

import { useState } from "react";
import { validateGig, type GigDraft } from "@/domain/gig";
import "./style.css";

const initial: GigDraft = { title: "", venue: "", date: "", sets: "", artist: "", feeDollars: "", ticketDollars: "", paymentTerms: "" };
const fields: { key: keyof GigDraft; label: string; hint?: string; type?: string }[] = [
  { key: "title", label: "Gig title" }, { key: "venue", label: "Venue" },
  { key: "date", label: "Gig date", type: "date" }, { key: "sets", label: "Set times", hint: "New York time, 24-hour format. Example: 20:00, 22:00" },
  { key: "artist", label: "Artist or band" }, { key: "feeDollars", label: "Total performance fee (USD)", hint: "Private contract information" },
  { key: "ticketDollars", label: "Audience ticket price (USD)", hint: "Optional; leave blank if unknown" }, { key: "paymentTerms", label: "Payment terms", hint: "Include when and how payment will be made" },
];
export default function Home() {
  const [draft, setDraft] = useState(initial);
  const [checked, setChecked] = useState(false);
  const result = validateGig(draft);
  return <main><header><span className="brand">JAZZLINK AI</span><span className="badge">WORK IN PROGRESS</span></header>
    <section className="hero"><p className="eyebrow">MADE FOR THE MUSIC COMMUNITY</p><h1>One gig. One clear agreement.</h1><p>Bring the details together before creating a contract and sharing your show.</p></section>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">01 / GIG DETAILS</p><h2>Start with the essentials</h2></div><span>New York · USD</span></div>
      <p className="notice">Early prototype: details stay in this browser session and are not saved. AI extraction, contracts, signatures, PDF and posters are not available yet.</p>
      <form onSubmit={(event) => { event.preventDefault(); setChecked(true); }}><div className="grid">{fields.map(({ key, label, hint, type }) => <label key={key}>{label}<input type={type ?? "text"} value={draft[key]} onChange={(event) => { setDraft({ ...draft, [key]: event.target.value }); setChecked(false); }} />{hint && <small>{hint}</small>}</label>)}</div><button type="submit">Review details <span>→</span></button></form>
      {checked && <div className="review" role="status">{result.spec ? <><h3>Details ready for review</h3><p>{result.spec.title} · {result.spec.venue} · {result.spec.date}</p><p>{result.spec.sets.join(" / ")} America/New_York · {result.spec.artist}</p><p>This is a local validation only; no agreement has been saved or approved.</p></> : <><h3>More information needed</h3><ul>{result.errors.map((error) => <li key={error}>{error}</li>)}</ul></>}</div>}
    </section><footer>Built for the NYC music community · Demo uses fictional data</footer></main>;
}
