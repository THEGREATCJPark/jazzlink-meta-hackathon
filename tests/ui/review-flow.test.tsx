import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn(async () => ({ ok: true })) }));
import Home from "@/app/page";
import Demo from "@/app/demo/page";
import { ChangeReview } from "@/components/ChangeReview";
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
const failure = (status: number, error: string) => ({ ok: false, status, json: async () => ({ error }) });
const draft = { id: "123e4567-e89b-42d3-a456-426614174000", source_text: "New source", draft: { review: null }, version: 4, updated_at: "2026-10-27" };
let copy: ReturnType<typeof vi.fn>;
beforeEach(() => { copy = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("workspace interaction", () => {
  it("displays pending, signed-out, and signed-in session states exclusively", async () => {
    let resolve!: (value: unknown) => void;
    const deferred = new Promise((r) => { resolve = r; });
    vi.stubGlobal("fetch", vi.fn(() => deferred));
    const view = render(<Home />);
    expect(screen.getByText("Checking session…")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
    resolve(failure(401, "Sign in"));
    expect(await screen.findByRole("link", { name: /sign in/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
    view.unmount();
    vi.stubGlobal("fetch", vi.fn(async () => ok({ drafts: [] })));
    render(<Home />);
    expect(await screen.findByRole("button", { name: /sign out/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
  });

  it("distinguishes missing from unselected values, copies questions and discloses sources", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => failure(401, "Sign in")));
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /preview example results without ai/i }));
    expect(screen.getByText(/These questions reflect the original analysis\./)).toBeTruthy();
    const suggestions = screen.getByRole("heading", { name: "Suggestions to review" }).parentElement!;
    expect(within(suggestions).getByText(/Venue/)).toBeTruthy();
    const missing = screen.getByRole("heading", { name: "No value provided" }).parentElement!.parentElement!.parentElement!;
    expect(within(missing).getByRole("button", { name: /Gig title/i })).toBeTruthy();
    expect(within(missing).queryByRole("button", { name: /Venue/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copy questions" }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(expect.stringContaining("What is the year")));
    const venue = screen.getByText("Blue Alley · Not selected").closest("details")!;
    expect(venue.open).toBe(false);
    fireEvent.click(within(venue).getByText("Blue Alley · Not selected"));
    fireEvent.change(within(venue).getByLabelText("Suggested value"), { target: { value: "A different venue" } });
    expect(screen.getByText(/may no longer fit your changes or selections/i)).toBeTruthy();
    fireEvent.click(within(venue).getByLabelText("Include this value in my reviewed terms"));
    const source = within(venue).getByText("See source quote").closest("details")!;
    expect(source.open).toBe(false);
    fireEvent.click(within(venue).getByText("See source quote"));
    expect(source.open).toBe(true);
    expect(within(source).getByText("“Blue Alley”")).toBeTruthy();
  });

  it("flags original questions when the source changes without making an AI request", () => {
    const fetchMock = vi.fn(async (url: string) => { void url; return failure(401, "Sign in"); });
    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /preview example results without ai/i }));
    fireEvent.change(screen.getByLabelText("Conversation or notes"), { target: { value: "Changed source" } });
    expect(screen.getByText(/may no longer fit your changes or selections/i)).toBeTruthy();
    expect(fetchMock.mock.calls.every(([url]) => url !== "/api/extract")).toBe(true);
  });

  it("sends revision zero for a saved draft and preserves text on stale rejection", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const saved = { ...draft, draft: { review: { source: "New source", items: [{ field: "venue", value: "New source", quote: "New source", status: "stated", editedValue: "New source", edited: false, manual: false }], questions: ["Is this venue correct?"] } } };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url === "/api/drafts") return ok({ drafts: [saved] });
      if (url.startsWith("/api/revisions?")) return ok({ revisions: [] });
      if (url === "/api/extract") return failure(409, "Draft or review history changed. Reload and try again.");
      throw new Error("Unexpected fetch " + url);
    }));
    render(<Home />);
    await screen.findByRole("button", { name: /sign out/i });
    fireEvent.click(screen.getByRole("button", { name: "Open saved drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: /New source · v4/i }));
    await waitFor(() => expect((screen.getByRole("button", { name: /Review gig details/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: /Review gig details/i }));
    fireEvent.click(screen.getByRole("button", { name: "Replace and analyze" }));
    expect(await screen.findByText(/Draft or review history changed/)).toBeTruthy();
    expect(screen.getByText("Is this venue correct?")).toBeTruthy();
    expect(screen.getByText("New source · Not selected")).toBeTruthy();
    expect((screen.getByLabelText("Conversation or notes") as HTMLTextAreaElement).value).toBe("New source");
    const request = requests.find((entry) => entry.url === "/api/extract")!;
    expect(JSON.parse(String(request.init?.body))).toEqual({ text: "New source", context: { draftId: draft.id, expectedVersion: 4, expectedRevision: 0 } });
  });
});

describe("fictional demo interaction", () => {
  it("prioritizes changes, copies the complete-arrangement question and gates a fee-free SVG", async () => {
    render(<Demo />);
    fireEvent.click(screen.getByRole("button", { name: /I reviewed these original details/i }));
    const panel = screen.getByRole("heading", { name: "Inspect the changes" }).closest("section")!;
    const other = within(panel).getByText(/Other earlier or matching details/).closest("details")!;
    expect(other.open).toBe(false);
    expect(within(other).getByText("Date")).toBeTruthy();
    expect(within(panel).getByText("Additional sets requested")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy questions" }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(expect.stringContaining("total performance fee for the complete new arrangement")));
    fireEvent.click(screen.getByRole("button", { name: /Show the fictional reply/i }));
    fireEvent.click(screen.getByLabelText(/Use the explicitly stated three-set schedule/i));
    fireEvent.click(screen.getByLabelText(/Use the stated \$1,200 total fee/i));
    fireEvent.click(screen.getByLabelText(/I reviewed these choices/i));
    fireEvent.click(screen.getByRole("button", { name: /Record my demo review/i }));
    expect(screen.getByText(/Check the public card option above/i)).toBeTruthy();
    expect(screen.queryByText(/Add a valid date/i)).toBeNull();
    expect(screen.queryByRole("img", { name: "Public gig information card" })).toBeNull();
    fireEvent.click(screen.getByLabelText(/I separately checked that the date/i));
    const svg = screen.getByRole("img", { name: "Public gig information card" });
    expect(svg.textContent).toContain("2026-11-20");
    expect(svg.textContent).toContain("21:00, 22:00, 23:00");
    expect(svg.textContent).not.toContain("1,200");
    expect(svg.textContent).not.toContain("900");
    expect((screen.getByRole("button", { name: /Download public card/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});


it("keeps conflicting proposals visible and matching details behind disclosure", () => {
  render(<ChangeReview previous={[{ field: "sets", label: "Set times", value: "20:00", status: "stated" }, { field: "venue", label: "Venue", value: "Blue Alley", status: "stated" }]} current={[{ field: "sets", label: "Set times", value: "21:00", status: "proposed" }, { field: "sets", label: "Set times", value: "22:00", status: "unclear" }, { field: "venue", label: "Venue", value: "Blue Alley", status: "stated" }]} />);
  expect(screen.getByText(/Multiple values are shown/)).toBeTruthy();
  expect(screen.getByText("21:00")).toBeTruthy();
  expect(screen.getByText("22:00")).toBeTruthy();
  expect(screen.getByText("Status: Proposal")).toBeTruthy();
  expect(screen.getByText("Status: Needs review")).toBeTruthy();
  const matching = screen.getByText(/Other earlier or matching details/).closest("details")!;
  expect(matching.open).toBe(false);
  fireEvent.click(within(matching).getByText(/Other earlier or matching details/));
  expect(matching.open).toBe(true);
  expect(within(matching).getByText("Venue")).toBeTruthy();
});
