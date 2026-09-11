# Talaria Flow — publish guide for the developer

Read this first. It is the handoff: what the site does, how to put it live, and how to run it after launch. DNS record values and long checklists live in `DEPLOY.md` and `.env.example`; this file is the ordered path.

**Do not commit `.env`.** Copy `.env.example` → `.env` and fill it. The same keys go into Vercel → Settings → Environment Variables (Production **and** Preview).

---

## 1. What you are shipping

Talaria Flow is the marketing and member site for a **free order-flow course**. A visitor:

1. Opens a NinjaTrader account through the partner link (no deposit).
2. Creates a Talaria account with the **same email**.
3. Uploads **two** screenshots as proof (NinjaTrader dashboard “Welcome, \<name\>” + Web trading platform in Simulation).
4. Waits for a person to approve or ask for a resubmit from `/admin/`.
5. Gets course access by email **before 31 December 2026**. Until you flip `COURSE_RELEASED=1`, the curriculum on `/account/course/` stays locked.

The public site is **English + Arabic (RTL)**. The admin console is **English only**. Mail is sent from `support@talaria-flow.com`.

Stack: static HTML in `public/` + vanilla JS, Vercel serverless functions in `api/`, Supabase (Auth + Postgres + private `proofs` bucket), Resend, Cloudflare Turnstile, Upstash (or Vercel KV) for rate limits. **No Next.js. No Supabase Edge Functions.** Do not add a database webhook on `submissions` — it would double-send mail.

---

## 2. What the website does

### 2.1 Public (no login)

| URL | Function |
|---|---|
| `/` | Home: course pitch, waitlist for the tools suite, cookie notice |
| `/course/` | Curriculum + 17-step “how to register” tutorial (NinjaTrader → proof) |
| `/ninjatrader/` | Partner / Ecosystem page |
| `/tools/` | Tools-suite teaser + waitlist |
| `/signup/` | Create account (Turnstile, rate limit, confirm-email) |
| `/login/` | Log in, forgot password, unverified-email view |
| `/legal/privacy/`, `/legal/terms/`, `/legal/disclaimers/` | Legal, EN + AR |
| `/404` | Designed 404 (also used for `/admin/` when the visitor is not an admin) |

Language: header switch, or `?lang=en` / `?lang=ar` (also works on in-tab navigation). Cookie bar: essential vs accept; footer **Cookie settings** reopens it.

### 2.2 Member (`/account/…`)

Guest is sent to `/login/?redirect=…`. Email must be confirmed.

| Tab | Function |
|---|---|
| `/account/` | Overview: access state, course card, recent activity |
| `/account/access/` | Upload / under review / approved / needs resubmit. Two screenshots required. Pending members can **resend the confirmation email** if Resend failed |
| `/account/course/` | Seven-module list. Locked until the member is approved **and** `COURSE_RELEASED=1`. Lesson URLs like `/account/course/1/` still open this page (no player yet) |
| `/account/profile/` | Name, language, password, delete account |
| `/account/notifications/` | Course / newsletter / tools-suite prefs (review emails cannot be turned off) |

One pending submission per member. After reject they can upload again. After approve they cannot submit again.

### 2.3 Admin (`/admin/…`)

Anyone who is not an admin gets the public 404 (not a login redirect). Promote after they have signed up and confirmed:

```sql
select public.set_admin('you@talaria-flow.com', true);
```

| URL | Function |
|---|---|
| `/admin/` | Today: queue counts, recent activity |
| `/admin/members/` | Review queue: approve / reject (reason required on reject), member delete, password reset |
| `/admin/campaigns/` | Create / schedule / cancel campaigns; recipient count |
| `/admin/campaigns/history/` | Send history; **run-due** fires any scheduled send that is due (use this on the same day — the cron is daily) |
| `/admin/emails/` | Template list + delivery stats |
| `/admin/emails/new/`, `/admin/emails/:id/` | Visual editor, EN/AR, preview with merge fields, test-send to the admin’s own inbox |
| `/admin/waitlist/` | Tools-suite waitlist |

