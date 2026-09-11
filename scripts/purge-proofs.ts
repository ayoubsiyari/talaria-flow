/**
 * Manual run of the 90-day proof purge (same code as the nightly Vercel cron).
 *
 *   pnpm purge:proofs            # delete
 *   pnpm purge:proofs -- --dry   # report only
 *
 * Needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.
 */
import { adminClient } from '../src/lib/server/supabase.ts';
import { purgeExpiredProofs, PROOF_RETENTION_DAYS } from '../src/lib/server/purge.ts';

const dryRun = process.argv.includes('--dry');
const result = await purgeExpiredProofs(adminClient(), { dryRun, limit: 1000 });

console.log(`${dryRun ? '[dry run] ' : ''}proofs older than ${PROOF_RETENTION_DAYS} days (decided before ${result.cutoff})`);
console.log(`submissions: ${result.submissions}   files: ${result.files}`);
for (const e of result.errors) console.error('error:', e);
process.exit(result.errors.length ? 1 : 0);
