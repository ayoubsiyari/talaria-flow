/**
 * Minimal stand-in for Supabase Auth (GoTrue) + PostgREST + Storage used by the Playwright suite and the
 * local dev server, so the auth guard, admin console and API routes run from a fresh clone with no
 * project or .env.
 *
 *   node tests/mock-supabase.mjs            -> http://127.0.0.1:5099
 *
 * Accounts mirror scripts/create-test-accounts.ts; password is MOCK_PASSWORD below. Tokens are unsigned
 * JWT-shaped strings; nothing here is reachable outside the test run. All tables are in memory and
 * reset on restart. Fixture rows (profiles, one submission per member) are mutable so decisions,
 * preference and profile edits persist across page loads; waitlist / email_sends / activity_log /
 * email_events start EMPTY.
 *
 * PostgREST subset: eq/neq/gt/gte/lt/lte/is/in filters, order, limit, select (ignored — full rows),
 * Prefer: return=representation | resolution=ignore-duplicates (on_conflict), count=exact, HEAD.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MOCK_PASSWORD = 'Talaria!2026-test';
export const ACCOUNTS = [
  { id: '00000000-0000-4000-8000-000000000001', email: 'admin@talaria-flow.test', is_admin: true, role: 'admin', status: null, first_name: 'Ada', last_name: 'Admin', country: 'GB', lang: 'en' },
  { id: '00000000-0000-4000-8000-000000000002', email: 'member-pending@talaria-flow.test', is_admin: false, role: 'member', status: 'submitted', first_name: 'Pia', last_name: 'Pending', country: 'DE', lang: 'en', note: 'Both screenshots attached: Welcome page and Simulation platform.' },
  { id: '00000000-0000-4000-8000-000000000003', email: 'member-approved@talaria-flow.test', is_admin: false, role: 'member', status: 'approved', first_name: 'Amir', last_name: 'Approved', country: 'AE', lang: 'ar' },
  { id: '00000000-0000-4000-8000-000000000004', email: 'member-rejected@talaria-flow.test', is_admin: false, role: 'member', status: 'rejected', first_name: 'Rita', last_name: 'Rejected', country: 'FR', lang: 'en', reviewer_note: 'The second screenshot does not show the Simulation label. Please retake it with the platform header visible.' },
  { id: '00000000-0000-4000-8000-000000000005', email: 'member-new@talaria-flow.test', is_admin: false, role: 'member', status: null, first_name: 'Noor', last_name: 'New', country: 'EG', lang: 'en' },
];

const b64url = (s) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

function token(acc, ttl = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = { sub: acc.id, email: acc.email, role: 'authenticated', aud: 'authenticated', exp, iat: exp - ttl };
  return `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.mock`;
}
function userFromToken(t) {
  try {
    const p = JSON.parse(unb64url(t.split('.')[1]));
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return ACCOUNTS.find((a) => a.id === p.sub) || null;
  } catch { return null; }
}
const bearer = (req) => ((req.headers.authorization || '').match(/^Bearer (.+)$/) || [])[1] || null;
function isService(req) {
  const t = bearer(req);
  return t && t === (process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key');
}
const userJson = (a) => ({ id: a.id, aud: 'authenticated', role: 'authenticated', email: a.email, email_confirmed_at: '2026-01-01T00:00:00Z', confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
const session = (a) => ({ access_token: token(a), refresh_token: `rt-${a.id}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: userJson(a) });

// ---- in-memory database (real column names) --------------------------------------------------
export const db = { profiles: [], submissions: [], submission_files: [], waitlist: [], activity_log: [], email_events: [], email_sends: [], email_templates: [] };

export function resetDb() {
  for (const k of Object.keys(db)) db[k].length = 0;
  for (const a of ACCOUNTS) {
    db.profiles.push({
      id: a.id, email: a.email, is_admin: a.is_admin, role: a.role,
      first_name: a.first_name, last_name: a.last_name, name: `${a.first_name} ${a.last_name}`,
      country: a.country, lang: a.lang,
      notify: { course: true, newsletter: true, tools: false },
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    });
    if (a.status) {
      db.submissions.push({
        id: `s-${a.id}`, user_id: a.id, status: a.status, note: a.note || null, reviewer_note: a.reviewer_note || null,
        file_count: 2, created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z',
        decided_at: a.status === 'submitted' ? null : '2026-02-02T00:00:00Z',
        reviewed_at: a.status === 'submitted' ? null : '2026-02-02T00:00:00Z',
        reviewed_by: a.status === 'submitted' ? null : ACCOUNTS[0].id, files_purged_at: null,
      });
    }
  }
}
resetDb();

const objects = new Map();
const OWNER = { profiles: 'id', submissions: 'user_id', submission_files: 'user_id', activity_log: 'actor_id' };
const ADMIN_ONLY = new Set(['waitlist', 'email_events', 'email_sends', 'email_templates']);

// ---- PostgREST filter subset -----------------------------------------------------------------
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function parseFilters(url) {
  const out = [];
  for (const [k, v] of url.searchParams) {
    if (RESERVED.has(k)) continue;
    const m = v.match(/^(eq|neq|gt|gte|lt|lte|is|in|like|ilike)\.(.*)$/s);
    if (!m) continue;
    out.push({ col: k, op: m[1], val: m[2] });
  }
  return out;
}
function cmp(a, b) {
  if (typeof a === 'number' && typeof b !== 'number') b = Number(b);
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return a < b ? -1 : a > b ? 1 : 0;
}
function matches(row, f) {
  const v = row[f.col];
  switch (f.op) {
    case 'eq': return String(v) === f.val;
    case 'neq': return String(v) !== f.val;
    case 'is': return f.val === 'null' ? v == null : f.val === 'true' ? v === true : f.val === 'false' ? v === false : false;
    case 'in': return f.val.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).includes(String(v));
    case 'gt': return v != null && cmp(v, f.val) > 0;
    case 'gte': return v != null && cmp(v, f.val) >= 0;
    case 'lt': return v != null && cmp(v, f.val) < 0;
    case 'lte': return v != null && cmp(v, f.val) <= 0;
    case 'like': case 'ilike': {
      const re = new RegExp('^' + f.val.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', f.op === 'ilike' ? 'i' : '');
      return re.test(String(v ?? ''));
    }
    default: return true;
  }
}
function applyQuery(rows, url) {
  const filters = parseFilters(url);
  let out = rows.filter((r) => filters.every((f) => matches(r, f)));
  const order = url.searchParams.get('order');
  if (order) {
    const [col, ...mods] = order.split('.');
    const desc = mods.includes('desc');
    out = out.slice().sort((a, b) => {
      const x = a[col], y = b[col];
      if (x == null && y == null) return 0;
      if (x == null) return mods.includes('nullsfirst') ? -1 : 1;
      if (y == null) return mods.includes('nullsfirst') ? 1 : -1;
      return desc ? cmp(y, x) : cmp(x, y);
    });
  }
  const offset = Number(url.searchParams.get('offset') || 0);
  const limit = url.searchParams.get('limit');
  if (offset) out = out.slice(offset);
  if (limit != null) out = out.slice(0, Number(limit));
  return out;
}

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

function reply(res, status, data, extra = {}) {
  const h = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range', ...extra };
  res.writeHead(status, h);
  res.end(data === undefined ? '' : JSON.stringify(data));
}
const pgError = (res, status, code, message) => reply(res, status, { code, message, details: null, hint: null });

/** Unique constraints mirrored from the migrations. */
function uniqueViolation(table, row, list) {
  if (table === 'email_events') {
    if (row.submission_id && list.some((e) => e.template_id === row.template_id && e.member_id === row.member_id && e.submission_id === row.submission_id)) return 'email_events_once_per_submission';
    if (row.send_id && list.some((e) => e.send_id === row.send_id && e.recipient === row.recipient)) return 'email_events_once_per_send';
    if (row.provider_id && list.some((e) => e.provider_id === row.provider_id && e.event === row.event)) return 'email_events_once_per_provider_event';
  }
  if (table === 'submissions' && row.status === 'submitted' && list.some((s) => s.user_id === row.user_id && s.status === 'submitted')) return 'submissions_one_submitted_per_user';
  if (table === 'waitlist' && list.some((w) => w.email === row.email)) return 'waitlist_email_key';
  if ((table === 'email_sends' || table === 'submissions' || table === 'profiles') && row.id && list.some((r) => r.id === row.id)) return `${table}_pkey`;
  return null;
}

