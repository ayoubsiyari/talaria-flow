/**
 * Server-side email send used by every API route (proof, decisions, campaigns, admin test sends).
 * Renders emails/templates.json with emails/render.js (the same renderer the admin preview uses),
 * fills merge fields HTML-escaped, sends through Resend and records one email_events row per send.
 *
 * Idempotency: a unique email_events row per (template, member, submission) and per (send_id,
 * recipient) means retries cannot double-send. Send failure is recorded and reported to Sentry;
 * callers must not fail their request because of it.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { env } from './env.ts';
import { sendSmtp } from './smtp.ts';
import { adminClient } from './supabase.ts';
import { captureException } from './sentry.ts';
import { unsubscribeKindFor, unsubscribeUrl } from './unsubscribe.ts';
import { fillTemplate } from '../escape.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const ALIAS: Record<string, string> = {
  'submission-received': '03-submission-received',
  'confirm-email': '01-confirm-email',
  'signin-code': '02-signup-code',
  'approved': '04-approved',
  'needs-resubmission': '05-needs-resubmission',
  'course-ready': '06-course-ready',
  'password-reset': '07-password-reset',
  'newsletter': '08-newsletter',
  'tools-suite-launch': '09-tools-suite-launch',
};

export type TemplateSpec = Record<string, unknown> & { file?: string; id?: string; name?: string; subject?: string; ar?: Record<string, unknown> };

export function resolveTemplateId(id: string): string {
  if (ALIAS[id]) return ALIAS[id];
  if (/^\d{2}-/.test(id)) return id;
  const found = Object.values(ALIAS).find((x) => x.startsWith(id.padStart(2, '0')));
  return found || id;
}

export function formatDate(now: Date, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(now);
  } catch {
    return now.toISOString();
  }
}

function fill(html: string, data: Record<string, unknown>): string {
  return fillTemplate(html, data);
}

type Renderer = { render: (spec: unknown, opts?: { lang?: string; baseUrl?: string }) => string };
let renderer: Renderer | null = null;

function loadRenderer(): Renderer {
  if (renderer) return renderer;
  const code = readFileSync(join(ROOT, 'emails/render.js'), 'utf8');
  const ctx: { TFEmail?: Renderer; globalThis: unknown } = { globalThis: null };
  ctx.globalThis = ctx;
  vm.runInNewContext(code, ctx);
  if (!ctx.TFEmail) throw new Error('TFEmail renderer missing');
  renderer = ctx.TFEmail;
  return renderer;
}

let specs: TemplateSpec[] | null = null;
export function loadTemplates(): TemplateSpec[] {
  if (!specs) specs = JSON.parse(readFileSync(join(ROOT, 'emails/templates.json'), 'utf8')) as TemplateSpec[];
  return specs;
}

export function findTemplate(id: string): TemplateSpec | null {
  const wanted = resolveTemplateId(id);
  return loadTemplates().find((t) => t.file === wanted || t.id === wanted) || null;
}

/** File spec plus any admin-saved email_templates rows (same merge as the preview). */
export async function resolveSendSpec(id: string): Promise<TemplateSpec | null> {
  const wanted = resolveTemplateId(id);
  const base = findTemplate(wanted);
  const spec: TemplateSpec = base ? { ...base, ar: base.ar ? { ...base.ar } : undefined } : { file: wanted, id: wanted };
  try {
    const { data } = await adminClient()
      .from('email_templates')
      .select('id, name, kind, trigger, spec, lang')
      .eq('id', wanted);
    for (const row of data || []) {
      if (!row || !row.spec) continue;
      if (row.lang === 'ar') spec.ar = row.spec as Record<string, unknown>;
      else {
        const ar = spec.ar;
        Object.assign(spec, row.spec);
        if (row.name) spec.name = row.name;
        if (row.kind) spec.kind = row.kind;
        if (row.trigger) spec.trigger = row.trigger;
        if (ar && !spec.ar) spec.ar = ar;
      }
    }
  } catch {
    /* file spec is enough when the table is unreachable */
  }
  if (!spec.blocks && !spec.subject && !base) return null;
  return spec;
}

