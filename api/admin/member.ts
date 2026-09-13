/**
 * POST /api/admin/member { action: "delete" | "reset-password" | "delete-waitlist", id? email? }  (Authorization: Bearer <admin token>)
 *   delete         -> removes proof files + auth user (profile/submissions cascade)
 *   reset-password -> Supabase Auth sends the recovery email to the member
 * Non-admins get 404. Admin accounts cannot be deleted here.
 */
import { z } from 'zod';
import { handle, json, readJson, methodNotAllowed, HttpError, clientIp } from '../../src/lib/server/http.ts';
import { adminClient, requireAdmin, gotrue } from '../../src/lib/server/supabase.ts';
import { env } from '../../src/lib/server/env.ts';
import { rateLimit } from '../../src/lib/server/ratelimit.ts';

const schema = z.object({
  action: z.enum(['delete', 'reset-password', 'delete-waitlist']),
  id: z.string().uuid().optional(),
  email: z.string().email().optional(),
}).refine((v) => (v.action === 'delete-waitlist' ? Boolean(v.email) : Boolean(v.id)), { message: 'id or email is required' });

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const admin = await requireAdmin(req);
  const input = await readJson(req, schema);
  const sb = adminClient();

  if (input.action === 'delete-waitlist') {
    const email = String(input.email || '').trim().toLowerCase();
    const { error } = await sb.from('waitlist').delete().eq('email', email);
    if (error) throw new Error(error.message);
    await sb.from('activity_log').insert({ kind: 'deleted', actor_id: admin.id, text: `Waitlist ${email} removed`, color: '#B7BCCB', filter: 'member' });
    return json({ ok: true });
  }

  const { data: target } = await sb.from('profiles').select('id, email, is_admin, role').eq('id', input.id).maybeSingle();
  if (!target) throw new HttpError(404, 'not_found', 'Member not found.');
  if (target.is_admin || target.role === 'admin') throw new HttpError(403, 'forbidden', 'Admins are managed in the Supabase dashboard.');

  if (input.action === 'reset-password') {
    await rateLimit('admin-reset', clientIp(req), String(target.email || target.id));
    await gotrue(`/recover?redirect_to=${encodeURIComponent(`${env.siteUrl}/login/?type=recovery`)}`, { email: target.email });
    await sb.from('activity_log').insert({ kind: 'reset', actor_id: admin.id, text: `Password reset sent to ${target.email}`, color: '#B7BCCB', filter: 'email' });
    return json({ ok: true });
  }

  const { data: files } = await sb.from('submission_files').select('file_path').eq('user_id', target.id);
  const paths = (files || []).map((f) => f.file_path as string);
  const { data: incoming } = await sb.storage.from('proofs').list(`${target.id}/incoming`);
  for (const o of incoming || []) paths.push(`${target.id}/incoming/${o.name}`);
  if (paths.length) await sb.storage.from('proofs').remove(paths);
  const { error } = await sb.auth.admin.deleteUser(target.id);
  if (error) throw new Error(error.message);
  await sb.from('activity_log').insert({ kind: 'deleted', actor_id: admin.id, text: `${target.email} deleted by admin`, color: '#FF8AD0', filter: 'member' });
  return json({ ok: true });
});
