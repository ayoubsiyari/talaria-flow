/**
 * POST   /api/auth/session { access_token }  -> validates the token with Supabase Auth and (re)sets the
 *                                              HttpOnly cookie used by middleware.ts. Called by the browser
 *                                              on SIGNED_IN / TOKEN_REFRESHED.
 * DELETE /api/auth/session                    -> clears the cookie (sign-out).
 */
import { sessionSchema } from '../../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, error } from '../../src/lib/server/http.ts';
import { callerFromToken } from '../../src/lib/server/supabase.ts';
import { sessionCookie, clearSessionCookie, jwtExpiry, isSecureRequest } from '../../src/lib/server/session-cookie.ts';

export default handle(async (req: Request) => {
  const secure = isSecureRequest(req);
  if (req.method === 'DELETE') {
    return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(secure) });
  }
  if (req.method !== 'POST') return methodNotAllowed(['POST', 'DELETE']);

  const input = await readJson(req, sessionSchema);
  const caller = await callerFromToken(input.access_token);
  if (!caller) return error(401, 'unauthorized', 'Invalid session.');
  if (!caller.emailVerified) return error(403, 'email_not_confirmed', 'Confirm your email first.');

  const exp = jwtExpiry(input.access_token) || input.expires_at || Math.floor(Date.now() / 1000) + 3600;
  const maxAge = Math.max(0, exp - Math.floor(Date.now() / 1000));
  return json({ ok: true, is_admin: caller.isAdmin }, 200, { 'set-cookie': sessionCookie(input.access_token, maxAge, secure) });
});
