/**
 * POST /api/auth/reset  { email, redirectTo, turnstileToken }
 * Rate limited + Turnstile, then asks Supabase Auth to send the recovery email. Always 200.
 */
import { resetSchema } from '../../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, clientIp } from '../../src/lib/server/http.ts';
import { rateLimit } from '../../src/lib/server/ratelimit.ts';
import { verifyTurnstile } from '../../src/lib/server/turnstile.ts';
import { gotrue } from '../../src/lib/server/supabase.ts';
import { env } from '../../src/lib/server/env.ts';

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const input = await readJson(req, resetSchema);
  const ip = clientIp(req);
  await rateLimit('reset', ip, input.email);
  await verifyTurnstile(input.turnstileToken, ip, 'reset');

  let redirect = `${env.siteUrl}/login/?type=recovery`;
  if (input.redirectTo) {
    try {
      const u = new URL(input.redirectTo);
      if (u.host === new URL(env.siteUrl).host || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(u.host)) redirect = u.toString();
    } catch { /* keep default */ }
  }
  try {
    await gotrue(`/recover?redirect_to=${encodeURIComponent(redirect)}`, { email: input.email });
  } catch {
    // Same 200 as a successful send so unknown emails cannot be enumerated.
  }
  return json({ ok: true });
});
