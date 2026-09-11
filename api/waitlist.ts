/**
 * POST /api/waitlist { email, source, lang, turnstileToken }
 * Tools-suite waitlist. Rate limited + Turnstile; written with the service role because anon inserts
 * on public.waitlist are disabled (RLS). The zod schema lower-cases and trims the address and the
 * table has a plain unique constraint on email (waitlist_email_key), so duplicates are ignored.
 */
import { waitlistSchema } from '../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, clientIp } from '../src/lib/server/http.ts';
import { rateLimit } from '../src/lib/server/ratelimit.ts';
import { verifyTurnstile } from '../src/lib/server/turnstile.ts';
import { adminClient } from '../src/lib/server/supabase.ts';

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const input = await readJson(req, waitlistSchema);
  const ip = clientIp(req);
  await rateLimit('waitlist', ip, input.email);
  await verifyTurnstile(input.turnstileToken, ip, 'waitlist');

  const { error: dbError } = await adminClient()
    .from('waitlist')
    .upsert({ email: input.email, source: input.source, lang: input.lang }, { onConflict: 'email', ignoreDuplicates: true });
  if (dbError) throw new Error(dbError.message);

  return json({ ok: true });
});
