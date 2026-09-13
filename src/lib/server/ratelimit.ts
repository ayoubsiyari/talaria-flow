/**
 * Rate limit: 5 attempts per 15 minutes per IP + email.
 *
 * Backed by Upstash Redis / Vercel KV over REST (UPSTASH_REDIS_REST_URL+TOKEN or KV_REST_API_URL+TOKEN).
 * In production the store is mandatory: without it every limited route answers 500
 * `ratelimit_unconfigured` (fail closed, like Turnstile). The in-memory window is for dev/test only —
 * it protects a single warm function instance.
 */
import { createHash } from 'node:crypto';
import { env } from './env.ts';
import { HttpError } from './http.ts';

export const RATE_LIMIT = { attempts: 5, windowSeconds: 15 * 60 } as const;

const memory = new Map<string, { count: number; resetAt: number }>();

function keyFor(action: string, ip: string, email: string): string {
  const id = createHash('sha256').update(`${ip}|${email.toLowerCase()}`).digest('hex').slice(0, 32);
  return `tf:rl:${action}:${id}`;
}

async function redisIncr(key: string): Promise<{ count: number; ttl: number } | null> {
  if (!env.redisUrl || !env.redisToken) return null;
  const res = await fetch(`${env.redisUrl}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.redisToken}`, 'content-type': 'application/json' },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, String(RATE_LIMIT.windowSeconds), 'NX'],
      ['TTL', key],
    ]),
  });
  if (!res.ok) throw new Error(`rate limit store ${res.status}`);
  const rows = (await res.json()) as Array<{ result: number }>;
  return { count: Number(rows[0]?.result || 0), ttl: Number(rows[2]?.result || RATE_LIMIT.windowSeconds) };
}

function memoryIncr(key: string): { count: number; ttl: number } {
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || cur.resetAt <= now) {
    const resetAt = now + RATE_LIMIT.windowSeconds * 1000;
    memory.set(key, { count: 1, resetAt });
    if (memory.size > 5000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    return { count: 1, ttl: RATE_LIMIT.windowSeconds };
  }
  cur.count += 1;
  return { count: cur.count, ttl: Math.ceil((cur.resetAt - now) / 1000) };
}

export type RateLimitAction = 'login' | 'signup' | 'reset' | 'waitlist' | 'proof' | 'unsubscribe' | 'admin-reset' | 'verify' | 'resend' | 'campaign';

export async function rateLimit(action: RateLimitAction, ip: string, email: string, max: number = RATE_LIMIT.attempts): Promise<void> {
  if ((!env.redisUrl || !env.redisToken) && env.failClosed) {
    throw new HttpError(500, 'ratelimit_unconfigured', 'UPSTASH_REDIS_REST_URL / KV_REST_API_URL is not set.');
  }
  const key = keyFor(action, ip, email);
  const hit = (await redisIncr(key)) || memoryIncr(key);
  if (hit.count > max) {
    throw new HttpError(429, 'rate_limited', `Too many attempts. Try again in ${Math.max(1, Math.ceil(hit.ttl / 60))} min.`);
  }
}

/** Exposed for tests. */
export function _resetMemory(): void { memory.clear(); }
