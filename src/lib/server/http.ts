/**
 * Small helpers shared by api/* functions (Web Request/Response signature).
 */
import type { ZodType } from 'zod';
import { captureException } from './sentry.ts';

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function error(status: number, code: string, message?: string): Response {
  return json({ error: code, message: message || code }, status);
}

export function methodNotAllowed(allow: string[]): Response {
  return json({ error: 'method_not_allowed' }, 405, { allow: allow.join(', ') });
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  // JSON-only: cross-site HTML forms cannot produce this content type, which rules out CSRF posts.
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) throw new HttpError(415, 'json_required');
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, 'invalid_input', first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'invalid input');
  }
  return parsed.data;
}

const PRIVATE_IP = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1$|fc|fd|fe80:)/i;

/**
 * Client address for rate limiting. Vercel sets `x-vercel-forwarded-for` / `x-real-ip` from the TCP
 * peer, which a client cannot forge. `x-forwarded-for` is read right-to-left (the right-most hop is
 * the one appended by the trusted proxy) and private/loopback entries are skipped when a public one
 * exists, so a spoofed left-most value never becomes the key.
 */
export function clientIp(req: Request): string {
  const vercel = (req.headers.get('x-vercel-forwarded-for') || '').split(',')[0].trim();
  if (vercel) return vercel;
  const real = (req.headers.get('x-real-ip') || '').trim();
  if (real) return real;
  const hops = (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = hops.length - 1; i >= 0; i--) if (!PRIVATE_IP.test(hops[i])) return hops[i];
  if (hops.length) return hops[hops.length - 1];
  return req.headers.get('cf-connecting-ip') || '0.0.0.0';
}

export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Wrap a handler so thrown HttpError/zod issues become JSON responses and nothing else leaks. */
export function handle(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return error(e.status, e.code, e.message);
      console.error('[api]', e instanceof Error ? e.message : e);
      await captureException(e, { route: new URL(req.url).pathname, method: req.method });
      return error(500, 'server_error', 'Something went wrong.');
    }
  };
}
