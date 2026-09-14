# DEPLOY — Talaria Flow on Vercel + Supabase + Resend + Cloudflare

Follow top to bottom. Every value you collect goes into `.env` locally and into Vercel → Project → Settings → Environment Variables. `.env.example` lists every variable with a comment; nothing else is configured anywhere.

Order matters: Supabase first (you need its keys for everything), then Resend (DNS), Cloudflare (Turnstile + DNS), Upstash, Sentry, then Vercel, then the post-deploy checks.

---

## 0. Prerequisites

- Node 22 (`.nvmrc`; 22.18+ for native type stripping) and pnpm 10+ (`corepack enable && corepack prepare pnpm@10 --activate`)
- Supabase CLI ≥ 2.x (`pnpm dlx supabase --version`)
- Accounts: Supabase, Vercel, Resend, Cloudflare (domain DNS), Upstash (or Vercel KV), Sentry
- Domain `talaria-flow.com` with DNS on Cloudflare

```bash
pnpm install
cp .env.example .env      # fill as you go through the steps below
```

---

## 1. Supabase

### 1.1 Project
1. Create a project (region close to the audience, e.g. `eu-central-1`). Note the database password.
2. Project Settings → API: copy **Project URL** → `SUPABASE_URL`, **anon** → `SUPABASE_ANON_KEY`, **service_role** → `SUPABASE_SERVICE_ROLE_KEY`.
3. Project Settings → Database → Connection string (URI, direct) → `SUPABASE_DB_URL`.

### 1.2 Migrations (tables, RLS, storage, triggers)
```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <project-ref>
pnpm dlx supabase db push
```
This applies every file in `supabase/migrations/`, in order:

| File | What it does |
|---|---|
| `20260905000000_talaria_backend.sql` | profiles, submissions, submission_files, waitlist, RLS, `is_admin()`, private `proofs` bucket |
| `20260905200000_email_templates.sql` | `email_templates` (admin editor) and `email_events` (send log + Resend webhook) |
| `20260909000000_release_hardening.sql` | member fields on profiles, `reviewer_note`/`decided_at`, `campaigns` (legacy), `email_sends`, `activity_log`, storage folder policies, least-privilege grants |
| `20260910120000_email_events_once.sql` | `email_events.member_id/submission_id/status` + unique index (one transactional email per template × member × submission) |
| `20260910140000_release_fixes.sql` | `waitlist.email` unique constraint (fixes the upsert), `email_events.send_id` + FKs + status check + unique per send × recipient, `email_sends` campaign columns, "Members read own activity", admin browser writes to submissions / email_sends removed (decisions and campaigns are server-side now) |
| `20260910180000_drop_unused_campaigns.sql` | drops unused `public.campaigns` (sends live on `email_sends`) |
| `20260910200000_proof_once_and_webhook_dedupe.sql` | one `submitted` row per user; webhook events unique per provider + type |
| `20260913120000_resubmit_note.sql` | `profiles.resubmit_note` for the reason shown after a resubmission request |
| `20260913140000_profiles_blocked.sql` | `profiles.blocked` + `admin_set_blocked` (reject / restore) |
| `20260913143000_fix_admin_set_blocked.sql` | restore RPC without `session_replication_role` |
| `20260913180000_protect_admin_privileges.sql` | trigger: only `service_role` / postgres may change `is_admin`, `role`, `blocked`, `resubmit_note` |

Verify: `node scripts/rls-report.mjs` prints the policy set that is now live; Dashboard → Database → Policies should match.

### 1.3 Auth
Authentication → URL Configuration:
- Site URL: `https://www.talaria-flow.com`
- Redirect URLs: `https://www.talaria-flow.com/account/`, `https://www.talaria-flow.com/login/?type=recovery`, `https://www.talaria-flow.com/**` (and `http://127.0.0.1:5051/**` for local)

Authentication → Providers → Email: **Confirm email ON**, **Secure email change ON**, minimum password length 8. Leave "Allow new users to sign up" ON (signup goes through `/api/auth/signup`, which adds Turnstile + rate limiting on top).

