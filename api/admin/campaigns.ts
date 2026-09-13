/**
 * Campaign sends, server-side (Authorization: Bearer <admin access token>; non-admins get 404).
 *
 * GET  /api/admin/campaigns                       -> { ok, sends: EmailSend[] }  (newest first, 100)
 * POST /api/admin/campaigns  body by `action`:
 *   { action: "count",  audience, lang?, skipRecent?, memberIds?, templateId? } -> { ok, count }
 *   { action: "create", templateId, audience, lang?, skipRecent?, memberIds?, subject?, note?, scheduledFor? }
 *                                                                              -> { ok, send }
 *        scheduledFor in the future -> state "scheduled" (cron / run-due executes it); omitted -> sent now;
 *        in the past -> 400 invalid_input
 *   { action: "cancel", id }                                                   -> { ok, send } | 409 not_cancellable
 *   { action: "run-due" }                                                      -> { ok, processed, ids }
 *
 * templateId: any saved email template (built-in 01–10 or a custom id from Email templates).
 * audience: approved | submitted | rejected | none (no submission) | all | waitlist.
 * lang: all = each recipient's profile language; en / ar = send that language to the whole audience.
 */
import { adminCampaignSchema } from '../../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, HttpError, clientIp } from '../../src/lib/server/http.ts';
import { adminClient, requireAdmin } from '../../src/lib/server/supabase.ts';
import { resolveTemplateId } from '../../src/lib/server/send-template.ts';
import { createCampaign, processDueSends, resolveRecipients } from '../../src/lib/server/campaigns.ts';
import { rateLimit } from '../../src/lib/server/ratelimit.ts';

export default handle(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(['GET', 'POST']);
  const admin = await requireAdmin(req);
  const sb = adminClient();

  if (req.method === 'GET') {
    const { data, error } = await sb.from('email_sends').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return json({ ok: true, sends: data || [] });
  }

  const input = await readJson(req, adminCampaignSchema);

  if (input.action === 'count') {
    // Notification preferences depend on the template (06 course, 08 newsletter, 09 tools).
    const recipients = await resolveRecipients(sb, {
      templateId: resolveTemplateId(input.templateId || '08-newsletter'),
      audience: input.audience,
      lang: input.lang,
      skipRecent: input.skipRecent,
      memberIds: input.memberIds || null,
    });
    return json({ ok: true, count: recipients.length });
  }

  if (input.action === 'create') {
    await rateLimit('campaign', clientIp(req), admin.id, 20);
    const templateId = resolveTemplateId(input.templateId);
    // A schedule is either clearly in the future or omitted; a stale timestamp must not silently send now.
    if (input.scheduledFor && new Date(input.scheduledFor).getTime() < Date.now() - 60_000) {
      throw new HttpError(400, 'invalid_input', 'scheduledFor: must be in the future (omit it to send now)');
    }
    const send = await createCampaign(
      sb,
      {
        templateId,
        subject: input.subject || null,
        audience: input.audience,
        lang: input.lang,
        skipRecent: input.skipRecent,
        scheduledFor: input.scheduledFor || null,
        memberIds: input.memberIds || null,
        note: input.note || null,
      },
      admin.id,
    );
    return json({ ok: true, send });
  }

  if (input.action === 'cancel') {
    const { data: row } = await sb.from('email_sends').select('*').eq('id', input.id).maybeSingle();
    if (!row) throw new HttpError(404, 'not_found', 'Send not found.');
    if (row.state !== 'scheduled') throw new HttpError(409, 'not_cancellable', `A ${row.state} send cannot be cancelled.`);
    const { data: updated, error } = await sb.from('email_sends').update({ state: 'cancelled', finished_at: new Date().toISOString() }).eq('id', input.id).eq('state', 'scheduled').select().single();
    if (error || !updated) throw new HttpError(409, 'not_cancellable', 'The send already started.');
    return json({ ok: true, send: updated });
  }

  const result = await processDueSends(sb);
  return json({ ok: true, ...result });
});
