import { authenticatedDraftClient, readDraftBody, sameOrigin } from "@/server/supabase/draft-request";

export async function GET() {
  const auth = await authenticatedDraftClient();
  if (!auth) return Response.json({ error: "Sign in to access your drafts." }, { status: 401 });
  const { data, error } = await auth.supabase.from("gig_drafts").select("*")
    .eq("owner_id", auth.userId).order("updated_at", { ascending: false }).limit(50);
  if (error) return Response.json({ error: "Could not load drafts." }, { status: 500 });
  return Response.json({ drafts: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authenticatedDraftClient();
  if (!auth) return Response.json({ error: "Sign in to save a draft." }, { status: 401 });
  const body = await readDraftBody(request, false);
  if (!body) return Response.json({ error: "Invalid or oversized draft." }, { status: 400 });
  const { data, error } = await auth.supabase.from("gig_drafts")
    .insert({ owner_id: auth.userId, source_text: body.sourceText, draft: body.draft }).select("*").single();
  if (error?.code === "P0001") return Response.json({ error: "Your draft storage limit has been reached." }, { status: 429 });
  if (error?.code === "23514") return Response.json({ error: "The draft is invalid or too large to save." }, { status: 400 });
  if (error) return Response.json({ error: "Could not save draft." }, { status: 500 });
  return Response.json({ draft: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