export function templateName(id: string): string {
  const t = findTemplate(id);
  return (t && (t.name as string)) || resolveTemplateId(id);
}

/** The spec in one language: English base with the `ar` overrides applied for Arabic. */
export function localiseSpec(spec: TemplateSpec, lang: string): TemplateSpec {
  const { ar, ...en } = spec;
  if (lang === 'ar' && ar && typeof ar === 'object') return { ...en, ...ar, lang: 'ar' };
  return { ...en, lang: 'en' };
}

/** Render a spec to { html, subject } with merge fields filled (escaped). */
export function renderEmail(spec: TemplateSpec, lang: string, vars: Record<string, unknown>, subjectOverride?: string, extra?: { logoUrl?: string }): { html: string; subject: string } {
  const l = lang === 'ar' ? 'ar' : 'en';
  const localised = localiseSpec(spec, l);
  const html = fill(loadRenderer().render(localised, { lang: l, baseUrl: env.siteUrl + '/', logoUrl: extra?.logoUrl }), vars);
  const subject = fill(String(subjectOverride || localised.subject || spec.subject || ''), vars);
  return { html, subject };
}

/**
 * Footer links for a recipient. Campaign templates (06/08/09) get a signed one-click unsubscribe for
 * the matching preference (waitlist recipients: removal from the waitlist); transactional templates
 * hide the link in the footer (`unsubscribe: false`) and only get the preferences page.
 */
export function emailLinks(opts: { memberId?: string | null; email: string; templateId: string }): { unsubscribe_url: string; preferences_url: string } {
  const preferences_url = `${env.siteUrl}/account/notifications/`;
  const kind = unsubscribeKindFor(resolveTemplateId(opts.templateId));
  let unsubscribe_url: string | null = null;
  if (kind) {
    const key = env.supabaseServiceRoleKey;
    unsubscribe_url = opts.memberId
      ? unsubscribeUrl(env.siteUrl, { kind, memberId: opts.memberId }, key)
      : unsubscribeUrl(env.siteUrl, { kind: 'waitlist', email: opts.email }, key);
  }
  return { unsubscribe_url: unsubscribe_url || preferences_url, preferences_url };
}

const LOGO_CID = 'tf-logo';
const LOGO_FILE = join(ROOT, 'public/assets/email-logo-2x.png');

async function sendMail(opts: { to: string; subject: string; html: string; templateId: string }): Promise<{ id: string }> {
  if (env.smtpEnabled) {
    const inlineImages = existsSync(LOGO_FILE)
      ? [{ cid: LOGO_CID, filename: 'email-logo-2x.png', contentType: 'image/png', data: readFileSync(LOGO_FILE) }]
      : [];
    return sendSmtp({
      host: env.smtpHost,
      port: env.smtpPort,
      user: env.smtpUser,
      password: env.smtpPassword,
      from: env.smtpFrom,
      replyTo: 'support@talaria-flow.com',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      inlineImages,
    });
  }
  if (!env.resendApiKey) {
    // Fail closed in production; locally and in tests a stand-in id keeps the flow observable.
    if (env.failClosed) throw new Error('RESEND_API_KEY is not set');
    return { id: `re_local_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}` };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.resendFrom,
      reply_to: 'support@talaria-flow.com',
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      tags: [{ name: 'template_id', value: opts.templateId.replace(/[^A-Za-z0-9_-]/g, '_') }],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !data.id) throw new Error(data.message || 'Resend failed');
  return { id: data.id };
}