Authentication → Email Templates (English only — GoTrue has one body per slot; product mail in `emails/` is bilingual):
- *Confirm signup* / *Magic Link* / *Reset password*: the live app sends **OTP codes** through `POST /api/hooks/send-email` (templates 02 and 07). Set Auth OTP expiry to 900 seconds. Paste-ins in `supabase/templates/` are unused while the hook is enabled.
The logo in these paste-ins is `https://www.talaria-flow.com/assets/email-logo-2x.png` (production origin; required because GoTrue cannot resolve a relative `/assets` path).

Authentication → SMTP: enable **Custom SMTP** and use Resend (after §2):
`host smtp.resend.com · port 465 · user resend · password <RESEND_API_KEY> · sender support@talaria-flow.com · sender name Talaria Flow`. Without this, Supabase's built-in mailer caps at ~3 emails/hour.

### 1.4 Application emails
There is nothing to deploy on the Supabase side for the site's own emails: submission received (03), approved (04), needs resubmission (05), application rejected (10) and the campaigns (06/08/09) are rendered and sent by the Node API (`src/lib/server/send-template.ts` → Resend/SMTP), each logged once in `public.email_events`. No edge functions, no database webhooks — do not add a webhook on `public.submissions`, it would double-send.

### 1.5 Seed and admin
```bash
pnpm seed                    # email templates -> public.email_templates (10 x EN/AR), over the API
psql "$SUPABASE_DB_URL" -f supabase/seed.sql   # same rows without Node; regenerate with `pnpm seed -- --sql`
pnpm seed:test-accounts      # staging only: the five *@talaria-flow.test accounts (TEST_PASSWORD)
```
Make a real user admin (after they signed up and confirmed):
```sql
select public.set_admin('you@talaria-flow.com', true);
```
`/admin/` returns 404 for everyone else.

### 1.6 Backups (nightly)
- **Pro plan or above**: Project Settings → Database → **Point in Time Recovery → Enable** (7-day window). This is continuous, so it covers the nightly requirement and more.
- **Free plan**: daily backups are automatic (Database → Backups, 7 days retained) but cannot be restored to a point in time. For an off-site copy add a scheduled dump from any machine with the CLI:
  ```bash
  # cron: 0 3 * * *
  pnpm dlx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f backup-$(date +%F).sql
  ```
  Storage (`proofs`) is not part of DB backups; it is intentionally short-lived (90-day purge, §6.3).

---

## 2. Resend — email for support@talaria-flow.com

### 2.1 Domain
Resend → Domains → **Add domain** → `talaria-flow.com`, region matching Supabase. Resend shows three records; add them in Cloudflare → DNS (proxy status **DNS only**, grey cloud):

| Type | Name | Content | Purpose |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ…` *(exact value from Resend)* | **DKIM** — signs every message |
| MX  | `send` | `feedback-smtp.eu-west-1.amazonses.com` priority `10` *(host shown by Resend for your region)* | bounce/feedback return path |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | **SPF** for the return-path subdomain |

Click **Verify** in Resend; status must be *Verified* for all three before any email is sent.

### 2.2 DMARC
Add once the domain is verified:

| Type | Name | Content |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@talaria-flow.com; fo=1; adkim=s; aspf=r` |

Run with `p=none` for two weeks while you watch the aggregate reports, then move to `p=quarantine` and finally `p=reject`. BIMI (the Gmail sender circle) needs `p=quarantine` or `p=reject`. Live DNS is already `p=quarantine`. `adkim=s` requires DKIM to align with `talaria-flow.com` (it does — Resend signs with the root domain); `aspf=r` lets the `send.` return path pass SPF alignment.

### 2.2.1 Gmail brand circle (BIMI)

The logo **inside** the email is already `email-logo-2x.png`. The grey person next to the sender name is a **Gmail avatar**. Gmail only fills that circle with BIMI + a paid certificate.

Already in this repo (served live after deploy):

- Logo: `https://www.talaria-flow.com/.well-known/bimi/logo.svg` (SVG Tiny PS, square, solid `#07080C` background)
- After you buy a VMC/CMC, put the PEM at `https://www.talaria-flow.com/.well-known/bimi/vmc.pem`

**You still have to do this (DNS + certificate). Code cannot finish it.**

1. In GoDaddy DNS (or whatever hosts `talaria-flow.com`) add:

