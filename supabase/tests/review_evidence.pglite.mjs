// Isolated local runner. No network, Vercel, Supabase account, or real data.
// Install @electric-sql/pglite@0.5.12 in a separate directory, set
// JAZZLINK_PGLITE_DIR to that directory, and run this file from the repo root.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const installDir = process.env.JAZZLINK_PGLITE_DIR;
  if (!installDir || !path.isAbsolute(installDir)) throw new Error("Set JAZZLINK_PGLITE_DIR to an absolute isolated install directory.");
  const isolatedRequire = createRequire(path.join(installDir, "package.json"));
  const { PGlite } = isolatedRequire("@electric-sql/pglite");
  const { pgcrypto } = isolatedRequire("@electric-sql/pglite/contrib/pgcrypto");
  const db = new PGlite({ extensions: { pgcrypto } });
  const readSql = (file) => readFile(path.join(process.cwd(), "supabase", file), "utf8");
  try {
    // This mock supplies only the role/JWT features needed by these migrations.
    // It is not the Supabase Auth server or PostgREST.
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.jwt() returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims',true), '')::jsonb,'{}'::jsonb)
      $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on all functions in schema auth to authenticated;
      create schema extensions; create extension pgcrypto with schema extensions;
    `);
    const migrations = [
      "20261027035752_create_private_gig_drafts.sql",
      "20261027035920_tune_private_draft_security.sql",
      "20261027040248_create_reviewed_revisions.sql",
      "20261027041139_bound_owner_storage.sql",
      "20261027043152_enforce_canonical_money.sql",
      "20261027045514_enforce_review_evidence.sql",
    ];
    for (const migration of migrations) {
      if (migration === "20261027043152_enforce_canonical_money.sql") {
        await db.exec(await readSql("tests/review_evidence_legacy_seed.sql"));
      }
      await db.exec(await readSql(path.join("migrations", migration)));
    }
    await db.exec(await readSql("tests/review_evidence.sql"));
    console.log("PGlite: evidence regression checks passed.");
    const started = Date.now();
    const stress = await db.exec(await readSql("tests/review_evidence_stress.sql"));
    const result = stress.flatMap((entry) => entry.rows).find((row) => row.outcome);
    if (!result) throw new Error("Stress test did not report an outcome.");
    console.log(JSON.stringify({ stress: result, wallMs: Date.now() - started }));
    if (!["completed", "controlled_timeout"].includes(result.outcome)) throw new Error("Unexpected stress outcome.");
  } finally {
    await db.close();
  }

  // Test the production-oriented rollback script against a separate local DB
  // with exactly one mock user and normal triggers/constraints enabled.
  const rollbackDb = new PGlite({ extensions: { pgcrypto } });
  try {
    await rollbackDb.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.jwt() returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims',true), '')::jsonb,'{}'::jsonb)
      $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on all functions in schema auth to authenticated;
      create schema extensions; create extension pgcrypto with schema extensions;
      insert into auth.users(id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    `);
    for (const migration of [
      "20261027035752_create_private_gig_drafts.sql",
      "20261027035920_tune_private_draft_security.sql",
      "20261027040248_create_reviewed_revisions.sql",
      "20261027041139_bound_owner_storage.sql",
      "20261027043152_enforce_canonical_money.sql",
      "20261027045514_enforce_review_evidence.sql",
    ]) await rollbackDb.exec(await readSql(path.join("migrations", migration)));
    await rollbackDb.exec(await readSql("tests/review_evidence_remote_rollback.sql"));
    const result = await rollbackDb.query("select (select count(*) from public.gig_drafts) as drafts, (select count(*) from public.gig_reviews) as reviews, (select count(*) from jazzlink_private.owner_storage_counts) as counters");
    if (Number(result.rows[0].drafts) !== 0 || Number(result.rows[0].reviews) !== 0 || Number(result.rows[0].counters) !== 0) throw new Error("Rollback left synthetic records.");
    console.log("PGlite: remote-rollback script passed locally; no synthetic rows remained.");
  } finally {
    await rollbackDb.close();
  }
}

main().catch((error) => {
  // Do not print SQL, source payloads, environment variables or credentials.
  console.error("Local evidence test failed:", error.code ?? "ERROR", error.message);
  process.exitCode = 1;
});
