/**
 * Cloudflare Turnstile server-side verification (invisible widget on signup, login, reset, waitlist).
 * When TURNSTILE_SECRET_KEY is unset (local dev) verification is skipped; DEPLOY.md requires it in production.
 */
import { env } from './env.ts';
import { HttpError } from './http.ts';

export async function verifyTurnstile(token: string, ip: string, action?: string): Promise<void> {
  if (!env.turnstileSecret) {
    if (env.failClosed) throw new HttpError(500, 'turnstile_unconfigured', 'TURNSTILE_SECRET_KEY is not set.');
    return;
  }
  if (!token) throw new HttpError(400, 'turnstile_required', 'Verification failed. Reload the page and try again.');
  const form = new URLSearchParams({ secret: env.turnstileSecret, response: token, remoteip: ip });
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; action?: string };
  if (!data.success) throw new HttpError(400, 'turnstile_failed', 'Verification failed. Reload the page and try again.');
  if (action && data.action && data.action !== action) throw new HttpError(400, 'turnstile_failed', 'Verification failed.');
}
