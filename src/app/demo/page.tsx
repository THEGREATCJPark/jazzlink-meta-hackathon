"use client";

import Link from "next/link";
import { useState } from "react";
import { ChangeReview } from "@/components/ChangeReview";
import type { ChangeReviewRow } from "@/components/change-review-data";
import PublicTermsCard from "@/components/PublicTermsCard";
import { validateNewYorkSchedule } from "@/domain/timezone";
import styles from "./demo.module.css";

type Phase = "initial" | "request" | "reply" | "reviewed";
type Snapshot = { sets: string; setCount: number; feeCents: number | null; usesNewSchedule: boolean };

const original = {
  title: "Blue Alley Jazz Night",
  artist: "The Example Trio",
  venue: "Blue Alley",
  date: "2026-11-20",
  sets: "20:00, 22:00",
  setCount: 2,
  feeCents: 90000,
};
const initialSource = "Venue: The Example Trio can play Blue Alley Jazz Night at Blue Alley on November 20, 2026. Two sets at 20:00 and 22:00, total performance fee $900. Payment date still to be confirmed.";
const requestSource = "Venue: Could we start at 21:00 and add one set?";
const replySource = "Venue: For three sets at 21:00, 22:00 and 23:00, the total performance fee would be $1,200. Payment date still to be confirmed.";
const demoQuestions = [
  "What are all the new set times?",
  "What is the total performance fee for the complete new arrangement, including the additional set?",
  "When will payment be made?",
];

const previousRows: ChangeReviewRow[] = [
  { field: "date", label: "Date", value: original.date, status: "Previously reviewed by you" },
  { field: "sets", label: "Set times", value: original.sets, status: "Previously reviewed by you" },
  { field: "setCount", label: "Total set count", value: String(original.setCount), status: "Previously reviewed by you" },
  { field: "feeCents", label: "Performance fee (private)", value: "$900.00", status: "Previously reviewed by you" },
];
const pendingRows: ChangeReviewRow[] = [
  { field: "date", label: "Date", value: original.date, status: "No change requested" },
  { field: "sets", label: "Set times", value: "21:00 requested; full schedule unknown", status: "proposed" },
  { field: "setCount", label: "Total set count", value: "Not confirmed for the request", status: "unclear" },
  { field: "additionalSets", label: "Additional sets requested", value: "1", status: "proposed" },
  { field: "feeCents", label: "Performance fee (private)", value: "Not confirmed for the request", status: "unclear" },
];

function money(cents: number | null) {
  return cents === null ? "Not confirmed" : `$${(cents / 100).toFixed(2)}`;
}