Decisions and campaigns are **server-only** (`POST /api/admin/submission`, `POST /api/admin/campaigns`). The browser never writes `submissions` or `email_sends` directly.

### 2.4 Emails

**Product mail** (this repo → Resend), bilingual, logged once in `email_events`:

| Id | When |
|---|---|
| 03 submission received | Member finishes proof upload |
| 04 approved | Admin approves |
| 05 needs resubmission | Admin rejects |
| 06 course-ready | Campaign when you announce the course |
| 08 newsletter | Campaign |
| 09 tools-suite launch | Campaign / waitlist |

Failed sends can be retried (the unique row is not treated as success if status is `failed`). Campaigns have a signed one-click unsubscribe. Transactional mail does not.

**Auth mail** (Supabase GoTrue → Resend SMTP), **English only** — paste from `supabase/templates/`:

| File | Dashboard slot |
|---|---|
| `01-confirm-email.html` | Confirm signup (`{{ .ConfirmationURL }}`) |
| `02-signup-code.html` | Magic Link **only if** you send a 6-digit OTP (`{{ .Token }}`). If Magic Link is a URL, paste 01 again |
| `07-password-reset.html` | Reset password |

### 2.5 Background jobs (Vercel Cron)

Both require `Authorization: Bearer <CRON_SECRET>`. Missing secret → 404 (route stays hidden).

| Job | Schedule | Does |
|---|---|---|
| `/api/cron/purge-proofs` | Daily 03:20 UTC | Deletes proof images 90 days after a decision; sweeps abandoned `proofs/<uid>/incoming/` files older than 24h |
| `/api/cron/send-campaigns` | Daily 08:00 UTC | Sends due `email_sends`. Hobby cannot run more often than daily; for same-day mail use admin **run-due** |

### 2.6 API (for operators)

| Route | Who | Purpose |
|---|---|---|
| `POST /api/auth/login`, `/signup`, `/reset`, `/session` | Public | Auth + HttpOnly cookie; Turnstile + 5 tries / 15 min |
| `POST /api/waitlist` | Public | Tools waitlist |
| `POST /api/proof` | Member | Finish upload (sharp re-encode, EXIF stripped) or `{ "resend": true }` to retry the receipt email |
| `DELETE /api/account/delete` | Member | Delete own account and files |
| `GET /api/unsubscribe` | Signed link | One-click unsubscribe |
| `POST /api/admin/submission` | Admin | Approve / reject |
| `GET/POST /api/admin/campaigns` | Admin | `count`, `create`, `cancel`, `run-due` |
| `POST /api/admin/member` | Admin | Delete member / send reset |
| `POST /api/admin/emails/test` | Admin | Test send to self |
| `POST /api/webhooks/resend` | Resend | Delivery events (Svix). Deduped; increments `opened_count` |

---

## 3. Publish — do this in order

You need accounts: **Supabase, Resend, Cloudflare, Upstash (or Vercel KV), Sentry, Vercel**. Domain `talaria-flow.com` on Cloudflare DNS.

Machine: **Node 22** (`.nvmrc`, 22.18+) and **pnpm 10+**:

```bash
corepack enable
corepack prepare pnpm@10 --activate
pnpm install
cp .env.example .env
```

Fill `.env` as you collect keys. Details and exact DNS rows: `DEPLOY.md`.

### Step A — Supabase

1. New project. Copy **URL** → `SUPABASE_URL`, **anon** → `SUPABASE_ANON_KEY`, **service_role** → `SUPABASE_SERVICE_ROLE_KEY`, DB URI → `SUPABASE_DB_URL`.
2. Push **all seven** migrations (do not skip the last two):

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <project-ref>
pnpm dlx supabase db push
node scripts/rls-report.mjs
```

| Migration | Why it matters |
|---|---|
| `20260905000000_talaria_backend.sql` | Tables, RLS, private `proofs` bucket |
| `20260905200000_email_templates.sql` | Templates + send log |
| `20260909000000_release_hardening.sql` | Admin tables, decision stamps, storage folders |
| `20260910120000_email_events_once.sql` | One transactional email per template × member × submission |
| `20260910140000_release_fixes.sql` | Waitlist unique, campaign FKs, server-only writes |
| `20260910180000_drop_unused_campaigns.sql` | Drops unused `public.campaigns` |
| `20260910200000_proof_once_and_webhook_dedupe.sql` | One pending proof per user; webhook dedupe |

3. Auth → URL Configuration: Site URL `https://www.talaria-flow.com`. Redirects: `/account/`, `/login/?type=recovery`, `https://www.talaria-flow.com/**` (plus `http://127.0.0.1:5051/**` for local).
4. Auth → Email: **Confirm email ON**, password min 8. Paste the three templates (§2.4).
5. After Resend SMTP exists (§B): Auth → SMTP → `smtp.resend.com`, port 465, user `resend`, password = `RESEND_API_KEY`, sender `support@talaria-flow.com`. Without this, confirm/reset mail is capped at a few per hour.
6. Seed templates and make yourself admin:

