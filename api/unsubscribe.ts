/**
 * GET /api/unsubscribe?m=<profile id>&k=course|newsletter|tools&t=<hmac>
 * GET /api/unsubscribe?e=<email>&k=waitlist&t=<hmac>
 *
 * One-click unsubscribe from campaign mail. The link is signed by src/lib/server/unsubscribe.ts
 * (HMAC-SHA256 with the service-role key), so no session is needed. Members get profiles.notify[k]
 * = false (merged into the JSON); waitlist addresses are deleted. Answers a small self-contained HTML
 * page; a bad or missing signature is a 400 page. Never cached, never indexed.
 */
import { handle, clientIp, HttpError } from '../src/lib/server/http.ts';
import { rateLimit } from '../src/lib/server/ratelimit.ts';
import { adminClient } from '../src/lib/server/supabase.ts';
import { env } from '../src/lib/server/env.ts';
import { parseUnsubscribe, type UnsubscribeKind } from '../src/lib/server/unsubscribe.ts';

const LABEL: Record<UnsubscribeKind, string> = {
  course: 'course announcements',
  newsletter: 'the newsletter',
  tools: 'tools-suite news',
  waitlist: 'the tools-suite waitlist',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function page(opts: { title: string; line: string; status?: number; siteUrl: string }): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="dark"><title>${esc(opts.title)} · Talaria Flow</title>
<style>html,body{margin:0;min-height:100%;background:#07080C;color:#F2F4F8;font-family:Archivo,"Helvetica Neue",Arial,system-ui,sans-serif}body{display:grid;place-items:center;padding:32px 20px;box-sizing:border-box;min-height:100vh}main{max-width:520px;width:100%;background:#0E1017;border:1px solid rgba(255,255,255,.08);border-top:3px solid #2EE8FF;border-radius:14px;padding:32px 28px}h1{margin:0 0 12px;font-size:24px;line-height:1.2;letter-spacing:-.02em}p{margin:0 0 20px;font-size:16px;line-height:1.6;color:#B7BCCB}a{color:#2EE8FF}small{display:block;font-family:"Geist Mono",Menlo,Consolas,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8B90A3;margin-bottom:14px}</style></head>
<body><main><small>Talaria Flow</small><h1>${esc(opts.title)}</h1><p>${esc(opts.line)}</p><p><a href="${esc(opts.siteUrl)}/">Back to talaria-flow.com</a></p></main></body></html>`;
  return new Response(html, {
    status: opts.status || 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
      'referrer-policy': 'no-referrer',
    },
  });
}

export default handle(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(404, 'not_found');
  const url = new URL(req.url);
  const siteUrl = env.siteUrl;
  const key = (url.searchParams.get('m') || url.searchParams.get('e') || '').toLowerCase();
  await rateLimit('unsubscribe', clientIp(req), key || 'anonymous');

  const target = parseUnsubscribe(url.searchParams, env.supabaseServiceRoleKey);
  if (!target) {
    return page({ status: 400, siteUrl, title: 'This link is not valid', line: 'The unsubscribe link is incomplete or has been altered. Open the latest email from us and use the link in its footer, or manage your preferences from your account.' });
  }

  const sb = adminClient();
  if (target.kind === 'waitlist') {
    const { error } = await sb.from('waitlist').delete().eq('email', target.email);
    if (error) throw new Error(error.message);
  } else {
    const { data: profile } = await sb.from('profiles').select('id, notify').eq('id', target.memberId).maybeSingle();
    if (profile) {
      const notify = profile.notify && typeof profile.notify === 'object' ? { ...(profile.notify as Record<string, unknown>) } : {};
      notify[target.kind] = false;
      const { error } = await sb.from('profiles').update({ notify }).eq('id', profile.id);
      if (error) throw new Error(error.message);
    }
  }
  return page({ siteUrl, title: "You're unsubscribed", line: `You're unsubscribed from ${LABEL[target.kind]}. Review or transactional emails about your own submissions are not affected.` });
});
