/**
 * POST /api/admin/emails/test  (Authorization: Bearer <admin access token>)
 *   { id, lang, to }          -> renders the saved template `id` (emails/templates.json)
 *   { spec, lang, to }        -> renders an unsaved spec from the template editor ("Send test to me")
 * Sends one email to the admin's own address only, through the same sendTemplate() the member
 * emails use, with sample merge data so no placeholder is blank. Non-admins get 404.
 * Response: { ok, id: <provider id> | null, skipped? }
 */
import { adminTestEmailSchema } from '../../../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, HttpError } from '../../../src/lib/server/http.ts';
import { requireAdmin } from '../../../src/lib/server/supabase.ts';
import { env } from '../../../src/lib/server/env.ts';
import { sendTemplate, formatDate, resolveSendSpec, resolveTemplateId, emailLinks, type TemplateSpec } from '../../../src/lib/server/send-template.ts';

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const caller = await requireAdmin(req);
  const input = await readJson(req, adminTestEmailSchema);
  if (input.to !== caller.email.toLowerCase()) throw new HttpError(400, 'invalid_input', 'Test emails go to your own address.');

  const spec: TemplateSpec | null = input.spec ? (input.spec as TemplateSpec) : await resolveSendSpec(input.id || '');
  if (!spec) throw new HttpError(404, 'not_found', 'Unknown template.');
  const templateId = resolveTemplateId(input.id || String(spec.file || spec.id || 'custom-test'));
  const now = new Date();
  const to = input.to;
  const sample = {
    first_name: 'Test',
    email: to,
    account_email: to,
    reason: 'Example reason',
    note: '',
    file_count: 2,
    submitted_at: formatDate(now, input.lang),
    dashboard_url: `${env.siteUrl}/account/access/`,
    course_url: `${env.siteUrl}/account/course/`,
    token: 'example-token',
    code: '123456',
    device: 'Chrome on Windows',
    location: 'London, UK',
    time: formatDate(now, input.lang),
    subject: 'Example subject',
    preheader: 'Example preheader',
    issue_label: 'Issue 01',
    title: 'Example title',
    intro: 'This is a test send from the admin console.',
    body: 'This is a test send from the admin console.',
    hero_image_url: `${env.siteUrl}/assets/nt-platform.png`,
    hero_image_alt: 'Talaria Flow suite on a NinjaTrader chart',
    section_1_title: 'Section one',
    section_1_body: 'Example body copy for the first section.',
    section_2_title: 'Section two',
    section_2_body: 'Example body copy for the second section.',
    cta_label: 'Open dashboard',
    cta_url: `${env.siteUrl}/account/access/`,
    ...emailLinks({ memberId: caller.id, email: to, templateId }),
  };

  // Test sends carry no member/submission/send id, so the idempotency index never blocks a re-send.
  const result = await sendTemplate({ templateId, to, lang: input.lang, spec, vars: sample });
  if (!result.ok) throw new HttpError(502, 'send_failed', result.error || 'The email provider rejected the message.');
  return json({ ok: true, id: result.id || null, skipped: Boolean(result.skipped) });
});
