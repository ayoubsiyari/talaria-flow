# Talaria Flow

Talaria Flow is the marketing and member site for a free order-flow trading course. A visitor opens a NinjaTrader account through the partner link, creates a Talaria account, uploads two screenshots as proof (the NinjaTrader web dashboard showing "Welcome, <name>" and the Web trading platform in Simulation), and an admin approves or asks for a resubmission from `/admin/`. Approved members get the course materials by email before 31 December 2026. The site is bilingual (English / Arabic, RTL) and sends nine transactional and campaign emails from `support@talaria-flow.com`.

**Publishing this site:** start with `PUBLISH.md` (what the product does + ordered go-live steps). DNS and long checklists are in `DEPLOY.md`.

## Stack

| Layer | What | Where in the repo |
|---|---|---|
| Frontend | Static HTML per route with a small SPA layer (soft navigation, i18n, tutorial player), no framework, no build step for the markup | `public/`, `src/i18n`, `src/tutorial`, `public/assets/css/tokens.css` |
| Edge / API | Vercel Edge Middleware (session guard for `/account/*`, 404 for `/admin/*`) and Vercel Serverless Functions (Node 22) for auth, uploads, waitlist, admin decisions, campaigns, unsubscribe, webhooks, crons | `middleware.ts`, `api/**`, `src/lib/server/**` |
| Data & auth | Supabase: Postgres with RLS, Auth (email + password, PKCE), private `proofs` storage bucket. No edge functions — every write that is not a member's own profile goes through `api/*` with the service role | `supabase/migrations` (7 files), `supabase/seed.sql`, `supabase/templates` (Auth email paste-ins) |
| Email | Resend (sending + delivery webhooks), one renderer (`emails/render.js`, also served to the admin preview as a generated copy) and nine JSON template specs, EN + AR; campaigns + signed one-click unsubscribe | `emails/`, `src/lib/server/{send-template,campaigns,unsubscribe}.ts`, `api/webhooks/resend.ts` |
| Bots | Cloudflare Turnstile (invisible) on signup, login, reset, waitlist | `src/lib/server/turnstile.ts`, `public/assets/js/supabase-client.js` |
| Rate limiting | Upstash Redis or Vercel KV (REST), 5 attempts / 15 min per IP+email | `src/lib/server/ratelimit.ts` |
| Errors | Sentry, browser + server, DSN-only (no SDK bundle) | `public/assets/js/sentry.js`, `src/lib/server/sentry.ts` |
| Hosting | Vercel (`vercel.json`: build/install/output settings, headers, redirects, rewrites, function limits, two crons) | `vercel.json`, `.nvmrc` |

## Prerequisites

