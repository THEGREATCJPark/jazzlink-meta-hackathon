"use client";

import { useState } from "react";
import Link from "next/link";
import { dollarsToCents, isValidTermValue } from "@/domain/terms";
import { ChangeReview } from "@/components/ChangeReview";
import PublicTermsCard from "@/components/PublicTermsCard";
import "./style.css";

type Field = "title" | "venue" | "date" | "artist" | "sets" | "feeCents" | "ticketCents" | "paymentTerms";
type Interpretation = "stated" | "proposed" | "accepted" | "rejected" | "withdrawn" | "unclear";
type Candidate = { field: Field; value: string; quote: string; status: Interpretation };
type ReviewItem = Candidate & { editedValue: string; edited: boolean; manual: boolean; selected?: boolean; publicShare?: boolean };
type Review = { source: string; items: ReviewItem[]; questions: string[]; fixture?: boolean };
type SavedDraft = { id: string; source_text: string; draft: { review?: Review | null }; version: number; updated_at: string };
type SavedRevision = { id: string; revision: number; draft_version: number; source_text: string; draft: { review?: Review | null }; created_at: string };

const fields: { key: Field; label: string; hint: string }[] = [
  { key: "title", label: "Gig title", hint: "Public information" },
  { key: "venue", label: "Venue", hint: "Public information" },
  { key: "date", label: "Performance date", hint: "America/New_York" },
  { key: "artist", label: "Artist or band", hint: "Public information" },
  { key: "sets", label: "Set times", hint: "America/New_York" },
  { key: "feeCents", label: "Performance fee", hint: "Private · USD" },
  { key: "ticketCents", label: "Audience ticket price", hint: "Public · USD" },
  { key: "paymentTerms", label: "Payment terms", hint: "Private" },
];
const fieldKeys = new Set(fields.map((field) => field.key));
const koreanLabels: Record<Field, string> = { title: "공연명", venue: "장소", date: "공연 날짜", artist: "출연자", sets: "세트 시간", feeCents: "출연료", ticketCents: "입장권", paymentTerms: "지급 조건" };
const publicFields = new Set<Field>(["title", "venue", "date", "artist", "sets", "ticketCents"]);
const statuses = new Set<Interpretation>(["stated", "proposed", "accepted", "rejected", "withdrawn", "unclear"]);

const sample = `Venue: Hi! Could your jazz trio play Blue Alley on November 20?
Musician: Yes, we're available. We can play two sets at 8 PM and 10 PM.
Venue: Great, the total performance fee would be $900.
Musician: Thanks, I'll confirm the remaining details.

Later, venue: Could we start at 9 PM and add another set?`;

const labels: Record<Interpretation, string> = {
  stated: "Mentioned",
  proposed: "Proposal",
  accepted: "Possible acceptance",
  rejected: "Possible rejection",
  withdrawn: "Possibly withdrawn",
  unclear: "Needs review",
};

function displayValue(candidate: Candidate) {
  if (candidate.field !== "feeCents" && candidate.field !== "ticketCents") return candidate.value;
  if (!/^\d+$/.test(candidate.value)) return candidate.value;
  const amount = Number(candidate.value);
  return Number.isSafeInteger(amount) ? (amount / 100).toFixed(2) : candidate.value;
}

function validItem(item: ReviewItem) {
  const value = item.editedValue.trim();
  if (item.field === "feeCents" || item.field === "ticketCents") return dollarsToCents(value) !== null;
  return isValidTermValue(item.field, value);
}

