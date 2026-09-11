/**
 * POST /api/auth/resend  { email, turnstileToken }
 * Asks GoTrue to issue a new signup OTP. Always 200 so existing addresses cannot be enumerated.
 */
import { resendSchema } from '../../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, clientIp } from '../../src/lib/server/http.ts';
import { rateLimit } from '../../src/lib/server/ratelimit.ts';
import { verifyTurnstile } from '../../src/lib/server/turnstile.ts';
import { gotrue } from '../../src/lib/server/supabase.ts';

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const input = await readJson(req, resendSchema);
  const ip = clientIp(req);
  await rateLimit('resend', ip, input.email);
  await verifyTurnstile(input.turnstileToken, ip, 'resend');
  if (input.purpose === 'recovery') {
    try {
      await gotrue('/recover', { email: input.email });
    } catch { /* always 200 */ }
  } else {
    try {
      await gotrue('/resend', { type: 'signup', email: input.email });
    } catch { /* always 200 */ }
  }
  return json({ ok: true });
});
