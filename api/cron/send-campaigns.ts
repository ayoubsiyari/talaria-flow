/**
 * GET /api/cron/send-campaigns — daily 08:00 UTC (vercel.json → crons; Hobby runs at most daily.
 * The admin UI's `run-due` action is the fallback for same-day sends). Vercel calls it with
 * `Authorization: Bearer <CRON_SECRET>`; anything else is 404 so the route stays invisible.
 * Executes every email_sends row with state "scheduled" whose scheduled_for has passed.
 */
import { env } from '../../src/lib/server/env.ts';
import { handle, json, bearer, HttpError } from '../../src/lib/server/http.ts';
import { adminClient } from '../../src/lib/server/supabase.ts';
import { processDueSends } from '../../src/lib/server/campaigns.ts';

export default handle(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(404, 'not_found');
  const secret = env.cronSecret;
  if (!secret || bearer(req) !== secret) throw new HttpError(404, 'not_found');

  const result = await processDueSends(adminClient());
  return json({ ok: true, ...result });
});
