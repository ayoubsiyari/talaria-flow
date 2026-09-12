/**
 * Campaign sends (templates 06 / 08 / 09), server-side.
 *
 * The admin UI only posts parameters (template, audience, language, schedule) to
 * POST /api/admin/campaigns; recipients are resolved here from profiles + latest submission status
 * (or the waitlist), notification preferences are honoured, one email_sends row tracks the run and
 * one email_events row per recipient (unique per send_id + recipient) makes re-runs idempotent.
 * Scheduled rows are executed by api/cron/send-campaigns (or the admin's `run-due` action).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.ts';
import { HttpError } from './http.ts';
import { sendTemplate, resolveTemplateId, templateName, emailLinks } from './send-template.ts';
import { unsubscribeKindFor } from './unsubscribe.ts';

export const CAMPAIGN_TEMPLATES = ['06-course-ready', '08-newsletter', '09-tools-suite-launch'] as const;
export const AUDIENCES = ['approved', 'submitted', 'rejected', 'none', 'all', 'waitlist'] as const;
export const LANGS = ['all', 'en', 'ar'] as const;
export type Audience = (typeof AUDIENCES)[number];
export type CampaignLang = (typeof LANGS)[number];

export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ProfileRow {
  id: string;
  email: string;
  lang?: string | null;
  first_name?: string | null;
  name?: string | null;
  notify?: unknown;
}
export interface SubmissionRow { user_id: string; status: string; created_at?: string | null }
export interface WaitlistRow { email: string; lang?: string | null }

export interface Recipient {
  email: string;
  memberId: string | null;
  lang: 'en' | 'ar';
  firstName: string;
}

export interface AudienceQuery {
  templateId: string;
  audience: Audience;
  lang: CampaignLang;
  skipRecent?: boolean;
  memberIds?: string[] | null;
}

export function isCampaignTemplate(id: string): boolean {
  return (CAMPAIGN_TEMPLATES as readonly string[]).includes(resolveTemplateId(id));
}

/** profiles.notify is `{ course, newsletter, tools, ... }`; a missing key means opted in. */
export function prefAllows(notify: unknown, templateId: string): boolean {
  const key = unsubscribeKindFor(resolveTemplateId(templateId));
  if (!key) return true;
  if (!notify || typeof notify !== 'object') return true;
  const v = (notify as Record<string, unknown>)[key];
  return v === undefined || v === null ? true : Boolean(v);
}

/** Newest submission per user decides the member's state. */
export function latestStatusByUser(subs: SubmissionRow[]): Map<string, string> {
  const out = new Map<string, { status: string; at: number }>();
  for (const s of subs) {
    const at = s.created_at ? Date.parse(s.created_at) || 0 : 0;
    const cur = out.get(s.user_id);
    if (!cur || at >= cur.at) out.set(s.user_id, { status: s.status, at });
  }
  return new Map([...out].map(([k, v]) => [k, v.status]));
}

export function firstNameOf(p: { first_name?: string | null; name?: string | null; email?: string }): string {
  if (p.first_name) return String(p.first_name).trim();
  if (p.name) return String(p.name).trim().split(/\s+/)[0] || '';
  return '';
}

/**
 * Pure recipient selection. `recentEmails` are addresses with an email_events row inside the last 24h.
 * With `memberIds` the list is exactly those profiles (prefs do not apply); `audience` is informational.
 */
export function pickRecipients(
  data: { profiles: ProfileRow[]; submissions: SubmissionRow[]; waitlist: WaitlistRow[]; recentEmails?: Set<string> },
  q: AudienceQuery,
): Recipient[] {
  const wantLang = (l: string | null | undefined) => q.lang === 'all' || (l === 'ar' ? 'ar' : 'en') === q.lang;
  const recent = q.skipRecent ? data.recentEmails || new Set<string>() : new Set<string>();
  const seen = new Set<string>();
  const out: Recipient[] = [];
  const push = (r: Recipient) => {
    const key = r.email.toLowerCase();
    if (!key || seen.has(key) || recent.has(key)) return;
    seen.add(key);
    out.push({ ...r, email: key });
  };

  if (q.audience === 'waitlist' && !(q.memberIds && q.memberIds.length)) {
    for (const w of data.waitlist) if (w.email && wantLang(w.lang)) push({ email: w.email, memberId: null, lang: w.lang === 'ar' ? 'ar' : 'en', firstName: '' });
    return out;
  }

  const status = latestStatusByUser(data.submissions);
  const wanted = new Set(q.memberIds || []);
  for (const p of data.profiles) {
    if (!p.email) continue;
    if (wanted.size) {
      if (!wanted.has(p.id)) continue;
    } else {
      const st = status.get(p.id) || 'none';
      if (q.audience !== 'all' && st !== q.audience) continue;
      if (!wantLang(p.lang)) continue;
      if (!prefAllows(p.notify, q.templateId)) continue;
    }
    push({ email: p.email, memberId: p.id, lang: p.lang === 'ar' ? 'ar' : 'en', firstName: firstNameOf(p) });
  }
  return out;
}