function parseResult(data: unknown, source: string): Review {
  if (!data || typeof data !== "object" || !("candidates" in data) || !Array.isArray(data.candidates) || !("questions" in data) || !Array.isArray(data.questions)) {
    throw new Error("We couldn't read the response. Your text is still here; please try again.");
  }
  const items: ReviewItem[] = [];
  for (const entry of data.candidates as unknown[]) {
    if (!entry || typeof entry !== "object") throw new Error("The response was incomplete. Your text is still here.");
    const item = entry as Record<string, unknown>;
    if (typeof item.field !== "string" || !fieldKeys.has(item.field as Field) ||
      typeof item.value !== "string" || typeof item.quote !== "string" ||
      typeof item.status !== "string" || !statuses.has(item.status as Interpretation)) {
      throw new Error("The response was incomplete. Your text is still here.");
    }
    const candidate = item as Candidate;
    if (!candidate.quote || !source.includes(candidate.quote)) {
      throw new Error("A source quote could not be matched. Your text is still here; try again or review it manually.");
    }
    items.push({ ...candidate, editedValue: displayValue(candidate), edited: false, manual: false });
  }
  if (!data.questions.every((question: unknown) => typeof question === "string")) {
    throw new Error("The response was incomplete. Your text is still here.");
  }
  return { source, items, questions: data.questions as string[] };
}

