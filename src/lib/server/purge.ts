/**
 * Proof retention: 90 days after a submission is approved or rejected, its screenshots are
 * deleted from the private `proofs` bucket and the submission_files rows are removed. The
 * submission row itself (status, reviewer note, timestamps) is kept; files_purged_at records
 * when the files went. Runs from api/cron/purge-proofs (Vercel cron) and scripts/purge-proofs.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const PROOF_RETENTION_DAYS = 90;
export const PROOF_BUCKET = 'proofs';

const INCOMING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PurgeResult {
  cutoff: string;
  submissions: number;
  files: number;
  incoming: number;
  errors: string[];
}

export function retentionCutoff(now: Date = new Date(), days: number = PROOF_RETENTION_DAYS): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Drop originals left in proofs/<uid>/incoming/ after a failed or abandoned submit (older than 24h). */
export async function purgeAbandonedIncoming(
  sb: SupabaseClient,
  opts: { now?: Date; dryRun?: boolean } = {},
): Promise<number> {
  const storage = sb.storage.from(PROOF_BUCKET);
  const now = opts.now ?? new Date();
  const { data: roots, error } = await storage.list('', { limit: 1000 });
  if (error) throw new Error(error.message);
  let removed = 0;
  for (const root of roots || []) {
    if (!root?.name) continue;
    const { data: incoming } = await storage.list(`${root.name}/incoming`, { limit: 100 });
    const stale = (incoming || []).filter((o) => {
      const t = o.updated_at || o.created_at;
      if (!t) return true;
      return now.getTime() - new Date(t).getTime() > INCOMING_MAX_AGE_MS;
    });
    if (!stale.length) continue;
    if (opts.dryRun) { removed += stale.length; continue; }
    const paths = stale.map((o) => `${root.name}/incoming/${o.name}`);
    const { error: rmErr } = await storage.remove(paths);
    if (!rmErr) removed += paths.length;
  }
  return removed;
}

export async function purgeExpiredProofs(sb: SupabaseClient, opts: { now?: Date; dryRun?: boolean; limit?: number } = {}): Promise<PurgeResult> {
  const cutoff = retentionCutoff(opts.now);
  const result: PurgeResult = { cutoff, submissions: 0, files: 0, incoming: 0, errors: [] };

  try {
    result.incoming = await purgeAbandonedIncoming(sb, { now: opts.now, dryRun: opts.dryRun });
  } catch (err) {
    result.errors.push(`incoming: ${err instanceof Error ? err.message : String(err)}`);
  }

  const { data: due, error } = await sb
    .from('submissions')
    .select('id, user_id')
    .in('status', ['approved', 'rejected'])
    .is('files_purged_at', null)
    .lt('decided_at', cutoff)
    .order('decided_at', { ascending: true })
    .limit(opts.limit ?? 200);
  if (error) throw new Error(error.message);
  if (!due || !due.length) return result;

  const storage = sb.storage.from(PROOF_BUCKET);
  for (const sub of due) {
    const { data: files, error: fErr } = await sb.from('submission_files').select('id, file_path').eq('submission_id', sub.id);
    if (fErr) { result.errors.push(`${sub.id}: ${fErr.message}`); continue; }
    const paths = (files || []).map((f) => f.file_path).filter(Boolean);

    if (opts.dryRun) { result.submissions++; result.files += paths.length; continue; }

    if (paths.length) {
      const { error: rmErr } = await storage.remove(paths);
      if (rmErr) { result.errors.push(`${sub.id}: storage ${rmErr.message}`); continue; }
    }
    // Sweep anything left in the folder (re-encoded copies always live under <uid>/<submission>/).
    const { data: leftovers } = await storage.list(`${sub.user_id}/${sub.id}`, { limit: 100 });
    if (leftovers && leftovers.length) await storage.remove(leftovers.map((o) => `${sub.user_id}/${sub.id}/${o.name}`));

    const { error: delErr } = await sb.from('submission_files').delete().eq('submission_id', sub.id);
    if (delErr) { result.errors.push(`${sub.id}: rows ${delErr.message}`); continue; }
    const { error: upErr } = await sb.from('submissions').update({ files_purged_at: new Date().toISOString(), file_count: 0 }).eq('id', sub.id);
    if (upErr) { result.errors.push(`${sub.id}: stamp ${upErr.message}`); continue; }

    result.submissions++;
    result.files += paths.length;
  }
  return result;
}
