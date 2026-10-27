"use client";

import { useRef, useState } from "react";
import { ticketLabel, validatePublicCard, type PublicCardInput } from "@/domain/public-card";
import styles from "./PublicTermsCard.module.css";

/**
 * Deliberate public-field allowlist. Callers must construct this object from a
 * human-reviewed revision; never spread a complete gig or model response.
 */
export type PublicTermsCardProps = PublicCardInput;

function fit(value: string, limit: number, width = 850) {
  return Array.from(value).length > limit ? { textLength: width, lengthAdjust: "spacingAndGlyphs" as const } : {};
}

export default function PublicTermsCard({
  revision,
  title,
  venue,
  date,
  artist,
  sets,
  setCount,
  ticketCents,
}: PublicTermsCardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [message, setMessage] = useState("");
  const publicTitle = title?.trim() || "Title not specified";
  const publicVenue = venue?.trim() || "Venue not specified";
  const publicArtist = artist?.trim() || "Artist not specified";
  const publicDate = date?.trim() || "";
  const publicSets = sets?.trim() || "";
  const publicTicket = ticketCents?.trim() || "";
  const { canExport, missingTitle, missingVenue, missingArtist, invalidDate, invalidTime,
    invalidTicket, invalidText, invalidRevision, invalidSetCount, setCountMismatch, scheduleStatus } =
    validatePublicCard({ revision, title, venue, artist, date, sets, setCount, ticketCents });

  function downloadCard() {
    if (!canExport || !svgRef.current) return;
    try {
      const source = new XMLSerializer().serializeToString(svgRef.current);
      const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "jazzlink-public-card-revision-" + revision + ".svg";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage("Card downloaded. Please review it before sharing.");
    } catch {
      setMessage("Download was unavailable. Your reviewed information is unchanged; please try again.");
    }
  }

  return (
    <section className={styles.section} aria-labelledby="public-card-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>PUBLIC INFORMATION · REVISION {revision}</p>
          <h2 id="public-card-title">{canExport ? "Your gig, ready to share." : "Preview public gig details."}</h2>
          <p>Preview the public details from this reviewed version. No information is posted automatically.</p>
        </div>
      </div>

      <svg ref={svgRef} className={styles.artwork} viewBox="0 0 1080 1080" width="1080" height="1080" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Public gig information card" aria-describedby="public-card-description">
        <title>Public gig information card</title>
        <desc id="public-card-description">Gig information card with English and Korean labels. Review the details before sharing.</desc>
        <rect width="1080" height="1080" fill="#f1f2e7" />
        <rect x="34" y="34" width="1012" height="1012" fill="none" stroke="#809b7f" strokeWidth="2" />
        <circle cx="928" cy="135" r="55" fill="#d5ddbf" />
        <circle cx="928" cy="135" r="26" fill="none" stroke="#789477" strokeWidth="2" />
        <text x="96" y="125" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="700" letterSpacing="5" fill="#66816a">JAZZLINK / LIVE MUSIC</text>
        <text x="96" y="185" fontFamily="Arial, sans-serif" fontSize="22" fill="#6e8470">PUBLIC GIG INFORMATION · 공개 공연 정보</text>
        <text x="96" y="285" fontFamily="Georgia, serif" fontSize="68" fill="#294638" {...fit(publicTitle, 19, 880)}>{publicTitle}</text>
        <text x="96" y="355" fontFamily="Arial, sans-serif" fontSize="37" fill="#506b53" {...fit(publicArtist, 28, 880)}>{publicArtist}</text>
        <line x1="96" y1="403" x2="984" y2="403" stroke="#a8b9a2" strokeWidth="2" />

        <text x="96" y="474" fontFamily="Arial, sans-serif" fontSize="21" fontWeight="700" fill="#788e79">DATE · 공연 날짜</text>
        <text x="96" y="525" fontFamily="Georgia, serif" fontSize="39" fill="#294638">{publicDate || "Not specified"}</text>
        <text x="96" y="597" fontFamily="Arial, sans-serif" fontSize="21" fontWeight="700" fill="#788e79">SET TIMES · 공연 시간</text>
        <text x="96" y="648" fontFamily="Georgia, serif" fontSize="39" fill="#294638" {...fit(publicSets, 28, 880)}>{publicSets || "Not specified"}</text>
        <text x="96" y="680" fontFamily="Arial, sans-serif" fontSize="19" fill="#6f8471">America/New_York</text>
        <text x="96" y="750" fontFamily="Arial, sans-serif" fontSize="21" fontWeight="700" fill="#788e79">VENUE · 장소</text>
        <text x="96" y="801" fontFamily="Georgia, serif" fontSize="39" fill="#294638" {...fit(publicVenue, 28, 880)}>{publicVenue}</text>
        <text x="96" y="873" fontFamily="Arial, sans-serif" fontSize="21" fontWeight="700" fill="#788e79">TICKET · 입장권</text>
        <text x="96" y="924" fontFamily="Georgia, serif" fontSize="39" fill="#294638">{ticketLabel(publicTicket)}</text>
        <line x1="96" y1="968" x2="984" y2="968" stroke="#a8b9a2" strokeWidth="2" />
        <text x="96" y="1003" fontFamily="Arial, sans-serif" fontSize="18" letterSpacing="2" fill="#7d937e">REVIEWED VERSION · 검토 버전 {revision}</text>
      </svg>

      <div className={styles.actions}>
        <button type="button" onClick={downloadCard} disabled={!canExport}>Download public card <span aria-hidden="true">↗</span></button>
        <p>SVG · 1080 × 1080 · English with Korean labels</p>
      </div>
      {!canExport ? (
        <p className={styles.warning} role="status">
          {missingTitle ? "Add a gig title. " : ""}
          {missingVenue ? "Add a venue. " : ""}
          {missingArtist ? "Add an artist or band. " : ""}
          {invalidDate ? "Add a valid date (YYYY-MM-DD). " : ""}
          {invalidTime ? "Add valid set times (24-hour HH:MM, comma-separated). " : ""}
          {invalidSetCount ? "Total set count must be a whole number from 1 to 99. " : ""}
          {setCountMismatch ? "The number of set times must match the total set count. " : ""}
          {invalidTicket ? "Ticket price must be whole USD cents. " : ""}
          {invalidText ? "Keep title, artist and venue under 120 characters on one line. " : ""}
          {invalidRevision ? "A valid reviewed revision is required. " : ""}
          {scheduleStatus === "invalid" && !invalidDate && !invalidTime ? "The date or set times cannot be interpreted in New York. " : ""}
          {scheduleStatus === "nonexistent" ? "A time does not exist in New York because of a clock change. " : ""}
          {scheduleStatus === "ambiguous" ? "A time occurs twice in New York during a clock change; selecting the occurrence is not supported yet. " : ""}
          {scheduleStatus === "overnight_date_needed" ? "The set list may cross midnight; dates for individual sets are not supported yet. " : ""}
          {scheduleStatus === "unavailable" ? "New York timezone data is unavailable. " : ""}
          Export is disabled until these details are ready.
        </p>
      ) : <p className={styles.note}>Review the card before sharing. A reviewed version is not proof of the other party’s consent.</p>}
      {message ? <p className={styles.note} role="status">{message}</p> : null}
    </section>
  );
}
