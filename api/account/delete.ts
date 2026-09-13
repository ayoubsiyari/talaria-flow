/**
 * DELETE /api/account/delete  (Authorization: Bearer <member access token>)
 * Removes the member's proof files, the auth user (profiles/submissions cascade) and the session cookie.
 */
import { handle, json, methodNotAllowed, HttpError, readJson } from '../../src/lib/server/http.ts';
import { adminClient, requireUser, gotrue } from '../../src/lib/server/supabase.ts';
import { clearSessionCookie, isSecureRequest } from '../../src/lib/server/session-cookie.ts';
import { z } from 'zod';

const schema = z.object({ password: z.string().min(1).max(128) });

export default handle(async (req: Request) => {
  if (req.method !== 'DELETE' && req.method !== 'POST') return methodNotAllowed(['DELETE', 'POST']);
  const caller = await requireUser(req);
  if (caller.isAdmin) throw new HttpError(403, 'forbidden', 'Admins are removed from the Supabase dashboard.');
  const input = await readJson(req, schema);
  const { status } = await gotrue('/token?grant_type=password', { email: caller.email, password: input.password });
  if (status !== 200) throw new HttpError(401, 'invalid_credentials', 'Wrong password.');
  const sb = adminClient();

  const { data: files } = await sb.from('submission_files').select('file_path').eq('user_id', caller.id);
  const paths = (files || []).map((f) => f.file_path as string);
  const { data: incoming } = await sb.storage.from('proofs').list(`${caller.id}/incoming`);
  for (const o of incoming || []) paths.push(`${caller.id}/incoming/${o.name}`);
  if (paths.length) await sb.storage.from('proofs').remove(paths);

  const { error } = await sb.auth.admin.deleteUser(caller.id);
  if (error) throw new Error(error.message);

  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(isSecureRequest(req)) });
});
