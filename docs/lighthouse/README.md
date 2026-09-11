# Lighthouse — 2026-09-10

Lighthouse 13.4.1, Chromium via Playwright, default simulated throttling (mobile: Moto G Power / slow 4G; desktop preset). Origin: `http://127.0.0.1:5051` served by `scripts/dev-server.mjs` (same headers, redirects and compression as Vercel).

Re-run: `node scripts/lighthouse.mjs`. HTML/JSON reports are generated locally and are not committed.

| Page | Form | Performance | Accessibility | Best practices | SEO | LCP | FCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|---|
| `/` | mobile | 97 | 100 | 100 | 100 | 2.6 s | 1.6 s | 0 ms | 0 |
| `/` | desktop | 100 | 100 | 100 | 100 | 0.7 s | 0.5 s | 0 ms | 0 |
| `/course/` | mobile | 93 | 100 | 100 | 100 | 3.2 s | 1.3 s | 20 ms | 0 |
| `/course/` | desktop | 100 | 100 | 100 | 100 | 0.7 s | 0.4 s | 0 ms | 0 |
| `/login/` | mobile | 98 | 100 | 100 | 100 | 2.3 s | 1.4 s | 0 ms | 0 |
| `/login/` | desktop | 100 | 100 | 100 | 100 | 0.5 s | 0.4 s | 0 ms | 0 |

Gate: every category ≥ 90. Passed.