export default function Home() {
  const [text, setText] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [revisions, setRevisions] = useState<SavedRevision[]>([]);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  const changedSource = review !== null && review.source !== text;
  const presentFields = new Set(review?.items.filter((item) => item.editedValue.trim()).map((item) => item.field) ?? []);
  const missing = fields.filter((field) => !presentFields.has(field.key));
  const concerns = review?.items.filter((item) => item.status === "proposed" || item.status === "unclear") ?? [];
  const competingFields = fields.filter((field) => new Set((review?.items ?? [])
    .filter((item) => item.field === field.key && item.editedValue.trim())
    .map((item) => item.editedValue.trim())).size > 1);
  const hasUnsavedChanges = savedContent !== JSON.stringify({ text, review });
  const previousReview = revisions[0]?.draft.review;
  const publicValue = (field: Field) => {
    const item = previousReview?.items.find((entry) => entry.field === field && entry.selected && entry.publicShare && validItem(entry));
    if (!item) return undefined;
    if (field === "ticketCents") return String(dollarsToCents(item.editedValue));
    return item.editedValue.trim();
  };
  const changeRows = (items: ReviewItem[]) => items.map((item) => ({ field: item.field,
    label: fields.find((field) => field.key === item.field)?.label ?? item.field,
    value: item.editedValue, status: item.manual || item.edited ? "Your entry" : item.status }));

  async function saveDraft() {
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch(draftId ? `/api/drafts/${draftId}` : "/api/drafts", {
        method: draftId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: text, draft: { review }, ...(draftId ? { version: draftVersion } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your draft.");
      setDraftId(result.draft.id);
      setDraftVersion(result.draft.version);
      setReviewRequestId(null);
      setReviewAcknowledged(false);
      setSavedContent(JSON.stringify({ text, review }));
      setSaveMessage("Draft saved privately. This is not an agreement or approval.");
    } catch (caught) {
      setSaveMessage(caught instanceof Error ? caught.message : "Could not save. Your edits remain here.");
    } finally { setSaving(false); }
  }

  async function listDrafts() {
    setSaveMessage("");
    try {
      const response = await fetch("/api/drafts", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load drafts.");
      setSavedDrafts(result.drafts);
      setSaveMessage(result.drafts.length ? "Choose a draft below to open it." : "No saved drafts yet.");
    } catch (caught) { setSaveMessage(caught instanceof Error ? caught.message : "Could not load drafts."); }
  }

  function openDraft(saved: SavedDraft) {
    if (hasUnsavedChanges && (text || review) && !window.confirm("Opening another draft will replace the unsaved work on this screen. Continue?")) return;
    const storedReview = saved.draft.review ?? null;
    setText(saved.source_text);
    setReview(storedReview);
    setDraftId(saved.id);
    setDraftVersion(saved.version);
    setSavedContent(JSON.stringify({ text: saved.source_text, review: storedReview }));
    setSavedDrafts([]);
    setRevisions([]);
    setReviewRequestId(null);
    setReviewAcknowledged(false);
    setSaveMessage("Draft opened. No agreement has been confirmed.");
  }

  async function loadRevisions() {
    if (!draftId) return;
    try {
      const response = await fetch(`/api/revisions?draftId=${encodeURIComponent(draftId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load history.");
      setRevisions(result.revisions);
      setSaveMessage(result.revisions.length ? "Your reviewed snapshots are shown below." : "No reviewed snapshots yet.");
    } catch (caught) { setSaveMessage(caught instanceof Error ? caught.message : "Could not load history."); }
  }

  async function recordReview() {
    if (!draftId || !draftVersion || !reviewAcknowledged || hasUnsavedChanges || changedSource) return;
    const requestId = reviewRequestId ?? crypto.randomUUID();
    setReviewRequestId(requestId);
    setReviewBusy(true);
    try {
      const response = await fetch("/api/revisions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, expectedVersion: draftVersion, requestId, confirmReview: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not record review.");
      setSaveMessage(`Review ${result.revision.revision} saved. This records your review only; it is not a contract or counterparty approval.`);
      setReviewAcknowledged(false);
      await loadRevisions();
    } catch (caught) { setSaveMessage(caught instanceof Error ? caught.message : "Could not record review. Retry to check the same request."); }
    finally { setReviewBusy(false); }
  }

  async function analyze() {
    if (!text.trim() || busy) return;
    if (review && !window.confirm("A new review replaces the edits currently shown. Save first if you need to keep them. Continue?")) return;
    const submitted = text;
    setBusy(true);
    setError("");
    setCopyMessage("");
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: submitted }),
      });
      if (!response.ok) {
        let detail = response.status === 401 ? "Sign in is required to review your notes. Your text is still here." : "Analysis is unavailable right now. Your text is still here; please try again.";
        try {
          const result = await response.json();
          if (typeof result.error === "string" && result.error.length < 240) detail = result.error;
        } catch { /* Show a generic recovery message. */ }
        throw new Error(detail);
      }
      setReview(parseResult(await response.json(), submitted));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis is unavailable. Your text is still here.");
    } finally {
      setBusy(false);
    }
  }

  function previewSample() {
    if ((text || review) && !window.confirm("Replace the current screen with the fictional sample? Save any work you want to keep first.")) return;
    const example = {
      candidates: [
        { field: "venue", value: "Blue Alley", quote: "Blue Alley", status: "stated" },
        { field: "sets", value: "20:00, 22:00", quote: "two sets at 8 PM and 10 PM", status: "stated" },
        { field: "feeCents", value: "90000", quote: "$900", status: "proposed" },
        { field: "sets", value: "21:00", quote: "start at 9 PM and add another set", status: "proposed" },
      ],
      questions: ["What is the year of the performance?", "What is the total fee if a third set is added?", "What are all the new set times and payment terms?"],
    };
    setText(sample);
    setReview({ ...parseResult(example, sample), fixture: true });
    setDraftId(null);
    setDraftVersion(null);
    setSavedContent("");
    setError("");
    setSaveMessage("");
  }

  function updateItem(index: number, value: string) {
    setReview((current) => current && {
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, editedValue: value, edited: true, selected: false, publicShare: false } : item),
    });
  }

  function selectItem(index: number, selected: boolean) {
    setReview((current) => current && {
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex === index) return { ...item, selected, publicShare: selected ? item.publicShare : false };
        if (selected && item.field === current.items[index].field) return { ...item, selected: false, publicShare: false };
        return item;
      }),
    });
  }

  function setPublicShare(index: number, publicShare: boolean) {
    setReview((current) => current && { ...current, items: current.items.map((item, itemIndex) =>
      itemIndex === index && item.selected && publicFields.has(item.field) ? { ...item, publicShare } : item) });
  }

  function addManualField(field: Field) {
    setReview((current) => current && {
      ...current,
      items: [...current.items, { field, value: "", quote: "", status: "unclear", editedValue: "", edited: true, manual: true }],
    });
  }

  async function copyQuestions() {
    if (!review?.questions.length) return;
    try {
      await navigator.clipboard.writeText(review.questions.map((question) => "• " + question).join("\n"));
      setCopyMessage("Copied. Review the questions before sending them yourself.");
    } catch {
      setCopyMessage("Copy was unavailable. Please select the questions and copy them manually.");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="JazzLink AI"><span className="brand-mark">J</span><span>jazzlink<span className="brand-ai"> ai</span></span></div>
        <div className="topbar-right"><Link href="/auth" target="_blank">Sign in ↗</Link><span className="workspace-label">YOUR GIG WORKSPACE</span><span className="prototype-badge"><span /> EARLY PREVIEW</span></div>
      </header>

      <div className="page-content">
        <div className="intro">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" /> LESS ADMIN. MORE MUSIC.</p>
            <h1>Make every gig<br /><em>clearer.</em></h1>
            <p className="intro-copy">Turn scattered messages into a clearer picture of your gig. See what was said, what changed, and what to ask next.</p>
          </div>
          <aside className="intro-note"><span className="note-icon">✳</span><p>Made for the people<br /><strong>behind the music.</strong></p></aside>
        </div>

        <div className="steps" aria-label="Workflow steps">
          <div className="step step-active"><span>01</span><div><strong>Bring the conversation</strong><small>Paste messages or notes</small></div></div>
          <div className="step"><span>02</span><div><strong>Review the details</strong><small>Check each source</small></div></div>
          <div className="step"><span>03</span><div><strong>Clarify what’s missing</strong><small>Keep the conversation going</small></div></div>
        </div>

        <div className="workspace">
          <section className="panel input-panel" aria-labelledby="source-title">
            <div className="panel-heading"><div><p className="section-kicker">01 / THE CONVERSATION</p><h2 id="source-title">Start with what you know.</h2></div><span className="panel-icon">✳</span></div>
            <p className="panel-copy">Paste the relevant messages or notes. Keep speaker names and message order when you can.</p>
            <div className="input-label-row"><label htmlFor="source-text">Conversation or notes</label><button className="text-button" type="button" onClick={() => { if (!text || window.confirm("Replace the text currently in the input with the fictional example?")) { setText(sample); setError(""); } }}>Try a fictional example <span aria-hidden="true">↗</span></button></div>
            <button className="text-button" type="button" onClick={previewSample}>Preview example results without AI ↗</button>
            <textarea id="source-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={8000} placeholder={"Venue: Can your trio play on November 20?\nMusician: Yes, we can do two sets..."} />
            <div className="input-meta"><span>Only use synthetic or permission-cleared material.</span><span>{text.length.toLocaleString()} / 8,000</span></div>
            <button className="primary-button" type="button" disabled={busy || !text.trim()} onClick={analyze}>{busy ? "Reviewing your notes…" : "Review gig details"} <span aria-hidden="true">{busy ? "···" : "↗"}</span></button>
            <div className="draft-actions"><button className="secondary-button" type="button" onClick={saveDraft} disabled={saving || !text.trim()}>{saving ? "Saving…" : "Save private draft"}</button><button className="secondary-button" type="button" onClick={listDrafts}>Open saved drafts</button></div>
            {saveMessage && <p className="local-note" role="status">{saveMessage}</p>}
            {savedDrafts.length > 0 && <ul className="saved-drafts">{savedDrafts.map((saved) => <li key={saved.id}><button type="button" onClick={() => openDraft(saved)}>{saved.source_text.split("\n")[0].slice(0, 60) || "Untitled draft"} · v{saved.version}</button></li>)}</ul>}
            {draftId && review && <div className="review-commit"><label><input type="checkbox" checked={reviewAcknowledged} onChange={(event) => setReviewAcknowledged(event.target.checked)} /> I reviewed this saved snapshot, including any unresolved suggestions. This records my review only.</label><div className="draft-actions"><button className="secondary-button" type="button" disabled={!reviewAcknowledged || hasUnsavedChanges || changedSource || reviewBusy} onClick={recordReview}>{reviewBusy ? "Recording…" : "Record my review"}</button><button className="secondary-button" type="button" onClick={loadRevisions}>View review history</button></div>{hasUnsavedChanges && <p className="local-note">Save the current edits before recording your review.</p>}{changedSource && <p className="local-note">Run a fresh review before recording the changed input.</p>}</div>}
            {revisions.length > 0 && <div className="revision-history"><h3>Review history</h3>{revisions.map((revision) => <details key={revision.id}><summary>Review {revision.revision} · saved draft v{revision.draft_version}</summary><p>Snapshot of your review; suggestions and missing information are not counterparty approval.</p><ul>{revision.draft.review?.items.map((item, index) => <li key={index}>{fields.find((field) => field.key === item.field)?.label}: {item.editedValue || "Unknown"} ({item.manual || item.edited ? "your entry" : labels[item.status]})</li>)}</ul><details><summary>Source at time of review</summary><pre>{revision.source_text}</pre></details></details>)}</div>}
            {review && <p className="local-note">Running a new review replaces the edits currently shown. Save the draft first if needed.</p>}
            <p className="privacy-note"><span aria-hidden="true">◌</span> Your text is sent to the AI provider for analysis. Avoid real personal or contract information in this preview.</p>
            {error && <div className="error-message" role="alert"><strong>Couldn’t complete the review.</strong><p>{error}</p></div>}
          </section>

          <section className="panel review-panel" aria-labelledby="review-title">
            <div className="panel-heading"><div><p className="section-kicker">02 / YOUR REVIEW</p><h2 id="review-title">A clearer picture.</h2></div><span className="review-chip">{review ? "REVIEW NEEDED" : "WAITING FOR NOTES"}</span></div>
            {!review ? (
              <div className="empty-state"><div className="empty-art"><span>♪</span><i /></div><h3>Let’s get the details in tune.</h3><p>Your extracted details, source quotes, and questions will appear here for you to check.</p><div className="empty-points"><span>✦ &nbsp; Keep track of what was said</span><span>✦ &nbsp; Spot details still missing</span><span>✦ &nbsp; Decide what to ask next</span></div></div>
            ) : (
              <div className="review-content">
                <p className="review-notice">{review.fixture ? "Example interpretations" : "AI interpretations"} are suggestions, not approval or proof of agreement. Check the original messages and edit anything that’s wrong.</p>
                {review.fixture && <p className="warning-note">Fictional example with prewritten results. No AI request was made. Use “Review gig details” to request a real analysis after signing in.</p>}
                {changedSource && <p className="warning-note" role="status">The input has changed since this review. These suggestions refer to the earlier text shown in their source quotes. Run a new review to update them.</p>}
                {competingFields.length > 0 && <p className="warning-note" role="status">Multiple values need review for: {competingFields.map((field) => field.label).join(", ")}. A later request does not automatically replace an earlier value.</p>}
                <div className="review-summary"><div><strong>{review.items.length}</strong><span>details found</span></div><div><strong>{missing.length}</strong><span>fields not found</span></div><div><strong>{concerns.length}</strong><span>suggested for review</span></div></div>
                {previousReview && <ChangeReview previous={changeRows(previousReview.items.filter((item) => item.selected))} current={changeRows(review.items)} />}
                {review.items.length > 0 && <div className="detail-list">{review.items.map((item, index) => {
                  const field = fields.find((entry) => entry.key === item.field);
                  return <article className="detail-card" key={item.field + "-" + index}>
                    <div className="detail-top"><div><h3>{field?.label}</h3><span className="field-hint">{field?.hint}</span></div><span className={"status-chip status-" + item.status}>{item.manual ? "Your entry" : labels[item.status]}</span></div>
                    <label className="detail-label" htmlFor={"detail-" + index}>{item.edited ? "Your edit (not saved or approved)" : "AI-suggested value"}</label>
                    <input id={"detail-" + index} value={item.editedValue} onChange={(event) => updateItem(index, event.target.value)} placeholder="Unknown" />
                    <label className="select-term"><input type="checkbox" checked={item.selected ?? false} disabled={!validItem(item)} onChange={(event) => selectItem(index, event.target.checked)} /> Include this value in my reviewed terms</label>
                    {publicFields.has(item.field) && <label className="select-term"><input type="checkbox" checked={item.publicShare ?? false} disabled={!item.selected} onChange={(event) => setPublicShare(index, event.target.checked)} /> Allow this field on the public card</label>}
                    {!validItem(item) && item.editedValue.trim() && <p className="edit-explanation">Use a valid value: dates need YYYY-MM-DD, times use HH:MM, and amounts use USD dollars.</p>}
                    {item.edited && !item.manual && <p className="edit-explanation">Original AI suggestion: {displayValue(item) || "Unknown"}. The source below refers to that suggestion, not your edit.</p>}
                    {item.manual ? <p className="edit-explanation">Entered by you; no source quote or counterparty approval is attached.</p> : <div className="source-quote"><span>FROM YOUR NOTES</span><blockquote>“{item.quote}”</blockquote></div>}
                  </article>;
                })}</div>}
                {missing.length > 0 && <div className="missing-box"><div className="box-heading"><span>?</span><div><h3>Still to check</h3><p>Not found in this review. Blank doesn’t mean zero or agreed. Add a value if you know it.</p></div></div><div className="missing-tags">{missing.map((field) => <button type="button" key={field.key} disabled={review.items.some((item) => item.field === field.key)} onClick={() => addManualField(field.key)}>+ {field.label}</button>)}</div></div>}
                {review.questions.length > 0 && <div className="questions-box"><div className="question-heading"><div><p className="section-kicker">KEEP THE CONVERSATION GOING</p><h3>Questions to consider</h3></div><button className="secondary-button" type="button" onClick={copyQuestions}>Copy questions</button></div><ul>{review.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>{copyMessage && <p className="copy-message" role="status">{copyMessage}</p>}<p className="questions-footnote">Review these first. JazzLink won’t send messages for you.</p></div>}
                <p className="local-note">{hasUnsavedChanges ? "There are unsaved edits." : "This draft is saved."} No agreement has been confirmed.</p>
              </div>
            )}
          </section>
        </div>
        {previousReview && revisions[0] && <section className="terms-output"><p className="section-kicker">YOUR REVIEWED TERMS · REVISION {revisions[0].revision}</p><h2>Personal review / 개인 검토</h2><p>This is your own review, not a contract or proof of the other party’s approval. Unselected fields remain unresolved.</p><dl>{fields.map((field) => {
          const selected = previousReview.items.find((item) => item.field === field.key && item.selected);
          return <div key={field.key}><dt>{field.label} / {koreanLabels[field.key]}</dt><dd>{selected?.editedValue || "Not selected / 미선택"}</dd></div>;
        })}</dl><PublicTermsCard revision={revisions[0].revision} title={publicValue("title")} venue={publicValue("venue")} date={publicValue("date")} artist={publicValue("artist")} sets={publicValue("sets")} ticketCents={publicValue("ticketCents")} /></section>}
        <div className="bottom-note"><span>✳</span><p><strong>Built around your real conversations.</strong> Keep using your existing messenger; you’re always in control of what gets shared.</p></div>
      </div>
      <footer><span>JAZZLINK AI</span><span>NEW YORK · USD · AMERICA/NEW_YORK</span><span>EARLY PREVIEW · FICTIONAL DATA</span></footer>
    </main>
  );
}