export function audienceLabel(q: { audience: Audience; lang: CampaignLang; memberIds?: string[] | null }): string {
  const base = q.memberIds && q.memberIds.length
    ? `Selected members (${q.memberIds.length})`
    : ({ approved: 'Approved members', submitted: 'Under review', rejected: 'Needs resubmission', none: 'No submission yet', all: 'All members', waitlist: 'Waitlist' } as Record<Audience, string>)[q.audience];
  return q.lang === 'all' ? base : `${base} · ${q.lang.toUpperCase()}`;
}

async function loadRecent(sb: SupabaseClient, now: Date): Promise<Set<string>> {
  const since = new Date(now.getTime() - RECENT_WINDOW_MS).toISOString();
  const { data, error } = await sb.from('email_events').select('recipient').gte('created_at', since).limit(5000);
  if (error) throw new Error(error.message);
  return new Set((data || []).map((r) => String(r.recipient || '').toLowerCase()).filter(Boolean));
}

export async function resolveRecipients(sb: SupabaseClient, q: AudienceQuery, now: Date = new Date()): Promise<Recipient[]> {
  const recentEmails = q.skipRecent ? await loadRecent(sb, now) : undefined;
  if (q.audience === 'waitlist' && !(q.memberIds && q.memberIds.length)) {
    const { data, error } = await sb.from('waitlist').select('email, lang');
    if (error) throw new Error(error.message);
    return pickRecipients({ profiles: [], submissions: [], waitlist: (data || []) as WaitlistRow[], recentEmails }, q);
  }
  let profilesQuery = sb.from('profiles').select('id, email, lang, first_name, name, notify');
  if (q.memberIds && q.memberIds.length) profilesQuery = profilesQuery.in('id', q.memberIds);
  const { data: profiles, error: pErr } = await profilesQuery;
  if (pErr) throw new Error(pErr.message);
  let submissions: SubmissionRow[] = [];
  if (!(q.memberIds && q.memberIds.length) && q.audience !== 'all') {
    const { data, error } = await sb.from('submissions').select('user_id, status, created_at').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    submissions = (data || []) as SubmissionRow[];
  }
  return pickRecipients({ profiles: (profiles || []) as ProfileRow[], submissions, waitlist: [], recentEmails }, q);
}

export interface EmailSendRow {
  id: string;
  state: 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';
  template_id: string;
  template_name: string | null;
  /** human label shown in the admin history, e.g. "Approved members · EN" */
  audience: string | null;
  /** machine key used to re-resolve recipients when a scheduled send runs */
  audience_key: Audience | null;
  recipient_count: number;
  sent_count: number;
  opened_count?: number;
  scheduled_for: string | null;
  finished_at: string | null;
  created_at?: string;
  created_by: string | null;
  subject: string | null;
  lang: CampaignLang;
  note: string | null;
  member_ids: string[] | null;
  skip_recent: boolean;
  error: string | null;
}

export interface CreateCampaignInput {
  templateId: string;
  subject?: string | null;
  audience: Audience;
  lang: CampaignLang;
  skipRecent?: boolean;
  scheduledFor?: string | null;
  memberIds?: string[] | null;
  note?: string | null;
}

export function audienceKeyOf(send: { audience_key?: string | null }): Audience {
  const k = String(send.audience_key || '');
  return (AUDIENCES as readonly string[]).includes(k) ? (k as Audience) : 'all';
}