export function listen(port = Number(process.env.MOCK_PORT || 5099)) {
  const srv = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;
    if (req.method === 'OPTIONS') return reply(res, 204);
    if (p === '/auth/v1/health') return reply(res, 200, { name: 'mock-supabase' });
    if (p === '/__reset' && req.method === 'POST') { resetDb(); objects.clear(); return reply(res, 200, { ok: true }); }

    // ---- GoTrue ----
    if (p === '/auth/v1/token') {
      const b = await body(req);
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const acc = ACCOUNTS.find((a) => a.email === String(b.email || '').toLowerCase());
        if (!acc || b.password !== MOCK_PASSWORD) return reply(res, 400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return reply(res, 200, session(acc));
      }
      if (grant === 'refresh_token') {
        const acc = ACCOUNTS.find((a) => `rt-${a.id}` === b.refresh_token);
        return acc ? reply(res, 200, session(acc)) : reply(res, 400, { error_code: 'refresh_token_not_found' });
      }
      return reply(res, 400, { error: 'unsupported_grant_type' });
    }
    if (p === '/auth/v1/user') {
      const acc = userFromToken(bearer(req) || '');
      if (!acc) return reply(res, 401, { code: 401, msg: 'invalid JWT' });
      if (req.method === 'PUT') return reply(res, 200, userJson(acc));
      return reply(res, 200, userJson(acc));
    }
    if (p === '/auth/v1/logout') return reply(res, 204);
    if (p === '/auth/v1/signup') {
      const b = await body(req);
      return reply(res, 200, { id: '00000000-0000-4000-8000-0000000000ff', email: b.email, confirmation_sent_at: new Date().toISOString() });
    }
    if (p === '/auth/v1/recover' || p === '/auth/v1/resend') return reply(res, 200, {});
    if (p.startsWith('/auth/v1/admin/users/') && req.method === 'DELETE') {
      if (!isService(req)) return reply(res, 401, { code: 401, msg: 'service role required' });
      const id = p.split('/').pop();
      for (const t of ['profiles', 'submissions', 'submission_files']) db[t] = db[t].filter((r) => (r.id !== id) && (r.user_id !== id));
      return reply(res, 200, {});
    }

    // ---- PostgREST ----
    if (p === '/rest/v1/rpc/is_admin') {
      const acc = userFromToken(bearer(req) || '');
      if (!acc) return reply(res, 401, { message: 'JWT expired or invalid' });
      return reply(res, 200, acc.is_admin);
    }
    if (p.startsWith('/rest/v1/')) {
      const table = p.slice('/rest/v1/'.length);
      if (!(table in db)) return pgError(res, 404, 'PGRST205', `Could not find the table 'public.${table}'`);
      const acc = userFromToken(bearer(req) || '');
      const svc = isService(req);
      if (!svc && !acc) return reply(res, 401, { message: 'JWT expired or invalid' });
      const prefer = String(req.headers.prefer || '');
      const single = /vnd\.pgrst\.object/.test(req.headers.accept || '');
      const representation = /return=representation/.test(prefer) || single;
      const canRead = (row) => svc || acc.is_admin || (!ADMIN_ONLY.has(table) && OWNER[table] && row[OWNER[table]] === acc.id);
      const list = db[table];
      const visible = list.filter(canRead);
      const now = new Date().toISOString();

      if (req.method === 'GET' || req.method === 'HEAD') {
        const rows = applyQuery(visible, url);
        const total = /count=exact/.test(prefer) ? applyQuery(visible, new URL(url.toString().replace(/[?&]limit=\d+/, ''))).length : rows.length;
        const extra = { 'content-range': `0-${Math.max(0, rows.length - 1)}/${total}` };
        if (req.method === 'HEAD') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...extra }); return res.end(); }
        // .single()/.maybeSingle(): no row -> null (supabase-js treats it as data: null, like maybeSingle).
        if (single) return reply(res, 200, rows[0] || null, extra);
        return reply(res, 200, rows, extra);
      }

      // Writes: members may only PATCH their own profile row; everything else is service role / admin.
      if (req.method === 'POST') {
        if (!svc && !acc.is_admin) return pgError(res, 401, '42501', 'new row violates row-level security policy');
        const b = await body(req);
        const items = Array.isArray(b) ? b : [b];
        const ignoreDup = /resolution=ignore-duplicates/.test(prefer);
        const merge = /resolution=merge-duplicates/.test(prefer);
        const onConflict = url.searchParams.get('on_conflict');
        const inserted = [];
        for (const x of items) {
          const row = { id: x.id || randomUUID(), created_at: now, ...x };
          if (table === 'profiles' && row.notify === undefined) row.notify = { course: true, newsletter: true, tools: false };
          if (table === 'submissions') Object.assign(row, { reviewer_note: null, decided_at: null, reviewed_at: null, reviewed_by: null, files_purged_at: null, updated_at: now }, x);
          if (table === 'email_sends') Object.assign(row, { sent_count: 0, opened_count: 0, finished_at: null, error: null }, x);
          if (table === 'waitlist') row.email = String(row.email || '').trim().toLowerCase();
          const conflictKey = onConflict ? onConflict.split(',')[0] : 'id';
          const existing = onConflict ? list.find((r) => String(r[conflictKey]) === String(row[conflictKey])) : null;
          if (existing && ignoreDup) continue;
          if (existing && merge) { Object.assign(existing, x); inserted.push(existing); continue; }
          const violated = uniqueViolation(table, row, list);
          if (violated) {
            if (ignoreDup) continue;
            return reply(res, 409, { code: '23505', message: `duplicate key value violates unique constraint "${violated}"`, details: null, hint: null });
          }
          list.push(row);
          inserted.push(row);
        }
        if (!representation) return reply(res, 201, undefined);
        return reply(res, 201, single ? (inserted[0] || null) : inserted);
      }
      if (req.method === 'PATCH') {
        const b = await body(req);
        const filters = parseFilters(url);
        const targets = list.filter((r) => filters.every((f) => matches(r, f)) && (svc || acc.is_admin || (table === 'profiles' && r.id === acc.id)));
        for (const r of targets) {
          const patch = { ...b };
          // Mirror protect_profile_privileges(): members cannot change identity/privilege columns.
          if (table === 'profiles' && !svc && !acc.is_admin) for (const k of ['id', 'email', 'is_admin', 'role', 'created_at']) delete patch[k];
          Object.assign(r, patch, { updated_at: now });
        }
        if (!representation) return reply(res, 204, undefined);
        return reply(res, 200, single ? (targets[0] || null) : targets);
      }
      if (req.method === 'DELETE') {
        if (!svc && !acc.is_admin) return pgError(res, 401, '42501', 'permission denied');
        const filters = parseFilters(url);
        if (!filters.length) return pgError(res, 400, 'PGRST102', 'DELETE requires a filter');
        const removed = list.filter((r) => filters.every((f) => matches(r, f)));
        db[table] = list.filter((r) => !removed.includes(r));
        if (table === 'submissions') db.submission_files = db.submission_files.filter((f) => !removed.some((s) => s.id === f.submission_id));
        if (!representation) return reply(res, 204, undefined);
        return reply(res, 200, single ? (removed[0] || null) : removed);
      }
    }

    // ---- storage ----
    if (p.startsWith('/storage/v1/object/remove/')) {
      const b = await body(req);
      const prefixes = b.prefixes || [];
      for (const key of prefixes) {
        for (const k of [...objects.keys()]) if (k === key || k.endsWith('/' + key) || k.endsWith(key)) objects.delete(k);
      }
      return reply(res, 200, []);
    }
    if (p.startsWith('/storage/v1/object/list/')) return reply(res, 200, []);
    if (p.startsWith('/storage/v1/object/')) {
      const key = decodeURIComponent(p.slice('/storage/v1/object/'.length));
      if (req.method === 'POST' || req.method === 'PUT') {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        let buf = Buffer.concat(chunks);
        // Browser uploads from supabase-js arrive as multipart/form-data; keep only the file part's bytes.
        const ct = String(req.headers['content-type'] || '');
        const bm = /boundary=("?)([^";]+)\1/.exec(ct);
        if (/multipart\/form-data/i.test(ct) && bm) {
          const boundary = Buffer.from('--' + bm[2]);
          let cursor = 0;
          let filePart = null;
          while (true) {
            const start = buf.indexOf(boundary, cursor);
            if (start === -1) break;
            const hdrStart = start + boundary.length + 2;
            const hdrEnd = buf.indexOf('\r\n\r\n', hdrStart);
            if (hdrEnd === -1) break;
            const next = buf.indexOf(boundary, hdrEnd);
            if (next === -1) break;
            const headers = buf.slice(hdrStart, hdrEnd).toString('utf8');
            const content = buf.slice(hdrEnd + 4, next - 2);
            if (/filename=/i.test(headers) || /content-type:\s*(image|application\/octet)/i.test(headers)) filePart = content;
            cursor = next;
          }
          if (filePart) buf = filePart;
        }
        objects.set(key, buf);
        return reply(res, 200, { Key: key });
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        const buf = objects.get(key);
        if (!buf) return reply(res, 404, { statusCode: '404', error: 'not_found' });
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': buf.length,
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
        });
        if (req.method === 'HEAD') return res.end();
        return res.end(buf);
      }
      if (req.method === 'DELETE') {
        objects.delete(key);
        return reply(res, 200, {});
      }
    }
    if (p.startsWith('/storage/v1/')) return reply(res, 200, { Key: 'proofs/mock', signedURL: '/assets/logo.svg' });

    reply(res, 404, { error: 'mock: no route for ' + req.method + ' ' + p });
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok({ srv, origin: `http://127.0.0.1:${port}` })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { origin } = await listen();
  console.log(`mock-supabase  ${origin}`);
}
