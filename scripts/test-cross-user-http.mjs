import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomUUID, randomBytes } from 'node:crypto';

// Explicit manual run only. All accounts, sessions, and identifiers remain in memory.
const project = 'https://inlotwlppvrscyjncbbb.supabase.co';
const app = 'https://jazzlink-meta-hackathon.vercel.app';
const publishable = process.env.JAZZLINK_TEST_PUBLISHABLE_KEY;
const secret = process.env.JAZZLINK_TEST_ADMIN_KEY;
if (!publishable || !secret || process.env.JAZZLINK_HTTP_TEST !== 'yes') {
  console.log('Not run: set JAZZLINK_HTTP_TEST=yes and the two test key environment variables.');
  process.exit(2);
}
const admin = createClient(project, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const ids = [];
const sessions = [];
let draftId;
let failure = false;
let cleanupFailed = false;
function check(label, ok) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failure = true; }
async function account() {
  const email = `jazzlink-test-${randomUUID()}@example.com`;
  const password = randomBytes(32).toString('base64url');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('Test account creation failed');
  ids.push(created.data.user.id);
  const cookies = new Map();
  const sessionClient = createServerClient(project, publishable, { cookies: {
    getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
    setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
  } });
  const login = await sessionClient.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) throw new Error('Test account sign-in failed');
  sessions.push(sessionClient);
  const direct = createClient(project, publishable, { auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${login.data.session.access_token}` } } });
  return { sessionClient, direct, cookie: Array.from(cookies, ([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ') };
}
async function request(path, cookie, method = 'GET', body) {
  return fetch(app + path, { method, headers: { origin: app, ...(cookie ? { cookie } : {}),
    ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual' });
}
try {
  const a = await account();
  const b = await account();
  const created = await request('/api/drafts', a.cookie, 'POST', { sourceText: 'Synthetic test source.', draft: {} });
  const body = await created.json();
  if (created.status !== 201 || body.draft?.owner_id !== ids[0] || !/^[0-9a-f-]{36}$/i.test(body.draft?.id ?? '')) throw new Error('Own draft creation failed');
  draftId = body.draft.id;
  check('A creates and reads own draft via app HTTP', (await request(`/api/drafts/${draftId}`, a.cookie)).status === 200);
  check('B cannot read A draft via app HTTP', (await request(`/api/drafts/${draftId}`, b.cookie)).status === 404);
  check('B cannot update A draft via app HTTP', (await request(`/api/drafts/${draftId}`, b.cookie, 'PUT', { sourceText: 'Synthetic replacement.', draft: {}, version: 1 })).status === 409);
  check('B cannot create review of A draft via app HTTP', (await request('/api/revisions', b.cookie, 'POST', { draftId, expectedVersion: 1, requestId: randomUUID(), confirmReview: true })).status === 404);
  check('Anonymous cannot read or create drafts via app HTTP', (await request(`/api/drafts/${draftId}`)).status === 401 && (await request('/api/drafts', null, 'POST', { sourceText: 'Synthetic.', draft: {} })).status === 401);
  const own = await a.direct.from('gig_drafts').select('id').eq('id', draftId);
  const other = await b.direct.from('gig_drafts').select('id').eq('id', draftId);
  const update = await b.direct.from('gig_drafts').update({ source_text: 'Synthetic replacement.', version: 2 }).eq('id', draftId).select('id');
  const rpc = await b.direct.rpc('create_gig_review', { p_draft_id: draftId, p_expected_version: 1, p_request_id: randomUUID(), p_confirm_review: true });
  check('A reads own draft via PostgREST', !own.error && own.data.length === 1);
  check('B cannot read or update A draft via PostgREST', !other.error && other.data.length === 0 && !update.error && update.data.length === 0);
  check('B cannot create A review via PostgREST RPC', Boolean(rpc.error) && !rpc.data);
  const malformed = await request('/api/extract', a.cookie, 'POST', { text: 'Synthetic.', context: { draftId, expectedVersion: 1, expectedRevision: 0, baseline: {} } });
  const stale = await request('/api/extract', a.cookie, 'POST', { text: 'Synthetic.', context: { draftId, expectedVersion: 2, expectedRevision: 0 } });
  const foreign = await request('/api/extract', b.cookie, 'POST', { text: 'Synthetic.', context: { draftId, expectedVersion: 1, expectedRevision: 0 } });
  check('Malformed context rejected', malformed.status === 400);
  check('Stale context rejected', stale.status === 409);
  check('Foreign draft context rejected', foreign.status === 404);
} catch {
  failure = true;
  console.log('FAIL setup or request; no sensitive details printed.');
} finally {
  for (const session of sessions) {
    try { if ((await session.auth.signOut()).error) cleanupFailed = true; } catch { cleanupFailed = true; }
  }
  if (draftId) {
    // A failed isolation check may have created a synthetic review; remove only records tied to this run's draft.
    try {
      const reviews = await admin.from('gig_reviews').delete().eq('draft_id', draftId);
      const draft = await admin.from('gig_drafts').delete().eq('id', draftId);
      if (reviews.error || draft.error) cleanupFailed = true;
    } catch { cleanupFailed = true; }
  }
  for (const id of ids) {
    try { if ((await admin.auth.admin.deleteUser(id)).error) cleanupFailed = true; } catch { cleanupFailed = true; }
  }
  console.log(cleanupFailed ? 'FAIL cleanup: test fixtures may remain; administrator review required.' : 'PASS cleanup of created Auth users and public fixtures; zero-count private owner rows may remain.');
}
process.exit(failure || cleanupFailed ? 1 : 0);
