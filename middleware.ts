/**
 * Vercel Edge Middleware — server-side session check for /account/* and /admin/*.
 *
 *  - No valid session on /account/* -> 307 to /login/?redirect=<path>
 *  - No valid session or not an admin on /admin/* -> 404 (the 404 page, not a redirect)
 *
 * The session is the HttpOnly `tf-session` cookie set by /api/auth/login and /api/auth/session.
 * One PostgREST call (`rpc/is_admin`) both validates the token and answers the admin question:
 * an invalid/expired token is rejected by PostgREST with 401.
 */
export const config = {
  matcher: ['/account', '/account/:path*', '/admin', '/admin/:path*'],
};

const COOKIE = 'tf-session';

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

async function notFound(req: Request): Promise<Response> {
  const page = await fetch(new URL('/404.html', req.url), { headers: { accept: 'text/html' } }).catch(() => null);
  const body = page && page.ok ? await page.text() : '<!doctype html><title>404</title><h1>Not found</h1>';
  return new Response(body, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}

function toLogin(url: URL): Response {
  const dest = new URL('/login/', url);
  dest.searchParams.set('redirect', url.pathname + url.search);
  return Response.redirect(dest.toString(), 307);
}

async function isAdminFor(token: string): Promise<'anon' | 'member' | 'admin' | 'error'> {
  const base = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || '';
  if (!base || !anon) return 'error';
  const res = await fetch(`${base}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: anon, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
  }).catch(() => null);
  if (!res) return 'error';
  if (res.status === 401 || res.status === 403) return 'anon';
  if (!res.ok) return 'error';
  const value = await res.json().catch(() => false);
  return value === true ? 'admin' : 'member';
}

export default async function middleware(req: Request): Promise<Response | undefined> {
  const url = new URL(req.url);
  const adminArea = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
  const token = readCookie(req, COOKIE);

  if (!token) return adminArea ? notFound(req) : toLogin(url);

  const who = await isAdminFor(token);
  // Fail closed: if the auth backend is unreachable, protected pages are not served.
  if (who === 'anon' || who === 'error') return adminArea ? notFound(req) : toLogin(url);
  if (adminArea && who !== 'admin') return notFound(req);
  return undefined;
}