export interface SendTemplateOptions {
  templateId: string;
  to: string;
  lang?: string;
  vars?: Record<string, unknown>;
  memberId?: string | null;
  submissionId?: string | null;
  /** email_sends.id for campaign sends; unique per recipient */
  sendId?: string | null;
  /** Subject override (campaigns) — merge fields allowed */
  subject?: string | null;
  /** Render this spec instead of the one in templates.json (admin "send test" of an unsaved template) */
  spec?: TemplateSpec | null;
}

export type SendResult = { ok: boolean; id?: string; skipped?: boolean; error?: string };

async function findExistingEvent(
  sb: ReturnType<typeof adminClient>,
  opts: { templateId: string; to: string; memberId?: string | null; submissionId?: string | null; sendId?: string | null },
): Promise<{ id: string; status: string | null; provider_id: string | null } | null> {
  if (opts.sendId) {
    const { data } = await sb
      .from('email_events')
      .select('id, status, provider_id')
      .eq('send_id', opts.sendId)
      .eq('recipient', opts.to)
      .maybeSingle();
    return data || null;
  }
  if (opts.submissionId && opts.memberId) {
    const { data } = await sb
      .from('email_events')
      .select('id, status, provider_id')
      .eq('template_id', opts.templateId)
      .eq('member_id', opts.memberId)
      .eq('submission_id', opts.submissionId)
      .maybeSingle();
    return data || null;
  }
  return null;
}

export async function sendTemplate(opts: SendTemplateOptions): Promise<SendResult> {
  const templateId = resolveTemplateId(opts.templateId);
  const lang = opts.lang === 'ar' ? 'ar' : 'en';
  const sb = adminClient();
  let eventId: string | null = null;
  try {
    const { data: inserted, error: insErr } = await sb
      .from('email_events')
      .insert({
        template_id: templateId,
        event: 'queued',
        recipient: opts.to,
        provider_id: null,
        member_id: opts.memberId || null,
        submission_id: opts.submissionId || null,
        send_id: opts.sendId || null,
        status: 'queued',
      })
      .select('id')
      .single();
    if (insErr) {
      if (insErr.code === '23505' || /duplicate|unique/i.test(insErr.message || '')) {
        const existing = await findExistingEvent(sb, { templateId, to: opts.to, memberId: opts.memberId, submissionId: opts.submissionId, sendId: opts.sendId });
        if (!existing || existing.status === 'sent') return { ok: true, skipped: true };
        if (existing.status === 'failed') {
          const { data: claimed } = await sb
            .from('email_events')
            .update({ status: 'queued', event: 'queued', provider_id: null })
            .eq('id', existing.id)
            .eq('status', 'failed')
            .select('id')
            .maybeSingle();
          if (!claimed) return { ok: true, skipped: true };
          eventId = claimed.id;
        } else if (existing.status === 'queued' && !existing.provider_id) {
          eventId = existing.id;
        } else {
          return { ok: true, skipped: true };
        }
      } else {
        throw new Error(insErr.message);
      }
    } else {
      eventId = inserted?.id || null;
    }

    const spec = opts.spec || await resolveSendSpec(templateId);
    if (!spec) throw new Error('Unknown template ' + templateId);
    const vars = {
      ...emailLinks({ memberId: opts.memberId, email: opts.to, templateId }),
      ...(opts.vars || {}),
    };
    const { html, subject } = renderEmail(spec, lang, vars, opts.subject || undefined, env.smtpEnabled ? { logoUrl: 'cid:' + LOGO_CID } : undefined);
    const sent = await sendMail({ to: opts.to, subject, html, templateId });

    if (eventId) {
      await sb.from('email_events').update({ event: 'sent', status: 'sent', provider_id: sent.id }).eq('id', eventId);
    }
    return { ok: true, id: sent.id };
  } catch (err) {
    if (eventId) {
      await sb.from('email_events').update({ event: 'failed', status: 'failed' }).eq('id', eventId).then(() => {}, () => {});
    }
    await captureException(err, {
      templateId,
      to: opts.to,
      memberId: opts.memberId,
      submissionId: opts.submissionId,
      sendId: opts.sendId,
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
