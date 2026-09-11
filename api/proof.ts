/**
 * POST /api/proof  (Authorization: Bearer <member access token>)
 * { note, files: [{ path: "<uid>/incoming/<uuid>.png", name }] }
 *
 * The browser uploads originals straight to the private `proofs` bucket under <uid>/incoming/ (RLS:
 * own folder only, 5 MB, png/jpg/webp enforced by the bucket). This function then:
 *   1. checks the caller owns the paths, sniffs the magic bytes and size,
 *   2. re-encodes every image with sharp (EXIF and all other metadata dropped),
 *   3. stores the result under <uid>/<submission>/<random>.webp,
 *   4. only then creates the submission + submission_files rows (rolled back, objects included, if a
 *      later step fails — a submission never exists without its files), deletes the originals and
 *      sends the "submission received" email (sendTemplate; one row per submission, never twice).
 */
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { proofFinishSchema, sniffImage, PROOF_MAX_BYTES, PROOF_MAX_FILES } from '../src/lib/validation.ts';
import { handle, json, readJson, methodNotAllowed, clientIp, HttpError } from '../src/lib/server/http.ts';
import { rateLimit } from '../src/lib/server/ratelimit.ts';
import { adminClient, requireUser } from '../src/lib/server/supabase.ts';
import { env } from '../src/lib/server/env.ts';
import { sendTemplate, formatDate, emailLinks } from '../src/lib/server/send-template.ts';
import { firstNameOf } from '../src/lib/server/campaigns.ts';

const BUCKET = 'proofs';

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const caller = await requireUser(req);
  if (!caller.emailVerified) throw new HttpError(403, 'email_not_confirmed');
  const input = await readJson(req, proofFinishSchema);
  await rateLimit('proof', clientIp(req), caller.email);

  const sb = adminClient();
  const storage = sb.storage.from(BUCKET);

  const { data: latest } = await sb.from('submissions').select('id, status').eq('user_id', caller.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if ('resend' in input) {
    if (!latest || latest.status !== 'submitted') throw new HttpError(409, 'not_pending', 'There is no proof under review to email about.');
    const email = await sendProofReceived(sb, { caller, submissionId: latest.id });
    return json({ ok: true, submission_id: latest.id, resent: true, email: { ok: email.ok, skipped: Boolean(email.skipped) } });
  }

  for (const f of input.files) {
    if (!f.path.startsWith(`${caller.id}/incoming/`)) throw new HttpError(403, 'forbidden', 'File does not belong to you.');
  }
  if (latest && latest.status === 'submitted') throw new HttpError(409, 'already_pending', 'Your proof is already under review.');
  if (latest && latest.status === 'approved') throw new HttpError(409, 'already_approved', 'Your proof is already approved.');

  // Validate and re-encode before anything is written to the database.
  const encoded: Array<{ bytes: Buffer; originalName: string }> = [];
  for (const f of input.files.slice(0, PROOF_MAX_FILES)) {
    const { data, error } = await storage.download(f.path);
    if (error || !data) throw new HttpError(400, 'missing_file', 'Upload did not complete. Try again.');
    const buf = Buffer.from(await data.arrayBuffer());
    if (buf.byteLength > PROOF_MAX_BYTES) throw new HttpError(413, 'file_too_large', 'Each screenshot must be under 5 MB.');
    if (!sniffImage(buf)) throw new HttpError(415, 'unsupported_type', 'Only PNG, JPG or WEBP screenshots.');
    let out: Buffer;
    try {
      out = await sharp(buf, { limitInputPixels: 40_000_000, failOn: 'error' })
        .rotate()
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer();
    } catch {
      throw new HttpError(415, 'unsupported_type', 'That file is not a valid image.');
    }
    encoded.push({ bytes: out, originalName: f.name.replace(/[^\w .()-]+/g, '_').slice(0, 120) });
  }

  // The submission id is chosen here so the re-encoded files can be stored before the row exists.
  const submissionId = randomUUID();
  const stored: string[] = [];
  const rows = [];
  let submissionCreated = false;
  try {
    for (const e of encoded) {
      const path = `${caller.id}/${submissionId}/${randomUUID()}.webp`;
      const { error: upErr } = await storage.upload(path, e.bytes, { contentType: 'image/webp', upsert: false, cacheControl: '0' });
      if (upErr) throw new Error(upErr.message);
      stored.push(path);
      rows.push({ submission_id: submissionId, user_id: caller.id, file_path: path, file_name: e.originalName, file_size: e.bytes.byteLength, mime_type: 'image/webp' });
    }

    const { error: subErr } = await sb
      .from('submissions')
      .insert({ id: submissionId, user_id: caller.id, note: input.note || null, status: 'submitted', file_count: encoded.length });
    if (subErr) {
      if (subErr.code === '23505' || /duplicate|unique/i.test(subErr.message || '')) {
        throw new HttpError(409, 'already_pending', 'Your proof is already under review.');
      }
      throw new Error(subErr.message);
    }
    submissionCreated = true;

    const { error: filesErr } = await sb.from('submission_files').insert(rows);
    if (filesErr) throw new Error(filesErr.message);
  } catch (err) {
    // Roll back: no half-written submission may remain.
    if (submissionCreated) await sb.from('submissions').delete().eq('id', submissionId).then(() => {}, () => {});
    if (stored.length) await storage.remove(stored).then(() => {}, () => {});
    throw err;
  }

  await storage.remove(input.files.map((f) => f.path));
  await sb.from('activity_log').insert({ kind: 'submitted', actor_id: caller.id, submission_id: submissionId, text: `${caller.email} submitted ${encoded.length} screenshot${encoded.length === 1 ? '' : 's'}`, color: '#FBBF24', filter: 'review' });

  const email = await sendProofReceived(sb, { caller, submissionId, fileCount: encoded.length });

  return json({ ok: true, submission_id: submissionId, file_count: encoded.length, email: { ok: email.ok, skipped: Boolean(email.skipped) } });
});

async function sendProofReceived(
  sb: ReturnType<typeof adminClient>,
  opts: { caller: { id: string; email: string }; submissionId: string; fileCount?: number },
) {
  const { data: member } = await sb.from('profiles').select('email, lang, first_name, name').eq('id', opts.caller.id).maybeSingle();
  const { data: sub } = opts.fileCount == null
    ? await sb.from('submissions').select('file_count, created_at').eq('id', opts.submissionId).maybeSingle()
    : { data: { file_count: opts.fileCount, created_at: new Date().toISOString() } };
  const now = sub?.created_at ? new Date(sub.created_at) : new Date();
  const lang = member?.lang === 'ar' ? 'ar' : 'en';
  const to = member?.email || opts.caller.email;
  return sendTemplate({
    templateId: 'submission-received',
    to,
    lang,
    memberId: opts.caller.id,
    submissionId: opts.submissionId,
    vars: {
      first_name: firstNameOf(member || { email: to }),
      file_count: sub?.file_count ?? opts.fileCount ?? 0,
      submitted_at: formatDate(now, lang),
      account_email: to,
      email: to,
      dashboard_url: `${env.siteUrl}/account/access/`,
      ...emailLinks({ memberId: opts.caller.id, email: to, templateId: 'submission-received' }),
    },
  });
}