```bash
pnpm seed
```

```sql
select public.set_admin('you@talaria-flow.com', true);
```

Sign up on the live site first, confirm the email, then run `set_admin`. `/admin/` is 404 until that is done.

**No Edge Functions to deploy.**

### Step B — Resend (`support@talaria-flow.com`)

1. Domains → add `talaria-flow.com`. Add the three DNS records Resend shows (DKIM, `send` MX, `send` SPF). Cloudflare: **DNS only** (grey cloud). Verify all three.
2. Add DMARC (`_dmarc`, start `p=none`). After two weeks: `quarantine` → `reject`. See `DEPLOY.md` §2.2.
3. Receive replies: Cloudflare Email Routing for `support@…` (`DEPLOY.md` §2.3). Merge SPF if the root already has a TXT.
4. API key → `RESEND_API_KEY`. `RESEND_FROM="Talaria Flow <support@talaria-flow.com>"`.
5. Webhook: `https://www.talaria-flow.com/api/webhooks/resend`  
   Events: delivered, opened, clicked, bounced, complained. Signing secret → `RESEND_WEBHOOK_SECRET`.  
   Add this **after** the first Vercel deploy if the URL is not live yet; until then events are dropped.

### Step C — Cloudflare Turnstile + DNS

1. Turnstile widget, mode **Invisible**, hostnames `talaria-flow.com`, `www.talaria-flow.com` (and localhost for local). Site key → `TURNSTILE_SITE_KEY`, secret → `TURNSTILE_SECRET_KEY`.
2. Point the domain at Vercel, **DNS only**:

| Type | Name | Content |
|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` |
| A | `@` | `76.76.21.21` |

Primary host is **www**. Apex redirects to www.

### Step D — Upstash (or Vercel KV)

Create Redis (same region as Vercel). REST URL + token → `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.  
On any Vercel deploy these are **required**. Missing them → `500 ratelimit_unconfigured` on login, signup, reset, waitlist, proof, unsubscribe.

### Step E — Sentry (optional)

Browser JS project. DSN → `SENTRY_DSN`. Allowed domain: `www.talaria-flow.com`. Empty DSN = errors are not reported.

### Step F — Vercel

