"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { dollarsToCents, isValidTermValue } from "@/domain/terms";
import { mayPublish, valueWasEdited } from "@/domain/publication";
import { checkEvidenceIntegrity } from "@/domain/evidence-integrity";
import { assessFeeContext } from "@/domain/fee-context";
import { ChangeReview } from "@/components/ChangeReview";
import PublicTermsCard from "@/components/PublicTermsCard";
import { signOut } from "@/app/auth/actions";
import "./style.css";

type Field = "title" | "venue" | "date" | "artist" | "sets" | "setCount" | "additionalSets" | "feeCents" | "ticketCents" | "paymentTerms";
type Interpretation = "stated" | "proposed" | "accepted" | "rejected" | "withdrawn" | "unclear";
type Candidate = { field: Field; value: string; quote: string; status: Interpretation };
type ReviewItem = Candidate & { editedValue: string; edited: boolean; manual: boolean; selected?: boolean; publicShare?: boolean; publishConfirmed?: boolean; amountCents?: number | null; carriedFrom?: { revision: number; source: string; fixture: boolean } };
type Baseline = { revision: number; source: string; fixture: boolean; items: ReviewItem[] };
type Review = { source: string; items: ReviewItem[]; questions: string[]; fixture?: boolean; manualOnly?: boolean; baseline?: Baseline };
type SavedDraft = { id: string; source_text: string; draft: { review?: Review | null }; version: number; updated_at: string };
type SavedRevision = { id: string; draft_id: string; revision: number; draft_version: number; source_text: string; draft: { review?: Review | null }; created_at: string };

const fields: { key: Field; label: string; hint: string }[] = [
  { key: "title", label: "Gig title", hint: "Public information" },
  { key: "venue", label: "Venue", hint: "Public information" },
  { key: "date", label: "Performance date", hint: "America/New_York" },
  { key: "artist", label: "Artist or band", hint: "Public information" },
  { key: "sets", label: "Set times", hint: "America/New_York" },
  { key: "setCount", label: "Total set count", hint: "Total sets for this gig" },
  { key: "additionalSets", label: "Additional sets requested", hint: "Request only; not automatically added to total" },
  { key: "feeCents", label: "Performance fee", hint: "Private · USD" },
  { key: "ticketCents", label: "Audience ticket price", hint: "Public · USD" },
  { key: "paymentTerms", label: "Payment terms", hint: "Private" },
];
const fieldKeys = new Set(fields.map((field) => field.key));
const koreanLabels: Record<Field, string> = { title: "공연명", venue: "장소", date: "공연 날짜", artist: "출연자", sets: "세트 시간", setCount: "총 세트 수", additionalSets: "추가 요청 세트 수", feeCents: "출연료", ticketCents: "입장권", paymentTerms: "지급 조건" };
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

function itemWasEdited(item: ReviewItem) {
  return valueWasEdited(displayValue(item), item.editedValue, item.edited);
}

function mayShareItem(item: ReviewItem) {
  return mayPublish({ ...item, edited: itemWasEdited(item) });
}

