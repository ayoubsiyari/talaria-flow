/**
 * HttpOnly session cookie used by middleware.ts to guard /account and /admin on the server.
 *
 * supabase-js keeps the full session in localStorage for API calls; the browser never reads
 * this cookie. It carries the access token only and is refreshed by POST /api/auth/session
 * whenever supabase-js rotates the token, and cleared on sign-out.
 */
export const SESSION_COOKIE = 'tf-session';

export function sessionCookie(token: string, maxAgeSeconds: number, secure = true): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(secure = true): string {
  return sessionCookie('', 0, secure);
}

/** Read the `exp` claim of a JWT without verifying it (verification happens against GoTrue). */
export function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '');
  return proto === 'https';
}
