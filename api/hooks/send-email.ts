/**
 * POST /api/hooks/send-email — GoTrue Send Email Hook.
 * Auth signs the body (Standard Webhooks). We render the same branded templates as campaigns
 * and send them over Office 365. A non-2xx response makes GoTrue fail the auth action.
 */
import { handle, json, methodNotAllowed, HttpError } from '../../src/lib/server/http.ts';
import { env } from '../../src/lib/server/env.ts';
import { sendTemplate, formatDate } from '../../src/lib/server/send-template.ts';
import { verifySvix, svixHeaders } from '../../src/lib/server/svix.ts';

interface HookBody {
  user?: { email?: string; user_metadata?: { lang?: string; first_name?: string } };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
}

function resetUrl(data: NonNullable<HookBody['email_data']>): string {
  const site = env.siteUrl.replace(/\/+$/, '');
  const hash = data.token_hash || data.token || '';
  const redirect = encodeURIComponent(data.redirect_to || `${site}/login/?type=recovery`);
  return `${site}/auth/v1/verify?token=${encodeURIComponent(hash)}&type=recovery&redirect_to=${redirect}`;
}

export default handle(async (req: Request) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  if (!env.sendEmailHookSecret) throw new HttpError(503, 'hook_unconfigured');
  const raw = await req.text();
  if (!(await verifySvix(env.sendEmailHookSecret, svixHeaders(req), raw))) {
    throw new HttpError(401, 'bad_signature');
  }
  let payload: HookBody;
  try {
    payload = JSON.parse(raw) as HookBody;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
  const email = String(payload.user?.email || '').trim().toLowerCase();
  const data = payload.email_data || {};
  const token = String(data.token || '').trim();
  if (!email || !token) throw new HttpError(400, 'invalid_input');

  const lang = payload.user?.user_metadata?.lang === 'ar' ? 'ar' : 'en';
  const first = String(payload.user?.user_metadata?.first_name || '').trim() || 'there';
  const action = String(data.email_action_type || 'signup');
  const now = formatDate(new Date(), lang);
  const common = {
    email,
    first_name: first,
    code: token,
    token,
    device: 'Talaria Flow',
    location: 'Account verification',
    time: now,
    reset_url: resetUrl(data),
    verify_url: `${env.siteUrl.replace(/\/+$/, '')}/signup/verify?email=${encodeURIComponent(email)}&code=${encodeURIComponent(token)}`,
  };

  const templateId = action === 'recovery' ? '07-password-reset' : '02-signup-code';

  const sent = await sendTemplate({ templateId, to: email, lang, vars: common });
  if (!sent.ok) throw new HttpError(502, 'send_failed', sent.error || 'email failed');
  return json({ ok: true });
});
