/**
 * POST /api/auth/signup  { email, password, first_name, last_name, country, lang, redirectTo, turnstileToken }
 * Rate limited, Turnstile verified, zod validated. GoTrue creates an unconfirmed user and the
 * send-email hook delivers a branded OTP. No session is returned until /api/auth/verify succeeds.
 */
import { signupSchema } from '../../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, clientIp, error } from '../../src/lib/server/http.ts';
import { rateLimit } from '../../src/lib/server/ratelimit.ts';
import { verifyTurnstile } from '../../src/lib/server/turnstile.ts';
import { gotrue } from '../../src/lib/server/supabase.ts';
import { env } from '../../src/lib/server/env.ts';

interface SignupResponse {
  id?: string;
  email?: string;
  confirmation_sent_at?: string;
  email_confirmed_at?: string | null;
  identities?: unknown[];
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email?: string };
  error_code?: string;
  msg?: string;
}

function allowedRedirect(url: string | undefined): string {
  const fallback = `${env.siteUrl}/account/`;
  if (!url) return fallback;
  try {
    const u = new URL(url);
    const site = new URL(env.siteUrl);
    const ok = u.host === site.host || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(u.host);
    return ok ? u.toString() : fallback;
  } catch {
    return fallback;
  }
}

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const input = await readJson(req, signupSchema);
  const ip = clientIp(req);
  await rateLimit('signup', ip, input.email);
  await verifyTurnstile(input.turnstileToken, ip, 'signup');

  const redirect = encodeURIComponent(allowedRedirect(input.redirectTo));
  const { status, data } = await gotrue<SignupResponse>(`/signup?redirect_to=${redirect}`, {
    email: input.email,
    password: input.password,
    data: {
      first_name: input.first_name,
      last_name: input.last_name,
      country: input.country,
      lang: input.lang,
    },
  });

  if (status !== 200) {
    const code = data.error_code || '';
    if (code === 'weak_password') return error(400, 'weak_password', 'Choose a longer password.');
    if (/over_.*rate_limit|too_many/.test(code)) return error(429, 'rate_limited', 'Too many attempts.');
    if (code === 'user_already_exists' || code === 'email_exists') {
      // Behave like a fresh signup that needs confirmation.
      return json({ ok: true, needsConfirmation: true });
    }
    return error(400, 'signup_failed', 'Could not create the account.');
  }

  // Never return a session here. Email confirmation (OTP) is required before login.
  return json({ ok: true, needsConfirmation: true });
});
