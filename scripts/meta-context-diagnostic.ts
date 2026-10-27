import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { extractTerms, MetaError } from "../src/server/meta.ts";
import { containsCredentialLikeText } from "./evaluate-one.ts";
import type { Extraction } from "../src/domain/terms.ts";
import type { PriorContext } from "../src/server/prior-context.ts";

const source = "Venue: Could we add one extra set at 9 PM?";
const prior: PriorContext = { revision: 1, selected: [
  { field: "setCount", value: "2", evidence: { kind: "source", quote: "two sets", edited: false, interpretation: "stated" } },
  { field: "feeCents", value: "90000", evidence: { kind: "source", quote: "$900", edited: false, interpretation: "proposed" } },
] };
type Dependencies = {
  catalog: (key: string) => Promise<Response>;
  extract: (text: string, context: PriorContext) => Promise<Extraction>;
};

/** One catalog read and, only for an exact listed model, one synthetic adapter call. */
export async function runDiagnostic(key: string, model: string, deps: Dependencies) {
  if (!key || !/^[A-Za-z0-9_.\/-]{1,100}$/.test(model)) return { status: "invalid_configuration", catalogCalls: 0, adapterCalls: 0 };
  let response: Response;
  try { response = await deps.catalog(key); }
  catch (error) { return { status: error instanceof Error && error.name === "TimeoutError" ? "catalog_timeout" : "catalog_unavailable", catalogCalls: 1, adapterCalls: 0 }; }
  if (!response.ok) return { status: "catalog_http_failure", httpStatus: response.status, catalogCalls: 1, adapterCalls: 0 };
  let payload: unknown;
  try { payload = await response.json(); } catch { return { status: "invalid_catalog", catalogCalls: 1, adapterCalls: 0 }; }
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data) || payload.data.length > 10000) {
    return { status: "invalid_catalog", catalogCalls: 1, adapterCalls: 0 };
  }
  const listed = payload.data.some((item: unknown) => item !== null && typeof item === "object" && "id" in item && item.id === model);
  if (!listed) return { status: "configured_model_not_listed", modelCount: payload.data.length, catalogCalls: 1, adapterCalls: 0 };
  const started = Date.now();
  try {
    const result = await deps.extract(source, prior);
    const withheld = containsCredentialLikeText(result, key);
    return { status: withheld ? "output_withheld" : "response_received", modelCount: payload.data.length,
      catalogCalls: 1, adapterCalls: 1, elapsedMs: Date.now() - started, result: withheld ? null : result, humanReview: "required" };
  } catch (error) {
    return { status: "adapter_failed", catalogCalls: 1, adapterCalls: 1, elapsedMs: Date.now() - started,
      errorKind: error instanceof MetaError ? error.kind : "unexpected" };
  }
}

async function main() {
  const key = process.env.MODEL_API_KEY ?? "";
  const model = process.env.META_TEXT_MODEL ?? "";
  const provenance = process.env.META_KEY_PROVENANCE === "operator_attests_production" ? "operator_attests_production" : "independent_or_unverified";
  let telemetry: { status: string | number | null; inputTokens: number | null; outputTokens: number | null } | null = null;
  const report = await runDiagnostic(key, model, {
    catalog: (secret) => fetch("https://api.meta.ai/v1/models", { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(30000), cache: "no-store", redirect: "error" }),
    extract: async (text, context) => {
      const previous = console.info;
      const originalFetch = globalThis.fetch;
      // Do not follow redirects: the authorized budget is one provider request.
      globalThis.fetch = (input, init) => originalFetch(input, { ...init, redirect: "error" });
      console.info = (...args: unknown[]) => {
        try {
          const data = JSON.parse(String(args[0]));
          const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
          telemetry = { status: data.status === "completed" || data.status === "incomplete" || typeof data.status === "number" ? data.status : null,
            inputTokens: count(data.inputTokens), outputTokens: count(data.outputTokens) };
        } catch { /* Do not print untrusted provider diagnostics. */ }
      };
      try { return await extractTerms(text, context); } finally { console.info = previous; globalThis.fetch = originalFetch; }
    },
  });
  console.log(JSON.stringify({ keyProvenance: provenance, configuredModel: "operator supplied", ...report, telemetry,
    cost: "not reported; check account usage", scope: "synthetic direct adapter only; no app route or storage" }, null, 2));
  if (report.status !== "response_received") process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error("Diagnostic could not complete."); process.exitCode = 1; });
}
