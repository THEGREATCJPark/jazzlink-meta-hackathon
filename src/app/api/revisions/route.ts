import { authenticatedDraftClient, isUuid, sameOrigin } from "@/server/supabase/draft-request";
import { readReviewRequest } from "@/server/supabase/review-request";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const draftId = new URL(request.url).searchParams.get("draftId");
  if (!draftId || !isUuid(draftId)) return Response.json({ error: "A valid draft ID is required." }, { status: 400 });
  const auth = await authenticatedDraftClient();
  if (!auth) return Response.json({ error: "Sign in to access reviews." }, { status: 401 });
  const { data, error } = await auth.supabase.from("gig_reviews").select("*")
    .eq("owner_id", auth.userId).eq("draft_id", draftId).order("revision", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "Could not load reviews." }, { status: 500 });
  return Response.json({ revisions: data }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authenticatedDraftClient();
  if (!auth) return Response.json({ error: "Sign in to review a draft." }, { status: 401 });
  const body = await readReviewRequest(request);
  if (!body) return Response.json({ error: "Review request is invalid or confirmation is missing." }, { status: 400 });
  const { data: id, error } = await auth.supabase.rpc("create_gig_review", {
    p_draft_id: body.draftId,
    p_expected_version: body.expectedVersion,
    p_request_id: body.requestId,
    p_confirm_review: body.confirmReview,
  });
  if (error) {
    if (error.code === "P0002") return Response.json({ error: "Draft not found." }, { status: 404 });
    if (error.code === "40001" || error.code === "23505") {
      return Response.json({ error: "The saved draft changed or was already reviewed. Reload and review it." }, { status: 409 });
    }
    if (error.code === "22023") return Response.json({ error: "Review request is invalid or has already been used." }, { status: 400 });
    return Response.json({ error: "Could not create a review." }, { status: 500 });
  }
  const { data: revision, error: readError } = await auth.supabase.from("gig_reviews").select("*")
    .eq("owner_id", auth.userId).eq("id", id).maybeSingle();
  if (readError || !revision) return Response.json({ error: "Review saved, but could not be loaded. Retry with the same request ID." }, { status: 500 });
  return Response.json({ revision }, { status: 201, headers: privateHeaders });
}
