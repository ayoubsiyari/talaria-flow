# Emails

One renderer, one JSON spec per template. Nothing is hand-edited HTML.

- `render.js` — `TFEmail.render(spec, opts)` returns a complete, email-client-safe HTML document (tables, inline styles, 600px, dark). The single source of truth: the server loads it through `node:vm` (`src/lib/server/send-template.ts`) and `pnpm build` copies it to `public/assets/js/emails-render.js` for the admin preview (`window.TFEmail`). `opts.lang` (`'en' | 'ar'`) applies the spec's `ar` overrides (button hrefs / image srcs are inherited from the English blocks when the Arabic block omits them); `opts.baseUrl` (default `https://www.talaria-flow.com/`) or `opts.logoUrl` control where the logo loads from. Also exports `bidi(text)` (LTR isolate for Latin runs inside RTL copy), `blocks` (the block type list) and `colors`.
- `templates.json` — ten templates. Each has `file`, `name`, `trigger`, `kind` (`auto` | `campaign`), `subject`, `preheader`, `eyebrow`, `title`, optional `accent` (`#2EE8FF` default · `#FBBF24` under review · `#FF37B0` rejection/launch), `unsubscribe: false` on every transactional template (01–05, 07, 10), and `blocks[]`. Seeded into `public.email_templates` by `scripts/seed.ts`; `pnpm build` copies it to `public/assets/emails/templates.json` for the admin preview.

| # | id | Sent by | Merge fields |
|---|---|---|---|
| 01 | confirm-email | Fallback Auth paste-in (live path uses the send-email hook + 02) | email, token |
| 02 | signup-code | `POST /api/hooks/send-email` (signup OTP) | code, device, location, time |
| 03 | submission-received | `POST /api/proof` | file_count, submitted_at |
| 04 | approved | `POST /api/admin/submission` (approve) | — |
| 05 | needs-resubmission | `POST /api/admin/submission` (resubmit) | reason |
| 10 | application-rejected | `POST /api/admin/submission` (reject / block) | reason |
| 06 | course-ready | campaign (`POST /api/admin/campaigns`), pref `course` | note |
| 07 | password-reset | send-email hook (recovery OTP) | email, token / code |
| 08 | newsletter | campaign, pref `newsletter`; waitlist audience too | subject, preheader, issue_label, title, intro, hero_image_url, hero_image_alt, section_*_title/body, cta_label, cta_url, body (AR) |
| 09 | tools-suite-launch | campaign, pref `tools`; waitlist audience | hero_image_url |

Always available: `email`, `account_email`, `first_name`, `dashboard_url`, `unsubscribe_url`, `preferences_url`. Merge fields are `{{snake_case}}` and are substituted after render, per recipient, HTML-escaped. `unsubscribe_url` is a signed link (`GET /api/unsubscribe` shows a confirm page; `POST` applies). Mail clients that POST List-Unsubscribe still work. HMAC uses `UNSUBSCRIBE_SECRET` (falls back to the service role). Pref keys: 06 → course, 08 → newsletter, 09 → tools; waitlist recipients → waitlist removal. `preferences_url` is `/account/notifications/`. OTP in 02 and 07 is valid for **15 minutes**.

## Block types
`p` · `h2` · `button {label, href, variant?:'outline', fallback?:false}` · `callout {label?, text, color?}` · `code {value, note?}` · `kv {rows:[[k,v]]}` · `steps {items[]}` · `list {items[]}` · `image {src, alt}` · `status {text, color}` · `divider` · `spacer {height?}`

## Rules
- Sender `Talaria Flow <support@talaria-flow.com>`, reply-to `support@talaria-flow.com`, via Resend. DNS (SPF, DKIM, DMARC) is documented in `DEPLOY.md`.
- Arabic: `render(spec, { lang: 'ar' })`; the renderer sets `<html lang="ar" dir="rtl">`, right-aligns the card, isolates Latin runs (`dir="ltr"`), keeps the footer LTR and uses the font stack `Cairo, Segoe UI, Tahoma`. Compliance lines in the footer stay English.
- Logo: `https://www.talaria-flow.com/assets/email-logo-2x.png` (PNG — Gmail and Outlook do not render SVG). One CTA per email, cyan `#2EE8FF` with `#04141A` text, 10px radius. No other images, no gradients.
- Footer: legal entity, NinjaTrader non-affiliation, support email; unsubscribe link on campaign mail only.
- Every send is one row in `public.email_events` (`queued` → `sent` | `failed`, tagged `template_id`, linked to `member_id` / `submission_id` / `send_id`). A unique index per template × member × submission and per send × recipient makes retries idempotent. Delivery events (`email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`) arrive at `POST /api/webhooks/resend` (Svix signature verified with `RESEND_WEBHOOK_SECRET`) and are appended to `email_events`; the admin "Email templates" page reads its counts from there.

## Supabase Auth templates
Live signup/reset mail goes through `POST /api/hooks/send-email` (templates 02 and 07, 6-digit OTP, 15 minutes). Fallback HTML with GoTrue placeholders lives in `supabase/templates/` — only paste those into the dashboard if the hook is off (DEPLOY.md §1.3).
