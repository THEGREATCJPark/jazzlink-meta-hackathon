import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { extractTerms, MetaError } from "../src/server/meta.ts";
import type { Extraction } from "../src/domain/terms.ts";

const allowedModels = new Set(["muse-spark-1.2", "muse-spark-1.3"]);
const datasetVersion = "evaluation-v1";
export const EXPECTED_DATASET_SHA256 = "7e3ec39bdb144cc68c2c27275186e1bfb357758a71e75ead1c73d9151204a41c";
type Status = "started" | "response_received" | "failed" | "interrupted" | "output_withheld";
type Telemetry = { status: string | number | null; code: string | null; elapsedMs: number | null; inputTokens: number | null; outputTokens: number | null };
export type EvaluationRecord = {
  datasetVersion: string;
  expectedDatasetSha256: string;
  caseId: string;
  requestedModel: string;
  revision: string | null;
  runId: string | null;
  runAttempt: string | null;
  status: Status;
  startedAt: string;
  finishedAt: string | null;
  elapsedMs: number | null;
  adapterCalls: number;
  providerTelemetry: Telemetry | null;
  errorKind: string | null;
  result: Extraction | null;
  humanScoring: "not_started";
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns only the source; evaluation labels never enter the model request. */
export function selectCase(dataset: unknown, caseId: string): { id: string; source: string } {
  if (!/^[CN]\d{2}-[a-z0-9-]+$/.test(caseId) || !isObject(dataset) || dataset.version !== datasetVersion || !Array.isArray(dataset.cases)) throw new Error("Invalid dataset.");
  const matches = dataset.cases.filter((item: unknown) => isObject(item) && item.id === caseId);
  if (matches.length !== 1 || !isObject(matches[0]) || typeof matches[0].source !== "string" ||
      !matches[0].source.trim() || matches[0].source.length > 8000) throw new Error("Invalid case.");
  return { id: caseId, source: matches[0].source };
}

/** Canonical JSON prevents platform line endings from changing the frozen dataset digest. */
export function isFrozenDataset(dataset: unknown): boolean {
  return createHash("sha256").update(JSON.stringify(dataset) ?? "").digest("hex") === EXPECTED_DATASET_SHA256;
}

/** A result containing a configured secret or common credential-shaped text is withheld entirely. */
export function containsCredentialLikeText(value: unknown, secret: string | undefined): boolean {
  const text = JSON.stringify(value) ?? "";
  return Boolean((secret && text.includes(secret)) || /\bLLM[|_]\d{6,}[|_][A-Za-z0-9_-]{8,}\b/.test(text) ||
    /\bsk-[A-Za-z0-9_-]{16,}\b/.test(text) || /\bgh[pousr]_[A-Za-z0-9_]{16,}\b/.test(text) ||
    /\bgithub_pat_[A-Za-z0-9_]{16,}\b/.test(text) || /\bBearer\s+[A-Za-z0-9_.|_-]{12,}/i.test(text));
}

function errorKind(error: unknown): string {
  return error instanceof MetaError ? error.kind : "unexpected";
}

export async function evaluateOne(options: {
  dataset: unknown;
  caseId: string;
  model: string;
  secret?: string;
  revision?: string;
  runId?: string;
  runAttempt?: string;
  extract: (source: string) => Promise<Extraction>;
  telemetry?: () => Telemetry | null;
  record: (record: EvaluationRecord) => void;
}): Promise<EvaluationRecord> {
  if (!allowedModels.has(options.model)) throw new Error("Unsupported model ID.");
  const selected = selectCase(options.dataset, options.caseId);
  const startedAt = new Date();
  const initial: EvaluationRecord = {
    datasetVersion, expectedDatasetSha256: EXPECTED_DATASET_SHA256, caseId: selected.id, requestedModel: options.model,
    revision: options.revision ?? null, runId: options.runId ?? null, runAttempt: options.runAttempt ?? null,
    status: "started", startedAt: startedAt.toISOString(), finishedAt: null, elapsedMs: null,
    adapterCalls: 0, providerTelemetry: null, errorKind: null, result: null, humanScoring: "not_started",
  };
  options.record(initial);
  // Write the call intent before awaiting so interrupted runs are not mistaken for unattempted cases.
  const attempted = { ...initial, adapterCalls: 1 };
  options.record(attempted);
  let outcome: EvaluationRecord;
  try {
    // Exactly one adapter invocation. extractTerms itself does not retry requests.
    const result = await options.extract(selected.source);
    const withheld = containsCredentialLikeText(result, options.secret);
    outcome = { ...attempted, status: withheld ? "output_withheld" : "response_received",
      result: withheld ? null : result, errorKind: withheld ? "credential_like_output" : null };
  } catch (error) {
    outcome = { ...attempted, status: "failed", errorKind: errorKind(error) };
  }
  const finishedAt = new Date();
  outcome = { ...outcome, finishedAt: finishedAt.toISOString(), elapsedMs: finishedAt.getTime() - startedAt.getTime(),
    providerTelemetry: options.telemetry?.() ?? null };
  options.record(outcome);
  return outcome;
}

function parseTelemetry(value: unknown): Telemetry | null {
  if (typeof value !== "string") return null;
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { return null; }
  if (!isObject(raw) || raw.provider !== "meta") return null;
  const numberOrNull = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  return {
    status: typeof raw.status === "number" || raw.status === "completed" || raw.status === "incomplete" ? raw.status : null,
    code: typeof raw.code === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(raw.code) ? raw.code : null,
    elapsedMs: numberOrNull(raw.elapsedMs), inputTokens: numberOrNull(raw.inputTokens), outputTokens: numberOrNull(raw.outputTokens),
  };
}

async function main() {
  const caseId = process.env.EVAL_CASE_ID ?? "";
  const model = process.env.META_TEXT_MODEL ?? "";
  const resultPath = process.env.EVAL_RESULT_PATH;
  if (!resultPath) throw new Error("Missing result path.");
  mkdirSync(dirname(resultPath), { recursive: true });
  let latest: EvaluationRecord | null = null;
  let telemetry: Telemetry | null = null;
  const writeRecord = (record: EvaluationRecord) => {
    latest = record;
    // Preserve the previous valid JSON if the runner is stopped during a write.
    const temporary = `${resultPath}.tmp`;
    writeFileSync(temporary, JSON.stringify(record, null, 2) + "\n", "utf8");
    renameSync(temporary, resultPath);
  };
  const interrupted = () => {
    if (latest && latest.status === "started") {
      writeRecord({ ...latest, status: "interrupted", finishedAt: new Date().toISOString(), errorKind: "runner_interrupted",
        elapsedMs: Date.now() - Date.parse(latest.startedAt), providerTelemetry: telemetry });
    }
    process.exit(1);
  };
  process.once("SIGTERM", interrupted);
  process.once("SIGINT", interrupted);

  const safeRevision = /^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA ?? "") ? process.env.GITHUB_SHA : undefined;
  const safeRunId = /^\d+$/.test(process.env.GITHUB_RUN_ID ?? "") ? process.env.GITHUB_RUN_ID : undefined;
  const safeAttempt = /^\d+$/.test(process.env.GITHUB_RUN_ATTEMPT ?? "") ? process.env.GITHUB_RUN_ATTEMPT : undefined;
  const preflight: EvaluationRecord = {
    datasetVersion, expectedDatasetSha256: EXPECTED_DATASET_SHA256, caseId: /^[CN]\d{2}-[a-z0-9-]+$/.test(caseId) ? caseId : "invalid",
    requestedModel: allowedModels.has(model) ? model : "invalid", revision: safeRevision ?? null,
    runId: safeRunId ?? null, runAttempt: safeAttempt ?? null, status: "started", startedAt: new Date().toISOString(),
    finishedAt: null, elapsedMs: null, adapterCalls: 0, providerTelemetry: null, errorKind: null, result: null, humanScoring: "not_started",
  };
  writeRecord(preflight);
  try {
    const dataset = JSON.parse(readFileSync(new URL("../tests/fixtures/evaluation-v1.json", import.meta.url), "utf8"));
    if (!isFrozenDataset(dataset)) throw new Error("Frozen dataset changed.");
    const result = await evaluateOne({
      dataset, caseId, model, secret: process.env.MODEL_API_KEY, revision: safeRevision,
      runId: safeRunId, runAttempt: safeAttempt, telemetry: () => telemetry, record: writeRecord,
      extract: async (source) => {
        const original = console.info;
        console.info = (...args: unknown[]) => {
          const parsed = parseTelemetry(args[0]);
          if (parsed) telemetry = containsCredentialLikeText(parsed, process.env.MODEL_API_KEY) ? { ...parsed, code: null } : parsed;
        };
        try { return await extractTerms(source); } finally { console.info = original; }
      },
    });
    console.log(JSON.stringify({ caseId: result.caseId, requestedModel: result.requestedModel, status: result.status,
      adapterCalls: result.adapterCalls, elapsedMs: result.elapsedMs, providerTelemetry: result.providerTelemetry,
      errorKind: result.errorKind, humanScoring: result.humanScoring }));
    if (result.status !== "response_received") process.exitCode = 1;
  } catch {
    const failedBase = (latest as EvaluationRecord | null) ?? preflight;
    writeRecord({ ...failedBase, status: "failed", finishedAt: new Date().toISOString(), errorKind: "evaluation_runner_error", providerTelemetry: telemetry });
    console.error("Evaluation could not start; check the selected case and configuration.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error("Evaluation could not start; check the selected case and configuration."); process.exitCode = 1; });
}