export default function DemoPage() {
  const [phase, setPhase] = useState<Phase>("initial");
  const [useNewSchedule, setUseNewSchedule] = useState(false);
  const [useNewFee, setUseNewFee] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [publicConfirmed, setPublicConfirmed] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  function reviewReply() {
    if (!reviewConfirmed) return;
    const sets = useNewSchedule ? "21:00, 22:00, 23:00" : original.sets;
    const schedule = validateNewYorkSchedule(original.date, sets);
    if (schedule.status !== "valid") {
      setMessage("The New York date or time needs clarification before review.");
      return;
    }
    setSnapshot({
      sets,
      setCount: useNewSchedule ? 3 : original.setCount,
      feeCents: useNewSchedule ? (useNewFee ? 120000 : null) : original.feeCents,
      usesNewSchedule: useNewSchedule,
    });
    setPublicConfirmed(false);
    setMessage("");
    setPhase("reviewed");
  }

  function startOver() {
    setPhase("initial");
    setUseNewSchedule(false);
    setUseNewFee(false);
    setReviewConfirmed(false);
    setPublicConfirmed(false);
    setSnapshot(null);
    setMessage("");
    setCopyMessage("");
  }

  async function copyQuestions() {
    try {
      await navigator.clipboard.writeText(demoQuestions.map((question) => `• ${question}`).join("\n"));
      setCopyMessage("Copied. Review the questions before sending them yourself.");
    } catch { setCopyMessage("Copy was unavailable. Select the questions and copy them manually."); }
  }

  const currentRows: ChangeReviewRow[] = snapshot ? [
    { field: "date", label: "Date", value: original.date, status: "Retained from earlier personal review" },
    { field: "sets", label: "Set times", value: snapshot.sets, status: snapshot.usesNewSchedule ? "Reviewed by you from fictional reply" : "Earlier value retained; request pending" },
    { field: "setCount", label: "Total set count", value: String(snapshot.setCount), status: snapshot.usesNewSchedule ? "Reviewed by you from fictional reply" : "Earlier value retained; request pending" },
    { field: "feeCents", label: "Performance fee (private)", value: money(snapshot.feeCents), status: snapshot.feeCents === null ? "unclear" : snapshot.usesNewSchedule ? "Reviewed by you; not counterparty approval" : "Earlier value retained; request pending" },
  ] : pendingRows;

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>JAZZLINK <span>AI</span></Link>
      <nav><Link href="/">Live AI workspace ↗</Link><button type="button" onClick={startOver}>Start over</button></nav>
    </header>

    <div className={styles.content}>
      <p className={styles.eyebrow}>INTERACTIVE FICTIONAL DEMO</p>
      <h1>One change. <em>A clearer conversation.</em></h1>
      <p className={styles.lead}>See how a bandleader can inspect an earlier gig and a new request without silently changing the terms.</p>
      <div className={styles.notice} role="note"><strong>This is a prewritten example, not an AI result.</strong> Your demo choices stay in this browser and are not sent or saved; reloading clears them. Blue Alley and all messages are fictional.</div>
      <p className={styles.small}>For a real Meta-powered analysis of synthetic or permission-cleared text, use the <Link href="/">signed-in workspace</Link>.</p>

      <ol className={styles.steps} aria-label="Demo steps">
        <li className={phase === "initial" ? styles.active : ""}><span>01</span> Review original details</li>
        <li className={phase === "request" ? styles.active : ""}><span>02</span> Inspect the changes</li>
        <li className={phase === "reply" || phase === "reviewed" ? styles.active : ""}><span>03</span> Record your review</li>
      </ol>

      <section className={styles.panel} aria-labelledby="initial-title">
        <p className={styles.kicker}>01 / ORIGINAL MESSAGE</p>
        <h2 id="initial-title">Start with the details you have.</h2>
        <blockquote>{initialSource}</blockquote>
        <div className={styles.grid}>
          <div><span>DATE · NEW YORK</span><strong>{original.date}</strong></div>
          <div><span>SET TIMES</span><strong>{original.sets}</strong></div>
          <div><span>TOTAL SETS</span><strong>{original.setCount}</strong></div>
          <div><span>PERFORMANCE FEE · PRIVATE</span><strong>{money(original.feeCents)}</strong></div>
        </div>
        <p className={styles.small}>The payment date is unknown. Your review is not proof that the other party approved anything in this app.</p>
        {phase === "initial" ? <button className={styles.primary} type="button" onClick={() => setPhase("request")}>I reviewed these original details →</button> : <p className={styles.done}>✓ Original details reviewed by you in this demo</p>}
      </section>

      {phase !== "initial" && <section className={styles.panel} aria-labelledby="request-title">
        <p className={styles.kicker}>02 / A NEW REQUEST</p>
        <h2 id="request-title">A request is not a change yet.</h2>
        <blockquote>{requestSource}</blockquote>
        <div className={styles.pending}><strong>Needs clarification</strong><p>Only a new start time and one extra set were requested. The full schedule and fee for that arrangement are not confirmed. The earlier review stays as it was.</p></div>
        <div className={styles.questions}><strong>Questions you could ask</strong><ul>{demoQuestions.map((question) => <li key={question}>{question}</li>)}</ul><button className={styles.secondary} type="button" onClick={copyQuestions}>Copy questions</button>{copyMessage && <p role="status">{copyMessage}</p>}<p>Nothing is sent for you.</p></div>
        <ChangeReview previous={previousRows} current={pendingRows} />
        {phase === "request" && <button className={styles.primary} type="button" onClick={() => setPhase("reply")}>Show the fictional reply →</button>}
      </section>}

      {(phase === "reply" || phase === "reviewed") && <section className={styles.panel} aria-labelledby="reply-title">
        <p className={styles.kicker}>03 / FICTIONAL REPLY</p>
        <h2 id="reply-title">You decide what to carry forward.</h2>
        <blockquote>{replySource}</blockquote>
        <p className={styles.small}>Choose values for your own review. These choices are not a signature or proof of the venue’s approval.</p>
        {phase === "reply" && <div className={styles.checks}>
          <label><input type="checkbox" checked={useNewSchedule} onChange={(event) => { setUseNewSchedule(event.target.checked); if (!event.target.checked) setUseNewFee(false); }} /> <span>Use the explicitly stated three-set schedule: 21:00, 22:00, 23:00.</span></label>
          <label><input type="checkbox" checked={useNewFee} disabled={!useNewSchedule} onChange={(event) => setUseNewFee(event.target.checked)} /> <span>Use the stated $1,200 total fee for that three-set arrangement.</span></label>
          {useNewSchedule && !useNewFee && <p className={styles.warning}>The new fee remains unconfirmed. The earlier $900 will not be carried into the three-set arrangement.</p>}
          <label><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} /> <span>I reviewed these choices and understand that unresolved items remain.</span></label>
          {message && <p className={styles.warning} role="alert">{message}</p>}
          <button className={styles.primary} type="button" disabled={!reviewConfirmed} onClick={reviewReply}>Record my demo review →</button>
        </div>}
        {phase === "reviewed" && <button className={styles.secondary} type="button" onClick={() => { setPhase("reply"); setReviewConfirmed(false); setPublicConfirmed(false); }}>Revise my choices</button>}
      </section>}

      {phase === "reviewed" && snapshot && <section className={styles.panel} aria-labelledby="result-title">
        <p className={styles.kicker}>YOUR PERSONAL REVIEW · DEMO REVISION 2</p>
        <h2 id="result-title">A version you can inspect.</h2>
        <p className={styles.small}>Venue, date and artist remain from your earlier review. Payment date remains unknown. This is not an agreement or a legal document.</p>
        <ChangeReview previous={previousRows} current={currentRows} />
        <div className={styles.grid}>
          <div><span>DATE · NEW YORK</span><strong>{original.date}</strong></div>
          <div><span>SET TIMES</span><strong>{snapshot.sets}</strong></div>
          <div><span>TOTAL SETS</span><strong>{snapshot.setCount}</strong></div>
          <div><span>PERFORMANCE FEE · PRIVATE</span><strong>{money(snapshot.feeCents)}</strong></div>
        </div>
        {!snapshot.usesNewSchedule && <p className={styles.warning}>The new schedule remains a pending request; the earlier times are shown only as your previous review.</p>}
        {snapshot.feeCents === null && <p className={styles.warning}>Fee for the new schedule is still unconfirmed.</p>}
        <label className={styles.publicCheck}><input type="checkbox" checked={publicConfirmed} disabled={!snapshot.usesNewSchedule} onChange={(event) => setPublicConfirmed(event.target.checked)} /> <span>I separately checked that the date and reviewed new set times are suitable for the public demo card.</span></label>
        {!snapshot.usesNewSchedule && <p className={styles.small}>Select the complete new schedule and review it before enabling the card.</p>}
        {snapshot.usesNewSchedule && !publicConfirmed && <p className={styles.small}>Check the public card option above to preview and download these details.</p>}
        {snapshot.usesNewSchedule && publicConfirmed && <PublicTermsCard revision={2} title={original.title} venue={original.venue} artist={original.artist}
          date={original.date} sets={snapshot.sets} setCount={String(snapshot.setCount)} />}
        <p className={styles.small}>The card is a local download only. The performance fee, messages and payment details are never passed to it.</p>
      </section>}
    </div>
    <footer className={styles.footer}>JAZZLINK AI · FICTIONAL DEMO · AMERICA/NEW_YORK · USD</footer>
  </main>;
}
