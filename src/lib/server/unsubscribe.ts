/**
 * Signed one-click unsubscribe links. Pure functions (no I/O) so they can be unit-tested; the
 * signing key is UNSUBSCRIBE_SECRET (falls back to SUPABASE_SERVICE_ROLE_KEY). It never leaves the server.
 *
 *   /api/unsubscribe?m=<profile id>&k=course|newsletter|tools&t=<hmac>
 *   /api/unsubscribe?e=<email>&k=waitlist&t=<hmac>
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const UNSUBSCRIBE_KINDS = ['course', 'newsletter', 'tools', 'waitlist'] as const;
export type UnsubscribeKind = (typeof UNSUBSCRIBE_KINDS)[number];

export interface UnsubscribeTarget {
  kind: UnsubscribeKind;
  /** profiles.id for member kinds */
  memberId?: string | null;
  /** waitlist.email for the waitlist kind (lower-cased) */
  email?: string | null;
}

/** Notification preference key for a campaign template; null for transactional templates. */
export function unsubscribeKindFor(templateId: string): Exclude<UnsubscribeKind, 'waitlist'> | null {
  const id = String(templateId || '');
  if (/^06(-|$)|course-ready/.test(id)) return 'course';
  if (/^08(-|$)|newsletter/.test(id)) return 'newsletter';
  if (/^09(-|$)|tools-suite/.test(id)) return 'tools';
  return null;
}

function subject(target: UnsubscribeTarget): string | null {
  if (!UNSUBSCRIBE_KINDS.includes(target.kind)) return null;
  if (target.kind === 'waitlist') {
    const email = String(target.email || '').trim().toLowerCase();
    return email ? `waitlist|e|${email}` : null;
  }
  const id = String(target.memberId || '').trim().toLowerCase();
  return id ? `${target.kind}|m|${id}` : null;
}

export function signUnsubscribe(target: UnsubscribeTarget, key: string): string | null {
  const s = subject(target);
  if (!s || !key) return null;
  return createHmac('sha256', key).update(s).digest('hex').slice(0, 40);
}

export function verifyUnsubscribe(target: UnsubscribeTarget, token: string, key: string): boolean {
  const expected = signUnsubscribe(target, key);
  const given = String(token || '');
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(given, 'utf8'));
}

export function unsubscribeUrl(siteUrl: string, target: UnsubscribeTarget, key: string): string | null {
  const t = signUnsubscribe(target, key);
  if (!t) return null;
  const q = new URLSearchParams();
  if (target.kind === 'waitlist') q.set('e', String(target.email).trim().toLowerCase());
  else q.set('m', String(target.memberId).trim().toLowerCase());
  q.set('k', target.kind);
  q.set('t', t);
  return `${siteUrl.replace(/\/+$/, '')}/api/unsubscribe?${q.toString()}`;
}

/** Parse and verify the query string of /api/unsubscribe. Returns the target on success. */
export function parseUnsubscribe(params: URLSearchParams, key: string | string[]): UnsubscribeTarget | null {
  const kind = params.get('k') as UnsubscribeKind | null;
  if (!kind || !UNSUBSCRIBE_KINDS.includes(kind)) return null;
  const target: UnsubscribeTarget =
    kind === 'waitlist'
      ? { kind, email: (params.get('e') || '').trim().toLowerCase() }
      : { kind, memberId: (params.get('m') || '').trim().toLowerCase() };
  if (kind !== 'waitlist' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(target.memberId || '')) return null;
  if (kind === 'waitlist' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email || '')) return null;
  const keys = Array.isArray(key) ? key : [key];
  const token = params.get('t') || '';
  for (const k of keys) {
    if (k && verifyUnsubscribe(target, token, k)) return target;
  }
  return null;
}
