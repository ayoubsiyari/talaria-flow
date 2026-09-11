/**
 * POST /api/auth/verify  { email, token, turnstileToken }
 * Confirms a signup or recovery OTP issued by GoTrue.
 */
import { verifySchema } from '../../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, clientIp, error } from '../../src/lib/server/http.ts';
import { rateLimit } from '../../src/lib/server/ratelimit.ts';
import { verifyTurnstile } from '../../src/lib/server/turnstile.ts';
import { gotrue, adminClient } from '../../src/lib/server/supabase.ts';
import { sessionCookie, isSecureRequest } from '../../src/lib/server/session-cookie.ts';

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: { id: string; email?: string; email_confirmed_at?: string | null; confirmed_at?: string | null };
  error_code?: string;
  error?: string;
  msg?: string;
}

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const input = await readJson(req, verifySchema);
  const ip = clientIp(req);
  await rateLimit('verify', ip, input.email);
  await verifyTurnstile(input.turnstileToken, ip, 'verify');

  const { status, data } = await gotrue<TokenResponse>('/verify', {
    type: input.purpose,
    email: input.email,
    token: input.token,
  });

  if (status !== 200 || !data.access_token || !data.refresh_token || !data.user) {
    const code = data.error_code || data.error || '';
    if (/over_request_rate_limit|too_many/.test(code)) return error(429, 'rate_limited', 'Too many attempts.');
    return error(401, 'invalid_code', 'Wrong or expired code.');
  }

  if (input.purpose === 'signup') {
    const verified = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
    if (!verified) return error(403, 'email_not_confirmed', 'Confirm your email first.');
  }

  const { data: profile } = await adminClient().from('profiles').select('is_admin, role').eq('id', data.user.id).maybeSingle();
  const isAdmin = Boolean(profile && (profile.is_admin || profile.role === 'admin'));
  const expiresIn = Number(data.expires_in || 3600);

  return json(
    {
      ok: true,
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: expiresIn,
        expires_at: data.expires_at,
        token_type: data.token_type || 'bearer',
      },
      user: { id: data.user.id, email: data.user.email, is_admin: isAdmin },
    },
    200,
    { 'set-cookie': sessionCookie(data.access_token, expiresIn, isSecureRequest(req)) },
  );
});