- Node 22 (`.nvmrc`; 22.18 or newer — the scripts run TypeScript directly with Node's type stripping) and pnpm 10+ (`corepack enable && corepack prepare pnpm@10 --activate`)
- Supabase CLI 2.x via `pnpm dlx supabase`
- Accounts: Supabase, Vercel, Resend, Cloudflare (domain DNS + Turnstile), Upstash or Vercel KV, Sentry
- For the browser tests: `pnpm exec playwright install chromium`

## `.env` variables

Copy `.env.example` to `.env`. Keys marked public are copied into `public/assets/js/env.js` by `pnpm build`; everything else stays server-side.

| Name | Where to get it | Required | Public |
|---|---|---|---|
| `SITE_URL` | Canonical origin, `https://www.talaria-flow.com` | yes | yes |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL | yes | yes |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon | yes | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role | yes | no |
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → Connection string (URI) | for `supabase db push`, `seed.sql`, dumps | no |
| `TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → widget (mode Invisible) | yes | yes |
| `TURNSTILE_SECRET_KEY` | same widget → secret | yes in production — the API answers `500 turnstile_unconfigured` without it (empty = checks skipped locally) | no |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash → database → REST API (or `KV_REST_API_URL` / `KV_REST_API_TOKEN` from Vercel KV) | yes in production — `500 ratelimit_unconfigured` without it (in-memory window locally) | no |
| `RESEND_API_KEY` | Resend → API Keys | yes in production — sends are recorded as failed without it (local: `re_local_*` stand-in ids) | no |
| `RESEND_FROM` | `Talaria Flow <support@talaria-flow.com>` | yes | no |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks → endpoint → Signing secret (`whsec_…`) | yes | no |
| `SENTRY_DSN` | Sentry → Project → Client Keys | optional (empty = disabled) | yes |
| `CRON_SECRET` | `openssl rand -hex 32`; Vercel sends it to `/api/cron/*` | yes on every Vercel deploy | no |
| `COURSE_RELEASED` | `1` when the 30-video course should unlock for approved members; empty until then | no (empty = locked) | yes |
| `TEST_PASSWORD` | your choice, min 8 chars, for the five test accounts | staging/local only | no |

`VERCEL_ENV` / `NODE_ENV` are set by the platform; any Vercel env (and `NODE_ENV=production`) switches the fail-closed checks above on (`env.failClosed`).

## Local run

```bash
pnpm install
cp .env.example .env         # fill at least SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
pnpm dev                     # build generated assets, then serve http://127.0.0.1:5051
```

`scripts/dev-server.mjs` mirrors Vercel locally: same `vercel.json` headers, redirects, rewrites, compression, the edge middleware and the `api/*` functions (re-imported per request, so `api/*.ts` edits are live; `src/lib/**` edits need a restart). Without a Supabase project, point it at the mock backend: start `node tests/mock-supabase.mjs` (port 5099) and run the dev server with `SUPABASE_URL=http://127.0.0.1:5099 SUPABASE_ANON_KEY=mock-anon-key SUPABASE_SERVICE_ROLE_KEY=mock-service-role-key`.

### Generated assets

`pnpm build` (`scripts/build.mjs`) writes every file under `public/` that is not committed — all of them are in `.gitignore`:

| Generated file | Source |
|---|---|
| `public/assets/js/i18n.js` | `src/i18n/en.json` + `ar.json` |
| `public/assets/js/env.js` | public keys from `.env` / `process.env` |
| `public/assets/js/emails-render.js` | `emails/render.js` — the single email renderer (server via `vm`, admin preview via `window.TFEmail`) |
| `public/assets/js/tutorial/*.js` | `src/tutorial/*.jsx` (JSX stripped) |
| `public/assets/emails/templates.json` | `emails/templates.json` (admin preview / campaign editor) |

## Migrations

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <project-ref>
pnpm dlx supabase db push                       # supabase/migrations/*.sql, in order
node scripts/rls-report.mjs                     # prints the policy set that is now live
```

The seven migrations, in order: `20260905000000_talaria_backend.sql` (schema, RLS, `proofs` bucket), `20260905200000_email_templates.sql` (`email_templates`, `email_events`), `20260909000000_release_hardening.sql` (profile fields, decision stamps, admin tables, storage folders), `20260910120000_email_events_once.sql` (one transactional email per template × member × submission), `20260910140000_release_fixes.sql` (waitlist unique constraint, `email_events.send_id` + FKs, `email_sends` campaign columns, server-only writes for decisions and campaigns), `20260910180000_drop_unused_campaigns.sql` (drops unused `public.campaigns`), `20260910200000_proof_once_and_webhook_dedupe.sql` (one pending proof per user, webhook dedupe). Details in `PUBLISH.md` and `DEPLOY.md` §1.2.

Then configure Auth (URLs, "Confirm email" on, custom SMTP via Resend, the three auth email templates from `supabase/templates/`) — step 1.3 in `DEPLOY.md`. There are no edge functions to deploy.

## API and background jobs

| Route | Purpose |
|---|---|
| `POST /api/auth/{login,signup,reset,session}` | Turnstile + rate limit in front of Supabase Auth, HttpOnly session cookie |
| `POST /api/waitlist` | tools-suite waitlist |
| `POST /api/proof` | finish a proof upload (re-encode with sharp, store, create submission, send "submission received") |
| `POST /api/admin/submission` | approve / reject: writes the decision, logs to `activity_log`, sends "approved" / "needs resubmission" |
| `GET/POST /api/admin/campaigns` | campaigns are server-side: `count` recipients, `create` (send now or schedule), `cancel`, `run-due`; `GET` lists `email_sends` |
| `POST /api/admin/member`, `POST /api/admin/emails/test` | member admin, test send to the admin's own address (saved template id or unsaved spec) |
| `GET /api/unsubscribe` | signed one-click unsubscribe from campaign mail (`profiles.notify[kind] = false`, or waitlist removal) |
| `POST /api/webhooks/resend` | Resend delivery events → `email_events` |
| `GET /api/cron/purge-proofs` (daily 03:20 UTC), `GET /api/cron/send-campaigns` (daily 08:00 UTC) | proof retention purge; scheduled campaign runner. Hobby is limited to daily crons — for a same-day send use the admin UI's `run-due` |

## Seed

```bash
pnpm seed                    # emails/templates.json -> public.email_templates (9 templates x EN/AR), via the API
# or, with psql:
psql "$SUPABASE_DB_URL" -f supabase/seed.sql   # same rows; regenerate the file with `pnpm seed -- --sql`
```

`supabase/seed.sql` also documents the admin placeholder: profiles are created by the `on_auth_user_created` trigger, so the first admin signs up like a member and is then promoted (see "Admin" below).

## Test accounts

Staging and local projects only. Set `TEST_PASSWORD` in `.env`, then:

```bash
pnpm seed:test-accounts            # idempotent; add -- --dry to preview
```

| Email | State |
|---|---|
| `admin@talaria-flow.test` | admin (`is_admin`, `role = 'admin'`); `/admin/` opens |
| `member-pending@talaria-flow.test` | one submission, status `submitted` (in the review queue) |
| `member-approved@talaria-flow.test` | one submission, status `approved`; Arabic UI |
| `member-rejected@talaria-flow.test` | one submission, status `rejected`, with a reviewer note |
| `member-new@talaria-flow.test` | confirmed account, no submission yet |

All five share `TEST_PASSWORD`. Submissions are database rows (`file_count = 2`) without files in the bucket. `pnpm test` does not need any of this: the Playwright suite runs against `tests/mock-supabase.mjs`; set `TEST_REAL_BACKEND=1` to run it against these accounts instead.

## Deploy

Start with `PUBLISH.md`. `DEPLOY.md` has the DNS / SMTP / webhook appendix. The Vercel project settings live in `vercel.json` (`framework: null`, `buildCommand: pnpm build`, `installCommand: pnpm install --frozen-lockfile`, `outputDirectory: public`, function limits, crons); only the Node.js version (22.x) is set in the dashboard. `pnpm package` (`scripts/package.mjs`) archives **git HEAD only** — this working tree (including unpublished fixes) is zipped separately as `talaria-flow-publish-*.zip`.

## Admin

- URL: `https://www.talaria-flow.com/admin/` (overview, members/review queue, campaigns, email templates, waitlist). Anyone without an admin session gets a 404, not a redirect. The admin console is English-only by design.
- Decisions (`POST /api/admin/submission`) and campaigns (`POST /api/admin/campaigns`) are executed server-side with the service role; the browser only reads.
- Make a user admin after they signed up and confirmed their email:

```sql
select public.set_admin('you@talaria-flow.com', true);   -- SQL editor or psql; false demotes
```

`is_admin()` (SQL, security definer) is what every RLS policy and the middleware's profile check rely on; members cannot change `is_admin` / `role` on their own row (trigger `protect_profile_privileges`).

## Design system

`docs/DESIGN.md`: tokens, style rules and the component inventory. Tokens live in `public/assets/css/tokens.css` (the single source; there is no separate contract copy), fonts in `public/fonts/` (OFL licences in `public/fonts/licenses/`), page markup in `public/**/index.html`, behaviour in `public/assets/js/`. Verification evidence (Lighthouse, contrast, links, responsive, session state) is under `docs/lighthouse/` and `docs/verification/`; the full pre-launch checklist is `docs/CHECKLIST.md`.

## Tests

```bash
pnpm test          # build, CSP hashes, tsc, 24 unit tests (validation, svix, emails EN/AR x9, campaign resolver, unsubscribe signatures, clientIp, rate limit, cookie), Playwright suite
pnpm test:links    # crawl every internal link and asset
node scripts/lighthouse.mjs      # with `pnpm dev` running in another terminal
pnpm audit         # production dependencies
```

## Known limitations

- The course itself (thirty videos) is not in this repo: `/account/course/` shows the locked module list until `COURSE_RELEASED=1`; there is no lesson player. Release is also announced by the "course ready" campaign email.
- Uploads are re-encoded with `sharp` inside a Vercel function (max 4 files x 5 MB per submission, downscaled to 2400 px, EXIF stripped); files over 5 MB are rejected, not compressed.
- Rate limiting falls back to an in-memory window when neither Upstash nor Vercel KV is configured — locally only; in production the routes fail closed (`500 ratelimit_unconfigured`).
- Turnstile is skipped when `TURNSTILE_SECRET_KEY` is empty (local development); production fails closed (`500 turnstile_unconfigured`).
- Campaign sends run inside one function invocation (60 s), sequentially through Resend; for audiences beyond a few hundred recipients schedule several sends (e.g. by language) rather than one.
- Scheduled campaigns depend on the daily 08:00 UTC cron; for a same-day send use admin Send history → `run-due`.
- The Supabase Auth emails (confirm, code, reset) are sent by Supabase's SMTP, not by the site; paste the templates from `supabase/templates/` and configure Resend as custom SMTP, otherwise the built-in mailer caps at a few emails per hour.
- Admin is English-only by design; the member site is EN/AR.
- Cookie notice on first visit (essential vs accept); footer **Cookie settings** reopens it. No analytics. Auth session and language preference are stored (stated on `/legal/privacy/`).
