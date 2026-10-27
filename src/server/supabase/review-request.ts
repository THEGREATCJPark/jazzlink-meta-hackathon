function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export type ReviewRequest = {
  draftId: string;
  expectedVersion: number;
  requestId: string;
  confirmReview: true;
};

/** Review content is intentionally absent: the database reads the saved draft. */
export async function readReviewRequest(request: Request): Promise<ReviewRequest | null> {
  if (!request.body || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > 4096)) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return null;
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const input: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const body = input as Record<string, unknown>;
    if (Object.keys(body).some((key) => !["draftId", "expectedVersion", "requestId", "confirmReview"].includes(key))) return null;
    if (typeof body.draftId !== "string" || !isUuid(body.draftId) ||
      typeof body.requestId !== "string" || !isUuid(body.requestId) ||
      !Number.isSafeInteger(body.expectedVersion) || (body.expectedVersion as number) < 1 ||
      (body.expectedVersion as number) > 2147483647 || body.confirmReview !== true) return null;
    return {
      draftId: body.draftId,
      expectedVersion: body.expectedVersion as number,
      requestId: body.requestId,
      confirmReview: true,
    };
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