1. Import this folder (or the git repo). `vercel.json` already sets: framework none, `pnpm build`, `pnpm install --frozen-lockfile`, output `public`, headers, redirects, crons, function limits.
2. Settings → General → **Node.js 22.x**.
3. Environment variables — add **every** non-comment line of `.env.example` to **Production and Preview**. Mark sensitive: `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `CRON_SECRET`.

```bash
openssl rand -hex 32    # → CRON_SECRET
```

Do **not** set `TEST_PASSWORD` in production. Leave `COURSE_RELEASED` empty until the videos ship.

4. Domains: `www.talaria-flow.com` (primary), `talaria-flow.com` → www. Wait for TLS.
5. Deploy. `pnpm build` generates `i18n.js`, `env.js`, tutorial JS, email renderer, `templates.json`. You do not commit those files.

### Step G — Prove it is live

```bash
curl -I https://www.talaria-flow.com/          # 200 + HSTS / CSP / X-Frame-Options
curl -I https://www.talaria-flow.com/admin/     # 404 when logged out
curl -I https://www.talaria-flow.com/account/   # 307 → /login/?redirect=%2Faccount%2F
curl -s https://www.talaria-flow.com/api/cron/purge-proofs   # 404 without the secret
```

Then in a browser:

1. Sign up with a real inbox → confirm mail from `support@talaria-flow.com` (DKIM/SPF/DMARC pass).
2. Log in → upload two screenshots → `/admin/` approve → “Approved” mail arrives.
3. Resend → Webhooks shows 2xx. Admin → Emails shows counts.
4. Admin → Campaigns: count recipients, send a test to yourself, click unsubscribe.

Rollback: Vercel → Deployments → Promote previous. Database migrations are forward-only (PITR to undo).

---

## 4. After launch

| Task | How |
|---|---|
| Unlock the course for approved members | Set `COURSE_RELEASED=1` in Vercel Production and redeploy. Marketing already says “before 31 Dec 2026”. |
| Send a campaign the same day | Admin → Campaigns / History → **run-due**. Do not wait for 08:00 UTC. |
| Promote an admin | `select public.set_admin('email@…', true);` |
| Purge proofs dry-run | `pnpm purge:proofs -- --dry` or curl the cron with `?dry=1` and `CRON_SECRET` |
| Nightly DB backup | Supabase PITR (Pro) or daily backups (Free). `proofs` storage is not in DB dumps; it is purged after 90 days |
| Staging test users | `TEST_PASSWORD` + `pnpm seed:test-accounts` — **never in production** |

Test accounts (staging only), all one password:

| Email | State |
|---|---|
| `admin@talaria-flow.test` | Admin |
| `member-new@talaria-flow.test` | Confirmed, no proof |
| `member-pending@talaria-flow.test` | Under review |
| `member-approved@talaria-flow.test` | Approved |
| `member-rejected@talaria-flow.test` | Needs resubmit |

---

## 5. Run it on your machine

```bash
pnpm install
cp .env.example .env          # real Supabase keys, or the mock below
pnpm dev                      # http://127.0.0.1:5051
```

**Without a Supabase project** (UI + Playwright):

```bash
# terminal 1
node tests/mock-supabase.mjs          # :5099

# terminal 2
# SUPABASE_URL=http://127.0.0.1:5099
# SUPABASE_ANON_KEY=mock-anon-key
# SUPABASE_SERVICE_ROLE_KEY=mock-service-role-key
pnpm start
```

`src/lib/**` edits need a restart of the dev server. `api/*.ts` reloads per request.

```bash
pnpm test          # build, CSP hashes, types, unit tests, Playwright
pnpm test:links    # internal links
pnpm audit --prod
```

---

## 6. Limits you should not fight

- The **30 videos are not in this repo**. `/account/course/` is a locked list until `COURSE_RELEASED=1`. There is no lesson player.
- Proof: max 4 files, 5 MB each, PNG/JPG/WEBP, re-encoded to WebP (2400 px, no EXIF).
- Campaigns run in one 60 s function, one recipient after another. Split large lists (e.g. by language).
- Auth emails are English-only (Supabase limitation). Product mail is EN + AR.
- Preview/production **fail closed** if Turnstile, Redis/KV, Resend, or `CRON_SECRET` is missing. Local `pnpm dev` without those keys still runs.

---

## 7. Other files in this zip

| File | Use |
|---|---|
| `DEPLOY.md` | Full DNS / SMTP / webhook / curl appendix |
| `.env.example` | Every variable, with comments |
| `docs/CHECKLIST.md` | Pre-launch brief, line by line |
| `docs/DESIGN.md` | Tokens and UI rules |
| `README.md` | Repo map and local commands |
| `vercel.json` | Hosting, headers, crons, redirects |
| `supabase/migrations/` | Apply all seven with `db push` |
| `supabase/templates/` | Paste into Supabase Auth |
| `emails/` | Product templates + renderer |

This archive is the **working tree** (including publish-readiness fixes that may not be on git `HEAD` yet). It does **not** include `node_modules`, `.env`, `.git`, or agent folders. After unzip:

```bash
cd talaria-flow
pnpm install --frozen-lockfile
cp .env.example .env
# then Step A → F above
```
