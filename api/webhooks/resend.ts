/**
 * POST /api/webhooks/resend — Resend delivery events → public.email_events.
 *
 * Resend → Webhooks → Add endpoint: https://www.talaria-flow.com/api/webhooks/resend
 * Events: email.delivered, email.opened, email.clicked, email.bounced, email.complained
 * Signing secret → RESEND_WEBHOOK_SECRET. Unsigned or stale requests get 401 and are not stored.
 */
import { z } from 'zod';
import { env } from '../../src/lib/server/env.ts';
import { handle, json, methodNotAllowed, HttpError } from '../../src/lib/server/http.ts';
import { adminClient } from '../../src/lib/server/supabase.ts';
import { svixHeaders, verifySvix } from '../../src/lib/server/svix.ts';

export const EVENT_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'delayed',
};

const payloadSchema = z.object({
  type: z.string().max(64),
  created_at: z.string().optional(),
  data: z.object({
    email_id: z.string().max(128).optional(),
    to: z.union([z.array(z.string().max(320)), z.string().max(320)]).optional(),
    tags: z
      .union([z.array(z.object({ name: z.string().max(64), value: z.string().max(128) })), z.record(z.string().max(64), z.string().max(128))])
      .optional(),
  }).passthrough(),
});

export function templateIdFrom(tags: unknown): string {
  if (Array.isArray(tags)) {
    const hit = tags.find((t) => t && t.name === 'template_id');
    return (hit && hit.value) || 'unknown';
  }
  if (tags && typeof tags === 'object') return String((tags as Record<string, string>).template_id || 'unknown');
  return 'unknown';
}

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const raw = await req.text();
  if (raw.length > 64 * 1024) throw new HttpError(413, 'payload_too_large');

  if (!(await verifySvix(env.resendWebhookSecret, svixHeaders(req), raw))) throw new HttpError(401, 'bad_signature');

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new HttpError(400, 'invalid_json'); }
  const body = payloadSchema.safeParse(parsed);
  if (!body.success) throw new HttpError(400, 'invalid_input');

  const event = EVENT_MAP[body.data.type];
  if (!event) return json({ ok: true, ignored: true });

  const d = body.data.data;
  const sb = adminClient();
  const { error } = await sb.from('email_events').insert({
    template_id: templateIdFrom(d.tags),
    event,
    recipient: Array.isArray(d.to) ? d.to[0] : d.to || null,
    provider_id: d.email_id || null,
  });
  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) return json({ ok: true, skipped: true });
    throw new Error(error.message);
  }
  if (event === 'opened' && d.email_id) {
    const { data: orig } = await sb
      .from('email_events')
      .select('send_id')
      .eq('provider_id', d.email_id)
      .not('send_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (orig?.send_id) {
      const { data: send } = await sb.from('email_sends').select('opened_count').eq('id', orig.send_id).maybeSingle();
      if (send) {
        await sb.from('email_sends').update({ opened_count: (send.opened_count || 0) + 1 }).eq('id', orig.send_id);
      }
    }
  }
  return json({ ok: true });
});
