/**
 * GET /api/admin/stats  (Authorization: Bearer <admin token>)
 * Database totals for admin badges, filter chips and Overview KPIs.
 * Cache: 0 (json() already sends cache-control: no-store).
 *
 * There is no members table. Counts are non-admin profiles joined to each
 * user's latest submission. Anything other than submitted|approved|rejected
 * (including null and the legacy string 'none') is no_proof.
 *
 *   select
 *     count(*) filter (where status = 'submitted')              as pending,
 *     count(*) filter (where status = 'approved')             as approved,
 *     count(*) filter (where status = 'rejected')             as resubmission,
 *     count(*) filter (where status is null or status = 'none') as no_proof,
 *     count(*)                                                as total
 *   from members;
 *   -- waitlist and scheduled are separate one-line counts
 */
import { handle, json, methodNotAllowed } from '../../src/lib/server/http.ts';
import { adminClient, requireAdmin } from '../../src/lib/server/supabase.ts';
import { latestStatusByUser } from '../../src/lib/server/campaigns.ts';

function normStatus(status: string | null | undefined): 'submitted' | 'approved' | 'rejected' | null {
  if (status === 'submitted' || status === 'approved' || status === 'rejected') return status;
  return null;
}

export default handle(async (req: Request) => {
  if (req.method !== 'GET') return methodNotAllowed(['GET']);
  await requireAdmin(req);
  const sb = adminClient();

  const [{ data: profiles, error: pErr }, { data: subs, error: sErr }, wait, scheduled] = await Promise.all([
    sb.from('profiles').select('id, is_admin, role, blocked, resubmit_note'),
    sb.from('submissions').select('user_id, status, created_at'),
    sb.from('waitlist').select('*', { count: 'exact', head: true }),
    sb.from('email_sends').select('*', { count: 'exact', head: true }).eq('state', 'scheduled'),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (sErr) throw new Error(sErr.message);

  const latest = latestStatusByUser(subs || []);
  const members = (profiles || []).filter((p) => !p.is_admin && p.role !== 'admin');

  let pending = 0;
  let approved = 0;
  let resubmission = 0;
  let blocked = 0;
  let noProof = 0;
  for (const p of members) {
    if (p.blocked) {
      blocked += 1;
      continue;
    }
    const status = normStatus(latest.get(p.id) || null);
    if (status === 'submitted') pending += 1;
    else if (status === 'approved') approved += 1;
    else if (status === 'rejected' || p.resubmit_note) resubmission += 1;
    else noProof += 1;
  }

  return json({
    ok: true,
    pending,
    approved,
    resubmission,
    blocked,
    no_proof: noProof,
    total: members.length,
    waitlist: wait.count || 0,
    scheduled: scheduled.count || 0,
  });
});