function itemStatus(item: ReviewItem) {
  const origin = item.manual ? "Your entry" : itemWasEdited(item) ? `Your edit; original suggestion: ${labels[item.status]}` : labels[item.status];
  return item.carriedFrom ? `${origin} · carried from personal review ${item.carriedFrom.revision}` : origin;
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

function feeContextFor(review: Review | null | undefined) {
  const baseline = review?.baseline;
  if (!review || !baseline) return null;
  const previous = (field: Field) => baseline.items.find((item) => item.field === field)?.editedValue.trim() ?? null;
  const oldFee = previous("feeCents");
  const isEarlierValue = (item: ReviewItem) => Boolean(item.carriedFrom) &&
    (item.field !== "feeCents" || (oldFee !== null && item.editedValue.trim() === oldFee));
  return assessFeeContext({
    previous: { sets: previous("sets"), setCount: previous("setCount") },
    candidates: review.items.map((item) => ({ field: item.field, value: item.editedValue, status: item.status,
      selected: item.selected === true, fromPreviousReview: isEarlierValue(item) })),
    carriedFeeSelected: review.items.some((item) => item.field === "feeCents" && item.selected && isEarlierValue(item)),
  });
}

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
  const reviewedFeeContext = feeContextFor(previousReview);
  const publicValue = (field: Field) => {
    const item = previousReview?.items.find((entry) => entry.field === field && entry.selected && entry.publicShare && validItem(entry) && mayShareItem(entry));
    if (!item) return undefined;
    if (field === "ticketCents") return typeof item.amountCents === "number" && Number.isSafeInteger(item.amountCents) ? String(item.amountCents) : undefined;
    return item.editedValue.trim();
  };
  const changeRows = (items: ReviewItem[]) => items.map((item) => ({ field: item.field,
    label: fields.find((field) => field.key === item.field)?.label ?? item.field,
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="JazzLink AI"><span className="brand-mark">J</span><span>jazzlink<span className="brand-ai"> ai</span></span></div>
        <div className="topbar-right"><Link href="/demo">Try demo ↗</Link>{session === "signed-out" && <Link href="/auth">Sign in ↗</Link>}{session === "signed-in" && <button className="text-button" type="button" disabled={editingLocked} onClick={leaveAccount}>{loggingOut ? "Signing out…" : "Sign out"}</button>}{session === "checking" && <span className="session-label">Checking session…</span>}{session === "unavailable" && <span className="session-label">Session unavailable · <Link href="/auth">Sign in</Link></span>}<span className="prototype-badge"><span /> EARLY PREVIEW</span></div>
      </header>

      <div className="page-content">
        <div className="intro">
          <div><p className="eyebrow"><span className="eyebrow-line" /> YOUR GIG WORKSPACE</p>
            <h1>Make every gig <em>clearer.</em></h1>
            <p className="intro-copy">See what changed, what needs a closer look, and what to ask next.</p></div>
        </div>
        <div className="steps" aria-label="Workflow steps">
          <div className="step step-active"><span>01</span><div><strong>Bring the conversation</strong></div></div>
          <div className="step"><span>02</span><div><strong>Inspect the changes</strong></div></div>
          <div className="step"><span>03</span><div><strong>Record your review</strong></div></div>
        </div>

        <div className="workspace">
          <section className="panel input-panel" aria-labelledby="source-title">
            <div className="panel-heading"><div><p className="section-kicker">01 / THE CONVERSATION</p><h2 id="source-title">Start with what you know.</h2></div><span className="panel-icon">✳</span></div>
            <p className="panel-copy">Paste the relevant messages or notes. Keep speaker names and message order when you can.</p>
            <div className="input-label-row"><label htmlFor="source-text">Conversation or notes</label><button className="text-button" type="button" disabled={editingLocked} onClick={() => { if (!text || window.confirm("Replace the text currently in the input with the fictional example?")) { setText(sample); setError(""); } }}>Try a fictional example <span aria-hidden="true">↗</span></button></div>
            <button className="text-button" type="button" disabled={editingLocked} onClick={previewSample}>Preview example results without AI ↗</button>
            <textarea id="source-text" value={text} disabled={editingLocked} onChange={(event) => setText(event.target.value)} maxLength={8000} placeholder={"Venue: Can your trio play on November 20?\nMusician: Yes, we can do two sets..."} />
            <div className="input-meta"><span>Only use synthetic or permission-cleared material.</span><span>{text.length.toLocaleString()} / 8,000</span></div>
            <button className="primary-button" type="button" disabled={editingLocked || historyStatus !== "ready" || !text.trim()} onClick={requestAnalysis}>{busy ? "Reviewing your notes…" : "Review gig details"} <span aria-hidden="true">{busy ? "···" : "↗"}</span></button>
            {pendingReview && <div className="review-confirm" role="alertdialog" aria-labelledby="review-confirm-title" aria-describedby="review-confirm-description"><h3 id="review-confirm-title">Start a new review?</h3><p id="review-confirm-description">The current suggestions on this screen will be replaced. Your saved drafts and review history remain available.</p><div className="draft-actions"><button className="secondary-button" type="button" onClick={() => setPendingReview(null)}>Cancel</button><button className="secondary-button" type="button" onClick={() => { const mode = pendingReview; setPendingReview(null); if (mode === "ai") void analyze(); else startManualReview(); }}>{pendingReview === "ai" ? "Replace and analyze" : "Replace and review manually"}</button></div></div>}
            <button className="text-button" type="button" disabled={editingLocked || historyStatus !== "ready" || !text.trim()} onClick={requestManualReview}>Review manually without AI ↗</button>
            <div className="draft-actions"><button className="secondary-button" type="button" onClick={saveDraft} disabled={editingLocked || !text.trim()}>{saving ? "Saving…" : "Save private draft"}</button><button className="secondary-button" type="button" disabled={editingLocked} onClick={listDrafts}>Open saved drafts</button></div>
            {saveMessage && <p className="local-note" role="status">{saveMessage}</p>}
            {savedDrafts.length > 0 && <ul className="saved-drafts">{savedDrafts.map((saved) => <li key={saved.id}><button type="button" disabled={saving || busy || reviewBusy} onClick={() => openDraft(saved)}>{saved.source_text.split("\n")[0].slice(0, 60) || "Untitled draft"} · v{saved.version}</button></li>)}</ul>}
            {draftId && historyStatus !== "ready" && <p className="warning-note">{historyStatus === "loading" ? "Loading the previous review before analyzing changes…" : "Review history could not be loaded. Retry before analyzing changes."} {historyStatus === "error" && <button type="button" className="text-button" onClick={loadRevisions}>Retry history</button>}</p>}
            {draftId && review && <div className="review-commit"><label><input type="checkbox" checked={reviewAcknowledged} disabled={editingLocked} onChange={(event) => setReviewAcknowledged(event.target.checked)} /> I reviewed this saved snapshot, including any unresolved suggestions. This records my review only.</label><div className="draft-actions"><button className="secondary-button" type="button" disabled={!reviewAcknowledged || hasUnsavedChanges || changedSource || editingLocked || historyStatus !== "ready" || !currentEvidence?.ok} onClick={recordReview}>{reviewBusy ? "Recording…" : "Record my review"}</button><button className="secondary-button" type="button" disabled={editingLocked || historyStatus === "loading"} onClick={loadRevisions}>View review history</button></div>{hasUnsavedChanges && <p className="local-note">Save the current edits before recording your review.</p>}{changedSource && <p className="local-note">Run a fresh review before recording the changed input.</p>}{currentEvidence && !currentEvidence.ok && <p className="warning-note">Source links could not be verified. Start a new review from the current text; saved history is not changed.</p>}</div>}
            {revisions.length > 0 && <div className="revision-history"><h3>Review history</h3>{revisions.map((revision) => <details key={revision.id}><summary>Review {revision.revision} · saved draft v{revision.draft_version}</summary><p>Snapshot of your review; suggestions and missing information are not counterparty approval.</p><ul>{revision.draft.review?.items.map((item, index) => <li key={index}>{fields.find((field) => field.key === item.field)?.label}: {item.editedValue || "Unknown"} ({itemStatus(item)}{item.selected ? "; included in personal terms" : "; not selected"})</li>)}</ul><details><summary>Source at time of review</summary><pre>{revision.source_text}</pre></details></details>)}</div>}
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
                <p className="review-notice">{review.manualOnly ? "Your entries" : review.fixture ? "Example interpretations" : freshModelReview ? "AI interpretations" : "Saved interpretations"} are not proof of agreement. Check the original messages and edit anything that’s wrong.</p>
                {review.fixture && <p className="warning-note">Fictional example with prewritten results. No AI request was made. Use “Review gig details” to request a real analysis after signing in.</p>}
                {review.manualOnly && <p className="warning-note">Manual review. No AI request was made for this review; add the details you want to check below.</p>}
                {review.questions.length > 0 && <div className="questions-box"><div className="question-heading"><div><p className="section-kicker">KEEP THE CONVERSATION GOING</p><h3>Questions to consider</h3></div><button className="secondary-button" type="button" onClick={copyQuestions}>Copy questions</button></div><ul>{review.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>{copyMessage && <p className="copy-message" role="status">{copyMessage}</p>}<p className="questions-footnote">Review these first. JazzLink won’t send messages for you.</p></div>}
                {changedSource && <p className="warning-note" role="status">The input has changed since this review. These suggestions refer to the earlier text shown in their source quotes. Run a new review to update them.</p>}
                {currentEvidence && !currentEvidence.ok && <p className="warning-note" role="alert">At least one quote or earlier-review link could not be verified. Source labels and review recording are disabled for this view. Start a new review from the current text.</p>}
                {feeContext?.scheduleChangeRisk && <p className="warning-note" role="status">The schedule has a change or open request. Check the fee for that schedule separately; an earlier fee is not automatically carried to new terms.</p>}
                {feeContext?.previousFeeApplicability === "needs_reconfirmation" && <p className="warning-note" role="status">The selected earlier fee may not apply to the changed schedule. Its application and the other party’s agreement remain unconfirmed.</p>}
                {competingFields.length > 0 && <p className="warning-note" role="status">Multiple values need review for: {competingFields.map((field) => field.label).join(", ")}. A later request does not automatically replace an earlier value.</p>}
                <div className="review-summary"><div><strong>{review.items.length}</strong><span>candidate details</span></div><div><strong>{missing.length}</strong><span>without a value</span></div><div><strong>{unreviewed.length}</strong><span>fields to review</span></div></div>
                {previousReview && snapshotEvidence?.ok && <ChangeReview previous={changeRows(previousReview.items.filter((item) => item.selected))} current={changeRows(review.items)} />}
                {review.baseline && currentEvidence?.ok && <details className="baseline-box"><summary>Keep values from earlier personal review · revision {review.baseline.revision}</summary><p>These are earlier choices, not automatically carried into the next review. Choose each value you want to keep after checking the new message.</p>{review.baseline.items.length === 0 ? <p>No values were selected in that review.</p> : <ul>{review.baseline.items.map((item, index) => <li key={index}><strong>{fields.find((field) => field.key === item.field)?.label}: {item.editedValue}</strong><span>{itemStatus(item)}</span><button className="secondary-button" type="button" disabled={editingLocked || review.items.some((entry) => entry.carriedFrom?.revision === review.baseline?.revision && entry.field === item.field)} onClick={() => carryBaseline(index)}>{item.field === "feeCents" && feeContext?.scheduleChangeRisk ? "Bring earlier fee for checking" : "Keep this earlier value"}</button></li>)}</ul>}<details><summary>Earlier source</summary><pre>{review.baseline.source}</pre></details>{review.baseline.fixture && <p>Earlier source was a fictional example with prewritten results.</p>}</details>}
                {unreviewed.length > 0 && <div className="missing-box"><div className="box-heading"><span>?</span><div><h3>Suggestions to review</h3><p>There are suggested values for {unreviewed.map((field) => field.label).join(", ")}, but none is selected for your review.</p></div></div></div>}
                {missing.length > 0 && <div className="missing-box"><div className="box-heading"><span>?</span><div><h3>No value provided</h3><p>No value is shown for these fields. Add one if you know it; a blank does not mean zero or agreement.</p></div></div><div className="missing-tags">{missing.map((field) => <button type="button" key={field.key} disabled={editingLocked || review.items.some((item) => item.field === field.key && item.manual)} onClick={() => addManualField(field.key)}>+ {field.label}</button>)}</div></div>}
                {review.items.length > 0 && <><h3 className="details-heading">Review individual values</h3><p className="details-intro">Open a value to check its source, edit it, or include it in your review.</p><div className="detail-list">{review.items.map((item, index) => {
                  const field = fields.find((entry) => entry.key === item.field);
                  return <details className="detail-card" open={item.manual || undefined} key={item.field + "-" + index}>
                    <summary className="detail-top"><span><strong>{field?.label}</strong><span className="detail-preview">{item.editedValue || "No value entered"}{item.selected ? " · Included in your review" : " · Not selected"}</span></span><span className={"status-chip status-" + item.status}>{item.manual ? "Your entry" : labels[item.status]}</span></summary>
                    <p className="field-hint">{field?.hint}</p>
                    <label className="detail-label" htmlFor={"detail-" + index}>{itemWasEdited(item) ? "Your edit (not saved or approved)" : freshModelReview && !item.carriedFrom ? "AI-suggested value" : "Suggested value"}</label>
                    <input id={"detail-" + index} value={item.editedValue} disabled={editingLocked} onChange={(event) => updateItem(index, event.target.value)} placeholder="Unknown" />
                    <label className="select-term"><input type="checkbox" checked={item.selected ?? false} disabled={editingLocked || !validItem(item)} onChange={(event) => selectItem(index, event.target.checked)} /> Include this value in my reviewed terms</label>
                    {publicFields.has(item.field) && item.selected && <details className="item-disclosure"><summary>Public card options</summary>
                      {(item.status !== "stated" || itemWasEdited(item) || item.manual) && <label className="select-term"><input type="checkbox" checked={item.publishConfirmed ?? false} disabled={editingLocked} onChange={(event) => confirmPublicValue(index, event.target.checked)} /> I separately checked this is the current value I want to publish. This does not verify the other party’s consent.</label>}
                      <label className="select-term"><input type="checkbox" checked={Boolean(item.publicShare && mayShareItem(item))} disabled={editingLocked || !mayShareItem(item)} onChange={(event) => setPublicShare(index, event.target.checked)} /> Allow this field on the public card</label>
                    </details>}
                    {!validItem(item) && item.editedValue.trim() && <p className="edit-explanation">Use a valid value: dates need YYYY-MM-DD, times use HH:MM, and amounts use USD dollars.</p>}
                    {itemWasEdited(item) && !item.manual && <p className="edit-explanation">Original suggestion: {displayValue(item) || "Unknown"}. The source refers to that suggestion, not your edit.</p>}
                    {item.carriedFrom && currentEvidence?.ok && <p className="edit-explanation">Carried by you from personal review {item.carriedFrom.revision}.{item.carriedFrom.fixture ? " Earlier source was a fictional example." : ""} It has not been automatically accepted by the other party.</p>}
                    {item.manual ? <p className="edit-explanation">Entered by you; no source quote or counterparty approval is attached.</p> : currentEvidence?.ok ? <details className="source-quote"><summary>{item.carriedFrom ? "Source from earlier review" : "See source quote"}</summary><blockquote>“{item.quote}”</blockquote>{item.carriedFrom && <details><summary>Original source</summary><pre>{item.carriedFrom.source}</pre></details>}</details> : <p className="warning-note">Source link is not verified.</p>}
                  </details>;
                })}</div></>}

                <p className="local-note">{hasUnsavedChanges ? "There are unsaved edits." : "This draft is saved."} No agreement has been confirmed.</p>
              </div>
            )}
          </section>
        </div>
        {previousReview && revisions[0] && snapshotEvidence?.ok && <section className="terms-output"><p className="section-kicker">YOUR REVIEWED TERMS · REVISION {revisions[0].revision}</p><h2>Personal review / 개인 검토</h2><p>This is your own review, not a contract or proof of the other party’s approval. Unselected fields remain unresolved.</p>{reviewedFeeContext?.previousFeeApplicability === "needs_reconfirmation" && <p className="warning-note">The earlier fee’s application to the changed schedule is unconfirmed. Review it with the other party.</p>}<dl>{fields.map((field) => {
          const selected = previousReview.items.find((item) => item.field === field.key && item.selected);
          return <div key={field.key}><dt>{field.label} / {koreanLabels[field.key]}</dt><dd>{selected?.editedValue || "Not selected / 미선택"}{selected && <small> · {itemStatus(selected)}</small>}</dd></div>;
        })}</dl><PublicTermsCard revision={revisions[0].revision} title={publicValue("title")} venue={publicValue("venue")} date={publicValue("date")} artist={publicValue("artist")} sets={publicValue("sets")} setCount={previousReview.items.find((item) => item.field === "setCount" && item.selected && validItem(item))?.editedValue} ticketCents={publicValue("ticketCents")} /></section>}
        {previousReview && snapshotEvidence && !snapshotEvidence.ok && <p className="warning-note" role="alert">The latest saved review has an unverifiable source link. Its terms sheet and public card are hidden; its history has not been changed. Start a new review from the current text.</p>}
        <div className="bottom-note"><span>✳</span><p><strong>Built around your real conversations.</strong> Keep using your existing messenger; you’re always in control of what gets shared.</p></div>
      </div>
      <footer><span>JAZZLINK AI</span><span>NEW YORK · USD · AMERICA/NEW_YORK</span><span>EARLY PREVIEW · FICTIONAL DATA</span></footer>
    </main>
  );
}
