/**
 * Verifies Standard Webhooks / Svix signatures (the scheme Resend uses).
 *
 * Headers: svix-id, svix-timestamp, svix-signature ("v1,<base64> v1,<base64> …").
 * Signed content: `${id}.${timestamp}.${rawBody}` with HMAC-SHA256 keyed by the
 * base64-decoded part of the secret after "whsec_". Web Crypto only, so it runs in
 * Node functions and on the edge alike.
 */

export const SVIX_TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export function svixHeaders(req: Request): SvixHeaders {
  return {
    id: req.headers.get('svix-id') || req.headers.get('webhook-id'),
    timestamp: req.headers.get('svix-timestamp') || req.headers.get('webhook-timestamp'),
    signature: req.headers.get('svix-signature') || req.headers.get('webhook-signature'),
  };
}

function b64decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function b64encode(bytes: ArrayBuffer): string {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function signSvix(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey('raw', b64decode(raw) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return `v1,${b64encode(sig)}`;
}

/** True only when a v1 signature matches and the timestamp is within tolerance. */
export async function verifySvix(
  secret: string,
  headers: SvixHeaders,
  body: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > SVIX_TOLERANCE_SECONDS) return false;
  const expected = await signSvix(secret, headers.id, headers.timestamp, body);
  return headers.signature
    .split(/\s+/)
    .filter((s) => s.startsWith('v1,'))
    .some((s) => timingSafeEqual(s, expected));
}