| Type | Name | Value |
|---|---|---|
| TXT | `default._bimi` | `v=BIMI1;l=https://www.talaria-flow.com/.well-known/bimi/logo.svg;` |

2. Buy a **Verified Mark Certificate (VMC)** or **Common Mark Certificate (CMC)** for the Talaria mark from [DigiCert](https://www.digicert.com/tls-ssl/verified-mark-certificates) or Entrust. Gmail will **not** show the circle without `a=` pointing at that PEM. VMC needs a registered trademark and shows a checkmark; CMC is the cheaper “logo only” path.

3. Save the PEM as `public/.well-known/bimi/vmc.pem`, deploy, then **replace** the TXT with:

`v=BIMI1;l=https://www.talaria-flow.com/.well-known/bimi/logo.svg;a=https://www.talaria-flow.com/.well-known/bimi/vmc.pem;`

4. Wait up to 48 hours. Check [BIMI Inspector](https://bimigroup.org/bimi-generator/) and send a **new** mail to Gmail (old threads keep the old avatar).

Do not put spaces around `l=` / `a=`. The SVG must stay Tiny PS (`version="1.2"` `baseProfile="tiny-ps"`), square, no scripts, no external files.

### 2.3 Receiving mail at support@ (replies)
Resend only sends. To *receive* at `support@talaria-flow.com`, use Cloudflare → Email → Email Routing → enable, add destination inbox, then create the rule `support@talaria-flow.com → your-inbox@…`. Cloudflare adds these root records automatically:

| Type | Name | Content |
|---|---|---|
| MX  | `@` | `route1.mx.cloudflare.net` (priority 69), `route2…` (28), `route3…` (86) |
| TXT | `@` | `v=spf1 include:_spf.mx.cloudflare.net ~all` |

If the root already has an SPF record, merge into one: `v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all` (one SPF TXT per name, never two).

### 2.4 API key, sender, webhook
1. Resend → API Keys → Create (Sending access, domain `talaria-flow.com`) → `RESEND_API_KEY`.
2. `RESEND_FROM="Talaria Flow <support@talaria-flow.com>"` (reply-to is set to `support@talaria-flow.com` in code).
3. Resend → Webhooks → **Add endpoint**
   - URL: `https://www.talaria-flow.com/api/webhooks/resend`
   - Events: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
   - Copy the **Signing secret** (`whsec_…`) → `RESEND_WEBHOOK_SECRET`.
   The endpoint verifies the Svix signature and 5-minute timestamp and appends rows to `public.email_events`; unsigned requests get 401. Every send is tagged with `template_id`, so the admin → Emails page can count sent/delivered/opened per template.
4. Unsubscribe: campaign emails carry a signed one-click link to `GET /api/unsubscribe?m=<member>&k=course|newsletter|tools&t=<hmac>` (waitlist mail: `?e=<email>&k=waitlist&t=…`). The signature key is `SUPABASE_SERVICE_ROLE_KEY`; rotating that key invalidates links already sent. Transactional emails (01–05, 07) show no unsubscribe link, only "Email preferences" (`/account/notifications/`).

Verify DNS from a shell (values must match Resend's panel):
```bash
dig +short TXT resend._domainkey.talaria-flow.com
dig +short MX send.talaria-flow.com
dig +short TXT send.talaria-flow.com
dig +short TXT _dmarc.talaria-flow.com
dig +short MX talaria-flow.com
```

---

## 3. Cloudflare

### 3.1 Turnstile (bots on signup / login / reset / waitlist)
Cloudflare → Turnstile → **Add widget**: name `talaria-flow`, hostnames `talaria-flow.com`, `www.talaria-flow.com` (add `localhost` / `127.0.0.1` for local), widget mode **Invisible**. Copy Site key → `TURNSTILE_SITE_KEY`, Secret key → `TURNSTILE_SECRET_KEY`.
The four forms render the widget invisibly and `api/auth/*` + `api/waitlist` verify the token server-side. When `TURNSTILE_SECRET_KEY` is empty (local dev) verification is skipped; production must set it.

### 3.2 Site DNS → Vercel
| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` | DNS only |
| A | `@` | `76.76.21.21` | DNS only |

Vercel redirects `talaria-flow.com` → `https://www.talaria-flow.com` (set `www` as the primary domain in Vercel → Domains). Keep Cloudflare proxy **off** for these two so Vercel terminates TLS and HSTS preload works as configured in `vercel.json`. SSL/TLS mode in Cloudflare: *Full (strict)* if you ever turn the proxy on.

---

## 4. Upstash (rate limiting)
Upstash → Redis → Create database (region matching Vercel, e.g. `eu-central-1`, TLS on). REST API → copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
Rule: **5 attempts / 15 minutes per IP+email** on login, signup, reset, waitlist, proof and unsubscribe (`src/lib/server/ratelimit.ts`). Vercel KV works the same — set `KV_REST_API_URL` / `KV_REST_API_TOKEN` instead. In production (`VERCEL_ENV=production`) the store is mandatory: without it those routes answer `500 ratelimit_unconfigured` (fail closed). Locally the limit falls back to an in-memory window per process. The client address is taken from `x-vercel-forwarded-for` / `x-real-ip` (set by Vercel), then the right-most public hop of `x-forwarded-for`.

---

## 5. Sentry
Sentry → Create project → **Browser JavaScript** (one project serves both sides). Copy the DSN → `SENTRY_DSN`.
- Browser: `public/assets/js/sentry.js` reports uncaught errors and unhandled rejections (no PII, no replay, no performance tracing). It is a no-op when the DSN is empty.
- Server: every `api/*` 500 goes through `src/lib/server/sentry.ts` with route + method only — no bodies, cookies or tokens.
Sentry → Project → Settings → Security & Privacy → **Allowed Domains**: `www.talaria-flow.com`. The CSP in `vercel.json` already allows `*.ingest.sentry.io` and `*.ingest.de.sentry.io`.

---

## 6. Vercel

### 6.1 Import
Vercel → Add New → Project → import the repository (or `vercel deploy` from the folder). The project settings are encoded in `vercel.json` and need no clicking: `"framework": null` (Other), `buildCommand: pnpm build`, `installCommand: pnpm install --frozen-lockfile`, `outputDirectory: public`. Set **Node.js version: 22.x** in Settings → General (also pinned by `.nvmrc` and `package.json#engines`).

`vercel.json` also carries: clean URLs, trailing slashes, security headers (CSP with script hashes, HSTS preload, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy), redirects, rewrites, the two crons and per-function limits (`api/proof.ts` 60 s / 1024 MB for the sharp re-encode; `api/admin/campaigns.ts` and `api/cron/send-campaigns.ts` 60 s).

`pnpm build` (`scripts/build.mjs`) generates everything under `public/` that is not committed: `public/assets/js/i18n.js` (from `src/i18n/*.json`), `public/assets/js/env.js` (public env keys), `public/assets/js/emails-render.js` (copy of `emails/render.js`, the single email renderer), `public/assets/js/tutorial/*.js` (JSX stripped) and `public/assets/emails/templates.json`. All of them are in `.gitignore`.

### 6.2 Environment variables
Add every non-comment line of `.env.example` to Production (and Preview). Mark these **Sensitive**: `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `CRON_SECRET`. Generate `CRON_SECRET` with `openssl rand -hex 32`. Do **not** set `TEST_PASSWORD` in production.

`pnpm build` writes `public/assets/js/env.js` from the **public** keys only (`SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TURNSTILE_SITE_KEY`, `SENTRY_DSN`, `COURSE_RELEASED`) and refuses to run if a secret-looking name slips into that list.

### 6.3 Crons
`vercel.json` → `crons`. Vercel sends `Authorization: Bearer <CRON_SECRET>`; anything else gets 404.

| Path | Schedule | Job |
|---|---|---|
| `GET /api/cron/purge-proofs` | `20 3 * * *` (daily 03:20 UTC) | deletes screenshots of submissions decided more than 90 days ago, removes `submission_files` rows, stamps `files_purged_at`, and sweeps abandoned `proofs/<uid>/incoming/` uploads older than 24h |
| `GET /api/cron/send-campaigns` | `0 8 * * *` (daily 08:00 UTC) | executes every `email_sends` row with `state = 'scheduled'` whose `scheduled_for` has passed (claims the row first, so two runs never double-send) |

**Plan note:** Hobby runs each cron at most daily, so the schedule is daily on purpose. Same-day sends: the admin console calls `POST /api/admin/campaigns {"action":"run-due"}` when it opens Send history. Vercel Pro can tighten the schedule later if needed. `CRON_SECRET` is required on every Vercel deploy (production and preview); without it both cron routes 404 / fail closed.

Run by hand or dry-run:
```bash
pnpm purge:proofs -- --dry
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.talaria-flow.com/api/cron/purge-proofs?dry=1"
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.talaria-flow.com/api/cron/send-campaigns"
```
Vercel → Project → Settings → Cron Jobs shows the last runs.

### 6.4 Course unlock
Approved members see a locked curriculum until you flip the public flag. Set `COURSE_RELEASED=1` in Vercel (Production) and redeploy, or set `window.__TF_COURSE_RELEASED = true` for a one-off. Empty / unset keeps the course locked. Marketing copy already says access lands before 31 December 2026.

### 6.5 API routes (for reference)
All under `/api/`, JSON in / JSON out, wrapped by `src/lib/server/http.ts` (zod-validated, 404 for non-admins on admin routes):

| Route | Who | Purpose |
|---|---|---|
| `POST /api/auth/login`, `/signup`, `/reset`, `/session` | public | Turnstile + rate limit in front of Supabase Auth; HttpOnly session cookie |
| `POST /api/waitlist` | public | tools-suite waitlist (Turnstile, rate limit, lower-cased, unique) |
| `POST /api/proof` | member | finish a proof upload: re-encode, store, create submission + files, send 03 |
| `DELETE /api/account/delete` | member | delete own account and files |
| `GET /api/unsubscribe` | signed link | one-click unsubscribe (see §2.4) |
| `POST /api/admin/submission` | admin | approve / reject a submission; writes the decision, logs it, sends 04 / 05 |
| `GET/POST /api/admin/campaigns` | admin | list sends; `count`, `create` (now or scheduled), `cancel`, `run-due` |
| `POST /api/admin/member` | admin | delete member / send password reset |
| `POST /api/admin/emails/test` | admin | send a saved or unsaved template to the admin's own address |
| `POST /api/webhooks/resend` | Resend | delivery events → `email_events` (Svix-signed) |
| `GET /api/cron/purge-proofs`, `/send-campaigns` | Vercel cron | see §6.3 |

Decisions and campaigns are **server-side only**: the browser never updates `submissions` or `email_sends` directly (the policies were removed in the fifth migration), so every decision email and every campaign goes through the same idempotent `email_events` log.

### 6.6 Domains
Vercel → Domains: add `www.talaria-flow.com` (primary) and `talaria-flow.com` (redirect to www). Wait for the certificate, then confirm `curl -I https://www.talaria-flow.com/` shows the headers from `vercel.json`.

---

## 7. Post-deploy checks
```bash
curl -I https://www.talaria-flow.com/                      # 200 + HSTS/CSP/XFO headers
curl -I https://www.talaria-flow.com/admin/                 # 404 anonymous
curl -I https://www.talaria-flow.com/account/               # 307 -> /login/?redirect=%2Faccount%2F
curl -s -X POST https://www.talaria-flow.com/api/webhooks/resend -d '{}' -H 'content-type: application/json'   # 401 bad_signature
curl -s https://www.talaria-flow.com/api/cron/purge-proofs  # 404 without CRON_SECRET
curl -s https://www.talaria-flow.com/api/cron/send-campaigns  # 404 without CRON_SECRET
curl -s -i "https://www.talaria-flow.com/api/unsubscribe?m=x&k=course&t=bad"   # 400 HTML page, no-store, noindex
```
Then in the browser: sign up with a real address → confirm email arrives from `support@talaria-flow.com` (check the DKIM/SPF/DMARC "pass" lines in the message headers) → log in → upload two screenshots → approve from `/admin/` (calls `POST /api/admin/submission`) → "Approved" email arrives → Resend → Webhooks shows 2xx deliveries → admin → Emails shows the counts → admin → Campaigns: recipient counter matches `action: count`, a test campaign to "Selected members" (yourself) arrives with a working unsubscribe link.

The admin console is English-only by design; the member site is EN/AR.

Rollback: Vercel → Deployments → Promote the previous deployment. Database changes are forward-only; restore via PITR if a migration has to be undone.
