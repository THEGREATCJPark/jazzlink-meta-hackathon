import { createSupabaseServerClient } from "@/server/supabase/server";
import { extractTerms, MetaError } from "@/server/meta";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const length = request.headers.get("content-length");
  if ((length && (!/^\d+$/.test(length) || Number(length) > 32000)) ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !request.body) {
    return Response.json({ error: "Invalid or oversized input." }, { status: 413 });
  }
  let payload: unknown;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 32000) { await reader.cancel(); return Response.json({ error: "Input is too long." }, { status: 413 }); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  finally { reader.releaseLock(); }
  if (!payload || typeof payload !== "object" || !("text" in payload) || typeof payload.text !== "string" ||
      !payload.text.trim() || payload.text.length > 8000) {
    return Response.json({ error: "Enter up to 8,000 characters of conversation." }, { status: 400 });
  }
  const sourceText = payload.text;
  if (!process.env.MODEL_API_KEY || !process.env.META_TEXT_MODEL || process.env.MODEL_API_BASE_URL !== "https://api.meta.ai/v1") {
    return Response.json({ error: "AI extraction is not configured. Your text has not been sent." }, { status: 503 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.is_anonymous) return Response.json({ error: "Sign in to use AI extraction." }, { status: 401 });
    const { data: reserved, error: quotaError } = await supabase.rpc("reserve_model_call");
    if (quotaError) return Response.json({ error: "AI quota is unavailable. Try again later." }, { status: 503 });
    if (reserved !== true) return Response.json({ error: "Today's AI request limit has been reached. Your text is still here." }, { status: 429 });
    const result = await extractTerms(sourceText);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const kind = error instanceof MetaError ? error.kind : "provider";
    const message = kind === "model_unavailable" ? "The configured AI model is unavailable. Your text and current review are still here; you can continue with manual review."
      : kind === "invalid_output" ? "The response could not be verified against the source. Please review or try again."
      : kind === "timeout" ? "The AI request timed out. Your text is still here."
        : "AI extraction is temporarily unavailable. Your text is still here.";
    return Response.json({ error: message }, { status: kind === "model_unavailable" ? 503 : 502 });
  }
}