/** Execute one send: resolve recipients (unless given), send sequentially, stamp the row. */
export async function runSend(sb: SupabaseClient, send: EmailSendRow, recipients?: Recipient[], now: Date = new Date()): Promise<EmailSendRow> {
  const q: AudienceQuery = {
    templateId: send.template_id,
    audience: audienceKeyOf(send),
    lang: send.lang || 'all',
    skipRecent: Boolean(send.skip_recent),
    memberIds: send.member_ids || null,
  };
  const list = recipients || (await resolveRecipients(sb, q, now));
  await sb.from('email_sends').update({ state: 'sending', recipient_count: list.length, error: null }).eq('id', send.id);

  let sent = 0;
  let lastError: string | null = null;
  for (const r of list) {
    const res = await sendTemplate({
      templateId: send.template_id,
      to: r.email,
      lang: r.lang,
      memberId: r.memberId,
      sendId: send.id,
      subject: send.subject || undefined,
      vars: {
        first_name: r.firstName,
        note: send.note || '',
        subject: send.subject || '',
        account_email: r.email,
        email: r.email,
        dashboard_url: `${env.siteUrl}/account/access/`,
        ...emailLinks({ memberId: r.memberId, email: r.email, templateId: send.template_id }),
      },
    });
    if (res.ok) sent += 1;
    else lastError = res.error || 'send failed';
  }
  const state: EmailSendRow['state'] = list.length && sent === 0 ? 'failed' : 'sent';
  const patch = { state, sent_count: sent, recipient_count: list.length, finished_at: new Date().toISOString(), error: state === 'failed' ? lastError : null };
  const { data, error } = await sb.from('email_sends').update(patch).eq('id', send.id).select().single();
  if (error) throw new Error(error.message);
  return data as EmailSendRow;
}

export async function createCampaign(sb: SupabaseClient, input: CreateCampaignInput, createdBy: string, now: Date = new Date()): Promise<EmailSendRow> {
  const templateId = resolveTemplateId(input.templateId);
  const q: AudienceQuery = { templateId, audience: input.audience, lang: input.lang, skipRecent: Boolean(input.skipRecent), memberIds: input.memberIds || null };
  const recipients = await resolveRecipients(sb, q, now);
  const scheduledAt = input.scheduledFor ? new Date(input.scheduledFor) : null;
  const future = Boolean(scheduledAt && scheduledAt.getTime() > now.getTime());
  if (!future && recipients.length === 0) {
    throw new HttpError(400, 'empty_audience', 'Nobody to send to. They may have turned this email off, or the selection is empty.');
  }
  const row = {
    id: crypto.randomUUID(),
    state: future ? 'scheduled' : 'sending',
    template_id: templateId,
    template_name: templateName(templateId),
    audience: audienceLabel(q),
    audience_key: input.audience,
    recipient_count: recipients.length,
    sent_count: 0,
    scheduled_for: scheduledAt ? scheduledAt.toISOString() : null,
    finished_at: null,
    created_by: createdBy,
    subject: input.subject || null,
    lang: input.lang,
    note: input.note || null,
    member_ids: input.memberIds && input.memberIds.length ? input.memberIds : null,
    skip_recent: Boolean(input.skipRecent),
    error: null,
  };
  const { data, error } = await sb.from('email_sends').insert(row).select().single();
  if (error) throw new Error(error.message);
  const send = data as EmailSendRow;
  if (future) return send;
  return runSend(sb, send, recipients, now);
}

/** Claim and run every scheduled send that is due. Returns the number processed. */
export async function processDueSends(sb: SupabaseClient, now: Date = new Date()): Promise<{ processed: number; ids: string[] }> {
  const { data, error } = await sb
    .from('email_sends')
    .select('*')
    .eq('state', 'scheduled')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);
  const ids: string[] = [];
  for (const row of (data || []) as EmailSendRow[]) {
    // Claim first so a concurrent cron / admin run-due cannot process the same row twice.
    const { data: claimed } = await sb.from('email_sends').update({ state: 'sending' }).eq('id', row.id).eq('state', 'scheduled').select('id');
    if (!claimed || !claimed.length) continue;
    try {
      await runSend(sb, { ...row, state: 'sending' }, undefined, now);
    } catch (e) {
      await sb.from('email_sends').update({ state: 'failed', finished_at: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }).eq('id', row.id);
    }
    ids.push(row.id);
  }
  return { processed: ids.length, ids };
}
