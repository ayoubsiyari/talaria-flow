# P4 verification — 2026-09-09

Everything below runs from a fresh clone with `pnpm install` and no Supabase project: the Playwright
config starts `tests/mock-supabase.mjs` (GoTrue + PostgREST stand-in) and points `scripts/dev-server.mjs`
at it. Set `TEST_REAL_BACKEND=1` with a filled `.env` to run the same suite against the real project.

| Check (pre-launch P4, see `../CHECKLIST.md` and `../../DEPLOY.md`) | Result | How to reproduce |
|---|---|---|
| Lighthouse ≥ 90 on `/`, `/course/`, `/login/`, mobile + desktop | 24/24 categories ≥ 90 (lowest: performance 93, course mobile) — [../lighthouse/README.md](../lighthouse/README.md) | `pnpm dev` then `node scripts/lighthouse.mjs` |
| Contrast on every text/background pair in tokens | 41 pairs, 0 below 4.5:1 — [contrast.md](./contrast.md) | `node scripts/contrast-report.mjs` |
| Inline validation with EN + AR error copy on every form | login, reset, signup, waitlist: `forms validate inline with localised copy` × 2 langs — [playwright.txt](./playwright.txt) | `pnpm exec playwright test tests/verification.spec.js` |
| Zero broken internal links | 111 URLs across 25 documents, 0 broken — [links.txt](./links.txt) | `pnpm test:links` |
| One cyan primary per view (audit) | body ≤ 1 on every public page; the header "Create account" (Site Header.dc.html) is the only other one | `one cyan primary per view (audit)` in verification.spec.js |
| Responsive at 390 / 768 / 1024 / 1440 / 1920, no horizontal scroll | 9 public pages × 5 widths × EN/AR: `scrollWidth <= innerWidth` everywhere — samples in [responsive/](./responsive/) | same spec; set `SHOTS_DIR=…` to save every page × width × language |
| Session + language state on every page after login | member (Arabic) and admin: chip, user menu, `<html lang>` and the HttpOnly cookie hold across all account, admin and public pages; header switch back to EN sticks; logout re-arms the guard | `member:` and `admin:` tests in verification.spec.js |
| Hover contrast on every button, both languages | 24/24 pages pass (`tests/hover-contrast.spec.js`) | `pnpm exec playwright test tests/hover-contrast.spec.js` |
| Routes, redirects, 404, security headers, CSP hashes, API validation, rate limit, session cookie | `tests/routes.spec.js`, `tests/security.spec.js`, `tests/unit/*` — 49 Playwright + 13 unit tests green | `pnpm test` |

Fixes that came out of this round: unread `fetch()` bodies in the session-cookie sync kept Chromium's network
busy (visible as a never-idle page); the header "Create account" leaked through the ≤ 1000px hide rule and
pushed the header 1px past a 390px viewport; the course hero's longest link-button overflowed the 358px
column at 390px; the waitlist forms relied on the browser's own (untranslated) validation bubbles; the
poster button on the course guide had no text colour of its own; `/login/` carried a static `noindex`
while being listed in `sitemap.xml`.
