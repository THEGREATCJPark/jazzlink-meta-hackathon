import { authenticatedDraftClient, isUuid, readDraftBody, sameOrigin } from "@/server/supabase/draft-request";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid draft ID." }, { status: 400 });
  const auth = await authenticatedDraftClient();
  if (!auth) return Response.json({ error: "Sign in to access your draft." }, { status: 401 });
  const { data, error } = await auth.supabase.from("gig_drafts").select("*")
    .eq("id", id).eq("owner_id", auth.userId).maybeSingle();
  if (error) return Response.json({ error: "Could not load draft." }, { status: 500 });
  if (!data) return Response.json({ error: "Draft not found." }, { status: 404 });
  return Response.json({ draft: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid draft ID." }, { status: 400 });
  const auth = await authenticatedDraftClient();
  if (!auth) return Response.json({ error: "Sign in to save a draft." }, { status: 401 });
  const body = await readDraftBody(request, true);
  if (!body || body.version === undefined) return Response.json({ error: "Invalid or oversized draft." }, { status: 400 });
  const { data, error } = await auth.supabase.from("gig_drafts")
    .update({ source_text: body.sourceText, draft: body.draft, version: body.version + 1, updated_at: new Date().toISOString() })
    .eq("id", id).eq("owner_id", auth.userId).eq("version", body.version).select("*").maybeSingle();
  if (error?.code === "23514") return Response.json({ error: "The draft is invalid or too large to save." }, { status: 400 });
  if (error) return Response.json({ error: "Could not save draft." }, { status: 500 });
  if (!data) return Response.json({ error: "Draft changed or is unavailable. Reload before saving." }, { status: 409 });
  return Response.json({ draft: data }, { headers: { "Cache-Control": "private, no-store" } });
}
