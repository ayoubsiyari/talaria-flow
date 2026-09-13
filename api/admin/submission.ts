/**
 * POST /api/admin/submission
 *   approve   -> mark approved, email 04
 *   resubmit  -> email 05, wipe proof, member can upload again
 *   reject    -> email 10, wipe proof, block further uploads until restore
 *   restore   -> clear the block so the member can upload again (id = member id)
 */
import { adminDecisionSchema } from '../../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, HttpError } from '../../src/lib/server/http.ts';
import { adminClient, requireAdmin } from '../../src/lib/server/supabase.ts';
import { env } from '../../src/lib/server/env.ts';
import { sendTemplate, emailLinks } from '../../src/lib/server/send-template.ts';
import { firstNameOf } from '../../src/lib/server/campaigns.ts';

async function wipeProof(sb: ReturnType<typeof adminClient>, submissionId: string) {
  const { data: files } = await sb.from('submission_files').select('file_path').eq('submission_id', submissionId);
  const paths = (files || []).map((f) => String(f.file_path || '')).filter(Boolean);
  if (paths.length) await sb.storage.from('proofs').remove(paths);
  const { error: delErr } = await sb.from('submissions').delete().eq('id', submissionId);
  if (delErr) throw new Error(delErr.message);
}

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const admin = await requireAdmin(req);
  const input = await readJson(req, adminDecisionSchema);
  const sb = adminClient();
  const now = new Date().toISOString();
  const reason = String(input.reason || '').trim();

  if (input.action === 'restore') {
    const { data: member } = await sb.from('profiles').select('id, email').eq('id', input.id).maybeSingle();
    if (!member) throw new HttpError(404, 'not_found', 'Member not found.');
    const { error } = await sb.from('profiles').update({ blocked: false, resubmit_note: null }).eq('id', member.id);
    if (error) throw new Error(error.message);
    await sb.from('activity_log').insert({
      kind: 'decision',
      actor_id: admin.id,
      text: `${member.email} restored — can submit again`,
      color: '#2EE8FF',
      filter: 'review',
    });
    return json({ ok: true, id: member.id, status: 'none', email: { ok: true, skipped: true } });
  }

  const { data: bySub, error: findErr } = await sb.from('submissions').select('id, user_id, status').eq('id', input.id).maybeSingle();
  if (findErr && findErr.code !== '22P02') throw new Error(findErr.message);
  let submission = bySub;
  if (!submission) {
    const { data: latest } = await sb.from('submissions').select('id, user_id, status').eq('user_id', input.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    submission = latest;
  }
  const userId = submission ? submission.user_id : input.id;
  const { data: member } = await sb.from('profiles').select('id, email, lang, first_name, name').eq('id', userId).maybeSingle();
  if (!member || !member.email) throw new HttpError(404, 'not_found', 'Member not found.');
  if (submission && submission.status === 'approved' && input.action !== 'resubmit') {
    throw new HttpError(409, 'already_decided', 'This submission has already been decided.');
  }

  if (input.action === 'approve') {
    if (!submission || submission.status !== 'submitted') throw new HttpError(404, 'not_found', 'Submission not found.');
    const { error: upErr } = await sb
      .from('submissions')
      .update({ status: 'approved', reviewer_note: null, decided_at: now, reviewed_at: now, reviewed_by: admin.id })
      .eq('id', submission.id);
    if (upErr) throw new Error(upErr.message);
    await sb.from('profiles').update({ blocked: false, resubmit_note: null }).eq('id', member.id);
  }

  const approve = input.action === 'approve';
  const resubmit = input.action === 'resubmit';
  const templateId = approve ? '04-approved' : resubmit ? '05-needs-resubmission' : '10-application-rejected';
  await sb.from('activity_log').insert({
    kind: 'decision',
    actor_id: admin.id,
    submission_id: submission ? submission.id : null,
    text: approve ? `${member.email} approved` : resubmit ? `${member.email} asked to resubmit` : `${member.email} rejected`,
    color: approve ? '#2EE8FF' : '#FF8AD0',
    filter: 'review',
  });

  const lang = member.lang === 'ar' ? 'ar' : 'en';
  const email = await sendTemplate({
    templateId,
    to: member.email,
    lang,
    memberId: member.id,
    submissionId: submission ? submission.id : null,
    vars: {
      first_name: firstNameOf(member),
      reason: reason || '',
      dashboard_url: `${env.siteUrl}/account/access/`,
      account_email: member.email,
      email: member.email,
      ...emailLinks({ memberId: member.id, email: member.email, templateId }),
    },
  });

  if (resubmit) {
    if (submission) await wipeProof(sb, submission.id);
    const { error } = await sb.from('profiles').update({
      blocked: false,
      resubmit_note: reason || 'Please upload new screenshots.',
    }).eq('id', member.id);
    if (error) throw new Error(error.message);
    return json({ ok: true, id: submission ? submission.id : member.id, status: 'rejected', email: { ok: email.ok, skipped: Boolean(email.skipped) } });
  }

  if (input.action === 'reject') {
    if (submission) await wipeProof(sb, submission.id);
    const { error } = await sb.from('profiles').update({
      blocked: true,
      resubmit_note: null,
    }).eq('id', member.id);
    if (error) throw new Error(error.message);
    return json({ ok: true, id: submission ? submission.id : member.id, status: 'blocked', email: { ok: email.ok, skipped: Boolean(email.skipped) } });
  }

  if (!submission) throw new HttpError(404, 'not_found', 'Submission not found.');
  return json({ ok: true, id: submission.id, status: 'approved', email: { ok: email.ok, skipped: Boolean(email.skipped) } });
});
