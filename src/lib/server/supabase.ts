/**
 * Supabase on the server: service-role client (bypasses RLS, never shipped to the browser)
 * and helpers that resolve the caller from a user access token.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.ts';
import { HttpError, bearer } from './http.ts';
import { readSessionCookie } from './session-cookie.ts';

let admin: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export interface Caller {
  id: string;
  email: string;
  isAdmin: boolean;
  emailVerified: boolean;
  token: string;
}

/** Validate an access token with GoTrue and load the caller's profile row. */
export async function callerFromToken(token: string | null): Promise<Caller | null> {
  if (!token) return null;
  const bases: string[] = [];
  const seen = new Set<string>();
  for (const raw of [process.env.SUPABASE_INTERNAL_URL, 'http://127.0.0.1:8000', process.env.SUPABASE_URL]) {
    const base = String(raw || '').replace(/\/+$/, '');
    if (!base || seen.has(base)) continue;
    seen.add(base);
    bases.push(base);
  }
  let user: { id: string; email?: string; email_confirmed_at?: string; confirmed_at?: string } | null = null;
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/auth/v1/user`, {
        headers: { apikey: env.supabaseAnonKey, authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { id: string; email?: string; email_confirmed_at?: string; confirmed_at?: string };
      if (body?.id) { user = body; break; }
    } catch {
      /* try the next GoTrue base */
    }
  }
  if (!user?.id) return null;
  const { data } = await adminClient().from('profiles').select('is_admin, role').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email || '',
    isAdmin: Boolean(data && (data.is_admin || data.role === 'admin')),
    emailVerified: Boolean(user.email_confirmed_at || user.confirmed_at),
    token,
  };
}

export async function requireUser(req: Request): Promise<Caller> {
  const caller = await callerFromToken(bearer(req) || readSessionCookie(req));
  if (!caller) throw new HttpError(401, 'unauthorized');
  if (!caller.emailVerified) throw new HttpError(403, 'email_not_confirmed');
  return caller;
}

export async function requireAdmin(req: Request): Promise<Caller> {
  const caller = await requireUser(req);
  // 404, not 403: the admin surface does not acknowledge its existence to non-admins.
  if (!caller.isAdmin) throw new HttpError(404, 'not_found');
  return caller;
}

/** GoTrue REST call with the anon key (password grant, signup, recover). */
export async function gotrue<T>(path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1${path}`, {
    method: 'POST',
    headers: { apikey: env.supabaseAnonKey, 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}
