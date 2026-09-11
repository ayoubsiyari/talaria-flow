/**
 * The five test accounts from docs/CHECKLIST.md, idempotent. Staging / local projects only.
 *
 *   pnpm seed:test-accounts            # needs SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TEST_PASSWORD in .env
 *   pnpm seed:test-accounts -- --dry   # print what would change
 *
 *   admin@talaria-flow.test            admin (is_admin + role), no submission
 *   member-pending@talaria-flow.test   one submission, status submitted (waiting for review)
 *   member-approved@talaria-flow.test  one submission, status approved
 *   member-rejected@talaria-flow.test  one submission, status rejected, with a reviewer note
 *   member-new@talaria-flow.test       confirmed account, no submission yet
 *
 * Submissions are rows only (file_count = 2, no objects in the proofs bucket), which is what the
 * dashboard, the admin queue and the 90-day purge need to show every state.
 */
import { adminClient } from '../src/lib/server/supabase.ts';

interface Account {
  email: string;
  first_name: string;
  last_name: string;
  country: string;
  lang: 'en' | 'ar';
  admin?: boolean;
  submission?: { status: 'submitted' | 'approved' | 'rejected'; note?: string; reviewer_note?: string };
}

export const TEST_ACCOUNTS: Account[] = [
  { email: 'admin@talaria-flow.test', first_name: 'Ada', last_name: 'Admin', country: 'GB', lang: 'en', admin: true },
  { email: 'member-pending@talaria-flow.test', first_name: 'Pia', last_name: 'Pending', country: 'DE', lang: 'en', submission: { status: 'submitted', note: 'Both screenshots attached: Welcome page and Simulation platform.' } },
  { email: 'member-approved@talaria-flow.test', first_name: 'Amir', last_name: 'Approved', country: 'AE', lang: 'ar', submission: { status: 'approved' } },
  { email: 'member-rejected@talaria-flow.test', first_name: 'Rita', last_name: 'Rejected', country: 'FR', lang: 'en', submission: { status: 'rejected', reviewer_note: 'The second screenshot does not show the Simulation label. Please retake it with the platform header visible.' } },
  { email: 'member-new@talaria-flow.test', first_name: 'Noor', last_name: 'New', country: 'EG', lang: 'en' },
];

const dry = process.argv.includes('--dry');
const password = process.env.TEST_PASSWORD || '';
if (password.length < 8 || /^replace-with/.test(password)) {
  console.error('Set TEST_PASSWORD in .env (min 8 characters) before creating test accounts.');
  process.exit(1);
}

const sb = adminClient();
console.log(`${dry ? '[dry run] ' : ''}project ${process.env.SUPABASE_URL}`);

async function findUser(email: string): Promise<{ id: string } | null> {
  // GoTrue admin API has no lookup-by-email; the user list is small on staging projects.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email);
    if (hit) return { id: hit.id };
    if (data.users.length < 200) break;
  }
  return null;
}

let failures = 0;
for (const acc of TEST_ACCOUNTS) {
  const meta = { first_name: acc.first_name, last_name: acc.last_name, country: acc.country, lang: acc.lang };
  try {
    let user = await findUser(acc.email);
    if (dry) {
      console.log(`${user ? 'update' : 'create'}  ${acc.email}${acc.admin ? '  (admin)' : ''}${acc.submission ? `  submission=${acc.submission.status}` : ''}`);
      continue;
    }
    if (user) {
      const { error } = await sb.auth.admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: meta });
      if (error) throw new Error(`updateUserById: ${error.message}`);
    } else {
      const { data, error } = await sb.auth.admin.createUser({ email: acc.email, password, email_confirm: true, user_metadata: meta });
      if (error || !data.user) throw new Error(`createUser: ${error?.message || 'no user returned'}`);
      user = { id: data.user.id };
    }

    // The on_auth_user_created trigger inserted the profile; make sure the fields are what we expect.
    const { error: pErr } = await sb.from('profiles').upsert(
      {
        id: user.id,
        email: acc.email,
        first_name: acc.first_name,
        last_name: acc.last_name,
        name: `${acc.first_name} ${acc.last_name}`,
        country: acc.country,
        lang: acc.lang,
        is_admin: Boolean(acc.admin),
        role: acc.admin ? 'admin' : 'member',
      },
      { onConflict: 'id' },
    );
    if (pErr) throw new Error(`profiles: ${pErr.message}`);

    const { error: dErr } = await sb.from('submissions').delete().eq('user_id', user.id);
    if (dErr) throw new Error(`submissions delete: ${dErr.message}`);
    if (acc.submission) {
      const decided = acc.submission.status === 'submitted' ? null : new Date().toISOString();
      const { error: sErr } = await sb.from('submissions').insert({
        user_id: user.id,
        status: acc.submission.status,
        note: acc.submission.note || null,
        reviewer_note: acc.submission.reviewer_note || null,
        file_count: 2,
        decided_at: decided,
        reviewed_at: decided,
      });
      if (sErr) throw new Error(`submissions insert: ${sErr.message}`);
    }
    console.log(`ok      ${acc.email}${acc.admin ? '  (admin)' : ''}${acc.submission ? `  submission=${acc.submission.status}` : ''}`);
  } catch (err) {
    failures += 1;
    console.error(`failed  ${acc.email}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (!dry) console.log(`\nPassword for all five: TEST_PASSWORD from .env. Log in at ${(process.env.SITE_URL || 'http://127.0.0.1:5051').replace(/\/+$/, '')}/login/`);
process.exit(failures ? 1 : 0);
