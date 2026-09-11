/**
 * DELETE /api/account/delete  (Authorization: Bearer <member access token>)
 * Removes the member's proof files, the auth user (profiles/submissions cascade) and the session cookie.
 */
import { handle, json, methodNotAllowed, HttpError } from '../../src/lib/server/http.ts';
import { adminClient, requireUser } from '../../src/lib/server/supabase.ts';
import { clearSessionCookie, isSecureRequest } from '../../src/lib/server/session-cookie.ts';

export default handle(async (req: Request) => {
  if (req.method !== 'DELETE') return methodNotAllowed(['DELETE']);
  const caller = await requireUser(req);
  if (caller.isAdmin) throw new HttpError(403, 'forbidden', 'Admins are removed from the Supabase dashboard.');
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
