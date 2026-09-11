/**
 * Server-side Sentry without the SDK: posts a single error event as an envelope to the DSN.
 * Keeps the functions small and works identically in Node and edge runtimes. No-op when
 * SENTRY_DSN is empty. Never includes request bodies, cookies or tokens.
 */
import { env } from './env.ts';

interface Dsn { publicKey: string; host: string; projectId: string; protocol: string }

export function parseDsn(dsn: string): Dsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, '').split('/').pop() || '';
    if (!u.username || !projectId) return null;
    return { publicKey: u.username, host: u.host, projectId, protocol: u.protocol.replace(':', '') };
  } catch {
    return null;
  }
}

export function envelopeFor(dsn: Dsn, err: unknown, ctx: Record<string, unknown> = {}): { url: string; body: string } {
  const e = err instanceof Error ? err : new Error(String(err));
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const frames = (e.stack || '')
    .split('\n')
    .slice(1, 30)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('at '))
    .map((l) => ({ function: l.slice(3).split(' (')[0], filename: (l.match(/\(([^)]+)\)/) || [])[1] || '' }))
    .reverse();
  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    server_name: 'vercel',
    tags: { runtime: 'server' },
    extra: ctx,
    exception: { values: [{ type: e.name, value: e.message, stacktrace: frames.length ? { frames } : undefined }] },
  };
  const header = { event_id: eventId, sent_at: new Date().toISOString(), dsn: `${dsn.protocol}://${dsn.publicKey}@${dsn.host}/${dsn.projectId}` };
  const body = `${JSON.stringify(header)}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}\n`;
  return { url: `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`, body };
}

/** Fire-and-forget. Resolves quickly; failures are swallowed so error reporting never breaks a request. */
export async function captureException(err: unknown, ctx: Record<string, unknown> = {}): Promise<void> {
  const dsn = parseDsn(env.sentryDsn);
  if (!dsn) return;
  const { url, body } = envelopeFor(dsn, err, ctx);
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=talaria-flow/1.0`,
      },
      body,
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    /* reporting must never throw */
  }
}
