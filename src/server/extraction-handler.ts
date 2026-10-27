import { MetaError, type extractTerms } from "./meta.ts";
import { ContextError, loadPriorContext, parseContext, type ContextRepository } from "./prior-context.ts";

type Auth = { userId: string; repository: ContextRepository; reserve: () => PromiseLike<{ data: boolean | null; error: unknown }> };
type Dependencies = { authenticate: () => Promise<Auth | null>; extract: typeof extractTerms };

export async function handleExtraction(request: Request, dependencies: Dependencies) {
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => !["text", "context"].includes(key)) || !("text" in payload) || typeof payload.text !== "string" ||
      !payload.text.trim() || payload.text.length > 8000) {
    return Response.json({ error: "Enter up to 8,000 characters of conversation." }, { status: 400 });
  }
  const sourceText = payload.text;
  const contextRequest = "context" in payload ? parseContext(payload.context) : undefined;
  if (contextRequest === null) return Response.json({ error: "Review context is invalid." }, { status: 400 });
  if (!process.env.MODEL_API_KEY || !process.env.META_TEXT_MODEL || process.env.MODEL_API_BASE_URL !== "https://api.meta.ai/v1") {
    return Response.json({ error: "AI extraction is not configured. Your text has not been sent." }, { status: 503 });
  }
  try {
    const auth = await dependencies.authenticate();
    if (!auth) return Response.json({ error: "Sign in to use AI extraction." }, { status: 401 });
    const prior = contextRequest ? await loadPriorContext(auth.repository, auth.userId, contextRequest) : undefined;
    const { data: reserved, error: quotaError } = await auth.reserve();
    if (quotaError) return Response.json({ error: "AI quota is unavailable. Try again later." }, { status: 503 });
    if (reserved !== true) return Response.json({ error: "Today's AI request limit has been reached. Your text is still here." }, { status: 429 });
    const result = await dependencies.extract(sourceText, prior);
    // A concurrent draft or review change must not return a result tied to an older baseline.
    if (contextRequest) await loadPriorContext(auth.repository, auth.userId, contextRequest);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ContextError) {
      const status = error.kind === "stale" ? 409 : error.kind === "not_found" ? 404 : error.kind === "invalid" ? 422 : 503;
      const message = error.kind === "stale" ? "The saved draft or latest review changed. Reload before analyzing."
        : error.kind === "not_found" ? "Draft not found."
          : error.kind === "invalid" ? "The earlier review or its source links could not be verified for analysis."
            : "Could not load review context. Try again later.";
      return Response.json({ error: message }, { status });
    }
    const kind = error instanceof MetaError ? error.kind : "provider";
    const message = kind === "model_unavailable" ? "The configured AI model is unavailable. Your text and current review are still here; you can continue with manual review."
      : kind === "invalid_output" ? "The response could not be verified against the source. Please review or try again."
      : kind === "timeout" ? "The AI request timed out. Your text is still here."
        : "AI extraction is temporarily unavailable. Your text is still here.";
    return Response.json({ error: message }, { status: kind === "model_unavailable" ? 503 : 502 });
  }
}
