import { createSupabaseServerClient } from "./server";
import { canonicalizeDraftMoney } from "../../domain/canonical-draft.ts";

const maxBodyBytes = 128 * 1024;

export async function authenticatedDraftClient() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return null;
  return { supabase, userId: data.user.id };
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function readDraftBody(request: Request, requiresVersion: boolean) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !request.body) return null;
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBodyBytes)) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const body = data as Record<string, unknown>;
    if (typeof body.sourceText !== "string" || body.sourceText.length > 20000) return null;
    if (!body.draft || typeof body.draft !== "object" || Array.isArray(body.draft)) return null;
    if (requiresVersion && (!Number.isSafeInteger(body.version) || (body.version as number) < 1 || (body.version as number) >= 2147483647)) return null;
    const canonicalDraft = canonicalizeDraftMoney(body.draft as Record<string, unknown>);
    if (!canonicalDraft) return null;
    return { sourceText: body.sourceText, draft: canonicalDraft, version: body.version as number | undefined };
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
