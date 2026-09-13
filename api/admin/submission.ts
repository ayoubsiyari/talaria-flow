/**
 * POST /api/admin/submission  (Authorization: Bearer <admin access token>)
 *   { action: "approve", id }                 -> status approved, "04-approved" email
 *   { action: "reject",  id, reason }         -> "05-needs-resubmission" email, then proof files
 *                                              and the submission row are removed so the member
 *                                              can upload again from a clean slate.
 *
 * The decision is written with the service role (browser policies no longer allow admins to update
 * submissions), logged to activity_log and mailed to the member in their language. A failed email
 * never fails the decision; the response reports it. Non-admins get 404.
 * Response: { ok: true, id, status, email: { ok, skipped } }
 */
import { adminDecisionSchema } from '../../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, HttpError } from '../../src/lib/server/http.ts';
import { adminClient, requireAdmin } from '../../src/lib/server/supabase.ts';
import { env } from '../../src/lib/server/env.ts';
import { sendTemplate, emailLinks } from '../../src/lib/server/send-template.ts';
import { firstNameOf } from '../../src/lib/server/campaigns.ts';

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const admin = await requireAdmin(req);
  const input = await readJson(req, adminDecisionSchema);
  const sb = adminClient();

  const { data: submission, error: findErr } = await sb.from('submissions').select('id, user_id, status').eq('id', input.id).maybeSingle();
  // 22P02 = malformed uuid: Postgres refuses to even compare it, which for us just means "no such row".
  if (findErr && findErr.code !== '22P02') throw new Error(findErr.message);
  if (!submission) throw new HttpError(404, 'not_found', 'Submission not found.');
  if (submission.status === 'approved') throw new HttpError(409, 'already_decided', 'This submission has already been decided.');
  const { data: member } = await sb.from('profiles').select('id, email, lang, first_name, name').eq('id', submission.user_id).maybeSingle();
  if (!member || !member.email) throw new HttpError(404, 'not_found', 'Member not found.');

  const approve = input.action === 'approve';
  const reason = approve ? null : String(input.reason || '').trim();
  const now = new Date().toISOString();

  if (approve) {
    const { error: upErr } = await sb
      .from('submissions')
      .update({ status: 'approved', reviewer_note: null, decided_at: now, reviewed_at: now, reviewed_by: admin.id })
      .eq('id', submission.id);
    if (upErr) throw new Error(upErr.message);
  }

  await sb.from('activity_log').insert({
    kind: 'decision',
    actor_id: admin.id,
    submission_id: submission.id,
    text: approve ? `${member.email} approved` : `${member.email} asked to resubmit`,
    color: approve ? '#2EE8FF' : '#FF8AD0',
    filter: 'review',
  });

  const lang = member.lang === 'ar' ? 'ar' : 'en';
  const templateId = approve ? '04-approved' : '05-needs-resubmission';
  const email = await sendTemplate({
    templateId,
    to: member.email,
    lang,
    memberId: member.id,
    submissionId: submission.id,
    vars: {
      first_name: firstNameOf(member),
      reason: reason || '',
      dashboard_url: `${env.siteUrl}/account/access/`,
      account_email: member.email,
      email: member.email,
      ...emailLinks({ memberId: member.id, email: member.email, templateId }),
    },
  });

  if (!approve) {
    const { data: files } = await sb.from('submission_files').select('file_path').eq('submission_id', submission.id);
    const paths = (files || []).map((f) => String(f.file_path || '')).filter(Boolean);
    if (paths.length) await sb.storage.from('proofs').remove(paths);
    const { error: delErr } = await sb.from('submissions').delete().eq('id', submission.id);
    if (delErr) throw new Error(delErr.message);
    await sb.from('profiles').update({ resubmit_note: reason || 'Please upload new screenshots.' }).eq('id', member.id);
  }

  return json({ ok: true, id: submission.id, status: approve ? 'approved' : 'none', email: { ok: email.ok, skipped: Boolean(email.skipped) } });
});
