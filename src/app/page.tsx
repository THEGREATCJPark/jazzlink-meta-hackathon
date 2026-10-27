"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { checkEvidenceIntegrity } from "@/domain/evidence-integrity";
import { ChangeReview } from "@/components/ChangeReview";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { Stepper } from "@/components/site/Stepper";
import { DetailCard } from "@/components/workspace/DetailCard";
import { RevisionHistory } from "@/components/workspace/RevisionHistory";
import { TermsSheet } from "@/components/workspace/TermsSheet";
import { feeContextFor, fieldLabel, fields, itemStatus, itemWasEdited, mayShareItem, parseResult, publicFields, sample, validItem,
  type Baseline, type Field, type Review, type ReviewItem, type SavedDraft, type SavedRevision } from "@/components/workspace/model";
import { signOut } from "@/app/auth/actions";
import "./workspace.css";

const workflowSteps = [
  { title: "Bring the conversation", hint: "Paste messages or notes" },
  { title: "Inspect the changes", hint: "Check sources and edit values" },
  { title: "Record your review", hint: "Save a reviewed snapshot" },
];

export default function Home() {
  const [text, setText] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [freshModelReview, setFreshModelReview] = useState(false);
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [session, setSession] = useState<"checking" | "signed-in" | "signed-out" | "unavailable">("checking");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/drafts", { cache: "no-store", signal: controller.signal })
      .then((response) => setSession(response.ok ? "signed-in" : response.status === 401 ? "signed-out" : "unavailable"))
      .catch(() => { if (!controller.signal.aborted) setSession("unavailable"); });
    return () => controller.abort();
  }, []);
  const [pendingReview, setPendingReview] = useState<"ai" | "manual" | null>(null);
  const [historyStatus, setHistoryStatus] = useState<"ready" | "loading" | "error">("ready");
  const contextVersion = useRef(0);
  const editingLocked = busy || saving || reviewBusy || loggingOut || pendingReview !== null;

  const changedSource = review !== null && review.source !== text;
  const questionsMayBeOutdated = changedSource || (review?.items.some((item) => item.edited || item.manual || item.selected || item.carriedFrom) ?? false);
  const selectedFields = new Set(review?.items.filter((item) => item.selected && validItem(item)).map((item) => item.field) ?? []);
  const missing = fields.filter((field) => !(review?.items.some((item) => item.field === field.key && item.editedValue.trim())));
  const unreviewed = fields.filter((field) => !selectedFields.has(field.key) && review?.items.some((item) => item.field === field.key && item.editedValue.trim()));
  const competingFields = fields.filter((field) => new Set((review?.items ?? [])
    .filter((item) => item.field === field.key && item.editedValue.trim())
    .map((item) => item.editedValue.trim())).size > 1);
  const hasUnsavedChanges = savedContent !== JSON.stringify({ text, review });
  const previousReview = revisions[0]?.draft.review;
  const snapshotEvidence = previousReview && revisions[0] && draftId ? checkEvidenceIntegrity({
    draftId, sourceText: revisions[0].source_text, review: previousReview, revisions, currentRevision: revisions[0].revision,
  }) : null;
  const currentEvidence = review && historyStatus === "ready" ? checkEvidenceIntegrity({
    draftId: draftId ?? "unsaved", sourceText: review.source, review, revisions,
  }) : null;
  const feeContext = feeContextFor(review);
  const changeRows = (items: ReviewItem[]) => items.map((item) => ({ field: item.field,
    label: fieldLabel(item.field),
    value: item.editedValue, status: item.manual || itemWasEdited(item) ? "Your entry" : item.status }));

  async function saveDraft() {
    if (busy || saving || reviewBusy) return;
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
    if (saving || busy || reviewBusy) return;
    if (hasUnsavedChanges && (text || review) && !window.confirm("Opening another draft will replace the unsaved work on this screen. Continue?")) return;
    contextVersion.current += 1;
    const storedReview = saved.draft.review ?? null;
    setText(saved.source_text);
    setReview(storedReview);
    setFreshModelReview(false);
    setDraftId(saved.id);
    setDraftVersion(saved.version);
    setSavedContent(JSON.stringify({ text: saved.source_text, review: storedReview }));
    setSavedDrafts([]);
    setRevisions([]);
    setReviewRequestId(null);
    setReviewAcknowledged(false);
    setSaveMessage("Draft opened. No agreement has been confirmed.");
    void loadRevisionsFor(saved.id, contextVersion.current);
  }

  async function loadRevisions() {
    if (!draftId) return;
    await loadRevisionsFor(draftId, contextVersion.current);
  }

  async function loadRevisionsFor(id: string, requestedContext: number) {
    setHistoryStatus("loading");
    try {
      const response = await fetch(`/api/revisions?draftId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json();
      if (requestedContext !== contextVersion.current) return;
      if (!response.ok) throw new Error(result.error || "Could not load history.");
      setRevisions(result.revisions);
      setHistoryStatus("ready");
      setSaveMessage(result.revisions.length ? "Your reviewed snapshots are shown below." : "No reviewed snapshots yet.");
    } catch (caught) { if (requestedContext === contextVersion.current) { setHistoryStatus("error"); setSaveMessage(caught instanceof Error ? caught.message : "Could not load history."); } }
  }

  async function recordReview() {
    if (!draftId || !draftVersion || !reviewAcknowledged || hasUnsavedChanges || changedSource || busy || saving || historyStatus !== "ready" || !currentEvidence?.ok) return;
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
    if (!text.trim() || busy || saving || reviewBusy || historyStatus !== "ready") return;
    const submitted = text;
    const requestedContext = contextVersion.current;
    const latest = revisions[0];
    if ((draftId && !draftVersion) || (latest && (!latest.draft.review || !snapshotEvidence?.ok || !draftId || !draftVersion))) {
      setError("The latest personal review could not be verified. Reload the draft and its history before starting a new review.");
      return;
    }
    const baseline: Baseline | undefined = latest?.draft.review && snapshotEvidence?.ok ? {
      revision: latest.revision,
      source: latest.draft.review.source,
      fixture: latest.draft.review.fixture === true,
      items: structuredClone(latest.draft.review.items.filter((item) => item.selected)),
    } : undefined;
    setBusy(true);
    setError("");
    setCopyMessage("");
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: submitted, ...(draftId && draftVersion ? { context: { draftId, expectedVersion: draftVersion, expectedRevision: latest?.revision ?? 0 } } : {}) }),
      });
      if (!response.ok) {
        let detail = response.status === 401 ? "Sign in is required to review your notes. Your text is still here." : "Analysis is unavailable right now. Your text is still here; please try again.";
        try {
          const result = await response.json();
          if (typeof result.error === "string" && result.error.length < 240) detail = result.error;
        } catch { /* Show a generic recovery message. */ }
        throw new Error(detail);
      }
      const result = parseResult(await response.json(), submitted);
      if (requestedContext !== contextVersion.current) return;
      setReview({ ...result, baseline });
      setFreshModelReview(true);
    } catch (caught) {
      if (requestedContext === contextVersion.current) setError(caught instanceof Error ? caught.message : "Analysis is unavailable. Your text is still here.");
    } finally {
      setBusy(false);
    }
  }

  function requestAnalysis() {
    if (editingLocked || !text.trim()) return;
    if (review) setPendingReview("ai");
    else void analyze();
  }

  function startManualReview() {
    if (!text.trim() || busy || saving || reviewBusy || loggingOut || historyStatus !== "ready") return;
    const latest = revisions[0];
    if ((draftId && !draftVersion) || (latest && (!latest.draft.review || !snapshotEvidence?.ok || !draftId || !draftVersion))) {
      setError("The latest personal review could not be verified. Reload the draft and its history before starting a new review.");
      return;
    }
    const baseline: Baseline | undefined = latest?.draft.review && snapshotEvidence?.ok ? {
      revision: latest.revision,
      source: latest.draft.review.source,
      fixture: latest.draft.review.fixture === true,
      items: structuredClone(latest.draft.review.items.filter((item) => item.selected)),
    } : undefined;
    setReview({ source: text, items: [], questions: [], manualOnly: true, baseline });
    setFreshModelReview(false);
    setError("");
  }

  function requestManualReview() {
    if (editingLocked || !text.trim() || historyStatus !== "ready") return;
    if (review) setPendingReview("manual");
    else startManualReview();
  }

  function previewSample() {
    if (saving || busy || reviewBusy) return;
    if ((text || review) && !window.confirm("Replace the current screen with the fictional sample? Save any work you want to keep first.")) return;
    contextVersion.current += 1;
    const example = {
      candidates: [
        { field: "venue", value: "Blue Alley", quote: "Blue Alley", status: "stated" },
        { field: "sets", value: "20:00, 22:00", quote: "two sets at 8 PM and 10 PM", status: "stated" },
        { field: "setCount", value: "2", quote: "two sets", status: "stated" },
        { field: "feeCents", value: "90000", quote: "$900", status: "proposed" },
        { field: "sets", value: "21:00", quote: "start at 9 PM and add another set", status: "proposed" },
        { field: "additionalSets", value: "1", quote: "add another set", status: "proposed" },
      ],
      questions: ["What is the year of the performance?", "What is the total fee if a third set is added?", "What are all the new set times and payment terms?"],
    };
    setText(sample);
    setReview({ ...parseResult(example, sample), fixture: true });
    setFreshModelReview(false);
    setDraftId(null);
    setDraftVersion(null);
    setSavedDrafts([]);
    setRevisions([]);
    setHistoryStatus("ready");
    setReviewAcknowledged(false);
    setReviewRequestId(null);
    setSavedContent("");
    setError("");
    setSaveMessage("");
  }

  function updateItem(index: number, value: string) {
    setReview((current) => current && {
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, editedValue: value, edited: true, selected: false, publicShare: false, publishConfirmed: false } : item),
    });
  }

  function selectItem(index: number, selected: boolean) {
    setReview((current) => current && {
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex === index) return { ...item, selected, publicShare: selected ? item.publicShare : false, publishConfirmed: selected ? item.publishConfirmed : false };
        if (selected && item.field === current.items[index].field) return { ...item, selected: false, publicShare: false, publishConfirmed: false };
        return item;
      }),
    });
  }

  function setPublicShare(index: number, publicShare: boolean) {
    setReview((current) => current && { ...current, items: current.items.map((item, itemIndex) =>
      itemIndex === index && item.selected && publicFields.has(item.field) && mayShareItem(item) ? { ...item, publicShare } : item) });
  }

  function confirmPublicValue(index: number, publishConfirmed: boolean) {
    setReview((current) => current && { ...current, items: current.items.map((item, itemIndex) =>
      itemIndex === index && item.selected && publicFields.has(item.field) ? { ...item, publishConfirmed, publicShare: false } : item) });
  }

  function carryBaseline(index: number) {
    setReview((current) => {
      const baseline = current?.baseline;
      const item = baseline?.items[index];
      if (!current || !baseline || !item || !validItem(item)) return current;
      if (current.items.some((entry) => entry.carriedFrom?.revision === baseline.revision && entry.field === item.field)) return current;
      const next = current.items.map((entry) => entry.field === item.field ? { ...entry, selected: false, publicShare: false, publishConfirmed: false } : entry);
      const carriedFrom = { revision: baseline.revision, source: item.carriedFrom?.source ?? baseline.source, fixture: item.carriedFrom?.fixture ?? baseline.fixture };
      const selected = item.field !== "feeCents" || !feeContextFor(current)?.scheduleChangeRisk;
      return { ...current, items: [...next, { ...item, selected, publicShare: false, publishConfirmed: false, carriedFrom }] };
    });
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

  async function leaveAccount() {
    if (editingLocked) return;
    if (hasUnsavedChanges && (text || review) && !window.confirm("Sign out and discard the unsaved work on this screen?")) return;
    setLoggingOut(true);
    try {
      const result = await signOut();
      if (!result.ok) throw new Error("Sign out failed. Please try again.");
      contextVersion.current += 1;
      setText("");
      setReview(null);
      setRevisions([]);
      setSavedDrafts([]);
      setDraftId(null);
      setDraftVersion(null);
      window.location.replace("/auth");
    } catch {
      setLoggingOut(false);
      setSaveMessage("Sign out failed. Your current work is still here.");
    }
  }


  const hasWork = Boolean(text || review);
  const currentStep = !review ? 0 : !draftId ? 1 : 2;
  const canAnalyze = !editingLocked && historyStatus === "ready" && Boolean(text.trim());
  const recordDisabled = !reviewAcknowledged || hasUnsavedChanges || changedSource || editingLocked || historyStatus !== "ready" || !currentEvidence?.ok;
  const panelState = busy ? "Analyzing" : review ? "Review needed" : "Waiting for notes";

  return (
    <div className="app-shell">
      <SiteHeader badge="EARLY PREVIEW">
        <Link href="/demo">Try demo <span aria-hidden="true">↗</span></Link>
        {session === "signed-out" && <Link href="/auth">Sign in <span aria-hidden="true">↗</span></Link>}
        {session === "signed-in" && <button className="link-button" type="button" disabled={editingLocked} onClick={leaveAccount}>{loggingOut ? "Signing out…" : "Sign out"}</button>}
        {session === "checking" && <span className="session-label">Checking session…</span>}
        {session === "unavailable" && <span className="session-label">Session unavailable · <Link href="/auth">Sign in</Link></span>}
      </SiteHeader>

      <main id="main" className="page-content">
        <div className="intro">
          <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> YOUR GIG WORKSPACE</p>
          <h1>Make every gig <em>clearer.</em></h1>
          <p className="intro-copy">See what changed, what needs a closer look, and what to ask next.</p>
        </div>
        <Stepper label="Workflow steps" steps={workflowSteps} current={currentStep} />

        <div className="workspace">
          <section className="panel input-panel" aria-labelledby="source-title">
            <div className="panel-heading"><div><p className="kicker">01 / THE CONVERSATION</p><h2 id="source-title">Start with what you know.</h2></div></div>
            <p className="panel-copy">Paste the relevant messages or notes. Keep speaker names and message order when you can.</p>

            <div className="input-label-row"><label htmlFor="source-text">Conversation or notes</label><span className="char-count" aria-live="off">{text.length.toLocaleString()} / 8,000</span></div>
            <textarea id="source-text" value={text} disabled={editingLocked} onChange={(event) => setText(event.target.value)} maxLength={8000} aria-describedby="source-help" placeholder={"Venue: Can your trio play on November 20?\nMusician: Yes, we can do two sets..."} />
            <p className="input-meta" id="source-help">Only use synthetic or permission-cleared material.</p>

            <button className="btn btn-primary btn-block" type="button" disabled={!canAnalyze} aria-busy={busy || undefined} onClick={requestAnalysis}>{busy ? "Reviewing your notes…" : "Review gig details"} <span aria-hidden="true">{busy ? "···" : "→"}</span></button>
            {pendingReview && <div className="review-confirm" role="alertdialog" aria-labelledby="review-confirm-title" aria-describedby="review-confirm-description"><h3 id="review-confirm-title">Start a new review?</h3><p id="review-confirm-description">The current suggestions on this screen will be replaced. Your saved drafts and review history remain available.</p><div className="button-row"><button className="btn btn-secondary" type="button" onClick={() => setPendingReview(null)}>Cancel</button><button className="btn btn-primary" type="button" onClick={() => { const mode = pendingReview; setPendingReview(null); if (mode === "ai") void analyze(); else startManualReview(); }}>{pendingReview === "ai" ? "Replace and analyze" : "Replace and review manually"}</button></div></div>}
            {error && <div className="callout callout-error" role="alert"><strong>Couldn’t complete the review.</strong><p>{error}</p></div>}

            <div className="alt-actions" role="group" aria-labelledby="alt-actions-title">
              <p id="alt-actions-title" className="alt-actions-title">Other ways to start</p>
              <button className="btn btn-ghost" type="button" disabled={editingLocked || historyStatus !== "ready" || !text.trim()} onClick={requestManualReview}>Review manually without AI</button>
              <button className="btn btn-ghost" type="button" disabled={editingLocked} onClick={() => { if (!text || window.confirm("Replace the text currently in the input with the fictional example?")) { setText(sample); setError(""); } }}>Try a fictional example</button>
              <button className="btn btn-ghost" type="button" disabled={editingLocked} onClick={previewSample}>Preview example results without AI</button>
            </div>
            <p className="privacy-note"><span aria-hidden="true">ⓘ</span> Your text is sent to the AI provider for analysis. Avoid real personal or contract information in this preview.</p>

            <div className="panel-section">
              <div className="section-title-row"><h3>Private draft</h3>{hasWork && <span className={"save-state " + (hasUnsavedChanges ? "is-dirty" : "is-saved")}>{hasUnsavedChanges ? "Unsaved changes" : "Saved"}</span>}</div>
              <div className="button-row"><button className="btn btn-secondary" type="button" onClick={saveDraft} disabled={editingLocked || !text.trim()}>{saving ? "Saving…" : "Save private draft"}</button><button className="btn btn-secondary" type="button" disabled={editingLocked} onClick={listDrafts}>Open saved drafts</button></div>
              {saveMessage && <p className="status-note" role="status">{saveMessage}</p>}
              {savedDrafts.length > 0 && <ul className="saved-drafts">{savedDrafts.map((saved) => <li key={saved.id}><button type="button" disabled={saving || busy || reviewBusy} onClick={() => openDraft(saved)}>{saved.source_text.split("\n")[0].slice(0, 60) || "Untitled draft"} · v{saved.version}</button></li>)}</ul>}
              {draftId && historyStatus !== "ready" && <p className="callout callout-warning">{historyStatus === "loading" ? "Loading the previous review before analyzing changes…" : "Review history could not be loaded. Retry before analyzing changes."} {historyStatus === "error" && <button type="button" className="link-button" onClick={loadRevisions}>Retry history</button>}</p>}
            </div>

            {draftId && review && <div className="panel-section review-commit">
              <h3>Record your review</h3>
              <label className="check-row"><input type="checkbox" checked={reviewAcknowledged} disabled={editingLocked} onChange={(event) => setReviewAcknowledged(event.target.checked)} /> I reviewed this saved snapshot, including any unresolved suggestions. This records my review only.</label>
              <div className="button-row"><button className="btn btn-primary" type="button" disabled={recordDisabled} onClick={recordReview}>{reviewBusy ? "Recording…" : "Record my review"}</button><button className="btn btn-secondary" type="button" disabled={editingLocked || historyStatus === "loading"} onClick={loadRevisions}>View review history</button></div>
              {hasUnsavedChanges && <p className="status-note">Save the current edits before recording your review.</p>}
              {changedSource && <p className="status-note">Run a fresh review before recording the changed input.</p>}
              {currentEvidence && !currentEvidence.ok && <p className="callout callout-warning">Source links could not be verified. Start a new review from the current text; saved history is not changed.</p>}
            </div>}
            <RevisionHistory revisions={revisions} />
            {review && <p className="status-note">Running a new review replaces the edits currently shown. Save the draft first if needed.</p>}
          </section>

          <section className="panel review-panel" aria-labelledby="review-title" aria-busy={busy || undefined}>
            <div className="panel-heading"><div><p className="kicker">02 / YOUR REVIEW</p><h2 id="review-title">A clearer picture.</h2></div><span className={"review-chip" + (review ? " is-active" : "")}>{panelState}</span></div>
            {!review ? (busy ? (
              <div className="empty-state" role="status"><div className="skeleton" aria-hidden="true"><i /><i /><i /></div><h3>Reading your conversation…</h3><p>Extracted details, source quotes and questions will appear here for you to check.</p></div>
            ) : (
              <div className="empty-state"><div className="empty-art" aria-hidden="true">♪</div><h3>Let’s get the details in tune.</h3><p>Your extracted details, source quotes, and questions will appear here for you to check.</p><ul className="empty-points"><li>Keep track of what was said</li><li>Spot details still missing</li><li>Decide what to ask next</li></ul></div>
            )) : (
              <div className="review-content">
                <div className="notices">
                  <p className="callout callout-info">{review.manualOnly ? "Your entries" : review.fixture ? "Example interpretations" : freshModelReview ? "AI interpretations" : "Saved interpretations"} are not proof of agreement. Check the original messages and edit anything that’s wrong.</p>
                  {review.fixture && <p className="callout callout-warning">Fictional example with prewritten results. No AI request was made. Use “Review gig details” to request a real analysis after signing in.</p>}
                  {review.manualOnly && <p className="callout callout-warning">Manual review. No AI request was made for this review; add the details you want to check below.</p>}
                  {changedSource && <p className="callout callout-warning" role="status">The input has changed since this review. These suggestions refer to the earlier text shown in their source quotes. Run a new review to update them.</p>}
                  {currentEvidence && !currentEvidence.ok && <p className="callout callout-error" role="alert">At least one quote or earlier-review link could not be verified. Source labels and review recording are disabled for this view. Start a new review from the current text.</p>}
                  {feeContext?.scheduleChangeRisk && <p className="callout callout-warning" role="status">The schedule has a change or open request. Check the fee for that schedule separately; an earlier fee is not automatically carried to new terms.</p>}
                  {feeContext?.previousFeeApplicability === "needs_reconfirmation" && <p className="callout callout-warning" role="status">The selected earlier fee may not apply to the changed schedule. Its application and the other party’s agreement remain unconfirmed.</p>}
                  {competingFields.length > 0 && <p className="callout callout-warning" role="status">Multiple values need review for: {competingFields.map((field) => field.label).join(", ")}. A later request does not automatically replace an earlier value.</p>}
                </div>

                <dl className="review-summary"><div><dt>Candidate details</dt><dd>{review.items.length}</dd></div><div><dt>Without a value</dt><dd>{missing.length}</dd></div><div><dt>Fields to review</dt><dd>{unreviewed.length}</dd></div></dl>

                {review.questions.length > 0 && <div className="questions-box"><div className="question-heading"><div><p className="kicker">KEEP THE CONVERSATION GOING</p><h3>Questions to consider</h3></div><button className="btn btn-secondary btn-small" type="button" onClick={copyQuestions}>Copy questions</button></div><ul>{review.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>{copyMessage && <p className="copy-message" role="status">{copyMessage}</p>}<p className="questions-footnote" role="status">{questionsMayBeOutdated ? "These questions reflect the original analysis and may no longer fit your changes or selections. Review and edit them before sending." : "These questions reflect the original analysis. Review them before sending."} JazzLink won’t send messages for you.</p></div>}

                {previousReview && snapshotEvidence?.ok && <ChangeReview previous={changeRows(previousReview.items.filter((item) => item.selected))} current={changeRows(review.items)} />}
                {review.baseline && currentEvidence?.ok && <details className="baseline-box"><summary>Keep values from earlier personal review · revision {review.baseline.revision}</summary><p>These are earlier choices, not automatically carried into the next review. Choose each value you want to keep after checking the new message.</p>{review.baseline.items.length === 0 ? <p>No values were selected in that review.</p> : <ul>{review.baseline.items.map((item, index) => <li key={index}><strong>{fieldLabel(item.field)}: {item.editedValue}</strong><span>{itemStatus(item)}</span><button className="btn btn-secondary btn-small" type="button" disabled={editingLocked || review.items.some((entry) => entry.carriedFrom?.revision === review.baseline?.revision && entry.field === item.field)} onClick={() => carryBaseline(index)}>{item.field === "feeCents" && feeContext?.scheduleChangeRisk ? "Bring earlier fee for checking" : "Keep this earlier value"}</button></li>)}</ul>}<details><summary>Earlier source</summary><pre>{review.baseline.source}</pre></details>{review.baseline.fixture && <p>Earlier source was a fictional example with prewritten results.</p>}</details>}

                {unreviewed.length > 0 && <div className="missing-box"><div className="box-heading"><span aria-hidden="true">?</span><div><h3>Suggestions to review</h3><p>There are suggested values for {unreviewed.map((field) => field.label).join(", ")}, but none is selected for your review.</p></div></div></div>}
                {missing.length > 0 && <div className="missing-box"><div className="box-heading"><span aria-hidden="true">+</span><div><h3>No value provided</h3><p>No value is shown for these fields. Add one if you know it; a blank does not mean zero or agreement.</p></div></div><div className="missing-tags">{missing.map((field) => <button type="button" key={field.key} disabled={editingLocked || review.items.some((item) => item.field === field.key && item.manual)} onClick={() => addManualField(field.key)}>+ {field.label}</button>)}</div></div>}

                {review.items.length > 0 && <><h3 className="details-heading">Review individual values</h3><p className="details-intro">Open a value to check its source, edit it, or include it in your review.</p><div className="detail-list">{review.items.map((item, index) =>
                  <DetailCard key={item.field + "-" + index} item={item} index={index} freshModelReview={freshModelReview} locked={editingLocked} evidenceOk={Boolean(currentEvidence?.ok)}
                    onValue={(value) => updateItem(index, value)} onSelect={(selected) => selectItem(index, selected)}
                    onPublicShare={(share) => setPublicShare(index, share)} onConfirmPublic={(confirmed) => confirmPublicValue(index, confirmed)} />)}</div></>}

                <p className="status-note">{hasUnsavedChanges ? "There are unsaved edits." : "This draft is saved."} No agreement has been confirmed.</p>
              </div>
            )}
          </section>
        </div>
        {previousReview && revisions[0] && snapshotEvidence?.ok && <TermsSheet revision={revisions[0].revision} review={previousReview} />}
        {previousReview && snapshotEvidence && !snapshotEvidence.ok && <p className="callout callout-error" role="alert">The latest saved review has an unverifiable source link. Its terms sheet and public card are hidden; its history has not been changed. Start a new review from the current text.</p>}
        <div className="bottom-note"><span aria-hidden="true">✳</span><p><strong>Built around your real conversations.</strong> Keep using your existing messenger; you’re always in control of what gets shared.</p></div>
      </main>
      <SiteFooter items={["JAZZLINK AI", "NEW YORK · USD · AMERICA/NEW_YORK", "EARLY PREVIEW · FICTIONAL DATA"]} />
    </div>
  );
}
