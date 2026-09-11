/**
 * GET /api/cron/purge-proofs — nightly (vercel.json → crons). Vercel calls it with
 * `Authorization: Bearer <CRON_SECRET>`; anything else is 404 so the route stays invisible.
 * Deletes proof files 90 days after the decision (src/lib/server/purge.ts).
 */
import { env } from '../../src/lib/server/env.ts';
import { handle, json, bearer, HttpError } from '../../src/lib/server/http.ts';
import { adminClient } from '../../src/lib/server/supabase.ts';
import { purgeExpiredProofs } from '../../src/lib/server/purge.ts';

export default handle(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(404, 'not_found');
  const secret = env.cronSecret;
  if (!secret || bearer(req) !== secret) throw new HttpError(404, 'not_found');

  const dryRun = new URL(req.url).searchParams.get('dry') === '1';
  const result = await purgeExpiredProofs(adminClient(), { dryRun });
  return json({ ok: result.errors.length === 0, dryRun, ...result });
});
